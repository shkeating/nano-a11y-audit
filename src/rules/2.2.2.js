export const id = "2.2.2";
export const earlId = "WCAG22:pause-stop-hide";

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 2.2.2 Pause, Stop, Hide.
Task: Evaluate moving, blinking, or scrolling content.

**CRITERIA**
1. **Duration:** Content that moves/blinks for more than **5 seconds** automatically must have a user control.
2. **Suspicious Elements:** Elements with IDs/Classes like "blink" or "marquee" usually indicate script-based movement and should be flagged for manual review.

**INSTRUCTIONS**
- Review the 'movingElements' list.
- **Verdict:** If the list is empty, PASS. If items exist, FAIL.
- **Reasoning:** You MUST list **EVERY** item found in the input. Do not summarize or skip items.
- Use a bulleted list format: "- [Type] on [Element]: [Details]"

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Moving content found without pause controls:\\n- [Item 1]\\n- [Item 2]..."}
- If no violations: {"verdict": "PASS", "reason": "No moving content violations found."}
`;

export function extractor() {
  const movingElements = [];

  // 1. HELPERS
  function parseDuration(timeStr) {
    if (!timeStr) return 0;
    const floatVal = parseFloat(timeStr);
    if (timeStr.includes("ms")) return floatVal / 1000;
    return floatVal;
  }

  function isEssential(el) {
    const role = el.getAttribute("role");
    const classes = (el.className || "").toString().toLowerCase();
    return (
      role === "progressbar" ||
      role === "status" ||
      classes.includes("spinner") ||
      classes.includes("loader") ||
      classes.includes("loading")
    );
  }

  function isVisible(el) {
    if (el.offsetParent !== null) return true;
    const style = window.getComputedStyle(el);
    // Allow visibility:hidden (it might be in the 'blink off' state) but check display
    return style.display !== "none";
  }

  // 2. SCAN FOR CSS ANIMATIONS
  const allElements = document.querySelectorAll("body *");

  for (const el of allElements) {
    if (["SCRIPT", "STYLE", "LINK", "META"].includes(el.tagName)) continue;
    if (!isVisible(el)) continue;

    const style = window.getComputedStyle(el);
    const animName = style.animationName;

    if (animName && animName !== "none") {
      const duration = parseDuration(style.animationDuration);
      const iterationCount = style.animationIterationCount;

      let totalDuration = 0;
      if (iterationCount === "infinite") {
        totalDuration = Infinity;
      } else {
        totalDuration = duration * parseFloat(iterationCount);
      }

      if (totalDuration > 5 && !isEssential(el)) {
        movingElements.push({
          type: "CSS Animation",
          element: `<${el.tagName.toLowerCase()} class="${el.className}">`,
          details: `Duration: ${
            iterationCount === "infinite" ? "Infinite" : totalDuration + "s"
          }`,
        });
      }
    }
  }

  // 3. SCAN FOR SVG ANIMATIONS
  const svgAnims = document.querySelectorAll("animate, animateTransform");
  svgAnims.forEach((anim) => {
    const parentSvg = anim.closest("svg");
    if (!parentSvg || !isVisible(parentSvg)) return;

    const dur = parseDuration(anim.getAttribute("dur"));
    const repeat = anim.getAttribute("repeatCount");

    if (repeat === "indefinite" || dur > 5) {
      movingElements.push({
        type: "SVG Animation",
        element: "SVG Object",
        details: `Attribute: ${anim.getAttribute("attributeName")}, Duration: ${
          repeat === "indefinite" ? "Infinite" : dur + "s"
        }`,
      });
    }
  });

  // 4. SCAN FOR SUSPICIOUS JS (Fixed: Removed buggy duplication check)
  const suspiciousTerms = [
    "blink",
    "marquee",
    "ticker",
    "scroller",
    "auto-scroll",
  ];

  for (const el of allElements) {
    if (!isVisible(el)) continue;

    const id = (el.id || "").toLowerCase();
    const className = (el.className || "").toString().toLowerCase();

    if (
      suspiciousTerms.some(
        (term) => id.includes(term) || className.includes(term)
      )
    ) {
      // Only report if it wasn't ALREADY caught as a CSS animation
      const style = window.getComputedStyle(el);
      if (!style.animationName || style.animationName === "none") {
        movingElements.push({
          type: "Potential JS Animation",
          element: `<${el.tagName.toLowerCase()} id="${el.id}" class="${
            el.className
          }">`,
          details: "Suspicious ID/Class detected (Manual Review Required)",
        });
      }
    }
  }

  // --- RESULT ---
  if (movingElements.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No moving content violations found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    movingElements: movingElements.slice(0, 10),
  };
}
