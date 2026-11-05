import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  LangfuseClient,
  type Evaluation,
  type RunEvaluator,
} from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
  startActiveObservation,
  LangfuseSpan,
  propagateAttributes,
  type LangfuseEvaluator,
} from '@langfuse/tracing';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { context, trace, type SpanContext } from '@opentelemetry/api';
import type { TelemetrySettings } from 'ai';
import type { PlayerAgent } from './agents/player';
import type { SessionConfig } from './checkpoint/schema';
import type { SessionResult, SessionRunnerConfig } from './session/runner';
import type { GeminiEvaluation } from './report/gemini-eval';

let runtime:
  | { client: LangfuseClient; sdk: NodeSDK; processor: LangfuseSpanProcessor }
  | undefined;
export function getLangfuse(): LangfuseClient | undefined {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY)
    return;
  if (!runtime) {
    const config = {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    };
    const processor = new LangfuseSpanProcessor(config);
    const sdk = new NodeSDK({ spanProcessors: [processor] });
    sdk.start();
    runtime = { client: new LangfuseClient(config), sdk, processor };
  }
  return runtime.client;
}

export async function shutdownLangfuse(): Promise<void> {
  if (!runtime) return;
  const current = runtime;
  runtime = undefined;
  try {
    await current.client.shutdown();
  } finally {
    try {
      await current.processor.forceFlush();
    } finally {
      await current.sdk.shutdown();
    }
  }
}

export function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

export function stableItemId(
  story: string,
  players: number,
  index: number,
): string {
  return createHash('sha256')
    .update(JSON.stringify(['pulse-player-groups-v1', story, players, index]))
    .digest('hex');
}

export function sessionInput(config: {
  story: { storyId: string };
  archetypes?: string[];
  promptStyle?: string;
  maxTurns?: number;
}) {
  return {
    story: config.story.storyId,
    archetypes: config.archetypes ?? [],
    variant: config.promptStyle || 'production',
    maxTurns: config.maxTurns ?? 100,
  };
}

export function sessionOutput(result: SessionResult) {
  return {
    outcome: result.outcome,
    finalTurn: result.finalTurn,
    excerpt: result.conversationHistory
      .slice(-3)
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(-600),
  };
}

export async function traceSession(
  config: SessionRunnerConfig,
  run: () => Promise<SessionResult>,
): Promise<SessionResult> {
  if (!getLangfuse()) return run();
  const input = sessionInput(config);
  const tags = ['pulse', 'narrator-eval', input.variant];
  const record = async (span: LangfuseSpan) => {
    const metadata = {
      story: input.story,
      narrator_model: config.narratorModel,
      prompt_variant: input.variant,
      maxTurns: input.maxTurns,
      git_commit: gitCommit(),
    };
    span.update({ input, metadata });
    const result = await run();
    result.langfuseContext = span.otelSpan.spanContext();
    const finalInput = {
      ...input,
      archetypes: result.config.group.players.map((p) => p.archetype),
    };
    const output = sessionOutput(result);
    const finalMetadata = {
      ...metadata,
      archetypes: finalInput.archetypes,
      outcome: result.outcome,
      raw_session: {
        config: result.config,
        conversationHistory: result.conversationHistory,
      },
    };
    span.update({ input: finalInput, output, metadata: finalMetadata });
    span.otelSpan.setAttribute('session.id', result.sessionId);
    if (result.outcome === 'failed')
      span.update({
        level: 'ERROR',
        statusMessage: result.error || 'Session failed',
      });
    emitScores(result, performanceScores(result));
    await mkdir(`sessions/${result.sessionId}`, { recursive: true });
    await writeFile(
      `sessions/${result.sessionId}/langfuse.json`,
      JSON.stringify({
        context: result.langfuseContext,
        performanceMetrics: result.performanceMetrics,
        outcome: result.outcome,
        duration: result.duration,
        error: result.error,
      }),
    );
    return result;
  };
  return propagateAttributes(
    {
      traceName: 'play-session',
      tags,
      metadata: { story: input.story, variant: input.variant },
    },
    () => {
      const active = config.langfuseExperiment
        ? trace.getSpan(context.active())
        : undefined;
      if (active) {
        // The experiment SDK owns and ends this root observation.
        active.updateName('play-session');
        return record(new LangfuseSpan({ otelSpan: active }));
      }
      return startActiveObservation('play-session', record);
    },
  );
}

export function withGameSession<T>(
  config: SessionConfig,
  run: (config: SessionConfig) => Promise<T>,
): Promise<T> {
  if (!getLangfuse()) return run(config);
  return propagateAttributes({ sessionId: config.sessionId }, () =>
    run(config),
  );
}

export async function restoreTrace(result: SessionResult): Promise<void> {
  if (!getLangfuse() || result.langfuseContext) return;
  try {
    const saved = JSON.parse(
      await readFile(`sessions/${result.sessionId}/langfuse.json`, 'utf8'),
    );
    result.langfuseContext = saved.context;
    result.performanceMetrics = saved.performanceMetrics;
    result.outcome = saved.outcome;
    result.duration = saved.duration;
    result.error = saved.error;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function withSessionTrace<T>(
  result: SessionResult,
  run: () => Promise<T>,
): Promise<T> {
  if (!getLangfuse()) return run();
  await restoreTrace(result);
  if (!result.langfuseContext) return run();
  return context.with(
    trace.setSpanContext(context.active(), result.langfuseContext),
    () =>
      propagateAttributes(
        {
          sessionId: result.sessionId,
          traceName: 'play-session',
          tags: [
            'pulse',
            'narrator-eval',
            result.config.promptStyle || 'production',
          ],
        },
        run,
      ),
  );
}

export async function traceJudge(
  result: SessionResult,
  judge: () => Promise<GeminiEvaluation>,
  scoreTrace = true,
): Promise<GeminiEvaluation> {
  if (!getLangfuse()) return judge();
  await restoreTrace(result);
  const evaluate = async (span: LangfuseEvaluator) => {
    span.update({
      input: { sessionId: result.sessionId, turns: result.finalTurn },
      metadata: { raw_transcript: result.conversationHistory },
    });
    const evaluation = await judge();
    span.update({
      output: {
        weighted_overall: weightedOverall(evaluation),
        judge_reported_overall: evaluation.overall.score,
        summary: evaluation.overall.summary,
      },
      metadata: { raw_verdict: evaluation },
    });
    if (scoreTrace)
      emitScores(result, [
        ...evaluationScores(evaluation),
        ...performanceScores(result),
      ]);
    return evaluation;
  };
  // Legacy sessions have no trace yet. Create one once and persist its context.
  if (!result.langfuseContext) {
    await traceSession(
      {
        story: result.config.story,
        narratorModel: result.config.narratorConfig.model,
        systemPrompt: result.config.systemPrompt,
        storyGuide: result.config.storyGuide,
        maxTurns: result.config.maxTurns,
        promptStyle: result.config.promptStyle,
      },
      async () => result,
    );
  }
  return propagateAttributes(
    {
      sessionId: result.sessionId,
      tags: [
        'pulse',
        'narrator-eval',
        result.config.promptStyle || 'production',
      ],
    },
    () =>
      startActiveObservation('judge-session', evaluate, {
        asType: 'evaluator',
        parentSpanContext: result.langfuseContext,
      }),
  );
}

export function traceTurn<T>(turn: number, run: () => Promise<T>): Promise<T> {
  if (!getLangfuse()) return run();
  return propagateAttributes({ metadata: { turn: String(turn) } }, () =>
    startActiveObservation('play-turn', async (span) => {
      span.update({ input: { turn }, metadata: { turn } });
      const result = await run();
      span.update({ output: result });
      return result;
    }),
  );
}

export function telemetry(
  functionId: string,
  metadata: TelemetrySettings['metadata'] = {},
): TelemetrySettings {
  return {
    isEnabled: Boolean(getLangfuse()),
    functionId,
    metadata,
    recordInputs: true,
    recordOutputs: true,
  };
}

export function tracePlayer<T>(
  player: Pick<PlayerAgent, 'name' | 'archetype' | 'modelId'>,
  input: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!getLangfuse()) return run();
  return startActiveObservation(
    'simulate-player',
    async (span) => {
      span.update({
        input,
        metadata: {
          player: player.name,
          archetype: player.archetype,
          model: player.modelId,
        },
      });
      const result = await run();
      span.update({
        output:
          result && typeof result === 'object' && 'text' in result
            ? result.text
            : result,
      });
      return result;
    },
    { asType: 'agent' },
  );
}

const criterionWeights = {
  agencyRespect: 2,
  declarationVsAcknowledgment: 1.5,
  invitationArchitecture: 1.5,
  branchingPersistence: 1.5,
  equipmentEngagement: 1,
  npcDialogue: 1,
  spatialConsistency: 1,
  characterCreation: 1,
  atmosphere: 1,
  curiosityFollowing: 1,
  pacingBreath: 1,
  actionableVsAtmospheric: 1,
} as const;
const smellChecks = [
  'railroadedReported',
  'linearLanguageUsed',
  'declarationPhrases',
  'experientiallyWrong',
] as const;

export function weightedOverall(evaluation: GeminiEvaluation): number {
  let total = 0;
  let weightSum = 0;
  for (const criterion of Object.keys(criterionWeights) as Array<
    keyof typeof criterionWeights
  >) {
    const weight = criterionWeights[criterion];
    total += evaluation[criterion].score * weight;
    weightSum += weight;
  }
  const score = total / weightSum;
  return smellChecks.some((check) => evaluation.smellTest[check])
    ? Math.min(score, 8.5)
    : score;
}

const criterionScoreNames = {
  agencyRespect: 'agency_respect',
  declarationVsAcknowledgment: 'declaration_vs_acknowledgment',
  invitationArchitecture: 'invitation_architecture',
  branchingPersistence: 'branching_persistence',
  equipmentEngagement: 'equipment_engagement',
  npcDialogue: 'npc_dialogue',
  spatialConsistency: 'spatial_consistency',
  characterCreation: 'character_creation',
  atmosphere: 'atmosphere',
  curiosityFollowing: 'curiosity_following',
  pacingBreath: 'pacing_breath',
  actionableVsAtmospheric: 'actionable_vs_atmospheric',
} as const;
const checkScoreNames = {
  railroadedReported: 'railroaded_reported',
  linearLanguageUsed: 'linear_language_used',
  declarationPhrases: 'declaration_phrases',
  experientiallyWrong: 'experientially_wrong',
} as const;
export function evaluationScores(evaluation: GeminiEvaluation): Evaluation[] {
  const scores: Evaluation[] = [];
  for (const criterion of Object.keys(criterionScoreNames) as Array<
    keyof typeof criterionScoreNames
  >) {
    const dimension = evaluation[criterion];
    scores.push({
      name: criterionScoreNames[criterion],
      value: dimension.score,
      dataType: 'NUMERIC',
      comment: JSON.stringify({
        notes: dimension.notes,
        evidence: dimension.evidence,
      }),
    });
  }
  scores.push({
    name: 'weighted_overall',
    value: weightedOverall(evaluation),
    dataType: 'NUMERIC',
    comment: evaluation.overall.summary,
  });
  scores.push({
    name: 'judge_reported_overall',
    value: evaluation.overall.score,
    dataType: 'NUMERIC',
    comment: evaluation.overall.summary,
  });
  for (const name of smellChecks) {
    scores.push({
      name: checkScoreNames[name],
      value: Number(evaluation.smellTest[name]),
      dataType: 'BOOLEAN',
      comment: evaluation.smellTest.notes,
    });
  }
  return scores;
}

export function performanceScores(result: SessionResult): Evaluation[] {
  const metrics = result.performanceMetrics;
  if (!metrics) return [];
  return [
    {
      name: 'cost_per_turn_usd',
      value: metrics.costMetrics.costPerTurn,
      dataType: 'NUMERIC',
    },
    {
      name: 'latency_per_turn_ms',
      value: metrics.avgTurnDuration,
      dataType: 'NUMERIC',
    },
  ];
}

function emitScores(result: SessionResult, scores: Evaluation[]): void {
  const client = getLangfuse();
  if (!client || !result.langfuseContext) return;
  for (const score of scores)
    client.score.create({
      ...score,
      traceId: result.langfuseContext.traceId,
      id: `${result.langfuseContext.traceId}-${score.name}`,
    });
}

export const aggregateRun: RunEvaluator = async ({ itemResults }) => {
  const values = itemResults.flatMap((item) => item.evaluations);
  const mean = (
    name: 'weighted_overall' | 'cost_usd',
    scoreName: 'mean_weighted_overall' | 'mean_cost_usd',
  ) => {
    const scores = values.filter(
      (s) => s.name === name && typeof s.value === 'number',
    );
    return scores.length
      ? [
          {
            name: scoreName,
            value:
              scores.reduce((sum, s) => sum + Number(s.value), 0) /
              scores.length,
            dataType: 'NUMERIC' as const,
          },
        ]
      : [];
  };
  return [
    ...mean('weighted_overall', 'mean_weighted_overall'),
    ...mean('cost_usd', 'mean_cost_usd'),
  ];
};

export type { SpanContext };
