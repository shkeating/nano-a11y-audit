export const id = "1.4.5";
export const earlId = "WCAG22:images-of-text";
export const relevantElements = ["img", "svg", "[role='img']"];

export const systemPrompt = `
You are an accessibility auditor checking WCAG 1.4.5 (Images of Text).
Determine if the text inside the image is essential or if it should be converted to real text.

**CRITERIA**
1. **FAIL:** The image contains text that is NOT a logo, brand name, or essential diagram.
2. **PASS:** The image contains no text, OR the text is part of a logo/brand, OR the text is essential (e.g., a map, chart, or screenshot).

**OUTPUT**
Return a JSON object:
- {"verdict": "FAIL", "reason": "Image contains non-essential text '[text]'. Use CSS text instead."}
- {"verdict": "PASS", "reason": "Image is a logo/diagram."}
`;

export async function extractor() {
  const elements = Array.from(
    document.querySelectorAll("img, svg, [role='img']")
  );
  const candidates = [];

  // Feature Detect: Check if the Shape Detection API is available
  const hasTextDetector = "TextDetector" in window;
  let detector = null;

  if (hasTextDetector) {
    try {
      // @ts-ignore - TextDetector is experimental
      detector = new window.TextDetector();
    } catch (e) {
      console.warn("TextDetector initialization failed:", e);
    }
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  for (const el of elements) {
    if (!isVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) continue; // Skip tiny icons

    // --- OPTIMIZATION: NATIVE SHAPE DETECTION ---
    if (detector && el.tagName === "IMG") {
      // TextDetector primarily supports <img>, <canvas>, <video>
      try {
        // Run the fast local check
        const detectedText = await detector.detect(el);

        // If the browser is 100% sure there is no text, SKIP the AI check.
        if (detectedText.length === 0) {
          continue;
        }
        // If text IS found, we still need AI to tell us if it's a "Logo" (Pass) or "Bad Image Text" (Fail)
      } catch (err) {
        // If detection crashes (e.g. tainted canvas/security), ignore and fall back to AI
      }
    }
    // --------------------------------------------

    candidates.push({
      name: `<${el.tagName.toLowerCase()}>`,
      alt: el.getAttribute("alt") || "",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });

    if (candidates.length >= 10) break; // Cap at 10 to save tokens
  }

  if (candidates.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No images of text detected (filtered by Shape Detection API).",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: candidates,
  };
}
