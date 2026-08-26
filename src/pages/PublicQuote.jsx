import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  ThumbsUp,
} from "lucide-react";
import { format } from "date-fns";
import SEO from "@/components/seo/SEO";

/**
 * The quote a client sees. No account, no login -- the public_id in the URL is
 * the credential.
 *
 * This page used to call sdk.entities directly, and it had two problems that
 * masked each other:
 *
 *   1. Both reads ran with the anon key, and RLS resolves to false for an
 *      anonymous caller, so both arrays were always empty and every client who
 *      ever opened a quote link saw "Quote Not Found". A live outage.
 *   2. The settings read was `BusinessSettings.list()` and then `[0]` -- the
 *      FIRST row in the table, not the one belonging to this quote's owner.
 *
 * (2) was dormant only because of (1). Fixing the outage by moving the read
 * behind the service role -- which bypasses RLS -- would have woken it up and
 * shown one contractor's client another contractor's name, logo, address and
 * phone number. The fix for both is get-public-quote, which resolves settings
 * BY the quote's user_id and returns a narrowed payload. There is no
 * sdk.entities call left in this file.
 */

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
    }).format(Number(amount) || 0);
  } catch {
    return `${(Number(amount) || 0).toFixed(2)} ${currency || ""}`.trim();
  }
}

function safeDate(value, pattern) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, pattern);
}

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

export default function PublicQuote() {
  const [searchParams] = useSearchParams();
  const publicId = searchParams.get("id");
  const isPreview = searchParams.get("preview") === "1";

  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(null);
  // The confirmation step. The public quote link is MEANT to be forwarded -- a
  // client passing it to their spouse or business partner is normal -- so
  // approval must be a deliberate act by a named person rather than a
  // consequence of opening a URL. The name is also what makes the approval
  // defensible if the scope is disputed later.
  const [confirming, setConfirming] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const { data: res } = await sdk.functions.invoke("getPublicQuote", {
      public_id: publicId,
    });
    if (res?.success) {
      setData(res);
    } else {
      setFailure({
        reason: res?.reason || "server_error",
        message: res?.error || "Something went wrong loading this quote.",
      });
    }
    setLoading(false);
  }, [publicId]);

  useEffect(() => {
    if (!publicId) {
      setFailure({ reason: "not_found", message: "This quote link is not valid." });
      setLoading(false);
      return;
    }
    load();
  }, [publicId, load]);

  // Recorded from JS after mount, never from the request that served the HTML --
  // corporate mail scanners pre-fetch every URL in an email at delivery time,
  // and they do not boot a React SPA. See _shared/public-link.ts.
  useEffect(() => {
    if (!data) return;
    sdk.functions
      .invoke("getPublicQuote", {
        public_id: publicId,
        action: "record_view",
        preview: isPreview,
      })
      .catch(() => {
        // Telemetry must never be why a client cannot read their quote.
      });
  }, [data, publicId, isPreview]);

  const handleApprove = async () => {
    setApproving(true);
    setActionError("");
    // approve-quote accepts public_id as well as the emailed approval_token, so
    // this page never has to hold the approval credential. The name is required
    // by the FUNCTION, not just by this form -- a confirmation that lives only
    // in the page is decoration, since the endpoint is reachable directly.
    const { data: res } = await sdk.functions.invoke("approveQuote", {
      public_id: publicId,
      approver_name: approverName.trim(),
    });
    if (res?.success) {
      setApproved(res);
    } else if (res?.already_approved) {
      setActionError("This quote has already been approved.");
    } else if (res?.expired) {
      setActionError("This quote has expired. Please ask for an updated one.");
    } else {
      setActionError(res?.error || "Could not approve the quote. Please try again.");
    }
    setApproving(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setActionError("");
    try {
      const { data: res } = await sdk.functions.invoke("getPublicQuote", {
        public_id: publicId,
        action: "download_pdf",
      });
      if (!res?.success || !res.pdf_url) {
        setActionError(res?.error || "No PDF is available for this quote.");
        return;
      }
      // Chrome blocks top-level navigation to data: URLs, so the stored base64
      // has to become a blob before a download link can take it.
      const blob = await (await fetch(res.pdf_url)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote-${data?.quote?.number || "quote"}.pdf`;
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
    // One state for revoked, unknown and malformed -- the server answers all
    // three identically so it cannot be used to probe which links were once
    // real, and the copy is true for every case.
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
      <Notice icon={AlertCircle} tone="text-danger-500" title="Quote not found">
        {failure.message}
      </Notice>
    );
  }

  const { quote, client, business, capabilities } = data;
  const issued = safeDate(quote.issue_date, "PP");
  const expires = safeDate(quote.expiry_date, "PP");
  const isApproved = approved || quote.status === "approved";

  return (
    <div className="min-h-screen bg-surface-sunken p-4 sm:p-8">
      <SEO
        title={`Quote ${quote.number}`}
        description={`View and approve your quote from ${business.name || "Invoicium"}.`}
        // A quote is addressed to one person and the credential is in the URL.
        // A crawler that found this would put a live credential in a search
        // result.
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
            Quote from {business.name || "Us"}
          </h1>
          <p className="text-content-body">Quote #{quote.number}</p>
        </header>

        {isPreview && (
          <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-center text-sm text-content-body">
            <strong className="text-ink-800">Preview.</strong> This is exactly
            what your client sees. Opening it this way does not count as a view.
          </div>
        )}

        {isApproved && (
          <div className="mb-6 rounded-lg bg-success-50 p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-success-600 mx-auto mb-2" />
            <p className="font-semibold text-lg text-success-800">
              Quote approved. Thank you!
            </p>
            {approved?.approved_by && (
              <p className="text-sm text-success-800 mt-1">
                Approved by <strong>{approved.approved_by}</strong>.
              </p>
            )}
            <p className="text-sm text-success-800 mt-1">
              {business.name || "Your contractor"} has been notified and will be
              in touch.
            </p>
          </div>
        )}

        {!isApproved && capabilities.expired && (
          <div className="mb-6 rounded-lg bg-caution-50 p-6 text-center">
            <p className="font-semibold text-lg text-caution-800">
              This quote has expired. Please contact us for an updated one.
            </p>
          </div>
        )}

        {!isApproved && !capabilities.expired && quote.status === "rejected" && (
          <div className="mb-6 rounded-lg bg-surface p-6 text-center shadow">
            <p className="font-semibold text-lg text-ink-800">
              This quote was declined.
            </p>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-surface rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-sm text-content-muted mb-1">Quote For</h2>
              <p className="font-semibold text-content">{client.name}</p>
            </div>
            <div className="text-right">
              {issued && (
                <>
                  <p className="text-sm text-content-muted mb-1">Issued</p>
                  <p className="font-semibold text-content">{issued}</p>
                </>
              )}
              {expires && (
                <>
                  <p className="text-sm text-content-muted mb-1 mt-2">
                    Valid until
                  </p>
                  <p className="font-semibold text-content">{expires}</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {quote.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-start py-3 border-b border-line last:border-b-0"
              >
                <div className="pr-4">
                  <p className="font-medium text-content">{item.description}</p>
                  <p className="text-sm text-content-body">
                    {item.quantity} × {money(item.rate, quote.currency)}
                  </p>
                </div>
                <p className="font-medium text-content whitespace-nowrap">
                  {money(item.amount, quote.currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t-2 border-line space-y-2">
            <div className="flex justify-between text-content-body">
              <span>Subtotal</span>
              <span>{money(quote.subtotal, quote.currency)}</span>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between text-content-body">
                <span>Tax ({quote.tax_rate}%)</span>
                <span>{money(quote.tax_amount, quote.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-content pt-2">
              <span>Total</span>
              <span>{money(quote.total, quote.currency)}</span>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-8 pt-6 border-t border-line">
              <h3 className="font-black text-ink-800 mb-2">Notes</h3>
              <p className="text-content-body whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

          {((capabilities.can_approve && !isApproved && !confirming) ||
            capabilities.can_download_pdf) && (
            <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row gap-3">
              {capabilities.can_approve && !isApproved && !confirming && (
                <Button
                  onClick={() => setConfirming(true)}
                  className="flex-1 h-12 text-base"
                >
                  <ThumbsUp className="w-5 h-5 mr-2" />
                  Approve this quote
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

          {/*
            The confirmation. Approving a quote commits to the job, and this
            link is one a client may legitimately forward -- so the person
            approving states who they are, deliberately, before it lands.
            The name is stored with the approval so the contractor has a record
            that survives a scope dispute months later.
          */}
          {confirming && !isApproved && (
            <form
              className="mt-6 pt-6 border-t border-line"
              onSubmit={(e) => {
                e.preventDefault();
                handleApprove();
              }}
            >
              <h3 className="font-black text-ink-800 mb-1">
                Approve {money(quote.total, quote.currency)} of work
              </h3>
              <p className="text-sm text-content-body mb-4">
                By approving you accept this quote from{" "}
                {business.name || "this business"}. Please enter your full name
                to confirm.
              </p>
              <label
                htmlFor="approver-name"
                className="block text-sm font-medium text-ink-800 mb-1"
              >
                Your full name
              </label>
              <input
                id="approver-name"
                type="text"
                autoComplete="name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="e.g. Dana Marchetti"
                className="w-full rounded border border-line bg-surface px-3 py-2 text-content mb-4"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  disabled={approving || approverName.trim().length < 2}
                  className="flex-1 h-12 text-base"
                >
                  {approving ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-5 h-5 mr-2" />
                  )}
                  Confirm approval
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12"
                  onClick={() => {
                    setConfirming(false);
                    setActionError("");
                  }}
                  disabled={approving}
                >
                  Cancel
                </Button>
              </div>
            </form>
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
