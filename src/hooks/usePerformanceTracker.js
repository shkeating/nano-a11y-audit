import { useState, useRef } from "preact/hooks";

export function usePerformanceTracker() {
  // UI State (for rendering)
  const [pageTimings, setPageTimings] = useState([]);

  // Logic State (for synchronous calculations)
  const pageTimingsRef = useRef([]);
  const startTimeRef = useRef(null);

  /**
   * Starts the timer for the current operation.
   */
  const startTimer = () => {
    startTimeRef.current = performance.now();
  };

  /**
   * Stops the timer, records the duration, and updates both Ref and State.
   */
  const stopTimer = (url) => {
    if (startTimeRef.current === null) return 0;

    const endTime = performance.now();
    const duration = Math.round(endTime - startTimeRef.current);

    // 1. Update Ref (Immediate Source of Truth)
    pageTimingsRef.current.push({ url, duration });

    // 2. Update State (Triggers UI Re-render)
    setPageTimings([...pageTimingsRef.current]);

    startTimeRef.current = null; // Reset
    return duration;
  };

  /**
   * Resets all recorded timings.
   */
  const resetTimings = () => {
    pageTimingsRef.current = []; // Clear Ref
    setPageTimings([]); // Clear State
    startTimeRef.current = null;
  };

  /**
   * Calculates the average duration using the REF (latest data).
   */
  const getAverageDuration = () => {
    const currentTimings = pageTimingsRef.current;
    if (currentTimings.length === 0) return 0;

    const total = currentTimings.reduce((acc, t) => acc + t.duration, 0);
    return Math.round(total / currentTimings.length);
  };

  return {
    pageTimings, // Return state for UI rendering
    startTimer,
    stopTimer,
    resetTimings,
    getAverageDuration,
  };
}
