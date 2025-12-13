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
You are an Accessibility Judge.
You will receive an image and a specific **TASK**. You must only perform that exact task.

**DEFINITIONS**
- **Boundary:** The background color or border of the button/input.
- **Focus Ring:** An extra outline (halo/glow) around the element.

**CRITERIA**
- **Low Contrast Boundary:** Light Gray, Beige, Pale Blue, or White-on-White. (< 3:1).
- **High Contrast Boundary:** Black, Dark Blue, Green, Red, or thick Dark Border. (> 3:1).
- **Weak Focus Ring:** Missing, or very faint (Cyan/Pale Gray).
- **Strong Focus Ring:** Clear, solid outline (White/Black/Blue) distinct from the button.

**OUTPUT FORMAT**
Return JSON only.
{"verdict": "FAIL", "reason": "..."}
{"verdict": "PASS", "reason": "..."}
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

    // 1. DEFAULT STATE CHECK
    // We inject the strict instruction into the 'alt' property, which the Runner passes to the AI as the User Prompt.
    images.push({
      src: "[UI Component Screenshot]",
      name: accName,
      html: snippet,
      // INSTRUCTION INJECTION:
      alt: "Task: Check BOUNDARY contrast only. Ignore focus rings. Fail if Light/Pastel.",
      trigger: "default",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      selector: `[data-nano-contrast-id="${uniqueId}"]`,
    });

    // 2. FOCUS STATE CHECK
    images.push({
      src: "[UI Component Screenshot]",
      name: accName,
      html: snippet,
      // INSTRUCTION INJECTION:
      alt: "Task: Check FOCUS RING visibility only. Ignore button color. Fail if ring is missing/faint.",
      trigger: "focus",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
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
