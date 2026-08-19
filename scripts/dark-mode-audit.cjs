#!/usr/bin/env node
/**
 * Dark-mode coverage audit.
 *
 *   node scripts/dark-mode-audit.cjs            # summary by file
 *   node scripts/dark-mode-audit.cjs --list     # every finding
 *   node scripts/dark-mode-audit.cjs --file X   # one file
 *
 * Finds light-only utilities that have no `dark:` counterpart for the SAME
 * property and the SAME variant prefix. `hover:bg-surface` is satisfied by
 * `dark:hover:bg-*`, not by `dark:bg-*`.
 *
 * KNOWN LIMIT: a class is only "missing" relative to its own element. Text that
 * legitimately inherits a dark-aware colour from a parent is still reported.
 */
const fs = require("fs");
const path = require("path");

// Marketing / public / auth screens are deliberately light-only: they render
// the same for signed-out visitors regardless of the app's theme setting.
const LIGHT_ONLY =
  /(Home|Pricing|BookDemo|Blog|BlogPost|Contact|PrivacyPolicy|TermsOfService|Sitemap|Features|PublicQuote|PublicBooking|ApproveQuote|SharedPhotos|Login|Register|sign-in|PaymentSuccess|InvoicePaymentSuccess|PhoneVerification|UpgradeRequired|UserNotRegisteredError|PageNotFound|QuickInvoice|QuickQuote)\.jsx$/;
const SKIP_DIR = /\/marketing\//; // matched against the normalised path

// Document previews render what the CLIENT receives — a printed invoice/quote.
// They stay white paper in both themes (their roots carry dark:!bg-surface),
// so their light ink text is correct, not a dark-mode gap.
const PAPER = /(InvoicePreview|QuotePreview|CustomTemplatePreview)\.jsx$/;
// A file can opt a region out inline, for blocks that are light in both
// themes (e.g. the signed-out marketing shell inside Layout). Line numbers
// shift every time the file is edited, so the exclusion lives in the code it
// describes:  /* audit:light-only:start */ ... /* audit:light-only:end */
const MARK_START = "audit:light-only:start";
const MARK_END = "audit:light-only:end";
const ALLOW_FILE = /GoogleAuthButton\.jsx$/;

const LIGHT_BG =
  /^((?:[a-z-]+:)*)(bg-(?:surface|surface-sunken|white|ink-(?:50|100|200)|line|line-subtle))(\/\d+)?$/;
const DARK_TEXT =
  /^((?:[a-z-]+:)*)(text-(?:content|content-body|ink-(?:600|700|800|900|950)))(\/\d+)?$/;
const LIGHT_BORDER =
  /^((?:[a-z-]+:)*)(border-(?:line|line-subtle|line-strong|ink-(?:100|200|300)))(\/\d+)?$/;

const RULES = [
  ["bg", LIGHT_BG, "dark:%sbg-"],
  ["text", DARK_TEXT, "dark:%stext-"],
  ["border", LIGHT_BORDER, "dark:%sborder-"],
];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".jsx")) files.push(p);
  }
})("src");

const args = process.argv.slice(2);
const only = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const list = args.includes("--list");

const byFile = new Map();
for (const f of files) {
  const rel = f.split(path.sep).join("/");
  if (
    only
      ? !rel.includes(only)
      : LIGHT_ONLY.test(rel) ||
        SKIP_DIR.test(rel) ||
        PAPER.test(rel) ||
        ALLOW_FILE.test(rel)
  )
    continue;
  let muted = false;
  fs.readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes(MARK_START)) muted = true;
      if (line.includes(MARK_END)) muted = false;
      if (muted) return;
      for (const m of line.matchAll(/class(?:Name)?=["`{]?["`]?([^"`]*)/g)) {
        const cls = m[1].trim().split(/\s+/).filter(Boolean);
        // An element whose fill is a fixed brand/status colour (bg-warning-500
        // with no dark override) looks identical in both themes, so its text
        // must NOT flip either. Flagging it would push white onto amber.
        const fixedFill = cls.some(
          (c) =>
            /^bg-(?:success|danger|warning|info|brand|alert|accent|positive|caution|magenta|aqua|blush)-(?:[3-9]00|950)$/.test(
              c,
            ) && !cls.some((o) => o.startsWith("dark:bg-")),
        );
        for (const c of cls) {
          for (const [kind, re, tmpl] of RULES) {
            if (kind === "text" && fixedFill) continue;
            const hit = c.match(re);
            if (!hit) continue;
            const need = new RegExp("^" + tmpl.replace("%s", hit[1]));
            if (cls.some((o) => need.test(o))) continue;
            if (!byFile.has(rel)) byFile.set(rel, []);
            byFile.get(rel).push({ line: i + 1, kind, cls: c });
          }
        }
      }
    });
}

let total = 0;
const rows = [...byFile].sort((a, b) => b[1].length - a[1].length);
for (const [rel, hits] of rows) {
  total += hits.length;
  const k = { bg: 0, text: 0, border: 0 };
  hits.forEach((h) => k[h.kind]++);
  console.log(
    `${String(hits.length).padStart(4)}  ${rel}   (bg ${k.bg} / text ${k.text} / border ${k.border})`,
  );
  if (list) for (const h of hits) console.log(`        :${h.line}  ${h.cls}`);
}
console.log(`\n${total} finding(s) across ${rows.length} file(s)`);
