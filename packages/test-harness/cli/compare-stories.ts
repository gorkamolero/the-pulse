#!/usr/bin/env node

/**
 * Story Version Comparison Test
 *
 * Compares linear vs nonlinear versions of the same story with identical config.
 * Same narrator, same group, same prompt - only story structure differs.
 *
 * Command: pnpm cli:compare-stories --base innsmouth --narrator deepseek-v3.2
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { runSession } from '../session/runner';
import { saveSessionReport } from '../report/markdown';
import type { StoryContext } from '../agents/player';
import { NARRATOR_MODEL_MAP, type NarratorModel } from '../agents/narrator';
import type { ArchetypeId } from '../archetypes/types';
import { getStory, listStoryIds, hasStory } from '../stories/loader';
import { getSystemPrompt, type PromptStyle } from '../prompts/loader';
import { generateGroup } from '../agents/player';
import type { StoryContext as GeneratorStoryContext } from '../agents/character-generator';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULTS,
  withNarrator,
  withPlayers,
  withArchetypes,
  withMaxTurns,
  withLanguage,
  withPromptStyle,
  withGeminiEval,
} from './shared-options';

config({ path: '.env.local' });

const program = new Command();

const AVAILABLE_STORIES = listStoryIds().join(', ');
const AVAILABLE_NARRATORS = Object.keys(NARRATOR_MODEL_MAP).join(', ');

program.name('test-compare-stories').description('Compare two story versions with the same group');

program.requiredOption('--story1 <id>', `First story ID (${AVAILABLE_STORIES})`);
program.requiredOption('--story2 <id>', `Second story ID (${AVAILABLE_STORIES})`);
withNarrator(program);
withPromptStyle(program);
withPlayers(program);
withArchetypes(program);
withMaxTurns(program);
withLanguage(program);
withGeminiEval(program);
program.parse();

const options = program.opts();

interface ComparisonResult {
  storyId: string;
  storyLabel: string;
  sessionId: string;
  outcome: string;
  turns: number;
  narratorScore: number;
  pacing: string;
  tangents: number;
  privateMoments: number;
  cost: number;
  duration: string;
  issues: number;
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
  const story1Id = options.story1;
  const story2Id = options.story2;
  const narratorModel = options.narrator as NarratorModel;
  const promptStyle = options.prompt as PromptStyle;
  const language = options.language;
  const maxTurns = options.maxTurns;

  // Validate both stories exist
  if (!hasStory(story1Id)) {
    console.error(chalk.red(`Story 1 not found: ${story1Id}`));
    console.log(chalk.yellow('Available stories:'), AVAILABLE_STORIES);
    process.exit(1);
  }
  if (!hasStory(story2Id)) {
    console.error(chalk.red(`Story 2 not found: ${story2Id}`));
    console.log(chalk.yellow('Available stories:'), AVAILABLE_STORIES);
    process.exit(1);
  }

  // Validate narrator
  if (!NARRATOR_MODEL_MAP[narratorModel]) {
    console.error(chalk.red(`Unknown narrator model: ${narratorModel}`));
    console.log(chalk.yellow('Available models:'), AVAILABLE_NARRATORS);
    process.exit(1);
  }

  // Parse archetypes or use defaults
  let archetypes: ArchetypeId[] | undefined;
  if (options.archetypes) {
    archetypes = options.archetypes.split(',').map((s: string) => s.trim()) as ArchetypeId[];
  }

  const playerCount = options.players || archetypes?.length || DEFAULTS.players;

  console.log(chalk.bold.cyan('\n📚 Story Comparison Test\n'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(`  Story 1:    ${chalk.white(story1Id)}`);
  console.log(`  Story 2:    ${chalk.white(story2Id)}`);
  console.log(`  Narrator:   ${chalk.white(narratorModel)}`);
  console.log(`  Prompt:     ${chalk.white(promptStyle)}`);
  console.log(`  Players:    ${chalk.white(playerCount)}`);
  console.log(`  Max Turns:  ${chalk.white(maxTurns)}`);
  console.log(chalk.gray('━'.repeat(50)));

  // Generate group ONCE for both sessions (fair comparison)
  console.log(chalk.bold.yellow('\n▶ Generating shared group...\n'));

  // Use story1 for group generation context
  const story1Context = buildStoryContext(story1Id);
  const generatorContext: GeneratorStoryContext = {
    storyId: story1Context.storyId,
    title: story1Context.storyTitle,
    description: story1Context.storySetting,
    genre: story1Context.storyGenre,
  };

  const finalArchetypes =
    archetypes || (['director', 'contrarian', 'questioner', 'invested'] as ArchetypeId[]);
  const sharedGroup = await generateGroup(generatorContext, finalArchetypes, language);

  console.log(`📋 ${sharedGroup.group.relationship} | ${sharedGroup.group.occasion}`);
  console.log(`👥 ${sharedGroup.players.map((p) => p.name).join(', ')}\n`);

  // Run both stories in parallel
  console.log(chalk.bold.yellow('▶ Running both stories in parallel...\n'));

  const storyConfigs = [
    { storyId: story1Id, label: 'Story 1' },
    { storyId: story2Id, label: 'Story 2' },
  ];

  const sessionPromises = storyConfigs.map(async ({ storyId, label }): Promise<ComparisonResult> => {
    try {
      const story = buildStoryContext(storyId);
      const loadedStory = getStory(storyId);
      const systemPrompt = getSystemPrompt(loadedStory.storyGuide, language, promptStyle);

      const result = await runSession({
        story,
        systemPrompt,
        storyGuide: loadedStory.storyGuide,
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
      const reportPath = await saveSessionReport(result, undefined, {
        geminiEval: options.geminiEval,
      });
      console.log(chalk.green(`\n✓ ${label} (${storyId}) complete: ${reportPath}`));

      // Extract metrics
      const narratorScore = result.playerFeedback?.narratorScore ?? 0;
      const totalCost = result.costBreakdown?.total.cost ?? 0;
      const pacing = result.playerFeedback?.pacingVerdict || 'unknown';
      const issues = result.tangentAnalysis?.totalTangents ?? 0;

      return {
        storyId,
        storyLabel: label,
        sessionId: result.sessionId,
        outcome: result.outcome,
        turns: result.finalTurn,
        narratorScore: Math.round(narratorScore * 10) / 10,
        pacing,
        tangents: result.tangents.length,
        privateMoments: result.privateMoments.length,
        cost: totalCost,
        duration: formatDuration(result.duration),
        issues,
      };
    } catch (error) {
      console.error(chalk.red(`\n✗ ${label} (${storyId}) failed:`), error);
      return {
        storyId,
        storyLabel: label,
        sessionId: 'FAILED',
        outcome: 'failed',
        turns: 0,
        narratorScore: 0,
        pacing: 'N/A',
        tangents: 0,
        privateMoments: 0,
        cost: 0,
        duration: 'N/A',
        issues: 0,
      };
    }
  });

  const results = await Promise.all(sessionPromises);

  // Generate comparison report
  generateComparisonReport(results, story1Id, story2Id, narratorModel, promptStyle);
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function generateComparisonReport(
  results: ComparisonResult[],
  story1Id: string,
  story2Id: string,
  narrator: string,
  promptStyle: string,
) {
  const result1 = results.find((r) => r.storyLabel === 'Story 1');
  const result2 = results.find((r) => r.storyLabel === 'Story 2');

  console.log(chalk.bold.cyan('\n\n📊 Story Comparison Results\n'));
  console.log(chalk.gray('━'.repeat(80)));

  // Side-by-side comparison
  const metrics = [
    { label: 'Story ID', val1: story1Id, val2: story2Id },
    { label: 'Outcome', val1: result1?.outcome || 'N/A', val2: result2?.outcome || 'N/A' },
    { label: 'Turns', val1: String(result1?.turns || 0), val2: String(result2?.turns || 0) },
    { label: 'Narrator Score', val1: `${result1?.narratorScore || 0}/10`, val2: `${result2?.narratorScore || 0}/10` },
    { label: 'Pacing', val1: result1?.pacing || 'N/A', val2: result2?.pacing || 'N/A' },
    { label: 'Tangents', val1: String(result1?.tangents || 0), val2: String(result2?.tangents || 0) },
    { label: 'Private Moments', val1: String(result1?.privateMoments || 0), val2: String(result2?.privateMoments || 0) },
    { label: 'Issues', val1: String(result1?.issues || 0), val2: String(result2?.issues || 0) },
    { label: 'Cost', val1: `$${(result1?.cost || 0).toFixed(4)}`, val2: `$${(result2?.cost || 0).toFixed(4)}` },
    { label: 'Duration', val1: result1?.duration || 'N/A', val2: result2?.duration || 'N/A' },
  ];

  console.log(chalk.bold(`  ${'Metric'.padEnd(18)} ${'Story 1'.padEnd(25)} ${'Story 2'.padEnd(25)}`));
  console.log(chalk.gray('─'.repeat(80)));

  for (const m of metrics) {
    let display1 = m.val1;
    let display2 = m.val2;

    // Highlight winner for score
    if (m.label === 'Narrator Score' && result1 && result2) {
      if (result1.narratorScore > result2.narratorScore) {
        display1 = chalk.green(m.val1);
      } else if (result2.narratorScore > result1.narratorScore) {
        display2 = chalk.green(m.val2);
      }
    }

    console.log(`  ${m.label.padEnd(18)} ${String(display1).padEnd(25)} ${String(display2).padEnd(25)}`);
  }

  console.log(chalk.gray('━'.repeat(80)));

  // Winner determination
  const score1 = result1?.narratorScore || 0;
  const score2 = result2?.narratorScore || 0;

  if (score1 > score2) {
    console.log(chalk.bold.green(`\n🏆 Winner: Story 1 (${story1Id}) - ${score1}/10 vs ${score2}/10\n`));
  } else if (score2 > score1) {
    console.log(chalk.bold.green(`\n🏆 Winner: Story 2 (${story2Id}) - ${score2}/10 vs ${score1}/10\n`));
  } else {
    console.log(chalk.bold.yellow(`\n🤝 Tie: Both scored ${score1}/10\n`));
  }

  // Analysis
  console.log(chalk.bold('Analysis:'));
  if (result1 && result2) {
    const turnDiff = result2.turns - result1.turns;

    if (Math.abs(turnDiff) > 3) {
      const longer = turnDiff > 0 ? 'Story 2' : 'Story 1';
      console.log(`  • ${longer} took ${Math.abs(turnDiff)} more turns`);
    }

    if (result1.privateMoments !== result2.privateMoments) {
      console.log(`  • Private moments: Story 1 (${result1.privateMoments}) vs Story 2 (${result2.privateMoments})`);
    }

    if (result1.tangents !== result2.tangents) {
      console.log(`  • Tangents: Story 1 (${result1.tangents}) vs Story 2 (${result2.tangents})`);
    }
  }

  // Save comparison to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const comparisonDir = join(process.cwd(), 'sessions', 'comparisons');
  mkdirSync(comparisonDir, { recursive: true });

  const markdown = `# Story Comparison Report

**Date**: ${new Date().toISOString()}
**Story 1**: ${story1Id}
**Story 2**: ${story2Id}
**Narrator**: ${narrator}
**Prompt Style**: ${promptStyle}

## Results

| Metric | Story 1 | Story 2 |
|--------|---------|---------|
${metrics.map((m) => `| ${m.label} | ${m.val1} | ${m.val2} |`).join('\n')}

## Winner

${score1 > score2 ? `**Story 1** (${story1Id}) - ${score1}/10` : score2 > score1 ? `**Story 2** (${story2Id}) - ${score2}/10` : `**Tie** (${score1}/10)`}

## Session Links

- [Story 1: ${story1Id}](../${result1?.sessionId}/report.md)
- [Story 2: ${story2Id}](../${result2?.sessionId}/report.md)

## Analysis

${result1 && result2 ? `
- Turn difference: ${result2.turns - result1.turns > 0 ? '+' : ''}${result2.turns - result1.turns}
- Private moments: Story 1 (${result1.privateMoments}), Story 2 (${result2.privateMoments})
- Tangents: Story 1 (${result1.tangents}), Story 2 (${result2.tangents})
- Issues detected: Story 1 (${result1.issues}), Story 2 (${result2.issues})
` : 'One or both sessions failed.'}
`;

  const reportPath = join(comparisonDir, `${timestamp}-compare-${narrator}.md`);
  writeFileSync(reportPath, markdown);
  console.log(chalk.gray(`\nSaved: ${reportPath}\n`));
}

runComparison().catch(console.error);
