// src/ui/App.jsx
import { useState, useEffect, useRef } from "preact/hooks";
import Papa from "papaparse";
import { loadSafeList, saveSafeList } from "../services/storage";
import { analyzePage } from "../services/audit-runner";
import { generateEarlReport } from "../utils/earl-reporter";
import { injectReportFunction } from "../utils/report-injector";

// Import Components
import { SetupView } from "./components/SetupView";
import { AuditView } from "./components/AuditView";
import { CompleteView } from "./components/CompleteView";
import { SettingsModal } from "./components/SettingsModal";

export function App() {
  // --- STATE ---
  const [view, setView] = useState("setup"); // 'setup', 'auditing', 'complete'
  const [urlQueue, setUrlQueue] = useState([]);
  const [auditResults, setAuditResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentUrl: "Waiting...",
  });

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    safeList: [],
    enableMultimodal: true,
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

    const resultsAccumulator = [];

    for (let i = 0; i < urlQueue.length; i++) {
      const url = urlQueue[i];
      setProgress({ current: i + 1, total: urlQueue.length, currentUrl: url });
      addLog(`Navigating to: ${url}`);

      try {
        const tab = await getActiveTab();

        try {
          await navigateTab(tab.id, url);
        } catch (navErr) {
          addLog(`❌ Navigation Failed: ${navErr.message}`);
          const errorResult = {
            url,
            verdict: "ERROR",
            reason: "Page failed to load.",
          };
          resultsAccumulator.push(errorResult);
          setAuditResults((prev) => [...prev, errorResult]);
          continue;
        }

        addLog(`Analyzing DOM...`);
        const pageResults = await analyzePage(tab.id, url, {
          safeList: settings.safeList,
          enableMultimodal: settings.enableMultimodal,
          logger: addLog,
        });

        resultsAccumulator.push(...pageResults);
        setAuditResults((prev) => [...prev, ...pageResults]);
        addLog(`✅ Page Complete.`);
      } catch (err) {
        addLog(`⛔ Critical Error: ${err.message}`);
      }
    }

    finishAudit(resultsAccumulator);
  };

  const finishAudit = (finalResults) => {
    const reportOptions = {
      includePassed: settings.includePassed,
      includeNotPresent: settings.includeNotPresent,
    };
    const earlReport = generateEarlReport(finalResults, reportOptions);
    downloadReport(earlReport);

    setView("complete");
    addLog("✨ Audit Complete.");

    const reportToolUrl = "https://www.w3.org/WAI/eval/report-tool/";
    chrome.tabs.create({ url: reportToolUrl }, (tab) => {
      const executeInjection = (targetTabId) => {
        addLog("🚀 Injecting report into W3C Tool...");
        chrome.scripting.executeScript(
          {
            target: { tabId: targetTabId },
            func: injectReportFunction,
            args: [earlReport],
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

  const downloadReport = (reportData) => {
    const jsonString = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });
  };

  const downloadAgain = () => {
    const reportOptions = {
      includePassed: settings.includePassed,
      includeNotPresent: settings.includeNotPresent,
    };
    const earlReport = generateEarlReport(auditResults, reportOptions);
    downloadReport(earlReport);
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
          onDownloadAgain={downloadAgain}
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
