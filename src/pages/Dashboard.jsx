import React, { useState, useEffect, useMemo } from "react";
import { token } from "@/lib/tokens";
import { Link, useNavigate } from "react-router-dom";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { canAccessFeature } from "@/components/utils/permissions";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
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

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "emerald",
  trend,
  onClick,
  alert,
}) => {
  const colorClasses = {
    emerald:
      "bg-success-50 text-success-600 border-success-100 dark:bg-success-900/30 dark:text-success-400 dark:border-success-800",
    blue: "bg-info-50 text-info-600 border-info-100 dark:bg-info-900/30 dark:text-info-400 dark:border-info-800",
    purple:
      "bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800",
    orange:
      "bg-alert-50 text-alert-600 border-alert-100 dark:bg-alert-900/30 dark:text-alert-400 dark:border-alert-800",
    red: "bg-danger-50 text-danger-600 border-danger-100 dark:bg-danger-900/30 dark:text-danger-400 dark:border-danger-800",
    yellow:
      "bg-caution-50 text-caution-600 border-caution-100 dark:bg-caution-900/30 dark:text-caution-400 dark:border-caution-800",
  };

  return (
    <Card
      className={`border-none shadow-sm hover:shadow-lg transition-all duration-300 ${onClick ? "cursor-pointer" : ""} group ${alert ? "ring-2 ring-danger-400 dark:ring-danger-500" : ""} bg-surface dark:bg-ink-800 border border-line-subtle dark:border-ink-700`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-content-body dark:text-content-subtle">
              {title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted tracking-tight truncate">
              {value}
            </p>
            {subtitle && (
              <p
                className={`text-xs sm:text-sm font-normal ${alert ? "text-danger-600 dark:text-danger-400" : "text-content-muted dark:text-content-subtle"} truncate`}
              >
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-xs font-semibold text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/30 px-2 py-1 rounded-full w-fit">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </div>
            )}
          </div>
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center border-2 group-hover:scale-110 transition-transform flex-shrink-0`}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Action Button
const QuickAction = ({
  to,
  icon: Icon,
  title,
  description,
  color,
  delay = 0,
}) => {
  const colorClasses = {
    emerald:
      "bg-success-500 hover:shadow-success-200 dark:hover:shadow-success-900/30",
    blue: "bg-brand-600 hover:shadow-info-200 dark:hover:shadow-info-900/30",
    purple:
      "bg-brand-500 hover:shadow-brand-200 dark:hover:shadow-brand-900/30",
    orange:
      "bg-alert-500 hover:shadow-alert-200 dark:hover:shadow-alert-900/30",
  };

  return (
    <Link to={to} className="block group">
      <div
        className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 ${colorClasses[color]} text-content-inverted shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full min-h-[140px] sm:min-h-[160px]`}
      >
        <div className="relative z-10">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-surface/20 backdrop-blur-sm flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform dark:bg-surface-inverted/20">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted" />
          </div>
          <h3 className="text-base sm:text-lg font-black mb-1">{title}</h3>
          <p className="text-sm text-content-inverted/90 leading-tight">
            {description}
          </p>
        </div>
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-5 h-5" />
        </div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-surface/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 dark:bg-surface-inverted/10" />
      </div>
    </Link>
  );
};

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
      className="flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700/50 transition-all cursor-pointer border border-transparent hover:border-line dark:hover:border-ink-600 group"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg ${invoice.status === "paid" ? "bg-success-100 dark:bg-success-900/30" : "bg-ink-100 dark:bg-ink-700"} flex items-center justify-center flex-shrink-0`}
        >
          <Receipt
            className={`w-5 h-5 sm:w-6 sm:h-6 ${invoice.status === "paid" ? "text-success-600 dark:text-success-400" : "text-content-body dark:text-content-subtle"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-content dark:text-content-inverted text-sm sm:text-base truncate">
              {invoice.invoice_number ||
                `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
            </p>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${status.bg} ${status.text} ${status.border} flex-shrink-0`}
            >
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-content-muted dark:text-content-subtle truncate">
            {invoice.client_name}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="font-bold text-content dark:text-content-inverted text-base sm:text-lg whitespace-nowrap">
          ${invoice.total?.toFixed(2)}
        </p>
        <p className="text-xs text-content-subtle dark:text-content-muted">
          {invoice.created_date &&
            format(new Date(invoice.created_date), "MMM d")}
        </p>
      </div>
    </div>
  );
};

// Accent per tile: the chip colour, its glow, and the border tint. Kept as
// token classes (not inline styles) so both themes are covered.
const QUICK_ACTIONS = [
  {
    to: createPageUrl("QuickInvoice"),
    icon: FileText,
    title: "Invoice",
    description: "Photo or words — AI bills it",
    accent: {
      chip: "bg-success-500",
      glow: "shadow-success-500/30",
      border: "border-success-200 dark:border-success-500/25",
    },
  },
  {
    to: createPageUrl("QuickQuote"),
    icon: ClipboardList,
    title: "Quote",
    description: "Estimate any job in seconds",
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
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
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
        clientData,
        settingsData,
        recurringData,
        subscriptionData,
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
        sdk.entities.Client.filter(
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
      ]);

      setInvoices(invoiceData);
      setQuotes(quoteData);
      setClients(clientData);
      setSettings(settingsData.length > 0 ? settingsData[0] : null);
      setRecurringInvoices(recurringData);
      setSubscription(subscriptionData.length > 0 ? subscriptionData[0] : null);

      // Generate chart data
      const sixMonths = Array.from({ length: 6 }, (_, i) => {
        const month = subMonths(new Date(), 5 - i);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthInvoices = invoiceData.filter((inv) => {
          const invDate = new Date(inv.created_date);
          return invDate >= monthStart && invDate <= monthEnd;
        });

        const paid = monthInvoices
          .filter((inv) => inv.status === "paid")
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
        const pending = monthInvoices
          .filter((inv) => inv.status === "sent")
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

      const [invoiceData, recurringData, quoteData, jobData, clientData] =
        await Promise.all([
          sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.RecurringInvoice.filter(
            { user_id: user.id },
            "-created_date",
          ),
          sdk.entities.Quote.filter({ user_id: user.id }, "-created_date"),
          sdk.entities.Job.filter({ user_id: user.id }, "-created_date"),
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
          inv.due_date ? format(new Date(inv.due_date), "yyyy-MM-dd") : "",
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

    const thisMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv.created_date);
      return date >= thisMonthStart && date <= thisMonthEnd;
    });

    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === "overdue") return true;
      if (inv.status === "sent" && inv.due_date && new Date(inv.due_date) < now)
        return true;
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
      thisMonthRevenue: thisMonthInvoices
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + (inv.total || 0), 0),
      thisMonthCount: thisMonthInvoices.length,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0,
      ),
    };
  }, [invoices]);

  const transactionStats = useMemo(() => {
    const used = subscription?.transactions_used_this_month || 0;
    const limit = subscription?.monthly_transaction_limit || 30;
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
          new Date(a.next_generation_date) - new Date(b.next_generation_date),
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
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-content-subtle dark:text-content-muted uppercase tracking-widest mb-1.5">
                Dashboard
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted tracking-tight truncate">
                {settings?.business_name || "Invoicium"}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden sm:inline-flex items-center bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-success-100 dark:border-success-800">
                Owner
              </span>
              <Button
                onClick={handleExportAll}
                disabled={exporting}
                variant="outline"
                className="rounded-lg border-line dark:border-ink-700 h-9 px-3 bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 hidden sm:flex text-sm font-medium"
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Export
              </Button>
            </div>
          </div>

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
            <p className="text-xs font-semibold text-content-muted uppercase tracking-widest mb-3">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.title} {...action} />
              ))}
            </div>
          </div>

          {/* Stats Cards - 2x2 Grid */}
          <div>
            <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-widest mb-3">
              Overview
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Total Revenue */}
              <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-5 shadow-sm border border-line-subtle dark:border-ink-800 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-success-600 dark:text-success-400" />
                  </div>
                  <p className="text-xs sm:text-sm lg:text-base font-medium text-content-body dark:text-content-subtle truncate leading-tight">
                    Total Revenue
                  </p>
                </div>
                <div className="mt-auto">
                  <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-content dark:text-content-inverted mb-1 sm:mb-2 tracking-tight truncate">
                    $
                    {stats.totalRevenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs sm:text-sm text-success-600 dark:text-success-400 flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">All time</span>
                  </p>
                </div>
              </div>

              {/* Pending */}
              <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-5 shadow-sm border border-line-subtle dark:border-ink-800 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-info-100 dark:bg-info-900/30 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-brand-700 dark:text-brand-400" />
                  </div>
                  <p className="text-xs sm:text-sm lg:text-base font-medium text-content-body dark:text-content-subtle truncate leading-tight">
                    Pending
                  </p>
                </div>
                <div className="mt-auto">
                  <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-content dark:text-content-inverted mb-1 sm:mb-2 tracking-tight truncate">
                    $
                    {stats.pendingAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                    {invoices.filter((inv) => inv.status === "sent").length}{" "}
                    invoices
                  </p>
                </div>
              </div>

              {/* Invoices Used */}
              <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-5 shadow-sm border border-line-subtle dark:border-ink-800 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <p className="text-xs sm:text-sm lg:text-base font-medium text-content-body dark:text-content-subtle truncate leading-tight">
                    Invoices
                  </p>
                </div>
                <div className="mt-auto">
                  <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-content dark:text-content-inverted mb-1 sm:mb-2 tracking-tight truncate">
                    {subscription?.transactions_used_this_month || 0}/
                    {subscription?.monthly_transaction_limit === -1
                      ? "∞"
                      : subscription?.monthly_transaction_limit || 0}
                  </p>
                  <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                    This month
                  </p>
                </div>
              </div>

              {/* This Month Revenue */}
              <div className="bg-surface dark:bg-surface-inverted rounded-2xl p-4 sm:p-5 shadow-sm border border-line-subtle dark:border-ink-800 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-alert-100 dark:bg-alert-900/30 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-alert-600 dark:text-alert-400" />
                  </div>
                  <p className="text-xs sm:text-sm lg:text-base font-medium text-content-body dark:text-content-subtle truncate leading-tight">
                    This Month
                  </p>
                </div>
                <div className="mt-auto">
                  <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-content dark:text-content-inverted mb-1 sm:mb-2 tracking-tight truncate">
                    $
                    {stats.thisMonthRevenue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                    {stats.thisMonthCount} invoices
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts & Recent Activity */}
          <div>
            <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-widest mb-3">
              Activity
            </p>
            <div className="grid lg:grid-cols-3 gap-5 sm:gap-6">
              {/* Revenue Chart */}
              <Card className="lg:col-span-2 border border-line dark:border-ink-800 shadow-sm bg-surface dark:bg-surface-inverted">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg sm:text-xl font-black text-content dark:text-content-inverted">
                        Revenue Overview
                      </CardTitle>
                      <CardDescription className="text-sm text-content-muted dark:text-content-subtle">
                        Last 6 months
                      </CardDescription>
                    </div>
                    <Link to={createPageUrl("Analytics")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-success-700 dark:text-success-400 flex-shrink-0 hover:bg-success-50 dark:hover:bg-success-900/20"
                      >
                        <span className="hidden sm:inline">View Analytics</span>
                        <span className="sm:hidden">View</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={token("ink-700")}
                          opacity={0.1}
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: token("ink-500"), fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: token("ink-500"), fontSize: 12 }}
                          tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            backgroundColor: "rgb(var(--ink-800))",
                            color: "rgb(var(--color-text-inverted))",
                          }}
                          formatter={(value) => [
                            `$${value.toFixed(2)}`,
                            "Revenue",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="paid"
                          stroke={token("success-500")}
                          strokeWidth={2}
                          fillOpacity={0.08}
                          fill={token("success-500")}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Invoices */}
              <Card className="border border-line dark:border-ink-800 shadow-sm bg-surface dark:bg-surface-inverted">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-lg sm:text-xl font-black text-content dark:text-content-inverted">
                      Recent Invoices
                    </CardTitle>
                    <Link to={createPageUrl("Invoices")}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 text-content-body dark:text-content-subtle hover:bg-ink-100 dark:hover:bg-ink-700"
                      >
                        View All
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0 px-4 pb-4">
                  {recentInvoices.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 bg-ink-100 dark:bg-ink-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                      </div>
                      <p className="text-content-body dark:text-content-subtle font-medium mb-2">
                        No invoices yet
                      </p>
                      <p className="text-sm text-content-muted dark:text-content-muted mb-4">
                        Create your first invoice to get started
                      </p>
                      <Link to={createPageUrl("CreateInvoice")}>
                        <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Invoice
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-line-subtle dark:divide-ink-700 space-y-0">
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
            <Card className="shadow-sm bg-brand-50 border border-brand-200 dark:border-brand-800 dark:bg-brand-900/20">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="w-5 h-5 text-brand-700 dark:text-brand-400 flex-shrink-0" />
                    <CardTitle className="text-lg sm:text-xl font-black text-content dark:text-content-inverted truncate">
                      Upcoming Recurring
                    </CardTitle>
                  </div>
                  <Link
                    to={createPageUrl("RecurringInvoices")}
                    className="flex-shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-info-300 dark:border-info-700 hover:bg-info-100 dark:hover:bg-info-900/30 dark:text-info-300"
                    >
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingRecurring.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-surface dark:bg-ink-800 rounded-xl p-5 shadow-sm border border-brand-200 dark:border-brand-800/50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <p className="font-bold text-content dark:text-content-inverted truncate flex-1">
                          {rec.client_name}
                        </p>
                        <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 bg-info-50 dark:bg-info-900/30 px-2.5 py-1 rounded-full capitalize flex-shrink-0">
                          {rec.frequency}
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-2">
                        ${rec.total?.toFixed(2)}
                      </p>
                      <p className="text-sm text-content-muted dark:text-content-subtle">
                        Next:{" "}
                        {format(
                          new Date(rec.next_generation_date),
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
              className="w-full border-line-strong dark:border-ink-600 h-12 bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
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
        {/* Soft pulsing glow */}
        <span className="absolute inset-0 rounded-full bg-success-500/50 blur-2xl scale-110 animate-pulse" />
        {/* Pill */}
        <span className="relative inline-flex items-center gap-2 h-14 pl-5 pr-6 rounded-full bg-success-700 text-content-inverted font-bold text-sm shadow-2xl shadow-success-500/50 ring-1 ring-content-inverted/30 active:scale-95 transition-transform whitespace-nowrap">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/25 backdrop-blur-sm dark:bg-surface-inverted/25">
            <Sparkles
              className="w-4 h-4 text-content-inverted"
              strokeWidth={2.5}
            />
          </span>
          <span className="tracking-tight">AI Quick Bill</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-surface/25 text-[9px] font-bold tracking-widest dark:bg-surface-inverted/25">
            NEW
          </span>
        </span>
      </Link>
    </PullToRefresh>
  );
}
