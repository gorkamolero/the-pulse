/**
 * Issue Detection
 *
 * Detect contradictions, loops, forced segues, stuck moments.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { Message } from '../session/turn';
import { withRetry } from '../utils/retry';

export type IssueType =
  | 'contradiction'
  | 'loop'
  | 'forced-segue'
  | 'stuck'
  | 'confusion';

export type IssueSeverity = 'warning' | 'error';

export interface Issue {
  turn: number;
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  relatedContent?: string;
}

const contradictionSchema = z.object({
  turn: z.number(),
  description: z.string(),
});

const contradictionsArraySchema = z.array(contradictionSchema);

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
          relatedContent: recent.content,
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
          relatedContent: message.content,
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
export function detectStuckMoments(
  messages: Message[],
  pulses: number[],
): Issue[] {
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
 * Detect contradictions using LLM
 */
export async function detectContradictions(
  messages: Message[],
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  // First do heuristic detection for door states
  issues.push(...detectDoorContradictions(narratorMessages));

  // Then do LLM-based semantic contradiction detection
  if (narratorMessages.length > 5) {
    const llmIssues = await detectSemanticContradictions(narratorMessages);
    issues.push(...llmIssues);
  }

  return issues;
}

/**
 * Heuristic door state contradiction detection
 */
function detectDoorContradictions(narratorMessages: Message[]): Issue[] {
  const issues: Issue[] = [];
  const stateTracker = {
    doorStates: new Map<string, 'open' | 'closed' | 'locked'>(),
  };

  for (const message of narratorMessages) {
    const doorOpenMatch = message.content.match(
      /the (\w+) door (?:is |stands )?open/i,
    );
    const doorClosedMatch = message.content.match(
      /the (\w+) door (?:is |stands )?closed/i,
    );
    const doorLockedMatch = message.content.match(
      /the (\w+) door (?:is |stands )?locked/i,
    );

    if (doorOpenMatch) {
      const doorName = doorOpenMatch[1];
      const previousState = stateTracker.doorStates.get(doorName || '');

      if (previousState === 'locked' || previousState === 'closed') {
        issues.push({
          turn: message.turn,
          type: 'contradiction',
          description: `Door "${doorName}" was ${previousState}, now open without transition`,
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
 * LLM-based semantic contradiction detection
 */
async function detectSemanticContradictions(
  narratorMessages: Message[],
): Promise<Issue[]> {
  const issues: Issue[] = [];

  try {
    // Sample every 5th message to keep context manageable
    const sampledMessages = narratorMessages.filter(
      (_, i) => i % 5 === 0 || i === narratorMessages.length - 1,
    );

    const transcript = sampledMessages
      .map((m) => `Turn ${m.turn}: ${m.content}`)
      .join('\n\n');

    const prompt = `Analyze this narrative transcript for contradictions. Look for:
- Character descriptions that change (hair color, age, etc.)
- Location inconsistencies (indoors then suddenly outdoors without transition)
- Object state changes without explanation
- Factual contradictions about events

TRANSCRIPT:
${transcript}

List any contradictions found. For each, provide:
- Turn number where contradiction appears
- Brief description of the contradiction

If no contradictions found, return an empty array.`;

    const result = await withRetry(
      async () => {
        return generateObject({
          model: 'google/gemini-2.5-flash',
          schema: contradictionsArraySchema,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        });
      },
      {
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.warn(
            `Contradiction detection retry ${attempt}/2:`,
            error.message.slice(0, 100),
          );
        },
      },
    );

    for (const c of result.object) {
      issues.push({
        turn: c.turn,
        type: 'contradiction',
        description: c.description,
        severity: 'error',
      });
    }
  } catch (error) {
    console.warn(
      'LLM contradiction detection failed after retries:',
      error instanceof Error ? error.message : error,
    );
    // Fallback to heuristics only
  }

  return issues;
}

/**
 * Detect all issues in a session
 */
export async function detectAllIssues(
  messages: Message[],
  pulses: number[],
): Promise<Issue[]> {
  const [loops, segues, stuck, contradictions] = await Promise.all([
    Promise.resolve(detectLoops(messages)),
    Promise.resolve(detectForcedSegues(messages)),
    Promise.resolve(detectStuckMoments(messages, pulses)),
    detectContradictions(messages),
  ]);

  return [...loops, ...segues, ...stuck, ...contradictions].sort(
    (a, b) => a.turn - b.turn,
  );
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
