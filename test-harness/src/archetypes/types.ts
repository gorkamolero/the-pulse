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

export const ARCHETYPE_MODEL_MAP: Record<PlayerModel, string> = {
  grok: 'x-ai/grok-2-1212',
  qwen: 'qwen/qwen-2.5-72b-instruct',
  deepseek: 'deepseek/deepseek-chat',
  'kimi-k2': 'moonshot/moonshot-v1-8k',
};
