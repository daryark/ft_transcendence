import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.scss";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled frontend error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error">
        <section>
          <span>CLIENT ERROR</span>
          <h1>Something went wrong</h1>
          <p>The page encountered an unexpected error.</p>
          <button onClick={() => window.location.reload()} type="button">
            RELOAD
          </button>
          <button
            onClick={() => {
              window.location.href = "/play";
            }}
            type="button"
          >
            RETURN TO PLAY
          </button>
        </section>
      </main>
    );
  }
}
