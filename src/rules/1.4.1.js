export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. SYSTEM PROMPT (Restored to match the working 1.3.2 structure)
export const systemPrompt = `
You are a precise accessibility auditor.
Task: Report WCAG 1.4.1 Use of Color violations.

**INSTRUCTIONS**
Review the input arrays ('links', 'formElements', 'textFragments').
1. **If an array is empty:** Write NOTHING for that section.
2. **If an array has items:**
   - Write a summary sentence (e.g., "Links found relying on color:").
   - Create a Markdown list using dashes (-).
   - **CRITICAL:** Start every list item on a new line using the literal string "\\n".

**REQUIRED FORMAT EXAMPLE**
"We found links relying on color:\\n- [link inner text] \\n- [next link inner text]"

**FINAL OUTPUT**
- If NO items exist in any array: {"verdict": "PASS", "reason": "No use-of-color violations were found."}
- If items exist: {"verdict": "FAIL", "reason": "[Combine your summaries here]"}
`;

// 2. EXTRACTOR (Robust Version)
export function extractor() {
  // --- HELPER: Visual Indicators ---
  function hasVisualIndicator(el, label) {
    const text = label ? label.innerText.toLowerCase() : "";
    if (
      text.includes("*") ||
      text.includes("required") ||
      text.includes("error")
    )
      return true;

    if (label) {
      const styles = [
        window.getComputedStyle(label, "::before"),
        window.getComputedStyle(label, "::after"),
      ];
      if (styles.some((s) => s.content.includes("*"))) return true;
    }

    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && document.getElementById(describedBy)) {
      return document.getElementById(describedBy).innerText.trim().length > 0;
    }
    return false;
  }

  // --- HELPER: Color Difference ---
  function hasOnlyColorDifference(element, parent) {
    const s1 = window.getComputedStyle(element);
    const s2 = window.getComputedStyle(parent);

    // If colors match, it's not a color violation
    if (s1.color === s2.color) return false;

    // Check if distinct by anything OTHER than color
    const isDistinct =
      s1.fontWeight !== s2.fontWeight ||
      s1.fontStyle !== s2.fontStyle ||
      s1.textDecorationLine !== s2.textDecorationLine ||
      s1.borderBottomStyle !== s2.borderBottomStyle ||
      s1.backgroundColor !== s2.backgroundColor;

    return !isDistinct;
  }

  // --- LINK CHECKER ---
  const failingLinks = [];
  const links = Array.from(document.querySelectorAll("a:not(nav a)"));

  for (const link of links) {
    if (link.offsetParent === null) continue;
    const s = window.getComputedStyle(link);

    if (
      s.textDecorationLine.includes("underline") ||
      parseInt(s.fontWeight) >= 700 ||
      s.fontWeight === "bold" ||
      s.borderBottomStyle !== "none"
    )
      continue;

    failingLinks.push({ text: link.innerText.trim().substring(0, 30) });
    if (failingLinks.length >= 5) break;
  }

  // --- FORM CHECKER ---
  const failingForms = [];
  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );

  for (const el of inputs) {
    if (el.offsetParent === null) continue;
    if (["submit", "button", "hidden", "image"].includes(el.type)) continue;

    const label = el.labels?.[0];
    if (hasVisualIndicator(el, label)) continue;

    const isReq =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true";
    const isInv = el.getAttribute("aria-invalid") === "true";
    const isErr =
      el.className.includes("error") || el.className.includes("invalid");

    if (isReq || isInv || isErr) {
      failingForms.push({
        label: label ? label.innerText.substring(0, 30) : "Unlabeled Field",
      });
    }
    if (failingForms.length >= 5) break;
  }

  // --- TEXT FRAGMENT CHECKER ---
  const failingFragments = [];
  const allElements = document.body.getElementsByTagName("*");

  for (const el of allElements) {
    if (el.offsetParent === null) continue;
    if (
      [
        "SCRIPT",
        "STYLE",
        "NOSCRIPT",
        "A",
        "BUTTON",
        "INPUT",
        "SELECT",
        "TEXTAREA",
      ].includes(el.tagName)
    )
      continue;

    // Check strict text nodes (prevents picking up container divs)
    const hasDirectText = Array.from(el.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0
    );

    if (hasDirectText) {
      const parent = el.parentElement;
      if (parent && hasOnlyColorDifference(el, parent)) {
        failingFragments.push({
          text: el.innerText.substring(0, 40),
          tagName: el.tagName.toLowerCase(),
        });
      }
    }
    if (failingFragments.length >= 5) break;
  }

  return {
    pageTitle: document.title,
    links: failingLinks,
    formElements: failingForms,
    textFragments: failingFragments,
  };
}
