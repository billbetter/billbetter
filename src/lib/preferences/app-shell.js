import { useLayoutEffect } from "react";
import { enterThemedScreen, leaveThemedScreen } from "./preferences";

/**
 * Let this screen follow the theme preference (light / dark / system).
 *
 * For screens outside the dashboard shell that were always theme-aware --
 * checkout, the paywall, the 404. The marketing site and the client links do
 * not call it, so they stay light.
 *
 * A layout effect so the dark class lands before the first paint rather than
 * flashing light first; mount/unmount pairs run in one flush, so moving
 * between two themed screens never drops it in between.
 */
export function useThemedScreen() {
  useLayoutEffect(() => {
    enterThemedScreen();
    return leaveThemedScreen;
  }, []);
}

let shellUsers = 0;

/**
 * Opt the current screen into the dashboard theme.
 *
 * Sets `data-app-shell` on <html>, which is what src/styles/app-theme.css is
 * scoped to, and makes the screen themed (see useThemedScreen). On <html>
 * rather than a wrapper div because menus, dialogs and toasts portal to
 * <body>: a wrapper would theme the page and leave every popup in the old
 * palette.
 *
 * Counted, so a screen swapping one shell branch for another (Layout's
 * loading state -> the app) never leaves a gap with the attribute removed.
 */
export function useAppShell() {
  useLayoutEffect(() => {
    shellUsers += 1;
    document.documentElement.dataset.appShell = "";
    enterThemedScreen();
    return () => {
      shellUsers -= 1;
      if (shellUsers === 0) delete document.documentElement.dataset.appShell;
      leaveThemedScreen();
    };
  }, []);
}
