/**
 * Golden-master snapshot of every page, for proving a refactor changed no
 * output. Browser half of snapshot-pages.py.
 *
 * -- What "no output change" means here -------------------------------------
 *
 * Each page is loaded as the owner (writes blocked -- see _page-harness.cjs) at
 * a phone and a desktop width, left to settle, and its whole <body> is written
 * out as text: every element, every attribute, every text node, in DOM order,
 * plus the final URL, the title, and any uncaught error or console.error. Two
 * runs that produce the same files rendered the same thing -- same classes,
 * same copy, same controls in the same state -- which is the claim a pure
 * structural refactor has to be able to make.
 *
 * Kept deterministic on purpose, because a golden master that differs between
 * two identical runs is one people learn to ignore:
 *   - the clock is frozen, so greetings, "3 days overdue" and the invoice
 *     number CreateInvoice derives from Date.now() do not drift;
 *   - Math.random is seeded;
 *   - React's generated ids (":r3:", "radix-:r3:") are normalised, because
 *     splitting a component legitimately renumbers them and nothing observable
 *     depends on the number;
 *   - numbers inside an inline `transform:` are masked. The homepage
 *     testimonial columns scroll forever, so their translateY is never the
 *     same twice. `transform: none` still differs from a real transform;
 *   - the notification prompt is pre-dismissed ("notification_prompted", the
 *     key the app sets itself). It mounts on a 3s timer, so a fixed settle
 *     time caught it on some runs and not others -- 46 lines of noise on every
 *     signed-in page. Calibrated by diffing two captures of the same build.
 *
 * States behind a click -- an open menu, a dialog, a later wizard step -- are
 * not in a page's first render, so SCENARIOS below script the clicks and
 * capture what they open. Behaviour (what a handler DOES) is still outside
 * what any snapshot can see.
 *
 * Usage: node scripts/snapshot-pages.cjs <origin> <configJson> <outDir> [only]
 *   only: comma-separated substrings; just the routes/scenarios matching one
 */
const fs = require("fs");
const path = require("path");
const harness = require("./_page-harness.cjs");

const [origin, configPath, outDir, onlyArg] = process.argv.slice(2);
const only = onlyArg ? onlyArg.split(",").filter(Boolean) : null;
const wanted = (name) => !only || only.some((o) => name.includes(o));
const config = harness.readConfig(configPath);

const PROFILES = [
  { name: "mobile-390", width: 390, height: 844, dpr: 1 },
  { name: "desktop-1440", width: 1440, height: 900, dpr: 1, desktop: true },
];

// Beyond the audit's list: every other registered page, so a shared component
// cannot change on a page nobody looked at. Pages that need a token they do
// not get still render (an error or empty state), and that render counts.
const EXTRA_PUBLIC = [
  "/Blog",
  "/Sitemap",
  "/PublicBooking",
  "/PhoneVerification",
  "/PaymentSuccess",
  "/InvoicePaymentSuccess",
  "/SharedPhotos",
  "/ApproveQuote",
  "/NoSuchPageHere",
];
const EXTRA_APP = [
  "/UpgradeRequired",
  "/Checkout",
  "/CancelSubscription",
  "/TestCheckout",
  "/Team",
  "/Timesheet",
  "/AcceptCrewInvite",
];

// Interactions whose result is not on screen until a click. Each runs at both
// widths; `steps` can differ per profile because the controls do.
//   { click: selector } { tap: selector } { focus: selector } { press: key }
//   { waitFor: selector } { wait: ms }
//   { clickText: label }  the first VISIBLE button whose text is exactly
//                         `label`, clicked from the DOM -- for controls that
//                         exist twice (one per breakpoint) with no stable id.
//   { domClick: selector } element.click() on the first match, for clickable
//                         cards (a div with onClick) that are not buttons.
//   { domClickNth: selector, index } the same, on the index-th match.
//   { clickContains: text, last? } the first (or last) VISIBLE button whose
//                         text contains `text` -- sheet actions carry a title
//                         and a hint; `last` picks a sheet's copy over a
//                         matching label earlier on the page.
// A scenario's `mocks` (see _page-harness.cjs) stand in for data the account
// does not have. They are fixed values, so baseline and candidate see the
// same rows.
const SCENARIOS = [
  {
    // One menu, rendered from the sidebar on desktop and the top bar on phones.
    name: "account-menu",
    route: "/Dashboard",
    // Not the first haspopup button: the notification bell comes first in
    // both bars. The account trigger is the full-width sidebar row on
    // desktop and the round avatar on phones.
    //
    // The phone path opens it from the keyboard because a tap CANNOT: the
    // empty toast viewport (ui/toast.jsx, `fixed top-0 w-full z-[100] p-4`)
    // covers the top 32px of the mobile header, so elementFromPoint at the
    // avatar's centre is the viewport, and tap and click both land on it.
    // That is a live bug, not a test quirk -- reported, not fixed here.
    steps: (profile) =>
      profile.desktop
        ? [
            { click: "aside button.w-full[aria-haspopup='menu']" },
            { waitFor: "[role='menu'] [role='menuitem']" },
          ]
        : [
            { focus: ".mobile-header button.rounded-full[aria-haspopup='menu']" },
            { press: "Enter" },
            { waitFor: "[role='menu'] [role='menuitem']" },
          ],
  },
  // The calendar opens on its list; these three views only render after a
  // tab switch, so a page load never shows them.
  ...["Month", "Week", "Day"].map((label) => ({
    name: `calendar-${label.toLowerCase()}`,
    route: "/Calendar",
    steps: () => [{ clickText: label }, { wait: 400 }],
  })),
];

// ---- Fixture data for scenarios -----------------------------------------
// The owner account has no jobs, so the job screens only exist with these.
const FIXTURE_JOB_ID = "11111111-1111-4111-8111-111111111111";
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const FIXTURE_JOB = {
  id: FIXTURE_JOB_ID,
  user_id: config.session.user.id,
  job_title: "Kitchen remodel",
  client_id: null,
  client_name: "Dana Reyes",
  status: "in_progress",
  description: "Full strip and refit",
  location: "12 Elm St",
  estimated_hours: 8,
  actual_hours: 12,
  hourly_rate: 85,
  linked_quote_id: null,
  linked_invoice_id: null,
  created_at: "2026-09-01T15:00:00Z",
  created_date: "2026-09-01T15:00:00Z",
};
const FIXTURE_PHOTOS = [
  { id: "p1", job_id: FIXTURE_JOB_ID, user_id: config.session.user.id, category: "before",
    caption: "Old cabinets", photo_url: PIXEL, thumbnail_url: PIXEL, is_favorite: false,
    taken_date: "2026-09-02T15:00:00Z",
    created_at: "2026-09-02T15:00:00Z", created_date: "2026-09-02T15:00:00Z" },
  { id: "p2", job_id: FIXTURE_JOB_ID, user_id: config.session.user.id, category: "receipt",
    caption: "Lumber receipt", photo_url: PIXEL, thumbnail_url: PIXEL, is_favorite: true,
    taken_date: "2026-09-03T15:00:00Z",
    created_at: "2026-09-03T15:00:00Z", created_date: "2026-09-03T15:00:00Z" },
];
const JOB_MOCKS = [
  { match: /^Job\?/, body: [FIXTURE_JOB] },
  { match: /^JobPhoto\?/, body: FIXTURE_PHOTOS },
];
const openFixtureJob = { domClick: "div.group.cursor-pointer" };

SCENARIOS.push(
  {
    name: "job-detail",
    route: "/JobPhotos",
    mocks: JOB_MOCKS,
    steps: () => [openFixtureJob, { waitFor: "img[alt='Old cabinets']" }],
  },
  {
    name: "job-photo-upload",
    route: "/JobPhotos",
    mocks: JOB_MOCKS,
    steps: () => [
      openFixtureJob,
      { waitFor: "img[alt='Old cabinets']" },
      { clickText: "Upload Photos" },
      { waitFor: "[role='dialog']" },
    ],
  },
  {
    name: "job-photo-edit",
    route: "/JobPhotos",
    mocks: JOB_MOCKS,
    steps: () => [
      openFixtureJob,
      { waitFor: "img[alt='Old cabinets']" },
      { domClick: "div.cursor-pointer.transition-shadow" },
      { waitFor: "[role='dialog']" },
      { clickText: "Edit Details" },
    ],
  },
);

// What a client sees from a link, rendered from fixed payloads in the shape
// get-public-invoice / get-public-quote return. The token and id are made up:
// with the function mocked, no real link is opened and nothing is logged.
const FIXTURE_BUSINESS = {
  name: "Miller Construction",
  logo_url: "",
  address: "12 Bay Street, Halifax",
  phone: "902 555 0100",
  email: "sam@miller.example",
  website: "miller.example",
};
const FIXTURE_ITEMS = [
  { description: "Demolition and haul-away", quantity: 1, rate: 1200, amount: 1200 },
  { description: "Cabinet install", quantity: 8, rate: 85, amount: 680 },
];
SCENARIOS.push(
  {
    name: "public-invoice",
    route: "/i/fixture-token?preview=1",
    mocks: [{
      fn: "get-public-invoice",
      body: {
        success: true,
        invoice: {
          number: "INV-901", issue_date: "2026-09-01T15:00:00Z", due_date: "2026-09-30",
          status: "sent", payment_terms: "Net 30", notes: "Thanks for your business.",
          currency: "CAD", items: FIXTURE_ITEMS, subtotal: 1880, tax_rate: 15,
          tax_amount: 282, total: 2162, amount_paid: 500, balance_due: 1662,
        },
        client: { name: "Dana Reyes", address: "4 Elm Road, Halifax" },
        business: FIXTURE_BUSINESS,
        capabilities: { can_pay_online: true, can_download_pdf: true },
      },
    }],
    steps: () => [{ waitFor: "h1, h2" }],
  },
  {
    name: "public-quote",
    route: "/PublicQuote?id=fixture-id&preview=1",
    mocks: [{
      fn: "get-public-quote",
      body: {
        success: true,
        quote: {
          number: "QTE-501", issue_date: "2026-09-01T15:00:00Z", expiry_date: "2026-10-01",
          status: "sent", notes: "Valid for 30 days.", currency: "CAD", items: FIXTURE_ITEMS,
          subtotal: 1880, tax_rate: 15, tax_amount: 282, total: 2162,
        },
        client: { name: "Dana Reyes" },
        business: FIXTURE_BUSINESS,
        capabilities: { can_approve: true, can_decline: true, expired: false, can_download_pdf: true },
      },
    }],
    steps: () => [{ waitFor: "h1, h2" }],
  },
  // A link that no longer resolves: the full-page Notice, not the document.
  ...[
    ["public-invoice-unavailable", "/i/fixture-token?preview=1", "get-public-invoice"],
    ["public-quote-unavailable", "/PublicQuote?id=fixture-id&preview=1", "get-public-quote"],
  ].map(([name, route, fn]) => ({
    name,
    route,
    mocks: [{
      fn,
      body: { success: false, reason: "link_unavailable", error: "This link is no longer available." },
    }],
    steps: () => [{ waitFor: "h1" }],
  })),
);

// ---- The invoice list, from fixed rows ------------------------------------
// One row per status, in this order, so each scenario can name its row:
// row 1 is overdue (offers Send Reminder), row 2 a draft (the only status
// that may be deleted), row 5 void (a record: no delete).
const invoiceRow = (id, n, status, total, extra = {}) => ({
  id, user_id: config.session.user.id, invoice_number: `INV-09${n}`, status, total,
  subtotal: total, tax_amount: 0, client_name: ["Dana Reyes", "Sam Vega", "Ruth Okafor",
    "Paid Co", "Void Ltd"][n - 1], client_email: `client${n}@example.com`,
  due_date: "2026-09-20", created_date: `2026-09-0${n}T15:00:00Z`,
  created_at: `2026-09-0${n}T15:00:00Z`, items: [], ...extra,
});
const INVOICE_MOCKS = [
  { match: /^Invoice\?/, body: [
    invoiceRow("11111111-0000-4000-8000-000000000001", 1, "overdue", 1250, { due_date: "2026-08-20" }),
    invoiceRow("11111111-0000-4000-8000-000000000002", 2, "draft", 300),
    invoiceRow("11111111-0000-4000-8000-000000000003", 3, "sent", 480),
    invoiceRow("11111111-0000-4000-8000-000000000004", 4, "paid", 960, { paid_date: "2026-09-05" }),
    invoiceRow("11111111-0000-4000-8000-000000000005", 5, "void", 200, { voided_at: "2026-09-06T15:00:00Z" }),
  ] },
  { match: /^InvoicePayment\?/, body: [] },
];
const rowMenu = (n) => ({ click: `table tbody tr:nth-child(${n}) button[aria-haspopup='menu']` });
const mobileMore = (n) => ({ domClickNth: "button.h-9.w-9", index: n - 1 });

SCENARIOS.push(
  { name: "invoices-fixture", route: "/Invoices", mocks: INVOICE_MOCKS, steps: () => [{ waitFor: "table" }] },
  {
    name: "invoices-row-actions",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, rowMenu(1), { waitFor: "[role='menu']" }]
      : [{ waitFor: "button.h-9.w-9" }, mobileMore(1), { wait: 500 }],
  },
  {
    name: "invoices-delete",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, rowMenu(2), { waitFor: "[role='menu']" },
         { click: "[role='menuitem']::-p-text(Delete)" }, { waitFor: "[role='dialog']" }]
      : [{ waitFor: "button.h-9.w-9" }, mobileMore(2), { wait: 500 },
         { clickContains: "Delete" }, { waitFor: "[role='dialog']" }],
  },
  {
    name: "invoices-reminder",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, rowMenu(1), { waitFor: "[role='menu']" },
         { click: "[role='menuitem']::-p-text(Send Reminder)" }, { waitFor: "[role='dialog']" }]
      : [{ waitFor: "button.h-9.w-9" }, mobileMore(1), { wait: 500 },
         { clickContains: "Send Overdue Notice" }, { waitFor: "[role='dialog']" }],
  },
  {
    name: "invoices-status-sheet",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: () => [{ waitFor: "button.h-9.w-9" },
      { domClickNth: "button.rounded-full.text-xs.font-bold", index: 1 }, { wait: 500 }],
  },
  {
    // The header's Actions menu: Check Overdue / Export CSV (+ Batch on desktop).
    name: "invoices-header-actions",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, { click: "button[aria-haspopup='menu']::-p-text(Actions)" },
         { waitFor: "[role='menu']" }]
      : [{ waitFor: "button.h-9.w-9" }, { focus: "main .lg\\:hidden button[aria-haspopup='menu']" },
         { press: "Enter" }, { waitFor: "[role='menu']" }],
  },
  {
    // Setting a status to "paid" opens Record Payment instead of writing it.
    name: "invoices-record-payment",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" },
         { domClick: "table tbody tr:nth-child(3) button[type='button']:not([aria-haspopup])" },
         { waitFor: "[data-select-item-value='paid']" },
         { domClick: "[data-select-item-value='paid']" }, { waitFor: "[role='dialog']" }]
      : [{ waitFor: "button.h-9.w-9" },
         { domClickNth: "button.rounded-full.text-xs.font-bold", index: 2 }, { wait: 500 },
         { clickContains: "paid", last: true }, { waitFor: "[role='dialog']" }],
  },
  {
    name: "invoices-select-mode",
    route: "/Invoices",
    mocks: INVOICE_MOCKS,
    steps: () => [{ waitFor: "button.h-9.w-9" }, { clickText: "Select invoices" }, { wait: 400 }],
  },
);

// ---- The quote list, from fixed rows ---------------------------------------
// sent, draft, approved (row 3 -- the only one that offers Convert), declined,
// converted.
const quoteRow = (id, n, status, total) => ({
  id, user_id: config.session.user.id, quote_number: `QTE-50${n}`, status, total,
  subtotal: total, tax_amount: 0, client_name: ["Dana Reyes", "Sam Vega", "Ruth Okafor",
    "Lee Park", "Moss & Co"][n - 1], client_email: `client${n}@example.com`,
  expiry_date: "2026-10-01", date_issued: `2026-09-0${n}`,
  created_date: `2026-09-0${n}T15:00:00Z`,
  created_at: `2026-09-0${n}T15:00:00Z`, items: [],
});
const QUOTE_MOCKS = [
  { match: /^Quote\?/, body: [
    quoteRow("22222222-0000-4000-8000-000000000001", 1, "sent", 1250),
    quoteRow("22222222-0000-4000-8000-000000000002", 2, "draft", 300),
    quoteRow("22222222-0000-4000-8000-000000000003", 3, "approved", 4800),
    quoteRow("22222222-0000-4000-8000-000000000004", 4, "declined", 960),
    quoteRow("22222222-0000-4000-8000-000000000005", 5, "converted", 2200),
  ] },
];
SCENARIOS.push(
  { name: "quotes-fixture", route: "/Quotes", mocks: QUOTE_MOCKS, steps: () => [{ waitFor: "table" }] },
  {
    name: "quotes-row-actions",
    route: "/Quotes",
    mocks: QUOTE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" },
         { domClick: "table tbody tr:nth-child(1) button[type='button']:not([title])" },
         { waitFor: "[data-select-item-value]" }]
      : [{ waitFor: "button.h-9.w-9" }, { domClickNth: "button.h-9.w-9", index: 0 }, { wait: 500 }],
  },
  {
    name: "quotes-delete",
    route: "/Quotes",
    mocks: QUOTE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, { domClick: "table tbody tr:nth-child(2) button[title='Delete']" },
         { waitFor: "[role='dialog']" }]
      : [{ waitFor: "button.h-9.w-9" }, { domClickNth: "button.h-9.w-9", index: 1 }, { wait: 500 },
         { clickContains: "Delete Quote", last: true }, { waitFor: "[role='dialog']" }],
  },
  {
    name: "quotes-convert",
    route: "/Quotes",
    mocks: QUOTE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }]
      : [{ waitFor: "button.h-9.w-9" }, { clickText: "Convert" }, { waitFor: "[role='dialog']" }],
  },
  {
    name: "quotes-header-actions",
    route: "/Quotes",
    mocks: QUOTE_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, { click: "button[aria-haspopup='menu']::-p-text(Actions)" },
         { waitFor: "[role='menu']" }]
      : [{ waitFor: "button.h-9.w-9" }, { focus: "main .lg\\:hidden button[aria-haspopup='menu']" },
         { press: "Enter" }, { waitFor: "[role='menu']" }],
  },
);

// ---- Recurring invoices, from fixed rows ----------------------------------
const recurringRow = (id, n, status, frequency, extra = {}) => ({
  id, user_id: config.session.user.id, client_name: ["Dana Reyes", "Sam Vega", "Ruth Okafor"][n - 1],
  template_name: ["Monthly maintenance", "Weekly lawn care", "Quarterly HVAC"][n - 1],
  frequency, status, total: [450, 120, 900][n - 1], next_generation_date: `2026-10-0${n}`,
  end_type: "never", created_date: `2026-08-0${n}T15:00:00Z`, created_at: `2026-08-0${n}T15:00:00Z`,
  ...extra,
});
const RECURRING_MOCKS = [
  { match: /^RecurringInvoice\?/, body: [
    recurringRow("33333333-0000-4000-8000-000000000001", 1, "active", "monthly"),
    recurringRow("33333333-0000-4000-8000-000000000002", 2, "paused", "weekly"),
    recurringRow("33333333-0000-4000-8000-000000000003", 3, "active", "quarterly",
      { end_type: "after", occurrences: 4 }),
  ] },
];
SCENARIOS.push(
  { name: "recurring-fixture", route: "/RecurringInvoices", mocks: RECURRING_MOCKS,
    steps: () => [{ waitFor: "button.h-9.w-9" }] },
  {
    name: "recurring-actions",
    route: "/RecurringInvoices",
    mocks: RECURRING_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }]
      : [{ waitFor: "button.h-9.w-9:has(svg.lucide-ellipsis-vertical)" }, { domClickNth: "button.h-9.w-9:has(svg.lucide-ellipsis-vertical)", index: 0 }, { wait: 500 }],
  },
  {
    name: "recurring-delete",
    route: "/RecurringInvoices",
    mocks: RECURRING_MOCKS,
    steps: (p) => p.desktop
      ? [{ waitFor: "table" }, { domClick: "table tbody tr:nth-child(1) button:has(svg.lucide-trash2)" },
         { waitFor: "[role='dialog']" }]
      : [{ waitFor: "button.h-9.w-9:has(svg.lucide-ellipsis-vertical)" }, { domClickNth: "button.h-9.w-9:has(svg.lucide-ellipsis-vertical)", index: 0 }, { wait: 500 },
         { clickContains: "Delete", last: true }, { waitFor: "[role='dialog']" }],
  },
);

// ---- Invoice and quote detail, from fixed documents -------------------------
// Resend is clicked in two scenarios to reach the result dialog. It is safe
// because the guard aborts sendInvoiceEmail / sendInvoiceSMS /
// sendQuoteEmail / sendQuoteSMS / createInvoicePaymentLink before they leave
// the browser -- and the fixture client's address is @example.com regardless.
const DETAIL_CLIENT = {
  id: "66666666-0000-4000-8000-000000000001", user_id: config.session.user.id,
  name: "Dana Reyes", email: "dana@example.com", phone: "902 555 0101",
  address: "4 Elm Road, Halifax", created_date: "2026-08-01T15:00:00Z",
};
const DETAIL_ITEMS = [
  { description: "Demolition and haul-away", quantity: 1, rate: 1200, amount: 1200 },
  { description: "Cabinet install", quantity: 8, rate: 85, amount: 680 },
];
const DETAIL_INVOICE = {
  id: "44444444-0000-4000-8000-000000000001", user_id: config.session.user.id,
  invoice_number: "INV-0950", status: "sent", client_id: DETAIL_CLIENT.id,
  client_name: DETAIL_CLIENT.name, client_email: DETAIL_CLIENT.email,
  client_phone: DETAIL_CLIENT.phone, client_address: DETAIL_CLIENT.address,
  items: DETAIL_ITEMS, subtotal: 1880, tax_rate: 15, tax_amount: 282, total: 2162,
  due_date: "2026-09-30", payment_terms: "Net 30", notes: "Thanks for the work.",
  created_date: "2026-09-01T15:00:00Z", created_at: "2026-09-01T15:00:00Z",
};
const DETAIL_QUOTE = {
  id: "55555555-0000-4000-8000-000000000001", user_id: config.session.user.id,
  quote_number: "QTE-0950", status: "sent", client_id: DETAIL_CLIENT.id,
  client_name: DETAIL_CLIENT.name, client_email: DETAIL_CLIENT.email,
  client_phone: DETAIL_CLIENT.phone, items: DETAIL_ITEMS, subtotal: 1880,
  tax_rate: 15, tax_amount: 282, total: 2162, expiry_date: "2026-10-01",
  date_issued: "2026-09-01", notes: "Valid for 30 days.",
  created_date: "2026-09-01T15:00:00Z", created_at: "2026-09-01T15:00:00Z",
};
const INVOICE_DETAIL_MOCKS = [
  { match: /^Invoice\?/, body: [DETAIL_INVOICE] },
  { match: /^Client\?/, body: [DETAIL_CLIENT] },
  { match: /^InvoicePayment\?/, body: [] },
  { match: /^InvoiceEvent\?/, body: [] },
];
const QUOTE_DETAIL_MOCKS = [
  { match: /^Quote\?/, body: [DETAIL_QUOTE] },
  { match: /^Client\?/, body: [DETAIL_CLIENT] },
];
const invRoute = `/InvoiceDetail?id=${DETAIL_INVOICE.id}`;
const quoteRoute = `/QuoteDetail?id=${DETAIL_QUOTE.id}`;
const desktopBar = "div.hidden.sm\\:flex";
const mobileBar = "div.fixed.bottom-0";
SCENARIOS.push(
  { name: "invoice-detail-fixture", route: invRoute, mocks: INVOICE_DETAIL_MOCKS,
    steps: () => [{ waitFor: "text/INV-0950" }] },
  { name: "invoice-detail-payment", route: invRoute, mocks: INVOICE_DETAIL_MOCKS,
    steps: (p) => [{ waitFor: "text/INV-0950" }, { clickText: p.desktop ? "Record payment" : "Payment" },
      { waitFor: "[role='dialog']" }] },
  { name: "invoice-detail-void", route: invRoute, mocks: INVOICE_DETAIL_MOCKS,
    steps: (p) => [{ waitFor: "text/INV-0950" },
      { domClick: `${p.desktop ? desktopBar : mobileBar} button:has(svg.lucide-ban)` },
      { waitFor: "[role='dialog']" }] },
  { name: "invoice-detail-delete", route: invRoute, mocks: INVOICE_DETAIL_MOCKS,
    steps: (p) => [{ waitFor: "text/INV-0950" },
      { domClick: `${p.desktop ? desktopBar : mobileBar} button:has(svg.lucide-trash2)` },
      { waitFor: "[role='dialog']" }] },
  { name: "invoice-detail-resend-result", route: invRoute, mocks: INVOICE_DETAIL_MOCKS,
    steps: () => [{ waitFor: "text/INV-0950" }, { clickContains: "Resend" }, { wait: 2500 }] },
  { name: "quote-detail-fixture", route: quoteRoute, mocks: QUOTE_DETAIL_MOCKS,
    steps: () => [{ waitFor: "text/QTE-0950" }] },
  { name: "quote-detail-delete", route: quoteRoute, mocks: QUOTE_DETAIL_MOCKS,
    steps: () => [{ waitFor: "text/QTE-0950" }, { domClick: "button:has(svg.lucide-trash2)" },
      { waitFor: "[role='dialog']" }] },
  { name: "quote-detail-resend-result", route: quoteRoute, mocks: QUOTE_DETAIL_MOCKS,
    steps: () => [{ waitFor: "text/QTE-0950" }, { clickContains: "Resend" }, { wait: 2500 }] },
);

// The quote in each state its status cards and response line distinguish:
// approved by the client (a name), marked approved by hand (no name, no
// date), declined with a reason, and converted to an invoice.
const quoteIn = (name, patch) => ({
  name: `quote-detail-${name}`, route: quoteRoute,
  mocks: [{ match: /^Quote\?/, body: [{ ...DETAIL_QUOTE, ...patch }] }, QUOTE_DETAIL_MOCKS[1]],
  steps: () => [{ waitFor: "text/QTE-0950" }],
});
SCENARIOS.push(
  quoteIn("approved", { status: "approved", approved_by_name: "Dana Reyes",
    approved_at: "2026-09-04T18:30:00Z", job_id: "77777777-0000-4000-8000-000000000001" }),
  quoteIn("approved-manual", { status: "approved" }),
  quoteIn("declined", { status: "declined", declined_at: "2026-09-05T14:00:00Z",
    decline_reason: "Went with a cheaper quote.\nMaybe next year." }),
  quoteIn("converted", { status: "converted",
    linked_invoice_id: "44444444-0000-4000-8000-000000000001" }),
);

// ---- Settings, one scenario per tab, from a fixed settings row ---------------
// Every tab opens straight from ?tab=. The Stripe states are driven by the
// row alone: stripe_account_id stays null outside "active", so the on-load
// status check (a toast on a timer) never fires and cannot race a capture.
const SETTINGS_ROW = {
  id: "88888888-0000-4000-8000-000000000001", user_id: config.session.user.id,
  business_name: "Reyes Renovations", email: "office@example.com", phone: "902 555 0199",
  address: "12 Harbour St, Halifax", website: "https://example.com", logo_url: null,
  tax_rate: 15, hourly_rate: 75, invoice_template: "professional", invoice_prefix: "INV",
  payment_terms: "Net 30", review_link: "https://g.page/r/example",
  allow_client_quote_approval: true, stripe_account_id: "acct_fixture",
  stripe_account_status: "active", created_date: "2026-08-01T15:00:00Z",
};
const SUBSCRIPTION_ROW = {
  id: "99999999-0000-4000-8000-000000000001", user_id: config.session.user.id,
  plan_name: "professional", billing_cycle: "monthly", status: "active",
  transactions_used_this_month: 12, next_billing_date: "2026-10-01T15:00:00Z",
  stripe_customer_id: "cus_fixture",
};
const settingsIn = (name, tab, { row = {}, subscription = [SUBSCRIPTION_ROW], waitFor, steps = () => [] } = {}) => ({
  name: `settings-${name}`, route: `/Settings?tab=${tab}`,
  mocks: [
    { match: /^BusinessSettings\?/, body: [{ ...SETTINGS_ROW, ...row }] },
    { match: /^Subscription\?/, body: subscription },
  ],
  steps: (p) => [{ waitFor: `text/${waitFor}` }, ...steps(p)],
});
SCENARIOS.push(
  settingsIn("business", "business", { waitFor: "Business Information" }),
  settingsIn("security", "security", { waitFor: "Signed in as" }),
  settingsIn("security-password", "security", { waitFor: "Signed in as",
    steps: () => [{ clickText: "Change password" }, { waitFor: "#new-password" }] }),
  settingsIn("billing", "billing", { waitFor: "Recent Billing History" }),
  settingsIn("billing-none", "billing", { subscription: [], waitFor: "No Active Subscription" }),
  settingsIn("payments-active", "payments", { waitFor: "Stripe Account" }),
  settingsIn("payments-pending", "payments", { waitFor: "Stripe Account",
    row: { stripe_account_id: null, stripe_account_status: "pending" } }),
  settingsIn("payments-none", "payments", { waitFor: "Stripe Account",
    row: { stripe_account_id: null, stripe_account_status: null } }),
  settingsIn("appearance", "appearance", { waitFor: "Theme Preference" }),
  settingsIn("notifications", "notifications", { waitFor: "Settings", steps: () => [{ wait: 1500 }] }),
  settingsIn("calendar", "calendar", { waitFor: "Settings", steps: () => [{ wait: 1500 }] }),
  settingsIn("template", "template", { waitFor: "Settings", steps: () => [{ wait: 1500 }] }),
  settingsIn("legal", "legal", { waitFor: "Delete Account" }),
  settingsIn("contact", "contact", { waitFor: "Need Help?" }),
  settingsIn("reset-dialog", "business", { waitFor: "Business Information",
    steps: (p) => (p.desktop ? [{ clickText: "Reset to Defaults" }, { waitFor: "[role='dialog']" }] : []) }),
);

// ---- CreateInvoice, from fixed clients, settings, templates and plan ---------
// Nothing here can send: the buttons that would are never pressed, and the
// guard blocks every write regardless. The draft the page autosaves is cleared
// before each load so scenarios cannot inherit one another's form.
const CREATE_TEMPLATE = {
  id: "aaaaaaaa-0000-4000-8000-000000000001", user_id: config.session.user.id,
  template_name: "Kitchen refit", items: DETAIL_ITEMS, notes: "Includes haul-away.",
  tax_rate: 15, created_date: "2026-08-15T15:00:00Z",
};
const JOB_EXPENSES = [
  { id: "e1", job_id: "77777777-0000-4000-8000-000000000001", description: "Tile adhesive",
    vendor: "Kent", amount: 64.5, quantity: 3, include_in_invoice: true },
  { id: "e2", job_id: "77777777-0000-4000-8000-000000000001", description: "Skip rental",
    amount: 240, billable_amount: 276, include_in_invoice: true },
  { id: "e3", job_id: "77777777-0000-4000-8000-000000000001", description: "Coffee",
    amount: 12, include_in_invoice: false },
];
const createInvoice = (name, { query = "", subscription = SUBSCRIPTION_ROW, extra = [], steps = () => [] } = {}) => ({
  name: `create-invoice-${name}`, route: `/CreateInvoice${query}`,
  clearStorage: ["invoicium_invoice_draft"],
  mocks: [
    ...extra,
    { match: /^Client\?/, body: [DETAIL_CLIENT, { ...DETAIL_CLIENT, id: "66666666-0000-4000-8000-000000000002",
      name: "Morgan Lee", email: null, phone: "902 555 0102" }] },
    { match: /^BusinessSettings\?/, body: [SETTINGS_ROW] },
    { match: /^InvoiceTemplate\?/, body: [CREATE_TEMPLATE] },
    { match: /^Subscription\?/, body: [subscription] },
    { match: /^UserSpecialty\?/, body: [{ id: "s1", primary_specialty: "general_contractor" }] },
    { match: /^Invoice\?/, body: [DETAIL_INVOICE] },
    { match: /^JobExpense\?/, body: JOB_EXPENSES },
  ],
  steps: (p) => [{ waitFor: "text/Job Details" }, ...steps(p)],
});
// The client picker is the app's own Select (src/components/ui/select.jsx),
// not Radix: a plain button, and options marked with data-select-item-value.
const pickFirstClient = [{ domClick: "form div.relative > button:has(svg.lucide-chevron-down)" },
  { waitFor: "[data-select-item-value]" }, { domClick: "[data-select-item-value]" }, { wait: 800 }];
SCENARIOS.push(
  createInvoice("fixture"),
  createInvoice("client", { steps: () => pickFirstClient }),
  createInvoice("recurring", { steps: () => [{ domClick: "label input[type='checkbox'].sr-only" }, { wait: 400 }] }),
  createInvoice("job-expenses", { query: "?jobId=77777777-0000-4000-8000-000000000001" }),
  createInvoice("edit", { query: `?edit=${DETAIL_INVOICE.id}`, steps: () => [{ wait: 800 }] }),
  createInvoice("limit", { subscription: { ...SUBSCRIPTION_ROW, transactions_used_this_month: 999 },
    steps: () => [...pickFirstClient, { clickContains: "Save & Download" }, { waitFor: "[role='dialog']" }] }),
  createInvoice("template-edit", { steps: () => [{ click: "button[aria-haspopup='menu']:has(svg.lucide-ellipsis-vertical)" },
    { waitFor: "[role='menuitem']" }, { click: "[role='menuitem']" }, { waitFor: "[role='dialog']" }] }),
  createInvoice("save-template", { steps: () => [{ clickContains: "Save" }, { waitFor: "[role='dialog']" }] }),
);

// ---- CreateQuote, from the same fixtures ------------------------------------
const createQuote = (name, { query = "", steps = () => [] } = {}) => ({
  name: `create-quote-${name}`, route: `/CreateQuote${query}`,
  mocks: [
    { match: /^Client\?/, body: [DETAIL_CLIENT, { ...DETAIL_CLIENT, id: "66666666-0000-4000-8000-000000000002",
      name: "Morgan Lee", email: null, phone: "902 555 0102" }] },
    { match: /^BusinessSettings\?/, body: [SETTINGS_ROW] },
    { match: /^Subscription\?/, body: [SUBSCRIPTION_ROW] },
    { match: /^UserSpecialty\?/, body: [{ id: "s1", primary_specialty: "general_contractor" }] },
    { match: /^Quote\?/, body: [DETAIL_QUOTE] },
  ],
  steps: (p) => [{ waitFor: "text/Line Items" }, ...steps(p)],
});
SCENARIOS.push(
  createQuote("fixture"),
  createQuote("client", { steps: () => pickFirstClient }),
  createQuote("edit", { query: `?edit=${DETAIL_QUOTE.id}`, steps: () => [{ wait: 800 }] }),
);

// 15:00 UTC on a fixed weekday: an afternoon greeting, and far enough from
// midnight that no timezone flips the date.
const FROZEN_NOW = Date.parse("2026-09-09T15:00:00Z");

async function freezeTimeAndRandom(page) {
  await page.evaluateOnNewDocument((now) => {
    const RealDate = Date;
    function FrozenDate(...args) {
      if (!new.target) return new RealDate(now).toString();
      return args.length ? new RealDate(...args) : new RealDate(now);
    }
    FrozenDate.prototype = RealDate.prototype;
    FrozenDate.now = () => now;
    FrozenDate.parse = RealDate.parse;
    FrozenDate.UTC = RealDate.UTC;
    window.Date = FrozenDate;

    try {
      localStorage.setItem("notification_prompted", "true");
    } catch {
      /* opaque origin before the first navigation */
    }

    let seed = 0x2f6b1a3d; // mulberry32
    Math.random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, FROZEN_NOW);
}

/** The whole body as indented text. Runs in the page. */
function serialize() {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME"]);
  const reactId = /(radix-)?:r[0-9a-z]+:/g;
  const clean = (v) => {
    let s = String(v).replace(reactId, ":r:").replace(location.origin, "");
    return s.length > 200 ? `${s.slice(0, 80)}…[${s.length}]` : s;
  };
  const out = [];
  const walk = (node, depth) => {
    const pad = "  ".repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (t) out.push(`${pad}"${clean(t)}"`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName)) return;
    const attrs = [...node.attributes]
      .map((a) => {
        const value =
          a.name === "style"
            ? a.value.replace(/transform:[^;]*/g, (t) => t.replace(/-?\d+(\.\d+)?/g, "#"))
            : a.value;
        return `${a.name}="${clean(value)}"`;
      })
      .sort();
    // Live state that is a property, not an attribute.
    if ("value" in node && /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)) {
      attrs.push(`.value="${clean(node.value)}"`);
    }
    if (node.tagName === "INPUT" && /^(checkbox|radio)$/.test(node.type)) {
      attrs.push(`.checked=${node.checked}`);
    }
    out.push(`${pad}<${node.tagName.toLowerCase()}${attrs.length ? " " + attrs.join(" ") : ""}>`);
    for (const child of node.childNodes) walk(child, depth + 1);
  };
  walk(document.body, 0);
  return {
    url: location.pathname + location.search,
    title: document.title,
    dom: out.join("\n"),
  };
}

const slug = (route) =>
  route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60) || "home";

async function runSteps(page, steps) {
  for (const step of steps) {
    if (step.click) await page.click(step.click);
    else if (step.tap) await page.tap(step.tap);
    else if (step.focus) await page.focus(step.focus);
    else if (step.domClickNth) {
      const hit = await page.evaluate(
        (sel, i) => {
          const el = document.querySelectorAll(sel)[i];
          if (el) el.click();
          return Boolean(el);
        },
        step.domClickNth,
        step.index,
      );
      if (!hit) throw new Error(`no match #${step.index} for ${step.domClickNth}`);
    } else if (step.clickContains) {
      const hit = await page.evaluate((text, last) => {
        const matches = [...document.querySelectorAll("button")].filter((b) => {
          const r = b.getBoundingClientRect();
          return b.textContent.includes(text) && r.width > 0 && r.height > 0;
        });
        const button = last ? matches[matches.length - 1] : matches[0];
        if (button) button.click();
        return Boolean(button);
      }, step.clickContains, Boolean(step.last));
      if (!hit) throw new Error(`no visible button containing "${step.clickContains}"`);
    } else if (step.domClick) {
      const hit = await page.$eval(step.domClick, (el) => (el.click(), true)).catch(() => false);
      if (!hit) throw new Error(`nothing matches ${step.domClick}`);
    }
    else if (step.clickText) {
      const hit = await page.evaluate((label) => {
        const button = [...document.querySelectorAll("button")].find((b) => {
          const r = b.getBoundingClientRect();
          return b.textContent.trim() === label && r.width > 0 && r.height > 0;
        });
        if (button) button.click();
        return Boolean(button);
      }, step.clickText);
      if (!hit) throw new Error(`no visible button labelled "${step.clickText}"`);
    }
    else if (step.waitFor) await page.waitForSelector(step.waitFor, { timeout: 10000 });
    else if (step.press) await page.keyboard.press(step.press);
    else if (step.wait) await new Promise((r) => setTimeout(r, step.wait));
  }
  // Let an opening animation finish before reading the result.
  await new Promise((r) => setTimeout(r, 600));
}

async function snapshotRoute(context, profile, route, scenario) {
  const consoleErrors = [];
  const { page, errors } = await harness.openPage(
    context,
    origin,
    profile,
    route,
    async (p) => {
      await freezeTimeAndRandom(p);
      if (scenario?.clearStorage) {
        await p.evaluateOnNewDocument((keys) => keys.forEach((k) => localStorage.removeItem(k)), scenario.clearStorage);
      }
      p.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().replace(/\s+/g, " ").slice(0, 200));
      });
    },
    scenario?.mocks,
  );
  let stepError = null;
  if (scenario) {
    await runSteps(page, scenario.steps(profile)).catch((e) => {
      stepError = e.message.slice(0, 160);
    });
  }
  const snap = await page.evaluate(serialize).catch((e) => ({ url: "?", title: "?", dom: `EVAL FAILED: ${e.message}` }));
  await page.close();

  // Blocked requests surface as "Failed to load resource" console errors on
  // every run alike; they are the guard working, not the page changing.
  const realConsole = consoleErrors.filter((t) => !/net::ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(t));
  const name = scenario ? `scenario-${scenario.name}` : slug(route);
  const file = path.join(outDir, profile.name, `${name}.txt`);
  fs.writeFileSync(
    file,
    [
      `route: ${route}`,
      ...(stepError ? [`STEP FAILED: ${stepError}`] : []),
      `landed: ${snap.url}`,
      `title: ${snap.title}`,
      ...errors.map((e) => `pageerror: ${e}`),
      ...realConsole.map((e) => `console.error: ${e}`),
      "",
      snap.dom,
      "",
    ].join("\n"),
  );
  return {
    route: scenario ? `scenario:${scenario.name}` : route,
    lines: snap.dom.split("\n").length,
    errors: errors.length + realConsole.length + (stepError ? 1 : 0),
  };
}

async function main() {
  const browser = await harness.launch();
  for (const profile of PROFILES) {
    fs.mkdirSync(path.join(outDir, profile.name), { recursive: true });
    const done = [];

    const anon = await browser.createBrowserContext();
    for (const r of [...harness.publicRoutes(config), ...EXTRA_PUBLIC].filter(wanted)) {
      done.push(await snapshotRoute(anon, profile, r));
    }
    await anon.close();

    const authed = await harness.signedInContext(browser, origin, config.session);
    for (const r of [...harness.appRoutes(config), ...EXTRA_APP].filter(wanted)) {
      done.push(await snapshotRoute(authed, profile, r));
    }
    for (const s of SCENARIOS.filter((s) => wanted(`scenario:${s.name}`) || wanted(s.route))) {
      done.push(await snapshotRoute(authed, profile, s.route, s));
    }
    await authed.close();

    const withErrors = done.filter((d) => d.errors);
    console.log(
      `${profile.name}: ${done.length} pages, ${done.reduce((n, d) => n + d.lines, 0)} DOM lines` +
        (withErrors.length ? `, errors on: ${withErrors.map((d) => d.route).join(", ")}` : ""),
    );
  }
  harness.printBlocked(config);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
