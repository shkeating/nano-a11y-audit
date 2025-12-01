export const id = "3.3.2";
export const earlId = "WCAG22:labels-or-instructions";
export const relevantElements = ["input", "textarea", "select"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 3.3.2 (Labels or Instructions).
Task: Determine if form fields requiring specific data formats provide visible instructions.

**INSTRUCTIONS**
Review the input data (inputs with their labels, placeholders, and descriptions).
1. **Analyze:** Does the visible label or input type imply a strict format (e.g., "Date", "Phone", "SSN", "Currency")?
   - Common Strict Formats: Dates (MM/DD/YYYY), Phone Numbers, Social Security Numbers, Credit Cards, Times.
   - Flexible Formats (PASS): Name, Email (standard), URL (standard), Search, Address (free text), Comments.
   - Native UI (PASS): Inputs with type="date", "time", "color", "range" (Browser provides UI).
2. **Evaluate:** If a strict format is implied, are instructions provided in the 'label', 'description', or 'placeholder' text?
   - PASS if instructions exist (e.g., "MM/DD/YYYY", "xxx-xxx-xxxx").
   - PASS if the label is generic enough not to need one (e.g., "Birth Year" is simple, "Date of Birth" usually needs format if text input).
   - FAIL if the field expects a specific format but offers no visible hint.

**OUTPUT**
- If NO failures: {"verdict": "PASS", "reason": "All relevant fields have sufficient instructions or use native format controls."}
- If failures exist: {"verdict": "FAIL", "reason": "Fields with specific format requirements are missing visible instructions:\\n- [Label] ([Type]): Missing format hint"}

**EXAMPLES**
- PASS: Label "Event Date", Type "date" (Native UI).
- PASS: Label "Zip Code", Placeholder "90210" (Instruction provided).
- PASS: Label "Comments", Type "textarea" (No format needed).
- FAIL: Label "Date of Birth", Type "text", No description (User doesn't know format).
- FAIL: Label "Phone", Type "tel", No description (Ambiguous format).
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

  function getVisibleLabel(el) {
    let labelText = "";
    // 0. Check for aria-labelledby (Prioritize if visible)
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      ids.forEach((id) => {
         const labelEl = document.getElementById(id);
         if (labelEl && isVisible(labelEl)) {
           labelText += labelEl.innerText + " ";
         }
      });
    }

    // 1. Check for 'for' attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) labelText += label.innerText + " ";
    }
    // 2. Check for wrapping label
    const parentLabel = el.closest("label");
    if (parentLabel) {
      labelText += parentLabel.innerText + " ";
    }
    // 3. Check for aria-describedby (only if visible)
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy) {
      const ids = describedBy.split(" ");
      ids.forEach((id) => {
        const descEl = document.getElementById(id);
        if (descEl && isVisible(descEl)) {
          labelText += descEl.innerText + " ";
        }
      });
    }
    return labelText.trim();
  }

  const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
  const relevantInputs = [];

  for (const el of inputs) {
    if (!isVisible(el)) continue;

    // Skip hidden/submit/button types
    const type = el.type ? el.type.toLowerCase() : "text";
    if (["hidden", "submit", "button", "image", "reset", "checkbox", "radio"].includes(type)) continue;

    const label = getVisibleLabel(el);
    const placeholder = el.getAttribute("placeholder") || "";

    // We send this to AI
    relevantInputs.push({
      tag: el.tagName.toLowerCase(),
      type: type,
      label: label.substring(0, 100), // Truncate for token limits
      placeholder: placeholder.substring(0, 50),
      description: "" // Merged into label for simplicity in prompt instructions
    });

    if (relevantInputs.length >= 10) break; // Limit context
  }

  return {
    formFields: relevantInputs
  };
}
