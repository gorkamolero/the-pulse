#!/usr/bin/env node

/**
 * Narrator Model Comparison Test
 *
 * Runs the same session config with multiple narrator models for A/B comparison.
 * Same story, same archetypes, same prompt - only narrator model differs.
 *
 * Command: pnpm test:compare-narrators --story [id] --narrators deepseek-v3.2,kimi-k2-thinking
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { runSession } from '../session/runner';
import { saveSessionReport } from '../report/markdown';
import type { StoryContext } from '../agents/player';
import { NARRATOR_MODEL_MAP, type NarratorModel } from '../agents/narrator';
import type { ArchetypeId } from '../archetypes/types';
import { getStory, listStoryIds } from '../stories/loader';
import { getSystemPrompt, type PromptStyle } from '../prompts/loader';
import { generateGroup } from '../agents/player';
import type { StoryContext as GeneratorStoryContext } from '../agents/character-generator';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

config({ path: '.env.local' });

const program = new Command();

const AVAILABLE_NARRATORS = Object.keys(NARRATOR_MODEL_MAP).join(', ');

program
  .name('test-compare-narrators')
  .description('Compare narrator models with identical config')
  .requiredOption('--story <id>', 'Story ID')
  .requiredOption(
    '--narrators <models>',
    `Comma-separated narrator models to compare (${AVAILABLE_NARRATORS})`,
  )
  .option(
    '--prompt <style>',
    'Prompt style (mechanical, philosophical, minimal)',
    'minimal',
  )
  .option('--players <number>', 'Group size (2-5)', (v) => Number.parseInt(v, 10))
  .option('--archetypes <ids>', 'Comma-separated archetype IDs (locked for all runs)')
  .option('--max-turns <number>', 'Maximum turns', (v) => Number.parseInt(v, 10), 100)
  .option('--language <lang>', 'Output language', 'english')
  .parse();

const options = program.opts();

interface ComparisonResult {
  narrator: NarratorModel;
  sessionId: string;
  turns: number;
  pulses: number;
  narratorScore: number;
  cost: number;
  duration: string;
}

function buildStoryContext(storyId: string): StoryContext {
  const loadedStory = getStory(storyId);
  return {
    storyId: loadedStory.id,
    storyTitle: loadedStory.title,
    storySetting: loadedStory.description || 'Unknown setting',
    storyGenre: 'Interactive fiction',
  };
}

async function runComparison() {
  const storyId = options.story;
  const promptStyle = options.prompt as PromptStyle;
  const language = options.language;
  const maxTurns = options.maxTurns;

  // Parse narrator models
  const narrators = options.narrators.split(',').map((s: string) => s.trim()) as NarratorModel[];

  // Validate narrator models
  for (const narrator of narrators) {
    if (!NARRATOR_MODEL_MAP[narrator]) {
      console.error(chalk.red(`Unknown narrator model: ${narrator}`));
      console.log(chalk.yellow('Available models:'), AVAILABLE_NARRATORS);
      process.exit(1);
    }
  }

  // Validate story exists
  let storyGuide: string;
  try {
    const loadedStory = getStory(storyId);
    storyGuide = loadedStory.storyGuide;
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    console.log(chalk.yellow('Available stories:'), listStoryIds().join(', '));
    process.exit(1);
  }

  // Parse archetypes or use defaults
  let archetypes: ArchetypeId[] | undefined;
  if (options.archetypes) {
    archetypes = options.archetypes.split(',').map((s: string) => s.trim()) as ArchetypeId[];
  }

  const playerCount = options.players || archetypes?.length || 4;

  console.log(chalk.bold.cyan('\n🔬 Narrator Model Comparison Test\n'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(`  Story:      ${chalk.white(storyId)}`);
  console.log(`  Prompt:     ${chalk.white(promptStyle)}`);
  console.log(`  Narrators:  ${chalk.white(narrators.join(', '))}`);
  console.log(`  Players:    ${chalk.white(playerCount)}`);
  console.log(`  Archetypes: ${chalk.white(archetypes?.join(', ') || 'random (same for all)')}`);
  console.log(`  Max Turns:  ${chalk.white(maxTurns)}`);
  console.log(chalk.gray('━'.repeat(50)));

  const story = buildStoryContext(storyId);

  // Generate group ONCE for all sessions (fair comparison)
  console.log(chalk.bold.yellow('\n▶ Generating shared group...\n'));

  const generatorContext: GeneratorStoryContext = {
    storyId: story.storyId,
    title: story.storyTitle,
    description: story.storySetting,
    genre: story.storyGenre,
  };

  const finalArchetypes =
    archetypes || (['director', 'contrarian', 'questioner', 'invested'] as ArchetypeId[]);
  const sharedGroup = await generateGroup(generatorContext, finalArchetypes, language);

  console.log(`📋 ${sharedGroup.group.relationship} | ${sharedGroup.group.occasion}`);
  console.log(`👥 ${sharedGroup.players.map((p) => p.name).join(', ')}\n`);

  // Get system prompt ONCE (same for all narrators)
  const systemPrompt = getSystemPrompt(storyGuide, language, promptStyle);

  console.log(
    chalk.bold.yellow(`▶ Running ${narrators.length} sessions in parallel with same group...\n`),
  );

  // Run all narrator models in parallel with SAME group and prompt
  const sessionPromises = narrators.map(async (narratorModel): Promise<ComparisonResult> => {
    try {
      const result = await runSession({
        story,
        systemPrompt,
        storyGuide,
        narratorModel,
        groupSize: playerCount,
        archetypes: finalArchetypes,
        preGeneratedGroup: sharedGroup,
        maxTurns,
        temperature: 0.7,
        language,
        promptStyle,
      });

      // Save individual report
      const reportPath = await saveSessionReport(result);
      console.log(chalk.green(`\n✓ ${narratorModel} complete: ${reportPath}`));

      // Extract metrics for comparison
      const narratorScore = result.playerFeedback?.narratorScore ?? 0;
      const totalCost = result.costBreakdown?.total.cost ?? 0;

      return {
        narrator: narratorModel,
        sessionId: result.sessionId,
        turns: result.finalTurn,
        pulses: result.detectedPulses.length,
        narratorScore: Math.round(narratorScore * 10) / 10,
        cost: totalCost,
        duration: formatDuration(result.duration),
      };
    } catch (error) {
      console.error(chalk.red(`\n✗ ${narratorModel} failed:`), error);
      return {
        narrator: narratorModel,
        sessionId: 'FAILED',
        turns: 0,
        pulses: 0,
        narratorScore: 0,
        cost: 0,
        duration: 'N/A',
      };
    }
  });

  const results = await Promise.all(sessionPromises);

  // Generate comparison report
  generateComparisonReport(results, storyId, promptStyle);
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function generateComparisonReport(
  results: ComparisonResult[],
  storyId: string,
  promptStyle: string,
) {
  console.log(chalk.bold.cyan('\n\n📊 Narrator Comparison Results\n'));
  console.log(chalk.gray('━'.repeat(70)));

  // Table header
  console.log(
    chalk.bold(
      `  ${'Narrator'.padEnd(18)} ${'Score'.padEnd(8)} ${'Pulses'.padEnd(8)} ${'Turns'.padEnd(8)} ${'Cost'.padEnd(10)} ${'Duration'.padEnd(10)}`,
    ),
  );
  console.log(chalk.gray('─'.repeat(70)));

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.narratorScore - a.narratorScore);

  for (const r of sorted) {
    const scoreColor =
      r.narratorScore >= 8.5 ? chalk.green : r.narratorScore >= 7 ? chalk.yellow : chalk.red;

    console.log(
      `  ${r.narrator.padEnd(18)} ${scoreColor(r.narratorScore.toFixed(1).padEnd(8))} ${String(r.pulses).padEnd(8)} ${String(r.turns).padEnd(8)} $${r.cost.toFixed(4).padEnd(9)} ${r.duration.padEnd(10)}`,
    );
  }

  console.log(chalk.gray('━'.repeat(70)));

  // Winner
  const winner = sorted[0];
  if (winner && winner.narratorScore > 0) {
    console.log(chalk.bold.green(`\n🏆 Winner: ${winner.narrator} (${winner.narratorScore}/10)\n`));
  }

  // Save comparison to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const comparisonDir = join(process.cwd(), 'sessions', 'comparisons');
  mkdirSync(comparisonDir, { recursive: true });

  const markdown = `# Narrator Model Comparison Report

**Date**: ${new Date().toISOString()}
**Story**: ${storyId}
**Prompt**: ${promptStyle}

## Results

| Narrator | Score | Pulses | Turns | Cost | Duration | Session |
|----------|-------|--------|-------|------|----------|---------|
${results.map((r) => `| ${r.narrator} | ${r.narratorScore}/10 | ${r.pulses} | ${r.turns} | $${r.cost.toFixed(4)} | ${r.duration} | ${r.sessionId} |`).join('\n')}

## Winner

**${winner?.narrator}** with a score of ${winner?.narratorScore}/10

## Session Links

${results.map((r) => `- [${r.narrator}](../${r.sessionId}/report.md)`).join('\n')}
`;

  const reportPath = join(comparisonDir, `${timestamp}-narrators-${storyId}.md`);
  writeFileSync(reportPath, markdown);
  console.log(chalk.gray(`Saved: ${reportPath}\n`));
}

runComparison().catch(console.error);
