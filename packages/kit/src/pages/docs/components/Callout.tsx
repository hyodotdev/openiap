import type { ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb, ShieldAlert } from "lucide-react";

type CalloutKind = "note" | "tip" | "warning" | "danger";

const STYLES: Record<
  CalloutKind,
  {
    border: string;
    bg: string;
    icon: ReactNode;
    label: string;
  }
> = {
  note: {
    border: "border-blue-300 dark:border-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
    label: "Note",
  },
  tip: {
    border: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: (
      <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    ),
    label: "Tip",
  },
  warning: {
    border: "border-amber-300 dark:border-amber-700",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    icon: (
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    ),
    label: "Warning",
  },
  danger: {
    border: "border-red-300 dark:border-red-700",
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />,
    label: "Critical",
  },
};

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: CalloutKind;
  title?: string;
  children: ReactNode;
}) {
  const style = STYLES[kind];
  return (
    <aside
      className={`my-4 rounded-lg border ${style.border} ${style.bg} p-4`}
      role="note"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {style.icon}
        <span>{title ?? style.label}</span>
      </div>
      <div className="text-sm leading-relaxed text-foreground/90 [&>p]:mb-2 [&>p:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}
