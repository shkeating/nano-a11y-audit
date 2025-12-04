export const id = "1.4.5";
export const earlId = "WCAG22:images-of-text";
export const relevantElements = ["img"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.5 Images of Text.
Task: Analyze the image to see if it displays text that should be HTML.

**CRITERIA**
- **FAIL:** The image is a picture of text (e.g., a button, a warning message, a scanned document).
- **PASS:** The image is a photo, a logo, or contains NO text.

**INSTRUCTIONS**
1. Read any text visible in the image.
2. If text is found, the verdict is FAIL. 
3. Your "reason" must explicitly quote the text found.

**OUTPUT FORMAT (JSON ONLY)**
If text is found:
{"verdict": "FAIL", "reason": "The image displays the text: [transcribed text]"}

If no text or is a logo:
{"verdict": "PASS", "reason": "Image is decorative or a logo."}
`;

export function extractor() {
  const images = [];
  const candidates = document.querySelectorAll("img");

  for (const img of candidates) {
    const rect = img.getBoundingClientRect();
    if (
      rect.width < 20 ||
      rect.height < 20 ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight
    )
      continue;
    if (img.src.includes(".svg")) continue;

    images.push({
      src: img.src,
      alt: img.alt || "No alt text",
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

  return { images: images.slice(0, 3) };
}
