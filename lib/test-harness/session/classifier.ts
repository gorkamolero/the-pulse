/**
 * Output Classification
 *
 * Classifies narrator output into types: pulse, tangent-response, private-moment,
 * clarification, recap. Uses Gemini 2.0 Flash Lite via OpenRouter for classification.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, type LanguageModelUsage } from 'ai';
import { z } from 'zod';

export type OutputType =
  | 'pulse'
  | 'tangent-response'
  | 'private-moment'
  | 'directed-questions'
  | 'requires-discussion'
  | 'clarification'
  | 'recap'
  | 'ending';

export interface Classification {
  type: OutputType;
  confidence: number;
  reasoning: string;
  pulseNumber?: number;
  privateTarget?: string;
  targetPlayers?: string[];
  usage?: LanguageModelUsage;
}

const classificationSchema = z.object({
  type: z.enum(['pulse', 'tangent-response', 'private-moment', 'directed-questions', 'requires-discussion', 'clarification', 'recap', 'ending']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  pulseNumber: z.number().optional(),
  privateTarget: z.string().optional(),
  targetPlayers: z.array(z.string()).optional(),
});

const CLASSIFICATION_PROMPT = `You are analyzing narrator output from an interactive fiction game to classify its type.

CRITICAL DISTINCTION - Pulse vs Non-Pulse:

A **PULSE** is a story beat that ADVANCES the narrative:
- New revelation, challenge, location change, or plot development
- Introduces new information that moves the story forward
- Changes the situation or escalates stakes
- Examples: discovering a clue, entering a new room with danger, NPC reveals plot-critical info

NOT pulses (these are responses, not story beats):
- Engaging with player jokes, digressions, banter
- Answering questions about the world that don't advance plot
- Atmospheric moments that don't change anything
- Clarifications about current scene
- Recaps of what already happened

OUTPUT TYPES:

**pulse** - Story beat that advances narrative
- New scene/location that changes situation
- Plot-critical revelation or discovery
- New challenge or obstacle presented
- Significant character moment that moves story
- Ask: "Did the story situation change because of this?"

**tangent-response** - Engaging with player off-topic behavior
- Responding to jokes, banter, or digressions
- Playing along with tangents
- Acknowledging player comments that don't affect story
- NOT forced transitions like "anyway, back to..."

**private-moment** - Individual player addressed privately/secretly
- "[To X only]" or "X, you alone notice..."
- Personal revelation matching backstory
- Visions/dreams for one player
- Secrets that would spoil group experience
- Key: OTHER players should NOT hear/know this

**directed-questions** - Narrator asking specific players questions by name
- Questions explicitly addressed to named players: "**Alex** —" or "Alex, tell me..."
- Can target multiple players: "**Alex**, **Jordan** — answer these:"
- NOT private (others can hear), but only named players should respond
- Common during character creation when narrator asks individual backstory questions
- Extract targetPlayers: array of player names being directly asked questions
- Key: Questions are PUBLIC but directed at SPECIFIC players

**requires-discussion** - Group needs to deliberate before responding
- Character creation: "Who are you?", "What's your backstory?", "Are you a journalist? A genealogist?"
- Equipment/item selection: "What do you carry?", "What items do you bring?"
- Path decisions: "Which way?", "Left or right?", "Door A or Door B?"
- Accept/reject offers: NPC offers something with "take it or leave it" framing
- Point of no return: "Do you enter?", "Do you open it?", entering dangerous places
- Tactical choices: "Up, down, or hold?", multiple options with different consequences
- Climactic moments: transformation choices, sacrifice decisions, major commitments
- Key: Players need to DISCUSS with each other before answering
- NOT for simple reactions or single-answer questions
- Look for: explicit choices, binary/ternary options, "or" in the question, requests for group coordination

**clarification** - Answering questions about current scene
- "You see..." describing details already present
- "Yes, you can..." answering capability questions
- Explaining current situation without advancing it

**recap** - Summarizing previous events
- "As you recall...", "So far you have..."
- Reminding players of earlier information

**ending** - Story conclusion/epilogue
- Explicit story ending: "The End", "Fin", "Our story concludes"
- Epilogue wrapping up character fates
- Final resolution of the main conflict
- Narrator explicitly ending the session
- Key: The story is OVER, not just a dramatic moment

RULE: When in doubt between pulse and something else, ask "Did this advance the story or just respond to players?" If it advanced, it's a pulse. If it responded without advancing, it's not.

Analyze the narrator's output and classify it.`;

/**
 * Classify narrator output using LLM
 */
export async function classifyOutput(
  narratorOutput: string,
  context?: {
    previousPulseCount?: number;
    playerNames?: string[];
  },
): Promise<Classification> {
  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const result = await generateObject({
      model: openrouter('google/gemini-2.5-flash'),
      schema: classificationSchema,
      messages: [
        {
          role: 'system',
          content: CLASSIFICATION_PROMPT,
        },
        {
          role: 'user',
          content: `Narrator output to classify:\n\n${narratorOutput}\n\nContext: ${context?.previousPulseCount ? `Previous pulse count: ${context.previousPulseCount}` : 'Unknown'}\nPlayer names: ${context?.playerNames?.join(', ') || 'Unknown'}`,
        },
      ],
      temperature: 0.3,
    });

    return {
      ...result.object,
      usage: result.usage,
    };
  } catch (error) {
    console.error('Classification error:', error);
    throw error;
  }
}

/**
 * Detect if output is a private moment and extract target
 */
export function detectPrivateMoment(output: string): {
  isPrivate: boolean;
  target?: string;
} {
  const patterns = [
    /\[to ([^\]]+) only\]/i,
    /\[([^,\]]+), you alone/i,
    /([^,\s]+), only you/i,
    /([^,\s]+) alone notices?/i,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]) {
      return {
        isPrivate: true,
        target: match[1].trim(),
      };
    }
  }

  return { isPrivate: false };
}

/**
 * Quick check if output is likely a pulse (story beat)
 */
export function isProbablyPulse(output: string): boolean {
  // Pulses are typically longer and contain scene-setting or action
  if (output.length < 50) return false;

  const pulseIndicators = [
    'you find yourself',
    'you arrive',
    'suddenly',
    'you notice',
    'before you',
    'in front of you',
    'you hear',
    'you see',
    'the room',
    'the door',
    'ahead of you',
  ];

  const lower = output.toLowerCase();
  return pulseIndicators.some((indicator) => lower.includes(indicator));
}
