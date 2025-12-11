/**
 * Narrator Output Validation
 *
 * Detects garbage/hallucination outputs from LLMs.
 */

/**
 * Patterns that indicate garbage/hallucination output
 */
export const GARBAGE_PATTERNS = {
  /** Changelog/release notes patterns */
  changelog: [
    'fixed a bug',
    '## 1.0',
    '## 0.',
    'changelog',
    'release notes',
    'breaking changes',
    'deprecated',
  ],

  /** Code/technical patterns */
  code: [
    'function(',
    'const ',
    'import ',
    'export ',
    '```typescript',
    '```javascript',
    'npm install',
    'yarn add',
  ],

  /** Repetition patterns (detected by count) */
  repetition: [
    '- fixed',
    '- added',
    '- updated',
    '- removed',
  ],

  /** Meta/system patterns */
  meta: [
    'as an ai',
    'i cannot',
    'i apologize',
    'let me help you',
    'here is',
    'sure!',
  ],
} as const;

/**
 * Minimum length for valid narrator output
 */
export const MIN_OUTPUT_LENGTH = 50;

/**
 * Minimum repetition count to flag as garbage
 */
export const REPETITION_THRESHOLD = 3;

/**
 * Check if narrator output is garbage/hallucination
 *
 * @param text - The narrator output to validate
 * @param playerNames - List of player names to check for story relevance
 * @returns true if output is garbage and should be retried
 */
export function isGarbageOutput(text: string, playerNames: string[] = []): boolean {
  const lowerText = text.toLowerCase();

  // Check changelog patterns
  for (const pattern of GARBAGE_PATTERNS.changelog) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }

  // Check code patterns
  for (const pattern of GARBAGE_PATTERNS.code) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }

  // Check repetition patterns
  for (const pattern of GARBAGE_PATTERNS.repetition) {
    const matches = lowerText.match(new RegExp(pattern, 'g')) || [];
    if (matches.length >= REPETITION_THRESHOLD) {
      return true;
    }
  }

  // Check meta patterns (AI refusing or being overly helpful)
  for (const pattern of GARBAGE_PATTERNS.meta) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }

  // Too short to be a real narrator turn
  if (text.trim().length < MIN_OUTPUT_LENGTH) {
    return true;
  }

  // No story-like content at all
  const hasDialogue = text.includes('"') || text.includes('"') || text.includes('"');
  const hasPlayerReference = playerNames.length > 0 && playerNames.some(
    (name) => lowerText.includes(name.toLowerCase()),
  );
  const hasNarrativeWords = /\b(you|the|door|room|see|hear|feel|walk|stand|look|voice|shadow|light|dark|night|day)\b/i.test(text);

  // If no story indicators at all, likely garbage
  if (!hasDialogue && !hasPlayerReference && !hasNarrativeWords) {
    return true;
  }

  return false;
}

/**
 * Describe why output was flagged as garbage (for logging)
 */
export function describeGarbageReason(text: string, playerNames: string[] = []): string {
  const lowerText = text.toLowerCase();

  for (const pattern of GARBAGE_PATTERNS.changelog) {
    if (lowerText.includes(pattern)) {
      return `changelog pattern: "${pattern}"`;
    }
  }

  for (const pattern of GARBAGE_PATTERNS.code) {
    if (lowerText.includes(pattern)) {
      return `code pattern: "${pattern}"`;
    }
  }

  for (const pattern of GARBAGE_PATTERNS.repetition) {
    const matches = lowerText.match(new RegExp(pattern, 'g')) || [];
    if (matches.length >= REPETITION_THRESHOLD) {
      return `repetition: "${pattern}" x${matches.length}`;
    }
  }

  for (const pattern of GARBAGE_PATTERNS.meta) {
    if (lowerText.includes(pattern)) {
      return `meta pattern: "${pattern}"`;
    }
  }

  if (text.trim().length < MIN_OUTPUT_LENGTH) {
    return `too short: ${text.trim().length} chars`;
  }

  const hasDialogue = text.includes('"') || text.includes('"') || text.includes('"');
  const hasPlayerReference = playerNames.length > 0 && playerNames.some(
    (name) => lowerText.includes(name.toLowerCase()),
  );
  const hasNarrativeWords = /\b(you|the|door|room|see|hear|feel|walk|stand|look|voice|shadow|light|dark|night|day)\b/i.test(text);

  if (!hasDialogue && !hasPlayerReference && !hasNarrativeWords) {
    return 'no story content detected';
  }

  return 'unknown';
}
