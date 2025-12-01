export const id = "2.4.6";
export const earlId = "WCAG22:headings-and-labels";
export const relevantElements = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "[role='heading']",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "label",
  "[aria-label]",
  "[aria-labelledby]"
];

export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 2.4.6 Headings and Labels violations.
The criterion requires that headings and labels describe the topic or purpose of the content.

**INSTRUCTIONS**
Review the input data for headings and labels.
1. **Analyze specificity:**
   - FAIL if a heading or label is "generic" (e.g., "Section", "Untitled", "Input", "Field", "Button", "Read More") and lacks context.
   - FAIL if a heading or label is empty or whitespace only.
   - PASS if the text describes the purpose or topic (e.g., "Contact Us", "Search", "Submit", "Chapter 1").
   - PASS common navigational terms if they are standard (e.g., "Menu", "Home", "Back", "Next").
2. **Context Matters:**
   - A heading "Chapter 1" is descriptive enough if it organizes content.
   - A button "X" is descriptive if it clearly means "Close" in a modal context (though "Close" is better).
   - Use the provided context snippet to judge if the heading/label fits the content.

**SUMMARY SENTENCES**
- For 'nonDescriptiveItems': "Headings or labels that do not describe topic or purpose were found:"

**REQUIRED FORMAT EXAMPLE**
"Headings or labels that do not describe topic or purpose were found:\\n- Element: '[tag] ([text])' - Reason: [Brief explanation]"

**FINAL OUTPUT**
- If NO items exist: {"verdict": "PASS", "reason": "All headings and labels appear descriptive."}
- If items exist: {"verdict": "FAIL", "reason": "[Combine your summaries here]"}
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

  function getAccessibleName(el) {
    // 1. aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const parts = ids.map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl ? labelEl.innerText : "";
      });
      const joined = parts.join(" ").trim();
      if (joined) return joined;
    }
    // 2. aria-label
    if (el.hasAttribute("aria-label")) {
      const val = el.getAttribute("aria-label").trim();
      if (val) return val;
    }
    // 3. Associated Label (for inputs)
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
        if (el.labels && el.labels.length > 0) {
            return Array.from(el.labels).map(l => l.innerText).join(" ").trim();
        }
        // Implicit label (wrapped) - handled by el.labels usually, but fallback:
        // (Not strictly necessary if el.labels works, which it does in modern browsers)
    }
    // 4. Content (for headings, buttons, links)
    // Check for images with alt text if innerText is empty
    const text = (el.innerText || el.textContent || "").trim();
    if (!text && (el.tagName === "BUTTON" || el.getAttribute("role") === "button")) {
       const imgs = el.querySelectorAll("img[alt]");
       if (imgs.length > 0) {
           return Array.from(imgs).map(img => img.getAttribute("alt")).join(" ").trim();
       }
       // Also check for SVGs with title or aria-label?
       const svgs = el.querySelectorAll("svg");
       for (const svg of svgs) {
           if (svg.getAttribute("aria-label")) return svg.getAttribute("aria-label");
           const title = svg.querySelector("title");
           if (title) return title.textContent;
       }
    }
    return text;
  }

  function getContext(el) {
      // Get next sibling text for headings to help judge topic
      if (["H1","H2","H3","H4","H5","H6"].includes(el.tagName) || el.getAttribute("role") === "heading") {
          let next = el.nextElementSibling;
          while(next && isVisible(next) === false) {
              next = next.nextElementSibling;
          }
          if (next) return (next.innerText || next.textContent || "").substring(0, 50).replace(/\n/g, " ");
      }
      return "";
  }

  const selector = "h1, h2, h3, h4, h5, h6, [role='heading'], button, input, select, textarea, [role='button'], label, [aria-label], [aria-labelledby]";
  const elements = Array.from(document.querySelectorAll(selector));

  const items = [];
  let processedCount = 0;

  for (const el of elements) {
    if (processedCount >= 50) break; // Limit payload
    if (!isVisible(el)) continue;

    // Skip submit inputs/buttons that default to "Submit" if no value is present?
    // Actually, "Submit" is descriptive enough.

    const accName = getAccessibleName(el);
    const context = getContext(el);

    // Simple pre-filtering to reduce noise for AI?
    // Let's send everything that isn't obviously fine, or maybe just send a sample.
    // Actually, sending "Submit" button is a waste of tokens if we know it's fine.
    // But we need to let AI decide "Generic" vs "Specific".
    // "Submit" is fine. "Button" is not.

    // We can filter out empty names here to save AI effort?
    // No, empty names are failures.

    items.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        text: accName.substring(0, 50),
        context: context ? context.trim() : "(No context)"
    });

    processedCount++;
  }

  return {
      items: items,
      pageTitle: document.title
  };
}
