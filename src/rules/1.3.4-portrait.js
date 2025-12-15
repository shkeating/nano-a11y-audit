export const id = "1.3.4-portrait";
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
Task: Identify if the page restricts access based on device orientation.

**CRITERIA**
- The user is currently in **LANDSCAPE** mode.
- Fail if you see a message demanding the user switch to PORTRAIT.

**INSTRUCTIONS**
Review the 'potentialRestrictions' list.
- **PASS:** If the list is empty.
- **FAIL:** If text is found demanding the user rotate their device.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Orientation restriction (Forces Portrait) detected:\\n- [Quote Text]"}
- If no violations: {"verdict": "PASS", "reason": "No portrait-only restrictions found."}
`;

export async function setup(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    // FORCE LANDSCAPE MODE
    await chrome.debugger.sendCommand(
      { tabId },
      "Emulation.setDeviceMetricsOverride",
      {
        width: 812,
        height: 375,
        deviceScaleFactor: 3,
        mobile: true,
        screenOrientation: { type: "landscapePrimary", angle: 90 },
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
  // 1. VERIFY EMULATION
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  if (!isLandscape) {
    return {
      computedVerdict: "CANNOT_TELL",
      reason: `Emulation Failed: Browser reported portrait during landscape test. Width: ${window.innerWidth}`,
      pageTitle: document.title,
    };
  }

  // 2. FIXED VISIBILITY CHECK
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    // Handle fixed position elements (offsetParent is null for fixed)
    if (style.position === "fixed") return true;

    return el.offsetParent !== null;
  }

  const potentialRestrictions = [];
  const candidates = Array.from(
    document.querySelectorAll("div, p, h1, h2, h3, span, dialog")
  );
  const SUSPICIOUS_KEYWORDS = ["rotate", "portrait", "turn your device"];

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
