export const id = "2.4.4";
export const earlId = "WCAG22:link-purpose-in-context";
export const relevantElements = ["a"];

export const systemPrompt = `
You are an accessibility expert.
Task: Analyze links for WCAG 2.4.4 Link Purpose (In Context).

**CRITERIA**
- FAIL if the link text is generic (e.g., "click here", "read more") AND the provided context does not clarify the destination.
- PASS if the link text describes the destination (e.g., "Download Report").
- PASS if the link text is generic BUT the context (surrounding text or ARIA) makes the purpose clear.

**INSTRUCTIONS**
Review the input data (generic links found on the page).
1. **If 'genericLinks' is empty:** Return PASS.
2. **If 'genericLinks' has items:**
   - Analyze each item's 'text' and 'context'.
   - Determine if the context is sufficient.
   - If ANY link fails, the verdict is FAIL.
   - Write the specific Summary Sentence defined below.
   - Create a Markdown list using dashes (-).
   - **CRITICAL:** Start every list item on a new line using the literal string "\\n".

**SUMMARY SENTENCES**
- For 'genericLinks': "Links with generic text and insufficient context were found:"

**REQUIRED FORMAT EXAMPLE**
"Links with generic text and insufficient context were found:\\n- Link: '[link text]', Context: '[context snippet]'"

**FINAL OUTPUT**
- If NO failures: {"verdict": "PASS", "reason": "All generic links have sufficient context."}
- If failures exist: {"verdict": "FAIL", "reason": "[Combine your summaries here]"}
`;

export function extractor() {
  function isVisible(el) {
    if (!el) return false;
    // Basic visibility check
    return el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  function cleanText(str) {
    if (!str) return "";
    return str.replace(/\\s+/g, " ").trim();
  }

  function getAccessibleName(el) {
    if (el.getAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const parts = ids.map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl ? labelEl.innerText : "";
      });
      return cleanText(parts.join(" "));
    }
    if (el.getAttribute("aria-label")) {
      return cleanText(el.getAttribute("aria-label"));
    }

    // Check for images with alt text
    const images = el.querySelectorAll("img, svg[role='img']");
    if (images.length > 0) {
        const altTexts = Array.from(images).map(img => {
            if (img.getAttribute("alt")) return img.getAttribute("alt");
            if (img.getAttribute("aria-label")) return img.getAttribute("aria-label");
            return "";
        });
        const combinedAlt = altTexts.join(" ").trim();
        if (combinedAlt) return cleanText(combinedAlt);
    }

    return cleanText(el.innerText);
  }

  function getContext(el) {
    // 1. Check aria-describedby
    if (el.getAttribute("aria-describedby")) {
      const ids = el.getAttribute("aria-describedby").split(" ");
      const parts = ids.map((id) => {
        const descEl = document.getElementById(id);
        return descEl ? descEl.innerText : "";
      });
      const descText = cleanText(parts.join(" "));
      if (descText) return "Aria-DescribedBy: " + descText;
    }

    // 2. Check parent element text (sentence/paragraph context)
    const parent = el.parentElement;
    if (parent) {
        let parentText = cleanText(parent.innerText);

        // Optimize: If the text is super long, try to find the link text and grab a window around it.
        // If not found (e.g. image link), just grab the first chunk.
        const linkText = cleanText(el.innerText);

        if (parentText.length > 300) {
             if (linkText && parentText.includes(linkText)) {
                 const index = parentText.indexOf(linkText);
                 const start = Math.max(0, index - 100);
                 const end = Math.min(parentText.length, index + linkText.length + 100);
                 parentText = "..." + parentText.substring(start, end) + "...";
             } else {
                 parentText = parentText.substring(0, 300) + "...";
             }
        }
        return parentText;
    }
    return "";
  }

  const genericTerms = [
    "click here", "here",
    "read more", "more",
    "learn more",
    "info", "more info",
    "details", "view details",
    "go", "view", "link",
    "continue", "continue reading"
  ];

  const links = Array.from(document.querySelectorAll("a"));
  const genericLinks = [];

  for (const el of links) {
    if (!isVisible(el)) continue;

    const name = getAccessibleName(el);
    const nameLower = name.toLowerCase();

    // Check if name is generic
    const isGeneric = genericTerms.includes(nameLower) ||
                      (nameLower.split(" ").length <= 2 && (nameLower.includes("more") || nameLower.includes("view") || nameLower.includes("click")));

    if (isGeneric) {
      const context = getContext(el);

      genericLinks.push({
        text: name,
        context: context
      });
    }

    if (genericLinks.length >= 10) break; // Limit items
  }

  const result = { pageTitle: document.title };
  if (genericLinks.length > 0) {
    result.genericLinks = genericLinks;
  } else {
    result.computedVerdict = "PASS";
  }

  return result;
}
