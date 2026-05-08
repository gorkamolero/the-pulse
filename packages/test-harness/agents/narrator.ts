/**
 * Narrator Wrapper
 *
 * Wraps narrator model configuration and provides interface for generating
 * story content. All models are accessed through Vercel AI Gateway.
 */

export type NarratorModel =
  | 'opus-4.6'
  | 'xai/grok-4.3'
  | 'deepseek-v4-pro'
  | 'deepseek-v4-flash'
  | 'moonshotai/kimi-k2.6';

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
  'opus-4.6': 'anthropic/claude-opus-4.6',
  'xai/grok-4.3': 'xai/grok-4.3',
  'deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'moonshotai/kimi-k2.6': 'moonshotai/kimi-k2.6',
};

/**
 * Models that use <think> tags for reasoning (need extractReasoningMiddleware)
 */
export const THINK_TAG_MODELS: NarratorModel[] = [];

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
