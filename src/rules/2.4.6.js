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

// In src/rules/2.4.6.js

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 2.4.6 Headings and Labels.
Task: Evaluate if a Form Label is descriptive enough.

**CRITERIA**
1. **PASS (Common Patterns):** - Standard form labels like "Name", "Email", "License", "Username", "Password", "Subject", "Passport Number", "Address", "City", "Zip", "Phone" are **PASS** if they appear in a standard form context, even without a specific heading.
2. **PASS (Descriptive):** The label is specific (e.g., "Date of Birth").
3. **FAIL (Ambiguous):** - The label is extremely vague (e.g., "Field 1", "Value", "Input", "Yes", "No") AND lacks context.
   - Duplicate generic labels under the SAME heading (e.g. two "Name" fields under "Personal Info").

**OUTPUT FORMAT**
Return a **SINGLE** JSON object.
- If violations found: {"verdict": "FAIL", "reason": "Ambiguous labels found:\\n- [Label]"}
- If all pass: {"verdict": "PASS", "reason": "Labels are descriptive."}
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
  const nodes = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, label, legend"
  );

  let currentHeading = "No Heading Found";

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
      const lower = text.toLowerCase();
      // Optimization: Only check "Risky" labels
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
    items: items.slice(0, 30),
  };
}
