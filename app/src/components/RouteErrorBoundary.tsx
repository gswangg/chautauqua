import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

// DEC-695 (mandate item 33): ONE route-level error boundary. Without this,
// any throw during render unmounts the whole tree and ships an empty
// <body> -- verified as the root cause of three P0s (Overview's
// undefined.length per DEC-370, the shell's badge fetch, and the
// reviewer-role blackout). App.tsx wraps the routed content in this
// boundary, keyed on the router location, so navigating away from a
// failed route remounts the boundary and clears the error.
//
// No co-located stylesheet -- every class here is a shared one already
// defined in app/src/styles.css (chq-measure, chq-section-label,
// chq-page-title, chq-empty, chq-error, chq-btn tiers).
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Fail loudly: log the caught error and its component stack rather
    // than swallowing it into a friendly nothing.
    console.error(error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="chq-measure">
          <span className="chq-section-label">Something broke</span>
          <h1 className="chq-page-title">This page hit an error</h1>
          <p className="chq-error">{error.message}</p>
          <p className="chq-empty">
            <button type="button" className="chq-btn chq-btn-primary" onClick={this.reset}>
              Try again
            </button>{' '}
            <Link className="chq-btn chq-btn-tertiary" to="/overview">
              Back to Overview
            </Link>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
