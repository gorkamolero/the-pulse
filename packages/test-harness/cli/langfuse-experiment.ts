#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Command, InvalidArgumentError } from 'commander';
import { generateGroup, type GeneratedGroup } from '../agents/player';
import { ARCHETYPES } from '../archetypes/definitions';
import type { ArchetypeId } from '../archetypes/types';
import { NARRATOR_MODEL_MAP, type NarratorModel } from '../agents/narrator';
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
  const client = getLangfuse();
  if (!client) return; // No keys means no API calls, including group generation.

  const datasetName = 'pulse-player-groups';
  await client.createDataset({
    name: datasetName,
    description: 'Stored friend groups shared across narrator prompt variants',
  });
  const data = [];
  for (let index = 0; index < options.items; index++) {
    const id = stableItemId(story.id, options.players, index);
    let item: Awaited<ReturnType<typeof client.getDatasetItem>>;
    try {
      item = await client.getDatasetItem(id);
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
      item = await client.createDatasetItem({ id, datasetName, input });
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
      runName: `pulse-${variant}-${date}`,
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
      },
      maxConcurrency: 1,
      task: async (item) => {
        const metadata = item.metadata as {
          datasetItemId: string;
          rawInput: PlayerGroupInput;
        };
        const input = metadata.rawInput;
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
          await saveGeminiEvaluation(
            evaluation,
            `sessions/${session.sessionId}`,
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
    .option('--players <number>', 'Players per item (1-5)', positiveInteger, 2);
  program.parse();
  runExperiment(program.opts())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(shutdownLangfuse);
}
