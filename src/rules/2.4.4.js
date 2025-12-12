export const id = "2.4.4";
export const earlId = "WCAG22:link-purpose-in-context";
export const relevantElements = ["a"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Determine if a link's purpose is clear based on the provided Context.

**CRITERIA**
1. **PASS (Self-Descriptive):** The link text itself describes the destination (e.g., "2024 Financial Report", "Contact Support").
2. **PASS (Contextual):** The link is generic (e.g., "Read more"), BUT the **Context** clearly explains the topic.
   - Context: "Q3 Financial Results." -> PASS.
   - Context: "" (Empty) -> FAIL.

**INSTRUCTIONS**
- Return a JSON object.
- **ONLY** list the items that **FAIL**.
- If a failure is found, the reason must be: "(Context was empty)".

**FEW-SHOT EXAMPLES**

User:
- Link: "Click here", Context: ""
- Link: "Read more", Context: ""
- Link: "Learn more", Context: "To understand our privacy policy"
- Link: "View Report", Context: "Q3 Earnings exceeded expectations"

Model:
{"verdict": "FAIL", "reason": "Ambiguous links found:\\n- 'Click here' (Context was empty)\\n- 'Read more' (Context was empty)"}

User:
- Link: "Start", Context: ""
- Link: "Details", Context: "Project Alpha status: On Track"

Model:
{"verdict": "FAIL", "reason": "Ambiguous links found:\\n- 'Start' (Context was empty)"}
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

  function cleanText(str) {
    return str ? str.replace(/\s+/g, " ").trim() : "";
  }

  // Helper to get context (parent text or preceding heading)
  function getContext(el) {
    let contextStr = "";

    // 1. Parent block text (p, li, div)
    // We try to get the parent's text, but REMOVE the link's own text from it
    const parent = el.parentElement;
    if (parent && parent.innerText.length < 300) {
      // Clone to remove the link itself before grabbing text
      // This prevents "Read more" from appearing in the context
      const clone = parent.cloneNode(true);
      const linkInClone = clone.querySelector("a"); // This might be too aggressive if multiple links, but okay for this check
      if (linkInClone) linkInClone.remove();
      contextStr = cleanText(clone.innerText);
    }

    // 2. Preceding Heading (If parent text was empty/short)
    if (contextStr.length < 5) {
      let prev = parent;
      let attempts = 0;
      while (prev && attempts < 3) {
        if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(prev.tagName)) {
          contextStr = cleanText(prev.innerText);
          break;
        }
        prev = prev.previousElementSibling;
        attempts++;
      }
    }

    return contextStr;
  }

  const items = [];
  const candidates = document.querySelectorAll("a");

  // Filter: Only send "suspicious" links to AI to save tokens.
  const SUSPICIOUS_TERMS = [
    "click",
    "here",
    "read",
    "more",
    "details",
    "info",
    "link",
    "go",
    "start",
    "view",
  ];

  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = cleanText(el.innerText);

    if (text.length === 0) continue;

    const wordCount = text.split(" ").length;
    const isGeneric = SUSPICIOUS_TERMS.some((t) =>
      text.toLowerCase().includes(t)
    );
    const hasYear = /\d{4}/.test(text); // Regex Bypass for dates

    // If it's generic AND doesn't have a date bypass
    if ((wordCount < 5 || isGeneric) && !hasYear) {
      items.push(`Link: "${text}", Context: "${getContext(el)}"`);
    }
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No ambiguous links found (filtered by length/keywords).",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    items: items.slice(0, 25),
  };
}
