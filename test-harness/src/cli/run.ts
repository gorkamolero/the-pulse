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

// Load environment variables
config();

const program = new Command();

program
  .name('test-run')
  .description('Run a test harness session')
  .requiredOption('--story <id>', 'Story ID (innsmouth, hollow-choir, etc.)')
  .requiredOption('--prompt <name>', 'System prompt variant (baseline, pulse-aware, etc.)')
  .requiredOption('--narrator <model>', 'Narrator model (opus-4.5, grok-4, deepseek-r2)')
  .option('--players <number>', 'Group size (2-5)', parseInt)
  .option('--max-turns <number>', 'Maximum turns', parseInt, 100)
  .option('--temperature <number>', 'Temperature', parseFloat, 0.7)
  .option('--dry-run', 'Show config without executing')
  .parse();

const options = program.opts();

// Story configurations
const STORIES: Record<string, StoryContext> = {
  innsmouth: {
    storyId: 'shadow-over-innsmouth',
    storyTitle: 'Shadow Over Innsmouth',
    storySetting: 'Coastal town of Innsmouth, 1920s New England',
    storyGenre: 'Lovecraftian horror',
  },
  'hollow-choir': {
    storyId: 'the-hollow-choir',
    storyTitle: 'The Hollow Choir',
    storySetting: 'Flooded city with haunting song',
    storyGenre: 'Gothic horror',
  },
  'whispering-pines': {
    storyId: 'whispering-pines',
    storyTitle: 'Whispering Pines',
    storySetting: 'Isolated cabin in the woods',
    storyGenre: 'Psychological horror',
  },
  'red-dust': {
    storyId: 'siren-of-the-red-dust',
    storyTitle: 'Siren of the Red Dust',
    storySetting: 'Mars colony',
    storyGenre: 'Sci-fi thriller',
  },
};

// System prompts
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

// Story guides (placeholder - would load from files)
const STORY_GUIDES: Record<string, string> = {
  'shadow-over-innsmouth': `Setting: Coastal town of Innsmouth, 1920s New England
Atmosphere: Decaying architecture, fish smell, suspicious locals, cult activity
Key Locations: Town square, old church, docks, Marsh mansion
NPCs: Zadok Allen (drunk old sailor), Obed Marsh (cult leader), innkeeper
Story Arc: Arrival → Investigation → Discovery → Confrontation → Escape/Revelation
Pulses: ~20 beats building tension toward cosmic horror revelation`,
  'the-hollow-choir': `Setting: Flooded city ruins, haunting choir song in distance
Atmosphere: Gothic, melancholic, mysterious
Story Arc: ~20 beats exploring the flooded city and uncovering the choir's origin`,
  'whispering-pines': `Setting: Isolated cabin in dark woods
Atmosphere: Psychological horror, paranoia, isolation
Story Arc: ~20 beats of mounting dread and revelation`,
  'siren-of-the-red-dust': `Setting: Mars colony, red dust storms
Atmosphere: Sci-fi thriller, corporate conspiracy
Story Arc: ~20 beats of investigation and survival`,
};

async function main() {
  const story = STORIES[options.story];
  if (!story) {
    console.error(chalk.red(`Unknown story: ${options.story}`));
    console.log(chalk.yellow('Available stories:'), Object.keys(STORIES).join(', '));
    process.exit(1);
  }

  const systemPrompt = PROMPTS[options.prompt];
  if (!systemPrompt) {
    console.error(chalk.red(`Unknown prompt: ${options.prompt}`));
    console.log(chalk.yellow('Available prompts:'), Object.keys(PROMPTS).join(', '));
    process.exit(1);
  }

  const storyGuide = STORY_GUIDES[story.storyId] || 'Story guide not found';

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
  console.log(chalk.white(`Prompt: ${chalk.bold(options.prompt)}`));
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
