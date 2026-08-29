// The one place account notifications are sent from.
//
// Requested as `lib/email/send.ts` using the `resend` npm package and React
// Email templates. Neither is usable where these triggers actually run:
//
//   * All four triggers fire inside Supabase Edge Functions (Deno), not in the
//     Vite frontend. Putting the sender in the frontend would ship
//     RESEND_API_KEY to the browser.
//   * scripts/deploy-functions.py deploys a function by textually inlining its
//     `../_shared/*.ts` imports into a single file and POSTing that as the
//     body. There is no bundler and no npm resolution step, so `resend` and
//     `@react-email/components` cannot be installed into this path, and there
//     is no JSX compile stage for .tsx templates.
//
// So this wraps the existing HTTP call to the Resend API (_shared/resend.ts)
// and keeps the property that matters: one chokepoint, so swapping providers
// or adding logging happens in exactly one file.

import { sendEmail, SUPPORT_EMAIL } from "../_shared/resend.ts";
import type {
  NotificationResult,
  TrialStartedPayload,
  InvoiceSentPayload,
  InvoicePaidPayload,
  SubscriptionChangedPayload,
  QuoteApprovedPayload,
  QuoteDeclinedPayload,
} from "../_shared/notification-types.ts";
import { trialStartedEmail } from "../_shared/email-trial-started.ts";
import { invoiceSentEmail } from "../_shared/email-invoice-sent.ts";
import { invoicePaidEmail } from "../_shared/email-invoice-paid.ts";
import { subscriptionChangedEmail } from "../_shared/email-subscription-changed.ts";
import {
  quoteApprovedEmail,
  quoteDeclinedEmail,
} from "../_shared/email-quote-responded.ts";
import { wantsNotification } from "../_shared/notify-prefs.ts";
import type { NotificationPreferenceKey } from "../_shared/notify-prefs.ts";

/**
 * Send one notification. NEVER throws and never rejects.
 *
 * A notification is a side effect of an action the user already completed. If
 * Resend is down, the invoice was still sent and the payment still landed —
 * failing the caller would turn a cosmetic problem into a real one. Every
 * failure path returns a result and logs; callers are not expected to branch
 * on it beyond metrics.
 */
async function deliver(
  kind: string,
  to: string | null | undefined,
  build: () => { subject: string; html: string },
  replyTo?: string,
): Promise<NotificationResult> {
  if (!to) {
    console.warn(`[notify:${kind}] skipped — no recipient address`);
    return { sent: false, skipped: "no-recipient" };
  }

  try {
    const { subject, html } = build();
    // These are Invoicium's own notifications to the contractor, and the
    // shared footer already tells them "Reply to this email or contact
    // support@invoicium.ca". Pointing Reply-To at the same address the copy
    // already names makes replying do what the sentence promises.
    //
    // A caller can override it when the useful reply goes somewhere else --
    // a quote-approved notice should reply to the CLIENT who just approved,
    // because "great, when can you start?" is the next conversation.
    const data = await sendEmail({
      to,
      subject,
      html,
      replyTo: replyTo || SUPPORT_EMAIL,
    });
    console.log(`[notify:${kind}] sent to ${to} (${data?.id ?? "no id"})`);
    return { sent: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Missing RESEND_API_KEY / RESEND_FROM_EMAIL is a deployment problem, not a
    // transient one — label it so it stands out in the logs.
    const skipped = /not configured/i.test(message)
      ? ("not-configured" as const)
      : undefined;
    console.error(`[notify:${kind}] FAILED for ${to}: ${message}`);
    return { sent: false, error: message, ...(skipped ? { skipped } : {}) };
  }
}

/**
 * deliver(), but only if the contractor still wants this kind of mail.
 *
 * Separate from deliver() rather than a flag on it, so that the four existing
 * notifications keep their exact behaviour: they are not gated in this change,
 * because they cover billing and payment mail and switching those off deserves
 * its own decision. Anything routed through `gated` IS gated, and the
 * difference is visible at the call site rather than buried in an argument.
 *
 * `opts.settings` lets a caller that already loaded BusinessSettings pass the
 * row in -- approve-quote and send-invoice-email both hold it for branding
 * before they notify, so the gate costs no extra query.
 */
async function gated(
  key: NotificationPreferenceKey,
  opts: { settings?: Record<string, unknown> | null; userId?: string },
  kind: string,
  to: string | null | undefined,
  build: () => { subject: string; html: string },
  replyTo?: string,
): Promise<NotificationResult> {
  const wanted = await wantsNotification(key, opts);
  if (!wanted) {
    console.log(`[notify:${kind}] skipped — ${key} is off in Settings`);
    return { sent: false, skipped: "preference-off" };
  }
  return deliver(kind, to, build, replyTo);
}

export const notify = {
  trialStarted: (p: TrialStartedPayload) =>
    deliver("trial-started", p.userEmail, () => trialStartedEmail(p)),

  invoiceSent: (p: InvoiceSentPayload) =>
    deliver("invoice-sent", p.userEmail, () => invoiceSentEmail(p)),

  invoicePaid: (p: InvoicePaidPayload) =>
    deliver("invoice-paid", p.userEmail, () => invoicePaidEmail(p)),

  subscriptionChanged: (p: SubscriptionChangedPayload) =>
    deliver("subscription-changed", p.userEmail, () =>
      subscriptionChangedEmail(p),
    ),

  /**
   * A client approved a quote. Gated by the `quote_approved` toggle.
   *
   * `replyTo` is the CLIENT, not support: this email goes TO the contractor
   * about a decision their client just made, and the reply belongs in that
   * conversation.
   */
  quoteApproved: (
    p: QuoteApprovedPayload,
    opts: { settings?: Record<string, unknown> | null; userId?: string; replyTo?: string },
  ) =>
    gated(
      "quote_approved",
      opts,
      "quote-approved",
      p.userEmail,
      () => quoteApprovedEmail(p),
      opts.replyTo,
    ),

  /** A client declined a quote. Gated by the `quote_declined` toggle. */
  quoteDeclined: (
    p: QuoteDeclinedPayload,
    opts: { settings?: Record<string, unknown> | null; userId?: string; replyTo?: string },
  ) =>
    gated(
      "quote_declined",
      opts,
      "quote-declined",
      p.userEmail,
      () => quoteDeclinedEmail(p),
      opts.replyTo,
    ),
};
