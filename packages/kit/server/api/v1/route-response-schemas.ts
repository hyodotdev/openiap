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
      "Consumable purchase is ready to be fulfilled. Reported for App Store and Amazon consumables, and for Google Play purchases the project catalog identifies as consumable. Reflects the state at verification time, not later consumption.",
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

export const unifiedPurchaseStateSchema = v.union(
  unifiedPurchaseStates.map(({ name, description }) =>
    v.pipe(v.literal(name), v.description(description)),
  ),
);

// Degraded state for a value outside the published enum. `isValid` is never
// rewritten — metadata drift must not revoke a real entitlement.
export const FALLBACK_PURCHASE_STATE = "UNKNOWN";

const verifyStoreSchema = v.union([
  v.literal("apple"),
  v.literal("google"),
  v.literal("horizon"),
  v.literal("amazon"),
]);

export const clientPayloadSchema = v.object({
  format: v.union([v.literal("toml"), v.literal("json"), v.literal("text")]),
  body: v.string(),
  version: v.number(),
  updatedAt: v.number(),
});

export const productIdSchema = v.pipe(
  v.string(),
  v.description(
    "Product id verified by the upstream store. For Meta Horizon this is the SKU IAPKit checked.",
  ),
);

export const environmentSchema = v.pipe(
  v.union([v.literal("Sandbox"), v.literal("Production")]),
  v.description(
    "Amazon RVS environment selected by IAPKit. Present on handled Amazon verification results.",
  ),
);

const baseReceiptResponseSchema = v.object({
  store: verifyStoreSchema,
  isValid: v.boolean(),
  state: unifiedPurchaseStateSchema,
  productId: v.optional(productIdSchema),
  environment: v.optional(environmentSchema),
  clientPayload: v.optional(
    v.pipe(
      clientPayloadSchema,
      v.description(
        "Project-managed client metadata. Returned only when explicitly requested and available for a verified Apple or Google product.",
      ),
    ),
  ),
});

export const verifyPurchaseSuccessResponseSchema = v.pipe(
  baseReceiptResponseSchema,
  v.title("Unified purchase verification result"),
);
