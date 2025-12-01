export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";
export const relevantElements = ["a", "button", "input", "select", "textarea"];

// 1. SYSTEM PROMPT
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

// 2. EXTRACTOR
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
   * REVISED Hover Check
   * Iterates all rules to simulate cascade (last match wins).
   */
  function hasValidHoverStyle(element) {
    let hasCue = false; // Default assumption: no hover cue

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

            // Check if this rule applies to our element
            const baseSel = sel.replace(/:hover/g, "").trim();
            const matches =
              baseSel === "" || baseSel === "a" || element.matches(baseSel);

            if (matches) {
              const s = rule.style;

              // Check for adding a cue (Underline or Border)
              if (
                s.textDecorationLine?.includes("underline") ||
                s.textDecoration?.includes("underline") ||
                (s.borderBottomStyle && s.borderBottomStyle !== "none")
              ) {
                hasCue = true;
              }
              // Check for REMOVING a cue (text-decoration: none)
              else if (
                s.textDecorationLine?.includes("none") ||
                s.textDecoration === "none"
              ) {
                hasCue = false;
              }
            }
          }
        }
      } catch (e) {
        // CORS blocked
        continue;
      }
    }
    return hasCue;
  }

  // --- 1. LINK LOGIC (Smart Mode) ---
  const failingLinks = [];
  let linksToCheck = [];

  if (incompleteSelectors && incompleteSelectors.length > 0) {
    // Only check what Axe flagged as "Incomplete"
    incompleteSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) linksToCheck.push(el);
    });
  } else {
    // Fallback: Scan everything
    linksToCheck = Array.from(document.querySelectorAll("a:not(nav a)"));
  }

  for (const link of linksToCheck) {
    if (link.offsetParent === null) continue;
    const parent = link.parentElement;
    if (!parent) continue;

    const parentTag = parent.tagName;
    if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(parentTag)) continue;

    const s = window.getComputedStyle(link);
    const hasUnderline =
      s.textDecorationLine.includes("underline") ||
      s.textDecoration.includes("underline");
    const hasBorder =
      s.borderBottomStyle !== "none" && parseFloat(s.borderBottomWidth) > 0;
    const hasBold = parseInt(s.fontWeight) >= 700 || s.fontWeight === "bold";

    // Static check
    if (hasUnderline || hasBorder) continue;

    const linkColor = s.color;
    const parentColor = window.getComputedStyle(parent).color;
    const ratio = getContrastRatio(linkColor, parentColor);

    if (ratio !== null) {
      // 1. Hard Fail: Contrast too low (< 3:1)
      if (ratio < 3.0) {
        failingLinks.push({
          text: link.innerText.substring(0, 40),
          issue: `Contrast ${ratio.toFixed(2)}:1 is too low (<3:1).`,
        });
      }
      // 2. Conditional Fail: Contrast OK, but NO visual cue on hover
      // We explicitly check !hasValidHoverStyle here.
      else if (!hasBold && !hasValidHoverStyle(link)) {
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
    const isInv = el.getAttribute("aria-invalid") === "true";
    const isErr =
      el.className.includes("error") || el.className.includes("invalid");

    if (isReq || isInv || isErr) {
      failingForms.push({
        text: label ? label.innerText.substring(0, 30) : "Unlabeled Field",
      });
    }
    if (failingForms.length >= 5) break;
  }

  // --- 3. TEXT FRAGMENT LOGIC ---
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
        "NAV",
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
          failingFragments.push({ text: txt.substring(0, 40) });
        }
      }
    }
    if (failingFragments.length >= 5) break;
  }

  // --- RESULT GENERATION ---
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
