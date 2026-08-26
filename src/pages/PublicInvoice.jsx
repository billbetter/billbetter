import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import SEO from "@/components/seo/SEO";

/**
 * The invoice a client sees. No account, no login -- the URL token is the whole
 * credential.
 *
 * This page never touches sdk.entities. Every anonymous read in this app has
 * resolved to an empty array since RLS was tightened (has_app_access(null) is
 * false), which is why PublicQuote renders "Quote Not Found" for every client
 * it has ever been sent to. The fix is not a looser policy -- it is that a
 * service-role edge function answers by token and returns a narrowed payload.
 * See docs/invoice-links-plan.md.
 *
 * Rendered OUTSIDE Layout, deliberately. Layout gates on an auth check with two
 * separate allowlists (publicPages and publicPaths), and missing either bounces
 * the visitor to a login screen they can never pass. Routing this like /Login
 * does -- straight in App.jsx, no Layout -- means there is no gate to get wrong,
 * and no sidebar or marketing header on a document meant to look like a bill.
 */

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
    }).format(Number(amount) || 0);
  } catch {
    // An unknown currency code from settings must not blank the total.
    return `${(Number(amount) || 0).toFixed(2)} ${currency || ""}`.trim();
  }
}

function safeDate(value, pattern) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, pattern);
}

/** Full-page message, used for every state that is not a rendered invoice. */
function Notice({ icon: Icon, tone, title, children }) {
  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Icon className={`w-16 h-16 mx-auto mb-4 ${tone}`} />
        <h1 className="text-2xl font-black text-ink-800">{title}</h1>
        <p className="text-content-body mt-2">{children}</p>
      </div>
    </div>
  );
}

export default function PublicInvoice() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  // The contractor's own preview. Layer 1 of the "don't mark your own link as
  // viewed" rule -- trivially removable by anyone reading the URL, which is
  // fine, because the only person motivated to remove it is the contractor and
  // they would only be fooling themselves.
  const isPreview = searchParams.get("preview") === "1";

  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const { data: res } = await sdk.functions.invoke("getPublicInvoice", {
      token,
    });
    if (res?.success) {
      setData(res);
    } else {
      setFailure({
        reason: res?.reason || "server_error",
        message: res?.error || "Something went wrong loading this invoice.",
      });
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setFailure({ reason: "not_found", message: "This invoice link is not valid." });
      setLoading(false);
      return;
    }
    load();
  }, [token, load]);

  // Recorded from JS AFTER mount, never from the request that served the HTML.
  //
  // Corporate mail security (Outlook Safe Links, Mimecast, Proofpoint)
  // pre-fetches every URL in an email at delivery time. Recording server-side
  // would fire first_viewed_at seconds after send, from a scanner, for a large
  // share of business clients -- and the failure mode is not noise, it is wrong
  // in the direction that makes the product accuse people, because a chase
  // sequence would escalate against a client who never opened anything. A
  // scanner fetches HTML; it does not boot a React SPA, so this line is most of
  // the defence.
  useEffect(() => {
    if (!data) return;
    sdk.functions
      .invoke("getPublicInvoice", {
        token,
        action: "record_view",
        preview: isPreview,
      })
      .catch(() => {
        // A view is telemetry. It must never be why a client cannot read their
        // invoice, so this failure is swallowed on purpose.
      });
  }, [data, token, isPreview]);

  const handlePay = async () => {
    setPaying(true);
    setActionError("");
    const { data: res } = await sdk.functions.invoke("payPublicInvoice", {
      token,
    });
    if (res?.success && res.url) {
      // The Checkout session is minted at this click, never baked into the
      // email -- a session URL expires in 24h, and an invoice may sit unopened
      // for a fortnight.
      window.location.href = res.url;
      return;
    }
    setActionError(res?.error || "Could not start the payment. Please try again.");
    setPaying(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setActionError("");
    try {
      const { data: res } = await sdk.functions.invoke("getPublicInvoice", {
        token,
        action: "download_pdf",
      });
      if (!res?.success || !res.pdf_url) {
        setActionError(res?.error || "No PDF is available for this invoice.");
        return;
      }
      // The stored value is a base64 data: URL. Chrome blocks top-level
      // navigation to data: URLs, so it has to become a blob before it can be
      // handed to a download link.
      const blob = await (await fetch(res.pdf_url)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${data?.invoice?.number || "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Could not download the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-accent-600" />
      </div>
    );
  }

  if (failure) {
    // One state for revoked, unknown and malformed. The server answers all
    // three identically so it cannot be used to probe which tokens were once
    // real, and the copy has to be true for every case -- it must not claim the
    // sender turned the link off, because for a mistyped address that is false.
    if (failure.reason === "unavailable") {
      return (
        <Notice icon={Lock} tone="text-caution-500" title="This link is no longer active">
          {failure.message}
        </Notice>
      );
    }
    if (failure.reason === "rate_limited") {
      return (
        <Notice icon={AlertCircle} tone="text-caution-500" title="Too many requests">
          Please wait a moment and refresh the page.
        </Notice>
      );
    }
    return (
      <Notice icon={AlertCircle} tone="text-danger-500" title="Invoice not found">
        {failure.message}
      </Notice>
    );
  }

  const { invoice, client, business, capabilities } = data;
  const isPaid = invoice.status === "paid";
  const issued = safeDate(invoice.issue_date, "PP");
  const due = safeDate(invoice.due_date, "PP");

  return (
    <div className="min-h-screen bg-surface-sunken p-4 sm:p-8">
      <SEO
        title={`Invoice ${invoice.number}`}
        description={`View and pay your invoice from ${business.name || "Invoicium"}.`}
        // An invoice is addressed to one person. It must never be indexed, and
        // the token is in the URL, so a crawler that found it would put a live
        // credential in a search result.
        noindex={true}
      />

      <div className="max-w-3xl mx-auto">
        <header className="mb-8 text-center">
          {business.logo_url && (
            <img
              src={business.logo_url}
              alt={business.name}
              className="w-24 h-auto mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-black text-content">
            Invoice from {business.name || "Us"}
          </h1>
          <p className="text-content-body">Invoice #{invoice.number}</p>
        </header>

        {isPreview && (
          <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-center text-sm text-content-body">
            <strong className="text-ink-800">Preview.</strong> This is exactly
            what your client sees. Opening it this way does not count as a view.
          </div>
        )}

        {isPaid && (
          <div className="mb-6 rounded-lg bg-success-50 p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-success-600 mx-auto mb-2" />
            <p className="font-semibold text-lg text-success-800">
              This invoice has been paid. Thank you.
            </p>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-surface rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-sm text-content-muted mb-1">Billed To</h2>
              <p className="font-semibold text-content">{client.name}</p>
              {client.address && (
                <p className="text-sm text-content-body whitespace-pre-wrap">
                  {client.address}
                </p>
              )}
            </div>
            <div className="text-right">
              {issued && (
                <>
                  <p className="text-sm text-content-muted mb-1">Issued</p>
                  <p className="font-semibold text-content">{issued}</p>
                </>
              )}
              {due && (
                <>
                  <p className="text-sm text-content-muted mb-1 mt-2">Due</p>
                  <p className="font-semibold text-content">{due}</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {invoice.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-start py-3 border-b border-line last:border-b-0"
              >
                <div className="pr-4">
                  <p className="font-medium text-content">{item.description}</p>
                  <p className="text-sm text-content-body">
                    {item.quantity} × {money(item.rate, invoice.currency)}
                  </p>
                </div>
                <p className="font-medium text-content whitespace-nowrap">
                  {money(item.amount, invoice.currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t-2 border-line space-y-2">
            <div className="flex justify-between text-content-body">
              <span>Subtotal</span>
              <span>{money(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-content-body">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span>{money(invoice.tax_amount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-content pt-2">
              <span>{isPaid ? "Total" : "Amount Due"}</span>
              <span>{money(invoice.total, invoice.currency)}</span>
            </div>
          </div>

          {invoice.payment_terms && (
            <p className="mt-4 text-sm text-content-muted">
              Payment terms: {invoice.payment_terms}
            </p>
          )}

          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-line">
              <h3 className="font-black text-ink-800 mb-2">Notes</h3>
              <p className="text-content-body whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {(capabilities.can_pay_online || capabilities.can_download_pdf) && (
            <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row gap-3">
              {capabilities.can_pay_online && (
                <Button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-1 h-12 text-base"
                >
                  {paying ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5 mr-2" />
                  )}
                  Pay {money(invoice.total, invoice.currency)}
                </Button>
              )}
              {capabilities.can_download_pdf && (
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex-1 h-12 text-base"
                >
                  {downloading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 mr-2" />
                  )}
                  Download PDF
                </Button>
              )}
            </div>
          )}

          {actionError && (
            <p className="mt-4 text-sm text-danger-600 text-center">
              {actionError}
            </p>
          )}
        </div>

        <footer className="mt-8 text-center text-sm text-content-muted">
          {business.name && <p className="font-semibold">{business.name}</p>}
          {business.address && <p>{business.address}</p>}
          <p>
            {[business.phone, business.email, business.website]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </footer>
      </div>
    </div>
  );
}
