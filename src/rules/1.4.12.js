import { isVisible } from "../utils/dom.js";

export const id = "1.4.12";
export const earlId = "WCAG22:text-spacing";
// Check everything, as text can be anywhere
export const relevantElements = ["*"];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.12 Text Spacing.
Task: Identify content that is cut off, clipped, or obscured when standard text spacing overrides are applied.

**CRITERIA**
- No loss of content or functionality should occur when:
  - Line height = 1.5 times font size
  - Spacing after paragraphs = 2 times font size
  - Letter spacing = 0.12 times font size
  - Word spacing = 0.16 times font size

**INSTRUCTIONS**
Review the 'clippedElements' list.
- **PASS:** If the list is empty.
- **FAIL:** If items are listed, they have been detected as clipping text (scrollHeight > clientHeight with hidden overflow) after spacing was applied.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Text clipping detected when spacing applied:\\n- [Element]: [Details]"}
- If no violations: {"verdict": "PASS", "reason": "No text clipping violations found."}
`;

// The official WCAG Text Spacing styles
const SPACING_CSS = `
    * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
    }
    p {
        margin-bottom: 2em !important;
    }
`;

/**
 * SETUP: Inject WCAG Spacing Styles
 */
export async function setup(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: SPACING_CSS,
      origin: "USER", // treating it as a user stylesheet override
    });
  } catch (e) {
    console.warn("CSS injection failed:", e);
  }
}

/**
 * TEARDOWN: Remove Styles
 */
export async function teardown(tabId) {
  try {
    // removeCSS needs to match the exact details of insertCSS
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: SPACING_CSS,
      origin: "USER",
    });
  } catch (e) {}
}

export function extractor() {
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

  const clippedElements = [];
  // We scan potential text containers
  const candidates = Array.from(
    document.querySelectorAll("div, p, section, article, li, td, span")
  );

  for (const el of candidates) {
    if (!isVisible(el)) continue;

    // Check for clipping
    // Condition 1: Element must restrict overflow
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;

    if (
      overflowY === "hidden" ||
      overflowY === "scroll" ||
      overflowY === "auto"
    ) {
      // Condition 2: Content is taller than the box
      // We allow a small tolerance (2px) for rounding errors
      if (el.scrollHeight > el.clientHeight + 2) {
        // Condition 3: Must contain text
        if (el.innerText.trim().length > 0) {
          clippedElements.push({
            element: `<${el.tagName.toLowerCase()} class="${el.className}">`,
            details: `Content height (${el.scrollHeight}px) exceeds container height (${el.clientHeight}px) with overflow:${overflowY}`,
          });
        }
      }
    }
  }

  if (clippedElements.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No text clipping detected.",
      pageTitle: document.title,
    };
  }

  // Limit output to avoid token limits
  return {
    pageTitle: document.title,
    clippedElements: clippedElements.slice(0, 5),
  };
}
