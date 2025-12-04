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
- Fail if an element removes the default focus outline (e.g., outline: none) without providing an alternative visible indicator (border, background, box-shadow, text-decoration).
- Fail if the provided focus styles are fully transparent (e.g., rgba(0,0,0,0)) or width is 0.

**DATA INTERPRETATION**
- 'focusStyles': Contains the specific CSS properties detected for the :focus state.
- 'outlineRemoved': Boolean, true if outline is set to none/0.
- 'hasAlternative': Boolean, true if another property (border, background, shadow) is modified.

**VERDICT INSTRUCTION**
1. If 'focusStyles' is empty or implies browser default (no overrides found) -> PASS.
2. If 'outlineRemoved' is true AND 'hasAlternative' is false -> FAIL.
3. If 'outlineRemoved' is true AND 'hasAlternative' is true -> PASS (Assume the alternative is visible unless the style values explicitly show transparency).

**OUTPUT FORMAT**
Return a JSON object with:
- "verdict": "PASS" or "FAIL"
- "reason": A detailed summary of findings. IF THE VERDICT IS FAIL: You MUST list the 'element' identifier string for at least 3 failing items in this summary so the user knows exactly what to fix.
- "failures": A list of objects { "element": "string", "reason": "string" } for any failures.
`;

export function extractor(incompleteSelectors = []) {
  function isTransparent(color) {
    if (!color) return false;
    if (color === "transparent") return true;
    if (color === "rgba(0, 0, 0, 0)") return true;
    const match = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)/
    );
    if (match && match[4] && parseFloat(match[4]) === 0) return true;
    return false;
  }

  function getFocusStyles(element) {
    let styles = {
      outlineStyle: null,
      outlineWidth: null,
      outlineColor: null,
      borderStyle: null,
      borderColor: null,
      backgroundColor: null,
      boxShadow: null,
      textDecoration: null,
    };

    let foundFocusRule = false;

    // Iterate stylesheets to find :focus rules matching this element
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.selectorText || !rule.selectorText.includes(":focus"))
            continue;

          const selectors = rule.selectorText.split(",");
          for (const sel of selectors) {
            if (!sel.includes(":focus")) continue;

            // Remove pseudo-classes to check base match
            const baseSel = sel
              .replace(/:focus-visible/g, "")
              .replace(/:focus/g, "")
              .trim();

            let matches = false;
            try {
              // If baseSel is empty, it matches universal context, otherwise check match
              if (baseSel === "" || element.matches(baseSel)) {
                matches = true;
              }
            } catch (e) {
              // Ignore invalid selectors
            }

            if (matches) {
              foundFocusRule = true;
              const s = rule.style;

              if (s.outlineStyle) styles.outlineStyle = s.outlineStyle;
              if (s.outlineWidth) styles.outlineWidth = s.outlineWidth;
              if (s.outlineColor) styles.outlineColor = s.outlineColor;
              if (s.outline) {
                // simple parse attempt for shorthand
                if (s.outline === "none" || s.outline === "0") {
                  styles.outlineStyle = "none";
                }
              }

              if (s.borderStyle) styles.borderStyle = s.borderStyle;
              if (s.borderColor) styles.borderColor = s.borderColor;
              if (s.backgroundColor) styles.backgroundColor = s.backgroundColor;
              if (s.boxShadow) styles.boxShadow = s.boxShadow;
              if (s.textDecoration) styles.textDecoration = s.textDecoration;
              if (
                s.color &&
                s.color !== window.getComputedStyle(element).color
              ) {
                // Text color change is also a valid indicator
                styles.color = s.color;
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Check inline styles
    if (element.style.outlineStyle)
      styles.outlineStyle = element.style.outlineStyle;
    if (element.style.outline === "none") styles.outlineStyle = "none";

    return { foundFocusRule, styles };
  }

  const elementsToCheck = [];
  if (incompleteSelectors && incompleteSelectors.length > 0) {
    incompleteSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) elementsToCheck.push(el);
    });
  } else {
    const candidates = document.querySelectorAll(
      "a, button, input, select, textarea, [tabindex]"
    );
    candidates.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      )
        return;
      if (el.disabled || el.getAttribute("aria-hidden") === "true") return;
      if (el.hasAttribute("tabindex") && el.getAttribute("tabindex") === "-1")
        return;
      elementsToCheck.push(el);
    });
  }

  const failures = [];
  const analyzed = [];
  const sample = elementsToCheck.slice(0, 50); // Limit sample size

  for (const el of sample) {
    const { foundFocusRule, styles } = getFocusStyles(el);

    // Heuristics for the prompt data
    const outlineRemoved =
      styles.outlineStyle === "none" ||
      styles.outlineStyle === "hidden" ||
      styles.outlineWidth === "0" ||
      styles.outlineWidth === "0px" ||
      isTransparent(styles.outlineColor);

    const hasAlternative =
      (styles.borderStyle &&
        styles.borderStyle !== "none" &&
        !isTransparent(styles.borderColor)) ||
      (styles.backgroundColor && !isTransparent(styles.backgroundColor)) ||
      (styles.boxShadow && styles.boxShadow !== "none") ||
      (styles.textDecoration && styles.textDecoration !== "none") ||
      !!styles.color;

    // Filter properties to only send non-null values to save tokens
    const cleanStyles = {};
    Object.keys(styles).forEach((key) => {
      if (styles[key]) cleanStyles[key] = styles[key];
    });

    // --- IDENTIFIER GENERATION ---
    // Creates a specific ID string like: button#submit-btn.primary (Text: "Submit")
    let idStr = el.id ? `#${el.id}` : "";
    let classStr = el.className
      ? `.${el.className.split(" ")[0]}` // Grab just the first class for brevity
      : "";
    let textStr = (
      el.innerText ||
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      ""
    )
      .trim()
      .substring(0, 20)
      .replace(/\n/g, " ");

    const identifier = `<${el.tagName.toLowerCase()}${idStr}${classStr}>${
      textStr ? ` "${textStr}..."` : ""
    }`;

    const item = {
      element: identifier,
      focusStyles: cleanStyles,
      outlineRemoved,
      hasAlternative,
      usingBrowserDefault: !foundFocusRule && !el.style.outline,
    };

    analyzed.push(item);

    if (item.outlineRemoved && !item.hasAlternative) {
      failures.push(item);
    }
  }

  return {
    pageTitle: document.title,
    computedVerdict: failures.length > 0 ? "FAIL" : "PASS",
    items: analyzed,
  };
}
