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
    description: "Purchase not found in the upstream store.",
  },
] as const;

const unifiedPurchaseStateSchema = v.union(
  unifiedPurchaseStates.map(({ name, description }) =>
    v.pipe(v.literal(name), v.description(description)),
  ),
);

const verifyStoreSchema = v.union([
  v.literal("apple"),
  v.literal("google"),
  v.literal("horizon"),
  v.literal("amazon"),
]);

const baseReceiptResponseSchema = v.object({
  store: verifyStoreSchema,
  isValid: v.boolean(),
  state: unifiedPurchaseStateSchema,
  productId: v.optional(
    v.pipe(
      v.string(),
      v.description(
        "Product id verified by the upstream store. For Meta Horizon this is the SKU IAPKit checked.",
      ),
    ),
  ),
});

export const verifyPurchaseSuccessResponseSchema = v.pipe(
  baseReceiptResponseSchema,
  v.title("Unified purchase verification result"),
);
