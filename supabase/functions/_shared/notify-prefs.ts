import { db } from './supabase-admin.ts';

/**
 * The one place a contractor's notification preference is read.
 *
 * -- Why this file exists at all -------------------------------------------
 *
 * Settings has offered ten notification toggles since it was written and not
 * one of them has ever gated anything. Three separate breaks stacked on top of
 * each other:
 *
 *   1. approve-quote called sendEmail() directly, so no preference was
 *      consulted on that path.
 *   2. notify.ts consulted none either -- deliver() took a recipient and sent.
 *      Routing a caller through it would not, by itself, have gated anything.
 *   3. NotificationSettings.jsx never SAVED the toggles: saveSettings() posted
 *      four keys and notification_preferences was not among them, so every
 *      switch reverted on reload.
 *
 * A control the user deliberately turns off, which then does nothing, is worse
 * than no control -- they chose it, and we ignored them. So the gate lives in
 * one function that every notification path calls, rather than in a condition
 * each caller is trusted to remember.
 *
 * -- Absent means ENABLED --------------------------------------------------
 *
 * `prefs[key] !== false` and not `prefs[key] === true`. A contractor who has
 * never opened Settings has expressed no opinion, and the product's behaviour
 * for them must not change. It also means a key added here later arrives
 * switched ON for everyone rather than silently off for everyone -- the failure
 * direction where somebody hears about a $15k decision they would otherwise
 * have missed.
 */

/** Keys that gate a notification. Mirrors NotificationSettings.jsx. */
export type NotificationPreferenceKey =
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'quote_approved'
  | 'quote_declined'
  | 'payment_received'
  | 'payment_failed'
  | 'due_date_reminder'
  | 'new_client'
  | 'system_alerts';

/**
 * Does this contractor want this notification?
 *
 * Takes the settings row when the caller already has it -- approve-quote and
 * send-invoice-email both load BusinessSettings for branding before they
 * notify, so the common case costs no query at all. Pass `userId` only when
 * there is no row in hand.
 *
 * NEVER throws. A preference lookup that fails must not stop a notification:
 * the action it describes already happened, and silence is the worse failure.
 */
export async function wantsNotification(
  key: NotificationPreferenceKey,
  source: { settings?: Record<string, unknown> | null; userId?: string },
): Promise<boolean> {
  try {
    let row = source.settings;

    if (row === undefined && source.userId) {
      row = await db.findOne('BusinessSettings', { user_id: String(source.userId) });
    }

    // No settings row at all is "not chosen", which is enabled -- same rule as
    // a missing key.
    if (!row) return true;

    const raw = (row as Record<string, unknown>).notification_preferences;
    const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!prefs || typeof prefs !== 'object') return true;

    return (prefs as Record<string, unknown>)[key] !== false;
  } catch (err) {
    console.warn(
      `wantsNotification(${key}) failed, defaulting to send:`,
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}
