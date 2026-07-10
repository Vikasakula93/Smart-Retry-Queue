const DEFAULT_BACKOFF_DELAYS_MS = [10_000, 30_000, 120_000, 600_000, 1_800_000];
const configuredDelays = process.env.BACKOFF_DELAYS_MS?.split(',').map(Number);
const BACKOFF_DELAYS_MS = configuredDelays?.length === 5 && configuredDelays.every((delay) => Number.isFinite(delay) && delay >= 0)
  ? configuredDelays : DEFAULT_BACKOFF_DELAYS_MS;
const MAX_ATTEMPTS = 5;

function nextAttemptAtAfterFailure(failedAttemptCount, now = new Date()) {
  return new Date(now.getTime() + BACKOFF_DELAYS_MS[failedAttemptCount - 1]).toISOString();
}
module.exports = { BACKOFF_DELAYS_MS, MAX_ATTEMPTS, nextAttemptAtAfterFailure };
