import React, { useState } from "react";
import { sdk } from "@/api/sdk";










import {
  sendInvoiceBatch,
  draftsNowSent,
} from "@/lib/invoiceBatch";
import { isVoided, VOID_STATUS } from "@/lib/invoiceVoid";
import ListLoadingState from "@/components/documentList/ListLoadingState";
import ConfirmDeleteDialog from "@/components/documentList/ConfirmDeleteDialog";

import RecordPaymentDialog from "@/components/invoice/RecordPaymentDialog";
import {
  indexPaymentsByInvoice,
  paymentsSupported,
} from "@/lib/invoicePayments";
import { dueReminders, reminderSentPatch } from "@/lib/reminders";
import { issuedPatch } from "@/lib/invoiceIssued";
import PullToRefresh from "@/components/utils/PullToRefresh";
import ChaseInvoiceBanner from "@/components/invoice/ChaseInvoiceBanner";
import OverdueReminderDialog from "@/components/invoice/list/OverdueReminderDialog";
import BatchSendResultDialog from "@/components/invoice/list/BatchSendResultDialog";
import InvoiceStatusSheet from "@/components/invoice/list/InvoiceStatusSheet";
import InvoiceActionSheet from "@/components/invoice/list/InvoiceActionSheet";
import InvoiceCardList from "@/components/invoice/list/InvoiceCardList";
import InvoiceTable from "@/components/invoice/list/InvoiceTable";
import BatchSendBar from "@/components/invoice/list/BatchSendBar";
import RemindersDueBanner from "@/components/invoice/list/RemindersDueBanner";
import InvoiceFilterBar from "@/components/invoice/list/InvoiceFilterBar";
import InvoicesDesktopHeader from "@/components/invoice/list/InvoicesDesktopHeader";
import InvoicesMobileHeader from "@/components/invoice/list/InvoicesMobileHeader";
import useInvoiceListData from "@/components/invoice/list/useInvoiceListData";
import useRecordPayment from "@/components/invoice/list/useRecordPayment";
import useInvoiceSelection from "@/components/invoice/list/useInvoiceSelection";
import { exportInvoicesCsv } from "@/components/invoice/list/exportInvoicesCsv";
import { downloadInvoicePdfById } from "@/components/invoice/list/downloadInvoicePdfById";

export default function Invoices() {
  const {
    invoices,
    setInvoices,
    settings,
    loading,
    refreshing,
    payments,
    currentUser,
    loadData,
  } = useInvoiceListData();
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

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResult, setBatchResult] = useState(null);

  // Built once per render rather than filtered per row: the list renders every
  // invoice on the account, and a linear scan inside the loop is quadratic on
  // exactly the accounts where it would be felt.
  const paymentsByInvoice = indexPaymentsByInvoice(payments);

  const {
    paymentFor,
    setPaymentFor,
    recordingPayment,
    paymentError,
    setPaymentError,
    handleRecordPayment,
  } = useRecordPayment({ paymentsByInvoice, currentUser, loadData });

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

  const downloadInvoicePdf = (invoiceId) =>
    downloadInvoicePdfById(invoiceId, settings);

  const handleExportInvoices = () => exportInvoicesCsv(filteredInvoices);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // -- Batch sending: derived state and the run itself ---------------------

  const {
    selectMode,
    setSelectMode,
    selectedIds,
    setSelectedIds,
    eligibility,
    selectableIds,
    chosen,
    resendCount,
    allSelectableChosen,
    toggleOne,
    toggleAll,
    exitSelectMode,
  } = useInvoiceSelection(filteredInvoices);

  // Overdue invoices the ladder says are due a chase today. Computed from the
  // invoice rows themselves rather than from a stored queue, so it is always
  // current and there is no second thing to keep in step.
  const remindersDue = dueReminders(filteredInvoices);





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
      // issuedPatch is inside the flip branch on purpose. An overdue invoice
      // going out again is a reminder, not a re-issue -- stamping it here
      // would reset the age of the debt every time it was chased.
      const patch = toFlip.has(invoice.id)
        ? { status: "sent", ...issuedPatch(invoice) }
        : {};
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

  const stats = {
    total: filteredInvoices.length,
    pending: filteredInvoices.filter((i) => i.status === "sent").length,
    paid: filteredInvoices.filter((i) => i.status === "paid").length,
    overdue: filteredInvoices.filter((i) => i.status === "overdue").length,
    totalValue: filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
  };

  if (loading && invoices.length === 0) {
    return <ListLoadingState label="Loading invoices" />;
  }

  return (
    <PullToRefresh onRefresh={() => loadData(true)}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          <InvoicesMobileHeader
            checkingOverdue={checkingOverdue}
            handleCheckOverdue={handleCheckOverdue}
            handleExportInvoices={handleExportInvoices}
            loadData={loadData}
            refreshing={refreshing}
            stats={stats}
          />

          <InvoicesDesktopHeader
            checkingOverdue={checkingOverdue}
            handleCheckOverdue={handleCheckOverdue}
            handleExportInvoices={handleExportInvoices}
            loadData={loadData}
            refreshing={refreshing}
            stats={stats}
          />

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

          <InvoiceFilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />

          <RemindersDueBanner
            remindersDue={remindersDue}
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            setSelectedIds={setSelectedIds}
          />

          <BatchSendBar
            allSelectableChosen={allSelectableChosen}
            batchProgress={batchProgress}
            batchRunning={batchRunning}
            chosen={chosen}
            exitSelectMode={exitSelectMode}
            handleBatchSend={handleBatchSend}
            resendCount={resendCount}
            selectMode={selectMode}
            selectableIds={selectableIds}
            setSelectMode={setSelectMode}
            toggleAll={toggleAll}
          />

          <InvoiceTable
            allSelectableChosen={allSelectableChosen}
            batchRunning={batchRunning}
            eligibility={eligibility}
            filteredInvoices={filteredInvoices}
            handleStatusChange={handleStatusChange}
            paymentsByInvoice={paymentsByInvoice}
            searchTerm={searchTerm}
            selectMode={selectMode}
            selectedIds={selectedIds}
            setDeleteDialog={setDeleteDialog}
            setNotificationDialog={setNotificationDialog}
            statusFilter={statusFilter}
            toggleAll={toggleAll}
            toggleOne={toggleOne}
            updatingStatus={updatingStatus}
          />

          <InvoiceCardList
            batchRunning={batchRunning}
            eligibility={eligibility}
            filteredInvoices={filteredInvoices}
            paymentsByInvoice={paymentsByInvoice}
            searchTerm={searchTerm}
            selectMode={selectMode}
            selectedIds={selectedIds}
            setMobileMenuOpen={setMobileMenuOpen}
            setMobileStatusPicker={setMobileStatusPicker}
            statusFilter={statusFilter}
            toggleOne={toggleOne}
            updatingStatus={updatingStatus}
          />

          <InvoiceActionSheet
            downloadInvoicePdf={downloadInvoicePdf}
            filteredInvoices={filteredInvoices}
            mobileMenuOpen={mobileMenuOpen}
            setDeleteDialog={setDeleteDialog}
            setMobileMenuOpen={setMobileMenuOpen}
            setNotificationDialog={setNotificationDialog}
          />

          <InvoiceStatusSheet
            filteredInvoices={filteredInvoices}
            handleStatusChange={handleStatusChange}
            mobileStatusPicker={mobileStatusPicker}
            setMobileStatusPicker={setMobileStatusPicker}
          />

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

          <BatchSendResultDialog
            batchResult={batchResult}
            setBatchResult={setBatchResult}
          />

          <ConfirmDeleteDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, invoice: null })}
            title="Delete Invoice"
            deleting={deleting}
            onCancel={() => setDeleteDialog({ open: false, invoice: null })}
            onConfirm={handleDelete}
          >
            Are you sure you want to delete{" "}
            <span className="font-bold text-content dark:text-content-inverted">
              {deleteDialog.invoice?.invoice_number}
            </span>
            ? This action cannot be undone.
          </ConfirmDeleteDialog>

          <OverdueReminderDialog
            handleSendOverdueNotification={handleSendOverdueNotification}
            notificationDialog={notificationDialog}
            sendingNotification={sendingNotification}
            setNotificationDialog={setNotificationDialog}
          />
        </div>
      </div>
    </PullToRefresh>
  );
}
