/**
 * The template's font choices, loaded from Google Fonts on demand.
 *
 * Geist ships in index.css with Inter (one stylesheet request), because it is
 * the default and must not flash. The rest are only fetched when picked, so
 * nobody downloads a dozen families to read an invoice list.
 */
export const FONT_OPTIONS = [
  { key: "geist", label: "Geist", family: "Geist", query: "Geist:wght@300..800" },
  { key: "inter", label: "Inter", family: "Inter", query: null },
  { key: "dmSans", label: "DM Sans", family: "DM Sans", query: "DM+Sans:wght@300..800" },
  { key: "figtree", label: "Figtree", family: "Figtree", query: "Figtree:wght@300..800" },
  { key: "publicSans", label: "Public Sans", family: "Public Sans", query: "Public+Sans:wght@300..800" },
  { key: "outfit", label: "Outfit", family: "Outfit", query: "Outfit:wght@300..800" },
  { key: "nunitoSans", label: "Nunito Sans", family: "Nunito Sans", query: "Nunito+Sans:wght@300..800" },
  { key: "raleway", label: "Raleway", family: "Raleway", query: "Raleway:wght@300..800" },
  { key: "roboto", label: "Roboto", family: "Roboto", query: "Roboto:wght@300;400;500;700" },
  { key: "geistMono", label: "Geist Mono", family: "Geist Mono", query: "Geist+Mono:wght@300..800" },
  { key: "lora", label: "Lora", family: "Lora", query: "Lora:wght@400..700" },
  { key: "playfairDisplay", label: "Playfair Display", family: "Playfair Display", query: "Playfair+Display:wght@400..800" },
];

export const FONT_KEYS = FONT_OPTIONS.map((f) => f.key);

const loaded = new Set(["geist", "inter"]);

/** Fetch a font's stylesheet once, and publish its family for the CSS. */
export function loadFont(key) {
  if (typeof document === "undefined") return;
  const font = FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[0];
  document.documentElement.style.setProperty("--app-font", `"${font.family}"`);
  if (loaded.has(font.key) || !font.query) return;
  loaded.add(font.key);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`;
  document.head.appendChild(link);
}
