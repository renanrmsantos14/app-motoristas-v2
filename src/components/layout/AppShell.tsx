import type { ReactNode } from "react";

type AppShellProps = {
  screenLabel: string;
  children: ReactNode;
};

export function AppShell({ screenLabel, children }: AppShellProps) {
  return (
    <main className="screen" aria-label={screenLabel}>
      <section className="container-1">
        <div className="container-5">{children}</div>
      </section>
    </main>
  );
}
