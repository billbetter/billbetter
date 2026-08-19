#!/usr/bin/env node
/**
 * Proposes token-based fixes for every pair the contrast audit flags.
 *
 *   node scripts/contrast-plan.cjs           # print the plan
 *   node scripts/contrast-plan.cjs --apply   # write the fixes
 *
 * Strategy, in order of preference:
 *   1. Light tint background (50/100/200)  -> darken the TEXT, keep the tint.
 *   2. Saturated fill with inverted text   -> darken the FILL, keep white text.
 *   3. Dark surface with muted text        -> lighten the TEXT.
 * Every replacement is another token on the same ramp, so hue/meaning is kept.
 */
const fs = require("fs");
const path = require("path");

const AA = 4.5;
const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/index.css"), "utf8");

const raw = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g))
  raw[m[1]] = m[2].trim();

function channels(name, d = 0) {
  if (d > 6) return null;
  const v = raw[name];
  if (!v) return null;
  const ind = v.match(/^var\(--([a-z0-9-]+)\)$/);
  if (ind) return channels(ind[1], d + 1);
  const p = v.split(/\s+/).map(Number);
  return p.length === 3 && p.every((n) => !isNaN(n)) ? p : null;
}
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

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
const chOf = (t) => channels(varOf(t));

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const CONTENT_LADDER_DARK = ["content-muted", "content-body", "content"]; // toward darker
const CONTENT_LADDER_LIGHT = [
  "content-muted",
  "ink-300",
  "ink-200",
  "content-inverted",
]; // toward lighter

const parse = (t) => {
  const m = t.match(/^([a-z]+)-(\d{2,3})$/);
  return m ? { ramp: m[1], shade: Number(m[2]) } : null;
};

/** darker steps on the same ramp */
function darker(tok) {
  const p = parse(tok);
  if (!p) return [];
  return SHADES.filter((s) => s > p.shade).map((s) => `${p.ramp}-${s}`);
}
/** lighter steps on the same ramp */
function lighter(tok) {
  const p = parse(tok);
  if (!p) return [];
  return SHADES.filter((s) => s < p.shade)
    .sort((a, b) => b - a)
    .map((s) => `${p.ramp}-${s}`);
}

function solve(bg, text) {
  const cbg = chOf(bg),
    ctx = chOf(text);
  if (!cbg || !ctx) return null;
  if (ratio(cbg, ctx) >= AA) return null;

  const bgIsLightTint = parse(bg) && parse(bg).shade <= 200;
  const bgIsDark = lum(cbg) < 0.2;
  const textIsInverted = text === "content-inverted";

  // 1. light tint -> darken text
  if (bgIsLightTint) {
    const cands = parse(text) ? darker(text) : CONTENT_LADDER_DARK;
    for (const c of cands) {
      const cc = chOf(c);
      if (cc && ratio(cbg, cc) >= AA)
        return { kind: "text", from: text, to: c };
    }
  }
  // 2a. Warm/light fills (amber, yellow, orange) can never carry white text at
  //     AA without turning brown. Keep the vivid fill, darken the TEXT instead.
  //     e.g. warning-500 + white = 2.15:1, but + content(ink-900) = 8.31:1.
  const WARM = new Set(["warning", "caution", "alert"]);
  if (textIsInverted && parse(bg) && WARM.has(parse(bg).ramp)) {
    for (const c of ["content", "content-body"]) {
      const cc = chOf(c);
      if (cc && ratio(cbg, cc) >= AA)
        return { kind: "text", from: text, to: c };
    }
  }

  // 2b. Cool saturated fill + white text -> darken the fill, keep white text.
  if (textIsInverted && parse(bg)) {
    for (const c of darker(bg)) {
      const cc = chOf(c);
      if (cc && ratio(cc, ctx) >= AA) return { kind: "bg", from: bg, to: c };
    }
  }
  // 3. dark surface -> lighten the text
  if (bgIsDark) {
    const cands = parse(text) ? lighter(text) : CONTENT_LADDER_LIGHT;
    for (const c of cands) {
      const cc = chOf(c);
      if (cc && ratio(cbg, cc) >= AA)
        return { kind: "text", from: text, to: c };
    }
  }
  // fallback: darken text on any ramp
  const cands = parse(text) ? darker(text) : CONTENT_LADDER_DARK;
  for (const c of cands) {
    const cc = chOf(c);
    if (cc && ratio(cbg, cc) >= AA) return { kind: "text", from: text, to: c };
  }
  return null;
}

// ── collect findings (same scan as contrast-audit.cjs)
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".jsx")) files.push(p);
  }
})(path.join(ROOT, "src"));

const TOKEN =
  "(?:ink|brand|success|danger|warning|caution|info|accent|positive|alert|aqua|blush|magenta|sand|surface|content|line)(?:-[a-z]+)?(?:-\\d{2,3})?";

const APPLY = process.argv.includes("--apply");
const plan = new Map(); // file -> [{line, from, to}]
const summary = new Map();
let unsolved = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/class(?:Name)?=["'{`]([^"'}`]*)/g)) {
      const cls = m[1].split(/\s+/);
      const pick = (p) =>
        cls
          .filter((c) => new RegExp(`^${p}-${TOKEN}$`).test(c))
          .map((c) => c.replace(new RegExp(`^${p}-`), ""));
      const bg = pick("bg"),
        text = pick("text");
      const hbg = pick("hover:bg"),
        htext = pick("hover:text");
      const pairs = [];
      for (const b of bg) for (const t of text) pairs.push([b, t, ""]);
      for (const b of hbg)
        for (const t of [...text, ...htext]) pairs.push([b, t, "hover:"]);
      for (const b of bg)
        for (const t of htext) pairs.push([b, t, "hover-text"]);

      for (const [b, t, ctx] of pairs) {
        const fix = solve(b, t);
        if (!fix) {
          const cb = chOf(b),
            ct = chOf(t);
          if (cb && ct && ratio(cb, ct) < AA) unsolved++;
          continue;
        }
        const prefix =
          fix.kind === "bg"
            ? ctx === "hover:"
              ? "hover:bg"
              : "bg"
            : ctx === "hover-text"
              ? "hover:text"
              : "text";
        const fromCls = `${prefix}-${fix.from}`;
        const toCls = `${prefix}-${fix.to}`;
        if (!line.includes(fromCls)) continue;
        const key = `${fromCls} -> ${toCls}`;
        summary.set(key, (summary.get(key) || 0) + 1);
        if (!plan.has(file)) plan.set(file, []);
        plan.get(file).push({ line: i + 1, from: fromCls, to: toCls, rel });
      }
    }
  });
}

console.log(
  `${[...summary.values()].reduce((a, b) => a + b, 0)} replacement(s) planned across ${plan.size} file(s)`,
);
if (unsolved)
  console.log(
    `${unsolved} pair(s) had no token-only solution — review manually`,
  );
console.log("\n-- by pattern --");
for (const [k, v] of [...summary].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`);

if (APPLY) {
  let n = 0;
  for (const [file, edits] of plan) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    const byLine = new Map();
    for (const e of edits) {
      if (!byLine.has(e.line)) byLine.set(e.line, new Set());
      byLine.get(e.line).add(`${e.from}|${e.to}`);
    }
    for (const [ln, set] of byLine) {
      for (const pair of set) {
        const [from, to] = pair.split("|");
        const rx = new RegExp(
          `(?<![\\w-])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
          "g",
        );
        const before = lines[ln - 1];
        lines[ln - 1] = before.replace(rx, to);
        if (lines[ln - 1] !== before) n++;
      }
    }
    fs.writeFileSync(file, lines.join("\n"));
  }
  console.log(`\napplied ${n} edit(s)`);
}
