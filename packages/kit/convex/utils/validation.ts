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
