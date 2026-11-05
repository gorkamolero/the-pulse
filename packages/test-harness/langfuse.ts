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
  startObservation,
  type LangfuseGeneration,
} from '@langfuse/tracing';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { SpanContext } from '@opentelemetry/api';
import type { LanguageModelUsage, streamText } from 'ai';
import type { SessionResult, SessionRunnerConfig } from './session/runner';
import type { GeminiEvaluation } from './report/gemini-eval';
import { CostTracker } from './session/cost';

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

export async function traceSession(
  config: SessionRunnerConfig,
  run: () => Promise<SessionResult>,
): Promise<SessionResult> {
  if (!getLangfuse()) return run();
  return startActiveObservation('pulse-session', async (span) => {
    const metadata = {
      story: config.story.storyId,
      narrator_model: config.narratorModel,
      prompt_variant: config.promptStyle || 'production',
      maxTurns: config.maxTurns ?? 100,
      git_commit: gitCommit(),
    };
    span.updateTrace({ name: 'pulse-session', metadata });
    const result = await run();
    result.langfuseContext = span.otelSpan.spanContext();
    span.updateTrace({
      sessionId: result.sessionId,
      metadata: {
        ...metadata,
        archetypes: result.config.group.players.map((p) => p.archetype),
        outcome: result.outcome,
      },
      output: { outcome: result.outcome, turns: result.finalTurn },
    });
    if (result.outcome === 'failed')
      span.update({
        level: 'ERROR',
        statusMessage: result.error || 'Session failed',
      });
    emitScores(result, performanceScores(result));
    // Retain the original parent for post-hoc cli:eval, including failed sessions.
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
  });
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

export async function traceJudge(
  result: SessionResult,
  judge: () => Promise<GeminiEvaluation>,
  scoreTrace = true,
): Promise<GeminiEvaluation> {
  if (!getLangfuse()) return judge();
  await restoreTrace(result);
  const evaluate = async () => {
    const evaluation = await judge();
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
  return startActiveObservation('judge-evaluation', evaluate, {
    parentSpanContext: result.langfuseContext,
  });
}

export function traceTurn<T>(turn: number, run: () => Promise<T>): Promise<T> {
  if (!getLangfuse()) return run();
  return startActiveObservation(`turn-${turn}`, (span) => {
    span.update({ metadata: { turn } });
    return run();
  });
}

function finishGeneration(
  span: LangfuseGeneration,
  model: string,
  usage: LanguageModelUsage,
  output: unknown,
): void {
  const tokens = {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens:
      usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  };
  const cost = new CostTracker(model, []).calculateCost(tokens, model);
  span.update({
    output,
    usageDetails: {
      input: tokens.promptTokens,
      output: tokens.completionTokens,
      total: tokens.totalTokens,
    },
    costDetails: { total: cost },
  });
}

export function traceStream<T extends ReturnType<typeof streamText>>(
  name: string,
  model: string,
  run: () => T,
): T {
  if (!getLangfuse()) return run();
  const span = startObservation(name, { model }, { asType: 'generation' });
  try {
    const result = run();
    void Promise.all([result.totalUsage, result.text])
      .then(([usage, text]) => {
        finishGeneration(span, model, usage, text);
        span.end();
      })
      .catch((error: unknown) => {
        span.update({ level: 'ERROR', statusMessage: String(error) });
        span.end();
      });
    return result;
  } catch (error) {
    span.update({ level: 'ERROR', statusMessage: String(error) });
    span.end();
    throw error;
  }
}

export async function traceGeneration<
  T extends { usage: LanguageModelUsage; object?: unknown; text?: string },
>(name: string, model: string, run: () => Promise<T>): Promise<T> {
  if (!getLangfuse()) return run();
  return startActiveObservation(
    name,
    async (span) => {
      span.update({ model });
      try {
        const result = await run();
        finishGeneration(
          span,
          model,
          result.usage,
          result.object ?? result.text,
        );
        return result;
      } catch (error) {
        span.update({ level: 'ERROR', statusMessage: String(error) });
        throw error;
      }
    },
    { asType: 'generation' },
  );
}

const snake = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export function evaluationScores(evaluation: GeminiEvaluation): Evaluation[] {
  const scores: Evaluation[] = [];
  for (const [name, dimension] of Object.entries(evaluation)) {
    if (
      name !== 'overall' &&
      typeof dimension === 'object' &&
      'score' in dimension &&
      'evidence' in dimension
    ) {
      scores.push({
        name: snake(name),
        value: dimension.score,
        dataType: 'NUMERIC',
        comment: JSON.stringify({
          notes: dimension.notes,
          evidence: dimension.evidence,
        }),
      });
    }
  }
  scores.push({
    name: 'weighted_overall',
    value: evaluation.overall.score,
    dataType: 'NUMERIC',
    comment: evaluation.overall.summary,
  });
  for (const name of [
    'railroadedReported',
    'linearLanguageUsed',
    'declarationPhrases',
    'experientiallyWrong',
  ] as const) {
    scores.push({
      name: snake(name),
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
  const mean = (name: string) => {
    const scores = values.filter(
      (s) => s.name === name && typeof s.value === 'number',
    );
    return scores.length
      ? [
          {
            name: `mean_${name}`,
            value:
              scores.reduce((sum, s) => sum + Number(s.value), 0) /
              scores.length,
            dataType: 'NUMERIC' as const,
          },
        ]
      : [];
  };
  return [...mean('weighted_overall'), ...mean('cost_usd')];
};

export type { SpanContext };
