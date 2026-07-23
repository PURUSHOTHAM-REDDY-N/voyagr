/**
 * Simple bounded retry with exponential backoff, run synchronously in-process.
 *
 * convex/retrier.ts retried Convex actions out-of-band via the scheduler for
 * up to ~16 attempts (spanning minutes). There's no scheduler/job-queue
 * equivalent here, so this retries inline within the request instead - a
 * handful of quick attempts to smooth over transient failures (network
 * blips, momentary 5xxs from the LLM/image APIs), not a long-running job
 * system. If you deploy this behind a hard request timeout, keep
 * maxAttempts/backoff small enough to fit inside it.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 }: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * 2 ** attempt;
        console.log(`attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
