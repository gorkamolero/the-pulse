/**
 * Checkpoint Schema
 *
 * Defines checkpoint data structure for saving/loading session state.
 * Serializable to JSON for replay and branching.
 */

import type { PlayerAgent } from '../agents/player';
import type { NarratorConfig } from '../agents/narrator';
import type { StoryContext } from '../agents/player';
import type { Message } from '../session/turn';
import type { PrivateMoment } from '../session/private';

export interface Tangent {
  startTurn: number;
  endTurn: number;
  length: number;
  initiator: string;
  type: string;
  recoveryMethod: string;
  segueQuality: number;
}

export interface GroupConfig {
  players: PlayerAgent[];
  spokesperson: PlayerAgent;
  size: number;
}

export interface SessionConfig {
  sessionId: string;
  story: StoryContext;
  systemPrompt: string;
  storyGuide: string;
  narratorConfig: NarratorConfig;
  group: GroupConfig;
  maxTurns: number;
  seed?: number;
  createdAt: number;
}

export interface Checkpoint {
  version: string; // Schema version for compatibility
  sessionId: string;
  turn: number;
  timestamp: number;
  conversationHistory: Message[];
  playerAgents: PlayerAgent[];
  spokespersonId: string;
  sessionConfig: SessionConfig;
  detectedPulses: number[];
  detectedTangents: Tangent[];
  privateMoments: PrivateMoment[];
  metadata: {
    parentCheckpoint?: string; // For branching
    branchReason?: string;
  };
}

export const CHECKPOINT_VERSION = '1.0.0';

/**
 * Create a checkpoint from session state
 */
export function createCheckpoint(
  sessionId: string,
  turn: number,
  conversationHistory: Message[],
  playerAgents: PlayerAgent[],
  spokesperson: PlayerAgent,
  sessionConfig: SessionConfig,
  detectedPulses: number[],
  detectedTangents: Tangent[],
  privateMoments: PrivateMoment[],
  metadata?: {
    parentCheckpoint?: string;
    branchReason?: string;
  },
): Checkpoint {
  return {
    version: CHECKPOINT_VERSION,
    sessionId,
    turn,
    timestamp: Date.now(),
    conversationHistory,
    playerAgents,
    spokespersonId: spokesperson.archetype,
    sessionConfig,
    detectedPulses,
    detectedTangents,
    privateMoments,
    metadata: metadata || {},
  };
}

/**
 * Validate checkpoint structure
 */
export function validateCheckpoint(checkpoint: any): checkpoint is Checkpoint {
  return (
    checkpoint &&
    typeof checkpoint.version === 'string' &&
    typeof checkpoint.sessionId === 'string' &&
    typeof checkpoint.turn === 'number' &&
    typeof checkpoint.timestamp === 'number' &&
    Array.isArray(checkpoint.conversationHistory) &&
    Array.isArray(checkpoint.playerAgents) &&
    typeof checkpoint.spokespersonId === 'string' &&
    checkpoint.sessionConfig &&
    Array.isArray(checkpoint.detectedPulses) &&
    Array.isArray(checkpoint.detectedTangents) &&
    Array.isArray(checkpoint.privateMoments)
  );
}

/**
 * Get checkpoint file name for a turn
 */
export function getCheckpointFilename(sessionId: string, turn: number): string {
  return `sessions/${sessionId}/turn-${turn.toString().padStart(3, '0')}.json`;
}

/**
 * Serialize checkpoint to JSON
 */
export function serializeCheckpoint(checkpoint: Checkpoint): string {
  return JSON.stringify(checkpoint, null, 2);
}

/**
 * Deserialize checkpoint from JSON
 */
export function deserializeCheckpoint(json: string): Checkpoint {
  const parsed = JSON.parse(json);

  if (!validateCheckpoint(parsed)) {
    throw new Error('Invalid checkpoint format');
  }

  return parsed;
}
