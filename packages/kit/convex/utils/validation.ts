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

export const dataProvenanceValidator = v.union(
  v.literal("store"),
  v.literal("catalog"),
  v.literal("inferred"),
);

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
