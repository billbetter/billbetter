/**
 * The branding half of a PDF: logo, font, footer, and whose name is on it.
 *
 * -- Why this module exists ------------------------------------------------
 *
 * invoiceTheme.js already owns colour, and does it well. Everything else the
 * branding settings screen offers was a form field wired to nothing:
 *
 *   logo_url           uploaded, stored, shown in the app sidebar and on the
 *                      public pages -- and absent from every PDF. The Detailed
 *                      template drew a bordered box containing the word "LOGO".
 *   font_family        seven options, saved, read by no template.
 *   pdf_footer_text    saved, read by no template.
 *   show_pdf_branding  saved, read by no template.
 *
 * And the Professional template -- the default -- printed "INVOICIUM" at 17pt
 * as the largest thing on the page, with the contractor's own business name
 * beneath it in 9pt grey. A contractor's client received an invoice headed with
 * our name, not theirs.
 *
 * Pure functions plus one guarded fetch, so the rules are testable without a
 * browser and the one thing that can fail at runtime is isolated.
 */

/**
 * The default font id. Also what an unset column resolves to, and it renders
 * as Inter -- exactly what every PDF renders as today -- so turning this
 * feature on changes nothing for a business that never picked a font.
 */
export const DEFAULT_PDF_FONT = "helvetica";

/**
 * The three families a PDF can actually use here, and what each renders as.
 *
 * A PDF has fourteen standard fonts, of which three are families: Helvetica,
 * Times and Courier. Anything else has to be embedded as a font file, and this
 * app ships exactly one -- Inter, in public/fonts.
 *
 * The settings screen offered seven names. Georgia, Palatino, Arial and
 * Verdana were never going to render: react-pdf would have fallen back
 * silently, so four of the seven choices did the same thing as each other
 * whether or not anything read the column. Rather than keep a menu that
 * promises typefaces we do not have, the choice is now the three real ones and
 * the retired names alias onto whichever family they most resemble -- so a row
 * saved months ago still resolves, and resolves to something defensible.
 */
const PDF_FONT_FAMILIES = {
  helvetica: "Inter",
  times: "Times-Roman",
  courier: "Courier",
};

/** Retired option -> the real family it most resembles. */
const PDF_FONT_ALIASES = {
  arial: "helvetica",
  verdana: "helvetica",
  georgia: "times",
  palatino: "times",
};

/** What the settings screen offers, in order. */
export const PDF_FONT_OPTIONS = [
  {
    id: "helvetica",
    label: "Inter — modern sans-serif",
    hint: "The default. What your PDFs look like today.",
  },
  { id: "times", label: "Times — classic serif", hint: "Traditional and formal." },
  { id: "courier", label: "Courier — monospace", hint: "Typewriter style." },
];

/**
 * The font a document should render in.
 *
 * @returns {{ id: string, family: string }} `id` is what belongs in the select;
 *   `family` is what goes in a react-pdf style.
 */
export function resolvePdfFont(settings) {
  const raw = String(settings?.font_family || "").trim().toLowerCase();
  const id = PDF_FONT_ALIASES[raw] ?? raw;
  return PDF_FONT_FAMILIES[id]
    ? { id, family: PDF_FONT_FAMILIES[id] }
    : { id: DEFAULT_PDF_FONT, family: PDF_FONT_FAMILIES[DEFAULT_PDF_FONT] };
}

/**
 * The business's own footer line, or null.
 *
 * Null rather than "" so a template can render nothing at all instead of an
 * empty Text that still takes up its line height.
 */
export function resolveFooterText(settings) {
  const text = String(settings?.pdf_footer_text || "").trim();
  return text ? text.slice(0, 300) : null;
}

/**
 * Whether to print "Powered by Invoicium".
 *
 * STRICTLY `=== true`, and that is the whole point. The checkbox rendered as
 * `checked={show_pdf_branding !== false}` -- so every account with a null
 * column looked ticked -- while nothing printed the line. Honouring the
 * checkbox as it read would have put our name on every existing customer's
 * invoices on their next PDF, on documents already going out to their clients,
 * without anyone choosing it.
 *
 * So an unset column is off, and the checkbox now reflects that. Turning it on
 * is a decision somebody makes, once, on purpose.
 */
export function showsPoweredBy(settings) {
  return settings?.show_pdf_branding === true;
}

/**
 * The name that goes at the top of the document.
 *
 * Always the contractor's. The Professional template hardcoded "INVOICIUM" as
 * its 17pt heading and put `business_name` underneath in 9pt grey -- so the
 * default template, the one most invoices use, was branded for us rather than
 * for the person sending it.
 *
 * "Invoicium" survives only as the fallback for a business that has not set a
 * name, because a blank heading looks broken and is worse.
 */
export function brandHeading(settings) {
  return String(settings?.business_name || "").trim() || "Invoicium";
}

// ---- The logo ------------------------------------------------------------

/**
 * Image formats a PDF can embed here.
 *
 * react-pdf supports PNG and JPEG only. An SVG, WebP or GIF makes it throw
 * during render, which fails the WHOLE PDF -- so a contractor who uploaded an
 * SVG logo would find that their invoices stopped generating, with an error
 * that says nothing about the logo. The settings upload now accepts only these
 * two, and this is the second line of defence for logos uploaded before that.
 */
const RENDERABLE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

/** Bigger than this and it is not a logo, it is a photo somebody mis-uploaded. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Keyed by URL. A batch of thirty invoices is thirty renders of the same logo,
// and refetching it thirty times is thirty chances for one to time out.
const logoCache = new Map();

/**
 * Fetch a logo and return it as a data: URL, or null.
 *
 * -- Why this is fetched rather than handed to react-pdf as a URL ----------
 *
 * <Image src="https://..."> makes react-pdf fetch it during render, and a
 * fetch that fails -- CORS, a deleted object, a slow network, a logo replaced
 * by an SVG -- throws inside the renderer and takes the entire PDF with it.
 * The contractor gets no invoice and no explanation.
 *
 * Doing it here means every failure is caught in one place and answers null,
 * which renders an unbranded document. A missing logo is a blemish; a missing
 * invoice is a job not billed.
 *
 * NEVER throws, and never rejects.
 *
 * @param {string|null|undefined} url
 * @param {{ timeoutMs?: number, fetchImpl?: Function }} [opts]
 * @returns {Promise<string|null>}
 */
export async function loadLogoDataUrl(url, opts = {}) {
  const src = typeof url === "string" ? url.trim() : "";
  if (!src) return null;

  // Already inline. Trusted as-is only if it claims a type we can render --
  // a data:image/svg+xml would sail through and then break the render.
  if (src.startsWith("data:")) {
    const declared = /^data:([^;,]+)/.exec(src)?.[1]?.toLowerCase();
    return declared && RENDERABLE_IMAGE_TYPES.has(declared) ? src : null;
  }

  if (!/^https?:\/\//i.test(src)) return null;
  if (logoCache.has(src)) return logoCache.get(src);

  const timeoutMs = opts.timeoutMs ?? 6000;
  const doFetch = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return null;

  const result = await (async () => {
    // A logo that takes ten seconds has already cost more than it is worth.
    // AbortController rather than Promise.race: race leaves the request
    // running, and a batch would pile up thirty of them.
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await doFetch(src, controller ? { signal: controller.signal } : undefined);
      if (!res?.ok) return null;

      const blob = await res.blob();
      const type = String(blob?.type || "").toLowerCase();
      if (!RENDERABLE_IMAGE_TYPES.has(type)) return null;
      if (blob.size > MAX_LOGO_BYTES) return null;

      return await blobToDataUrl(blob);
    } catch {
      // Every failure is the same failure as far as the document is concerned:
      // there is no logo. Deliberately not re-thrown and deliberately not
      // reported to the user mid-render -- the settings screen is where a bad
      // logo should be caught, and it now is.
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();

  // Cached either way, including null: a logo that failed once will fail again
  // for the same reason, and retrying it per invoice makes a batch crawl.
  logoCache.set(src, result);
  return result;
}

/** Drop a URL from the cache, so a re-upload is picked up without a reload. */
export function forgetLogo(url) {
  if (typeof url === "string") logoCache.delete(url.trim());
}

/**
 * Blob -> "data:image/png;base64,...".
 *
 * arrayBuffer() rather than FileReader, which every current browser supports
 * and which also exists off the main thread and in Node -- so the logo path is
 * testable without a DOM. FileReader stays as the fallback for anything old
 * enough to lack it.
 *
 * The base64 is built in chunks: String.fromCharCode applied to a whole
 * megabyte-long byte array at once overflows the argument stack, which is a
 * crash rather than a failed logo.
 */
async function blobToDataUrl(blob) {
  const type = String(blob?.type || "image/png");
  try {
    if (typeof blob?.arrayBuffer === "function") {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return `data:${type};base64,${bytesToBase64(bytes)}`;
    }
  } catch {
    // Falls through to FileReader.
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result) || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Everything branding-related a template needs, in one object.
 *
 * `logo` is passed in rather than fetched here, because this is synchronous
 * and the fetch belongs at the one async boundary the render already has.
 */
export function resolveBrand(settings, { logo = null } = {}) {
  return {
    businessName: brandHeading(settings),
    logo: logo || null,
    fontFamily: resolvePdfFont(settings).family,
    footerText: resolveFooterText(settings),
    showPoweredBy: showsPoweredBy(settings),
  };
}
