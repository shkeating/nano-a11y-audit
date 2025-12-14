export const id = "high-contrast";
export const earlId = "WCAG22:contrast-enhanced";
// We keep this export for the runner to verify scope, if needed
export const relevantElements = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "svg",
  "img",
];

export const systemPrompt = `
You are an accessibility auditor specializing in Windows High Contrast Mode (Forced Colors).
The image provided shows a simulation where "forced-colors: active" is enabled.
In this mode, background colors, background images, and box-shadows are stripped.

**CRITERIA**
1. **FAIL (Vanishing Icon):** If an icon or graphic has disappeared (became invisible or same color as background).
2. **FAIL (Invisible Boundary):** If a button or input field has NO visible border and blends into the background.
3. **PASS:** If the element is clearly visible, identifiable, and has distinct boundaries (e.g. solid border).

**OUTPUT**
Return a JSON object:
- Fail: {"verdict": "FAIL", "reason": "Element is invisible in High Contrast Mode (likely relied on background-image or shadow)."}
- Pass: {"verdict": "PASS", "reason": "Element remains visible with distinct boundaries."}
`;

export async function extractor() {
  try {
    // --- 1. SELF-CONTAINED DATA ---
    // We explicitly define the selectors INSIDE the function so it runs safely in the tab.
    const relevantSelectors = [
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "svg",
      "img",
    ];

    // --- 2. INJECT HIGH CONTRAST SIMULATION CSS ---
    if (!document.getElementById("nano-hc-polyfill")) {
      const style = document.createElement("style");
      style.id = "nano-hc-polyfill";
      style.textContent = `
        :root {
          --hc-bg: #000000 !important;
          --hc-text: #ffffff !important;
          --hc-border: #ffffff !important;
        }
        *:not(img):not(svg):not(video) {
          background-color: var(--hc-bg) !important;
          background-image: none !important;
          color: var(--hc-text) !important;
          box-shadow: none !important;
          text-shadow: none !important;
          border-color: var(--hc-border) !important;
        }
        svg {
          fill: var(--hc-text) !important;
          stroke: var(--hc-text) !important;
        }
      `;
      document.head.appendChild(style);
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

    // --- 3. FIND CANDIDATES ---
    const elements = Array.from(
      document.querySelectorAll(relevantSelectors.join(","))
    );
    const candidates = [];

    for (const el of elements) {
      if (!isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;

      candidates.push({
        name: `<${el.tagName.toLowerCase()}> "${el.innerText.slice(0, 20)}"`,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });

      if (candidates.length >= 10) break;
    }

    // --- 4. RETURN RESULT ---
    if (candidates.length === 0) {
      return {
        computedVerdict: "PASS",
        reason: "No interactive candidates found for High Contrast check.",
        pageTitle: document.title,
      };
    }

    return {
      pageTitle: document.title,
      images: candidates,
    };
  } catch (err) {
    return {
      computedVerdict: "FAIL",
      reason: "Error running High Contrast Rule: " + err.message,
      pageTitle: document.title || "Unknown",
    };
  }
}
