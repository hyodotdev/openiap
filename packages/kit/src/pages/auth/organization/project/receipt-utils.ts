import type { BadgeVariant } from "@/components/Badge";
import { HarmonizedPurchaseState } from "@/convex";

export const FALLBACK_VALUE = "—";

export function formatReceiptDate(
  timestamp?: number | null,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
) {
  if (!timestamp) {
    return FALLBACK_VALUE;
  }

  try {
    return new Intl.DateTimeFormat(undefined, options).format(
      new Date(timestamp),
    );
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

const stateLabelMap: Record<HarmonizedPurchaseState, string> = {
  [HarmonizedPurchaseState.ENTITLED]: "Entitled",
  [HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT]: "Pending acknowledgment",
  [HarmonizedPurchaseState.PENDING]: "Pending",
  [HarmonizedPurchaseState.CANCELED]: "Canceled",
  [HarmonizedPurchaseState.EXPIRED]: "Expired",
  [HarmonizedPurchaseState.READY_TO_CONSUME]: "Ready to consume",
  [HarmonizedPurchaseState.CONSUMED]: "Consumed",
  [HarmonizedPurchaseState.UNKNOWN]: "Unknown",
  [HarmonizedPurchaseState.INAUTHENTIC]: "Inauthentic",
};

const stateVariantMap: Record<HarmonizedPurchaseState, BadgeVariant> = {
  [HarmonizedPurchaseState.ENTITLED]: "success",
  [HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT]: "warning",
  [HarmonizedPurchaseState.PENDING]: "warning",
  [HarmonizedPurchaseState.CANCELED]: "danger",
  [HarmonizedPurchaseState.EXPIRED]: "danger",
  [HarmonizedPurchaseState.READY_TO_CONSUME]: "primary",
  [HarmonizedPurchaseState.CONSUMED]: "secondary",
  [HarmonizedPurchaseState.UNKNOWN]: "outline",
  [HarmonizedPurchaseState.INAUTHENTIC]: "danger",
};

export function getPurchaseStateDisplay(
  state?: HarmonizedPurchaseState | null,
): { label: string; variant: BadgeVariant } {
  const normalized = state ?? HarmonizedPurchaseState.UNKNOWN;
  return {
    label: stateLabelMap[normalized] ?? "Unknown",
    variant: stateVariantMap[normalized] ?? "outline",
  };
}
