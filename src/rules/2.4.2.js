export const id = "2.4.2";
export const earlId = "WCAG22:page-titled";
export const relevantElements = ["title"];

export const systemPrompt = `
You are an accessibility auditor checking WCAG 2.4.2 (Page Titled).
Your goal is to determine if the web page's <title> element accurately describes the page content.

**INPUT DATA**
You will receive:
1. "titleTag": The text inside the <title> tag.
2. "contentSnippet": The first ~1000 characters of text from the page body.

**CRITERIA**
1. **FAIL:** If the title is generic or placeholder text (e.g., "Home", "Untitled", "Page 1", "React App", "Index", "Document").
2. **FAIL:** If the title is completely unrelated to the content provided (e.g., Title is "Contact Us" but content is clearly a blog post about cooking).
3. **PASS:** If the title reasonably describes the topic or purpose of the page.

**OUTPUT FORMAT**
Return a JSON object:
- {"verdict": "PASS", "reason": "The title '[title]' accurately describes the page content (about [topic])."}
- {"verdict": "FAIL", "reason": "The title '[title]' is too generic/inaccurate for a page about [topic]."}
`;

export function extractor() {
  const titleEl = document.querySelector("title");
  const title = titleEl ? titleEl.innerText.trim() : "";

  // 1. Basic Check: Missing/Empty Title (We can fail this immediately without AI to save tokens)
  if (!title) {
    return {
      computedVerdict: "FAIL",
      reason: "The page <title> element is missing or empty.",
      pageTitle: "No Title",
    };
  }

  // 2. Extract Context
  // We grab the first 1000 characters of visible text to give the AI a "Summary"
  const bodyText = document.body.innerText
    .replace(/[\n\t]+/g, " ") // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 1000);

  return {
    pageTitle: title, // For the UI
    titleTag: title, // For the AI Prompt
    contentSnippet: bodyText || "[No text content found on page]",
  };
}
