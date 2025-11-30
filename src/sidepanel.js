import Papa from "papaparse";
import { RULES } from "./rules/index.js";
import { generateEarlReport } from "./utils/earl-reporter.js";
import { runAxeAudit } from "./utils/axe-runner.js";
import { injectReportFunction } from "./utils/report-injector.js";

let urlQueue = [];
let auditResults = [];

// 1. CSV UPLOAD HANDLER
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
        document.getElementById("startBtn").disabled = false;
      } else {
        log("❌ No valid URLs found. Check CSV headers.");
      }
    },
  });
});

// 2. BATCH PROCESS RUNNER
document.getElementById("startBtn").addEventListener("click", async () => {
  document.getElementById("startBtn").disabled = true;
  document.getElementById("statusArea").style.display = "block";
  auditResults = [];

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    updateStatus(i + 1, urlQueue.length, url);

    try {
      log(`Navigating to: ${url}`);
      const tab = await getActiveTab();

      const loadPromise = waitForTabLoad(tab.id);
      await chrome.tabs.update(tab.id, { url: url });
      await loadPromise;

      log(`Analyzing DOM...`);

      // 1. Run Axe Core Audit
      log(`Running Axe Core...`);
      const axeResults = await runAxeAudit(tab.id);

      axeResults.forEach((r) => {
        if (r.verdict === "FAIL") {
          log(`[Axe: ${r.ruleId}] ❌ FAIL`);
        }
        auditResults.push({
          url,
          ...r,
        });
      });
      log(`✅ Axe Complete: ${axeResults.length} checks mapped.`);

      // 2. Run Gemini Nano Audit (Iterate through Rules Registry)
      log(`Running Gemini Nano...`);
      for (const ruleId in RULES) {
        const rule = RULES[ruleId];

        try {
          const result = await runAuditOnTab(tab.id, rule);

          const statusIcon =
            result.verdict === "FAIL"
              ? "❌"
              : result.verdict === "PASS"
              ? "✅"
              : "⚠️";
          log(`[Nano: ${ruleId}] ${statusIcon} ${result.verdict}`);

          auditResults.push({
            url,
            earlId: rule.earlId, // Needed for the report
            ...result,
          });
        } catch (ruleErr) {
          console.error(ruleErr);
          log(`⚠️ Error [${ruleId}]: ${ruleErr.message}`);
          // Push an error result so the report isn't empty
          auditResults.push({
            url,
            earlId: rule.earlId,
            verdict: "ERROR",
            reason: ruleErr.message,
            pageTitle: "Error",
          });
        }
      }
    } catch (err) {
      log(`⛔ Critical Error: ${err.message}`);
    }
  }

  finishAudit();
});

// 3. THE AI AUDITOR
async function runAuditOnTab(tabId, rule) {
  try {
    // A. Inject Extractor
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: rule.extractor, // Uses the specific rule's extractor
    });

    if (!injection || !injection[0]) throw new Error("Script injection failed");
    const domContext = injection[0].result;

    // B. Check AI API
    // Robust check for both namespaces
    const aiOrigin = window.ai?.languageModel || window.LanguageModel;

    if (!aiOrigin) {
      return {
        verdict: "ERROR",
        reason: "AI API missing",
        pageTitle: domContext.pageTitle,
      };
    }

    // C. Create Session
    const session = await aiOrigin.create({
      initialPrompts: [
        {
          role: "system",
          content: rule.systemPrompt, // Use the specific rule's prompt
        },
      ],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });

    // D. Prompt
    const resultString = await session.prompt(JSON.stringify(domContext));

    // E. Parse (The "Hunter" Logic)
    // Find the first '{' and the last '}' to ignore conversational text
    const jsonMatch = resultString.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("Raw AI Output:", resultString); // Log for debugging
      throw new Error(
        `No JSON found in output. Raw: "${resultString.substring(0, 20)}..."`
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    session.destroy();

    return {
      ...result,
      pageTitle: domContext.pageTitle,
    };
  } catch (err) {
    throw err; // Bubble up to the main loop
  }
}

// --- UTILS ---

function waitForTabLoad(tabId) {
  return new Promise(async (resolve) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") {
        setTimeout(resolve, 1000);
        return;
      }
    } catch (e) {}

    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000);
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
  document.getElementById("progress").textContent = `${current}/${total}`;
  document.getElementById("currentUrl").textContent = url;
}

function log(msg) {
  const area = document.getElementById("log");
  area.value += `> ${msg}\n`;
  area.scrollTop = area.scrollHeight;
}

function finishAudit() {
  document.getElementById("startBtn").disabled = false;
  document.getElementById("startBtn").textContent = "Audit Complete";

  const earlReport = generateEarlReport(auditResults);
  const jsonString = JSON.stringify(earlReport, null, 2);
  const blob = new Blob([jsonString], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  // 1. Auto-download the JSON file
  chrome.downloads.download({ url: url, filename: "nano-audit-report.json" }, (downloadId) => {
    if (chrome.runtime.lastError) {
      log(`⚠️ Download failed: ${chrome.runtime.lastError.message}`);
    } else {
      log(`⬇️ Report downloaded (ID: ${downloadId})`);
    }
  });

  // Show download button anyway in case user wants to download again
  const btn = document.getElementById("downloadBtn");
  btn.style.display = "block";
  btn.onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });
  };

  log("🏁 Done. Opening W3C Report Tool...");

  // 2. Open W3C Report Tool and inject data
  const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
  chrome.tabs.create({ url: reportToolUrl }, (tab) => {
    const inject = (tabId) => {
      log("🚀 Injecting report into W3C Tool...");
      // Inject script programmatically
      chrome.scripting.executeScript({
        target: { tabId },
        func: injectReportFunction,
        args: [earlReport]
      }, (results) => {
         if (chrome.runtime.lastError) {
           log(`⚠️ Injection failed: ${chrome.runtime.lastError.message}`);
         } else {
           log("✅ Report injection script started.");
         }
      });
    };

    if (tab.status === 'complete') {
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
