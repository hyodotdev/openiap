import {
  Children,
  cloneElement,
  isValidElement,
  ReactNode,
  useId,
  useState,
  type FocusEvent,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

// Lightweight hover/focus tooltip. Self-contained — no Radix /
// floating-ui dep — because the only thing we need is a positioned
// popover that opens on `mouseenter` / `focusin` and closes on
// `mouseleave` / `focusout`. Anchors against the trigger element
// via the wrapping `relative` div.
//
// A11y plumbing (Copilot review on PR #127):
// - The trigger element gets `aria-describedby` pointing at a
//   stable id on the tooltip popover (via `useId` + `cloneElement`),
//   so screen readers announce the tooltip text alongside the
//   trigger's own label.
// - Focus close uses `onBlurCapture` with a `relatedTarget`
//   containment check — the tooltip stays open while focus moves
//   between descendants of the wrapper instead of closing the
//   moment any inner element is blurred.
//
// Use a real component (not a `title=` attribute or inline JSX) so
// the hover affordance is consistent across the app: same delay,
// same widths, same border/padding tokens.
export function Tooltip({
  children,
  content,
  side = "bottom",
  align = "end",
  widthClass = "w-80",
}: {
  children: ReactNode;
  content: ReactNode;
  side?: Side;
  align?: Align;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  // Wire `aria-describedby` onto the first valid React element so
  // assistive tech announces the tooltip text. Falls through
  // unchanged when the consumer passes a fragment / text node /
  // multiple siblings — we don't want to silently swallow those
  // shapes, the user just gets a tooltip without the SR linkage.
  const trigger =
    Children.count(children) === 1 && isValidElement(children)
      ? cloneElement(
          children as ReactElement<{ "aria-describedby"?: string }>,
          {
            "aria-describedby": tooltipId,
          },
        )
      : children;

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    // `relatedTarget` is the element receiving focus next. When it
    // stays inside the wrapper (e.g. focus moving between two
    // buttons in the trigger), keep the tooltip open. Closing on
    // every bubbled blur was prematurely hiding the popover the
    // moment focus shifted across descendants.
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setOpen(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlurCapture={handleBlur}
    >
      {trigger}
      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          // Explicit opaque surfaces — `bg-popover` resolved to a
          // semi-transparent token in this theme, which let the
          // table content bleed through and made the tooltip
          // unreadable. Pin to solid white in light mode and a
          // near-black gray in dark mode so contrast is guaranteed
          // regardless of what's behind the trigger.
          className={cn(
            "absolute z-50 rounded-md border border-border bg-white dark:bg-[#0f0f14] text-foreground p-3 text-xs shadow-xl",
            widthClass,
            sidePosition(side),
            alignPosition(side, align),
          )}
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}

function sidePosition(side: Side): string {
  switch (side) {
    case "top":
      return "bottom-full mb-2";
    case "bottom":
      return "top-full mt-2";
    case "left":
      return "right-full mr-2";
    case "right":
      return "left-full ml-2";
  }
}

function alignPosition(side: Side, align: Align): string {
  if (side === "top" || side === "bottom") {
    switch (align) {
      case "start":
        return "left-0";
      case "center":
        return "left-1/2 -translate-x-1/2";
      case "end":
        return "right-0";
    }
  }
  switch (align) {
    case "start":
      return "top-0";
    case "center":
      return "top-1/2 -translate-y-1/2";
    case "end":
      return "bottom-0";
  }
}
