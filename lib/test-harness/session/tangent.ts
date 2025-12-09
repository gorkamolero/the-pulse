
import type { Classification } from './classifier';

export interface TangentMoment {
  /** Turn number where tangent occurred */
  turn: number;
  /** Player messages that triggered the tangent */
  playerMessages: string[];
  /** Narrator's response to the tangent */
  narratorResponse: string;
  /** How the narrator handled it */
  handling: 'acknowledged' | 'redirected' | 'ignored' | 'engaged';
  /** Whether narrator successfully returned to main story */
  returnedToStory: boolean;
  /** How many turns it took to return to story (if applicable) */
  turnsUntilReturn?: number;
}

export interface TangentAnalysis {
  /** All detected tangent moments */
  moments: TangentMoment[];
  /** Total number of tangents */
  totalTangents: number;
  /** How many were successfully redirected */
  successfulRedirects: number;
  /** Average turns to return to story */
  avgTurnsToReturn: number;
  /** Tangent handling distribution */
  handlingDistribution: {
    acknowledged: number;
    redirected: number;
    ignored: number;
    engaged: number;
  };
}

/**
 * Detect if player messages contain tangent behavior
 */
export function detectPlayerTangent(playerMessages: string[]): boolean {
  const tangentPatterns = [
    // Meta-commentary
    /\b(ooc|out of character|meta|fourth wall)\b/i,
    // Jokes/humor
    /\b(lol|haha|just kidding|jk|lmao)\b/i,
    // Completely off-topic
    /\b(by the way|btw|random question|totally unrelated)\b/i,
    // Modern references in period settings
    /\b(selfie|smartphone|internet|wifi|tiktok|instagram)\b/i,
  ];

  return playerMessages.some((msg) =>
    tangentPatterns.some((pattern) => pattern.test(msg)),
  );
}

/**
 * Analyze narrator's tangent handling strategy
 */
export function analyzeTangentHandling(
  narratorResponse: string,
  playerMessages: string[],
): TangentMoment['handling'] {
  const response = narratorResponse.toLowerCase();

  // Ignored - narrator doesn't acknowledge the tangent at all
  const ignorePatterns = [
    /^(?!.*(you|your|however|but)).+$/s, // Response that doesn't reference player at all
  ];

  // Redirected - explicitly brings back to story
  const redirectPatterns = [
    /\b(however|but|yet|returning to|back to|focus on|more pressing)\b/i,
    /\b(the story|narrative|task at hand|matter at hand)\b/i,
  ];

  // Engaged - fully engages with the tangent
  const engagePatterns = [
    /\b(interesting point|good question|you're right|indeed|excellent)\b/i,
    // Response is mostly about the tangent (>50% of content)
  ];

  if (redirectPatterns.some((p) => p.test(response))) {
    return 'redirected';
  }

  if (engagePatterns.some((p) => p.test(response))) {
    return 'engaged';
  }

  // Acknowledged but minimal
  if (response.includes('you') || response.includes('your')) {
    return 'acknowledged';
  }

  return 'ignored';
}

/**
 * Check if narrator returned to main story after tangent
 */
export function checkReturnToStory(
  subsequentOutputs: Classification[],
): { returned: boolean; turnsUntilReturn?: number } {
  // Find the next pulse after the tangent
  const nextPulseIndex = subsequentOutputs.findIndex(
    (c) => c.type === 'pulse',
  );

  if (nextPulseIndex === -1) {
    return { returned: false };
  }

  return {
    returned: true,
    turnsUntilReturn: nextPulseIndex + 1,
  };
}

/**
 * Track tangent throughout session
 */
export class TangentTracker {
  private moments: TangentMoment[] = [];
  private pendingTangents: Map<
    number,
    Omit<TangentMoment, 'returnedToStory' | 'turnsUntilReturn'>
  > = new Map();

  /**
   * Record a potential tangent moment
   */
  recordTangent(
    turn: number,
    playerMessages: string[],
    narratorResponse: string,
    classification: Classification,
  ): void {
    if (classification.type !== 'tangent-response') {
      // Check if this is a return to story after a pending tangent
      if (classification.type === 'pulse' && this.pendingTangents.size > 0) {
        this.resolvePendingTangents(turn);
      }
      return;
    }

    const handling = analyzeTangentHandling(narratorResponse, playerMessages);

    // Store as pending until we see if story returns
    this.pendingTangents.set(turn, {
      turn,
      playerMessages,
      narratorResponse,
      handling,
    });
  }

  /**
   * Resolve pending tangents when story returns
   */
  private resolvePendingTangents(currentTurn: number): void {
    for (const [tangentTurn, pending] of this.pendingTangents) {
      this.moments.push({
        ...pending,
        returnedToStory: true,
        turnsUntilReturn: currentTurn - tangentTurn,
      });
    }
    this.pendingTangents.clear();
  }

  /**
   * Finalize tracking - resolve any remaining pending tangents
   */
  finalize(): void {
    // Any remaining pending tangents didn't return to story
    for (const [_turn, pending] of this.pendingTangents) {
      this.moments.push({
        ...pending,
        returnedToStory: false,
      });
    }
    this.pendingTangents.clear();
  }

  /**
   * Generate tangent analysis
   */
  getAnalysis(): TangentAnalysis {
    const handlingDistribution = {
      acknowledged: 0,
      redirected: 0,
      ignored: 0,
      engaged: 0,
    };

    let totalReturns = 0;
    let sumTurnsToReturn = 0;

    for (const moment of this.moments) {
      handlingDistribution[moment.handling]++;

      if (moment.returnedToStory && moment.turnsUntilReturn) {
        totalReturns++;
        sumTurnsToReturn += moment.turnsUntilReturn;
      }
    }

    return {
      moments: this.moments,
      totalTangents: this.moments.length,
      successfulRedirects: totalReturns,
      avgTurnsToReturn:
        totalReturns > 0 ? sumTurnsToReturn / totalReturns : 0,
      handlingDistribution,
    };
  }
}
