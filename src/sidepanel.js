import "@picocss/pico";
import "./sidepanel.css";

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
      } else {
        log("❌ No valid URLs found. Check CSV headers.");
      }
    },
  });
});

// 2. BATCH PROCESS RUNNER
document.getElementById("startBtn").addEventListener("click", async () => {
  if (urlQueue.length === 0) {
    alert("Please upload a valid CSV file before starting.");
    return;
  }

  // --- VIEW TRANSITION ---
  // Hide Setup
  document.getElementById("setup").setAttribute("hidden", "true");

  // Show Audit View
  document.getElementById("auditView").removeAttribute("hidden");

  // Reset Audit View States (in case of re-run)
  document.getElementById("statusArea").removeAttribute("hidden");
  document.getElementById("completeView").setAttribute("hidden", "true");

  // Initialize Progress Bar
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

      const loadPromise = waitForTabLoad(tab.id);
      await chrome.tabs.update(tab.id, { url: url });
      await loadPromise;

      log(`Analyzing DOM...`);

      // 1. Run Axe Core Audit
      log(`Running Axe Core...`);
      const axeResults = await runAxeAudit(tab.id);

      // Filter out 'INCOMPLETE' results from final report
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

      // Identify 'leads' for Nano
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
          const result = await runAuditOnTab(tab.id, rule, targetSelectors);

          const statusIcon =
            result.verdict === "FAIL"
              ? "❌"
              : result.verdict === "PASS"
              ? "✅"
              : "⚠️";
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
        }
      }
    } catch (err) {
      log(`⛔ Critical Error: ${err.message}`);
    }
  }

  finishAudit();
});

// 3. THE AI AUDITOR
async function runAuditOnTab(tabId, rule, targetSelectors = []) {
  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: rule.extractor,
      args: [targetSelectors],
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

    const aiOrigin = window.ai?.languageModel || window.LanguageModel;

    if (!aiOrigin) {
      if (domContext.computedVerdict) {
        return {
          verdict: domContext.computedVerdict,
          reason: JSON.stringify(domContext),
          pageTitle: domContext.pageTitle,
        };
      }
      return {
        verdict: "ERROR",
        reason: "AI API missing",
        pageTitle: domContext.pageTitle,
      };
    }

    const session = await aiOrigin.create({
      initialPrompts: [{ role: "system", content: rule.systemPrompt }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });

    const resultString = await session.prompt(JSON.stringify(domContext));
    const jsonMatch = resultString.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("Raw AI Output:", resultString);
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
    throw err;
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

  // 1. Trigger Download
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

  // 2. Show Complete View
  document.getElementById("statusArea").setAttribute("hidden", "true");
  document.getElementById("completeView").removeAttribute("hidden");

  // 3. Setup Download Button (In case they want to download again)
  const btn = document.getElementById("downloadBtn");
  btn.onclick = () => {
    chrome.downloads.download({
      url: url,
      filename: "nano-audit-report.json",
    });
  };

  log("✨ Audit Complete.");

  // 4. Inject into W3C Tool
  log("🏁 Opening W3C Report Tool...");
  const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
  chrome.tabs.create({ url: reportToolUrl }, (tab) => {
    const inject = (tabId) => {
      log("🚀 Injecting report into W3C Tool...");
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: injectReportFunction,
          args: [earlReport],
        },
        (results) => {
          if (chrome.runtime.lastError) {
            log(`⚠️ Injection failed: ${chrome.runtime.lastError.message}`);
          } else {
            log("✅ Report injection script started.");
          }
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
