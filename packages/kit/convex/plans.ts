import { v } from "convex/values";

/**
 * IAPKit is free for everyone with no monthly cap: monthly counts never block
 * a request. Abuse protection is the fair-use edge in `server/api/v1/`
 * (format validation, replay guard, per-key burst and concurrency limits),
 * which may throttle any plan to protect the shared service.
 *
 * Organizations keep `monthlyRequestCount` for the dashboard and informal
 * telemetry, and `monthlyRequestLimit` as this display-only sponsor-CTA
 * threshold; the verification path never reads it.
 */
export const SPONSOR_CTA_THRESHOLD = 25_000;

// Stored on existing organizations; every tier is free.
export const subscriptionPlanValidator = v.union(
  v.literal("developer"),
  v.literal("pro"),
  v.literal("enterprise"),
);
