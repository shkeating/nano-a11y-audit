// src/ui/App.jsx
import { useState, useEffect, useRef } from "preact/hooks";
import Papa from "papaparse";
import { loadSafeList, saveSafeList } from "../services/storage";
import { analyzePage } from "../services/audit-runner"; // Your optimized runner
import { generateEarlReport } from "../utils/earl-reporter";
import { injectReportFunction } from "../utils/report-injector";

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

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [safeList, setSafeList] = useState([]);
  const [enableMultimodal, setEnableMultimodal] = useState(true);
  const [includePassed, setIncludePassed] = useState(false);
  const [includeNotPresent, setIncludeNotPresent] = useState(false);

  // Auto-scroll ref for logs
  const logEndRef = useRef(null);

  // --- EFFECTS ---

  // Load settings on boot
  useEffect(() => {
    loadSafeList().then(setSafeList);
  }, []);

  // Auto-scroll logs whenever they change
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // --- ACTIONS ---

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
          addLog(`✅ Loaded ${urls.length} URLs.`);
        } else {
          addLog("❌ No valid URLs found. Check CSV headers.");
        }
      },
    });
  };

  const runAudit = async () => {
    if (urlQueue.length === 0) return;

    setView("auditing");
    setAuditResults([]);
    setLogs([]); // Clear previous logs

    const resultsAccumulator = [];

    for (let i = 0; i < urlQueue.length; i++) {
      const url = urlQueue[i];
      setProgress({ current: i + 1, total: urlQueue.length, currentUrl: url });
      addLog(`Navigating to: ${url}`);

      try {
        const tab = await getActiveTab();

        // Navigation Step
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

        // Analysis Step
        addLog(`Analyzing DOM...`);
        const pageResults = await analyzePage(tab.id, url, {
          safeList,
          enableMultimodal,
          logger: addLog, // Pass our state-updater as the logger
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
    const reportOptions = { includePassed, includeNotPresent };
    const earlReport = generateEarlReport(finalResults, reportOptions);

    // Auto-download
    const jsonString = JSON.stringify(earlReport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });

    setView("complete");
    addLog("✨ Audit Complete.");

    // Inject into W3C Tool
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
          // Check for chrome error pages
          if (
            tab.url.startsWith("chrome-error:") ||
            tab.url.startsWith("view-source:")
          ) {
            reject(new Error("Tab failed to load."));
          } else {
            setTimeout(resolve, 500); // Wait for render
          }
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  };

  const downloadAgain = () => {
    const reportOptions = { includePassed, includeNotPresent };
    const earlReport = generateEarlReport(auditResults, reportOptions);
    const jsonString = JSON.stringify(earlReport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url: url, filename: "nano-audit-report.json" });
  };

  // --- RENDER ---
  return (
    <main className="container">
      <header id="appHeader">
        <h2>Nano A11y Audit</h2>
      </header>

      {/* VIEW: SETUP */}
      {view === "setup" && (
        <div id="setup">
          <h3>Getting Started</h3>
          <p className="instruction-text">
            Upload a CSV of URLs to begin the hybrid audit.
          </p>

          <div className="flex">
            <section style={{ width: "100%" }}>
              <h3>Test Sample</h3>
              <label htmlFor="csvFile">Load URLs (CSV):</label>
              <input
                type="file"
                id="csvFile"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </section>
          </div>

          <div className="grid" style={{ marginTop: "20px" }}>
            <button
              className="secondary outline"
              onClick={() => setShowSettings(true)}
            >
              Configure Settings
            </button>
            <button onClick={runAudit} disabled={urlQueue.length === 0}>
              Start Batch Audit
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AUDITING */}
      {view === "auditing" && (
        <div id="auditView">
          {enableMultimodal && (
            <div className="warning-box">
              <strong>IMPORTANT: Keep Window Focused</strong>
              <p style={{ marginBottom: 0, fontSize: "0.9em" }}>
                Visual checks require the page to be visible on screen. Do not
                minimize.
              </p>
            </div>
          )}

          <div className="status-box">
            <h3>Audit Status</h3>
            <div>
              <strong>Progress:</strong> {progress.current}/{progress.total}
            </div>
            <progress
              value={progress.current}
              max={progress.total}
              style={{ width: "100%" }}
            ></progress>
            <div className="status-current-url">
              <strong>Current:</strong> <span>{progress.currentUrl}</span>
            </div>

            {/* Log Area */}
            <section id="log" role="log" aria-live="polite">
              {logs.map((msg, i) => (
                <div key={i} className="log-entry">
                  {msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </section>
          </div>
        </div>
      )}

      {/* VIEW: COMPLETE */}
      {view === "complete" && (
        <div
          className="complete-box"
          style={{ textAlign: "center", marginTop: "2rem" }}
        >
          <h3>Audit Completed</h3>
          <p>The report has been downloaded and the W3C Tool opened.</p>
          <div className="grid">
            <button className="contrast" onClick={downloadAgain}>
              Download Report Again
            </button>
            <button onClick={() => setView("setup")}>Start New Audit</button>
          </div>
        </div>
      )}

      {/* MODAL: SETTINGS */}
      <dialog open={showSettings}>
        <article>
          <header>
            <h3>Settings</h3>
            <button
              aria-label="Close"
              className="close"
              onClick={() => setShowSettings(false)}
            ></button>
          </header>

          <fieldset>
            <legend>
              <h4>Testing</h4>
            </legend>
            <label>
              <input
                type="checkbox"
                checked={enableMultimodal}
                onChange={(e) => setEnableMultimodal(e.target.checked)}
              />{" "}
              Enable Multimodal AI (Images)
            </label>
            <small
              style={{ display: "block", marginBottom: "10px", color: "#888" }}
            >
              Uncheck for faster, text-only audits.
            </small>
            <hr />
            <label>2.4.6 Heading & Labels Safe Terms (Comma Separated)</label>
            <textarea
              rows="6"
              style={{ fontSize: "0.9em" }}
              value={safeList.join(", ")}
              onInput={(e) =>
                setSafeList(e.target.value.split(",").map((s) => s.trim()))
              }
            />
          </fieldset>

          <fieldset>
            <legend>
              <h4>Reporting</h4>
            </legend>
            <label>
              <input
                type="checkbox"
                checked={includePassed}
                onChange={(e) => setIncludePassed(e.target.checked)}
              />
              Include 'Passed' results
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeNotPresent}
                onChange={(e) => setIncludeNotPresent(e.target.checked)}
              />
              Include 'Not Present' results
            </label>
          </fieldset>

          <footer>
            <button
              className="secondary"
              onClick={() => setShowSettings(false)}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                saveSafeList(safeList);
                setShowSettings(false);
              }}
            >
              Save Changes
            </button>
          </footer>
        </article>
      </dialog>
    </main>
  );
}
