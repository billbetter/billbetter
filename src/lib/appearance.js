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
import { DEFAULT_PRESET_ID } from "@/components/ui/shader-presets";

const SHADER_KEY = "invoicium-shader-bg";
const PRESET_KEY = "invoicium-shader-preset";
const EVENT = "invoicium:appearance";

/**
 * Whether the animated background is on. ON unless explicitly turned off.
 *
 * Reads `!== "false"` rather than `=== "true"` so the three states stay
 * distinct: "true" (chosen on), "false" (chosen off), and absent (default).
 * Anyone who already switched it off keeps it off -- flipping the default must
 * not reach into a choice someone already made.
 */
export function isShaderBackgroundEnabled() {
  try {
    return window.localStorage.getItem(SHADER_KEY) !== "false";
  } catch {
    // Private mode / storage disabled. Match the default rather than the old
    // off: a private window should look like the product, and the shader
    // falls back to the flat background on its own where WebGL is missing.
    return true;
  }
}

/**
 * Whether the person actually flipped the switch, either way.
 *
 * This is NOT "is it on". It exists because the two are no longer the same
 * thing. The reduced-motion override in Layout is justified by the comment on
 * ShaderBackground -- "a person deliberately enabled IS the consent" -- and
 * that argument only holds for someone who deliberately enabled it. On by
 * default is nobody's consent, so the default has to keep honouring the OS
 * setting, which draws one static frame instead of animating.
 */
export function isShaderBackgroundChosen() {
  try {
    return window.localStorage.getItem(SHADER_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Which background is drawn. Separate key from the on/off switch.
 *
 * Kept apart so turning the background off and on again returns the one that
 * was chosen, rather than resetting to the default -- the switch answers
 * "should there be a background", not "which one".
 *
 * An unrecognised stored value is not corrected here. getPreset() already
 * falls back, and rewriting storage on read would silently discard the choice
 * of anyone running a build where a preset exists that this one has not
 * shipped yet.
 */
export function getShaderPreset() {
  try {
    return window.localStorage.getItem(PRESET_KEY) || DEFAULT_PRESET_ID;
  } catch {
    return DEFAULT_PRESET_ID;
  }
}

/** @param {string} id a key of SHADER_PRESETS */
export function setShaderPreset(id) {
  try {
    window.localStorage.setItem(PRESET_KEY, String(id));
  } catch {
    // Same as the switch: notify anyway so the change is at least live.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
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

function readAppearance() {
  return {
    enabled: isShaderBackgroundEnabled(),
    chosen: isShaderBackgroundChosen(),
    preset: getShaderPreset(),
  };
}

/**
 * Subscribe to the setting.
 *
 * Tracks `chosen` alongside `enabled` in ONE state object on purpose. Reading
 * `chosen` outside React state would go stale in the one case that matters:
 * setting the value it already had (default-on, then switched on) changes
 * `chosen` without changing `enabled`, so a re-render keyed only on `enabled`
 * would never happen and the reduced-motion decision would be made on a value
 * from before the click.
 *
 * @returns {{ enabled: boolean, chosen: boolean, preset: string }}
 */
export function useShaderAppearance() {
  const [state, setState] = useState(readAppearance);

  useEffect(() => {
    // Also on mount: a fresh page load has the stored value but no class yet.
    applyShaderClass(isShaderBackgroundEnabled());
    const sync = () => {
      const next = readAppearance();
      applyShaderClass(next.enabled);
      setState((prev) =>
        prev.enabled === next.enabled &&
        prev.chosen === next.chosen &&
        prev.preset === next.preset
          ? prev
          : next,
      );
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}

/**
 * Subscribe to the setting.
 *
 * @returns {boolean} whether the animated background is currently on
 */
export function useShaderBackground() {
  return useShaderAppearance().enabled;
}
