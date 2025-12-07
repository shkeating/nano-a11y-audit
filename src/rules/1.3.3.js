// src/rules/1.3.3.js
export const id = "1.3.3";
export const earlId = "WCAG22:sensory-characteristics";
export const relevantElements = ["p", "li", "span", "div", "td", "th"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.3.3 Sensory Characteristics.
Task: Identify **instructions** that rely *solely* on sensory characteristics to be understood.

**DEFINITION OF AN INSTRUCTION**
An instruction must tell the user to **DO** something (Click, Use, Select, Look at, Press).
If the text is just a statement of fact, a label, or a title, IT IS NOT A VIOLATION.

**CRITERIA (Flag ONLY if an action is required)**
Flag text describing:
- Shape (round, square, triangle)
- Size (large, small, big, tiny)
- Color (green, red, blue, dark)
- Location (on the right, at the bottom, left, top)
- Sound (beep, chime, ring)

**STRICT NEGATIVE CONSTRAINTS (IGNORE THESE)**
1. **Test Suite Titles:** IGNORE page titles or test labels.
2. **Alt Text & Image Quality:** DO NOT flag images for having bad or missing alt text.
3. **Status Messages:** DO NOT flag status text like "Confirmed", "Cancelled", "Active", or "Inactive" unless it tells the user to DO something based on that status (e.g. "Click the Active item").

**OUTPUT FORMAT**
Return a JSON object with a "verdict" and a "reason".
- If a violation is found:
  {"verdict": "FAIL", "reason": "Instructions rely solely on sensory characteristics: [quote the failing text]"}
- If no violations are found:
  {"verdict": "PASS", "reason": "No sensory characteristic violations found."}
`;

export function extractor() {
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    if (el.tagName === "BODY" || el.tagName === "HTML") return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  // KEYWORD FILTER: Only check text that might actually be sensory.
  // This drastically reduces hallucinations.
  const SENSORY_KEYWORDS = [
    "left",
    "right",
    "top",
    "bottom",
    "above",
    "below",
    "corner",
    "side", // Location
    "green",
    "red",
    "blue",
    "yellow",
    "orange",
    "purple",
    "black",
    "white",
    "color", // Color
    "round",
    "square",
    "triangle",
    "circle",
    "shape", // Shape
    "large",
    "small",
    "big",
    "tiny", // Size
    "beep",
    "chime",
    "ring",
    "sound", // Sound
  ];

  const potentialInstructions = [];
  const elements = Array.from(
    document.querySelectorAll("p, li, span, div, td, th")
  );

  for (const el of elements) {
    if (!isVisible(el)) continue;

    // 1. Get direct text (ignoring children to avoid huge blocks)
    // We clone to remove children safely for text extraction
    const clone = el.cloneNode(true);
    Array.from(clone.children).forEach((c) => c.remove());
    const text = clone.innerText.trim().toLowerCase();

    if (!text || text.length < 5) continue;
    if (text.startsWith("<") || text.includes("{")) continue;

    // 2. CHECK KEYWORDS
    // If the text doesn't mention a sensory word, we don't even send it to the AI.
    const hasKeyword = SENSORY_KEYWORDS.some((kw) => text.includes(kw));

    if (hasKeyword) {
      // Send the full original text (case preserved) for context
      const originalText = el.innerText.trim();
      // Avoid duplicates
      if (
        !potentialInstructions.includes(originalText) &&
        originalText.length < 300
      ) {
        potentialInstructions.push(originalText);
      }
    }

    if (potentialInstructions.length >= 15) break;
  }

  if (potentialInstructions.length === 0) {
    return {
      computedVerdict: "PASS",
      reason:
        "No text containing sensory keywords (right, left, green, round, etc.) found.",
      pageTitle: document.title,
    };
  }

  return { potentialInstructions };
}
