import React from "react";
// @ts-ignore react-dom package is incomplete locally; this CJS file exists and bundles correctly.
import * as ReactDOM from "../node_modules/react-dom/cjs/react-dom.production.min.js";
import App from "./App";
import { AppErrorBoundary } from "./components/app/AppErrorBoundary";
import { installGlobalAppErrorLogger } from "./lib/appErrorLogger";

installGlobalAppErrorLogger();

try {
  (ReactDOM as { render: (node: React.ReactNode, container: HTMLElement) => void }).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
    document.getElementById("root") as HTMLElement
  );
} catch (error) {
  (window as Window & { __APP_REPORT_ERROR?: (error: unknown, context?: Record<string, unknown>) => void }).__APP_REPORT_ERROR?.(error, {
    severity: "critical",
    source: "main.render",
    phase: "bootstrap"
  });
  throw error;
}
