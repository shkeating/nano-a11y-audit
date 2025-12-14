export const id = "1.4.4";
export const earlId = "WCAG22:resize-text";
export const relevantElements = ["body"]; // Applies to whole page

// Mark this as destructive so we know to clean it up or run it last
export const isDestructive = true;

export const systemPrompt = `
You are an accessibility auditor checking WCAG 1.4.4 (Resize Text).
The image provided shows the web page with the layout zoomed to 200%.

**CRITERIA**
1. **FAIL (Clipping):** Text is cut off vertically or horizontally by its container (e.g., "Submi..." instead of "Submit").
2. **FAIL (Overlap):** Text overlaps other text or images, making it illegible.
3. **FAIL (Spillover):** Text overflows its container boundaries without a scrollbar, bleeding into unrelated content.
4. **PASS:** All text remains legible, even if the layout looks messy. Horizontal scrolling is allowed.

**OUTPUT**
Return a JSON object:
- {"verdict": "FAIL", "reason": "Text in the 'Pricing' card is cut off at the bottom."}
- {"verdict": "PASS", "reason": "Text resized successfully without loss of content."}
`;

export async function extractor() {
  // 1. Helper to determine candidates (We just snapshot the viewport here)
  // For 1.4.4, we usually analyze the whole viewport or specific risk areas.
  // To save tokens, we'll try to identify containers with fixed heights,
  // but for V1, let's just snapshot the top of the viewport where nav/heroes live.

  // We return a specific "viewport" candidate to force a full-screen check
  return {
    pageTitle: document.title,
    images: [
      {
        name: "Viewport at 200% Zoom",
        rect: {
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        },
        trigger: "zoom", // Custom trigger we'll handle below
      },
    ],
  };
}

// SETUP: Force the Zoom
export async function setup() {
  document.body.style.zoom = "200%";
}

// TEARDOWN: Reset
export async function teardown() {
  document.body.style.zoom = "100%";
}
