import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Last line of defence: a render error shows a message and a reload button, never a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Genesis UI error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="error-state" role="alert">
            <div>
              <strong>Something went wrong while drawing this page.</strong>
              <p className="muted">{this.state.error.message}</p>
            </div>
            <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
