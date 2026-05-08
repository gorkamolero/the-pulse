#!/usr/bin/env npx tsx
/**
 * Compare latest narrator models on the same first-pulse prompt.
 *
 * This is intentionally smaller and cleaner than a full simulated session:
 * one story, one prompt, one generation per model, sequential execution.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { generateText, gateway } from 'ai';
import { systemPrompt } from '@pulse/core/ai/prompts/system';
import {
  NARRATOR_MODEL_MAP,
  type NarratorModel,
} from '../agents/narrator';
import { getStory } from '../stories/loader';

config({ path: resolve(import.meta.dirname, '../../../.env.local') });

const STORY_ID = 'shadow-over-innsmouth';
const USER_MESSAGE = 'Begin Shadow Over Innsmouth for a solo player.';
const NARRATORS = Object.keys(NARRATOR_MODEL_MAP) as NarratorModel[];

interface Result {
  narrator: NarratorModel;
  modelId: string;
  ok: boolean;
  durationMs: number;
  words: number;
  score: number;
  issues: string[];
  text: string;
  error?: string;
}

function scoreOutput(text: string, durationMs: number): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (words < 60) issues.push('too short');
  if (words > 180) issues.push('too long');
  if (/^#+\s/m.test(text) || /\*\*/.test(text)) issues.push('markdown formatting');
  if (/how many players|player names|character|backstory/i.test(text)) {
    issues.push('asks setup questions');
  }
  if (/what do you do\??/i.test(text)) issues.push('uses stock choice prompt');
  if (durationMs > 8000) issues.push('slow');

  let score = 10;
  score -= Math.abs(words - 110) / 35;
  score -= issues.length * 1.2;
  if (durationMs > 5000) score -= (durationMs - 5000) / 2500;

  return {
    score: Math.max(0, Math.round(score * 10) / 10),
    issues,
  };
}

async function testNarrator(narrator: NarratorModel): Promise<Result> {
  const story = getStory(STORY_ID);
  const modelId = NARRATOR_MODEL_MAP[narrator];
  const system = systemPrompt({
    storyGuide: story.storyGuide,
    language: 'english',
    solo: true,
  });

  const startedAt = performance.now();
  try {
    const { text, usage } = await generateText({
      model: gateway(modelId),
      system,
      prompt: USER_MESSAGE,
      temperature: 0.7,
      maxOutputTokens: 350,
    });
    const durationMs = performance.now() - startedAt;
    const { score, issues } = scoreOutput(text, durationMs);
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    console.log(
      `${narrator.padEnd(24)} ${score.toFixed(1).padStart(4)}/10  ${(
        durationMs / 1000
      ).toFixed(1)}s  ${String(words).padStart(3)}w  ${
        usage.totalTokens ?? 'n/a'
      }t`,
    );

    return {
      narrator,
      modelId,
      ok: true,
      durationMs,
      words,
      score,
      issues,
      text,
    };
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${narrator.padEnd(24)} FAIL  ${(durationMs / 1000).toFixed(1)}s`);
    return {
      narrator,
      modelId,
      ok: false,
      durationMs,
      words: 0,
      score: 0,
      issues: ['generation failed'],
      text: '',
      error: message,
    };
  }
}

function saveReport(results: Result[]): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(process.cwd(), 'sessions', 'comparisons');
  mkdirSync(dir, { recursive: true });

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const markdown = `# Latest Narrator First-Pulse Comparison

**Date**: ${new Date().toISOString()}
**Story**: ${STORY_ID}
**Prompt**: ${USER_MESSAGE}

| Narrator | Gateway model | Score | Time | Words | Issues |
|---|---|---:|---:|---:|---|
${sorted
  .map(
    (r) =>
      `| ${r.narrator} | \`${r.modelId}\` | ${r.score}/10 | ${(
        r.durationMs / 1000
      ).toFixed(1)}s | ${r.words} | ${r.issues.join(', ') || 'none'} |`,
  )
  .join('\n')}

## Samples

${sorted
  .map(
    (r) => `### ${r.narrator}

${r.error ? `Failed: ${r.error}` : r.text}
`,
  )
  .join('\n')}
`;

  const markdownPath = join(dir, `${timestamp}-latest-narrators-first-pulse.md`);
  const jsonPath = join(dir, `${timestamp}-latest-narrators-first-pulse.json`);
  writeFileSync(markdownPath, markdown);
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  return markdownPath;
}

async function main() {
  console.log('\nLatest narrator first-pulse comparison\n');
  console.log('Narrator                  Score   Time   Len  Tokens');
  console.log('----------------------------------------------------');
  const results: Result[] = [];
  for (const narrator of NARRATORS) {
    results.push(await testNarrator(narrator));
  }
  const reportPath = saveReport(results);
  const winner = [...results].sort((a, b) => b.score - a.score)[0];
  console.log('----------------------------------------------------');
  console.log(`Winner: ${winner?.narrator} (${winner?.score}/10)`);
  console.log(`Saved: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
