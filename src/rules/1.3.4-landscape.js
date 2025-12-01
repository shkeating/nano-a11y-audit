export const id = "1.3.4-landscape";
export const earlId = "WCAG22:orientation";
export const relevantElements = [
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "span",
  "dialog",
];

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 1.3.4 Orientation.
Task: Identify if the page restricts access based on device orientation (e.g., "Please rotate your device").

**CRITERIA**
- The user is currently in **PORTRAIT** mode.
- Fail if you see a message demanding the user switch to LANDSCAPE.

**INSTRUCTIONS**
Review the 'potentialRestrictions' list.
- **PASS:** If the list is empty.
- **FAIL:** If text is found demanding the user rotate their device.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Orientation restriction (Forces Landscape) detected:\\n- [Quote Text]"}
- If no violations: {"verdict": "PASS", "reason": "No landscape-only restrictions found."}
`;

export async function setup(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    // FORCE PORTRAIT MODE
    await chrome.debugger.sendCommand(
      { tabId },
      "Emulation.setDeviceMetricsOverride",
      {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        mobile: true,
        screenOrientation: { type: "portraitPrimary", angle: 0 },
      }
    );
  } catch (e) {
    console.warn("Debugger attach failed:", e);
  }
}

export async function teardown(tabId) {
  try {
    await chrome.debugger.sendCommand(
      { tabId },
      "Emulation.clearDeviceMetricsOverride"
    );
    await chrome.debugger.detach({ tabId });
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

  const potentialRestrictions = [];
  const candidates = Array.from(
    document.querySelectorAll("div, p, h1, h2, h3, span, dialog")
  );
  // Keywords for "Forces Landscape"
  const SUSPICIOUS_KEYWORDS = ["rotate", "landscape", "turn your device"];

  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = el.innerText.toLowerCase();
    if (text.length < 10 || text.length > 150) continue;

    if (SUSPICIOUS_KEYWORDS.some((kw) => text.includes(kw))) {
      const cleanText = el.innerText.trim();
      if (!potentialRestrictions.includes(cleanText))
        potentialRestrictions.push(cleanText);
    }
  }

  if (potentialRestrictions.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No restrictions found.",
      pageTitle: document.title,
    };
  }
  return {
    pageTitle: document.title,
    potentialRestrictions: potentialRestrictions,
  };
}
