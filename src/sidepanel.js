// src/sidepanel.js
import "@picocss/pico";
import "./sidepanel.css";
import Papa from "papaparse";

// Modules
import { loadSafeList, saveSafeList } from "./services/storage.js";
import { UI } from "./ui/ui-controller.js";
import { analyzePage } from "./services/audit-runner.js"; // <--- This uses your new optimized runner
import { generateEarlReport } from "./utils/earl-reporter.js";
import { injectReportFunction } from "./utils/report-injector.js";

// State
let urlQueue = [];
let auditResults = [];
let currentSafeList = [];

// --- INITIALIZATION ---

// 1. Load Settings
loadSafeList().then((list) => {
  currentSafeList = list;
  UI.setSettingsInputValue(list);
});

// 2. Setup Settings Modal
UI.initSettingsModal((rawInput) => {
  const newList = rawInput
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  saveSafeList(newList).then((saved) => {
    currentSafeList = saved;
    console.log("Settings saved:", currentSafeList);
  });
});

// 3. CSV Handler
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

      if (urlQueue.length > 0) UI.log(`✅ Loaded ${urlQueue.length} URLs.`);
      else UI.log("❌ No valid URLs found. Check CSV headers.");
    },
  });
});

// 4. MAIN AUDIT LOOP
document.getElementById("startBtn").addEventListener("click", async () => {
  if (urlQueue.length === 0) {
    alert("Please upload a valid CSV file before starting.");
    return;
  }

  const enableMultimodal = document.getElementById("enableMultimodal").checked;
  UI.setAuditState(true, enableMultimodal);

  // Reset
  auditResults = [];

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    UI.updateProgress(i + 1, urlQueue.length, url);

    try {
      UI.log(`Navigating to: ${url}`);
      const tab = await getActiveTab();

      // Navigate and Wait
      try {
        const loadPromise = waitForTabLoad(tab.id);
        await chrome.tabs.update(tab.id, { url: url });
        await loadPromise;
      } catch (navErr) {
        UI.log(`❌ Navigation Failed: ${navErr.message}`);
        auditResults.push({
          url,
          verdict: "ERROR",
          reason: "Page failed to load.",
        });
        continue;
      }

      // Run Analysis
      UI.log(`Analyzing DOM...`);
      // Here we pass the UI logger so the runner can print updates live
      const pageResults = await analyzePage(tab.id, url, {
        safeList: currentSafeList,
        enableMultimodal: enableMultimodal,
        logger: UI.log.bind(UI),
      });

      auditResults.push(...pageResults);
      UI.log(`✅ Page Complete.`);
    } catch (err) {
      UI.log(`⛔ Critical Error: ${err.message}`);
    }
  }

  finishAudit();
});

// --- HELPERS ---

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const listener = (tid, changeInfo, tab) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        if (
          tab.url.startsWith("chrome-error:") ||
          tab.url.startsWith("view-source:")
        ) {
          reject(new Error("Tab failed to load."));
        } else {
          setTimeout(resolve, 500); // Small buffer for rendering
        }
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
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

  // Auto-download
  chrome.downloads.download(
    { url: url, filename: "nano-audit-report.json" },
    (downloadId) => {
      if (chrome.runtime.lastError)
        UI.log(`⚠️ Download failed: ${chrome.runtime.lastError.message}`);
      else UI.log(`⬇️ Report downloaded (ID: ${downloadId})`);
    }
  );

  // Update UI
  UI.setAuditState(false);
  UI.log("✨ Audit Complete.");

  // Re-bind download button
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      chrome.downloads.download({
        url: url,
        filename: "nano-audit-report.json",
      });
    };
  }

  // W3C Tool Injection
  const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
  chrome.tabs.create({ url: reportToolUrl }, (tab) => {
    const inject = (tabId) => {
      UI.log("🚀 Injecting report into W3C Tool...");
      chrome.scripting.executeScript(
        { target: { tabId }, func: injectReportFunction, args: [earlReport] },
        () => UI.log("✅ Report injection script started.")
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
