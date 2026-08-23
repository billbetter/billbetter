// InvoiceDemoMockup — the hero device mockup on the marketing homepage.
//
// Built from a Next.js + TypeScript spec, adapted to this codebase:
//  - JSX with JSDoc typedefs rather than .tsx. eslint.config.js only matches
//    {js,mjs,cjs,jsx} under src/components, so a .tsx file would ship entirely
//    unlinted -- no no-undef, no unused-imports. jsconfig.json sets
//    checkJs: true, so the typedefs below are still checked by `npm run
//    typecheck`; the props are typed, just not in TS syntax.
//  - No "use client": this is a Vite SPA, not the Next.js App Router, so the
//    directive is meaningless here.
//
// The invoice is a depiction of a printed document, so its palette is literal
// rather than drawn from the app's semantic tokens -- it should look like paper
// regardless of the surrounding theme. The one exception is that nothing here
// reads from the real invoice templates; this is marketing art, not a preview.

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Receipt } from "lucide-react";

/**
 * @typedef {Object} InvoiceLineItem
 * @property {string}  name        Bold first line, e.g. "Central AC Unit Installation"
 * @property {string} [subtitle]   Optional grey second line, e.g. "3.5 ton, 16 SEER"
 * @property {number}  amount      Line total in dollars
 */

/**
 * @typedef {Object} InvoiceClient
 * @property {string}  name
 * @property {string} [email]
 * @property {string} [phone]
 */

/**
 * @typedef {Object} InvoiceMeta
 * @property {string}  number      e.g. "INV-458821"
 * @property {Date|string} [dateIssued]  defaults to today
 * @property {Date|string} [dueDate]     defaults to 30 days out
 */

/**
 * @typedef {Object} InvoiceBusiness
 * @property {string}  name
 * @property {string} [email]
 */

/**
 * @typedef {Object} InvoiceDemoMockupProps
 * @property {InvoiceBusiness}   [business]
 * @property {InvoiceClient}     [client]
 * @property {InvoiceMeta}       [invoice]
 * @property {InvoiceLineItem[]} [lineItems]
 * @property {number}            [taxRate]      fraction, e.g. 0.13
 * @property {string}            [taxLabel]
 * @property {string}            [paymentMethods]
 * @property {string}            [notesTitle]
 * @property {string}            [notes]
 * @property {boolean}           [showBackdrop] render the blue gradient panel
 * @property {string}            [className]
 */

const DEFAULT_BUSINESS = { name: "Invoicium", email: "billing@invoicium.ca" };

const DEFAULT_CLIENT = {
  name: "Marlowe & Sons HVAC Client",
  email: "accounts@marloweandsons.ca",
  phone: "(604) 555-0142",
};

/** @type {InvoiceLineItem[]} */
const DEFAULT_LINE_ITEMS = [
  { name: "High-Efficiency Furnace Install", subtitle: "96% AFUE, variable speed", amount: 4200 },
  { name: "Central AC Unit Installation", subtitle: "3.5 ton, 16 SEER", amount: 3800 },
  { name: "Ductwork Redesign & Install", amount: 1650 },
  { name: "Electrical Panel Upgrade", subtitle: "100A → 200A", amount: 2400 },
  { name: "Smart Thermostat Install", amount: 350 },
  { name: "Labor", subtitle: "28 hrs @ $95", amount: 2660 },
];

const BADGE_GREEN = "#14b866";

const currency = (n) =>
  `$${Number(n || 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * @param {InvoiceDemoMockupProps} props
 */
export default function InvoiceDemoMockup({
  business = DEFAULT_BUSINESS,
  client = DEFAULT_CLIENT,
  invoice,
  lineItems = DEFAULT_LINE_ITEMS,
  taxRate = 0.13,
  taxLabel,
  paymentMethods = "E-transfer, Visa, Mastercard, ACH",
  notesTitle = "Notes / Terms",
  notes = "Payment due within 30 days. Parts and labour carry a 2-year warranty.",
  showBackdrop = true,
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  // Totals are derived from the line items rather than passed in, so the
  // mockup can never display arithmetic that does not add up.
  const { subtotal, tax, total } = useMemo(() => {
    const items = Array.isArray(lineItems) ? lineItems : [];
    const sub = items.reduce((sum, li) => sum + Number(li?.amount || 0), 0);
    const t = sub * Number(taxRate || 0);
    return { subtotal: sub, tax: t, total: sub + t };
  }, [lineItems, taxRate]);

  // Dates default relative to mount. Computed once so a re-render cannot make
  // the issued date drift while someone is looking at it.
  const meta = useMemo(() => {
    const today = new Date();
    return {
      number: invoice?.number ?? "INV-458821",
      dateIssued: invoice?.dateIssued ?? today,
      dueDate: invoice?.dueDate ?? addDays(today, 30),
    };
  }, [invoice?.number, invoice?.dateIssued, invoice?.dueDate]);

  const resolvedTaxLabel = taxLabel ?? `Tax (HST ${Math.round(taxRate * 100)}%)`;

  return (
    <div className={`relative mx-auto flex w-full max-w-[590px] justify-center ${className}`}>
      {showBackdrop ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-6 bottom-6 rounded-[48px] bg-gradient-to-b from-sky-100 via-sky-50 to-transparent"
        />
      ) : null}

      {/* Sized in vw below 300px so the frame and its overhanging badge stay on
          screen on a narrow phone, instead of being scaled and leaving a gap. */}
      <div className="relative w-[min(300px,calc(100vw-4.5rem))]">
        {/* ── Payment received badge, overlapping the frame ─────────────── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -right-4 -top-5 z-20 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-white shadow-[0_18px_35px_-10px_rgba(20,184,102,0.55)] sm:-right-7"
          style={{ backgroundColor: BADGE_GREEN }}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-black leading-none">
            $
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-semibold text-white/85">
              Payment Received
            </span>
            <span className="block text-lg font-black tracking-tight">
              {currency(total)}
            </span>
          </span>
        </motion.div>

        {/* ── Device frame ──────────────────────────────────────────────── */}
        {/* 9/19.5 is the real proportion of every iPhone since the X (393x852
            on a 14 Pro). Letting the content set the height instead drifted to
            roughly 21:9, which reads as a stretched phone rather than a phone. */}
        <div className="relative aspect-[9/19.5] rounded-[44px] bg-black p-[10px] shadow-2xl shadow-black/30">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-white">
            {/* Dynamic island */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-2 z-10 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-black"
            />

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-8 text-[11px] text-neutral-900">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-black tracking-tight">{business.name}</p>
                  {business.email ? (
                    <p className="mt-0.5 text-[9px] text-neutral-500">{business.email}</p>
                  ) : null}
                </div>
                <Receipt className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />
              </div>

              {/* Bill to */}
              <div className="mt-3 rounded-xl bg-neutral-100 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">
                  Bill To
                </p>
                <p className="mt-1 text-[11px] font-bold leading-tight">{client.name}</p>
                {client.email ? (
                  <p className="text-[9px] text-neutral-500">{client.email}</p>
                ) : null}
                {client.phone ? (
                  <p className="text-[9px] text-neutral-500">{client.phone}</p>
                ) : null}
              </div>

              {/* Meta row */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: "Invoice #", value: meta.number },
                  { label: "Date Issued", value: formatDate(meta.dateIssued) },
                  { label: "Due Date", value: formatDate(meta.dueDate) },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-lg bg-neutral-100 px-2 py-1.5">
                    <p className="text-[7px] font-bold uppercase tracking-wider text-neutral-500">
                      {cell.label}
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold leading-tight">{cell.value}</p>
                  </div>
                ))}
              </div>

              {/* Services */}
              <p className="mt-2 text-[8px] font-bold uppercase tracking-wider text-neutral-500">
                Description of Services
              </p>
              <ul className="mt-1.5 min-h-0 flex-1 divide-y divide-neutral-200 overflow-hidden border-t border-neutral-200">
                {(Array.isArray(lineItems) ? lineItems : []).map((li, i) => (
                  <li key={`${li.name}-${i}`} className="flex items-start justify-between gap-3 py-1">
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold leading-tight">{li.name}</span>
                      {li.subtitle ? (
                        <span className="block text-[8px] text-neutral-500">{li.subtitle}</span>
                      ) : null}
                    </span>
                    <span className="flex-shrink-0 text-[10px] font-semibold tabular-nums">
                      {currency(li.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>{resolvedTaxLabel}</span>
                  <span className="tabular-nums">{currency(tax)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-300 pt-1.5">
                  <span className="text-[11px] font-black">Total Due</span>
                  <span
                    className="text-[13px] font-black tabular-nums"
                    style={{ color: BADGE_GREEN }}
                  >
                    {currency(total)}
                  </span>
                </div>
              </div>

              {/* Payment information */}
              <div className="mt-2 rounded-xl bg-neutral-100 px-3 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">
                  Payment Information
                </p>
                <p className="mt-0.5 text-[8px] leading-relaxed text-neutral-500">
                  Accepted: {paymentMethods}
                  <br />
                  Reference invoice {meta.number} with your payment.
                </p>
              </div>

              {/* Notes / terms */}
              <div className="mt-2 rounded-xl bg-amber-50 px-3 py-1.5">
                <p className="text-[8px] font-bold text-amber-900">{notesTitle}</p>
                <p className="mt-0.5 text-[8px] leading-relaxed text-amber-800">{notes}</p>
              </div>

              {/* mt-auto pins the footer to the bottom of the fixed-ratio
                  screen, so any slack collects here rather than leaving the
                  invoice floating in the middle. */}
              <p className="mt-auto pt-2 text-center text-[7px] text-neutral-400">
                Powered by {business.name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
