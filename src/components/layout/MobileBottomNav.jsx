import React from "react";
import { ClipboardList, FileText, LayoutDashboard, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/** The phone tab bar. Four fixed tabs and More; its height is published
 * for the flows that sit above it. */
export default function MobileBottomNav({
  bottomNavRef,
  getPaidActive,
}) {
  return (
    <nav
      ref={bottomNavRef}
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-surface-inverted/95 backdrop-blur-sm border-t border-line-subtle dark:border-ink-800 z-50"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
    >
      <div className="grid grid-cols-5 px-1">
        {/* Dashboard */}
        <Link
          to={createPageUrl("Dashboard")}
          className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
            location.pathname === createPageUrl("Dashboard")
              ? "text-success-600 dark:text-success-400"
              : "text-content-muted dark:text-content-subtle"
          }`}
        >
          <LayoutDashboard
            className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Dashboard") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
          />
          <span
            className={`text-[11px] ${location.pathname === createPageUrl("Dashboard") ? "font-semibold" : "font-medium"}`}
          >
            Home
          </span>
        </Link>

        {/* Invoices */}
        <Link
          to={createPageUrl("Invoices")}
          className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
            location.pathname === createPageUrl("Invoices")
              ? "text-success-600 dark:text-success-400"
              : "text-content-muted dark:text-content-subtle"
          }`}
        >
          <FileText
            className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Invoices") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
          />
          <span
            className={`text-[11px] ${location.pathname === createPageUrl("Invoices") ? "font-semibold" : "font-medium"}`}
          >
            Invoices
          </span>
        </Link>

        {/* Quotes */}
        <Link
          to={createPageUrl("Quotes")}
          className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
            location.pathname === createPageUrl("Quotes")
              ? "text-success-600 dark:text-success-400"
              : "text-content-muted dark:text-content-subtle"
          }`}
        >
          <ClipboardList
            className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Quotes") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
          />
          <span
            className={`text-[11px] ${location.pathname === createPageUrl("Quotes") ? "font-semibold" : "font-medium"}`}
          >
            Quotes
          </span>
        </Link>

        {/*
          Get Paid.

          Active for the Paper Trail too, which lives under this tab rather
          than beside it. A tab that goes dark when you follow a link from
          its own page reads as "you have left the section", and the user
          then has no idea which of the five tabs to press to get back.
        */}
        <Link
          to={createPageUrl("ChaseInvoice")}
          className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
            getPaidActive
              ? "text-success-600 dark:text-success-400"
              : "text-content-muted dark:text-content-subtle"
          }`}
        >
          <Zap
            className={`w-5 h-5 mb-1 ${getPaidActive ? "stroke-[2.5]" : "stroke-[1.75]"}`}
          />
          <span
            className={`text-[11px] ${getPaidActive ? "font-semibold" : "font-medium"}`}
          >
            Get Paid
          </span>
        </Link>

        {/* More Menu */}
        <button
          onClick={() => {
            const sheet = document.getElementById("mobile-more-menu");
            sheet.classList.toggle("hidden");
          }}
          className="flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg text-content-muted dark:text-content-subtle active:scale-95 transition-all"
        >
          <div className="w-5 h-5 mb-1 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <circle
                cx="4"
                cy="10"
                r="1.25"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="10"
                cy="10"
                r="1.25"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="16"
                cy="10"
                r="1.25"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </div>
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
