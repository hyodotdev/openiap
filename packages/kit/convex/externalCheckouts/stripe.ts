"use node";

import { createHmac, timingSafeEqual } from "node:crypto";
import * as v from "valibot";
import type { Doc } from "../_generated/dataModel";
import type { Integration } from "./config";
import {
  disputePrefixes,
  fail,
  paymentEvents,
  total,
  validPrice,
  type PaymentFact,
  type RefundFact,
} from "./model";

type Checkout = Doc<"externalCheckouts">;
const str = v.string();
const num = v.number();
const bool = v.boolean();
const nullableId = v.nullish(str);
const metadata = v.optional(v.record(str, str));

const intentSchema = v.object({
  id: str,
  status: str,
  livemode: bool,
  currency: str,
  amount_received: num,
  latest_charge: nullableId,
  metadata,
  invoice: nullableId,
});
const chargeSchema = v.object({
  id: str,
  status: str,
  captured: bool,
  paid: bool,
  livemode: bool,
  amount_captured: num,
  amount_refunded: num,
  disputed: bool,
  currency: str,
  payment_intent: nullableId,
  created: num,
});
const invoiceSchema = v.object({
  id: str,
  status: v.nullable(str),
  livemode: bool,
  currency: str,
  amount_paid: num,
  total: num,
  tax: v.nullable(num),
  payment_intent: nullableId,
  paid_out_of_band: bool,
  billing_reason: v.nullable(str),
  subscription: nullableId,
  status_transitions: v.object({ paid_at: v.nullable(num) }),
  subscription_details: v.nullish(
    v.object({ metadata: v.nullable(v.record(str, str)) }),
  ),
  lines: v.object({
    has_more: bool,
    data: v.array(
      v.object({
        type: str,
        proration: bool,
        quantity: v.nullable(num),
        period: v.object({ start: num, end: num }),
      }),
    ),
  }),
});
const refundSchema = v.object({
  id: str,
  status: v.nullable(str),
  charge: nullableId,
  amount: num,
  currency: str,
  created: num,
});
const disputeSchema = v.object({
  id: str,
  status: str,
  livemode: bool,
  charge: nullableId,
  amount: num,
  currency: str,
  created: num,
});
// The event's own object follows the endpoint's API version, so only stable
// fields are read from it; everything else is fetched at the pinned version.
const eventSchema = v.object({
  id: str,
  type: str,
  livemode: bool,
  account: v.optional(str),
  data: v.object({
    object: v.object({
      id: str,
      charge: v.optional(v.unknown()),
      metadata: v.optional(v.unknown()),
    }),
  }),
});

const eventPrefixes: Readonly<Record<string, readonly string[]>> = {
  "payment_intent.succeeded": ["pi_"],
  "invoice.paid": ["in_"],
  "refund.created": ["re_"],
  "refund.updated": ["re_"],
  "charge.refund.updated": ["re_"],
  "charge.dispute.closed": disputePrefixes,
};
const text = (value: unknown) =>
  typeof value === "string" ? value : undefined;

// A checkout's PaymentIntent or Subscription carries these three keys.
const checkoutBinding = v.object({ orderId: str, userId: str, productId: str });

// Stripe metadata binds a payment to its checkout. An erased user's ID is
// gone, so the order and product still bind it, and IAPKit records and
// reports it without granting access.
export function bindsCheckout(
  metadata: Readonly<Record<string, string>> | null | undefined,
  checkout: Checkout,
): boolean {
  return (
    metadata?.orderId === checkout.orderId &&
    metadata.productId === checkout.productId &&
    (checkout.userId === undefined || metadata.userId === checkout.userId)
  );
}

export class ExternalJobError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = true,
  ) {
    super(code);
  }
}

export async function request(url: string, options: RequestInit) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ExternalJobError("PROVIDER_UNREACHABLE");
  }
}

export function stripeEvent(
  raw: string,
  signature: string,
  integration: Integration,
  now = Date.now(),
) {
  const fields = signature.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = fields.find(([key]) => key === "t")?.[1] ?? "";
  if (
    !/^\d{1,12}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp) * 1000) > 300_000
  )
    fail("INVALID_SIGNATURE", "Stripe signature is invalid");
  const digest = createHmac("sha256", integration.signingSecret)
    .update(`${timestamp}.${raw}`)
    .digest();
  if (
    !fields.some(
      ([key, value]) =>
        key === "v1" &&
        /^[a-f0-9]{64}$/i.test(value ?? "") &&
        timingSafeEqual(digest, Buffer.from(value, "hex")),
    )
  )
    fail("INVALID_SIGNATURE", "Stripe signature is invalid");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    fail("INVALID_INPUT", "Stripe event is invalid");
  }
  const parsed = v.safeParse(eventSchema, data);
  if (!parsed.success) fail("INVALID_INPUT", "Stripe event is invalid");
  const event = parsed.output;
  if (
    event.livemode !== (integration.environment === "production") ||
    (event.account !== undefined && event.account !== integration.accountId)
  )
    fail("INVALID_INPUT", "Stripe event does not match this integration");
  const prefixes = eventPrefixes[event.type];
  if (!prefixes) return null;
  const object = event.data.object;
  if (
    !stripeId(event.id, "evt_") ||
    !prefixes.some((prefix) => stripeId(object.id, prefix))
  )
    fail("INVALID_INPUT", "Stripe event identifiers are invalid");
  return {
    eventId: event.id,
    event: event.type,
    reference: object.id,
    // A refund or dispute names its charge.
    charge: paymentEvents[event.type] ? undefined : text(object.charge),
    bound: v.is(checkoutBinding, object.metadata),
  };
}

export function stripeId(value: string, prefix: string): boolean {
  return (
    value.startsWith(prefix) &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_]+$/.test(value) &&
    value.length > prefix.length
  );
}

export class Stripe {
  constructor(private readonly integration: Integration) {}

  private async get<T extends v.GenericSchema>(
    path: string,
    schema: T,
  ): Promise<v.InferOutput<T>> {
    const response = await request(`https://api.stripe.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${this.integration.apiKey}`,
        "Stripe-Version": "2024-10-28.acacia",
      },
    });
    if (!response.ok)
      throw new ExternalJobError(
        `STRIPE_HTTP_${response.status}`,
        response.status === 404 ||
          response.status === 429 ||
          response.status >= 500,
      );
    const parsed = v.safeParse(schema, await response.json());
    if (!parsed.success)
      throw new ExternalJobError("STRIPE_RESPONSE_INVALID", false);
    return parsed.output;
  }

  async verifyAccount() {
    const account = await this.get("account", v.object({ id: str }));
    if (account.id !== this.integration.accountId)
      throw new ExternalJobError("STRIPE_ACCOUNT_MISMATCH", false);
  }

  private checkMode(livemode: boolean) {
    if (livemode !== (this.integration.environment === "production"))
      throw new ExternalJobError("STRIPE_ENVIRONMENT_MISMATCH", false);
  }

  invoice(id: string) {
    return this.get(`invoices/${encodeURIComponent(id)}`, invoiceSchema);
  }

  private async verifiedCharge(intentId: string, invoiceId?: string) {
    const intent = await this.get(
      `payment_intents/${encodeURIComponent(intentId)}`,
      intentSchema,
    );
    this.checkMode(intent.livemode);
    if (intent.status !== "succeeded" || !intent.latest_charge)
      throw new ExternalJobError(
        "STRIPE_PAYMENT_PENDING",
        !["canceled"].includes(intent.status),
      );
    if (intent.id !== intentId || (intent.invoice ?? undefined) !== invoiceId)
      throw new ExternalJobError("STRIPE_PAYMENT_REFERENCE_MISMATCH", false);
    const charge = await this.get(
      `charges/${encodeURIComponent(intent.latest_charge)}`,
      chargeSchema,
    );
    this.checkMode(charge.livemode);
    if (
      !charge.captured ||
      !charge.paid ||
      charge.status !== "succeeded" ||
      charge.payment_intent !== intent.id ||
      charge.id !== intent.latest_charge ||
      charge.currency !== intent.currency ||
      charge.amount_captured !== intent.amount_received
    )
      throw new ExternalJobError("STRIPE_CHARGE_MISMATCH", false);
    return { charge, intent };
  }

  async payment(
    checkout: Checkout,
    invoice?: v.InferOutput<typeof invoiceSchema>,
  ): Promise<{ fact: PaymentFact; refunds: RefundFact[] }> {
    if (checkout.payment.kind === "invoice" && !invoice)
      invoice = await this.invoice(checkout.payment.reference);
    const initial = !invoice || invoice.id === checkout.payment.reference;
    // A plan change starts its checkout with an invoice that bills the new
    // plan at once or at the next renewal.
    const change = initial && !!checkout.previousCheckoutId;
    // The customer's credit balance can pay a whole bill, and a free trial or
    // a downgrade's credit leaves nothing to pay.
    const charged = !invoice || invoice.amount_paid > 0;
    if (invoice) {
      this.checkMode(invoice.livemode);
      if (invoice.status !== "paid")
        throw new ExternalJobError("STRIPE_PAYMENT_PENDING");
      const reasons = change
        ? ["subscription_update", "subscription_cycle"]
        : [initial ? "subscription_create" : "subscription_cycle"];
      if (
        invoice.paid_out_of_band ||
        (charged && !invoice.payment_intent) ||
        !invoice.subscription ||
        // Only a downgrade credits more than it bills.
        (invoice.total < 0 && !change) ||
        !reasons.includes(invoice.billing_reason ?? "")
      )
        throw new ExternalJobError("STRIPE_INVOICE_UNSUPPORTED", false);
    }
    const paid = charged
      ? await this.verifiedCharge(
          invoice?.payment_intent ?? checkout.payment.reference,
          invoice?.id,
        )
      : undefined;
    const paidAt = invoice
      ? invoice.status_transitions.paid_at
      : paid?.charge.created;
    if (!paidAt)
      throw new ExternalJobError("STRIPE_INVOICE_UNSUPPORTED", false);
    if (
      initial &&
      !bindsCheckout(
        invoice
          ? invoice.subscription_details?.metadata
          : paid?.intent.metadata,
        checkout,
      )
    )
      throw new ExternalJobError("STRIPE_CHECKOUT_BINDING_MISMATCH", false);
    if (!initial && invoice?.subscription !== checkout.subscriptionId)
      throw new ExternalJobError("STRIPE_SUBSCRIPTION_MISMATCH", false);
    const expected = checkout.price;
    // The checkout registers what the invoice bills, and a downgrade's credit
    // bills nothing.
    const billedTax = invoice && invoice.total > 0 ? (invoice.tax ?? 0) : 0;
    const bill = invoice
      ? {
          ...expected,
          currency: invoice.currency.toUpperCase(),
          taxMinor: billedTax,
          netMinor: Math.max(invoice.total, 0) - billedTax,
        }
      : expected;
    // The credit balance paid the rest of the bill; tax splits in proportion.
    const amount = invoice ? invoice.amount_paid : total(bill);
    const taxMinor =
      amount === total(bill)
        ? bill.taxMinor
        : Math.round((bill.taxMinor * amount) / total(bill));
    const price = { ...bill, taxMinor, netMinor: amount - taxMinor };
    if (
      !validPrice(bill, !!invoice) ||
      bill.currency !== expected.currency ||
      amount > total(bill) ||
      (paid &&
        (paid.charge.currency.toUpperCase() !== expected.currency ||
          amount !== paid.charge.amount_captured)) ||
      (initial &&
        (bill.netMinor !== expected.netMinor ||
          bill.taxMinor !== expected.taxMinor))
    )
      throw new ExternalJobError("STRIPE_AMOUNT_MISMATCH", false);

    let subscription: PaymentFact["subscription"];
    if (invoice) {
      const lines = invoice.lines.data;
      // A plan change credits the old plan's unused time and charges the new
      // plan in proration items or a new period; the new plan's line runs
      // latest.
      const line = lines.reduce<(typeof lines)[number] | undefined>(
        (latest, item) =>
          latest && latest.period.end >= item.period.end ? latest : item,
        undefined,
      );
      if (
        !invoice.subscription ||
        invoice.lines.has_more ||
        !line ||
        lines.length > (change ? 2 : 1) ||
        lines.some(
          (item) =>
            item.quantity !== 1 ||
            (change
              ? !item.proration && item.type !== "subscription"
              : item.proration || item.type !== "subscription"),
        ) ||
        line.period.end <= line.period.start
      )
        throw new ExternalJobError("STRIPE_INVOICE_UNSUPPORTED", false);
      subscription = {
        id: invoice.subscription,
        start: line.period.start * 1000,
        end: line.period.end * 1000,
        billed: invoice.total > 0,
      };
    }
    return {
      fact: {
        reference: invoice?.id ?? checkout.payment.reference,
        chargeId: paid?.charge.id,
        price,
        subscription,
        paidAt: paidAt * 1000,
      },
      refunds: paid ? await this.chargeRefunds(paid.charge) : [],
    };
  }

  // Succeeded refunds and lost disputes already on the charge, oldest first.
  private async chargeRefunds(charge: v.InferOutput<typeof chargeSchema>) {
    const refunds: RefundFact[] = [];
    if (charge.amount_refunded > 0) {
      const query = new URLSearchParams({ charge: charge.id, limit: "100" });
      for (let pageNumber = 0; ; pageNumber++) {
        const page = await this.get(
          `refunds?${query}`,
          v.object({ data: v.array(refundSchema), has_more: bool }),
        );
        for (const refund of page.data) {
          if (refund.status === "succeeded")
            refunds.push(this.refundFact(refund, refund.id, charge.id));
        }
        if (!page.has_more) break;
        const last = page.data[page.data.length - 1]?.id;
        if (!last || pageNumber === 2 || refunds.length >= 100)
          throw new ExternalJobError(
            "STRIPE_REFUND_HISTORY_UNSUPPORTED",
            false,
          );
        query.set("starting_after", last);
      }
    }
    if (charge.disputed) {
      const page = await this.get(
        `disputes?${new URLSearchParams({ charge: charge.id, limit: "100" })}`,
        v.object({ data: v.array(disputeSchema), has_more: bool }),
      );
      if (page.has_more)
        throw new ExternalJobError("STRIPE_DISPUTE_HISTORY_UNSUPPORTED", false);
      for (const dispute of page.data) {
        const fact = this.disputeFact(dispute, dispute.id, charge.id);
        if (fact) refunds.push(fact);
      }
    }
    return refunds.sort(
      (a, b) => a.at - b.at || a.reference.localeCompare(b.reference),
    );
  }

  private refundFact(
    refund: v.InferOutput<typeof refundSchema>,
    id: string,
    chargeId = refund.charge,
  ): RefundFact {
    if (
      refund.id !== id ||
      !refund.charge ||
      refund.charge !== chargeId ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount <= 0
    )
      throw new ExternalJobError("STRIPE_REFUND_INVALID", false);
    return {
      reference: id,
      chargeId: refund.charge,
      amount: refund.amount,
      currency: refund.currency.toUpperCase(),
      at: refund.created * 1000,
    };
  }

  // A lost dispute returns the disputed amount to the customer, so IAPKit
  // records it as a refund; other outcomes leave the payment as it is.
  private disputeFact(
    dispute: v.InferOutput<typeof disputeSchema>,
    id: string,
    chargeId = dispute.charge,
  ): RefundFact | null {
    this.checkMode(dispute.livemode);
    if (dispute.status !== "lost") return null;
    if (
      dispute.id !== id ||
      !dispute.charge ||
      dispute.charge !== chargeId ||
      !Number.isSafeInteger(dispute.amount) ||
      dispute.amount <= 0
    )
      throw new ExternalJobError("STRIPE_DISPUTE_INVALID", false);
    return {
      reference: id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      currency: dispute.currency.toUpperCase(),
      at: dispute.created * 1000,
    };
  }

  async dispute(id: string): Promise<RefundFact | null> {
    return this.disputeFact(
      await this.get(`disputes/${encodeURIComponent(id)}`, disputeSchema),
      id,
    );
  }

  async refund(id: string): Promise<RefundFact | null> {
    const refund = await this.get(
      `refunds/${encodeURIComponent(id)}`,
      refundSchema,
    );
    if (refund.status === "failed" || refund.status === "canceled") return null;
    if (refund.status !== "succeeded")
      throw new ExternalJobError("STRIPE_REFUND_PENDING");
    return this.refundFact(refund, id);
  }
}
