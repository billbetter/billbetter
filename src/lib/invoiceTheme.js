// Per-business colour theming for the React-PDF invoice templates.
//
// The three templates (InvoiceDocument, InvoiceDocumentSimple,
// InvoiceDocumentComplex) hardcoded their palette as module constants. They now
// take an optional `theme` and build their StyleSheet from it, so a business can
// brand its PDFs without any layout, spacing or font changing.
//
// Colours are stored as flat text columns on public."BusinessSettings" -- that
// table is all flat scalars, so a jsonb blob would have been the odd one out.
// `pdf_color_scheme` already existed (and already had a picker in
// PdfTemplateSettings.jsx); the other three are new. See
// supabase/migrations/20260822120000_pdf_theme_columns.sql.

/**
 * @typedef {Object} InvoiceTheme
 * @property {string} primaryColor     Header/section bars and the totals box.
 * @property {string} backgroundColor  Page background.
 * @property {string} textColor        Body text.
 * @property {string} mutedTextColor   Labels and secondary text.
 * @property {string} lineColor        Rules and table borders. Derived, not stored.
 * @property {string} onPrimaryColor   Text drawn ON primaryColor. Always computed,
 *                                     never stored -- see contrastTextOn().
 * @property {string} accentColor      primaryColor where it is visible against the
 *                                     page, else textColor. Derived, not stored.
 * @property {string} subtleFill       Faint tint for table-head bands. Derived.
 * @property {string|undefined} pageFill  What to actually paint the page with:
 *                                     undefined on a white page. Derived.
 */

/**
 * Today's look, exactly: black bars, white page, near-black text, grey labels.
 * A business that has never customised anything renders identically to before.
 */
export const DEFAULT_INVOICE_THEME = Object.freeze({
  primaryColor: "#000000",
  backgroundColor: "#ffffff",
  textColor: "#000000",
  mutedTextColor: "#595959",
  lineColor: "#BFBFBF",
});

/**
 * The value `pdf_color_scheme` shipped with as its column default. It is the
 * retired emerald from this app's previous brand -- the rest of the app moved to
 * #0369A1 -- and it was
 * never rendered, because nothing outside the settings form read the column.
 * Rows still holding it are migrated to #000000 rather than trusted, so this
 * feature does not silently restyle every existing business's invoices. Kept
 * here as a guard for rows written before that migration runs.
 */
export const LEGACY_UNSET_PRIMARY = "#10b981";

const HEX_SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_FULL = /^#?([0-9a-f]{6})$/i;

/**
 * Normalise user input to "#rrggbb", or null if it is not a colour.
 *
 * The settings form takes a free-text hex field, so this receives whatever was
 * typed. An unparseable value falls back to the default rather than reaching
 * react-pdf, which renders an invalid colour as transparent -- that would drop
 * black text onto a black bar with no way for the user to tell why.
 */
export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const short = HEX_SHORT.exec(raw);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const full = HEX_FULL.exec(raw);
  return full ? `#${full[1].toLowerCase()}` : null;
}

/** sRGB channel -> linear light, per WCAG 2.1 relative-luminance. */
function channelToLinear(int8) {
  const c = int8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * WCAG relative luminance, 0 (black) to 1 (white).
 * Returns 0 for an unparseable colour, which is the safe end: callers then treat
 * it as dark and put white text on it.
 */
export function relativeLuminance(color) {
  const hex = normalizeHex(color);
  if (!hex) return 0;
  const n = parseInt(hex.slice(1), 16);
  const r = channelToLinear((n >> 16) & 0xff);
  const g = channelToLinear((n >> 8) & 0xff);
  const b = channelToLinear(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick black or white for text sitting ON `background`, whichever is more
 * readable.
 *
 * This is what keeps a pastel brand colour usable. The filled bars (table
 * header, totals box, section titles) hardcoded white text, so a business
 * choosing pale yellow got white-on-pale-yellow and an unreadable total.
 *
 * Compares actual contrast ratios rather than thresholding luminance at 0.5:
 * the crossover for a mid-tone sits nearer 0.18, so a 0.5 threshold puts white
 * text on colours that genuinely need black.
 */
export function contrastTextOn(background) {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000";
}

/**
 * Return `color` if it is distinguishable from `background`, else `fallback`.
 *
 * The templates draw structural rules -- the line under the Simple table head,
 * the border above its total -- in the brand colour. A pastel brand colour on a
 * white page makes those effectively invisible, so the invoice reads as broken
 * rather than as branded. 3:1 is WCAG 2.1's non-text contrast minimum.
 */
export function ensureContrast(color, background, fallback, minRatio = 3) {
  const hex = normalizeHex(color);
  if (!hex) return fallback;
  return contrastRatio(hex, background) >= minRatio ? hex : fallback;
}

/**
 * Build a complete theme from a BusinessSettings row.
 *
 * Every field falls back to the default independently, so a partially-filled or
 * partially-invalid row still yields a renderable theme. Accepts an already-
 * shaped theme object too, so callers (the live settings preview) can pass
 * in-progress form values that are not saved yet.
 *
 * @param {object|null} [settings] row from public."BusinessSettings", or a
 *                                 partial InvoiceTheme
 * @returns {InvoiceTheme}
 */
export function resolveInvoiceTheme(settings) {
  const s = settings || {};
  // Accept both the DB column names and the camelCase theme shape.
  const pick = (camel, column) => normalizeHex(s[camel] ?? s[column]);

  const backgroundColor =
    pick("backgroundColor", "pdf_background_color") ??
    DEFAULT_INVOICE_THEME.backgroundColor;

  // Each unset field derives from the background rather than falling back to a
  // fixed light-page constant. On the default white page every derivation
  // reproduces the old hardcoded value exactly (#000000 text, #595959 labels),
  // so an unthemed business is byte-identical to before -- but a business that
  // sets only a dark background still gets readable text instead of black on
  // near-black, which a fixed fallback would have produced.
  const textColor =
    pick("textColor", "pdf_text_color") ?? contrastTextOn(backgroundColor);

  // 0.35 of the way from text to page: black over white lands on #595959.
  const mutedTextColor =
    pick("mutedTextColor", "pdf_muted_text_color") ??
    mixHex(textColor, backgroundColor, 0.35);

  // A row still carrying the never-rendered column default is treated as
  // "never customised", not as a deliberate choice of emerald.
  const storedPrimary = pick("primaryColor", "pdf_color_scheme");
  const primaryColor =
    storedPrimary && storedPrimary !== LEGACY_UNSET_PRIMARY ? storedPrimary : textColor;

  return {
    primaryColor,
    backgroundColor,
    textColor,
    mutedTextColor,
    // Rules are the label colour washed toward the page. 0.615 is not arbitrary:
    // it is the ratio that turns the default #595959 labels on a white page into
    // #BFBFBF, the exact hairline colour the templates hardcoded before theming,
    // so an unthemed invoice keeps the rules it has always had. Deriving rather
    // than fixing that value is what keeps hairlines visible on a dark page,
    // where a literal #BFBFBF would sit brighter than the body text.
    lineColor: mixHex(mutedTextColor, backgroundColor, 0.615),
    onPrimaryColor: contrastTextOn(primaryColor),
    accentColor: ensureContrast(primaryColor, backgroundColor, textColor),
    // A 6% wash of the text colour over the page. On the default white page this
    // lands next to the #F4F4F4 the Complex draft hardcoded; on a dark page it
    // lightens instead of turning into an invisible near-white band.
    subtleFill: mixHex(backgroundColor, textColor, 0.06),
    // react-pdf leaves the page unpainted, which already prints white, so an
    // explicit white fill would add a redundant paint op to every unthemed
    // invoice. Undefined here keeps those byte-identical to the pre-theming
    // output; a business that picks a real page colour still gets it painted.
    pageFill: backgroundColor === "#ffffff" ? undefined : backgroundColor,
  };
}

/**
 * Blend `from` toward `to` by `amount` (0..1). Used only to derive the rule
 * colour, so it works in plain sRGB rather than a perceptual space.
 */
export function mixHex(from, to, amount) {
  const a = normalizeHex(from);
  const b = normalizeHex(to);
  if (!a || !b) return a || b || DEFAULT_INVOICE_THEME.lineColor;

  const t = Math.min(1, Math.max(0, amount));
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const ca = (na >> shift) & 0xff;
    const cb = (nb >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  const hex = ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0");
  return `#${hex}`;
}

export default resolveInvoiceTheme;
