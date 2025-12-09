/**
 * Timeline Generation
 *
 * Process full transcript into timeline entries grouped by type.
 */

import type { Message } from '../session/turn';
import type { PrivateMoment } from '../session/private';
import type { Issue } from './issues';

export type TimelineEntryType =
  | 'pulse'
  | 'tangent'
  | 'recovery'
  | 'private-moment'
  | 'issue'
  | 'character-creation';

export interface TimelineEntry {
  turn: number;
  type: TimelineEntryType;
  title: string;
  content: string;
  notes?: string;
}

/**
 * Generate timeline from session data
 */
export function generateTimeline(
  messages: Message[],
  pulses: number[],
  privateMoments: PrivateMoment[],
  issues: Issue[],
): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];

  // Character creation (turn 0)
  const characterCreationMessages = messages.filter((m) => m.turn === 0);
  if (characterCreationMessages.length > 0) {
    const players = characterCreationMessages
      .filter((m) => m.role === 'player')
      .map((m) => m.player)
      .filter(Boolean);

    timeline.push({
      turn: 0,
      type: 'character-creation',
      title: 'Character Creation',
      content: `Players introduced themselves: ${players.join(', ')}`,
    });
  }

  // Process messages turn by turn
  const narratorMessages = messages.filter((m) => m.role === 'narrator' && m.turn > 0);

  for (const message of narratorMessages) {
    const isPulse = pulses.includes(message.turn);
    const hasPrivateMoment = privateMoments.some((pm) => pm.turn === message.turn);
    const hasIssue = issues.some((i) => i.turn === message.turn);

    if (isPulse) {
      const pulseNumber = pulses.indexOf(message.turn) + 1;
      timeline.push({
        turn: message.turn,
        type: 'pulse',
        title: `Pulse ${pulseNumber} - Story Beat`,
        content: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''),
      });
    }

    if (hasPrivateMoment) {
      const pm = privateMoments.find((p) => p.turn === message.turn);
      if (pm) {
        timeline.push({
          turn: message.turn,
          type: 'private-moment',
          title: `Private Moment → ${pm.target}`,
          content: pm.content.substring(0, 150),
          notes: `Response: ${pm.response.substring(0, 100)}`,
        });
      }
    }

    if (hasIssue) {
      const issuesAtTurn = issues.filter((i) => i.turn === message.turn);
      for (const issue of issuesAtTurn) {
        timeline.push({
          turn: message.turn,
          type: 'issue',
          title: `⚠️ ${issue.type.toUpperCase()}`,
          content: issue.description,
          notes: issue.relatedContent ? `Context: ${issue.relatedContent}` : undefined,
        });
      }
    }

    // Detect tangent responses
    if (message.classification === 'tangent-response') {
      timeline.push({
        turn: message.turn,
        type: 'recovery',
        title: 'Tangent Recovery',
        content: message.content.substring(0, 150),
        notes: 'Narrator handling player tangent',
      });
    }
  }

  return timeline.sort((a, b) => a.turn - b.turn);
}

/**
 * Format timeline as markdown
 */
export function formatTimelineMarkdown(timeline: TimelineEntry[]): string {
  const lines: string[] = [];

  for (const entry of timeline) {
    lines.push(`### Turn ${entry.turn}: ${entry.title}\n`);
    lines.push(`${entry.content}\n`);
    if (entry.notes) {
      lines.push(`*${entry.notes}*\n`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Group timeline by type
 */
export function groupTimelineByType(timeline: TimelineEntry[]): Record<string, TimelineEntry[]> {
  const grouped: Record<string, TimelineEntry[]> = {};

  for (const entry of timeline) {
    if (!grouped[entry.type]) {
      grouped[entry.type] = [];
    }
    grouped[entry.type]?.push(entry);
  }

  return grouped;
}

/**
 * Get timeline summary stats
 */
export function getTimelineSummary(timeline: TimelineEntry[]): {
  totalEntries: number;
  pulses: number;
  privateMoments: number;
  issues: number;
  tangents: number;
} {
  return {
    totalEntries: timeline.length,
    pulses: timeline.filter((e) => e.type === 'pulse').length,
    privateMoments: timeline.filter((e) => e.type === 'private-moment').length,
    issues: timeline.filter((e) => e.type === 'issue').length,
    tangents: timeline.filter((e) => e.type === 'recovery').length,
  };
}
