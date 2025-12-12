// src/rules/3.1.1.js
export const id = "3.1.1";
export const earlId = "WCAG22:language-of-page";
export const relevantElements = ["html", "body"];

// We set this to null because we are calculating the verdict manually below.
export const systemPrompt = null;

export async function extractor() {
  // 1. Get Declared Language
  const htmlEl = document.documentElement;
  const declaredLang =
    htmlEl.getAttribute("lang") || htmlEl.getAttribute("xml:lang");

  if (!declaredLang) {
    return {
      computedVerdict: "FAIL",
      reason: "Missing <html lang> attribute on the document element.",
    };
  }

  // 2. Get Text Sample (First 2000 chars)
  const textSample = document.body.innerText
    .substring(0, 2000)
    .replace(/\s+/g, " ")
    .trim();

  if (textSample.length < 50) {
    return {
      computedVerdict: "PASS",
      reason: "Insufficient text content to verify language programmatically.",
    };
  }

  // 3. Run Chrome Language Detection
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

    const results = await detector.detect(textSample);

    // Check if we got results
    if (!results || results.length === 0) {
      return {
        computedVerdict: "CANNOT_TELL",
        reason: "Language detection returned no results.",
      };
    }

    const topResult = results[0];

    // Normalize (e.g., 'en-US' -> 'en')
    const declaredSimple = declaredLang.split("-")[0].toLowerCase();
    const detectedSimple = topResult.detectedLanguage
      .split("-")[0]
      .toLowerCase();

    console.log(
      `[3.1.1] Declared: ${declaredSimple} | Detected: ${detectedSimple} (${topResult.confidence})`
    );

    // 4. Calculate Verdict
    // We only fail if the model is VERY confident (> 0.8) that the language is wrong.
    if (topResult.confidence > 0.8 && declaredSimple !== detectedSimple) {
      return {
        computedVerdict: "FAIL",
        reason: `Declared lang="${declaredLang}" does not match detected language "${
          topResult.detectedLanguage
        }" (Confidence: ${(topResult.confidence * 100).toFixed(0)}%).`,
      };
    }

    return {
      computedVerdict: "PASS",
      reason: `Declared language "${declaredLang}" matches the detected content language.`,
    };
  } catch (error) {
    console.error("Language Detection Error:", error);
    return {
      computedVerdict: "ERROR",
      reason: `Error running language detection: ${error.message}`,
    };
  }
}
