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

// The storage key this app shipped under before it was renamed to Invoicium.
// It is the one legacy brand string that cannot be deleted from the source:
// a session saved under the old name can only be found by asking for it by
// name, and dropping this would silently sign out everyone who has not opened
// the app since the rename. The entry is moved and then deleted, so this runs
// at most once per browser and the constant can be retired outright once the
// rename is far enough behind (added 2026-08-19).
const RETIRED_STORAGE_KEY = "axisbill-auth";

if (typeof window !== "undefined") {
  try {
    const carried = window.localStorage.getItem(RETIRED_STORAGE_KEY);
    if (carried) {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, carried);
      }
      window.localStorage.removeItem(RETIRED_STORAGE_KEY);
    }
  } catch {
    // private mode / storage disabled — nothing to migrate
  }
}

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
