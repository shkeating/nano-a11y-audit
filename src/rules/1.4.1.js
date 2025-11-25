export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. HARDENED PROMPT
export const systemPrompt = `
You are a strict accessibility auditor who writes in plain, easy-to-understand language.
Task: Check if a link OR a form field relies ONLY on color to convey information (WCAG 1.4.1).
Input: A JSON object with 'links' and 'formElements' arrays.

Execution Steps:
1. Initialize two empty lists: 'failing_links' and 'failing_form_fields'.
2. For EACH link in the 'links' array: if 'isUnderlined' is false AND 'isBold' is false AND 'hasBorder' is false, add the link's 'text' to the 'failing_links' list.
3. For EACH form element in the 'formElements' array: if ('isRequired' is true OR 'isInvalid' is true) AND 'hasVisibleLabelAsterisk' is false AND 'hasDescribedByError' is false, add the element's 'label' to the 'failing_form_fields' list.
4. After checking all elements, if both lists are empty, the final verdict is "PASS".
5. If either list is not empty, the final verdict is "FAIL".

Reasoning for FAIL verdict:
- If the 'failing_form_fields' list is not empty, generate a sentence with this exact format: "The form field(s) '[field label 1]' and '[field label 2]' use(s) only color to indicate they are required or invalid. Add an asterisk to the label or a visible error message that does not rely on color." (Use the labels from the list, quoted and joined naturally).
- If the 'failing_links' list is not empty, generate a sentence with this exact format: "The link(s) '[link text 1]' and '[link text 2]' rely only on color. Add an underline or make them bold." (Use the texts from the list, quoted and joined naturally).
- If both lists are not empty, provide both sentences, separated by a newline.

Final JSON Output:
- Return ONLY the raw JSON object in the format {"verdict": "PASS"|"FAIL", "reason": "Your explanation(s) here."}
`;

// 2. EXTRACTOR
export function extractor() {
  const links = Array.from(document.querySelectorAll("a"));
  const formElements = Array.from(
    document.querySelectorAll("input, textarea, select")
  );

  return {
    pageTitle: document.title,
    links: links.map((a) => {
      const s = window.getComputedStyle(a);
      return {
        text: a.innerText.substring(0, 20), // Truncate
        color: s.color,
        isUnderlined: s.textDecorationLine.includes("underline"),
        isBold:
          s.fontWeight === "700" ||
          s.fontWeight === "bold" ||
          parseInt(s.fontWeight) >= 700,
        hasBorder: s.borderBottomStyle !== "none",
      };
    }),
    formElements: formElements.map((el) => {
      const s = window.getComputedStyle(el);
      const label = el.labels?.[0];
      const describedById = el.getAttribute("aria-describedby");
      let describedByText = "";
      if (describedById) {
        const describedByEl = document.getElementById(describedById);
        if (describedByEl) {
          describedByText = describedByEl.innerText;
        }
      }

      return {
        tagName: el.tagName.toLowerCase(),
        label: label?.innerText.substring(0, 30),
        color: s.color,
        borderColor: s.borderColor,
        isRequired: el.required,
        isInvalid: el.getAttribute("aria-invalid") === "true",
        hasVisibleLabelAsterisk: label?.innerText.includes("*") ?? false,
        hasDescribedByError: describedByText.trim().length > 0,
      };
    }),
  };
}
