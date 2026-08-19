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
const LEGACY_STORAGE_KEY = "axisbill-auth";

// The AxisBill -> Invoicium rename changed this key, which silently signed out
// everyone who was already logged in. Carry the old session over once so the
// rename doesn't cost anyone their session.
if (typeof window !== "undefined") {
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
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
