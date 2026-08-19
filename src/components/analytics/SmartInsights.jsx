import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  CheckCircle,
  Clock,
} from "lucide-react";
import { subDays, subWeeks } from "date-fns";

export default function SmartInsights({
  invoices,
  quotes,
  jobs,
  clients,
  dateRange,
}) {
  const insights = useMemo(() => {
    const now = new Date();
    const weekAgo = subWeeks(now, 1);
    const twoWeeksAgo = subWeeks(now, 2);
    const monthAgo = subDays(now, 30);
    const twoMonthsAgo = subDays(now, 60);

    // Filter by date range if custom
    const filterByDateRange = (items, dateField = "created_date") => {
      if (!dateRange || dateRange.preset === "all") return items;
      return items.filter((item) => {
        const date = new Date(item[dateField]);
        return date >= dateRange.start && date <= dateRange.end;
      });
    };

    const filteredInvoices = filterByDateRange(invoices);
    const filteredQuotes = filterByDateRange(quotes);
    const filteredJobs = filterByDateRange(jobs);

    const results = [];

    // 1. Revenue Trend Analysis
    const thisWeekRevenue = invoices
      .filter(
        (inv) =>
          inv.status === "paid" &&
          new Date(inv.paid_date || inv.created_date) >= weekAgo,
      )
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const lastWeekRevenue = invoices
      .filter((inv) => {
        const date = new Date(inv.paid_date || inv.created_date);
        return inv.status === "paid" && date >= twoWeeksAgo && date < weekAgo;
      })
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const revenueChange =
      lastWeekRevenue > 0
        ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
        : thisWeekRevenue > 0
          ? 100
          : 0;

    if (Math.abs(revenueChange) > 10) {
      results.push({
        type: revenueChange > 0 ? "positive" : "warning",
        icon: revenueChange > 0 ? TrendingUp : TrendingDown,
        title: revenueChange > 0 ? "Revenue Growing" : "Revenue Declining",
        message: `Your revenue is ${revenueChange > 0 ? "up" : "down"} ${Math.abs(revenueChange).toFixed(0)}% compared to last week ($${thisWeekRevenue.toFixed(0)} vs $${lastWeekRevenue.toFixed(0)}).`,
        priority: 1,
      });
    }

    // 2. Quote Approval Rate
    const thisMonthQuotes = quotes.filter(
      (q) => new Date(q.created_date) >= monthAgo,
    );
    const approvedThisMonth = thisMonthQuotes.filter(
      (q) => q.status === "approved" || q.status === "converted",
    ).length;
    const approvalRate =
      thisMonthQuotes.length > 0
        ? (approvedThisMonth / thisMonthQuotes.length) * 100
        : 0;

    const lastMonthQuotes = quotes.filter((q) => {
      const date = new Date(q.created_date);
      return date >= twoMonthsAgo && date < monthAgo;
    });
    const approvedLastMonth = lastMonthQuotes.filter(
      (q) => q.status === "approved" || q.status === "converted",
    ).length;
    const lastApprovalRate =
      lastMonthQuotes.length > 0
        ? (approvedLastMonth / lastMonthQuotes.length) * 100
        : 0;

    if (thisMonthQuotes.length >= 3) {
      const rateChange = approvalRate - lastApprovalRate;
      results.push({
        type:
          approvalRate >= 50
            ? "positive"
            : approvalRate >= 30
              ? "neutral"
              : "warning",
        icon: CheckCircle,
        title: "Quote Performance",
        message: `Quote approval rate: ${approvalRate.toFixed(0)}% (${approvedThisMonth}/${thisMonthQuotes.length} quotes)${rateChange !== 0 ? `. ${rateChange > 0 ? "Up" : "Down"} ${Math.abs(rateChange).toFixed(0)}% from last month.` : ""}`,
        priority: 2,
      });
    }

    // 3. Overdue Invoice Alert
    const overdueInvoices = invoices.filter((inv) => {
      if (inv.status === "paid" || inv.status === "cancelled") return false;
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      return dueDate && dueDate < now;
    });

    if (overdueInvoices.length > 0) {
      const overdueTotal = overdueInvoices.reduce(
        (sum, inv) => sum + (inv.total || 0),
        0,
      );
      results.push({
        type: "danger",
        icon: AlertTriangle,
        title: "Overdue Invoices",
        message: `You have ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} totaling $${overdueTotal.toFixed(2)}. Consider sending reminders.`,
        priority: 0,
      });
    }

    // 4. New vs Returning Customers
    const thisMonthClients = new Set(
      invoices
        .filter((inv) => new Date(inv.created_date) >= monthAgo)
        .map((inv) => inv.client_id),
    );

    const previousClients = new Set(
      invoices
        .filter((inv) => new Date(inv.created_date) < monthAgo)
        .map((inv) => inv.client_id),
    );

    const newClients = [...thisMonthClients].filter(
      (id) => !previousClients.has(id),
    ).length;
    const returningClients = [...thisMonthClients].filter((id) =>
      previousClients.has(id),
    ).length;

    if (thisMonthClients.size > 0) {
      results.push({
        type: newClients > returningClients ? "positive" : "neutral",
        icon: Users,
        title: "Customer Mix",
        message: `This month: ${newClients} new client${newClients !== 1 ? "s" : ""} and ${returningClients} returning. ${newClients > returningClients ? "Great job acquiring new customers!" : "Strong repeat business!"}`,
        priority: 3,
      });
    }

    // 5. Job Completion Trend
    const completedThisWeek = jobs.filter(
      (j) =>
        j.status === "completed" &&
        new Date(j.updated_date || j.created_date) >= weekAgo,
    ).length;

    const completedLastWeek = jobs.filter((j) => {
      const date = new Date(j.updated_date || j.created_date);
      return j.status === "completed" && date >= twoWeeksAgo && date < weekAgo;
    }).length;

    if (completedThisWeek > 0 || completedLastWeek > 0) {
      const jobChange =
        completedLastWeek > 0
          ? ((completedThisWeek - completedLastWeek) / completedLastWeek) * 100
          : completedThisWeek > 0
            ? 100
            : 0;

      results.push({
        type: jobChange >= 0 ? "positive" : "warning",
        icon: jobChange >= 0 ? TrendingUp : TrendingDown,
        title: "Job Completions",
        message: `Completed ${completedThisWeek} job${completedThisWeek !== 1 ? "s" : ""} this week${completedLastWeek > 0 ? ` (${jobChange > 0 ? "+" : ""}${jobChange.toFixed(0)}% vs last week)` : ""}.`,
        priority: 4,
      });
    }

    // 6. Pending Payments
    const pendingPayments = invoices.filter((inv) => inv.status === "sent");
    const pendingTotal = pendingPayments.reduce(
      (sum, inv) => sum + (inv.total || 0),
      0,
    );

    if (pendingPayments.length > 0) {
      results.push({
        type: "neutral",
        icon: Clock,
        title: "Awaiting Payment",
        message: `${pendingPayments.length} invoice${pendingPayments.length > 1 ? "s" : ""} pending payment, totaling $${pendingTotal.toFixed(2)}.`,
        priority: 5,
      });
    }

    return results.sort((a, b) => a.priority - b.priority);
  }, [invoices, quotes, jobs, clients, dateRange]);

  const typeStyles = {
    positive:
      "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800/60 text-success-800 dark:text-success-200",
    warning:
      "bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800/60 text-warning-800 dark:text-warning-200",
    danger:
      "bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800/60 text-danger-800 dark:text-danger-200",
    neutral:
      "bg-brand-50 dark:bg-brand-900/20 border-info-200 dark:border-info-800/60 text-info-800 dark:text-info-200",
  };

  const iconStyles = {
    positive:
      "text-success-600 dark:text-success-400 bg-success-100 dark:bg-success-900/40",
    warning:
      "text-warning-600 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/40",
    danger:
      "text-danger-600 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/40",
    neutral:
      "text-brand-700 dark:text-brand-400 bg-brand-100 dark:bg-brand-900/40",
  };

  if (insights.length === 0) {
    return (
      <Card className="border-none shadow-lg bg-brand-50 dark:bg-surface-inverted">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-12 h-12 text-brand-400 dark:text-brand-500 mx-auto mb-3" />
          <p className="text-content-body dark:text-content-subtle">
            Not enough data yet for insights. Keep adding invoices and jobs!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border flex items-start gap-3 ${typeStyles[insight.type]}`}
        >
          <div
            className={`p-2 rounded-lg ${iconStyles[insight.type]} flex-shrink-0`}
          >
            <insight.icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-content dark:text-ink-100 mb-1">
              {insight.title}
            </h4>
            <p className="text-sm text-ink-700 dark:text-ink-300">
              {insight.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
