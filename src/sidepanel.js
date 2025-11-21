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
      // Filter for rows that actually have a 'url'
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
  auditResults = []; // Reset results

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    updateStatus(i + 1, urlQueue.length, url);

    try {
      // A. Navigate
      log(`Navigating to: ${url}`);
      const tab = await getActiveTab();
      await chrome.tabs.update(tab.id, { url: url });

      // B. Wait for Load
      await waitForTabLoad(tab.id);

      // C. Run Audit
      log(`Analyzing DOM...`);
      const result = await runAuditOnTab(tab.id);

      // D. Log Result
      const statusIcon = result.verdict === "FAIL" ? "❌" : "✅";
      log(`${statusIcon} Verdict: ${result.verdict}`);

      auditResults.push({ url, ...result });
    } catch (err) {
      log(`⚠️ Error: ${err.message}`);
      auditResults.push({ url, verdict: "ERROR", reason: err.message });
    }
  }

  finishAudit();
});

// 3. THE AI AUDITOR (Injected Script + Local AI)
async function runAuditOnTab(tabId) {
  // Step A: Inject the Extractor to get the Structured Context Object
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractDomContext, // This function runs INSIDE the web page
  });

  const domContext = injection[0].result;

  // Step B: Check AI Capability
  if (typeof window.LanguageModel === "undefined") {
    return { verdict: "ERROR", reason: "AI API (LanguageModel) missing" };
  }

  try {
    // Step C: Initialize Session (Using updated Pilot syntax)
    const session = await window.LanguageModel.create({
      expectedContext: "Accessibility Audit",
      initialPrompts: [
        {
          role: "system",
          content: `You are an accessibility auditor checking WCAG 1.4.1 (Use of Color).
                    RULE: Links must have visual indicators (underline, border, bold) other than color.
                    INSTRUCTIONS: 
                    - If textDecorationLine is 'none' AND borderBottomStyle is 'none', return {"verdict": "FAIL"}.
                    - Otherwise, return {"verdict": "PASS"}.
                    - Output JSON only.`,
        },
      ],
    });

    // Step D: Prompt the Model
    const aiResponse = await session.prompt(JSON.stringify(domContext));

    // Step E: Parse Output
    const cleanJson = aiResponse.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJson);

    session.destroy();
    return result;
  } catch (err) {
    return { verdict: "AI_ERROR", reason: err.message };
  }
}

// 4. THE EXTRACTOR (This runs inside the page, not the extension)
function extractDomContext() {
  // Grab the first 5 links for this pilot test
  const links = Array.from(document.querySelectorAll("a")).slice(0, 5);

  // Create the SCO (Structured Context Object)
  // We grab the *first* failing link we find, or just the first link if all pass
  // Real version would return an array, but we simplify for the AI input limit
  const target = links[0];
  if (!target) return { error: "No links found" };

  const s = window.getComputedStyle(target);
  return {
    tagName: "A",
    text: target.innerText.substring(0, 50),
    computedStyles: {
      color: s.color,
      textDecorationLine: s.textDecorationLine,
      borderBottomStyle: s.borderBottomStyle,
      fontWeight: s.fontWeight,
    },
  };
}

// --- UTILS ---

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500); // 1.5s buffer for hydration
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
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

  // Prepare CSV Download
  const csv = Papa.unparse(auditResults);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const btn = document.getElementById("downloadBtn");
  btn.style.display = "block";
  btn.onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano_audit_results.csv" });
  };
}

// dev note: Right-click inside the Side Panel and hit Reload Frame to update with changes
