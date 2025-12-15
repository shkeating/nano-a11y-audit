export const id = "4.1.2-meaningful-name";
export const earlId = "WCAG22:name-role-value";
export const relevantElements = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role]",
  "div[onclick]",
  "span[onclick]",
  "div[tabindex]",
  "span[tabindex]",
  "div[role='button']",
  "span[role='button']",
];

export const systemPrompt = `
You are an accessibility auditor checking the quality of Accessible Names (WCAG 4.1.2).
Task: Determine if the accessible name is meaningless, generic, or likely a file name.

**CRITERIA**
1. **FAIL:** Name is a filename (e.g., "icon.png", "btn_bg.jpg").
2. **FAIL:** Name is gibberish or purely numeric (e.g., "123", "btn-1", "x", "div34").
3. **FAIL:** Name is a placeholder that describes the *type* not the *action* (e.g., "button", "link", "image", "clickable", "submit").
4. **PASS:** Name describes the action or destination (e.g., "Search", "Menu", "Submit Order", "View Profile").

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Non-descriptive accessible names found:\\n- [Element]: '[Name]' (Reason)"}
- If pass: {"verdict": "PASS", "reason": "Interactive elements have meaningful names."}
`;

export function extractor() {
  // --- DUPLICATED HELPERS START ---
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

  function cleanText(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[\W_]+/g, " ")
      .trim();
  }

  function getAccessibleName(el) {
    // 1. aria-labelledby
    if (el.hasAttribute("aria-labelledby")) {
      const ids = el.getAttribute("aria-labelledby").split(" ");
      const labels = ids
        .map((id) => {
          const labelEl = document.getElementById(id);
          return labelEl && isVisible(labelEl) ? labelEl.innerText : "";
        })
        .filter((s) => s);
      if (labels.length > 0) return labels.join(" ");
    }
    // 2. aria-label
    if (el.hasAttribute("aria-label")) {
      const label = el.getAttribute("aria-label").trim();
      if (label) return label;
    }
    // 3. Native Labeling
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
      if (el.labels && el.labels.length > 0) {
        return Array.from(el.labels)
          .map((l) => l.innerText)
          .join(" ");
      }
      if (el.type === "submit" || el.type === "button") return el.value;
    }
    // 4. Content
    return el.innerText || "";
  }
  // --- DUPLICATED HELPERS END ---

  const candidates = document.querySelectorAll(
    "button, a, [role='button'], [role='link'], input[type='submit'], input[type='button']"
  );
  const suspiciousItems = [];

  // Regex for obvious junk names to save tokens (don't send "Search" to AI)
  const JUNK_REGEX =
    /^$|^button$|^link$|^submit$|^click here$|^untitled$|^\d+$|^\W+$|\.(png|jpg|svg|gif|webp)$/i;

  for (const el of candidates) {
    if (!isVisible(el)) continue;

    // Ignore small touch targets or layout elements
    if (el.offsetWidth < 10 || el.offsetHeight < 10) continue;

    const accName = getAccessibleName(el);
    const cleanName = accName.trim();

    // 1. Empty is an Axe failure (4.1.2), not ours. We check QUALITY.
    if (!cleanName) continue;

    // 2. Filter: If it matches known junk patterns, add to list immediately or for AI verification
    // We send it to AI to get the nice "Reason" string, but we prioritize these candidates.
    if (JUNK_REGEX.test(cleanName) || cleanName.length < 3) {
      suspiciousItems.push({
        element: `<${el.tagName.toLowerCase()}>`,
        name: cleanName,
      });
    }

    if (suspiciousItems.length >= 10) break;
  }

  if (suspiciousItems.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No obviously generic or meaningless names detected.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    suspiciousItems: suspiciousItems,
  };
}
