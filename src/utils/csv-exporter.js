/**
 * Converts the audit results into a normalized CSV format.
 * Features:
 * - Separates "Axe Core" vs "Gemini Nano" sources
 * - Extracts CSS selectors into their own column
 * - Prepends [TestID] and [Engine] to the description
 */
export function generateCSV(results) {
  // 1. Define Research-Ready Headers
  const headers = [
    "URL",
    "Rule_ID",
    "Test_Case_ID", // Optional separate column if needed
    "Engine",
    "Verdict",
    "Confidence",
    "Element_Selector",
    "Reason", // This will now contain the formatted string
    "Latency_ms",
  ];

  // 2. Process Rows
  const rows = results.map((r) => {
    const url = r.url || "N/A";
    const ruleId = r.earlId || r.id || "Unknown";

    // --- Engine Detection ---
    const engineName =
      r.engine || (ruleId.startsWith("WCAG") ? "Gemini Nano" : "Axe Core");
    const engineTag = engineName.includes("Axe") ? "[Axe]" : "[Nano]";

    // --- Verdict Normalization ---
    let verdict = (r.verdict || "UNKNOWN").toUpperCase();
    if (verdict.includes("PASSED")) verdict = "PASS";
    if (verdict.includes("FAILED")) verdict = "FAIL";
    if (verdict.includes("INAPPLICABLE") || verdict.includes("NOT PRESENT"))
      verdict = "N/A";
    if (verdict.includes("UNTESTED")) verdict = "UNTESTED";

    // --- Selector & Reason Cleaning ---
    let selector = "Page";
    let cleanReason = (r.reason || r.description || "").replace(
      /(\r\n|\n|\r)/gm,
      " "
    );

    if (r.selector) {
      selector = r.selector;
    } else if (cleanReason.includes("Element:")) {
      const match = cleanReason.match(/- Element: (.*?)(\(|$)/);
      if (match && match[1]) {
        selector = match[1].trim();
      }
    }

    // --- ID Capture & Formatting ---
    let testCaseId = r.testCaseId || "";

    // If not found in object, check if Nano embedded it in the reason string
    if (!testCaseId && cleanReason.includes("[TestCase:")) {
      const idMatch = cleanReason.match(/\[TestCase:(.*?)\]/);
      if (idMatch && idMatch[1]) {
        testCaseId = idMatch[1].trim();
        // Optional: Remove the tag from the reason text to avoid duplication
        cleanReason = cleanReason.replace(idMatch[0], "").trim();
      }
    }

    // Fallback: If no ID found, use selector or "Page"
    const displayId = testCaseId ? `[${testCaseId}]` : `[${selector}]`;

    // Construct the requested format: [TestID] [Engine] Reason
    const formattedReason = `${displayId} ${engineTag} ${cleanReason}`;

    // Sanitize for CSV
    const safeReason = formattedReason.replace(/"/g, '""');
    const safeSelector = selector.replace(/"/g, '""');
    const confidence = "HIGH";
    const latency = r.latency !== undefined ? r.latency : "0";

    return [
      `"${url}"`,
      `"${ruleId}"`,
      `"${testCaseId || "N/A"}"`, // Keep raw ID in separate column too
      `"${engineName}"`,
      `"${verdict}"`,
      `"${confidence}"`,
      `"${safeSelector}"`,
      `"${safeReason}"`,
      `"${latency}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

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
