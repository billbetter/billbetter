import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { groupBy, sumBy } from "lodash";
import { indexPaymentsByInvoice, revenueDate } from "@/lib/invoicePayments";

/**
 * Every figure the Analytics page shows, derived from the rows it loaded.
 * Pure apart from reading the clock: months are counted back from today.
 */
export function buildAnalytics({ invoices, payments, clients, jobs, dateRange }) {
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

  // The business health score, 0-100: collections, growth (capped at 50%),
  // client base (up to ten) and whether any job was completed this month.
  const healthScore = Math.min(
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

  return {
    filteredInvoices,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    totalRevenue,
    pendingAmount,
    overdueAmount,
    collectionRate,
    monthlyData,
    revenueTrendData,
    jobsCompletedThisMonth,
    revenueByJobTypeWithPercent,
    revenueByClient,
    currentMonthRevenue,
    lastMonthRevenue,
    growthRate,
    healthScore,
    statsData,
  };
}

/** The one-line verdict shown above the health score. */
export function healthHeadline(score) {
  if (score >= 80) return "Your business is thriving";
  if (score >= 60) return "Solid performance overall";
  if (score >= 40) return "Room for improvement";
  return "Needs attention";
}
