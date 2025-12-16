/**
 * Gemini Pro Post-Hoc Evaluation
 *
 * Comprehensive session evaluation using Gemini Pro's large context window.
 * Evaluates narrator performance against the philosophical framework.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import type { SessionResult } from '../session/runner';
import type { Message } from '../session/turn';
import { withRetry } from '../utils/retry';
import { evaluatorPrompt } from '../prompts/evaluator';

/**
 * Dimension score with evidence
 */
const dimensionSchema = z.object({
  score: z.number().min(1).max(10),
  evidence: z.array(z.object({
    turn: z.number(),
    quote: z.string().describe('Brief quote from the transcript'),
    assessment: z.string().describe('Why this is good or bad'),
  })).describe('2-4 specific examples from the transcript'),
  notes: z.string().describe('Overall assessment of this dimension'),
});

/**
 * Evaluation result schema - 12 dimensions from philosophical framework
 */
const evaluationSchema = z.object({
  // Overall assessment
  overall: z.object({
    score: z.number().min(1).max(10).describe('Average of all dimension scores'),
    summary: z.string().describe('2-3 sentence summary of the session quality'),
    verdict: z.enum(['excellent', 'good', 'acceptable', 'poor', 'failed']),
  }),

  // 1. Agency Respect (Critical)
  agencyRespect: dimensionSchema.describe('Does the Narrator respect player agency? Look for violations: writing player actions/speech/decisions/internal states, advancing time during decision points'),

  // 2. Equipment Engagement
  equipmentEngagement: dimensionSchema.describe('Does the Narrator track and respond to player equipment? Are items woven into scenes or forgotten?'),

  // 3. NPC Dialogue Quality
  npcDialogue: dimensionSchema.describe('Are NPCs people having conversations, or exposition dispensers? Look for monologues, lore dumps, ignored questions'),

  // 4. Spatial Consistency
  spatialConsistency: dimensionSchema.describe('Does the Narrator track where everyone is? Look for teleporting NPCs, position contradictions'),

  // 5. Character Creation Depth
  characterCreation: dimensionSchema.describe('Did the Narrator properly establish characters before beginning? Did they probe beyond initial answers?'),

  // 6. Invitation Architecture
  invitationArchitecture: dimensionSchema.describe('Do Narrator responses create space for player response? Look for openings vs closed paragraphs'),

  // 7. Atmosphere & Feeling
  atmosphere: dimensionSchema.describe('Is the Narrator making players feel things? Look for sensory immersion, evoked emotions, weight of moments'),

  // 8. Curiosity Following
  curiosityFollowing: dimensionSchema.describe('When players show interest in something, does the Narrator lean in? Or redirect to their plan?'),

  // 9. Pacing & Breath
  pacingBreath: dimensionSchema.describe('Does the session breathe, or is it a plot sprint? Look for atmospheric moments, space for tangents'),

  // 10. Declaration vs Acknowledgment (Critical)
  declarationVsAcknowledgment: dimensionSchema.describe('When players make decisions, does the Narrator acknowledge (set up the world and wait) or declare (summarize as fact and move forward)? Look for "The decision is made", "You have chosen X", "The group moves toward Y"'),

  // 11. Branching Persistence
  branchingPersistence: dimensionSchema.describe('Once an objective is established, do meaningful alternatives remain? Can players deviate? Are unexpected approaches incorporated or redirected?'),

  // 12. Actionable vs Atmospheric
  actionableVsAtmospheric: dimensionSchema.describe('Are descriptions translatable to player action? Look for sensory details that suggest interaction, clear spatial relationships, stakes that invite response. Red flags: purely conceptual descriptions, atmosphere without objects to interact with'),

  // Experiential Smell Test
  smellTest: z.object({
    railroadedReported: z.boolean().describe('Did any player explicitly report feeling railroaded?'),
    linearLanguageUsed: z.boolean().describe('Did any player use words like "linear", "prescriptive", or "predetermined"?'),
    declarationPhrases: z.boolean().describe('Did the Narrator ever use phrases like "The decision is made" or "You have chosen"?'),
    experientiallyWrong: z.boolean().describe('Were there moments where technically correct narration felt experientially wrong?'),
    cappedScore: z.boolean().describe('Should overall score be capped at 8.5 due to smell test failures?'),
    notes: z.string().optional().describe('Explanation if any smell test failed'),
  }).describe('Final check: if ANY answer is yes, cap overall score at 8.5'),

  // Critical issues (agency violations)
  agencyViolations: z.array(z.object({
    turn: z.number(),
    quote: z.string(),
    explanation: z.string(),
  })).describe('Specific moments where Narrator wrote player actions/decisions'),

  // Notable strengths
  strengths: z.array(z.object({
    turn: z.number(),
    description: z.string(),
    why: z.string(),
  })).describe('2-4 moments that really worked'),

  // Actionable recommendations
  recommendations: z.array(z.string()).describe('Specific, actionable improvements'),
});

export type GeminiEvaluation = z.infer<typeof evaluationSchema>;

/**
 * Format transcript for evaluation (narrator + spokesperson only, compressed)
 */
function formatTranscriptForEval(messages: Message[]): string {
  return messages
    .filter((m) => m.role === 'narrator' || m.role === 'spokesperson')
    .map((m) => {
      const role = m.role === 'narrator' ? 'NARRATOR' : `PLAYERS (${m.player})`;
      // Include thinking for narrator if present
      const thinking = m.reasoning ? `\n[Thinking: ${m.reasoning.slice(0, 500)}...]` : '';
      return `--- Turn ${m.turn} ---\n${role}:${thinking}\n${m.content}`;
    })
    .join('\n\n');
}

/**
 * Session metadata for evaluation context
 */
export interface SessionMetadata {
  outcome: 'completed' | 'timeout' | 'failed';
  finalTurn: number;
  maxTurns: number;
  error?: string;
}

/**
 * Build the evaluation prompt
 */
function buildEvaluationPrompt(
  transcript: string,
  narratorSystemPrompt: string,
  storyGuide: string,
  storyTitle: string,
  storyDescription: string,
  metadata: SessionMetadata,
): string {
  // Build session status section
  let sessionStatus = `## Session Status\n\n`;
  sessionStatus += `- **Outcome**: ${metadata.outcome}\n`;
  sessionStatus += `- **Turns Completed**: ${metadata.finalTurn} / ${metadata.maxTurns}\n`;

  if (metadata.outcome === 'failed') {
    sessionStatus += `\n**⚠️ IMPORTANT: This session FAILED before completion.** `;
    sessionStatus += `The evaluation should reflect that we only have ${metadata.finalTurn} turns of content to assess. `;
    sessionStatus += `A failed session cannot receive a high overall score regardless of content quality. `;
    sessionStatus += `Factor the incomplete nature into your verdict.\n`;
    if (metadata.error) {
      sessionStatus += `- **Error**: ${metadata.error}\n`;
    }
  } else if (metadata.outcome === 'timeout') {
    sessionStatus += `\n**Note**: This session hit the turn limit without reaching a natural ending. `;
    sessionStatus += `Consider whether the pacing allowed for story resolution.\n`;
  }

  return `${evaluatorPrompt()}

${sessionStatus}

## Story Information

**Title**: ${storyTitle}
**Description**: ${storyDescription}

## Narrator System Prompt

This is the instruction set given to the AI narrator. Use this to understand what the narrator was asked to do:

<narrator_system_prompt>
${narratorSystemPrompt}
</narrator_system_prompt>

## Story Guide

This is the story guide with intended beats and scenes. The narrator should adapt to player choices, not railroad:

<story_guide>
${storyGuide}
</story_guide>

## Session Transcript

<transcript>
${transcript}
</transcript>

Provide your evaluation as structured JSON matching the schema.`;
}

/**
 * Run Gemini Pro evaluation on a session
 */
export async function evaluateWithGemini(
  result: SessionResult,
  narratorSystemPrompt: string,
  storyGuide: string,
): Promise<GeminiEvaluation> {
  const transcript = formatTranscriptForEval(result.conversationHistory);
  const metadata: SessionMetadata = {
    outcome: result.outcome,
    finalTurn: result.finalTurn,
    maxTurns: result.config.maxTurns,
    error: result.error,
  };
  const prompt = buildEvaluationPrompt(
    transcript,
    narratorSystemPrompt,
    storyGuide,
    result.config.story.storyTitle,
    result.config.story.storySetting,
    metadata,
  );

  const evaluation = await withRetry(
    async () => {
      const response = await generateObject({
        model: 'google/gemini-3-pro-preview',
        schema: evaluationSchema,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      return response.object;
    },
    {
      maxRetries: 2,
      onRetry: (attempt, error) => {
        console.warn(`Gemini evaluation retry ${attempt}/2:`, error.message.slice(0, 100));
      },
    },
  );

  return evaluation;
}

/**
 * Format dimension for markdown
 */
function formatDimension(name: string, dim: z.infer<typeof dimensionSchema>): string {
  const evidenceList = dim.evidence
    .map((e) => `- **Turn ${e.turn}**: "${e.quote}" — ${e.assessment}`)
    .join('\n');

  return `### ${name}: ${dim.score}/10

${dim.notes}

**Evidence**:
${evidenceList || '- No specific examples cited'}
`;
}

/**
 * Format evaluation as markdown report
 */
export function formatEvaluationMarkdown(
  eval_: GeminiEvaluation,
  metadata?: SessionMetadata,
): string {
  const avgScore = eval_.overall.score;

  // Build session status banner for failed/timeout sessions
  let statusBanner = '';
  if (metadata?.outcome === 'failed') {
    statusBanner = `> ⚠️ **Session Failed** after ${metadata.finalTurn} turns\n\n`;
  } else if (metadata?.outcome === 'timeout') {
    statusBanner = `> ⏱️ **Session Timeout** at ${metadata.finalTurn}/${metadata.maxTurns} turns\n\n`;
  }

  return `# Narrator Evaluation

${statusBanner}## Overall: ${avgScore.toFixed(1)}/10 (${eval_.overall.verdict})

${eval_.overall.summary}

---

## Scores

| Dimension | Score | Weight |
|-----------|-------|--------|
| Agency Respect | ${eval_.agencyRespect.score}/10 | 2.0x |
| Declaration vs Acknowledgment | ${eval_.declarationVsAcknowledgment.score}/10 | 1.5x |
| Invitation Architecture | ${eval_.invitationArchitecture.score}/10 | 1.5x |
| Branching Persistence | ${eval_.branchingPersistence.score}/10 | 1.5x |
| Equipment Engagement | ${eval_.equipmentEngagement.score}/10 | 1.0x |
| NPC Dialogue | ${eval_.npcDialogue.score}/10 | 1.0x |
| Spatial Consistency | ${eval_.spatialConsistency.score}/10 | 1.0x |
| Character Creation | ${eval_.characterCreation.score}/10 | 1.0x |
| Atmosphere & Feeling | ${eval_.atmosphere.score}/10 | 1.0x |
| Curiosity Following | ${eval_.curiosityFollowing.score}/10 | 1.0x |
| Pacing & Breath | ${eval_.pacingBreath.score}/10 | 1.0x |
| Actionable vs Atmospheric | ${eval_.actionableVsAtmospheric.score}/10 | 1.0x |

---

## Dimension Details

${formatDimension('Agency Respect (Critical)', eval_.agencyRespect)}

${formatDimension('Equipment Engagement', eval_.equipmentEngagement)}

${formatDimension('NPC Dialogue Quality', eval_.npcDialogue)}

${formatDimension('Spatial Consistency', eval_.spatialConsistency)}

${formatDimension('Character Creation Depth', eval_.characterCreation)}

${formatDimension('Invitation Architecture', eval_.invitationArchitecture)}

${formatDimension('Atmosphere & Feeling', eval_.atmosphere)}

${formatDimension('Curiosity Following', eval_.curiosityFollowing)}

${formatDimension('Pacing & Breath', eval_.pacingBreath)}

${formatDimension('Declaration vs Acknowledgment (Critical)', eval_.declarationVsAcknowledgment)}

${formatDimension('Branching Persistence', eval_.branchingPersistence)}

${formatDimension('Actionable vs Atmospheric', eval_.actionableVsAtmospheric)}

---

## Experiential Smell Test

${eval_.smellTest.cappedScore ? '⚠️ **SCORE CAPPED AT 8.5** due to smell test failure\n\n' : ''}| Question | Result |
|----------|--------|
| Player reported feeling railroaded? | ${eval_.smellTest.railroadedReported ? '⚠️ YES' : '✓ No'} |
| Used "linear/prescriptive/predetermined"? | ${eval_.smellTest.linearLanguageUsed ? '⚠️ YES' : '✓ No'} |
| Narrator used "decision is made" phrases? | ${eval_.smellTest.declarationPhrases ? '⚠️ YES' : '✓ No'} |
| Technically correct but experientially wrong? | ${eval_.smellTest.experientiallyWrong ? '⚠️ YES' : '✓ No'} |

${eval_.smellTest.notes ? `**Notes**: ${eval_.smellTest.notes}` : ''}

---

## Agency Violations

${eval_.agencyViolations.length > 0
    ? eval_.agencyViolations.map((v) => `### Turn ${v.turn}
> "${v.quote}"

${v.explanation}
`).join('\n')
    : 'No agency violations detected.'}

---

## Notable Strengths

${eval_.strengths.map((s) => `### Turn ${s.turn}
${s.description}

*Why it worked*: ${s.why}
`).join('\n') || 'No specific strengths highlighted.'}

---

## Recommendations

${eval_.recommendations.map((r) => `- ${r}`).join('\n') || '- None'}
`;
}

/**
 * Save Gemini evaluation to session directory
 */
export async function saveGeminiEvaluation(
  evaluation: GeminiEvaluation,
  sessionDir: string,
  metadata?: SessionMetadata,
): Promise<void> {
  // Save as JSON for programmatic access
  await writeFile(
    `${sessionDir}/gemini-eval.json`,
    JSON.stringify(evaluation, null, 2),
    'utf-8',
  );

  // Save as markdown for human reading
  const markdown = formatEvaluationMarkdown(evaluation, metadata);
  await writeFile(`${sessionDir}/gemini-eval.md`, markdown, 'utf-8');
}
