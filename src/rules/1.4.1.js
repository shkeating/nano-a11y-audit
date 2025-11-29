export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. HARDENED PROMPT
export const systemPrompt = `
You are a strict accessibility auditor who writes in plain, easy-to-understand language.
Task: Check for WCAG 1.4.1 violations based on the provided JSON data.
The JSON has three arrays: 'links', 'formElements', 'textFragments'.

Analyze each array based on the rules below.

**Rule 1: Links using only color**
- A link from the 'links' array fails if 'isUnderlined' is false, 'isBold' is false, and 'hasBorder' is false.
- For each failing link, get its 'text'.
- If you find any failing links, generate a sentence with this exact format: "The link(s) '[link text 1]' and '[link text 2]' rely only on color to differentiate themselves from other text to communicate visually link interactivity. Add an underline or make them bold." (Use the collected texts, quoted and joined naturally).

**Rule 2: Form fields using only color**
- A form element from the 'formElements' array fails if ('isRequired' is true or 'isInvalid' is true) AND 'hasVisibleLabelAsterisk' is false AND 'hasDescribedByError' is false.
- For each failing form element, get its 'label'.
- If you find any failing form elements, generate a sentence with this exact format: "The form field(s) '[field label 1]' and '[field label 2]' use only color to indicate they are required or invalid. Add an asterisk to the label or a visible error message that does not rely on color." (Use the collected labels, quoted and joined naturally).

**Rule 3: Text fragments using only color**
- Any fragment in the 'textFragments' array is considered a failure. These have been pre-identified as being distinguished by color alone.
- For each failing fragment, get its 'text'.
- If the 'textFragments' array is not empty, generate a sentence with this exact format: "There are text fragment(s) such as '[fragment text 1]' and '[fragment text 2]' that rely only on color to convey information. Use bold, underline, or other non-color indicators to distinguish them." (Use the collected texts, quoted and joined naturally).

**Final Output**
- If there are no failures from any of the rules, the final verdict is "PASS".
- If there are any failures, the final verdict is "FAIL".
- Combine all generated failure sentences, each on a new line, for the 'reason'.
- Return ONLY the raw JSON object in the format {"verdict": "PASS"|"FAIL", "reason": "Your combined explanation(s) here."}
`;

// 2. EXTRACTOR
export function extractor() {
  // Sample links with unique styles, ignoring links in <nav>, to avoid exceeding token limits
  const allLinks = Array.from(document.querySelectorAll("a"));
  const linksOutsideNav = allLinks.filter(link => !link.closest('nav'));
  const uniqueStyledLinks = new Map();
  const MAX_LINKS_TO_SAMPLE = 50; // Hard cap for safety

  for (const link of linksOutsideNav) {
    if (link.offsetParent === null) continue; // Ignore non-visible links

    const s = window.getComputedStyle(link);
    const isBold = s.fontWeight === "700" || s.fontWeight === "bold" || parseInt(s.fontWeight) >= 700;
    const isUnderlined = s.textDecorationLine.includes("underline");
    const hasBorder = s.borderBottomStyle !== "none";

    const signature = `${s.color}|${s.backgroundColor}|${isBold}|${isUnderlined}|${hasBorder}`;

    if (!uniqueStyledLinks.has(signature)) {
      uniqueStyledLinks.set(signature, {
        text: link.innerText.substring(0, 20),
        color: s.color,
        isUnderlined: isUnderlined,
        isBold: isBold,
        hasBorder: hasBorder,
      });
    }

    if (uniqueStyledLinks.size >= MAX_LINKS_TO_SAMPLE) {
        break;
    }
  }
  const links = Array.from(uniqueStyledLinks.values());

  const formElements = Array.from(
    document.querySelectorAll("input, textarea, select")
  );

  function hasOnlyColorDifference(element, parent) {
    const elementStyle = window.getComputedStyle(element);
    const parentStyle = window.getComputedStyle(parent);

    if (elementStyle.color === parentStyle.color) {
      return false; // No color difference
    }

    // Check for other differences that provide non-color-based distinction
    const fontWeightChanged = elementStyle.fontWeight !== parentStyle.fontWeight;
    const fontStyleChanged = elementStyle.fontStyle !== parentStyle.fontStyle;
    const textDecorationChanged =
      elementStyle.textDecorationLine !== parentStyle.textDecorationLine;
    const borderBottomChanged =
      elementStyle.borderBottomStyle !== parentStyle.borderBottomStyle;
    const backgroundChanged =
      elementStyle.backgroundColor !== parentStyle.backgroundColor;
    const beforeContentChanged =
      window.getComputedStyle(element, "::before").content !== "none";
    const afterContentChanged =
      window.getComputedStyle(element, "::after").content !== "none";

    return !(
      fontWeightChanged ||
      fontStyleChanged ||
      textDecorationChanged ||
      borderBottomChanged ||
      backgroundChanged ||
      beforeContentChanged ||
      afterContentChanged
    );
  }

  const textFragments = [];
  const allElements = document.body.getElementsByTagName("*");

  for (const el of allElements) {
    // Check if it's a leaf element in terms of element nodes.
    if (el.children.length === 0 && el.textContent.trim().length > 0) {
      const parent = el.parentElement;
      if (parent && parent.children.length > 1) {
        if (hasOnlyColorDifference(el, parent)) {
          textFragments.push({
            text: el.innerText.substring(0, 30),
            tagName: el.tagName.toLowerCase(),
          });
        }
      }
    }
  }

  return {
    pageTitle: document.title,
    links,
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
    textFragments,
  };
}
