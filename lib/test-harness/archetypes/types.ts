/**
 * Player Archetype Types
 */

export type ArchetypeId =
  | 'joker'
  | 'engaged'
  | 'questioner'
  | 'wildcard'
  | 'follower'
  | 'curious'
  | 'optimizer'
  | 'invested'
  | 'drifter'
  | 'experienced';

export type PlayerModel = 'grok' | 'qwen' | 'deepseek' | 'kimi-k2';

export interface Archetype {
  id: ArchetypeId;
  name: string;
  style: string;
  context: string;
  patterns: string[];
  quirkFrequency: number;
  testsFor: string[];
  model: PlayerModel;
}

/**
 * OpenRouter model identifiers for player agents
 * All models accessed through OpenRouter
 */
export const ARCHETYPE_MODEL_MAP: Record<PlayerModel, string> = {
  grok: 'x-ai/grok-4.1-fast',
  qwen: 'qwen/qwen-2.5-72b-instruct',
  deepseek: 'deepseek/deepseek-v3.2',
  'kimi-k2': 'moonshotai/kimi-k2',
};
