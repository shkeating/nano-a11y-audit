import { isVisible } from "../utils/dom.js";

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
1. **Test Suite Titles:** IGNORE page titles or test labels like:
   - "Link only identifiable by colour alone"
   - "Image with partial text alternative"
   - "Content identified by location"
   These are labels for the test case, not instructions to the user.

2. **Alt Text & Image Quality:** DO NOT flag images for having bad or missing alt text. That is WCAG 1.1.1.
   - Bad: "The text alternative is insufficient..." -> IGNORE.
   - Good: "Instructions rely on 'green icon'..." -> REPORT.

3. **Link Design:** DO NOT flag links for being color-only. That is WCAG 1.4.1.

**EXAMPLES**
- Violation: "Click the **green** button." (Action + Color = Fail)
- Violation: "See the sidebar on the **left**." (Action + Location = Fail)
- Pass: "Link only identifiable by colour alone." (No action verb = Pass)
- Pass: "Image with partial text alternative." (No action verb = Pass)
- Pass: "Red button." (Label only = Pass)
- Pass: "Click the 'Submit' button (green)." (Has text label 'Submit' = Pass)

**OUTPUT FORMAT**
Return a JSON object with a "verdict" and a "reason".
- If a violation is found:
  {"verdict": "FAIL", "reason": "Instructions rely solely on sensory characteristics: [quote the failing text]"}
- If no violations are found:
  {"verdict": "PASS", "reason": "No sensory characteristic violations found."}
`;

export function extractor() {
  const potentialInstructions = [];
  const elements = Array.from(
    document.querySelectorAll("p, li, span, div, td, th")
  );

  for (const el of elements) {
    if (!isVisible(el)) continue;

    const text = el.innerText.trim();

    if (!text || text.length < 10) continue;
    if (text.startsWith("<") || text.includes("{")) continue;

    if (potentialInstructions.includes(text)) continue;

    potentialInstructions.push(text);

    if (potentialInstructions.length >= 20) break;
  }

  return { potentialInstructions };
}
