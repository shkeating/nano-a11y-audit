export const id = "1.3.1-visual-heading"; // Unique ID
export const earlId = "WCAG22:info-and-relationships"; // Same EARL ID as the main rule
export const relevantElements = ["p", "div", "span"];

export const systemPrompt = `
You are an accessibility auditor.
Task: Identify "Visual Headings" that lack proper semantic markup (<h1>-<h6>).

**INPUT DATA**
You will receive a list of text elements that are styled to look like headings (large font, bold weight).

**ANALYSIS LOGIC**
1. **Pass (Not a Heading):** - If the text is a full sentence or paragraph (long).
   - If the text is a price, a button label, or a status tag.
   - If the text is purely decorative (e.g., a big number "50%").
2. **Fail (Visual Heading):**
   - If the text acts as a title for the content following it.
   - If it is short, bold, and distinct from the body text.

**OUTPUT FORMAT**
Return a JSON object:
{
  "verdict": "PASS" | "FAIL",
  "reason": "..."
}

If FAIL, list the items:
"- Visual Heading found: '[Text]' (Styled as [Size/Weight] but uses [TagName])"
`;

export function extractor() {
  const candidates = [];

  // HEURISTIC: What looks like a heading?
  // 1. Large Text (>= 20px)
  // 2. Bold Text (>= 600 weight) + Medium Size (>= 16px)

  function isVisualHeading(el) {
    // Skip empty or invisible
    if (!el.innerText.trim()) return false;
    const style = window.getComputedStyle(el);

    // Skip if it's already hidden
    if (style.display === "none" || style.visibility === "hidden") return false;

    const size = parseFloat(style.fontSize);
    const weight =
      parseInt(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400);

    // Check 1: Very Large (e.g. Hero text)
    if (size >= 24) return true;

    // Check 2: Bold and larger than default body (usually 16px)
    if (weight >= 600 && size >= 18) return true;

    return false;
  }

  const elements = document.querySelectorAll("p, div, span");

  // Limit processing to prevent freezing on huge pages
  let count = 0;

  for (const el of elements) {
    if (count > 20) break; // Only check first 20 candidates to save tokens

    // Filter out elements that contain other block elements (we want leaf nodes)
    if (el.querySelector("p, div, h1, h2, h3, h4, h5, h6")) continue;

    if (isVisualHeading(el)) {
      // Double check it's not a button or link wrapper
      if (el.closest('a, button, [role="button"]')) continue;

      candidates.push({
        text: el.innerText.substring(0, 100),
        tagName: el.tagName.toLowerCase(),
        style: `${window.getComputedStyle(el).fontSize} ${
          window.getComputedStyle(el).fontWeight
        }`,
      });
      count++;
    }
  }

  if (candidates.length === 0) {
    return {
      computedVerdict: "PASS",
      reason:
        "No elements found that resemble visual headings (large/bold text).",
    };
  }

  return {
    candidates: candidates,
    pageTitle: document.title,
  };
}
