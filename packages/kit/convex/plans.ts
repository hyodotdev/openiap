import { v } from "convex/values";

/**
 * IAPKit is free-for-everyone with no monthly cap. Abuse protection
 * lives at the edge (format validation, replay-guard, per-key burst
 * limit in `server/api/v1/`) — not as a monthly hard stop, so
 * legitimate high-volume apps are never blocked for being successful.
 *
 * `monthlyRequestCount` on organizations stays for dashboard display
 * and informal telemetry. `monthlyRequestLimit` is kept as a soft
 * display / sponsor-CTA threshold (default shown below) — the
 * verification path never consults it.
 */
export const SPONSOR_CTA_THRESHOLD = 25_000;

/**
 * Subscription plan enum kept for backwards compatibility with existing
 * org records. All three tiers are free post-2026-05; limits are for
 * display only.
 */
export const SUBSCRIPTION_PLANS = {
  developer: {
    id: "developer" as const,
    label: "Developer",
    description: "Free for all developers",
    monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
    requiresPayment: false,
  },
  pro: {
    id: "pro" as const,
    label: "Pro",
    description: "Legacy tier — free",
    monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
    requiresPayment: false,
  },
  enterprise: {
    id: "enterprise" as const,
    label: "Enterprise",
    description: "Legacy tier — free",
    monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
    requiresPayment: false,
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export const subscriptionPlanValidator = v.union(
  v.literal("developer"),
  v.literal("pro"),
  v.literal("enterprise"),
);

export function getMonthlyRequestLimit(plan: SubscriptionPlanId): number {
  return SUBSCRIPTION_PLANS[plan].monthlyRequestLimit;
}

export function ensurePlanId(plan: string): SubscriptionPlanId {
  if (plan in SUBSCRIPTION_PLANS) {
    return plan as SubscriptionPlanId;
  }
  throw new Error(`Unsupported subscription plan: ${plan}`);
}
