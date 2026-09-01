import * as v from "valibot";

export const apiErrorResponseSchemaV2 = v.object({
  errors: v.array(
    v.object({
      code: v.string(),
      message: v.string(),
    }),
  ),
});

const subscriptionStateSchema = v.union([
  v.literal("Active"),
  v.literal("InGracePeriod"),
  v.literal("InBillingRetry"),
  v.literal("Expired"),
  v.literal("Revoked"),
  v.literal("Refunded"),
  v.literal("Paused"),
  v.literal("Unknown"),
]);

export const subscriptionV2Schema = v.object({
  id: v.string(),
  productId: v.string(),
  platform: v.union([v.literal("IOS"), v.literal("Android")]),
  state: subscriptionStateSchema,
  expiresAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  cancellationReason: v.optional(v.string()),
  currency: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
  startedAt: v.number(),
  updatedAt: v.number(),
  userId: v.optional(v.string()),
});

export const subscriptionStatusResponseSchemaV2 = v.object({
  active: v.boolean(),
  subscription: v.union([subscriptionV2Schema, v.null()]),
});

export const subscriptionEntitlementsResponseSchemaV2 = v.object({
  userId: v.string(),
  productIds: v.array(v.string()),
  subscriptions: v.array(subscriptionV2Schema),
});

const userErasureStatusSchema = v.union([
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
]);

export const userErasureAcceptedResponseSchemaV2 = v.object({
  ok: v.boolean(),
  jobId: v.string(),
  status: userErasureStatusSchema,
});

export const userErasureStatusResponseSchemaV2 = v.object({
  jobId: v.string(),
  status: userErasureStatusSchema,
  subscriptionsErased: v.number(),
  commerceEventsErased: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});
