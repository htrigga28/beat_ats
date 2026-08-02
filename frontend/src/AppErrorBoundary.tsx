import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error" role="alert">
        <p className="kicker">PRIVATE DOCUMENT WORKSPACE</p>
        <h1>We could not render this step.</h1>
        <p>
          Your session is still in this page, but the interface hit an unexpected data shape. Reload
          the app to start a clean session.
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Reload app
        </button>
      </main>
    );
  }
}
