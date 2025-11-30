export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. SYSTEM PROMPT (Strictly uses computedVerdict)
export const systemPrompt = `
You are a violation reporter.
Task: Format the input JSON data into a simple bulleted list.

**VERDICT INSTRUCTION**
- The input JSON contains a 'computedVerdict' field.
- **You MUST use this value** for the output 'verdict'. Do not calculate it yourself.

**SECTION INSTRUCTIONS**
- **If 'links' has items:**
  Write: "Links relying on color were found:\\n"
  Then list items using the 'text' field (Format: "- [text]\\n").

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
export function extractor() {
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

  function isInsideNav(element) {
    return element.closest("nav") !== null || element.closest('[role="navigation"]') !== null;
  }

  // Pre-scan stylesheets for hover rules
  const hoverRules = [];
  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        for (const rule of rules) {
          if (rule.type === CSSRule.STYLE_RULE && rule.selectorText.includes(":hover")) {
            // Store selector and style for later checking
            // We store the raw selector to handle splitting later if needed,
            // or just iterate and check matches.
            // Note: Handling comma-separated selectors is important.
            const selectors = rule.selectorText.split(",");
            for (const sel of selectors) {
              if (sel.includes(":hover")) {
                 hoverRules.push({
                   selector: sel.trim(),
                   style: rule.style
                 });
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet access might fail
      }
    }
  } catch (e) {
    // Safety catch
  }

  function checkHoverSafety(link) {
    // If we couldn't access any rules, assume pass to avoid false positives?
    // Or if hoverRules is empty, it means no hover styles defined (safe).
    if (hoverRules.length === 0) return true;

    let hasHoverChange = false;
    let safeHover = false;

    for (const rule of hoverRules) {
      // Create a selector that applies to the element by stripping :hover
      // This is a heuristic.
      // "a:hover" -> "a"
      // ".nav-link:hover" -> ".nav-link"
      // "li:hover a" -> "li a" (NOTE: This implies the li is hovered, but the style applies to a. The link is the subject.)
      // "a:hover::after" -> "a::after" (matches() might fail on pseudo-element)

      try {
        const cleanSel = rule.selector.replace(/:hover/g, "");
        // Filter out pseudo-elements from selector for matching check
        // e.g. "a::after" -> "a". matches() handles "a".
        // If cleanSel is "a::after", link.matches("a::after") throws.
        // We only care about styles applied to the element itself, or if pseudo-element provides cue.
        // If pseudo-element provides cue, we can't easily check computed style of it from rule.style.
        // Assume rule applies to element if it matches stripped selector.

        const baseSel = cleanSel.split("::")[0].split(":")[0]; // overly aggressive stripping?
        // Better: try matching. If it throws, ignore.

        // We'll trust replace(/:hover/g, "") covers most cases.
        // If it contains ::, element.matches might throw or return false.

        // If the rule is for a pseudo-element (e.g. a:hover::after),
        // the visual change is on the pseudo-element. This counts as a visual change!
        // But we can't check 'link.matches' against 'a::after'.
        // We can check 'link.matches' against 'a'.

        // Let's rely on a simplified check:
        // If rule.selector contains ::, assume it adds something visual?
        // Or check if base element matches.

        const isPseudo = rule.selector.includes("::") || (rule.selector.split(":").length > 2 && !rule.selector.includes(":not"));

        // Use a version of selector without pseudos for matching the element
        const matchSel = rule.selector.replace(/:hover/g, "").split("::")[0];

        if (link.matches(matchSel)) {
           hasHoverChange = true;

           if (isPseudo) {
             // If a pseudo-element is involved on hover, assume it adds content/style -> Safe.
             safeHover = true;
           } else {
             // Check properties on the element itself
             const s = rule.style;
             const changesColor = s.color !== "";
             const changesOther =
               (s.textDecorationLine && s.textDecorationLine !== "none") ||
               (s.textDecoration && s.textDecoration !== "none") ||
               (s.borderBottomStyle && s.borderBottomStyle !== "none") ||
               (s.borderBottom && s.borderBottom !== "none") ||
               (s.border && s.border !== "none") ||
               (s.fontWeight && s.fontWeight !== "normal") ||
               (s.backgroundColor && s.backgroundColor !== "") ||
               (s.background && s.background !== "") ||
               (s.outline && s.outline !== "none");

             if (changesOther) {
               safeHover = true;
             }
           }
        }
      } catch (e) {
        // Selector parsing error
      }
    }

    // If no hover rules apply, safe (no change).
    if (!hasHoverChange) return true;

    // If changes found, at least one must be safe.
    return safeHover;
  }


  const failingLinks = [];
  const links = Array.from(document.querySelectorAll("a"));

  for (const link of links) {
    if (link.offsetParent === null) continue;

    const parentTag = link.parentElement ? link.parentElement.tagName : "";
    if (
      ["H1", "H2", "H3", "H4", "H5", "H6"].includes(parentTag) ||
      ["H1", "H2", "H3", "H4", "H5", "H6"].includes(link.tagName)
    ) {
      continue;
    }

    if (isInsideNav(link)) {
      // Special check for nav links (Hover state)
      if (!checkHoverSafety(link)) {
        // Fail if relies on color for hover
         const txt = link.innerText.trim();
         if (txt.length > 0) {
            failingLinks.push({ text: `[Nav Link Hover] ${txt.substring(0, 40)}` });
         }
      }
      // Implicitly passes the default state check (no underline needed)

    } else {
      // Standard check (Default state)
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
    }

    if (failingLinks.length >= 5) break;
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

  // --- SMART RETURN ---
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
