/**
 * System Prompt Loader
 *
 * Imports and prepares the production system prompt for test harness.
 * No variants - we test what ships.
 */

import { systemPrompt as productionPrompt } from '../../ai/prompts/system';

/**
 * Get the production system prompt with story guide injected
 */
export function getSystemPrompt(
  storyGuide: string,
  language = 'english',
): string {
  return productionPrompt({ storyGuide, language });
}
