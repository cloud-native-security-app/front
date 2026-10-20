/**
 * Top-level error boundary (feature `resilient-error-handling`, REH-01).
 * A render exception anywhere below it would otherwise unmount the whole
 * React tree and leave a blank page; instead the user sees a friendly
 * message and a "Recargar" button. The error is logged with `console.error`
 * (the only observability channel this SPA has) — never shown to the user.
 *
 * Must be a class component: React offers no hook equivalent of
 * `getDerivedStateFromError`/`componentDidCatch`.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary: unexpected render error", error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div role="alert">
        <h2>Algo salió mal.</h2>
        <p>
          Ocurrió un error inesperado y no pudimos mostrar esta página. Recarga
          para intentarlo de nuevo.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
