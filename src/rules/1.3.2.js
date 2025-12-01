export const id = "1.3.2";
export const earlId = "WCAG22:meaningful-sequence";

export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 1.3.2 Meaningful Sequence violations.

**INSTRUCTIONS**
Review the input arrays.
1. **If input is empty:** Write NOTHING.
2. **If issues exist:**
   - Return a JSON object with "verdict": "FAIL".
   - In the "reason" field, write a **single short sentence** summarizing the CSS issues found.
   - **DO NOT** list every element. **DO NOT** use bullet points. Keep it under 30 words.

**REQUIRED FORMAT**
{"verdict": "FAIL", "reason": "CSS properties like flex-direction and order are altering the visual sequence of content."}

**FINAL OUTPUT**
- If NO items exist: {"verdict": "PASS", "reason": "No meaningful sequence violations found."}
- If items exist: {"verdict": "FAIL", "reason": "[Your short summary]"}
`;

export function extractor() {
  const orderingProperties = [];
  const elements = Array.from(document.querySelectorAll("*"));

  for (const el of elements) {
    if (el.offsetParent === null) continue;
    if (
      el.getAttribute("aria-hidden") === "true" ||
      el.getAttribute("role") === "presentation"
    )
      continue;

    let parent = el.parentElement;
    let isHiddenByParent = false;
    while (parent) {
      if (parent.getAttribute("aria-hidden") === "true") {
        isHiddenByParent = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (isHiddenByParent) continue;

    const style = window.getComputedStyle(el);
    const flexDirection = style.flexDirection;
    const cssOrder = style.order;
    const cssFloat = style.cssFloat;
    const position = style.position;

    let reason = "";

    if (cssOrder && cssOrder !== "0" && cssOrder !== "auto")
      reason += `order:${cssOrder} `;
    if (flexDirection === "row-reverse" || flexDirection === "column-reverse")
      reason += `flex-dir:${flexDirection} `;
    if (cssFloat && cssFloat !== "none") reason += `float:${cssFloat} `;

    if (position === "absolute" || position === "fixed") {
      const hasText = el.innerText.trim().length > 0;
      const isTiny = el.offsetWidth < 20 || el.offsetHeight < 20;
      if (hasText && !isTiny) reason += `pos:${position} `;
    }

    if (reason) {
      orderingProperties.push({
        text: el.tagName.toLowerCase(), // Sending Tag Name instead of full text to save tokens
        css: reason.trim(),
      });
    }
  }

  const layoutTables = Array.from(document.querySelectorAll("table"))
    .filter(
      (table) =>
        table.getAttribute("role") === "presentation" ||
        (!table.querySelector("th") && !table.querySelector("caption"))
    )
    .map((table) => ({ html: "Table layout" }));

  // --- OPTIMIZED SMART RETURN ---
  // We limit the input heavily to prevent the LLM from running out of tokens.
  const result = {};
  if (orderingProperties.length > 0)
    result.orderingProperties = orderingProperties.slice(0, 3);
  if (layoutTables.length > 0) result.layoutTables = layoutTables.slice(0, 1);

  return result;
}
