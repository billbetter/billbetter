/**
 * Prove a quote created THROUGH THE REAL UI gets its public credentials.
 *
 * -- Why a browser and not a direct insert --------------------------------
 *
 * The original bug was that CreateQuote.jsx's explicit field list omitted
 * public_id and approval_token. A test that inserts a row with SQL would have
 * passed while the product stayed broken, because the test would not have been
 * running the code that was wrong.
 *
 * So this drives the actual built bundle in a real browser: the real Radix
 * form, the real submit handler, the real sdk.entities.Quote.create ->
 * localDataEngine -> supabase-js path, authenticated as a real user against the
 * real database. The only thing faked is the session cookie, which is minted
 * through the Supabase admin API rather than by typing a password.
 *
 * Usage: node scripts/test-create-quote-ui.cjs <origin> <sessionJson> <clientName>
 * Driven by scripts/test-create-quote-ui.py, which handles fixtures and asserts
 * the database afterwards.
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const [origin, sessionPath, clientName] = process.argv.slice(2);
const sessionJson = fs.readFileSync(sessionPath, 'utf8');
const STORAGE_KEY = "invoicium-auth";

const log = (...a) => console.log("   ", ...a);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  try {
    // Land on the origin first so localStorage is same-origin, then plant the
    // session supabase-js expects to find.
    await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      (key, sess) => {
        window.localStorage.setItem(key, sess);
        window.localStorage.setItem("invoicium-remember-me", "true");
      },
      STORAGE_KEY,
      sessionJson,
    );

    log("session planted, opening CreateQuote");
    await page.goto(`${origin}/CreateQuote`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 3000));

    const url = page.url();
    if (/Login|UpgradeRequired/.test(url)) {
      throw new Error(`bounced to ${url} -- session or subscription gate`);
    }

    // --- Dismiss the notification prompt -------------------------------
    // It renders over the form and swallows the first click on anything else.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /maybe later/i.test(b.textContent),
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // --- Pick the client -------------------------------------------------
    // The trigger is a plain <button> reading "Select a client"; the list is
    // rendered into a portal once it opens.
    const opened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /select a client/i.test(b.textContent),
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!opened) throw new Error("could not find the client Select trigger");
    await new Promise((r) => setTimeout(r, 1200));

    // The list renders inline and its items carry no role="option", so try the
    // structural selectors first and fall back to the deepest element whose
    // text is the client we want.
    const picked = await page.evaluate((name) => {
      const bySelector = [
        '[role="option"]',
        "[data-radix-collection-item]",
        "[data-value]",
      ];
      for (const sel of bySelector) {
        const opts = Array.from(document.querySelectorAll(sel));
        const hit = opts.find((o) => o.textContent.includes(name));
        if (hit) {
          hit.click();
          return `${sel}: ${hit.textContent.trim().slice(0, 60)}`;
        }
      }
      // Deepest element containing the name -- clicking a wrapper can miss the
      // handler, clicking the leaf bubbles up to it.
      const all = Array.from(document.querySelectorAll("div,li,span,button"))
        .filter((el) => el.textContent.includes(name))
        .sort((a, b) => a.textContent.length - b.textContent.length);
      if (!all.length) return null;
      all[0].click();
      return `text-fallback: ${all[0].textContent.trim().slice(0, 60)}`;
    }, clientName);
    if (!picked) throw new Error("no client options rendered in the Select");
    log(`client selected: ${picked}`);
    await new Promise((r) => setTimeout(r, 1000));

    // --- Fill the first line item ----------------------------------------
    const setNativeSrc = `
      (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }`;

    const filled = await page.evaluate((setterSrc) => {
      // React tracks input value internally; assigning .value is ignored unless
      // the native setter is used and an input event dispatched.
      const setNative = eval(setterSrc);
      const desc = document.querySelector('input[placeholder^="Type to search"]');
      const qty = document.querySelector('input[type="number"][placeholder="0"]');
      const rate = document.querySelector('input[type="number"][placeholder="0.00"]');
      if (desc) setNative(desc, "UI-TEST line item");
      if (qty) setNative(qty, "2");
      if (rate) setNative(rate, "125");
      return { desc: !!desc, qty: !!qty, rate: !!rate };
    }, setNativeSrc);
    log(`line item filled: ${JSON.stringify(filled)}`);
    if (!filled.desc || !filled.qty || !filled.rate) {
      throw new Error(`missing line item inputs: ${JSON.stringify(filled)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));

    // The search field opens a suggestion list; close it so it cannot swallow
    // the submit click.
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 600));

    // --- Submit -----------------------------------------------------------
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => /create & send quote/i.test(b.textContent));
      if (!btn) return { ok: false, candidates: ["no Create & Send Quote button"] };
      if (btn.disabled) {
        // Disabled means the form does not consider itself valid, which is a
        // real failure worth reporting rather than clicking past.
        return {
          ok: false,
          candidates: [`"Create & Send Quote" is disabled -- form invalid`],
        };
      }
      btn.click();
      return { ok: true, label: btn.textContent.trim() };
    });
    if (!submitted.ok) {
      throw new Error(
        `no enabled submit button. candidates: ${JSON.stringify(submitted.candidates)}`,
      );
    }
    log(`submitted via "${submitted.label}"`);

    // The page navigates or opens a success dialog once the row is written.
    await new Promise((r) => setTimeout(r, 9000));
    log(`after submit, url = ${page.url()}`);

    console.log(
      "RESULT " +
        JSON.stringify({ ok: true, url: page.url(), errors: errors.slice(0, 6) }),
    );
  } catch (err) {
    console.log(
      "RESULT " +
        JSON.stringify({
          ok: false,
          error: String(err.message || err),
          errors: errors.slice(0, 6),
        }),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
