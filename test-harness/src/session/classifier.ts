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

OUTPUT TYPES:

**pulse** - A story beat that advances the narrative
- New scene or location
- Plot revelation
- Character confrontation
- Challenge presented
- Major decision point

**tangent-response** - Handling player distraction/off-topic behavior
- Responding to jokes or off-topic remarks
- Addressing player confusion that isn't about the story
- Handling meta-commentary

**private-moment** - Addressing an individual player privately
- Personal revelation matching their backstory
- Visions or dreams for one player
- NPC singling them out
- Secrets that would spoil group experience
- Look for phrases like "[To X only]" or "X, you alone notice..."

**clarification** - Answering player questions about the current situation
- Describing what they see in more detail
- Answering "can I..." type questions
- Clarifying confusion about current scene

**recap** - Summarizing or recapping previous events
- "As you recall..."
- "So far you have..."
- Reminding players of earlier information

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

  // Check for tangent response indicators
  if (
    lower.includes('anyway') ||
    lower.includes('back to') ||
    lower.includes('but returning to') ||
    lower.includes('getting back')
  ) {
    return {
      type: 'tangent-response',
      confidence: 0.6,
      reasoning: 'Contains tangent recovery language',
    };
  }

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
