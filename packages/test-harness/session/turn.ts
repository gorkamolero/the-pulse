/**
 * Turn Execution Types
 *
 * Type definitions for turn execution. The actual turn execution logic is
 * implemented in session/runner.ts which handles narrator generation,
 * player responses, and spokesperson synthesis using the AI SDK.
 */

import type { PlayerAgent } from '../agents/player';
import type { Classification, OutputType } from './classifier';
import type { PrivateMoment } from './private';

export interface TestHarnessMessage {
  role: 'narrator' | 'spokesperson' | 'player';
  player?: string;
  content: string;
  turn: number;
  timestamp: number;
  classification?: OutputType;
  /** Model reasoning/thinking (for thinking models like deepseek-v3.2) */
  reasoning?: string;
}

// Alias for backwards compatibility
export type Message = TestHarnessMessage;

export interface TurnContext {
  turn: number;
  conversationHistory: Message[];
  playerAgents: PlayerAgent[];
  spokesperson: PlayerAgent;
  previousPulseCount: number;
}

export interface TurnResult {
  turn: number;
  timestamp: number;
  narratorOutput: string;
  classification: Classification;
  isPrivateMoment: boolean;
  privateMoment?: PrivateMoment;
  playerResponses: Array<{
    agent: PlayerAgent;
    response: string;
  }>;
  spokespersonRelay: string;
  messages: Message[];
}

/**
 * Build turn context from session state
 */
export function buildTurnContext(
  turn: number,
  conversationHistory: Message[],
  playerAgents: PlayerAgent[],
  spokesperson: PlayerAgent,
  previousPulseCount: number,
): TurnContext {
  return {
    turn,
    conversationHistory,
    playerAgents,
    spokesperson,
    previousPulseCount,
  };
}
