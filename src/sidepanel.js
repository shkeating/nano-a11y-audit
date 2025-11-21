// 5. CRITERIA MAPPING (Matches your Manual File)
const CRITERIA_MAP = {
  "1.3.2": "WCAG21:meaningful-sequence",
  "1.3.3": "WCAG21:sensory-characteristics",
  "1.3.4": "WCAG21:orientation",
  "1.4.1": "WCAG21:use-of-color",
  "1.4.2": "WCAG21:audio-control",
  "1.4.5": "WCAG21:images-of-text",
  "1.4.10": "WCAG21:reflow",
  "1.4.12": "WCAG21:text-spacing",
  "2.2.1": "WCAG21:timing-adjustable",
  "2.2.2": "WCAG21:pause-stop-hide",
  "2.4.5": "WCAG21:multiple-ways",
  "2.5.3": "WCAG21:label-in-name",
  "2.5.8": "WCAG21:target-size",
  "3.2.2": "WCAG21:on-input",
};

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
        log("❌ No valid URLs found. Header must be 'url'.");
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
      const result = await runAuditOnTab(tab.id);

      const statusIcon =
        result.verdict === "FAIL"
          ? "❌"
          : result.verdict === "PASS"
          ? "✅"
          : "⚠️";
      log(`${statusIcon} Verdict: ${result.verdict}`);

      auditResults.push({ url, ...result });
    } catch (err) {
      log(`⚠️ Error: ${err.message}`);
      auditResults.push({
        url,
        verdict: "ERROR",
        reason: err.message,
        pageTitle: "Error Loading Page",
      });
    }
  }

  finishAudit();
});

// 3. THE AI AUDITOR
async function runAuditOnTab(tabId) {
  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractDomContext,
    });

    if (!injection || !injection[0]) throw new Error("Script injection failed");
    const domContext = injection[0].result;

    if (typeof window.LanguageModel === "undefined") {
      return {
        verdict: "ERROR",
        reason: "LanguageModel API missing",
        pageTitle: domContext.pageTitle,
      };
    }

    const session = await window.LanguageModel.create({
      expectedContext: "Accessibility Audit",
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        {
          role: "system",
          content: `You are an accessibility auditor checking WCAG 1.4.1 (Use of Color).
                    RULE: Links must have visual indicators (underline, bold, or border) other than color.
                    INSTRUCTIONS: 
                    - Analyze the JSON input.
                    - If textDecorationLine is 'none' AND borderBottomStyle is 'none' AND fontWeight is 400, verdict is FAIL.
                    - Otherwise verdict is PASS.
                    
                    OUTPUT FORMAT:
                    Return ONLY valid JSON with these two fields:
                    {
                      "verdict": "PASS" or "FAIL",
                      "reason": "A short sentence explaining why."
                    }`,
        },
      ],
    });

    const resultString = await session.prompt(JSON.stringify(domContext));
    const cleanJson = resultString.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJson);

    session.destroy();

    return {
      ...result,
      pageTitle: domContext.pageTitle,
    };
  } catch (err) {
    console.error(err);
    return {
      verdict: "ERROR",
      reason: `AI Error: ${err.message}`,
      pageTitle: "Unknown Title",
    };
  }
}

// 4. THE EXTRACTOR
function extractDomContext() {
  const links = Array.from(document.querySelectorAll("a")).slice(0, 5);
  const target = links[0];
  const pageTitle = document.title || "Untitled Page";

  if (!target) return { pageTitle, note: "No links found" };

  const s = window.getComputedStyle(target);
  return {
    pageTitle,
    tagName: "A",
    text: target.innerText.substring(0, 30),
    computedStyles: {
      color: s.color,
      textDecorationLine: s.textDecorationLine,
      borderBottomStyle: s.borderBottomStyle,
      fontWeight: s.fontWeight,
    },
  };
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
  const blob = new Blob([JSON.stringify(earlReport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const btn = document.getElementById("downloadBtn");
  btn.style.display = "block";
  btn.onclick = () => {
    chrome.downloads.download({ url: url, filename: "nano-audit-wcag.json" });
  };
}

// 6. REPORT GENERATOR (Type-Corrected Version)
function generateEarlReport(results) {
  const date = new Date().toISOString();

  // 1. CREATE SAMPLE LIST (Step 3)
  const pages = results.map((item, index) => ({
    id: `_:page_${index}`,
    // FIX: Use Array with "Webpage" type, exactly like the manual file
    type: ["TestSubject", "Webpage"],
    title: item.pageTitle || item.url,
    description: item.url,
    date: date,
  }));

  // 2. CREATE ASSERTIONS (Step 4)
  const assertions = results.map((item, index) => {
    const testId = CRITERIA_MAP["1.4.1"] || "WCAG21:use-of-color";

    let outcomeObj;
    if (item.verdict === "FAIL") {
      outcomeObj = {
        id: "earl:failed",
        type: ["OutcomeValue", "Fail"],
        title: "Failed",
      };
    } else if (item.verdict === "PASS") {
      outcomeObj = {
        id: "earl:passed",
        type: ["OutcomeValue", "Pass"],
        title: "Passed",
      };
    } else {
      outcomeObj = {
        id: "earl:cantTell",
        type: ["OutcomeValue", "CannotTell"],
        title: "Cannot Tell",
      };
    }

    return {
      type: "Assertion",
      date: date,
      mode: { type: "TestMode", "@value": "earl:manual" },
      result: {
        type: "TestResult",
        date: date,
        description: item.reason || "AI Audit via Gemini Nano",
        outcome: outcomeObj,
      },
      subject: {
        id: `_:page_${index}`, // Link to the specific page ID
        // FIX: Must match the sample definition above EXACTLY
        type: ["TestSubject", "Webpage"],
        title: item.pageTitle || item.url,
        description: item.url,
        date: date,
      },
      test: {
        id: testId,
        type: ["TestCriterion", "TestRequirement"],
        date: date,
      },
    };
  });

  return {
    "@context": {
      reporter: "http://github.com/w3c/wcag-em-report-tool/",
      wcagem: "http://www.w3.org/TR/WCAG-EM/#",
      WAI: "http://www.w3.org/WAI/",
      WCAG21: "http://www.w3.org/TR/WCAG21/#",
      earl: "http://www.w3.org/ns/earl#",
      Evaluation: "wcagem:procedure",
      defineScope: "wcagem:step1",
      scope: "wcagem:step1a",
      step1b: { "@id": "wcagem:step1b", "@type": "@id" },
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
      A: "WAI:WCAG2A-Conformance",
      AA: "WAI:WCAG2AA-Conformance",
      AAA: "WAI:WCAG2AAA-Conformance",
      wcagVersion: "WAI:standards-guidelines/wcag/#versions",
    },
    type: "Evaluation",
    language: "en",
    reportToolVersion: "3.0.3",
    defineScope: {
      id: "_:defineScope",
      scope: { description: "", title: "Gemini Nano Audit" },
      conformanceTarget: "AA",
      wcagVersion: "2.1",
    },
    exploreTarget: {
      id: "_:exploreTarget",
      essentialFunctionality: "",
      pageTypeVariety: "",
      technologiesReliedUpon: [],
    },
    selectSample: {
      id: "_:selectSample",
      structuredSample: pages, // <--- Populated with Webpages
      randomSample: [],
    },
    auditSample: assertions, // <--- Linked Results
  };
}
