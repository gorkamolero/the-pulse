/**
 * Turn Execution
 *
 * Single turn logic: narrator generates → classify → route → agents respond →
 * spokesperson synthesizes → return. Each turn returns data needed for checkpoint.
 */

import type { PlayerAgent } from '../agents/player';
import type { Classification, OutputType } from './classifier';
import type { PrivateMoment } from './private';
import { classifyOutput } from './classifier';
import { routePrivateMoment, extractPrivateContent } from './private';

export interface Message {
  role: 'narrator' | 'spokesperson' | 'player';
  player?: string;
  content: string;
  turn: number;
  timestamp: number;
  classification?: OutputType;
}

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
 * Generate narrator output
 * This is a placeholder - actual implementation in session runner
 */
export async function generateNarratorOutput(
  conversationHistory: Message[],
  narratorConfig: any,
): Promise<string> {
  // TODO: Implement with AI SDK
  // This will be done in the session runner
  throw new Error('Not implemented - will be done in session runner');
}

/**
 * Generate player response to narrator output
 * This is a placeholder - actual implementation in session runner
 */
export async function generatePlayerResponse(
  agent: PlayerAgent,
  narratorOutput: string,
  conversationHistory: Message[],
): Promise<string> {
  // TODO: Implement with AI SDK
  // This will be done in the session runner
  throw new Error('Not implemented - will be done in session runner');
}

/**
 * Execute a single turn
 */
export async function executeTurn(context: TurnContext): Promise<TurnResult> {
  const timestamp = Date.now();
  const turn = context.turn;

  // 1. Narrator generates output (placeholder)
  // In actual implementation, this will call the narrator LLM
  const narratorOutput = 'Placeholder narrator output';

  // 2. Classify output
  const classification = await classifyOutput(narratorOutput, {
    previousPulseCount: context.previousPulseCount,
    playerNames: context.playerAgents.map((a) => a.name),
  });

  // 3. Check if private moment
  const privateRouting = routePrivateMoment(narratorOutput, context.playerAgents);

  const messages: Message[] = [
    {
      role: 'narrator',
      content: narratorOutput,
      turn,
      timestamp,
      classification: classification.type,
    },
  ];

  let privateMoment: PrivateMoment | undefined;
  let playerResponses: Array<{ agent: PlayerAgent; response: string }> = [];
  let spokespersonRelay = '';

  // 4. Route based on type
  if (privateRouting.isPrivate && privateRouting.targetAgent) {
    // Private moment - route to individual player
    const privateContent = extractPrivateContent(narratorOutput);
    const response = await generatePlayerResponse(
      privateRouting.targetAgent,
      privateContent,
      context.conversationHistory,
    );

    privateMoment = {
      turn,
      target: privateRouting.targetAgent.name,
      content: privateContent,
      response,
    };

    messages.push({
      role: 'player',
      player: privateRouting.targetAgent.name,
      content: response,
      turn,
      timestamp,
    });

    spokespersonRelay = `[Private moment with ${privateRouting.targetAgent.name}]`;
  } else {
    // Group moment - all players respond
    playerResponses = await Promise.all(
      context.playerAgents.map(async (agent) => ({
        agent,
        response: await generatePlayerResponse(
          agent,
          narratorOutput,
          context.conversationHistory,
        ),
      })),
    );

    // Add player response messages
    for (const { agent, response } of playerResponses) {
      messages.push({
        role: 'player',
        player: agent.name,
        content: response,
        turn,
        timestamp,
      });
    }

    // Spokesperson synthesizes
    // TODO: Implement with AI SDK in session runner
    spokespersonRelay = playerResponses.map((r) => r.response).join(' ');

    messages.push({
      role: 'spokesperson',
      player: context.spokesperson.name,
      content: spokespersonRelay,
      turn,
      timestamp,
    });
  }

  return {
    turn,
    timestamp,
    narratorOutput,
    classification,
    isPrivateMoment: privateRouting.isPrivate,
    privateMoment,
    playerResponses,
    spokespersonRelay,
    messages,
  };
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
