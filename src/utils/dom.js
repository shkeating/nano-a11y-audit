/**
 * Shared DOM Utilities for Nano A11y Rules.
 */

/**
 * Checks if an element is visible to the user.
 * Handles standard CSS visibility and edge cases like fixed position or SVG elements.
 */
export function isVisible(el) {
  if (!el) return false;
  // Standard check (offsetParent is null for display:none)
  if (el.offsetParent !== null) return true;

  // Fallback for Fixed position or SVG children (which have null offsetParent)
  if (el.tagName === "BODY" || el.tagName === "HTML") return true;

  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

/**
 * Normalizes text for comparison (strips punctuation, extra spaces, case).
 * Useful for 2.5.3 (Label in Name).
 */
export function cleanText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .trim();
}

/**
 * Parsing helper for RGB strings "rgb(255, 0, 0)" -> [255, 0, 0]
 */
export function parseRgb(colorStr) {
  if (!colorStr) return null;
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match
    ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
    : null;
}

/**
 * Calculates relative luminance (W3C Algorithm).
 */
export function getLuminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates contrast ratio between two color strings.
 * Returns float (1.0 to 21.0) or null if invalid.
 */
export function getContrastRatio(fgColor, bgColor) {
  const rgb1 = parseRgb(fgColor);
  const rgb2 = parseRgb(bgColor);

  if (!rgb1 || !rgb2) return null;

  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}
