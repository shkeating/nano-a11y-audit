export const id = "1.3.1-orphaned-label";
export const earlId = "WCAG22:info-and-relationships";
export const relevantElements = ["input", "textarea", "select"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Identify inputs that have a **visual** label nearby that is NOT programmatically associated.

**INPUT DATA**
You will receive a list of "Orphaned Inputs". Each item contains:
1. **Nearby Text:** Text found immediately before or around the input.
2. **Accessible Name:** The actual programmatic name (often empty).

**CRITERIA**
- **FAIL:** If "Nearby Text" clearly looks like a label (e.g., "First Name", "Email Address") BUT "Accessible Name" is empty.
  *Reasoning:* The user sees a label, but the screen reader sees nothing.
- **PASS:** If "Accessible Name" is present and matches the nearby text.
- **PASS:** If "Nearby Text" is unrelated navigation or generic content.

**OUTPUT FORMAT**
Return a JSON object:
- Fail: {"verdict": "FAIL", "reason": "Visual labels not associated with inputs:\\n- Label '[Text]' near [Input Type]"}
- Pass: {"verdict": "PASS", "reason": "No orphaned labels found."}
`;

export function extractor() {
  // --- DUPLICATED HELPERS START ---
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

  function getAccessibleName(el) {
    if (el.hasAttribute("aria-labelledby")) return "Has aria-labelledby"; // Short circuit
    if (el.hasAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
      return document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        .innerText;
    if (el.closest("label")) return el.closest("label").innerText;
    return "";
  }
  // --- DUPLICATED HELPERS END ---

  const inputs = document.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']), textarea, select"
  );
  const orphans = [];

  for (const el of inputs) {
    if (!isVisible(el)) continue;

    const accName = getAccessibleName(el);

    // If it already has a name, we assume it's good (Axe checks the validity).
    // We are looking for inputs that usually FAIL "label-title-only" in Axe,
    // but we want to confirm if a visual label EXISTS nearby.
    if (accName && accName.trim().length > 0) continue;

    // Look for nearby text (heuristic: previous sibling or parent's previous sibling)
    let nearbyText = "";

    // Check previous element
    let prev = el.previousElementSibling;
    if (prev && isVisible(prev)) {
      nearbyText = prev.innerText.trim();
    }
    // Check parent's previous element (common in form-group wrappers)
    else if (el.parentElement && el.parentElement.previousElementSibling) {
      const parentPrev = el.parentElement.previousElementSibling;
      if (isVisible(parentPrev)) nearbyText = parentPrev.innerText.trim();
    }

    // Only flag if we found plausible label text (short, no punctuation ending)
    if (nearbyText && nearbyText.length < 50 && nearbyText.length > 2) {
      orphans.push({
        inputType: el.tagName + (el.type ? `[type="${el.type}"]` : ""),
        nearbyText: nearbyText,
        accessibleName: "(Empty)",
      });
    }

    if (orphans.length >= 5) break;
  }

  if (orphans.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No inputs found with missing names but visible labels.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    orphans: orphans,
  };
}
