export const id = "1.3.2";
export const earlId = "WCAG22:meaningful-sequence";

export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 1.3.2 Meaningful Sequence violations.

**INSTRUCTIONS**
Review the input arrays.
1. **If an array is empty:** Write NOTHING.
2. **If an array has items:**
   - Write a summary sentence explaining the CSS issue.
   - Create a Markdown list using dashes (-).
   - **CRITICAL:** Start every list item on a new line using "\\n".

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

    // Skip if parent hides it
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

    // Absolute check with noise filter
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

  return {
    orderingProperties: orderingProperties.slice(0, 5),
    layoutTables: layoutTables.slice(0, 3),
    elementsWithBadWhitespace: elementsWithBadWhitespace.slice(0, 5),
  };
}
