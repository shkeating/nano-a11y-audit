export const id = "1.4.1";
export const earlId = "WCAG22:use-of-color";

// 1. HARDENED PROMPT
// Added "Return ONLY JSON" and "Do not include markdown"
export const systemPrompt = `
You are a strict accessibility auditor who writes in plain, easy-to-understand language.
Task: Check if ANY link in the provided array relies ONLY on color (WCAG 1.4.1).
Input: A JSON object with a 'links' property containing an array of link style objects.

Rules:
1. Iterate through EACH link object in the 'links' array.
2. A link FAILS if it does not have a visual indicator other than color.
3. A link fails if 'isUnderlined' is false, 'isBold' is false, AND 'hasBorder' is false.
4. If ANY link in the array fails, the entire test is a FAIL.
5. If ALL links in the array pass, the entire test is a PASS.

OUTPUT INSTRUCTIONS:
- Return ONLY the raw JSON object. Do not use Markdown or conversational text.
- For a FAIL verdict, the 'reason' MUST clearly explain the problem in simple terms.
- Example Fail Reason: "The link 'Some Text' might be hard for some users to see because it is only distinguished by color. Try adding an underline or making it bold."
- Format: {"verdict": "PASS"|"FAIL", "reason": "Your simple explanation here."}
`;

// 2. EXTRACTOR
export function extractor() {
  // We grab up to 5 links to give a good sample
  const links = Array.from(document.querySelectorAll("a")).slice(0, 5);

  return {
    pageTitle: document.title,
    // simplify the data structure to keep tokens low and prevent confusion
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
  };
}
