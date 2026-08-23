/**
 * Who am I working for?
 *
 * Every business table in this schema is keyed by `user_id`, and until now that
 * was always the signed-in user -- one account, one business. Crew members
 * break that: an employee's rows must belong to their EMPLOYER, or the owner
 * cannot see the work their own staff did.
 *
 * So there are two different ids in play and they are easy to confuse:
 *
 *   authUserId  who is holding the phone
 *   ownerId     whose business the data belongs to
 *
 * For a solo contractor they are the same value, which is why nothing broke
 * before. Everywhere that writes a business row wants `ownerId`; anything about
 * the person -- attribution, "my hours", permissions -- wants `authUserId`.
 *
 * This module is the only place that resolves the difference. It talks to
 * supabase directly rather than through localDataEngine, because the data
 * engine imports this to stamp writes and the cycle would be unresolvable.
 */

import { supabase } from "@/api/supabaseClient";

/** Roles, lowest authority first. */
export const CREW_ROLES = ["employee", "supervisor", "admin"];

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  supervisor: "Supervisor",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS = {
  admin: "Everything except billing and removing the owner.",
  supervisor: "Jobs, quotes, invoices and the team's hours. No settings.",
  employee: "Their own jobs, photos and hours.",
};

/**
 * What each role may do.
 *
 * Deliberately coarse. The pricing page sells "advanced granular permissions"
 * at Enterprise; this is the ordinary version, and inventing twenty toggles
 * nobody asked for would make the common case worse to serve the rare one.
 */
const ROLE_CAPABILITIES = {
  owner: {
    manage_team: true,
    manage_settings: true,
    manage_billing: true,
    manage_invoices: true,
    manage_quotes: true,
    manage_clients: true,
    manage_jobs: true,
    view_analytics: true,
    view_all_time: true,
    log_time: true,
  },
  admin: {
    manage_team: true,
    manage_settings: false,
    manage_billing: false,
    manage_invoices: true,
    manage_quotes: true,
    manage_clients: true,
    manage_jobs: true,
    view_analytics: true,
    view_all_time: true,
    log_time: true,
  },
  supervisor: {
    manage_team: false,
    manage_settings: false,
    manage_billing: false,
    manage_invoices: true,
    manage_quotes: true,
    manage_clients: true,
    manage_jobs: true,
    view_analytics: false,
    view_all_time: true,
    log_time: true,
  },
  employee: {
    manage_team: false,
    manage_settings: false,
    manage_billing: false,
    manage_invoices: false,
    manage_quotes: false,
    manage_clients: false,
    manage_jobs: false,
    view_analytics: false,
    view_all_time: false,
    log_time: true,
  },
};

/**
 * @typedef {Object} BusinessContext
 * @property {string|null} authUserId   the signed-in user
 * @property {string|null} ownerId      whose business the data belongs to
 * @property {boolean} isOwner          true when this user owns the business
 * @property {boolean} isCrew           true when working inside someone else's
 * @property {string} role              owner | admin | supervisor | employee
 * @property {string|null} displayName
 * @property {Object|null} membership   the EmployeeProfile row, when crew
 */

/**
 * The resolved context, cached and KEYED BY THE USER IT DESCRIBES.
 *
 * The key is the whole point. This cache is module-level, so it outlives a
 * sign-out: without the key, signing in as a second person in the same tab
 * kept the first person's context. getOwnerId() would then return the previous
 * user's id, localDataEngine would rewrite every `user_id` filter to it, and
 * RLS would correctly refuse -- so the new user saw empty lists and their saves
 * failed with "new row violates row-level security policy". A cache that can
 * describe the wrong person is worse than no cache.
 *
 * onAuthStateChange below clears it too. That is the fast path; the key is the
 * one that cannot be missed, because it is checked on every read.
 */
let cachedUserId;
let cached = null;
let inFlight = null;

/** Drop the cache. Call on sign-in, sign-out, or after accepting an invite. */
export function clearBusinessContext() {
  cachedUserId = undefined;
  cached = null;
  inFlight = null;
}

// Belt and braces: drop the cache the moment auth changes, so the next reader
// does not even pay for the mismatch check. Guarded because this module is
// imported by localDataEngine, which some tooling loads outside a browser.
if (typeof window !== "undefined") {
  try {
    supabase.auth.onAuthStateChange(() => clearBusinessContext());
  } catch (err) {
    console.warn("crew: could not subscribe to auth changes", err);
  }
}

/** A solo owner, and the shape returned when nobody is signed in. */
function soloContext(user) {
  return {
    authUserId: user?.id ?? null,
    ownerId: user?.id ?? null,
    isOwner: true,
    isCrew: false,
    role: "owner",
    displayName:
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || null,
    membership: null,
  };
}

/**
 * Resolve the current business context, hitting the network at most once per
 * session. Concurrent callers share one request rather than each issuing their
 * own -- on a cold dashboard load a dozen components ask at the same moment.
 *
 * @returns {Promise<BusinessContext>}
 */
export async function getBusinessContext() {
  // getSession reads the stored session locally -- no network -- so checking
  // who is actually signed in on every call is cheap enough to do always.
  // getUser() would be a round trip and would defeat the point of caching.
  let currentId = null;
  try {
    const { data } = await supabase.auth.getSession();
    currentId = data?.session?.user?.id ?? null;
  } catch {
    // Fall through: a session we cannot read is treated as a cache miss, which
    // costs one lookup rather than serving somebody else's business.
  }

  if (cached && cachedUserId === currentId) return cached;
  if (inFlight && cachedUserId === currentId) return inFlight;
  if (cachedUserId !== currentId) clearBusinessContext();
  cachedUserId = currentId;

  inFlight = (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return soloContext(null);

    // A membership row is the only thing that makes someone crew. Its absence
    // -- including when the table does not exist yet, on an install that has
    // not run the crew migration -- means solo, which is the old behaviour.
    let membership = null;
    try {
      const { data, error } = await supabase
        .from("EmployeeProfile")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);
      if (error) throw error;
      membership = (data && data[0]) || null;
    } catch (err) {
      // PGRST205 / 42P01 are "no such table"; anything else is worth knowing
      // about but still must not lock the user out of their own account.
      if (err?.code !== "PGRST205" && err?.code !== "42P01") {
        console.warn("crew: could not resolve membership", err);
      }
    }

    if (!membership) return soloContext(user);

    return {
      authUserId: user.id,
      ownerId: membership.owner_id,
      isOwner: false,
      isCrew: true,
      role: membership.role || "employee",
      displayName:
        membership.name ||
        user.user_metadata?.full_name ||
        user.email ||
        null,
      membership,
    };
  })();

  try {
    cached = await inFlight;
    return cached;
  } finally {
    inFlight = null;
  }
}

/**
 * The id business rows should be stamped with. Falls back to the auth user so
 * a failure here can never write a row with a null owner.
 */
export async function getOwnerId() {
  const ctx = await getBusinessContext();
  return ctx.ownerId ?? ctx.authUserId ?? null;
}

/** @param {BusinessContext|null} ctx @param {string} capability */
export function can(ctx, capability) {
  if (!ctx) return false;
  const caps = ROLE_CAPABILITIES[ctx.role] || ROLE_CAPABILITIES.employee;
  return Boolean(caps[capability]);
}

/** Capability check that resolves the context itself. */
export async function currentUserCan(capability) {
  return can(await getBusinessContext(), capability);
}
