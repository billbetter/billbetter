import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  MoreVertical,
  Trash2,
  Loader2,
  Pause,
  Play,
  Calendar,
  TrendingUp,
  Wallet,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Ban,
  Zap,
  ChevronRight,
  X,
  Search,
  RotateCcw,
  FileText,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import FeatureGate from "@/components/access/FeatureGate";
import { canAccessFeature } from "@/components/utils/permissions";

export default function RecurringInvoices() {
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    invoice: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [userSpecialty, setUserSpecialty] = useState(null);
  const [recentServices, setRecentServices] = useState([]);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(null);
  const [stats, setStats] = useState({
    active: 0,
    paused: 0,
    monthlyRevenue: 0,
    total: 0,
  });

  useEffect(() => {
    loadRecurringInvoices();
  }, []);

  const loadRecurringInvoices = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      const [data, subscriptionData, specialtyData, customTemplates] =
        await Promise.all([
          sdk.entities.RecurringInvoice.filter(
            { user_id: currentUser.id },
            "-created_date",
          ),
          sdk.entities.Subscription.filter({ user_id: currentUser.id }),
          sdk.entities.UserSpecialty.filter({ user_id: currentUser.id }),
          sdk.entities.CustomServiceTemplate.filter(
            { user_id: currentUser.id },
            "-use_count",
            5,
          ),
        ]);

      setRecurringInvoices(data);
      setSubscription(subscriptionData.length > 0 ? subscriptionData[0] : null);
      setUserSpecialty(specialtyData.length > 0 ? specialtyData[0] : null);
      setRecentServices(customTemplates);

      const active = data.filter((inv) => inv.status === "active").length;
      const paused = data.filter((inv) => inv.status === "paused").length;
      const monthlyRevenue = data
        .filter((inv) => inv.status === "active")
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      setStats({
        active,
        paused,
        monthlyRevenue,
        total: data.length,
      });
    } catch (error) {
      console.error("Error loading recurring invoices:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleToggleStatus = async (recurringInvoice) => {
    setUpdatingStatus(recurringInvoice.id);
    try {
      const newStatus =
        recurringInvoice.status === "active" ? "paused" : "active";
      await sdk.entities.RecurringInvoice.update(recurringInvoice.id, {
        status: newStatus,
      });
      await loadRecurringInvoices(true);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
    setUpdatingStatus(null);
  };

  const handleDelete = async () => {
    if (!deleteDialog.invoice) return;
    setDeleting(true);
    try {
      await sdk.entities.RecurringInvoice.delete(deleteDialog.invoice.id);
      setDeleteDialog({ open: false, invoice: null });
      loadRecurringInvoices(true);
    } catch (error) {
      console.error("Error deleting recurring invoice:", error);
      alert("Failed to delete recurring invoice. Please try again.");
    }
    setDeleting(false);
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      weekly: "Weekly",
      biweekly: "Bi-weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
    };
    return labels[frequency] || frequency;
  };

  const getEndLabel = (recurring) => {
    if (recurring.end_type === "never") return "Never ends";
    if (recurring.end_type === "after")
      return `After ${recurring.occurrences} invoices`;
    if (recurring.end_type === "on_date")
      return `Ends ${format(new Date(recurring.end_date), "MMM d, yyyy")}`;
    return "N/A";
  };

  const statusConfig = {
    active: {
      color:
        "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200 dark:border-success-800",
      icon: CheckCircle2,
      indicator: "bg-success-500",
      label: "Active",
    },
    paused: {
      color:
        "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200 dark:border-warning-800",
      icon: Pause,
      indicator: "bg-warning-500",
      label: "Paused",
    },
    completed: {
      color:
        "bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-400 border-info-200 dark:border-info-800",
      icon: CheckCircle2,
      indicator: "bg-brand-600",
      label: "Completed",
    },
    cancelled: {
      color:
        "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-content-subtle border-line-strong dark:border-ink-700",
      icon: Ban,
      indicator: "bg-ink-400 dark:bg-ink-600",
      label: "Cancelled",
    },
  };

  const filteredInvoices = recurringInvoices.filter((invoice) => {
    const matchesSearch =
      invoice.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.template_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasRecurringAccess = canAccessFeature(
    subscription,
    "recurring_invoices",
  );

  if (loading && recurringInvoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading recurring invoices
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
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {/*
          Automatic generation does not exist. A RecurringInvoice row is
          created, listed, edited and deleted, and NOTHING anywhere converts one
          into an Invoice -- no edge function, no cron job, no client path.

          Saying so, rather than quietly accepting a schedule and ignoring it.
          A page that takes a weekly billing cycle and never bills is worse than
          one that admits it, because the contractor stops chasing that money
          themselves.

          The templates are still worth keeping: they hold the client, the line
          items and the cadence, so they become real the moment the scheduler
          lands. Remove this notice then.
        */}
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-800/50 dark:bg-warning-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600 dark:text-warning-400" />
            <div>
              <p className="text-sm font-semibold text-warning-900 dark:text-warning-200">
                Automatic billing isn&apos;t running yet
              </p>
              <p className="mt-1 text-sm text-warning-800 dark:text-warning-300">
                These are saved templates. They hold the client, the line items
                and the schedule, but nothing sends them on its own yet &mdash;
                create each invoice from a template when it is due, and keep
                your own reminder of the date.
              </p>
            </div>
          </div>
        </div>
        {/* Mobile Header - EXACTLY like Invoices */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
                <RefreshCw className="w-5 h-5 text-content-inverted" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
                  Recurring
                </h1>
                <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                  {stats.total} invoices
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => loadRecurringInvoices(true)}
                variant="outline"
                size="icon"
                disabled={refreshing}
                className="h-10 w-10 rounded-xl border-line dark:border-ink-700 bg-surface dark:bg-ink-800 shadow-sm active:scale-95 transition-all hover:bg-surface-sunken dark:hover:bg-ink-700"
              >
                <RefreshCw
                  className={`w-4 h-4 text-content-body dark:text-content-subtle ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-line dark:border-ink-700 bg-surface dark:bg-ink-800 shadow-sm active:scale-95 transition-all hover:bg-surface-sunken dark:hover:bg-ink-700"
                  >
                    <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
                >
                  <DropdownMenuItem
                    onClick={() => loadRecurringInvoices(true)}
                    className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                    Refresh
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile Stats - EXACTLY like Invoices layout */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/30 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-success-600 dark:text-success-400" />
                </div>
                <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                  Monthly
                </p>
              </div>
              <p className="text-xl font-bold text-content dark:text-content-inverted">
                $
                {stats.monthlyRevenue.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-warning-50 dark:bg-warning-900/30 flex items-center justify-center">
                  <Pause className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                </div>
                <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                  Paused
                </p>
              </div>
              <p
                className={`text-xl font-bold ${stats.paused > 0 ? "text-warning-600 dark:text-warning-400" : "text-content dark:text-content-inverted"}`}
              >
                {stats.paused}
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400" />
                </div>
                <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                  Active
                </p>
              </div>
              <p className="text-xl font-bold text-success-600 dark:text-success-400">
                {stats.active}
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                </div>
                <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                  Total
                </p>
              </div>
              <p className="text-xl font-bold text-brand-700 dark:text-brand-400">
                {stats.total}
              </p>
            </div>
          </div>

          <Link
            to={createPageUrl("CreateInvoice")}
            state={{ isRecurring: true }}
            className="block mb-6"
          >
            <Button className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all">
              <PlusCircle className="w-5 h-5 mr-2" />
              Create Recurring
            </Button>
          </Link>
        </div>

        {/* Desktop Header - EXACTLY like Invoices color/design */}
        <div className="hidden lg:block">
          <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-success-600 flex items-center justify-center shadow-lg shadow-success-200 dark:shadow-success-900/30">
                  <RefreshCw className="w-6 h-6 text-content-inverted" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                    Recurring Invoices
                  </h1>
                  <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                    Automate your repeat billing
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => loadRecurringInvoices(true)}
                  variant="outline"
                  disabled={refreshing}
                  className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>

                <Link
                  to={createPageUrl("CreateInvoice")}
                  state={{ isRecurring: true }}
                >
                  <Button className="bg-brand hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    New Recurring
                  </Button>
                </Link>
              </div>
            </div>

            {/* Desktop Stats - EXACTLY like Invoices layout with 5 columns */}
            <div className="grid grid-cols-5 gap-8">
              <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                  <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Monthly Rev
                  </p>
                </div>
                <p className="text-3xl font-bold text-content dark:text-content-inverted">
                  $
                  {stats.monthlyRevenue.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                  <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Total
                  </p>
                </div>
                <p className="text-3xl font-bold text-content dark:text-content-inverted">
                  {stats.total}
                </p>
              </div>
              <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success-400 dark:text-success-500" />
                  <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Active
                  </p>
                </div>
                <p className="text-3xl font-bold text-success-600 dark:text-success-400">
                  {stats.active}
                </p>
              </div>
              <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <Pause className="w-4 h-4 text-warning-400 dark:text-warning-500" />
                  <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Paused
                  </p>
                </div>
                <p
                  className={`text-3xl font-bold ${stats.paused > 0 ? "text-warning-600 dark:text-warning-400" : "text-content dark:text-content-inverted"}`}
                >
                  {stats.paused}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-info-400 dark:text-brand-600" />
                  <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Frequency
                  </p>
                </div>
                <p className="text-3xl font-bold text-brand-700 dark:text-brand-400">
                  Auto
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter - EXACTLY like Invoices */}
        <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-subtle w-4 h-4 group-focus-within:text-content-body dark:group-focus-within:text-ink-300 transition-colors" />
              <input
                type="text"
                placeholder="Search recurring invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 h-11 bg-transparent border border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 focus:border-transparent transition-all"
              />
            </div>
            <div className="w-full sm:w-56">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-11 border border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm px-3 focus:outline-none focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "40px",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Frequent Services Card */}
        <div className="hidden lg:block">
          <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-line-subtle dark:border-ink-700 bg-surface-sunken/50 dark:bg-ink-800/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-brand-700 dark:text-brand-400" />
              </div>
              <h3 className="font-black text-content dark:text-content-inverted">
                Frequent Services
              </h3>
            </div>
            <div className="p-6">
              {recentServices.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {recentServices.slice(0, 3).map((service) => (
                    <div
                      key={service.id}
                      className="flex flex-col justify-between py-3 px-4 rounded-xl bg-surface-sunken dark:bg-surface-inverted/50 border border-line-subtle dark:border-ink-700 hover:border-line dark:hover:border-ink-600 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mb-2">
                        <p className="font-bold text-sm text-content dark:text-content-inverted truncate">
                          {service.name}
                        </p>
                        <p className="text-xs text-content-muted dark:text-content-subtle font-medium">
                          ${service.default_rate.toFixed(2)}/{service.unit}
                        </p>
                      </div>
                      <Badge className="bg-surface dark:bg-ink-800 text-ink-700 dark:text-ink-300 border border-line dark:border-ink-700 text-xs font-bold px-2.5 py-1 w-fit">
                        {service.use_count || 0} uses
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mb-3 border border-line dark:border-ink-700">
                    <Receipt className="w-6 h-6 text-content-subtle dark:text-content-muted" />
                  </div>
                  <p className="text-sm font-bold text-content dark:text-content-inverted mb-1">
                    No services yet
                  </p>
                  <p className="text-xs text-content-muted dark:text-content-subtle">
                    Create invoices to build your library
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <FeatureGate
          hasAccess={hasRecurringAccess}
          featureName="recurring_invoices"
          mode="blur"
        >
          {filteredInvoices.length === 0 ? (
            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700">
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-success-50 dark:bg-success-900/20 flex items-center justify-center mx-auto mb-4 border border-success-100 dark:border-success-800">
                  <RefreshCw className="w-8 h-8 text-success-600 dark:text-success-400" />
                </div>
                <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                  {searchTerm || statusFilter !== "all"
                    ? "No invoices found"
                    : "No recurring invoices"}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle max-w-xs mx-auto mb-6">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search"
                    : "Save a template with the client, line items and cadence"}
                </p>
                <Link
                  to={createPageUrl("CreateInvoice")}
                  state={{ isRecurring: true }}
                >
                  <Button className="bg-brand hover:bg-brand-hover text-content-inverted font-bold h-12 px-8 text-base rounded-xl shadow-sm border-0">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Create Invoice
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[200px]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" />
                          Client
                        </div>
                      </TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                        Schedule
                      </TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[140px]">
                        Amount
                      </TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
                        Next Date
                      </TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
                        Status
                      </TableHead>
                      <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[100px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((recurring) => {
                      const StatusIcon =
                        statusConfig[recurring.status]?.icon || AlertCircle;
                      return (
                        <TableRow
                          key={recurring.id}
                          className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
                        >
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-1 h-8 rounded-full ${statusConfig[recurring.status]?.indicator || "bg-ink-300"}`}
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-content dark:text-content-inverted text-sm">
                                  {recurring.client_name}
                                </span>
                                {recurring.template_name && (
                                  <span className="text-xs text-content-muted dark:text-content-subtle truncate max-w-[180px]">
                                    {recurring.template_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-4 px-6">
                            <Badge
                              variant="outline"
                              className="text-xs font-bold border-line dark:border-ink-700 text-ink-700 dark:text-ink-300 bg-surface dark:bg-ink-800 px-2.5 py-1"
                            >
                              {getFrequencyLabel(recurring.frequency)}
                            </Badge>
                            <p className="text-xs text-content-subtle dark:text-content-muted mt-1.5 font-medium">
                              {getEndLabel(recurring)}
                            </p>
                          </TableCell>

                          <TableCell className="py-4 px-6 text-right">
                            <span className="font-bold text-success-600 dark:text-success-400 text-base">
                              ${recurring.total.toFixed(2)}
                            </span>
                          </TableCell>

                          <TableCell className="py-4 px-6">
                            {recurring.next_generation_date ? (
                              <div className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
                                <Calendar className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                                {format(
                                  new Date(recurring.next_generation_date),
                                  "MMM d, yyyy",
                                )}
                              </div>
                            ) : (
                              <span className="text-content-subtle dark:text-content-muted text-sm">
                                -
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig[recurring.status]?.color || statusConfig.cancelled.color}`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusConfig[recurring.status]?.label ||
                                recurring.status}
                            </span>
                          </TableCell>

                          <TableCell className="text-right py-4 px-6">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleToggleStatus(recurring)}
                                disabled={updatingStatus === recurring.id}
                                className="h-8 w-8 border-line dark:border-ink-700 bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 rounded-lg"
                              >
                                {updatingStatus === recurring.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-content-body dark:text-content-subtle" />
                                ) : recurring.status === "active" ? (
                                  <Pause className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                                ) : (
                                  <Play className="w-4 h-4 text-success-600 dark:text-success-400" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    invoice: recurring,
                                  })
                                }
                                className="h-8 w-8 border-line dark:border-ink-700 bg-surface dark:bg-ink-800 hover:bg-danger-50 dark:hover:bg-danger-900/30 hover:border-danger-200 dark:hover:border-danger-800 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4 text-content-body dark:text-content-subtle hover:text-danger-600 dark:hover:text-danger-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile List - EXACTLY like Invoices style */}
              <div className="lg:hidden space-y-3">
                {filteredInvoices.map((recurring) => {
                  const StatusIcon =
                    statusConfig[recurring.status]?.icon || AlertCircle;
                  return (
                    <div
                      key={recurring.id}
                      className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
                    >
                      <div
                        className={`h-1 ${statusConfig[recurring.status]?.indicator || "bg-ink-300"}`}
                      />
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-content dark:text-content-inverted text-sm">
                                {recurring.client_name}
                              </span>
                            </div>
                            {recurring.template_name && (
                              <p className="text-xs text-content-muted dark:text-content-subtle truncate mb-1">
                                {recurring.template_name}
                              </p>
                            )}
                            <p className="text-xs text-content-subtle dark:text-content-muted font-medium">
                              {getFrequencyLabel(recurring.frequency)} •{" "}
                              {getEndLabel(recurring)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-success-600 dark:text-success-400 text-lg">
                              ${recurring.total.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig[recurring.status]?.color || "bg-ink-100"}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span className="capitalize">
                              {recurring.status}
                            </span>
                          </span>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleToggleStatus(recurring)}
                              disabled={updatingStatus === recurring.id}
                              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
                            >
                              {updatingStatus === recurring.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-content-body dark:text-content-subtle" />
                              ) : recurring.status === "active" ? (
                                <Pause className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                              ) : (
                                <Play className="w-4 h-4 text-success-600 dark:text-success-400" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
                              onClick={() => setMobileMenuOpen(recurring.id)}
                            >
                              <MoreVertical className="w-4 h-4 text-content-body dark:text-content-subtle" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </FeatureGate>
      </div>

      {/* Mobile Bottom Sheet - EXACTLY like Invoices */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setMobileMenuOpen(null)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-ink-800 rounded-t-3xl z-50 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="w-full flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-12 h-1.5 bg-ink-300 dark:bg-ink-600 rounded-full"></div>
              </div>

              <div className="px-6 py-4 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between bg-surface-sunken/50 dark:bg-ink-800/50 flex-shrink-0">
                <div>
                  <h3 className="font-black text-content dark:text-content-inverted text-lg">
                    Recurring Actions
                  </h3>
                  <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                    {
                      filteredInvoices.find((inv) => inv.id === mobileMenuOpen)
                        ?.client_name
                    }
                  </p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(null)}
                  className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-600 active:scale-95 transition-all"
                >
                  <X className="w-5 h-5 text-content-body dark:text-content-subtle" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
                <button
                  className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
                  onClick={() => {
                    setDeleteDialog({
                      open: true,
                      invoice: filteredInvoices.find(
                        (inv) => inv.id === mobileMenuOpen,
                      ),
                    });
                    setMobileMenuOpen(null);
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-bold">Delete Recurring</p>
                    <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                      Stop all future invoices
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Dialog - EXACTLY like Invoices style */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !deleting && setDeleteDialog({ open, invoice: null })
        }
      >
        <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
          <DialogHeader className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto shadow-sm dark:bg-danger-900/30">
              <Trash2 className="w-7 h-7 text-danger-600 dark:text-danger-400" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
              Delete Recurring Invoice?
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
              This will stop all future invoices for{" "}
              <span className="font-bold text-content dark:text-content-inverted">
                {deleteDialog.invoice?.client_name}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-8">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, invoice: null })}
              disabled={deleting}
              className="flex-1 h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 h-12 text-sm font-semibold bg-danger-600 hover:bg-danger-700 dark:bg-danger-600 dark:hover:bg-danger-700 text-content-inverted rounded-xl shadow-lg shadow-danger-200 dark:shadow-danger-900/30"
            >
              {deleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
