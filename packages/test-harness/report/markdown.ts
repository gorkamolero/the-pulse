/**
 * Markdown Report Generator
 *
 * Generate formatted markdown reports from session data.
 */

import { writeFile } from 'node:fs/promises';
import type { SessionResult } from '../session/runner';
import type { SessionFeedback } from '../session/feedback';
import { detectAllIssues } from './issues';
import {
  generateTimeline,
  formatTimelineMarkdown,
  getTimelineSummary,
} from './timeline';
import { saveHTMLReport } from './html';
import { saveEvaluationLogs, saveTranscript } from './evaluation';
import { evaluateWithGemini, saveGeminiEvaluation } from './gemini-eval';

export interface SessionReport {
  config: {
    story: string;
    narrator: string;
    prompt: string;
    duration: number;
    cost: number;
  };
  group: Array<{ name: string; archetype: string; model: string }>;
  summary: {
    turns: number;
    pulsesDetected: number;
    pulsesExpected: number;
    tangentCount: number;
    avgTangentLength: number;
    privateMoments: number;
    issuesFound: number;
    outcome: string;
  };
  timeline: string;
  issues: string;
  transcript: string;
}

/**
 * Generate complete session report
 */
export async function generateSessionReport(
  result: SessionResult,
): Promise<string> {
  const issues = await detectAllIssues(result.conversationHistory);
  const timeline = generateTimeline(
    result.conversationHistory,
    result.privateMoments,
    issues,
  );
  const timelineSummary = getTimelineSummary(timeline);

  const report = `# Session Report

## Configuration

- **Session ID**: ${result.sessionId}
- **Story**: ${result.config.story.storyTitle}
- **Narrator**: ${result.config.narratorConfig.model}
- **Prompt Style**: ${result.config.promptStyle || 'mechanical'}
- **Duration**: ${formatDuration(result.duration)}
- **Outcome**: ${result.outcome}
- **Cost**: ${result.costBreakdown ? `$${result.costBreakdown.total.cost.toFixed(4)}` : `$${estimateCost(result).toFixed(2)} (estimated)`}

## Group

| Player | Archetype | Model |
|--------|-----------|-------|
${result.config.group.players
  .map(
    (p) =>
      `| ${p.name} ${p.name === result.config.group.spokesperson.name ? '(spokesperson)' : ''} | ${p.archetype} | ${p.model} |`,
  )
  .join('\n')}

## Summary

- **Turns**: ${result.finalTurn} (total exchanges)
- **Tangents**: ${timelineSummary.tangents}
- **Private Moments**: ${timelineSummary.privateMoments}
- **Issues Detected**: ${issues.length}

${
  result.costBreakdown
    ? `## Cost Breakdown

| Component | Tokens (Input/Output) | Cost |
|-----------|----------------------|------|
| Narrator | ${result.costBreakdown.narrator.tokens.promptTokens.toLocaleString()}/${result.costBreakdown.narrator.tokens.completionTokens.toLocaleString()} | $${result.costBreakdown.narrator.cost.toFixed(4)} |
| Players | ${result.costBreakdown.players.tokens.promptTokens.toLocaleString()}/${result.costBreakdown.players.tokens.completionTokens.toLocaleString()} | $${result.costBreakdown.players.cost.toFixed(4)} |
| Classification | ${result.costBreakdown.classification.tokens.promptTokens.toLocaleString()}/${result.costBreakdown.classification.tokens.completionTokens.toLocaleString()} | $${result.costBreakdown.classification.cost.toFixed(4)} |
| **Total** | **${result.costBreakdown.total.tokens.totalTokens.toLocaleString()}** | **$${result.costBreakdown.total.cost.toFixed(4)}** |
`
    : ''
}

## Timeline

${formatTimelineMarkdown(timeline)}

${result.playerFeedback ? formatPlayerFeedback(result.playerFeedback) : ''}

---

*Full transcript available in \`transcript.md\`. Evaluation data in \`narrator-log.md\`, \`pulse-log.jsonl\`, and \`issues.md\`.*
`;

  return report;
}

export interface SaveReportOptions {
  /** Run Gemini Pro evaluation (requires large context, slower) */
  geminiEval?: boolean;
}

/**
 * Save report to file
 */
export async function saveSessionReport(
  result: SessionResult,
  filename?: string,
  options: SaveReportOptions = {},
): Promise<string> {
  const report = await generateSessionReport(result);
  const sessionDir = `sessions/${result.sessionId}`;
  const filepath = filename || `${sessionDir}/report.md`;

  await writeFile(filepath, report, 'utf-8');

  // Generate evaluation logs
  const issues = await detectAllIssues(result.conversationHistory);

  try {
    await saveEvaluationLogs(result, issues, sessionDir);
    console.log(`  📊 Evaluation logs saved to ${sessionDir}/`);
  } catch (error) {
    console.warn('Failed to generate evaluation logs:', error);
  }

  // Save transcript separately
  try {
    await saveTranscript(result.conversationHistory, sessionDir);
    console.log(`  📝 Transcript saved to ${sessionDir}/transcript.md`);
  } catch (error) {
    console.warn('Failed to save transcript:', error);
  }

  // Run Gemini Pro evaluation if requested
  if (options.geminiEval) {
    try {
      console.log('  🤖 Running Gemini Pro evaluation...');
      const evaluation = await evaluateWithGemini(
        result,
        result.config.systemPrompt,
        result.config.storyGuide,
      );
      await saveGeminiEvaluation(evaluation, sessionDir, {
        outcome: result.outcome,
        finalTurn: result.finalTurn,
        maxTurns: result.config.maxTurns,
        error: result.error,
      });
      console.log(`  ✅ Gemini evaluation saved: ${evaluation.overall.score}/10 (${evaluation.overall.verdict})`);
    } catch (error) {
      console.warn('Failed to run Gemini evaluation:', error);
    }
  }

  // Also generate HTML report
  try {
    await saveHTMLReport(result);
  } catch (error) {
    console.warn('Failed to generate HTML report:', error);
  }

  return filepath;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Estimate cost based on usage
 * Note: Actual token tracking is implemented in session/cost.ts
 */
function estimateCost(result: SessionResult): number {
  // Rough estimates based on model pricing
  const narratorCostPerTurn =
    result.config.narratorConfig.model === 'opus-4.5' ? 0.15 : 0.02;
  const playerCostPerTurn = 0.01;

  return (
    result.finalTurn *
    (narratorCostPerTurn + playerCostPerTurn * result.config.group.size)
  );
}


/**
 * Format player feedback for markdown
 */
function formatPlayerFeedback(feedback: SessionFeedback): string {
  const playerFeedbackSections = feedback.players
    .map(
      (p) => `
### ${p.agentName} (${p.archetype})

**Highlight**: ${p.highlight.moment}
> ${p.highlight.reason}

**Agency**: ${p.agency.feltMeaningful ? '✓ Felt meaningful' : '✗ Did not feel meaningful'}
> ${p.agency.example}

**Pacing**: ${p.pacing.rating === 'good' ? '✓ Good' : p.pacing.rating === 'too-fast' ? '⚡ Too fast' : '🐌 Too slow'}
> ${p.pacing.notes}

**Narrator Rating**: ${p.narratorRating.score}/10
- Positives: ${p.narratorRating.positives.join(', ') || 'None mentioned'}
- Negatives: ${p.narratorRating.negatives.join(', ') || 'None mentioned'}

**Frustrations**: ${p.frustrations.length > 0 ? p.frustrations.map((f) => `\n- ${f}`).join('') : 'None'}

**Missed Opportunities**: ${p.missedOpportunities.length > 0 ? p.missedOpportunities.map((m) => `\n- ${m}`).join('') : 'None'}

**Group Dynamics**: ${p.groupDynamics}
`,
    )
    .join('\n---\n');

  return `## Player Feedback

### Summary

- **Narrator Score**: ${feedback.narratorScore.toFixed(1)}/10
- **Pacing**: ${feedback.pacingVerdict}

**Top Moments**:
${feedback.topMoments.map((m) => `- ${m}`).join('\n')}

**Shared Pain Points**:
${feedback.sharedPainPoints.length > 0 ? feedback.sharedPainPoints.map((p) => `- ${p}`).join('\n') : '- None'}

**Narrator Strengths**:
${feedback.narratorStrengths.length > 0 ? feedback.narratorStrengths.map((s) => `- ${s}`).join('\n') : '- None mentioned'}

**Narrator Weaknesses**:
${feedback.narratorWeaknesses.length > 0 ? feedback.narratorWeaknesses.map((w) => `- ${w}`).join('\n') : '- None mentioned'}

**Recommendations**:
${feedback.recommendations.length > 0 ? feedback.recommendations.map((r) => `- ${r}`).join('\n') : '- None'}

### Individual Player Feedback

${playerFeedbackSections}
`;
}

// formatTranscript moved to evaluation.ts
