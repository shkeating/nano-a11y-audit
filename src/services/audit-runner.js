import { RULES } from "../rules/index.js";
import { runAxeAudit } from "../utils/axe-runner.js";
import { runInBatches, delay } from "../utils/async-helpers.js";

// Rules that require the tab to be visible/focused and cannot be parallelized easily
const VISUAL_RULE_IDS = ["1.4.5", "1.4.1-images", "2.4.7"];

// Rules that rely on the Chrome Language Detection API
const LANGUAGE_RULE_IDS = ["3.1.1", "3.1.2"];

/**
 * Runs the full suite of tests (Axe + Nano) on a specific tab.
 * Uses batching for static rules and sequential execution for visual rules.
 * @param {number} tabId
 * @param {string} url
 * @param {Object} config - { safeList, enableMultimodal, enableLanguageDetection, logger }
 * @returns {Promise<Array>} List of audit results.
 */
export async function analyzePage(tabId, url, config) {
  const { safeList, enableMultimodal, enableLanguageDetection, logger } =
    config;
  const pageResults = [];

  // --- PHASE 1: BASELINE (AXE) ---
  logger(`Running Axe Core...`);
  const axeResults = await runAxeAudit(tabId);

  axeResults.forEach((r) => {
    if (r.verdict === "FAIL") logger(`[Axe: ${r.ruleId}] ❌ FAIL`);
    pageResults.push({ url, ...r });
  });

  // Identify "Incomplete" Axe results that need AI verification
  const incompleteLeads = axeResults.filter((r) => r.verdict === "INCOMPLETE");

  // --- PHASE 2: SORT & PREPARE RULES ---
  const staticTasks = [];
  const visualTasks = [];

  for (const ruleId in RULES) {
    const rule = RULES[ruleId];

    // --- CHECK: Should we skip this rule? ---
    if (LANGUAGE_RULE_IDS.includes(ruleId) && !enableLanguageDetection) {
      logger(`[Nano: ${ruleId}] Skipped (Language Detection Disabled)`);
      pageResults.push({
        url,
        earlId: rule.earlId,
        verdict: "INAPPLICABLE",
        reason: "Language Detection checks disabled in user settings.",
        pageTitle: "Skipped",
      });
      continue;
    }

    // Filter selectors relevant to this rule (from Axe incomplete items)
    const relevantLeads = incompleteLeads.filter(
      (l) => ruleId === "1.4.1" && l.ruleId === "link-in-text-block"
    );
    const targetSelectors = relevantLeads.flatMap((l) => l.selectors);

    const taskPayload = {
      tabId,
      rule,
      targetSelectors,
      options: { safeList, enableMultimodal, enableLanguageDetection },
    };

    if (VISUAL_RULE_IDS.includes(ruleId)) {
      visualTasks.push(taskPayload);
    } else {
      // Create a task function for batch execution
      staticTasks.push(async () => {
        const res = await runAuditOnTab(
          tabId,
          rule,
          targetSelectors,
          taskPayload.options
        );
        return { ruleId, res }; // Return ID so we can log it correctly later
      });
    }
  }

  // --- PHASE 3: EXECUTE STATIC RULES (PARALLEL) ---
  logger(`Running Static Checks (${staticTasks.length})...`);

  // Run 5 checks concurrently. This makes text-based auditing nearly instant.
  const staticOutcomes = await runInBatches(staticTasks, 5);

  staticOutcomes.forEach((outcome) => {
    if (outcome.error) {
      // Handle crashes in individual rules
      logger(`⚠️ Error in static rule: ${outcome.error.message}`);
    } else {
      const { ruleId, res } = outcome;
      logResult(logger, ruleId, res);
      pageResults.push({ url, earlId: RULES[ruleId].earlId, ...res });
    }
  });

  // --- PHASE 4: EXECUTE VISUAL RULES (SEQUENTIAL) ---
  if (visualTasks.length > 0 && enableMultimodal) {
    logger(`Running Visual Checks (${visualTasks.length})...`);

    // These MUST be sequential because they manipulate window focus and scroll
    for (const task of visualTasks) {
      try {
        // Run Setup (e.g., inject styles or debugger)
        if (task.rule.setup) {
          await task.rule.setup(tabId);
          await delay(200); // Small buffer for layout shift
        }

        const res = await runAuditOnTab(
          tabId,
          task.rule,
          task.targetSelectors,
          task.options
        );
        logResult(logger, task.rule.id, res);
        pageResults.push({ url, earlId: task.rule.earlId, ...res });
      } catch (ruleErr) {
        logger(`⚠️ Error [${task.rule.id}]: ${ruleErr.message}`);
        pageResults.push({
          url,
          earlId: task.rule.earlId,
          verdict: "ERROR",
          reason: ruleErr.message,
        });
      } finally {
        // Run Teardown (remove styles/debugger)
        if (task.rule.teardown) await task.rule.teardown(tabId);
      }
    }
  } else if (visualTasks.length > 0) {
    logger("Skipping Visual Checks (Multimodal Disabled)");
  }

  return pageResults;
}

/**
 * Internal helper to run a single rule logic
 */
async function runAuditOnTab(tabId, rule, targetSelectors, options) {
  // A. Check Applicability (Fast Check)
  if (rule.relevantElements && rule.relevantElements.length > 0) {
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selectors) =>
        selectors.some((s) => document.querySelector(s) !== null),
      args: [rule.relevantElements],
    });
    if (!checkResult?.[0]?.result) {
      return {
        verdict: "INAPPLICABLE",
        reason: `No relevant elements found.`,
        pageTitle: "N/A",
      };
    }
  }

  // B. Extract Data (Script Injection)
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    func: rule.extractor,
    args: [targetSelectors, options],
  });

  if (!injection?.[0]) throw new Error("Script injection failed");
  const domContext = injection[0].result;

  // --- FIX: Use Computed Verdict if available ---
  if (domContext.computedVerdict) {
    return {
      verdict: domContext.computedVerdict,
      reason: domContext.reason || "Verdict computed by rule logic.",
      pageTitle: domContext.pageTitle || "Audit Result",
    };
  }

  const aiOrigin = window.LanguageModel;
  const isVisualRule = ["1.4.5", "1.4.1-images", "2.4.7"].includes(rule.id);

  // C. Visual AI Analysis
  if (isVisualRule) {
    if (!options.enableMultimodal || !aiOrigin) {
      return {
        verdict: "CANNOT_TELL",
        reason: "Multimodal AI disabled.",
        pageTitle: domContext.pageTitle,
      };
    }
    return await runVisualAnalysis(tabId, rule, domContext, aiOrigin);
  }

  // D. Text AI Analysis
  if (!aiOrigin) {
    return {
      verdict: "INAPPLICABLE",
      reason: "AI API missing.",
      pageTitle: domContext.pageTitle,
    };
  }

  try {
    // Single-shot Prompt
    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: rule.systemPrompt }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    const resultString = await session.prompt(JSON.stringify(domContext));
    const result = parseAIResponse(resultString);
    session.destroy();
    return { ...result, pageTitle: domContext.pageTitle };
  } catch (e) {
    return {
      verdict: "ERROR",
      reason: `AI Error: ${e.message}`,
      pageTitle: domContext.pageTitle,
    };
  }
}

/**
 * Visual Analysis with Scrolling and Smart Retries
 */
async function runVisualAnalysis(tabId, rule, domContext, aiOrigin) {
  if (!domContext.images || domContext.images.length === 0) {
    return {
      verdict: "PASS",
      reason: "No relevant images found.",
      pageTitle: domContext.pageTitle,
    };
  }

  const results = [];
  let session;

  try {
    session = await aiOrigin.create({
      expectedInputs: [{ type: "text" }, { type: "image" }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
  } catch (err) {
    return {
      verdict: "INAPPLICABLE",
      reason: `AI Session Failed: ${err.message}`,
      pageTitle: domContext.pageTitle,
    };
  }

  for (const imgMeta of domContext.images) {
    // Throttle: Short wait between images to let GPU catch up
    await delay(500);

    let captureRect = imgMeta.rect;

    // 1. SCROLL INTO VIEW (If selector exists)
    if (imgMeta.selector) {
      try {
        const scrollResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            el.scrollIntoView({ behavior: "instant", block: "center" });
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              windowWidth: window.innerWidth,
            };
          },
          args: [imgMeta.selector],
        });

        if (scrollResult?.[0]?.result) {
          captureRect = scrollResult[0].result;
          // Wait for painting after scroll
          await delay(200);
        }
      } catch (e) {
        console.warn("Scroll failed, using original rect", e);
      }
    }

    try {
      // 2. CAPTURE & CROP
      const winId = await getWindowId(tabId);
      // Force focus for screenshots
      await chrome.windows.update(winId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      await delay(100);

      const screenshot = await getTabScreenshot();
      if (!screenshot || screenshot.width === 0) continue;

      const imageBlob = await cropImage(screenshot, captureRect);
      if (!imageBlob) continue;

      const imageBitmap = await createImageBitmap(imageBlob);

      // 3. PROMPT WITH RETRY
      const promptText = `\nSYSTEM INSTRUCTIONS:\n${rule.systemPrompt}\n\nUSER REQUEST:\nAnalyze this image. Alt text provided: "${imgMeta.alt}"\n`;

      let attempts = 0;
      let success = false;
      let responseString = "";

      while (attempts < 3 && !success) {
        try {
          responseString = await session.prompt([
            {
              role: "user",
              content: [
                { type: "text", value: promptText },
                { type: "image", value: imageBitmap },
              ],
            },
          ]);
          success = true;
        } catch (promptErr) {
          attempts++;
          // Exponential backoff: 1s, 2s, 3s
          console.warn(`AI Prompt busy/error, retrying (${attempts}/3)...`);
          await delay(1000 * attempts);
        }
      }

      if (!success) {
        results.push(`- Image (${imgMeta.alt}): AI Busy/Timeout.`);
        continue;
      }

      const result = parseAIResponse(responseString);
      if (result.verdict === "FAIL" || result.verdict === "CANNOT_TELL") {
        results.push(
          `- Image (${
            imgMeta.src ? imgMeta.src.substring(0, 30) : "Graphic"
          }...): ${result.reason}`
        );
      }
    } catch (e) {
      console.error("Visual Analysis Error", e);
      results.push(`- Image (${imgMeta.alt}): Capture Error.`);
    }
  }
  session.destroy();

  if (results.length > 0) {
    return {
      verdict: "FAIL",
      reason: "Visual violations detected:\n" + results.join("\n"),
      pageTitle: domContext.pageTitle,
    };
  }
  return {
    verdict: "PASS",
    reason: "No visual violations found.",
    pageTitle: domContext.pageTitle,
  };
}

// --- UTILS ---

function logResult(logger, ruleId, result) {
  const icon = getStatusIcon(result.verdict);
  if (result.verdict !== "INAPPLICABLE") {
    logger(`[Nano: ${ruleId}] ${icon} ${result.verdict}`);
  } else {
    console.log(`[Nano: ${ruleId}] Skipped: ${result.reason}`);
  }
}

function getStatusIcon(verdict) {
  if (verdict === "FAIL") return "❌";
  if (verdict === "PASS") return "✅";
  if (verdict === "INAPPLICABLE") return "⚪";
  if (verdict === "CANNOT_TELL") return "❓";
  return "⚠️";
}

function parseAIResponse(responseString) {
  try {
    let clean = responseString.replace(/```json|```/g, "").trim();
    const startIndex = clean.indexOf("{");
    const endIndex = clean.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1) throw new Error("No JSON found");
    return JSON.parse(clean.substring(startIndex, endIndex + 1));
  } catch (e) {
    return { verdict: "ERROR", reason: "Invalid AI Response format" };
  }
}

async function getWindowId(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return tab.windowId;
}

async function getTabScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
    });
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch (e) {
    return null;
  }
}

async function cropImage(sourceImage, rect) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");

  // Ensure we don't crop outside the image bounds
  const sx = Math.max(0, rect.x);
  const sy = Math.max(0, rect.y);

  ctx.drawImage(
    sourceImage,
    sx,
    sy,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
