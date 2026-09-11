import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { quoteResponseRecord } from "@/components/quote/detail/quoteDetailStatus";
import useQuoteDetailData from "@/components/quote/detail/useQuoteDetailData";
import QuoteDetailHeader from "@/components/quote/detail/QuoteDetailHeader";
import QuoteMobileActionBar from "@/components/quote/detail/QuoteMobileActionBar";
import QuoteSummaryCard from "@/components/quote/detail/QuoteSummaryCard";
import QuoteStatusCards from "@/components/quote/detail/QuoteStatusCards";
import QuoteLineItemsCard from "@/components/quote/detail/QuoteLineItemsCard";
import QuoteNotesCard from "@/components/quote/detail/QuoteNotesCard";
import QuoteDetailSidebar from "@/components/quote/detail/QuoteDetailSidebar";
import QuoteNotificationResultDialog from "@/components/quote/detail/QuoteNotificationResultDialog";
import DeleteQuoteDialog from "@/components/quote/detail/DeleteQuoteDialog";

export default function QuoteDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("id");
  const { quote, setQuote, client, loading, error, loadQuoteData } =
    useQuoteDetailData(quoteId);

  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);

  const handleResendNotifications = async () => {
    if (!quote || !client) return;
    setSendingNotifications(true);

    let smsSuccess = false;
    let emailSuccess = false;
    let smsError = null;
    let emailError = null;

    if (!quote.pdf_url) {
      setNotificationResult({
        sms: false,
        email: false,
        hasPdf: false,
        hasPhone: !!client.phone,
        hasEmail: !!client.email,
        smsError: "No PDF available",
        emailError: "No PDF available",
      });
      setSendingNotifications(false);
      return;
    }

    if (client.phone) {
      try {
        await sdk.functions.invoke("sendQuoteSMS", {
          quote_id: quote.id,
          client_phone: client.phone,
        });
        smsSuccess = true;
      } catch (error) {
        console.error("SMS failed:", error);
        smsError =
          error.response?.data?.error || error.message || "SMS sending failed";
      }
    }

    if (client.email) {
      try {
        await sdk.functions.invoke("sendQuoteEmail", {
          quote_id: quote.id,
          client_email: client.email,
        });
        emailSuccess = true;
      } catch (error) {
        console.error("Email failed:", error);
        emailError =
          error.response?.data?.error ||
          error.message ||
          "Email failed to send";
      }
    }

    // -- Mark the quote sent -------------------------------------------------
    //
    // This page used to deliver the quote and never touch the row, so a quote
    // created as a draft and sent from here stayed 'draft' forever. That is not
    // cosmetic: get-public-quote computes `can_approve: status === 'sent'`, so
    // the client opened the link to a quote with NO APPROVE BUTTON on it. The
    // emailed one-click link still worked, which is why the outage was partial
    // and easy to miss.
    //
    // CreateQuote.jsx already does this after each successful send; this is the
    // same write on the other send path.
    if ((smsSuccess || emailSuccess) && quote.status === "draft") {
      try {
        await sdk.entities.Quote.update(quote.id, { status: "sent" });
        setQuote((prev) => (prev ? { ...prev, status: "sent" } : prev));
      } catch (statusError) {
        // The client HAS the quote -- the send succeeded. Failing the whole
        // action over the status write would tell them otherwise.
        console.error("Quote sent but status update failed:", statusError);
      }
    }

    setSendingNotifications(false);
    setNotificationResult({
      sms: smsSuccess,
      email: emailSuccess,
      hasPdf: !!quote.pdf_url,
      hasPhone: !!client.phone,
      hasEmail: !!client.email,
      smsError: smsError,
      emailError: emailError,
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await sdk.entities.Quote.delete(quote.id);
      navigate(createPageUrl("Quotes"));
    } catch (error) {
      console.error("Error deleting quote:", error);
      alert("Failed to delete quote. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteDialog(false);
    }
  };

  const handleConvertToInvoice = () => {
    if (!quote) return;

    navigate(createPageUrl("CreateInvoice"), {
      state: {
        prefillData: {
          client_id: quote.client_id,
          client_name: quote.client_name,
          client_email: quote.client_email,
          client_phone: client?.phone || "",
          client_address: client?.address || "",
          items: quote.items,
          tax_rate: quote.tax_rate,
          notes: quote.notes,
          due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
          from_quote_id: quote.id,
          from_quote_number: quote.quote_number,
        },
      },
    });
  };

  const handleCreateJob = async () => {
    try {
      const user = await sdk.auth.me();

      const newJob = await sdk.entities.Job.create({
        user_id: user.id,
        job_title: quote.job_name || `Job for ${quote.client_name}`,
        client_id: quote.client_id,
        client_name: quote.client_name,
        description: quote.job_description || quote.notes || "",
        status: "planning",
      });

      await sdk.entities.Quote.update(quote.id, {
        job_id: newJob.id,
      });

      navigate(createPageUrl("JobPhotos"));
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Failed to create job. Please try again.");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Link copied to clipboard!");
  };

  const responseRecord = quoteResponseRecord(quote);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-600"></div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-12">
          <p className="text-content-body mb-4 dark:text-ink-300">
            {error || "Quote not found"}
          </p>
          <Button onClick={() => navigate(createPageUrl("Quotes"))}>
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24 sm:pb-8">
      <QuoteDetailHeader
        client={client}
        copyToClipboard={copyToClipboard}
        handleResendNotifications={handleResendNotifications}
        navigate={navigate}
        quote={quote}
        sendingNotifications={sendingNotifications}
        setDeleteDialog={setDeleteDialog}
      />

      <QuoteMobileActionBar
        client={client}
        copyToClipboard={copyToClipboard}
        handleResendNotifications={handleResendNotifications}
        quote={quote}
        sendingNotifications={sendingNotifications}
        setDeleteDialog={setDeleteDialog}
      />

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <QuoteSummaryCard
            client={client}
            quote={quote}
            responseRecord={responseRecord}
          />

          <QuoteStatusCards
            handleConvertToInvoice={handleConvertToInvoice}
            handleCreateJob={handleCreateJob}
            navigate={navigate}
            quote={quote}
            responseRecord={responseRecord}
          />

          <QuoteLineItemsCard
            quote={quote}
          />

          <QuoteNotesCard
            quote={quote}
          />
        </div>

        <QuoteDetailSidebar
          loadQuoteData={loadQuoteData}
          quote={quote}
        />
      </div>

      <QuoteNotificationResultDialog
        client={client}
        copyToClipboard={copyToClipboard}
        notificationResult={notificationResult}
        quote={quote}
        setNotificationResult={setNotificationResult}
      />

      <DeleteQuoteDialog
        deleteDialog={deleteDialog}
        deleting={deleting}
        handleDelete={handleDelete}
        quote={quote}
        setDeleteDialog={setDeleteDialog}
      />
    </div>
  );
}
