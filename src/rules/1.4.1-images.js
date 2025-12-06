export const id = "1.4.1-images";
export const earlId = "WCAG22:use-of-color"; // Maps to the same criteria in the report
export const relevantElements = ["img", "svg", "canvas"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.1 Use of Color.
Task: Analyze the provided image to determine if color is the ONLY means of conveying information.

**SCOPE**
- Focus on: Charts, graphs, maps, diagrams, and status indicators.
- Ignore: Photographs, logos, decorative images, and icons accompanied by text.

**CRITERIA**
1. **FAIL:** If the image is a data visualization (chart/graph) where categories are distinguished *solely* by color (e.g., a legend with colored squares but no labels on the chart segments).
2. **PASS:**
   - If the chart uses patterns, textures, or direct text labels to differentiate data.
   - If the image is a photograph or decorative.
   - If the image contains text that sufficiently explains the color-coded data.

**OUTPUT FORMAT**
Return a JSON object:
- Fail: {"verdict": "FAIL", "reason": "Chart/Diagram relies solely on color to distinguish categories (no labels/patterns)."}
- Pass: {"verdict": "PASS", "reason": "Image uses labels/patterns or is not a data visualization."}
`;

export function extractor() {
  const images = [];
  // Select images and potential chart containers
  const imageCandidates = document.querySelectorAll("img, svg, canvas");

  for (const el of imageCandidates) {
    const rect = el.getBoundingClientRect();
    // Filter out small icons or off-screen elements
    if (
      rect.width < 50 ||
      rect.height < 50 ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight
    )
      continue;

    // Filter out purely decorative/presentation items
    const role = el.getAttribute("role");
    if (role === "presentation" || role === "none") continue;

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
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No relevant chart/image candidates found.",
      pageTitle: document.title,
    };
  }

  // Return images for the sidepanel to process
  return {
    pageTitle: document.title,
    images: images.slice(0, 3), // Analyze top 3 candidates to save resources
  };
}
