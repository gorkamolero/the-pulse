/**
 * Prompt Variant Loader
 *
 * Imports the production system prompt and creates test variants
 * that extend/modify it rather than replacing it.
 */

import { systemPrompt as productionPrompt } from '../../ai/prompts/system';

export interface SystemPrompt {
  id: string;
  name: string;
  version: string;
  description?: string;
  content: string;
}

/**
 * Inject an additional section into the base prompt
 */
function injectSection(basePrompt: string, section: string): string {
  // Insert before the closing </system-prompt> tag
  return basePrompt.replace('</system-prompt>', `${section}\n\n</system-prompt>`);
}

/**
 * Explicit pulse tracking section for variants
 */
const PULSE_TRACKING_SECTION = `
## PULSE TRACKING (TEST VARIANT)

CRITICAL: Track your current pulse number internally.

- You are currently on pulse [N] out of ~20
- Each PULSE (not tangent/clarification) increments your counter
- If you're past pulse 15, start building toward conclusion
- If you're at pulse 20, deliver the ending
- Tangent responses do NOT increment the pulse counter`;

/**
 * Detailed 3-act structure guidance for variants
 */
const ACT_STRUCTURE_SECTION = `
## ACT STRUCTURE GUIDANCE (TEST VARIANT)

Follow this structure for your ~20 pulses:

- Act 1 (Pulses 1-6): Setup - Establish setting, mystery, and initial conflicts
- Act 2 (Pulses 7-16): Escalation - Deepen mystery, increase tension, present challenges
- Act 3 (Pulses 17-20): Resolution - Build to climax, resolve story, deliver satisfying conclusion

PACING RULES:
- Each response should be a meaningful story beat OR a tangent response
- Never spend more than 2 responses on the same pulse
- Always track which pulse you're on`;

/**
 * Baseline - Production prompt with no modifications
 */
const baseline: SystemPrompt = {
  id: 'baseline',
  name: 'Production Baseline',
  version: '1.0',
  description: 'Unmodified production system prompt - tests what actually ships',
  content: productionPrompt({ storyGuide: '{{STORY_GUIDE}}' }),
};

/**
 * Pulse-aware - Adds explicit pulse tracking
 */
const pulseAware: SystemPrompt = {
  id: 'pulse-aware',
  name: 'Pulse-Aware Variant',
  version: '1.0',
  description: 'Production prompt + explicit pulse tracking instructions',
  content: injectSection(
    productionPrompt({ storyGuide: '{{STORY_GUIDE}}' }),
    PULSE_TRACKING_SECTION,
  ),
};

/**
 * Pulse-detailed - Adds both pulse tracking and act structure
 */
const pulseDetailed: SystemPrompt = {
  id: 'pulse-detailed',
  name: 'Detailed Pulse-Aware Variant',
  version: '1.0',
  description: 'Production prompt + pulse tracking + 3-act structure guidance',
  content: injectSection(
    productionPrompt({ storyGuide: '{{STORY_GUIDE}}' }),
    `${PULSE_TRACKING_SECTION}\n${ACT_STRUCTURE_SECTION}`,
  ),
};

/**
 * All available prompts
 */
const ALL_PROMPTS = new Map<string, SystemPrompt>([
  [baseline.id, baseline],
  [pulseAware.id, pulseAware],
  [pulseDetailed.id, pulseDetailed],
]);

/**
 * Get all available prompts
 */
export function getAllPrompts(): Map<string, SystemPrompt> {
  return new Map(ALL_PROMPTS);
}

/**
 * Get a prompt by ID, throw if not found
 */
export function getPrompt(promptId: string): SystemPrompt {
  const prompt = ALL_PROMPTS.get(promptId);

  if (!prompt) {
    const availableIds = Array.from(ALL_PROMPTS.keys()).join(', ');
    throw new Error(
      `Prompt "${promptId}" not found. Available prompts: ${availableIds}`,
    );
  }

  return prompt;
}

/**
 * List all available prompt IDs
 */
export function listPromptIds(): string[] {
  return Array.from(ALL_PROMPTS.keys()).sort();
}

/**
 * Check if a prompt ID exists
 */
export function hasPrompt(promptId: string): boolean {
  return ALL_PROMPTS.has(promptId);
}

/**
 * Replace placeholder with actual story guide
 */
export function withStoryGuide(promptContent: string, storyGuide: string): string {
  return promptContent.replace('{{STORY_GUIDE}}', storyGuide);
}
