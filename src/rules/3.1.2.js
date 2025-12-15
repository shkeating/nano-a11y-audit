export const id = "3.1.2";
export const earlId = "WCAG22:language-of-parts";
export const relevantElements = ["p", "blockquote", "li", "div", "span", "q"];

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

  function getInheritedLang(el) {
    let current = el;
    while (current) {
      if (current.getAttribute && current.getAttribute("lang")) {
        return current.getAttribute("lang").split("-")[0].toLowerCase();
      }
      current = current.parentElement;
    }
    return document.documentElement.lang.split("-")[0].toLowerCase() || "und";
  }

  const failures = [];
  const debugLog = []; // NEW: Store logs for every check

  // Scrape all candidates
  const candidates = Array.from(
    document.querySelectorAll("p, blockquote, li, q, span")
  );

  let checksRun = 0;
  const MAX_CHECKS = 50; // Increased limit for debug

  try {
    const detectorClass = self.LanguageDetector || self.ai?.languageDetector;
    if (!detectorClass) {
      return {
        computedVerdict: "INAPPLICABLE",
        reason: "Browser does not support the Language Detection API.",
      };
    }

    const detector = await detectorClass.create();

    for (const el of candidates) {
      if (checksRun >= MAX_CHECKS) break;
      if (!isVisible(el)) continue;

      const text = el.innerText.trim();

      // --- CRITICAL CHANGE: LOWER LIMIT TO 5 CHARS ---
      if (text.length < 5) continue;

      // Avoid re-scanning parent elements that contain the same text
      // (Simple check: if element has children, maybe skip if text is huge?
      // For now, we scan everything to be safe).

      checksRun++;

      const results = await detector.detect(text);
      if (!results || results.length === 0) continue;

      const topResult = results[0];
      const detectedLang = topResult.detectedLanguage
        .split("-")[0]
        .toLowerCase();
      const declaredLang = getInheritedLang(el);

      // --- DYNAMIC CONFIDENCE THRESHOLD ---
      // Short text is harder to guess, so we accept lower confidence.
      // < 50 chars: 0.3 confidence (Very lenient)
      // > 50 chars: 0.85 confidence (Strict)
      const confidenceThreshold = text.length < 50 ? 0.3 : 0.85;

      const isMismatch =
        topResult.confidence > confidenceThreshold &&
        detectedLang !== "und" &&
        detectedLang !== declaredLang;

      const snippet = text.substring(0, 30).replace(/\n/g, " ");

      // LOG ENTRY (For Debugging)
      debugLog.push(
        `[${
          isMismatch ? "FAIL" : "PASS"
        }] "${snippet}" | Declared: ${declaredLang} | Detected: ${detectedLang} (${topResult.confidence.toFixed(
          2
        )})`
      );

      if (isMismatch) {
        failures.push({
          element: `<${el.tagName.toLowerCase()}>`,
          snippet: `"${snippet}..."`,
          issue: `Detected ${detectedLang.toUpperCase()} (${topResult.confidence.toFixed(
            2
          )}) vs Declared ${declaredLang.toUpperCase()}`,
        });
      }
    }

    // --- REPORT GENERATION ---
    // If failures exist, report them.
    if (failures.length > 0) {
      return {
        computedVerdict: "FAIL",
        reason: `Language mismatches detected:\n${failures
          .map((f) => `- ${f.snippet}: ${f.issue}`)
          .join("\n")}\n\n--- DEBUG LOG ---\n${debugLog.join("\n")}`,
      };
    }

    // Even on PASS, we return the log so you can see what happened!
    return {
      computedVerdict: "PASS",
      reason: `Analyzed ${checksRun} sections. No mismatches found.\n\n--- DEBUG LOG ---\n${debugLog.join(
        "\n"
      )}`,
      pageTitle: document.title,
    };
  } catch (error) {
    return {
      computedVerdict: "ERROR",
      reason: `Language API Error: ${error.message}`,
    };
  }
}
