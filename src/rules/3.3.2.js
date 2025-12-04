export const id = "3.3.2";
export const earlId = "WCAG22:labels-or-instructions";
export const relevantElements = ["input", "textarea", "select"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 3.3.2.
Task: Check if inputs with strict data requirements (e.g. dates, phone numbers) have visible format hints.

**INSTRUCTIONS**
1. Analyze the 'label', 'placeholder', and 'type' of each field.
2. PASS if:
   - The field is free-text (Name, Address, Comments).
   - The field has a native UI (type="date", "time", "color").
   - The label or placeholder provides a format hint (e.g. "MM/DD/YYYY").
3. FAIL if:
   - The field implies a strict format (Date, Phone, SSN) BUT has no visible hint.

**OUTPUT (JSON)**
- PASS: {"verdict": "PASS", "reason": "All strict fields have instructions."}
- FAIL: {"verdict": "FAIL", "reason": "Missing format hints for: [Comma separated list of Labels]."}
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
    // 1. aria-labelledby (Highest Priority)
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

    // 3. Native Label (Explicit 'for' or Implicit wrapping)
    let nativeLabelText = "";

    // Check explicit 'for'
    if (el.id) {
      // Use CSS.escape if available to prevent SyntaxErrors with complex IDs
      const escapedId = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id;
      try {
        const label = document.querySelector(`label[for="${escapedId}"]`);
        if (label) nativeLabelText += label.innerText;
      } catch (e) {
        console.warn("Label selector failed:", e);
      }
    }

    // Check implicit wrapping (Only if we haven't found an explicit one to avoid duplication)
    if (!nativeLabelText) {
      const parentLabel = el.closest("label");
      if (parentLabel) {
        // Clone to safely remove the input itself from the text content extraction
        const clone = parentLabel.cloneNode(true);
        const inputInClone = clone.querySelector(el.tagName);
        if (inputInClone) inputInClone.remove();
        nativeLabelText += clone.innerText;
      }
    }

    // 4. aria-describedby (Supplemental - Append to main label)
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

  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  const relevantInputs = [];

  for (const el of inputs) {
    if (!isVisible(el)) continue;

    // Skip hidden/submit/button types
    const type = el.type ? el.type.toLowerCase() : "text";
    if (
      [
        "hidden",
        "submit",
        "button",
        "image",
        "reset",
        "checkbox",
        "radio",
      ].includes(type)
    )
      continue;

    const label = getAccessibleLabel(el);
    const placeholder = el.getAttribute("placeholder") || "";

    // We send this to AI
    relevantInputs.push({
      tag: el.tagName.toLowerCase(),
      type: type,
      label: label.substring(0, 150),
      placeholder: placeholder.substring(0, 50),
      description: "", // Merged into label above
    });

    if (relevantInputs.length >= 15) break; // Limit context
  }

  return {
    pageTitle: document.title,
    formFields: relevantInputs,
  };
}
