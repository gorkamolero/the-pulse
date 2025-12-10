/**
 * Performance Metrics Tracking
 *
 * Tracks timing, token usage, and quality metrics for sessions
 */

import type { CostBreakdown } from './cost';
import type { TangentAnalysis } from './tangent';

export interface PerformanceMetrics {
  /** Total session duration in ms */
  totalDuration: number;

  /** Average time per turn in ms */
  avgTurnDuration: number;

  /** Longest turn duration in ms */
  maxTurnDuration: number;

  /** Shortest turn duration in ms */
  minTurnDuration: number;

  /** Narrator response times */
  narratorMetrics: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    totalTokens: number;
    avgTokensPerResponse: number;
  };

  /** Player response times */
  playerMetrics: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    totalTokens: number;
    avgTokensPerPlayer: number;
  };

  /** Story pacing metrics */
  pacingMetrics: {
    totalPulses: number;
    avgTurnsBetweenPulses: number;
    pulsesPerMinute: number;
    targetPulses: number; // Usually 20
    completionRate: number; // pulses / targetPulses
  };

  /** Quality indicators */
  qualityMetrics: {
    tangentRate: number; // tangents / totalTurns
    privateMomentRate: number; // privateMoments / totalTurns
    payoffRate: number; // paidOffMoments / totalPrivateMoments
  };

  /** Cost efficiency */
  costMetrics: {
    totalCost: number;
    costPerTurn: number;
    costPerPulse: number;
  };
}

export interface TurnTiming {
  turn: number;
  narratorTime: number;
  playersTime: number;
  totalTime: number;
}

/**
 * Track turn timings throughout session
 */
export class PerformanceTracker {
  private turnTimings: TurnTiming[] = [];
  private currentTurnStart?: number;
  private currentNarratorStart?: number;

  startTurn(): void {
    this.currentTurnStart = Date.now();
  }

  startNarrator(): void {
    this.currentNarratorStart = Date.now();
  }

  endNarrator(): number {
    if (!this.currentNarratorStart) return 0;
    const duration = Date.now() - this.currentNarratorStart;
    this.currentNarratorStart = undefined;
    return duration;
  }

  endTurn(turn: number, narratorTime: number, playersTime: number): void {
    if (!this.currentTurnStart) return;

    this.turnTimings.push({
      turn,
      narratorTime,
      playersTime,
      totalTime: Date.now() - this.currentTurnStart,
    });

    this.currentTurnStart = undefined;
  }

  /**
   * Generate performance metrics from session data
   */
  generateMetrics(options: {
    totalDuration: number;
    totalTurns: number;
    totalPulses: number;
    tangentAnalysis: TangentAnalysis;
    privateMoments: number;
    paidOffMoments: number;
    costBreakdown: CostBreakdown;
  }): PerformanceMetrics {
    const { totalDuration, totalTurns, totalPulses, tangentAnalysis, privateMoments, paidOffMoments, costBreakdown } = options;

    const turnDurations = this.turnTimings.map((t) => t.totalTime);
    const narratorTimes = this.turnTimings.map((t) => t.narratorTime);
    const playerTimes = this.turnTimings.map((t) => t.playersTime);

    return {
      totalDuration,
      avgTurnDuration: turnDurations.length > 0 ? turnDurations.reduce((a, b) => a + b, 0) / turnDurations.length : 0,
      maxTurnDuration: Math.max(...turnDurations, 0),
      minTurnDuration: Math.min(...turnDurations.filter((t) => t > 0), Number.MAX_SAFE_INTEGER),

      narratorMetrics: {
        avgResponseTime: narratorTimes.length > 0 ? narratorTimes.reduce((a, b) => a + b, 0) / narratorTimes.length : 0,
        maxResponseTime: Math.max(...narratorTimes, 0),
        minResponseTime: Math.min(...narratorTimes.filter((t) => t > 0), Number.MAX_SAFE_INTEGER),
        totalTokens: costBreakdown.narrator.totalTokens,
        avgTokensPerResponse: totalTurns > 0 ? costBreakdown.narrator.totalTokens / totalTurns : 0,
      },

      playerMetrics: {
        avgResponseTime: playerTimes.length > 0 ? playerTimes.reduce((a, b) => a + b, 0) / playerTimes.length : 0,
        maxResponseTime: Math.max(...playerTimes, 0),
        minResponseTime: Math.min(...playerTimes.filter((t) => t > 0), Number.MAX_SAFE_INTEGER),
        totalTokens: costBreakdown.players.totalTokens,
        avgTokensPerPlayer: costBreakdown.players.totalTokens / costBreakdown.players.models.length,
      },

      pacingMetrics: {
        totalPulses,
        avgTurnsBetweenPulses: totalPulses > 0 ? totalTurns / totalPulses : 0,
        pulsesPerMinute: totalDuration > 0 ? (totalPulses / totalDuration) * 60000 : 0,
        targetPulses: 20,
        completionRate: totalPulses / 20,
      },

      qualityMetrics: {
        tangentRate: totalTurns > 0 ? tangentAnalysis.totalTangents / totalTurns : 0,
        privateMomentRate: totalTurns > 0 ? privateMoments / totalTurns : 0,
        payoffRate: privateMoments > 0 ? paidOffMoments / privateMoments : 0,
      },

      costMetrics: {
        totalCost: costBreakdown.total.cost,
        costPerTurn: totalTurns > 0 ? costBreakdown.total.cost / totalTurns : 0,
        costPerPulse: totalPulses > 0 ? costBreakdown.total.cost / totalPulses : 0,
      },
    };
  }

  /**
   * Get all turn timings
   */
  getTimings(): TurnTiming[] {
    return this.turnTimings;
  }
}
