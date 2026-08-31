import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Invoice } from "@/entities/Invoice";
import { Client } from "@/entities/Client";
import { BusinessSettings } from "@/entities/BusinessSettings";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Ban,
  RefreshCw, // Added for regenerate button
  Send,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import PublicLinkControls from "@/components/invoice/PublicLinkControls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import {
  canDeleteInvoice,
  isVoided,
  paidAfterVoid,
  voidAuditLine,
  voidEligibility,
  voidPatch,
} from "@/lib/invoiceVoid";

export default function InvoiceDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invoiceId = searchParams.get("id");

  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);
  const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false); // Changed from generatingLink, removed linkCopied
  const [voidDialog, setVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
    }
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const invoices = await Invoice.filter({ id: invoiceId });
      if (invoices.length > 0) {
        const inv = invoices[0];
        setInvoice(inv);

        // Load client data
        if (inv.client_id) {
          const clients = await Client.filter({ id: inv.client_id });
          if (clients.length > 0) {
            setClient(clients[0]);
          }
        }

        // Load settings
        const settingsData = await BusinessSettings.list();
        if (settingsData.length > 0) {
          setSettings(settingsData[0]);
        }
      }
    } catch (error) {
      console.error("Error loading invoice:", error);
    }
    setLoading(false);
  };

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

  const handleGeneratePaymentLink = async () => {
    setGeneratingPaymentLink(true);
    try {
      console.log("🔗 Generating payment link for invoice:", invoice.id);

      const response = await sdk.functions.invoke("createInvoicePaymentLink", {
        invoice_id: invoice.id,
      });

      console.log("✅ Payment link response:", response.data);

      if (response.data?.payment_link) {
        // Reload invoice to get updated payment link
        await loadInvoiceData(); // Use loadInvoiceData() instead of loadData()
        alert("Payment link generated successfully!");
      } else {
        throw new Error("No payment link in response");
      }
    } catch (error) {
      console.error("❌ Error generating payment link:", error);
      alert("Failed to generate payment link. Please try again.");
    } finally {
      setGeneratingPaymentLink(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (invoice?.payment_link) {
      navigator.clipboard.writeText(invoice.payment_link);
      alert("Payment link copied to clipboard!");
    }
  };

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

  /**
   * Void this invoice.
   *
   * The whole patch comes from voidPatch() rather than being assembled here,
   * so there is exactly one shape of a voided invoice and no way for this
   * screen to produce a partial one -- a void with a status but no timestamp
   * would be worse than no void at all.
   *
   * The invoice in state is replaced with the server's answer rather than
   * merged optimistically. If the write only half landed, the screen shows
   * what actually happened.
   */
  const handleVoid = async () => {
    const allowed = voidEligibility(invoice);
    if (!allowed.ok) {
      setVoidError(allowed.reason);
      return;
    }

    setVoiding(true);
    setVoidError(null);
    try {
      await Invoice.update(invoice.id, voidPatch(invoice, { reason: voidReason, user }));
      const rows = await Invoice.filter({ id: invoice.id });
      const saved = rows?.[0] || null;
      if (saved) setInvoice(saved);
      setVoidDialog(false);
      setVoidReason("");
    } catch (error) {
      console.error("Error voiding invoice:", error);
      setVoidError(
        error?.message || "Could not void this invoice. Nothing has been changed.",
      );
    }
    setVoiding(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const statusColors = {
    draft: "bg-ink-100 text-ink-800",
    sent: "bg-info-100 text-info-800",
    paid: "bg-success-100 text-success-800",
    overdue: "bg-danger-100 text-danger-800",
    cancelled: "bg-ink-100 text-content-body",
    // Struck through as well as greyed. Colour alone is not a status for a
    // contractor reading this in a van in daylight, and this is the one status
    // where mistaking it for "sent" means chasing money nobody owes.
    void: "bg-ink-200 text-ink-700 line-through dark:bg-ink-700 dark:text-ink-200",
  };

  // Null-safe on every one of these, so they can sit above the loading guards
  // rather than being recomputed inside three separate branches.
  const voided = isVoided(invoice);
  const canVoid = voidEligibility(invoice);
  const auditLine = voidAuditLine(invoice, (d) => format(new Date(d), "d MMM yyyy"));
  const paidDespiteVoid = paidAfterVoid(invoice);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading invoice
            </p>
            <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Invoices"))}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Invoices</span>
          <span className="sm:hidden">Back</span>
        </Button>

        {/* Desktop Actions */}
        <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
          {invoice.pdf_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  copyToClipboard(invoice.pdf_url);
                  alert("PDF link copied to clipboard!");
                }}
              >
                📋 Copy Link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </a>
              </Button>
            </>
          )}

          {/* Resend, Void and Delete all disappear once an invoice is voided.
              A voided invoice is a record to look at, not a document to act
              on -- and re-mailing one would be a demand for money the
              contractor has already withdrawn. */}
          {!voided && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendNotifications}
                disabled={sendingNotifications || !client}
                className="gap-2"
              >
                {sendingNotifications ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Resend
              </Button>
              {canVoid.ok && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVoidError(null);
                    setVoidDialog(true);
                  }}
                  className="gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Void
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialog(true)}
                className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Floating Action Bar.
          Hidden entirely on a voided invoice with no PDF, because everything
          inside it is gone by then and a bar with nothing in it still eats the
          bottom of a phone screen. */}
      {(!voided || invoice.pdf_url) && (
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-inverted border-t border-line dark:border-ink-700 shadow-lg z-40"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="p-3 flex items-center gap-2">
          {invoice.pdf_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  copyToClipboard(invoice.pdf_url);
                  alert("PDF link copied!");
                }}
                className="flex-1 h-11"
              >
                📋 Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="flex-1 h-11"
              >
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </a>
              </Button>
            </>
          )}
          {!voided && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendNotifications}
                disabled={sendingNotifications || !client}
                className="flex-1 h-11"
              >
                {sendingNotifications ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Resend
                  </>
                )}
              </Button>
              {canVoid.ok && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVoidError(null);
                    setVoidDialog(true);
                  }}
                  className="h-11 px-3"
                >
                  <Ban className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialog(true)}
                className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 h-11 px-3 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      )}

      {/* The audit trail. Above the invoice itself, because it changes what
          every figure below it means. */}
      {voided && (
        <div className="mb-4 sm:mb-6 rounded-xl border border-line dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 p-4">
          <div className="flex items-start gap-3">
            <Ban className="w-5 h-5 text-content-body dark:text-ink-300 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-content dark:text-content-inverted">
                This invoice has been voided
              </p>
              {auditLine && (
                <p className="text-sm text-content-body dark:text-ink-300 mt-1 break-words">
                  {auditLine}
                </p>
              )}
              <p className="text-sm text-content-muted dark:text-content-subtle mt-2">
                It is kept as a record. It cannot be edited, deleted, sent or paid,
                and its number is never reused.
              </p>
            </div>
          </div>

          {/* Money that arrived after the void. See recordInvoicePayment in
              stripe-webhook: the webhook writes the payment and deliberately
              does NOT clear the void, so the contractor is told rather than
              quietly shown a paid invoice. */}
          {paidDespiteVoid && (
            <div className="mt-3 pt-3 border-t border-line dark:border-ink-700 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-alert-600 dark:text-alert-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-content dark:text-content-inverted">
                  A payment arrived for this invoice anyway
                </p>
                <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                  A checkout page opened before you voided it stays valid for 24
                  hours. The money is in your Stripe account. Refund it there, or
                  raise a replacement invoice to cover it.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Invoice Header */}
          <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
            <CardContent className="p-4 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-6 sm:mb-8">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-2">
                    {invoice.invoice_number}
                  </h1>
                  <Badge className={`${statusColors[invoice.status]}`}>
                    {invoice.status}
                  </Badge>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                    ${invoice.total.toFixed(2)}
                  </p>
                  <p className="text-sm text-content-body dark:text-content-subtle mt-1">
                    Total Amount
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <div className="flex items-center gap-2 text-content-body dark:text-content-subtle mb-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Client</span>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-content dark:text-content-inverted">
                    {invoice.client_name}
                  </p>
                  {client && (
                    <>
                      {client.email && (
                        <p className="text-sm text-content-body dark:text-ink-300 flex items-center gap-2 mt-1 break-all">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="break-all">{client.email}</span>
                        </p>
                      )}
                      {client.phone && (
                        <p className="text-sm text-content-body dark:text-ink-300 flex items-center gap-2 mt-1">
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          {client.phone}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-content-body dark:text-content-subtle mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Dates</span>
                  </div>
                  <p className="text-sm text-content-body dark:text-ink-300">
                    <span className="font-medium text-content dark:text-content-inverted">
                      Created:
                    </span>{" "}
                    {format(new Date(invoice.created_date), "MMM d, yyyy")}
                  </p>
                  {invoice.due_date && (
                    <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                      <span className="font-medium text-content dark:text-content-inverted">
                        Due:
                      </span>{" "}
                      {format(new Date(invoice.due_date), "MMM d, yyyy")}
                    </p>
                  )}
                  {invoice.paid_date && (
                    <p className="text-sm text-success-600 dark:text-success-400 mt-1">
                      <span className="font-medium">Paid:</span>{" "}
                      {format(new Date(invoice.paid_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Link Card. Gone on a voided invoice: generating a
              Checkout URL for one would fail at buildInvoiceCheckoutSession
              anyway, and offering a button that cannot work is worse than not
              offering it. */}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && !voided && (
            <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
              <CardHeader className="border-b border-line dark:border-ink-700 bg-info-50 p-4 sm:p-6 dark:bg-info-900/20">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
                  <DollarSign className="w-5 h-5 text-brand-700 dark:text-brand-400" />
                  Payment Link
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {invoice.payment_link ? (
                  <div className="space-y-4">
                    <div className="p-3 sm:p-4 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg">
                      <p className="text-sm text-success-800 dark:text-success-400 font-medium mb-2">
                        ✅ Payment link is active
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={invoice.payment_link}
                          readOnly
                          className="flex-1 px-3 py-2 text-xs sm:text-sm border border-line-strong dark:border-ink-600 rounded-lg bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
                        />
                        <Button
                          onClick={handleCopyPaymentLink}
                          variant="outline"
                          className="gap-2 w-full sm:w-auto"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() =>
                          window.open(invoice.payment_link, "_blank")
                        }
                        className="flex-1 bg-brand hover:bg-brand-hover gap-2 h-11"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Payment Page
                      </Button>
                      <Button
                        onClick={handleGeneratePaymentLink}
                        variant="outline"
                        disabled={generatingPaymentLink}
                        className="h-11 w-full sm:w-auto"
                      >
                        {generatingPaymentLink ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
                            <span className="hidden sm:inline">
                              Regenerating...
                            </span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-content-body dark:text-ink-300">
                      Generate a secure payment link to share with your client.
                      They'll be able to pay directly via credit card.
                    </p>
                    <Button
                      onClick={handleGeneratePaymentLink}
                      disabled={generatingPaymentLink}
                      className="w-full bg-brand hover:bg-brand-hover gap-2"
                    >
                      {generatingPaymentLink ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating Payment Link...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Generate Payment Link
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Line Items */}
          <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg text-content dark:text-content-inverted">
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {invoice.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start gap-3 pb-3 sm:pb-4 border-b border-line-subtle dark:border-ink-700 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-content dark:text-content-inverted text-sm sm:text-base break-words">
                        {item.description}
                      </p>
                      <p className="text-xs sm:text-sm text-content-body dark:text-content-subtle mt-1">
                        {item.quantity} × ${item.rate.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-content dark:text-content-inverted text-sm sm:text-base flex-shrink-0">
                      ${item.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-line dark:border-ink-700 space-y-2">
                <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-ink-300">
                  <span>Subtotal</span>
                  <span>${invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-ink-300">
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span>${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg sm:text-xl font-bold text-content dark:text-content-inverted pt-2 border-t border-line dark:border-ink-700">
                  <span>Total</span>
                  <span>${invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg text-content dark:text-content-inverted">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <p className="text-sm sm:text-base text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/*
            The hosted invoice page a client actually opens. Distinct from the
            Payment Link card above: that one is a Stripe Checkout URL, which
            expires after 24 hours and does nothing but take money. This link
            never expires, shows the invoice itself, and mints the Checkout
            session at the moment the client clicks Pay.
          */}
          {voided ? (
            /* Not PublicLinkControls. That component offers Restore, which
               clears public_link_revoked_at -- and voiding sets exactly that
               field to kill the link. Leaving the control there would put an
               "undo" next to a one-way door. Payment would still be refused by
               buildInvoiceCheckoutSession, but the client would be looking at a
               live page for an invoice that no longer exists. */
            <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
              <CardHeader className="border-b border-line dark:border-ink-700 p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
                  <Ban className="w-5 h-5 text-content-body dark:text-ink-300" />
                  Client link
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="text-sm text-content-body dark:text-ink-300">
                  Switched off when this invoice was voided. Anyone opening the
                  link they were sent now sees that it is no longer available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <PublicLinkControls
              document={invoice}
              kind="invoice"
              onChange={loadInvoiceData}
            />
          )}
        </div>
      </div>

      {/* Notification Result Dialog */}
      {notificationResult && (
        <Dialog open={true} onOpenChange={() => setNotificationResult(null)}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle className="text-center">
                Notification Status
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {!notificationResult.hasPdf ? (
                <div className="p-4 bg-caution-50 rounded-lg border border-caution-200 dark:bg-caution-900/20 dark:border-caution-800/50">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-caution-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-caution-800">
                        No PDF Available
                      </p>
                      <p className="text-sm text-caution-700 mt-1">
                        This invoice doesn't have a PDF yet. Please regenerate
                        the invoice to create a PDF before sending
                        notifications.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* SMS Status */}
                  <div className="p-3 bg-surface rounded-lg border dark:bg-surface-inverted">
                    <div className="flex items-start gap-2">
                      {notificationResult.sms ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-content dark:text-content-inverted">
                              SMS Sent Successfully
                            </p>
                            <p className="text-sm text-content-body dark:text-ink-300">
                              Text message with PDF link delivered
                            </p>
                          </div>
                        </>
                      ) : notificationResult.hasPhone ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-caution-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-caution-800">
                              SMS Not Sent
                            </p>
                            <p className="text-sm text-caution-700 mb-2">
                              {notificationResult.smsError ||
                                "Failed to send SMS"}
                            </p>
                            {notificationResult.smsError?.includes(
                              "trial account",
                            ) ||
                            notificationResult.smsError?.includes(
                              "unverified",
                            ) ? (
                              <div className="text-xs bg-caution-50 p-2 rounded border border-caution-200 dark:bg-caution-900/20 dark:border-caution-800/50">
                                <p className="font-medium mb-1">
                                  📱 Twilio Trial Account?
                                </p>
                                <p>
                                  If you're using a trial, you must verify the
                                  recipient's phone number first:
                                </p>
                                <a
                                  href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-success-600 hover:underline block mt-1"
                                >
                                  console.twilio.com → Verified Caller IDs
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-line-strong flex-shrink-0 mt-0.5 dark:border-ink-600" />
                          <div>
                            <p className="font-medium text-content-body dark:text-ink-300">
                              No Phone Number
                            </p>
                            <p className="text-sm text-content-muted">
                              Add a phone number to the client to send SMS
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Email Status */}
                  <div className="p-3 bg-surface rounded-lg border dark:bg-surface-inverted">
                    <div className="flex items-start gap-2">
                      {notificationResult.email ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-content dark:text-content-inverted">
                              Email Sent Successfully
                            </p>
                            <p className="text-sm text-content-body dark:text-ink-300">
                              Email delivered to {client?.email}
                            </p>
                          </div>
                        </>
                      ) : notificationResult.hasEmail ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-danger-800">
                              Email Not Sent
                            </p>
                            <p className="text-sm text-danger-700">
                              {notificationResult.emailError}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-line-strong flex-shrink-0 mt-0.5 dark:border-ink-600" />
                          <div>
                            <p className="font-medium text-content-body dark:text-ink-300">
                              No Email Address
                            </p>
                            <p className="text-sm text-content-muted">
                              Add an email to the client to send notifications
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Copy PDF Link Button */}
            {invoice.pdf_url && (
              <Button
                onClick={() => {
                  copyToClipboard(invoice.pdf_url);
                  alert("PDF link copied to clipboard!");
                }}
                variant="outline"
                className="w-full"
              >
                📋 Copy PDF Link to Share
              </Button>
            )}

            <Button
              onClick={() => setNotificationResult(null)}
              className="w-full"
            >
              Close
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Void Confirmation Dialog */}
      <Dialog open={voidDialog} onOpenChange={setVoidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void invoice {invoice.invoice_number}?</DialogTitle>
            <DialogDescription>
              The invoice stays on record with its number, and this is written
              against it. Its payment link stops working immediately, and it can
              never be edited, sent or paid again. There is no undo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <label
              htmlFor="void-reason"
              className="text-sm font-semibold text-content dark:text-content-inverted"
            >
              Reason{" "}
              <span className="font-normal text-content-muted dark:text-content-subtle">
                (optional)
              </span>
            </label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Wrong client, duplicate, job cancelled…"
              className="mt-2"
            />
            <p className="text-xs text-content-muted dark:text-content-subtle mt-1.5">
              Only you and your crew see this. Your client is not told.
            </p>
          </div>

          {voidError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mt-3">
              {voidError}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setVoidDialog(false)}
              disabled={voiding}
            >
              Keep it
            </Button>
            <Button onClick={handleVoid} disabled={voiding} className="gap-2">
              {voiding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Voiding…
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  Void invoice
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice {invoice.invoice_number}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Deleting a sent invoice is still allowed -- it was allowed before
              this feature and removing it would take away something
              contractors do. But the client has this number, so the dialog
              says what disappears and offers the answer that keeps it. */}
          {canDeleteInvoice(invoice).prefer === "void" && (
            <div className="rounded-lg border border-line dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 p-3">
              <p className="text-sm text-content-body dark:text-ink-300">
                Your client has already been sent this invoice. Deleting it
                leaves nothing to point at if they ask about{" "}
                {invoice.invoice_number} later.
              </p>
              {canVoid.ok && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => {
                    setDeleteDialog(false);
                    setVoidError(null);
                    setVoidDialog(true);
                  }}
                >
                  <Ban className="w-4 h-4" />
                  Void it instead
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-danger-600 hover:bg-danger-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Invoice"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
