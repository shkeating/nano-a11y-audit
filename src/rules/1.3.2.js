export const id = "1.3.2";
export const earlId = "WCAG22:meaningful-sequence";

// 1 PROMPT
export const systemPrompt = `
You are a precise accessibility auditor.
Task: Analyze the JSON for WCAG 1.3.2 Meaningful Sequence violations.

**Output Style Rules**
- Keep explanations extremely brief (1-2 sentences).
- If you find multiple examples, list them as bullet points using a newline character (\\n) before each bullet.

**Rule 1: CSS Reordering**
- Check 'orderingProperties'. These are elements using properties like 'order', 'float', 'flex-reverse', or 'absolute position'.
- If found, write: "CSS properties are used to alter the visual order of content, which may differ from the code order."
- Then list the text of the elements and the specific CSS reason found.

**Rule 2: Layout Tables**
- Check 'layoutTables'.
- If found, write: "HTML tables are being used for visual layout purposes instead of tabular data."

**Rule 3: Whitespace Misuse**
- Check 'elementsWithBadWhitespace'.
- If found, write: "Words are being spaced out with characters or excessive whitespace (e.g., 'W e l c o m e'), which disrupts screen reader pronunciation."
- List the affected text snippets.

**Final Output**
- If all arrays are empty, verdict is "PASS".
- If any array has items, verdict is "FAIL".
- Join all findings into the 'reason' field.
- Return ONLY valid JSON: {"verdict": "PASS"|"FAIL", "reason": "..."}
`;

// 2. EXTRACTOR

export function extractor() {
  const orderingProperties = [];
  const elements = Array.from(document.querySelectorAll("*"));

  for (const el of elements) {
    if (el.offsetParent === null) continue;

    // SKIP: Elements hidden from screen readers
    if (
      el.getAttribute("aria-hidden") === "true" ||
      el.getAttribute("role") === "presentation" ||
      el.getAttribute("role") === "none"
    ) {
      continue;
    }

    // SKIP: Check if parent hides it
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

    // 1. Check Flex/Grid Order
    if (cssOrder && cssOrder !== "0" && cssOrder !== "auto") {
      reason += `CSS order property used (${cssOrder}); `;
    }

    // 2. Check Flex Direction
    if (flexDirection === "row-reverse" || flexDirection === "column-reverse") {
      reason += `flex-direction: ${flexDirection}; `;
    }

    // 3. Check Floats
    if (cssFloat && cssFloat !== "none") {
      reason += `float: ${cssFloat}; `;
    }

    // 4. Check Absolute/Fixed Positioning (With Noise Filter)
    if (position === "absolute" || position === "fixed") {
      // NOISE FILTER: Ignore if the element is likely "safe"
      const hasText = el.innerText.trim().length > 0;
      const isTiny = el.offsetWidth < 20 || el.offsetHeight < 20; // Likely an icon or decorative dot
      const isImage = el.tagName === "IMG" || el.tagName === "SVG";

      // We only flag absolute items if they contain readable text AND are not tiny icons
      if (hasText && !isTiny) {
        reason += `position: ${position}; `;
      }
      // Exception: If it's a large image, position might matter, but usually 1.3.2 cares about text sequence.
    }

    if (reason) {
      orderingProperties.push({
        text: el.textContent.trim().substring(0, 100),
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
    .map((table) => ({
      html: table.outerHTML.substring(0, 500),
    }));

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
      if (
        parent &&
        parent.offsetParent !== null &&
        !elementsWithBadWhitespace.some(
          (e) => e.text === parent.textContent.trim().substring(0, 100)
        )
      ) {
        elementsWithBadWhitespace.push({
          tagName: parent.tagName.toLowerCase(),
          text: parent.textContent.trim().substring(0, 100),
        });
      }
    }
  }

  return {
    // Only send the first 5 items of each to the model
    orderingProperties: orderingProperties.slice(0, 5),
    layoutTables: layoutTables.slice(0, 3),
    elementsWithBadWhitespace: elementsWithBadWhitespace.slice(0, 5),
  };
}
