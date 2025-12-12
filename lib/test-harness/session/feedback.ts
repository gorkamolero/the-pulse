/**
 * Post-Game Player Feedback System
 *
 * After story completion, interview each player agent about their experience.
 * Use subjective feedback to improve narrator behavior, pacing, and story design.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { PlayerAgent } from '../agents/player';
import type { Message } from './turn';
import type { CostTracker } from './cost';
import { withRetry } from '../utils/retry';

/**
 * Individual player's feedback after the session
 */
export interface PlayerFeedback {
  agentId: string;
  agentName: string;
  archetype: string;

  highlight: {
    moment: string;
    reason: string;
  };

  agency: {
    feltMeaningful: boolean;
    example: string;
  };

  frustrations: string[];

  missedOpportunities: string[];

  pacing: {
    rating: 'too-fast' | 'too-slow' | 'good';
    notes: string;
  };

  narratorRating: {
    score: number;
    positives: string[];
    negatives: string[];
  };

  groupDynamics: string;
}

/**
 * Aggregated feedback from all players
 */
export interface SessionFeedback {
  sessionId: string;

  /** Individual player feedback */
  players: PlayerFeedback[];

  /** Moments multiple agents loved */
  topMoments: string[];

  /** Common frustrations across agents */
  sharedPainPoints: string[];

  /** Average narrator score */
  narratorScore: number;
  narratorStrengths: string[];
  narratorWeaknesses: string[];

  /** Pacing consensus */
  pacingVerdict: string;

  /** Actionable improvements */
  recommendations: string[];
}

// Zod schema for structured feedback response
const feedbackSchema = z.object({
  highlight: z.object({
    moment: z.string().describe('Your single favorite moment from the story'),
    reason: z.string().describe('Why this moment stood out'),
  }),
  agency: z.object({
    feltMeaningful: z
      .boolean()
      .describe('Did your choices feel like they mattered?'),
    example: z
      .string()
      .describe('A specific example of a meaningful (or meaningless) choice'),
  }),
  frustrations: z
    .array(z.string())
    .describe('Things that were confusing, unfair, or annoying'),
  missedOpportunities: z
    .array(z.string())
    .describe("Things you wanted to do but couldn't"),
  pacing: z.object({
    rating: z.enum(['too-fast', 'too-slow', 'good']).describe('Overall pacing'),
    notes: z.string().describe('Specific pacing observations'),
  }),
  narratorRating: z.object({
    score: z.number().min(1).max(10).describe('Rating from 1-10'),
    positives: z.array(z.string()).describe('What the narrator did well'),
    negatives: z.array(z.string()).describe('What the narrator could improve'),
  }),
  groupDynamics: z
    .string()
    .describe('How playing with others affected your experience'),
});

// Use a cheap model for feedback collection
const FEEDBACK_MODEL = 'google/gemini-2.5-flash';

/**
 * Build feedback interview prompt
 */
function buildFeedbackPrompt(
  agent: PlayerAgent,
  conversationHistory: Message[],
): string {
  // Get a summary of key moments (narrator messages only, last 20)
  const narratorMoments = conversationHistory
    .filter((m) => m.role === 'narrator')
    .slice(-20)
    .map((m) => m.content.slice(0, 200))
    .join('\n---\n');

  return `You played as "${agent.name}" (archetype: ${agent.archetype}).

Sample narrator outputs from the session:
${narratorMoments}

Evaluate the STORY and NARRATOR:

1. HIGHLIGHT: Best moment. Why was it effective?
2. AGENCY: Did choices feel meaningful? Specific example.
3. FRUSTRATIONS: Problems? (railroading, inconsistency, pacing)
4. MISSED OPPORTUNITIES: What could have been better?
5. PACING: Too fast, too slow, or good?
6. NARRATOR RATING: 1-10. Strengths and weaknesses?
7. GROUP DYNAMICS: How well did narrator handle multiple players?`;
}

/**
 * Collect feedback from a single player agent
 */
async function collectAgentFeedback(
  agent: PlayerAgent,
  conversationHistory: Message[],
  costTracker: CostTracker,
): Promise<PlayerFeedback> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const feedbackPrompt = buildFeedbackPrompt(agent, conversationHistory);

  try {
    const result = await withRetry(
      async () => {
        return generateObject({
          model: openrouter(FEEDBACK_MODEL),
          schema: feedbackSchema,
          messages: [
            { role: 'system', content: agent.systemPrompt },
            {
              role: 'system',
              content: `**MODE CHANGE: FEEDBACK COLLECTION**

The game is OVER. You are now an AI TEST AGENT evaluating the experience.

CRITICAL INSTRUCTIONS:
- Do NOT roleplay as your character
- Do NOT reference fictional shared memories as real experiences
- You are EVALUATING the story and narrator performance analytically
- Reference actual content from the session
- Be specific and critical`,
            },
            { role: 'user', content: feedbackPrompt },
          ],
          temperature: 0.7,
        });
      },
      {
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.warn(
            `   ⚠ ${agent.name} feedback retry ${attempt}/2:`,
            error.message.slice(0, 80),
          );
        },
      },
    );

    if (result.usage) {
      costTracker.recordClassificationUsage(result.usage); // Use classification bucket for misc costs
    }

    console.log(
      `   ✓ ${agent.name}: ${result.object.narratorRating.score}/10 - "${result.object.highlight.moment.slice(0, 50)}..."`,
    );

    return {
      agentId: agent.archetype,
      agentName: agent.name,
      archetype: agent.archetype,
      ...result.object,
    };
  } catch (error) {
    console.error(
      `Feedback collection error for ${agent.name} after retries:`,
      error instanceof Error ? error.message : error,
    );

    // Return minimal feedback on error
    return {
      agentId: agent.archetype,
      agentName: agent.name,
      archetype: agent.archetype,
      highlight: {
        moment: 'Unable to provide feedback',
        reason: 'Error during collection',
      },
      agency: { feltMeaningful: false, example: 'N/A' },
      frustrations: ['Feedback collection failed'],
      missedOpportunities: [],
      pacing: { rating: 'good', notes: 'N/A' },
      narratorRating: {
        score: 5,
        positives: [],
        negatives: ['Feedback collection failed'],
      },
      groupDynamics: 'N/A',
    };
  }
}

/**
 * Collect feedback from all player agents
 */
export async function collectPlayerFeedback(
  agents: PlayerAgent[],
  conversationHistory: Message[],
  costTracker: CostTracker,
): Promise<PlayerFeedback[]> {
  console.log('\n--- Post-Game Feedback ---\n');

  const feedback: PlayerFeedback[] = [];

  for (const agent of agents) {
    const agentFeedback = await collectAgentFeedback(
      agent,
      conversationHistory,
      costTracker,
    );
    feedback.push(agentFeedback);
  }

  return feedback;
}

/**
 * Synthesize individual feedback into session-level insights
 */
export function synthesizeFeedback(
  sessionId: string,
  playerFeedback: PlayerFeedback[],
): SessionFeedback {
  // Guard against empty feedback
  if (playerFeedback.length === 0) {
    return {
      sessionId,
      players: [],
      topMoments: [],
      sharedPainPoints: [],
      narratorScore: 0,
      narratorStrengths: [],
      narratorWeaknesses: [],
      pacingVerdict: 'No feedback collected',
      recommendations: ['No player feedback was collected'],
    };
  }

  // Calculate average narrator score
  const narratorScore =
    playerFeedback.reduce((sum, f) => sum + f.narratorRating.score, 0) /
    playerFeedback.length;

  // Find common highlights (moments mentioned by multiple players)
  const allMoments = playerFeedback.map((f) =>
    f.highlight.moment.toLowerCase(),
  );
  const topMoments = playerFeedback
    .map((f) => f.highlight.moment)
    .filter((moment, i) => {
      // Check if similar moment mentioned by others
      const lowerMoment = moment.toLowerCase();
      return allMoments.some(
        (other, j) =>
          i !== j &&
          (other.includes(lowerMoment.slice(0, 20)) ||
            lowerMoment.includes(other.slice(0, 20))),
      );
    });

  // Aggregate frustrations
  const allFrustrations = playerFeedback.flatMap((f) => f.frustrations);
  const frustrationCounts = new Map<string, number>();
  for (const f of allFrustrations) {
    const key = f.toLowerCase().slice(0, 30);
    frustrationCounts.set(key, (frustrationCounts.get(key) || 0) + 1);
  }
  const sharedPainPoints = allFrustrations.filter((f) => {
    const key = f.toLowerCase().slice(0, 30);
    return (frustrationCounts.get(key) || 0) > 1;
  });

  // Aggregate narrator positives/negatives
  const narratorStrengths = Array.from(
    new Set(playerFeedback.flatMap((f) => f.narratorRating.positives)),
  );
  const narratorWeaknesses = Array.from(
    new Set(playerFeedback.flatMap((f) => f.narratorRating.negatives)),
  );

  // Pacing verdict
  const pacingVotes = playerFeedback.map((f) => f.pacing.rating);
  const pacingCounts = {
    'too-fast': pacingVotes.filter((v) => v === 'too-fast').length,
    'too-slow': pacingVotes.filter((v) => v === 'too-slow').length,
    good: pacingVotes.filter((v) => v === 'good').length,
  };
  const pacingWinner = Object.entries(pacingCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const pacingVerdict = pacingWinner
    ? `${pacingWinner[0]} (${pacingWinner[1]}/${playerFeedback.length} agents)`
    : 'mixed';

  // Generate recommendations
  const recommendations: string[] = [];

  if (narratorScore < 7) {
    recommendations.push(
      'Narrator quality needs improvement - review negative feedback',
    );
  }

  if (sharedPainPoints.length > 0) {
    recommendations.push(
      `Address shared frustrations: ${sharedPainPoints.slice(0, 2).join(', ')}`,
    );
  }

  const lowAgency = playerFeedback.filter((f) => !f.agency.feltMeaningful);
  if (lowAgency.length > playerFeedback.length / 2) {
    recommendations.push(
      'Improve player agency - choices feel meaningless to most players',
    );
  }

  if (pacingCounts['too-fast'] > pacingCounts.good) {
    recommendations.push('Slow down pacing - too rushed for most players');
  } else if (pacingCounts['too-slow'] > pacingCounts.good) {
    recommendations.push('Speed up pacing - too slow for most players');
  }

  const missedOpps = Array.from(
    new Set(playerFeedback.flatMap((f) => f.missedOpportunities)),
  );
  if (missedOpps.length > 3) {
    recommendations.push(
      `Consider enabling: ${missedOpps.slice(0, 3).join(', ')}`,
    );
  }

  // Log summary
  console.log('\n--- Feedback Summary ---\n');
  console.log(`   Narrator Score: ${narratorScore.toFixed(1)}/10`);
  console.log(`   Pacing: ${pacingVerdict}`);
  console.log(
    `   Agency felt meaningful: ${playerFeedback.filter((f) => f.agency.feltMeaningful).length}/${playerFeedback.length}`,
  );
  if (recommendations.length > 0) {
    console.log(`   Recommendations:`);
    for (const rec of recommendations) {
      console.log(`      - ${rec}`);
    }
  }
  console.log('');

  return {
    sessionId,
    players: playerFeedback,
    topMoments:
      topMoments.length > 0
        ? topMoments
        : playerFeedback.map((f) => f.highlight.moment),
    sharedPainPoints:
      sharedPainPoints.length > 0
        ? sharedPainPoints
        : allFrustrations.slice(0, 3),
    narratorScore,
    narratorStrengths,
    narratorWeaknesses,
    pacingVerdict,
    recommendations,
  };
}
