export const id = "2.4.6";
export const earlId = "WCAG22:headings-and-labels";
export const relevantElements = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "legend",
];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 2.4.6 Headings and Labels.
Task: Evaluate if a Form Label is descriptive enough, considering its Section Heading context.

**CRITERIA**
1. **FAIL (Ambiguous):** The label is generic (e.g., "Name", "Date", "Yes", "No") AND the Section Heading is missing, generic (e.g. "Section 1", "Untitled", "Page 2"), or unrelated.
2. **PASS (Descriptive):** The label itself is specific (e.g., "Date of Birth", "Credit Card Number").
3. **PASS (Contextual):** The label is generic, BUT the Section Heading provides the necessary context (e.g., Heading: "Spouse", Label: "Name").

**INPUT FORMAT**
"Heading: [text] | Label: [text]"

**OUTPUT FORMAT**
Return a JSON object:
- If violation: {"verdict": "FAIL", "reason": "Label '[label]' is ambiguous under heading '[heading]'."}
- If pass: {"verdict": "PASS", "reason": "Label is descriptive in context."}

**FEW-SHOT EXAMPLES**
User: "Heading: Untitled Section | Label: Name"
Model: {"verdict": "FAIL", "reason": "Label 'Name' is ambiguous under heading 'Untitled Section'."}

User: "Heading: Spouse Information | Label: Name"
Model: {"verdict": "PASS", "reason": "Label is descriptive in context."}
`;

export function extractor() {
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  const items = [];
  // Get document order of relevant nodes to determine context
  const nodes = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, label, legend"
  );

  let currentHeading = "No Heading Found";

  // Heuristic: Labels that are risky without context
  const GENERIC_LABELS = [
    "name",
    "date",
    "email",
    "address",
    "phone",
    "yes",
    "no",
    "other",
    "input",
    "field",
    "value",
    "quantity",
    "search",
    "title",
    "details",
  ];

  for (const el of nodes) {
    if (!isVisible(el)) continue;

    const text = el.innerText.replace(/[:\-\.]/g, "").trim();
    if (!text) continue;

    if (el.tagName.startsWith("H")) {
      currentHeading = text;
    } else {
      // It's a label or legend
      const lower = text.toLowerCase();

      // Optimization: Only check "Risky" labels to save AI tokens
      // We check if it's in the list OR very short (less than 3 words)
      const isGeneric =
        GENERIC_LABELS.includes(lower) || text.split(" ").length < 3;

      if (isGeneric) {
        items.push(`Heading: "${currentHeading}" | Label: "${text}"`);
      }
    }
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No ambiguous labels found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    items: items.slice(0, 30), // Limit payload
  };
}
