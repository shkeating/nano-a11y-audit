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

// Load Settings on Init
chrome.storage.local.get(["safeList"], (result) => {
  if (result.safeList) {
    currentSafeList = result.safeList;
  }
  // Populate Modal UI
  const input = document.getElementById("safeListInput");
  if (input) input.value = currentSafeList.join(", ");
});

// -- MODAL CONTROLS --
const modal = document.getElementById("settingsModal");
const openBtn = document.getElementById("openSettingsBtn");
const closeX = document.getElementById("modalCloseX");
const cancelBtn = document.getElementById("modalCancelBtn");
const saveBtn = document.getElementById("saveSettingsBtn");

// Open Modal
openBtn.addEventListener("click", () => {
  modal.showModal();
});

// Close Modal (Cancel)
const closeModal = () => modal.close();
closeX.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

// Close on outside click
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

// Save Settings
saveBtn.addEventListener("click", () => {
  const input = document.getElementById("safeListInput");
  const raw = input.value;

  // Parse CSV to Array
  const newList = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  chrome.storage.local.set({ safeList: newList }, () => {
    currentSafeList = newList;
    // Visual feedback handled by closing the modal
    modal.close();
    // Optional: Log to console/UI
    console.log("Settings saved:", currentSafeList);
  });
});

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

      if (urlQueue.length > 0) {
        log(`✅ Loaded ${urlQueue.length} URLs.`);
      } else {
        log("❌ No valid URLs found. Check CSV headers.");
      }
    },
  });
});

// 3. BATCH PROCESS RUNNER
document.getElementById("startBtn").addEventListener("click", async () => {
  if (urlQueue.length === 0) {
    alert("Please upload a valid CSV file before starting.");
    return;
  }

  document.getElementById("setup").setAttribute("hidden", "true");
  document.getElementById("auditView").removeAttribute("hidden");
  document.getElementById("statusArea").removeAttribute("hidden");
  document.getElementById("completeView").setAttribute("hidden", "true");

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

      // WAIT FOR LOAD
      try {
        const loadPromise = waitForTabLoad(tab.id);
        await chrome.tabs.update(tab.id, { url: url });
        await loadPromise;
      } catch (navErr) {
        log(`❌ Navigation Failed: ${navErr.message}`);
        auditResults.push({
          url,
          verdict: "ERROR",
          reason: "Page failed to load (404 or Server Down).",
          pageTitle: "Load Error",
        });
        continue;
      }

      log(`Analyzing DOM...`);

      // 1. Run Axe Core Audit
      log(`Running Axe Core...`);
      const axeResults = await runAxeAudit(tab.id);

      axeResults.forEach((r) => {
        if (r.verdict === "FAIL") {
          log(`[Axe: ${r.ruleId}] ❌ FAIL`);
        }
        if (r.verdict !== "INCOMPLETE") {
          auditResults.push({
            url,
            ...r,
          });
        }
      });
      log(`✅ Axe Complete: ${axeResults.length} checks processed.`);

      const incompleteLeads = axeResults.filter(
        (r) => r.verdict === "INCOMPLETE"
      );

      // 2. Run Gemini Nano Audit
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

          // Pass currentSafeList to the rule
          const result = await runAuditOnTab(tab.id, rule, targetSelectors, {
            safeList: currentSafeList,
          });

          const statusIcon =
            result.verdict === "FAIL"
              ? "❌"
              : result.verdict === "PASS"
              ? "✅"
              : result.verdict === "INAPPLICABLE"
              ? "⚪"
              : "⚠️";

          if (result.verdict === "INAPPLICABLE") {
            // Downgraded to log to prevent console warnings
            console.log(`[Nano: ${ruleId}] Skipped: ${result.reason}`);
          }

          log(`[Nano: ${ruleId}] ${statusIcon} ${result.verdict}`);

          auditResults.push({
            url,
            earlId: rule.earlId,
            ...result,
          });
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
          if (rule.teardown) {
            await rule.teardown(tab.id);
          }
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
    // A. PRE-FLIGHT CHECK
    if (rule.relevantElements && rule.relevantElements.length > 0) {
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selectors) => {
          return selectors.some((s) => document.querySelector(s) !== null);
        },
        args: [rule.relevantElements],
      });

      if (checkResult && checkResult[0] && !checkResult[0].result) {
        return {
          verdict: "INAPPLICABLE",
          reason: `No relevant elements (${rule.relevantElements.join(
            ","
          )}) found on page.`,
          pageTitle: "N/A",
        };
      }
    }

    // B. Inject Extractor
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: rule.extractor,
      // Pass both selectors AND options (safeList)
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

    // C. AI API Detection
    const aiOrigin = window.LanguageModel;

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
        reason: "AI API missing (window.LanguageModel undefined).",
        pageTitle: domContext.pageTitle,
      };
    }

    // --- D. MULTIMODAL LOGIC ---
    if (
      (rule.id === "1.4.5" || rule.id === "1.4.1-images") &&
      domContext.images
    ) {
      const screenshot = await getTabScreenshot();
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
          reason: `Create Failed: ${err.message}`,
          pageTitle: domContext.pageTitle,
        };
      }

      for (const imgMeta of domContext.images) {
        const imageBlob = await cropImage(screenshot, imgMeta.rect);
        const imageBitmap = await createImageBitmap(imageBlob);

        try {
          const promptText = `
SYSTEM INSTRUCTIONS:
${rule.systemPrompt}

USER REQUEST:
Analyze this image. Alt text provided: "${imgMeta.alt}"
`;
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

          if (result.verdict === "FAIL") {
            results.push(
              `- Image (${imgMeta.src.substring(0, 30)}...): ${result.reason}`
            );
          }
        } catch (e) {
          console.error("AI Processing Error:", e);
        }
      }

      session.destroy();

      if (results.length > 0) {
        // 1. Dynamic Failure Prefix
        const prefix =
          rule.id === "1.4.5"
            ? "Images of Text detected"
            : "Visual reliance on color detected";

        return {
          verdict: "FAIL",
          reason: `${prefix}:\n` + results.join("\n"),
          pageTitle: domContext.pageTitle,
        };
      } else {
        // 2. Dynamic Passing Reason
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

    // --- E. STANDARD TEXT-ONLY LOGIC ---
    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: rule.systemPrompt }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });

    const resultString = await session.prompt(JSON.stringify(domContext));
    const result = parseAIResponse(resultString);
    session.destroy();

    return {
      ...result,
      pageTitle: domContext.pageTitle,
    };
  } catch (err) {
    throw err;
  }
}

// --- UTILS ---

async function getTabScreenshot() {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

async function cropImage(sourceImage, rect) {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    sourceImage,
    rect.x,
    rect.y,
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
      if (chrome.runtime.lastError) {
        log(`⚠️ Download failed: ${chrome.runtime.lastError.message}`);
      } else {
        log(`⬇️ Report downloaded (ID: ${downloadId})`);
      }
    }
  );

  document.getElementById("statusArea").setAttribute("hidden", "true");
  document.getElementById("completeView").removeAttribute("hidden");

  document.getElementById("downloadBtn").onclick = () => {
    chrome.downloads.download({
      url: url,
      filename: "nano-audit-report.json",
    });
  };

  log("✨ Audit Complete.");

  const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
  chrome.tabs.create({ url: reportToolUrl }, (tab) => {
    const inject = (tabId) => {
      log("🚀 Injecting report into W3C Tool...");
      chrome.scripting.executeScript(
        { target: { tabId }, func: injectReportFunction, args: [earlReport] },
        () => {
          log("✅ Report injection script started.");
        }
      );
    };

    if (tab.status === "complete") {
      inject(tab.id);
    } else {
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
