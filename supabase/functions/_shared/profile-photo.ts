// The account holder's profile picture: the photo their sign-in provider
// supplied (Google puts it in user_metadata as avatar_url, and again as
// picture). Null for an email-and-password account, which has none.
//
// It goes on sent invoices and quotes in the logo's place when the business
// has not uploaded a logo -- the email header, the client's link and the PDF
// -- so a contractor who never set up branding still sends documents with a
// face on them rather than a bare name.
//
// Mirrors profilePhotoOf() in src/lib/profilePhoto.js, which the PDF renderer
// and the app's own avatar use. Two copies because they run in two runtimes;
// keep them in step.

/** Google's default crop is 96px: soft in a PDF and on a retina screen. */
const PHOTO_SIZE = 256;

export function profilePhotoOf(meta: Record<string, unknown> | null | undefined): string | null {
  // The owner's own switch (Settings -> Business Info). Same key as
  // HIDE_PHOTO_KEY in src/lib/profilePhoto.js.
  if (meta?.hide_photo_on_documents === true) return null;
  const raw = String(meta?.avatar_url || meta?.picture || '').trim();
  // https only. The value is user-writable metadata and ends up in an <img
  // src> in an email and on a public page.
  if (!/^https:\/\//i.test(raw)) return null;
  // A Google photo URL ends in its size, e.g. `=s96-c`; ask for a bigger one.
  return raw.replace(/=s\d+-c$/, `=s${PHOTO_SIZE}-c`);
}
