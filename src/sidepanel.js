// 1. THE SAFE ID LIST (Exact IDs extracted from your working manual file)
const ALL_VALID_IDS = [
  "WCAG22:non-text-content",
  "WCAG22:audio-only-and-video-only-prerecorded",
  "WCAG22:captions-prerecorded",
  "WCAG22:audio-description-or-media-alternative-prerecorded",
  "WCAG22:captions-live",
  "WCAG22:audio-description-prerecorded",
  "WCAG22:info-and-relationships",
  "WCAG22:meaningful-sequence",
  "WCAG22:sensory-characteristics",
  "WCAG22:orientation",
  "WCAG22:identify-input-purpose",
  "WCAG22:use-of-color",
  "WCAG22:audio-control",
  "WCAG22:contrast-minimum",
  "WCAG22:resize-text",
  "WCAG22:images-of-text",
  "WCAG22:contrast-enhanced",
  "WCAG22:low-or-no-background-audio",
  "WCAG22:visual-presentation",
  "WCAG22:images-of-text-no-exception",
  "WCAG22:reflow",
  "WCAG22:non-text-contrast",
  "WCAG22:text-spacing",
  "WCAG22:content-on-hover-or-focus",
  "WCAG22:keyboard",
  "WCAG22:no-keyboard-trap",
  "WCAG22:keyboard-no-exception",
  "WCAG22:character-key-shortcuts",
  "WCAG22:timing-adjustable",
  "WCAG22:pause-stop-hide",
  "WCAG22:no-timing",
  "WCAG22:interruptions",
  "WCAG22:re-authenticating",
  "WCAG22:timeouts",
  "WCAG22:three-flashes-or-below-threshold",
  "WCAG22:three-flashes",
  "WCAG22:bypass-blocks",
  "WCAG22:page-titled",
  "WCAG22:focus-order",
  "WCAG22:link-purpose-in-context",
  "WCAG22:multiple-ways",
  "WCAG22:headings-and-labels",
  "WCAG22:focus-visible",
  "WCAG22:focus-not-obscured-minimum",
  "WCAG22:focus-not-obscured-enhanced",
  "WCAG22:focus-appearance",
  "WCAG22:pointer-gestures",
  "WCAG22:pointer-cancellation",
  "WCAG22:label-in-name",
  "WCAG22:motion-actuation",
  "WCAG22:target-size", // Note: 2.5.5 (Enhanced)
  "WCAG22:dragging-movements",
  "WCAG22:target-size-minimum", // Note: 2.5.8 (Minimum)
  "WCAG22:language-of-page",
  "WCAG22:language-of-parts",
  "WCAG22:unusual-words",
  "WCAG22:abbreviations",
  "WCAG22:reading-level",
  "WCAG22:pronunciation",
  "WCAG22:on-focus",
  "WCAG22:on-input",
  "WCAG22:consistent-navigation",
  "WCAG22:consistent-identification",
  "WCAG22:change-on-request",
  "WCAG22:consistent-help",
  "WCAG22:error-identification",
  "WCAG22:labels-or-instructions",
  "WCAG22:error-suggestion",
  "WCAG22:error-prevention-legal-financial-data",
  "WCAG22:help",
  "WCAG22:error-prevention-all",
  "WCAG22:redundant-entry",
  "WCAG22:accessible-authentication-minimum",
  "WCAG22:accessible-authentication-enhanced",
  "WCAG21:parsing", // <--- SPECIAL EXCEPTION (4.1.1)
  "WCAG22:name-role-value",
  "WCAG21:status-messages", // <--- SPECIAL EXCEPTION (4.1.3)
];

// 2. CRITERIA MAPPING (Maps your simple IDs to the Safe List)
const CRITERIA_MAP = {
  "1.3.2": "WCAG22:meaningful-sequence",
  "1.3.3": "WCAG22:sensory-characteristics",
  "1.3.4": "WCAG22:orientation",
  "1.4.1": "WCAG22:use-of-color",
  "1.4.2": "WCAG22:audio-control",
  "1.4.5": "WCAG22:images-of-text",
  "1.4.10": "WCAG22:reflow",
  "1.4.12": "WCAG22:text-spacing",
  "2.2.1": "WCAG22:timing-adjustable",
  "2.2.2": "WCAG22:pause-stop-hide",
  "2.4.5": "WCAG22:multiple-ways",
  "2.5.3": "WCAG22:label-in-name",
  "2.5.8": "WCAG22:target-size-minimum",
  "3.2.2": "WCAG22:on-input",
};

let urlQueue = [];
let auditResults = [];

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
      if (urlQueue.length > 0)
        document.getElementById("startBtn").disabled = false;
      log(`✅ Loaded ${urlQueue.length} URLs.`);
    },
  });
});

document.getElementById("startBtn").addEventListener("click", async () => {
  document.getElementById("startBtn").disabled = true;
  document.getElementById("statusArea").style.display = "block";
  auditResults = [];

  for (let i = 0; i < urlQueue.length; i++) {
    const url = urlQueue[i];
    updateStatus(i + 1, urlQueue.length, url);
    try {
      log(`Navigating: ${url}`);
      const tab = await getActiveTab();
      const loadPromise = waitForTabLoad(tab.id);
      await chrome.tabs.update(tab.id, { url: url });
      await loadPromise;
      log(`Scanning...`);
      const result = await runAuditOnTab(tab.id);
      log(`${result.verdict === "FAIL" ? "❌" : "✅"} ${result.verdict}`);
      auditResults.push({ url, ...result });
    } catch (err) {
      log(`Error: ${err.message}`);
      auditResults.push({ url, verdict: "ERROR", reason: err.message });
    }
  }
  finishAudit();
});

async function runAuditOnTab(tabId) {
  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractDomContext,
    });
    const domContext = injection[0].result;

    if (typeof window.LanguageModel === "undefined")
      return {
        verdict: "ERROR",
        reason: "AI API missing",
        pageTitle: domContext.pageTitle,
      };

    const session = await window.LanguageModel.create({
      expectedContext: "Accessibility Audit",
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        {
          role: "system",
          content: `Audit WCAG 1.4.1 (Use of Color). Links need visual indicators. OUTPUT JSON: {"verdict": "PASS"|"FAIL", "reason": "string"}`,
        },
      ],
    });

    const resultString = await session.prompt(JSON.stringify(domContext));
    const result = JSON.parse(resultString.replace(/```json|```/g, "").trim());
    session.destroy();
    return { ...result, pageTitle: domContext.pageTitle };
  } catch (err) {
    return { verdict: "ERROR", reason: err.message, pageTitle: "Error" };
  }
}

function extractDomContext() {
  const links = Array.from(document.querySelectorAll("a")).slice(0, 5);
  const target = links[0];
  const s = target ? window.getComputedStyle(target) : {};
  return {
    pageTitle: document.title || "Untitled",
    linkStyle: target
      ? { color: s.color, textDecoration: s.textDecorationLine }
      : null,
  };
}

function generateEarlReport(results) {
  const date = new Date().toISOString();
  const websiteId = "_:website";

  // 1. DEFINE PAGES (Step 3)
  const pages = results.map((item, index) => ({
    id: `_:page_${index + 1}`,
    type: ["TestSubject", "Webpage"],
    title: item.pageTitle || item.url,
    description: item.url,
    date: date,
  }));

  // 2. GENERATE ALL ASSERTIONS (Step 4)
  const allAssertions = [];

  // Loop through EVERY valid ID to ensure the matrix is complete
  ALL_VALID_IDS.forEach((fullId) => {
    // A. Create "Untested" Placeholder for Website Scope (Boilerplate)
    allAssertions.push({
      type: "Assertion",
      date: date,
      mode: { type: "TestMode", "@value": "earl:manual" },
      result: {
        type: "TestResult",
        date: date,
        outcome: { id: "earl:untested", type: ["OutcomeValue", "NotTested"] },
      },
      subject: {
        id: websiteId,
        type: ["TestSubject", "Website"],
        title: "Gemini Nano Audit",
      },
      test: { id: fullId, type: ["TestCriterion", "TestRequirement"] },
    });

    // B. If we have a specific result for this ID, add the Page-Level Assertion
    results.forEach((item, index) => {
      const auditedId = CRITERIA_MAP["1.4.1"]; // Currently hardcoded to 1.4.1

      if (fullId === auditedId) {
        const outcomeObj =
          item.verdict === "FAIL"
            ? {
                id: "earl:failed",
                type: ["OutcomeValue", "Fail"],
                title: "Failed",
              }
            : {
                id: "earl:passed",
                type: ["OutcomeValue", "Pass"],
                title: "Passed",
              };

        allAssertions.push({
          type: "Assertion",
          date: date,
          mode: { type: "TestMode", "@value": "earl:manual" },
          result: {
            type: "TestResult",
            date: date,
            description: item.reason,
            outcome: outcomeObj,
          },
          subject: { id: `_:page_${index + 1}` }, // Links to Page
          test: { id: fullId, type: ["TestCriterion", "TestRequirement"] },
        });
      }
    });
  });

  // 3. RETURN REPORT
  return {
    "@context": {
      reporter: "http://github.com/w3c/wcag-em-report-tool/",
      wcagem: "http://www.w3.org/TR/WCAG-EM/#",
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
      wcagVersion: "2.2",
    },
    exploreTarget: {
      id: "_:exploreTarget",
      essentialFunctionality: "",
      pageTypeVariety: "",
      technologiesReliedUpon: [],
    },
    selectSample: {
      id: "_:selectSample",
      structuredSample: pages,
      randomSample: [],
    },
    auditSample: allAssertions,
  };
}

// --- UTILS ---
function waitForTabLoad(tabId) {
  return new Promise((r) => setTimeout(r, 1000));
}
async function getActiveTab() {
  const t = await chrome.tabs.query({ active: true, currentWindow: true });
  return t[0];
}
function updateStatus(c, t, u) {
  document.getElementById("progress").innerText = `${c}/${t}`;
}
function log(m) {
  document.getElementById("log").value += `> ${m}\n`;
}
function finishAudit() {
  const report = generateEarlReport(auditResults);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  );
  const btn = document.getElementById("downloadBtn");
  btn.style.display = "block";
  btn.onclick = () =>
    chrome.downloads.download({ url, filename: "nano-audit-final.json" });
}
