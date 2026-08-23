"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Receipt } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface InvoiceLineItem {
  /** Stable key for the row. Falls back to the index when omitted. */
  id?: string;
  /** Bold service name, e.g. "High-Efficiency Furnace Install". */
  name: string;
  /** Optional muted second line, e.g. "96% AFUE, variable speed". */
  subtitle?: string;
  /** Amount in major currency units (dollars, not cents). */
  amount: number;
}

export interface InvoiceClientInfo {
  name: string;
  email: string;
  phone: string;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export interface InvoiceDemoMockupProps {
  /** Brand block at the top of the invoice screen. */
  brandName?: string;
  brandEmail?: string;
  /** "BILL TO" block. */
  client?: InvoiceClientInfo;
  /** Meta row. Dates accept a Date (formatted for you) or a pre-formatted string. */
  invoiceNumber?: string;
  dateIssued?: Date | string;
  dueDate?: Date | string;
  /** Line items — subtotal / tax / total are derived from these. */
  lineItems?: InvoiceLineItem[];
  /** Decimal tax rate, e.g. 0.13 for 13%. */
  taxRate?: number;
  /** Overrides the auto-generated "Tax (HST 13%)" label. */
  taxLabel?: string;
  currency?: string;
  locale?: string;
  /** Payment information block. */
  paymentMethods?: string[];
  paymentReference?: string;
  /** Notes / terms block. */
  notesTitle?: string;
  notesBody?: string;
  footerText?: string;
  /** Floating notification badge. */
  showBadge?: boolean;
  badgeLabel?: string;
  /** Defaults to the computed total due. */
  badgeAmount?: number;
  /** Called with the derived totals — handy for wiring real data in later. */
  onTotalsComputed?: (totals: InvoiceTotals) => void;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_LINE_ITEMS: InvoiceLineItem[] = [
  { id: "furnace", name: "High-Efficiency Furnace Install", subtitle: "96% AFUE, variable speed", amount: 4200 },
  { id: "ac", name: "Central AC Unit Installation", subtitle: "3.5 ton, 16 SEER", amount: 3800 },
  { id: "ductwork", name: "Ductwork Redesign & Install", amount: 1650 },
  { id: "panel", name: "Electrical Panel Upgrade", subtitle: "100A → 200A", amount: 2400 },
  { id: "thermostat", name: "Smart Thermostat Install", amount: 350 },
  { id: "labor", name: "Labor (28 hrs @ $95)", amount: 2660 },
];

const DEFAULT_CLIENT: InvoiceClientInfo = {
  name: "Marlowe & Sons HVAC Client",
  email: "accounts@marloweandsons.ca",
  phone: "(416) 555-0148",
};

const DEFAULT_PAYMENT_METHODS = ["Credit card", "e-Transfer", "ACH"];

/** Natural design size of the whole mockup, in px. Everything scales off this. */
const STAGE_W = 590;
const STAGE_H = 740;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** Deterministic, timezone-agnostic date formatting. */
function formatDate(value: Date | string): string {
  if (typeof value === "string") return value;
  return `${MONTHS[value.getMonth()]} ${value.getDate()}, ${value.getFullYear()}`;
}

function formatPercent(rate: number): string {
  return `${Number((rate * 100).toFixed(4))}%`;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function InvoiceDemoMockup({
  brandName = "Invoicium",
  brandEmail = "billing@invoicium.app",
  client = DEFAULT_CLIENT,
  invoiceNumber = "INV-458821",
  dateIssued,
  dueDate,
  lineItems = DEFAULT_LINE_ITEMS,
  taxRate = 0.13,
  taxLabel,
  currency = "USD",
  locale = "en-US",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  paymentReference,
  notesTitle = "Notes & Terms",
  notesBody = "Payment due within 30 days. Thank you for your business!",
  footerText = "Powered by Invoicium",
  showBadge = true,
  badgeLabel = "Payment Received",
  badgeAmount,
  onTotalsComputed,
  className = "",
}: InvoiceDemoMockupProps) {
  const prefersReducedMotion = useReducedMotion();

  // Dates default to "today" / "+30 days" but stay stable across re-renders.
  const issued = useMemo(() => dateIssued ?? new Date(), [dateIssued]);
  const due = useMemo(
    () => dueDate ?? addDays(issued instanceof Date ? issued : new Date(), 30),
    [dueDate, issued],
  );

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale, currency],
  );

  const totals = useMemo<InvoiceTotals>(() => {
    const subtotal = round2(lineItems.reduce((sum, item) => sum + item.amount, 0));
    const tax = round2(subtotal * taxRate);
    return { subtotal, tax, total: round2(subtotal + tax) };
  }, [lineItems, taxRate]);

  React.useEffect(() => {
    onTotalsComputed?.(totals);
  }, [onTotalsComputed, totals]);

  const badgeValue = badgeAmount ?? totals.total;
  const resolvedTaxLabel = taxLabel ?? `Tax (HST ${formatPercent(taxRate)})`;
  const reference = paymentReference ?? `Reference invoice ${invoiceNumber} with your payment.`;

  const metaCells: Array<{ label: string; value: string }> = [
    { label: "Invoice #", value: invoiceNumber },
    { label: "Date Issued", value: formatDate(issued) },
    { label: "Due Date", value: formatDate(due) },
  ];

  return (
    <section
      className={`relative w-full overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50 to-white ${className}`}
    >
      {/* soft blue glow behind the device */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-300/35 blur-3xl" />

      <div className="relative mx-auto flex w-full justify-center px-4 py-10 sm:py-14">
        {/*
          The mockup is authored at its natural 590x740 size, then uniformly scaled
          to whatever width the viewport can actually give it (capped at 1x).
        */}
        <div
          className="relative [--s:min(1,calc((100vw-2rem)/590))]"
          style={{ width: `calc(${STAGE_W}px * var(--s))`, height: `calc(${STAGE_H}px * var(--s))` }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left scale-[var(--s)]"
            style={{ width: STAGE_W, height: STAGE_H }}
          >
            {/* ---------------------------------------------------------- */}
            {/*  Phone                                                     */}
            {/* ---------------------------------------------------------- */}
            <div className="absolute left-1/2 top-[62px] h-[650px] w-[300px] -translate-x-1/2 rounded-[44px] bg-black p-[10px] shadow-[0_40px_80px_-20px_rgba(15,23,42,0.45)] ring-1 ring-black/10">
              <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-white">
                {/* dynamic island */}
                <div className="absolute left-1/2 top-[10px] z-10 h-[22px] w-[82px] -translate-x-1/2 rounded-full bg-black" />

                {/* -------------------- invoice screen -------------------- */}
                <div className="flex h-full flex-col gap-[8px] px-[14px] pb-[12px] pt-[42px]">
                  {/* header */}
                  <div className="flex items-start justify-between">
                    <div className="leading-tight">
                      <div className="text-[15px] font-black tracking-tight text-gray-900">{brandName}</div>
                      <div className="text-[9px] text-gray-400">{brandEmail}</div>
                    </div>
                    <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[9px] bg-gray-100">
                      <Receipt className="h-[13px] w-[13px] text-gray-500" strokeWidth={2.2} />
                    </div>
                  </div>

                  {/* bill to */}
                  <div className="rounded-[12px] bg-gray-50 px-[10px] py-[8px]">
                    <div className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-gray-400">Bill To</div>
                    <div className="mt-[3px] text-[11px] font-bold leading-tight text-gray-900">{client.name}</div>
                    <div className="text-[8.5px] leading-[1.5] text-gray-500">{client.email}</div>
                    <div className="text-[8.5px] leading-[1.5] text-gray-500">{client.phone}</div>
                  </div>

                  {/* meta row */}
                  <div className="grid grid-cols-3 gap-[6px]">
                    {metaCells.map((cell) => (
                      <div key={cell.label} className="rounded-[10px] bg-gray-50 px-[7px] py-[6px]">
                        <div className="text-[6.5px] font-bold uppercase tracking-[0.1em] text-gray-400">
                          {cell.label}
                        </div>
                        <div
                          className="mt-[2px] text-[8.5px] font-bold leading-tight text-gray-900"
                          suppressHydrationWarning
                        >
                          {cell.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* line items */}
                  <div>
                    <div className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-gray-400">
                      Description of Services
                    </div>
                    <div className="mt-[4px] divide-y divide-gray-100">
                      {lineItems.map((item, index) => (
                        <div key={item.id ?? index} className="flex items-start justify-between gap-[10px] py-[6px]">
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-bold leading-tight text-gray-900">{item.name}</div>
                            {item.subtitle ? (
                              <div className="text-[8px] leading-tight text-gray-400">{item.subtitle}</div>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-[9.5px] font-bold tabular-nums text-gray-900">
                            {money.format(item.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* totals */}
                  <div>
                    <div className="flex items-center justify-between py-[2px]">
                      <span className="text-[9px] text-gray-500">Subtotal</span>
                      <span className="text-[9px] font-semibold tabular-nums text-gray-900">
                        {money.format(totals.subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-[2px]">
                      <span className="text-[9px] text-gray-500">{resolvedTaxLabel}</span>
                      <span className="text-[9px] font-semibold tabular-nums text-gray-900">
                        {money.format(totals.tax)}
                      </span>
                    </div>
                    <div className="mt-[6px] flex items-center justify-between border-t border-gray-200 pt-[7px]">
                      <span className="text-[10px] font-black text-gray-900">Total Due</span>
                      <span className="text-[13px] font-black tabular-nums text-[#14b866]">
                        {money.format(totals.total)}
                      </span>
                    </div>
                  </div>

                  {/* payment information */}
                  <div className="rounded-[12px] bg-gray-50 px-[10px] py-[8px]">
                    <div className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-gray-400">
                      Payment Information
                    </div>
                    <div className="mt-[3px] text-[8.5px] leading-[1.45] text-gray-500">
                      Accepted methods: {paymentMethods.join(", ")}.
                    </div>
                    <div className="text-[8.5px] leading-[1.45] text-gray-500">{reference}</div>
                  </div>

                  {/* notes / terms */}
                  <div className="rounded-[12px] bg-yellow-50 px-[10px] py-[8px]">
                    <div className="text-[8.5px] font-bold text-yellow-900">{notesTitle}</div>
                    <div className="mt-[2px] text-[8.5px] leading-[1.45] text-yellow-800/80">{notesBody}</div>
                  </div>

                  {/* footer */}
                  <div className="mt-auto pt-[4px] text-center text-[7px] font-medium tracking-[0.08em] text-gray-300">
                    {footerText}
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/*  Floating "Payment Received" badge                         */}
            {/* ---------------------------------------------------------- */}
            {showBadge ? (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -34 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.35 }}
                className="absolute right-[6px] top-[22px] z-20 flex items-center gap-[10px] rounded-[20px] bg-[#14b866] py-[13px] pl-[14px] pr-[20px] shadow-[0_22px_45px_-12px_rgba(20,184,102,0.6)]"
              >
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[17px] font-black text-white">
                  $
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-semibold text-white/85">{badgeLabel}</div>
                  <div className="text-[21px] font-black leading-tight tabular-nums text-white">
                    {money.format(badgeValue)}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
