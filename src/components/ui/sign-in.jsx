import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppShell } from "@/lib/preferences/app-shell";
import { AppShellContext } from "@/lib/preferences/shell-context";

/**
 * The auth screen used by the Login and Register pages, laid out as the
 * next-shadcn-admin-dashboard template's two-column login: the form centred
 * on the left, a primary-coloured brand panel on the right.
 *
 * Presentation only -- it owns no auth logic. The page passes the field
 * values, the submit handler and the message to show, so both pages share one
 * look while keeping their own Supabase wiring.
 */

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

/** The brand panel: the mark and tagline at the top, the product highlights
 * (`heroCards`) along the bottom, set the way the template sets its notes. */
function BrandPanel({ heroCards }) {
  const notes = heroCards;
  return (
    <div className="relative order-2 hidden h-full rounded-3xl bg-primary lg:flex">
      <div className="absolute top-10 space-y-1 px-10 text-primary-foreground">
        <img src="/logo-mark.png" alt="" className="mb-3 size-10 rounded-lg bg-primary-foreground/95 p-1.5" />
        <h2 className="text-2xl font-medium">Invoicium</h2>
        <p className="text-sm text-primary-foreground/80">Invoice, quote and get paid -- built for the trades.</p>
      </div>

      {notes.length > 0 && (
        <div className="absolute bottom-10 flex w-full justify-between px-10">
          {notes.map((note, i) => (
            <React.Fragment key={note.name}>
              {i > 0 && <Separator orientation="vertical" className="mx-3 !h-auto bg-primary-foreground/20" />}
              <div className="flex-1 space-y-1 text-primary-foreground">
                <h3 className="font-medium">{note.name}</h3>
                <p className="text-sm text-primary-foreground/80">{note.text}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export const SignInPage = ({
  mode = "signin",
  title,
  description,
  heroCards = [],
  email = "",
  password = "",
  onEmailChange,
  onPasswordChange,
  rememberMe = true,
  onRememberMeChange,
  message,
  loading = false,
  submitLabel,
  passwordSlot,
  showGoogle = true,
  googleLoading = false,
  onSubmit,
  onGoogleSignIn,
  onResetPassword,
  onToggleMode,
}) => {
  // The auth screens wear the app's theme (preset, font, dark mode).
  useAppShell();
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const isError = message && message.tone !== "success";

  return (
    <AppShellContext.Provider value={true}>
      <main className="bg-background text-foreground">
        <div className="grid min-h-[100dvh] justify-center p-2 lg:h-[100dvh] lg:grid-cols-2">
          <BrandPanel heroCards={heroCards} />

          <div className="relative order-1 flex h-full flex-col">
            {/* Top bar: the mark (phones, where the panel is hidden) and the
                switch between signing in and creating an account. */}
            <div className="flex items-center justify-between gap-4 px-4 pt-3 sm:px-8 lg:justify-end">
              <a href="/" className="flex items-center gap-2 lg:hidden">
                <img src="/logo-mark.png" alt="" className="size-7 object-contain" />
                <span className="font-semibold">Invoicium</span>
              </a>
              <p className="text-sm text-muted-foreground">
                {isSignup ? "Already have an account?" : "New to Invoicium?"}{" "}
                <button
                  type="button"
                  onClick={onToggleMode}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {isSignup ? "Sign in" : "Create an account"}
                </button>
              </p>
            </div>

            <div className="flex flex-1 items-center justify-center px-4 py-10">
              <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
                <div className="space-y-2 text-center">
                  <h1 className="text-3xl font-medium">{title}</h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <div className="space-y-4">
                  {showGoogle && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={onGoogleSignIn}
                        disabled={googleLoading}
                      >
                        {googleLoading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
                        {googleLoading ? "Opening Google..." : "Continue with Google"}
                      </Button>
                      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                        <span className="relative z-10 bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </>
                  )}

                  <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="grid gap-1.5">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => onEmailChange?.(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {!isSignup && (
                          <button
                            type="button"
                            onClick={onResetPassword}
                            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Reset password
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={isSignup ? "new-password" : "current-password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => onPasswordChange?.(e.target.value)}
                          placeholder="Enter your password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {passwordSlot}
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(checked) => onRememberMeChange?.(Boolean(checked))}
                      />
                      <Label htmlFor="rememberMe" className="font-normal">
                        Keep me signed in
                      </Label>
                    </div>

                    {message && (
                      <div
                        role="status"
                        className={`rounded-md border px-3 py-2.5 text-sm ${
                          isError
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300"
                        }`}
                      >
                        {message.text}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="animate-spin" />}
                      {loading
                        ? isSignup
                          ? "Creating account..."
                          : "Signing in..."
                        : submitLabel || (isSignup ? "Create Account" : "Sign In")}
                    </Button>
                  </form>
                </div>
              </div>
            </div>

            <div className="flex w-full justify-between px-4 pb-3 text-sm text-muted-foreground sm:px-8">
              <span>© {new Date().getFullYear()} Invoicium</span>
              <a href="/PrivacyPolicy" className="hover:text-foreground">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </main>
    </AppShellContext.Provider>
  );
};
