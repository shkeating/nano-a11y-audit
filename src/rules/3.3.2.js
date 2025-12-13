export const id = "3.3.2";
export const earlId = "WCAG22:labels-or-instructions";
export const relevantElements = ["input", "textarea", "select"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Report a consolidated list of form field violations.

**INPUT DATA**
1. "confirmedFailures": A list of fields that have ALREADY FAILED validation (e.g. missing required indicators).
2. "suspectFields": A list of fields that need your judgment.

**STEP 1: JUDGE SUSPECT FIELDS**
Review "suspectFields".
- **FAIL** if the label implies strict data (e.g. "Date", "Phone", "SSN", "Tax ID") AND has no hint.
- **PASS** if the label is generic (e.g. "Name", "Message", "Search").

**STEP 2: GENERATE REPORT**
Combine "confirmedFailures" AND any failures identified in Step 1 into a single list.

**CRITICAL: DO NOT HALLUCINATE**
- **Only report fields that are actually listed in the input data.**
- Do NOT copy examples from this prompt (like "SSN" or "Tax ID") unless they truly appear in the input list.

**OUTPUT (JSON)**
Return a SINGLE JSON object.
- If failures exist: {"verdict": "FAIL", "reason": "Missing instructions/indicators for: [List ONLY the failed fields from input]."}
- If no failures: {"verdict": "PASS", "reason": "All fields have sufficient instructions."}
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

  function getAccessibleLabel(el) {
    // 1. aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      let compositeLabel = "";
      ids.forEach((id) => {
        if (!id) return;
        const labelEl = document.getElementById(id);
        if (labelEl && isVisible(labelEl)) {
          compositeLabel += labelEl.innerText + " ";
        }
      });
      if (compositeLabel.trim()) return compositeLabel.trim();
    }

    // 2. aria-label
    if (el.hasAttribute("aria-label")) {
      return el.getAttribute("aria-label").trim();
    }

    // 3. Native Label
    let nativeLabelText = "";
    if (el.id) {
      const escapedId = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id;
      try {
        const label = document.querySelector(`label[for="${escapedId}"]`);
        if (label) nativeLabelText += label.innerText;
      } catch (e) {
        console.warn("Label selector failed:", e);
      }
    }
    if (!nativeLabelText) {
      const parentLabel = el.closest("label");
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        const inputInClone = clone.querySelector(el.tagName);
        if (inputInClone) inputInClone.remove();
        nativeLabelText += clone.innerText;
      }
    }

    // 4. aria-describedby
    let descriptionText = "";
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy) {
      const ids = describedBy.split(" ");
      ids.forEach((id) => {
        if (!id) return;
        const descEl = document.getElementById(id);
        if (descEl && isVisible(descEl)) {
          descriptionText += descEl.innerText + " ";
        }
      });
    }

    return (nativeLabelText + " " + descriptionText).trim();
  }

  // --- PATTERNS ---
  const HINT_PATTERN =
    /\(.*\)|e\.g\.|example|format:|\d{2}\/\d{2}|\d{3}-\d{2}/i;
  const REQ_INDICATOR_PATTERN = /\*|required|mandatory/i;
  const FREE_TEXT_PATTERN =
    /name|address|city|comment|search|email|appointment|subject/i;

  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  const relevantInputs = [];
  const failures = [];

  for (const el of inputs) {
    if (!isVisible(el)) continue;

    const rawType = el.getAttribute("type");
    const type = (rawType || el.type || "text").toLowerCase().trim();

    if (
      [
        "hidden",
        "submit",
        "button",
        "image",
        "reset",
        "checkbox",
        "radio",
        "file",
        "date",
        "time",
        "datetime-local",
        "month",
        "week",
        "color",
        "range",
      ].includes(type)
    )
      continue;

    const label = getAccessibleLabel(el);
    const placeholder = el.getAttribute("placeholder") || "";
    const fullText = label + " " + placeholder;
    const isRequired =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true";

    // 2. CHECK: Required Field Missing Indicator?
    if (isRequired && !REQ_INDICATOR_PATTERN.test(fullText)) {
      failures.push(
        label.substring(0, 50) + " (Required field missing indicator)"
      );
      continue;
    }

    // 3. CHECK: Has Format Hint?
    if (HINT_PATTERN.test(fullText)) continue;

    // 4. CHECK: Is it obviously Free Text?
    if (FREE_TEXT_PATTERN.test(fullText)) continue;

    // 5. REMAINING: Ambiguous fields
    relevantInputs.push({
      label: label.substring(0, 150),
    });

    if (relevantInputs.length >= 15) break;
  }

  return {
    pageTitle: document.title,
    suspectFields: relevantInputs,
    confirmedFailures: failures,
  };
}
