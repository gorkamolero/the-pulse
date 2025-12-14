/**
 * Narrator Wrapper
 *
 * Wraps narrator model configuration and provides interface for generating
 * story content. All models are accessed through Vercel AI Gateway.
 */

export type NarratorModel = 'opus-4.5' | 'grok-4' | 'deepseek-v3.2' | 'kimi-k2-thinking';

export interface NarratorConfig {
  model: NarratorModel;
  systemPrompt: string;
  storyGuide: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI Gateway model identifiers
 * All narrator models use Vercel AI Gateway for unified access
 */
export const NARRATOR_MODEL_MAP: Record<NarratorModel, string> = {
  'opus-4.5': 'anthropic/claude-opus-4.5',
  'grok-4': 'xai/grok-4.1-fast-reasoning',
  'deepseek-v3.2': 'deepseek/deepseek-v3.2-thinking',
  'kimi-k2-thinking': 'moonshotai/kimi-k2-thinking',
};

/**
 * Models that use <think> tags for reasoning (need extractReasoningMiddleware)
 */
export const THINK_TAG_MODELS: NarratorModel[] = ['deepseek-v3.2', 'kimi-k2-thinking'];

/**
 * All narrator models use AI Gateway
 */
export function getNarratorProvider(_model: NarratorModel): 'ai-gateway' {
  return 'ai-gateway';
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
