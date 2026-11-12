import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateText, generateObject, streamText } from 'ai';
import { z } from 'zod';
import { codexLocal, codexStats, CodexLocalError } from '../ai/codex-local';
import { resolveModel, modelIdFor } from '../ai/models';
import { withRetry, withModelFallback } from '../utils/retry';

test('Codex protocol, role routing, structured output, concurrency and bounded retries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-codex-test-'));
  const originalPath = process.env.PATH;
  const originalPlayer = process.env.PULSE_PLAYER_MODEL;
  const events = join(dir, 'events.jsonl');
  const executable = join(dir, 'codex');
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ type: 'start', pid: process.pid, args }) + '\\n');
  // Real subprocess overlap exercises the OS process semaphore, not in-process fake time.
  setTimeout(() => {
    const failed = prompt.includes('ALWAYS_FAIL') || (prompt.includes('FAIL_ONCE') && !fs.existsSync(${JSON.stringify(join(dir, 'retried'))}));
    if (prompt.includes('FAIL_ONCE')) fs.writeFileSync(${JSON.stringify(join(dir, 'retried'))}, 'yes');
    fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ type: 'end', pid: process.pid }) + '\\n');
    if (failed) process.exit(1);
    const text = args.includes('--output-schema') ? '{"answer":"structured"}' : 'local answer';
    fs.writeFileSync(args[args.indexOf('-o') + 1], text);
    console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 17, cached_input_tokens: 5, output_tokens: 3 } }));
  }, 50);
});
`,
  );
  await chmod(executable, 0o755);
  process.env.PATH = `${dir}:${originalPath}`;
  try {
    process.env.PULSE_PLAYER_MODEL = 'codex-local';
    assert.equal(modelIdFor('paid-model'), 'codex-local');
    assert.equal(resolveModel('paid-model'), codexLocal);
    const text = await generateText({
      model: codexLocal,
      system: 'System instruction',
      prompt: 'hello',
    });
    assert.equal(text.text, 'local answer');
    assert.equal(text.usage.inputTokens, 17);
    assert.equal(text.usage.outputTokens, 3);
    const object = await generateObject({
      model: codexLocal,
      schema: z.object({ answer: z.string() }),
      prompt: 'object',
    });
    assert.equal(object.object.answer, 'structured');
    const stream = streamText({ model: codexLocal, prompt: 'stream' });
    let collected = '';
    for await (const chunk of stream.textStream) collected += chunk;
    assert.equal(collected, 'local answer');
    await Promise.all(
      Array.from({ length: 7 }, () =>
        generateText({ model: codexLocal, prompt: 'parallel' }),
      ),
    );
    let running = 0;
    let peak = 0;
    const recorded = (await readFile(events, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    for (const event of recorded) {
      running += event.type === 'start' ? 1 : -1;
      peak = Math.max(peak, running);
    }
    assert.equal(peak, 3);
    assert.equal(running, 0);
    assert.ok(
      recorded.some((event) => event.args?.includes('--output-schema')),
    );
    assert.ok(
      recorded
        .filter((event) => event.args)
        .every(
          (event) =>
            event.args.includes('web_search="disabled"') &&
            event.args.includes('features.shell_tool=false'),
        ),
    );
    const beforeRetry = codexStats.calls;
    assert.equal(
      (await generateText({ model: codexLocal, prompt: 'FAIL_ONCE' })).text,
      'local answer',
    );
    assert.equal(codexStats.calls - beforeRetry, 2);
    const beforeFailure = codexStats.calls;
    await assert.rejects(
      withRetry(() =>
        generateText({ model: codexLocal, prompt: 'ALWAYS_FAIL' }),
      ),
      CodexLocalError,
    );
    assert.equal(codexStats.calls - beforeFailure, 2);
    const beforeFallback = codexStats.calls;
    await assert.rejects(
      withModelFallback(
        'codex-local',
        () => generateText({ model: codexLocal, prompt: 'ALWAYS_FAIL' }),
        {
          label: 'test',
          getNextModel: () => {
            throw new Error('Must not use paid fallback');
          },
        },
      ),
      CodexLocalError,
    );
    assert.equal(codexStats.calls - beforeFallback, 2);
  } finally {
    process.env.PATH = originalPath;
    if (originalPlayer === undefined)
      Reflect.deleteProperty(process.env, 'PULSE_PLAYER_MODEL');
    else process.env.PULSE_PLAYER_MODEL = originalPlayer;
    await rm(dir, { recursive: true, force: true });
  }
});
