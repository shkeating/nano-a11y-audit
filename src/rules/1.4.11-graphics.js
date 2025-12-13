export const id = "1.4.11-graphics";
export const earlId = "WCAG22:non-text-contrast";
// Note: earlId is the same because it maps to the same WCAG criterion
export const relevantElements = [
  "svg",
  "img",
  "canvas",
  "[role='img']",
  "[role='graphics-symbol']",
  "[role='graphics-document']",
];

export const systemPrompt = `
You are a WCAG Graphics Contrast Auditor.
Task: Analyze the graphic (Icon, Chart, or Diagram) to ensure all **essential visual parts** are visible.

**CRITERIA**
- **FAIL:** If ANY essential part (icon shape, chart bar, line) is Pale Yellow, Light Gray, or Pastel (< 3:1).
- **FAIL:** If an icon on a white background is very faint.
- **PASS:** If all meaningful shapes are High Contrast (Black, Dark Blue, Red, etc.).

**INSTRUCTIONS**
- Ignore text (text is checked by a different rule).
- Ignore decorative details (shadows, gradients) unless they are the only thing visible.
- Focus on the *meaningful* shapes.

**OUTPUT FORMAT**
Return JSON only.
{"verdict": "FAIL", "reason": "Graphic contains low contrast parts (Pale Yellow)."}
{"verdict": "PASS", "reason": "All graphic parts are high contrast."}
`;

export function extractor() {
  const images = [];
  const candidates = document.querySelectorAll(
    "svg, img, canvas, [role='img'], [role='graphics-symbol'], [role='graphics-document']"
  );

  let count = 0;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) continue;

    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    )
      continue;

    count++;
    if (count > 4) break; // Limit to 4 graphics to prevent timeout

    const uniqueId = "nano-graphic-" + Math.random().toString(36).substr(2, 9);
    el.setAttribute("data-nano-graphic-id", uniqueId);

    // Smart naming for graphics
    let accName =
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("name") ||
      "";
    if (!accName && (el.tagName === "SVG" || el.tagName === "CANVAS")) {
      accName = `<${el.tagName}> Graphic`;
    }
    accName = accName.trim().substring(0, 30);

    let snippet = el.outerHTML.substring(0, 80).replace(/[\n\r]+/g, " ");
    if (el.outerHTML.length > 80) snippet += "...";

    // Single pass check for graphics (no focus state needed)
    images.push({
      src: "[Graphic Screenshot]",
      name: accName,
      html: snippet,
      alt: "Task: Identify low contrast parts in this graphic. Fail if any essential shape is too faint.",
      trigger: "default",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      selector: `[data-nano-graphic-id="${uniqueId}"]`,
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No relevant graphics found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: images,
  };
}
