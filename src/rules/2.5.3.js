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

// We keep the system prompt as a backup for the report generation,
// though the verdict is computed programmatically.
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

export async function extractor() {
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

  function getVisibleLabel(el) {
    // 1. Inputs/Textareas
    if (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT"
    ) {
      const type = el.type ? el.type.toLowerCase() : "text";
      if (["submit", "reset", "button"].includes(type)) {
        return el.value;
      }
      // Explicit Label
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
      // Implicit/Wrapped Label (Fallback if .labels not supported)
      let parent = el.parentElement;
      if (parent.tagName === "LABEL") return parent.innerText;

      // Placeholder is strictly NOT a label for 2.5.3, but often perceived as one.
      // We skip it here because 2.5.3 applies to *Visible Labels*.
      // If placeholder is the only thing, it's covered by other rules.
      return "";
    }
    // 2. Buttons/Links (Inner Text)
    return el.innerText;
  }

  // --- AOM FEATURE CHECK ---
  // We check if the AOM API is available on a standard element
  const dummy = document.createElement("div");
  if (!dummy.computedAccessibleNode) {
    return {
      computedVerdict: "INAPPLICABLE",
      reason:
        "The Accessibility Object Model (AOM) is not enabled. Please enable chrome://flags/#enable-accessibility-object-model to run this test.",
      pageTitle: document.title,
    };
  }

  const elements = Array.from(
    document.querySelectorAll(
      "button, a, input, select, textarea, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='menuitem']"
    )
  );
  const mismatchedElements = [];

  for (const el of elements) {
    if (!isVisible(el)) continue;

    // 1. Get Visible Label (Visual Reality)
    const visibleRaw = getVisibleLabel(el);
    if (!visibleRaw || !visibleRaw.trim()) continue;

    // 2. Get Accessible Name (Browser Reality via AOM)
    let accessibleRaw = "";
    try {
      const axNode = await el.computedAccessibleNode();
      accessibleRaw = axNode.name || "";
    } catch (e) {
      // Fallback or skip if AOM fails for this specific node
      continue;
    }

    if (!accessibleRaw) continue; // If no acc name, it fails 4.1.2, not 2.5.3

    // 3. Compare
    const visible = cleanText(visibleRaw);
    const accessible = cleanText(accessibleRaw);

    // WCAG 2.5.3: The accessible name must *contain* the text of the visible label.
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
    // We construct the failure reason manually to be robust
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
