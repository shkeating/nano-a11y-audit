export const id = "1.3.2";
export const earlId = "WCAG22:meaningful-sequence";

export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 1.3.2 Meaningful Sequence violations.

**INSTRUCTIONS**
Review the input arrays.
1. **If an array is empty or missing:** Write NOTHING.
2. **If an array has items:**
   - Write a summary sentence explaining the CSS issue.
   - List ONLY the first 2 examples found. Do not list everything.
   - Use a bulleted format with a new line ("\\n") for each item.

**REQUIRED FORMAT EXAMPLE**
"CSS properties alter visual order:\\n- Login Button (reordered)\\n- Submit Button (floated)"

**FINAL OUTPUT**
- If NO items exist: {"verdict": "PASS", "reason": "No meaningful sequence violations found."}
- If items exist: {"verdict": "FAIL", "reason": "[Your summary here]"}
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
      reason += `CSS order (${cssOrder}); `;
    if (flexDirection === "row-reverse" || flexDirection === "column-reverse")
      reason += `flex-direction: ${flexDirection}; `;
    if (cssFloat && cssFloat !== "none") reason += `float: ${cssFloat}; `;

    if (position === "absolute" || position === "fixed") {
      const hasText = el.innerText.trim().length > 0;
      const isTiny = el.offsetWidth < 20 || el.offsetHeight < 20;
      if (hasText && !isTiny) reason += `position: ${position}; `;
    }

    if (reason) {
      orderingProperties.push({
        text: el.textContent.trim().substring(0, 50),
        reason: reason.trim(),
      });
    }
  }

  const layoutTables = Array.from(document.querySelectorAll("table"))
    .filter(
      (table) =>
        table.getAttribute("role") === "presentation" ||
        (!table.querySelector("th") && !table.querySelector("caption"))
    )
    .map((table) => ({ html: "Table used for layout" }));

  const elementsWithBadWhitespace = [];
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );
  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    const text = currentNode.nodeValue;
    if (text && (text.match(/\w\s{2,}\w/g) || text.match(/&nbsp;.*&nbsp;/g))) {
      const parent = currentNode.parentElement;
      if (parent && parent.offsetParent !== null) {
        elementsWithBadWhitespace.push({
          text: parent.textContent.trim().substring(0, 50),
        });
      }
    }
  }

  // --- RESTORED SMART RETURN ---
  // Only return keys if they have items.
  const result = {};
  if (orderingProperties.length > 0)
    result.orderingProperties = orderingProperties.slice(0, 5);
  if (layoutTables.length > 0) result.layoutTables = layoutTables.slice(0, 3);
  if (elementsWithBadWhitespace.length > 0)
    result.elementsWithBadWhitespace = elementsWithBadWhitespace.slice(0, 5);

  return result;
}
