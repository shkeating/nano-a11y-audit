/**
 * Earl Data Report Composer
 * Handles the generation of the W3C EARL (Evaluation and Report Language) JSON-LD reports.
 */

const BASELINE_IDS = [
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
  "WCAG22:target-size",
  "WCAG22:dragging-movements",
  "WCAG22:target-size-minimum",
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
  "WCAG21:parsing",
  "WCAG22:name-role-value",
  "WCAG21:status-messages",
];

export function generateEarlReport(auditResults, options = {}) {
  const { includePassed = true, includeNotPresent = true } = options;
  const date = new Date().toISOString();
  const websiteId = "_:website";

  // 1. DEFINE PAGES
  const uniqueUrls = [...new Set(auditResults.map((r) => r.url))];

  const pages = uniqueUrls.map((url, index) => {
    const foundResult = auditResults.find((r) => r.url === url);
    const title =
      foundResult && foundResult.pageTitle ? foundResult.pageTitle : url;

    return {
      id: `_:page_${index + 1}`,
      type: ["TestSubject", "Webpage"],
      title: title,
      description: url,
      date: date,
    };
  });

  const urlToIdMap = uniqueUrls.reduce((acc, url, index) => {
    acc[url] = `_:page_${index + 1}`;
    return acc;
  }, {});

  // 2. GENERATE ALL ASSERTIONS
  const allAssertions = [];

  // DYNAMIC MERGE: Combine Baseline IDs with any new IDs found in the results
  const resultIds = new Set(auditResults.map((r) => r.earlId));
  const combinedIds = new Set([...BASELINE_IDS, ...resultIds]);

  combinedIds.forEach((fullId) => {
    // Get all results for this specific SC (Criteria)
    const relevantResults = auditResults.filter((r) => r.earlId === fullId);
    let hasResult = false;

    if (relevantResults.length > 0) {
      hasResult = true;

      // --- AGGREGATE WEBSITE ASSERTION ---
      const anyFailures = relevantResults.some((r) => r.verdict === "FAIL");
      // NEW: Check for Cannot Tell
      const anyCannotTell = relevantResults.some(
        (r) => r.verdict === "CANNOT_TELL"
      );
      const onlyInapplicable = relevantResults.every(
        (r) => r.verdict === "INAPPLICABLE"
      );

      let aggregateOutcome;
      let aggregateDescription = "";

      if (anyFailures) {
        aggregateOutcome = {
          id: "earl:failed",
          type: ["OutcomeValue", "Fail"],
          title: "Failed",
        };
        aggregateDescription = "Issues were found in the sample.";
      } else if (anyCannotTell) {
        // NEW: Prioritize Cannot Tell over Pass, but under Fail
        aggregateOutcome = {
          id: "earl:cantTell",
          type: ["OutcomeValue", "CannotTell"],
          title: "Cannot Tell",
        };
        aggregateDescription =
          "Some checks could not be completed automatically.";
      } else if (onlyInapplicable) {
        aggregateOutcome = {
          id: "earl:inapplicable",
          type: ["OutcomeValue", "NotApplicable"],
          title: "Not Present",
        };
        if (includeNotPresent) aggregateDescription = "Not Present";
      } else {
        aggregateOutcome = {
          id: "earl:passed",
          type: ["OutcomeValue", "Pass"],
          title: "Passed",
        };
        if (includePassed) aggregateDescription = "Passed";
      }

      allAssertions.push({
        type: "Assertion",
        date: date,
        mode: { type: "TestMode", "@value": "earl:manual" },
        result: {
          type: "TestResult",
          date: date,
          description: aggregateDescription,
          outcome: aggregateOutcome,
        },
        subject: {
          id: websiteId,
          type: ["TestSubject", "Website"],
          title: "Gemini Nano Audit",
        },
        test: { id: fullId, type: ["TestCriterion", "TestRequirement"] },
      });

      // --- PER-PAGE DETAILED ASSERTIONS ---
      const resultsByUrl = relevantResults.reduce((acc, item) => {
        if (!acc[item.url]) acc[item.url] = [];
        acc[item.url].push(item);
        return acc;
      }, {});

      for (const [url, pageResults] of Object.entries(resultsByUrl)) {
        const isFailure = pageResults.some((r) => r.verdict === "FAIL");
        // NEW: Check per-page Cannot Tell
        const isCannotTell = pageResults.some(
          (r) => r.verdict === "CANNOT_TELL"
        );
        const isInapplicable = pageResults.every(
          (r) => r.verdict === "INAPPLICABLE"
        );

        let outcomeObj;
        let pageDescription = "";

        if (isFailure) {
          outcomeObj = {
            id: "earl:failed",
            type: ["OutcomeValue", "Fail"],
            title: "Failed",
          };
          pageDescription = pageResults
            .filter((r) => r.verdict === "FAIL")
            .map((r) => {
              const prefix = r.source ? `[${r.source}] ` : "";
              const ruleSuffix = r.ruleId ? ` (Rule: ${r.ruleId})` : "";
              return `${prefix}${r.reason}${ruleSuffix}`;
            })
            .join("\n\n");
        } else if (isCannotTell) {
          // NEW: Handle Cannot Tell
          outcomeObj = {
            id: "earl:cantTell",
            type: ["OutcomeValue", "CannotTell"],
            title: "Cannot Tell",
          };
          // Include the "Cannot Tell" reasons (like the multimodal warning)
          pageDescription = pageResults
            .filter((r) => r.verdict === "CANNOT_TELL")
            .map((r) => {
              const prefix = r.source ? `[${r.source}] ` : "";
              return `${prefix}${r.reason}`;
            })
            .join("\n\n");
        } else if (isInapplicable) {
          outcomeObj = {
            id: "earl:inapplicable",
            type: ["OutcomeValue", "NotApplicable"],
            title: "Not Present",
          };
          if (includeNotPresent) pageDescription = "Not Present";
        } else {
          outcomeObj = {
            id: "earl:passed",
            type: ["OutcomeValue", "Pass"],
            title: "Passed",
          };
          if (includePassed) {
            pageDescription = pageResults
              .map((r) => {
                const prefix = r.source ? `[${r.source}] ` : "";
                const ruleSuffix = r.ruleId ? ` (Rule: ${r.ruleId})` : "";
                return `${prefix}${r.reason}${ruleSuffix}`;
              })
              .join("\n\n");
          }
        }

        allAssertions.push({
          type: "Assertion",
          date: date,
          mode: { type: "TestMode", "@value": "earl:manual" },
          result: {
            type: "TestResult",
            date: date,
            description: pageDescription,
            outcome: outcomeObj,
          },
          subject: { id: urlToIdMap[url] },
          test: { id: fullId, type: ["TestCriterion", "TestRequirement"] },
        });
      }
    }

    // --- UNTESTED ASSERTION ---
    if (!hasResult) {
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
    }
  });

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
