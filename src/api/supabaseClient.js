import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Auth and API calls will fail until these are set in .env.",
  );
}

const STORAGE_KEY = "invoicium-auth";

// A carry-over that moved sessions off this app's previous storage key ran here
// from 2026-08-19 to 2026-08-22. It was self-retiring -- it deleted the old
// entry as it moved it, so it did nothing after a browser's first load -- and is
// removed now that the rename is far enough behind. A browser that never opened
// the app in that window simply signs in again.

// "Keep me signed in": supabase-js always persists to localStorage, so the
// opt-out is enforced here instead — sessionStorage is cleared when the browser
// session ends, so a missing marker means this is a fresh browser session and
// the stored session should be dropped.
if (typeof window !== "undefined") {
  try {
    const remember = window.localStorage.getItem("invoicium-remember-me");
    const sameBrowserSession = window.sessionStorage.getItem(
      "invoicium-session-active",
    );
    if (remember === "false" && !sameBrowserSession) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.sessionStorage.setItem("invoicium-session-active", "1");
  } catch {
    // private mode / storage disabled — fall back to default persistence
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: STORAGE_KEY,
    flowType: "pkce",
  },
});
