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
  traceGeneration,
  traceJudge,
  traceSession,
  traceStream,
  traceTurn,
} from '../langfuse';
import { PerformanceTracker } from '../session/metrics';
import { CostTracker } from '../session/cost';
import type { SessionResult, SessionRunnerConfig } from '../session/runner';
import type { GeminiEvaluation } from '../report/gemini-eval';
import type { LanguageModelUsage, streamText } from 'ai';
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
    'scores reuse the returned overall and all evidence; boolean yes means a smell was detected',
    () => {
      const scores = evaluationScores(evaluation);
      assert.equal(scores.length, 17);
      assert.equal(scores.filter((s) => s.dataType === 'NUMERIC').length, 13);
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
      assert.equal(
        evaluationScores({
          ...evaluation,
          overall: { ...evaluation.overall, score: 7.123 },
        }).find((s) => s.name === 'weighted_overall')?.value,
        7.123,
      );
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

  await t.test(
    'session, concurrent turns, streams and post-hoc judge share exactly one trace',
    async () => {
      const session = await traceSession(config, async () => {
        await Promise.all(
          [1, 2].map((turn) =>
            traceTurn(turn, async () => {
              await traceGeneration(
                'classifier',
                'google/gemini-2.5-flash',
                async () => ({ usage, object: { type: 'group' } }),
              );
              const stream = traceStream(
                'player-generation',
                'deepseek/deepseek-v4-flash',
                () =>
                  ({
                    totalUsage: Promise.resolve(usage),
                    text: Promise.resolve('Hello'),
                  }) as unknown as ReturnType<typeof streamText>,
              );
              await stream.text;
            }),
          ),
        );
        return fixture('one-session');
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
      await traceJudge(restored, () =>
        traceGeneration(
          'gemini-judge',
          'google/gemini-2.5-flash',
          async () => ({ usage, object: evaluation }),
        ).then((r) => r.object),
      );
      assert.equal(new Set(spans.map((s) => s.spanContext().traceId)).size, 1);
      assert.equal(spans.filter((s) => s.name === 'pulse-session').length, 1);
      const judge = spans.find((s) => s.name === 'gemini-judge');
      assert.ok(judge);
      const generation = spans.find((s) => s.name === 'player-generation');
      assert.ok(generation);
      assert.match(
        String(generation.attributes['langfuse.observation.usage_details']),
        /100/,
      );
      assert.match(
        String(generation.attributes['langfuse.observation.cost_details']),
        /total/,
      );
      assert.ok(
        scores.every((s) => s.traceId === session.langfuseContext?.traceId),
      );
      assert.equal(scores.length, 17);
    },
  );

  await t.test(
    'errors end generation observations and mark them as errors',
    async () => {
      await assert.rejects(
        traceTurn(3, () =>
          traceGeneration('broken-classifier', 'stub', async () => {
            throw new Error('stub failure');
          }),
        ),
      );
      const span = spans.find((s) => s.name === 'broken-classifier');
      assert.ok(span);
      assert.equal(span.attributes['langfuse.observation.level'], 'ERROR');
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
          inputs.push(params.data);
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
      const result = await client.experiment.run({
        name: 'pulse-narrator',
        runName: 'pulse-minimal-test',
        data: [
          { id: 'item-stub', datasetId: 'dataset-stub', input: {} },
        ] as Parameters<typeof client.experiment.run>[0]['data'],
        task: () => traceSession(config, async () => fixture('sdk-experiment')),
        evaluators: [
          async ({ output }) => {
            const session = output as SessionResult;
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
      const session = item.output as SessionResult;
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
