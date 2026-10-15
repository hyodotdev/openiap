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

// How a subscription's first paid charge began: after a free trial, or as a
// paid start with no trial.
export const paidStartValidator = v.union(
  v.literal("trial_conversion"),
  v.literal("direct"),
);

// Analytics split production from everything else; Xcode joins Sandbox.
export const analyticsEnvironmentValidator = v.union(
  v.literal("Production"),
  v.literal("Sandbox"),
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
