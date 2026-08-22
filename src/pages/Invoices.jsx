import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileText,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  Trash2,
  Loader2,
  Download,
  MoreVertical,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  MessageSquare,
  UserCheck,
  X,
  ChevronRight,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import PullToRefresh from "@/components/utils/PullToRefresh";
import ChaseInvoiceBanner from "@/components/invoice/ChaseInvoiceBanner";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    invoice: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [checkingOverdue, setCheckingOverdue] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(null);
  const [notificationDialog, setNotificationDialog] = useState({
    open: false,
    invoice: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileStatusPicker, setMobileStatusPicker] = useState(null); // invoiceId

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const user = await sdk.auth.me();

      const [invoiceData, settingsData] = await Promise.all([
        sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
      ]);

      setInvoices(invoiceData);
      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog.invoice) return;
    const invoiceToDelete = deleteDialog.invoice;

    // Optimistic: remove from UI immediately
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete.id));
    setDeleteDialog({ open: false, invoice: null });
    setDeleting(false);

    try {
      await sdk.entities.Invoice.delete(invoiceToDelete.id);
    } catch (error) {
      // Revert on failure
      setInvoices((prev) => [invoiceToDelete, ...prev]);
      console.error("Error deleting invoice:", error);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    const prevInvoices = invoices;
    // Optimistic: update UI immediately
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: newStatus } : inv,
      ),
    );
    setUpdatingStatus(invoiceId);
    try {
      await sdk.entities.Invoice.update(invoiceId, { status: newStatus });
    } catch (error) {
      // Revert on failure
      setInvoices(prevInvoices);
      console.error("Error updating status:", error);
    }
    setUpdatingStatus(null);
  };

  const handleCheckOverdue = async () => {
    setCheckingOverdue(true);
    try {
      const response = await sdk.functions.invoke("checkOverdueInvoices");
      if (response.data.success) {
        await loadData(true);
        alert(
          `Updated ${response.data.updated_count} invoice(s) to overdue status.`,
        );
      }
    } catch (error) {
      console.error("Error checking overdue invoices:", error);
      alert("Failed to check overdue invoices. Please try again.");
    }
    setCheckingOverdue(false);
  };

  const handleSendOverdueNotification = async (invoice, method) => {
    setSendingNotification(invoice.id);
    try {
      const response = await sdk.functions.invoke("sendOverdueNotification", {
        invoice_id: invoice.id,
        method: method,
      });

      if (response.data.success) {
        alert(`Overdue notification sent via ${method}!`);
        setNotificationDialog({ open: false, invoice: null });
      }
    } catch (error) {
      console.error("Error sending overdue notification:", error);
      alert("Failed to send notification. Please try again.");
    }
    setSendingNotification(null);
  };

  const handleExportInvoices = () => {
    if (filteredInvoices.length === 0) {
      alert("No invoices to export.");
      return;
    }

    const headers = [
      "Invoice Number",
      "Client Name",
      "Created Date",
      "Due Date",
      "Total Amount",
      "Status",
      "PDF URL",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredInvoices.map((invoice) => {
        const clientName = `"${invoice.client_name?.replace(/"/g, '""') || ""}"`;
        const invoiceNumber = `"${invoice.invoice_number?.replace(/"/g, '""') || ""}"`;
        const createdDate = invoice.created_date
          ? format(new Date(invoice.created_date), "yyyy-MM-dd")
          : "";
        const dueDate = invoice.due_date
          ? format(new Date(invoice.due_date), "yyyy-MM-dd")
          : "";
        const total = invoice.total?.toFixed(2) || "0.00";
        const status = invoice.status || "";
        const pdfUrl = invoice.pdf_url || "";

        return [
          invoiceNumber,
          clientName,
          createdDate,
          dueDate,
          total,
          status,
          pdfUrl,
        ].join(",");
      }),
    ];

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `invoices_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    draft: {
      color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
      icon: FileText,
      indicator: "bg-ink-400 dark:bg-ink-600",
    },
    sent: {
      color: "bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-400",
      icon: Clock,
      indicator: "bg-brand-600",
    },
    paid: {
      color:
        "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
      icon: CheckCircle2,
      indicator: "bg-success-500",
    },
    overdue: {
      color:
        "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400",
      icon: AlertCircle,
      indicator: "bg-danger-500",
    },
    cancelled: {
      color:
        "bg-ink-100 text-content-body dark:bg-ink-800/50 dark:text-content-muted",
      icon: X,
      indicator: "bg-ink-400 dark:bg-ink-600",
    },
  };

  const stats = {
    total: filteredInvoices.length,
    pending: filteredInvoices.filter((i) => i.status === "sent").length,
    paid: filteredInvoices.filter((i) => i.status === "paid").length,
    overdue: filteredInvoices.filter((i) => i.status === "overdue").length,
    totalValue: filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-brand-700 dark:text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading invoices
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
    <PullToRefresh onRefresh={() => loadData(true)}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {/* Mobile Header - Enhanced with Icon */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
                  <Receipt className="w-5 h-5 text-content-inverted" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
                    Invoices
                  </h1>
                  <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                    {stats.total} invoices
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => loadData(true)}
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
                      onClick={handleCheckOverdue}
                      disabled={checkingOverdue}
                      className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      {checkingOverdue && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {!checkingOverdue && (
                        <AlertCircle className="w-4 h-4 mr-2 text-alert-500" />
                      )}
                      Check Overdue
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportInvoices}
                      className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                      Export CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mobile Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Total Value
                  </p>
                </div>
                <p className="text-xl font-bold text-content dark:text-content-inverted">
                  $
                  {stats.totalValue.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-danger-50 dark:bg-danger-900/30 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Overdue
                  </p>
                </div>
                <p
                  className={`text-xl font-bold ${stats.overdue > 0 ? "text-danger-600 dark:text-danger-400" : "text-content dark:text-content-inverted"}`}
                >
                  {stats.overdue}
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Paid
                  </p>
                </div>
                <p className="text-xl font-bold text-success-600 dark:text-success-400">
                  {stats.paid}
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-info-50 dark:bg-info-900/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Pending
                  </p>
                </div>
                <p className="text-xl font-bold text-brand-700 dark:text-brand-400">
                  {stats.pending}
                </p>
              </div>
            </div>

            <Link to={createPageUrl("CreateInvoice")} className="block mb-6">
              <Button className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create New Invoice
              </Button>
            </Link>
          </div>

          {/* Desktop Header - Enhanced */}
          <div className="hidden lg:block">
            <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
                    <Receipt className="w-6 h-6 text-content-inverted" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                      Invoices
                    </h1>
                    <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                      Manage and track your billing
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => loadData(true)}
                    variant="outline"
                    disabled={refreshing}
                    className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 px-4 rounded-xl border-line dark:border-ink-700 text-sm font-medium shadow-sm hover:bg-surface-sunken dark:hover:bg-ink-700 active:scale-95 transition-all dark:bg-ink-800 dark:text-ink-300"
                      >
                        <MoreVertical className="w-4 h-4 mr-2" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
                    >
                      <DropdownMenuItem
                        onClick={handleCheckOverdue}
                        disabled={checkingOverdue}
                        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                      >
                        {checkingOverdue && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {!checkingOverdue && (
                          <AlertCircle className="w-4 h-4 mr-2 text-alert-500" />
                        )}
                        Check Overdue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportInvoices}
                        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                      >
                        <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                        Export CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Link to={createPageUrl("CreateInvoice")}>
                    <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New Invoice
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Desktop Stats with Icons */}
              <div className="grid grid-cols-5 gap-8">
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Total Value
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-content dark:text-content-inverted">
                    $
                    {stats.totalValue.toLocaleString(undefined, {
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
                      Paid
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-success-600 dark:text-success-400">
                    {stats.paid}
                  </p>
                </div>
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-info-400 dark:text-brand-600" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Pending
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-brand-700 dark:text-brand-400">
                    {stats.pending}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-danger-400 dark:text-danger-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Overdue
                    </p>
                  </div>
                  <p
                    className={`text-3xl font-bold ${stats.overdue > 0 ? "text-danger-600 dark:text-danger-400" : "text-content dark:text-content-inverted"}`}
                  >
                    {stats.overdue}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chase Invoice promo */}
          {stats.overdue > 0 ? (
            <ChaseInvoiceBanner
              variant="urgent"
              overdueCount={stats.overdue}
              outstandingAmount={filteredInvoices
                .filter((i) => i.status === "overdue")
                .reduce((s, i) => s + (i.total || 0), 0)}
            />
          ) : (
            <ChaseInvoiceBanner variant="compact" compact />
          )}

          {/* Search and Filter */}
          <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-subtle w-4 h-4 group-focus-within:text-content-body dark:group-focus-within:text-ink-300 transition-colors" />
                <Input
                  placeholder="Search invoices by client or number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-ink-200 dark:focus-visible:ring-ink-700"
                />
              </div>
              <div className="w-full sm:w-56">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 border-line dark:border-ink-700 dark:bg-surface-inverted dark:text-content-inverted rounded-xl text-sm focus:ring-2 focus:ring-ink-200 dark:focus:ring-ink-700">
                    <Filter className="w-4 h-4 mr-2 text-content-muted dark:text-content-subtle" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl dark:bg-ink-800 dark:border-ink-700">
                    <SelectItem
                      value="all"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      All Statuses
                    </SelectItem>
                    <SelectItem
                      value="draft"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Draft
                    </SelectItem>
                    <SelectItem
                      value="sent"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Sent
                    </SelectItem>
                    <SelectItem
                      value="paid"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Paid
                    </SelectItem>
                    <SelectItem
                      value="overdue"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Overdue
                    </SelectItem>
                    <SelectItem
                      value="cancelled"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Cancelled
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                </div>
                <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                  {searchTerm || statusFilter !== "all"
                    ? "No invoices found"
                    : "No invoices yet"}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search"
                    : "Create your first invoice to get started"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link to={createPageUrl("CreateInvoice")}>
                    <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                      <PlusCircle className="w-5 h-5 mr-2" />
                      Create Invoice
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[180px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" />
                        Invoice
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5" />
                        Client
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[160px]">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Date
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[140px]">
                      <div className="flex items-center justify-end gap-2">
                        <DollarSign className="w-3.5 h-3.5" />
                        Amount
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[140px]">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Status
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-6 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-center w-[120px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const StatusIcon =
                      statusConfig[invoice.status]?.icon || FileText;
                    const isAssigned =
                      invoice.assigned_to ||
                      (invoice.assigned_to_users &&
                        invoice.assigned_to_users.length > 0);

                    return (
                      <TableRow
                        key={invoice.id}
                        className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
                      >
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-1 h-8 rounded-full ${statusConfig[invoice.status]?.indicator || "bg-ink-300"}`}
                            />
                            <Link
                              to={
                                createPageUrl("InvoiceDetail") +
                                `?id=${invoice.id}`
                              }
                              className="font-bold text-content dark:text-content-inverted hover:text-info-600 dark:hover:text-info-400 transition-colors text-sm"
                            >
                              {invoice.invoice_number ||
                                `#${invoice.id.slice(0, 8)}`}
                            </Link>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-6">
                          <p className="font-bold text-content dark:text-content-inverted text-sm">
                            {invoice.client_name}
                          </p>
                          {invoice.client_email && (
                            <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                              {invoice.client_email}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="py-4 px-6">
                          <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">
                            {format(
                              new Date(invoice.created_date),
                              "MMM d, yyyy",
                            )}
                          </p>
                          <p className="text-xs text-content-subtle dark:text-content-muted mt-0.5">
                            Due{" "}
                            {format(
                              new Date(
                                invoice.due_date || invoice.created_date,
                              ),
                              "MMM d",
                            )}
                          </p>
                        </TableCell>

                        <TableCell className="py-4 px-6 text-right">
                          <p className="font-bold text-content dark:text-content-inverted text-base">
                            ${invoice.total?.toFixed(2)}
                          </p>
                        </TableCell>

                        <TableCell className="py-4 px-6">
                          <Select
                            value={invoice.status}
                            onValueChange={(value) =>
                              handleStatusChange(invoice.id, value)
                            }
                            disabled={updatingStatus === invoice.id}
                          >
                            <SelectTrigger
                              className={`w-28 h-7 border-0 bg-transparent p-0 focus:ring-0 text-xs ${updatingStatus === invoice.id ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[invoice.status]?.color || "bg-ink-100"}`}
                              >
                                {updatingStatus === invoice.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <StatusIcon className="w-3 h-3" />
                                )}
                                <span className="capitalize">
                                  {invoice.status}
                                </span>
                              </span>
                            </SelectTrigger>
                            <SelectContent
                              align="start"
                              className="rounded-xl dark:bg-ink-800 dark:border-ink-700"
                            >
                              {Object.keys(statusConfig).map((status) => (
                                <SelectItem
                                  key={status}
                                  value={status}
                                  className="capitalize text-xs rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                                >
                                  <div className="flex items-center gap-2">
                                    {React.createElement(
                                      statusConfig[status].icon,
                                      { className: "w-3.5 h-3.5" },
                                    )}
                                    {status}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-content-body hover:text-info-600 dark:hover:text-info-400 hover:bg-info-50 dark:hover:bg-info-900/30 rounded-lg dark:text-ink-300"
                            >
                              <Link
                                to={
                                  createPageUrl("InvoiceDetail") +
                                  `?id=${invoice.id}`
                                }
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-content-body hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-lg dark:text-ink-300"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 rounded-xl dark:bg-ink-800 dark:border-ink-700"
                              >
                                {invoice.status === "overdue" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setNotificationDialog({
                                        open: true,
                                        invoice,
                                      })
                                    }
                                    className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                                  >
                                    <AlertCircle className="w-4 h-4 mr-2 text-alert-500" />
                                    Send Reminder
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() =>
                                    setDeleteDialog({ open: true, invoice })
                                  }
                                  className="rounded-lg text-danger-600 dark:text-danger-400 dark:focus:bg-ink-700"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Mobile List */}
          <div className="lg:hidden space-y-3">
            {filteredInvoices.length === 0 ? (
              <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-8 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                </div>
                <h3 className="text-lg font-black text-content dark:text-content-inverted mb-1">
                  {searchTerm || statusFilter !== "all"
                    ? "No invoices found"
                    : "No invoices yet"}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "Adjust your filters"
                    : "Create your first invoice"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link to={createPageUrl("CreateInvoice")}>
                    <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                      <PlusCircle className="w-5 h-5 mr-2" />
                      Create Invoice
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice) => {
                  const StatusIcon =
                    statusConfig[invoice.status]?.icon || FileText;
                  const isAssigned =
                    invoice.assigned_to ||
                    (invoice.assigned_to_users &&
                      invoice.assigned_to_users.length > 0);

                  return (
                    <div
                      key={invoice.id}
                      className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
                    >
                      <div
                        className={`h-1 ${statusConfig[invoice.status]?.indicator || "bg-ink-300"}`}
                      />
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-content dark:text-content-inverted text-sm">
                                {invoice.invoice_number ||
                                  `#${invoice.id.slice(0, 8)}`}
                              </span>
                              {isAssigned && (
                                <span className="text-[10px] bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                  Assigned
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-ink-700 dark:text-ink-300 font-semibold truncate">
                              {invoice.client_name}
                            </p>
                            <p className="text-xs text-content-subtle dark:text-content-muted mt-0.5 font-medium">
                              {format(new Date(invoice.created_date), "MMM d")}{" "}
                              • Due{" "}
                              {format(
                                new Date(
                                  invoice.due_date || invoice.created_date,
                                ),
                                "MMM d",
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-content dark:text-content-inverted text-lg">
                              ${invoice.total?.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
                          <button
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold active:scale-95 transition-transform ${statusConfig[invoice.status]?.color || "bg-ink-100"}`}
                            onClick={() => setMobileStatusPicker(invoice.id)}
                          >
                            {updatingStatus === invoice.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <StatusIcon className="w-3 h-3" />
                            )}
                            <span className="capitalize">{invoice.status}</span>
                          </button>

                          <div className="flex gap-2">
                            <Link
                              to={
                                createPageUrl("InvoiceDetail") +
                                `?id=${invoice.id}`
                              }
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 text-xs font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-700"
                              >
                                View
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
                              onClick={() => setMobileMenuOpen(invoice.id)}
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
            )}
          </div>

          {/* Mobile Bottom Sheet */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                  onClick={() => setMobileMenuOpen(false)}
                />

                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-ink-800 rounded-t-3xl z-50 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                >
                  {/* Handle bar */}
                  <div className="w-full flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-12 h-1.5 bg-ink-300 dark:bg-ink-600 rounded-full"></div>
                  </div>

                  <div className="px-6 py-4 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between bg-surface-sunken/50 dark:bg-ink-800/50 flex-shrink-0">
                    <div>
                      <h3 className="font-black text-content dark:text-content-inverted text-lg">
                        Invoice Actions
                      </h3>
                      <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                        {
                          filteredInvoices.find(
                            (inv) => inv.id === mobileMenuOpen,
                          )?.invoice_number
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-600 active:scale-95 transition-all"
                    >
                      <X className="w-5 h-5 text-content-body dark:text-content-subtle" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
                    {filteredInvoices.find((inv) => inv.id === mobileMenuOpen)
                      ?.status === "overdue" && (
                      <button
                        className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-alert-50 dark:hover:bg-alert-900/20 hover:text-alert-700 dark:hover:text-alert-400 rounded-2xl transition-all active:scale-[0.98]"
                        onClick={() => {
                          setNotificationDialog({
                            open: true,
                            invoice: filteredInvoices.find(
                              (inv) => inv.id === mobileMenuOpen,
                            ),
                          });
                          setMobileMenuOpen(false);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-alert-100 dark:bg-alert-900/30 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-5 h-5 text-alert-600 dark:text-alert-400" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-bold">Send Overdue Notice</p>
                          <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                            Email or SMS reminder
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                      </button>
                    )}

                    {filteredInvoices.find((inv) => inv.id === mobileMenuOpen)
                      ?.pdf_url && (
                      <a
                        href={
                          filteredInvoices.find(
                            (inv) => inv.id === mobileMenuOpen,
                          )?.pdf_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full"
                      >
                        <button className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-2xl transition-all active:scale-[0.98]">
                          <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                            <Download className="w-5 h-5 text-content-body dark:text-content-subtle" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-bold">Download PDF</p>
                            <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                              Save invoice to device
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                        </button>
                      </a>
                    )}

                    <button
                      className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
                      onClick={() => {
                        setDeleteDialog({
                          open: true,
                          invoice: filteredInvoices.find(
                            (inv) => inv.id === mobileMenuOpen,
                          ),
                        });
                        setMobileMenuOpen(false);
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold">Delete Invoice</p>
                        <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                          Remove permanently
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Mobile Status Picker Bottom Sheet */}
          <AnimatePresence>
            {mobileStatusPicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                  onClick={() => setMobileStatusPicker(null)}
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-ink-800 rounded-t-3xl z-50 shadow-2xl overflow-hidden"
                  style={{
                    paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
                  }}
                >
                  <div className="w-full flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 bg-ink-300 dark:bg-ink-600 rounded-full" />
                  </div>
                  <div className="px-6 py-3 border-b border-line-subtle dark:border-ink-700">
                    <h3 className="font-black text-content dark:text-content-inverted text-base">
                      Change Status
                    </h3>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {Object.entries(statusConfig).map(([status, config]) => {
                      const Icon = config.icon;
                      const isCurrentStatus =
                        filteredInvoices.find(
                          (inv) => inv.id === mobileStatusPicker,
                        )?.status === status;
                      return (
                        <button
                          key={status}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] ${isCurrentStatus ? "bg-ink-100 dark:bg-ink-700" : "hover:bg-surface-sunken dark:hover:bg-ink-700/50"}`}
                          onClick={() => {
                            handleStatusChange(mobileStatusPicker, status);
                            setMobileStatusPicker(null);
                          }}
                        >
                          <span
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="font-semibold text-ink-800 dark:text-ink-200 capitalize text-sm">
                            {status}
                          </span>
                          {isCurrentStatus && (
                            <CheckCircle2 className="w-4 h-4 text-success-500 ml-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Delete Dialog */}
          <Dialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, invoice: null })}
          >
            <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
              <DialogHeader className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto shadow-sm dark:bg-danger-900/30">
                  <Trash2 className="w-7 h-7 text-danger-600 dark:text-danger-400" />
                </div>
                <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
                  Delete Invoice
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-content dark:text-content-inverted">
                    {deleteDialog.invoice?.invoice_number}
                  </span>
                  ? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() =>
                    setDeleteDialog({ open: false, invoice: null })
                  }
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

          {/* Notification Dialog */}
          <Dialog
            open={notificationDialog.open}
            onOpenChange={(open) =>
              setNotificationDialog({ open, invoice: null })
            }
          >
            <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
              <DialogHeader className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-alert-100 flex items-center justify-center mx-auto shadow-sm dark:bg-alert-900/30">
                  <AlertCircle className="w-7 h-7 text-alert-600 dark:text-alert-400" />
                </div>
                <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
                  Send Reminder
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
                  Notify{" "}
                  <span className="font-bold text-content dark:text-content-inverted">
                    {notificationDialog.invoice?.client_name}
                  </span>{" "}
                  about their overdue payment
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-8">
                <Button
                  onClick={() =>
                    handleSendOverdueNotification(
                      notificationDialog.invoice,
                      "email",
                    )
                  }
                  disabled={
                    sendingNotification === notificationDialog.invoice?.id
                  }
                  className="w-full h-12 text-sm font-semibold bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl shadow-lg shadow-brand-200 dark:shadow-brand-900/30"
                >
                  {sendingNotification === notificationDialog.invoice?.id ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-5 h-5 mr-2" />
                  )}
                  Send via Email
                </Button>

                <Button
                  onClick={() =>
                    handleSendOverdueNotification(
                      notificationDialog.invoice,
                      "sms",
                    )
                  }
                  disabled={
                    sendingNotification === notificationDialog.invoice?.id
                  }
                  variant="outline"
                  className="w-full h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
                >
                  {sendingNotification === notificationDialog.invoice?.id ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="w-5 h-5 mr-2" />
                  )}
                  Send via SMS
                </Button>

                <Button
                  variant="ghost"
                  onClick={() =>
                    setNotificationDialog({ open: false, invoice: null })
                  }
                  className="w-full h-12 text-sm font-semibold hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </PullToRefresh>
  );
}
