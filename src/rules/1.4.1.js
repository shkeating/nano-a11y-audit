export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. SYSTEM PROMPT (Strict Reporting / No Analysis)
export const systemPrompt = `
You are a violation reporter. 
Task: Format the input JSON data into a simple bulleted list.

**CRITICAL RULES**
1. **No Analysis:** The input data consists of CONFIRMED violations. Do not evaluate if they are violations. Do not explain the impact on users. Do not write paragraphs.
2. **Empty Input:** If the input JSON is empty ({}), return the standard PASS JSON immediately.
3. **List Format:** Use a simple dash "- " for lists. Start every item on a new line ("\\n").

**SECTION INSTRUCTIONS (Only process present keys)**

- **If 'links' exists:**
  Write: "Links relying on color were found:\\n"
  Then list items using the 'text' field.

- **If 'formElements' exists:**
  Write: "Form fields relying on color were found:\\n"
  Then list items using the 'label' field.

- **If 'textFragments' exists:**
  Write: "Text content relying on color was found:\\n"
  Then list items using the 'text' field. (Just copy the text, do not describe it).

**FINAL OUTPUT JSON**
- If input is empty: {"verdict": "PASS", "reason": "No use-of-color violations were found."}
- If input has data: {"verdict": "FAIL", "reason": "[Your generated lists here]"}
`;

// 2. EXTRACTOR (Smart Filter - Unchanged)
export function extractor() {
  // --- HELPER: Visual Indicators ---
  function hasVisualIndicator(el, label) {
    const text = label ? label.innerText.toLowerCase() : "";
    if (
      text.includes("*") ||
      text.includes("required") ||
      text.includes("error")
    )
      return true;

    if (label) {
      const styles = [
        window.getComputedStyle(label, "::before"),
        window.getComputedStyle(label, "::after"),
      ];
      if (styles.some((s) => s.content.includes("*"))) return true;
    }

    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && document.getElementById(describedBy)) {
      return document.getElementById(describedBy).innerText.trim().length > 0;
    }
    return false;
  }

  // --- HELPER: Color Difference ---
  function hasOnlyColorDifference(element, parent) {
    const s1 = window.getComputedStyle(element);
    const s2 = window.getComputedStyle(parent);

    if (s1.color === s2.color) return false;

    const isDistinct =
      s1.fontWeight !== s2.fontWeight ||
      s1.fontStyle !== s2.fontStyle ||
      s1.textDecorationLine !== s2.textDecorationLine ||
      s1.borderBottomStyle !== s2.borderBottomStyle ||
      s1.backgroundColor !== s2.backgroundColor;

    return !isDistinct;
  }

  // --- LINK CHECKER ---
  const failingLinks = [];
  const links = Array.from(document.querySelectorAll("a:not(nav a)"));

  for (const link of links) {
    if (link.offsetParent === null) continue;

    // Ignore headings (h1-h6) or links inside them
    const parentTag = link.parentElement ? link.parentElement.tagName : "";
    if (
      ["H1", "H2", "H3", "H4", "H5", "H6"].includes(parentTag) ||
      ["H1", "H2", "H3", "H4", "H5", "H6"].includes(link.tagName)
    ) {
      continue;
    }

    const s = window.getComputedStyle(link);
    if (
      s.textDecorationLine.includes("underline") ||
      parseInt(s.fontWeight) >= 700 ||
      s.fontWeight === "bold" ||
      s.borderBottomStyle !== "none"
    )
      continue;

    const txt = link.innerText.trim();
    if (txt.length > 0) {
      failingLinks.push({ text: txt.substring(0, 40) });
    }
    if (failingLinks.length >= 5) break;
  }

  // --- FORM CHECKER ---
  const failingForms = [];
  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );

  for (const el of inputs) {
    if (el.offsetParent === null) continue;
    if (["submit", "button", "hidden", "image"].includes(el.type)) continue;

    const label = el.labels?.[0];
    if (hasVisualIndicator(el, label)) continue;

    const isReq =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true";
    const isInv = el.getAttribute("aria-invalid") === "true";
    const isErr =
      el.className.includes("error") || el.className.includes("invalid");

    if (isReq || isInv || isErr) {
      failingForms.push({
        label: label ? label.innerText.substring(0, 30) : "Unlabeled Field",
      });
    }
    if (failingForms.length >= 5) break;
  }

  // --- TEXT FRAGMENT CHECKER ---
  const failingFragments = [];
  const allElements = document.body.getElementsByTagName("*");

  for (const el of allElements) {
    if (el.offsetParent === null) continue;
    if (
      [
        "SCRIPT",
        "STYLE",
        "NOSCRIPT",
        "A",
        "BUTTON",
        "INPUT",
        "SELECT",
        "TEXTAREA",
      ].includes(el.tagName)
    )
      continue;

    const hasDirectText = Array.from(el.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0
    );

    if (hasDirectText) {
      const parent = el.parentElement;
      if (parent && hasOnlyColorDifference(el, parent)) {
        const txt = el.innerText.trim();
        if (txt.length > 0) {
          failingFragments.push({
            text: txt.substring(0, 40),
          });
        }
      }
    }
    if (failingFragments.length >= 5) break;
  }

  // --- SMART RETURN: Only return keys that have data ---
  const result = {};

  if (failingLinks.length > 0) {
    result.links = failingLinks;
  }

  if (failingForms.length > 0) {
    result.formElements = failingForms;
  }

  if (failingFragments.length > 0) {
    result.textFragments = failingFragments;
  }

  return result;
}
