import React from "react";
import { reportAppError } from "../../lib/appErrorLogger";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportAppError(error, {
      severity: "critical",
      source: "react.errorboundary",
      component: "AppErrorBoundary",
      phase: "render",
      payload: { componentStack: info.componentStack }
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="critical-error-card" role="alert" aria-live="assertive">
        <strong>Erro crítico no app.</strong>
        <span>Falha registrada na tabela de log. Recarregue para continuar.</span>
        <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
      </div>
    );
  }
}
