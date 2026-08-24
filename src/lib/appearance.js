/**
 * Appearance preferences that live only on this device.
 *
 * Follows the pattern dark mode already uses: a localStorage key, read
 * synchronously so the first paint is already correct. Deliberately NOT stored
 * on BusinessSettings -- a crew member sharing a business must not inherit the
 * owner's choice of background, and "how it looks on my phone" is not business
 * data.
 *
 * The event is what lets Settings toggle it and the Layout react without a
 * reload. `storage` alone would not do: browsers fire it in OTHER tabs only,
 * never the one that wrote. So we dispatch our own, and also listen to
 * `storage` so a change in one tab reaches the rest.
 */

import { useEffect, useState } from "react";

const SHADER_KEY = "invoicium-shader-bg";
const EVENT = "invoicium:appearance";

/** Whether the animated background is on. Off unless explicitly enabled. */
export function isShaderBackgroundEnabled() {
  try {
    return window.localStorage.getItem(SHADER_KEY) === "true";
  } catch {
    // Private mode / storage disabled. Off is the safe answer: it is the
    // current look, and nobody is surprised by it.
    return false;
  }
}

/**
 * Mirror the setting onto <html> as a class.
 *
 * The CSS that clears each page's own flat background keys off this, the same
 * way dark mode keys off `.dark`. It has to be a class rather than a prop:
 * the rule has to reach page-root elements this module never renders.
 */
export function applyShaderClass(enabled) {
  try {
    document.documentElement.classList.toggle("shader-bg", Boolean(enabled));
  } catch {
    // No document (SSR/tests) -- nothing to style.
  }
}

/** @param {boolean} enabled */
export function setShaderBackgroundEnabled(enabled) {
  try {
    window.localStorage.setItem(SHADER_KEY, String(Boolean(enabled)));
  } catch {
    // Fall through and still notify: the toggle should feel live even where
    // the choice cannot be remembered.
  }
  applyShaderClass(enabled);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Subscribe to the setting.
 *
 * @returns {boolean} whether the animated background is currently on
 */
export function useShaderBackground() {
  const [enabled, setEnabled] = useState(isShaderBackgroundEnabled);

  useEffect(() => {
    // Also on mount: a fresh page load has the stored value but no class yet.
    applyShaderClass(isShaderBackgroundEnabled());
    const sync = () => {
      const next = isShaderBackgroundEnabled();
      applyShaderClass(next);
      setEnabled(next);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return enabled;
}
