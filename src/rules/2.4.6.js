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

// We use "Few-Shot Prompting" here.
// By providing a concrete Q&A example, we force the model to mimic the logic
// rather than interpreting abstract rules about "vagueness".
export const systemPrompt = `
You are a WCAG accessibility classifier.
Task: Identify text that is VAGUE or PLACEHOLDER content.

**CLASSIFICATION GUIDE**
1. **FAIL (Vague):** "Section 1", "Untitled", "Page 2", "Input", "Field", "Data", "Value", "Text", "..."
2. **PASS (Descriptive):** "Refund Policy", "Contact Us", "Email Address", "Zip Code", "Search Results", "User Profile".
   - IF THE TEXT DESCRIBES A SPECIFIC TOPIC, IT PASSES.

**INSTRUCTIONS**
- Review the user's list of text items.
- Return a JSON object with a "verdict" and "reason".
- **ONLY** list the items that FAIL.
- If an item is PASS, do not mention it.

**FEW-SHOT EXAMPLES**

User:
- "Chapter 1"
- "Login"
- "Untitled"
- "Submit"

Model:
{"verdict": "FAIL", "reason": "Meaningless/Placeholder text found:\\n- Chapter 1\\n- Untitled"}

User:
- "Financial Report"
- "Name"
- "Search"

Model:
{"verdict": "PASS", "reason": "Headings and labels are descriptive."}

*** USER SAFE LIST (These always PASS) ***
(The user's safe terms will be injected here by the runner)
`;

export function extractor(selectors = [], options = {}) {
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

  function cleanText(str) {
    return str.replace(/[:\-\.]/g, "").trim();
  }

  function getNextContentSnippet(el) {
    let sibling = el.nextElementSibling;
    let attempts = 0;
    while (sibling && attempts < 3) {
      if (sibling.innerText && sibling.innerText.trim().length > 0) {
        return sibling.innerText.trim().substring(0, 100) + "...";
      }
      sibling = sibling.nextElementSibling;
      attempts++;
    }
    return "No immediate text content found.";
  }

  const items = [];

  const candidates = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, label, legend"
  );
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const raw = el.innerText.trim();
    if (raw.length === 0) continue;

    // Hard filter for technical test artifacts to save tokens
    const lower = raw.toLowerCase();
    if (
      lower.includes("sc ") ||
      lower.includes("wcag") ||
      lower.includes("test")
    )
      continue;

    items.push(cleanText(raw));
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No headings or labels found to evaluate.",
      pageTitle: document.title,
    };
  }

  // We send a simple array of strings now to match the Few-Shot format
  // Limit to 40 items to keep context window manageable
  return {
    pageTitle: document.title,
    items: items.slice(0, 40),
  };
}
