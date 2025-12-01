import { cleanText, isVisible } from "../utils/dom.js";

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
  /**
   * Gets the Accessible Name (Focus on Overrides)
   */
  function getOverrideName(el) {
    // 1. aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const parts = ids.map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl ? labelEl.innerText : "";
      });
      return parts.join(" ").trim();
    }
    // 2. aria-label
    if (el.hasAttribute("aria-label")) {
      return el.getAttribute("aria-label").trim();
    }
    // 3. alt
    if (el.hasAttribute("alt")) {
      return el.getAttribute("alt").trim();
    }
    return null;
  }

  function getVisibleLabel(el) {
    // 1. Inputs
    if (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT"
    ) {
      const type = el.type ? el.type.toLowerCase() : "text";
      if (["submit", "reset", "button"].includes(type)) {
        return el.value;
      }

      // A. Check for Programmatic Labels (Best Practice)
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }

      // B. Heuristic: Check for "Orphaned" Visual Labels
      let prev = el.previousElementSibling;
      while (
        prev &&
        (prev.tagName === "BR" ||
          (prev.tagName === "SPAN" && prev.innerText.length < 2))
      ) {
        prev = prev.previousElementSibling;
      }

      if (prev && prev.tagName === "LABEL") {
        return prev.innerText;
      }

      // C. Check Placeholder
      if (el.hasAttribute("placeholder")) {
        return el.getAttribute("placeholder");
      }

      return "";
    }

    // 2. Standard Elements
    return el.innerText;
  }

  const elements = Array.from(
    document.querySelectorAll(
      "button, a, input, select, textarea, [role='button'], [role='link']"
    )
  );
  const mismatchedElements = [];

  for (const el of elements) {
    // USAGE: Imported visibility check
    if (!isVisible(el)) continue;

    const visibleRaw = getVisibleLabel(el);
    if (!visibleRaw || !visibleRaw.trim()) continue;

    const accessibleRaw = getOverrideName(el);
    if (!accessibleRaw) continue;

    // USAGE: Imported text cleaner
    const visible = cleanText(visibleRaw);
    const accessible = cleanText(accessibleRaw);

    if (visible.length > 0 && !accessible.includes(visible)) {
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
    result.computedVerdict = "FAIL";
  } else {
    result.computedVerdict = "PASS";
  }

  return result;
}
