import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { runExperiment } from '../cli/langfuse-experiment';
import { shutdownLangfuse } from '../langfuse';

// Run from packages/test-harness, with credentials supplied only in the environment.
// This calls only the saved-checkpoint branch, never runSession/group generation:
// all three dataset groups already exist in the hosted dataset.
const [phase, model] = process.argv.slice(2);
if (!['before', 'after'].includes(phase) || !['codex', 'gemini'].includes(model))
  throw new Error('Usage: tsx calibration/rejudge.ts before|after codex|gemini');
if (process.env.PULSE_JUDGE_MODEL !== (model === 'codex' ? 'codex-local' : undefined))
  throw new Error('Judge environment does not match requested model');
const labels = JSON.parse(await readFile('calibration/character-creation-labels.json', 'utf8')) as {
  sessions: { sessionId: string; stack: string }[];
};
const batches = [labels.sessions.slice(0, 3), labels.sessions.slice(3, 6), labels.sessions.slice(6, 9)];
const started = Date.now();
const manifest: { phase: string; model: string; completed: string[]; reused: string[]; wallSeconds?: number } = {
  phase, model, completed: [], reused: [],
};
const destination = `calibration/results/${phase}-${model}`;
await mkdir(destination, { recursive: true });
try {
  for (const [index, batch] of batches.entries()) {
    const reuse = phase === 'before' && (model === 'gemini' ? index < 2 : index === 2);
    if (!reuse) {
      await runExperiment({
        story: 'shadow-over-innsmouth', variants: 'minimal-character', items: 3,
        maxTurns: 6, players: 2, narrator: model === 'codex' ? 'codex-local' : 'deepseek-v4-flash',
        rejudgeSessions: batch.map((s) => s.sessionId).join(','),
        runLabel: `judge-calibration-${phase}-${model}-batch${index + 1}`,
      });
    }
    for (const { sessionId } of batch) {
      await copyFile(`sessions/${sessionId}/${reuse ? '' : 'judge-full-replies/'}gemini-eval.json`, `${destination}/${sessionId}.json`);
      (reuse ? manifest.reused : manifest.completed).push(sessionId);
    }
    await writeFile(`${destination}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  }
} finally {
  manifest.wallSeconds = (Date.now() - started) / 1000;
  await writeFile(`${destination}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await shutdownLangfuse();
}
console.log(JSON.stringify(manifest));
