export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";
export const relevantElements = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[aria-current]",
  "[aria-selected]",
];

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

- **If 'stateElements' has items:**
  Write: "Active/Selected states relying on color were found (G14 Check):\\n"
  Then list items using the 'text' and 'issue' fields.

- **If 'textFragments' has items:**
  Write: "Text content relying on color was found:\\n"
  Then list items using the 'text' field (Format: "- [text]\\n").

**FINAL OUTPUT JSON**
- If computedVerdict is "PASS": {"verdict": "PASS", "reason": "No use-of-color violations were found.", "title": "[pageTitle]"}
- If computedVerdict is "FAIL": {"verdict": "FAIL", "reason": "[Your generated lists]", "title": "[pageTitle]"}
`;

export function extractor(incompleteSelectors = []) {
  // --- HELPERS ---
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

  /**
   * Checks if an element has a non-color visual cue (underline, border, bold, outline)
   * on BOTH :hover AND :focus states.
   */
  function hasValidVisualCues(element) {
    const states = [":hover", ":focus"];
    let hasHoverCue = false;
    let hasFocusCue = false;

    // Check for browser default outline on focus (if not overridden)
    if (element.style.outline !== "none" && element.style.outline !== "0px") {
      // We assume default focus ring exists unless we find a rule removing it
      hasFocusCue = true;
    }

    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.selectorText) continue;

          // Check for Hover/Focus rules matching this element
          for (const state of states) {
            if (!rule.selectorText.includes(state)) continue;

            const selectors = rule.selectorText.split(",");
            for (const sel of selectors) {
              if (!sel.includes(state)) continue;

              // Strip pseudo-class to test if the base selector matches our element
              const baseSel = sel.replace(state, "").trim();
              let matches = false;
              try {
                if (
                  baseSel === "" ||
                  baseSel === "a" ||
                  element.matches(baseSel)
                ) {
                  matches = true;
                }
              } catch (e) {}

              if (matches) {
                const s = rule.style;
                // Check for "Valid" Cues (Decoration, Border, Outline, Bold)
                const hasCue =
                  (s.textDecorationLine &&
                    s.textDecorationLine.includes("underline")) ||
                  (s.textDecoration &&
                    s.textDecoration.includes("underline")) ||
                  (s.borderBottomStyle && s.borderBottomStyle !== "none") ||
                  (s.borderStyle && s.borderStyle !== "none") ||
                  (s.outlineStyle && s.outlineStyle !== "none") ||
                  (s.fontWeight &&
                    (s.fontWeight === "bold" || parseInt(s.fontWeight) >= 700));

                if (hasCue) {
                  if (state === ":hover") hasHoverCue = true;
                  if (state === ":focus") hasFocusCue = true;
                }

                // Check if they explicitly REMOVED the default focus ring
                if (
                  state === ":focus" &&
                  (s.outline === "none" || s.outlineWidth === "0px")
                ) {
                  hasFocusCue = false; // Reset unless they added something else
                }
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    // G183 requires cues on BOTH hover and focus
    return hasHoverCue && hasFocusCue;
  }

  // --- 1. LINK LOGIC (G183) ---
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

    if (hasStaticCue) continue; // Pass if underlined by default

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
      } else if (!hasBold && !hasValidVisualCues(link)) {
        // Updated to check BOTH hover and focus
        failingLinks.push({
          text: link.innerText.substring(0, 40),
          issue: `Contrast OK (${ratio.toFixed(
            2
          )}:1) but missing visual cue on Hover or Focus.`,
        });
      }
    }
    if (failingLinks.length >= 5) break;
  }

  // --- 2. FORM LOGIC (G14/F81) ---
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

  // --- 3. STATE INDICATORS (G14 - Active/Selected States) ---
  const failingStates = [];
  const stateElements = document.querySelectorAll(
    "[aria-current], [aria-selected='true']"
  );

  for (const el of stateElements) {
    if (el.offsetParent === null) continue;

    // Ignore if explicitly set to false/null
    if (el.getAttribute("aria-current") === "false") continue;

    const s = window.getComputedStyle(el);
    const hasShapeCue =
      (s.textDecorationLine && s.textDecorationLine.includes("underline")) ||
      (s.borderStyle && s.borderStyle !== "none") ||
      (s.outlineStyle && s.outlineStyle !== "none") ||
      parseInt(s.fontWeight) >= 700 ||
      s.fontWeight === "bold";

    // Check for icons in pseudo-elements
    const beforeContent = window.getComputedStyle(el, "::before").content;
    const afterContent = window.getComputedStyle(el, "::after").content;
    const hasIcon =
      (beforeContent && beforeContent !== "none") ||
      (afterContent && afterContent !== "none");

    if (!hasShapeCue && !hasIcon) {
      failingStates.push({
        text: el.innerText.substring(0, 30) || el.tagName,
        issue:
          "Selected state relies only on color (missing bold, underline, or icon).",
      });
    }
    if (failingStates.length >= 5) break;
  }

  // --- 4. TEXT FRAGMENTS (G182) ---
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
    failingStates.length > 0 ||
    failingFragments.length > 0;

  const result = {
    pageTitle: document.title,
    computedVerdict: hasFailures ? "FAIL" : "PASS",
  };

  if (failingLinks.length > 0) result.links = failingLinks;
  if (failingForms.length > 0) result.formElements = failingForms;
  if (failingStates.length > 0) result.stateElements = failingStates;
  if (failingFragments.length > 0) result.textFragments = failingFragments;

  return result;
}
