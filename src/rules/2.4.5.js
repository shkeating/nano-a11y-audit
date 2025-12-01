export const id = "2.4.5";
export const earlId = "WCAG22:multiple-ways";

export const systemPrompt = `
You are an accessibility auditor specializing in WCAG 2.4.5 Multiple Ways.
Task: Determine if the web page provides at least two distinct ways to locate content within the site.

**CRITERIA**
The page must offer at least **TWO** of the following mechanisms:
1. **Search:** A functioning search bar.
2. **Navigation Menu:** A list of links to other pages (usually in a <nav> or header).
3. **Sitemap:** A link labeled "Sitemap" or "Site Map".
4. **Table of Contents:** A link or section labeled "Table of Contents".

**INSTRUCTIONS**
Review the 'foundMechanisms' list.
- **PASS:** If 2 or more distinct mechanisms are found.
- **FAIL:** If 0 or 1 mechanism is found.

**OUTPUT FORMAT**
Return a JSON object:
- If violations: {"verdict": "FAIL", "reason": "Only [Count] navigation method(s) found ([List]). Two are required."}
- If no violations: {"verdict": "PASS", "reason": "Multiple ways to locate content found: [List methods]."}
`;

export function extractor() {
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

  const foundMechanisms = [];

  // 1. CHECK FOR SEARCH (G161)
  const searchInputs = document.querySelectorAll(
    "input[type='search'], form[role='search']"
  );
  for (const el of searchInputs) {
    if (isVisible(el)) {
      foundMechanisms.push("Search Function");
      break;
    }
  }

  // 2. CHECK FOR NAVIGATION MENU (G125)
  const navs = document.querySelectorAll("nav, [role='navigation']");
  for (const el of navs) {
    if (isVisible(el)) {
      // Heuristic: Must have links
      if (el.querySelectorAll("a").length > 2) {
        foundMechanisms.push("Navigation Menu");
        break;
      }
    }
  }

  // 3. CHECK FOR SITEMAP / T.O.C. (G63 / G64)
  const links = document.querySelectorAll("a");
  for (const el of links) {
    if (!isVisible(el)) continue;
    const text = el.innerText.toLowerCase();
    if (text.includes("sitemap") || text.includes("site map")) {
      foundMechanisms.push("Sitemap Link");
      break;
    }
    if (text.includes("table of contents")) {
      foundMechanisms.push("Table of Contents");
      break;
    }
  }

  const uniqueMethods = [...new Set(foundMechanisms)];
  const count = uniqueMethods.length;

  // Verdict logic
  if (count >= 2) {
    return {
      computedVerdict: "PASS",
      reason: `Found ${count} navigation methods: ${uniqueMethods.join(", ")}.`,
      pageTitle: document.title,
    };
  }

  return {
    pageTitle: document.title,
    foundMechanisms: uniqueMethods,
    count: count,
    computedVerdict: "FAIL",
  };
}
