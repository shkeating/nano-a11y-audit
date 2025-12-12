export const id = "3.1.2";
export const earlId = "WCAG22:language-of-parts";
// We focus on text-heavy elements where language switches typically happen
export const relevantElements = ["p", "blockquote", "li", "div", "span", "q"];

// We set this to null because we use a computed verdict.
export const systemPrompt = null;

export async function extractor() {
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  // Helper to find the effective lang of an element
  function getInheritedLang(el) {
    let current = el;
    while (current) {
      if (current.getAttribute && current.getAttribute("lang")) {
        return current.getAttribute("lang").split("-")[0].toLowerCase();
      }
      current = current.parentElement;
    }
    // Fallback to page default or 'und' (undefined)
    return document.documentElement.lang.split("-")[0].toLowerCase() || "und";
  }

  const failures = [];
  const candidates = document.querySelectorAll("p, blockquote, li, q"); // Focused list for performance

  // We limit the number of checks to prevent freezing on huge pages
  let checksRun = 0;
  const MAX_CHECKS = 20;

  try {
    const detectorClass = self.LanguageDetector || self.ai?.languageDetector;

    if (!detectorClass) {
      return {
        computedVerdict: "INAPPLICABLE",
        reason: "Browser does not support the Language Detection API.",
      };
    }

    // FIX: Removed the .capabilities() check.
    // We trust .create() to work or throw an error if unavailable.
    const detector = await detectorClass.create();

    for (const el of candidates) {
      if (checksRun >= MAX_CHECKS) break;
      if (!isVisible(el)) continue;

      const text = el.innerText.trim();

      // SKIP short text: Models are unreliable with < 5 words
      if (text.length < 50) continue;

      checksRun++;

      const results = await detector.detect(text);
      if (!results || results.length === 0) continue;

      const topResult = results[0];
      const detectedLang = topResult.detectedLanguage
        .split("-")[0]
        .toLowerCase();
      const declaredLang = getInheritedLang(el);

      // CRITERIA:
      // 1. High Confidence (> 0.85)
      // 2. Detected != Declared
      // 3. Detected is not 'und' (undefined)
      if (
        topResult.confidence > 0.85 &&
        detectedLang !== "und" &&
        detectedLang !== declaredLang
      ) {
        // Snippet for report
        const snippet = text.substring(0, 40) + (text.length > 40 ? "..." : "");

        failures.push({
          element: `<${el.tagName.toLowerCase()}>`,
          snippet: `"${snippet}"`,
          issue: `Detected ${topResult.detectedLanguage.toUpperCase()} but section is declared as ${
            declaredLang.toUpperCase() || "unknown"
          }.`,
        });
      }
    }

    if (failures.length > 0) {
      return {
        computedVerdict: "FAIL",
        reason: `Content found in a language different from its declared language:\n${failures
          .map((f) => `- ${f.snippet}: ${f.issue}`)
          .join("\n")}`,
      };
    }

    return {
      computedVerdict: "PASS",
      reason: `Analyzed ${checksRun} sections. No language mismatches detected.`,
    };
  } catch (error) {
    return {
      computedVerdict: "ERROR",
      reason: `Language API Error: ${error.message}`,
    };
  }
}
