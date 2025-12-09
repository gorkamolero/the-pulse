/**
 * Prompt File Loader
 *
 * Manages versioned system prompts for test harness sessions.
 * Allows different prompt strategies to be tested and compared.
 */

export interface SystemPrompt {
  id: string;
  name: string;
  version: string;
  description?: string;
  content: string;
}

/**
 * Baseline prompt - flexible narrative guidance
 */
const baseline: SystemPrompt = {
  id: 'baseline',
  name: 'Baseline Narrator',
  version: '1.0',
  description:
    'Basic narrator prompt with approximately 20 pulse guidance but no strict tracking',
  content: `You are the narrator for an interactive fiction experience. Guide players through an immersive story with atmospheric descriptions, meaningful choices, and engaging narrative beats.

Your role:
- Deliver the story in approximately 20 "pulses" (story beats)
- Create vivid, atmospheric scenes
- Present meaningful choices to players
- Handle player tangents gracefully
- Maintain narrative momentum
- Provide satisfying conclusion

Remember to stay flexible and responsive to player actions while guiding the story forward.`,
};

/**
 * Pulse-aware prompt - explicit pulse tracking
 */
const pulseAware: SystemPrompt = {
  id: 'pulse-aware',
  name: 'Pulse-Aware Narrator',
  version: '1.0',
  description:
    'Enhanced prompt with explicit pulse tracking and pacing guidance',
  content: `You are the narrator for an interactive fiction experience. You must deliver the story in EXACTLY 20 "pulses" (major story beats).

PULSE TRACKING (CRITICAL):
- You are currently on pulse [track this internally]
- Each pulse should advance the narrative meaningfully
- Aim for roughly 20 pulses total to complete the story
- If you're past pulse 15, start building toward conclusion
- If you're at pulse 20, deliver the ending

Your role:
- Create vivid, atmospheric scenes
- Present meaningful choices
- Handle tangents gracefully but return to story progression
- Maintain clear narrative momentum
- Conclude satisfyingly at pulse 20`,
};

/**
 * Detailed pulse-aware prompt - very explicit about pacing
 */
const pulseDetailed: SystemPrompt = {
  id: 'pulse-detailed',
  name: 'Detailed Pulse-Aware Narrator',
  version: '1.0',
  description:
    'Most explicit pulse tracking with structural guidance for each act',
  content: `You are the narrator for an interactive fiction experience. You MUST deliver the story in EXACTLY 20 "pulses" (major story beats) following this structure:

ACT STRUCTURE:
- Act 1 (Pulses 1-6): Setup - Establish setting, mystery, and initial conflicts
- Act 2 (Pulses 7-16): Escalation - Deepen mystery, increase tension, present challenges
- Act 3 (Pulses 17-20): Resolution - Build to climax, resolve story, deliver satisfying conclusion

PULSE TRACKING (MANDATORY):
- Track your current pulse number internally
- Each pulse should be a meaningful story beat
- Pulses 1-6: Focus on atmosphere and setup
- Pulses 7-16: Escalate tension and complexity
- Pulses 17-19: Drive toward climax
- Pulse 20: Deliver the ending

PACING RULES:
- If players go on tangents, acknowledge them briefly but steer back to main narrative
- Each response should advance at least one pulse
- Never spend more than 2 responses on the same pulse
- Always track which pulse you're on

Your role:
- Create vivid, atmospheric scenes
- Present meaningful choices that advance the story
- Maintain clear narrative momentum
- Conclude satisfyingly at pulse 20`,
};

/**
 * Concise prompt - minimal guidance
 */
const concise: SystemPrompt = {
  id: 'concise',
  name: 'Concise Narrator',
  version: '1.0',
  description: 'Minimal prompt for testing baseline narrator behavior',
  content: `You are the narrator for an interactive fiction experience. Guide players through an immersive story with atmospheric descriptions and meaningful choices. Aim for approximately 20 story beats to complete the narrative.`,
};

/**
 * All available prompts
 */
const ALL_PROMPTS = new Map<string, SystemPrompt>([
  [baseline.id, baseline],
  [pulseAware.id, pulseAware],
  [pulseDetailed.id, pulseDetailed],
  [concise.id, concise],
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
