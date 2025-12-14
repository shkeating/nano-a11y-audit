import { RULES } from "../rules/index.js";
import { runAxeAudit } from "../utils/axe-runner.js";
import { runInBatches, delay } from "../utils/async-helpers.js";

// Rules that require the tab to be visible/focused and cannot be parallelized easily
const VISUAL_RULE_IDS = [
  "1.1.1",
  "1.4.5",
  "1.4.1-images",
  "2.4.7",
  "1.4.11",
  "1.4.11-graphics",
  "high-contrast", // Added to list, but handled specially in logic
];

// Rules that rely on the Chrome Language Detection API
const LANGUAGE_RULE_IDS = ["3.1.1", "3.1.2"];

/**
 * Runs the full suite of tests (Axe + Nano) on a specific tab.
 * Uses batching for static rules and sequential execution for visual rules.
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

  const incompleteLeads = axeResults.filter((r) => r.verdict === "INCOMPLETE");

  // --- PHASE 2: SORT & PREPARE RULES ---
  const staticTasks = [];
  const standardVisualTasks = [];
  const destructiveVisualTasks = []; // New bucket for High Contrast

  for (const ruleId in RULES) {
    const rule = RULES[ruleId];

    if (LANGUAGE_RULE_IDS.includes(ruleId) && !enableLanguageDetection) {
      logger(`[Nano: ${ruleId}] Skipped (Language Detection Disabled)`);
      continue;
    }

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
      // Isolate Destructive Tests to run LAST
      if (ruleId === "high-contrast") {
        destructiveVisualTasks.push(taskPayload);
      } else {
        standardVisualTasks.push(taskPayload);
      }
    } else {
      staticTasks.push(async () => {
        const res = await runAuditOnTab(
          tabId,
          rule,
          targetSelectors,
          taskPayload.options
        );
        return { ruleId, res };
      });
    }
  }

  // --- PHASE 3: EXECUTE STATIC RULES (PARALLEL) ---
  logger(`Running Static Checks (${staticTasks.length})...`);
  const staticOutcomes = await runInBatches(staticTasks, 5);

  staticOutcomes.forEach((outcome) => {
    if (outcome.error) {
      logger(`⚠️ Error in static rule: ${outcome.error.message}`);
    } else {
      const { ruleId, res } = outcome;
      logResult(logger, ruleId, res);
      pageResults.push({ url, earlId: RULES[ruleId].earlId, ...res });
    }
  });

  // --- PHASE 4: EXECUTE STANDARD VISUAL RULES (SEQUENTIAL) ---
  // Run these first while the DOM is "Clean" (no injected High Contrast CSS)
  if (standardVisualTasks.length > 0 && enableMultimodal) {
    logger(`Running Visual Checks (${standardVisualTasks.length})...`);

    for (const task of standardVisualTasks) {
      const res = await runSafeVisualTask(task, logger);
      pageResults.push({ url, earlId: task.rule.earlId, ...res });
    }
  }

  // --- PHASE 5: EXECUTE DESTRUCTIVE RULES (SEQUENTIAL) ---
  // Run High Contrast last because it vandalizes the page style
  if (destructiveVisualTasks.length > 0 && enableMultimodal) {
    logger(`Running Destructive Checks (${destructiveVisualTasks.length})...`);

    for (const task of destructiveVisualTasks) {
      const res = await runSafeVisualTask(task, logger);
      pageResults.push({ url, earlId: task.rule.earlId, ...res });
    }
  }

  return pageResults;
}

// --- HELPER: WRAP VISUAL TASKS WITH SETUP/TEARDOWN ---
async function runSafeVisualTask(task, logger) {
  try {
    if (task.rule.setup) {
      await task.rule.setup(task.tabId);
      await delay(200);
    }

    const res = await runAuditOnTab(
      task.tabId,
      task.rule,
      task.targetSelectors,
      task.options
    );
    logResult(logger, task.rule.id, res);
    return res;
  } catch (ruleErr) {
    logger(`⚠️ Error [${task.rule.id}]: ${ruleErr.message}`);
    return {
      verdict: "ERROR",
      reason: ruleErr.message,
    };
  } finally {
    if (task.rule.teardown) await task.rule.teardown(task.tabId);
  }
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
  const isVisualRule = VISUAL_RULE_IDS.includes(rule.id);

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
    // --- SAFE LIST INJECTION ---
    // Rule 2.4.6 (Headings/Labels) needs the user's safe list injected into the prompt
    let finalSystemPrompt = rule.systemPrompt;

    if (
      rule.id === "2.4.6" &&
      options.safeList &&
      options.safeList.length > 0
    ) {
      const safeTerms = options.safeList.join("\n- ");
      finalSystemPrompt += `\n\n*** USER CONFIGURATION: SAFE LIST ***\nThe user has explicitly marked the following terms as Descriptive (PASS). Allow variations (case/plural):\n- ${safeTerms}`;
    }
    // ----------------------------

    // Single-shot Prompt
    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: finalSystemPrompt }],
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
 * Visual Analysis with Scrolling, Interaction Triggers, Smart Retries, and Grouped Reporting
 */
async function runVisualAnalysis(tabId, rule, domContext, aiOrigin) {
  if (!domContext.images || domContext.images.length === 0) {
    return {
      verdict: "PASS",
      reason: "No relevant images found.",
      pageTitle: domContext.pageTitle,
    };
  }

  // Grouped Results
  const generalFailures = [];
  const focusFailures = [];

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

  // --- GET PIXEL RATIO ONCE ---
  const dprInjection = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.devicePixelRatio || 1,
  });
  const dpr = dprInjection[0]?.result || 1;

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

    // --- 2. HANDLE INTERACTION TRIGGERS (e.g., FORCE FOCUS) ---
    if (imgMeta.trigger === "focus" && imgMeta.selector) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel) => {
          const el = document.querySelector(sel);
          if (el) el.focus();
        },
        args: [imgMeta.selector],
      });
      // Increased delay to allow for focus ring transition/paint
      await delay(500);
    }

    try {
      // 3. CAPTURE & CROP
      const winId = await getWindowId(tabId);
      // Force focus for screenshots
      await chrome.windows.update(winId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      await delay(100);

      const screenshot = await getTabScreenshot();

      // --- 4. CLEANUP INTERACTION (BLUR) ---
      if (imgMeta.trigger === "focus") {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            if (document.activeElement) document.activeElement.blur();
          },
        });
      }

      if (!screenshot || screenshot.width === 0) continue;

      const imageBlob = await cropImage(screenshot, captureRect, dpr);
      if (!imageBlob) continue;

      const imageBitmap = await createImageBitmap(imageBlob);

      // 5. PROMPT WITH RETRY
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
        // If AI is busy, we technically don't know the verdict, so we skip adding it to failures
        // or add a warning. For now, we skip.
        continue;
      }

      const result = parseAIResponse(responseString);
      if (result.verdict === "FAIL" || result.verdict === "CANNOT_TELL") {
        // --- IMPROVED IDENTIFIER LOGIC ---
        let identifier = "";

        if (imgMeta.name && imgMeta.name.length > 0) {
          identifier = `"${imgMeta.name}"`;
        } else if (imgMeta.html) {
          identifier = `\`${imgMeta.html}\``;
        } else if (imgMeta.src && !imgMeta.src.startsWith("[")) {
          identifier = imgMeta.src.substring(0, 30) + "...";
        } else {
          identifier = imgMeta.alt || "Unknown Element";
        }

        // --- SORT INTO BUCKETS BASED ON TRIGGER ---
        const message = `- Element ${identifier}: ${result.reason}`;

        if (imgMeta.trigger === "focus") {
          focusFailures.push(message);
        } else {
          // "default" or undefined -> General Visual Failure
          generalFailures.push(message);
        }
      }
    } catch (e) {
      console.error("Visual Analysis Error", e);
      generalFailures.push(`- Element (${imgMeta.alt}): Capture Error.`);
    }
  }
  session.destroy();

  // --- BUILD FINAL REPORT STRING ---
  if (generalFailures.length > 0 || focusFailures.length > 0) {
    let finalReason = "";

    if (generalFailures.length > 0) {
      finalReason +=
        "Visual violations detected:\n" + generalFailures.join("\n");
    }

    if (focusFailures.length > 0) {
      if (finalReason) finalReason += "\n\n"; // Spacer between sections
      finalReason +=
        "Focus ring contrast violations detected:\n" + focusFailures.join("\n");
    }

    return {
      verdict: "FAIL",
      reason: finalReason,
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

async function cropImage(sourceImage, rect, dpr = 1) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const canvas = document.createElement("canvas");

  // Scale dimensions by Device Pixel Ratio
  const scaledWidth = rect.width * dpr;
  const scaledHeight = rect.height * dpr;
  const scaledX = rect.x * dpr;
  const scaledY = rect.y * dpr;

  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext("2d");

  // Ensure we don't crop outside the image bounds
  ctx.drawImage(
    sourceImage,
    scaledX,
    scaledY,
    scaledWidth,
    scaledHeight,
    0,
    0,
    scaledWidth,
    scaledHeight
  );
  return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
