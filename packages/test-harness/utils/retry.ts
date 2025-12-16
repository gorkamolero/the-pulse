/**
 * Retry Utility
 *
 * Provides retry logic with exponential backoff for AI operations.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt, baseDelayMs, maxDelayMs);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Retry with fallback - returns fallback value if all retries fail
 */
export async function withRetryOrFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  options: RetryOptions = {},
): Promise<{ result: T; usedFallback: boolean }> {
  try {
    const result = await withRetry(fn, options);
    return { result, usedFallback: false };
  } catch (error) {
    console.warn(
      `All retries failed, using fallback:`,
      error instanceof Error ? error.message : error,
    );
    return { result: fallback, usedFallback: true };
  }
}

/**
 * Base delay for model fallback attempts
 */
export const FALLBACK_BASE_DELAY_MS = 2000;

/**
 * Max delay for model fallback attempts
 */
export const FALLBACK_MAX_DELAY_MS = 30000;

/**
 * Max retries per model before falling back to next model
 */
export const MAX_RETRIES_PER_MODEL = 3;

/**
 * Get exponential backoff delay for fallback attempts
 * attempt 0: 2s, attempt 1: 4s, attempt 2: 8s, etc. (with jitter)
 */
export function getFallbackDelay(attempt: number): number {
  return getBackoffDelay(attempt, FALLBACK_BASE_DELAY_MS, FALLBACK_MAX_DELAY_MS);
}

export interface ModelFallbackOptions {
  /** Function to get next fallback model given already-tried models */
  getNextModel: (triedModels: string[]) => string | null;
  /** Label for logging (e.g., "Narrator", "Garrett") */
  label: string;
  /** Max retries per model before switching (default: 3) */
  retriesPerModel?: number;
}

/**
 * Execute a function with model fallback and per-model retries.
 *
 * Pattern:
 * 1. Try current model up to N times with exponential backoff
 * 2. If all retries fail, switch to next fallback model and reset backoff
 * 3. Repeat until success or all models exhausted
 */
export async function withModelFallback<T>(
  initialModelId: string,
  fn: (modelId: string) => Promise<T>,
  options: ModelFallbackOptions,
): Promise<{ result: T; modelUsed: string }> {
  const { getNextModel, label, retriesPerModel = MAX_RETRIES_PER_MODEL } = options;
  const triedModels: string[] = [];
  let currentModelId = initialModelId;

  while (true) {
    // Try current model up to retriesPerModel times
    for (let attempt = 1; attempt <= retriesPerModel; attempt++) {
      // Add delay before retry (not on first attempt of each model)
      if (attempt > 1) {
        const delay = getFallbackDelay(attempt - 2);
        console.log(`   ↻ Retrying ${label} in ${(delay / 1000).toFixed(1)}s (attempt ${attempt}/${retriesPerModel})...`);
        await sleep(delay);
      }

      try {
        const result = await fn(currentModelId);
        return { result, modelUsed: currentModelId };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`   ⚠ ${label} failed (${currentModelId}, attempt ${attempt}/${retriesPerModel}): ${errorMsg.slice(0, 80)}`);

        // If this was the last attempt for this model, we'll fall through to try next model
      }
    }

    // All retries exhausted for this model, try next fallback
    triedModels.push(currentModelId);
    const nextModel = getNextModel(triedModels);

    if (nextModel) {
      console.log(`   → Switching to fallback model: ${nextModel}`);
      currentModelId = nextModel;
      // Continue loop with new model (backoff resets)
    } else {
      // No more fallback models available
      console.error(`   ✗ All models failed for ${label}`);
      throw new Error(`All models failed for ${label}`);
    }
  }
}

/**
 * Sleep utility (exported for fallback delays)
 */
export { sleep };
