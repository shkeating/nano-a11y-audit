export const id = "1.4.4";
export const earlId = "WCAG22:resize-text";

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.4 Resize Text.
Task: Evaluate elements that restrict text resizing or cause clipping when text is zoomed.

**CRITERIA**
1. **Clipping:** Text containers with fixed heights (in px) and \`overflow: hidden\` or \`clip\` are high risks for clipping text when it expands (F69).
2. **Form Controls:** Text inputs with fixed heights (in px) may cut off text when the font size increases (F80).
3. **Exceptions:**
    - Elements with \`overflow: visible\`, \`overflow: auto\`, or \`overflow: scroll\` allow expansion.
    - Elements with \`min-height\` allow expansion.
    - Elements using relative units (em, rem, %) for height are usually safe.

**INSTRUCTIONS**
- Review the 'suspiciousElements' list.
- **Verdict:**
    - If the list is empty, PASS.
    - If items exist, analyze them. If an item has "Risk: High", it is a likely FAIL.
    - Use your judgment: does the combination of styles (e.g. fixed height + overflow hidden) prevent text from growing?
- **Reasoning:** Cite the specific failure (F69 or F80) and the element details.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Text resizing issues found:\\n- [Element]: [Issue] (F#)..."}
- If no violations: {"verdict": "PASS", "reason": "No text resizing restrictions found."}
`;

export const relevantElements = [
    "[style*='height']",
    "[style*='overflow']",
    "input",
    "textarea",
    ".fail-fixed-height-overflow", /* for testing */
    "div", "p", "section", "article", "span" /* Catch-all for elements with CSS classes we can't see in selector */
];

export function extractor() {
  const suspiciousElements = [];

  function isVisible(el) {
    if (!el) return false;
    if (el.tagName === "BODY" || el.tagName === "HTML") return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function hasTextContent(el) {
    // Check if element has direct text nodes or text in children
    // Inputs always have text content potential (value)
    if (['INPUT', 'TEXTAREA'].includes(el.tagName)) return true;
    return el.textContent.trim().length > 0;
  }

  // Iterate over all elements to check computed styles (since CSS classes might set styles, not just inline styles)
  // Optimization: Select elements that might have text
  const candidates = document.querySelectorAll("div, p, h1, h2, h3, h4, h5, h6, span, li, td, th, section, article, nav, aside, footer, header, input, textarea, label, button, a");

  for (const el of candidates) {
    if (!isVisible(el)) continue;

    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const height = style.height;
    const maxHeight = style.maxHeight;
    const whiteSpace = style.whiteSpace;
    const tagName = el.tagName;

    let issue = null;
    let risk = "Low";

    const isInput = tagName === "INPUT" || tagName === "TEXTAREA";

    // F80: Input with fixed height (Inline check)
    if (isInput) {
       if (el.style.height && el.style.height.includes("px")) {
           risk = "Medium";
           issue = "Input with fixed height (F80)";
       }
    }

    // F69: Overflow hidden + fixed height (Inline check)
    const inlineHeight = el.style.height;
    const inlineMaxHeight = el.style.maxHeight;

    if (
        (overflowY === "hidden" || overflowY === "clip") &&
        (inlineHeight.includes("px") || inlineMaxHeight.includes("px")) &&
        hasTextContent(el) &&
        !isInput
    ) {
        risk = "High";
        issue = "Fixed height container with overflow hidden (F69)";
    }

    // Also check for `white-space: nowrap` + `overflow: hidden` (Truncation)
    if (
        (overflowX === "hidden" || overflowX === "clip") &&
        whiteSpace === "nowrap" &&
        hasTextContent(el)
    ) {
        risk = "High";
        issue = "Text truncation prevented by nowrap + overflow hidden (F69)";
    }

    if (issue) {
         suspiciousElements.push({
            element: `<${tagName.toLowerCase()} class="${el.className}" id="${el.id}">`,
            snippet: isInput ? (el.value || "[Input]") : el.textContent.substring(0, 50),
            issue: issue,
            risk: risk,
            styles: `height: ${inlineHeight || "computed " + height}; overflow: ${overflowY}; white-space: ${whiteSpace}`
        });
    }
  }

  // Advanced: Check stylesheets for class-based failures
  try {
      for (const sheet of document.styleSheets) {
          try {
              for (const rule of sheet.cssRules) {
                  if (rule.style) {
                      const h = rule.style.height;
                      const mh = rule.style.maxHeight;
                      const ov = rule.style.overflow;
                      const ovy = rule.style.overflowY;
                      const ovx = rule.style.overflowX;
                      const ws = rule.style.whiteSpace;

                      const isFixed = (h && h.includes("px")) || (mh && mh.includes("px"));
                      const isHidden = (ov && (ov.includes("hidden") || ov.includes("clip"))) ||
                                       (ovy && (ovy.includes("hidden") || ovy.includes("clip")));
                      const isNoWrap = (ws && ws.includes("nowrap"));
                      const isHiddenX = (ov && (ov.includes("hidden") || ov.includes("clip"))) ||
                                        (ovx && (ovx.includes("hidden") || ovx.includes("clip")));

                      // Check for matching elements safely
                      let matches = [];
                      try {
                          matches = document.querySelectorAll(rule.selectorText);
                      } catch (e) {
                          // Invalid selector or not supported
                          continue;
                      }

                      // Check for F69: Fixed height + Overflow hidden (Containers)
                      if (isFixed && isHidden) {
                          matches.forEach(el => {
                              if (isVisible(el) && hasTextContent(el) && !['INPUT', 'TEXTAREA'].includes(el.tagName)) {
                                  if (!suspiciousElements.some(i => i.element.includes(el.className))) {
                                      suspiciousElements.push({
                                          element: `<${el.tagName.toLowerCase()} class="${el.className}">`,
                                          snippet: el.textContent.substring(0, 50),
                                          issue: "Class-based fixed height with overflow hidden (F69)",
                                          risk: "High",
                                          styles: `rule: ${rule.selectorText} { height: ${h}; overflow: ${ov || ovy} }`
                                      });
                                  }
                              }
                          });
                      }

                      // Check for F80: Fixed height Inputs (Inputs only, NO overflow hidden required)
                      if (isFixed) {
                          matches.forEach(el => {
                              if (isVisible(el) && ['INPUT', 'TEXTAREA'].includes(el.tagName)) {
                                   if (!suspiciousElements.some(i => i.element.includes(el.className))) {
                                      suspiciousElements.push({
                                          element: `<${el.tagName.toLowerCase()} class="${el.className}">`,
                                          snippet: el.value || "[Input]",
                                          issue: "Class-based fixed height input (F80)",
                                          risk: "Medium",
                                          styles: `rule: ${rule.selectorText} { height: ${h} }`
                                      });
                                   }
                              }
                          });
                      }

                      // Check for Truncation (nowrap + overflow hidden)
                      if (isHiddenX && isNoWrap) {
                           matches.forEach(el => {
                              if (isVisible(el) && hasTextContent(el)) {
                                  if (!suspiciousElements.some(i => i.element.includes(el.className))) {
                                      suspiciousElements.push({
                                          element: `<${el.tagName.toLowerCase()} class="${el.className}">`,
                                          snippet: el.textContent.substring(0, 50),
                                          issue: "Class-based nowrap with overflow hidden (F69)",
                                          risk: "High",
                                          styles: `rule: ${rule.selectorText} { white-space: nowrap; overflow: ${ov || ovx} }`
                                      });
                                  }
                              }
                           });
                      }
                  }
              }
          } catch (e) {
              // cross-origin stylesheet access might fail
              continue;
          }
      }
  } catch (e) {
      console.log("Stylesheet scan error", e);
  }

  if (suspiciousElements.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No text resizing restrictions found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    suspiciousElements: suspiciousElements.slice(0, 15), // Limit for context window
  };
}
