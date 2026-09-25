import { useEffect } from "react";
import { applyPreferences } from "./preferences";

/**
 * Apply the stored preferences (dark class, preset, font...) to <html>.
 *
 * Called where the old dark-mode effect lived -- Layout and the 404 -- so the
 * pages that never followed the theme (the client-facing invoice and quote
 * links) still don't on a fresh load.
 */
export function useApplyPreferences() {
  useEffect(() => {
    applyPreferences();
  }, []);
}

let shellUsers = 0;

/**
 * Opt the current screen into the dashboard theme.
 *
 * Sets `data-app-shell` on <html>, which is what src/styles/app-theme.css is
 * scoped to. On <html> rather than a wrapper div because menus, dialogs and
 * toasts portal to <body>: a wrapper would theme the page and leave every
 * popup in the old palette.
 *
 * Counted, so a screen swapping one shell branch for another (Layout's
 * loading state -> the app) never leaves a gap with the attribute removed.
 */
export function useAppShell() {
  useEffect(() => {
    applyPreferences();
    shellUsers += 1;
    document.documentElement.dataset.appShell = "";
    return () => {
      shellUsers -= 1;
      if (shellUsers === 0) delete document.documentElement.dataset.appShell;
    };
  }, []);
}
