/**
 * Shared CLI Options
 *
 * Centralized option definitions for consistent defaults across all CLI commands.
 */

import type { Command } from 'commander';
import { NARRATOR_MODEL_MAP, type NarratorModel } from '../agents/narrator';
import { listStoryIds } from '../stories/loader';

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULTS = {
  players: 3,
  maxTurns: 50,
  language: 'english',
  narrator: 'deepseek-v3.2' as NarratorModel,
  promptStyle: 'mechanical',
} as const;

// ============================================================================
// Parsers
// ============================================================================

const parseIntArg = (v: string) => Number.parseInt(v, 10);

// ============================================================================
// Option Builders
// ============================================================================

/**
 * Add --story option (required)
 */
export function withStoryRequired(program: Command): Command {
  const available = listStoryIds().join(', ');
  return program.requiredOption('--story <id>', `Story ID (${available})`);
}

/**
 * Add --story option (optional)
 */
export function withStory(program: Command): Command {
  const available = listStoryIds().join(', ');
  return program.option('--story <id>', `Story ID (${available})`);
}

/**
 * Add --narrator option
 */
export function withNarrator(program: Command, required = false): Command {
  const available = Object.keys(NARRATOR_MODEL_MAP).join(', ');
  const desc = `Narrator model (${available})`;

  if (required) {
    return program.requiredOption('--narrator <model>', desc);
  }
  return program.option('--narrator <model>', desc, DEFAULTS.narrator);
}

/**
 * Add --players option
 */
export function withPlayers(program: Command): Command {
  return program.option(
    '--players <number>',
    'Group size (2-5)',
    parseIntArg,
    DEFAULTS.players,
  );
}

/**
 * Add --archetypes option
 */
export function withArchetypes(program: Command): Command {
  return program.option(
    '--archetypes <ids>',
    'Comma-separated archetype IDs',
  );
}

/**
 * Add --max-turns option
 */
export function withMaxTurns(program: Command): Command {
  return program.option(
    '--max-turns <number>',
    'Maximum turns',
    parseIntArg,
    DEFAULTS.maxTurns,
  );
}

/**
 * Add --language option
 */
export function withLanguage(program: Command): Command {
  return program.option(
    '--language <lang>',
    'Output language',
    DEFAULTS.language,
  );
}

/**
 * Add --prompt option
 */
export function withPromptStyle(program: Command): Command {
  return program.option(
    '--prompt <style>',
    'Prompt style (mechanical, philosophical, minimal)',
    DEFAULTS.promptStyle,
  );
}

/**
 * Add --no-gemini-eval option (defaults to eval ON)
 */
export function withGeminiEval(program: Command): Command {
  return program.option(
    '--no-gemini-eval',
    'Skip Gemini Pro evaluation after each session',
  );
}

// ============================================================================
// Combo Builders
// ============================================================================

/**
 * Add common session options: players, archetypes, max-turns, language
 */
export function withSessionOptions(program: Command): Command {
  withPlayers(program);
  withArchetypes(program);
  withMaxTurns(program);
  withLanguage(program);
  return program;
}

/**
 * Add all comparison options: narrator, players, archetypes, max-turns, language, gemini-eval
 */
export function withComparisonOptions(program: Command): Command {
  withNarrator(program);
  withSessionOptions(program);
  withGeminiEval(program);
  return program;
}
