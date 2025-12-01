// src/utils/viewport-runner.js

/**
 * Simulates a mobile viewport to test WCAG 1.4.10 Reflow (320 CSS pixels).
 * Returns TRUE if horizontal scrollbars appear (Failure).
 */
export async function testReflow(tabId) {
  const target = { tabId };

  try {
    // 1. Attach Debugger
    await chrome.debugger.attach(target, "1.3");

    // 2. Override Metrics (Simulate iPhone SE-ish width)
    // WCAG Reflow requires testing at 320px width.
    await chrome.debugger.sendCommand(
      target,
      "Emulation.setDeviceMetricsOverride",
      {
        width: 320,
        height: 640,
        deviceScaleFactor: 2,
        mobile: true,
      }
    );

    // 3. Wait for layout to adjust (give the page a moment to reflow)
    await new Promise((r) => setTimeout(r, 500));

    // 4. Inject Script to Check for Scrollbars
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // A page fails 1.4.10 if it requires two-dimensional scrolling.
        // At 320px width, horizontal scrolling shouldn't exist.
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      },
    });

    // 5. Cleanup
    await chrome.debugger.sendCommand(
      target,
      "Emulation.clearDeviceMetricsOverride"
    );
    await chrome.debugger.detach(target);

    return {
      verdict: result[0].result ? "FAIL" : "PASS",
      reason: result[0].result
        ? "Horizontal scrollbar detected at 320px width."
        : "Content reflowed correctly at 320px.",
    };
  } catch (err) {
    console.error("Debugger Error:", err);
    // Ensure we detach even if there's an error
    try {
      await chrome.debugger.detach(target);
    } catch (e) {}
    return { verdict: "ERROR", reason: err.message };
  }
}

/**
 * Simulates Landscape Orientation to test WCAG 1.3.4.
 */
export async function testOrientation(tabId) {
  const target = { tabId };

  // ... (similar attach logic) ...

  // Set Landscape
  await chrome.debugger.sendCommand(
    target,
    "Emulation.setDeviceMetricsOverride",
    {
      width: 640,
      height: 320,
      mobile: true,
      screenOrientation: { type: "landscapePrimary", angle: 90 },
    }
  );

  // ... (Inject script to check if a "Please Rotate Device" modal appeared) ...
}
