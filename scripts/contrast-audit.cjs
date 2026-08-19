#!/usr/bin/env node
/**
 * Design-token contrast audit — LIGHT and DARK mode.
 *
 *   node scripts/contrast-audit.cjs          # fail-on-findings (exit 1)
 *
 * The RGB token ramps are NOT redefined inside `.dark` — the values are the
 * same in both themes and only the applied class changes. So dark mode is
 * evaluated by preferring a `dark:`-prefixed utility over its bare form.
 *
 * Resolves the token ramps + semantic aliases out of src/index.css, then walks
 * every .jsx file looking for a background token and a text token applied to
 * the SAME element, and reports pairs under the WCAG AA threshold.
 *
 * KNOWN LIMIT: this is static analysis of one element at a time. Text that
 * inherits a colour from a parent whose background is set elsewhere is NOT
 * covered, and neither are currentColor icons. Those need a rendered DOM
 * (Playwright + axe-core) to catch.
 */
const fs = require("fs");
const path = require("path");

const AA_NORMAL = 4.5; // WCAG 1.4.3 normal text
const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/index.css"), "utf8");

const raw = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g))
  raw[m[1]] = m[2].trim();

function channels(name, depth = 0) {
  if (depth > 6) return null;
  const v = raw[name];
  if (!v) return null;
  const indirect = v.match(/^var\(--([a-z0-9-]+)\)$/);
  if (indirect) return channels(indirect[1], depth + 1);
  const parts = v.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? parts : null;
}

const luminance = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const l1 = luminance(a),
    l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// tailwind class fragment -> css variable
const SEMANTIC = {
  surface: "color-surface",
  "surface-sunken": "color-surface-sunken",
  "surface-inverted": "color-surface-inverted",
  "surface-inverted-deep": "color-surface-inverted-deep",
  content: "color-text-primary",
  "content-body": "color-text-body",
  "content-muted": "color-text-muted",
  "content-subtle": "color-text-subtle",
  "content-inverted": "color-text-inverted",
  line: "color-border",
  "line-subtle": "color-border-subtle",
  "line-strong": "color-border-strong",
  "line-hover": "color-border-hover",
  brand: "color-primary",
  "brand-hover": "color-primary-hover",
  "brand-on-dark": "color-primary-on-dark",
  "brand-tint": "color-primary-tint",
};
const varOf = (t) => SEMANTIC[t] || t;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".jsx")) files.push(p);
  }
})(path.join(__dirname, "..", "src"));

const TOKEN =
  "(?:ink|brand|success|danger|warning|caution|info|accent|positive|alert|aqua|blush|magenta|sand|surface|content|line)(?:-[a-z]+){0,2}(?:-\\d{2,3})?";

/** Resolve `prop` for one element in one theme, as { token, alpha }. */
function resolve(cls, prop, dark) {
  const bare = new RegExp(`^${prop}-(${TOKEN})(?:/(\\d+))?$`);
  const dk = new RegExp(`^dark:${prop}-(${TOKEN})(?:/(\\d+))?$`);
  // A dark override written in a colour we don't own (bg-black/20, a Tailwind
  // default hue) still overrides — falling back to the light value would report
  // a failure that never happens on screen. Bail out instead.
  const hasDark = cls.some((c) => c.startsWith(`dark:${prop}-`));
  let base = null,
    over = null;
  for (const c of cls) {
    let m;
    if ((m = c.match(bare)))
      base = { token: m[1], alpha: m[2] ? +m[2] / 100 : 1 };
    else if ((m = c.match(dk)))
      over = { token: m[1], alpha: m[2] ? +m[2] / 100 : 1 };
  }
  if (dark) return over || (hasDark ? null : base);
  return base;
}

// A translucent fill is not the colour the eye sees — composite it over the
// page behind it before measuring. Tint chips are written as e.g.
// `dark:bg-success-900/30`, which over the dark page reads far lighter.
const PAGE = {
  light: [255, 255, 255],
  dark: channels("color-surface-inverted-deep"),
};
const over = (fg, alpha, bg) =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

const NL = String.fromCharCode(10);
const findings = [];
for (const file of files) {
  const rel = path
    .relative(path.join(__dirname, ".."), file)
    .split(path.sep)
    .join("/");
  fs.readFileSync(file, "utf8")
    .split(NL)
    .forEach((line, i) => {
      for (const m of line.matchAll(/class(?:Name)?=["'`{]?["'`]?([^"'`]*)/g)) {
        const cls = m[1].trim().split(/\s+/).filter(Boolean);
        for (const dark of [false, true]) {
          const b = resolve(cls, "bg", dark);
          const t = resolve(cls, "text", dark);
          if (!b || !t) continue;
          let cb = channels(varOf(b.token));
          let ct = channels(varOf(t.token));
          if (!cb || !ct) continue;
          // A translucent background composites over whatever is BEHIND it, and
          // static analysis can't see the parent. Reporting it would mean
          // guessing. Solid fills only.
          if (b.alpha < 1) continue;
          if (t.alpha < 1) ct = over(ct, t.alpha, cb);
          const ratio = contrast(cb, ct);
          if (ratio < AA_NORMAL)
            findings.push({
              rel,
              line: i + 1,
              mode: dark ? "dark" : "light",
              ratio,
              b: b.token + (b.alpha < 1 ? `/${Math.round(b.alpha * 100)}` : ""),
              t: t.token + (t.alpha < 1 ? `/${Math.round(t.alpha * 100)}` : ""),
            });
        }
      }
    });
}

findings.sort((a, b) => a.ratio - b.ratio);
if (!findings.length) {
  console.log(
    `No same-element token pairs below ${AA_NORMAL}:1 in either theme.`,
  );
  process.exit(0);
}
const dk = findings.filter((f) => f.mode === "dark").length;
console.log(
  `${findings.length} pair(s) below ${AA_NORMAL}:1  (${findings.length - dk} light, ${dk} dark)` +
    NL,
);
for (const f of findings)
  console.log(
    `${f.ratio.toFixed(2).padStart(5)}  [${f.mode.padEnd(5)}] ${f.rel}:${f.line}  bg-${f.b} + text-${f.t}`,
  );
process.exit(1);
