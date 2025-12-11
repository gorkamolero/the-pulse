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
  qwen: 'qwen/qwen3-32b',
  deepseek: 'deepseek/deepseek-v3.2',
  'kimi-k2': 'moonshotai/kimi-k2',
};

/**
 * Group Context - How the friend group knows each other
 */
export interface GroupContext {
  /** How they know each other */
  relationship: string;
  /** How long they've known each other */
  history: string;
  /** Why they're playing tonight */
  occasion: string;
  /** Role description of who found The Pulse (e.g., 'the horror fan') */
  organizerRole: string;
  /** Why they picked THIS story */
  storyReason: string;
  /** Group vibe */
  dynamic: string;
  /** 2-3 shared memories they might reference */
  sharedMemories: string[];
}

/**
 * Player Identity - Individual character within the group
 */
export interface PlayerIdentity {
  /** Player's name */
  name: string;
  /** Their role in the friend group */
  groupRole: string;
  /** Specific relationships to other players by name */
  relationships: Record<string, string>;
  /** Why they specifically are here tonight */
  personalReason: string;
  /** Their mood/state tonight */
  currentState: string;
  /** Backstory snippet for narrator's personality questions */
  backstory: string;
}
