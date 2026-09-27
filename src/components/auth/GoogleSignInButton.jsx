import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, makeNonce } from "@/lib/googleIdentity";
import { useResolvedThemeMode } from "@/lib/preferences/preferences";

/**
 * Google's own sign-in button, so the account chooser names this site rather
 * than the Supabase project (see lib/googleIdentity.js).
 *
 * `fallback` -- the old redirect button -- shows until Google's button has
 * drawn, and stays if Google's script is blocked or fails to load, so there
 * is always a working way in.
 *
 * @param {{ mode?: "signin" | "signup",
 *   onCredential: (token: string, nonce: string) => void,
 *   fallback: import("react").ReactNode }} props
 */
export default function GoogleSignInButton({ mode = "signin", onCredential, fallback }) {
  const slotRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [ready, setReady] = useState(false);
  const theme = useResolvedThemeMode();

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), makeNonce()]);
        const slot = slotRef.current;
        if (cancelled || !slot) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          context: mode === "signup" ? "signup" : "signin",
          ux_mode: "popup",
          itp_support: true,
          use_fedcm_for_button: true,
          callback: (response) => {
            if (response?.credential) onCredentialRef.current(response.credential, nonce.raw);
          },
        });
        slot.replaceChildren();
        google.accounts.id.renderButton(slot, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          // Google caps the button at 400px; match the form's width under that.
          width: Math.min(400, Math.round(slot.parentElement?.clientWidth || 320)),
        });
        if (!cancelled) setReady(true);
      } catch (err) {
        // Script blocked or offline: the redirect button stays in place.
        console.warn("Google sign-in button unavailable:", err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, theme]);

  return (
    <div className="w-full">
      {!ready && fallback}
      {/* Google draws an iframe in here. Hidden, not unmounted, until drawn. */}
      <div
        ref={slotRef}
        className={ready ? "flex min-h-10 w-full justify-center [color-scheme:normal]" : "hidden"}
      />
    </div>
  );
}
