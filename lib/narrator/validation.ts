/**
 * Narrator Output Validation
 *
 * Detects garbage/hallucination outputs from LLMs.
 */

/**
 * Patterns that indicate garbage/hallucination output
 * Based on actual observed failures - not speculative patterns
 */
export const GARBAGE_PATTERNS = {
  /** Changelog/release notes - observed hallucination type */
  changelog: [
    'fixed a bug',
    '## 1.0',
    '## 0.',
    'changelog',
    'release notes',
  ],

  /** Code patterns - backticks and code blocks don't belong in narrative */
  code: [
    '`',  // Any backtick = code, not story
    '```',
  ],
} as const;

/**
 * Minimum repetition count to flag as garbage
 * (same line appearing many times = hallucination loop)
 */
export const REPETITION_THRESHOLD = 4;

/**
 * Check if narrator output is garbage/hallucination
 *
 * @param text - The narrator output to validate
 * @returns true if output is garbage and should be retried
 */
export function isGarbageOutput(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check changelog patterns
  for (const pattern of GARBAGE_PATTERNS.changelog) {
    if (lowerText.includes(pattern)) {
      return true;
    }
  }

  // Check code patterns
  for (const pattern of GARBAGE_PATTERNS.code) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for repetitive lines (hallucination loop)
  // Split into lines and count duplicates
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  }
  for (const count of lineCounts.values()) {
    if (count >= REPETITION_THRESHOLD) {
      return true;
    }
  }

  return false;
}

/**
 * Describe why output was flagged as garbage (for logging)
 */
export function describeGarbageReason(text: string): string {
  const lowerText = text.toLowerCase();

  for (const pattern of GARBAGE_PATTERNS.changelog) {
    if (lowerText.includes(pattern)) {
      return `changelog: "${pattern}"`;
    }
  }

  for (const pattern of GARBAGE_PATTERNS.code) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return `code: "${pattern}"`;
    }
  }

  // Check for repetitive lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  }
  for (const [line, count] of lineCounts.entries()) {
    if (count >= REPETITION_THRESHOLD) {
      const preview = line.slice(0, 40) + (line.length > 40 ? '...' : '');
      return `repetition: "${preview}" x${count}`;
    }
  }

  return 'unknown';
}
