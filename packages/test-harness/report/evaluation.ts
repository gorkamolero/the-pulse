/**
 * Evaluation Log Extraction
 *
 * Extract focused evaluation data from session results:
 * - narrator-log.md: Narrator turns with thinking blocks
 * - pulse-log.jsonl: Structured turn data for analysis
 * - issues.md: Contradictions with surrounding context
 */

import { writeFile } from 'node:fs/promises';
import type { SessionResult } from '../session/runner';
import type { Message } from '../session/turn';
import type { Issue } from './issues';

/**
 * Truncate text to a maximum length, preserving word boundaries
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}...`;
}

/**
 * Extract narrator turns with their thinking for evaluation
 */
export function extractNarratorLog(messages: Message[]): string {
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  const entries = narratorMessages.map((msg) => {
    const classification = msg.classification || 'unknown';

    // Get player action from previous spokesperson message
    const prevSpokesperson = messages
      .filter((m) => m.turn === msg.turn - 1 && m.role === 'spokesperson')
      .pop();
    const playerAction = prevSpokesperson
      ? truncate(prevSpokesperson.content, 200)
      : '(session start)';

    const thinkingBlock = msg.reasoning
      ? `**Thinking**:\n${truncate(msg.reasoning, 500)}\n\n`
      : '';

    const outputPreview = truncate(msg.content, 800);

    return `## Turn ${msg.turn} [${classification}]

**Player Action**: ${playerAction}

${thinkingBlock}**Output**:
${outputPreview}
`;
  });

  return `# Narrator Evaluation Log

Generated: ${new Date().toISOString()}

${entries.join('\n---\n\n')}`;
}

/**
 * Turn log entry for JSONL format
 */
export interface TurnLogEntry {
  turn: number;
  type: string;
  narratorThinkingPreview: string | null;
  outputPreview: string;
  playerActionPreview: string;
  timestamp: number;
}

/**
 * Extract turn log as JSONL for structured analysis
 */
export function extractTurnLog(messages: Message[]): string {
  const narratorMessages = messages.filter((m) => m.role === 'narrator');

  const entries: TurnLogEntry[] = narratorMessages.map((msg) => {
    // Get player action from previous spokesperson message
    const prevSpokesperson = messages
      .filter((m) => m.turn === msg.turn - 1 && m.role === 'spokesperson')
      .pop();

    return {
      turn: msg.turn,
      type: msg.classification || 'unknown',
      narratorThinkingPreview: msg.reasoning ? truncate(msg.reasoning, 150) : null,
      outputPreview: truncate(msg.content, 150),
      playerActionPreview: prevSpokesperson
        ? truncate(prevSpokesperson.content, 100)
        : '(start)',
      timestamp: msg.timestamp,
    };
  });

  return entries.map((e) => JSON.stringify(e)).join('\n');
}

/**
 * Extract issues with surrounding context for debugging
 */
export function extractIssuesWithContext(
  messages: Message[],
  issues: Issue[],
): string {
  if (issues.length === 0) {
    return `# Issues Log

No issues detected in this session.
`;
  }

  const issueEntries = issues.map((issue) => {
    // Get context: 2 turns before and the issue turn
    const contextTurns = [issue.turn - 2, issue.turn - 1, issue.turn].filter(
      (t) => t > 0,
    );

    const contextMessages = messages
      .filter((m) => contextTurns.includes(m.turn) && m.role === 'narrator')
      .map((m) => {
        const isIssueTurn = m.turn === issue.turn;
        const prefix = isIssueTurn ? '>>> ' : '    ';
        return `${prefix}**Turn ${m.turn}**: ${truncate(m.content, 300)}`;
      });

    return `## ${issue.type.toUpperCase()} at Turn ${issue.turn}

**Severity**: ${issue.severity}
**Description**: ${issue.description}

### Context

${contextMessages.join('\n\n')}

${issue.relatedContent ? `### Related Content\n${truncate(issue.relatedContent, 200)}` : ''}
`;
  });

  return `# Issues Log

Generated: ${new Date().toISOString()}
Total Issues: ${issues.length}

${issueEntries.join('\n---\n\n')}`;
}

/**
 * Extract metrics summary as JSON
 */
export interface MetricsSummary {
  sessionId: string;
  story: string;
  narrator: string;
  promptStyle: string;
  turns: number;
  contradictions: number;
  loops: number;
  forcedSegues: number;
  narratorScore: number | null;
  pacingConsensus: string | null;
  duration: number;
  cost: number;
  outcome: string;
  timestamp: string;
}

/**
 * Extract metrics summary for quick comparison
 */
export function extractMetrics(result: SessionResult, issues: Issue[]): MetricsSummary {
  const contradictions = issues.filter((i) => i.type === 'contradiction').length;
  const loops = issues.filter((i) => i.type === 'loop').length;
  const forcedSegues = issues.filter((i) => i.type === 'forced-segue').length;

  return {
    sessionId: result.sessionId,
    story: result.config.story.storyId,
    narrator: result.config.narratorConfig.model,
    promptStyle: result.config.promptStyle || 'mechanical',
    turns: result.finalTurn,
    contradictions,
    loops,
    forcedSegues,
    narratorScore: result.playerFeedback?.narratorScore ?? null,
    pacingConsensus: result.playerFeedback?.pacingVerdict ?? null,
    duration: result.duration,
    cost: result.costBreakdown?.total.cost ?? 0,
    outcome: result.outcome,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Save all evaluation files for a session
 */
export async function saveEvaluationLogs(
  result: SessionResult,
  issues: Issue[],
  sessionDir: string,
): Promise<void> {
  const { conversationHistory } = result;

  // Save narrator log
  const narratorLog = extractNarratorLog(conversationHistory);
  await writeFile(`${sessionDir}/narrator-log.md`, narratorLog, 'utf-8');

  // Save turn log (JSONL)
  const turnLog = extractTurnLog(conversationHistory);
  await writeFile(`${sessionDir}/turn-log.jsonl`, turnLog, 'utf-8');

  // Save issues with context
  const issuesLog = extractIssuesWithContext(conversationHistory, issues);
  await writeFile(`${sessionDir}/issues.md`, issuesLog, 'utf-8');

  // Save metrics summary
  const metrics = extractMetrics(result, issues);
  await writeFile(`${sessionDir}/metrics.json`, JSON.stringify(metrics, null, 2), 'utf-8');

  // Append to global metrics log
  await appendToGlobalMetrics(metrics);
}

/**
 * Append metrics to global JSONL log
 */
async function appendToGlobalMetrics(metrics: MetricsSummary): Promise<void> {
  const globalLogPath = 'sessions/metrics.jsonl';

  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(globalLogPath, `${JSON.stringify(metrics)}\n`, 'utf-8');
  } catch {
    // File might not exist, create it
    await writeFile(globalLogPath, `${JSON.stringify(metrics)}\n`, 'utf-8');
  }
}

/**
 * Format transcript separately (for optional full output)
 */
export function formatTranscript(messages: Message[]): string {
  return messages
    .map((m) => {
      const speaker =
        m.role === 'narrator'
          ? '**Narrator**'
          : m.role === 'spokesperson'
            ? `**${m.player}** (to narrator)`
            : `**${m.player}**`;

      const reasoningBlock = m.reasoning
        ? `<details>\n<summary>🧠 Thinking</summary>\n\n${m.reasoning}\n\n</details>\n\n`
        : '';

      return `### Turn ${m.turn} - ${speaker}\n\n${reasoningBlock}${m.content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Save transcript as separate file
 */
export async function saveTranscript(
  messages: Message[],
  sessionDir: string,
): Promise<void> {
  const transcript = `# Session Transcript

${formatTranscript(messages)}
`;
  await writeFile(`${sessionDir}/transcript.md`, transcript, 'utf-8');
}
