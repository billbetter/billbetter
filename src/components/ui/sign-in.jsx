import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Split-screen auth shell used by the Login and Register pages.
 *
 * Presentation only — it owns no auth logic. The page passes the field values,
 * the submit handler and the message to show, so both pages share one look
 * while keeping their own Supabase wiring.
 *
 * Converted from the original TSX to JSX because this project is configured for
 * plain JavaScript (components.json -> "tsx": false), and the violet accent was
 * remapped onto the brand tokens so the page matches the rest of the site.
 */

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 48 48"
    aria-hidden="true"
  >
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

const GlassInputWrapper = ({ children }) => (
  <div className="rounded-2xl border border-line bg-surface-sunken/60 backdrop-blur-sm transition-colors focus-within:border-brand-500 focus-within:bg-brand-50/60">
    {children}
  </div>
);

/**
 * One card in the hero panel. Renders as a testimonial when `avatarSrc` is
 * given, and as a product highlight when `icon` is given instead — same shape
 * either way, so the layout doesn't depend on having real customer quotes.
 */
const HeroCard = ({ item, delay }) => {
  const Icon = item.icon;
  return (
    <div
      className={`animate-testimonial ${delay} flex w-64 items-start gap-3 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl`}
    >
      {item.avatarSrc ? (
        <img
          src={item.avatarSrc}
          className="h-10 w-10 rounded-2xl object-cover"
          alt=""
        />
      ) : (
        Icon && (
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Icon className="h-5 w-5 text-white" />
          </span>
        )
      )}
      <div className="text-sm leading-snug">
        <p className="font-bold text-white">{item.name}</p>
        {item.handle && <p className="text-white/60">{item.handle}</p>}
        <p className="mt-1 text-white/80">{item.text}</p>
      </div>
    </div>
  );
};

export const SignInPage = ({
  mode = "signin",
  title,
  description,
  heroImageSrc,
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
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const isError = message && message.tone !== "success";

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-surface md:flex-row">
      {/* Left column: the form */}
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <a
              href="/"
              className="animate-element animate-delay-100 flex items-center gap-2.5 self-start"
            >
              <img
                src="/logo-icon.png"
                alt=""
                className="h-9 w-9 object-contain"
              />
              <span className="text-lg font-black tracking-tight text-content">
                Invoicium
              </span>
            </a>

            <div>
              <h1 className="animate-element animate-delay-200 text-4xl font-black leading-tight tracking-tight text-content md:text-5xl">
                {title}
              </h1>
              <p className="animate-element animate-delay-300 mt-3 text-content-body">
                {description}
              </p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="animate-element animate-delay-400">
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-content-body"
                >
                  Email address
                </label>
                <div className="mt-1.5">
                  <GlassInputWrapper>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => onEmailChange?.(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl bg-transparent p-4 text-sm text-content placeholder:text-content-subtle focus:outline-none"
                    />
                  </GlassInputWrapper>
                </div>
              </div>

              <div className="animate-element animate-delay-500">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-content-body"
                >
                  Password
                </label>
                <div className="mt-1.5">
                  <GlassInputWrapper>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          isSignup ? "new-password" : "current-password"
                        }
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => onPasswordChange?.(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm text-content placeholder:text-content-subtle focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute inset-y-0 right-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-content-muted transition-colors hover:text-content" />
                        ) : (
                          <Eye className="h-5 w-5 text-content-muted transition-colors hover:text-content" />
                        )}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>
                {passwordSlot}
              </div>

              <div className="animate-element animate-delay-600 flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="custom-checkbox"
                    checked={rememberMe}
                    onChange={(e) => onRememberMeChange?.(e.target.checked)}
                  />
                  <span className="text-content-body">Keep me signed in</span>
                </label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={onResetPassword}
                    className="font-semibold text-brand-700 transition-colors hover:text-brand-800 hover:underline"
                  >
                    Reset password
                  </button>
                )}
              </div>

              {message && (
                <div
                  role="status"
                  className={`animate-element rounded-xl border px-4 py-3 text-sm ${
                    isError
                      ? "border-danger-200 bg-danger-50 text-danger-700"
                      : "border-success-200 bg-success-50 text-success-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-700 flex w-full items-center justify-center rounded-2xl bg-brand py-4 font-bold text-content-inverted shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-hover active:scale-[0.99] disabled:opacity-60"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading
                  ? isSignup
                    ? "Creating account..."
                    : "Signing in..."
                  : submitLabel || (isSignup ? "Create Account" : "Sign In")}
              </button>
            </form>

            {showGoogle && (
              <>
                <div className="animate-element animate-delay-800 relative flex items-center justify-center">
                  <span className="w-full border-t border-line" />
                  <span className="absolute bg-surface px-4 text-sm text-content-muted">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googleLoading}
                  className="animate-element animate-delay-900 flex w-full items-center justify-center gap-3 rounded-2xl border border-line py-4 font-semibold text-content transition-colors hover:bg-surface-sunken disabled:opacity-60"
                >
                  {googleLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {googleLoading ? "Opening Google..." : "Continue with Google"}
                </button>
              </>
            )}

            <p className="animate-element animate-delay-1000 text-center text-sm text-content-muted">
              {isSignup ? "Already have an account?" : "New to Invoicium?"}{" "}
              <button
                type="button"
                onClick={onToggleMode}
                className="font-semibold text-brand-700 transition-colors hover:underline"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero panel + cards */}
      <section className="relative hidden flex-1 p-4 md:block">
        <div
          className="animate-slide-right animate-delay-300 absolute inset-4 overflow-hidden rounded-3xl bg-surface-inverted bg-cover bg-center"
          style={
            heroImageSrc
              ? { backgroundImage: `url(${heroImageSrc})` }
              : undefined
          }
        >
          {!heroImageSrc && (
            <>
              <div className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full bg-brand-500/25 blur-[130px]" />
              <div className="absolute -bottom-32 -right-16 h-[460px] w-[460px] rounded-full bg-success-500/20 blur-[130px]" />
            </>
          )}
          {/* Scrim keeps the cards readable over a photo as well as the gradient. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
        </div>

        {heroCards.length > 0 && (
          <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
            <HeroCard item={heroCards[0]} delay="animate-delay-1000" />
            {heroCards[1] && (
              <div className="hidden xl:flex">
                <HeroCard item={heroCards[1]} delay="animate-delay-1200" />
              </div>
            )}
            {heroCards[2] && (
              <div className="hidden 2xl:flex">
                <HeroCard item={heroCards[2]} delay="animate-delay-1400" />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default SignInPage;
