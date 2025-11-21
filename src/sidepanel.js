let urlQueue = [];
let results = [];
let isAuditing = false;

// 1. Handle CSV Upload
document.getElementById("csvFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  Papa.parse(file, {
    header: true,
    complete: (results) => {
      // Expects CSV column header "url"
      urlQueue = results.data.filter((row) => row.url).map((row) => row.url);
      document.getElementById("startBtn").disabled = false;
      log(`Loaded ${urlQueue.length} URLs ready for audit.`);
    },
  });
});

// 2. The Batch Loop (State Machine)
document.getElementById("startBtn").addEventListener("click", async () => {
  isAuditing = true;
  document.getElementById("statusArea").style.display = "block";

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    updateStatus(i + 1, urlQueue.length, url);

    try {
      // A. Navigate Active Tab
      const tab = await getActiveTab();
      await chrome.tabs.update(tab.id, { url: url });

      // B. Wait for Load (The "Critical Wait")
      await waitForTabLoad(tab.id);

      // C. Inject Extractor & Run AI
      log(`Analysing ${url}...`);
      const result = await runAuditOnTab(tab.id);

      // D. Save Result
      results.push({ url, ...result });
      log(`Verdict: ${result.verdict}`);
    } catch (err) {
      log(`Error on ${url}: ${err.message}`);
      results.push({ url, verdict: "ERROR", reason: err.message });
    }
  }

  finishAudit();
});

// Helper: Wait for Tab Status 'complete'
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        // Give a tiny buffer for client-side hydration (React/Vue sites)
        setTimeout(resolve, 1000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Helper: The "AI Handoff"
async function runAuditOnTab(tabId) {
  // 1. Inject Script to get DOM Context
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractDomContext, // defined below
  });

  const domContext = injection[0].result;

  // 2. Run Gemini Nano (LanguageModel API)
  if (!window.LanguageModel)
    return { verdict: "ERROR", reason: "AI API missing" };

  const session = await window.LanguageModel.create({
    systemPrompt:
      "You are an accessibility auditor. Check for WCAG 1.4.1 (Color). Return JSON {verdict, reason}.",
  });

  const response = await session.prompt(JSON.stringify(domContext));
  return JSON.parse(response);
}

// The Extractor (Runs inside the page)
function extractDomContext() {
  // Simple example for WCAG 1.4.1
  const links = Array.from(document.querySelectorAll("a")).slice(0, 5); // Limit to 5 for speed
  return links.map((a) => {
    const s = window.getComputedStyle(a);
    return {
      text: a.innerText,
      color: s.color,
      decoration: s.textDecorationLine,
    };
  });
}

// Utility: Get Active Tab
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
  area.value += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  area.scrollTop = area.scrollHeight;
}

function finishAudit() {
  isAuditing = false;
  const csv = Papa.unparse(results);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const btn = document.getElementById("downloadBtn");
  btn.style.display = "block";
  btn.onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano-audit-results.csv" });
  };
  log("Batch Complete! Download your report.");
}

// dev note: Right-click inside the Side Panel and hit Reload Frame to update with changes
