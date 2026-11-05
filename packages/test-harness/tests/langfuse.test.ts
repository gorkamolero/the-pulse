import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { startActiveObservation } from '@langfuse/tracing';
import {
  aggregateRun,
  evaluationScores,
  getLangfuse,
  performanceScores,
  restoreTrace,
  shutdownLangfuse,
  stableItemId,
  telemetry,
  tracePlayer,
  weightedOverall,
  withGameSession,
  sessionOutput,
  traceJudge,
  traceSession,
  traceTurn,
} from '../langfuse';
import { PerformanceTracker } from '../session/metrics';
import { CostTracker } from '../session/cost';
import type { SessionResult, SessionRunnerConfig } from '../session/runner';
import {
  evaluateWithGemini,
  type GeminiEvaluation,
} from '../report/gemini-eval';
import {
  generateObject,
  generateText,
  streamText,
  type LanguageModelUsage,
} from 'ai';
import {
  MockLanguageModelV3,
  MockProviderV3,
  simulateReadableStream,
} from 'ai/test';
import { z } from 'zod';
import { positiveInteger, runExperiment } from '../cli/langfuse-experiment';

await test('Langfuse integration', async (t) => {
  // All network paths used by the integration are stubbed; no provider is invoked.
  mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected network call');
  });
  process.env.LANGFUSE_PUBLIC_KEY = '';
  process.env.LANGFUSE_SECRET_KEY = '';
  const usage: LanguageModelUsage = {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    inputTokenDetails: {
      noCacheTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokenDetails: { textTokens: 50, reasoningTokens: 0 },
  };
  const dimension = {
    score: 9,
    notes: 'Evidence-based assessment',
    evidence: [{ turn: 1, quote: 'A door opens', assessment: 'An invitation' }],
  };
  const evaluation: GeminiEvaluation = {
    overall: {
      score: 8.5,
      summary: 'Existing judge result, capped',
      verdict: 'good',
    },
    agencyRespect: dimension,
    equipmentEngagement: dimension,
    npcDialogue: dimension,
    spatialConsistency: dimension,
    characterCreation: dimension,
    invitationArchitecture: dimension,
    atmosphere: dimension,
    curiosityFollowing: dimension,
    pacingBreath: dimension,
    declarationVsAcknowledgment: dimension,
    branchingPersistence: dimension,
    actionableVsAtmospheric: dimension,
    smellTest: {
      railroadedReported: true,
      linearLanguageUsed: false,
      declarationPhrases: false,
      experientiallyWrong: false,
      cappedScore: true,
      notes: 'A player felt railroaded',
    },
    agencyViolations: [],
    strengths: [],
    recommendations: [],
  };
  const config = {
    story: { storyId: 'shadow-over-innsmouth' },
    narratorModel: 'deepseek-v4-flash',
    promptStyle: 'minimal',
    maxTurns: 6,
  } as SessionRunnerConfig;
  function fixture(sessionId: string): SessionResult {
    return {
      sessionId,
      config: {
        story: config.story,
        group: { players: [{ archetype: 'joker' }] },
        narratorConfig: { model: config.narratorModel },
        maxTurns: 6,
      },
      outcome: 'timeout',
      finalTurn: 1,
      duration: 100,
      conversationHistory: [],
      privateMoments: [],
      tangents: [],
    } as unknown as SessionResult;
  }

  const cwd = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'pulse-langfuse-'));
  t.after(async () => {
    await shutdownLangfuse();
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
    mock.restoreAll();
  });

  await t.test(
    'no keys: silent pass-through, including experiment CLI, with no API initialization',
    async () => {
      assert.equal(getLangfuse(), undefined);
      assert.equal(telemetry('generate-narration').isEnabled, false);
      const session = fixture('disabled');
      assert.equal(await traceSession(config, async () => session), session);
      assert.equal(
        await traceJudge(session, async () => evaluation),
        evaluation,
      );
      assert.equal(await traceTurn(1, async () => 42), 42);
      assert.equal(session.langfuseContext, undefined);
      await runExperiment({
        story: 'shadow-over-innsmouth',
        variants: 'minimal',
        items: 1,
        maxTurns: 6,
        narrator: 'deepseek-v4-flash',
        players: 2,
      });
      await shutdownLangfuse();
    },
  );

  await t.test(
    'deterministic weighted score uses 14.5 and preserves the judge number and evidence',
    () => {
      const scores = evaluationScores(evaluation);
      assert.equal(scores.length, 18);
      assert.equal(scores.filter((s) => s.dataType === 'NUMERIC').length, 14);
      assert.equal(
        scores.find((s) => s.name === 'weighted_overall')?.value,
        8.5,
      );
      assert.equal(
        scores.find((s) => s.name === 'railroaded_reported')?.value,
        1,
      );
      assert.equal(
        scores.find((s) => s.name === 'linear_language_used')?.value,
        0,
      );
      assert.match(
        scores.find((s) => s.name === 'agency_respect')?.comment || '',
        /A door opens/,
      );
      const changed = evaluationScores({
        ...evaluation,
        overall: { ...evaluation.overall, score: 7.123 },
      });
      assert.equal(
        changed.find((s) => s.name === 'weighted_overall')?.value,
        8.5,
      );
      assert.equal(
        changed.find((s) => s.name === 'judge_reported_overall')?.value,
        7.123,
      );
      const clear = {
        ...evaluation,
        smellTest: {
          ...evaluation.smellTest,
          railroadedReported: false,
          cappedScore: true,
        },
      };
      assert.equal(weightedOverall(clear), 9);
      assert.equal(
        weightedOverall({
          ...clear,
          agencyRespect: { ...dimension, score: 1 },
        }),
        114.5 / 14.5,
      );
      for (const criterion of [
        'declarationVsAcknowledgment',
        'invitationArchitecture',
        'branchingPersistence',
      ] as const) {
        assert.equal(
          weightedOverall({
            ...clear,
            [criterion]: { ...dimension, score: 1 },
          }),
          118.5 / 14.5,
        );
      }
      for (const check of [
        'railroadedReported',
        'linearLanguageUsed',
        'declarationPhrases',
        'experientiallyWrong',
      ] as const) {
        const capped = {
          ...clear,
          smellTest: { ...clear.smellTest, cappedScore: false, [check]: true },
        };
        assert.equal(weightedOverall(capped), 8.5);
        assert.equal(
          weightedOverall({
            ...capped,
            agencyRespect: { ...dimension, score: 1 },
          }),
          114.5 / 14.5,
        );
      }
    },
  );

  await t.test('stable dataset ids and CLI validation', () => {
    assert.equal(stableItemId('story', 2, 0), stableItemId('story', 2, 0));
    assert.notEqual(stableItemId('story', 2, 0), stableItemId('story', 2, 1));
    assert.notEqual(stableItemId('story', 2, 0), stableItemId('other', 2, 0));
    assert.notEqual(stableItemId('story', 2, 0), stableItemId('story', 3, 0));
    for (const invalid of ['0', '-1', '2.5', '2junk', 'Infinity'])
      assert.throws(() => positiveInteger(invalid));
    assert.equal(positiveInteger('6'), 6);
  });

  const spans: Parameters<LangfuseSpanProcessor['onEnd']>[0][] = [];
  mock.method(
    LangfuseSpanProcessor.prototype,
    'onEnd',
    (span: Parameters<LangfuseSpanProcessor['onEnd']>[0]) => {
      spans.push(span);
    },
  );
  process.env.LANGFUSE_PUBLIC_KEY = 'test-public';
  process.env.LANGFUSE_SECRET_KEY = 'test-secret';
  const client = getLangfuse();
  assert.ok(client);
  mock.method(
    client,
    'getTraceUrl',
    async (id: string) => `http://stub/project/test/traces/${id}`,
  );
  const scores: Parameters<typeof client.score.create>[0][] = [];
  mock.method(
    client.score,
    'create',
    (score: Parameters<typeof client.score.create>[0]) => {
      scores.push(score);
    },
  );
  process.chdir(directory);

  const player = {
    name: 'Ada',
    archetype: 'joker' as const,
    modelId: 'stub-model',
  };
  function model(text = 'A door opens') {
    const modelUsage = {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 40, reasoning: 10 },
    };
    const finishReason = { unified: 'stop' as const, raw: 'stop' };
    return new MockLanguageModelV3({
      modelId: 'stub-model',
      doGenerate: {
        content: [
          { type: 'reasoning', text: 'Consider the door' },
          { type: 'text', text },
        ],
        usage: modelUsage,
        finishReason,
        warnings: [],
      },
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'reasoning-start', id: 'reason' },
            {
              type: 'reasoning-delta',
              id: 'reason',
              delta: 'Consider the door',
            },
            { type: 'reasoning-end', id: 'reason' },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: text },
            { type: 'text-end', id: 'text' },
            { type: 'finish', usage: modelUsage, finishReason },
          ],
        }),
      },
    });
  }

  await t.test(
    'native AI SDK telemetry nests streaming players and classifiers under turns with model, tokens and reasoning',
    async () => {
      const session = await traceSession(config, async () => {
        const result = fixture('one-session');
        await withGameSession(
          { ...result.config, sessionId: result.sessionId },
          async () => {
            await Promise.all(
              [1, 2].map((turn) =>
                traceTurn(turn, async () => {
                  await generateObject({
                    model: model('{"type":"group"}'),
                    schema: z.object({ type: z.string() }),
                    prompt: 'Classify narration',
                    experimental_telemetry: telemetry('classify-narration'),
                  });
                  await tracePlayer(player, 'A door opens', async () => {
                    const stream = streamText({
                      model: model(),
                      prompt: 'Respond as Ada',
                      experimental_telemetry: telemetry(
                        'generate-player-response',
                      ),
                    });
                    const text = await stream.text;
                    await stream.totalUsage;
                    return { text };
                  });
                }),
              ),
            );
          },
        );
        result.conversationHistory = [
          {
            role: 'narrator',
            turn: 1,
            timestamp: Date.now(),
            content: 'The door opens. '.repeat(100),
          },
        ];
        return result;
      });
      const disk = JSON.parse(
        await readFile('sessions/one-session/langfuse.json', 'utf8'),
      );
      assert.equal(disk.context.traceId, session.langfuseContext?.traceId);
      const restored = fixture('one-session');
      await restoreTrace(restored);
      assert.equal(
        restored.langfuseContext?.traceId,
        session.langfuseContext?.traceId,
      );
      await traceJudge(restored, async () => {
        await generateText({
          model: model(),
          prompt: 'Judge session',
          experimental_telemetry: telemetry('generate-judgment'),
        });
        return evaluation;
      });
      assert.equal(new Set(spans.map((s) => s.spanContext().traceId)).size, 1);
      const roots = spans.filter((s) => s.name === 'play-session');
      assert.equal(roots.length, 1);
      const root = roots[0];
      assert.equal(root.attributes['langfuse.trace.name'], 'play-session');
      assert.equal(root.attributes['session.id'], session.sessionId);
      assert.deepEqual(
        JSON.parse(String(root.attributes['langfuse.trace.input'])),
        {
          story: config.story.storyId,
          archetypes: ['joker'],
          variant: 'minimal',
          maxTurns: 6,
        },
      );
      const output = JSON.parse(
        String(root.attributes['langfuse.trace.output']),
      );
      assert.equal(output.finalTurn, 1);
      assert.equal(output.excerpt.length, 600);
      assert.match(JSON.stringify(root.attributes), /narrator-eval/);
      const judge = spans.find((s) => s.name === 'judge-session');
      assert.ok(judge);
      assert.equal(judge.attributes['langfuse.observation.type'], 'evaluator');
      const agents = spans.filter((s) => s.name === 'simulate-player');
      assert.equal(agents.length, 2);
      for (const agent of agents) {
        assert.equal(agent.attributes['langfuse.observation.type'], 'agent');
        assert.match(JSON.stringify(agent.attributes), /joker/);
        const turn = spans.find(
          (s) => s.spanContext().spanId === agent.parentSpanContext?.spanId,
        );
        assert.equal(turn?.name, 'play-turn');
        const generation = spans.find(
          (s) => s.parentSpanContext?.spanId === agent.spanContext().spanId,
        );
        assert.equal(
          generation?.attributes['ai.telemetry.functionId'],
          'generate-player-response',
        );
      }
      const generations = spans.filter(
        (s) => s.name === 'ai.streamText.doStream',
      );
      assert.equal(generations.length, 2);
      for (const generation of generations) {
        assert.equal(generation.attributes['ai.model.id'], 'stub-model');
        assert.equal(generation.attributes['ai.usage.inputTokens'], 100);
        assert.equal(generation.attributes['ai.usage.outputTokens'], 50);
        assert.equal(
          generation.attributes['ai.response.reasoning'],
          'Consider the door',
        );
      }
      assert.ok(
        scores.every((s) => s.traceId === session.langfuseContext?.traceId),
      );
      assert.equal(scores.length, 18);
    },
  );

  await t.test(
    'the actual Gemini judge call emits native generation telemetry and separate deterministic and reported scores',
    async () => {
      const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
      const reported = {
        ...evaluation,
        overall: { ...evaluation.overall, score: 9.9 },
      };
      globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV3({
        languageModels: {
          'google/gemini-3-pro-preview': model(JSON.stringify(reported)),
        },
      });
      try {
        const result = fixture('one-session');
        const verdict = await evaluateWithGemini(
          result,
          'Narrator instructions',
          'Story guide',
        );
        assert.equal(verdict.overall.score, 9.9);
        assert.equal(
          scores.findLast((s) => s.name === 'weighted_overall')?.value,
          8.5,
        );
        assert.equal(
          scores.findLast((s) => s.name === 'judge_reported_overall')?.value,
          9.9,
        );
        const generation = spans.findLast(
          (s) => s.name === 'ai.generateObject.doGenerate',
        );
        assert.equal(
          generation?.attributes['ai.telemetry.functionId'],
          'generate-judgment',
        );
        assert.equal(generation?.attributes['ai.usage.promptTokens'], 100);
        assert.equal(
          generation?.spanContext().traceId,
          result.langfuseContext?.traceId,
        );
        const parent = spans.find(
          (s) =>
            s.spanContext().spanId === generation?.parentSpanContext?.spanId,
        );
        const evaluator = spans.find(
          (s) => s.spanContext().spanId === parent?.parentSpanContext?.spanId,
        );
        assert.equal(evaluator?.name, 'judge-session');
        assert.equal(
          evaluator?.attributes['langfuse.observation.type'],
          'evaluator',
        );
      } finally {
        globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
      }
    },
  );

  await t.test(
    'native AI SDK failed calls end with an error status',
    async () => {
      await assert.rejects(
        traceTurn(3, () =>
          generateText({
            model: new MockLanguageModelV3({
              doGenerate: async () => {
                throw new Error('stub failure');
              },
            }),
            prompt: 'Fail',
            maxRetries: 0,
            experimental_telemetry: telemetry('classify-failure'),
          }),
        ),
      );
      const span = spans.find(
        (s) =>
          s.name === 'ai.generateText.doGenerate' &&
          s.attributes['ai.telemetry.functionId'] === 'classify-failure',
      );
      assert.ok(span);
      assert.equal(span.status.code, 2);
    },
  );

  await t.test(
    'existing performance tracker supplies cost and latency without another formula',
    async () => {
      const costs = new CostTracker('deepseek/deepseek-v4-flash', []);
      costs.recordNarratorUsage(usage);
      const clock = mock.method(Date, 'now', () => 100);
      const tracker = new PerformanceTracker();
      tracker.startTurn();
      clock.mock.mockImplementation(() => 350);
      tracker.endTurn(1, 100, 150);
      const session = fixture('metrics');
      session.performanceMetrics = tracker.generateMetrics({
        totalDuration: 250,
        totalTurns: 1,
        totalPulses: 1,
        tangentAnalysis: { totalTangents: 0 } as Parameters<
          PerformanceTracker['generateMetrics']
        >[0]['tangentAnalysis'],
        privateMoments: 0,
        paidOffMoments: 0,
        costBreakdown: costs.getBreakdown(),
      });
      clock.mock.restore();
      assert.deepEqual(
        performanceScores(session).map((s) => s.value),
        [costs.getBreakdown().total.cost, 250],
      );
      const aggregates = await aggregateRun({
        itemResults: [
          {
            item: { input: {} },
            output: {},
            evaluations: [
              { name: 'weighted_overall', value: 8 },
              { name: 'cost_usd', value: 2 },
            ],
          },
          {
            item: { input: {} },
            output: {},
            evaluations: [
              { name: 'weighted_overall', value: 6 },
              { name: 'cost_usd', value: 4 },
            ],
          },
        ],
      });
      assert.deepEqual(aggregates, [
        { name: 'mean_weighted_overall', value: 7, dataType: 'NUMERIC' },
        { name: 'mean_cost_usd', value: 3, dataType: 'NUMERIC' },
      ]);
    },
  );

  await t.test(
    'experiment parent and session remain in one trace',
    async () => {
      const session = await startActiveObservation('experiment-item-run', () =>
        traceSession(config, async () => fixture('experiment-session')),
      );
      const parent = spans.find((s) => s.name === 'experiment-item-run');
      assert.equal(
        parent?.spanContext().traceId,
        session.langfuseContext?.traceId,
      );
    },
  );

  await t.test(
    'CLI reuses hosted groups for every variant and later invocation without regenerating',
    async () => {
      const dataset = mock.method(client, 'createDataset', async () => ({}));
      const getItem = mock.method(
        client,
        'getDatasetItem',
        async (id: string) => ({
          id,
          datasetId: 'dataset-stub',
          input: {
            storyId: 'shadow-over-innsmouth',
            archetypes: ['joker', 'engaged'],
            group: { players: [{ name: 'Ada' }, { name: 'Ben' }] },
          },
        }),
      );
      const upsert = mock.method(client, 'createDatasetItem', async () => {
        throw new Error('Must reuse stored group');
      });
      const inputs: unknown[] = [];
      const runs = mock.method(
        client.experiment,
        'run',
        async (params: Parameters<typeof client.experiment.run>[0]) => {
          assert.match(
            params.runName || '',
            /^pulse-(minimal|mechanical)-\d{4}-/,
          );
          assert.equal(params.runEvaluators?.[0], aggregateRun);
          inputs.push(
            params.data.map(
              (item) => (item.metadata as { rawInput: unknown }).rawInput,
            ),
          );
          return {
            itemResults: params.data.map((item) => ({
              item,
              evaluations: [{ name: 'weighted_overall', value: 8 }],
            })),
            format: async () => 'stub run',
          };
        },
      );
      const options = {
        story: 'shadow-over-innsmouth',
        variants: 'minimal,mechanical',
        items: 2,
        maxTurns: 6,
        narrator: 'deepseek-v4-flash',
        players: 2,
      };
      await runExperiment(options);
      await runExperiment(options);
      assert.equal(runs.mock.callCount(), 4);
      assert.equal(upsert.mock.callCount(), 0);
      for (const input of inputs) assert.deepEqual(input, inputs[0]);
      runs.mock.restore();
      getItem.mock.restore();
      upsert.mock.restore();
      dataset.mock.restore();
    },
  );

  await t.test(
    'real SDK experiment runner links the session trace and emits dataset-run aggregates',
    async () => {
      const link = mock.method(
        client.api.datasetRunItems,
        'create',
        async (request: { traceId: string }) => ({
          datasetRunId: 'run-stub',
          traceId: request.traceId,
        }),
      );
      let completedSession: SessionResult | undefined;
      const result = await client.experiment.run({
        name: 'pulse-narrator',
        runName: 'pulse-minimal-test',
        data: [
          { id: 'item-stub', datasetId: 'dataset-stub', input: {} },
        ] as Parameters<typeof client.experiment.run>[0]['data'],
        task: async () => {
          completedSession = await traceSession(
            { ...config, langfuseExperiment: true },
            async () => fixture('sdk-experiment'),
          );
          return sessionOutput(completedSession);
        },
        evaluators: [
          async ({ output }) => {
            const session = completedSession;
            assert.ok(session);
            assert.deepEqual(output, sessionOutput(session));
            await traceJudge(session, async () => evaluation, false);
            return [
              ...evaluationScores(evaluation),
              { name: 'cost_usd', value: 2, dataType: 'NUMERIC' },
            ];
          },
        ],
        runEvaluators: [aggregateRun],
      });
      const item = result.itemResults[0];
      const session = completedSession;
      assert.ok(session);
      const sessionSpans = spans.filter(
        (s) => s.spanContext().traceId === item.traceId,
      );
      const roots = sessionSpans.filter((s) => !s.parentSpanContext);
      assert.equal(roots.length, 1);
      assert.equal(roots[0].name, 'play-session');
      assert.equal(
        sessionSpans.filter((s) => s.name === 'play-session').length,
        1,
      );
      assert.deepEqual(
        JSON.parse(String(roots[0].attributes['langfuse.observation.output'])),
        sessionOutput(session),
      );
      assert.equal(item.traceId, session.langfuseContext?.traceId);
      assert.equal(link.mock.calls[0].arguments[0].traceId, item.traceId);
      assert.ok(
        scores.some(
          (s) =>
            s.datasetRunId === 'run-stub' &&
            s.name === 'mean_weighted_overall' &&
            s.value === 8.5,
        ),
      );
      assert.ok(
        scores.some(
          (s) =>
            s.datasetRunId === 'run-stub' &&
            s.name === 'mean_cost_usd' &&
            s.value === 2,
        ),
      );
      link.mock.restore();
    },
  );

  await t.test(
    'shutdown flushes both score client and span processor',
    async () => {
      const flush = mock.method(
        LangfuseSpanProcessor.prototype,
        'forceFlush',
        async () => {},
      );
      const originalShutdown = client.shutdown.bind(client);
      const shutdown = mock.method(client, 'shutdown', originalShutdown);
      await shutdownLangfuse();
      assert.equal(flush.mock.callCount(), 1);
      assert.equal(shutdown.mock.callCount(), 1);
    },
  );
});
