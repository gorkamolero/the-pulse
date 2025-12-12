/**
 * Error Handling
 *
 * Robust error handling with retry logic and graceful degradation.
 */

export class TestHarnessError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable = false,
  ) {
    super(message);
    this.name = 'TestHarnessError';
  }
}

export class NarratorError extends TestHarnessError {
  constructor(message: string, retryable = true) {
    super(message, 'NARRATOR_ERROR', retryable);
    this.name = 'NarratorError';
  }
}

export class PlayerAgentError extends TestHarnessError {
  constructor(message: string, retryable = true) {
    super(message, 'PLAYER_AGENT_ERROR', retryable);
    this.name = 'PlayerAgentError';
  }
}

export class CheckpointError extends TestHarnessError {
  constructor(message: string) {
    super(message, 'CHECKPOINT_ERROR', false);
    this.name = 'CheckpointError';
  }
}

/**
 * Retry with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      console.warn(`Error: ${lastError.message}`);

      await sleep(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe API call with error handling
 */
export async function safeAPICall<T>(
  fn: () => Promise<T>,
  fallback?: T,
): Promise<T | undefined> {
  try {
    return await retry(fn);
  } catch (error) {
    console.error('API call failed after retries:', error);
    return fallback;
  }
}

/**
 * Wrap async function with error boundary
 */
export function withErrorBoundary<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  errorHandler?: (error: Error) => R | Promise<R>,
) {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in ${fn.name}:`, error);

      if (errorHandler) {
        return await errorHandler(error as Error);
      }

      return undefined;
    }
  };
}

/**
 * Rate limit helper
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(
    private maxConcurrent = 5,
    private delayMs = 100,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);
      await Promise.all(batch.map((fn) => fn()));
      await sleep(this.delayMs);
    }

    this.processing = false;
  }
}
