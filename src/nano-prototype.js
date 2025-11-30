
export async function runPrototypeAudit() {
  console.log("Nano Prototype: Starting Audit...");

  class StructureBuilder {
    /**
     * Strategy: Link Context
     * Captures the link + the sentence it lives in.
     */
    buildLinkObject(anchorElement) {
      // 1. Basic Element Data
      const base = {
        type: "link",
        text: anchorElement.innerText.trim(), // "Click here"
        href: anchorElement.getAttribute("href"),
        ariaLabel: anchorElement.getAttribute("aria-label"),
        title: anchorElement.getAttribute("title"),
      };

      // 2. Get Context (The "Secret Sauce")
      // If the link text is short/vague, we need the parent sentence.
      const parentBlock = anchorElement.closest("p, li, div, section");
      const surroundingText = parentBlock
        ? parentBlock.innerText
        : "No context found";

      // 3. Clean the text (remove newlines, extra spaces to save tokens)
      base.context_sentence = surroundingText.replace(/\s+/g, " ").trim();

      return base;
    }

    /**
     * Strategy: Heading Hierarchy
     * Captures the outline, not the content.
     */
    buildHeadingMap() {
      // Select all headings in DOM order
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const structure = [];

      headings.forEach((h) => {
        structure.push({
          tag: h.tagName, // "H1"
          text: h.innerText.substring(0, 50) + "...", // Truncate text, we only care about level + logical flow
        });
      });

      return {
        type: "heading_hierarchy",
        sequence: structure,
      };
    }

    /**
     * Strategy: Table Analysis
     * Differentiates Layout vs Data tables
     */
    buildTableObject(tableElement) {
      // Check for "th" elements (strong signal of data tables)
      const hasHeaders = tableElement.querySelectorAll("th").length > 0;

      // Sample the first 3 rows to check for content patterns
      const sampleRows = Array.from(tableElement.querySelectorAll("tr"))
        .slice(0, 3)
        .map((tr) => {
          return Array.from(tr.children).map((td) => td.innerText.trim());
        });

      return {
        type: "table",
        has_th: hasHeaders,
        role: tableElement.getAttribute("role"),
        content_sample: sampleRows, // Array of arrays
      };
    }
  }

  async function checkWithNano(structureObject) {
    // 1. Initialize Model (Chrome built-in AI)
    let session;
    try {
      if (window.ai && window.ai.createTextSession) {
         session = await window.ai.createTextSession();
      } else if (window.ai && window.ai.languageModel) {
         session = await window.ai.languageModel.create();
      } else if (window.model) { // Fallback for some canary versions
         session = await window.model.create();
      } else {
        throw new Error("window.ai not available");
      }
    } catch (e) {
      console.error("Nano Initialization Failed:", e);
      return { pass: false, error: "AI Model Not Available" };
    }

    let prompt = "";

    // 2. Dynamic Prompting based on Object Type
    if (structureObject.type === "link") {
      prompt = `
      You are an accessibility auditor.
      Review this link data: ${JSON.stringify(structureObject)}

      Rule: Link text must be descriptive. If the text is generic (like "click here"),
      check the "context_sentence". If the sentence explains where the link goes, it passes.

      Respond in JSON only: { "pass": boolean, "reason": "short explanation" }
    `;
    } else if (structureObject.type === "heading_hierarchy") {
      prompt = `
      Review this sequence of headings: ${JSON.stringify(
        structureObject.sequence
      )}

      Rule: Headings must not skip levels (e.g., H1 to H4 is bad. H1 to H2 is good).
      Identify the first index where a logical skip occurs.

      Respond in JSON only: { "pass": boolean, "flagged_index": number, "reason": "string" }
    `;
    }

    // 3. Execution
    try {
      console.log("Nano Prompting:", prompt);
      const result = await session.prompt(prompt);
      console.log("Nano Result:", result);

      // Attempt to parse JSON from result (handle potential markdown blocks)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(result);
    } catch (error) {
      console.error("Nano Failed:", error);
      return { pass: false, error: "Model Parsing Failed" };
    } finally {
      if (session) {
          session.destroy();
      }
    }
  }

  // Helper to filter obvious "Passes" so we don't spam Nano
  function isGenericText(text) {
    if (!text) return true; // Empty text is suspicious
    const badWords = ["click", "here", "more", "read", "link", "start"];
    return badWords.some((word) => text.toLowerCase().includes(word));
  }

  // Controller
  const builder = new StructureBuilder();
  const report = [];

  // A. Test Links
  const links = document.querySelectorAll("a");
  console.log(`Found ${links.length} links.`);

  // Limit to first 10 for prototype performance
  for (let i = 0; i < Math.min(links.length, 10); i++) {
    const linkObj = builder.buildLinkObject(links[i]);

    // Only send to AI if it looks suspicious (simple heuristic to save battery/compute)
    if (isGenericText(linkObj.text)) {
      console.log("Analyzing suspicious link:", linkObj.text);
      const result = await checkWithNano(linkObj);
      if (!result.pass) {
        report.push({
          type: "link",
          element: links[i].outerHTML,
          issue: result.reason,
          data: linkObj
        });
      }
    }
  }

  // B. Test Heading Hierarchy
  console.log("Analyzing Heading Hierarchy...");
  const headingMap = builder.buildHeadingMap();
  if (headingMap.sequence.length > 0) {
      const hResult = await checkWithNano(headingMap);
      if (!hResult.pass) {
        report.push({
            type: "heading_hierarchy",
            issue: hResult.reason,
            details: hResult
        });
      }
  }

  console.table(report);
  return report;
}
