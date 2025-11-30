// src/utils/axe-runner.js

// Mapping from Axe tags/rules to EARL IDs used in earl-reporter.js (ALL_VALID_IDS)
const AXE_TO_EARL_MAP = {
  // 1. Perception
  "image-alt": "WCAG22:non-text-content",
  "svg-img-alt": "WCAG22:non-text-content",
  "object-alt": "WCAG22:non-text-content",
  "input-image-alt": "WCAG22:non-text-content",
  "area-alt": "WCAG22:non-text-content",
  "video-caption": "WCAG22:captions-prerecorded",
  "audio-caption": "WCAG22:captions-prerecorded",
  "video-description": "WCAG22:audio-description-or-media-alternative-prerecorded",
  "aria-allowed-attr": "WCAG22:info-and-relationships",
  "aria-required-attr": "WCAG22:info-and-relationships",
  "aria-required-children": "WCAG22:info-and-relationships",
  "aria-required-parent": "WCAG22:info-and-relationships",
  "aria-roles": "WCAG22:info-and-relationships",
  "aria-valid-attr-value": "WCAG22:info-and-relationships",
  "aria-valid-attr": "WCAG22:info-and-relationships",
  "dlitem": "WCAG22:info-and-relationships",
  "list": "WCAG22:info-and-relationships",
  "listitem": "WCAG22:info-and-relationships",
  "empty-heading": "WCAG22:info-and-relationships",
  "p-as-heading": "WCAG22:info-and-relationships",
  "label": "WCAG22:info-and-relationships", // Also labels-or-instructions
  "color-contrast": "WCAG22:contrast-minimum",
  "color-contrast-enhanced": "WCAG22:contrast-enhanced",
  "text-spacing": "WCAG22:text-spacing", // Axe rule 'avoid-inline-spacing'
  "avoid-inline-spacing": "WCAG22:text-spacing",

  // 2. Operable
  "keyboard": "WCAG22:keyboard",
  "accesskeys": "WCAG22:character-key-shortcuts", // Not exact but related
  "focus-order-semantics": "WCAG22:focus-order",
  "tabindex": "WCAG22:focus-order",
  "bypass": "WCAG22:bypass-blocks",
  "frame-title": "WCAG22:page-titled", // Frames should have titles
  "document-title": "WCAG22:page-titled",
  "link-name": "WCAG22:link-purpose-in-context",
  "buttons-must-have-content": "WCAG22:name-role-value", // Not exact match in list
  "button-name": "WCAG22:name-role-value",
  "label-title-only": "WCAG22:headings-and-labels", // Form labels
  "focus-visible": "WCAG22:focus-visible", // Axe doesn't test this well automatically
  "target-size": "WCAG22:target-size-minimum",

  // 3. Understandable
  "html-has-lang": "WCAG22:language-of-page",
  "html-lang-valid": "WCAG22:language-of-page",
  "valid-lang": "WCAG22:language-of-parts",
  "on-input": "WCAG22:on-input", // Axe rule?
  "consistent-navigation": "WCAG22:consistent-navigation",
  "consistent-identification": "WCAG22:consistent-identification",
  "label-content-name-mismatch": "WCAG22:label-in-name",

  // 4. Robust
  "duplicate-id": "WCAG21:parsing", // 4.1.1 is obsolete in WCAG 2.2 but kept in list
  "duplicate-id-active": "WCAG21:parsing",
  "duplicate-id-aria": "WCAG21:parsing",
  "aria-hidden-focus": "WCAG22:name-role-value",
  "aria-input-field-name": "WCAG22:name-role-value",
  "aria-toggle-field-name": "WCAG22:name-role-value",
};

/**
 * Injects Axe into the tab and runs the audit.
 * @param {number} tabId - The ID of the tab to audit.
 * @returns {Promise<Array>} - Array of mapped results.
 */
export async function runAxeAudit(tabId) {
  try {
    // 1. Inject Axe Core
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["lib/axe.min.js"],
    });

    // 2. Run Axe in the context of the page
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        return new Promise((resolve) => {
          // eslint-disable-next-line no-undef
          axe.run(
            document,
            {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
              },
            },
            (err, results) => {
              if (err) {
                console.error("Axe Error:", err);
                resolve({ error: err.message });
              } else {
                results.pageTitle = document.title;
                resolve(results);
              }
            }
          );
        });
      },
    });

    if (!execution || !execution[0] || !execution[0].result) {
      throw new Error("Axe execution failed to return results.");
    }

    const axeResults = execution[0].result;

    if (axeResults.error) {
      throw new Error(axeResults.error);
    }

    // 3. Process and map results
    const mappedResults = [];
    const violations = axeResults.violations || [];
    const pageTitle = axeResults.pageTitle || axeResults.url || "Unknown Page";

    for (const violation of violations) {
      // Find a mapping
      let earlId = AXE_TO_EARL_MAP[violation.id];

      // If no direct map, try to infer from tags (simplified)
      if (!earlId && violation.tags) {
        if (violation.tags.includes("wcag111")) earlId = "WCAG22:non-text-content";
        // ... add more inferencing if needed, but the map covers common ones
      }

      // If still no mapping, stick to a generic or skip?
      // For now, we only report if we can map it to the EARL report requirements.
      if (earlId) {
        // Build a detailed reason with specific node targets
        const nodeDetails = violation.nodes.map(node => {
            const target = node.target.join(', ');
            const htmlSnippet = node.html ? ` (\`${node.html}\`)` : '';
            return `- Element: ${target}${htmlSnippet}\n  Fix: ${node.failureSummary || 'Check element'}`;
        }).join('\n');

        mappedResults.push({
          verdict: "FAIL",
          reason: `${violation.help} (${violation.nodes.length} occurrences).\n${violation.description}\n${nodeDetails}`,
          earlId: earlId,
          pageTitle: pageTitle,
          source: "Axe",
          ruleId: violation.id
        });
      } else {
          // Optional: Report unmapped violations as "Other" or similar if valuable
          // For now, ignoring to maintain strict EARL format
      }
    }

    // We can also process 'passes' if we want to report PASS verdicts,
    // but typically EARL reports focus on failures or explicit checks.
    // The current sidepanel.js logic reports PASS/FAIL per rule.
    // Axe reports passes, violations, incomplete, inapplicable.
    // If we want to report PASS for rules that passed, we can iterate axeResults.passes

    const passes = axeResults.passes || [];
    for (const pass of passes) {
        let earlId = AXE_TO_EARL_MAP[pass.id];
        if (earlId) {
             mappedResults.push({
                verdict: "PASS",
                reason: pass.help,
                earlId: earlId,
                pageTitle: pageTitle,
                source: "Axe",
                ruleId: pass.id
            });
        }
    }

    return mappedResults;

  } catch (err) {
    console.error("Axe Runner Error:", err);
    return [{
      verdict: "ERROR",
      reason: err.message,
      earlId: "WCAG22:parsing", // Fallback
      pageTitle: "Error"
    }];
  }
}
