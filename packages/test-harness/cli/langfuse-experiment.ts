#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Command, InvalidArgumentError } from 'commander';
import { generateGroup, type GeneratedGroup } from '../agents/player';
import { ARCHETYPES } from '../archetypes/definitions';
import type { ArchetypeId } from '../archetypes/types';
import { NARRATOR_MODEL_MAP, type NarratorModel } from '../agents/narrator';
import { saveSessionReport } from '../report/markdown';
import { codexStats } from '../ai/codex-local';
import { deserializeCheckpoint } from '../checkpoint/schema';
import { getStory } from '../stories/loader';
import {
  getSystemPrompt,
  PROMPT_STYLES,
  type PromptStyle,
} from '../prompts/loader';
import { runSession, type SessionResult } from '../session/runner';
import {
  evaluateWithGemini,
  saveGeminiEvaluation,
} from '../report/gemini-eval';
import {
  aggregateRun,
  evaluationScores,
  getLangfuse,
  gitCommit,
  performanceScores,
  shutdownLangfuse,
  stableItemId,
  sessionInput,
  sessionOutput,
} from '../langfuse';

export interface PlayerGroupInput {
  storyId: string;
  archetypes: ArchetypeId[];
  group: GeneratedGroup;
}

export function positiveInteger(value: string): number {
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  ) {
    throw new InvalidArgumentError('Expected a positive integer');
  }
  return Number(value);
}

export async function runExperiment(options: {
  story: string;
  variants: string;
  items: number;
  maxTurns: number;
  narrator: string;
  players: number;
  offline?: boolean;
  rejudgeSessions?: string;
  runLabel?: string;
}): Promise<void> {
  const story = getStory(options.story);
  const variants = [
    ...new Set(options.variants.split(',').map((s) => s.trim())),
  ] as PromptStyle[];
  if (variants.some((v) => !PROMPT_STYLES.includes(v)))
    throw new Error('Unknown prompt variant');
  if (!(options.narrator in NARRATOR_MODEL_MAP))
    throw new Error('Unknown narrator model');
  if (options.players > 5) throw new Error('--players must be between 1 and 5');
  const rejudgeIds = options.rejudgeSessions?.split(',').map((id) => id.trim());
  if (rejudgeIds && (
    rejudgeIds.length !== variants.length * options.items ||
    rejudgeIds.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))
  )) throw new Error('--rejudge-sessions requires one session per item, in variant then item order');
  if (rejudgeIds && options.offline)
    throw new Error('--rejudge-sessions requires Langfuse');
  if (options.offline) {
    // Offline is explicit: never initialize telemetry even if credentials are inherited.
    process.env.LANGFUSE_PUBLIC_KEY = '';
    process.env.LANGFUSE_SECRET_KEY = '';
    if (
      options.narrator !== 'codex-local' ||
      [
        'PULSE_PLAYER_MODEL',
        'PULSE_CLASSIFIER_MODEL',
        'PULSE_JUDGE_MODEL',
      ].some((key) => process.env[key] !== 'codex-local') ||
      (process.env.PULSE_NARRATOR_MODEL &&
        process.env.PULSE_NARRATOR_MODEL !== 'codex-local')
    ) {
      throw new Error(
        '--offline requires narrator, players, classifier and judge on codex-local',
      );
    }
    const started = Date.now();
    const results = [];
    for (let index = 0; index < options.items; index++) {
      const archetypes = Array.from(
        { length: options.players },
        (_, i) =>
          ARCHETYPES[(index * options.players + i) % ARCHETYPES.length].id,
      );
      const group = await generateGroup(
        {
          storyId: story.id,
          title: story.title,
          description: story.description || 'Unknown setting',
          genre: 'Interactive fiction',
        },
        archetypes,
      );
      for (const variant of variants) {
        const session = await runSession({
          story: {
            storyId: story.id,
            storyTitle: story.title,
            storySetting: story.description || 'Unknown setting',
            storyGenre: 'Interactive fiction',
          },
          storyGuide: story.storyGuide,
          systemPrompt: getSystemPrompt(story.storyGuide, 'english', variant),
          narratorModel: 'codex-local',
          promptStyle: variant,
          archetypes,
          preGeneratedGroup: structuredClone(group),
          groupSize: options.players,
          maxTurns: options.maxTurns,
        });
        const report = await saveSessionReport(session, undefined, {
          geminiEval: false,
        });
        if (session.outcome === 'failed')
          throw new Error(
            `Session failed: ${session.error}; report: ${report}`,
          );
        const evaluation = await evaluateWithGemini(
          session,
          session.config.systemPrompt,
          session.config.storyGuide,
          false,
        );
        const sessionDir = `sessions/${session.sessionId}`;
        await saveGeminiEvaluation(evaluation, sessionDir);
        const result = {
          sessionId: session.sessionId,
          variant,
          outcome: session.outcome,
          turns: session.finalTurn,
          report,
          scores: evaluationScores(evaluation),
        };
        results.push(result);
        const summary = {
          wallMs: Date.now() - started,
          codex: { ...codexStats },
          results,
        };
        await writeFile(
          `${sessionDir}/codex-run.json`,
          JSON.stringify(summary, null, 2),
        );
        console.log(JSON.stringify(summary, null, 2));
      }
    }
    return;
  }
  const client = getLangfuse();
  if (!client) return; // No keys means no API calls, including group generation.

  const datasetName = 'pulse-player-groups';
  await client.api.datasets.create({
    name: datasetName,
    description: 'Stored friend groups shared across narrator prompt variants',
  });
  const data = [];
  for (let index = 0; index < options.items; index++) {
    const id = stableItemId(story.id, options.players, index);
    let item: Awaited<ReturnType<typeof client.api.datasetItems.get>>;
    try {
      item = await client.api.datasetItems.get(id);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) throw error;
      // The local cache survives an interrupted upload; the hosted item wins on subsequent runs.
      const cacheDir = 'sessions/langfuse-player-groups';
      const path = `${cacheDir}/${id}.json`;
      let input: PlayerGroupInput;
      try {
        input = JSON.parse(await readFile(path, 'utf8'));
      } catch (cacheError) {
        if ((cacheError as NodeJS.ErrnoException).code !== 'ENOENT')
          throw cacheError;
        const archetypes = Array.from(
          { length: options.players },
          (_, i) =>
            ARCHETYPES[(index * options.players + i) % ARCHETYPES.length].id,
        );
        const group = await generateGroup(
          {
            storyId: story.id,
            title: story.title,
            description: story.description || 'Unknown setting',
            genre: 'Interactive fiction',
          },
          archetypes,
        );
        input = { storyId: story.id, archetypes, group };
        await mkdir(cacheDir, { recursive: true });
        await writeFile(path, JSON.stringify(input, null, 2));
      }
      item = await client.api.datasetItems.create({ id, datasetName, input });
    }
    const input = item.input as PlayerGroupInput;
    if (
      input.storyId !== story.id ||
      input.archetypes.length !== options.players ||
      input.group.players.length !== options.players
    ) {
      throw new Error(`Invalid stored player group: ${id}`);
    }
    data.push(item);
  }

  const date = new Date().toISOString();
  for (const variant of variants) {
    const sessions = new Map<string, SessionResult>();
    const run = await client.experiment.run({
      name: 'pulse-narrator',
      runName: `pulse-${variant}-${options.runLabel ? `${options.runLabel}-` : ''}${rejudgeIds ? 'judge-full-replies-' : ''}${date}`,
      data: data.map((item) => {
        const input = item.input as PlayerGroupInput;
        return {
          ...item,
          input: sessionInput({
            story: { storyId: input.storyId },
            archetypes: input.archetypes,
            promptStyle: variant,
            maxTurns: options.maxTurns,
          }),
          metadata: { datasetItemId: item.id, rawInput: input },
        };
      }),
      metadata: {
        story: story.id,
        narrator: options.narrator,
        variant,
        maxTurns: options.maxTurns,
        git_commit: gitCommit(),
        measurement: 'full-player-replies-divisor-14.5',
        rejudgeSessions: rejudgeIds,
      },
      maxConcurrency: 1,
      task: async (item) => {
        const metadata = item.metadata as {
          datasetItemId: string;
          rawInput: PlayerGroupInput;
        };
        const input = metadata.rawInput;
        if (rejudgeIds) {
          const index = data.findIndex((entry) => entry.id === metadata.datasetItemId);
          const id = rejudgeIds[variants.indexOf(variant) * options.items + index];
          const directory = `sessions/${id}`;
          const checkpoint = deserializeCheckpoint(
            await readFile(`${directory}/turn-${String(options.maxTurns).padStart(3, '0')}.json`, 'utf8'),
          );
          const saved = JSON.parse(await readFile(`${directory}/langfuse.json`, 'utf8'));
          if (checkpoint.sessionConfig.promptStyle !== variant ||
              checkpoint.sessionConfig.story.storyId !== story.id ||
              checkpoint.sessionConfig.group.players.length !== options.players)
            throw new Error(`Rejudge session configuration mismatch: ${id}`);
          const session: SessionResult = {
            sessionId: id,
            config: checkpoint.sessionConfig,
            conversationHistory: checkpoint.conversationHistory,
            outcome: saved.outcome,
            finalTurn: checkpoint.turn,
            duration: saved.duration,
            error: saved.error,
            privateMoments: checkpoint.privateMoments,
            tangents: checkpoint.detectedTangents,
          };
          sessions.set(metadata.datasetItemId, session);
          return { ...sessionOutput(session), sourceSessionId: id };
        }
        const session = await runSession({
          langfuseExperiment: true,
          story: {
            storyId: story.id,
            storyTitle: story.title,
            storySetting: story.description || 'Unknown setting',
            storyGenre: 'Interactive fiction',
          },
          storyGuide: story.storyGuide,
          systemPrompt: getSystemPrompt(story.storyGuide, 'english', variant),
          narratorModel: options.narrator as NarratorModel,
          promptStyle: variant,
          archetypes: input.archetypes,
          preGeneratedGroup: structuredClone(input.group),
          groupSize: options.players,
          maxTurns: options.maxTurns,
        });
        sessions.set(metadata.datasetItemId, session);
        return sessionOutput(session);
      },
      evaluators: [
        async ({ metadata }) => {
          const session = sessions.get(metadata?.datasetItemId || '');
          if (!session) throw new Error('Missing session for dataset item');
          const evaluation = await evaluateWithGemini(
            session,
            session.config.systemPrompt,
            session.config.storyGuide,
            false,
          );
          if (rejudgeIds)
            await mkdir(`sessions/${session.sessionId}/judge-full-replies`, { recursive: true });
          await saveGeminiEvaluation(
            evaluation,
            `sessions/${session.sessionId}${rejudgeIds ? '/judge-full-replies' : ''}`,
          );
          return [
            ...evaluationScores(evaluation),
            ...performanceScores(session),
            {
              name: 'cost_usd',
              value: session.costBreakdown?.total.cost ?? 0,
              dataType: 'NUMERIC',
            },
          ];
        },
      ],
      runEvaluators: [aggregateRun],
    });
    console.log(await run.format());
    if (
      run.itemResults.length !== data.length ||
      run.itemResults.some(
        (item) =>
          !item.evaluations.some((score) => score.name === 'weighted_overall'),
      )
    ) {
      throw new Error(
        `Experiment ${variant} has failed items or missing judge results`,
      );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const program = new Command()
    .name('langfuse-experiment')
    .option('--story <id>', 'Story ID', 'shadow-over-innsmouth')
    .option(
      '--variants <styles>',
      'Comma-separated prompt styles',
      'mechanical,minimal',
    )
    .option('--items <number>', 'Dataset items', positiveInteger, 1)
    .option('--max-turns <number>', 'Turns per session', positiveInteger, 6)
    .option('--narrator <model>', 'Narrator model', 'deepseek-v4-flash')
    .option(
      '--offline',
      'Run fully on Codex without Langfuse credentials or network telemetry',
    )
    .option('--rejudge-sessions <ids>', 'Rejudge saved sessions without playing; variant then dataset-item order')
    .option('--run-label <label>', 'Describe the change or stack in the run name')
    .option('--players <number>', 'Players per item (1-5)', positiveInteger, 2);
  program.parse();
  runExperiment(program.opts())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(shutdownLangfuse);
}
