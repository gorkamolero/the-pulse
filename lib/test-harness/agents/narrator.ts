/**
 * Narrator Wrapper
 *
 * Wraps narrator model configuration and provides interface for generating
 * story content. All models are accessed through OpenRouter.
 */

export type NarratorModel = 'opus-4.5' | 'grok-4' | 'deepseek-v3.2';

export interface NarratorConfig {
  model: NarratorModel;
  systemPrompt: string;
  storyGuide: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenRouter model identifiers
 * All narrator models use OpenRouter for unified access
 */
export const NARRATOR_MODEL_MAP: Record<NarratorModel, string> = {
  'opus-4.5': 'anthropic/claude-opus-4.5',
  'grok-4': 'x-ai/grok-4.1-fast',
  'deepseek-v3.2': 'deepseek/deepseek-v3.2',
};

/**
 * All narrator models use OpenRouter
 */
export function getNarratorProvider(_model: NarratorModel): 'openrouter' {
  return 'openrouter';
}

/**
 * Create narrator instance (placeholder)
 * Full implementation will be in session runner
 */
export function createNarrator(config: NarratorConfig) {
  return {
    config,
    modelId: NARRATOR_MODEL_MAP[config.model],
    provider: getNarratorProvider(config.model),
  };
}
