/**
 * Private Moment Detection & Routing
 *
 * Detects when narrator addresses individual player and routes to correct agent.
 * Bypasses spokesperson for private interactions.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
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

const privateMomentValidationSchema = z.object({
  backstoryAlignment: z.number().min(0).max(1),
  narrativeAppropriateness: z.number().min(0).max(1),
  feedback: z.string(),
});

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
    console.warn(
      `Private moment target "${target}" not found in player agents`,
    );
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
  try {
    const prompt = `Evaluate this private moment in an interactive fiction game:

PLAYER CHARACTER:
Name: ${targetAgent.name}
Archetype: ${targetAgent.archetype}
Backstory: ${targetAgent.identity.backstory}

PRIVATE MOMENT CONTENT:
${privateMoment.content}

PLAYER'S RESPONSE:
${privateMoment.response}

NARRATIVE CONTEXT:
${narrativeContext.substring(0, 500)}

Evaluate:
1. Backstory Alignment (0-1): How well does this private moment connect to the player's backstory?
2. Narrative Appropriateness (0-1): Is this the right time in the narrative for this revelation?
3. Feedback: Brief explanation of your scores`;

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const result = await generateObject({
      model: openrouter('google/gemini-2.5-flash'),
      schema: privateMomentValidationSchema,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return result.object;
  } catch (error) {
    console.warn('Private moment validation failed, using heuristics:', error);
    // Fallback to heuristic scoring
    const hasBackstoryKeywords = privateMoment.content
      .toLowerCase()
      .includes(targetAgent.name.toLowerCase());
    return {
      backstoryAlignment: hasBackstoryKeywords ? 0.7 : 0.4,
      narrativeAppropriateness: 0.6,
      feedback: 'Heuristic validation (LLM failed)',
    };
  }
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
  async checkPayoff(
    turn: number,
    narrativeContent: string,
  ): Promise<PrivateMoment[]> {
    const payoffs: PrivateMoment[] = [];

    for (const moments of this.moments.values()) {
      for (const moment of moments) {
        if (moment.payoffDetected) continue;

        // Try LLM-based detection first
        const hasPayoff = await this.detectPayoffWithLLM(
          moment,
          narrativeContent,
        );

        if (hasPayoff) {
          moment.payoffDetected = true;
          moment.payoffTurn = turn;
          payoffs.push(moment);
        }
      }
    }

    return payoffs;
  }

  /**
   * LLM-based payoff detection
   */
  private async detectPayoffWithLLM(
    moment: PrivateMoment,
    narrativeContent: string,
  ): Promise<boolean> {
    try {
      const prompt = `Determine if a narrative event pays off an earlier private moment.

PRIVATE MOMENT (Turn ${moment.turn}):
Target: ${moment.target}
Content: ${moment.content}

CURRENT NARRATIVE:
${narrativeContent}

Does the current narrative reference, reveal, or pay off the private moment?
Consider:
- Direct references to the private information
- Consequences of the private moment playing out
- The player's secret being revealed or becoming relevant

Answer with ONLY: true or false`;

      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });

      const { text } = await generateText({
        model: openrouter('google/gemini-2.5-flash'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      return text.trim().toLowerCase() === 'true';
    } catch (_error) {
      // Fallback to keyword matching
      const momentKeywords = moment.content.toLowerCase().split(/\s+/);
      const contentLower = narrativeContent.toLowerCase();

      return momentKeywords.some(
        (keyword) => keyword.length > 4 && contentLower.includes(keyword),
      );
    }
  }

  /**
   * Get moments that haven't paid off yet
   */
  getUnpaidMoments(): PrivateMoment[] {
    return this.getAll().filter((m) => !m.payoffDetected);
  }
}
