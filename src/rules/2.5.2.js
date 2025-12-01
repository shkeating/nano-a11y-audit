export const id = "2.5.2";
export const earlId = "WCAG22:pointer-cancellation";

// Pre-flight check: we only care about elements that actually have these attributes
export const relevantElements = [
  "[onmousedown]",
  "[ontouchstart]",
  "[onpointerdown]",
];

export const systemPrompt = `
You are an accessibility auditor verifying WCAG 2.5.2 Pointer Cancellation.
Your goal is to identify interactive elements that execute a function on the "down" event (e.g., mousedown, touchstart) instead of the "up" event (click, mouseup).

Rules:
1. FAIL if an element has an event handler on a down-event ('onmousedown', 'ontouchstart', 'onpointerdown') that appears to execute a functional action (e.g., submitting a form, deleting data, opening a link, launching a dialog).
2. PASS if the down-event handler appears to ONLY change visual appearance (e.g., adding a CSS class, changing color, updating aria-pressed) to provide active state feedback.
3. PASS if the element is clearly part of a functionality where acting on the down-event is essential (e.g., an on-screen piano key, a drag-and-drop handle, a drawing canvas).
4. PASS if the element also has an 'onmouseup' or 'onclick' handler that suggests the primary action is handled there, AND the down-event logic seems supportive (visual only).

Negative Constraints (Do NOT Flag):
- Do NOT flag standard <button> or <a> elements unless they explicitly override behavior with a suspicious down-event handler.
- Do NOT flag elements where the code is clearly purely presentational (e.g., "this.classList.toggle('active')").

REQUIRED FORMAT EXAMPLE:
[
  {
    "verdict": "FAIL",
    "reason": "Element executes 'submitForm()' on 'onmousedown', which triggers action on the down-event without a chance to cancel."
  },
  {
    "verdict": "PASS",
    "reason": "The 'onmousedown' handler only adds the 'pressed' class, which is a visual state change."
  }
]
`;

export const extractor = () => {
  const elements = document.querySelectorAll(
    "[onmousedown], [ontouchstart], [onpointerdown]"
  );

  return Array.from(elements).map((el) => {
    // Helper to get attribute or null
    const getAttr = (name) => el.getAttribute(name);

    return {
      tagName: el.tagName.toLowerCase(),
      role: getAttr("role"),
      type: getAttr("type"),
      draggable: getAttr("draggable"),
      // Capture the actual code in the handlers
      events: {
        onmousedown: getAttr("onmousedown"),
        ontouchstart: getAttr("ontouchstart"),
        onpointerdown: getAttr("onpointerdown"),
        onclick: getAttr("onclick"),
        onmouseup: getAttr("onmouseup"),
      },
      // Snippet of text to help context (e.g. "Submit", "Cancel")
      visibleText: (el.innerText || el.textContent || "").substring(0, 50).trim(),
      // Snippet of HTML for context
      outerHTML: el.outerHTML.substring(0, 150),
    };
  });
};
