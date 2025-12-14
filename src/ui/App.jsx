import { useState, useEffect, useRef } from "preact/hooks";
import Papa from "papaparse";
import { loadSafeList, saveSafeList } from "../services/storage";
import { analyzePage } from "../services/audit-runner";
import { generateEarlReport } from "../utils/earl-reporter";
import { injectReportFunction } from "../utils/report-injector";
import { usePerformanceTracker } from "../hooks/usePerformanceTracker";

// Import Components
import { SetupView } from "./components/SetupView";
import { AuditView } from "./components/AuditView";
import { CompleteView } from "./components/CompleteView";
import { SettingsModal } from "./components/SettingsModal";

// Level AAA Criteria IDs to exclude from the AA summary count
const AAA_IDS = [
  "WCAG22:contrast-enhanced",
  "WCAG22:images-of-text-no-exception",
  "WCAG22:keyboard-no-exception",
  "WCAG22:no-timing",
  "WCAG22:interruptions",
  "WCAG22:re-authenticating",
  "WCAG22:timeouts",
  "WCAG22:three-flashes",
  "WCAG22:focus-not-obscured-enhanced",
  "WCAG22:target-size", // 2.5.5 (AAA) vs target-size-minimum (AA)
  "WCAG22:unusual-words",
  "WCAG22:abbreviations",
  "WCAG22:reading-level",
  "WCAG22:pronunciation",
  "WCAG22:change-on-request",
  "WCAG22:help",
  "WCAG22:error-prevention-all",
  "WCAG22:accessible-authentication-enhanced",
];

export function App() {
  // --- STATE ---
  const [view, setView] = useState("setup");
  const [urlQueue, setUrlQueue] = useState([]);
  const [auditResults, setAuditResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentUrl: "Waiting...",
  });

  // Performance Hook
  const tracker = usePerformanceTracker();

  // Report Data & Summary
  const [finalReport, setFinalReport] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    passed: 0,
    failed: 0,
    cantTell: 0,
    inapplicable: 0,
    untested: 0,
    totalCriteria: 55, // Fixed to WCAG 2.2 AA count
    averageDuration: 0,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    safeList: [],
    enableMultimodal: true,
    enableLanguageDetection: true,
    includePassed: false,
    includeNotPresent: false,
  });

  const logEndRef = useRef(null);

  // --- EFFECTS ---
  useEffect(() => {
    loadSafeList().then((list) => {
      setSettings((prev) => ({ ...prev, safeList: list }));
    });
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // --- ACTIONS ---

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettingsToStorage = () => {
    saveSafeList(settings.safeList);
    setShowSettings(false);
  };

  const addLog = (msg) => {
    setLogs((prev) => [...prev, `> ${msg}`]);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const urls = results.data
          .filter((r) => r.url && r.url.startsWith("http"))
          .map((r) => r.url);

        if (urls.length > 0) {
          setUrlQueue(urls);
        } else {
          alert("No valid URLs found. Please check CSV headers.");
        }
      },
    });
  };

  const runAudit = async () => {
    if (urlQueue.length === 0) {
      alert("Please upload a CSV file with URLs to start the audit.");
      return;
    }

    setView("auditing");
    setAuditResults([]);
    setLogs([]);
    tracker.resetTimings();

    const resultsAccumulator = [];

    for (let i = 0; i < urlQueue.length; i++) {
      const url = urlQueue[i];
      setProgress({ current: i + 1, total: urlQueue.length, currentUrl: url });
      addLog(`Navigating to: ${url}`);

      tracker.startTimer();

      try {
        const tab = await getActiveTab();

        try {
          await navigateTab(tab.id, url);
        } catch (navErr) {
          tracker.stopTimer(url); // Ensure timer is cleared
          addLog(`❌ Navigation Failed: ${navErr.message}`);
          const errorResult = {
            url,
            verdict: "ERROR",
            reason: "Page failed to load.",
            latency: 0,
          };
          resultsAccumulator.push(errorResult);
          setAuditResults((prev) => [...prev, errorResult]);
          continue;
        }

        addLog(`Analyzing DOM...`);
        const pageResults = await analyzePage(tab.id, url, {
          safeList: settings.safeList,
          enableMultimodal: settings.enableMultimodal,
          enableLanguageDetection: settings.enableLanguageDetection,
          logger: addLog,
        });

        const duration = tracker.stopTimer(url);
        addLog(`✅ Page Complete (${(duration / 1000).toFixed(2)}s).`);

        // Inject latency into results for CSV
        const resultsWithLatency = pageResults.map((r) => ({
          ...r,
          latency: duration,
        }));

        resultsAccumulator.push(...resultsWithLatency);
        setAuditResults((prev) => [...prev, ...resultsWithLatency]);
      } catch (err) {
        tracker.stopTimer(url); // Ensure timer is cleared
        addLog(`⛔ Critical Error: ${err.message}`);
      }
    }

    finishAudit(resultsAccumulator);
  };

  const finishAudit = (finalResults) => {
    // 1. Generate the JSON-LD Report
    const reportOptions = {
      includePassed: true,
      includeNotPresent: true,
    };
    const earlReport = generateEarlReport(finalResults, reportOptions);

    // 2. Calculate Statistics
    const TOTAL_AA_CRITERIA = 55;
    const stats = {
      passed: 0,
      failed: 0,
      cantTell: 0,
      inapplicable: 0,
      untested: 0,
      totalCriteria: TOTAL_AA_CRITERIA,
      averageDuration: tracker.getAverageDuration(),
    };

    if (earlReport.auditSample) {
      // Filter: Website-level assertions only AND exclude AAA criteria
      const criterionAssertions = earlReport.auditSample.filter(
        (a) =>
          a.subject &&
          a.subject.type &&
          a.subject.type.includes("Website") &&
          !AAA_IDS.includes(a.test.id)
      );

      criterionAssertions.forEach((assertion) => {
        const outcomeId = assertion.result.outcome.id;
        if (outcomeId === "earl:passed") stats.passed++;
        else if (outcomeId === "earl:failed") stats.failed++;
        else if (outcomeId === "earl:cantTell") stats.cantTell++;
        else if (outcomeId === "earl:inapplicable") stats.inapplicable++;
      });
    }

    // 3. Force mathematical consistency for "Untested"
    const evaluatedCount =
      stats.passed + stats.failed + stats.cantTell + stats.inapplicable;
    stats.untested = Math.max(0, stats.totalCriteria - evaluatedCount);

    setFinalReport(earlReport);
    setSummaryStats(stats);

    setView("complete");
    addLog("✨ Audit Complete. Ready for review.");
  };

  // --- ACTIONS ---

  const handleImportToW3C = () => {
    if (!finalReport) return;

    const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
    chrome.tabs.create({ url: reportToolUrl }, (tab) => {
      const executeInjection = (targetTabId) => {
        addLog("🚀 Injecting report into W3C Tool...");
        chrome.scripting.executeScript(
          {
            target: { tabId: targetTabId },
            func: injectReportFunction,
            args: [finalReport],
          },
          () => addLog("✅ Report injection script started.")
        );
      };

      if (tab.status === "complete") {
        executeInjection(tab.id);
      } else {
        const listener = (tid, changeInfo) => {
          if (tid === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            executeInjection(tid);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  };

  const handleDownloadJson = () => {
    if (!finalReport) return;
    const jsonString = JSON.stringify(finalReport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });
  };

  // --- HELPERS ---
  const getActiveTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  };

  const navigateTab = (tabId, url) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, { url });
      const listener = (tid, changeInfo, tab) => {
        if (tid === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          if (
            tab.url.startsWith("chrome-error:") ||
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
  };

  // --- RENDER ---
  return (
    <main className="container">
      <header id="appHeader">
        <h2>Nano A11y Audit</h2>
      </header>

      {view === "setup" && (
        <SetupView
          onFileUpload={handleFileUpload}
          onOpenSettings={() => setShowSettings(true)}
          onStartAudit={runAudit}
          urlCount={urlQueue.length}
        />
      )}

      {view === "auditing" && (
        <AuditView
          enableMultimodal={settings.enableMultimodal}
          progress={progress}
          logs={logs}
          logEndRef={logEndRef}
        />
      )}

      {view === "complete" && (
        <CompleteView
          summary={summaryStats}
          results={auditResults}
          pageTimings={tracker.pageTimings}
          onImport={handleImportToW3C}
          onDownload={handleDownloadJson}
          onStartNew={() => setView("setup")}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettingsToStorage}
        settings={settings}
        onUpdateSetting={updateSetting}
      />
    </main>
  );
}
