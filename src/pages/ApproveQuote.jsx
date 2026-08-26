import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, ThumbsUp } from "lucide-react";

/**
 * One-click approval landing page, reached from the emailed approval link.
 *
 * -- It no longer approves on mount ---------------------------------------
 *
 * This page used to call approveQuote from a useEffect, so merely LOADING the
 * URL committed the client to the job. Two problems with that:
 *
 *   1. It is a state change triggered by a GET. Anything that opens the link on
 *      the client's behalf -- a link scanner that runs JS, a prefetching
 *      browser, a preview pane, someone clicking to "have a look" -- approves.
 *   2. It leaves no record of who agreed. A status flipping to 'approved' is
 *      not something a contractor can point at three months later when the
 *      scope is disputed.
 *
 * So approval now needs a deliberate confirm and a typed name. The name is
 * required by approve-quote itself, not just by this form -- a confirmation
 * that lives only in the page is decoration, because the endpoint is reachable
 * directly.
 */
export default function ApproveQuote() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [approverName, setApproverName] = useState("");

  const handleApproval = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await sdk.functions.invoke("approveQuote", {
        token,
        approver_name: approverName.trim(),
      });

      if (response.data?.success) {
        setResult(response.data);
      } else if (response.data?.already_approved) {
        setError("This quote was already approved.");
      } else if (response.data?.expired) {
        setError("This quote has expired.");
      } else if (response.data?.needs_confirmation) {
        setError("Please enter your full name to confirm.");
      } else {
        setError(response.data?.error || "Failed to approve quote");
      }
    } catch (err) {
      console.error("Approval error:", err);
      setError("An error occurred");
    }
    setSubmitting(false);
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  );

  if (!token) {
    return (
      <Shell>
        <XCircle className="w-12 h-12 text-danger-600 mx-auto mb-4" />
        <h2 className="text-xl font-black text-content mb-2">
          Invalid approval link
        </h2>
        <p className="text-content-body text-sm">You can close this window.</p>
      </Shell>
    );
  }

  if (result) {
    return (
      <Shell>
        <CheckCircle className="w-16 h-16 text-success-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-content mb-2">
          Quote Approved!
        </h1>
        <p className="text-ink-700 mb-4">
          Thank you, <strong>{result.approved_by || result.client_name}</strong>!
        </p>
        <div className="bg-accent-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-accent-900">
            <strong>{result.business_name || "Your contractor"}</strong> has
            been notified and will contact you shortly.
          </p>
        </div>
        <p className="text-sm text-content-body">
          You can close this window now.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ThumbsUp className="w-12 h-12 text-accent-600 mx-auto mb-4" />
      <h1 className="text-2xl font-black text-content mb-2">Approve quote</h1>
      <p className="text-content-body text-sm mb-6">
        Approving accepts this quote and lets the work be scheduled. Please
        enter your full name to confirm.
      </p>
      <form onSubmit={handleApproval} className="text-left">
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
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={submitting || approverName.trim().length < 2}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <ThumbsUp className="w-5 h-5 mr-2" />
          )}
          Confirm approval
        </Button>
      </form>
      {error && (
        <p className="mt-4 text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </Shell>
  );
}
