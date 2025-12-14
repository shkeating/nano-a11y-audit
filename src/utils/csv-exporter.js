/**
 * Converts the audit results into a normalized CSV format optimized for data analysis.
 * Features:
 * - Separates "Axe Core" vs "Gemini Nano" sources
 * - Extracts CSS selectors into their own column
 * - Normalizes verdicts (PASS/FAIL)
 *
 * @param {Array} results - The array of result objects from the audit
 */
export function generateCSV(results) {
  // 1. Define Research-Ready Headers
  const headers = [
    "URL",
    "Rule_ID",
    "Engine", // New: "Axe Core" or "Gemini Nano"
    "Verdict", // Normalized: PASS, FAIL, N/A
    "Confidence",
    "Element_Selector", // New: Extracted CSS selector (e.g., "img", ".nav")
    "Reason", // Cleaned text explanation
    "Latency_ms",
  ];

  // 2. Process Rows
  const rows = results.map((r) => {
    const url = r.url || "N/A";
    const ruleId = r.earlId || r.id || "Unknown";

    // --- A. Engine Detection ---
    // Nano rules use "WCAG22:..." IDs, Axe uses "image-alt" style.
    // Fallback: If 'engine' is manually set (e.g. for Axe results), use that.
    const engine =
      r.engine || (ruleId.startsWith("WCAG") ? "Gemini Nano" : "Axe Core");

    // --- B. Verdict Normalization ---
    // Map EARL URIs to simple analysis terms
    let verdict = (r.verdict || "UNKNOWN").toUpperCase();
    if (verdict.includes("PASSED")) verdict = "PASS";
    if (verdict.includes("FAILED")) verdict = "FAIL";
    if (verdict.includes("INAPPLICABLE") || verdict.includes("NOT PRESENT"))
      verdict = "N/A";
    if (verdict.includes("UNTESTED")) verdict = "UNTESTED";

    // --- C. Selector Extraction & Reason Cleaning ---
    let selector = "Page";
    let cleanReason = (r.reason || r.description || "").replace(
      /(\r\n|\n|\r)/gm,
      " "
    );

    // Strategy 1: If there's a specific pointer/selector field (Nano often has this)
    if (r.selector) {
      selector = r.selector;
    }
    // Strategy 2: Regex extraction from Axe descriptions
    // Pattern: Look for "- Element: [selector] (" or "- Element: [selector]" at end of string
    else if (cleanReason.includes("Element:")) {
      const match = cleanReason.match(/- Element: (.*?)(\(|$)/);
      if (match && match[1]) {
        selector = match[1].trim();
        // Optional: Remove the raw HTML snippet from the reason to make it readable
        // cleanReason = cleanReason.split("- Element:")[0].trim();
      }
    }

    // Sanitize for CSV (Escape double quotes)
    const safeReason = cleanReason.replace(/"/g, '""');
    const safeSelector = selector.replace(/"/g, '""');

    // Default Metrics
    const confidence = "HIGH";
    // FIX: Use actual latency if available
    const latency = r.latency !== undefined ? r.latency : "0";

    return [
      `"${url}"`,
      `"${ruleId}"`,
      `"${engine}"`,
      `"${verdict}"`,
      `"${confidence}"`,
      `"${safeSelector}"`,
      `"${safeReason}"`,
      `"${latency}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Triggers the browser download
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
