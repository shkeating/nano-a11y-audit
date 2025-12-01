export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";
export const relevantElements = ["a", "button", "input", "select", "textarea"];

export const systemPrompt = `
You are a violation reporter.
Task: Format the input JSON data into a simple bulleted list.

**VERDICT INSTRUCTION**
- The input JSON contains a 'computedVerdict' field.
- **You MUST use this value** for the output 'verdict'.

**SECTION INSTRUCTIONS**
- **If 'links' has items:**
  Write: "Links relying on color were found (G183 Check):\\n"
  Then list items using the 'text' and 'issue' fields (Format: "- [text]: [issue]\\n").

- **If 'formElements' has items:**
  Write: "Form fields relying on color were found:\\n"
  Then list items using the 'text' field (Format: "- [text]\\n").

- **If 'textFragments' has items:**
  Write: "Text content relying on color was found:\\n"
  Then list items using the 'text' field (Format: "- [text]\\n").

**FINAL OUTPUT JSON**
- If computedVerdict is "PASS": {"verdict": "PASS", "reason": "No use-of-color violations were found.", "title": "[pageTitle]"}
- If computedVerdict is "FAIL": {"verdict": "FAIL", "reason": "[Your generated lists]", "title": "[pageTitle]"}
`;

export function extractor(incompleteSelectors = []) {
  // --- HELPERS (Restored) ---
  function parseRgb(colorStr) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match
      ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
      : null;
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(fgColor, bgColor) {
    const rgb1 = parseRgb(fgColor);
    const rgb2 = parseRgb(bgColor);
    if (!rgb1 || !rgb2) return null;
    const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function hasValidHoverStyle(element) {
    let hasCue = false;
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.selectorText || !rule.selectorText.includes(":hover"))
            continue;
          const selectors = rule.selectorText.split(",");
          for (const sel of selectors) {
            if (!sel.includes(":hover")) continue;
            const baseSel = sel.replace(/:hover/g, "").trim();
            if (baseSel === "" || baseSel === "a" || element.matches(baseSel)) {
              const s = rule.style;
              if (
                s.textDecorationLine?.includes("underline") ||
                s.textDecoration?.includes("underline") ||
                (s.borderBottomStyle && s.borderBottomStyle !== "none")
              ) {
                hasCue = true;
              } else if (
                (s.textDecorationLine?.includes("none") ||
                  s.textDecoration === "none") &&
                (s.borderBottomStyle === "none" || !s.borderBottomStyle)
              ) {
                hasCue = false;
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    return hasCue;
  }

  // --- 1. LINK LOGIC ---
  const failingLinks = [];
  let linksToCheck = [];

  if (incompleteSelectors && incompleteSelectors.length > 0) {
    incompleteSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) linksToCheck.push(el);
    });
  } else {
    linksToCheck = Array.from(document.querySelectorAll("a:not(nav a)"));
  }

  for (const link of linksToCheck) {
    if (link.offsetParent === null) continue;
    const parent = link.parentElement;
    if (!parent) continue;
    if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(parent.tagName)) continue;

    const s = window.getComputedStyle(link);
    const hasStaticCue =
      s.textDecorationLine.includes("underline") ||
      s.textDecoration.includes("underline") ||
      (s.borderBottomStyle !== "none" && parseFloat(s.borderBottomWidth) > 0);
    const hasBold = parseInt(s.fontWeight) >= 700 || s.fontWeight === "bold";

    if (hasStaticCue) continue;

    const ratio = getContrastRatio(
      s.color,
      window.getComputedStyle(parent).color
    );

    if (ratio !== null) {
      if (ratio < 3.0) {
        failingLinks.push({
          text: link.innerText.substring(0, 40),
          issue: `Contrast ${ratio.toFixed(2)}:1 is too low (<3:1).`,
        });
      } else if (!hasBold && !hasValidHoverStyle(link)) {
        failingLinks.push({
          text: link.innerText.substring(0, 40),
          issue: `Contrast OK (${ratio.toFixed(
            2
          )}:1) but missing visual cue on hover.`,
        });
      }
    }
    if (failingLinks.length >= 5) break;
  }

  // --- 2. FORM LOGIC ---
  function hasVisualIndicator(el, label) {
    const text = label ? label.innerText.toLowerCase() : "";
    return (
      text.includes("*") ||
      text.includes("required") ||
      text.includes("error") ||
      (label &&
        window.getComputedStyle(label, "::before").content.includes("*")) ||
      (label &&
        window.getComputedStyle(label, "::after").content.includes("*")) ||
      (el.getAttribute("aria-describedby") &&
        document
          .getElementById(el.getAttribute("aria-describedby"))
          ?.innerText.trim().length > 0)
    );
  }

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
    const isErr =
      el.getAttribute("aria-invalid") === "true" ||
      el.className.includes("error");

    if (isReq || isErr) {
      failingForms.push({
        text: label ? label.innerText.substring(0, 30) : "Unlabeled Field",
      });
    }
    if (failingForms.length >= 5) break;
  }

  // --- 3. TEXT FRAGMENTS ---
  function hasOnlyColorDifference(element, parent) {
    const s1 = window.getComputedStyle(element);
    const s2 = window.getComputedStyle(parent);
    if (s1.color === s2.color) return false;
    return (
      s1.fontWeight === s2.fontWeight &&
      s1.fontStyle === s2.fontStyle &&
      s1.textDecorationLine === s2.textDecorationLine &&
      s1.borderBottomStyle === s2.borderBottomStyle &&
      s1.backgroundColor === s2.backgroundColor
    );
  }

  const failingFragments = [];
  const allElements = document.body.getElementsByTagName("*");
  for (const el of allElements) {
    if (
      el.offsetParent === null ||
      ["SCRIPT", "STYLE", "A", "BUTTON", "INPUT", "NAV"].includes(el.tagName)
    )
      continue;

    const hasDirectText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.nodeValue.trim().length > 0
    );
    if (hasDirectText && el.parentElement) {
      if (hasOnlyColorDifference(el, el.parentElement)) {
        failingFragments.push({ text: el.innerText.substring(0, 40) });
      }
    }
    if (failingFragments.length >= 5) break;
  }

  const hasFailures =
    failingLinks.length > 0 ||
    failingForms.length > 0 ||
    failingFragments.length > 0;
  const result = {
    pageTitle: document.title,
    computedVerdict: hasFailures ? "FAIL" : "PASS",
  };

  if (failingLinks.length > 0) result.links = failingLinks;
  if (failingForms.length > 0) result.formElements = failingForms;
  if (failingFragments.length > 0) result.textFragments = failingFragments;

  return result;
}
