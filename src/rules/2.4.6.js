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
Task: Evaluate if headings and labels describe the topic or purpose of the content.

**CRITERIA**
1. **Headings:** Must describe the content that follows them.
   - FAIL: Generic text (e.g., "Section 1", "Untitled", "Details").
   - FAIL: Mismatched text (e.g., Heading says "Contact" but content is about "Pricing").
2. **Labels:** Must clearly identify the purpose of the form control.
   - FAIL: Vague text (e.g., "Input", "Data", "Field 1").

**INSTRUCTIONS**
Review the 'items' list.
- **PASS:** If the item clearly describes its context.
- **FAIL:** If the item is vague, generic, or misleading.
- **Format:** List failures as bullet points: "- [Type] '[Text]': [Reason]"

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Non-descriptive headings or labels found:\\n- [Item 1]..."}
- If no violations: {"verdict": "PASS", "reason": "All headings and labels appear descriptive."}
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

  // 1. HEADINGS
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const h of headings) {
    if (!isVisible(h)) continue;
    const text = h.innerText.trim();
    if (text.length === 0) continue; // Axe handles empty headings

    items.push({
      type: "Heading",
      text: text,
      context: getNextContentSnippet(h),
    });
  }

  // 2. LABELS
  const labels = document.querySelectorAll("label, legend");
  for (const l of labels) {
    if (!isVisible(l)) continue;
    const text = l.innerText.trim();
    if (text.length === 0) continue; // Axe handles empty labels

    // Find associated input for context (optional, but good for debugging)
    let inputType = "unknown";
    if (l.tagName === "LABEL" && l.htmlFor) {
      const input = document.getElementById(l.htmlFor);
      if (input) inputType = input.type || input.tagName;
    }

    items.push({
      type: "Label",
      text: text,
      context: `Input Type: ${inputType}`,
    });
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No headings or labels found to evaluate.",
      pageTitle: document.title,
    };
  }

  // Limit to avoid token overflow, prioritizing likely issues or top items
  return {
    pageTitle: document.title,
    items: items.slice(0, 15),
  };
}
