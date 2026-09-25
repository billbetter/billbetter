import React, { useState, useEffect, useMemo } from "react";
import { hslToken } from "@/lib/tokens";
import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/layout/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import {
  canAccessFeature,
  getTransactionAllowance,
} from "@/components/utils/permissions";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import DemandLetterBanner from "@/components/invoice/DemandLetterBanner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  FileText,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
  Download,
  Loader2,
  Users,
  Calendar as CalendarIcon,
  ClipboardList,
  Plus,
  Receipt,
  Sparkles,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PullToRefresh from "@/components/utils/PullToRefresh";
import DailyDigest from "@/components/dashboard/DailyDigest";
import ReadReceiptBadge from "@/components/invoice/ReadReceiptBadge";
import { indexPaymentsByInvoice, revenueDate } from "@/lib/invoicePayments";
import {
  formatCalendarDay,
  isPastDay,
  parseCalendarDay,
} from "@/lib/calendarDate";

// Invoice Row Component
const InvoiceRow = ({ invoice, onClick }) => {
  const statusConfig = {
    draft: {
      bg: "bg-ink-100 text-ink-700 border-line dark:bg-ink-800 dark:text-ink-300 dark:border-ink-700",
    },
    sent: {
      bg: "bg-info-50 text-info-700 border-info-200 dark:bg-info-900/30 dark:text-info-300 dark:border-info-800",
    },
    paid: {
      bg: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-300 dark:border-success-800",
    },
    overdue: {
      bg: "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:border-danger-800",
    },
    cancelled: {
      bg: "bg-surface-sunken text-content-muted border-line dark:bg-ink-800/50 dark:text-content-subtle dark:border-ink-700",
    },
  };

  const status = statusConfig[invoice.status] || statusConfig.draft;

  return (
    <div
      onClick={onClick}
      className="dash-invoice-row flex items-center justify-between px-2 py-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="size-9 rounded-lg border bg-background flex items-center justify-center flex-shrink-0">
          <Receipt
            className={`size-4 ${invoice.status === "paid" ? "text-success-600 dark:text-success-400" : "text-muted-foreground"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">
              {invoice.invoice_number ||
                `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
            </p>
            <span
              className={`px-1.5 py-0.5 rounded-md text-xs font-medium border capitalize ${status.bg} flex-shrink-0`}
            >
              {invoice.status}
            </span>
            {/* The dashboard is where a contractor looks first thing in the
                morning, so a receipt earned overnight belongs here rather than
                only two clicks away. Renders nothing until there is one. */}
            <ReadReceiptBadge document={invoice} className="flex-shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {invoice.client_name}
          </p>
        </div>
      </div>
      <div className="dash-invoice-row-amount text-right flex-shrink-0 ml-3">
        <p className="font-medium tabular-nums text-sm sm:text-base whitespace-nowrap">
          ${invoice.total?.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          {invoice.created_date &&
            format(new Date(invoice.created_date), "MMM d")}
        </p>
      </div>
    </div>
  );
};

// Invoice and Quote open the builder, not the AI Quick Bill flow. A tile
// labelled with a noun should land on the page that noun names; the builders
// carry the same photo, voice and describe-it AI anyway, so nothing a
// contractor could do from the quick flow got harder to reach.
//
// Accent per tile: the chip colour, its glow, and the border tint. Kept as
// token classes (not inline styles) so both themes are covered.
const QUICK_ACTIONS = [
  {
    to: createPageUrl("CreateInvoice"),
    icon: FileText,
    title: "Invoice",
    description: "Bill a job line by line",
    accent: {
      chip: "bg-success-500",
      glow: "shadow-success-500/30",
      border: "border-success-200 dark:border-success-500/25",
    },
  },
  {
    to: createPageUrl("CreateQuote"),
    icon: ClipboardList,
    title: "Quote",
    description: "Price a job before you start",
    accent: {
      chip: "bg-brand-500",
      glow: "shadow-brand-500/30",
      border: "border-brand-200 dark:border-info-500/25",
    },
  },
  {
    to: createPageUrl("Clients"),
    icon: Users,
    title: "Add Client",
    description: "Manage your client list",
    accent: {
      chip: "bg-brand-600",
      glow: "shadow-brand-500/30",
      border: "border-brand-200 dark:border-brand-700/25",
    },
  },
  {
    to: createPageUrl("Calendar"),
    icon: CalendarIcon,
    title: "Calendar",
    description: "View your schedule",
    accent: {
      chip: "bg-alert-600",
      glow: "shadow-alert-500/30",
      border: "border-alert-200 dark:border-alert-500/25",
    },
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      const [
        invoiceData,
        quoteData,
        settingsData,
        recurringData,
        subscriptionData,
        paymentData,
      ] = await Promise.all([
        sdk.entities.Invoice.filter(
          { user_id: currentUser.id },
          "-created_date",
          100,
        ),
        sdk.entities.Quote.filter(
          { user_id: currentUser.id },
          "-created_date",
          50,
        ),
        sdk.entities.BusinessSettings.filter({ user_id: currentUser.id }),
        sdk.entities.RecurringInvoice.filter(
          { user_id: currentUser.id },
          "-created_date",
          20,
        ),
        sdk.entities.Subscription.filter({ user_id: currentUser.id }),
        // Payments, so revenue is dated by when the money arrived rather than
        // by when the invoice was raised. Allowed to fail on its own:
        // revenueDate() then falls back to paid_date and finally to the
        // creation date, which is what this chart used for everything before.
        sdk.entities.InvoicePayment.filter({ user_id: currentUser.id }).catch(() => []),
      ]);

      setInvoices(invoiceData);
      setPayments(paymentData || []);
      setQuotes(quoteData);
      setSettings(settingsData.length > 0 ? settingsData[0] : null);
      setRecurringInvoices(recurringData);
      setSubscription(subscriptionData.length > 0 ? subscriptionData[0] : null);

      // Generate chart data
      const sixMonths = Array.from({ length: 6 }, (_, i) => {
        const month = subMonths(new Date(), 5 - i);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        // Paid is bucketed by when the money arrived; pending by when the
        // invoice was raised, because an unpaid invoice has no payment date to
        // be bucketed by. See revenueDate().
        const byInvoice = indexPaymentsByInvoice(paymentData || []);
        const paid = invoiceData
          .filter((inv) => inv.status === "paid")
          .filter((inv) => {
            const d = revenueDate(inv, byInvoice.get(inv.id) || []);
            return d >= monthStart && d <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
        const pending = invoiceData
          .filter((inv) => inv.status === "sent")
          .filter((inv) => {
            const invDate = new Date(inv.created_date);
            return invDate >= monthStart && invDate <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);

        return {
          month: format(month, "MMM"),
          paid,
          pending,
          total: paid + pending,
        };
      });
      setChartData(sixMonths);

      if (!currentUser.onboarding_completed && settingsData.length === 0) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      if (error.response?.status === 429) {
        alert("Too many requests. Please wait a moment and refresh.");
      }
    }
    setLoading(false);
  };

  const handleExportAll = async () => {
    if (!canAccessFeature(subscription, "excel_export")) {
      alert(
        "Excel export is available on Essential plan and higher. Please upgrade.",
      );
      return;
    }

    setExporting(true);
    try {
      const user = await sdk.auth.me();

      const [invoiceData, clientData] = await Promise.all([
        sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
        sdk.entities.Client.filter({ user_id: user.id }, "-created_date"),
      ]);

      const csvRows = [
        ["INVOICES"],
        ["Invoice #", "Client", "Date", "Due Date", "Total", "Status"],
        ...invoiceData.map((inv) => [
          inv.invoice_number || "",
          inv.client_name?.replace(/"/g, '""') || "",
          inv.created_date
            ? format(new Date(inv.created_date), "yyyy-MM-dd")
            : "",
          formatCalendarDay(inv.due_date, "yyyy-MM-dd"),
          inv.total?.toFixed(2) || "0.00",
          inv.status || "",
        ]),
        [""],
        ["CLIENTS"],
        ["Name", "Email", "Phone", "Total Invoiced"],
        ...clientData.map((client) => [
          client.name?.replace(/"/g, '""') || "",
          client.email || "",
          client.phone || "",
          client.total_invoiced?.toFixed(2) || "0.00",
        ]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoicium_export_${format(new Date(), "yyyyMMdd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    }
    setExporting(false);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);

    const byInvoice = indexPaymentsByInvoice(payments);

    // "This month" for a COUNT of invoices is still when they were raised --
    // that is what the label means. Revenue below is dated by payment.
    const thisMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv.created_date);
      return date >= thisMonthStart && date <= thisMonthEnd;
    });

    const paidThisMonth = invoices
      .filter((inv) => inv.status === "paid")
      .filter((inv) => {
        const d = revenueDate(inv, byInvoice.get(inv.id) || []);
        return d >= thisMonthStart && d <= thisMonthEnd;
      });

    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === "overdue") return true;
      if (inv.status === "sent" && isPastDay(inv.due_date, now)) return true;
      return false;
    });

    return {
      totalRevenue: invoices
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + (inv.total || 0), 0),
      pendingAmount: invoices
        .filter((inv) => inv.status === "sent")
        .reduce((sum, inv) => sum + (inv.total || 0), 0),
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((inv) => inv.status === "paid").length,
      thisMonthRevenue: paidThisMonth.reduce((sum, inv) => sum + (inv.total || 0), 0),
      thisMonthCount: thisMonthInvoices.length,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0,
      ),
    };
  }, [invoices, payments]);

  const transactionStats = useMemo(() => {
    const used = subscription?.transactions_used_this_month || 0;
    // Not the raw column: it holds whatever the limit was on the day this user
    // last checked out, so it goes stale every time the ladder is rebalanced.
    // getTransactionAllowance prefers the current plan definition.
    const limit = getTransactionAllowance(subscription);
    const unlimited = limit === -1;
    const percentage = unlimited ? 0 : Math.min(100, (used / limit) * 100);

    return {
      used,
      limit,
      unlimited,
      percentage,
      remaining: unlimited ? Infinity : Math.max(0, limit - used),
      over: !unlimited && used > limit,
      near: !unlimited && used > limit * 0.8 && used <= limit,
    };
  }, [subscription]);

  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);

  const upcomingRecurring = useMemo(() => {
    return recurringInvoices
      .filter((r) => r.status === "active" && r.next_generation_date)
      .sort(
        (a, b) =>
          parseCalendarDay(a.next_generation_date) -
          parseCalendarDay(b.next_generation_date),
      )
      .slice(0, 3);
  }, [recurringInvoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading dashboard
            </p>
            <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep transition-colors duration-300">
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          user={user}
          onComplete={() => {
            setShowOnboarding(false);
            loadData();
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Header */}
          <PageHeader
            className="flex-row items-end sm:items-end"
            eyebrow="Dashboard"
            title={settings?.business_name || "Invoicium"}
            badge={
              <Badge variant="outline" className="hidden sm:inline-flex">
                Owner
              </Badge>
            }
            actions={
              <Button
                onClick={handleExportAll}
                disabled={exporting}
                variant="outline"
                className="hidden sm:inline-flex"
              >
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                Export
              </Button>
            }
          />

          {/*
            Demand-letter prompt.

            Above the digest because it is the only thing on this page that is
            about a decision rather than a number, and it renders nothing at
            all unless an invoice has actually crossed 21 days -- so on an
            ordinary morning the dashboard looks exactly as it did.
          */}
          <DemandLetterBanner
            invoices={invoices}
            onDraftLetter={(invoice) => {
              // SEAM: step 3 replaces this with the drafting dialog -- the AI
              // call, the editable letter, the explicit review before anything
              // is sent. Until that exists this opens the collections screen,
              // which is the real place to act on the invoice today, rather
              // than a button that acknowledges nothing.
              navigate(createPageUrl("ChaseInvoice"), {
                state: { focusInvoiceId: invoice.id },
              });
            }}
            onDismissed={loadData}
          />

          {/* Overview: the template's section cards, first under the header. */}
          <section aria-labelledby="dash-overview">
            <p id="dash-overview" className="text-sm font-medium text-muted-foreground mb-3">
              Overview
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              label="Total Revenue"
              icon={DollarSign}
              value={`$${stats.totalRevenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              valueClassName="truncate"
              badgeReserve="sm:pr-16"
              badge={
                <Badge variant="outline" className="hidden sm:inline-flex">
                  <TrendingUp />
                  All time
                </Badge>
              }
              hint={<span className="sm:hidden">All time</span>}
            />
            <KpiCard
              label="Pending"
              icon={Clock}
              value={`$${stats.pendingAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              valueClassName="truncate"
              hint={`${invoices.filter((inv) => inv.status === "sent").length} invoices`}
            />
            <KpiCard
              label="Invoices"
              icon={FileText}
              value={`${transactionStats.used}/${transactionStats.unlimited ? "∞" : transactionStats.limit}`}
              hint="This month"
            />
            <KpiCard
              label="This Month"
              icon={TrendingUp}
              value={`$${stats.thisMonthRevenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              valueClassName="truncate"
              hint={`${stats.thisMonthCount} invoices`}
            />
            </div>
          </section>

          {/* Daily Digest */}
          <div>
            <DailyDigest
              invoices={invoices}
              quotes={quotes}
              settings={settings}
              user={user}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.title} {...action} />
              ))}
            </div>
          </div>

          {/* Charts & Recent Activity */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Activity
            </p>
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Revenue Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <CardTitle>Revenue Overview</CardTitle>
                      <CardDescription>Last 6 months</CardDescription>
                    </div>
                    <Button asChild variant="outline" size="sm" className="flex-shrink-0">
                      <Link to={createPageUrl("Analytics")}>
                        <span className="hidden sm:inline">View Analytics</span>
                        <span className="sm:hidden">View</span>
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="dashRevenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={hslToken("primary")} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={hslToken("primary")} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={hslToken("border")} />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tickMargin={8}
                          tick={{ fill: hslToken("muted-foreground"), fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: hslToken("muted-foreground"), fontSize: 12 }}
                          tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                          cursor={{ stroke: hslToken("border") }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: `1px solid ${hslToken("border")}`,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            backgroundColor: hslToken("popover"),
                            color: hslToken("popover-foreground"),
                            fontSize: 12,
                          }}
                          formatter={(value) => [
                            `$${value.toFixed(2)}`,
                            "Revenue",
                          ]}
                        />
                        <Area
                          type="natural"
                          dataKey="paid"
                          stroke={hslToken("primary")}
                          strokeWidth={2}
                          fill="url(#dashRevenueFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Invoices */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>Recent Invoices</CardTitle>
                    <Button asChild variant="ghost" size="sm" className="flex-shrink-0">
                      <Link to={createPageUrl("Invoices")}>View All</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 px-4 pb-4">
                  {recentInvoices.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="size-12 rounded-lg border bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <p className="font-medium mb-1">
                        No invoices yet
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first invoice to get started
                      </p>
                      <Button asChild>
                        <Link to={createPageUrl("CreateInvoice")}>
                          <Plus />
                          Create Invoice
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="dash-invoice-list divide-y space-y-0">
                      {recentInvoices.map((invoice) => (
                        <InvoiceRow
                          key={invoice.id}
                          invoice={invoice}
                          onClick={() =>
                            navigate(
                              createPageUrl(`InvoiceDetail?id=${invoice.id}`),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Upcoming Recurring */}
          {upcomingRecurring.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="size-4 text-muted-foreground flex-shrink-0" />
                    <CardTitle className="truncate">
                      Upcoming Recurring
                    </CardTitle>
                  </div>
                  <Button asChild variant="outline" size="sm" className="flex-shrink-0">
                    <Link to={createPageUrl("RecurringInvoices")}>Manage</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingRecurring.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-lg border bg-gradient-to-t from-primary/5 to-card p-4"
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <p className="font-medium truncate flex-1">
                          {rec.client_name}
                        </p>
                        <Badge variant="outline" className="capitalize flex-shrink-0">
                          {rec.frequency}
                        </Badge>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums tracking-tight mb-1">
                        ${rec.total?.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Next:{" "}
                        {formatCalendarDay(
                          rec.next_generation_date,
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mobile Export Button */}
          <div className="sm:hidden mt-4">
            <Button
              onClick={handleExportAll}
              disabled={exporting}
              variant="outline"
              size="lg"
              className="w-full"
            >
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              Export Business Data
            </Button>
          </div>
        </div>
      </div>

      {/* Floating AI Quick Bill button (mobile) — prominent labeled pill */}
      <Link
        to={createPageUrl("QuickInvoice")}
        aria-label="Create AI Quick Bill"
        className="lg:hidden fixed left-1/2 -translate-x-1/2 z-40 group"
        style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
      >
        {/* Pill: the theme's primary, the template's one strong colour. */}
        <span className="relative inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg ring-1 ring-border active:scale-95 transition-transform whitespace-nowrap">
          <span className="flex items-center justify-center size-7 rounded-full bg-primary-foreground/15">
            <Sparkles className="size-4" strokeWidth={2.25} />
          </span>
          <span className="tracking-tight">AI Quick Bill</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-primary-foreground/15 text-[9px] font-semibold tracking-widest">
            NEW
          </span>
        </span>
      </Link>
    </PullToRefresh>
  );
}
