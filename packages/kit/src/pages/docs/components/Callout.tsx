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
    border: "border-primary/25",
    bg: "bg-primary/5",
    icon: <Info className="h-4 w-4 text-primary" />,
    label: "Note",
  },
  tip: {
    border: "border-success/25",
    bg: "bg-success/5",
    icon: <Lightbulb className="h-4 w-4 text-success" />,
    label: "Tip",
  },
  warning: {
    border: "border-warning/30",
    bg: "bg-warning/5",
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
    label: "Warning",
  },
  danger: {
    border: "border-danger/30",
    bg: "bg-danger/5",
    icon: <ShieldAlert className="h-4 w-4 text-danger" />,
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
