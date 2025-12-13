export const id = "1.1.1";
export const earlId = "WCAG22:non-text-content";
export const relevantElements = ["img", "svg", "[role='img']"];

// FEW-SHOT PROMPTING: We give examples to force strict adherence to the rules.
export const systemPrompt = `
You are a strict accessibility auditor checking Image Alternatives.

**RULES**
1. **FAIL (Generic):** If Alt Text is "image", "photo", "picture", "icon", "spacer", "placeholder", or "graphic".
2. **FAIL (Filename):** If Alt Text looks like a file name (e.g., "my-pic.jpg", "img_001.png").
3. **FAIL (Mismatch):** If Alt Text describes something completely different from the image.
4. **FAIL (False Decorative):** If image is "Hidden/Decorative" but contains text or data that *should* be read.
5. **PASS:** If the text describes the image content OR if the image is correctly hidden.

**EXAMPLES**

User: Context: Alt Text: "image"
Image: [A photo of a team]
Response: {"verdict": "FAIL", "reason": "Generic text 'image' is not a valid text alternative."}

User: Context: Alt Text: "footer-bg.png"
Image: [A pattern]
Response: {"verdict": "FAIL", "reason": "Filename 'footer-bg.png' is not a valid text alternative."}

User: Context: Alt Text: "spacer"
Image: [A transparent box]
Response: {"verdict": "FAIL", "reason": "Decorative images should be hidden (alt=\"\"), not labeled 'spacer'."}

User: Context: Marked as Decorative (Hidden)
Image: [A chart showing sales data]
Response: {"verdict": "FAIL", "reason": "Meaningful image (Chart) is incorrectly hidden from screen readers."}

User: Context: Alt Text: "A golden retriever"
Image: [A dog]
Response: {"verdict": "PASS", "reason": "Descriptive."}
`;

export function extractor() {
  const images = [];
  const candidates = document.querySelectorAll("img, svg, [role='img']");

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

    // 1. Determine Accessibility Status
    const hasAltAttr = el.hasAttribute("alt");
    const altValue = el.getAttribute("alt");
    const role = el.getAttribute("role");
    const ariaLabel = el.getAttribute("aria-label");
    const title = el.getAttribute("title");

    let promptContext = "";

    // CASE: Explicitly Decorative
    if (
      (hasAltAttr && altValue === "") ||
      role === "presentation" ||
      role === "none"
    ) {
      promptContext = "Marked as Decorative (Hidden)";
    }
    // CASE: Has Accessible Name
    else if (altValue || ariaLabel || title) {
      const name = altValue || ariaLabel || title;
      promptContext = `Alt Text: "${name.trim()}"`;
    }
    // CASE: Missing Attribute (Axe catches this, ignore)
    else {
      continue;
    }

    const uniqueId =
      "nano-img-quality-" + Math.random().toString(36).substr(2, 9);
    el.setAttribute("data-nano-quality-id", uniqueId);

    let src = "";
    if (el.tagName === "IMG") src = el.src;
    else src = "[SVG/Graphic]";

    // Generate a clean identifier for the logs
    let identifier = "";
    if (el.tagName === "IMG") {
      const file = src.split("/").pop();
      identifier = `<img src=".../${file}">`;
    } else {
      identifier = `<${el.tagName.toLowerCase()}>`;
    }

    images.push({
      src: src,
      name: identifier, // Identifying string for the UI logs
      alt: promptContext, // The text passed to the AI
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      selector: `[data-nano-quality-id="${uniqueId}"]`,
      trigger: "default",
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No evaluate-able images found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: images.slice(0, 10),
  };
}
