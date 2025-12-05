export const id = "2.4.6";
export const earlId = "WCAG22:headings-and-labels";
export const relevantElements = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "legend",
];

export const systemPrompt = `
You are a WCAG text classifier.
Task: Classify web text as **PASS** (Descriptive) or **FAIL** (Non-Descriptive).

**CRITERIA**
1. **FAIL (Vague/Placeholder):**
   - "Section 1", "Untitled", "Page 2"
   - "Data", "Input", "Field", "Value", "Text"
   - "..." or symbols only.

2. **PASS (Descriptive):**
   - Any text that gives a specific clue about the content.
   - Example: "Refund Policy Details" -> PASS (Specific subject).
   - Example: "Pricing Plans" -> PASS (Specific subject).

**INSTRUCTIONS**
Review the 'items' list.
- If an item is **PASS**, ignore it.
- If an item is **FAIL**, add it to the report.

**OUTPUT FORMAT**
Return a JSON object:
- If violations exist: {"verdict": "FAIL", "reason": "Meaningless/Placeholder text found:\\n- [Item]"}
- If no violations: {"verdict": "PASS", "reason": "Headings and labels are descriptive."}
`;

// Extractor now accepts 'options' from sidepanel.js
export function extractor(selectors = [], options = {}) {
  // 1. DEFAULT SAFE LIST (Fallback)
  const DEFAULT_SAFE_TERMS = [
    "email",
    "email address",
    "name",
    "first name",
    "last name",
    "password",
    "search",
    "contact",
    "contact us",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "date",
    "submit",
    "login",
    "sign up",
    "menu",
    "about",
    "home",
    "products",
    "services",
    "pricing",
    "refund policy",
    "privacy policy",
    "terms",
  ];

  // 2. MERGE USER SETTINGS
  // If user provided a list, we use that. Otherwise, we use defaults.
  // We sanitize input to ensure it's an array of lowercase strings.
  let activeSafeList = DEFAULT_SAFE_TERMS;

  if (
    options &&
    Array.isArray(options.safeList) &&
    options.safeList.length > 0
  ) {
    activeSafeList = options.safeList.map((s) => s.toLowerCase().trim());
  }

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
    return str.replace(/[:\-\.]/g, "").trim();
  }

  function isSafe(text) {
    const lower = text.toLowerCase();
    // 1. Exact match
    if (activeSafeList.includes(lower)) return true;
    // 2. Contains specific safe phrase
    if (activeSafeList.some((term) => lower.includes(term))) return true;
    // 3. Test content / Meta content (Hardcoded exceptions)
    if (
      lower.includes("sc ") ||
      lower.includes("wcag") ||
      lower.includes("test")
    )
      return true;
    return false;
  }

  function getNextContentSnippet(el) {
    let sibling = el.nextElementSibling;
    let attempts = 0;
    while (sibling && attempts < 3) {
      if (sibling.innerText && sibling.innerText.trim().length > 0) {
        return sibling.innerText.trim().substring(0, 100) + "...";
      }
      sibling = sibling.nextElementSibling;
      attempts++;
    }
    return "No immediate text content found.";
  }

  const items = [];

  // 1. HEADINGS
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const h of headings) {
    if (!isVisible(h)) continue;
    const raw = h.innerText.trim();
    if (raw.length === 0) continue;

    if (isSafe(raw)) continue;

    items.push({
      type: "Heading",
      text: cleanText(raw),
      context: getNextContentSnippet(h),
    });
  }

  // 2. LABELS
  const labels = document.querySelectorAll("label, legend");
  for (const l of labels) {
    if (!isVisible(l)) continue;
    const raw = l.innerText.trim();
    if (raw.length === 0) continue;

    if (isSafe(raw)) continue;

    items.push({
      type: "Label",
      text: cleanText(raw),
    });
  }

  if (items.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No headings or labels found to evaluate.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    items: items.slice(0, 20),
  };
}
