/**
 * Google sign-in, full page, straight to Google.
 *
 * Why not supabase.auth.signInWithOAuth alone: that sends the browser to
 * Google by way of Supabase, so Google's page says "to continue to
 * rcymevdxsizstnopqeow.supabase.co" -- the domain Google will return to.
 * Here the browser goes to Google directly and comes back to this site's own
 * /Login, so Google's page names this site. Google returns a signed ID token
 * in the URL fragment, and supabase.auth.signInWithIdToken() turns it into a
 * session (OpenID Connect implicit flow, response_type=id_token).
 *
 * Not Google Identity Services' button: its pop-up is Chrome's own account
 * dialog (FedCM), which did not fit the page, and it only proves an origin
 * works once someone has signed in through it.
 *
 * The client ID is public by design. It must be the one on the Supabase
 * Google provider, since Supabase rejects a token issued for any other client
 * ("unacceptable audience"): 157344465743-..., as Supabase's own /authorize
 * redirect shows. GOOGLE_CLIENT_ID in .env is a different, older client.
 *
 * Google only returns to redirect URIs registered on that client, so this
 * flow is used only on DIRECT_ORIGINS, whose /Login is registered. Anywhere
 * else -- a Vercel preview URL, localhost -- the Supabase redirect flow is
 * used instead, and still works.
 */

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "157344465743-f1tgl942btn71ea3tnqs9l07df2ja99d.apps.googleusercontent.com";

/** Origins whose `${origin}/Login` is an Authorized redirect URI on the client. */
const DIRECT_ORIGINS = ["https://www.invoicium.ca"];

/**
 * Off until a real sign-in through it succeeds on the live site: Google
 * refuses an unregistered redirect URI only after the person has picked an
 * account. Until then, /Login?googlebutton=on turns it on in one browser
 * (remembered; ?googlebutton=off turns it off again).
 */
const DIRECT_BY_DEFAULT = false;

const OVERRIDE_KEY = "invoicium-google-button";
const PENDING_KEY = "invoicium-google-pending";
const REDIRECT_PATH = "/Login";

function readOverride() {
  try {
    const param = new URLSearchParams(window.location.search).get("googlebutton");
    if (param === "on" || param === "off") window.localStorage.setItem(OVERRIDE_KEY, param);
    return window.localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/** Whether "Continue with Google" should go to Google directly here. */
export function isDirectGoogleEnabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_GOOGLE_BUTTON === "off") return false;
  if (!DIRECT_ORIGINS.includes(window.location.origin)) return false;
  const override = readOverride();
  if (override === "off") return false;
  return DIRECT_BY_DEFAULT || override === "on";
}

function randomString(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/[^a-zA-Z0-9]/g, "");
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Send the browser to Google's sign-in page.
 *
 * The nonce's hash goes to Google, which embeds it in the ID token; the raw
 * value is kept here for Supabase to check against it, so a token lifted from
 * elsewhere cannot be replayed. `state` ties Google's answer to this request.
 * Both live in sessionStorage: this tab only, gone when it closes.
 *
 * @param {string} returnUrl same-origin path to land on once signed in
 */
export async function startDirectGoogleSignIn(returnUrl) {
  const nonce = randomString();
  const state = randomString(24);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ nonce, state, returnUrl }));
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: "id_token",
    // profile: the name and photo the app shows (see lib/profilePhoto.js).
    scope: "openid email profile",
    redirect_uri: window.location.origin + REDIRECT_PATH,
    nonce: await sha256Hex(nonce),
    state,
    prompt: "select_account",
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * Read Google's answer from the URL fragment, if this page load is one.
 *
 * Clears the fragment either way, so the token never sits in the address bar
 * or in history. Returns null when this load is not Google's answer; otherwise
 * { token, nonce, returnUrl }, { cancelled: true } or { error }.
 */
export function takeDirectGoogleResult() {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (!hash.has("id_token") && !(hash.has("error") && hash.has("state"))) return null;

  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.toString());

  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    pending = null;
  }
  sessionStorage.removeItem(PENDING_KEY);

  if (!pending || hash.get("state") !== pending.state) {
    return { error: "That Google sign-in expired. Please try again." };
  }
  if (hash.has("error")) {
    // Backing out of Google's page is not an error worth a message.
    return hash.get("error") === "access_denied"
      ? { cancelled: true }
      : { error: `Google sign-in failed (${hash.get("error")}). Please try again.` };
  }
  return { token: hash.get("id_token"), nonce: pending.nonce, returnUrl: pending.returnUrl };
}
