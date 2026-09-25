/**
 * Runtime access to the design tokens defined in src/index.css.
 *
 * Needed because SVG presentation attributes (recharts `stroke`, `fill`, chart
 * colour arrays) are NOT CSS declarations — `var(--brand-700)` does not resolve
 * there. Inline `style={{...}}` objects are real CSS and can use var() directly;
 * prefer that when you have the choice.
 *
 *   token("brand-700")        -> "rgb(3 105 161)"
 *   token("success-500", 0.2) -> "rgb(16 185 129 / 0.2)"
 */

const FALLBACK = "0 0 0";

/**
 * The same, for the shadcn tokens, which hold HSL triplets rather than RGB
 * channels -- the dashboard theme's primary and chart colours:
 *
 *   hslToken("primary")      -> "hsl(0 0% 9%)"
 *   hslToken("chart-2", 0.3) -> "hsl(0 0% 45.1% / 0.3)"
 */
export function hslToken(name, alpha) {
  let triplet = "0 0% 50%";
  if (typeof window !== "undefined" && document?.documentElement) {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(`--${name}`)
      .trim();
    if (raw) triplet = raw;
  }
  return alpha === undefined ? `hsl(${triplet})` : `hsl(${triplet} / ${alpha})`;
}

export function token(name, alpha) {
  let channels = FALLBACK;
  if (typeof window !== "undefined" && document?.documentElement) {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(`--${name}`)
      .trim();
    if (raw) channels = raw;
  }
  return alpha === undefined
    ? `rgb(${channels})`
    : `rgb(${channels} / ${alpha})`;
}
