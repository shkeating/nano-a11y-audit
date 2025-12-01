export const id = "2.5.3";
export const earlId = "WCAG22:label-in-name";
export const relevantElements = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
];

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
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[\W_]+/g, " ")
      .trim();
  }

  function getOverrideName(el) {
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const parts = ids.map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl ? labelEl.innerText : "";
      });
      return parts.join(" ").trim();
    }
    if (el.hasAttribute("aria-label")) {
      return el.getAttribute("aria-label").trim();
    }
    if (el.hasAttribute("alt")) {
      return el.getAttribute("alt").trim();
    }
    return null;
  }

  function getVisibleLabel(el) {
    if (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT"
    ) {
      const type = el.type ? el.type.toLowerCase() : "text";
      if (["submit", "reset", "button"].includes(type)) {
        return el.value;
      }
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
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
      if (el.hasAttribute("placeholder")) {
        return el.getAttribute("placeholder");
      }
      return "";
    }
    return el.innerText;
  }

  const elements = Array.from(
    document.querySelectorAll(
      "button, a, input, select, textarea, [role='button'], [role='link']"
    )
  );
  const mismatchedElements = [];

  for (const el of elements) {
    if (!isVisible(el)) continue;

    const visibleRaw = getVisibleLabel(el);
    if (!visibleRaw || !visibleRaw.trim()) continue;

    const accessibleRaw = getOverrideName(el);
    if (!accessibleRaw) continue;

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

  const result = { pageTitle: document.title };

  if (mismatchedElements.length > 0) {
    result.mismatchedElements = mismatchedElements;
    result.computedVerdict = "FAIL";
  } else {
    result.computedVerdict = "PASS";
  }

  return result;
}
