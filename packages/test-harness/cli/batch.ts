#!/usr/bin/env node

/**
 * Batch Analysis CLI
 *
 * Run multiple sessions in parallel for statistical analysis
 * Command: pnpm test:batch --config [file]
 */

import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import { runSession, type SessionRunnerConfig } from '../session/runner';
import { saveSessionReport } from '../report/markdown';
import { getStory, listStoryIds } from '../stories/loader';
import { getSystemPrompt } from '../prompts/loader';
import type { NarratorModel } from '../agents/narrator';
import type { SessionResult } from '../session/runner';

// Load environment variables
loadEnv();

const program = new Command();

export interface BatchConfig {
  /** Configurations to run */
  sessions: Array<{
    story: string;
    prompt: string;
    narrator: NarratorModel;
    runs: number;
    tags?: string[];
  }>;
  /** Maximum parallel sessions */
  maxParallel?: number;
  /** Output directory for reports */
  outputDir?: string;
}

program
  .name('test-batch')
  .description('Run multiple test sessions for batch analysis')
  .requiredOption(
    '--sessions <number>',
    'Number of sessions to run per configuration',
    Number.parseInt,
  )
  .option('--story <id>', `Story ID (${listStoryIds().join(', ')})`)
  .option(
    '--narrator <model>',
    'Narrator model (opus-4.5, grok-4, deepseek-v3.2)',
  )
  .option(
    '--max-parallel <number>',
    'Maximum parallel sessions',
    Number.parseInt,
    3,
  )
  .option('--players <number>', 'Group size (2-5)', Number.parseInt)
  .option('--max-turns <number>', 'Maximum turns', Number.parseInt, 100)
  .parse();

const options = program.opts();

async function runBatchSession(
  config: SessionRunnerConfig,
  index: number,
  total: number,
): Promise<SessionResult> {
  console.log(chalk.cyan(`\n[${index + 1}/${total}] Starting session...`));

  const result = await runSession(config);

  console.log(
    chalk.green(`[${index + 1}/${total}] Session completed: ${result.outcome}`),
  );

  // Generate report
  await saveSessionReport(result);

  return result;
}

async function main() {
  if (!options.story || !options.narrator) {
    console.error(chalk.red('Error: --story and --narrator are required'));
    console.log(chalk.yellow('Available stories:'), listStoryIds().join(', '));
    process.exit(1);
  }

  // Load story
  let storyData: ReturnType<typeof getStory>;

  try {
    storyData = getStory(options.story);
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }

  const config: SessionRunnerConfig = {
    story: {
      storyId: storyData.id,
      storyTitle: storyData.title,
      storySetting: storyData.description || 'Unknown setting',
      storyGenre: 'Interactive fiction',
    },
    systemPrompt: getSystemPrompt(storyData.storyGuide),
    storyGuide: storyData.storyGuide,
    narratorModel: options.narrator as NarratorModel,
    groupSize: options.players,
    maxTurns: options.maxTurns,
  };

  console.log(chalk.cyan('\n📊 Batch Analysis Configuration:\n'));
  console.log(chalk.white(`Story: ${chalk.bold(storyData.title)}`));
  console.log(chalk.white(`Narrator: ${chalk.bold(options.narrator)}`));
  console.log(chalk.white(`Sessions: ${chalk.bold(options.sessions)}`));
  console.log(chalk.white(`Max Parallel: ${chalk.bold(options.maxParallel)}`));
  console.log('');

  const results: SessionResult[] = [];
  const spinner = ora('Running batch sessions...').start();

  try {
    // Run sessions in batches
    for (let i = 0; i < options.sessions; i += options.maxParallel) {
      const batch = [];
      const batchSize = Math.min(options.maxParallel, options.sessions - i);

      for (let j = 0; j < batchSize; j++) {
        batch.push(runBatchSession(config, i + j, options.sessions));
      }

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);

      spinner.text = `Completed ${results.length}/${options.sessions} sessions...`;
    }

    spinner.succeed(chalk.green('All sessions completed!'));

    // Calculate statistics
    console.log(chalk.cyan('\n📈 Batch Statistics:\n'));

    const completed = results.filter((r) => r.outcome === 'completed').length;
    const timeout = results.filter((r) => r.outcome === 'timeout').length;
    const failed = results.filter((r) => r.outcome === 'failed').length;

    console.log(chalk.white(`Total Sessions: ${chalk.bold(results.length)}`));
    console.log(
      chalk.green(
        `✓ Completed: ${completed} (${((completed / results.length) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.yellow(
        `⏱ Timeout: ${timeout} (${((timeout / results.length) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.red(
        `✗ Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`,
      ),
    );

    const avgTurns =
      results.reduce((sum, r) => sum + r.finalTurn, 0) / results.length;
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log(
      chalk.white(`\nAverage Turns: ${chalk.bold(avgTurns.toFixed(1))}`),
    );
    console.log(
      chalk.white(
        `Average Duration: ${chalk.bold((avgDuration / 1000).toFixed(1))}s`,
      ),
    );

    if (results[0]?.costBreakdown) {
      const avgCost =
        results.reduce(
          (sum, r) => sum + (r.costBreakdown?.total.cost || 0),
          0,
        ) / results.length;
      console.log(
        chalk.white(`Average Cost: ${chalk.bold(`$${avgCost.toFixed(4)}`)}`),
      );
    }

    console.log(chalk.cyan('\n✨ Batch analysis complete!\n'));
  } catch (error) {
    spinner.fail(chalk.red('Batch analysis failed'));
    console.error(chalk.red('\nError:'), error);
    process.exit(1);
  }
}

main();
