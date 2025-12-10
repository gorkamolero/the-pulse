#!/usr/bin/env node

/**
 * Comparison CLI for A/B Testing
 *
 * Compare different prompts, models, or configurations
 * Command: pnpm test:compare --baseline [config] --variant [config]
 */

import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import chalk from 'chalk';
import { runSession, type SessionRunnerConfig } from '../session/runner';
import { getStory } from '../stories/loader';
import { getPrompt, withStoryGuide } from '../prompts/loader';
import type { NarratorModel } from '../agents/narrator';
import type { SessionResult } from '../session/runner';

// Load environment variables
loadEnv();

const program = new Command();

program
  .name('test-compare')
  .description('A/B test different configurations')
  .requiredOption('--story <id>', 'Story ID to use for comparison')
  .requiredOption('--baseline-prompt <name>', 'Baseline prompt variant')
  .requiredOption('--variant-prompt <name>', 'Variant prompt to compare')
  .option('--baseline-narrator <model>', 'Baseline narrator model', 'deepseek-r1')
  .option('--variant-narrator <model>', 'Variant narrator model')
  .option('--runs <number>', 'Number of runs per variant', Number.parseInt, 5)
  .option('--players <number>', 'Group size (2-5)', Number.parseInt)
  .option('--max-turns <number>', 'Maximum turns', Number.parseInt, 100)
  .parse();

const options = program.opts();

interface ComparisonStats {
  completionRate: number;
  avgPulses: number;
  avgTurns: number;
  avgDuration: number;
  avgCost: number;
  tangentRate: number;
  pulseCompletionRate: number;
}

function calculateStats(results: SessionResult[]): ComparisonStats {
  const completed = results.filter((r) => r.outcome === 'completed').length;
  const avgPulses = results.reduce((sum, r) => sum + r.detectedPulses.length, 0) / results.length;
  const avgTurns = results.reduce((sum, r) => sum + r.finalTurn, 0) / results.length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgCost = results.reduce((sum, r) => sum + (r.costBreakdown?.total.cost || 0), 0) / results.length;

  const tangents = results.reduce((sum, r) => sum + (r.tangentAnalysis?.totalTangents || 0), 0);
  const totalTurns = results.reduce((sum, r) => sum + r.finalTurn, 0);

  return {
    completionRate: completed / results.length,
    avgPulses,
    avgTurns,
    avgDuration,
    avgCost,
    tangentRate: totalTurns > 0 ? tangents / totalTurns : 0,
    pulseCompletionRate: avgPulses / 20,
  };
}

function printComparison(baseline: ComparisonStats, variant: ComparisonStats, variantName: string) {
  console.log(chalk.cyan('\n📊 Comparison Results:\n'));

  const metrics = [
    {
      name: 'Completion Rate',
      baseline: `${(baseline.completionRate * 100).toFixed(1)}%`,
      variant: `${(variant.completionRate * 100).toFixed(1)}%`,
      diff: ((variant.completionRate - baseline.completionRate) * 100).toFixed(1),
      unit: '%',
      higherIsBetter: true,
    },
    {
      name: 'Avg Pulses',
      baseline: baseline.avgPulses.toFixed(1),
      variant: variant.avgPulses.toFixed(1),
      diff: (variant.avgPulses - baseline.avgPulses).toFixed(1),
      unit: '',
      higherIsBetter: true,
    },
    {
      name: 'Pulse Completion',
      baseline: `${(baseline.pulseCompletionRate * 100).toFixed(1)}%`,
      variant: `${(variant.pulseCompletionRate * 100).toFixed(1)}%`,
      diff: ((variant.pulseCompletionRate - baseline.pulseCompletionRate) * 100).toFixed(1),
      unit: '%',
      higherIsBetter: true,
    },
    {
      name: 'Avg Turns',
      baseline: baseline.avgTurns.toFixed(1),
      variant: variant.avgTurns.toFixed(1),
      diff: (variant.avgTurns - baseline.avgTurns).toFixed(1),
      unit: '',
      higherIsBetter: false,
    },
    {
      name: 'Tangent Rate',
      baseline: `${(baseline.tangentRate * 100).toFixed(1)}%`,
      variant: `${(variant.tangentRate * 100).toFixed(1)}%`,
      diff: ((variant.tangentRate - baseline.tangentRate) * 100).toFixed(1),
      unit: '%',
      higherIsBetter: false,
    },
    {
      name: 'Avg Duration',
      baseline: `${(baseline.avgDuration / 1000).toFixed(1)}s`,
      variant: `${(variant.avgDuration / 1000).toFixed(1)}s`,
      diff: ((variant.avgDuration - baseline.avgDuration) / 1000).toFixed(1),
      unit: 's',
      higherIsBetter: false,
    },
    {
      name: 'Avg Cost',
      baseline: `$${baseline.avgCost.toFixed(4)}`,
      variant: `$${variant.avgCost.toFixed(4)}`,
      diff: (variant.avgCost - baseline.avgCost).toFixed(4),
      unit: '$',
      higherIsBetter: false,
    },
  ];

  console.log(chalk.white(`${'Metric'.padEnd(20)} ${'Baseline'.padEnd(15)} ${variantName.padEnd(15)} ${'Difference'.padEnd(15)}`));
  console.log(chalk.gray('─'.repeat(70)));

  for (const metric of metrics) {
    const diffNum = Number.parseFloat(metric.diff);
    const isImprovement = metric.higherIsBetter ? diffNum > 0 : diffNum < 0;
    const diffColor = isImprovement ? chalk.green : diffNum === 0 ? chalk.gray : chalk.red;
    const arrow = diffNum > 0 ? '↑' : diffNum < 0 ? '↓' : '→';

    console.log(
      chalk.white(metric.name.padEnd(20)),
      chalk.white(metric.baseline.padEnd(15)),
      chalk.white(metric.variant.padEnd(15)),
      diffColor(`${arrow} ${metric.diff}${metric.unit}`.padEnd(15)),
    );
  }

  console.log('');
}

async function main() {
  // Load story
  const storyData = getStory(options.story);
  const baselinePrompt = getPrompt(options.baselinePrompt);
  const variantPrompt = getPrompt(options.variantPrompt);

  const variantNarrator = options.variantNarrator || options.baselineNarrator;

  console.log(chalk.cyan('\n🧪 A/B Test Configuration:\n'));
  console.log(chalk.white(`Story: ${chalk.bold(storyData.title)}`));
  console.log(chalk.white(`Runs per variant: ${chalk.bold(options.runs)}`));
  console.log('');
  console.log(chalk.white('Baseline:'));
  console.log(chalk.white(`  Prompt: ${chalk.bold(options.baselinePrompt)}`));
  console.log(chalk.white(`  Narrator: ${chalk.bold(options.baselineNarrator)}`));
  console.log('');
  console.log(chalk.white('Variant:'));
  console.log(chalk.white(`  Prompt: ${chalk.bold(options.variantPrompt)}`));
  console.log(chalk.white(`  Narrator: ${chalk.bold(variantNarrator)}`));
  console.log('');

  // Run baseline sessions
  console.log(chalk.cyan('🎯 Running baseline sessions...'));
  const baselineResults: SessionResult[] = [];

  for (let i = 0; i < options.runs; i++) {
    console.log(chalk.gray(`Baseline run ${i + 1}/${options.runs}...`));

    const config: SessionRunnerConfig = {
      story: {
        storyId: storyData.id,
        storyTitle: storyData.title,
        storySetting: storyData.description || 'Unknown',
        storyGenre: 'Interactive fiction',
      },
      systemPrompt: withStoryGuide(baselinePrompt.content, storyData.storyGuide),
      storyGuide: storyData.storyGuide,
      narratorModel: options.baselineNarrator as NarratorModel,
      groupSize: options.players,
      maxTurns: options.maxTurns,
    };

    const result = await runSession(config);
    baselineResults.push(result);
  }

  // Run variant sessions
  console.log(chalk.cyan('\n🔬 Running variant sessions...'));
  const variantResults: SessionResult[] = [];

  for (let i = 0; i < options.runs; i++) {
    console.log(chalk.gray(`Variant run ${i + 1}/${options.runs}...`));

    const config: SessionRunnerConfig = {
      story: {
        storyId: storyData.id,
        storyTitle: storyData.title,
        storySetting: storyData.description || 'Unknown',
        storyGenre: 'Interactive fiction',
      },
      systemPrompt: withStoryGuide(variantPrompt.content, storyData.storyGuide),
      storyGuide: storyData.storyGuide,
      narratorModel: variantNarrator as NarratorModel,
      groupSize: options.players,
      maxTurns: options.maxTurns,
    };

    const result = await runSession(config);
    variantResults.push(result);
  }

  // Calculate and display comparison
  const baselineStats = calculateStats(baselineResults);
  const variantStats = calculateStats(variantResults);

  printComparison(baselineStats, variantStats, 'Variant');

  console.log(chalk.cyan('✨ A/B test complete!\n'));
}

main();
