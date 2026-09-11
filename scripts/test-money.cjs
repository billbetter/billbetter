/**
 * Formatting an amount in the business's currency.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Every amount on every screen. The formatter has a catch, so a bad options
 * combination does not throw where you would see it -- it renders the raw
 * fallback, "0.00 CAD", in place of the total. That is exactly what happened
 * when this module set minimumFractionDigits: 2 by default and a caller asked
 * for whole dollars: Intl refuses a minimum above an explicit maximum, and the
 * chase screen's stat tiles showed "0.00 CAD" instead of "$507,976".
 *
 * So: assert the shapes the app actually calls with, and assert the fallback
 * is NOT what comes back.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

async function load(rel) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
  });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

async function main() {
  const M = await load("src/lib/money.js");
  const looksBroken = (s) => /^[\d.]+ [A-Z]{3}$/.test(s); // the catch's output

  console.log("\nthe shapes the app calls with\n");

  const plain = M.formatMoney(1234.5, "CAD");
  check("two decimals by default", /1,234\.50/.test(plain) && !looksBroken(plain), plain);

  const whole = M.formatMoney(507976.24, "CAD", { maximumFractionDigits: 0 });
  check("whole dollars when asked (the chase tiles)",
    /507,976/.test(whole) && !/\.24/.test(whole) && !looksBroken(whole), whole);

  const bothZero = M.formatMoney(1250, "CAD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  check("whole dollars with both bounds (the digest, the banner)",
    /1,250/.test(bothZero) && !looksBroken(bothZero), bothZero);

  const twoTwo = M.formatMoney(99.5, "CAD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  check("two decimals with both bounds (quick bill)", /99\.50/.test(twoTwo) && !looksBroken(twoTwo), twoTwo);

  console.log("\nwhose currency\n");

  check("CAD when the business has not set one", M.formatMoney(10).includes("10"));
  check("a business on USD gets USD", /US\$|\$/.test(M.formatMoney(10, "USD")));
  const usd = M.formatMoney(10, "USD");
  const cad = M.formatMoney(10, "CAD");
  check("and the two are told apart", usd !== cad, `${usd} vs ${cad}`);

  console.log("\nnothing renders as a crash\n");

  check("no amount is still an amount", M.formatMoney(null, "CAD").includes("0"));
  check("rubbish counts as zero", M.formatMoney("abc", "CAD").includes("0"));
  const bad = M.formatMoney(5, "NOTACURRENCY");
  check("an unknown currency code falls back instead of throwing",
    bad.includes("5"), bad);

  console.log("\nbound formatters\n");

  const fmt = M.moneyFormatter("CAD", { maximumFractionDigits: 0 });
  check("moneyFormatter carries its options", !looksBroken(fmt(507976.24)), fmt(507976.24));
  check("and its currency", M.moneyFormatter("USD")(10) === M.formatMoney(10, "USD"));

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
