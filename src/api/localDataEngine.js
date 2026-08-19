import { supabase } from "./supabaseClient";

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

function isMissingTableError(error) {
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("does not exist") ||
    error?.message?.includes("Could not find the table") ||
    error?.details?.includes("does not exist")
  );
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
      const { data, error } = await supabase
        .from(entityName)
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
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
      let query = supabase.from(entityName).select("*");
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        query = query.order(field, { ascending: !desc });
      }
      if (typeof limit === "number" && limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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
      return data || null;
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
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
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
