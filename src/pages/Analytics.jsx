import React, { useState, useEffect } from "react";
import { token } from "@/lib/tokens";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Users,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  BarChart3,
  PieChart,
  Zap,
  Loader2,
} from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { groupBy, sumBy } from "lodash";
import { sdk } from "@/api/sdk";
import { motion } from "framer-motion";
import SmartInsights from "@/components/analytics/SmartInsights";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import ChaseInvoiceBanner from "@/components/invoice/ChaseInvoiceBanner";
import { indexPaymentsByInvoice, revenueDate } from "@/lib/invoicePayments";

/* ─── Animation wrapper ──────────────────────────────────────── */
const FadeIn = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ─── Mini sparkline for stat cards ──────────────────────────── */
const MiniSparkline = ({ data, color, height = 32 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = height;
  const points = data
    .map(
      (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-40">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ─── Stat Card ──────────────────────────────────────────────── */
const StatCard = ({ stat, index }) => {
  const palette = {
    emerald: {
      iconBg: "bg-success-500/10",
      iconText: "text-success-600",
      accent: token("success-500"),
      icon: DollarSign,
    },
    blue: {
      iconBg: "bg-accent-500/10",
      iconText: "text-accent-600",
      accent: token("accent-500"),
      icon: Receipt,
    },
    amber: {
      iconBg: "bg-success-500/10",
      iconText: "text-success-700",
      accent: token("success-600"),
      icon: Briefcase,
    },
    violet: {
      iconBg: "bg-accent-500/10",
      iconText: "text-accent-700",
      accent: token("accent-600"),
      icon: Users,
    },
  };

  const style = palette[stat.color] || palette.emerald;
  const Icon = stat.icon || style.icon;
  const isPositive = stat.trend >= 0;

  return (
    <FadeIn delay={index * 0.07}>
      <div className="group relative h-full overflow-hidden rounded-2xl border border-line-subtle dark:border-ink-800 bg-surface dark:bg-surface-inverted p-3 sm:p-5 transition-all duration-300 hover:border-line-strong dark:hover:border-ink-700 hover:shadow-md">
        {/* Accent line on hover */}
        <div
          className="absolute left-0 top-0 w-12 h-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: style.accent,
          }}
        />

        {/* Icon top-right */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div
            className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${style.iconBg} dark:bg-opacity-20`}
          >
            <Icon
              className={`h-4 w-4 sm:h-5 sm:w-5 ${style.iconText} dark:text-success-400`}
              strokeWidth={1.8}
            />
          </div>
          {stat.trend !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] sm:text-xs font-semibold ${
                isPositive
                  ? "text-success-600 dark:text-success-400"
                  : "text-danger-500 dark:text-danger-400"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(stat.trend).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-content dark:text-content-inverted mb-0.5 leading-tight truncate">
          {stat.value}
        </p>

        {/* Title + subtext */}
        <p className="text-xs sm:text-sm font-medium text-content-body dark:text-ink-300 leading-snug">
          {stat.title}
        </p>
        <p className="text-[10px] sm:text-xs text-content-subtle dark:text-content-muted mt-0.5 truncate">
          {stat.subtext}
        </p>

        {/* Sparkline — bottom of card, hidden on very small screens */}
        {stat.sparkline && (
          <div className="hidden sm:block mt-3 -mb-1">
            <MiniSparkline
              data={stat.sparkline}
              color={style.accent}
              height={28}
            />
          </div>
        )}
      </div>
    </FadeIn>
  );
};

/* ─── Invoice Status Pill ────────────────────────────────────── */
const StatusPill = ({ label, count, amount, color }) => (
  <div
    className={`flex items-center justify-between rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 ${color}`}
  >
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-ink-800 dark:text-ink-200 text-sm font-semibold">
        {label}
      </span>
      <span className="rounded-full bg-surface/80 dark:bg-black/20 px-2 py-0.5 text-xs font-bold text-ink-700 dark:text-ink-200 flex-shrink-0">
        {count}
      </span>
    </div>
    <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums flex-shrink-0 ml-2">
      ${amount.toLocaleString()}
    </span>
  </div>
);

/* ─── Custom Chart Tooltip ───────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-subtle dark:border-ink-800 bg-surface/95 dark:bg-surface-inverted/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />

          <span className="text-sm font-bold text-ink-800 dark:text-content-inverted tabular-nums">
            ${entry.value.toLocaleString()}
          </span>
          <span className="text-xs text-content-subtle dark:text-content-muted capitalize">
            {entry.dataKey}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 MAIN ANALYTICS COMPONENT
 ═══════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    preset: "all",
    start: null,
    end: null,
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await sdk.auth.me();
      const [invoiceData, clientData, quoteData, jobData, paymentData] =
        await Promise.all([
          sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Client.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Quote.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Job.filter({ user_id: user.id }, "-created_date"),
          // Allowed to fail on its own: revenueDate() then falls back to
          // paid_date and finally to the creation date, which is exactly what
          // every chart here used before.
          sdk.entities.InvoicePayment.filter({ user_id: user.id }).catch(() => []),
        ]);

      setInvoices(invoiceData);
      setPayments(paymentData || []);
      setClients(clientData);
      setQuotes(quoteData);
      setJobs(jobData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ── Filters ── */
  const filterByDateRange = (items, dateField = "created_date") => {
    if (!dateRange || dateRange.preset === "all") return items;
    return items.filter((item) => {
      const date = new Date(item[dateField]);
      return date >= dateRange.start && date <= dateRange.end;
    });
  };

  /* ── Derived data ── */
  const paymentsByInvoice = indexPaymentsByInvoice(payments);
  const filteredInvoices = filterByDateRange(invoices);
  const paidInvoices = filteredInvoices.filter((inv) => inv.status === "paid");
  const pendingInvoices = filteredInvoices.filter(
    (inv) => inv.status === "sent",
  );
  const overdueInvoices = filteredInvoices.filter(
    (inv) => inv.status === "overdue",
  );

  const totalRevenue = paidInvoices.reduce(
    (sum, inv) => sum + (inv.total || 0),
    0,
  );
  const pendingAmount = pendingInvoices.reduce(
    (sum, inv) => sum + (inv.total || 0),
    0,
  );
  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + (inv.total || 0),
    0,
  );
  const averageInvoice =
    paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  const collectionRate =
    filteredInvoices.length > 0
      ? Math.round((paidInvoices.length / filteredInvoices.length) * 100)
      : 0;

  // Revenue is bucketed by WHEN THE MONEY ARRIVED, not by when the invoice was
  // raised.
  //
  // Every chart here used `created_date` for both, so an invoice sent in
  // January and paid in April counted as January revenue -- the chart was
  // labelled revenue and was showing invoicing. revenueDate() prefers
  // paid_date, then the last recorded payment, and only falls back to the
  // creation date for a historic invoice marked paid by hand with no date on
  // it at all, which is the best that can be said about those.
  //
  // Money in and work invoiced are genuinely different questions, so `pending`
  // stays bucketed by creation date: an unpaid invoice has no payment date to
  // be bucketed by.
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(new Date(), 11 - i);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const paid = invoices
      .filter((inv) => inv.status === "paid")
      .filter((inv) => {
        const d = revenueDate(inv, paymentsByInvoice.get(inv.id) || []);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const pending = invoices
      .filter((inv) => inv.status === "sent")
      .filter((inv) => {
        const d = new Date(inv.created_date);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    return {
      month: format(month, "MMM"),
      paid,
      pending,
      total: paid + pending,
    };
  });

  const last6Revenue = monthlyData.slice(-6).map((m) => m.paid);
  const last6Total = monthlyData.slice(-6).map((m) => m.total);

  const revenueTrendData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthInvoices = invoices.filter((inv) => {
      if (inv.status !== "paid") return false;
      const d = revenueDate(inv, paymentsByInvoice.get(inv.id) || []);
      return d >= monthStart && d <= monthEnd;
    });
    return {
      month: format(month, "MMM"),
      revenue: monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
    };
  });

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const jobsCompletedThisMonth = jobs.filter((job) => {
    if (job.status !== "completed") return false;
    const completedDate = new Date(job.completed_at || job.created_date);
    return (
      completedDate >= currentMonthStart && completedDate <= currentMonthEnd
    );
  }).length;

  const jobTypeCategories = [
    "HVAC",
    "Electrical",
    "Plumbing",
    "Roofing",
    "Painting",
    "Carpentry",
    "Landscaping",
    "General",
  ];

  const revenueByJobType = jobTypeCategories
    .map((type) => {
      const typeJobs = jobs.filter((job) => {
        const searchText = (
          (job.job_title || "") +
          " " +
          (job.description || "")
        ).toLowerCase();
        if (type === "General") {
          return !jobTypeCategories
            .slice(0, -1)
            .some((cat) => searchText.includes(cat.toLowerCase()));
        }
        return searchText.includes(type.toLowerCase());
      });
      const linkedInvoiceIds = typeJobs
        .map((j) => j.linked_invoice_id)
        .filter(Boolean);
      const typeRevenue = invoices
        .filter(
          (inv) => inv.status === "paid" && linkedInvoiceIds.includes(inv.id),
        )
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      return { type, revenue: typeRevenue };
    })
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const totalJobTypeRevenue = revenueByJobType.reduce(
    (sum, item) => sum + item.revenue,
    0,
  );
  const revenueByJobTypeWithPercent = revenueByJobType.map((item) => ({
    ...item,
    percentage:
      totalJobTypeRevenue > 0
        ? Math.round((item.revenue / totalJobTypeRevenue) * 100)
        : 0,
  }));

  const revenueByClient = Object.entries(groupBy(paidInvoices, "client_name"))
    .map(([clientName, clientInvoices]) => ({
      name: clientName,
      revenue: sumBy(clientInvoices, "total"),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const currentMonthRevenue = monthlyData[monthlyData.length - 1]?.paid || 0;
  const lastMonthRevenue = monthlyData[monthlyData.length - 2]?.paid || 0;
  const growthRate =
    lastMonthRevenue > 0
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

  const statsData = [
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      subtext: `${paidInvoices.length} invoices paid`,
      trend: growthRate,
      color: "emerald",
      sparkline: last6Revenue,
    },
    {
      title: "Average Invoice",
      value: `$${Math.round(averageInvoice).toLocaleString()}`,
      subtext: "Per transaction",
      trend: 12.5,
      color: "blue",
      sparkline: last6Total,
    },
    {
      title: "Jobs Completed",
      value: jobsCompletedThisMonth.toString(),
      subtext: "This month",
      trend: 8.2,
      color: "amber",
    },
    {
      title: "Active Clients",
      value: clients.length.toString(),
      subtext: "Total accounts",
      trend: 15.3,
      color: "violet",
    },
  ];

  const catColors = [
    token("success-500"),
    token("accent-500"),
    token("success-600"),
    token("accent-600"),
    token("success-700"),
  ];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading analytics
            </p>
            <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══ RENDER ═══ */
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 min-h-screen">
      {/* ── Header ── */}
      <FadeIn>
        <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-6 shadow-sm mb-4 sm:mb-6 border border-line-subtle dark:border-ink-800">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <BarChart3 className="w-5 h-5 text-content-inverted" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl text-content dark:text-content-inverted">
                    Analytics
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 dark:bg-success-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success-600 dark:text-success-400 border border-success-500/20 dark:border-success-500/30 flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-success-500 dark:bg-success-400 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle">
                  Track revenue & performance
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <DateRangeFilter
                dateRange={dateRange}
                setDateRange={setDateRange}
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Chase Invoice promo ── */}
      <FadeIn delay={0.03}>
        <div className="mb-4 sm:mb-6">
          <ChaseInvoiceBanner variant="analytics" />
        </div>
      </FadeIn>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <FadeIn delay={0.05}>
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto inline-flex rounded-xl bg-ink-100 dark:bg-ink-800 p-1 border border-line/50 dark:border-ink-700/50 relative z-20">
            <TabsTrigger
              value="overview"
              className="flex-1 sm:flex-none rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-surface dark:data-[state=active]:bg-surface-inverted data-[state=active]:shadow-sm data-[state=active]:text-content dark:data-[state=active]:text-content-inverted text-content-body dark:text-content-subtle"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="flex-1 sm:flex-none rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-surface dark:data-[state=active]:bg-surface-inverted data-[state=active]:shadow-sm data-[state=active]:text-content dark:data-[state=active]:text-content-inverted text-content-body dark:text-content-subtle"
            >
              <Zap className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>
        </FadeIn>

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          {/* ── Revenue Hero Banner ── */}
          <FadeIn>
            <div className="relative overflow-hidden rounded-2xl bg-success-600 p-4 sm:p-7">
              <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-surface/10 blur-sm dark:bg-surface-inverted/10" />
              <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-surface/5 dark:bg-surface-inverted/5" />

              <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-success-100 text-xs font-semibold uppercase tracking-widest mb-1">
                    Total Revenue
                  </p>
                  <p className="text-2xl sm:text-4xl lg:text-5xl font-bold text-content-inverted tracking-tight">
                    ${totalRevenue.toLocaleString()}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface/20 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-content-inverted whitespace-nowrap dark:bg-surface-inverted/20">
                      {growthRate >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(growthRate).toFixed(1)}% vs last month
                    </span>
                    <span className="text-xs text-success-100 whitespace-nowrap">
                      {paidInvoices.length} invoices collected
                    </span>
                  </div>
                </div>

                {/* Mini monthly sparkline on desktop */}
                <div className="hidden sm:block flex-shrink-0">
                  <svg width="140" height="48" className="opacity-60">
                    {(() => {
                      const data = monthlyData.slice(-6).map((m) => m.paid);
                      if (data.length < 2) return null;
                      const max = Math.max(...data) || 1;
                      const min = Math.min(...data);
                      const range = max - min || 1;
                      const w = 140;
                      const h = 48;
                      const points = data
                        .map(
                          (v, i) =>
                            `${(i / (data.length - 1)) * w},${h - 4 - ((v - min) / range) * (h - 8)}`,
                        )
                        .join(" ");
                      return (
                        <polyline
                          points={points}
                          fill="none"
                          stroke="rgba(255,255,255,0.8)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })()}
                  </svg>
                  <p className="text-[10px] text-success-200 mt-0.5 text-right">
                    Last 6 months
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {statsData.map((stat, idx) => (
              <StatCard key={stat.title} stat={stat} index={idx} />
            ))}
          </div>

          {/* ── Invoice Pipeline ── */}
          <FadeIn delay={0.15}>
            <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                    <Receipt className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-content dark:text-content-inverted">
                      Invoice Pipeline
                    </h3>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      Current status breakdown
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success-500 dark:text-success-400" />
                  <span className="text-xs font-bold text-ink-700 dark:text-ink-300 tabular-nums">
                    {collectionRate}%
                  </span>
                  <span className="text-xs text-content-subtle dark:text-content-muted">
                    collected
                  </span>
                </div>
              </div>

              {/* Pipeline bar */}
              <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                {totalRevenue + pendingAmount + overdueAmount > 0 ? (
                  <>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(totalRevenue / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full bg-success-500"
                    />

                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(pendingAmount / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="h-full bg-warning-400"
                    />

                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(overdueAmount / (totalRevenue + pendingAmount + overdueAmount)) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="h-full bg-danger-400"
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-ink-100 dark:bg-ink-800" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StatusPill
                  label="Paid"
                  count={paidInvoices.length}
                  amount={totalRevenue}
                  color="bg-success-100 dark:bg-success-900/40 border border-success-200 dark:border-success-800/50"
                />
                <StatusPill
                  label="Pending"
                  count={pendingInvoices.length}
                  amount={pendingAmount}
                  color="bg-brand-100 dark:bg-brand-900/40 border border-info-200 dark:border-info-800/50"
                />
                <StatusPill
                  label="Overdue"
                  count={overdueInvoices.length}
                  amount={overdueAmount}
                  color="bg-blush-100 dark:bg-blush-900/40 border border-blush-200 dark:border-blush-800/50"
                />
              </div>
            </div>
          </FadeIn>

          {/* ── Charts Row 1: Revenue Trend (2/3) + Categories (1/3) ── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <FadeIn delay={0.2} className="lg:col-span-2">
              <div className="h-full rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
                      <TrendingUp className="h-4 w-4 text-success-600 dark:text-success-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-content dark:text-content-inverted">
                        Revenue Trend
                      </h3>
                      <p className="text-xs text-content-subtle dark:text-content-muted">
                        Last 6 months performance
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 px-2.5 py-1 text-[11px] font-medium text-content-muted dark:text-content-subtle">
                    <TrendingUp className="h-3 w-3" />
                    6-month view
                  </span>
                </div>

                {/* Summary row */}
                <div className="flex items-center gap-4 mt-3 mb-4 pb-4 border-b border-line-subtle dark:border-ink-800">
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-content dark:text-content-inverted tabular-nums">
                      ${currentMonthRevenue.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-content-subtle dark:text-content-muted">
                      This month
                    </p>
                  </div>
                  <div className="h-8 w-px bg-ink-100 dark:bg-ink-800" />
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-content-subtle dark:text-content-muted tabular-nums">
                      ${lastMonthRevenue.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-content-subtle dark:text-content-muted">
                      Last month
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-bold ${
                        growthRate >= 0
                          ? "text-success-600 dark:text-success-400"
                          : "text-danger-500 dark:text-danger-400"
                      }`}
                    >
                      {growthRate >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {Math.abs(growthRate).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="h-48 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={token("ink-100")}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fontSize: 11,
                          fill: token("ink-400"),
                          fontWeight: 500,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tickFormatter={(v) =>
                          `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                        }
                        width={48}
                        tick={{
                          fontSize: 11,
                          fill: token("ink-400"),
                          fontWeight: 500,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={token("success-500")}
                        strokeWidth={2.5}
                        fill={token("success-500")}
                        fillOpacity={0.08}
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: token("success-500"),
                          strokeWidth: 2,
                          stroke: "#fff",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FadeIn>

            {/* Categories */}
            <FadeIn delay={0.25}>
              <div className="h-full rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                    <PieChart className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-content dark:text-content-inverted">
                      Revenue by Category
                    </h3>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      Job type breakdown
                    </p>
                  </div>
                </div>
                <div className="space-y-3.5">
                  {revenueByJobTypeWithPercent.length > 0 ? (
                    revenueByJobTypeWithPercent.slice(0, 5).map((item, idx) => (
                      <div key={item.type}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  catColors[idx % catColors.length],
                              }}
                            />

                            <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
                              {item.type}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                            ${(item.revenue / 1000).toFixed(1)}k
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percentage}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.3 + idx * 0.1,
                            }}
                            className="h-full rounded-full"
                            style={{
                              backgroundColor:
                                catColors[idx % catColors.length],
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-content-subtle dark:text-content-muted mt-0.5">
                          {item.percentage}% of total
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
                      <PieChart className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No job data yet</p>
                      <p className="text-xs mt-1">
                        Link jobs to invoices to see breakdowns
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          </div>

          {/* ── Quote Conversion Funnel + Monthly Bar ── */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Quote Funnel */}
            <FadeIn delay={0.28}>
              <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
                    <FileText className="h-4 w-4 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-content dark:text-content-inverted">
                      Quote Funnel
                    </h3>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      Conversion pipeline
                    </p>
                  </div>
                </div>

                {(() => {
                  const total = quotes.length;
                  const accepted = quotes.filter(
                    (q) => q.status === "accepted" || q.status === "converted",
                  ).length;
                  const pending = quotes.filter(
                    (q) =>
                      q.status === "sent" ||
                      q.status === "pending" ||
                      q.status === "viewed",
                  ).length;
                  const declined = quotes.filter(
                    (q) => q.status === "declined" || q.status === "rejected",
                  ).length;
                  const draft = quotes.filter(
                    (q) => q.status === "draft",
                  ).length;
                  const conversionRate =
                    total > 0 ? Math.round((accepted / total) * 100) : 0;

                  if (total === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
                        <FileText className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No quotes yet</p>
                        <p className="text-xs mt-1">
                          Create quotes to track conversions
                        </p>
                      </div>
                    );
                  }

                  const stages = [
                    {
                      label: "Total Sent",
                      count: total,
                      color: "bg-ink-200 dark:bg-ink-700",
                      textColor: "text-content-body dark:text-content-subtle",
                    },
                    {
                      label: "Pending",
                      count: pending,
                      color: "bg-warning-400",
                      textColor: "text-warning-700 dark:text-warning-500",
                    },
                    {
                      label: "Accepted",
                      count: accepted,
                      color: "bg-success-500",
                      textColor: "text-success-700 dark:text-success-400",
                    },
                    {
                      label: "Declined",
                      count: declined,
                      color: "bg-danger-400",
                      textColor: "text-danger-600 dark:text-danger-400",
                    },
                  ];

                  return (
                    <div className="space-y-4">
                      {/* Conversion rate highlight */}
                      <div className="text-center py-3 rounded-xl bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700">
                        <p className="text-2xl font-bold text-content dark:text-content-inverted tabular-nums">
                          {conversionRate}%
                        </p>
                        <p className="text-[11px] font-medium text-content-subtle dark:text-content-muted uppercase tracking-wider">
                          Conversion Rate
                        </p>
                      </div>

                      {/* Funnel stages */}
                      <div className="space-y-2">
                        {stages.map((stage) => (
                          <div
                            key={stage.label}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.color}`}
                            />
                            <span className="text-xs font-medium text-content-body dark:text-content-subtle flex-1">
                              {stage.label}
                            </span>
                            <span
                              className={`text-xs font-bold tabular-nums ${stage.textColor}`}
                            >
                              {stage.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </FadeIn>

            {/* Monthly bar chart — 2 cols */}
            <FadeIn delay={0.3} className="lg:col-span-2">
              <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                      <BarChart3 className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-content dark:text-content-inverted">
                        Monthly Overview
                      </h3>
                      <p className="text-xs text-content-subtle dark:text-content-muted">
                        12-month revenue comparison
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-subtle">
                      <span className="h-2 w-2 rounded-full bg-success-500" />
                      Paid
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-content-muted">
                      <span className="h-2 w-2 rounded-full bg-warning-400" />
                      Pending
                    </span>
                  </div>
                </div>
                <div className="h-48 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} barGap={2}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={token("ink-100")}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fontSize: 11,
                          fill: token("ink-400"),
                          fontWeight: 500,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tickFormatter={(v) =>
                          `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                        }
                        width={48}
                        tick={{
                          fontSize: 11,
                          fill: token("ink-400"),
                          fontWeight: 500,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="paid"
                        fill={token("success-500")}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      />
                      <Bar
                        dataKey="pending"
                        fill={token("warning-400")}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* ── Top Clients + Recent Activity ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top Clients */}
            <FadeIn delay={0.35}>
              <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
                    <Users className="h-4 w-4 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-content dark:text-content-inverted">
                      Top Clients
                    </h3>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      Highest revenue customers
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {revenueByClient.map((client, idx) => {
                    const maxRev = revenueByClient[0]?.revenue || 1;
                    const pct = Math.round((client.revenue / maxRev) * 100);
                    const avatarColors = [
                      "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400",
                      "bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400",
                      "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300",
                      "bg-accent-100 text-accent-800 dark:bg-accent-900/30 dark:text-accent-300",
                      "bg-positive-100 text-positive-700 dark:bg-positive-900/30 dark:text-positive-400",
                    ];

                    return (
                      <motion.div
                        key={client.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.4 + idx * 0.06 }}
                        className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-surface-sunken dark:hover:bg-ink-800"
                      >
                        <span className="text-[11px] font-bold text-ink-300 dark:text-content-body w-3 text-right tabular-nums dark:dark:text-ink-300">
                          {idx + 1}
                        </span>
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            avatarColors[idx % avatarColors.length]
                          }`}
                        >
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-200">
                            {client.name}
                          </p>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{
                                duration: 0.6,
                                delay: 0.5 + idx * 0.06,
                              }}
                              className="h-full rounded-full bg-ink-300 dark:bg-ink-600 group-hover:bg-success-300 dark:group-hover:bg-success-500 transition-colors"
                            />
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                          ${client.revenue.toLocaleString()}
                        </span>
                      </motion.div>
                    );
                  })}
                  {revenueByClient.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
                      <Users className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No client revenue data yet</p>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>

            {/* Recent Activity */}
            <FadeIn delay={0.4}>
              <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
                    <Clock className="h-4 w-4 text-content-body dark:text-content-subtle" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-content dark:text-content-inverted">
                      Recent Activity
                    </h3>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      Latest invoice & job updates
                    </p>
                  </div>
                </div>

                <div className="space-y-0.5">
                  {(() => {
                    // Combine recent invoices and jobs into an activity feed
                    const activities = [
                      ...invoices.slice(0, 5).map((inv) => ({
                        type: "invoice",
                        title: inv.client_name || "Invoice",
                        amount: inv.total,
                        status: inv.status,
                        date: inv.created_date,
                      })),
                      ...jobs.slice(0, 3).map((job) => ({
                        type: "job",
                        title: job.job_title || job.client_name || "Job",
                        status: job.status,
                        date: job.created_date,
                      })),
                    ]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 6);

                    if (activities.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 text-content-subtle dark:text-content-muted">
                          <Clock className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-sm">No recent activity</p>
                        </div>
                      );
                    }

                    const statusStyles = {
                      paid: {
                        dot: "bg-success-500",
                        label: "Paid",
                        text: "text-success-700 dark:text-success-400",
                      },
                      sent: {
                        dot: "bg-info-400",
                        label: "Sent",
                        text: "text-info-700 dark:text-info-400",
                      },
                      pending: {
                        dot: "bg-warning-400",
                        label: "Pending",
                        text: "text-warning-700 dark:text-warning-400",
                      },
                      overdue: {
                        dot: "bg-danger-400",
                        label: "Overdue",
                        text: "text-danger-600 dark:text-danger-400",
                      },
                      draft: {
                        dot: "bg-ink-300 dark:bg-ink-600",
                        label: "Draft",
                        text: "text-content-muted dark:text-content-subtle",
                      },
                      completed: {
                        dot: "bg-success-500",
                        label: "Completed",
                        text: "text-success-700 dark:text-success-400",
                      },
                      in_progress: {
                        dot: "bg-info-400",
                        label: "In Progress",
                        text: "text-info-700 dark:text-info-400",
                      },
                      scheduled: {
                        dot: "bg-brand-400",
                        label: "Scheduled",
                        text: "text-brand-700 dark:text-brand-400",
                      },
                    };

                    return activities.map((act, idx) => {
                      const s = statusStyles[act.status] || statusStyles.draft;
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.45 + idx * 0.05 }}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors"
                        >
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${s.dot}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-800 dark:text-ink-200 truncate">
                              {act.title}
                            </p>
                            <p className="text-[11px] text-content-subtle dark:text-content-muted">
                              {act.type === "invoice" ? "Invoice" : "Job"} ·{" "}
                              {(() => {
                                try {
                                  const d = new Date(act.date);
                                  return format(d, "MMM d");
                                } catch {
                                  return "";
                                }
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {act.amount && (
                              <span className="text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                                ${act.amount.toLocaleString()}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.text} bg-surface-sunken dark:bg-ink-800`}
                            >
                              {s.label}
                            </span>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>
            </FadeIn>
          </div>
        </TabsContent>

        {/* ═══ INSIGHTS TAB ═══ */}
        <TabsContent value="insights" className="space-y-6 mt-0">
          {/* ── Business Health Score Hero ── */}
          <FadeIn>
            <div className="relative overflow-hidden rounded-2xl bg-surface-inverted p-5 sm:p-8">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-success-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

              <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
                {/* Score Ring */}
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="relative h-28 w-28 sm:h-32 sm:w-32">
                    <svg
                      className="h-full w-full -rotate-90"
                      viewBox="0 0 120 120"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke={(() => {
                          const score = Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                collectionRate * 0.4 +
                                  Math.min(growthRate, 50) * 0.3 +
                                  Math.min(clients.length, 10) * 3 +
                                  (jobsCompletedThisMonth > 0 ? 15 : 0),
                              ),
                            ),
                          );
                          if (score >= 70) return token("success-500");
                          if (score >= 40) return token("accent-500");
                          return token("danger-500");
                        })()}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(() => {
                          const score = Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                collectionRate * 0.4 +
                                  Math.min(growthRate, 50) * 0.3 +
                                  Math.min(clients.length, 10) * 3 +
                                  (jobsCompletedThisMonth > 0 ? 15 : 0),
                              ),
                            ),
                          );
                          return (score / 100) * 327;
                        })()} 327`}
                        style={{ transition: "stroke-dasharray 1.5s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold text-content-inverted tabular-nums">
                        {Math.min(
                          100,
                          Math.max(
                            0,
                            Math.round(
                              collectionRate * 0.4 +
                                Math.min(growthRate, 50) * 0.3 +
                                Math.min(clients.length, 10) * 3 +
                                (jobsCompletedThisMonth > 0 ? 15 : 0),
                            ),
                          ),
                        )}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
                        Score
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-success-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-success-400">
                      Business Health
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-content-inverted mb-2">
                    {(() => {
                      const score = Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            collectionRate * 0.4 +
                              Math.min(growthRate, 50) * 0.3 +
                              Math.min(clients.length, 10) * 3 +
                              (jobsCompletedThisMonth > 0 ? 15 : 0),
                          ),
                        ),
                      );
                      if (score >= 80) return "Your business is thriving";
                      if (score >= 60) return "Solid performance overall";
                      if (score >= 40) return "Room for improvement";
                      return "Needs attention";
                    })()}
                  </h2>
                  <p className="text-sm text-content-subtle leading-relaxed max-w-lg">
                    Based on your collection rate, revenue growth, client base,
                    and job completion metrics over the selected period.
                  </p>

                  {/* Score breakdown mini-bars */}
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      {
                        label: "Collections",
                        value: collectionRate,
                        max: 100,
                        color: token("success-500"),
                      },
                      {
                        label: "Growth",
                        value: Math.min(Math.max(growthRate, 0), 100),
                        max: 100,
                        color: token("accent-500"),
                      },
                      {
                        label: "Client Base",
                        value: Math.min(clients.length * 10, 100),
                        max: 100,
                        color: token("success-600"),
                      },
                      {
                        label: "Activity",
                        value: jobsCompletedThisMonth > 0 ? 75 : 10,
                        max: 100,
                        color: token("accent-600"),
                      },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-content-muted">
                            {metric.label}
                          </span>
                          <span className="text-[11px] font-bold text-ink-300 tabular-nums">
                            {Math.round(metric.value)}%
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-surface/10 dark:bg-surface-inverted/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metric.value}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: metric.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* ── Key Insight Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Revenue Insight */}
            <FadeIn delay={0.1}>
              <div className="rounded-2xl border border-success-200/60 dark:border-success-800/60 bg-success-50/30 dark:bg-success-900/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
                    <DollarSign className="h-4 w-4 text-success-600 dark:text-success-400" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                    Revenue
                  </span>
                </div>
                <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
                  {growthRate > 0
                    ? `Revenue grew ${Math.abs(growthRate).toFixed(1)}% this month. ${
                        growthRate > 20
                          ? "Exceptional growth — keep this momentum going."
                          : "Steady upward trajectory."
                      }`
                    : growthRate < 0
                      ? `Revenue declined ${Math.abs(growthRate).toFixed(1)}% this month. Consider following up on pending invoices or increasing outreach.`
                      : "Revenue has been stable. Look for opportunities to upsell existing clients."}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      growthRate >= 0
                        ? "bg-success-50 dark:bg-success-900/50 text-success-700 dark:text-success-300"
                        : "bg-danger-50 dark:bg-danger-900/50 text-danger-600 dark:text-danger-300"
                    }`}
                  >
                    {growthRate >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(growthRate).toFixed(1)}% vs last month
                  </span>
                </div>
              </div>
            </FadeIn>

            {/* Collection Insight */}
            <FadeIn delay={0.15}>
              <div className="rounded-2xl border border-accent-200/60 dark:border-accent-800/60 bg-accent-50/30 dark:bg-accent-900/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                    <CheckCircle2 className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                    Collections
                  </span>
                </div>
                <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
                  {collectionRate >= 80
                    ? `Excellent collection rate at ${collectionRate}%. Your invoicing process is working well.`
                    : collectionRate >= 50
                      ? `Collection rate is ${collectionRate}%. ${pendingInvoices.length} invoices are still pending — consider sending reminders.`
                      : `Collection rate is ${collectionRate}%. ${pendingInvoices.length + overdueInvoices.length} invoices need attention. Send a reminder from Get Paid.`}
                </p>
                {overdueAmount > 0 && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 dark:bg-danger-900/50 px-2 py-0.5 text-[11px] font-bold text-danger-700 dark:text-danger-300">
                      <AlertCircle className="h-3 w-3" />$
                      {overdueAmount.toLocaleString()} overdue
                    </span>
                  </div>
                )}
                {overdueAmount === 0 && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-900/50 px-2 py-0.5 text-[11px] font-bold text-success-700 dark:text-success-300">
                      <CheckCircle2 className="h-3 w-3" />
                      No overdue invoices
                    </span>
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Client Insight */}
            <FadeIn delay={0.2}>
              <div className="rounded-2xl border border-success-200/60 dark:border-success-800/60 bg-success-50/30 dark:bg-success-900/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 dark:bg-success-500/20">
                    <Users className="h-4 w-4 text-success-600 dark:text-success-400" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle dark:text-content-muted">
                    Clients
                  </span>
                </div>
                <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
                  {clients.length === 0
                    ? "No clients yet. Start by adding your first client to begin tracking revenue."
                    : clients.length <= 3
                      ? `You have ${clients.length} active client${clients.length > 1 ? "s" : ""}. ${
                          revenueByClient.length > 0
                            ? `${revenueByClient[0].name} is your top earner at $${revenueByClient[0].revenue.toLocaleString()}.`
                            : "Focus on building recurring relationships."
                        }`
                      : `${clients.length} active clients. ${
                          revenueByClient.length > 0
                            ? `Top client contributes $${revenueByClient[0].revenue.toLocaleString()} in revenue.`
                            : ""
                        } Good diversification.`}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-900/50 px-2 py-0.5 text-[11px] font-bold text-success-700 dark:text-success-300">
                    <Users className="h-3 w-3" />
                    {clients.length} active
                  </span>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* ── Actionable Recommendations ── */}
          <FadeIn delay={0.25}>
            <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 dark:bg-accent-500/20">
                  <Zap className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-content dark:text-content-inverted">
                    Recommended Actions
                  </h3>
                  <p className="text-xs text-content-subtle dark:text-content-muted">
                    Prioritized steps to improve your business
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  const actions = [];

                  if (overdueInvoices.length > 0) {
                    actions.push({
                      priority: "high",
                      icon: AlertCircle,
                      title: `Follow up on ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""}`,
                      description: `$${overdueAmount.toLocaleString()} is past due. Send payment reminders to recover this revenue.`,
                      color: "red",
                    });
                  }

                  if (pendingInvoices.length > 3) {
                    actions.push({
                      priority: "medium",
                      icon: Clock,
                      title: `${pendingInvoices.length} invoices awaiting payment`,
                      description: `$${pendingAmount.toLocaleString()} pending. Consider offering early payment discounts.`,
                      color: "amber",
                    });
                  }

                  if (clients.length < 5) {
                    actions.push({
                      priority: "medium",
                      icon: Users,
                      title: "Expand your client base",
                      description:
                        "Having fewer than 5 clients increases revenue concentration risk. Diversify with outreach.",
                      color: "violet",
                    });
                  }

                  if (growthRate < 0) {
                    actions.push({
                      priority: "medium",
                      icon: TrendingUp,
                      title: "Revenue is declining",
                      description:
                        "Consider upselling current clients, raising rates, or increasing marketing efforts.",
                      color: "blue",
                    });
                  }

                  if (quotes.length > 0) {
                    const unconverted = quotes.filter(
                      (q) =>
                        q.status !== "accepted" && q.status !== "converted",
                    );
                    if (unconverted.length > 0) {
                      actions.push({
                        priority: "low",
                        icon: FileText,
                        title: `${unconverted.length} quote${unconverted.length > 1 ? "s" : ""} need follow-up`,
                        description:
                          "Unconverted quotes represent potential revenue. Reach out to close these deals.",
                        color: "blue",
                      });
                    }
                  }

                  if (actions.length === 0) {
                    actions.push({
                      priority: "low",
                      icon: CheckCircle2,
                      title: "Everything looks great!",
                      description:
                        "No urgent actions needed. Keep up the good work and continue monitoring your metrics.",
                      color: "emerald",
                    });
                  }

                  const priorityColors = {
                    red: {
                      bg: "bg-danger-50 dark:bg-danger-900/20",
                      border: "border-danger-100 dark:border-danger-800/60",
                      badge:
                        "bg-danger-100 dark:bg-danger-900/50 text-danger-700 dark:text-danger-300",
                      icon: "text-danger-500 dark:text-danger-400",
                    },
                    amber: {
                      bg: "bg-warning-50 dark:bg-warning-900/20",
                      border: "border-warning-100 dark:border-warning-800/60",
                      badge:
                        "bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-300",
                      icon: "text-warning-500 dark:text-warning-400",
                    },
                    violet: {
                      bg: "bg-accent-50 dark:bg-accent-900/20",
                      border: "border-accent-100 dark:border-accent-800/60",
                      badge:
                        "bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300",
                      icon: "text-accent-500 dark:text-accent-400",
                    },
                    blue: {
                      bg: "bg-success-50 dark:bg-success-900/20",
                      border: "border-success-100 dark:border-success-800/60",
                      badge:
                        "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-300",
                      icon: "text-success-500 dark:text-success-400",
                    },
                    emerald: {
                      bg: "bg-success-50 dark:bg-success-900/20",
                      border: "border-success-100 dark:border-success-800/60",
                      badge:
                        "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-300",
                      icon: "text-success-500 dark:text-success-400",
                    },
                  };

                  return actions.map((action, idx) => {
                    const c = priorityColors[action.color];
                    const ActionIcon = action.icon;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 + idx * 0.08 }}
                        className={`flex items-start gap-3 rounded-xl ${c.bg} border ${c.border} px-4 py-3.5`}
                      >
                        <ActionIcon
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${c.icon}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-800 dark:text-ink-200">
                            {action.title}
                          </p>
                          <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5 leading-relaxed">
                            {action.description}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}
                        >
                          {action.priority}
                        </span>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </div>
          </FadeIn>

          {/* ── AI Smart Insights (existing component) ── */}
          <FadeIn delay={0.3}>
            <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10 dark:bg-success-500/20">
                  <Sparkles className="h-5 w-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-content dark:text-content-inverted">
                    AI Deep Analysis
                  </h3>
                  <p className="text-xs text-content-subtle dark:text-content-muted">
                    Advanced pattern recognition across your business data
                  </p>
                </div>
              </div>
              <SmartInsights
                invoices={filteredInvoices}
                clients={clients}
                jobs={jobs}
                quotes={quotes}
              />
            </div>
          </FadeIn>
        </TabsContent>
      </Tabs>
    </div>
  );
}
