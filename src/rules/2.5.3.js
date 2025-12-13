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
  "[role='checkbox']",
  "[role='radio']",
  "[role='menuitem']",
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
  // --- HELPER FUNCTIONS (Must be inside to survive injection) ---

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

  // --- 1. Compute Accessible Name (AccName Spec Approximation) ---
  function getAccessibleName(el) {
    // Priority 1: aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const labels = ids
        .map((id) => {
          const labelEl = document.getElementById(id);
          return labelEl && isVisible(labelEl) ? labelEl.innerText : "";
        })
        .filter((s) => s);
      if (labels.length > 0) return labels.join(" ");
    }

    // Priority 2: aria-label
    if (el.hasAttribute("aria-label")) {
      const label = el.getAttribute("aria-label").trim();
      if (label) return label;
    }

    // Priority 3: Native Labeling (Input/Image)
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
      // Associated Label Element
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
      if (el.id) {
        try {
          const label = document.querySelector(
            `label[for="${CSS.escape(el.id)}"]`
          );
          if (label) return label.innerText;
        } catch (e) {}
      }
      // Alt (Input Image)
      if (el.type === "image" && el.hasAttribute("alt")) {
        return el.getAttribute("alt");
      }
      // Value (Submit/Reset)
      if (["submit", "reset", "button"].includes(el.type)) {
        return el.value;
      }
    }

    if (el.tagName === "IMG" || el.getAttribute("role") === "img") {
      return el.getAttribute("alt") || "";
    }

    // Priority 4: Text Content (Recursive)
    return el.innerText || "";
  }

  // --- 2. Compute Visible Label (Visual Reality) ---
  function getVisibleLabel(el) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
      const type = el.type ? el.type.toLowerCase() : "text";
      if (["submit", "reset", "button"].includes(type)) {
        return el.value;
      }
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
      if (el.getAttribute("placeholder")) {
        return el.getAttribute("placeholder");
      }
      return "";
    }
    return el.innerText;
  }

  // --- MAIN AUDIT LOGIC ---

  const elements = Array.from(
    document.querySelectorAll(
      "button, a, input, select, textarea, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='menuitem']"
    )
  );
  const mismatchedElements = [];

  for (const el of elements) {
    if (!isVisible(el)) continue;

    const visibleRaw = getVisibleLabel(el);
    const accessibleRaw = getAccessibleName(el);

    if (!visibleRaw || !visibleRaw.trim()) continue;
    if (!accessibleRaw || !accessibleRaw.trim()) continue;

    const visible = cleanText(visibleRaw);
    const accessible = cleanText(accessibleRaw);

    // CHECK: Does the Accessible Name contain the Visible Label?
    if (visible.length > 0 && !accessible.includes(visible)) {
      mismatchedElements.push({
        visible: visibleRaw.trim().substring(0, 50),
        accessible: accessibleRaw.trim().substring(0, 50),
        element: `<${el.tagName.toLowerCase()}>`,
      });
    }

    if (mismatchedElements.length >= 10) break;
  }

  const result = { pageTitle: document.title };

  if (mismatchedElements.length > 0) {
    result.mismatchedElements = mismatchedElements;
    result.computedVerdict = "FAIL";
    result.reason =
      "Accessible names missing visible text were found:\n" +
      mismatchedElements
        .map(
          (m) =>
            `- Visible: "${m.visible}", Accessible: "${m.accessible}" ${m.element}`
        )
        .join("\n");
  } else {
    result.computedVerdict = "PASS";
    result.reason =
      "All interactive elements include their visible text labels.";
  }

  return result;
}
