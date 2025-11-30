export const id = "2.5.3";
export const earlId = "WCAG22:label-in-name";

export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 2.5.3 Label in Name violations.

**INSTRUCTIONS**
Review the input data.
1. **If a key is missing or empty:** Do NOT write about it.
2. **If a key exists:**
   - Write the specific Summary Sentence defined below.
   - Create a Markdown list using dashes (-).
   - **CRITICAL:** Start every list item on a new line using the literal string "\\n".

**SUMMARY SENTENCES**
- For 'mismatchedElements': "Accessible names missing visible text were found:"

**REQUIRED FORMAT EXAMPLE**
"Accessible names missing visible text were found:\\n- Visible: '[visible label]', Accessible: '[accessible name]'"

**FINAL OUTPUT**
- If NO items exist: {"verdict": "PASS", "reason": "No label-in-name violations were found."}
- If items exist: {"verdict": "FAIL", "reason": "[Combine your summaries here]"}
`;

export function extractor() {
  function getAccessibleName(el) {
    // Priority 1: aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const parts = ids.map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl ? labelEl.innerText : "";
      });
      return parts.join(" ").trim();
    }
    // Priority 2: aria-label
    if (el.hasAttribute("aria-label")) {
      return el.getAttribute("aria-label").trim();
    }
    // Priority 3: alt (specifically mentioned in prompt)
    if (el.hasAttribute("alt")) {
      return el.getAttribute("alt").trim();
    }
    return null;
  }

  function getVisibleLabel(el) {
    // If it's an input
    if (el.tagName === "INPUT") {
      const type = el.type ? el.type.toLowerCase() : "text";
      if (["submit", "reset", "button"].includes(type)) {
        return el.value;
      }
      // For other inputs, check associated label
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
      return "";
    }
    // For buttons and links
    return el.innerText;
  }

  const elements = Array.from(document.querySelectorAll("button, a, input"));
  const mismatchedElements = [];

  for (const el of elements) {
    if (el.offsetParent === null) continue; // Skip hidden elements

    const visibleRaw = getVisibleLabel(el);
    if (!visibleRaw || !visibleRaw.trim()) continue; // No visible label to check against

    const accessibleRaw = getAccessibleName(el);
    // Logic: "only return items where the accessibleName is present"
    if (!accessibleRaw) continue;

    const visible = visibleRaw.trim().toLowerCase();
    const accessible = accessibleRaw.trim().toLowerCase();

    if (!accessible.includes(visible)) {
      mismatchedElements.push({
        visible: visibleRaw.trim().substring(0, 50),
        accessible: accessibleRaw.trim().substring(0, 50),
      });
    }

    if (mismatchedElements.length >= 5) break;
  }

  const result = {
    pageTitle: document.title,
  };
  if (mismatchedElements.length > 0) {
    result.mismatchedElements = mismatchedElements;
  }
  return result;
}
