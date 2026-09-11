/**
 * Calendar days, read as the day they say.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * `due_date`, `date_issued` and `expiry_date` are DATE-ONLY columns. The
 * language reads "2026-09-20" as UTC midnight, which anywhere in Canada is the
 * evening of the 19th, so every screen that formatted one named the day before
 * the one that was typed, and every comparison with `now` called an invoice
 * overdue a day early -- including the sweep that WRITES status: "overdue",
 * and the reminder that tells a client they are late.
 *
 * These tests run at a fixed instant in a fixed zone (America/Halifax, the
 * worst case at UTC-3), because the bug only appears west of Greenwich and a
 * test in UTC would pass against the broken code.
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
  const plugin = {
    name: "alias",
    setup(build) {
      build.onResolve({ filter: /^@\// }, (args) => {
        const base = path.join(ROOT, "src", args.path.slice(2));
        for (const ext of ["", ".js", ".jsx"]) {
          if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
            return { path: base + ext };
          }
        }
        return { path: base };
      });
    },
  };
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
    plugins: [plugin],
  });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

async function main() {
  if (process.env.TZ !== "America/Halifax") {
    // Re-exec in the zone the bug shows up in, so the result does not depend
    // on the machine running it.
    const { spawnSync } = require("child_process");
    const r = spawnSync(process.execPath, [__filename], {
      stdio: "inherit",
      env: { ...process.env, TZ: "America/Halifax" },
    });
    process.exit(r.status === null ? 1 : r.status);
  }

  const C = await load("src/lib/calendarDate.js");
  const offset = new Date(2026, 8, 20).getTimezoneOffset();
  check("running west of Greenwich, where the bug lives", offset > 0, `offset=${offset}`);

  console.log("\nthe day a date-only column names\n");

  const day = C.parseCalendarDay("2026-09-20");
  check("is that day", day.getFullYear() === 2026 && day.getMonth() === 8 && day.getDate() === 20,
    day && day.toString());
  check("at local midnight", day.getHours() === 0 && day.getMinutes() === 0);
  check("which new Date() gets wrong, hence this module",
    new Date("2026-09-20").getDate() === 19, new Date("2026-09-20").toString());

  check("a timestamp keeps its own instant",
    C.parseCalendarDay("2026-09-20T15:00:00Z").getUTCHours() === 15);
  check("a Date passes through", C.parseCalendarDay(new Date(2026, 8, 20)).getDate() === 20);

  console.log("\nnothing to format is not a crash\n");

  for (const bad of [null, undefined, "", "not a date"]) {
    check(`${JSON.stringify(bad)} has no day`, C.parseCalendarDay(bad) === null);
    check(`${JSON.stringify(bad)} formats as the fallback`,
      C.formatCalendarDay(bad, "MMM d, yyyy", "—") === "—");
  }
  check("a real day formats normally",
    C.formatCalendarDay("2026-09-20", "MMM d, yyyy") === "Sep 20, 2026",
    C.formatCalendarDay("2026-09-20", "MMM d, yyyy"));

  console.log("\ndue today is not overdue\n");

  const noonToday = new Date(2026, 8, 20, 12, 0, 0);
  check("the due day itself is 0 days away", C.daysUntilDay("2026-09-20", noonToday) === 0);
  check("tomorrow is 1", C.daysUntilDay("2026-09-21", noonToday) === 1);
  check("yesterday is -1", C.daysUntilDay("2026-09-19", noonToday) === -1);
  check("no due date is null, not 0", C.daysUntilDay(null, noonToday) === null);

  check("an invoice due today is NOT overdue", C.isPastDay("2026-09-20", noonToday) === false);
  check("and is still not overdue late in the evening",
    C.isPastDay("2026-09-20", new Date(2026, 8, 20, 23, 59)) === false);
  check("it is overdue the next day", C.isPastDay("2026-09-20", new Date(2026, 8, 21, 0, 1)) === true);
  check("an invoice with no due date is never overdue", C.isPastDay(null, noonToday) === false);

  // The whole point: the old expression, evaluated here, is wrong.
  check("the old `new Date(due) < now` called it overdue on the morning of the due day",
    new Date("2026-09-20") < new Date(2026, 8, 20, 9, 0));

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
