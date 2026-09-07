import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Home, LayoutDashboard, ArrowLeft, Compass } from "lucide-react";

/**
 * The catch-all 404, rendered for any address that matches no route (see the
 * `path="*"` route in App.jsx). Dormant pages route here too, on purpose.
 *
 * Deliberately outside Layout, like Login and the public document pages: this
 * page must render for a signed-out visitor and a signed-in user alike, so it
 * cannot sit behind the auth gate, and it should not carry the app sidebar.
 *
 * Choices worth noting:
 *  - Navigation uses <Link>, not window.location, so returning home is an
 *    in-app transition rather than a full reload that re-downloads the bundle.
 *  - The primary action is contextual: a signed-in user is sent to their
 *    dashboard, a visitor to the marketing home -- whichever is the useful
 *    "back to safety" for who is actually looking at this.
 *  - The attempted path is shown, but only the pathname (never the query or
 *    hash), capped in length, in a muted mono chip. React escapes it, so it is
 *    text, not markup -- but it is kept small and de-emphasised so a junk URL
 *    does not dominate the page.
 *  - Semantic color tokens (surface/content/brand) carry their own light and
 *    dark values, so the page is theme-aware without per-element dark: classes.
 */
export default function PageNotFound() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Layout is what normally toggles the `.dark` class from this preference, and
  // this page renders OUTSIDE Layout -- so without this a dark-mode user would
  // get a light 404. Mirror Layout's exact behaviour (key "invoicium-dark-mode")
  // so the theme is consistent wherever the page is reached from.
  useEffect(() => {
    try {
      const dark = localStorage.getItem("invoicium-dark-mode") === "true";
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // Storage blocked (private mode); fall back to the default light theme.
    }
  }, []);

  // Pathname only, and bounded -- an attacker or a fat-fingered link should not
  // get to render 4KB of text into the page.
  const rawPath = location.pathname || "/";
  const attempted =
    rawPath.length > 64 ? `${rawPath.slice(0, 63)}…` : rawPath;

  const primary = isAuthenticated
    ? { to: createPageUrl("Dashboard"), label: "Back to dashboard", Icon: LayoutDashboard }
    : { to: "/", label: "Back to home", Icon: Home };

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-surface-sunken dark:bg-ink-950 text-content dark:text-content-inverted">
      {/* Soft brand wash behind the content -- decorative, low contrast, works
          in both themes because both blobs are brand-tinted at low alpha. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[440px] w-[440px] rounded-full bg-success-500/10 blur-[120px]"
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
        {/* Brand */}
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken"
        >
          <img
            src="/logo-mark.png"
            alt=""
            className="h-8 w-8 object-contain"
          />
          <span className="text-lg font-black tracking-tight text-content dark:text-content-inverted">
            Invoicium
          </span>
        </Link>

        <div className="w-full max-w-lg text-center">
          <p className="text-[10rem] leading-none font-black tracking-tighter text-content/10 dark:text-content-inverted/10 select-none sm:text-[12rem]">
            404
          </p>

          <div className="-mt-6 space-y-4 sm:-mt-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 dark:bg-brand-900/30 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              <Compass className="h-3.5 w-3.5" />
              Page not found
            </div>

            <h1 className="text-2xl font-black text-content dark:text-content-inverted sm:text-3xl">
              This page doesn&rsquo;t exist
            </h1>

            <p className="mx-auto max-w-md text-sm leading-relaxed text-content-muted dark:text-content-subtle sm:text-base">
              The link may be broken, the page may have moved, or it was never
              here. Let&rsquo;s get you back to somewhere that works.
            </p>

            <p className="mx-auto inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-surface-sunken dark:bg-ink-800/60 px-2.5 py-1 font-mono text-xs text-content-subtle dark:text-content-muted ring-1 ring-line-subtle dark:ring-ink-700">
              {attempted}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primary.to}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-content-inverted shadow-sm transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken sm:w-auto"
            >
              <primary.Icon className="h-4 w-4" />
              {primary.label}
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted px-5 py-2.5 text-sm font-semibold text-content-body dark:text-content-subtle transition-colors hover:bg-surface-sunken dark:hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>

          {/* Secondary help for a visitor who is lost, not just mistyped. */}
          <p className="mt-8 text-xs text-content-subtle dark:text-content-muted">
            Need a hand?{" "}
            <Link
              to={createPageUrl("Contact")}
              className="font-semibold text-brand-700 dark:text-brand-400 underline-offset-2 hover:underline"
            >
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
