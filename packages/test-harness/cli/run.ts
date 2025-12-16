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
import type { ArchetypeId } from '../archetypes/types';
import { getStory, listStoryIds } from '../stories/loader';
import { getSystemPrompt, PROMPT_STYLES, type PromptStyle } from '../prompts/loader';
import {
  withStoryRequired,
  withNarrator,
  withPlayers,
  withArchetypes,
  withMaxTurns,
  withLanguage,
  withPromptStyle,
} from './shared-options';

// Load environment variables from .env.local (Next.js convention)
config({ path: '.env.local' });

const program = new Command();

program.name('test-run').description('Run a test harness session');

withStoryRequired(program);
withNarrator(program);
withPlayers(program);
withMaxTurns(program);
program.option('--temperature <number>', 'Temperature', (v) => Number.parseFloat(v), 0.7);
withLanguage(program);
withArchetypes(program);
withPromptStyle(program);
program.option('--dry-run', 'Show config without executing');
program.parse();

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
    console.log(
      chalk.yellow('Available stories:'),
      availableStories.join(', '),
    );
    process.exit(1);
  }

  // Validate prompt style
  const promptStyle = options.prompt as PromptStyle;
  if (!PROMPT_STYLES.includes(promptStyle)) {
    console.error(chalk.red(`Unknown prompt style: ${options.prompt}`));
    console.log(chalk.yellow('Available styles:'), PROMPT_STYLES.join(', '));
    process.exit(1);
  }

  // Get system prompt for selected style
  const systemPrompt = getSystemPrompt(storyGuide, options.language, promptStyle);

  // Parse archetypes if provided
  const archetypes = options.archetypes
    ? (options.archetypes.split(',').map((id: string) => id.trim()) as ArchetypeId[])
    : undefined;

  const config = {
    story,
    systemPrompt,
    storyGuide,
    narratorModel: options.narrator as NarratorModel,
    groupSize: options.players,
    archetypes,
    maxTurns: options.maxTurns,
    temperature: options.temperature,
    language: options.language,
    promptStyle,
  };

  if (options.dryRun) {
    const playerInfo = archetypes
      ? archetypes.join(', ')
      : `${options.players || 'random'} players`;
    console.log(
      chalk.cyan(
        `\n📋 ${story.storyTitle} | ${options.narrator} | ${promptStyle} prompt | ${playerInfo} | ${options.maxTurns} turns`,
      ),
    );
    console.log(chalk.yellow('[Dry run - not executing]\n'));
    process.exit(0);
  }

  try {
    const result = await runSession(config);

    console.log(
      chalk.green(
        `\n✔ ${result.outcome} | ${result.finalTurn} turns | ${Math.round(result.duration / 1000)}s`,
      ),
    );

    // Only generate report if session has valid config
    if (result.config && result.outcome !== 'failed') {
      const reportSpinner = ora('Generating report...').start();
      const reportPath = await saveSessionReport(result);
      reportSpinner.succeed(`Report: ${reportPath}`);
    } else if (result.error) {
      console.log(chalk.red(`\nError: ${result.error}`));
    }
  } catch (error) {
    console.log(chalk.red('\n✖ Session failed'));
    console.error(error);
    process.exit(1);
  }
}

main();
