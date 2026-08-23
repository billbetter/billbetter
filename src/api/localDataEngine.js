import { supabase } from "./supabaseClient";
import { getOwnerId } from "@/lib/crew";

const STORAGE_PREFIX = "invoicium_";

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

function getAll(entityName) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${entityName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Error reading ${entityName} from localStorage`, e);
    return [];
  }
}

function setAll(entityName, items) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${entityName}`, JSON.stringify(items));
  } catch (e) {
    console.error(`Error writing ${entityName} to localStorage`, e);
  }
}

function matchesFilters(item, filters) {
  if (!filters || typeof filters !== "object") return true;
  for (const key of Object.keys(filters)) {
    if (item[key] !== filters[key]) return false;
  }
  return true;
}

function sortItems(items, sort) {
  if (!sort) return items;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

// The UI speaks base44's vocabulary (`created_date` / `updated_date`) but every
// Postgres table uses `created_at` / `updated_at`. Nothing reconciled the two,
// so `.order('created_date')` returned 42703 and every list view fell through
// to an empty localStorage store -- rows were being written and then never
// shown. Translating here keeps the fix in the one place the two vocabularies
// actually meet, instead of in ~60 call sites.
const REMOTE_BY_LEGACY = {
  created_date: "created_at",
  updated_date: "updated_at",
};

/** Map a legacy sort field to its real column. Unknown fields pass through. */
function toRemoteField(field) {
  return REMOTE_BY_LEGACY[field] || field;
}

/** Add legacy aliases to a row from Postgres so existing readers still work. */
function withLegacyDates(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const [legacy, remote] of Object.entries(REMOTE_BY_LEGACY)) {
    if (out[legacy] === undefined && out[remote] !== undefined) {
      out[legacy] = out[remote];
    }
  }
  return out;
}

/**
 * Strip legacy date keys before a write. Both real columns default on insert,
 * and sending a column that does not exist is a 400 -- so dropping them is the
 * safe direction. Nothing currently writes these; this stops it regressing.
 */
function stripLegacyDates(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const out = { ...payload };
  for (const legacy of Object.keys(REMOTE_BY_LEGACY)) delete out[legacy];
  return out;
}

/**
 * Tables whose `user_id` means "the business", not "the person".
 *
 * Every page writes `user_id: user.id` because for a solo contractor those are
 * the same value. They stop being the same the moment a crew member signs in:
 * their rows would be stamped with their own id, land outside the owner's
 * `accessible_owner_ids`, and become invisible to the employer who is paying
 * for the seat -- while still looking fine to the person who created them,
 * which is the worst kind of wrong.
 *
 * Fixing it centrally here rather than at the ~60 call sites means a page
 * cannot forget, and a new page gets it right without knowing crew exists.
 *
 * Excluded on purpose: EmployeeProfile and CrewMemberSettings (`user_id` is
 * genuinely the person), CrewInvite (`owner_id` carries the business), and
 * Subscription / BusinessSettings (owner-only writes; a crew member must never
 * create either).
 */
const OWNER_SCOPED_TABLES = new Set([
  "Client",
  "Invoice",
  "Quote",
  "Job",
  "JobPhoto",
  "JobMaterial",
  "JobNote",
  "RecurringInvoice",
  "InvoiceTemplate",
  "Receipt",
  "TimeEntry",
]);

/**
 * Tables a crew member READS from the business but must never WRITE as it.
 *
 * BusinessSettings is the whole list. Crew need the business name, logo and
 * PDF theme or every document they produce comes out unbranded and nameless --
 * but the same row carries the Stripe Connect account and the payout email, so
 * the write side stays owner-only (enforced in RLS, not merely here).
 *
 * It is deliberately NOT in OWNER_SCOPED_TABLES: stamping a crew member's
 * insert with the owner's id would aim it straight at a policy that rejects it,
 * turning "you cannot edit this" into an opaque 403 at a confusing moment.
 */
const OWNER_READ_TABLES = new Set(["BusinessSettings"]);

/**
 * Stamp a write with the owning business.
 *
 * Overrides any user_id the caller supplied: for a solo account that is a
 * no-op (owner id === auth id), and for crew the caller's value is the thing
 * being corrected. A failure to resolve leaves the payload untouched rather
 * than writing a null owner.
 */
async function withOwner(entityName, payload) {
  if (!OWNER_SCOPED_TABLES.has(entityName)) return payload;
  try {
    const ownerId = await getOwnerId();
    return ownerId ? { ...payload, user_id: ownerId } : payload;
  } catch (e) {
    console.warn(`Could not resolve owner for ${entityName}`, e);
    return payload;
  }
}

/**
 * The read-side mirror of withOwner.
 *
 * Pages ask for `{ user_id: user.id }`, which for a crew member selects their
 * own id and matches nothing -- the business's rows are stamped with the
 * OWNER's id. Rewriting the filter here keeps reads and writes symmetric: both
 * speak "the business", and no page has to know which it is.
 *
 * Only the user_id key is touched. A query already scoped to something else --
 * TimeEntry by member_user_id, say -- passes through untouched.
 */
async function withOwnerFilters(entityName, filters) {
  const scoped =
    OWNER_SCOPED_TABLES.has(entityName) || OWNER_READ_TABLES.has(entityName);
  if (!filters || !scoped) return filters;
  if (!Object.prototype.hasOwnProperty.call(filters, "user_id")) return filters;
  try {
    const ownerId = await getOwnerId();
    return ownerId ? { ...filters, user_id: ownerId } : filters;
  } catch (e) {
    console.warn(`Could not resolve owner for ${entityName}`, e);
    return filters;
  }
}

/**
 * Only a genuinely missing TABLE may fall back to localStorage.
 *
 * This used to match the bare substring "does not exist", which also catches
 * 42703 (undefined column), 42883 (undefined function) and every other
 * relation error. The effect was that any schema mismatch silently degraded to
 * an empty local store and looked to the user like their data had vanished --
 * a real error must surface, not turn into an empty list.
 *
 *   PGRST205 - table not found in PostgREST's schema cache
 *   42P01    - undefined_table
 */
function isMissingTableError(error) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

// Local fallback implementations
function localCreate(entityName, payload) {
  const items = getAll(entityName);
  const now = new Date().toISOString();
  const newItem = {
    ...payload,
    id: payload.id || generateId(),
    created_date: payload.created_date || now,
    updated_date: payload.updated_date || now,
  };
  items.push(newItem);
  setAll(entityName, items);
  return Promise.resolve({ ...newItem });
}

function localList(entityName, filters, sort, limit) {
  let items = getAll(entityName);
  if (filters) {
    items = items.filter((item) => matchesFilters(item, filters));
  }
  if (sort) {
    items = sortItems(items, sort);
  }
  if (typeof limit === "number" && limit > 0) {
    items = items.slice(0, limit);
  }
  return Promise.resolve(items.map((i) => ({ ...i })));
}

function localGet(entityName, id) {
  const items = getAll(entityName);
  const found = items.find((item) => item.id === id);
  return Promise.resolve(found ? { ...found } : null);
}

function localUpdate(entityName, id, payload) {
  const items = getAll(entityName);
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return Promise.reject(new Error(`${entityName} not found`));
  const now = new Date().toISOString();
  items[idx] = {
    ...items[idx],
    ...payload,
    id: items[idx].id,
    updated_date: now,
  };
  setAll(entityName, items);
  return Promise.resolve({ ...items[idx] });
}

function localDelete(entityName, id) {
  const items = getAll(entityName);
  const filtered = items.filter((item) => item.id !== id);
  setAll(entityName, filtered);
  return Promise.resolve({ success: true });
}

function localSeed(entityName, dataArray) {
  const existing = getAll(entityName);
  if (existing.length === 0) {
    setAll(entityName, dataArray.map((d) => ({ ...d })));
  }
}

export const localDataEngine = {
  async create(entityName, payload) {
    try {
      const row = await withOwner(entityName, payload);
      const { data, error } = await supabase
        .from(entityName)
        .insert([stripLegacyDates(row)])
        .select()
        .single();
      if (error) throw error;
      return withLegacyDates(data);
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(`[Fallback] ${entityName} table missing, using localStorage`);
        return localCreate(entityName, payload);
      }
      throw e;
    }
  },

  async list(entityName, filters, sort, limit) {
    try {
      const scoped = await withOwnerFilters(entityName, filters);
      let query = supabase.from(entityName).select("*");
      if (scoped) {
        Object.entries(scoped).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        query = query.order(toRemoteField(field), { ascending: !desc });
      }
      if (typeof limit === "number" && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(withLegacyDates);
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(`[Fallback] ${entityName} table missing, using localStorage`);
        return localList(entityName, filters, sort, limit);
      }
      throw e;
    }
  },

  async get(entityName, id) {
    try {
      const { data, error } = await supabase
        .from(entityName)
        .select("*")
        .eq("id", id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data ? withLegacyDates(data) : null;
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(`[Fallback] ${entityName} table missing, using localStorage`);
        return localGet(entityName, id);
      }
      throw e;
    }
  },

  async update(entityName, id, payload) {
    try {
      const { data, error } = await supabase
        .from(entityName)
        .update(stripLegacyDates(payload))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return withLegacyDates(data);
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(`[Fallback] ${entityName} table missing, using localStorage`);
        return localUpdate(entityName, id, payload);
      }
      throw e;
    }
  },

  async delete(entityName, id) {
    try {
      const { error } = await supabase.from(entityName).delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(`[Fallback] ${entityName} table missing, using localStorage`);
        return localDelete(entityName, id);
      }
      throw e;
    }
  },

  clear(entityName) {
    localStorage.removeItem(`${STORAGE_PREFIX}${entityName}`);
    return Promise.resolve({ success: true });
  },

  seed(entityName, dataArray) {
    localSeed(entityName, dataArray);
    return Promise.resolve({ success: true });
  },

  seedIfEmpty(entityName, seedFn) {
    const existing = getAll(entityName);
    if (existing.length === 0) {
      const data = seedFn();
      if (Array.isArray(data)) {
        setAll(entityName, data.map((d) => ({ ...d })));
      } else {
        setAll(entityName, [{ ...data }]);
      }
    }
    return Promise.resolve({ success: true });
  },
};
