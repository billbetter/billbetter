#!/usr/bin/env node
/**
 * Build-time guard for sdk.functions.invoke() names.
 *
 * WHY THIS EXISTS
 *
 * ApproveQuote.jsx called invoke("approveQuote") for months. No such edge
 * function was ever written, no stub matched, and the catch-all at the bottom
 * of handleFunctionInvoke answered { success: true }. The client saw a green
 * "Quote Approved!" and the quote's status was never touched -- silent data
 * loss, shown to the customer as confirmation.
 *
 * The previous version of this file walked src/, extracted every invoke name,
 * printed the list and exited 0. "approveQuote" was the SECOND LINE of its
 * output. It had been reporting the bug since the day it was written; it just
 * never compared the list to anything, and nothing ever ran it.
 *
 * THREE CATEGORIES, not two
 *
 * A literal "every invoked name needs an edge function directory" rule would
 * fail on 15 names that are deliberately stubbed client-side (getBillingHistory,
 * createBooking, ...). So each invoked name must be exactly one of:
 *
 *   1. MAPPED  - in realEdgeFunctions AND has a supabase/functions/ directory
 *   2. STUBBED - has an explicit `name === "x"` branch in handleFunctionInvoke
 *   3. neither -> FAILURE. This is the approveQuote class.
 *
 * Stubs are tracked against a baseline below so a NEW one has to be added
 * deliberately. A stub that answers { success: true } without doing anything is
 * the same failure mode as the catch-all, just written on purpose.
 *
 * Exit 1 on any failure. Wired into `npm run check`.
 */
const fs = require("fs");
const path = require("path");

const SDK = "src/api/sdk.js";
const FUNCTIONS_DIR = "supabase/functions";

/**
 * Client-side stubs that are intentional today.
 *
 * Every line here is a function the UI calls that does nothing on a server.
 * Each should eventually become a real edge function or be deleted. Adding to
 * this list is a decision; forgetting to is what this guard prevents.
 */
const KNOWN_STUBS = new Set([
  "createBooking",
  "createCheckoutSession",
  "exportQuotesToExcel",
  "getAvailableSlots",
  "getBillingHistory",
  "getInvoiceBySession",
  "notifyInvoiceCreated",
  "notifyQuoteApproval",
  "saveNotificationSettings",
  "sendContactEmail",
  "sendOverdueNotification",
  "sendPhoneVerification",
  "sendWelcomeEmail",
  "verifyPhoneCode",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|tsx?)$/.test(full)) out.push(full);
  }
  return out;
}

const sdkSource = fs.readFileSync(SDK, "utf8");

// The realEdgeFunctions literal: invoke name -> edge function directory.
const mapStart = sdkSource.indexOf("const realEdgeFunctions = {");
if (mapStart === -1) {
  console.error(`FAIL: could not find realEdgeFunctions in ${SDK}.`);
  process.exit(1);
}
const mapBody = sdkSource.slice(mapStart, sdkSource.indexOf("};", mapStart));
const mapped = new Map(
  [...mapBody.matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);

// Explicit stub branches.
const stubbed = new Set(
  [...sdkSource.matchAll(/name === "([^"]+)"/g)].map((m) => m[1]),
);

// Every literal invoke name across src/.
const invoked = new Map();
for (const file of walk("src")) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(
    /sdk\.functions\.invoke\s*\(\s*["'`]([^"'`]+)["'`]/g,
  )) {
    if (!invoked.has(m[1])) invoked.set(m[1], []);
    invoked.get(m[1]).push(path.relative(".", file));
  }
}

const dirs = new Set(
  fs
    .readdirSync(FUNCTIONS_DIR)
    .filter((d) => !d.startsWith("_") && fs.statSync(path.join(FUNCTIONS_DIR, d)).isDirectory()),
);

const errors = [];
const warnings = [];

for (const [name, files] of [...invoked].sort()) {
  const where = files.join(", ");
  if (mapped.has(name)) {
    const dir = mapped.get(name);
    if (!dirs.has(dir)) {
      errors.push(
        `"${name}" is mapped to ${FUNCTIONS_DIR}/${dir}, which does not exist.\n` +
          `      called from: ${where}`,
      );
    }
  } else if (stubbed.has(name)) {
    if (!KNOWN_STUBS.has(name)) {
      errors.push(
        `"${name}" is a NEW client-side stub. It does nothing on a server.\n` +
          `      Write the edge function, or add it to KNOWN_STUBS in this file\n` +
          `      to record that the stub is deliberate.\n` +
          `      called from: ${where}`,
      );
    }
  } else {
    errors.push(
      `"${name}" has NO implementation: not in realEdgeFunctions, no stub branch.\n` +
        `      It will hit the catch-all and return success:false.\n` +
        `      This is the approveQuote class of bug.\n` +
        `      called from: ${where}`,
    );
  }
}

// Mapped but never called: dead wiring, worth knowing, not worth failing over.
for (const [name, dir] of [...mapped].sort()) {
  if (!invoked.has(name)) warnings.push(`"${name}" (-> ${dir}) is mapped but never invoked.`);
}
// A stub in the baseline that nobody calls any more can be deleted.
for (const name of [...KNOWN_STUBS].sort()) {
  if (!invoked.has(name)) warnings.push(`"${name}" is in KNOWN_STUBS but never invoked -- remove it.`);
}

console.log(
  `Checked ${invoked.size} invoke names: ` +
    `${[...invoked.keys()].filter((n) => mapped.has(n)).length} mapped, ` +
    `${[...invoked.keys()].filter((n) => !mapped.has(n) && stubbed.has(n)).length} stubbed.`,
);

for (const w of warnings) console.log(`  warn  ${w}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  FAIL  ${e}\n`);
  process.exit(1);
}
console.log("All invoke names resolve to a real function or a known stub.");
