import React, { useState } from "react";
import { Invoice } from "@/entities/Invoice";
import { Quote } from "@/entities/Quote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  Copy,
  Eye,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldOff,
} from "lucide-react";
import { format } from "date-fns";
import { readReceipt } from "@/lib/readReceipt";

/**
 * The contractor's controls for the public link on one document.
 *
 * Three actions, and the difference between them matters:
 *
 *   Revoke      -- the link stops working, the credential is UNCHANGED.
 *                  Reversible. For "I sent that to the wrong address" where you
 *                  may want it back.
 *   Restore     -- undoes a revoke. The original link works again.
 *   Regenerate  -- mints a NEW credential. Every copy of the old link is dead
 *                  forever, including the one already in a client's inbox.
 *                  Irreversible, so it asks first.
 *
 * Revoke is reversible on purpose: the common case is a mistake, and a one-way
 * kill switch for a mistake means re-sending and confusing the client with two
 * links.
 *
 * -- Why one component for both document types ----------------------------
 *
 * Invoices and quotes differ in exactly two ways here: the column holding the
 * credential (`public_token` vs `public_id`, because the quote column predates
 * the convention and is already in links that were sent) and the URL shape.
 * Everything else -- revocation, the view summary, the confirm-before-break
 * flow -- is identical, and duplicating it would be the start of the two
 * drifting apart.
 */

const KINDS = {
  invoice: {
    label: "invoice",
    entity: Invoice,
    tokenField: "public_token",
    // Short on purpose: an SMS is 160 GSM-7 characters per segment.
    url: (token) => `${window.location.origin}/i/${token}`,
  },
  quote: {
    label: "quote",
    entity: Quote,
    tokenField: "public_id",
    // Kept as the existing query-string route so links already sent still work.
    url: (token) => `${window.location.origin}/PublicQuote?id=${token}`,
  },
};

export default function PublicLinkControls({ document: doc, kind = "invoice", onChange }) {
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const config = KINDS[kind];
  const token = doc?.[config.tokenField];

  // Every document gets its credential from a column default, but one loaded
  // from a stale cache might not -- render nothing rather than a broken link.
  if (!token) return null;

  const revoked = Boolean(doc.public_link_revoked_at);
  const url = config.url(token);

  const run = async (label, patch) => {
    setBusy(label);
    setError("");
    try {
      await config.entity.update(doc.id, patch);
      if (onChange) await onChange();
    } catch (err) {
      setError(err?.message || "That did not work. Please try again.");
    } finally {
      setBusy("");
      setConfirmingRegenerate(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied on insecure origins and in some embedded
      // browsers. Telling them to select it beats a silent no-op.
      setError("Could not copy. Select the link above and copy it manually.");
    }
  };

  // The wording lives in src/lib/readReceipt.js, which is also what the two
  // list views render. Four screens make this same claim about the client's
  // behaviour and they have to make it identically -- "opened" on one and
  // "not opened" on another is how someone stops believing the feature.
  const receipt = readReceipt(doc);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Client link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-content-body">
          {revoked
            ? `This link is turned off. Anyone opening it sees a notice, not the ${config.label}.`
            : kind === "invoice"
              ? "Anyone with this link can view and pay this invoice. It never expires."
              : "Anyone with this link can view and approve this quote. It never expires."}
        </p>

        <div className="flex items-center gap-2">
          <code
            className={`flex-1 truncate rounded border border-line bg-surface-sunken px-3 py-2 text-xs ${
              revoked ? "line-through text-content-muted" : "text-content-body"
            }`}
          >
            {url}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={revoked}
            title="Copy link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex items-start gap-2 text-sm text-content-muted">
          <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className={receipt.opened ? "text-content-body" : undefined}>
              {receipt.label}
            </p>
            {/* Only when the client came BACK. A second visit an hour later is
                a different signal from one long read, and it is the one that
                says they are still weighing it. */}
            {receipt.reopened && (
              <p className="text-xs mt-0.5">
                Last opened {format(receipt.lastAt, "PPp")}
              </p>
            )}
            {!receipt.opened && (
              // Said plainly, because the absence of a receipt is not evidence
              // the client ignored anything: a PDF read straight from the email
              // never touches this link.
              <p className="text-xs mt-0.5">
                This only counts opens of the link above — reading the attached
                PDF does not show up here.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {/* preview=1 tells the page not to count this as a client opening it. */}
          <Button variant="outline" size="sm" asChild disabled={revoked}>
            <a
              href={`${url}${url.includes("?") ? "&" : "?"}preview=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview
            </a>
          </Button>

          {revoked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => run("restore", { public_link_revoked_at: null })}
              disabled={busy !== ""}
            >
              {busy === "restore" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Turn back on
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run("revoke", { public_link_revoked_at: new Date().toISOString() })
              }
              disabled={busy !== ""}
            >
              {busy === "revoke" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="w-4 h-4 mr-2" />
              )}
              Turn off link
            </Button>
          )}

          {confirmingRegenerate ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  run("regenerate", {
                    [config.tokenField]: crypto.randomUUID(),
                    public_link_revoked_at: null,
                  })
                }
                disabled={busy !== ""}
              >
                {busy === "regenerate" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Yes, break the old link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingRegenerate(false)}
                disabled={busy !== ""}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRegenerate(true)}
              disabled={busy !== ""}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              New link
            </Button>
          )}
        </div>

        {confirmingRegenerate && (
          <p className="text-sm text-caution-700">
            This permanently breaks the link you already sent. Your client will
            need the new one.
          </p>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
