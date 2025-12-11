/**
 * Cost Tracking
 *
 * Track actual token usage and calculate costs from API responses.
 */

import type { LanguageModelUsage } from 'ai';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  narrator: {
    tokens: TokenUsage;
    cost: number;
  };
  players: {
    tokens: TokenUsage;
    cost: number;
  };
  classification: {
    tokens: TokenUsage;
    cost: number;
  };
  total: {
    tokens: TokenUsage;
    cost: number;
  };
}

/**
 * Model pricing per 1M tokens (input / output)
 * All models accessed through OpenRouter
 */
const MODEL_PRICING = {
  // Narrator models
  'anthropic/claude-opus-4.5': { input: 15.0, output: 75.0 },

  // Player models
  'qwen/qwen-2.5-72b-instruct': { input: 0.35, output: 0.4 },
  'moonshotai/kimi-k2': { input: 0.08, output: 0.08 },

  // Shared models (can be used as narrator or player)
  'x-ai/grok-4.1-fast': { input: 2.0, output: 10.0 },
  'deepseek/deepseek-v3.2': { input: 0.27, output: 1.1 },

  // Character generation
  'x-ai/grok-4': { input: 5.0, output: 15.0 },

  // Classification, validation, and feedback collection
  'google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
};

export class CostTracker {
  private narratorUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private playerUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private classificationUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(
    private narratorModel: string,
    private playerModels: string[],
  ) {}

  /**
   * Record narrator usage from AI SDK response
   */
  recordNarratorUsage(usage: LanguageModelUsage): void {
    // AI SDK v5 uses inputTokens/outputTokens instead of promptTokens/completionTokens
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    this.narratorUsage.promptTokens += inputTokens;
    this.narratorUsage.completionTokens += outputTokens;
    this.narratorUsage.totalTokens += usage.totalTokens ?? (inputTokens + outputTokens);
  }

  /**
   * Record player agent usage
   */
  recordPlayerUsage(usage: LanguageModelUsage): void {
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    this.playerUsage.promptTokens += inputTokens;
    this.playerUsage.completionTokens += outputTokens;
    this.playerUsage.totalTokens += usage.totalTokens ?? (inputTokens + outputTokens);
  }

  /**
   * Record classification usage
   */
  recordClassificationUsage(usage: LanguageModelUsage): void {
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    this.classificationUsage.promptTokens += inputTokens;
    this.classificationUsage.completionTokens += outputTokens;
    this.classificationUsage.totalTokens += usage.totalTokens ?? (inputTokens + outputTokens);
  }

  /**
   * Calculate cost for a model
   */
  private calculateCost(usage: TokenUsage, modelId: string): number {
    const pricing = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING];

    if (!pricing) {
      console.warn(`No pricing found for model ${modelId}, using estimate`);
      return (usage.totalTokens / 1_000_000) * 1.0; // $1 per 1M tokens estimate
    }

    const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get complete cost breakdown
   */
  getBreakdown(): CostBreakdown {
    const narratorCost = this.calculateCost(this.narratorUsage, this.narratorModel);
    const playerCost = this.calculateAveragePlayerCost();
    const classificationCost = this.calculateCost(
      this.classificationUsage,
      'google/gemini-2.5-flash',
    );

    const totalUsage: TokenUsage = {
      promptTokens:
        this.narratorUsage.promptTokens +
        this.playerUsage.promptTokens +
        this.classificationUsage.promptTokens,
      completionTokens:
        this.narratorUsage.completionTokens +
        this.playerUsage.completionTokens +
        this.classificationUsage.completionTokens,
      totalTokens:
        this.narratorUsage.totalTokens +
        this.playerUsage.totalTokens +
        this.classificationUsage.totalTokens,
    };

    return {
      narrator: {
        tokens: this.narratorUsage,
        cost: narratorCost,
      },
      players: {
        tokens: this.playerUsage,
        cost: playerCost,
      },
      classification: {
        tokens: this.classificationUsage,
        cost: classificationCost,
      },
      total: {
        tokens: totalUsage,
        cost: narratorCost + playerCost + classificationCost,
      },
    };
  }

  /**
   * Calculate average cost across player models
   */
  private calculateAveragePlayerCost(): number {
    if (this.playerModels.length === 0) return 0;

    // Distribute usage across player models
    const usagePerModel = {
      promptTokens: this.playerUsage.promptTokens / this.playerModels.length,
      completionTokens: this.playerUsage.completionTokens / this.playerModels.length,
      totalTokens: this.playerUsage.totalTokens / this.playerModels.length,
    };

    let totalCost = 0;
    for (const model of this.playerModels) {
      totalCost += this.calculateCost(usagePerModel, model);
    }

    return totalCost;
  }
}
