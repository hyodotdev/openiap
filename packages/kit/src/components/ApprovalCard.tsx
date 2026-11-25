import type { ReactNode } from "react";

import { PageWithTitle } from "@/components/PageWithTitle";

/** Centered card shared by the CLI and connector approval pages. */
export function ApprovalCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <PageWithTitle title={title}>
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-6">
        <section className="max-w-lg w-full rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {children}
        </section>
      </main>
    </PageWithTitle>
  );
}

export function ApprovalAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
