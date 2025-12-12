export const id = "1.4.11";
export const earlId = "WCAG22:non-text-contrast";
export const relevantElements = [
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
];

export const systemPrompt = `
You are a strict WCAG Contrast Validator.
Task: Classify the UI component based on the requested **MODE**.

**INPUT ANALYSIS**
- If input says **"(Focus State)"** -> **MODE: FOCUS_CHECK**
- If input says **"(Default State)"** -> **MODE: BOUNDARY_CHECK**

---

**MODE: BOUNDARY_CHECK (Default State)**
*Goal: Ensure the button/input shape is visible against the page.*
- **FAIL:** Light Gray, Beige, Pastel background/border (< 3:1).
- **PASS:** Dark/Solid background (Blue, Black, Green) or thick Dark border.
- **IGNORE:** Do not look for focus rings or glow. Only judge the component itself.

**MODE: FOCUS_CHECK (Active State)**
*Goal: Ensure the Focus Indicator (Ring/Outline) is visible.*
- **FAIL:** No visible change, or a very faint/thin outline (Light Blue/Gray) that blends in.
- **PASS:** Clear, high-contrast Focus Ring (Solid Outline) or drastic background change (Invert).
- **IGNORE:** Do not judge the button color unless it prevents seeing the ring.

---

**OUTPUT FORMAT (JSON)**
- Boundary Fail: {"verdict": "FAIL", "reason": "Component boundary is too faint (Light/Pastel)."}
- Focus Fail:    {"verdict": "FAIL", "reason": "Focus indicator (Ring) is missing or too faint."}
- Pass:          {"verdict": "PASS", "reason": "Contrast is sufficient."}
`;

export function extractor() {
  const images = [];
  const candidates = document.querySelectorAll(
    "button, input, select, textarea, [role='button']"
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
    if (count > 4) break;

    const uniqueId = "nano-contrast-" + Math.random().toString(36).substr(2, 9);
    el.setAttribute("data-nano-contrast-id", uniqueId);

    let accName =
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.innerText ||
      el.value ||
      "";
    accName = accName.trim().substring(0, 30);
    let snippet = el.outerHTML.substring(0, 80).replace(/[\n\r]+/g, " ");
    if (el.outerHTML.length > 80) snippet += "...";

    // 1. DEFAULT STATE CHECK (Boundary)
    images.push({
      src: "[UI Component Screenshot]",
      name: accName,
      html: snippet,
      alt: "UI Component (Default State)", // Triggers BOUNDARY_CHECK
      trigger: "default",
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      selector: `[data-nano-contrast-id="${uniqueId}"]`,
    });

    // 2. FOCUS STATE CHECK (Ring)
    images.push({
      src: "[UI Component Screenshot]",
      name: accName,
      html: snippet,
      alt: "UI Component (Focus State)", // Triggers FOCUS_CHECK
      trigger: "focus",
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      selector: `[data-nano-contrast-id="${uniqueId}"]`,
    });
  }

  if (images.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No active UI components found for contrast analysis.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    images: images,
  };
}
