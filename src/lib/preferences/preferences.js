/**
 * Layout and theme preferences for the signed-in app, ported from the
 * next-shadcn-admin-dashboard template's preference store.
 *
 * Device-local on purpose, like dark mode always was (see lib/appearance.js):
 * a crew member sharing a business must not inherit the owner's sidebar, and
 * "how it looks on my screen" is not business data.
 *
 * Every value is mirrored onto <html> as a data attribute, the way the
 * template does it, so CSS can react to it -- including in portalled menus
 * and dialogs that render outside the component tree.
 */
import { useSyncExternalStore } from "react";
import { THEME_PRESET_VALUES } from "./theme-presets";
import { FONT_KEYS, loadFont } from "./fonts";

const STORAGE_KEY = "invoicium-preferences";
// Read once for migration: this was the whole of the old theme setting.
const LEGACY_DARK_KEY = "invoicium-dark-mode";
const EVENT = "invoicium:preferences";

export const PREFERENCE_OPTIONS = {
  theme_mode: ["light", "dark", "system"],
  theme_preset: THEME_PRESET_VALUES,
  font: FONT_KEYS,
  content_layout: ["centered", "full-width"],
  navbar_style: ["sticky", "scroll"],
  sidebar_variant: ["inset", "sidebar", "floating"],
  sidebar_collapsible: ["icon", "offcanvas"],
};

export const PREFERENCE_DEFAULTS = {
  // Follow the device. Safe for the marketing site, which is light-only:
  // the dark class is only ever set while a themed screen is mounted (see
  // enterThemedScreen below), never on the public pages.
  theme_mode: "system",
  theme_preset: "default",
  font: "geist",
  content_layout: "centered",
  navbar_style: "sticky",
  sidebar_variant: "inset",
  sidebar_collapsible: "icon",
};

function sanitize(raw) {
  const out = { ...PREFERENCE_DEFAULTS };
  for (const key of Object.keys(PREFERENCE_DEFAULTS)) {
    if (raw && PREFERENCE_OPTIONS[key].includes(raw[key])) out[key] = raw[key];
  }
  return out;
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
    // First run on this build: carry the old dark-mode choice across.
    const legacy = window.localStorage.getItem(LEGACY_DARK_KEY);
    if (legacy === "true") return sanitize({ theme_mode: "dark" });
    if (legacy === "false") return sanitize({ theme_mode: "light" });
  } catch {
    // Private mode / storage blocked / corrupt JSON: defaults.
  }
  return { ...PREFERENCE_DEFAULTS };
}

let current = typeof window === "undefined" ? { ...PREFERENCE_DEFAULTS } : readStored();

function write(next) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Kept in step for anything still reading the old key (and for a rollback).
    window.localStorage.setItem(LEGACY_DARK_KEY, String(next.theme_mode === "dark"));
  } catch {
    // Still apply and notify, so the change is at least live in this tab.
  }
  applyPreferences(next);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getPreferences() {
  return current;
}

export function setPreference(key, value) {
  if (!PREFERENCE_OPTIONS[key]?.includes(value) || current[key] === value) return;
  write({ ...current, [key]: value });
}

export function resetPreferences() {
  write({ ...PREFERENCE_DEFAULTS });
}

const darkQuery = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function resolveThemeMode(mode = current.theme_mode) {
  if (mode === "system") return darkQuery()?.matches ? "dark" : "light";
  return mode;
}

// How many mounted screens follow the theme: the app shell, the auth screens,
// checkout, the paywall, the 404. The marketing site and the client-facing
// invoice and quote links are designed light-only, so while none of these is
// mounted the dark class stays off whatever the preference says -- which is
// what lets the default be "system" without a dark-mode device half-darkening
// the homepage.
let themedScreens = 0;

export function enterThemedScreen() {
  themedScreens += 1;
  applyPreferences();
}

export function leaveThemedScreen() {
  themedScreens = Math.max(0, themedScreens - 1);
  applyPreferences();
}

/** Mirror every preference onto <html>. Safe to call repeatedly. */
export function applyPreferences(values = current) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle(
    "dark",
    themedScreens > 0 && resolveThemeMode(values.theme_mode) === "dark",
  );
  root.dataset.themeMode = values.theme_mode;
  root.dataset.themePreset = values.theme_preset;
  root.dataset.font = values.font;
  root.dataset.contentLayout = values.content_layout;
  root.dataset.navbarStyle = values.navbar_style;
  root.dataset.sidebarVariant = values.sidebar_variant;
  root.dataset.sidebarCollapsible = values.sidebar_collapsible;
  loadFont(values.font);
}

function subscribe(onChange) {
  const sync = () => {
    const next = readStored();
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      current = next;
      applyPreferences(next);
    }
    onChange();
  };
  // "system" has to follow the OS live, not just at load.
  const media = darkQuery();
  const onMedia = () => {
    if (current.theme_mode === "system") {
      applyPreferences(current);
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", sync);
  media?.addEventListener?.("change", onMedia);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", sync);
    media?.removeEventListener?.("change", onMedia);
  };
}

/** @returns the current preferences; re-renders when any of them change. */
export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}

/** Light or dark, after resolving "system". */
export function useResolvedThemeMode() {
  const { theme_mode } = usePreferences();
  return resolveThemeMode(theme_mode);
}
