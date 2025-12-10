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
  | 'clarification'
  | 'recap';

export interface Classification {
  type: OutputType;
  confidence: number;
  reasoning: string;
  pulseNumber?: number;
  privateTarget?: string;
  usage?: LanguageModelUsage;
}

const classificationSchema = z.object({
  type: z.enum(['pulse', 'tangent-response', 'private-moment', 'clarification', 'recap']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  pulseNumber: z.number().optional(),
  privateTarget: z.string().optional(),
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

**private-moment** - Individual player addressed privately
- "[To X only]" or "X, you alone notice..."
- Personal revelation matching backstory
- Visions/dreams for one player
- Secrets that would spoil group experience

**clarification** - Answering questions about current scene
- "You see..." describing details already present
- "Yes, you can..." answering capability questions
- Explaining current situation without advancing it

**recap** - Summarizing previous events
- "As you recall...", "So far you have..."
- Reminding players of earlier information

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
      model: openrouter('google/gemini-2.0-flash-lite'),
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
    // Fallback to heuristic classification
    return heuristicClassification(narratorOutput, context);
  }
}

/**
 * Heuristic-based classification fallback
 */
function heuristicClassification(
  narratorOutput: string,
  context?: {
    previousPulseCount?: number;
    playerNames?: string[];
  },
): Classification {
  const lower = narratorOutput.toLowerCase();

  // Check for private moment indicators
  if (lower.includes('[to ') || lower.includes('you alone') || lower.includes('only you')) {
    const targetMatch = narratorOutput.match(/\[to ([^\]]+) only\]/i);
    return {
      type: 'private-moment',
      confidence: 0.8,
      reasoning: 'Contains private moment markers',
      privateTarget: targetMatch?.[1],
    };
  }

  // Check for recap indicators
  if (
    lower.includes('as you recall') ||
    lower.includes('so far you have') ||
    lower.includes('to recap')
  ) {
    return {
      type: 'recap',
      confidence: 0.7,
      reasoning: 'Contains recap language',
    };
  }

  // Note: We DON'T classify forced segues ("anyway", "back to") as tangent-response
  // Those are RED FLAGS that should be caught by issue detection
  // Tangent responses should be natural engagement, not forced returns

  // Check for clarification indicators
  if (lower.includes('you see') || lower.includes('you can') || lower.includes('yes, you')) {
    return {
      type: 'clarification',
      confidence: 0.6,
      reasoning: 'Appears to be clarifying/answering',
    };
  }

  // Default to pulse if it's substantial content
  if (narratorOutput.length > 100) {
    return {
      type: 'pulse',
      confidence: 0.5,
      reasoning: 'Substantial narrative content, likely a story beat',
      pulseNumber: context?.previousPulseCount
        ? context.previousPulseCount + 1
        : undefined,
    };
  }

  // Short responses are likely clarifications
  return {
    type: 'clarification',
    confidence: 0.4,
    reasoning: 'Short response, likely clarification',
  };
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
