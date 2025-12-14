import { useState, useRef } from "preact/hooks";

export function usePerformanceTracker() {
  const [pageTimings, setPageTimings] = useState([]);
  const startTimeRef = useRef(null);

  /**
   * Starts the timer for the current operation.
   */
  const startTimer = () => {
    startTimeRef.current = performance.now();
  };

  /**
   * Stops the timer, records the duration for the given URL, and returns the duration.
   * @param {string} url - The URL processed.
   * @returns {number} The duration in milliseconds.
   */
  const stopTimer = (url) => {
    if (startTimeRef.current === null) return 0;

    const endTime = performance.now();
    const duration = Math.round(endTime - startTimeRef.current);

    setPageTimings((prev) => [...prev, { url, duration }]);
    startTimeRef.current = null; // Reset

    return duration;
  };

  /**
   * Resets all recorded timings (e.g., for a new audit run).
   */
  const resetTimings = () => {
    setPageTimings([]);
    startTimeRef.current = null;
  };

  /**
   * Calculates the average duration of all recorded pages.
   */
  const getAverageDuration = () => {
    if (pageTimings.length === 0) return 0;
    const total = pageTimings.reduce((acc, t) => acc + t.duration, 0);
    return Math.round(total / pageTimings.length);
  };

  return {
    pageTimings,
    startTimer,
    stopTimer,
    resetTimings,
    getAverageDuration,
  };
}
