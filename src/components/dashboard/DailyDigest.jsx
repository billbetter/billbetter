import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import {
  Sun,
  Sunset,
  Moon,
  AlertTriangle,
  Clock,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

function getGreeting(name) {
  const hour = new Date().getHours();
  const first = name ? name.split(" ")[0] : null;
  const suffix = first ? `, ${first}` : "";
  if (hour < 12) return `Good morning${suffix}`;
  if (hour < 17) return `Good afternoon${suffix}`;
  return `Good evening${suffix}`;
}

function GreetingIcon({ hour, className }) {
  if (hour < 12) return <Sun className={className} />;
  if (hour < 17) return <Sunset className={className} />;
  return <Moon className={className} />;
}

const fmt = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function DailyDigest({
  invoices = [],
  quotes = [],
  settings,
  user,
}) {
  const now = new Date();
  const hour = now.getHours();

  const digest = useMemo(() => {
    const overdue = invoices.filter((inv) => {
      if (inv.status === "overdue") return true;
      if (inv.status === "sent" && inv.due_date && new Date(inv.due_date) < now)
        return true;
      return false;
    });

    const dueSoon = invoices.filter((inv) => {
      if (inv.status !== "sent") return false;
      if (!inv.due_date) return false;
      const due = new Date(inv.due_date);
      const days = differenceInDays(due, now);
      return days >= 0 && days <= 3;
    });

    const pendingQuotes = quotes.filter(
      (q) => q.status === "sent" || q.status === "pending",
    );

    const overdueAmount = overdue.reduce(
      (sum, inv) => sum + (inv.total || 0),
      0,
    );

    return { overdue, dueSoon, pendingQuotes, overdueAmount };
  }, [invoices, quotes]);

  const allClear =
    digest.overdue.length === 0 &&
    digest.dueSoon.length === 0 &&
    digest.pendingQuotes.length === 0;

  const userName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  return (
    <div className="rounded-2xl overflow-hidden bg-surface dark:bg-ink-800 border border-line-subtle dark:border-ink-700 shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 bg-surface-sunken dark:bg-ink-900 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
            <GreetingIcon
              hour={hour}
              className="w-5 h-5 text-warning-600 dark:text-warning-400"
            />
          </div>
          <div>
            <p className="font-bold text-content dark:text-content-inverted text-sm sm:text-base leading-snug">
              {getGreeting(userName)}
            </p>
            <p className="text-xs text-content-muted dark:text-content-subtle">
              {format(now, "EEEE, MMMM d")}
              {settings?.business_name ? ` · ${settings.business_name}` : ""}
            </p>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-content-subtle dark:text-content-muted uppercase tracking-widest flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          Daily Brief
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-ink-50 dark:divide-ink-700/50">
        {allClear ? (
          <div className="px-5 py-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="font-semibold text-content dark:text-content-inverted text-sm">
                You're all caught up
              </p>
              <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                No overdue invoices, nothing due soon. Nice work.
              </p>
            </div>
          </div>
        ) : (
          <>
            {digest.overdue.length > 0 && (
              <Link
                to={createPageUrl("ChaseInvoice")}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-danger-50/50 dark:hover:bg-danger-900/10 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content dark:text-content-inverted">
                      {digest.overdue.length} overdue invoice
                      {digest.overdue.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                      {fmt(digest.overdueAmount)} outstanding · Tap to chase
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-danger-400 flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            )}

            {digest.dueSoon.length > 0 && (
              <Link
                to={createPageUrl("Invoices")}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-warning-50/50 dark:hover:bg-warning-900/10 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content dark:text-content-inverted">
                      {digest.dueSoon.length} invoice
                      {digest.dueSoon.length !== 1 ? "s" : ""} due soon
                    </p>
                    <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                      {digest.dueSoon
                        .slice(0, 2)
                        .map((inv) => {
                          const days = differenceInDays(
                            new Date(inv.due_date),
                            now,
                          );
                          const label = isToday(new Date(inv.due_date))
                            ? "today"
                            : isTomorrow(new Date(inv.due_date))
                              ? "tomorrow"
                              : `in ${days}d`;
                          return `${inv.client_name} (due ${label})`;
                        })
                        .join(" · ")}
                      {digest.dueSoon.length > 2
                        ? ` +${digest.dueSoon.length - 2} more`
                        : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-warning-400 flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            )}

            {digest.pendingQuotes.length > 0 && (
              <Link
                to={createPageUrl("Quotes")}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-info-50/50 dark:hover:bg-info-900/10 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content dark:text-content-inverted">
                      {digest.pendingQuotes.length} quote
                      {digest.pendingQuotes.length !== 1 ? "s" : ""} awaiting
                      response
                    </p>
                    <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                      {digest.pendingQuotes
                        .map((q) => q.client_name)
                        .slice(0, 3)
                        .join(", ")}
                      {digest.pendingQuotes.length > 3
                        ? ` +${digest.pendingQuotes.length - 3} more`
                        : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-info-400 flex-shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
