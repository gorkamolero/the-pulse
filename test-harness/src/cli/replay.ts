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
import { saveSessionReport } from '../report/markdown';
import type { NarratorModel } from '../agents/narrator';

// Load environment variables
config();

const program = new Command();

program
  .name('test-replay')
  .description('Replay session from checkpoint with config changes')
  .requiredOption('--checkpoint <path>', 'Path to checkpoint file')
  .option('--prompt <name>', 'New system prompt variant')
  .option('--narrator <model>', 'New narrator model (opus-4.5, grok-4, deepseek-r2)')
  .option('--temperature <number>', 'New temperature', parseFloat)
  .option('--max-tokens <number>', 'New max tokens', parseInt)
  .parse();

const options = program.opts();

// System prompts (same as run.ts)
const PROMPTS: Record<string, string> = {
  baseline: `You are the narrator for an interactive fiction experience. Guide players through an immersive story with atmospheric descriptions, meaningful choices, and engaging narrative beats.

Your role:
- Deliver the story in approximately 20 "pulses" (story beats)
- Create vivid, atmospheric scenes
- Present meaningful choices to players
- Handle player tangents gracefully
- Maintain narrative momentum
- Provide satisfying conclusion

Remember to stay flexible and responsive to player actions while guiding the story forward.`,

  'pulse-aware': `You are the narrator for an interactive fiction experience. You must deliver the story in EXACTLY 20 "pulses" (major story beats).

PULSE TRACKING (CRITICAL):
- You are currently on pulse [track this internally]
- Each pulse should advance the narrative meaningfully
- Aim for roughly 20 pulses total to complete the story
- If you're past pulse 15, start building toward conclusion
- If you're at pulse 20, deliver the ending

Your role:
- Create vivid, atmospheric scenes
- Present meaningful choices
- Handle tangents gracefully but return to story progression
- Maintain clear narrative momentum
- Conclude satisfyingly at pulse 20`,
};

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

    // Build replay config
    const replayConfig: ReplayConfig = {};

    if (options.prompt) {
      const systemPrompt = PROMPTS[options.prompt];
      if (!systemPrompt) {
        console.error(chalk.red(`Unknown prompt: ${options.prompt}`));
        console.log(chalk.yellow('Available prompts:'), Object.keys(PROMPTS).join(', '));
        process.exit(1);
      }
      replayConfig.systemPrompt = systemPrompt;
      console.log(chalk.yellow(`→ Changing prompt to: ${options.prompt}`));
    }

    if (options.narrator) {
      replayConfig.narratorModel = options.narrator as NarratorModel;
      console.log(chalk.yellow(`→ Changing narrator to: ${options.narrator}`));
    }

    if (options.temperature !== undefined) {
      replayConfig.temperature = options.temperature;
      console.log(chalk.yellow(`→ Changing temperature to: ${options.temperature}`));
    }

    if (options.maxTokens !== undefined) {
      replayConfig.maxTokens = options.maxTokens;
      console.log(chalk.yellow(`→ Changing max tokens to: ${options.maxTokens}`));
    }

    // Apply config changes
    const updatedCheckpoint = applyReplayConfig(checkpoint, replayConfig);

    if (Object.keys(replayConfig).length > 0) {
      console.log(
        chalk.green(`\n✓ Config updated. New session ID: ${updatedCheckpoint.sessionId}`),
      );
      console.log(chalk.gray(`  Branch reason: ${updatedCheckpoint.metadata.branchReason}`));
    } else {
      console.log(chalk.yellow('\n⚠️  No config changes specified, continuing with original config'));
    }

    // TODO: Resume session from checkpoint
    // This would require integration with session runner to continue from a specific turn
    console.log(chalk.yellow('\n⚠️  Session replay not yet implemented'));
    console.log(
      chalk.gray('  Checkpoint loaded and config applied successfully, but session runner'),
    );
    console.log(chalk.gray('  integration for replay is pending.'));

    console.log(chalk.cyan('\n✨ Replay preparation complete!\n'));
  } catch (error) {
    loadSpinner.fail(chalk.red('Failed to load checkpoint'));
    console.error(chalk.red('\nError:'), error);
    process.exit(1);
  }
}

main();
