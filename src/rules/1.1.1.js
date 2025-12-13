export const id = "1.1.1";
export const earlId = "WCAG22:non-text-content";
export const relevantElements = ["img", "svg", "[role='img']"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.1.1.
Task: Evaluate the image based on its "Provided Attribute".

**SCENARIO A: Image has Alt Text**
If the user provides Alt Text string:
- **FAIL** if the text is generic (e.g., "image", "photo", "graphic", "icon", "placeholder", "spacer").
- **FAIL** if the text is a file name (e.g., "chart.png", "img_001.jpg").
- **FAIL** if the text does not describe the visual content.
- **PASS** if the text is descriptive.

**SCENARIO B: Image is Marked Decorative**
If the user says "Marked as Decorative (Hidden)":
- **FAIL** if the image contains legible text, data charts, or meaningful icons (e.g., a warning sign) that should NOT be hidden.
- **PASS** if the image is purely visual decoration, photography without specific meaning, or background art.

**OUTPUT FORMAT**
Return a JSON object:
- Fail: {"verdict": "FAIL", "reason": "[Explain why quality is poor OR why it should not be hidden]"}
- Pass: {"verdict": "PASS", "reason": "Alt text is sufficient OR image is correctly hidden."}
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

    let status = "unknown";
    let promptContext = "";

    // CASE: Explicitly Decorative
    if (
      (hasAltAttr && altValue === "") ||
      role === "presentation" ||
      role === "none"
    ) {
      status = "decorative";
      promptContext = "Marked as Decorative (Hidden from screen readers)";
    }
    // CASE: Has Accessible Name
    else if (altValue || ariaLabel || title) {
      status = "named";
      const name = altValue || ariaLabel || title;
      // Skip if filename detection is handled by Axe, but we want to check quality
      promptContext = `Alt Text: "${name.trim()}"`;
    }
    // CASE: Missing Attribute (Axe catches this, ignore)
    else {
      continue;
    }

    const uniqueId =
      "nano-img-check-" + Math.random().toString(36).substr(2, 9);
    el.setAttribute("data-nano-id", uniqueId);

    let src = "";
    if (el.tagName === "IMG") src = el.src;
    else src = "[SVG/Graphic]";

    images.push({
      src: src,
      alt: promptContext, // This is passed to the User Prompt for the AI
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      selector: `[data-nano-id="${uniqueId}"]`,
      trigger: "default",
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No evaluate-able images found (all missing alt caught by Axe).",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: images.slice(0, 10), // Increased limit to ensure test suite coverage
  };
}
