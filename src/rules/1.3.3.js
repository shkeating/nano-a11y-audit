export const id = "1.3.3";
export const earlId = "WCAG22:sensory-characteristics";

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.3.3 Sensory Characteristics.
Task: Identify instructions that rely *solely* on sensory characteristics to be understood.

**CRITERIA**
Flag text describing:
- Shape (round, square, triangle)
- Size (large, small, big, tiny)
- Color (green, red, blue, dark)
- Location (on the right, at the bottom, left, top)
- Sound (beep, chime, ring)

**EXAMPLES**
- Violation: "Click the green button to continue." (Relies solely on color).
- Violation: "Use the round icon to settings." (Relies solely on shape).
- Violation: "Instructions are in the right column." (Relies solely on location).
- Pass: "Click the green 'Start' button." (Passes because it includes the label 'Start').
- Pass: "Press the Delete key (red button)." (Passes because it identifies the key).

**OUTPUT FORMAT**
Return a JSON object with a "verdict" and a "reason".
- If a violation is found:
  {"verdict": "FAIL", "reason": "Instructions rely solely on sensory characteristics: [quote the failing text]"}
- If no violations are found:
  {"verdict": "PASS", "reason": "No sensory characteristic violations found."}
`;

export function extractor() {
  const potentialInstructions = [];
  // Select elements likely to contain instructions
  const elements = Array.from(document.querySelectorAll("p, li, span, div, td, th"));

  for (const el of elements) {
    // Basic visibility check
    if (el.offsetParent === null) continue;

    // Get direct text content or text content if it's a small leaf node
    const text = el.innerText.trim();

    // Filter: Ignore empty text, script tags (handled by querySelector), and very short strings
    if (!text || text.length < 10) continue;

    // Heuristic: Instructions often contain imperative verbs or directional words,
    // but for this rule, we want to capture general text that might contain sensory refs.
    // We rely on the AI to filter, so we just send candidates.
    // To avoid duplication, check if we already have this text (simple check)
    if (potentialInstructions.includes(text)) continue;

    potentialInstructions.push(text);

    // Limit to keep context window small
    if (potentialInstructions.length >= 20) break;
  }

  return { potentialInstructions };
}
