import { Tooltip } from "@/components/Tooltip";

/** Stands in for a value the store did not return; hovering says why. */
export function NotReported({ reason }: { reason: string }) {
  // To the right: a scrolling table would clip a tooltip above or below.
  return (
    <Tooltip content={reason} side="right" align="center">
      <span
        tabIndex={0}
        className="whitespace-nowrap rounded-sm text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {"Not reported"}
      </span>
    </Tooltip>
  );
}
