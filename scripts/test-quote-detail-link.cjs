/**
 * Assert QuoteDetail actually RENDERS the client link for a quote.
 *
 * This is the half that a database assertion cannot cover. Before this work
 * QuoteDetail computed `publicUrl` and then never referenced it anywhere in the
 * file, so a quote could have had a perfectly good public_id and the contractor
 * would still have had no way to reach or share the page. Checking the column
 * is populated proves the credential exists; only rendering the page proves it
 * is reachable.
 *
 * Usage: node scripts/test-quote-detail-link.cjs <origin> <sessionJson> <quoteId> <publicId>
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const [origin, sessionPath, quoteId, publicId] = process.argv.slice(2);
const sessionJson = fs.readFileSync(sessionPath, 'utf8');
const STORAGE_KEY = "invoicium-auth";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1600 });

  try {
    await page.goto(`${origin}/Login`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      (key, sess) => {
        window.localStorage.setItem(key, sess);
        window.localStorage.setItem("invoicium-remember-me", "true");
      },
      STORAGE_KEY,
      sessionJson,
    );

    await page.goto(`${origin}/QuoteDetail?id=${quoteId}`, {
      waitUntil: "networkidle2",
    });
    await new Promise((r) => setTimeout(r, 4000));

    const found = await page.evaluate((pid) => {
      // The link is rendered inside a <code> element by PublicLinkControls.
      const codes = Array.from(document.querySelectorAll("code")).map((c) =>
        c.textContent.trim(),
      );
      const linkText = codes.find((t) => t.includes("/PublicQuote?id=")) || null;
      const bodyText = document.body.innerText;
      return {
        linkShown: Boolean(linkText),
        linkText,
        hasPublicId: Boolean(linkText && linkText.includes(pid)),
        // Proves the surrounding control rendered, not just any <code>.
        hasClientLinkHeading: /Client link/i.test(bodyText),
        hasPreview: /Preview/i.test(bodyText),
        hasTurnOff: /Turn off link/i.test(bodyText),
        notOpenedYet: /Not opened yet/i.test(bodyText),
      };
    }, publicId);

    console.log("RESULT " + JSON.stringify({ ok: true, ...found }));
  } catch (err) {
    console.log(
      "RESULT " + JSON.stringify({ ok: false, error: String(err.message || err) }),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
