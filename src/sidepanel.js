import "@picocss/pico";
import "./sidepanel.css";

import Papa from "papaparse";
import { RULES } from "./rules/index.js";
import { generateEarlReport } from "./utils/earl-reporter.js";
import { runAxeAudit } from "./utils/axe-runner.js";
import { injectReportFunction } from "./utils/report-injector.js";

// --- DEFAULTS ---
const DEFAULT_SAFE_TERMS = [
  "email",
  "email address",
  "name",
  "first name",
  "last name",
  "password",
  "search",
  "contact",
  "contact us",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "date",
  "submit",
  "login",
  "sign up",
  "menu",
  "about",
  "home",
  "products",
  "services",
  "pricing",
  "refund policy",
  "privacy policy",
  "terms",
];

let urlQueue = [];
let auditResults = [];
let currentSafeList = [...DEFAULT_SAFE_TERMS];

// --- 1. SETTINGS MANAGEMENT ---
chrome.storage.local.get(["safeList"], (result) => {
  if (result.safeList) {
    currentSafeList = result.safeList;
  }
  const input = document.getElementById("safeListInput");
  if (input) input.value = currentSafeList.join(", ");
});

// Modal Logic
const modal = document.getElementById("settingsModal");
const openBtn = document.getElementById("openSettingsBtn");
const closeX = document.getElementById("modalCloseX");
const cancelBtn = document.getElementById("modalCancelBtn");
const saveBtn = document.getElementById("saveSettingsBtn");

if (openBtn)
  openBtn.addEventListener("click", () => modal && modal.showModal());
if (closeX) closeX.addEventListener("click", () => modal && modal.close());
if (cancelBtn)
  cancelBtn.addEventListener("click", () => modal && modal.close());
if (modal)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });

if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const input = document.getElementById("safeListInput");
    const raw = input.value;
    const newList = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    chrome.storage.local.set({ safeList: newList }, () => {
      currentSafeList = newList;
      if (modal) modal.close();
      console.log("Settings saved:", currentSafeList);
    });
  });
}

// --- HELPER: ROBUST JSON PARSER ---
function parseAIResponse(responseString) {
  try {
    let clean = responseString.replace(/```json|```/g, "").trim();
    const startIndex = clean.indexOf("{");
    const endIndex = clean.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      throw new Error("No JSON object found.");
    }
    const jsonString = clean.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("AI RAW OUTPUT:", responseString);
    throw e;
  }
}

// 2. CSV UPLOAD HANDLER
document.getElementById("csvFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      urlQueue = results.data
        .filter((r) => r.url && r.url.startsWith("http"))
        .map((r) => r.url);
      if (urlQueue.length > 0) log(`✅ Loaded ${urlQueue.length} URLs.`);
      else log("❌ No valid URLs found. Check CSV headers.");
    },
  });
});

// 3. BATCH PROCESS RUNNER
document.getElementById("startBtn").addEventListener("click", async () => {
  if (urlQueue.length === 0) {
    alert("Please upload a valid CSV file before starting.");
    return;
  }
  const enableMultimodal = document.getElementById("enableMultimodal").checked;

  document.getElementById("setup").setAttribute("hidden", "true");
  document.getElementById("auditView").removeAttribute("hidden");
  document.getElementById("statusArea").removeAttribute("hidden");
  document.getElementById("completeView").setAttribute("hidden", "true");

  // SHOW WARNING if multimodal is on
  if (enableMultimodal) {
    document.getElementById("focusWarning").removeAttribute("hidden");
  } else {
    document.getElementById("focusWarning").setAttribute("hidden", "true");
  }

  const progressBar = document.getElementById("auditProgress");
  progressBar.value = 0;
  progressBar.max = urlQueue.length;
  progressBar.removeAttribute("indeterminate");

  auditResults = [];

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    updateStatus(i + 1, urlQueue.length, url);

    try {
      log(`Navigating to: ${url}`);
      const tab = await getActiveTab();

      try {
        const loadPromise = waitForTabLoad(tab.id);
        await chrome.tabs.update(tab.id, { url: url });
        await loadPromise;
      } catch (navErr) {
        log(`❌ Navigation Failed: ${navErr.message}`);
        auditResults.push({
          url,
          verdict: "ERROR",
          reason: "Page failed to load.",
          pageTitle: "Load Error",
        });
        continue;
      }

      log(`Analyzing DOM...`);
      log(`Running Axe Core...`);
      const axeResults = await runAxeAudit(tab.id);
      axeResults.forEach((r) => {
        if (r.verdict === "FAIL") log(`[Axe: ${r.ruleId}] ❌ FAIL`);
        auditResults.push({ url, ...r });
      });
      log(`✅ Axe Complete: ${axeResults.length} checks processed.`);

      const incompleteLeads = axeResults.filter(
        (r) => r.verdict === "INCOMPLETE"
      );

      log(`Running Gemini Nano...`);
      for (const ruleId in RULES) {
        const rule = RULES[ruleId];
        const relevantLeads = incompleteLeads.filter(
          (l) => ruleId === "1.4.1" && l.ruleId === "link-in-text-block"
        );
        const targetSelectors = relevantLeads.flatMap((l) => l.selectors);

        try {
          if (rule.setup) {
            await rule.setup(tab.id);
            await new Promise((r) => setTimeout(r, 500));
          }

          const result = await runAuditOnTab(tab.id, rule, targetSelectors, {
            safeList: currentSafeList,
            enableMultimodal: enableMultimodal,
          });

          const statusIcon =
            result.verdict === "FAIL"
              ? "❌"
              : result.verdict === "PASS"
              ? "✅"
              : result.verdict === "INAPPLICABLE"
              ? "⚪"
              : result.verdict === "CANNOT_TELL"
              ? "❓"
              : "⚠️";
          if (result.verdict === "INAPPLICABLE")
            console.log(`[Nano: ${ruleId}] Skipped: ${result.reason}`);
          log(`[Nano: ${ruleId}] ${statusIcon} ${result.verdict}`);

          auditResults.push({ url, earlId: rule.earlId, ...result });
        } catch (ruleErr) {
          console.error(ruleErr);
          log(`⚠️ Error [${ruleId}]: ${ruleErr.message}`);
          auditResults.push({
            url,
            earlId: rule.earlId,
            verdict: "ERROR",
            reason: ruleErr.message,
            pageTitle: "Error",
          });
        } finally {
          if (rule.teardown) await rule.teardown(tab.id);
        }
      }
    } catch (err) {
      log(`⛔ Critical Error: ${err.message}`);
    }
  }
  finishAudit();
});

// 4. THE AI AUDITOR
async function runAuditOnTab(tabId, rule, targetSelectors = [], options = {}) {
  try {
    const { enableMultimodal } = options;

    if (rule.relevantElements && rule.relevantElements.length > 0) {
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selectors) =>
          selectors.some((s) => document.querySelector(s) !== null),
        args: [rule.relevantElements],
      });
      if (checkResult && checkResult[0] && !checkResult[0].result) {
        return {
          verdict: "INAPPLICABLE",
          reason: `No relevant elements found.`,
          pageTitle: "N/A",
        };
      }
    }

    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: rule.extractor,
      args: [targetSelectors, options],
    });

    if (!injection || !injection[0]) throw new Error("Script injection failed");
    const domContext = injection[0].result;

    if (domContext.computedVerdict === "PASS") {
      return {
        verdict: "PASS",
        reason: domContext.reason || "Passed internal check.",
        pageTitle: domContext.pageTitle,
      };
    }

    const isVisualRule = rule.id === "1.4.5" || rule.id === "1.4.1-images";
    const aiOrigin = window.LanguageModel;

    // CHECK: Handle Multimodal Disabled
    if (isVisualRule) {
      if (!enableMultimodal || !aiOrigin) {
        return {
          verdict: "CANNOT_TELL",
          reason:
            "The images on this page were not evaluated because the multimodal ai features were disabled for this test run. please manually assess the images on the page for this criteria, or re-run the test with the multimodal features turned on",
          pageTitle: domContext.pageTitle,
        };
      }
    }

    if (!aiOrigin) {
      if (domContext.computedVerdict) {
        return {
          verdict: domContext.computedVerdict,
          reason: JSON.stringify(domContext),
          pageTitle: domContext.pageTitle,
        };
      }
      return {
        verdict: "INAPPLICABLE",
        reason: "AI API missing.",
        pageTitle: domContext.pageTitle,
      };
    }

    // --- E. MULTIMODAL EXECUTION (SCROLL & SNAP) ---
    if (isVisualRule && domContext.images) {
      const results = [];
      let processedCount = 0;
      let session;

      try {
        session = await aiOrigin.create({
          expectedInputs: [{ type: "text" }, { type: "image" }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
        });
      } catch (err) {
        return {
          verdict: "INAPPLICABLE",
          reason: `Create Failed: ${err.message}`,
          pageTitle: domContext.pageTitle,
        };
      }

      for (const imgMeta of domContext.images) {
        // THROTTLE: 2 Seconds to Avoid Rate Limit
        await new Promise((r) => setTimeout(r, 2000));

        let captureRect = imgMeta.rect;
        let viewportWidth = 0;

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
                  rect: {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    top: r.top,
                    left: r.left,
                  },
                  windowWidth: window.innerWidth,
                };
              },
              args: [imgMeta.selector],
            });

            if (scrollResult && scrollResult[0] && scrollResult[0].result) {
              captureRect = scrollResult[0].result.rect;
              viewportWidth = scrollResult[0].result.windowWidth;
              // Wait for painting/rendering
              await new Promise((r) => setTimeout(r, 500));
            } else {
              continue; // Scroll failed
            }
          } catch (e) {
            console.warn("Scroll failed:", e);
            continue;
          }
        }

        // VALIDATION
        if (
          !captureRect ||
          typeof captureRect.width !== "number" ||
          captureRect.width <= 0 ||
          captureRect.height <= 0
        ) {
          console.warn(`Nano A11y: Skipped 0-size image: ${imgMeta.alt}`);
          continue;
        }

        // 3. CAPTURE & SCALE
        try {
          // FORCE FOCUS
          await chrome.windows.update(await getWindowId(tabId), {
            focused: true,
          });
          await chrome.tabs.update(tabId, { active: true });
          await new Promise((r) => setTimeout(r, 100));

          const screenshot = await getTabScreenshot();

          if (!screenshot || screenshot.width === 0) {
            console.warn("Screenshot capture failed (empty).");
            continue;
          }

          // DPI SCALING
          let scaledRect = captureRect;
          if (viewportWidth > 0 && screenshot.width > 0) {
            const zoomFactor = screenshot.width / viewportWidth;
            if (Math.abs(zoomFactor - 1) > 0.05) {
              scaledRect = {
                x: captureRect.x * zoomFactor,
                y: captureRect.y * zoomFactor,
                width: captureRect.width * zoomFactor,
                height: captureRect.height * zoomFactor,
              };
            }
          }

          const imageBlob = await cropImage(screenshot, scaledRect);

          if (!imageBlob) {
            console.warn(
              `Nano A11y: Failed to create blob for: ${imgMeta.alt}`
            );
            continue;
          }

          const imageBitmap = await createImageBitmap(imageBlob);
          processedCount++;

          const promptText = `\nSYSTEM INSTRUCTIONS:\n${rule.systemPrompt}\n\nUSER REQUEST:\nAnalyze this image. Alt text provided: "${imgMeta.alt}"\n`;
          const responseString = await session.prompt([
            {
              role: "user",
              content: [
                { type: "text", value: promptText },
                { type: "image", value: imageBitmap },
              ],
            },
          ]);
          const result = parseAIResponse(responseString);
          if (result.verdict === "FAIL" || result.verdict === "CANNOT_TELL") {
            results.push(
              `- Image (${imgMeta.src.substring(0, 30)}...): ${result.reason}`
            );
          }
        } catch (e) {
          console.error(`Capture/AI Error for ${imgMeta.alt}:`, e);
          results.push(
            `- Image (${imgMeta.alt}): Technical Error (Screenshot Failed). Please verify manually.`
          );
        }
      }
      session.destroy();

      if (processedCount === 0 && domContext.images.length > 0) {
        return {
          verdict: "CANNOT_TELL",
          reason:
            "Technical Error: Visual analysis failed for all detected images (screenshot/blob errors).",
          pageTitle: domContext.pageTitle,
        };
      }

      const hasErrors = results.some((r) => r.includes("Technical Error"));

      if (results.length > 0) {
        const prefix =
          rule.id === "1.4.5"
            ? "Images of Text detected"
            : "Visual reliance on color detected";
        const verdict = hasErrors ? "CANNOT_TELL" : "FAIL";

        return {
          verdict: verdict,
          reason: `${prefix}:\n` + results.join("\n"),
          pageTitle: domContext.pageTitle,
        };
      } else {
        const passReason =
          rule.id === "1.4.5"
            ? "No images of text found."
            : "No color-only charts or diagrams detected.";
        return {
          verdict: "PASS",
          reason: passReason,
          pageTitle: domContext.pageTitle,
        };
      }
    }

    // --- F. STANDARD TEXT-ONLY LOGIC ---
    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: rule.systemPrompt }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    const resultString = await session.prompt(JSON.stringify(domContext));
    const result = parseAIResponse(resultString);
    session.destroy();
    return { ...result, pageTitle: domContext.pageTitle };
  } catch (err) {
    throw err;
  }
}

// --- UTILS ---
async function getWindowId(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return tab.windowId;
}

async function getTabScreenshot() {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

async function cropImage(sourceImage, rect) {
  // Prevent zero-size or negative dimensions
  if (rect.width <= 0 || rect.height <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");

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

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const listener = (tid, changeInfo, tab) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        if (
          tab.url.startsWith("chrome-error:") ||
          tab.url.startsWith("chrome:") ||
          tab.url.startsWith("view-source:")
        ) {
          reject(new Error("Tab failed to load."));
        } else {
          setTimeout(resolve, 500);
        }
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function updateStatus(current, total, url) {
  const progressBar = document.getElementById("auditProgress");
  if (progressBar) {
    progressBar.value = current;
    progressBar.max = total;
  }
  document.getElementById("progressText").textContent = `${current}/${total}`;
  document.getElementById("currentUrl").textContent = url;
}

function log(msg) {
  const area = document.getElementById("log");
  const entry = document.createElement("div");
  entry.classList.add("log-entry");
  entry.textContent = `> ${msg}`;
  area.appendChild(entry);
  area.scrollTop = area.scrollHeight;
}

function finishAudit() {
  const reportOptions = {
    includePassed: document.getElementById("includePassed").checked,
    includeNotPresent: document.getElementById("includeNotPresent").checked,
  };
  const earlReport = generateEarlReport(auditResults, reportOptions);
  const jsonString = JSON.stringify(earlReport, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    { url: url, filename: "nano-audit-report.json" },
    (downloadId) => {
      if (chrome.runtime.lastError)
        log(`⚠️ Download failed: ${chrome.runtime.lastError.message}`);
      else log(`⬇️ Report downloaded (ID: ${downloadId})`);
    }
  );

  document.getElementById("statusArea").setAttribute("hidden", "true");
  document.getElementById("completeView").removeAttribute("hidden");
  document.getElementById("focusWarning").setAttribute("hidden", "true"); // HIDE WARNING

  document.getElementById("downloadBtn").onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });
  };
  log("✨ Audit Complete.");

  const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
  chrome.tabs.create({ url: reportToolUrl }, (tab) => {
    const inject = (tabId) => {
      log("🚀 Injecting report into W3C Tool...");
      chrome.scripting.executeScript(
        { target: { tabId }, func: injectReportFunction, args: [earlReport] },
        () => log("✅ Report injection script started.")
      );
    };
    if (tab.status === "complete") inject(tab.id);
    else {
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          inject(tabId);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    }
  });
}
