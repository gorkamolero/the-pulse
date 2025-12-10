#!/usr/bin/env node

/**
 * CLI for Running Sessions
 *
 * Command: pnpm test:run --story [id] --prompt [name] --narrator [model]
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import { runSession } from '../session/runner';
import { saveSessionReport } from '../report/markdown';
import type { StoryContext } from '../agents/player';
import type { NarratorModel } from '../agents/narrator';
import { getStory, listStoryIds } from '../stories/loader';
import { getSystemPrompt } from '../prompts/loader';

// Load environment variables
config();

const program = new Command();

program
  .name('test-run')
  .description('Run a test harness session')
  .requiredOption('--story <id>', 'Story ID (shadow-over-innsmouth, the-hollow-choir, whispering-pines, siren-of-the-red-dust, endless-path)')
  .requiredOption('--narrator <model>', 'Narrator model (opus-4.5, grok-4, deepseek-r1)')
  .option('--players <number>', 'Group size (2-5)', Number.parseInt)
  .option('--max-turns <number>', 'Maximum turns', Number.parseInt, 100)
  .option('--temperature <number>', 'Temperature', Number.parseFloat, 0.7)
  .option('--dry-run', 'Show config without executing')
  .parse();

const options = program.opts();

// StoryContext builder helper
function buildStoryContext(storyId: string): StoryContext {
  const loadedStory = getStory(storyId);

  // Extract setting and genre from description or use defaults
  const setting = loadedStory.description || 'Unknown setting';
  const genre = 'Interactive fiction';

  return {
    storyId: loadedStory.id,
    storyTitle: loadedStory.title,
    storySetting: setting,
    storyGenre: genre,
  };
}



async function main() {
  // Load story using the story loader
  let story: StoryContext;
  let storyGuide: string;

  try {
    story = buildStoryContext(options.story);
    const loadedStory = getStory(options.story);
    storyGuide = loadedStory.storyGuide;
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    const availableStories = listStoryIds();
    console.log(chalk.yellow('Available stories:'), availableStories.join(', '));
    process.exit(1);
  }

  // Get production system prompt
  const systemPrompt = getSystemPrompt(storyGuide);

  const config = {
    story,
    systemPrompt,
    storyGuide,
    narratorModel: options.narrator as NarratorModel,
    groupSize: options.players,
    maxTurns: options.maxTurns,
    temperature: options.temperature,
  };

  console.log(chalk.cyan('\n📋 Session Configuration:\n'));
  console.log(chalk.white(`Story: ${chalk.bold(story.storyTitle)}`));
  console.log(chalk.white(`Narrator: ${chalk.bold(options.narrator)}`));
  console.log(chalk.white(`Group Size: ${chalk.bold(options.players || 'random')}`));
  console.log(chalk.white(`Max Turns: ${chalk.bold(options.maxTurns)}`));

  if (options.dryRun) {
    console.log(chalk.yellow('\n[Dry run - not executing]\n'));
    process.exit(0);
  }

  console.log('\n');

  const spinner = ora('Running session...').start();

  try {
    const result = await runSession(config);

    spinner.succeed(chalk.green('Session completed!'));

    console.log(chalk.cyan('\n📊 Session Results:\n'));
    console.log(chalk.white(`Session ID: ${chalk.bold(result.sessionId)}`));
    console.log(chalk.white(`Outcome: ${chalk.bold(result.outcome)}`));
    console.log(chalk.white(`Turns: ${chalk.bold(result.finalTurn)}`));
    console.log(
      chalk.white(`Pulses: ${chalk.bold(`${result.detectedPulses.length}/~20`)}`),
    );
    console.log(
      chalk.white(`Duration: ${chalk.bold(`${Math.round(result.duration / 1000)}s`)}`),
    );

    // Generate report
    const reportSpinner = ora('Generating report...').start();
    const reportPath = await saveSessionReport(result);
    reportSpinner.succeed(chalk.green(`Report saved: ${reportPath}`));

    console.log(chalk.cyan('\n✨ Session complete!\n'));
  } catch (error) {
    spinner.fail(chalk.red('Session failed'));
    console.error(chalk.red('\nError:'), error);
    process.exit(1);
  }
}

main();
