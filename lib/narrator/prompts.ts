/**
 * Narrator System Prompts
 *
 * Re-exports the main system prompt for convenience.
 * This keeps prompt logic in one place while providing
 * access through the narrator module.
 */

// Re-export from the original location to avoid duplication
export { systemPrompt } from '@/lib/ai/prompts/system';
