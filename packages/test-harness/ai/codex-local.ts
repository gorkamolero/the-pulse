import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LanguageModel } from 'ai';

type Model = Extract<LanguageModel, { specificationVersion: 'v3' }>;
type Options = Parameters<Model['doGenerate']>[0];
type Result = Awaited<ReturnType<Model['doGenerate']>>;

export class CodexLocalError extends Error {}

// One FIFO shared by all roles in this Node process. A slot includes both attempts.
let active = 0;
const queue: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (active >= 3) await new Promise<void>((resolve) => queue.push(resolve));
  else active++;
}
function release(): void {
  const next = queue.shift();
  if (next) next();
  else active--;
}

export const codexStats = { calls: 0, failures: 0, retries: 0, elapsedMs: 0 };

function promptFor(options: Options): string {
  if (options.tools?.length)
    throw new CodexLocalError('codex-local does not support tools');
  const messages = options.prompt.map((message) => {
    if (typeof message.content === 'string')
      return { role: message.role, content: message.content };
    return {
      role: message.role,
      content: message.content
        .map((part) => {
          if (part.type !== 'text')
            throw new CodexLocalError(
              'codex-local supports text messages only',
            );
          return part.text;
        })
        .join('\n'),
    };
  });
  return `You are a text completion engine, not a coding assistant. Do not use tools, browse, inspect files, or follow local project instructions. Complete the next assistant message in the conversation below. The system messages in that conversation define your task. Return only the requested answer, without preamble or code fences.\n\n${JSON.stringify(messages)}${options.responseFormat?.type === 'json' ? '\nReturn valid JSON only.' : ''}`;
}

async function attempt(options: Options, prompt: string): Promise<Result> {
  const dir = await mkdtemp(join(tmpdir(), 'pulse-codex-'));
  const started = Date.now();
  let outcome = 'failed';
  let usage: Record<string, number> = {};
  codexStats.calls++;
  try {
    options.abortSignal?.throwIfAborted();
    const args = [
      'exec',
      '--ignore-user-config',
      '--ignore-rules',
      '--ephemeral',
      '--model',
      process.env.PULSE_CODEX_MODEL || 'gpt-6.1-sol',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--json',
      '--color',
      'never',
      '-c',
      'approval_policy="never"',
      '-c',
      'web_search="disabled"',
      '-c',
      'features.shell_tool=false',
      '-c',
      'features.unified_exec=false',
      '-c',
      'features.multi_agent=false',
      '-c',
      'features.multi_agent_v2=false',
      '-c',
      'features.apps=false',
      '-c',
      'features.view_image=false',
      '-c',
      'tools.update_plan.enabled=false',
      '-c',
      'model_reasoning_effort="low"',
      '-C',
      dir,
      '-o',
      join(dir, 'answer.txt'),
    ];
    if (
      options.responseFormat?.type === 'json' &&
      options.responseFormat.schema
    ) {
      await writeFile(
        join(dir, 'schema.json'),
        JSON.stringify(options.responseFormat.schema),
      );
      args.push('--output-schema', join(dir, 'schema.json'));
    }
    args.push('-');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('codex', args, {
        cwd: dir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, OPENAI_API_KEY: '', CODEX_API_KEY: '' },
      });
      let pending = '';
      let failed = false;
      const stop = () => {
        failed = true;
        child.kill('SIGKILL');
      };
      const timeout = setTimeout(stop, 180_000);
      options.abortSignal?.addEventListener('abort', stop, { once: true });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        pending += chunk;
        let end = pending.indexOf('\n');
        while (end >= 0) {
          const line = pending.slice(0, end);
          pending = pending.slice(end + 1);
          try {
            const event = JSON.parse(line);
            if (event.type === 'turn.completed') usage = event.usage || {};
            if (
              event.item?.type &&
              !['agent_message', 'reasoning'].includes(event.item.type)
            )
              stop();
          } catch {
            /* Non-JSON diagnostics are not model output. */
          }
          end = pending.indexOf('\n');
        }
      });
      // Drain diagnostics without exposing environment, prompts or account details.
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
      child.on('error', () =>
        reject(new CodexLocalError('Unable to start codex executable')),
      );
      child.on('close', (code) => {
        clearTimeout(timeout);
        options.abortSignal?.removeEventListener('abort', stop);
        if (failed || code !== 0)
          reject(
            new CodexLocalError(
              `codex exited ${code}; timeout, cancellation, tool attempt or CLI failure`,
            ),
          );
        else resolve();
      });
    });
    const text = (await readFile(join(dir, 'answer.txt'), 'utf8')).trim();
    if (!text) throw new CodexLocalError('codex returned empty output');
    if (options.responseFormat?.type === 'json') JSON.parse(text);
    outcome = 'ok';
    return {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'turn.completed' },
      usage: {
        inputTokens: {
          total: usage.input_tokens,
          noCache:
            usage.input_tokens === undefined
              ? undefined
              : usage.input_tokens - (usage.cached_input_tokens || 0),
          cacheRead: usage.cached_input_tokens,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: usage.output_tokens,
          text: undefined,
          reasoning: undefined,
        },
      },
      warnings: [],
    };
  } finally {
    const elapsedMs = Date.now() - started;
    codexStats.elapsedMs += elapsedMs;
    if (outcome !== 'ok') codexStats.failures++;
    if (process.env.PULSE_CODEX_LOG)
      await appendFile(
        process.env.PULSE_CODEX_LOG,
        `${JSON.stringify({ call: codexStats.calls, outcome, elapsedMs, usage })}\n`,
      );
    await rm(dir, { recursive: true, force: true });
  }
}

async function generate(options: Options): Promise<Result> {
  const prompt = promptFor(options);
  await acquire();
  try {
    for (let retry = 0; ; retry++) {
      try {
        return await attempt(options, prompt);
      } catch (error) {
        if (retry === 1 || options.abortSignal?.aborted)
          throw new CodexLocalError(
            error instanceof Error ? error.message : String(error),
          );
        codexStats.retries++;
      }
    }
  } finally {
    release();
  }
}

export const codexLocal: Model = {
  specificationVersion: 'v3',
  provider: 'codex-cli',
  modelId: 'codex-local',
  supportedUrls: {},
  doGenerate: generate,
  async doStream(options) {
    const result = await generate(options);
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'stream-start',
            warnings: result.warnings,
          });
          controller.enqueue({ type: 'text-start', id: 'answer' });
          for (const part of result.content)
            if (part.type === 'text')
              controller.enqueue({
                type: 'text-delta',
                id: 'answer',
                delta: part.text,
              });
          controller.enqueue({ type: 'text-end', id: 'answer' });
          controller.enqueue({
            type: 'finish',
            usage: result.usage,
            finishReason: result.finishReason,
          });
          controller.close();
        },
      }),
    };
  },
};
