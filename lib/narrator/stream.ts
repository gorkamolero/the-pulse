/**
 * Narrator Streaming
 *
 * Shared streaming logic with retry and validation for both
 * the main game and test harness.
 */

import { streamText, type LanguageModelV1 } from 'ai';
import { isGarbageOutput, describeGarbageReason } from './validation';

export interface NarratorStreamOptions {
  /** The language model to use */
  model: LanguageModelV1;
  /** System prompt for the narrator */
  system: string;
  /** Conversation messages */
  messages: Array<{ role: string; content: string }>;
  /** Player names for validation (optional) */
  playerNames?: string[];
  /** Temperature for generation */
  temperature?: number;
  /** Maximum retry attempts for garbage output */
  maxRetries?: number;
  /** Callback for each text chunk (for streaming to console) */
  onChunk?: (chunk: string) => void;
  /** Callback when retry happens */
  onRetry?: (attempt: number, reason: string) => void;
}

export interface NarratorStreamResult {
  /** The generated text */
  text: string;
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Number of attempts made */
  attempts: number;
}

/**
 * Generate narrator response with retry logic and garbage detection
 *
 * @param options - Stream options
 * @returns Promise with text, usage, and attempt count
 */
export async function generateNarratorStream(
  options: NarratorStreamOptions,
): Promise<NarratorStreamResult> {
  const {
    model,
    system,
    messages,
    playerNames = [],
    temperature = 0.7,
    maxRetries = 3,
    onChunk,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model,
        system,
        messages: messages as any,
        temperature,
      });

      // Collect the full text
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        onChunk?.(chunk);
      }

      // Check for garbage output
      if (isGarbageOutput(fullText, playerNames)) {
        const reason = describeGarbageReason(fullText, playerNames);
        onRetry?.(attempt, reason);

        if (attempt < maxRetries) {
          continue;
        }
        // On last attempt, return anyway with warning
        console.warn(`Narrator: returning potentially garbage output after ${maxRetries} attempts`);
      }

      const usage = await result.usage;

      return {
        text: fullText,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
        attempts: attempt,
      };
    } catch (error) {
      console.error(`Narrator generation error (attempt ${attempt}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        onRetry?.(attempt, `error: ${lastError.message}`);
        continue;
      }
    }
  }

  throw lastError || new Error('Narrator generation failed after retries');
}

/**
 * Create a streaming response for Next.js API routes with retry logic
 *
 * This wraps the narrator stream for use in API routes, handling
 * garbage detection transparently.
 */
export async function createNarratorStreamResponse(
  options: Omit<NarratorStreamOptions, 'onChunk' | 'onRetry'>,
): Promise<Response> {
  const {
    model,
    system,
    messages,
    playerNames = [],
    temperature = 0.7,
    maxRetries = 3,
  } = options;

  // For API routes, we need to handle retries before streaming
  // because once we start streaming, we can't retry
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model,
        system,
        messages: messages as any,
        temperature,
      });

      // For the response, we need to validate first
      // Collect full text to check for garbage
      const fullTextPromise = result.text;
      const fullText = await fullTextPromise;

      if (isGarbageOutput(fullText, playerNames)) {
        const reason = describeGarbageReason(fullText, playerNames);
        console.warn(`Narrator garbage detected (attempt ${attempt}/${maxRetries}): ${reason}`);

        if (attempt < maxRetries) {
          continue;
        }
      }

      // Return as text stream response
      // Note: Since we already consumed the stream for validation,
      // we return the text directly as a response
      return new Response(fullText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (error) {
      console.error(`Narrator generation error (attempt ${attempt}):`, error);

      if (attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('Narrator generation failed after retries');
}
