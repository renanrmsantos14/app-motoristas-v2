declare module "*react-dom.production.min.js" {
  import type { ReactNode } from "react";

  export function render(node: ReactNode, container: HTMLElement): void;
}
