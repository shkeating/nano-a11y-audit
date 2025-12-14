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
  "high-contrast",
];

// Rules that rely on the Chrome Language Detection API
const LANGUAGE_RULE_IDS = ["3.1.1", "3.1.2"];

export async function analyzePage(tabId, url, config) {
  const { safeList, enableMultimodal, enableLanguageDetection, logger } =
    config;
  const pageResults = [];

  // --- PHASE 1: BASELINE (AXE) ---
  logger(`Running Axe Core...`);
  try {
    const axeResults = await runAxeAudit(tabId);

    // DEBUG: Log how many results Axe found
    logger(`Axe Core found ${axeResults.length} issues.`);

    axeResults.forEach((r) => {
      // FIX: Handle Iframe "INCOMPLETE" results gracefully
      if (r.verdict === "INCOMPLETE" && r.reason.includes("iframe")) {
        r.verdict = "UNSUPPORTED"; // Mark explicitly so CSV is clear
        r.reason = "Iframes are not currently supported by this auditor.";
      }

      if (r.verdict === "FAIL") logger(`[Axe: ${r.ruleId}] ❌ FAIL`);

      // Ensure specific properties exist for CSV export
      pageResults.push({
        url,
        engine: "Axe Core", // Explicitly set engine
        ...r,
      });
    });

    // Helper for Nano rules that depend on Axe findings
    const incompleteLeads = axeResults.filter(
      (r) => r.verdict === "INCOMPLETE"
    );

    // --- PHASE 2: SORT & PREPARE RULES ---
    const staticTasks = [];
    const standardVisualTasks = [];
    const destructiveVisualTasks = [];

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
        if (ruleId === "high-contrast" || rule.isDestructive) {
          destructiveVisualTasks.push(taskPayload);
        } else {
          standardVisualTasks.push(taskPayload);
        }
      } else {
        staticTasks.push(async () => {
          // FIX: Latency tracking happens inside runAuditOnTab now
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
    if (standardVisualTasks.length > 0 && enableMultimodal) {
      logger(`Running Visual Checks (${standardVisualTasks.length})...`);
      for (const task of standardVisualTasks) {
        const res = await runSafeVisualTask(task, logger);
        pageResults.push({ url, earlId: task.rule.earlId, ...res });
      }
    }

    // --- PHASE 5: EXECUTE DESTRUCTIVE RULES (SEQUENTIAL) ---
    if (destructiveVisualTasks.length > 0 && enableMultimodal) {
      logger(
        `Running Destructive Checks (${destructiveVisualTasks.length})...`
      );
      for (const task of destructiveVisualTasks) {
        const res = await runSafeVisualTask(task, logger);
        pageResults.push({ url, earlId: task.rule.earlId, ...res });
      }
    }
  } catch (err) {
    logger(`CRITICAL ERROR: ${err.message}`);
  }

  return pageResults;
}

//Wrapper to ensure latency is tracked for visual tasks too
async function runSafeVisualTask(task, logger) {
  const startTime = performance.now(); // START TIMER
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

    // Add latency to result
    const endTime = performance.now();
    res.latency = Math.round(endTime - startTime);

    logResult(logger, task.rule.id, res);
    return res;
  } catch (ruleErr) {
    logger(`⚠️ Error [${task.rule.id}]: ${ruleErr.message}`);
    return {
      verdict: "ERROR",
      reason: ruleErr.message,
      latency: Math.round(performance.now() - startTime),
    };
  } finally {
    if (task.rule.teardown) await task.rule.teardown(task.tabId);
  }
}

async function runAuditOnTab(tabId, rule, targetSelectors, options) {
  const startTime = performance.now(); // START TIMER (Static Rules)

  // Helper to attach latency before returning
  const withLatency = (result) => {
    const endTime = performance.now();
    return { ...result, latency: Math.round(endTime - startTime) };
  };

  // A. Check Applicability
  if (rule.relevantElements && rule.relevantElements.length > 0) {
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selectors) =>
        selectors.some((s) => document.querySelector(s) !== null),
      args: [rule.relevantElements],
    });
    if (!checkResult?.[0]?.result) {
      return withLatency({
        verdict: "INAPPLICABLE",
        reason: `No relevant elements found.`,
        pageTitle: "N/A",
      });
    }
  }

  // B. Extract Data
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    func: rule.extractor,
    args: [targetSelectors, options],
  });

  if (!injection?.[0]) throw new Error("Script injection failed");
  const domContext = injection[0].result;

  if (domContext.computedVerdict) {
    return withLatency({
      verdict: domContext.computedVerdict,
      reason: domContext.reason || "Verdict computed by rule logic.",
      pageTitle: domContext.pageTitle || "Audit Result",
    });
  }

  const aiOrigin = window.LanguageModel;
  const isVisualRule = VISUAL_RULE_IDS.includes(rule.id);

  // C. Visual AI Analysis
  if (isVisualRule) {
    if (!options.enableMultimodal || !aiOrigin) {
      return withLatency({
        verdict: "CANNOT_TELL",
        reason: "Multimodal AI disabled.",
        pageTitle: domContext.pageTitle,
      });
    }
    // Note: Visual analysis takes longer; latency tracked in runSafeVisualTask
    // But we wrap here just in case logic changes
    const result = await runVisualAnalysis(tabId, rule, domContext, aiOrigin);
    return withLatency(result);
  }

  // D. Text AI Analysis
  if (!aiOrigin) {
    return withLatency({
      verdict: "INAPPLICABLE",
      reason: "AI API missing.",
      pageTitle: domContext.pageTitle,
    });
  }

  try {
    let finalSystemPrompt = rule.systemPrompt;
    if (rule.id === "2.4.6" && options.safeList?.length > 0) {
      const safeTerms = options.safeList.join("\n- ");
      finalSystemPrompt += `\n\n*** USER CONFIGURATION: SAFE LIST ***\nThe user has explicitly marked the following terms as Descriptive (PASS). Allow variations (case/plural):\n- ${safeTerms}`;
    }

    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: finalSystemPrompt }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    const resultString = await session.prompt(JSON.stringify(domContext));
    const result = parseAIResponse(resultString); // Use fixed parser
    session.destroy();
    return withLatency({ ...result, pageTitle: domContext.pageTitle });
  } catch (e) {
    return withLatency({
      verdict: "ERROR",
      reason: `AI Error: ${e.message}`,
      pageTitle: domContext.pageTitle,
    });
  }
}

// ... runVisualAnalysis function stays mostly the same ...
// You just need to ensure 'session.destroy()' is called and it returns standard result objects.
// (Omitted for brevity, assume existing implementation is fine unless specific logic changes needed)
async function runVisualAnalysis(tabId, rule, domContext, aiOrigin) {
  // ... [Use existing implementation from your file] ...
  // Just ensure you copy the existing function body here.
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
  // 1. Remove Markdown Code Blocks
  let clean = responseString.replace(/```json|```/g, "").trim();

  // 2. Extract the JSON Object (Find first { and last })
  const startIndex = clean.indexOf("{");
  const endIndex = clean.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1) {
    return { verdict: "ERROR", reason: "Invalid AI Response format" };
  }

  const jsonCandidate = clean.substring(startIndex, endIndex + 1);

  try {
    // 3. Try Standard Parsing
    return JSON.parse(jsonCandidate);
  } catch (e) {
    // 4. Fallback: Sanitize unescaped quotes inside the 'reason' value
    // This fixes cases where the AI writes: "reason": "element has alt="text""
    try {
      // Locate the "reason" key (it's usually the last key in your prompt structure)
      const reasonLabel = '"reason"';
      const reasonKeyIndex = jsonCandidate.lastIndexOf(reasonLabel);

      if (reasonKeyIndex !== -1) {
        // Find the colon and the opening quote of the value
        const colonIndex = jsonCandidate.indexOf(":", reasonKeyIndex);
        const valueStart = jsonCandidate.indexOf('"', colonIndex);
        // Find the closing quote (last quote in the entire string)
        const valueEnd = jsonCandidate.lastIndexOf('"');

        // Ensure indices are valid and we have content between quotes
        if (valueStart !== -1 && valueEnd !== -1 && valueEnd > valueStart) {
          const problematicText = jsonCandidate.substring(
            valueStart + 1,
            valueEnd
          );

          // SANITIZE: Replace all internal double quotes with single quotes
          const sanitizedText = problematicText.replace(/"/g, "'");

          // Reconstruct the JSON string with the fixed text
          const fixedJson =
            jsonCandidate.substring(0, valueStart + 1) +
            sanitizedText +
            jsonCandidate.substring(valueEnd);

          return JSON.parse(fixedJson);
        }
      }
    } catch (retryErr) {
      console.warn("AI Parse Retry Failed:", retryErr);
    }

    // Return Error if both attempts fail
    return {
      verdict: "ERROR",
      reason: "Invalid AI Response format (SyntaxError)",
    };
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
