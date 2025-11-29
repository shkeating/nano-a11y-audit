export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. SYSTEM PROMPT (Strict JSON-to-Text Conversion)
export const systemPrompt = `
You are a Strict JSON-to-Text Converter.
Task: Output a formatted report based EXACTLY on the provided JSON data keys.

**DATA MAPPING RULES (Follow Strictly)**

1. **CHECK key 'links':**
   - IF EMPTY: Output nothing.
   - IF HAS DATA:
     - Print Header: "Links found relying on color:"
     - Print Items: For each item, print "\\n- " followed by the 'text' value.
     - End Section: Print "\\n\\n" (Double newline).

2. **CHECK key 'formElements':**
   - IF EMPTY: Output nothing.
   - IF HAS DATA:
     - Print Header: "Form fields found relying on color:"
     - Print Items: For each item, print "\\n- " followed by the 'label' value.
     - End Section: Print "\\n\\n" (Double newline).

3. **CHECK key 'textFragments':**
   - IF EMPTY: Output nothing.
   - IF HAS DATA:
     - Print Header: "Text content found relying on color:"
     - Print Items: For each item, print "\\n- " followed by the 'text' value.
     - End Section: Print "\\n\\n" (Double newline).

**VERDICT LOGIC**
- If ALL input arrays are empty:
  Return: {"verdict": "PASS", "reason": "No use-of-color violations were found."}
- If ANY input array has data:
  Return: {"verdict": "FAIL", "reason": "[Your formatted text string]"}
`;

// 2. EXTRACTOR (Refined for False Positives)
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

    // FALSE POSITIVE FIX: Ignore links that are headings (h1-h6) or inside them.
    // These are often page titles/self-links where underline is not standard.
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

    // Fix: Ensure we don't push empty text links
    const linkText = link.innerText.trim();
    if (linkText.length > 0) {
      failingLinks.push({ text: linkText.substring(0, 40) });
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
    // Explicitly ignore links here so they don't double count
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
        // Fix: Ensure text is not empty
        const txt = el.innerText.trim();
        if (txt.length > 0) {
          failingFragments.push({
            text: txt.substring(0, 40),
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
