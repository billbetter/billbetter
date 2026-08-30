import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  ArrowRight,
  UserCheck,
  ClipboardList,
  X,
  ChevronRight,
  TrendingUp,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import PullToRefresh from "@/components/utils/PullToRefresh";

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    quote: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(null);
  const [convertDialog, setConvertDialog] = useState({
    open: false,
    quote: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadData();

    // Auto-refresh every 10 seconds to catch SMS-based status updates
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const user = await sdk.auth.me();

      const [quoteData, settingsData] = await Promise.all([
        sdk.entities.Quote.filter({ user_id: user.id }, "-created_date"),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
      ]);

      setQuotes(quoteData);
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
    if (!deleteDialog.quote) return;

    setDeleting(true);
    try {
      await sdk.entities.Quote.delete(deleteDialog.quote.id);
      setDeleteDialog({ open: false, quote: null });
      loadData(true);
    } catch (error) {
      console.error("Error deleting quote:", error);
      alert("Failed to delete quote. Please try again.");
    }
    setDeleting(false);
  };

  const handleEdit = (quoteId) => {
    navigate(createPageUrl(`CreateQuote?id=${quoteId}`));
  };

  const handleStatusChange = async (quoteId, newStatus) => {
    setUpdatingStatus(quoteId);
    try {
      // -- Stamp the date, never a name -----------------------------------
      //
      // approved_by_name and declined_by_name are written ONLY by a client
      // responding through the public link, where a real person typed their
      // name into a confirmation. That is the whole evidentiary value of those
      // columns.
      //
      // You moving this dropdown is a different event: it records that the
      // quote is settled, not that the client asserted anything. So it stamps
      // the timestamp alone, and QuoteDetail renders the two differently --
      // "Marked approved by you" versus "Approved by Dana Marchetti". A record
      // that looked identical either way would be worth nothing in a dispute,
      // which is the one moment it exists for.
      const patch = { status: newStatus };
      const now = new Date().toISOString();
      if (newStatus === "approved") patch.approved_at = now;
      if (newStatus === "declined") patch.declined_at = now;

      await sdk.entities.Quote.update(quoteId, patch);

      // The notification that used to live here called "notifyQuoteApproval",
      // a function that has never existed: sdk.js routes the name to
      // notImplemented, and the only caller logged the result to the console.
      // So a manual approve told nobody, and said "✅" while doing it.
      //
      // Nothing replaces it deliberately. The approval notification exists to
      // tell the contractor something they do not already know; you moving
      // this dropdown yourself is not that. The client-response path in
      // approve-quote sends it, gated by Settings.

      await loadData(true);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
    setUpdatingStatus(null);
  };

  const handleConvertToInvoice = async () => {
    if (!convertDialog.quote) return;

    setConverting(convertDialog.quote.id);
    try {
      await sdk.entities.Quote.update(convertDialog.quote.id, {
        status: "converted",
      });

      const params = new URLSearchParams({
        fromQuote: "true",
        quoteId: convertDialog.quote.id,
        clientId: convertDialog.quote.client_id || "",
        clientName: convertDialog.quote.client_name,
        clientEmail: convertDialog.quote.client_email || "",
        items: JSON.stringify(convertDialog.quote.items),
        taxRate: convertDialog.quote.tax_rate || 0,
        notes: convertDialog.quote.notes || "",
        quoteNumber: convertDialog.quote.quote_number,
      });

      navigate(createPageUrl("CreateInvoice") + "?" + params.toString());
    } catch (error) {
      console.error("Error converting quote:", error);
      alert("Failed to convert quote. Please try again.");
    } finally {
      setConverting(null);
      setConvertDialog({ open: false, quote: null });
    }
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      const response = await sdk.functions.invoke("exportQuotesToExcel", {
        quote_ids: [],
      });

      // Without this the line below wrapped a plain object in a Blob and
      // downloaded a .xlsx containing the text [object Object].
      if (!response?.data || response.data.success === false) {
        alert(
          response?.data?.not_implemented
            ? "Excel export isn't available yet."
            : "Export failed. Please try again.",
        );
        return;
      }

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotes-export-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Error exporting quotes:", error);
      alert("Failed to export quotes. Please try again.");
    }
    setExporting(false);
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || quote.status === statusFilter;
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
    approved: {
      color:
        "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
      icon: CheckCircle2,
      indicator: "bg-success-500",
    },
    declined: {
      color:
        "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400",
      icon: XCircle,
      indicator: "bg-danger-500",
    },
    converted: {
      color:
        "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400",
      icon: FileCheck,
      indicator: "bg-accent-500",
    },
  };

  /**
   * Who responded to this quote, for the list.
   *
   * Returns null unless a CLIENT responded through the public link -- the name
   * columns are written by nothing else. A quote the contractor marked approved
   * from the dropdown here keeps its badge and nothing more, which is correct:
   * there is no client assertion to report, and inventing a line that looked
   * like one would make the two indistinguishable at a glance.
   */
  const respondedBy = (quote) => {
    if (quote.status === "approved" && quote.approved_by_name) {
      return { verb: "Approved by", who: quote.approved_by_name };
    }
    if (
      (quote.status === "declined" || quote.status === "rejected") &&
      quote.declined_by_name
    ) {
      return { verb: "Declined by", who: quote.declined_by_name };
    }
    return null;
  };

  const stats = {
    total: filteredQuotes.length,
    pending: filteredQuotes.filter((q) => q.status === "sent").length,
    approved: filteredQuotes.filter((q) => q.status === "approved").length,
    declined: filteredQuotes.filter((q) => q.status === "declined").length,
    totalValue: filteredQuotes.reduce((sum, q) => sum + (q.total || 0), 0),
  };

  const getExpiryStatus = (expiryDate) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0)
      return {
        text: "Expired",
        color: "text-danger-600 dark:text-danger-400",
        bgColor: "bg-danger-50 dark:bg-danger-900/30",
        indicator: "bg-danger-500",
      };
    if (days <= 7)
      return {
        text: `${days}d left`,
        color: "text-alert-600 dark:text-alert-400",
        bgColor: "bg-alert-50 dark:bg-alert-900/30",
        indicator: "bg-alert-500",
      };
    return {
      text: `${days}d left`,
      color: "text-content-body dark:text-content-subtle",
      bgColor: "bg-ink-100 dark:bg-ink-800",
      indicator: "bg-ink-400",
    };
  };

  if (loading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-brand-700 dark:text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading quotes
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
      <div className="min-h-screen bg-surface-sunken/50 dark:bg-surface-inverted">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
                  <ClipboardList className="w-5 h-5 text-content-inverted" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-content dark:text-content-inverted tracking-tight">
                    Quotes
                  </h1>
                  <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                    {stats.total} quotes
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
                      onClick={handleExportToExcel}
                      disabled={exporting}
                      className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      {exporting && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {!exporting && (
                        <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                      )}
                      Export to Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mobile Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-accent-600 dark:text-accent-400" />
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

              <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
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

              <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Approved
                  </p>
                </div>
                <p className="text-xl font-bold text-success-600 dark:text-success-400">
                  {stats.approved}
                </p>
              </div>

              <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-danger-50 dark:bg-danger-900/30 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-danger-600 dark:text-danger-400" />
                  </div>
                  <p className="text-xs font-semibold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                    Declined
                  </p>
                </div>
                <p
                  className={`text-xl font-bold ${stats.declined > 0 ? "text-danger-600 dark:text-danger-400" : "text-content dark:text-content-inverted"}`}
                >
                  {stats.declined}
                </p>
              </div>
            </div>

            <Link to={createPageUrl("CreateQuote")} className="block mb-6">
              <Button className="w-full h-12 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl font-semibold shadow-sm active:scale-[0.98] transition-all">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create New Quote
              </Button>
            </Link>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line dark:border-ink-700 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand-200 dark:shadow-brand-900/30">
                    <ClipboardList className="w-6 h-6 text-content-inverted" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-content dark:text-content-inverted tracking-tight">
                      Quotes & Estimates
                    </h1>
                    <p className="text-sm text-content-muted dark:text-content-subtle mt-1 font-medium">
                      Create and manage professional quotes
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
                        onClick={handleExportToExcel}
                        disabled={exporting}
                        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                      >
                        {exporting && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {!exporting && (
                          <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                        )}
                        Export to Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Link to={createPageUrl("CreateQuote")}>
                    <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted h-10 px-5 text-sm font-semibold rounded-xl shadow-sm active:scale-95 transition-all">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New Quote
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Desktop Stats */}
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
                    <ClipboardList className="w-4 h-4 text-content-subtle dark:text-content-muted" />
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
                    <Clock className="w-4 h-4 text-info-400 dark:text-brand-600" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Pending
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-brand-700 dark:text-brand-400">
                    {stats.pending}
                  </p>
                </div>
                <div className="border-r border-line-subtle dark:border-ink-700 pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-success-400 dark:text-success-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Approved
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-success-600 dark:text-success-400">
                    {stats.approved}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-danger-400 dark:text-danger-500" />
                    <p className="text-xs font-bold text-content-subtle dark:text-content-muted uppercase tracking-wider">
                      Declined
                    </p>
                  </div>
                  <p
                    className={`text-3xl font-bold ${stats.declined > 0 ? "text-danger-600 dark:text-danger-400" : "text-content dark:text-content-inverted"}`}
                  >
                    {stats.declined}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-subtle w-4 h-4 group-focus-within:text-content-body dark:group-focus-within:text-ink-300 transition-colors" />
                <Input
                  placeholder="Search quotes by client or number..."
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
                      value="approved"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Approved
                    </SelectItem>
                    <SelectItem
                      value="declined"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Declined
                    </SelectItem>
                    <SelectItem
                      value="converted"
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Converted
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm overflow-x-auto">
            {filteredQuotes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                </div>
                <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                  {searchTerm || statusFilter !== "all"
                    ? "No quotes found"
                    : "No quotes yet"}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search"
                    : "Create your first quote to get started"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link to={createPageUrl("CreateQuote")}>
                    <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                      <PlusCircle className="w-5 h-5 mr-2" />
                      Create Quote
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[130px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" />
                        Quote
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5" />
                        Client
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[110px]">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Issued
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[100px]">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Validity
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[120px]">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Amount
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[130px]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Status
                      </div>
                    </TableHead>
                    <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-center w-[110px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => {
                    const StatusIcon =
                      statusConfig[quote.status]?.icon || FileText;
                    const expiryStatus = getExpiryStatus(quote.expiry_date);
                    const canConvert =
                      quote.status === "approved" &&
                      quote.status !== "converted";
                    const isAssigned =
                      quote.assigned_to ||
                      (quote.assigned_to_users &&
                        quote.assigned_to_users.length > 0);

                    return (
                      <TableRow
                        key={quote.id}
                        className="border-b border-line-subtle dark:border-ink-700 hover:bg-surface-sunken/50 dark:hover:bg-ink-700/50 transition-colors group"
                      >
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-1 h-8 rounded-full ${statusConfig[quote.status]?.indicator || "bg-ink-300"}`}
                            />
                            <button
                              onClick={() =>
                                navigate(
                                  createPageUrl("QuoteDetail") +
                                    `?id=${quote.id}`,
                                )
                              }
                              className="font-bold text-content dark:text-content-inverted hover:text-accent-600 dark:hover:text-accent-400 transition-colors text-sm"
                            >
                              {quote.quote_number || `#${quote.id.slice(0, 8)}`}
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <p className="font-bold text-content dark:text-content-inverted text-sm">
                            {quote.client_name}
                          </p>
                          {quote.client_email && (
                            <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                              {quote.client_email}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">
                            {format(new Date(quote.date_issued), "MMM d, yyyy")}
                          </p>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${expiryStatus.bgColor} ${expiryStatus.color}`}
                          >
                            <Clock className="w-3 h-3" />
                            {expiryStatus.text}
                          </span>
                        </TableCell>

                        <TableCell className="py-4 px-4 text-right">
                          <p className="font-bold text-content dark:text-content-inverted text-base">
                            ${quote.total?.toFixed(2)}
                          </p>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <Select
                            value={quote.status}
                            onValueChange={(value) =>
                              handleStatusChange(quote.id, value)
                            }
                            disabled={
                              updatingStatus === quote.id ||
                              quote.status === "converted"
                            }
                          >
                            <SelectTrigger
                              className={`w-28 h-7 border-0 bg-transparent p-0 focus:ring-0 text-xs ${updatingStatus === quote.id ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[quote.status]?.color || "bg-ink-100"}`}
                              >
                                {updatingStatus === quote.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <StatusIcon className="w-3 h-3" />
                                )}
                                <span className="capitalize">
                                  {quote.status}
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
                                  disabled={
                                    status === "converted" &&
                                    quote.status !== "converted"
                                  }
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
                          {/*
                            The name the client typed, under the badge. A green
                            badge says the quote is settled; it does not say who
                            settled it, and "who" is the part that matters three
                            months later.
                          */}
                          {respondedBy(quote) && (
                            <p className="mt-1 text-[11px] leading-tight text-content-muted dark:text-content-subtle truncate max-w-[130px]">
                              {respondedBy(quote).verb}{" "}
                              <span className="font-medium text-content-body dark:text-ink-300">
                                {respondedBy(quote).who}
                              </span>
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 text-content-muted hover:text-accent-700 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded-lg"
                              title="Open"
                            >
                              <Link
                                to={
                                  createPageUrl("QuoteDetail") +
                                  `?id=${quote.id}`
                                }
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeleteDialog({ open: true, quote })
                              }
                              className="h-8 w-8 text-content-body hover:text-danger-700 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded-lg dark:text-ink-300"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
            {filteredQuotes.length === 0 ? (
              <div className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-8 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                </div>
                <h3 className="text-lg font-black text-content dark:text-content-inverted mb-1">
                  {searchTerm || statusFilter !== "all"
                    ? "No quotes found"
                    : "No quotes yet"}
                </h3>
                <p className="text-sm text-content-muted dark:text-content-subtle mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "Adjust your filters"
                    : "Create your first quote"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link to={createPageUrl("CreateQuote")}>
                    <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                      <PlusCircle className="w-5 h-5 mr-2" />
                      Create Quote
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuotes.map((quote) => {
                  const StatusIcon =
                    statusConfig[quote.status]?.icon || FileText;
                  const expiryStatus = getExpiryStatus(quote.expiry_date);
                  const canConvert =
                    quote.status === "approved" && quote.status !== "converted";
                  const isAssigned =
                    quote.assigned_to ||
                    (quote.assigned_to_users &&
                      quote.assigned_to_users.length > 0);

                  return (
                    <div
                      key={quote.id}
                      className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
                    >
                      <div
                        className={`h-1 ${statusConfig[quote.status]?.indicator || "bg-ink-300"}`}
                      />
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-content dark:text-content-inverted text-sm">
                                {quote.quote_number ||
                                  `#${quote.id.slice(0, 8)}`}
                              </span>
                              {isAssigned && (
                                <span className="text-[10px] bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                  Assigned
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-ink-700 dark:text-ink-300 font-semibold truncate">
                              {quote.client_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-content-subtle dark:text-content-muted font-medium">
                                {format(new Date(quote.date_issued), "MMM d")}
                              </p>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${expiryStatus.bgColor} ${expiryStatus.color}`}
                              >
                                {expiryStatus.text}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-content dark:text-content-inverted text-lg">
                              ${quote.total?.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
                          <div className="min-w-0">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig[quote.status]?.color || "bg-ink-100"}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span className="capitalize">{quote.status}</span>
                            </span>
                            {respondedBy(quote) && (
                              <p className="mt-1.5 text-[11px] leading-tight text-content-muted dark:text-content-subtle truncate">
                                {respondedBy(quote).verb}{" "}
                                <span className="font-medium text-content-body dark:text-ink-300">
                                  {respondedBy(quote).who}
                                </span>
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {canConvert ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setConvertDialog({ open: true, quote })
                                }
                                className="h-9 px-4 text-xs font-semibold border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/20 rounded-lg hover:bg-success-100 dark:hover:bg-success-900/30"
                              >
                                <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                                Convert
                              </Button>
                            ) : (
                              <Link
                                to={
                                  createPageUrl("QuoteDetail") +
                                  `?id=${quote.id}`
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
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-line dark:border-ink-700 dark:bg-ink-800 rounded-lg active:scale-95 hover:bg-surface-sunken dark:hover:bg-ink-700"
                              onClick={() => setMobileMenuOpen(quote.id)}
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
                        Quote Actions
                      </h3>
                      <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
                        {
                          filteredQuotes.find((q) => q.id === mobileMenuOpen)
                            ?.quote_number
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
                    <Link
                      to={
                        createPageUrl("QuoteDetail") + `?id=${mobileMenuOpen}`
                      }
                      className="block w-full"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <button className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 rounded-2xl transition-all active:scale-[0.98]">
                        <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                          <ExternalLink className="w-5 h-5 text-content-body dark:text-content-subtle" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-bold">View Details</p>
                          <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                            See full quote information
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                      </button>
                    </Link>

                    {filteredQuotes.find((q) => q.id === mobileMenuOpen)
                      ?.pdf_url ? (
                      <a
                        href={
                          filteredQuotes.find((q) => q.id === mobileMenuOpen)
                            ?.pdf_url
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
                              Save quote to device
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                        </button>
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-content-subtle dark:text-content-body rounded-2xl opacity-50 cursor-not-allowed dark:dark:text-ink-300"
                      >
                        <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-bold">Generating PDF...</p>
                        </div>
                      </button>
                    )}

                    <button
                      className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-ink-700 dark:text-ink-300 hover:bg-info-50 dark:hover:bg-info-900/20 hover:text-info-700 dark:hover:text-info-400 rounded-2xl transition-all active:scale-[0.98]"
                      onClick={() => {
                        handleEdit(mobileMenuOpen);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-info-100 dark:bg-info-900/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-brand-700 dark:text-brand-400" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold">Edit Quote</p>
                        <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5 truncate">
                          Modify quote details
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                    </button>

                    <button
                      className="w-full flex items-center gap-4 px-4 py-4 text-base font-semibold text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-2xl transition-all active:scale-[0.98]"
                      onClick={() => {
                        setDeleteDialog({
                          open: true,
                          quote: filteredQuotes.find(
                            (q) => q.id === mobileMenuOpen,
                          ),
                        });
                        setMobileMenuOpen(false);
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold">Delete Quote</p>
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

          {/* Delete Dialog */}
          <Dialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, quote: null })}
          >
            <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
              <DialogHeader className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto shadow-sm dark:bg-danger-900/30">
                  <Trash2 className="w-7 h-7 text-danger-600 dark:text-danger-400" />
                </div>
                <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
                  Delete Quote
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-content dark:text-content-inverted">
                    {deleteDialog.quote?.quote_number}
                  </span>
                  ? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialog({ open: false, quote: null })}
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

          {/* Convert to Invoice Dialog */}
          <Dialog
            open={convertDialog.open}
            onOpenChange={(open) => setConvertDialog({ open, quote: null })}
          >
            <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
              <DialogHeader className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-success-100 flex items-center justify-center mx-auto shadow-sm dark:bg-success-900/30">
                  <ArrowRight className="w-7 h-7 text-success-600 dark:text-success-400" />
                </div>
                <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
                  Convert to Invoice
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
                  Convert{" "}
                  <span className="font-bold text-content dark:text-content-inverted">
                    {convertDialog.quote?.quote_number}
                  </span>{" "}
                  to an invoice? The quote will be marked as converted.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setConvertDialog({ open: false, quote: null })}
                  disabled={converting === convertDialog.quote?.id}
                  className="flex-1 h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConvertToInvoice}
                  disabled={converting === convertDialog.quote?.id}
                  className="flex-1 h-12 text-sm font-semibold bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl shadow-lg shadow-success-200 dark:shadow-success-900/30"
                >
                  {converting === convertDialog.quote?.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Convert"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </PullToRefresh>
  );
}
