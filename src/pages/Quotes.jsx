import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";










import PullToRefresh from "@/components/utils/PullToRefresh";
import ListLoadingState from "@/components/documentList/ListLoadingState";
import ConfirmDeleteDialog from "@/components/documentList/ConfirmDeleteDialog";


import ConvertQuoteDialog from "@/components/quote/list/ConvertQuoteDialog";
import QuoteActionSheet from "@/components/quote/list/QuoteActionSheet";
import QuoteCardList from "@/components/quote/list/QuoteCardList";
import QuoteTable from "@/components/quote/list/QuoteTable";
import QuoteFilterBar from "@/components/quote/list/QuoteFilterBar";
import QuotesDesktopHeader from "@/components/quote/list/QuotesDesktopHeader";
import QuotesMobileHeader from "@/components/quote/list/QuotesMobileHeader";
import useQuoteListData from "@/components/quote/list/useQuoteListData";
import { exportQuotesCsv } from "@/components/quote/list/exportQuotesCsv";

export default function Quotes() {
  const { quotes, loading, refreshing, loadData } = useQuoteListData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    quote: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [converting, setConverting] = useState(null);
  const [convertDialog, setConvertDialog] = useState({
    open: false,
    quote: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

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
    // ?edit=, which is what CreateQuote reads. With ?id= it opened a blank
    // New Quote form, so editing a quote quietly created a second one.
    navigate(createPageUrl(`CreateQuote?edit=${quoteId}`));
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

  const handleExportQuotes = () => exportQuotesCsv(filteredQuotes);

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: filteredQuotes.length,
    pending: filteredQuotes.filter((q) => q.status === "sent").length,
    approved: filteredQuotes.filter((q) => q.status === "approved").length,
    declined: filteredQuotes.filter((q) => q.status === "declined").length,
    totalValue: filteredQuotes.reduce((sum, q) => sum + (q.total || 0), 0),
  };

  if (loading && quotes.length === 0) {
    return <ListLoadingState label="Loading quotes" />;
  }

  return (
    <PullToRefresh onRefresh={() => loadData(true)}>
      <div className="min-h-screen bg-surface-sunken/50 dark:bg-surface-inverted">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          <QuotesMobileHeader
            handleExportQuotes={handleExportQuotes}
            loadData={loadData}
            refreshing={refreshing}
            stats={stats}
          />

          <QuotesDesktopHeader
            handleExportQuotes={handleExportQuotes}
            loadData={loadData}
            refreshing={refreshing}
            stats={stats}
          />

          <QuoteFilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />

          <QuoteTable
            filteredQuotes={filteredQuotes}
            handleStatusChange={handleStatusChange}
            navigate={navigate}
            searchTerm={searchTerm}
            setDeleteDialog={setDeleteDialog}
            statusFilter={statusFilter}
            updatingStatus={updatingStatus}
          />

          <QuoteCardList
            filteredQuotes={filteredQuotes}
            searchTerm={searchTerm}
            setConvertDialog={setConvertDialog}
            setMobileMenuOpen={setMobileMenuOpen}
            statusFilter={statusFilter}
          />

          <QuoteActionSheet
            filteredQuotes={filteredQuotes}
            handleEdit={handleEdit}
            mobileMenuOpen={mobileMenuOpen}
            setDeleteDialog={setDeleteDialog}
            setMobileMenuOpen={setMobileMenuOpen}
          />

          <ConfirmDeleteDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, quote: null })}
            title="Delete Quote"
            deleting={deleting}
            onCancel={() => setDeleteDialog({ open: false, quote: null })}
            onConfirm={handleDelete}
          >
            Are you sure you want to delete{" "}
            <span className="font-bold text-content dark:text-content-inverted">
              {deleteDialog.quote?.quote_number}
            </span>
            ? This action cannot be undone.
          </ConfirmDeleteDialog>

          <ConvertQuoteDialog
            convertDialog={convertDialog}
            converting={converting}
            handleConvertToInvoice={handleConvertToInvoice}
            setConvertDialog={setConvertDialog}
          />
        </div>
      </div>
    </PullToRefresh>
  );
}
