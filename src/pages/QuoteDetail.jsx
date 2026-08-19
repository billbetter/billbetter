import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Send,
  Trash2,
  User,
  XCircle,
  Building2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function QuoteDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("id");

  const [quote, setQuote] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendingSMS, setResendingSMS] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);

  useEffect(() => {
    if (quoteId) {
      loadQuoteData();
    }
  }, [quoteId]);

  const loadQuoteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await sdk.auth.me();

      const [quoteResults, clientResults, settingsResults] = await Promise.all([
        sdk.entities.Quote.filter({ id: quoteId }),
        sdk.entities.Client.filter({ user_id: user.id }),
        sdk.entities.BusinessSettings.filter({ user_id: user.id }),
      ]);

      if (quoteResults.length > 0) {
        const q = quoteResults[0];
        setQuote(q);
        const relatedClient = clientResults.find((c) => c.id === q.client_id);
        setClient(relatedClient || null);
      } else {
        setError("Quote not found.");
      }

      if (settingsResults.length > 0) {
        setSettings(settingsResults[0]);
      }
    } catch (e) {
      console.error("Error loading quote:", e);
      setError("Failed to load quote details.");
    }
    setLoading(false);
  };

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

  const statusColors = {
    draft: "bg-ink-100 text-ink-800",
    sent: "bg-info-100 text-info-800",
    approved: "bg-success-100 text-success-800",
    declined: "bg-danger-100 text-danger-800",
    converted: "bg-accent-100 text-accent-800",
  };

  const statusIcons = {
    draft: <FileText className="w-4 h-4" />,
    sent: <Clock className="w-4 h-4" />,
    approved: <CheckCircle2 className="w-4 h-4" />,
    declined: <XCircle className="w-4 h-4" />,
    converted: <FileCheck className="w-4 h-4" />,
  };

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

  const publicUrl = quote.public_id
    ? `${window.location.origin}${createPageUrl("PublicQuote")}?id=${quote.public_id}`
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Quotes"))}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Quotes</span>
          <span className="sm:hidden">Back</span>
        </Button>

        {/* Desktop Actions */}
        <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
          {quote.pdf_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(quote.pdf_url)}
              >
                📋 Copy Link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={quote.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </a>
              </Button>
            </>
          )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialog(true)}
            className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Floating Action Bar */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-inverted border-t border-line dark:border-ink-700 shadow-lg z-40"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="p-3 flex items-center gap-2">
          {quote.pdf_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(quote.pdf_url)}
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
                  href={quote.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </a>
              </Button>
            </>
          )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialog(true)}
            className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 h-11 px-3 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Quote Header */}
          <Card className="border-none shadow-lg">
            <CardContent className="p-4 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-6 sm:mb-8">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-2">
                    Quote {quote.quote_number}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={`${statusColors[quote.status]} flex items-center gap-1.5`}
                    >
                      {statusIcons[quote.status]}
                      <span className="capitalize">{quote.status}</span>
                    </Badge>
                    {quote.status === "approved" && quote.approval_date && (
                      <span className="text-sm text-content-body dark:text-content-subtle">
                        Approved{" "}
                        {format(new Date(quote.approval_date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                    ${quote.total?.toFixed(2)}
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
                    {quote.client_name}
                  </p>
                  {client && (
                    <>
                      {client.email && (
                        <p className="text-sm text-content-body dark:text-content-subtle flex items-center gap-2 mt-1 break-all">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="break-all">{client.email}</span>
                        </p>
                      )}
                      {client.phone && (
                        <p className="text-sm text-content-body dark:text-content-subtle flex items-center gap-2 mt-1">
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
                    <span className="font-medium">Issued:</span>{" "}
                    {format(new Date(quote.date_issued), "MMM d, yyyy")}
                  </p>
                  {quote.expiry_date && (
                    <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                      <span className="font-medium">Expires:</span>{" "}
                      {format(new Date(quote.expiry_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Action Cards */}
          {quote.status === "approved" && !quote.linked_invoice_id && (
            <Card className="border-success-200 bg-success-50 border-none shadow-lg dark:border-success-800/50 dark:bg-success-900/20">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <CheckCircle className="w-6 h-6 text-success-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-success-900">
                    Quote Approved
                  </p>
                  <p className="text-xs text-success-800">
                    {quote.approval_date &&
                      format(
                        new Date(quote.approval_date),
                        "MMMM d, yyyy 'at' h:mm a",
                      )}
                  </p>
                </div>
                <Button
                  onClick={handleConvertToInvoice}
                  size="sm"
                  className="bg-brand hover:bg-brand-hover w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Convert to Invoice
                </Button>
              </CardContent>
            </Card>
          )}

          {quote.status === "converted" && quote.linked_invoice_id && (
            <Card className="border-accent-200 bg-accent-50 border-none shadow-lg dark:border-accent-800/50 dark:bg-accent-900/20">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <FileCheck className="w-6 h-6 text-accent-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-accent-900">
                    Quote Converted to Invoice
                  </p>
                  <p className="text-xs text-accent-800">
                    This quote has been converted to an invoice.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    navigate(
                      createPageUrl("InvoiceDetail") +
                        `?id=${quote.linked_invoice_id}`,
                    )
                  }
                  size="sm"
                  variant="outline"
                  className="border-accent-300 hover:bg-accent-100 w-full sm:w-auto dark:hover:bg-accent-900/30"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Invoice
                </Button>
              </CardContent>
            </Card>
          )}

          {!quote.job_id && quote.status !== "draft" && (
            <Card className="border-info-200 bg-info-50 border-none shadow-lg dark:border-info-800/50 dark:bg-info-900/20">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Building2 className="w-6 h-6 text-info-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-info-900">
                    Create Job
                  </p>
                  <p className="text-xs text-info-800">
                    Start a job from this quote
                  </p>
                </div>
                <Button
                  onClick={handleCreateJob}
                  size="sm"
                  variant="outline"
                  className="border-info-300 hover:bg-info-100 w-full sm:w-auto dark:hover:bg-info-900/30"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Create Job
                </Button>
              </CardContent>
            </Card>
          )}

          {quote.job_id && (
            <Card className="border-success-200 bg-success-50 border-none shadow-lg dark:border-success-800/50 dark:bg-success-900/20">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Building2 className="w-6 h-6 text-success-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-success-900">
                    Job Created
                  </p>
                  <p className="text-xs text-success-800">
                    A job has been created from this quote
                  </p>
                </div>
                <Button
                  onClick={() => navigate(createPageUrl("JobPhotos"))}
                  size="sm"
                  variant="outline"
                  className="border-success-300 hover:bg-success-100 w-full sm:w-auto dark:hover:bg-success-900/30"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Job
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Line Items */}
          <Card className="border-none shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {quote.items?.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start gap-3 pb-3 sm:pb-4 border-b dark:border-ink-700 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-content dark:text-content-inverted text-sm sm:text-base break-words">
                        {item.description}
                      </p>
                      <p className="text-xs sm:text-sm text-content-body dark:text-content-subtle mt-1">
                        {item.quantity} × ${item.rate?.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-content dark:text-content-inverted text-sm sm:text-base flex-shrink-0">
                      ${item.amount?.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t dark:border-ink-700 space-y-2">
                <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-content-subtle">
                  <span>Subtotal</span>
                  <span>${quote.subtotal?.toFixed(2)}</span>
                </div>
                {quote.tax_rate > 0 && (
                  <div className="flex justify-between text-sm sm:text-base text-content-body dark:text-content-subtle">
                    <span>Tax ({quote.tax_rate}%)</span>
                    <span>${quote.tax_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg sm:text-xl font-bold text-content dark:text-content-inverted pt-2 border-t dark:border-ink-700">
                  <span>Total</span>
                  <span>${quote.total?.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card className="border-none shadow-lg">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <p className="text-sm sm:text-base text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words">
                  {quote.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar for additional info if needed */}
        <div className="lg:col-span-1 space-y-6">
          {/* Additional sidebar content can go here */}
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
                        This quote doesn't have a PDF yet. Please regenerate to
                        create a PDF before sending notifications.
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

            {quote.pdf_url && (
              <Button
                onClick={() => copyToClipboard(quote.pdf_url)}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete quote {quote.quote_number}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
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
                "Delete Quote"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
