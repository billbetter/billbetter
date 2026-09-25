import { createContext, useContext } from "react";

/**
 * True inside the signed-in app and the auth screens.
 *
 * The shared primitives (Button, Card, Input...) render the dashboard
 * template's styling when this is true and their original styling otherwise,
 * so the marketing site and the client-facing invoice and quote pages -- which
 * use the same components -- are left exactly as they were. Context crosses
 * portals, so a dialog opened from the app is styled like the app.
 */
export const AppShellContext = createContext(false);

export const useInAppShell = () => useContext(AppShellContext);
