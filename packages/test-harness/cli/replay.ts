#!/usr/bin/env node

/**
 * CLI for Replay
 *
 * Command: pnpm test:replay --checkpoint [path] --prompt [new-prompt-name]
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import {
  loadCheckpoint,
  applyReplayConfig,
  type ReplayConfig,
} from '../checkpoint/load';
import type { NarratorModel } from '../agents/narrator';
import { getSystemPrompt } from '../prompts/loader';

// Load environment variables
config();

const program = new Command();

program
  .name('test-replay')
  .description(
    'Replay session from checkpoint (uses current production prompt)',
  )
  .requiredOption('--checkpoint <path>', 'Path to checkpoint file')
  .option(
    '--narrator <model>',
    'Override narrator model (opus-4.5, grok-4, deepseek-v3.2)',
  )
  .option('--temperature <number>', 'Override temperature', Number.parseFloat)
  .parse();

const options = program.opts();

// System prompts (same as run.ts)
// PROMPTS removed - now using production prompt loader

async function main() {
  console.log(chalk.cyan('\n🔄 Replay from Checkpoint\n'));

  // Load checkpoint
  const loadSpinner = ora('Loading checkpoint...').start();

  try {
    const checkpoint = await loadCheckpoint(options.checkpoint);
    loadSpinner.succeed(chalk.green('Checkpoint loaded'));

    console.log(chalk.white(`Session ID: ${chalk.bold(checkpoint.sessionId)}`));
    console.log(chalk.white(`Turn: ${chalk.bold(checkpoint.turn)}`));
    console.log(
      chalk.white(
        `Original Narrator: ${chalk.bold(checkpoint.sessionConfig.narratorConfig.model)}`,
      ),
    );

    // Build replay config - always use current production prompt
    const replayConfig: ReplayConfig = {};

    // Get story guide from checkpoint and use current production prompt
    const storyGuide = checkpoint.sessionConfig.storyGuide || '';
    replayConfig.systemPrompt = getSystemPrompt(storyGuide);
    console.log(chalk.yellow('→ Using current production prompt'));

    if (options.narrator) {
      replayConfig.narratorModel = options.narrator as NarratorModel;
      console.log(chalk.yellow(`→ Changing narrator to: ${options.narrator}`));
    }

    if (options.temperature !== undefined) {
      replayConfig.temperature = options.temperature;
      console.log(
        chalk.yellow(`→ Changing temperature to: ${options.temperature}`),
      );
    }

    if (options.maxTokens !== undefined) {
      replayConfig.maxTokens = options.maxTokens;
      console.log(
        chalk.yellow(`→ Changing max tokens to: ${options.maxTokens}`),
      );
    }

    // Apply config changes
    const updatedCheckpoint = applyReplayConfig(checkpoint, replayConfig);

    if (Object.keys(replayConfig).length > 0) {
      console.log(
        chalk.green(
          `\n✓ Config updated. New session ID: ${updatedCheckpoint.sessionId}`,
        ),
      );
      console.log(
        chalk.gray(
          `  Branch reason: ${updatedCheckpoint.metadata.branchReason}`,
        ),
      );
    } else {
      console.log(
        chalk.yellow(
          '\n⚠️  No config changes specified, continuing with original config',
        ),
      );
    }

    console.log('\n');

    // Resume session from checkpoint
    const { resumeSessionFromCheckpoint } = await import('../session/runner');
    const runSpinner = ora('Resuming session from checkpoint...').start();

    try {
      const result = await resumeSessionFromCheckpoint(updatedCheckpoint);

      runSpinner.succeed(chalk.green('Session completed!'));

      console.log(chalk.cyan('\n📊 Session Results:\n'));
      console.log(chalk.white(`Session ID: ${chalk.bold(result.sessionId)}`));
      console.log(chalk.white(`Outcome: ${chalk.bold(result.outcome)}`));
      console.log(chalk.white(`Turns: ${chalk.bold(result.finalTurn)}`));
      console.log(
        chalk.white(
          `Duration: ${chalk.bold(`${Math.round(result.duration / 1000)}s`)}`,
        ),
      );

      // Generate report
      const { saveSessionReport } = await import('../report/markdown');
      const reportSpinner = ora('Generating report...').start();
      const reportPath = await saveSessionReport(result);
      reportSpinner.succeed(chalk.green(`Report saved: ${reportPath}`));

      console.log(chalk.cyan('\n✨ Replay complete!\n'));
    } catch (error) {
      runSpinner.fail(chalk.red('Session replay failed'));
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  } catch (error) {
    loadSpinner.fail(chalk.red('Failed to load checkpoint'));
    console.error(chalk.red('\nError:'), error);
    process.exit(1);
  }
}

main();
