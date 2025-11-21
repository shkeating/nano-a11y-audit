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
                    1. Analyze the JSON input.
                    2. If textDecorationLine is 'none' AND borderBottomStyle is 'none' AND fontWeight is not bold, the verdict is FAIL.
                    3. Otherwise, PASS.
                    
                    OUTPUT FORMAT:
                    Return ONLY valid JSON with these two fields:
                    {
                      "verdict": "PASS" or "FAIL",
                      "reason": "A short sentence explaining why."
                    }`,
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

  // GENERATE WCAG-EM COMPATIBLE JSON
  const earlReport = generateEarlReport(auditResults);
  const blob = new Blob([JSON.stringify(earlReport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const btn = document.getElementById("downloadBtn");
  btn.textContent = "Download WCAG-EM Data (.json)"; // Update label
  btn.style.display = "block";
  btn.onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano-audit-earl.json" });
  };
}

function generateEarlReport(results) {
  const date = new Date().toISOString();

  //  Create the "Structured Sample" (Step 3 Data)
  // We need unique IDs for each page (e.g., _:page_0, _:page_1)
  const structuredSample = results.map((item, index) => ({
    id: `_:page_${index}`,
    type: "Webpage",
    title: item.url,
    description: item.url, // The tool matches on this
  }));

  //  Create the "Audit Sample" (Step 4 Data)
  const auditSample = results.map((item, index) => {
    const testId = CRITERIA_MAP["1.4.1"] || "WCAG21:use-of-color"; // Fallback

    // Match the exact "outcome" object structure
    const outcomeObj =
      item.verdict === "FAIL"
        ? { id: "earl:failed", type: ["OutcomeValue", "Fail"], title: "Failed" }
        : {
            id: "earl:passed",
            type: ["OutcomeValue", "Pass"],
            title: "Passed",
          };

    return {
      type: "Assertion",
      date: date,
      mode: { type: "TestMode", "@value": "earl:automatic" },
      result: {
        type: "TestResult",
        date: date,
        description: item.reason || "AI Audit via Gemini Nano",
        outcome: outcomeObj,
      },
      // LINK THIS RESULT TO THE PAGE DEFINED ABOVE
      subject: { id: `_:page_${index}` },
      test: {
        id: testId,
        type: ["TestCriterion", "TestRequirement"],
      },
    };
  });

  // Return the Complete WCAG-EM Save File
  return {
    "@context": {
      reporter: "http://github.com/w3c/wcag-em-report-tool/",
      wcagem: "http://www.w3.org/TR/WCAG-EM/#",
      Evaluation: "wcagem:procedure",
      defineScope: "wcagem:step1",
      scope: "wcagem:step1a",
      conformanceTarget: "step1b",
      accessibilitySupportBaseline: "wcagem:step1c",
      additionalEvaluationRequirements: "wcagem:step1d",
      exploreTarget: "wcagem:step2",
      essentialFunctionality: "wcagem:step2b",
      pageTypeVariety: "wcagem:step2c",
      technologiesReliedUpon: "wcagem:step2d",
      selectSample: "wcagem:step3",
      structuredSample: "wcagem:step3a",
      randomSample: "wcagem:step3b",
      Website: "wcagem:website",
      Webpage: "wcagem:webpage",
      auditSample: "wcagem:step4",
      reportFindings: "wcagem:step5",
      documentSteps: "wcagem:step5a",
      commissioner: "wcagem:commissioner",
      evaluator: "wcagem:evaluator",
      evaluationSpecifics: "wcagem:step5b",
      WCAG: "http://www.w3.org/TR/WCAG/#",
      WCAG20: "http://www.w3.org/TR/WCAG20/#",
      WCAG21: "http://www.w3.org/TR/WCAG21/#",
      WAI: "http://www.w3.org/WAI/",
      earl: "http://www.w3.org/ns/earl#",
      Assertion: "earl:Assertion",
      TestMode: "earl:TestMode",
      TestCriterion: "earl:TestCriterion",
      TestRequirement: "earl:TestRequirement",
      TestSubject: "earl:TestSubject",
      TestResult: "earl:TestResult",
      OutcomeValue: "earl:OutcomeValue",
      Pass: "earl:Pass",
      Fail: "earl:Fail",
      CannotTell: "earl:CannotTell",
      NotApplicable: "earl:NotApplicable",
      NotTested: "earl:NotTested",
      assertedBy: "earl:assertedBy",
      mode: "earl:mode",
      result: "earl:result",
      subject: "earl:subject",
      test: "earl:test",
      outcome: "earl:outcome",
      dcterms: "http://purl.org/dc/terms/",
      title: "dcterms:title",
      description: "dcterms:description",
      summary: "dcterms:summary",
      date: "dcterms:date",
      id: "@id",
      type: "@type",
      language: "@language",
    },
    type: "Evaluation",
    language: "en",

    // STEP 1: Define Scope (Required boilerplate)
    defineScope: {
      id: "_:defineScope",
      scope: { description: "", title: "Gemini Nano Audit" },
      conformanceTarget: "AA",
      wcagVersion: "2.1",
    },

    // STEP 2: Explore Target (Boilerplate)
    exploreTarget: { id: "_:exploreTarget", technologiesReliedUpon: [] },

    // STEP 3: SELECT SAMPLE (This is what we fixed!)
    selectSample: {
      id: "_:selectSample",
      structuredSample: structuredSample, // <--- Your URLs go here
      randomSample: [],
    },

    // STEP 4: AUDIT SAMPLE (The Results)
    auditSample: auditSample,
  };
}

// Ensure this map is still at the bottom of your file
const CRITERIA_MAP = {
  "1.4.1": "WCAG21:use-of-color",
  // Add others as you build them...
};
