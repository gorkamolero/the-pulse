/**
 * Private Moment Detection & Routing
 *
 * Detects when narrator addresses individual player and routes to correct agent.
 * Bypasses spokesperson for private interactions.
 */

import type { PlayerAgent } from '../agents/player';
import { detectPrivateMoment } from './classifier';

export interface PrivateMoment {
  turn: number;
  target: string;
  content: string;
  response: string;
  backstoryAlignment?: number;
  narrativeAppropriateness?: number;
  payoffDetected?: boolean;
  payoffTurn?: number;
}

/**
 * Route private moment to specific player
 */
export function routePrivateMoment(
  narratorOutput: string,
  playerAgents: PlayerAgent[],
): {
  isPrivate: boolean;
  targetAgent?: PlayerAgent;
  targetName?: string;
} {
  const { isPrivate, target } = detectPrivateMoment(narratorOutput);

  if (!isPrivate || !target) {
    return { isPrivate: false };
  }

  // Find the target player by name (case-insensitive partial match)
  const targetAgent = playerAgents.find((agent) =>
    agent.name.toLowerCase().includes(target.toLowerCase()),
  );

  if (!targetAgent) {
    console.warn(`Private moment target "${target}" not found in player agents`);
    return {
      isPrivate: true,
      targetName: target,
    };
  }

  return {
    isPrivate: true,
    targetAgent,
    targetName: targetAgent.name,
  };
}

/**
 * Extract private content from narrator output
 * Removes private moment markers to get clean content
 */
export function extractPrivateContent(narratorOutput: string): string {
  // Remove common private moment markers
  return narratorOutput
    .replace(/\[to [^\]]+\]/gi, '')
    .replace(/\[([^,\]]+), you alone[^\]]+\]/gi, '')
    .replace(/^([^,\s]+), only you[^.!?]+[.!?]/gi, '')
    .trim();
}

/**
 * Validate if private moment is appropriate
 * Checks backstory alignment and narrative timing
 */
export async function validatePrivateMoment(
  privateMoment: PrivateMoment,
  targetAgent: PlayerAgent,
  narrativeContext: string,
): Promise<{
  backstoryAlignment: number;
  narrativeAppropriateness: number;
  feedback: string;
}> {
  // TODO: Implement LLM-based validation
  // For now, return placeholder scores
  return {
    backstoryAlignment: 0.7,
    narrativeAppropriateness: 0.8,
    feedback: 'Private moment seems appropriate',
  };
}

/**
 * Track private moments for payoff detection
 */
export class PrivateMomentTracker {
  private moments: Map<string, PrivateMoment[]> = new Map();

  add(moment: PrivateMoment): void {
    const existing = this.moments.get(moment.target) || [];
    existing.push(moment);
    this.moments.set(moment.target, existing);
  }

  getForPlayer(playerName: string): PrivateMoment[] {
    return this.moments.get(playerName) || [];
  }

  getAll(): PrivateMoment[] {
    return Array.from(this.moments.values()).flat();
  }

  /**
   * Check if a narrative event pays off a private moment
   */
  checkPayoff(turn: number, narrativeContent: string): PrivateMoment[] {
    const payoffs: PrivateMoment[] = [];

    for (const moments of this.moments.values()) {
      for (const moment of moments) {
        if (moment.payoffDetected) continue;

        // Simple keyword matching for payoff detection
        // TODO: Implement LLM-based payoff detection
        const momentKeywords = moment.content.toLowerCase().split(/\s+/);
        const contentLower = narrativeContent.toLowerCase();

        const hasKeywordMatch = momentKeywords.some(
          (keyword) => keyword.length > 4 && contentLower.includes(keyword),
        );

        if (hasKeywordMatch) {
          moment.payoffDetected = true;
          moment.payoffTurn = turn;
          payoffs.push(moment);
        }
      }
    }

    return payoffs;
  }

  /**
   * Get moments that haven't paid off yet
   */
  getUnpaidMoments(): PrivateMoment[] {
    return this.getAll().filter((m) => !m.payoffDetected);
  }
}
