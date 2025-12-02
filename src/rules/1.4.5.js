export const id = "1.4.5";
export const earlId = "WCAG22:images-of-text";
export const relevantElements = ["img"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Analyze the image for "Images of Text" (WCAG 1.4.5).

**INSTRUCTIONS**
- Return valid JSON only.
- Do NOT add markdown.
- Do NOT add conversational text.

**OUTPUT FORMAT**
{"verdict": "FAIL", "reason": "Image contains text: [text]"}
OR
{"verdict": "PASS", "reason": "No violation"}
`;

export function extractor() {
  const images = [];
  const candidates = document.querySelectorAll("img");

  for (const img of candidates) {
    const rect = img.getBoundingClientRect();

    // 1. Must be visible and have reasonable size
    if (
      rect.width < 20 ||
      rect.height < 20 ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight
    )
      continue;

    // 2. Ignore SVGs (usually code, not pixel data)
    if (img.src.includes(".svg")) continue;

    images.push({
      src: img.src,
      alt: img.alt || "No alt text",
      // We need these coordinates to crop the screenshot later
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
      reason: "No relevant images found in viewport.",
    };
  }

  // Limit to 3 images to save processing time
  return { images: images.slice(0, 3) };
}
