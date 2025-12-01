export const id = "1.4.10";
export const earlId = "WCAG22:reflow";
// We don't use relevantElements here because layout issues can come from anywhere.

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.4.10 Reflow.
Task: Evaluate if the page content reflows correctly at a viewport width of 320 CSS pixels.

**CRITERIA**
Content must not require two-dimensional scrolling (horizontal scrollbars) at a width of 320px.
Exceptions: Maps, games, diagrams, code blocks, and data tables where 2D scrolling is essential.

**INSTRUCTIONS**
Review the input data.
- **Verdict:** FAIL if 'hasHorizontalScrollbar' is true (unless it falls under an exception).
- **Reasoning:** If failing, describe the issue based on the provided details.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Horizontal scrollbar detected at 320px width."}
- If no violations: {"verdict": "PASS", "reason": "Content reflows correctly at 320px."}
`;

/**
 * SETUP: Force Viewport to 320px (Mobile)
 */
export async function setup(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand(
      { tabId },
      "Emulation.setDeviceMetricsOverride",
      {
        width: 320,
        height: 640,
        deviceScaleFactor: 2,
        mobile: true,
      }
    );
  } catch (e) {
    console.warn("Debugger attach failed (is DevTools open?):", e);
  }
}

/**
 * TEARDOWN: Reset Viewport
 */
export async function teardown(tabId) {
  try {
    await chrome.debugger.sendCommand(
      { tabId },
      "Emulation.clearDeviceMetricsOverride"
    );
    await chrome.debugger.detach({ tabId });
  } catch (e) {
    // Ignore detach errors
  }
}

export function extractor() {
  // Check for 2D scrolling
  const doc = document.documentElement;
  const scrollWidth = doc.scrollWidth;
  const clientWidth = doc.clientWidth;

  // Allow 1px tolerance for sub-pixel rendering differences
  const hasHorizontalScrollbar = scrollWidth > clientWidth + 1;

  if (!hasHorizontalScrollbar) {
    return {
      computedVerdict: "PASS",
      reason: "No horizontal scrollbar detected at 320px width.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    hasHorizontalScrollbar: true,
    details: `Scroll Width: ${scrollWidth}px, Viewport Width: ${clientWidth}px`,
  };
}
