import { db } from './supabase-admin.ts';

/**
 * What is still owed on an invoice, server-side.
 *
 * -- Why this exists at all ------------------------------------------------
 *
 * Until payments could be partial, `total` WAS the amount due -- and both the
 * checkout session and the public invoice page were written on that
 * assumption, in as many words (see decision 5 in get-public-invoice). Once a
 * contractor can record a $200 cash deposit against a $500 invoice, that
 * assumption charges the client $500 and takes $200 twice.
 *
 * So the balance is computed in ONE place that both the payment path and the
 * public page call. Two implementations of "what is owed" is two answers to a
 * question about money.
 *
 * -- Cents, not dollars ---------------------------------------------------
 *
 * Summed as integers and converted once. Three payments of 33.33 against a
 * 100.00 invoice must leave exactly 0.01 owed, not 0.010000000000005 -- the
 * balance is compared against zero to decide whether an invoice is settled,
 * and a float landing just above zero leaves an invoice owed forever for a
 * fraction of a cent. Mirrors src/lib/invoicePayments.js, which does the same
 * arithmetic for the browser.
 */

function toCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export interface InvoiceBalance {
  totalCents: number;
  paidCents: number;
  dueCents: number;
  settled: boolean;
}

/**
 * Read the payments on an invoice and work out the balance.
 *
 * A missing "InvoicePayment" table -- the migration not yet applied -- reads as
 * no payments, which restores exactly the previous behaviour of charging the
 * full total. Degrading to what the product did yesterday is the right failure
 * for a table that may not exist yet; refusing the payment would break taking
 * money for everyone.
 */
export async function invoiceBalance(invoice: Record<string, unknown>): Promise<InvoiceBalance> {
  const totalCents = toCents(invoice?.total);

  let paidCents = 0;
  try {
    const rows = await db.list('InvoicePayment', { invoice_id: String(invoice.id) });
    paidCents = rows.reduce((sum: number, row: Record<string, unknown>) => sum + toCents(row?.amount), 0);
  } catch (err) {
    console.warn('invoiceBalance: could not read payments, treating as none:', err instanceof Error ? err.message : err);
  }

  const dueCents = totalCents - paidCents;
  return {
    totalCents,
    paidCents,
    dueCents,
    // <= 0 so an overpayment counts as settled rather than leaving the invoice
    // open with a negative amount due, which would be offered as a charge.
    settled: totalCents > 0 && dueCents <= 0,
  };
}
