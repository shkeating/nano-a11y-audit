// src/utils/axe-runner.js

// Comprehensive mapping from Axe tags/rules to EARL IDs used in earl-reporter.js
const AXE_TO_EARL_MAP = {
  // 1.1.1 Non-text Content
  "image-alt": "WCAG22:non-text-content",
  "input-image-alt": "WCAG22:non-text-content",
  "object-alt": "WCAG22:non-text-content",
  "area-alt": "WCAG22:non-text-content",
  "svg-img-alt": "WCAG22:non-text-content",
  "role-img-alt": "WCAG22:non-text-content",

  // 1.2.1 Audio-only and Video-only (Prerecorded)
  // 1.2.2 Captions (Prerecorded)
  "video-caption": "WCAG22:captions-prerecorded",
  "audio-caption": "WCAG22:captions-prerecorded",

  // 1.2.3 Audio Description or Media Alternative (Prerecorded)
  "video-description":
    "WCAG22:audio-description-or-media-alternative-prerecorded",

  // 1.3.1 Info and Relationships
  "aria-allowed-attr": "WCAG22:info-and-relationships",
  "aria-required-attr": "WCAG22:info-and-relationships",
  "aria-required-children": "WCAG22:info-and-relationships",
  "aria-required-parent": "WCAG22:info-and-relationships",
  "aria-roles": "WCAG22:info-and-relationships",
  "aria-valid-attr-value": "WCAG22:info-and-relationships",
  "aria-valid-attr": "WCAG22:info-and-relationships",
  "definition-list": "WCAG22:info-and-relationships",
  dlitem: "WCAG22:info-and-relationships",
  list: "WCAG22:info-and-relationships",
  listitem: "WCAG22:info-and-relationships",
  "empty-heading": "WCAG22:info-and-relationships",
  "p-as-heading": "WCAG22:info-and-relationships",
  "th-has-data-cells": "WCAG22:info-and-relationships",
  "td-headers-attr": "WCAG22:info-and-relationships",
  "layout-table": "WCAG22:info-and-relationships",

  // 1.3.5 Identify Input Purpose
  "autocomplete-valid": "WCAG22:identify-input-purpose",

  // 1.4.1 Use of Color
  "link-in-text-block": "WCAG22:use-of-color",

  // 1.4.2 Audio Control
  "no-autoplay-audio": "WCAG22:audio-control",

  // 1.4.3 Contrast (Minimum)
  "color-contrast": "WCAG22:contrast-minimum",

  // 1.4.4 Resize text
  "meta-viewport": "WCAG22:resize-text",

  // 1.4.10 Reflow
  "meta-viewport-large": "WCAG22:reflow",

  // 1.4.6 Contrast (Enhanced)
  "color-contrast-enhanced": "WCAG22:contrast-enhanced",

  // 1.4.12 Text Spacing
  "avoid-inline-spacing": "WCAG22:text-spacing",

  // 2.1.1 Keyboard
  keyboard: "WCAG22:keyboard",
  accesskeys: "WCAG22:keyboard",
  "scrollable-region-focusable": "WCAG22:keyboard",

  // 2.2.1 Timing Adjustable
  "meta-refresh": "WCAG22:timing-adjustable",

  // 2.2.2 Pause, Stop, Hide
  blink: "WCAG22:pause-stop-hide",
  marquee: "WCAG22:pause-stop-hide",

  // 2.4.1 Bypass Blocks
  bypass: "WCAG22:bypass-blocks",
  "skip-link": "WCAG22:bypass-blocks",

  // 2.4.2 Page Titled
  "document-title": "WCAG22:page-titled",
  "frame-title": "WCAG22:page-titled",

  // 2.4.3 Focus Order
  tabindex: "WCAG22:focus-order",
  "focus-order-semantics": "WCAG22:focus-order",

  // 2.4.4 Link Purpose (In Context)
  "link-name": "WCAG22:link-purpose-in-context",

  // 2.4.6 Headings and Labels
  "label-title-only": "WCAG22:headings-and-labels",
  "page-has-heading-one": "WCAG22:headings-and-labels",

  // 2.5.3 Label in Name
  "label-content-name-mismatch": "WCAG22:label-in-name",

  // 2.5.8 Target Size (Minimum)
  "target-size": "WCAG22:target-size-minimum",

  // 3.1.1 Language of Page
  "html-has-lang": "WCAG22:language-of-page",
  "html-lang-valid": "WCAG22:language-of-page",
  "html-xml-lang-mismatch": "WCAG22:language-of-page",

  // 3.1.2 Language of Parts
  "valid-lang": "WCAG22:language-of-parts",

  // 3.3.2 Labels or Instructions
  label: "WCAG22:labels-or-instructions",
  "select-name": "WCAG22:labels-or-instructions",

  // 4.1.1 Parsing (Obsolete in 2.2, but IDs must still be unique)
  "duplicate-id": "WCAG21:parsing",
  "duplicate-id-active": "WCAG21:parsing",
  "duplicate-id-aria": "WCAG21:parsing",

  // 4.1.2 Name, Role, Value
  "aria-hidden-focus": "WCAG22:name-role-value",
  "aria-input-field-name": "WCAG22:name-role-value",
  "aria-toggle-field-name": "WCAG22:name-role-value",
  "aria-command-name": "WCAG22:name-role-value",
  "aria-dialog-name": "WCAG22:name-role-value",
  "aria-treeitem-name": "WCAG22:name-role-value",
  "aria-meter-name": "WCAG22:name-role-value",
  "aria-progressbar-name": "WCAG22:name-role-value",
  "button-name": "WCAG22:name-role-value",
  "input-button-name": "WCAG22:name-role-value",
  "frame-tested": "WCAG22:name-role-value",
};

export async function runAxeAudit(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["lib/axe.min.js"],
    });

    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        return new Promise((resolve) => {
          // eslint-disable-next-line no-undef
          axe.run(
            document,
            {
              iframes: true,
              runOnly: {
                type: "tag",
                values: [
                  "wcag2a",
                  "wcag2aa",
                  "wcag21a",
                  "wcag21aa",
                  "wcag22aa",
                  "best-practice",
                ],
              },
            },
            (err, results) => {
              if (err) resolve({ error: err.message });
              else {
                results.pageTitle = document.title;
                resolve(results);
              }
            }
          );
        });
      },
    });

    const axeResults = execution[0].result;
    if (axeResults.error) throw new Error(axeResults.error);

    const mappedResults = [];
    const pageTitle = axeResults.pageTitle || axeResults.url || "Unknown Page";

    // Helper to process results
    const processResult = (items, verdict) => {
      for (const item of items) {
        // Special Handling for Inapplicable Items
        if (verdict === "INAPPLICABLE") {
          // If 1.4.2 (no-autoplay-audio) is inapplicable, it means NO <audio> or <video> elements exist.
          // This implies multiple other Success Criteria are also Not Present (Inapplicable).
          if (item.id === "no-autoplay-audio") {
            const noMediaRules = [
              {
                id: "WCAG22:audio-only-and-video-only-prerecorded",
                reason: "No media elements found (inferred from 1.4.2).",
              },
              {
                id: "WCAG22:audio-description-or-media-alternative-prerecorded",
                reason: "No media elements found (inferred from 1.4.2).",
              },
              {
                id: "WCAG22:captions-live",
                reason: "No media elements found (inferred from 1.4.2).",
              },
              {
                id: "WCAG22:audio-description-prerecorded",
                reason: "No media elements found (inferred from 1.4.2).",
              },
            ];

            noMediaRules.forEach((rule) => {
              mappedResults.push({
                verdict: "INAPPLICABLE",
                reason: rule.reason,
                earlId: rule.id,
                pageTitle: pageTitle,
                source: "Axe-Inferred",
                ruleId: item.id,
                selectors: [],
              });
            });
          }

          // If meta-viewport is missing (Inapplicable), it usually means zooming is NOT disabled -> PASS for 1.4.4
          if (item.id === "meta-viewport") {
            mappedResults.push({
              verdict: "PASS",
              reason:
                "No restrictive viewport meta tag found (Implicit Pass for Resize Text).",
              earlId: "WCAG22:resize-text",
              pageTitle: pageTitle,
              source: "Axe",
              ruleId: item.id,
              selectors: [],
            });
            continue; // Skip standard processing for this item
          }

          // If autocomplete-valid is inapplicable, no invalid attributes found -> PASS for 1.3.5
          if (item.id === "autocomplete-valid") {
            mappedResults.push({
              verdict: "PASS",
              reason:
                "No invalid autocomplete attributes found (Implicit Pass for Identify Input Purpose).",
              earlId: "WCAG22:identify-input-purpose",
              pageTitle: pageTitle,
              source: "Axe",
              ruleId: item.id,
              selectors: [],
            });
            continue; // Skip standard processing
          }
        }

        let earlId = AXE_TO_EARL_MAP[item.id];

        // Fallback mapping inference
        if (!earlId && item.tags) {
          if (item.tags.includes("wcag111")) earlId = "WCAG22:non-text-content";
          else if (item.tags.includes("wcag131"))
            earlId = "WCAG22:info-and-relationships";
          else if (item.tags.includes("wcag412"))
            earlId = "WCAG22:name-role-value";
        }

        if (earlId) {
          const nodeDetails = item.nodes
            .map((node) => {
              const target = node.target.join(", ");
              // Truncate overly long HTML snippets
              const htmlSnippet = node.html
                ? ` (\`${node.html.substring(0, 100).replace(/\n/g, " ")}\`)`
                : "";
              return `- Element: ${target}${htmlSnippet}\n  Fix: ${
                node.failureSummary || "Check element"
              }`;
            })
            .join("\n");

          mappedResults.push({
            verdict: verdict, // "FAIL", "PASS", or "INCOMPLETE"
            reason: `${item.help}\n${item.description}\n${nodeDetails}`,
            earlId: earlId,
            pageTitle: pageTitle,
            source: "Axe",
            ruleId: item.id,
            // SAVE THE SELECTORS for Nano to re-check
            selectors: item.nodes.map((n) => n.target[0]),
          });
        }
      }
    };

    processResult(axeResults.violations, "FAIL");
    processResult(axeResults.passes, "PASS");
    // Capture incomplete items to pass to Nano
    processResult(axeResults.incomplete, "INCOMPLETE");
    // Capture inapplicable items
    processResult(axeResults.inapplicable, "INAPPLICABLE");

    return mappedResults;
  } catch (err) {
    console.error("Axe Runner Error:", err);
    return [
      {
        verdict: "ERROR",
        reason: err.message,
        earlId: "WCAG21:parsing",
        pageTitle: "Error",
      },
    ];
  }
}
