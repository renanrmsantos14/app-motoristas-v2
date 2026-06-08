import React from "react";
// @ts-ignore react-dom package is incomplete locally; this CJS file exists and bundles correctly.
import * as ReactDOM from "../node_modules/react-dom/cjs/react-dom.production.min.js";
import App from "./App";
import { installGlobalAppErrorLogger } from "./lib/appErrorLogger";

installGlobalAppErrorLogger();

(ReactDOM as { render: (node: React.ReactNode, container: HTMLElement) => void }).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root") as HTMLElement
);
