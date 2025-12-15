import { RULES } from "../rules/index.js";
import { runAxeAudit } from "../utils/axe-runner.js";
import { runInBatches, delay } from "../utils/async-helpers.js";

// Rules that need to run strictly one-by-one (usually for Setup/Teardown like resizing)
const SERIAL_RULE_IDS = [
  "1.1.1",
  "1.3.4-portrait",
  "1.3.4-landscape",
  "1.4.1-images",
  "1.4.4",
  "1.4.5",
  "1.4.10",
  "1.4.11",
  "1.4.11-graphics",
  "2.4.7",
  "high-contrast",
];

// Rules that specifically use Multimodal AI (Vision)
const MULTIMODAL_RULE_IDS = [
  "1.1.1",
  "1.4.1-images",
  "1.4.4", // 1.4.4 uses Vision
  "1.4.5",
  "1.4.11",
  "1.4.11-graphics",
  "high-contrast",
  "2.4.7",
];

const LANGUAGE_RULE_IDS = ["3.1.1", "3.1.2"];

export async function analyzePage(tabId, url, config) {
  const { safeList, enableMultimodal, enableLanguageDetection, logger } =
    config;
  const pageResults = [];

  // --- PHASE 1: BASELINE (AXE) ---
  logger(`Running Axe Core...`);
  const axeResults = await runAxeAudit(tabId);

  // FEATURE: Batch resolve Test Case IDs for Axe findings
  if (axeResults.length > 0) {
    const selectors = [
      ...new Set(axeResults.map((r) => r.selector).filter(Boolean)),
    ];
    const idMap = await resolveTestCaseIds(tabId, selectors);

    axeResults.forEach((r) => {
      if (r.selector && idMap[r.selector]) {
        r.testCaseId = idMap[r.selector];
      }
      if (r.verdict === "FAIL") logger(`[Axe: ${r.ruleId}] ❌ FAIL`);
      pageResults.push({ url, engine: "Axe Core", ...r });
    });
  }

  const incompleteLeads = axeResults.filter((r) => r.verdict === "INCOMPLETE");

  // --- PHASE 2: SORT & PREPARE RULES ---
  const staticTasks = [];
  const serialTasks = [];

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

    if (SERIAL_RULE_IDS.includes(ruleId)) {
      serialTasks.push(taskPayload);
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
      pageResults.push({
        url,
        earlId: RULES[ruleId].earlId,
        engine: "Gemini Nano",
        ...res,
      });
    }
  });

  // --- PHASE 4: EXECUTE SERIAL/VISUAL RULES ---
  if (serialTasks.length > 0) {
    logger(`Running Serial Checks (${serialTasks.length})...`);
    for (const task of serialTasks) {
      // Check if we should skip Vision-based rules if Multimodal is disabled
      const isVisionRule = MULTIMODAL_RULE_IDS.includes(task.rule.id);
      if (isVisionRule && !enableMultimodal) {
        logger(`[Nano: ${task.rule.id}] Skipped (Multimodal Disabled)`);
        continue;
      }

      const res = await runSafeVisualTask(task, logger);
      pageResults.push({
        url,
        earlId: task.rule.earlId,
        engine: "Gemini Nano",
        ...res,
      });
    }
  }

  return pageResults;
}

async function runSafeVisualTask(task, logger) {
  const startTime = performance.now();
  try {
    if (task.rule.setup) {
      await task.rule.setup(task.tabId);
      // Wait for layout/media queries to apply
      await delay(1000);
    }
    const res = await runAuditOnTab(
      task.tabId,
      task.rule,
      task.targetSelectors,
      task.options
    );
    res.latency = Math.round(performance.now() - startTime);
    logResult(logger, task.rule.id, res);
    return res;
  } catch (ruleErr) {
    logger(`⚠️ Error [${task.rule.id}]: ${ruleErr.message}`);
    return { verdict: "ERROR", reason: ruleErr.message, latency: 0 };
  } finally {
    if (task.rule.teardown) await task.rule.teardown(task.tabId);
  }
}

async function runAuditOnTab(tabId, rule, targetSelectors, options) {
  const startTime = performance.now();
  const withLatency = (r) => ({
    ...r,
    latency: Math.round(performance.now() - startTime),
  });

  // A. Check Applicability
  if (rule.relevantElements && rule.relevantElements.length > 0) {
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (selectors) =>
        selectors.some((s) => document.querySelector(s) !== null),
      args: [rule.relevantElements],
    });

    const isRelevant = checkResult?.some((frame) => frame.result === true);
    if (!isRelevant) {
      return withLatency({
        verdict: "INAPPLICABLE",
        reason: `No relevant elements found.`,
        pageTitle: "N/A",
      });
    }
  }

  // B. Extract Data
  const injection = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: rule.extractor,
    args: [targetSelectors, options],
  });

  if (!injection || injection.length === 0)
    throw new Error("Script injection failed");

  const frameResults = [];

  for (const frame of injection) {
    if (!frame.result) continue;

    const domContext = frame.result;
    const frameId = frame.frameId;

    // 1. Computed Verdict (Rule decided logic internally)
    if (domContext.computedVerdict) {
      frameResults.push({
        verdict: domContext.computedVerdict,
        reason: domContext.reason || "Verdict computed by rule logic.",
        pageTitle: domContext.pageTitle || `Frame ${frameId}`,
        frameId: frameId,
      });
      continue;
    }

    const aiOrigin = window.LanguageModel;
    const isVisionRule = MULTIMODAL_RULE_IDS.includes(rule.id);

    // 2. Vision/Multimodal Path
    if (isVisionRule) {
      if (!options.enableMultimodal || !aiOrigin) {
        frameResults.push({
          verdict: "CANNOT_TELL",
          reason: "Multimodal AI disabled.",
          pageTitle: domContext.pageTitle,
        });
      } else {
        const visualRes = await runVisualAnalysis(
          tabId,
          rule,
          domContext,
          aiOrigin,
          frameId
        );
        frameResults.push(visualRes);
      }
      continue;
    }

    // 3. Text/DOM AI Path
    if (!aiOrigin) {
      frameResults.push({
        verdict: "INAPPLICABLE",
        reason: "AI API missing.",
        pageTitle: domContext.pageTitle,
      });
      continue;
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
      const result = parseAIResponse(resultString);
      session.destroy();
      frameResults.push({ ...result, pageTitle: domContext.pageTitle });
    } catch (e) {
      frameResults.push({
        verdict: "ERROR",
        reason: `AI Error (Frame ${frameId}): ${e.message}`,
        pageTitle: domContext.pageTitle,
      });
    }
  }

  // C. Aggregate Results
  const failures = frameResults.filter((r) => r.verdict === "FAIL");
  const errors = frameResults.filter((r) => r.verdict === "ERROR");
  const passes = frameResults.filter((r) => r.verdict === "PASS");

  if (failures.length > 0) {
    const combinedReason = failures.map((f) => f.reason).join("\n\n");
    return withLatency({
      verdict: "FAIL",
      reason: combinedReason,
      pageTitle: "Multiple Frames",
    });
  }

  if (errors.length > 0) {
    return withLatency({
      verdict: "ERROR",
      reason: errors[0].reason,
      pageTitle: "Multiple Frames",
    });
  }

  if (passes.length > 0) {
    return withLatency({
      verdict: "PASS",
      reason: passes[0].reason,
      pageTitle: passes[0].pageTitle,
    });
  }

  return withLatency({
    verdict: "INAPPLICABLE",
    reason: "No content analyzed in any frame.",
    pageTitle: "N/A",
  });
}

async function runVisualAnalysis(
  tabId,
  rule,
  domContext,
  aiOrigin,
  frameId = 0
) {
  if (!domContext.images || domContext.images.length === 0) {
    return {
      verdict: "PASS",
      reason: "No relevant images found.",
      pageTitle: domContext.pageTitle,
    };
  }

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

  const dprInjection = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: () => window.devicePixelRatio || 1,
  });
  const dpr = dprInjection[0]?.result || 1;

  for (const imgMeta of domContext.images) {
    await delay(500);
    let captureRect = imgMeta.rect;

    if (imgMeta.selector) {
      try {
        const scrollResult = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            el.scrollIntoView({ behavior: "instant", block: "center" });
            return el.getBoundingClientRect();
          },
          args: [imgMeta.selector],
        });
        if (scrollResult?.[0]?.result) {
          captureRect = scrollResult[0].result;
          await delay(200);
        }
      } catch (e) {
        console.warn("Scroll failed", e);
      }
    }

    if (imgMeta.trigger === "focus" && imgMeta.selector) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: (sel) => {
          const el = document.querySelector(sel);
          if (el) el.focus();
        },
        args: [imgMeta.selector],
      });
      await delay(500);
    }

    try {
      const winId = await getWindowId(tabId);
      await chrome.windows.update(winId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      await delay(100);

      const screenshot = await getTabScreenshot();

      if (imgMeta.trigger === "focus") {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: () => {
            if (document.activeElement) document.activeElement.blur();
          },
        });
      }

      if (!screenshot || screenshot.width === 0) continue;

      const imageBlob = await cropImage(screenshot, captureRect, dpr);
      if (!imageBlob) continue;
      const imageBitmap = await createImageBitmap(imageBlob);

      const promptText = `\nSYSTEM INSTRUCTIONS:\n${rule.systemPrompt}\n\nUSER REQUEST:\nAnalyze this image. Alt text provided: "${imgMeta.alt}"\n`;
      let attempts = 0,
        success = false,
        responseString = "";

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
          await delay(1000 * attempts);
        }
      }

      if (!success) continue;

      const result = parseAIResponse(responseString);
      if (result.verdict === "FAIL" || result.verdict === "CANNOT_TELL") {
        let identifier = imgMeta.name || imgMeta.alt || "Unknown Element";

        let tcId = "";
        if (imgMeta.selector) {
          const map = await resolveTestCaseIds(tabId, [imgMeta.selector]);
          if (map && map[imgMeta.selector]) {
            tcId = map[imgMeta.selector];
          }
        }
        const idTag = tcId ? `[TestCase:${tcId}] ` : "";
        const message = `- Element ${identifier}: ${idTag}${result.reason}`;

        if (imgMeta.trigger === "focus") focusFailures.push(message);
        else generalFailures.push(message);
      }
    } catch (e) {
      console.error("Visual Analysis Error", e);
    }
  }
  session.destroy();

  if (generalFailures.length > 0 || focusFailures.length > 0) {
    let finalReason = "";
    if (generalFailures.length > 0)
      finalReason +=
        "Visual violations detected:\n" + generalFailures.join("\n");
    if (focusFailures.length > 0) {
      if (finalReason) finalReason += "\n\n";
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
async function resolveTestCaseIds(tabId, selectors) {
  if (!selectors || selectors.length === 0) return {};

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      args: [selectors],
      func: (selArray) => {
        const resultMap = {};
        selArray.forEach((selector) => {
          try {
            const el = document.querySelector(selector);
            if (!el) return;
            let current = el;
            let foundId = null;
            let depth = 0;
            while (
              current &&
              current.tagName !== "BODY" &&
              depth < 15 &&
              !foundId
            ) {
              let sibling = current.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === "H3" && sibling.id) {
                  foundId = sibling.id;
                  break;
                }
                if (sibling.tagName === "H2" || sibling.tagName === "H1") break;
                sibling = sibling.previousElementSibling;
              }
              current = current.parentElement;
              depth++;
            }
            if (foundId) resultMap[selector] = foundId;
          } catch (e) {
            /* ignore */
          }
        });
        return resultMap;
      },
    });

    const combinedMap = {};
    injection.forEach((frame) => {
      if (frame.result) {
        Object.assign(combinedMap, frame.result);
      }
    });
    return combinedMap;
  } catch (e) {
    console.warn("Failed to resolve Test Case IDs", e);
    return {};
  }
}

function logResult(logger, ruleId, result) {
  const icon = getStatusIcon(result.verdict);
  if (result.verdict !== "INAPPLICABLE")
    logger(`[Nano: ${ruleId}] ${icon} ${result.verdict}`);
  else console.log(`[Nano: ${ruleId}] Skipped: ${result.reason}`);
}

function getStatusIcon(verdict) {
  if (verdict === "FAIL") return "❌";
  if (verdict === "PASS") return "✅";
  if (verdict === "INAPPLICABLE") return "⚪";
  if (verdict === "CANNOT_TELL") return "❓";
  return "⚠️";
}

function parseAIResponse(responseString) {
  // 1. Remove Markdown code blocks
  let clean = responseString.replace(/```json|```/g, "").trim();

  // 2. Find the FIRST '{' and the LAST '}'
  const startIndex = clean.indexOf("{");
  const endIndex = clean.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return {
      verdict: "ERROR",
      reason: "Invalid AI Response format: No JSON object found.",
    };
  }

  // 3. Extract strictly the JSON part
  let jsonCandidate = clean.substring(startIndex, endIndex + 1);

  // 4. Attempt Parse
  try {
    return JSON.parse(jsonCandidate);
  } catch (e) {
    // 5. Fallback: Sanitization for common LLM errors
    try {
      jsonCandidate = jsonCandidate.replace(/(?:\r\n|\r|\n)/g, " ");
      const reasonLabel = '"reason"';
      const reasonKeyIndex = jsonCandidate.lastIndexOf(reasonLabel);
      if (reasonKeyIndex !== -1) {
        const colonIndex = jsonCandidate.indexOf(":", reasonKeyIndex);
        const valueStart = jsonCandidate.indexOf('"', colonIndex);
        const valueEnd = jsonCandidate.lastIndexOf('"');
        if (valueStart !== -1 && valueEnd !== -1 && valueEnd > valueStart) {
          const rawReason = jsonCandidate.substring(valueStart + 1, valueEnd);
          const sanitizedText = rawReason
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "'");

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
  const scaledWidth = rect.width * dpr;
  const scaledHeight = rect.height * dpr;
  const scaledX = rect.x * dpr;
  const scaledY = rect.y * dpr;
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext("2d");
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
