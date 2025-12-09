/**
 * Narrator Wrapper
 *
 * Wraps narrator model configuration and provides interface for generating
 * story content.
 */

export type NarratorModel = 'opus-4.5' | 'grok-4' | 'deepseek-r2';

export interface NarratorConfig {
  model: NarratorModel;
  systemPrompt: string;
  storyGuide: string;
  temperature?: number;
  maxTokens?: number;
}

export const NARRATOR_MODEL_MAP: Record<NarratorModel, string> = {
  'opus-4.5': 'claude-opus-4.5-20250514',
  'grok-4': 'x-ai/grok-2-1212',
  'deepseek-r2': 'deepseek/deepseek-chat',
};

/**
 * Get model provider for narrator model
 */
export function getNarratorProvider(model: NarratorModel): 'anthropic' | 'openrouter' {
  return model === 'opus-4.5' ? 'anthropic' : 'openrouter';
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
