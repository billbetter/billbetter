// Notification 1 of 4: a user started a trial.
// Requested as emails/trial-started.tsx. Plain-string template rather than
// React Email — see notify.ts for why JSX is not available in this runtime.
import {
  renderNotification,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type { TrialStartedPayload } from "../_shared/notification-types.ts";

export function trialStartedEmail(p: TrialStartedPayload): {
  subject: string;
  html: string;
} {
  const ends = niceDate(p.trialEndDate);

  return {
    subject: `Your Invoicium ${p.planName} trial is live`,
    html: renderNotification({
      preheader: ends
        ? `Full access until ${ends}. No charge until then.`
        : "Your trial is active — full access, no charge yet.",
      heading: "Your trial has started",
      name: p.userName,
      intro:
        `You now have full access to every ${p.planName} feature. Create an invoice, ` +
        `send a quote, and get paid — nothing is locked while you try it out.`,
      hero: ends
        ? { label: "Trial runs until", value: ends, accent: BRAND.primary }
        : undefined,
      rows: [
        { label: "Plan", value: p.planName },
        ...(ends ? [{ label: "First charge", value: ends }] : []),
      ],
      cta: { label: "Open your dashboard", url: p.dashboardUrl },
      footnote:
        "Cancel any time before the trial ends and you will not be charged.",
    }),
  };
}
