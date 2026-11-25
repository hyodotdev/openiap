import type { ReactElement, ReactNode } from "react";

export const SECTION_LABEL =
  "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
export const TOOLBAR =
  "flex flex-wrap items-center gap-2 border-b border-border p-4";

/** One bordered panel that holds a page's figures in place of stat cards. */
export function SummaryPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    // Sized by its own width, not the viewport: the sidebar narrows the page.
    <section aria-label={label} className="@container">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {children}
      </div>
    </section>
  );
}
