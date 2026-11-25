import { Tooltip } from "@/components/Tooltip";

/** Stands in for a value the store did not return; hovering says why. */
export function NotReported({ reason }: { reason: string }) {
  // To the right: a scrolling table would clip a tooltip above or below.
  return (
    <Tooltip content={reason} side="right" align="center">
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {"Not reported"}
      </span>
    </Tooltip>
  );
}
