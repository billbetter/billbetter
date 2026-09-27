/**
 * Google Identity Services -- Google's own "Sign in with Google" button.
 *
 * Why not supabase.auth.signInWithOAuth: that sends the browser to Google by
 * way of Supabase, so Google's account chooser says "to continue to
 * rcymevdxsizstnopqeow.supabase.co" -- the redirect's domain. Google's button
 * runs on this site instead: the chooser opens as a pop-up naming this site,
 * hands back a signed ID token, and supabase.auth.signInWithIdToken() turns
 * that into a session. No redirect through Supabase at all.
 *
 * The client ID is public by design -- Google puts it in every sign-in URL.
 * It must be the one configured on the Supabase Google provider, because
 * Supabase rejects a token issued for any other client ("unacceptable
 * audience"). That is 157344465743-..., as Supabase's own /authorize redirect
 * shows; the GOOGLE_CLIENT_ID in .env is a different, older client.
 *
 * Google only serves the button on origins listed as "Authorized JavaScript
 * origins" on that client in Google Cloud Console.
 */

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "157344465743-f1tgl942btn71ea3tnqs9l07df2ja99d.apps.googleusercontent.com";

/**
 * On. Google accepts https://www.invoicium.ca (and invoicium.ca, which
 * redirects there) as an Authorized JavaScript origin for the client.
 *
 * On an origin Google has NOT authorised -- a Vercel preview URL, or
 * localhost without both http://localhost and http://localhost:<port> listed
 * -- Google still draws its button, but the button cannot sign anyone in, and
 * it reports that only inside its own iframe, so the page cannot detect it
 * and fall back. VITE_GOOGLE_BUTTON=off turns it off for such a build; the
 * redirect button is then the way in.
 */
// ON. A real sign-in through it succeeded on https://www.invoicium.ca
// (2026-09-26). Note that Google drawing the button without an "origin is not
// allowed" is NOT proof the origin is accepted: an earlier release did exactly
// that and the pop-up then failed with Error 400: origin_mismatch, because
// Google's settings had not finished applying. Only a completed sign-in counts.
//
// Per-browser override, remembered: /Login?googlebutton=off falls back to the
// redirect button in that browser, ?googlebutton=on restores it. VITE_GOOGLE_
// BUTTON=off turns it off for a whole build -- needed on any origin Google has
// not authorised (a Vercel preview URL, or localhost unless both
// http://localhost and http://localhost:<port> are listed).
const OVERRIDE_KEY = "invoicium-google-button";

function readOverride() {
  try {
    const param = new URLSearchParams(window.location.search).get("googlebutton");
    if (param === "on" || param === "off") window.localStorage.setItem(OVERRIDE_KEY, param);
    return window.localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export const GOOGLE_BUTTON_ENABLED =
  import.meta.env.VITE_GOOGLE_BUTTON !== "off" &&
  (typeof window === "undefined" || readOverride() !== "off");

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const LOAD_TIMEOUT_MS = 8000;

let loading = null;

/** Load Google's script once. Rejects if it is blocked or too slow. */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    const timer = setTimeout(() => reject(new Error("Google sign-in timed out")), LOAD_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error("Google sign-in did not initialise"));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Google sign-in could not load"));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    // Let a later mount try again (a flaky network, an extension toggled off).
    loading = null;
    throw err;
  });
  return loading;
}

/**
 * A nonce pair: Google embeds the hash in the ID token, and Supabase is given
 * the raw value to check against it, so a token lifted from elsewhere cannot
 * be replayed here.
 */
export async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}
