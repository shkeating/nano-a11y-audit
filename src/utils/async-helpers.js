// src/utils/async-helpers.js

/**
 * Runs an array of promise-returning functions in batches.
 * This prevents locking up the browser thread when running 15+ checks.
 * * @param {Array<Function>} tasks - Array of functions that return a promise.
 * @param {number} batchSize - How many to run concurrently (default 5).
 * @returns {Promise<Array>} - Array of results (mapped from tasks).
 */
export async function runInBatches(tasks, batchSize = 5) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    // Catch errors inside the batch so one failure doesn't stop the whole group
    const batchResults = await Promise.all(
      batch.map((task) => task().catch((err) => ({ error: err })))
    );
    results.push(...batchResults);
  }
  return results;
}

/**
 * Smart polling helper.
 * useful if we need to wait for a condition (like AI readiness) without a hard sleep.
 */
export async function waitFor(conditionFn, timeout = 2000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Non-blocking sleep function.
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
