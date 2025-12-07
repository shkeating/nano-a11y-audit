export const id = "1.4.1-images";
export const earlId = "WCAG22:use-of-color";
export const relevantElements = ["img", "svg", "canvas"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.1 Use of Color.
Task: Analyze the image/graphic to determine if color is the *sole* means of conveying information.

**IMPORTANT: ALT TEXT vs VISUALS**
- The user provides "Alt Text" for context, but your verdict must be based **ONLY ON THE VISUAL IMAGE**.
- Even if the Alt Text says "Offline" or "Year 7", you must FAIL the image if the **visual pixels** rely only on color to convey that same info.

**CATEGORIZATION & CRITERIA**

**1. CHART / GRAPH (Technique G111)**
- **FAIL** if data series are distinguished *only* by color (e.g., Red Bar vs Blue Bar) with a legend, and NO patterns (stripes, dots) or direct labels on the bars/slices.
- **PASS** if bars/slices have patterns, textures, or text labels directly identifying them.

**2. STATUS INDICATOR / ICON (Technique G14)**
- **FAIL** if status is conveyed *only* by color change (e.g., a "Green Dot" for Online vs "Red Dot" for Offline) without a change in shape or a visible text label next to it.
- **PASS** if the shape also changes (e.g., Green Checkmark vs Red X) or if text accompanies it (e.g., "Offline").

**3. MAP / COMPLEX DIAGRAM (Technique G14)**
- **FAIL** if regions or lines are identified *only* by color matching a legend (e.g., "Red Line = Subway", "Blue Line = Bus") without labels on the lines themselves.
- **PASS** if the regions/lines have direct text labels or distinct line styles (dotted vs solid).

**4. ALT TEXT CHECK (Failure F13)**
- **FAIL** if the image conveys state via color (e.g. Red = Error) but the provided Alt Text ignores it (e.g. alt="Status Icon").

**OUTPUT FORMAT**
Return a JSON object:
- Fail: {"verdict": "FAIL", "reason": "[Category]: [Specific missing non-color cue]"}
- Pass: {"verdict": "PASS", "reason": "[Category]: Uses [Pattern/Shape/Label] to distinguish information."}
`;

export function extractor() {
  const images = [];
  const imageCandidates = document.querySelectorAll("img, svg, canvas");

  for (const el of imageCandidates) {
    const rect = el.getBoundingClientRect();

    // Filter out tiny elements
    if (rect.width < 10 || rect.height < 10) continue;

    // Filter out decorative
    const role = el.getAttribute("role");
    if (role === "presentation" || role === "none") continue;

    // --- ROBUST TAGGING FIX ---
    // Instead of guessing a CSS path, we stamp a unique ID directly on the element.
    // This ensures the Side Panel finds the EXACT same node later.
    const uniqueId = "nano-" + Math.random().toString(36).substr(2, 9);
    el.setAttribute("data-nano-id", uniqueId);

    let src = "";
    if (el.tagName === "IMG") src = el.src;
    else src = "[SVG/Canvas Content]";

    images.push({
      src: src,
      alt:
        el.getAttribute("alt") ||
        el.getAttribute("aria-label") ||
        "No text alternative",
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      selector: `[data-nano-id="${uniqueId}"]`, // Simple, bulletproof selector
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No relevant graphical content found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: images.slice(0, 5),
  };
}
