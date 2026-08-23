// The scroll-reveal product shot on the marketing homepage.
//
// ContainerScroll is built to reveal a screenshot, and this project has none --
// public/ holds only logos. Rather than ship a placeholder or a stock image,
// the card contains a live desktop rendering of the same invoice the hero phone
// shows, so the two mockups agree on figures and neither can go stale against a
// screenshot nobody remembers to retake.
//
// Figures come from InvoiceDemoMockup so there is one source of truth: totals
// are derived from the shared line items, never typed in.

import React, { useMemo } from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import {
  DEFAULT_BUSINESS,
  DEFAULT_CLIENT,
  DEFAULT_LINE_ITEMS,
  currency,
  formatDate,
} from "@/components/marketing/InvoiceDemoMockup";

const TAX_RATE = 0.13;
const INVOICE_NUMBER = "INV-458821";

/** The app window that sits inside the tilting card. */
function InvoiceDesktopPreview() {
  const { subtotal, tax, total, issued, due } = useMemo(() => {
    const sub = DEFAULT_LINE_ITEMS.reduce((s, li) => s + Number(li.amount || 0), 0);
    const t = sub * TAX_RATE;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);
    return { subtotal: sub, tax: t, total: sub + t, issued: today, due: dueDate };
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-neutral-100 dark:bg-zinc-900">
      {/* Browser chrome — sells "this is the real app" without a screenshot. */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
        <span className="mx-auto truncate rounded-md bg-neutral-100 px-3 py-1 text-[10px] text-neutral-500 dark:bg-zinc-700 dark:text-zinc-300">
          invoicium.ca/invoices/{INVOICE_NUMBER}
        </span>
      </div>

      {/* The document itself */}
      <div className="min-h-0 flex-1 overflow-hidden p-2 md:p-4">
        <div className="flex h-full flex-col rounded-xl bg-white p-3 shadow-sm md:p-4 dark:bg-zinc-800">
          <div className="flex flex-shrink-0 items-start justify-between">
            <div>
              <p className="text-base font-black tracking-tight text-neutral-900 md:text-xl dark:text-white">
                {DEFAULT_BUSINESS.name}
              </p>
              <p className="text-[10px] text-neutral-500 md:text-xs dark:text-zinc-400">
                {DEFAULT_BUSINESS.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 md:text-xs">
                Invoice
              </p>
              <p className="text-sm font-black text-neutral-900 md:text-lg dark:text-white">
                {INVOICE_NUMBER}
              </p>
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700 md:text-[10px]">
                Paid
              </span>
            </div>
          </div>

          <div className="mt-2 grid flex-shrink-0 grid-cols-3 gap-2 md:mt-3 md:gap-3">
            {[
              { label: "Billed To", value: DEFAULT_CLIENT.name },
              { label: "Date Issued", value: formatDate(issued) },
              { label: "Due Date", value: formatDate(due) },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-neutral-50 px-2.5 py-1.5 dark:bg-zinc-700/40">
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 md:text-[10px]">
                  {c.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-neutral-900 md:text-sm dark:text-white">
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          {/* Line items take the slack, so the totals never leave the frame. */}
          <div className="mt-2 min-h-0 flex-1 overflow-hidden md:mt-3">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-zinc-700">
              <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 md:text-[10px]">
                Description
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 md:text-[10px]">
                Amount
              </span>
            </div>
            <ul className="divide-y divide-neutral-100 dark:divide-zinc-700/60">
              {DEFAULT_LINE_ITEMS.map((li) => (
                <li key={li.name} className="flex items-center justify-between gap-4 py-1">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[11px] font-bold text-neutral-900 md:text-sm dark:text-white">
                      {li.name}
                    </span>
                    {li.subtitle ? (
                      <span className="hidden flex-shrink-0 truncate text-[9px] text-neutral-400 sm:inline md:text-xs">
                        {li.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-neutral-900 md:text-sm dark:text-white">
                    {currency(li.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 flex flex-shrink-0 justify-end">
            <div className="w-full max-w-[240px] space-y-0.5 md:max-w-[300px]">
              <div className="flex justify-between text-[10px] text-neutral-500 md:text-sm dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{currency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500 md:text-sm dark:text-zinc-400">
                <span>Tax (HST {Math.round(TAX_RATE * 100)}%)</span>
                <span className="tabular-nums">{currency(tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-300 pt-1.5 dark:border-zinc-600">
                <span className="text-xs font-black text-neutral-900 md:text-base dark:text-white">
                  Total Due
                </span>
                <span className="text-sm font-black tabular-nums text-[#14b866] md:text-xl">
                  {currency(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceScrollDemo() {
  return (
    <section className="overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="pb-4">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-700">
              See it in action
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-content sm:text-5xl">
              Every invoice, done in
              <br />
              <span className="text-4xl font-black leading-none md:text-[6rem]">
                under a minute
              </span>
            </h2>
          </div>
        }
      >
        <InvoiceDesktopPreview />
      </ContainerScroll>
    </section>
  );
}
