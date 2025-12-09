/**
 * Spokesperson Agent
 *
 * Synthesizes multiple player responses into a single coherent relay.
 * Adds realistic noise based on spokesperson's archetype.
 */

import type { PlayerAgent } from './player';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';

export interface PlayerResponse {
  player: PlayerAgent;
  response: string;
}

/**
 * Create system prompt for spokesperson
 */
export function createSpokespersonPrompt(
  spokesperson: PlayerAgent,
  groupSize: number,
): string {
  const archetype = ARCHETYPE_BY_ID[spokesperson.archetype];
  if (!archetype) {
    throw new Error(`Unknown archetype: ${spokesperson.archetype}`);
  }

  return `You are ${spokesperson.name}, the spokesperson for a group of ${groupSize} players.

YOUR ROLE:
You relay the group's collective responses and decisions to the narrator. You synthesize what everyone says into a coherent message.

YOUR PERSONALITY:
${archetype.style}

BEHAVIORAL PATTERNS:
${archetype.patterns.map((p) => `- ${p}`).join('\n')}

HOW TO SYNTHESIZE RESPONSES:
1. Read all the individual player responses
2. Identify the consensus or main action the group wants to take
3. Relay it to the narrator in your own voice
4. You can add your personality flavor (~${Math.round(archetype.quirkFrequency * 100)}% of the time)
5. But don't lose the group's intent or important details

EXAMPLES OF GOOD SYNTHESIS:
- If everyone wants to explore the door: "We want to check out that door."
- If there's disagreement: "Sam wants to leave, but the rest of us think we should stay."
- If someone noticed something: "Alex pointed out the symbol on the wall. We want to examine it."

IMPORTANT:
- Keep it concise (2-4 sentences max)
- Preserve important details from individual responses
- Reflect group dynamics naturally
- You can editorialize slightly based on your personality
- Never invent actions the group didn't suggest

Remember: You're translating group consensus into a clear message for the narrator.`;
}

/**
 * Synthesize multiple player responses into a single spokesperson relay
 *
 * This is a simple template-based version for fallback.
 * The actual implementation uses an LLM call in session/runner.ts
 */
export function synthesizeResponses(
  responses: PlayerResponse[],
  spokesperson: PlayerAgent,
): string {
  if (responses.length === 0) {
    return 'The group is silent, waiting to see what happens next.';
  }

  if (responses.length === 1) {
    // Single response, spokesperson just relays it (possibly with their flavor)
    const archetype = ARCHETYPE_BY_ID[spokesperson.archetype];
    const shouldAddFlavor = archetype && Math.random() < archetype.quirkFrequency;

    if (shouldAddFlavor && spokesperson.archetype === 'joker') {
      return `${responses[0]?.response} *chuckles*`;
    }

    return responses[0]?.response || '';
  }

  // Multiple responses - synthesize them
  // In full implementation, this would be an LLM call
  // For now, we'll do simple concatenation with attribution
  const responseTexts = responses
    .map((r) => `${r.player.name}: "${r.response}"`)
    .join('\n');

  // Simple synthesis for now
  return `The group discussed:\n${responseTexts}\n\nWe're ready to proceed based on that.`;
}
