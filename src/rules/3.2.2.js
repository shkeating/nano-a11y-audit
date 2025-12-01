export const id = "3.2.2";
export const earlId = "WCAG22:on-input";

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 3.2.2 On Input.
Task: Identify inputs that automatically trigger a change of context (submission, new window, navigation) without user warning.

**CRITERIA**
1. **Auto-Submission:** Forms should not submit automatically when a user selects an option or leaves a field (F36).
2. **New Windows:** Selecting a radio button or dropdown option should not immediately open a new window (F37).
3. **Context Change:** Focus changes or navigation should not happen solely on input/selection.

**INSTRUCTIONS**
Review the 'riskyInputs' list.
- **PASS:** If the list is empty.
- **FAIL:** If items are listed, they contain suspicious event handlers (like 'submit()' or 'window.open') that likely trigger context changes.
- **Format:** List the findings in a bulleted list: "- [Element]: [Snippet of suspicious code]"

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Inputs causing automatic context change found:\\n- [Item 1]..."}
- If no violations: {"verdict": "PASS", "reason": "No on-input violations found."}
`;

export function extractor() {
  const riskyInputs = [];

  // Keywords that signal a context change
  const SUSPICIOUS_PATTERNS = [
    "submit(",
    "submit()",
    "window.open",
    "location.href",
    "location.assign",
    "location.replace",
    "dispatchEvent(new Event('submit'))",
  ];

  // We only care about user-input fields
  const inputs = Array.from(
    document.querySelectorAll("select, input, textarea")
  );

  for (const el of inputs) {
    if (el.offsetParent === null) continue; // Skip hidden

    // Check inline event handlers (common in F36/F37 failures)
    // We check onchange, oninput, onblur (focus loss)
    const handlers = [
      el.getAttribute("onchange"),
      el.getAttribute("oninput"),
      el.getAttribute("onblur"),
      el.getAttribute("onclick"), // Sometimes used on radios/checkboxes
    ];

    let detectedIssue = null;

    for (const code of handlers) {
      if (!code) continue;
      const lowerCode = code.toLowerCase();

      // Check if the handler contains a forbidden pattern
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (lowerCode.includes(pattern.toLowerCase())) {
          detectedIssue = `Handler code contains: "${pattern}"`;
          break;
        }
      }
      if (detectedIssue) break;
    }

    if (detectedIssue) {
      // Get a friendly name for the element
      let name = el.tagName.toLowerCase();
      if (el.id) name += `#${el.id}`;
      else if (el.name) name += `[name="${el.name}"]`;

      // Get label if possible
      const labelText =
        el.labels && el.labels[0] ? ` ("${el.labels[0].innerText}")` : "";

      riskyInputs.push({
        element: name + labelText,
        details: detectedIssue,
        codeSnippet:
          handlers.find((h) => h && h.length > 0).substring(0, 50) + "...",
      });
    }
  }

  // --- RESULT ---
  if (riskyInputs.length === 0) {
    return {
      computedVerdict: "PASS",
      reason: "No suspicious 'on input' handlers found.",
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    riskyInputs: riskyInputs,
  };
}
