import { defineTable } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { verificationJobCiphertext } from "../purchases/verificationJobModel";

export const price = v.object({
  currency: v.string(),
  netMinor: v.number(),
  taxMinor: v.number(),
  regionCode: v.string(),
});
export const payment = v.object({
  provider: v.literal("stripe"),
  kind: v.union(v.literal("payment_intent"), v.literal("invoice")),
  reference: v.string(),
});
export const reporting = v.union(
  v.object({
    store: v.literal("apple"),
    profileId: v.string(),
    tokenIds: v.array(v.string()),
  }),
  v.object({
    store: v.literal("google"),
    profileId: v.string(),
    externalTransactionToken: v.string(),
  }),
);
export const checkoutInput = v.object({
  orderId: v.string(),
  userId: v.string(),
  productId: v.string(),
  payment,
  price,
  reporting,
  // The checkout whose subscription this one changes to a new plan.
  changeOf: v.optional(v.string()),
});
export const paymentFact = v.object({
  reference: v.string(),
  // Nothing is charged for a free trial or a bill the credit balance pays.
  chargeId: v.optional(v.string()),
  price,
  paidAt: v.number(),
  subscription: v.optional(
    v.object({
      id: v.string(),
      start: v.number(),
      end: v.number(),
      // A free trial bills nothing, so its days aren't paid service.
      billed: v.boolean(),
    }),
  ),
});
export const refundFact = v.object({
  reference: v.string(),
  chargeId: v.string(),
  amount: v.number(),
  currency: v.string(),
  at: v.number(),
});
export type CheckoutInput = Infer<typeof checkoutInput>;
export type PaymentFact = Infer<typeof paymentFact>;
export type RefundFact = Infer<typeof refundFact>;

export const disputePrefixes = ["du_", "dp_"] as const;

// Stripe events that carry a payment, and the checkout payment kind they verify.
export const paymentEvents: Readonly<
  Partial<Record<string, Infer<typeof payment>["kind"]>>
> = { "payment_intent.succeeded": "payment_intent", "invoice.paid": "invoice" };

export const task = v.union(
  v.object({
    kind: v.literal("verify"),
    checkoutId: v.id("externalCheckouts"),
  }),
  v.object({
    kind: v.literal("stripe"),
    integrationId: v.string(),
    event: v.string(),
    reference: v.string(),
    charge: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("purchase"),
    paymentId: v.id("externalCheckoutPayments"),
  }),
  v.object({
    kind: v.literal("refund"),
    paymentId: v.id("externalCheckoutPayments"),
    refund: refundFact,
    netMinor: v.number(),
    taxMinor: v.number(),
    full: v.boolean(),
    before: v.number(),
    refundedNet: v.number(),
  }),
  v.object({
    kind: v.literal("appleToken"),
    tokenId: v.id("externalPurchaseTokens"),
  }),
);
export const externalTables = {
  externalCheckouts: defineTable({
    projectId: v.id("projects"),
    integrationId: v.string(),
    profileId: v.string(),
    store: v.union(v.literal("apple"), v.literal("google")),
    orderId: v.string(),
    userId: v.optional(v.string()),
    productId: v.string(),
    payment,
    price,
    appleTokenIds: v.optional(v.array(v.id("externalPurchaseTokens"))),
    googleToken: v.optional(verificationJobCiphertext),
    googleTokenHash: v.optional(v.string()),
    requestHash: v.string(),
    subscriptionId: v.optional(v.string()),
    // A plan change links the checkouts of one subscription.
    previousCheckoutId: v.optional(v.id("externalCheckouts")),
    replacedBy: v.optional(v.id("externalCheckouts")),
    initialPaymentId: v.optional(v.id("externalCheckoutPayments")),
    latestPaidAt: v.optional(v.number()),
    latestPaymentId: v.optional(v.id("externalCheckoutPayments")),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("partially_refunded"),
      v.literal("refunded"),
      v.literal("action_required"),
    ),
    reportingStatus: v.union(
      v.literal("pending"),
      v.literal("queued"),
      v.literal("retrying"),
      v.literal("reported"),
      v.literal("action_required"),
    ),
    active: v.boolean(),
    expiresAt: v.optional(v.number()),
    pendingReports: v.number(),
    retryingReports: v.number(),
    failedReports: v.number(),
    // Paid invoices left for a manual report; a late plan change claims one.
    missedInvoices: v.optional(v.array(v.string())),
  })
    .index("by_project", ["projectId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_project_order", ["projectId", "orderId"])
    .index("by_integration_payment", [
      "integrationId",
      "payment.kind",
      "payment.reference",
    ])
    .index("by_integration_subscription", ["integrationId", "subscriptionId"])
    .index("by_project_token", ["projectId", "googleTokenHash"]),
  externalCheckoutKeys: defineTable({
    projectId: v.id("projects"),
    key: v.string(),
    requestHash: v.string(),
    checkoutId: v.id("externalCheckouts"),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "key"]),
  externalPurchaseTokens: defineTable({
    projectId: v.id("projects"),
    profileId: v.string(),
    userId: v.optional(v.string()),
    externalId: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    tokenType: v.optional(v.string()),
    duplicate: v.boolean(),
    used: v.boolean(),
    accountErased: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_project_external", ["projectId", "externalId"])
    .index("by_period", [
      "projectId",
      "profileId",
      "userId",
      "createdAt",
      "tokenType",
    ]),
  externalCheckoutPayments: defineTable({
    projectId: v.id("projects"),
    checkoutId: v.id("externalCheckouts"),
    integrationId: v.string(),
    fact: paymentFact,
    refunded: v.number(),
    refundedNet: v.number(),
    appleTokenId: v.optional(v.id("externalPurchaseTokens")),
    // Paid subscription days before this period, which Apple reports.
    daysOfPaidService: v.optional(v.number()),
    reported: v.boolean(),
    reportedRefunded: v.number(),
    expiresAt: v.optional(v.number()),
    fullyRefunded: v.boolean(),
  })
    .index("by_project", ["projectId"])
    .index("by_checkout_expiry", ["checkoutId", "fullyRefunded", "expiresAt"])
    .index("by_integration_charge", ["integrationId", "fact.chargeId"])
    .index("by_integration_reference", ["integrationId", "fact.reference"]),
  externalCheckoutRefunds: defineTable({
    projectId: v.id("projects"),
    integrationId: v.string(),
    reference: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_reference", ["integrationId", "reference"]),
  externalCheckoutJobs: defineTable({
    projectId: v.id("projects"),
    key: v.string(),
    task,
    attempts: v.number(),
    dueAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    // The checkout a Stripe payment event resolved to.
    checkoutId: v.optional(v.id("externalCheckouts")),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "key"])
    .index("by_due", ["dueAt"]),
};

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function total(value: Infer<typeof price>): number {
  return value.netMinor + value.taxMinor;
}

// Restrict reporting to currencies with compatible Stripe and ISO minor units.
export const minorDigits: Readonly<Record<string, number>> = {
  BRL: 2,
  CAD: 2,
  CHF: 2,
  CZK: 2,
  DKK: 2,
  EUR: 2,
  GBP: 2,
  HUF: 2,
  IDR: 2,
  ILS: 2,
  INR: 2,
  JPY: 0,
  KRW: 0,
  MXN: 2,
  NOK: 2,
  PLN: 2,
  RON: 2,
  SEK: 2,
  USD: 2,
};

export function validPrice(
  value: Infer<typeof price>,
  canBeFree = false,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(minorDigits, value.currency) &&
    /^[A-Z]{2}$/.test(value.regionCode) &&
    [value.netMinor, value.taxMinor].every(
      (amount) => Number.isSafeInteger(amount) && amount >= 0,
    ) &&
    (canBeFree ? total(value) >= 0 : total(value) > 0) &&
    total(value) <= 999999999
  );
}
