/**
 * Issue Detection
 *
 * Detect contradictions, loops, forced segues, stuck moments.
 */

import type { Message } from '../session/turn';

export type IssueType = 'contradiction' | 'loop' | 'forced-segue' | 'stuck' | 'confusion';

export type IssueSeverity = 'warning' | 'error';

export interface Issue {
  turn: number;
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  relatedContent?: string;
}

/**
 * Detect loops (repeated content)
 */
export function detectLoops(messages: Message[]): Issue[] {
  const issues: Issue[] = [];
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  for (let i = 0; i < narratorMessages.length; i++) {
    const current = narratorMessages[i];
    if (!current) continue;

    // Check for similar content in recent messages
    const recentMessages = narratorMessages.slice(Math.max(0, i - 5), i);

    for (const recent of recentMessages) {
      const similarity = calculateSimilarity(current.content, recent.content);

      if (similarity > 0.8) {
        issues.push({
          turn: current.turn,
          type: 'loop',
          description: `Narrator output very similar to turn ${recent.turn}`,
          severity: 'error',
          relatedContent: recent.content.substring(0, 100),
        });
      }
    }
  }

  return issues;
}

/**
 * Detect forced segues (awkward tangent recovery)
 */
export function detectForcedSegues(messages: Message[]): Issue[] {
  const issues: Issue[] = [];

  const forcedSeguePatterns = [
    /\banyway\b/i,
    /\bback to the (story|narrative)\b/i,
    /\breturning to\b/i,
    /\bas I was saying\b/i,
    /\blet's get back\b/i,
    /\bbut back to\b/i,
  ];

  for (const message of messages) {
    if (message.role !== 'narrator') continue;

    for (const pattern of forcedSeguePatterns) {
      if (pattern.test(message.content)) {
        issues.push({
          turn: message.turn,
          type: 'forced-segue',
          description: 'Narrator used forced transition language',
          severity: 'warning',
          relatedContent: message.content.substring(0, 150),
        });
        break;
      }
    }
  }

  return issues;
}

/**
 * Detect stuck moments (no pulse progress)
 */
export function detectStuckMoments(messages: Message[], pulses: number[]): Issue[] {
  const issues: Issue[] = [];
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  // Check for long stretches without pulses
  let lastPulseTurn = 0;

  for (const message of narratorMessages) {
    const isPulse = pulses.includes(message.turn);

    if (isPulse) {
      lastPulseTurn = message.turn;
    } else {
      const turnsSinceLastPulse = message.turn - lastPulseTurn;

      if (turnsSinceLastPulse > 10) {
        issues.push({
          turn: message.turn,
          type: 'stuck',
          description: `No pulse progress for ${turnsSinceLastPulse} turns`,
          severity: 'warning',
        });
      }
    }
  }

  return issues;
}

/**
 * Detect contradictions (simple heuristic)
 */
export function detectContradictions(messages: Message[]): Issue[] {
  const issues: Issue[] = [];
  // TODO: Implement LLM-based contradiction detection
  // This would require semantic understanding

  // For now, detect obvious contradictions with simple patterns
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  const stateTracker = {
    doorStates: new Map<string, 'open' | 'closed' | 'locked'>(),
    locations: new Map<string, string>(),
  };

  for (const message of narratorMessages) {
    // Track door states
    const doorOpenMatch = message.content.match(/the (\w+) door (?:is |stands )?open/i);
    const doorClosedMatch = message.content.match(/the (\w+) door (?:is |stands )?closed/i);
    const doorLockedMatch = message.content.match(/the (\w+) door (?:is |stands )?locked/i);

    if (doorOpenMatch) {
      const doorName = doorOpenMatch[1];
      const previousState = stateTracker.doorStates.get(doorName || '');

      if (previousState === 'locked' || previousState === 'closed') {
        issues.push({
          turn: message.turn,
          type: 'contradiction',
          description: `Door "${doorName}" was ${previousState}, now described as open without transition`,
          severity: 'error',
        });
      }

      stateTracker.doorStates.set(doorName || '', 'open');
    }

    if (doorClosedMatch) {
      const doorName = doorClosedMatch[1];
      stateTracker.doorStates.set(doorName || '', 'closed');
    }

    if (doorLockedMatch) {
      const doorName = doorLockedMatch[1];
      stateTracker.doorStates.set(doorName || '', 'locked');
    }
  }

  return issues;
}

/**
 * Detect all issues in a session
 */
export function detectAllIssues(messages: Message[], pulses: number[]): Issue[] {
  return [
    ...detectLoops(messages),
    ...detectForcedSegues(messages),
    ...detectStuckMoments(messages, pulses),
    ...detectContradictions(messages),
  ].sort((a, b) => a.turn - b.turn);
}

/**
 * Calculate similarity between two strings (simple Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
