export const id = "1.3.2";
export const earlId = "WCAG22:meaningful-sequence";

// 1. HARDENED PROMPT
export const systemPrompt = `
You are a strict accessibility auditor who writes in plain, easy-to-understand language.
Task: Check for WCAG 1.3.2 Meaningful Sequence violations based on the provided JSON data.
The JSON data contains findings about potential issues related to reading order.

Analyze the findings based on the rules below.

**Rule 1: Potential Incorrect Reading Order**
- The 'orderingProperties' array contains elements that use CSS properties like 'order', 'float', or 'flex-direction', which can cause a mismatch between the visual order and the DOM order, confusing users of assistive technologies.
- For each element in 'orderingProperties', this is a potential failure. The 'reason' field indicates the specific CSS property found.
- If this array is not empty, generate a sentence with this exact format: "The following element(s) use CSS properties that can disrupt the reading sequence: '[text 1]' ('[reason 1]'), '[text 2]' ('[reason 2]')." (Use the 'text' and 'reason' from each element, quoted and joined naturally).

**Rule 2: Layout Tables**
- The 'layoutTables' array contains HTML tables that appear to be used for layout, not for data. When linearized by a screen reader, their content may become nonsensical.
- For each table in 'layoutTables', consider it a failure.
- If this array is not empty, generate a sentence with this exact format: "A table that appears to be for layout was found, which can create a confusing reading order. A snippet of its content is: '[html snippet 1]'." (Use the 'html' from each element, quoted and joined naturally).

**Rule 3: Whitespace-based Layout**
- The 'elementsWithBadWhitespace' array contains elements using multiple spaces or non-breaking spaces to create a visual layout. This can add confusing pauses or alter the reading order for screen readers.
- For each element in 'elementsWithBadWhitespace', consider it a failure.
- If this array is not empty, generate a sentence with this exact format: "The following element(s) use excessive whitespace for formatting, which can disrupt the reading order: '[text 1]', '[text 2]'." (Use the 'text' from each element, quoted and joined naturally).

**Final Output**
- If all arrays in the input JSON are empty, the final verdict is "PASS".
- If any array is not empty, the final verdict is "FAIL".
- Combine all generated failure sentences, each on a new line, for the 'reason'.
- Return ONLY the raw JSON object in the format {"verdict": "PASS"|"FAIL", "reason": "Your combined explanation(s) here."}
`;

// 2. EXTRACTOR
export function extractor() {
    const orderingProperties = [];
    const elements = Array.from(document.querySelectorAll('*'));

    for (const el of elements) {
        if (el.offsetParent === null) continue;

        const style = window.getComputedStyle(el);
        const order = style.order;
        const float = style.float;
        const flexDirection = style.flexDirection;

        let reason = '';
        if (order !== '0') {
            reason += `order: ${order}; `;
        }
        if (float === 'left' || float === 'right') {
            reason += `float: ${float}; `;
        }
        if (flexDirection === 'row-reverse' || flexDirection === 'column-reverse') {
            reason += `flex-direction: ${flexDirection}; `;
        }

        if (reason) {
            orderingProperties.push({
                tagName: el.tagName.toLowerCase(),
                text: el.textContent.trim().substring(0, 100),
                reason: reason.trim()
            });
        }
    }

    // 2. Find potential layout tables
    const layoutTables = Array.from(document.querySelectorAll('table'))
        .filter(table => table.getAttribute('role') === 'presentation' || (!table.querySelector('th') && !table.querySelector('caption')))
        .map(table => ({
            html: table.outerHTML.substring(0, 500)
        }));

    // 3. Find elements with suspicious whitespace in text nodes
    const elementsWithBadWhitespace = [];
    const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let currentNode;
    while (currentNode = treeWalker.nextNode()) {
        const text = currentNode.nodeValue;
        // Check for more than two consecutive spaces between words, or multiple non-breaking spaces.
        if (text && (text.match(/\\w\\s{2,}\\w/g) || text.match(/&nbsp;.*&nbsp;/g))) {
            const parent = currentNode.parentElement;
            if (parent && parent.offsetParent !== null && !elementsWithBadWhitespace.some(e => e.text === parent.textContent.trim().substring(0, 100))) {
                 elementsWithBadWhitespace.push({
                    tagName: parent.tagName.toLowerCase(),
                    text: parent.textContent.trim().substring(0, 100)
                });
            }
        }
    }

    return {
        orderingProperties,
        layoutTables,
        elementsWithBadWhitespace
    };
}
