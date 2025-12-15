export const id = "2.4.4";
export const earlId = "WCAG22:link-purpose-in-context";
export const relevantElements = ["a"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Determine if a link's purpose is clear based on the provided Context.

**CRITERIA**
1. **PASS (Contextual):** The link is generic (e.g., "Read more", "Click here"), BUT the **Context** clearly explains the topic.
   - Context: "Q3 Financial Results." -> PASS.
   - Context: "" (Empty) -> FAIL.
2. **FAIL (Ambiguous):**
   - The link is generic ("Read more", "Start").
   - **AND** the Context is empty or generic.

**INSTRUCTIONS**
- Return a JSON object.
- **ONLY** list the items that **FAIL**.
- If a failure is found, the reason must be: "(Context was empty)".

**FEW-SHOT EXAMPLES**
User:
- Link: "Click here", Context: ""
- Link: "Read more", Context: "Q3 Earnings exceeded expectations"

Model:
{"verdict": "FAIL", "reason": "Ambiguous links found:\\n- 'Click here' (Context was empty)"}
`;

// NOW ACCEPTS OPTIONS (contains safeList)
export function extractor(selectors, options) {
  const safeList = options?.safeList || [];

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

  function getContext(el) {
    let contextStr = "";
    // 1. Parent block text
    const parent = el.parentElement;
    if (parent && parent.innerText.length < 300) {
      const clone = parent.cloneNode(true);
      const linkInClone = clone.querySelector("a");
      if (linkInClone) linkInClone.remove();
      contextStr = cleanText(clone.innerText);
    }
    // 2. Preceding Heading (up to 3 levels up)
    if (contextStr.length < 5) {
      let current = el.parentElement;
      for (let i = 0; i < 3; i++) {
        if (!current) break;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(sibling.tagName)) {
            contextStr = cleanText(sibling.innerText);
            break;
          }
          sibling = sibling.previousElementSibling;
        }
        if (contextStr) break;
        current = current.parentElement;
      }
    }
    return contextStr;
  }

  const items = [];
  const candidates = document.querySelectorAll("a");
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
    "continue",
  ];

  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = cleanText(el.innerText);
    if (text.length === 0) continue;

    const lower = text.toLowerCase();

    // 1. CHECK USER SAFE LIST
    // If the link text exactly matches (case-insensitive) a safe term, PASS it.
    if (safeList.some((term) => term.toLowerCase() === lower)) {
      continue;
    }

    // 2. HEURISTIC: PROPER NAMES / TITLES
    // If it looks like "Taylor Swift" (Capitalized Words, 2-3 words) AND has no suspicious terms, SKIP IT.
    // This reduces the need for users to manually add every name to the safe list.
    const isTitleCase = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$/.test(text);
    const isGeneric = SUSPICIOUS_TERMS.some((t) => lower.includes(t));

    if (isTitleCase && !isGeneric) {
      continue;
    }

    // 3. FILTER FOR AI
    // Only send to AI if it looks generic OR is very short (1 word)
    const wordCount = text.split(" ").length;
    if (isGeneric || wordCount <= 1) {
      items.push(`Link: "${text}", Context: "${getContext(el)}"`);
    }
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No ambiguous links found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    items: items.slice(0, 25),
  };
}
