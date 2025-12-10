/**
 * Session Metadata and Tagging
 *
 * Allows sessions to be tagged and organized for batch analysis
 */

export interface SessionMetadata {
  /** Freeform tags for categorization */
  tags: string[];
  /** Optional experiment name */
  experiment?: string;
  /** Notes about this session */
  notes?: string;
  /** Git commit hash when session was run */
  gitCommit?: string;
  /** Timestamp when session started */
  startedAt: number;
  /** Optional user-defined session name */
  name?: string;
}

/**
 * Common tag categories for organization
 */
export const TagCategories = {
  /** Prompt variant being tested (only production now) */
  PROMPT: ['production'],

  /** Narrator model */
  NARRATOR: ['opus-4.5', 'grok-4', 'deepseek-v3.2'],

  /** Story being tested */
  STORY: ['shadow-over-innsmouth', 'the-hollow-choir', 'whispering-pines', 'siren-of-the-red-dust', 'endless-path'],

  /** Experiment type */
  EXPERIMENT: ['a-b-test', 'prompt-comparison', 'model-comparison', 'baseline'],

  /** Quality indicators */
  QUALITY: ['success', 'failed', 'partial', 'timeout', 'tangent-heavy', 'on-track'],
} as const;

/**
 * Create session metadata with automatic git commit detection
 */
export function createSessionMetadata(options: {
  tags?: string[];
  experiment?: string;
  notes?: string;
  name?: string;
}): SessionMetadata {
  return {
    tags: options.tags || [],
    experiment: options.experiment,
    notes: options.notes,
    gitCommit: process.env.GIT_COMMIT, // Can be set via CI/CD
    startedAt: Date.now(),
    name: options.name,
  };
}

/**
 * Add tags to metadata
 */
export function addTags(metadata: SessionMetadata, ...tags: string[]): SessionMetadata {
  return {
    ...metadata,
    tags: [...new Set([...metadata.tags, ...tags])],
  };
}

/**
 * Check if metadata matches tag filter
 */
export function matchesTags(metadata: SessionMetadata, requiredTags: string[]): boolean {
  return requiredTags.every((tag) => metadata.tags.includes(tag));
}

/**
 * Generate automatic tags based on session configuration
 */
export function generateAutoTags(config: {
  promptId: string;
  narratorModel: string;
  storyId: string;
}): string[] {
  return [
    `prompt:${config.promptId}`,
    `narrator:${config.narratorModel}`,
    `story:${config.storyId}`,
  ];
}
