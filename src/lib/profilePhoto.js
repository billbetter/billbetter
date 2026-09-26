/**
 * The account holder's profile picture: the photo their sign-in provider
 * supplied (Google puts it in user_metadata as avatar_url, and again as
 * picture). Null for an email-and-password account, which has none.
 *
 * It stands in for the business logo wherever there is no logo -- the app's
 * account avatar, and the email, client link and PDF of every invoice and
 * quote sent -- so the picture a contractor sees on their account is the one
 * their clients see.
 *
 * Mirrors supabase/functions/_shared/profile-photo.ts, which the email and the
 * client links use. Two copies because they run in two runtimes; keep them in
 * step.
 */

/** Google's default crop is 96px: soft in a PDF and on a retina screen. */
const PHOTO_SIZE = 256;

/**
 * The user's own switch (Settings -> Business Info), kept in user_metadata
 * beside the photo it governs rather than in a BusinessSettings column: the
 * edge functions already read that metadata, and it needs no migration.
 */
export const HIDE_PHOTO_KEY = "hide_photo_on_documents";

/** The photo the sign-in provider supplied, whatever the switch says. */
export function providerPhotoOf(meta) {
  const raw = String(meta?.avatar_url || meta?.picture || "").trim();
  // https only. The value is user-writable metadata and ends up in an <img
  // src> in an email and on a public page.
  if (!/^https:\/\//i.test(raw)) return null;
  // A Google photo URL ends in its size, e.g. `=s96-c`; ask for a bigger one.
  return raw.replace(/=s\d+-c$/, `=s${PHOTO_SIZE}-c`);
}

/** The photo to use, or null when there is none or the user switched it off. */
export function profilePhotoOf(meta) {
  return meta?.[HIDE_PHOTO_KEY] === true ? null : providerPhotoOf(meta);
}
