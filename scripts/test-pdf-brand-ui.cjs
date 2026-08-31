/**
 * Render real PDFs in a real browser and read what came out.
 *
 * -- Why this is not a DOM test -------------------------------------------
 *
 * Every claim this change makes is about bytes in a PDF, and none of them are
 * visible to a unit test or to `npm run build`:
 *
 *   the heading says the contractor's name, not "INVOICIUM"
 *   an uploaded logo is actually embedded
 *   a logo that cannot be fetched leaves an invoice, not an exception
 *   an SVG logo does not take the whole render down
 *   the footer message and the Powered-by line print, or do not
 *   a quote renders through the same template, saying QUOTE and "Valid until"
 *
 * So this bundles the app's own render path, runs it in Chrome against the
 * built app (which serves /fonts, without which react-pdf cannot lay anything
 * out), and inspects the resulting PDF.
 *
 * -- How the text is read back --------------------------------------------
 *
 * PDF content streams are Flate-compressed, so the bytes are inflated here and
 * the drawing operators read directly. The documents under test are rendered in
 * Times -- one of the fourteen standard PDF fonts -- because standard-font text
 * is stored as literal strings. With an embedded subset font like Inter the
 * same text is stored as glyph indices, and searching for a business name would
 * find nothing whether the feature worked or not: a test that always passes.
 *
 * Nothing is saved, sent or uploaded. Every render is in memory.
 *
 * Usage: node scripts/test-pdf-brand-ui.cjs <origin> <outDir>
 */
const puppeteer = require("puppeteer-core");
const esbuild = require("esbuild");
const zlib = require("zlib");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [origin, outDir] = process.argv.slice(2);
const ROOT = path.join(__dirname, "..");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

/** A 1x1 PNG, as a data: URL. Small enough to inline, real enough to embed. */
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const HARNESS = `
import { renderInvoicePdfBlob, renderQuotePdfBlob } from "@/lib/invoicePdf";

async function toBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

window.__render = async (kind, doc, settings, options) => {
  try {
    const blob = kind === "quote"
      ? await renderQuotePdfBlob(doc, settings, options || {})
      : await renderInvoicePdfBlob(doc, settings, options || {});
    return { ok: true, base64: await toBase64(blob), size: blob.size };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
};
window.__ready = true;
`;

/**
 * Pull the readable text out of a PDF.
 *
 * Inflates every Flate stream and collects what the text operators draw. Only
 * meaningful for standard-font documents -- see the header.
 */
function pdfText(base64) {
  const buf = Buffer.from(base64, "base64");
  let out = "";

  // Uncompressed operators, if any.
  out += buf.toString("latin1");

  let idx = 0;
  while (true) {
    const start = buf.indexOf("stream", idx);
    if (start === -1) break;
    let s = start + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const end = buf.indexOf("endstream", s);
    if (end === -1) break;
    try {
      out += zlib.inflateSync(buf.subarray(s, end)).toString("latin1");
    } catch {
      // Not a Flate stream (an embedded image, say). Skipped, not fatal.
    }
    idx = end + 9;
  }
  return out;
}

/**
 * The strings a PDF actually draws, joined.
 *
 * react-pdf emits `[<48656c6c6f> 10 <21>] TJ` -- hex strings with kerning
 * numbers between them -- not the `(Hello) Tj` form. An extractor that only
 * looked for `(...) Tj` came back with an empty string for every document,
 * which made "our name is NOT on it" pass for the wrong reason. Both forms are
 * read here, and the caller checks a positive assertion first so an empty
 * extraction fails loudly rather than looking like success.
 *
 * With a standard PDF font the hex is the text's own bytes. With an embedded
 * subset font it is glyph indices and this returns gibberish -- which is why
 * the documents under test are rendered in Times.
 */
function drawnText(base64) {
  const raw = pdfText(base64);
  const parts = [];

  const unhex = (h) => Buffer.from(h.replace(/\s+/g, ""), "hex").toString("latin1");
  const unlit = (s) => s.replace(/\\([()\\])/g, "$1");

  // Array form: everything between [ and ] TJ.
  const arrays = /\[([^\]]*)\]\s*TJ/g;
  let m;
  while ((m = arrays.exec(raw))) {
    const chunks = /<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\)/g;
    let c;
    let text = "";
    while ((c = chunks.exec(m[1]))) {
      text += c[1] !== undefined ? unhex(c[1]) : unlit(c[2]);
    }
    parts.push(text);
  }

  // Single-string form, both spellings.
  const singles = /(?:<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\))\s*Tj/g;
  while ((m = singles.exec(raw))) {
    parts.push(m[1] !== undefined ? unhex(m[1]) : unlit(m[2]));
  }

  return parts.join(" ");
}

const SETTINGS = {
  business_name: "Miller Construction",
  address: "12 Bay Street, Halifax",
  email: "sam@miller.example",
  phone: "902 555 0100",
  tax_rate: 13,
  invoice_template: "professional",
  // Times so the text lands in the PDF as literal strings and can be read back.
  font_family: "times",
};

const INVOICE = {
  id: "inv-1",
  invoice_number: "INV-901",
  client_name: "Dana Reyes",
  client_email: "dana@example.com",
  client_address: "9 Water Street",
  items: [{ description: "Site visit", quantity: 2, rate: 150 }],
  subtotal: 300,
  tax_rate: 13,
  total: 339,
  due_date: "2026-05-30",
  created_at: "2026-05-01T00:00:00.000Z",
  notes: "",
};

const QUOTE = {
  id: "q-1",
  quote_number: "QUO-450",
  client_name: "Dana Reyes",
  client_email: "dana@example.com",
  items: [{ description: "Kitchen refit", quantity: 1, rate: 8200 }],
  subtotal: 8200,
  tax_rate: 13,
  total: 9266,
  date_issued: "2026-05-01",
  expiry_date: "2026-06-01",
  notes: "",
};

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const built = await esbuild.build({
    stdin: { contents: HARNESS, resolveDir: ROOT, loader: "js" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', global: "window" },
    plugins: [{
      name: "vite-alias",
      setup(build) {
        // Extensions are resolved here rather than assumed: this graph pulls in
        // both .js modules and .jsx templates, and vite's own resolver adds the
        // extension for you.
        build.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(ROOT, "src", args.path.slice(2));
          for (const ext of ["", ".js", ".jsx", "/index.js", "/index.jsx"]) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
              return { path: base + ext };
            }
          }
          return { path: base };
        });
      },
    }],
    loader: { ".js": "jsx" },
  });
  const bundlePath = path.join(os.tmpdir(), `pdf-harness-${process.pid}.js`);
  fs.writeFileSync(bundlePath, built.outputFiles[0].text);

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e.message)));

  try {
    // Served from the app's own origin so /fonts/Inter-*.ttf resolve.
    await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: bundlePath });
    await page.waitForFunction("window.__ready === true", { timeout: 20000 });

    const render = (kind, doc, settings, options) =>
      page.evaluate(
        (k, d, s, o) => window.__render(k, d, s, o),
        kind, doc, settings, options || {},
      );

    // ---- The heading ----------------------------------------------------
    console.log("\nwhose name is on the invoice\n");

    const plain = await render("invoice", INVOICE, SETTINGS);
    check("an invoice renders at all", plain.ok, plain.error);
    const plainText = plain.ok ? drawnText(plain.base64) : "";
    fs.writeFileSync(path.join(outDir, "invoice-plain.pdf"), Buffer.from(plain.base64 || "", "base64"));

    check(
      "THE HEADING IS THE CONTRACTOR'S NAME",
      /Miller Construction/.test(plainText),
      plainText.slice(0, 120),
    );
    check(
      "AND OUR NAME IS NOT ON IT",
      !/INVOICIUM/.test(plainText),
      "the Professional template printed INVOICIUM at 17pt above the business name",
    );
    check("the client is on it", /Dana Reyes/.test(plainText));
    check("so is the number", /INV-901/.test(plainText));
    check(
      "the default footer still prints when no message is set",
      /Thank you for your business/.test(plainText),
    );
    check(
      "and our name is NOT added by default",
      !/Powered by Invoicium/.test(plainText),
      "an unset show_pdf_branding must not brand an existing account",
    );

    // ---- The footer and the powered-by line ------------------------------
    console.log("\nthe footer settings\n");

    const withFooter = await render("invoice", INVOICE, {
      ...SETTINGS,
      pdf_footer_text: "Payment by e-transfer to sam@miller.example",
      show_pdf_branding: true,
    });
    const footerText = withFooter.ok ? drawnText(withFooter.base64) : "";
    check("the Footer Message setting reaches the PDF", /e-transfer/.test(footerText), footerText.slice(-160));
    check("it replaces the stock line", !/Thank you for your business/.test(footerText));
    check("and Powered by Invoicium prints when it is switched on", /Powered by Invoicium/.test(footerText));

    // ---- The logo --------------------------------------------------------
    console.log("\nthe logo\n");

    const withLogo = await render("invoice", INVOICE, { ...SETTINGS, logo_url: PNG_1PX });
    check("an invoice with a logo renders", withLogo.ok, withLogo.error);
    check(
      "AND THE IMAGE IS ACTUALLY EMBEDDED",
      withLogo.ok && /\/Subtype\s*\/Image/.test(pdfText(withLogo.base64)),
      "the logo was uploaded, stored and shown in-app, and never reached a PDF",
    );
    fs.writeFileSync(path.join(outDir, "invoice-logo.pdf"), Buffer.from(withLogo.base64 || "", "base64"));

    const deadLogo = await render("invoice", INVOICE, {
      ...SETTINGS,
      logo_url: "https://127.0.0.1:9/does-not-exist.png",
    });
    check(
      "A LOGO THAT CANNOT BE FETCHED STILL PRODUCES AN INVOICE",
      deadLogo.ok,
      deadLogo.error,
    );
    check(
      "just without the image",
      deadLogo.ok && !/\/Subtype\s*\/Image/.test(pdfText(deadLogo.base64)),
    );

    const svgLogo = await render("invoice", INVOICE, {
      ...SETTINGS,
      logo_url: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    check(
      "AN SVG LOGO DOES NOT TAKE THE RENDER DOWN",
      svgLogo.ok,
      svgLogo.error,
    );

    // ---- The other two templates ----------------------------------------
    console.log("\nthe other layouts\n");

    for (const tpl of ["simple", "detailed"]) {
      const r = await render("invoice", INVOICE, { ...SETTINGS, logo_url: PNG_1PX }, { templateId: tpl });
      check(`the ${tpl} layout renders`, r.ok, r.error);
      check(`the ${tpl} layout embeds the logo`, r.ok && /\/Subtype\s*\/Image/.test(pdfText(r.base64)));
      const t = r.ok ? drawnText(r.base64) : "";
      check(`the ${tpl} layout is headed with the business name`, /Miller Construction/.test(t), t.slice(0, 100));
    }

    const detailedNoLogo = await render("invoice", INVOICE, SETTINGS, { templateId: "detailed" });
    check(
      "THE DETAILED LAYOUT NO LONGER PRINTS A BOX SAYING \"LOGO\"",
      detailedNoLogo.ok && !/\bLOGO\b/.test(drawnText(detailedNoLogo.base64)),
      "that placeholder was on the finished PDF a client received",
    );

    // ---- Quotes ----------------------------------------------------------
    console.log("\nquotes\n");

    const quote = await render("quote", QUOTE, { ...SETTINGS, logo_url: PNG_1PX });
    check("a quote renders through the same path", quote.ok, quote.error);
    const quoteText = quote.ok ? drawnText(quote.base64) : "";
    fs.writeFileSync(path.join(outDir, "quote.pdf"), Buffer.from(quote.base64 || "", "base64"));

    check("it says QUOTE, not INVOICE", /QUOTE/.test(quoteText) && !/INVOICE/.test(quoteText), quoteText.slice(0, 140));
    check("it carries the quote number", /QUO-450/.test(quoteText));
    check(
      "it says \"Valid until\" rather than telling a client something is due",
      /Valid until/.test(quoteText),
      quoteText.slice(0, 200),
    );
    check("the total is labelled as a quote total", /Quote Total/.test(quoteText));
    check("QUOTES GET THE LOGO TOO", /\/Subtype\s*\/Image/.test(pdfText(quote.base64)));
    check("and the contractor's name", /Miller Construction/.test(quoteText));
    check("with the quoted work on it", /Kitchen refit/.test(quoteText));

    const quoteSimple = await render("quote", QUOTE, SETTINGS, { templateId: "simple" });
    check("a quote renders in the simple layout too", quoteSimple.ok, quoteSimple.error);
    check(
      "and calls itself a Quote there as well",
      // \s+ because the label and the number are separate text runs in the
      // PDF and the extractor joins runs with a space -- the document is
      // correct, a literal single space in the pattern is not.
      /Quote\s+QUO-450/.test(drawnText(quoteSimple.base64)),
      drawnText(quoteSimple.base64 || "").slice(0, 120),
    );

    // ---- The font setting ------------------------------------------------
    console.log("\nthe font setting\n");

    const courier = await render("invoice", INVOICE, { ...SETTINGS, font_family: "courier" });
    check("courier renders", courier.ok, courier.error);
    check(
      "and the document really is set in Courier",
      /Courier/.test(pdfText(courier.base64)),
      "the font setting was saved and read by nothing",
    );
    const retired = await render("invoice", INVOICE, { ...SETTINGS, font_family: "georgia" });
    check(
      "a retired option resolves to a real family rather than failing",
      retired.ok && /Times/.test(pdfText(retired.base64)),
      retired.error,
    );

    check("nothing threw on the page", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
    console.log(`\n  PDFs -> ${outDir}`);
  } finally {
    await browser.close();
    fs.unlinkSync(bundlePath);
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
