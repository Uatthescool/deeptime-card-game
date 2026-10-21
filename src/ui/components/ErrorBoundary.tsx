import { Component, type ErrorInfo, type ReactNode } from "react";

import { clearSavedGame } from "../save.ts";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last line of defense: an unexpected rendering error shows a recovery screen
 * instead of a blank page. The saved game is kept so "Try again" can resume it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="error-screen" role="alert">
        <section>
          <div className="eyebrow">Something went wrong</div>
          <h1>The game hit an unexpected error.</h1>
          <p>
            Your game in progress was saved before the error. Try again to resume it, or start over if the problem
            repeats.
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="setup-actions">
            <button className="primary-button" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button
              className="quiet-button"
              onClick={() => {
                clearSavedGame();
                window.location.reload();
              }}
            >
              Start over
            </button>
          </div>
        </section>
      </main>
    );
  }
}
