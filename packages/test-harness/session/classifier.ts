/**
 * Output Classification
 *
 * Classifies narrator output into types: pulse, tangent-response, private-moment,
 * clarification, recap. Uses fast/cheap models with fallback chain.
 */

import { generateObject, gateway, type LanguageModelUsage } from 'ai';
import { z } from 'zod';

// Classification models - ordered by cost/reliability for structured output
// Research: GPT-4o-mini has 72% accuracy, 89% precision for classification tasks
// Pricing: gpt-5-nano $0.05/$0.40, gpt-4o-mini $0.60/$2.40, gemini-2.5-flash $0.15/$0.60
const CLASSIFICATION_MODELS = [
  'openai/gpt-5-nano',        // Cheapest, fast
  'openai/gpt-4o-mini',       // Best classification accuracy/precision
  'google/gemini-2.5-flash',  // Reliable fallback, good at structured output
];

/**
 * Response type determines HOW players should respond
 */
export type ResponseType =
  | 'group'        // All players respond, spokesperson synthesizes
  | 'discussion'   // Players need to deliberate before responding
  | 'directed'     // Only specific named players respond
  | 'private'      // Single player responds privately
  | 'none';        // No response needed (ending, pure narration)

/**
 * Legacy OutputType for backwards compatibility with reports/checkpoints
 */
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
  isEnding: boolean;          // Is the story over?
  responseType: ResponseType; // How should players respond?

  // Metadata
  targetPlayers?: string[];   // For directed/private responses
  confidence: number;
  reasoning: string;

  // For backwards compatibility
  type: OutputType;           // Legacy single-label (derived)

  usage?: LanguageModelUsage;
}

const classificationSchema = z.object({
  isEnding: z.boolean(),
  responseType: z.enum(['group', 'discussion', 'directed', 'private', 'none']),
  targetPlayers: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const CLASSIFICATION_PROMPT = `You are analyzing narrator output from an interactive fiction game.

You must answer TWO questions:

## QUESTION 1: responseType - HOW should players respond?

**discussion** - Players need to deliberate together
- Character creation: "Who are you?", "What's your backstory?"
- Equipment choices: "What do you carry?"
- Path decisions: "Left or right?", "Door A or B?"
- Major decisions: "Do you accept?", "Do you enter?"
- Key: Requires GROUP COORDINATION before answering

**directed** - Only specific named players should respond
- "**Alex** — tell me about your character"
- "Alex, Jordan — what do you do?"
- Questions addressed to specific players BY NAME
- NOT private, but only named players respond
- Set targetPlayers to array of names

**private** - Single player addressed secretly
- "[To X only]" or "X, you alone notice..."
- Secrets that would spoil group experience
- Set targetPlayers to single-element array

**group** - All players react, spokesperson synthesizes
- General narrative that invites reactions
- No specific choice or question posed
- Default for most story beats

**none** - No player response needed
- Story ending/epilogue
- Pure narration that doesn't invite response

## QUESTION 2: isEnding - Is the story OVER?

**isEnding: true** only when:
- Explicit ending: "The End", "Fin", story concludes
- Epilogue wrapping up fates
- Narrator explicitly ends session
- NOT just a dramatic moment

Analyze the narrator output and provide responseType, isEnding, and targetPlayers (if applicable).`;

/**
 * Derive legacy type from classification
 * For backwards compatibility with reports/checkpoints
 */
function deriveLegacyType(
  isEnding: boolean,
  responseType: ResponseType,
): OutputType {
  if (isEnding) return 'ending';
  if (responseType === 'private') return 'private-moment';
  if (responseType === 'directed') return 'directed-questions';
  if (responseType === 'discussion') return 'requires-discussion';
  // Default to pulse for regular group responses
  return 'pulse';
}

/**
 * Default fallback classification when all retries fail
 */
const FALLBACK_CLASSIFICATION: Classification = {
  isEnding: false,
  responseType: 'group',
  confidence: 0,
  reasoning: 'Classification failed - using fallback',
  type: 'pulse',
};

/**
 * Classify narrator output using LLM with model fallback chain
 */
export async function classifyOutput(
  narratorOutput: string,
  context?: {
    playerNames?: string[];
  },
): Promise<Classification> {
  const userContent = `Narrator output to classify:\n\n${narratorOutput}\n\nPlayer names: ${context?.playerNames?.join(', ') || 'Unknown'}`;

  // Try each model in the fallback chain
  for (let i = 0; i < CLASSIFICATION_MODELS.length; i++) {
    const modelId = CLASSIFICATION_MODELS[i];
    const isLastModel = i === CLASSIFICATION_MODELS.length - 1;

    try {
      const response = await generateObject({
        model: gateway(modelId),
        schema: classificationSchema,
        messages: [
          { role: 'system', content: CLASSIFICATION_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
      });

      const {
        isEnding,
        responseType,
        targetPlayers,
        confidence,
        reasoning,
      } = response.object;

      return {
        isEnding,
        responseType,
        targetPlayers,
        confidence,
        reasoning,
        type: deriveLegacyType(isEnding, responseType),
        usage: response.usage,
      } as Classification;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message.slice(0, 80) : String(error);

      if (isLastModel) {
        console.warn(`Classification failed on all models, using fallback. Last error: ${errMsg}`);
        return FALLBACK_CLASSIFICATION;
      }

      console.warn(`Classification failed on ${modelId}, trying next model. Error: ${errMsg}`);
    }
  }

  // Should never reach here, but TypeScript needs it
  return FALLBACK_CLASSIFICATION;
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

