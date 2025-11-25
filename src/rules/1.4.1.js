export const id = "1.4.1";

// The optimized Nano Lite prompt
export const systemPrompt = `
Analyze the link style. 
If 'hasUnderline' is false AND 'hasBold' is false AND 'hasIcon' is false, return VERDICT: FAIL. 
Reason: "Link relies solely on color."
`;

// The extractor function.
// CRITICAL: This must be a pure function (no outside dependencies)
// because Chrome serializes this and injects it into the page context.
export function extractor() {
  const links = Array.from(document.querySelectorAll("p a")).slice(0, 5);
  return {
    links: links.map((a) => {
      const s = window.getComputedStyle(a);
      return {
        text: a.innerText,
        color: s.color,
        hasUnderline: s.textDecorationLine.includes("underline"),
        hasBold: s.fontWeight === "700" || s.fontWeight === "bold",
      };
    }),
  };
}
