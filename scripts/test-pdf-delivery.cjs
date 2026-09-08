/**
 * How a rendered PDF reaches the user.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Silence. Chrome refuses top-level navigation to a `data:` URL without
 * throwing, without warning, and with `window.open` still returning — so the
 * four call sites that did `window.open(pdf_url)` took their success branch,
 * told the user "Invoice created and downloaded!", and delivered nothing. A
 * failure that reports success is the worst shape a bug can take: there is no
 * error to search for and the user's only evidence is that the product does
 * not do what it says.
 *
 * So the properties worth pinning down are the ones whose absence is invisible:
 * that a data: URL is never handed to window.open, that a blocked popup still
 * results in a saved file, and that nothing is delivered for an empty input
 * (which would otherwise open a blank tab and look like a broken PDF).
 *
 * Usage: node scripts/test-pdf-delivery.cjs
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

let passed = 0,
  failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`);
  }
}

/** Minimal browser surface, recording what the helper did. */
function makeDom({ popupBlocked = false } = {}) {
  const log = { opened: [], downloaded: [], revoked: [], created: 0 };
  const anchors = [];

  global.URL = {
    createObjectURL(blob) {
      log.created++;
      log.lastBlobSize = blob && blob.size;
      return `blob:mock/${log.created}`;
    },
    revokeObjectURL(u) {
      log.revoked.push(u);
    },
  };
  global.document = {
    createElement() {
      const a = {
        href: "",
        download: "",
        click() {
          log.downloaded.push({ href: a.href, download: a.download });
        },
        remove() {},
      };
      anchors.push(a);
      return a;
    },
    body: { appendChild() {} },
  };
  global.window = {
    open(url) {
      log.opened.push(url);
      return popupBlocked ? null : { closed: false };
    },
  };
  // Real data: URL decoding, which is the behaviour being relied on.
  global.fetch = async (url) => {
    const b64 = String(url).split(",")[1] || "";
    const bytes = Buffer.from(b64, "base64");
    return { blob: async () => ({ size: bytes.length, type: "application/pdf" }) };
  };
  global.setTimeout = (fn) => fn();
  return log;
}

async function load() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/pdfDelivery.js")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
  });
  const tmp = path.join(ROOT, `tmp-delivery-${process.pid}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.split(path.sep).join("/"));
  fs.unlinkSync(tmp);
  return mod;
}

const DATA_PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 hello").toString("base64");

async function main() {
  const { deliverPdf } = await load();

  console.log("\nthe silent-failure bug");
  {
    const log = makeDom();
    await deliverPdf(DATA_PDF, { filename: "Invoice-1.pdf", mode: "open" });
    check(
      "a data: URL is NEVER passed to window.open",
      log.opened.every((u) => !u.startsWith("data:")),
      JSON.stringify(log.opened),
    );
    check("it opened a blob: URL instead", log.opened[0]?.startsWith("blob:"));
    check("the blob carries the decoded bytes", log.lastBlobSize === 14, log.lastBlobSize);
  }

  console.log("\npopup blocked -- must still deliver");
  {
    const log = makeDom({ popupBlocked: true });
    const ok = await deliverPdf(DATA_PDF, { filename: "Invoice-2.pdf", mode: "open" });
    check("reports success", ok === true);
    check("fell back to a download", log.downloaded.length === 1);
    check(
      "the saved file keeps the intended name",
      log.downloaded[0]?.download === "Invoice-2.pdf",
      JSON.stringify(log.downloaded),
    );
    check("the download used a blob: URL", log.downloaded[0]?.href.startsWith("blob:"));
  }

  console.log("\ndownload mode");
  {
    const log = makeDom();
    await deliverPdf(DATA_PDF, { filename: "Invoice-3.pdf" });
    check("never tries to open a tab", log.opened.length === 0);
    check("saves the file", log.downloaded[0]?.download === "Invoice-3.pdf");
  }

  console.log("\nnothing to deliver");
  {
    for (const empty of ["", null, undefined]) {
      const log = makeDom();
      const ok = await deliverPdf(empty, { filename: "x.pdf", mode: "open" });
      check(
        `${JSON.stringify(empty)} delivers nothing and says so`,
        ok === false && log.opened.length === 0 && log.downloaded.length === 0,
      );
    }
  }

  console.log("\nurls that are already fetchable");
  {
    const log = makeDom();
    await deliverPdf("https://example.com/a.pdf", { mode: "open" });
    check("an https URL is opened as-is", log.opened[0] === "https://example.com/a.pdf");
    check("no blob was minted for it", log.created === 0);
    check("and nothing is revoked", log.revoked.length === 0);
  }

  console.log("\nobject URLs are cleaned up");
  {
    const log = makeDom();
    await deliverPdf(DATA_PDF, { filename: "Invoice-4.pdf" });
    check("the minted blob URL is revoked", log.revoked.length === 1, JSON.stringify(log.revoked));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
