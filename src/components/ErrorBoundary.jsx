import React from "react";

/**
 * Catches render errors so one broken component does not blank the whole app.
 *
 * React unmounts the entire tree when a render throws and nothing catches it.
 * This app had no boundary anywhere, so any such throw produced a white page
 * with no message on screen and nothing to act on -- the error was only visible
 * to someone who happened to have the console open. Reports were "the page is
 * just white and won't load", which is indistinguishable from a failed deploy,
 * a network problem, or a hung request.
 *
 * `resetKey` lets a parent clear the error when the user navigates: without it
 * a boundary latches on first failure and the section stays broken until a full
 * reload, even after moving somewhere unrelated.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the component stack: it names the component that threw, which the
    // message alone usually does not.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <h2 className="text-lg font-bold text-content dark:text-content-inverted">
            This section failed to load
          </h2>
          <p className="mt-2 text-sm text-content-body dark:text-ink-300">
            The rest of the app is still working — use the back button or reload to
            continue.
          </p>

          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-sunken p-3 text-xs text-content-muted dark:bg-ink-800">
            {String(error?.message || error)}
          </pre>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface-sunken dark:border-ink-700 dark:text-content-inverted"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-content-inverted transition-colors hover:bg-brand-hover"
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
