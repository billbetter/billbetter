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

import { sendEmail } from "../_shared/resend.ts";
import type {
  NotificationResult,
  TrialStartedPayload,
  InvoiceSentPayload,
  InvoicePaidPayload,
  SubscriptionChangedPayload,
} from "../_shared/notification-types.ts";
import { trialStartedEmail } from "../_shared/email-trial-started.ts";
import { invoiceSentEmail } from "../_shared/email-invoice-sent.ts";
import { invoicePaidEmail } from "../_shared/email-invoice-paid.ts";
import { subscriptionChangedEmail } from "../_shared/email-subscription-changed.ts";

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
): Promise<NotificationResult> {
  if (!to) {
    console.warn(`[notify:${kind}] skipped — no recipient address`);
    return { sent: false, skipped: "no-recipient" };
  }

  try {
    const { subject, html } = build();
    const data = await sendEmail({ to, subject, html });
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
};
