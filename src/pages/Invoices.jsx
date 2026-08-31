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
  Send,
  CheckSquare,
  Ban,
  FileSpreadsheet,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  batchSendEligibility,
  sendInvoiceBatch,
  draftsNowSent,
} from "@/lib/invoiceBatch";
import { canDeleteInvoice, isVoided, VOID_STATUS } from "@/lib/invoiceVoid";
import RecordPaymentDialog from "@/components/invoice/RecordPaymentDialog";
import {
  formatMoney,
  indexPaymentsByInvoice,
  paymentRecord,
  paymentSummary,
  paymentsSupported,
  settledDate,
  statusChangeEvent,
  statusFromPayments,
} from "@/lib/invoicePayments";
import { dueReminders, reminderSentPatch } from "@/lib/reminders";
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

  // -- Batch sending ------------------------------------------------------
  //
  // Selection is off until asked for. Checkboxes on every row by default turn
  // a list you mostly READ into a form, and the common action here is opening
  // one invoice, not mailing twelve.
  const [payments, setPayments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [paymentFor, setPaymentFor] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResult, setBatchResult] = useState(null);

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
      setCurrentUser(user);

      // Payments are loaded alongside the invoices so each row can show what
      // is still owed on it. Allowed to fail on its own: without them every
      // invoice reads as fully unpaid, which is what the list showed before
      // this feature and is a worse outcome than no list at all.
      const [invoiceData, settingsData, paymentData] = await Promise.all([
        sdk.entities.Invoice.filter({ user_id: user.id }, "-created_date"),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
        sdk.entities.InvoicePayment.filter({ user_id: user.id }).catch(() => []),
      ]);

      setInvoices(invoiceData);
      setPayments(paymentData || []);
      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  /**
   * Record a payment from the list.
   *
   * Same ordering as InvoiceDetail: the payment row is created FIRST and the
   * invoice is marked paid only once it exists. The reverse leaves an invoice
   * marked paid with nothing behind it if the second write fails, which is the
   * exact state this feature exists to abolish.
   */
  const handleRecordPayment = async (form) => {
    const invoice = paymentFor;
    if (!invoice) return;

    setRecordingPayment(true);
    setPaymentError(null);
    try {
      const existing = paymentsByInvoice.get(invoice.id) || [];
      const created = await sdk.entities.InvoicePayment.create(
        paymentRecord({ invoice, user: currentUser, ...form }),
      );
      const next = [...existing, created];

      const nextStatus = statusFromPayments(invoice, next);
      if (nextStatus) {
        await sdk.entities.Invoice.update(invoice.id, {
          status: nextStatus,
          paid_date: settledDate(invoice, next),
        });
        try {
          await sdk.entities.InvoiceEvent.create(
            statusChangeEvent({
              invoice,
              from: invoice.status,
              to: nextStatus,
              detail: "Settled in full",
              user: currentUser,
            }),
          );
        } catch (err) {
          // A history entry that failed must not fail the payment it describes.
          console.error("Could not record history entry (ignored):", err);
        }
      }

      setPaymentFor(null);
      await loadData(true);
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err?.message || "Could not record that payment.");
    }
    setRecordingPayment(false);
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
    // A voided invoice's status is frozen. Both controls that reach here are
    // already disabled for one, but disabling a control is presentation and
    // this is the function that writes -- and the write it would make is an
    // undo of a void that recorded who did it, when and why, with nothing
    // recording the undo.
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (isVoided(target) || newStatus === VOID_STATUS) return;

    // Choosing "paid" opens the payment dialog rather than writing the status.
    //
    // This dropdown was the ONLY way to mark an offline payment, and it wrote
    // `{ status: 'paid' }` and nothing else -- no date, no amount, no method,
    // no actor. paid_date stayed null, so the invoice could never say when it
    // was paid and the revenue charts fell back to the date it was raised.
    // The dialog is prefilled with today and the full balance, so the one-click
    // habit still costs two clicks rather than a form.
    if (newStatus === "paid" && target && paymentsSupported()) {
      setPaymentError(null);
      setPaymentFor(target);
      return;
    }

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
      } else if (response.data.not_implemented) {
        // Was silently treated as sent. Chasing is the product's core promise,
        // so saying nothing here is worse than admitting it is not built.
        alert(
          `Automatic ${method} reminders aren't available yet. The invoice detail screen has the client's contact details so you can chase them directly.`,
        );
      } else {
        alert(`Couldn't send that reminder: ${response.data.error || "unknown error"}`);
      }
    } catch (error) {
      console.error("Error sending overdue notification:", error);
      alert("Failed to send notification. Please try again.");
    }
    setSendingNotification(null);
  };

  /**
   * Fetch one invoice's PDF and hand it to the browser.
   *
   * List queries deliberately no longer select pdf_url: that column stores the
   * whole PDF inline as a base64 data: URL, so `select("*")` on the list meant
   * downloading every invoice's PDF on every visit to this page. Fetching by id
   * keeps every column, so the document is complete here.
   */
  const downloadInvoicePdf = async (invoiceId) => {
    try {
      const inv = await sdk.entities.Invoice.get(invoiceId);
      const pdf = inv?.pdf_url || "";
      if (!pdf.startsWith("data:application/pdf")) {
        alert("No PDF is available for this invoice yet.");
        return;
      }
      // Chrome blocks top-level navigation to data: URLs, so it has to become a
      // blob before a download link will take it.
      const blob = await (await fetch(pdf)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${inv.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Could not download the PDF. Please try again.");
    }
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

        // The PDF column is gone on purpose. It wrote the entire PDF into a
        // cell as a base64 data: URL -- 22 kB per row, which no spreadsheet
        // can open and which is no longer fetched by list queries anyway.
        return [
          invoiceNumber,
          clientName,
          createdDate,
          dueDate,
          total,
          status,
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

  // -- Batch sending: derived state and the run itself ---------------------

  // Built once per render rather than filtered per row: the list renders every
  // invoice on the account, and a linear scan inside the loop is quadratic on
  // exactly the accounts where it would be felt.
  const paymentsByInvoice = indexPaymentsByInvoice(payments);

  /** Eligibility for every visible invoice, keyed by id. */
  const eligibility = new Map(
    filteredInvoices.map((inv) => [inv.id, batchSendEligibility(inv)]),
  );

  // Selection is kept as ids, so filtering or searching mid-selection cannot
  // silently drop an invoice from the batch. But only what is currently
  // VISIBLE and eligible can actually be sent -- sending something the user
  // can no longer see would be the worse surprise.
  const selectableIds = filteredInvoices
    .filter((inv) => eligibility.get(inv.id)?.ok)
    .map((inv) => inv.id);
  const chosen = filteredInvoices.filter(
    (inv) => selectedIds.has(inv.id) && eligibility.get(inv.id)?.ok,
  );
  const resendCount = chosen.filter(
    (inv) => eligibility.get(inv.id)?.kind === "resend",
  ).length;
  const allSelectableChosen =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  // Overdue invoices the ladder says are due a chase today. Computed from the
  // invoice rows themselves rather than from a stored queue, so it is always
  // current and there is no second thing to keep in step.
  const remindersDue = dueReminders(filteredInvoices);

  const toggleOne = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      allSelectableChosen ? new Set() : new Set([...prev, ...selectableIds]),
    );

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  /**
   * Send everything selected, one at a time.
   *
   * Only invoices that were drafts AND actually went out are flipped to
   * 'sent'. A re-sent overdue invoice keeps its status: rewriting it to 'sent'
   * would erase the fact that it is late, which is the one thing that status
   * is carrying.
   */
  const handleBatchSend = async () => {
    if (!chosen.length || batchRunning) return;
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: chosen.length });

    const rows = chosen.map((invoice) => ({ invoice }));
    const summary = await sendInvoiceBatch(
      rows,
      sdk.functions.invoke,
      (done) => setBatchProgress({ done, total: rows.length }),
    );

    const toFlip = new Set(draftsNowSent(rows, summary.results));
    const delivered = new Set(
      summary.results.filter((r) => r.emailed || r.texted).map((r) => r.id),
    );

    for (const { invoice } of rows) {
      if (!delivered.has(invoice.id)) continue;

      // An overdue invoice going out again IS a reminder, however it was
      // triggered -- so the ladder is advanced here rather than in a separate
      // "send reminders" path. One code path means the count cannot disagree
      // with what the client actually received.
      const patch = toFlip.has(invoice.id) ? { status: "sent" } : {};
      if (String(invoice.status || "").toLowerCase() === "overdue") {
        Object.assign(patch, reminderSentPatch(invoice));
      }
      if (!Object.keys(patch).length) continue;

      try {
        await sdk.entities.Invoice.update(invoice.id, patch);
      } catch (err) {
        // The mail is already gone; failing to record that is worth a line in
        // the console but must not be reported to the user as a failed send.
        console.error("Sent, but could not record it for", invoice.id, err);
      }
    }

    setBatchRunning(false);
    setBatchResult(summary);
    exitSelectMode();
    loadData(true);
  };

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
    // Display only. SETTABLE_STATUSES below is what the per-row dropdown
    // offers, and `void` is deliberately not in it: voiding has to record who,
    // when and why, and a dropdown records none of those. It is reachable only
    // from the Void dialog on InvoiceDetail, and there is no way back.
    void: {
      color:
        "bg-ink-200 text-ink-700 line-through dark:bg-ink-700 dark:text-ink-200",
      icon: Ban,
      indicator: "bg-ink-500 dark:bg-ink-500",
    },
  };

  /**
   * The statuses the per-row dropdown may set.
   *
   * Built by subtraction from statusConfig rather than as its own list, so a
   * status added to the map for display does not become settable by accident
   * -- which is exactly how `void` would have leaked in.
   */
  const SETTABLE_STATUSES = Object.keys(statusConfig).filter(
    (s) => s !== VOID_STATUS,
  );

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
                      {/* Sits beside Export CSV on purpose: exporting and
                          importing are the same shape of task, and this is
                          where someone who has just exported will look. */}
                      <DropdownMenuItem asChild>
                        <Link
                          to={createPageUrl("BatchInvoices")}
                          className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
                          Batch / import
                        </Link>
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
                    <SelectItem
                      value={VOID_STATUS}
                      className="dark:text-ink-300 dark:focus:bg-ink-700"
                    >
                      Voided
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Reminders that are due today.
              Nothing sends on its own -- this only says which invoices the
              ladder thinks are ready, and hands them to the same batch send
              the contractor already uses. Reviewing means selecting exactly
              these and nothing else, so the decision to mail a client is
              always a click someone made. */}
          {remindersDue.length > 0 && !selectMode && (
            <div className="rounded-xl border border-caution-200 bg-caution-50 p-4 shadow-sm dark:border-caution-800 dark:bg-caution-900/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-caution-900 dark:text-caution-200">
                    {remindersDue.length}{" "}
                    {remindersDue.length === 1 ? "reminder is" : "reminders are"}{" "}
                    due
                  </p>
                  <p className="mt-1 text-sm text-caution-800 dark:text-caution-300">
                    {remindersDue
                      .slice(0, 3)
                      .map(
                        (r) =>
                          `${r.invoice.invoice_number || "Invoice"} · ${r.invoice.client_name || "client"} · ${r.status.daysOverdue} days over`,
                      )
                      .join(" — ")}
                    {remindersDue.length > 3
                      ? ` — and ${remindersDue.length - 3} more`
                      : ""}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setSelectedIds(new Set(remindersDue.map((r) => r.invoice.id)));
                    setSelectMode(true);
                  }}
                  className="flex-shrink-0 bg-brand hover:bg-brand-hover text-content-inverted"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Review {remindersDue.length}
                </Button>
              </div>
            </div>
          )}

          {/* Batch sending.
              Off until asked for: checkboxes on every row turn a list you
              mostly read into a form, and the usual action here is opening one
              invoice. Once on, the bar states plainly how many are re-sends,
              because mailing a client a second copy of the same invoice is a
              different act from sending it for the first time. */}
          {selectableIds.length > 0 && (
            <div className="bg-surface dark:bg-surface-inverted rounded-xl border border-line-subtle dark:border-ink-800 p-3 sm:p-4 shadow-sm">
              {!selectMode ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-content-body dark:text-content-subtle">
                    {selectableIds.length}{" "}
                    {selectableIds.length === 1 ? "invoice" : "invoices"} can be
                    sent or re-sent.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSelectMode(true)}
                    className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select invoices
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={toggleAll}
                      disabled={batchRunning}
                      className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {allSelectableChosen
                        ? "Clear selection"
                        : `Select all ${selectableIds.length}`}
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={exitSelectMode}
                        disabled={batchRunning}
                        className="text-content-body dark:text-content-subtle"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBatchSend}
                        disabled={batchRunning || chosen.length === 0}
                        className="bg-brand hover:bg-brand-hover text-content-inverted"
                      >
                        {batchRunning ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {batchRunning
                          ? `Sending ${batchProgress.done} of ${batchProgress.total}...`
                          : `Send ${chosen.length}`}
                      </Button>
                    </div>
                  </div>

                  {chosen.length > 0 && !batchRunning && (
                    <p className="text-xs text-content-muted dark:text-content-subtle">
                      {resendCount > 0 ? (
                        <>
                          <span className="font-semibold text-caution-700 dark:text-caution-400">
                            {resendCount} of these{" "}
                            {resendCount === 1 ? "has" : "have"} already been
                            sent
                          </span>{" "}
                          — your client will get a second copy.{" "}
                        </>
                      ) : null}
                      Each client gets an email or text with a link to view and
                      pay. No PDF is attached.
                    </p>
                  )}

                  {batchRunning && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{
                          width: `${batchProgress.total ? (batchProgress.done / batchProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                    {selectMode && (
                      <TableHead className="h-12 w-[52px] pl-6 pr-0">
                        <Checkbox
                          checked={allSelectableChosen}
                          onCheckedChange={toggleAll}
                          disabled={batchRunning}
                          aria-label="Select all sendable invoices"
                        />
                      </TableHead>
                    )}
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
                        {selectMode && (
                          <TableCell className="py-4 pl-6 pr-0">
                            {/* Ineligible rows show a disabled box with the
                                reason on hover rather than an empty cell, so
                                "why can't I pick this one" is answered where
                                it is asked. */}
                            <Checkbox
                              checked={selectedIds.has(invoice.id)}
                              onCheckedChange={() => toggleOne(invoice.id)}
                              disabled={
                                batchRunning || !eligibility.get(invoice.id)?.ok
                              }
                              title={eligibility.get(invoice.id)?.reason || ""}
                              aria-label={`Select invoice ${invoice.invoice_number || ""}`}
                            />
                          </TableCell>
                        )}
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
                          {/* Only when a PART of it has been paid. A fully
                              unpaid invoice already says what is owed -- the
                              total -- and repeating it on every row would bury
                              the handful where it differs. */}
                          {(() => {
                            const s = paymentSummary(
                              invoice,
                              paymentsByInvoice.get(invoice.id) || [],
                            );
                            if (s.count === 0 || s.settled) return null;
                            return (
                              <p className="text-xs font-semibold text-alert-700 dark:text-alert-400 mt-0.5">
                                {formatMoney(s.balance)} still owed
                              </p>
                            );
                          })()}
                        </TableCell>

                        <TableCell className="py-4 px-6">
                          {/* A voided invoice's status is frozen. Leaving the
                              dropdown live would let one click undo a void
                              that recorded who did it and why -- and there is
                              no equivalent record of the undo. */}
                          <Select
                            value={invoice.status}
                            onValueChange={(value) =>
                              handleStatusChange(invoice.id, value)
                            }
                            disabled={
                              updatingStatus === invoice.id || isVoided(invoice)
                            }
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
                              {SETTABLE_STATUSES.map((status) => (
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
                                {/* A voided invoice is a record. Delete is
                                    not offered here, and handleDelete refuses
                                    it as well -- hiding a control is
                                    presentation, not enforcement. */}
                                {canDeleteInvoice(invoice).ok ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setDeleteDialog({ open: true, invoice })
                                    }
                                    className="rounded-lg text-danger-600 dark:text-danger-400 dark:focus:bg-ink-700"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled
                                    className="rounded-lg dark:text-ink-400"
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Voided — kept on record
                                  </DropdownMenuItem>
                                )}
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
                              {/* Same control as the desktop table. Batch
                                  sending on a phone is the case that matters
                                  most -- it is where a contractor sits at the
                                  end of a day with a list of finished work. */}
                              {selectMode && (
                                <Checkbox
                                  checked={selectedIds.has(invoice.id)}
                                  onCheckedChange={() => toggleOne(invoice.id)}
                                  disabled={
                                    batchRunning ||
                                    !eligibility.get(invoice.id)?.ok
                                  }
                                  aria-label={`Select invoice ${invoice.invoice_number || ""}`}
                                  className="h-5 w-5"
                                />
                              )}
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
                            {(() => {
                              const s = paymentSummary(
                                invoice,
                                paymentsByInvoice.get(invoice.id) || [],
                              );
                              if (s.count === 0 || s.settled) return null;
                              return (
                                <p className="text-xs font-semibold text-alert-700 dark:text-alert-400 mt-0.5">
                                  {formatMoney(s.balance)} owed
                                </p>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-ink-50 dark:border-ink-700">
                          <button
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-transform ${isVoided(invoice) ? "" : "active:scale-95"} ${statusConfig[invoice.status]?.color || "bg-ink-100"}`}
                            disabled={isVoided(invoice)}
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

                    {/*
                      Fetches the document on click. The list query no longer
                      asks for pdf_url, because that column holds the entire PDF
                      inline as base64 and selecting it meant downloading every
                      invoice's PDF just to render this menu.
                    */}
                    {mobileMenuOpen && (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          downloadInvoicePdf(mobileMenuOpen);
                        }}
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

                    {canDeleteInvoice(
                      filteredInvoices.find((inv) => inv.id === mobileMenuOpen),
                    ).ok ? (
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
                    ) : (
                      <div className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-ink-50 dark:bg-ink-700/40">
                        <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                          <Ban className="w-5 h-5 text-content-body dark:text-content-subtle" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-bold text-content dark:text-content-inverted text-base">
                            Voided
                          </p>
                          <p className="text-xs text-content-muted dark:text-content-subtle font-medium mt-0.5">
                            Kept on record. It cannot be deleted.
                          </p>
                        </div>
                      </div>
                    )}
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
                    {SETTABLE_STATUSES.map((status) => {
                      const config = statusConfig[status];
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

          <RecordPaymentDialog
        open={Boolean(paymentFor)}
        onOpenChange={(open) => {
          if (!open) setPaymentFor(null);
        }}
        invoice={paymentFor}
        payments={paymentFor ? paymentsByInvoice.get(paymentFor.id) || [] : []}
        saving={recordingPayment}
        error={paymentError}
        onRecord={handleRecordPayment}
      />

      {/* What the batch actually did.
              Named per invoice rather than summarised as "3 of 5 sent",
              because the only useful next action is retrying the specific ones
              that failed, and a contractor cannot do that from a count. */}
          <Dialog
            open={Boolean(batchResult)}
            onOpenChange={(open) => !open && setBatchResult(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-lg font-bold text-content dark:text-content-inverted">
                  {batchResult?.failed === 0
                    ? `Sent ${batchResult?.sent} ${batchResult?.sent === 1 ? "invoice" : "invoices"}`
                    : `Sent ${batchResult?.sent} of ${batchResult?.total}`}
                </DialogTitle>
                <DialogDescription className="text-content-body dark:text-content-subtle">
                  {batchResult?.failed === 0
                    ? "Every client has been contacted."
                    : `${batchResult?.failed} could not be delivered. Nothing else was affected.`}
                </DialogDescription>
              </DialogHeader>

              {batchResult?.failed > 0 && (
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {batchResult.results
                    .filter((r) => !r.emailed && !r.texted)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm dark:border-danger-800 dark:bg-danger-900/20"
                      >
                        <p className="font-semibold text-danger-800 dark:text-danger-300">
                          {r.invoice_number || r.id}
                        </p>
                        <p className="text-xs text-danger-700 dark:text-danger-400">
                          {r.errors[0] || "Failed to send"}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              <Button
                onClick={() => setBatchResult(null)}
                className="mt-4 w-full bg-brand hover:bg-brand-hover text-content-inverted"
              >
                Done
              </Button>
            </DialogContent>
          </Dialog>

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
