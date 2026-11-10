import { describe, expect, it } from "vitest";
import {
  LEGACY_BILLING_FIELDS,
  legacyBillingFieldsPatch,
} from "./legacyBilling";

describe("legacyBillingFieldsPatch", () => {
  // The migrations component applies the patch with db.patch, so only an
  // explicit `field: undefined` removes a field. Assert on key presence.
  it("removes every legacy billing field the row carries", () => {
    const patch = legacyBillingFieldsPatch({
      stripeCustomerId: "cus_1",
      stripeSubscriptionStatus: "active",
      defaultPaymentMethodLast4: "4242",
      billingEmail: "owner@example.com",
      taxId: null,
    });
    expect(patch).not.toBeNull();
    expect(Object.keys(patch!).sort()).toEqual(
      [
        "billingEmail",
        "defaultPaymentMethodLast4",
        "stripeCustomerId",
        "stripeSubscriptionStatus",
        "taxId",
      ].sort(),
    );
    for (const value of Object.values(patch!)) expect(value).toBeUndefined();
  });

  it("covers all nineteen fields", () => {
    const row = Object.fromEntries(
      LEGACY_BILLING_FIELDS.map((field) => [field, "x"]),
    );
    expect(Object.keys(legacyBillingFieldsPatch(row)!)).toHaveLength(19);
  });

  it("leaves a clean row and its other fields alone", () => {
    expect(
      legacyBillingFieldsPatch({
        name: "Acme",
        subscriptionTier: "developer",
        monthlyRequestLimit: 1000,
      }),
    ).toBeNull();
  });
});
