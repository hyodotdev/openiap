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

// How a subscription's first paid charge began: after a free trial, or as a
// paid start with no trial.
export const paidStartValidator = v.union(
  v.literal("trial_conversion"),
  v.literal("direct"),
);

// A verified receipt's environment. Analytics use the same two values, with
// Xcode counted as Sandbox.
export const receiptEnvironmentValidator = v.union(
  v.literal("Sandbox"),
  v.literal("Production"),
);

// The environment a store notification or subscription reports.
export const storeEnvironmentValidator = v.union(
  v.literal("Production"),
  v.literal("Sandbox"),
  v.literal("Xcode"),
);

// The per-project admission buckets in convex/purchases/verificationAdmission.ts.
export const admissionBucketValidator = v.union(
  v.literal("verification"),
  v.literal("entitlementRecheck"),
  v.literal("storeResync"),
);

// Why a verification or link failed. Each value maps from an error or verdict
// IAPKit already produces; see convex/purchaseIssues/shared.ts.
export const purchaseIssueCauseValidator = v.union(
  v.literal("STORE_PENDING"),
  v.literal("STORE_UNAVAILABLE"),
  v.literal("RATE_LIMITED"),
  v.literal("INAUTHENTIC"),
  v.literal("PRODUCT_MISMATCH"),
  v.literal("APP_MISMATCH"),
  v.literal("MALFORMED_EVIDENCE"),
  v.literal("SANDBOX_NOT_ALLOWED"),
  v.literal("STORE_NOT_CONFIGURED"),
  v.literal("CREDENTIALS_MISSING"),
  v.literal("CREDENTIALS_REJECTED"),
  v.literal("VERIFICATION_FAILED"),
  v.literal("OWNERSHIP_CONFLICT"),
  v.literal("BIND_LIMIT_REACHED"),
);

// Bind outcome reported to secret-key callers only: a publishable key must not
// learn whether someone else owns a purchase.
export const bindReasonValidator = v.union(
  v.literal("bound"),
  v.literal("already_bound"),
  v.literal("bound_to_other_user"),
  v.literal("not_found"),
  v.literal("not_bindable"),
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
