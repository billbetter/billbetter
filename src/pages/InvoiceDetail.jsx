import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Invoice } from "@/entities/Invoice";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import RecordPaymentDialog from "@/components/invoice/RecordPaymentDialog";
import {
  invoiceTimeline,
  paymentSummary,
  paymentsSupported,
} from "@/lib/invoicePayments";
import {
  canDeleteInvoice,
  isVoided,
  paidAfterVoid,
  voidAuditLine,
  voidEligibility,
} from "@/lib/invoiceVoid";
import DeleteInvoiceDialog from "@/components/invoice/detail/DeleteInvoiceDialog";
import VoidInvoiceDialog from "@/components/invoice/detail/VoidInvoiceDialog";
import InvoiceNotificationResultDialog from "@/components/invoice/detail/InvoiceNotificationResultDialog";
import InvoiceDetailSidebar from "@/components/invoice/detail/InvoiceDetailSidebar";
import InvoiceNotesCard from "@/components/invoice/detail/InvoiceNotesCard";
import InvoiceLineItemsCard from "@/components/invoice/detail/InvoiceLineItemsCard";
import PaymentLinkCard from "@/components/invoice/detail/PaymentLinkCard";
import InvoicePaymentsCard from "@/components/invoice/detail/InvoicePaymentsCard";
import InvoiceSummaryCard from "@/components/invoice/detail/InvoiceSummaryCard";
import VoidedInvoiceBanner from "@/components/invoice/detail/VoidedInvoiceBanner";
import InvoiceMobileActionBar from "@/components/invoice/detail/InvoiceMobileActionBar";
import InvoiceDetailHeader from "@/components/invoice/detail/InvoiceDetailHeader";
import ListLoadingState from "@/components/documentList/ListLoadingState";
import useInvoiceDetailData from "@/components/invoice/detail/useInvoiceDetailData";
import useRecordPayment from "@/components/invoice/detail/useRecordPayment";
import useVoidInvoice from "@/components/invoice/detail/useVoidInvoice";

export default function InvoiceDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invoiceId = searchParams.get("id");
  const {
    invoice, setInvoice, client, settings, loading, payments, events,
    loadInvoiceData,
  } = useInvoiceDetailData(invoiceId);
  const {
    paymentDialog, setPaymentDialog, recordingPayment, paymentError, setPaymentError,
    handleRecordPayment,
  } = useRecordPayment({ invoice, payments, user, loadInvoiceData });
  const {
    voidDialog, setVoidDialog, voidReason, setVoidReason, voiding, voidError, setVoidError,
    handleVoid,
  } = useVoidInvoice({ invoice, setInvoice, user });

  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);
  const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false);

  const handleResendNotifications = async () => {
    if (!invoice || !client) return;

    setSendingNotifications(true);
    let smsSuccess = false;
    let emailSuccess = false;
    let smsError = null;
    let emailError = null;

    // Check if PDF exists
    if (!invoice.pdf_url) {
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

    // Only include payment link if contractor has connected Stripe
    const stripeActive = settings?.stripe_account_status === "active";
    let paymentLink = stripeActive ? invoice.payment_link || null : null;
    if (stripeActive && !paymentLink) {
      try {
        const paymentLinkResponse = await sdk.functions.invoke(
          "createInvoicePaymentLink",
          {
            invoice_id: invoice.id,
          },
        );
        if (paymentLinkResponse.data && paymentLinkResponse.data.payment_link) {
          paymentLink = paymentLinkResponse.data.payment_link;
        }
      } catch (error) {
        console.error("⚠️ Payment link generation failed:", error);
      }
    }

    // Send SMS
    if (client.phone) {
      try {
        await sdk.functions.invoke("sendInvoiceSMS", {
          invoice_id: invoice.id,
          client_phone: client.phone,
          client_name: client.name,
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          payment_link: paymentLink,
        });
        smsSuccess = true;
      } catch (error) {
        console.error("SMS failed:", error);
        // Extract relevant error message for user
        smsError =
          error.response?.data?.error ||
          error.response?.data?.details ||
          error.message ||
          "SMS sending failed";
      }
    }

    // Send Email using new invoice email function
    if (client.email) {
      try {
        const emailResponse = await sdk.functions.invoke("sendInvoiceEmail", {
          invoice_id: invoice.id,
          client_email: client.email,
          client_name: client.name,
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          pdf_url: invoice.pdf_url,
          payment_link: paymentLink,
        });

        if (emailResponse.data?.success) {
          emailSuccess = true;
        } else {
          throw new Error(emailResponse.data?.error || "Email sending failed");
        }
      } catch (error) {
        console.error("Email failed:", error);
        emailError =
          error.response?.data?.error ||
          error.message ||
          "Email failed to send";

        if (emailError.includes("sandbox") || emailError.includes("verify")) {
          emailError =
            "Resend is in sandbox mode. Verify your domain at https://resend.com/domains";
        }
      }
    }

    setSendingNotifications(false);

    setNotificationResult({
      sms: smsSuccess,
      email: emailSuccess,
      hasPdf: !!invoice.pdf_url,
      hasPhone: !!client.phone,
      hasEmail: !!client.email,
      smsError: smsError,
      emailError: emailError,
    });
  };

  /**
   * Mint a Stripe Checkout session and, optionally, open it.
   *
   * -- Why it is minted at the moment it is opened ---------------------------
   *
   * A Checkout session URL EXPIRES AFTER 24 HOURS. This screen used to store
   * one on the invoice, label it "✅ Payment link is active", and hand out Copy
   * and Open buttons for it forever -- so every link older than a day led to
   * Stripe's "You've either completed your payment or this checkout session has
   * timed out" page. Measured on this account: stored links four and nine days
   * old, all dead.
   *
   * pay-public-invoice already solved this for the client side, in as many
   * words: "The email carries the page; the page mints the session." This does
   * the same for the contractor side.
   *
   * `openWhenReady` is a window opened SYNCHRONOUSLY by the click handler.
   * Calling window.open() after an await is blocked by every popup blocker, so
   * the tab is opened first and pointed at the URL once it exists -- otherwise
   * the fix would fail silently, which is the bug it is fixing.
   */
  const handleGeneratePaymentLink = async (openWhenReady = null) => {
    setGeneratingPaymentLink(true);
    try {
      const response = await sdk.functions.invoke("createInvoicePaymentLink", {
        invoice_id: invoice.id,
      });

      const url = response.data?.payment_link;
      if (url) {
        if (openWhenReady) openWhenReady.location = url;
        await loadInvoiceData();
        return url;
      }

      // invoke() RESOLVES with { error } on a non-2xx rather than throwing, so
      // the real reason is in the payload and has to be read out of it.
      throw new Error(response.data?.error || "No payment link in response");
    } catch (error) {
      if (openWhenReady) openWhenReady.close();
      console.error("Error generating payment link:", error);
      // The real message, not "Please try again". Stripe refuses any charge
      // under $0.50 CAD, and a contractor testing with a 35-cent invoice was
      // told to retry something that can never succeed.
      alert(error?.message || "Could not create a payment link.");
      return null;
    } finally {
      setGeneratingPaymentLink(false);
    }
  };

  /** The client-facing link, which never expires. */
  const publicInvoiceUrl =
    invoice?.public_token && !invoice?.public_link_revoked_at
      ? `${window.location.origin}/i/${invoice.public_token}`
      : null;

  const handleDelete = async () => {
    // Re-checked here and not only where the button is drawn. Hiding a control
    // is presentation; this is the last line before the row is gone, and a
    // voided invoice must not be deletable by any route that reaches it.
    const allowed = canDeleteInvoice(invoice);
    if (!allowed.ok) {
      setDeleteDialog(false);
      alert(allowed.reason);
      return;
    }
    setDeleting(true);
    try {
      await Invoice.delete(invoice.id);
      navigate(createPageUrl("Invoices"));
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice");
    }
    setDeleting(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Null-safe on every one of these, so they can sit above the loading guards
  // rather than being recomputed inside three separate branches.
  const voided = isVoided(invoice);
  const canVoid = voidEligibility(invoice);
  const summary = paymentSummary(invoice, payments);
  const timeline = invoiceTimeline(invoice, payments, events);
  // Offered whenever there is still something owed. Deliberately available on
  // a draft too: a deposit taken before the invoice was formally sent is
  // ordinary, and refusing to record money that has arrived is never right.
  const canRecordPayment = !voided && paymentsSupported() && !summary.settled;
  const auditLine = voidAuditLine(invoice, (d) => format(new Date(d), "d MMM yyyy"));
  const paidDespiteVoid = paidAfterVoid(invoice);

  if (loading) {
    return (
      <ListLoadingState
        label="Loading invoice"
        spinnerClassName="text-success-600 dark:text-success-400"
      />
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-content-body mb-4 dark:text-ink-300">
            Invoice not found
          </p>
          <Button onClick={() => navigate(createPageUrl("Invoices"))}>
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24 sm:pb-8 bg-surface-sunken dark:bg-surface-inverted-deep min-h-screen">
      <InvoiceDetailHeader
        canRecordPayment={canRecordPayment}
        canVoid={canVoid}
        client={client}
        copyToClipboard={copyToClipboard}
        handleResendNotifications={handleResendNotifications}
        invoice={invoice}
        navigate={navigate}
        sendingNotifications={sendingNotifications}
        setDeleteDialog={setDeleteDialog}
        setPaymentDialog={setPaymentDialog}
        setPaymentError={setPaymentError}
        setVoidDialog={setVoidDialog}
        setVoidError={setVoidError}
        voided={voided}
      />

      {/* Mobile Floating Action Bar.
          Hidden entirely on a voided invoice with no PDF, because everything
          inside it is gone by then and a bar with nothing in it still eats the
          bottom of a phone screen. */}
      <InvoiceMobileActionBar
        canRecordPayment={canRecordPayment}
        canVoid={canVoid}
        client={client}
        copyToClipboard={copyToClipboard}
        handleResendNotifications={handleResendNotifications}
        invoice={invoice}
        sendingNotifications={sendingNotifications}
        setDeleteDialog={setDeleteDialog}
        setPaymentDialog={setPaymentDialog}
        setPaymentError={setPaymentError}
        setVoidDialog={setVoidDialog}
        setVoidError={setVoidError}
        voided={voided}
      />

      {/* The audit trail. Above the invoice itself, because it changes what
          every figure below it means. */}
      <VoidedInvoiceBanner
        auditLine={auditLine}
        paidDespiteVoid={paidDespiteVoid}
        voided={voided}
      />

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <InvoiceSummaryCard
            client={client}
            invoice={invoice}
          />

          {/* What has actually been received.
              Rendered whenever there is a payment OR something still owed on a
              live invoice, so a fully unpaid draft does not carry an empty
              panel and a settled invoice still shows what settled it. */}
          <InvoicePaymentsCard
            payments={payments}
            summary={summary}
            voided={voided}
          />

          {/* Payment Link Card. Gone on a voided invoice: generating a
              Checkout URL for one would fail at buildInvoiceCheckoutSession
              anyway, and offering a button that cannot work is worse than not
              offering it. */}
          <PaymentLinkCard
            copyToClipboard={copyToClipboard}
            generatingPaymentLink={generatingPaymentLink}
            handleGeneratePaymentLink={handleGeneratePaymentLink}
            invoice={invoice}
            publicInvoiceUrl={publicInvoiceUrl}
            summary={summary}
            voided={voided}
          />

          <InvoiceLineItemsCard
            invoice={invoice}
          />

          <InvoiceNotesCard
            invoice={invoice}
          />
        </div>

        <InvoiceDetailSidebar
          invoice={invoice}
          loadInvoiceData={loadInvoiceData}
          timeline={timeline}
          voided={voided}
        />
      </div>

      <InvoiceNotificationResultDialog
        client={client}
        copyToClipboard={copyToClipboard}
        invoice={invoice}
        notificationResult={notificationResult}
        setNotificationResult={setNotificationResult}
      />

      <RecordPaymentDialog
        open={paymentDialog}
        onOpenChange={setPaymentDialog}
        invoice={invoice}
        payments={payments}
        saving={recordingPayment}
        error={paymentError}
        onRecord={handleRecordPayment}
      />

      <VoidInvoiceDialog
        handleVoid={handleVoid}
        invoice={invoice}
        setVoidDialog={setVoidDialog}
        setVoidReason={setVoidReason}
        voidDialog={voidDialog}
        voidError={voidError}
        voidReason={voidReason}
        voiding={voiding}
      />

      <DeleteInvoiceDialog
        canVoid={canVoid}
        deleteDialog={deleteDialog}
        deleting={deleting}
        handleDelete={handleDelete}
        invoice={invoice}
        setDeleteDialog={setDeleteDialog}
        setVoidDialog={setVoidDialog}
        setVoidError={setVoidError}
      />
    </div>
  );
}
