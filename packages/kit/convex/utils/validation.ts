import { v } from "convex/values";

export const subscriptionStateValidator = v.union(
  v.literal("Active"),
  v.literal("InGracePeriod"),
  v.literal("InBillingRetry"),
  v.literal("Expired"),
  v.literal("Revoked"),
  v.literal("Refunded"),
  v.literal("Paused"),
  v.literal("Unknown"),
);

export const cancellationReasonValidator = v.union(
  v.literal("UserCanceled"),
  v.literal("BillingError"),
  v.literal("PriceIncreaseDeclined"),
  v.literal("ProductUnavailable"),
  v.literal("Refunded"),
  v.literal("Other"),
);

export const dataProvenanceValidator = v.union(
  v.literal("store"),
  v.literal("catalog"),
  v.literal("inferred"),
);

// Failures that carry no HTTP status. Never a message or a body.
export const deliveryErrorClassValidator = v.union(
  v.literal("timeout"),
  v.literal("dns"),
  v.literal("connection_refused"),
  v.literal("connection_reset"),
  v.literal("tls"),
  v.literal("non_public_address"),
  v.literal("destination_rejected"),
  v.literal("network"),
);

export const deliveryAttemptValidator = v.object({
  at: v.number(),
  outcome: v.union(
    v.literal("delivered"),
    v.literal("retrying"),
    v.literal("failed"),
  ),
  statusCode: v.optional(v.number()),
  latencyMs: v.optional(v.number()),
  errorClass: v.optional(deliveryErrorClassValidator),
});

export const userSchema = {
  email: v.string(),
  name: v.string(),
  role: v.union(v.literal("admin"), v.literal("user")),
};

export const appSchema = {
  name: v.string(),
  description: v.optional(v.string()),
  apiKey: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("error"),
  ),
};
