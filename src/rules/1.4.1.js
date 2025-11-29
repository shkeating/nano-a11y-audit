export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. SYSTEM PROMPT (Matched to 1.3.2 Style)
export const systemPrompt = `
You are a helpful accessibility expert.
Task: Check for WCAG 1.4.1 Use of Color violations.

Analyze the input JSON and provide a concise, human-readable summary.

**Rule 1: Links**
- Look at the 'links' array.
- These are links that rely ONLY on color (no underline, bold, or border).
- If found, summarize: "We found links that rely only on color to be distinguishable."
- List 1 or 2 examples using a newline character (\\n) and a bullet point.

**Rule 2: Form Fields**
- Look at the 'formElements' array.
- These are required or invalid fields that lack text indicators (like "*" or "Error").
- If found, summarize: "We found form fields that rely only on color to indicate status."
- List 1 or 2 examples using a newline character (\\n) and a bullet point.

**Rule 3: Text Fragments**
- Look at the 'textFragments' array.
- If found, summarize: "We found text content where meaning is conveyed only through color differences."

**Final Output**
- If all arrays are empty, verdict is "PASS".
- If any array has items, verdict is "FAIL".
- Combine the summaries into a single string for the 'reason'.
- Return ONLY the raw JSON: {"verdict": "PASS"|"FAIL", "reason": "Your summary here."}
`;

// 2. EXTRACTOR
export function extractor() {
  // --- HELPER: Detect Visual Indicators on Forms ---
  function hasVisualIndicator(el, label) {
    // 1. Check text content for "*" or "required"
    const text = label ? label.innerText.toLowerCase() : "";
    if (text.includes("*") || text.includes("required")) return true;

    // 2. Check Pseudo-elements (::before / ::after) for "*"
    if (label) {
      const styles = [
        window.getComputedStyle(label, "::before"),
        window.getComputedStyle(label, "::after"),
      ];
      if (styles.some((s) => s.content.includes("*"))) return true;
    }

    // 3. Check for specific error message description
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && document.getElementById(describedBy)) {
      return document.getElementById(describedBy).innerText.trim().length > 0;
    }

    return false;
  }

  // --- HELPER: Detect Color-Only Text Fragments ---
  function hasOnlyColorDifference(element, parent) {
    const elementStyle = window.getComputedStyle(element);
    const parentStyle = window.getComputedStyle(parent);

    if (elementStyle.color === parentStyle.color) return false;

    // Check if ANY other visual style distinguishes it
    const fontWeightChanged =
      elementStyle.fontWeight !== parentStyle.fontWeight;
    const fontStyleChanged = elementStyle.fontStyle !== parentStyle.fontStyle;
    const textDecorationChanged =
      elementStyle.textDecorationLine !== parentStyle.textDecorationLine;
    const borderBottomChanged =
      elementStyle.borderBottomStyle !== parentStyle.borderBottomStyle;
    const backgroundChanged =
      elementStyle.backgroundColor !== parentStyle.backgroundColor;

    // It FAILS if ONLY the color changed
    return !(
      fontWeightChanged ||
      fontStyleChanged ||
      textDecorationChanged ||
      borderBottomChanged ||
      backgroundChanged
    );
  }

  // --- LINK CHECKER ---
  const failingLinks = [];
  const links = Array.from(document.querySelectorAll("a:not(nav a)"));

  for (const link of links) {
    if (link.offsetParent === null) continue;

    const s = window.getComputedStyle(link);
    const isBold = parseInt(s.fontWeight) >= 700 || s.fontWeight === "bold";
    const isUnderlined = s.textDecorationLine.includes("underline");
    const hasBorder = s.borderBottomStyle !== "none";

    if (isUnderlined || isBold || hasBorder) continue;

    failingLinks.push({
      text: link.innerText.trim().substring(0, 30),
      preview: `Color: ${s.color}`,
    });

    if (failingLinks.length >= 5) break;
  }

  // --- FORM CHECKER ---
  const failingForms = [];
  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );

  for (const el of inputs) {
    if (el.offsetParent === null) continue;
    if (el.type === "submit" || el.type === "button" || el.type === "hidden")
      continue;

    const label = el.labels?.[0];

    if (hasVisualIndicator(el, label)) continue;

    const isExplicitlyRequired =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true";
    const isExplicitlyInvalid = el.getAttribute("aria-invalid") === "true";
    const hasErrorClass =
      el.className.includes("error") || el.className.includes("invalid");

    if (isExplicitlyRequired || isExplicitlyInvalid || hasErrorClass) {
      failingForms.push({
        label: label ? label.innerText.substring(0, 30) : "Unlabeled Field",
        issue: "Missing text indicator for state",
      });
    }

    if (failingForms.length >= 5) break;
  }

  // --- TEXT FRAGMENT CHECKER ---
  const failingFragments = [];
  const allElements = document.body.getElementsByTagName("*");

  for (const el of allElements) {
    if (el.children.length === 0 && el.textContent.trim().length > 0) {
      const parent = el.parentElement;
      if (parent && parent.children.length > 1) {
        if (hasOnlyColorDifference(el, parent)) {
          failingFragments.push({
            text: el.innerText.substring(0, 30),
            tagName: el.tagName.toLowerCase(),
          });
        }
      }
    }
    if (failingFragments.length >= 5) break;
  }

  return {
    pageTitle: document.title,
    links: failingLinks,
    formElements: failingForms,
    textFragments: failingFragments,
  };
}
