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
