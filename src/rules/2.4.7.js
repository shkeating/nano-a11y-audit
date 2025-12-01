export const id = "2.4.7";
export const earlId = "WCAG22:focus-visible";
export const relevantElements = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]",
];

export const systemPrompt = `
You are an accessibility auditor.
Task: Analyze the focus indicators for the provided elements.

**CRITERIA**
- WCAG 2.4.7 Focus Visible: Any keyboard operable user interface must have a mode of operation where the keyboard focus indicator is visible.
- Fail if an element removes the default focus outline (e.g., outline: none) without providing an alternative visible indicator (border, background, box-shadow).
- Fail if the focus indicator is transparent or matches the background color.

**DATA INTERPRETATION**
- 'focusStyles': The CSS properties that change on focus (e.g., outline, border, background-color).
- 'hasDefaultFocus': Boolean, true if no custom focus styles are found (and outline is not removed), meaning the browser default is used (PASS).
- 'outlineRemoved': Boolean, true if outline is set to none/0.
- 'alternativeIndicator': Boolean, true if border, background, or box-shadow changes on focus.

**VERDICT INSTRUCTION**
- If 'hasDefaultFocus' is true -> PASS.
- If 'outlineRemoved' is true AND 'alternativeIndicator' is false -> FAIL.
- If 'outlineRemoved' is true AND 'alternativeIndicator' is true -> PASS (unless styles match background, but assume PASS for simple indicator changes).
- If 'outlineRemoved' is false -> PASS (browser default or custom outline present).

**OUTPUT FORMAT**
Return a JSON object with:
- "verdict": "PASS" or "FAIL"
- "reason": A brief summary of findings.
- "failures": A list of objects { "element": "string", "reason": "string" } for any failures.
`;

export function extractor(incompleteSelectors = []) {
  function getComputedStyleProperty(el, prop) {
    return window.getComputedStyle(el).getPropertyValue(prop);
  }

  function isTransparent(color) {
      if (!color) return false;
      if (color === 'transparent') return true;
      if (color === 'rgba(0, 0, 0, 0)') return true;
      // Simple regex for rgba with 0 alpha
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)/);
      if (match && match[4] && parseFloat(match[4]) === 0) return true;
      return false;
  }

  function hasEffectiveFocusStyle(element) {
    let outlineRemoved = false;
    let alternativeIndicator = false;

    // Iterate stylesheets to find :focus rules matching this element
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.selectorText || !rule.selectorText.includes(":focus")) continue;

          const selectors = rule.selectorText.split(",");
          for (const sel of selectors) {
            if (!sel.includes(":focus")) continue;

            const baseSel = sel.replace(/:focus-visible/g, "").replace(/:focus/g, "").trim();

            let matches = false;
            try {
                // If baseSel is empty, it means strict ":focus" which applies if the element matches the universal selector context
                // But typically ":focus" matches everything. If it's attached to "input:focus", base is "input".
                if (baseSel === "" || element.matches(baseSel)) {
                    matches = true;
                }
            } catch (e) {
                // Ignore invalid selectors
            }

            if (matches) {
              const s = rule.style;

              // --- Outline Checks ---
              const styleOutlineStyle = s.outlineStyle;
              const styleOutlineWidth = s.outlineWidth;
              const styleOutlineColor = s.outlineColor;
              const styleOutline = s.outline;

              // Check for Outline Removal
              if (styleOutlineStyle === "none" || styleOutlineStyle === "hidden") {
                  outlineRemoved = true;
              }
              if (styleOutlineWidth === "0px" || styleOutlineWidth === "0") {
                  outlineRemoved = true;
              }
              if (isTransparent(styleOutlineColor)) {
                  outlineRemoved = true;
              }
              if (styleOutline === "none" || styleOutline === "0") {
                  outlineRemoved = true;
              }

              // --- Alternative Indicator Checks ---
              // Border
              if (s.borderStyle && s.borderStyle !== "none" && s.borderStyle !== "hidden") {
                  if (s.borderWidth && s.borderWidth !== "0px" && s.borderWidth !== "0") {
                      if (!isTransparent(s.borderColor)) alternativeIndicator = true;
                  }
              }
              if (s.borderColor && !isTransparent(s.borderColor) && (!s.borderWidth || (s.borderWidth !== "0px" && s.borderWidth !== "0"))) {
                 // Assuming implicit style/width if only color changed? Unlikely but possible.
                 // Actually changing border color usually implies visibility if width exists.
                 // But we can't verify base width easily without computation.
                 // Assume yes if color changes.
                 alternativeIndicator = true;
              }

              // Background
              if (s.backgroundColor && !isTransparent(s.backgroundColor)) {
                  alternativeIndicator = true;
              }

              // Box Shadow
              if (s.boxShadow && s.boxShadow !== "none") {
                  alternativeIndicator = true;
              }

              // Text Decoration (e.g. underline)
              if (s.textDecoration && !s.textDecoration.includes("none")) {
                  alternativeIndicator = true;
              }

              // Color (text color change)
              if (s.color) {
                  // Hard to check if it's same as background without computation, but any color change is an "attempt"
                  alternativeIndicator = true;
              }

              // --- Re-adding Outline ---
              // If this rule re-adds outline, it cancels the removal
              if (styleOutlineStyle && styleOutlineStyle !== "none" && styleOutlineStyle !== "hidden") {
                   if (!isTransparent(styleOutlineColor)) {
                        // And width?
                        if (styleOutlineWidth !== "0px" && styleOutlineWidth !== "0") {
                            outlineRemoved = false;
                        }
                   }
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Also check inline styles
    if (element.style.outline === "none" || element.style.outlineStyle === "none" || element.style.outlineWidth === "0px" || isTransparent(element.style.outlineColor)) {
        outlineRemoved = true;
    }

    // Check if inline styles provide alternative
    if (element.style.borderStyle && element.style.borderStyle !== "none" && !isTransparent(element.style.borderColor)) alternativeIndicator = true;
    if (element.style.backgroundColor && !isTransparent(element.style.backgroundColor)) alternativeIndicator = true;
    if (element.style.boxShadow && element.style.boxShadow !== "none") alternativeIndicator = true;

    return {
        outlineRemoved,
        alternativeIndicator
    };
  }

  const elementsToCheck = [];
  if (incompleteSelectors && incompleteSelectors.length > 0) {
    incompleteSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) elementsToCheck.push(el);
    });
  } else {
    // Find relevant interactive elements
    const candidates = document.querySelectorAll("a, button, input, select, textarea, [tabindex]");
    candidates.forEach(el => {
        // filter out hidden or disabled
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (el.disabled || el.getAttribute('aria-hidden') === 'true') return;
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') === '-1') return;

        elementsToCheck.push(el);
    });
  }

  const failures = [];
  const analyzed = [];

  // Increased sample size
  const sample = elementsToCheck.slice(0, 100);

  for (const el of sample) {
    const status = hasEffectiveFocusStyle(el);

    let label = el.innerText || el.getAttribute("aria-label") || el.getAttribute("name") || el.tagName;
    label = label.substring(0, 30).replace(/\n/g, " ");

    const item = {
        element: `<${el.tagName.toLowerCase()}> ${label}`,
        outlineRemoved: status.outlineRemoved,
        alternativeIndicator: status.alternativeIndicator,
        hasDefaultFocus: !status.outlineRemoved
    };

    analyzed.push(item);

    if (status.outlineRemoved && !status.alternativeIndicator) {
        failures.push(item);
    }
  }

  return {
    pageTitle: document.title,
    computedVerdict: failures.length > 0 ? "FAIL" : "PASS",
    items: failures.length > 0 ? failures : [],
    totalChecked: sample.length
  };
}
