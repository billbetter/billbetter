// Typed payloads for every account notification. One type per trigger, so a
// template can never be called with the wrong shape.
//
// Requested as `lib/email/types.ts`. It lives here instead because all four
// triggers fire inside Supabase Edge Functions (Deno), not in the Vite
// frontend — see notify.ts for the full reasoning.

/** Fields every notification needs to address and greet the recipient. */
export interface NotificationRecipient {
  /** Where the mail goes. Required; a send with no address is dropped. */
  userEmail: string;
  /** Used in the greeting. Falls back to "there" when unknown. */
  userName?: string | null;
}

/** 1. A user started a trial. */
export interface TrialStartedPayload extends NotificationRecipient {
  planName: string;
  /** ISO 8601. Rendered as a friendly date; omitted if absent. */
  trialEndDate?: string | null;
  dashboardUrl: string;
}

/** 2. A contractor sent an invoice to their client. Goes to the CONTRACTOR. */
export interface InvoiceSentPayload extends NotificationRecipient {
  invoiceNumber?: string | null;
  clientName?: string | null;
  /** Recipient address the invoice went to, echoed back for confirmation. */
  sentTo: string;
  amount: number;
  dueDate?: string | null;
  invoiceUrl?: string | null;
}

/** 3. Stripe confirmed a client paid an invoice. Goes to the CONTRACTOR. */
export interface InvoicePaidPayload extends NotificationRecipient {
  invoiceNumber?: string | null;
  clientName?: string | null;
  amount: number;
  paidAt: string;
  invoiceUrl?: string | null;
}

/** What happened to a subscription. Drives the copy and the accent colour. */
export type SubscriptionChangeKind =
  "upgraded" | "downgraded" | "canceled" | "renewed" | "past_due";

/** 4. A subscription changed via Stripe. */
export interface SubscriptionChangedPayload extends NotificationRecipient {
  change: SubscriptionChangeKind;
  planName: string;
  previousPlanName?: string | null;
  /** ISO 8601. Next charge, or for a cancellation, when access ends. */
  effectiveDate?: string | null;
  billingUrl: string;
}

/** Uniform result. `sent: false` is a logged non-event, never a thrown error. */
export interface NotificationResult {
  sent: boolean;
  id?: string;
  error?: string;
  skipped?: "no-recipient" | "not-configured";
}
