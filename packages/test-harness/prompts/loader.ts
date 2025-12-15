/**
 * System Prompt Loader
 *
 * Supports multiple narrator prompt variants for A/B testing.
 * Default is 'production' - test exactly what ships.
 */

import { systemPrompt as productionPrompt } from '@pulse/core/ai/prompts/system';
import { mechanicalPrompt } from '@pulse/core/ai/prompts/mechanical';
import { philosophicalPrompt } from '@pulse/core/ai/prompts/philosophical';
import { minimalPrompt } from '@pulse/core/ai/prompts/minimal';

export type PromptStyle = 'production' | 'mechanical' | 'philosophical' | 'minimal';

export const PROMPT_STYLES: PromptStyle[] = ['production', 'mechanical', 'philosophical', 'minimal'];

export const PROMPT_DESCRIPTIONS: Record<PromptStyle, string> = {
  production: 'Exactly what ships in the real game',
  mechanical: 'Structure-focused with pulse tracking and three-act structure',
  philosophical: 'Feelings-first approach - curiosity, dread, connection over plot',
  minimal: 'Stripped to essentials - trust the model',
};

/**
 * Get a system prompt by style with story guide injected
 */
export function getSystemPrompt(
  storyGuide: string,
  language = 'english',
  style: PromptStyle = 'minimal',
): string {
  switch (style) {
    case 'production':
      return productionPrompt({ storyGuide, language });
    case 'philosophical':
      return philosophicalPrompt({ storyGuide, language });
    case 'minimal':
      return minimalPrompt({ storyGuide, language });
    case 'mechanical':
    default:
      return mechanicalPrompt({ storyGuide, language });
  }
}

/**
 * List available prompt styles
 */
export function listPromptStyles(): PromptStyle[] {
  return [...PROMPT_STYLES];
}
