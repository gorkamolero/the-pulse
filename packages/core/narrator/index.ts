/**
 * Shared Narrator Module
 *
 * Unified narrator logic for both the main game and test harness.
 * Handles garbage detection, retries, and consistent output validation.
 */

export { generateNarratorStream, type NarratorStreamOptions } from './stream';
export { isGarbageOutput, GARBAGE_PATTERNS } from './validation';
export { systemPrompt } from './prompts';
