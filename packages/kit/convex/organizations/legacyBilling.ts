import type { Doc } from "../_generated/dataModel";

// Organization fields left from the retired Stripe billing integration.
export const LEGACY_BILLING_FIELDS = [
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripePriceId",
  "stripeBaseSubscriptionItemId",
  "stripeMeteredSubscriptionItemId",
  "stripeSubscriptionStatus",
  "stripeCancelAtPeriodEnd",
  "stripeCurrentPeriodEnd",
  "stripeTrialEnd",
  "stripeCanceledAt",
  "stripeTaxIdId",
  "defaultPaymentMethodId",
  "defaultPaymentMethodBrand",
  "defaultPaymentMethodLast4",
  "defaultPaymentMethodExpMonth",
  "defaultPaymentMethodExpYear",
  "billingEmail",
  "taxId",
  "taxIdType",
] as const satisfies readonly (keyof Doc<"organizations">)[];

type LegacyBillingField = (typeof LEGACY_BILLING_FIELDS)[number];

/**
 * The migration patch that removes every legacy billing field the row
 * carries, or null when it carries none. The migrations component applies it
 * with db.patch, so each field must be present with the value `undefined`.
 */
export function legacyBillingFieldsPatch(
  doc: object,
): Partial<Record<LegacyBillingField, undefined>> | null {
  const present = LEGACY_BILLING_FIELDS.filter((field) => field in doc);
  if (present.length === 0) return null;
  return Object.fromEntries(present.map((field) => [field, undefined]));
}
