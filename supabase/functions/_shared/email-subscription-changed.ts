// Notification 4 of 4: a subscription changed via Stripe.
// Fired from the stripe-webhook on customer.subscription.updated and
// customer.subscription.deleted.
import {
  renderNotification,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type {
  SubscriptionChangedPayload,
  SubscriptionChangeKind,
} from "../_shared/notification-types.ts";

/** Copy and accent per change kind. Cancellation and past-due are not failures
 *  to shout about, but they must not look like good news either. */
const COPY: Record<
  SubscriptionChangeKind,
  { heading: string; accent: string; subject: (plan: string) => string }
> = {
  upgraded: {
    heading: "Your plan was upgraded",
    accent: BRAND.success,
    subject: (plan) => `You're now on Invoicium ${plan}`,
  },
  downgraded: {
    heading: "Your plan was changed",
    accent: BRAND.primary,
    subject: (plan) => `Your Invoicium plan changed to ${plan}`,
  },
  renewed: {
    heading: "Your plan renewed",
    accent: BRAND.primary,
    subject: (plan) => `Your Invoicium ${plan} plan renewed`,
  },
  canceled: {
    heading: "Your subscription was cancelled",
    accent: BRAND.danger,
    subject: () => "Your Invoicium subscription was cancelled",
  },
  past_due: {
    heading: "There's a problem with your payment",
    accent: BRAND.warning,
    subject: () => "Action needed: your Invoicium payment failed",
  },
};

function introFor(p: SubscriptionChangedPayload, when: string): string {
  const from = p.previousPlanName;
  switch (p.change) {
    case "upgraded":
      return from
        ? `You've moved from ${from} to ${p.planName}. The new features are available right now.`
        : `You're now on ${p.planName}. The new features are available right now.`;
    case "downgraded":
      return from
        ? `Your plan changed from ${from} to ${p.planName}.${when ? ` This takes effect ${when}.` : ""}`
        : `Your plan changed to ${p.planName}.${when ? ` This takes effect ${when}.` : ""}`;
    case "renewed":
      return `Your ${p.planName} plan renewed. Nothing changes — this is just your receipt.`;
    case "canceled":
      return when
        ? `Your subscription has been cancelled. You keep full access until ${when}, and nothing further will be charged.`
        : `Your subscription has been cancelled and nothing further will be charged.`;
    case "past_due":
      return `We couldn't take payment for your ${p.planName} plan. Update your card to keep your account active.`;
  }
}

export function subscriptionChangedEmail(p: SubscriptionChangedPayload): {
  subject: string;
  html: string;
} {
  const copy = COPY[p.change];
  const when = niceDate(p.effectiveDate);
  const isEnding = p.change === "canceled";

  return {
    subject: copy.subject(p.planName),
    html: renderNotification({
      preheader: introFor(p, when).slice(0, 140),
      heading: copy.heading,
      name: p.userName,
      intro: introFor(p, when),
      hero: { label: "Current plan", value: p.planName, accent: copy.accent },
      rows: [
        ...(p.previousPlanName
          ? [{ label: "Previous plan", value: p.previousPlanName }]
          : []),
        ...(when
          ? [{ label: isEnding ? "Access until" : "Effective", value: when }]
          : []),
      ],
      cta: {
        label:
          p.change === "past_due" ? "Update payment method" : "Manage billing",
        url: p.billingUrl,
      },
      footnote:
        p.change === "canceled"
          ? "Changed your mind? You can resubscribe at any time and keep all your existing data."
          : undefined,
    }),
  };
}
