import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { sdk } from "@/api/sdk";
import { PasswordStrength } from "@/components/ui/password-strength";
import { SignInPage } from "@/components/ui/sign-in";
import { getSameOriginReturnPath } from "@/lib/auth-redirects";

const isGoogleAuthEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== "false";

const HERO_CARDS = [
  {
    icon: FileText,
    name: "Invoice in under a minute",
    text: "Build it, send it, and get notified the moment your client opens it.",
  },
  {
    icon: Zap,
    name: "Chase overdue in one tap",
    text: "Friendly, professional or firm — the follow-up is written for you.",
  },
  {
    icon: ShieldCheck,
    name: "Card payments built in",
    text: "Clients pay straight from the invoice. Money lands in your account.",
  },
];

/**
 * Shared sign-in / create-account screen.
 *
 * `defaultMode` lets /Register mount the same page in signup mode; the ?mode=
 * query param still wins so existing links keep working.
 */
export default function Login({ defaultMode = "signin" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = getSameOriginReturnPath(
    searchParams.get("returnUrl"),
    "/Dashboard",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [mode, setMode] = useState(
    searchParams.get("mode") === "signup" ? "signup" : defaultMode,
  );

  const isSignup = mode === "signup";
  const fail = (text) => setMessage({ text, tone: "error" });
  const ok = (text) => setMessage({ text, tone: "success" });

  // Supabase bounces OAuth failures back to the redirect URL as ?error=... or
  // #error=..., which this page previously ignored — the user just landed back
  // on the form with no explanation. Surface it, then strip it from the URL.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = searchParams.get("error") || hash.get("error") || "";
    const description =
      searchParams.get("error_description") ||
      hash.get("error_description") ||
      code;
    if (!description) return;

    const readable = decodeURIComponent(description.replace(/\+/g, " "));
    fail(
      code === "unsupported_provider" ||
        /provider is not enabled/i.test(readable)
        ? "Google sign-in isn't switched on for this app yet. Use your email and password instead."
        : readable,
    );

    const url = new URL(window.location.href);
    url.hash = "";
    ["error", "error_code", "error_description"].forEach((key) =>
      url.searchParams.delete(key),
    );
    window.history.replaceState({}, "", url.toString());
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted && data.session) {
        navigate(returnUrl, { replace: true });
      }
    };

    redirectIfAuthenticated();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          navigate(returnUrl, { replace: true });
        }
      },
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate, returnUrl]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setMessage(null);
    try {
      await sdk.auth.signInWithGoogle(returnUrl);
    } catch (err) {
      console.error("Google auth error:", err);
      setGoogleLoading(false);
      fail(err.message || "Google sign-in could not start. Please try again.");
    }
  };

  // Fallback way in when the password is forgotten and the Google provider is
  // unavailable — emails a one-time link that signs the user straight in.
  const handleResetPassword = async () => {
    if (!email) {
      fail("Enter your email address first, then request the link.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/Login?returnUrl=${encodeURIComponent(returnUrl)}`,
        },
      });
      if (linkError) throw linkError;
      ok("Check your email — we sent you a sign-in link.");
    } catch (err) {
      console.error("Magic link error:", err);
      fail(err.message || "Could not send the sign-in link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    const next = isSignup ? "signin" : "signup";
    setMode(next);
    setMessage(null);
    navigate(next === "signup" ? "/Register" : "/Login", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    // Read back by supabaseClient.js on the next browser session.
    try {
      window.localStorage.setItem("invoicium-remember-me", String(rememberMe));
    } catch {
      // storage disabled — session simply stays persisted
    }

    try {
      if (!isSignup) {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          const text = signInError.message.toLowerCase();
          if (text.includes("email not confirmed")) {
            fail(
              "This email hasn't been confirmed yet. Check your inbox (and spam) for the confirmation link.",
            );
            setLoading(false);
            return;
          }
          if (text.includes("invalid login")) {
            fail(
              "No account found with that email and password. Create one below, or use the sign-in link.",
            );
            setMode("signup");
            setLoading(false);
            return;
          }
          throw signInError;
        }
        if (data.user) {
          navigate(returnUrl, { replace: true });
          return;
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          navigate(returnUrl, { replace: true });
          return;
        }
        ok(
          "Account created! Check your email to confirm it, then come back and sign in.",
        );
        setMode("signin");
      }
    } catch (err) {
      console.error("Auth error:", err);
      fail(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignInPage
      mode={mode}
      title={isSignup ? "Create your account" : "Welcome back"}
      description={
        isSignup
          ? "Start invoicing in minutes. Free to try — no credit card needed."
          : "Sign in to manage your invoices, quotes and payments."
      }
      heroCards={HERO_CARDS}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      rememberMe={rememberMe}
      onRememberMeChange={setRememberMe}
      message={message}
      loading={loading}
      showGoogle={isGoogleAuthEnabled}
      googleLoading={googleLoading}
      passwordSlot={
        isSignup ? <PasswordStrength value={password} className="mt-3" /> : null
      }
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onResetPassword={handleResetPassword}
      onToggleMode={toggleMode}
    />
  );
}
