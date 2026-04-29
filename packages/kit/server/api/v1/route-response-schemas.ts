import * as v from "valibot";

export const apiErrorResponseSchema = v.object({
  errors: v.array(
    v.object({
      code: v.string(),
      message: v.string(),
      path: v.optional(v.string()),
    }),
  ),
});

const unifiedPurchaseStates = [
  {
    name: "ENTITLED",
    description: "Purchase is complete and active.",
  },
  {
    name: "PENDING_ACKNOWLEDGMENT",
    description: "Receipt is valid but still needs server acknowledgment.",
  },
  {
    name: "PENDING",
    description: "Purchase is in progress or awaiting confirmation.",
  },
  {
    name: "CANCELED",
    description: "Purchase was cancelled or refunded.",
  },
  {
    name: "EXPIRED",
    description: "Subscription or entitlement has expired.",
  },
  {
    name: "READY_TO_CONSUME",
    description:
      "Consumable purchase is ready to be fulfilled. Note: This state is only applicable to App Store and does not reflect the actual consumable state of the item.",
  },
  {
    name: "CONSUMED",
    description:
      "Consumable item has been fulfilled/consumed. Note: This state is only applicable to Google Play.",
  },
  {
    name: "UNKNOWN",
    description: "Purchase state could not be determined.",
  },
  {
    name: "INAUTHENTIC",
    description: "Purchase not found in App Store / Google Play.",
  },
] as const;

const unifiedPurchaseStateSchema = v.union(
  unifiedPurchaseStates.map(({ name, description }) =>
    v.pipe(v.literal(name), v.description(description)),
  ),
);

const baseReceiptResponseSchema = v.object({
  isValid: v.boolean(),
  state: unifiedPurchaseStateSchema,
});

export const verifyPurchaseSuccessResponseSchema = v.pipe(
  baseReceiptResponseSchema,
  v.title("Unified purchase verification result"),
);
