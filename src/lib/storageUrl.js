import { supabase } from "@/api/supabaseClient";
import { PRIVATE_BUCKET } from "@/api/sdk";
import { useEffect, useState } from "react";

/**
 * Turn a stored file reference back into something a browser can open.
 *
 * -- Why a reference and not a URL -----------------------------------------
 *
 * Receipts and quote-analysis photos live in a private bucket, so there is no
 * permanent URL to store: reading one needs a signed URL that expires. What
 * goes in the database is therefore a REFERENCE -- 'private:<path>' -- and it
 * is resolved to a signed URL at the moment somebody actually looks.
 *
 * Storing the signed URL instead would appear to work for an hour and then rot
 * into a dead link, and the failure is silent: an <img> that renders nothing,
 * or a receipt link that 400s long after anyone remembers why.
 *
 * -- Legacy values pass straight through ------------------------------------
 *
 * Every row written before the bucket split holds a plain https URL into the
 * public bucket. Those still work, so they are returned untouched rather than
 * migrated behind a flag. That is what makes this change safe to deploy on its
 * own: nothing in the database has to move first.
 *
 * It also means those older receipts are still publicly downloadable by path.
 * Moving them is a separate, deliberate data migration --
 * scripts/migrate-receipts-to-private.py -- not something a render helper
 * should do behind anyone's back.
 */

const PRIVATE_PREFIX = "private:";

/** Roughly how long a minted URL is good for, and when we stop reusing it. */
const SIGN_TTL_SEC = 3600;
const CACHE_TTL_MS = (SIGN_TTL_SEC - 300) * 1000; // retire it 5 min early

/** path -> { url, expiresAt }. Per tab; signing again is cheap but not free. */
const signedCache = new Map();

export function isPrivateRef(value) {
  return typeof value === "string" && value.startsWith(PRIVATE_PREFIX);
}

/** The object path inside PRIVATE_BUCKET, or null if this is not a private ref. */
export function privateRefPath(value) {
  return isPrivateRef(value) ? value.slice(PRIVATE_PREFIX.length) : null;
}

/**
 * Resolve a stored reference to a URL a browser can load.
 *
 * Returns null rather than throwing when the reference cannot be resolved --
 * callers render a placeholder or hide a link, and a receipt that will not
 * load must not take a page down with it.
 *
 * @param {string|null|undefined} ref  'private:<path>', an https URL, or empty
 * @returns {Promise<string|null>}
 */
export async function resolveStorageUrl(ref) {
  if (!ref) return null;

  // Legacy public URLs, and logos, are already viewable.
  if (!isPrivateRef(ref)) return ref;

  const path = privateRefPath(ref);
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  try {
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, SIGN_TTL_SEC);
    if (error || !data?.signedUrl) throw error || new Error("no signed URL");
    signedCache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return data.signedUrl;
  } catch (e) {
    console.error("resolveStorageUrl failed for", ref, e);
    return null;
  }
}

/**
 * Open a stored reference in a new tab.
 *
 * The blank tab is opened FIRST, synchronously, and pointed at the URL after
 * the signing round-trip. Opening it after the await is a popup the browser
 * blocks, which reads to the user as a button that does nothing.
 *
 * @param {string|null|undefined} ref
 */
export async function openStorageRef(ref) {
  if (!ref) return;
  const win = window.open("", "_blank", "noopener,noreferrer");
  const url = await resolveStorageUrl(ref);
  if (!url) {
    if (win) win.close();
    alert("That file could not be opened. It may have been removed.");
    return;
  }
  if (win) win.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * React hook form, for anywhere the reference has to become an <img src>.
 *
 * Returns null while resolving and on failure, so `src={url || undefined}`
 * renders nothing rather than a broken-image icon.
 *
 * @param {string|null|undefined} ref
 * @returns {string|null}
 */
export function useStorageUrl(ref) {
  const [url, setUrl] = useState(() => (isPrivateRef(ref) ? null : ref || null));

  useEffect(() => {
    let cancelled = false;
    if (!ref) {
      setUrl(null);
      return undefined;
    }
    if (!isPrivateRef(ref)) {
      setUrl(ref);
      return undefined;
    }
    resolveStorageUrl(ref).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return url;
}
