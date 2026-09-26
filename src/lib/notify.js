/**
 * Pop-up notifications: errors, confirmations, and anything else the app has
 * to tell someone without stopping them.
 *
 *   import { notify } from "@/lib/notify";
 *   notify.error("Failed to save template. Please try again.");
 *   notify.success("Template saved", "It's in your templates list.");
 *
 * Replaces window.alert(), which froze the whole tab behind a grey browser
 * dialog headed with the site's address. These are drawn by <Toaster /> in
 * App.jsx with the notifications-5 card, and dismiss themselves.
 *
 * One message or two. With a single string, its first sentence becomes the
 * bold title and the rest the smaller body -- "Failed to save template. Please
 * try again." reads as title + hint -- so call sites that used to pass one
 * string to alert() look right without being rewritten twice.
 */
import { useSyncExternalStore } from "react";

/** Errors stay longer: they usually say what to do next. */
const DURATION = { success: 4000, info: 5000, warning: 6500, error: 8000 };
const MAX_VISIBLE = 4;
/** Past this a lone sentence is too long to be a heading. */
const TITLE_MAX = 80;
const DEFAULT_TITLE = {
  success: "Done",
  info: "Note",
  warning: "Heads up",
  error: "Something went wrong",
};

let items = [];
let nextId = 1;
const timers = new Map();
const listeners = new Set();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

function schedule(id, ms) {
  clearTimeout(timers.get(id)?.handle);
  timers.set(id, { handle: setTimeout(() => dismiss(id), ms), ends: Date.now() + ms, left: ms });
}

/** Split one message into a title and a body. */
export function splitMessage(message, variant = "info") {
  const text = String(message ?? "").trim();
  if (!text) return { title: DEFAULT_TITLE[variant] };
  // A blank line was always a paragraph break in alert() text.
  const para = text.split(/\n\s*\n/);
  if (para.length > 1) {
    return {
      title: para[0].trim().replace(/\.$/, ""),
      body: para.slice(1).join("\n\n").trim(),
    };
  }
  // First sentence: up to ". ", "! " or "? " -- not the dot in "0.5" or "e.g.".
  const m = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text);
  if (m && m[1].length <= TITLE_MAX) {
    return { title: m[1].replace(/\.$/, ""), body: m[2] };
  }
  if (text.length <= TITLE_MAX) return { title: text.replace(/\.$/, "") };
  return { title: DEFAULT_TITLE[variant], body: text };
}

/**
 * @param {"success"|"info"|"warning"|"error"} variant
 * @param {string} title  or the whole message, when body is left out
 * @param {string} [body]
 * @param {{ duration?: number }} [options]
 * @returns {number} the id, for dismiss()
 */
function show(variant, title, body, options = {}) {
  const parts = body === undefined || body === null || body === ""
    ? splitMessage(title, variant)
    : { title: String(title), body: String(body) };

  // The same message again (a double-tapped button, a retry loop) restarts
  // the one already showing instead of stacking a copy of it.
  const same = items.find(
    (n) => n.variant === variant && n.title === parts.title && n.body === parts.body,
  );
  const duration = options.duration ?? DURATION[variant];
  if (same) {
    schedule(same.id, duration);
    return same.id;
  }

  const id = nextId++;
  items = [{ id, variant, ...parts }, ...items];
  // Oldest out first when the stack is full.
  for (const extra of items.slice(MAX_VISIBLE)) {
    clearTimeout(timers.get(extra.id)?.handle);
    timers.delete(extra.id);
  }
  items = items.slice(0, MAX_VISIBLE);
  schedule(id, duration);
  emit();
  return id;
}

export function dismiss(id) {
  clearTimeout(timers.get(id)?.handle);
  timers.delete(id);
  const before = items.length;
  items = items.filter((n) => n.id !== id);
  if (items.length !== before) emit();
}

/** Hold a notification open while the pointer or focus is on it. */
export function pause(id) {
  const t = timers.get(id);
  if (!t || t.paused) return;
  clearTimeout(t.handle);
  timers.set(id, { ...t, paused: true, left: Math.max(0, t.ends - Date.now()) });
}

/** Resume the countdown, with at least a moment left to finish reading. */
export function resume(id) {
  const t = timers.get(id);
  if (!t || !t.paused) return;
  schedule(id, Math.max(t.left, 1500));
}

export const notify = {
  success: (title, body, options) => show("success", title, body, options),
  info: (title, body, options) => show("info", title, body, options),
  warning: (title, body, options) => show("warning", title, body, options),
  error: (title, body, options) => show("error", title, body, options),
  dismiss,
};

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => items;

/** The notifications on screen, newest first. */
export function useNotifications() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
