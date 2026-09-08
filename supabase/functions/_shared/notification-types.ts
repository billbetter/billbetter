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

/**
 * 5. A client approved a quote from its public link. Goes to the CONTRACTOR.
 *
 * `approvedBy` is the name the approver TYPED at the confirmation step, which
 * is deliberately separate from `clientName` on the record. They can differ --
 * the quote link is meant to be forwardable, so a partner or spouse may be the
 * one who actually agreed -- and in a scope dispute the name that matters is
 * what the person approving asserted about themselves.
 */
export interface QuoteApprovedPayload extends NotificationRecipient {
  quoteNumber?: string | null;
  /** Name typed at the confirm step. Unverified free text, by design. */
  approvedBy: string;
  /** client_name on the quote row. Shown alongside when it differs. */
  clientName?: string | null;
  total: number;
  /** ISO 8601. */
  approvedAt: string;
  quoteUrl?: string | null;
}

/** 6. A client declined a quote from its public link. Goes to the CONTRACTOR. */
export interface QuoteDeclinedPayload extends NotificationRecipient {
  quoteNumber?: string | null;
  declinedBy: string;
  clientName?: string | null;
  total: number;
  /** ISO 8601. */
  declinedAt: string;
  /** Optional, client-supplied, already trimmed and capped by the caller. */
  reason?: string | null;
  quoteUrl?: string | null;
}

/**
 * 7. A client opened an invoice or quote from its public link, for the FIRST
 * time. Goes to the CONTRACTOR.
 *
 * -- First open only, deliberately ----------------------------------------
 *
 * Not every open. The signal a contractor acts on is "it arrived and a human
 * looked at it" -- that is what turns "did they even get it?" into "give them
 * a day, then call". Every subsequent open is the same news again, and a
 * client who leaves the tab open in a busy office would send a stream of
 * them. The full count is on the document itself, where it is free to read
 * and costs nobody an inbox interruption.
 *
 * -- What this claim is worth ---------------------------------------------
 *
 * It is one-directional evidence. A recorded open means somebody loaded the
 * page; a missing one means only that we did not see one, because a client
 * who reads the attached PDF straight out of the email never touches the
 * link. The template says so, because a contractor who reads absence as
 * "they're ignoring me" will make a phone call this feature caused.
 */
export interface DocumentViewedPayload extends NotificationRecipient {
  kind: "invoice" | "quote";
  /** Invoice or quote number, without the #. */
  number?: string | null;
  clientName?: string | null;
  total: number;
  /** ISO 8601. When the first genuine open was recorded. */
  viewedAt: string;
  /** ISO 8601. Last write before the open — used to say how long it sat. */
  sentAt?: string | null;
  /** The CONTRACTOR's own detail page, never the client's public link. */
  documentUrl?: string | null;
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
  /**
   * "preference-off" is a SUCCESSFUL outcome, not a failure: the contractor
   * asked us not to send this. It is distinguished from the other two so a log
   * reader can tell "respected a choice" from "could not send".
   */
  skipped?: "no-recipient" | "not-configured" | "preference-off";
}
