// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { createHmac, generateKeyPairSync } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getAppStoreServerCredentials } from "./purchases/ios";
import { sha256Hex } from "./utils/sha256";
import { stripeEvent, Stripe } from "./externalCheckouts/stripe";
import {
  buildAppleReport,
  buildGooglePurchase,
  sendAppleReport,
  sendGoogleReport,
} from "./externalCheckouts/reporters";
import type { CheckoutInput } from "./externalCheckouts/model";
import type { Doc } from "./_generated/dataModel";

// Lets a test stand in for the project's App Store Connect key.
vi.mock("./purchases/ios", async (original) => {
  const actual = await original<typeof import("./purchases/ios")>();
  return {
    ...actual,
    getAppStoreServerCredentials: vi.fn(actual.getAppStoreServerCredentials),
  };
});

const modules = import.meta.glob("./**/*.ts");
const external = api.externalCheckouts.action;
const state = internal.externalCheckouts.state;
const week = 7 * 86_400_000;
const now = Date.UTC(2026, 10, 9);
const integration = {
  id: "stripe-test",
  accountId: "acct_test",
  projectId: "",
  environment: "sandbox" as const,
  apiKey: "rk_test_fixture",
  signingSecret: "whsec_fixture",
};
const profile = {
  id: "play-test",
  store: "google" as const,
  integrationId: integration.id,
  regions: ["DE"],
  appId: "dev.fixture",
};
const appleProfile = { ...profile, id: "apple-test", store: "apple" as const };
const input = {
  orderId: "order_1",
  userId: "user_1",
  productId: "monthly",
  payment: {
    provider: "stripe" as const,
    kind: "payment_intent" as const,
    reference: "pi_test",
  },
  price: { currency: "EUR", netMinor: 800, taxMinor: 200, regionCode: "DE" },
  reporting: {
    store: "google" as const,
    profileId: profile.id,
    externalTransactionToken: "opaque-google-token",
  },
};

// The fields Stripe puts on each event object that IAPKit reads.
function eventObject(type: string): Record<string, unknown> {
  if (type === "payment_intent.succeeded")
    return { metadata: paidIntent.metadata };
  if (type.includes("refund") || type.includes("dispute"))
    return { charge: "ch_test", payment_intent: "pi_test" };
  return {};
}

function event(
  type: string,
  reference: string,
  id: string,
  object = eventObject(type),
) {
  const raw = JSON.stringify({
    id,
    type,
    livemode: false,
    account: integration.accountId,
    data: { object: { id: reference, ...object } },
  });
  const t = Math.floor(Date.now() / 1000);
  const signature = `t=${t},v1=${createHmac("sha256", integration.signingSecret).update(`${t}.${raw}`).digest("hex")}`;
  return { raw, signature, integrationId: integration.id };
}

const paidCharge = {
  id: "ch_test",
  status: "succeeded",
  paid: true,
  captured: true,
  livemode: false,
  amount_captured: 1000,
  amount_refunded: 0,
  disputed: false,
  currency: "eur",
  payment_intent: "pi_test",
  created: now / 1000,
};
const paidIntent = {
  id: "pi_test",
  status: "succeeded",
  livemode: false,
  currency: "eur",
  amount_received: 1000,
  latest_charge: "ch_test",
  invoice: null,
  metadata: { orderId: "order_1", userId: "user_1", productId: "monthly" },
};
const refunds: Record<string, number> = { re_part: 250, re_rest: 750 };
// A paid single-item subscription invoice; a free one has no PaymentIntent.
function subscriptionInvoice(
  id: string,
  period: { start: number; end: number },
  {
    renewal = false,
    intent = "pi_test",
    total = 1000,
    tax = 200,
  }: {
    renewal?: boolean;
    intent?: string | null;
    total?: number;
    tax?: number;
  } = {},
) {
  return {
    id,
    status: "paid",
    livemode: false,
    currency: "eur",
    amount_paid: total,
    total,
    tax,
    payment_intent: intent,
    paid_out_of_band: false,
    subscription: "sub_test",
    billing_reason: renewal ? "subscription_cycle" : "subscription_create",
    subscription_details: { metadata: paidIntent.metadata },
    status_transitions: { paid_at: period.start },
    lines: {
      has_more: false,
      data: [{ type: "subscription", proration: false, quantity: 1, period }],
    },
  };
}

// The PaymentIntent and charge that pay an invoice.
function paidWith(
  intent: string,
  charge: string,
  invoice: string,
  created: number,
  amount = 1000,
) {
  return {
    [`/v1/payment_intents/${intent}`]: {
      ...paidIntent,
      id: intent,
      invoice,
      latest_charge: charge,
      amount_received: amount,
    },
    [`/v1/charges/${charge}`]: {
      ...paidCharge,
      id: charge,
      payment_intent: intent,
      amount_captured: amount,
      created,
    },
  };
}

function appleToken(externalPurchaseId: string, fields: object = {}) {
  return Buffer.from(
    JSON.stringify({
      externalPurchaseId,
      appAppleId: 12345,
      bundleId: "dev.fixture",
      tokenCreationDate: now - 1000,
      ...fields,
    }),
  ).toString("base64url");
}

// A subscription that starts on day 0 and upgrades on day 10 to a plan whose
// first cycle bills on day 31.
function planChange() {
  const day = 86_400;
  const start = now / 1000;
  const changeAt = start + 10 * day;
  const end = start + 31 * day;
  const nextEnd = end + 30 * day;
  const upgraded = {
    orderId: "order_2",
    userId: input.userId,
    productId: "yearly",
  };
  const prorated = { type: "invoiceitem", proration: true, quantity: 1 };
  const stripe = {
    "/v1/invoices/in_first": subscriptionInvoice("in_first", { start, end }),
    "/v1/payment_intents/pi_test": { ...paidIntent, invoice: "in_first" },
    // The old plan's unused time is credited and the new plan charged.
    "/v1/invoices/in_upgrade": {
      ...subscriptionInvoice(
        "in_upgrade",
        { start: changeAt, end },
        { intent: "pi_upgrade", total: 500, tax: 100 },
      ),
      billing_reason: "subscription_update",
      subscription_details: { metadata: upgraded },
      lines: {
        has_more: false,
        data: [
          { ...prorated, period: { start: changeAt, end } },
          { ...prorated, period: { start: changeAt, end } },
        ],
      },
    },
    ...paidWith("pi_upgrade", "ch_upgrade", "in_upgrade", changeAt, 500),
    "/v1/invoices/in_cycle": {
      ...subscriptionInvoice(
        "in_cycle",
        { start: end, end: nextEnd },
        { renewal: true, intent: "pi_cycle" },
      ),
      subscription_details: { metadata: upgraded },
    },
    ...paidWith("pi_cycle", "ch_cycle", "in_cycle", end),
  };
  const change = {
    ...input,
    ...upgraded,
    payment: {
      ...input.payment,
      kind: "invoice" as const,
      reference: "in_upgrade",
    },
    price: { ...input.price, netMinor: 400, taxMinor: 100 },
  };
  return { start, changeAt, end, nextEnd, stripe, change };
}

const dispute = (id: string, status: string, amount = 1000) => ({
  id,
  status,
  livemode: false,
  charge: "ch_test",
  amount,
  currency: "eur",
  created: (now + 2000) / 1000,
});
function stripeFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (url: string | URL) => {
    const path = new URL(url).pathname;
    const values: Record<string, unknown> = {
      "/v1/account": { id: integration.accountId },
      "/v1/payment_intents/pi_test": paidIntent,
      "/v1/charges/ch_test": paidCharge,
      ...overrides,
    };
    for (const [id, amount] of Object.entries(refunds))
      values[`/v1/refunds/${id}`] = {
        id,
        status: "succeeded",
        charge: "ch_test",
        amount,
        currency: "eur",
        created: (now + 1000) / 1000,
      };
    return values[path]
      ? Response.json(values[path])
      : new Response(null, { status: 404 });
  });
}

async function fixture() {
  const t = convexTest(schema, modules);
  const apiKey = "openiap-kit_sk_external_fixture";
  const keyHash = await sha256Hex(apiKey);
  const projectId = await t.run(async ({ db }) => {
    const userId = await db.insert("users", {});
    const organizationId = await db.insert("organizations", {
      name: "Test",
      slug: "external-fixture",
      createdAt: now,
      updatedAt: now,
    });
    const projectId = await db.insert("projects", {
      organizationId,
      name: "Test",
      slug: "external-fixture",
      apiKey: "legacy",
      createdAt: now,
      updatedAt: now,
      iosBundleId: "dev.fixture",
      androidPackageName: "dev.fixture",
      iosAppAppleId: 12345,
    });
    await db.insert("apiKeys", {
      projectId,
      organizationId,
      keyHash,
      keyType: "secret",
      name: "Test",
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return projectId;
  });
  vi.stubEnv(
    "IAPKIT_EXTERNAL_CHECKOUTS_CONFIG",
    JSON.stringify({
      integrations: [{ ...integration, projectId }],
      profiles: [profile, appleProfile],
    }),
  );
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
  const create = (key = "first", body: CheckoutInput = input) =>
    t.action(external.create, { apiKey, key, input: body });
  const jobs = () =>
    t.run((ctx) => ctx.db.query("externalCheckoutJobs").collect());
  async function run(
    kind: Doc<"externalCheckoutJobs">["task"]["kind"],
    key?: string,
  ) {
    const job = (await jobs()).find(
      (row) =>
        row.task.kind === kind &&
        row.dueAt !== undefined &&
        (!key || row.key.endsWith(key)),
    );
    if (!job) throw new Error(`No queued ${kind} job`);
    const attempt = job.attempts + 1;
    await t.run((ctx) => ctx.db.patch(job._id, { attempts: attempt }));
    await t.action(internal.externalCheckouts.action.run, {
      jobId: job._id,
      attempt,
    });
    return job._id;
  }
  // Stripe reports an invoice paid at its time, and IAPKit processes it.
  async function pay(reference: string, at: number) {
    vi.setSystemTime(at * 1000);
    await t.action(
      external.ingestStripe,
      event("invoice.paid", reference, `evt_${reference}`),
    );
    await run("stripe", `evt_${reference}`);
  }
  return { t, projectId, apiKey, create, jobs, run, pay };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("external checkout", () => {
  it("authenticates the raw Stripe event and dedupes replay, then atomically verifies and queues reporting", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await create();
    await expect(create()).resolves.toEqual({ checkoutId });
    await expect(
      create("first", { ...input, productId: "other" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(
      t.action(external.get, { apiKey: "legacy", checkoutId }),
    ).rejects.toThrow();
    const webhook = event("payment_intent.succeeded", "pi_test", "evt_payment");
    expect(() =>
      stripeEvent(webhook.raw + " ", webhook.signature, integration),
    ).toThrow("INVALID_SIGNATURE");
    expect(() =>
      stripeEvent(webhook.raw, webhook.signature, integration, now + 301_000),
    ).toThrow("INVALID_SIGNATURE");
    await t.action(external.ingestStripe, webhook);
    await t.action(external.ingestStripe, webhook);
    expect(
      (await jobs()).filter((job) => job.task.kind === "stripe"),
    ).toHaveLength(1);
    await t.action(external.verify, { apiKey, checkoutId });
    await run("stripe");
    await run("verify");
    expect(
      (await jobs()).filter((job) => job.task.kind === "purchase"),
    ).toHaveLength(1);
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "queued",
      entitlement: { active: true },
    });
    const checkout = await t.run((ctx) => ctx.db.get(checkoutId));
    expect(checkout?.googleToken?.ciphertext).not.toContain(
      input.reporting.externalTransactionToken,
    );
  });

  it("retries an early refund, dedupes refund events and revokes only on full refund", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await create();
    await t.action(
      external.ingestStripe,
      event("refund.created", "re_part", "evt_early"),
    );
    const early = await run("stripe", "evt_early");
    expect((await t.run((ctx) => ctx.db.get(early)))?.dueAt).toBeGreaterThan(
      now,
    );
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    await run("stripe", "evt_early");
    await t.action(
      external.ingestStripe,
      event("refund.updated", "re_part", "evt_repeat"),
    );
    await run("stripe", "evt_repeat");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "partially_refunded",
      entitlement: { active: true },
    });
    await t.action(
      external.ingestStripe,
      event("refund.created", "re_rest", "evt_rest"),
    );
    await run("stripe", "evt_rest");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "refunded",
      entitlement: { active: false },
    });
    expect(
      (await jobs()).flatMap((row) =>
        row.task.kind === "refund" ? [row.task] : [],
      ),
    ).toMatchObject([
      { netMinor: 200, taxMinor: 50, before: 0, full: false },
      { netMinor: 600, taxMinor: 150, before: 250, full: true },
    ]);
  });

  it("treats a lost dispute as a refund of what remains and ignores a won one", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/disputes/du_won": dispute("du_won", "won"),
        "/v1/disputes/du_lost": dispute("du_lost", "lost"),
      }),
    );
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    const ingest = async (type: string, reference: string) => {
      await t.action(
        external.ingestStripe,
        event(type, reference, `evt_${reference}`),
      );
      await run("stripe", `evt_${reference}`);
    };
    await ingest("refund.created", "re_part");
    await ingest("charge.dispute.closed", "du_won");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "partially_refunded",
      entitlement: { active: true },
    });
    await ingest("charge.dispute.closed", "du_lost");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "refunded",
      entitlement: { active: false },
    });
    expect(
      (await jobs()).flatMap((row) =>
        row.task.kind === "refund" ? [row.task] : [],
      ),
    ).toMatchObject([
      { refund: { reference: "re_part", amount: 250 }, full: false },
      {
        refund: { reference: "du_lost", amount: 750 },
        before: 250,
        full: true,
      },
    ]);
  });

  it("flags a refund it can't read until a later event settles it", async () => {
    const { t, apiKey, create, run } = await fixture();
    const refund = { charge: "ch_test", currency: "eur", created: now / 1000 };
    let stripe = stripeFetch({
      "/v1/refunds/re_void": {
        ...refund,
        id: "re_void",
        status: "canceled",
        amount: 100,
      },
    });
    // The Stripe key can't read refunds, as a restricted key may not.
    let denied = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        denied && new URL(url).pathname.startsWith("/v1/refunds/")
          ? new Response(null, { status: 403 })
          : stripe(url),
      ),
    );
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    const ingest = async (type: string, reference: string, id: string) => {
      await t.action(external.ingestStripe, event(type, reference, id));
      await run("stripe", id);
    };
    const checkout = () => t.run((ctx) => ctx.db.get(checkoutId));
    await ingest("refund.created", "re_part", "evt_denied");
    await ingest("refund.updated", "re_part", "evt_denied_again");
    await ingest("refund.created", "re_rest", "evt_rest_denied");
    await ingest("refund.created", "re_void", "evt_void_denied");
    expect(await checkout()).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "action_required",
      failedReports: 3,
      active: true,
    });
    denied = false;
    // Stripe canceled this refund, so there is nothing to report.
    await ingest("refund.updated", "re_void", "evt_void");
    expect(await checkout()).toMatchObject({
      paymentStatus: "paid",
      failedReports: 2,
    });
    // A payment event reads the refunds on its charge too.
    stripe = stripeFetch({
      "/v1/charges/ch_test": { ...paidCharge, amount_refunded: 250 },
      "/v1/refunds": {
        has_more: false,
        data: [{ ...refund, id: "re_part", status: "succeeded", amount: 250 }],
      },
    });
    await ingest("payment_intent.succeeded", "pi_test", "evt_paid_again");
    expect(await checkout()).toMatchObject({
      paymentStatus: "partially_refunded",
      reportingStatus: "action_required",
      failedReports: 1,
    });
    // A recorded refund needs no manual report, whatever a later event does.
    denied = true;
    await ingest("refund.updated", "re_part", "evt_denied_late");
    expect(await checkout()).toMatchObject({ failedReports: 1 });
    denied = false;
    await ingest("refund.updated", "re_rest", "evt_rest_read");
    expect(await checkout()).toMatchObject({
      paymentStatus: "refunded",
      reportingStatus: "queued",
      failedReports: 0,
      unverified: [],
      active: false,
    });
  });

  it("applies a dispute lost before the first verification", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/charges/ch_test": { ...paidCharge, disputed: true },
        "/v1/disputes": {
          has_more: false,
          data: [
            dispute("du_open", "needs_response"),
            dispute("du_lost", "lost"),
          ],
        },
      }),
    );
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "refunded",
      entitlement: { active: false },
    });
    expect((await jobs()).map((job) => job.task.kind)).toEqual([
      "verify",
      "purchase",
      "refund",
    ]);
  });

  it("records and reports an erased user's payment without granting access", async () => {
    const { t, projectId, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await create();
    const jobId = await t.run(async (ctx) =>
      ctx.db.insert("subscriptionUserErasureJobs", {
        projectId,
        userId: input.userId,
        userIdHash: await sha256Hex(input.userId),
        status: "queued",
        subscriptionsErased: 0,
        commerceEventsErased: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await t.mutation(
      internal.subscriptions.internal.drainSubscriptionUserErasureJob,
      {
        jobId,
      },
    );
    await expect(
      create("again", { ...input, orderId: "order_2" }),
    ).rejects.toThrow("App user is unavailable");
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "queued",
      entitlement: { active: false },
    });
    expect((await t.run((ctx) => ctx.db.get(checkoutId)))?.active).toBe(false);
    expect((await jobs()).map((job) => job.task.kind)).toEqual([
      "verify",
      "purchase",
    ]);
  });

  it("never grants a charge already fully refunded before the first verification", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/charges/ch_test": { ...paidCharge, amount_refunded: 1000 },
        "/v1/refunds": {
          has_more: false,
          data: [
            {
              id: "re_full",
              status: "succeeded",
              charge: "ch_test",
              amount: 1000,
              currency: "eur",
              created: now / 1000,
            },
          ],
        },
      }),
    );
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "refunded",
      reportingStatus: "queued",
      entitlement: { active: false },
    });
    expect((await jobs()).map((job) => job.task.kind)).toEqual([
      "verify",
      "purchase",
      "refund",
    ]);
  });

  it("recovers an abandoned report lease without duplicate scheduling and keeps payment separate", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    const report = (await jobs()).find((job) => job.task.kind === "purchase")!;
    // Claim using the queue mutation, but leave the scheduled action unrun.
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await t.mutation(state.dispatch, {});
    await t.mutation(state.dispatch, {});
    expect((await t.run((ctx) => ctx.db.get(report._id)))?.attempts).toBe(1);
    vi.setSystemTime(now + 13 * 60_000);
    await t.mutation(state.dispatch, {});
    await t.mutation(state.finish, {
      jobId: report._id,
      attempt: 1,
      outcome: "done",
    });
    expect((await t.run((ctx) => ctx.db.get(report._id)))?.attempts).toBe(2);
    await t.mutation(state.finish, {
      jobId: report._id,
      attempt: 2,
      outcome: "retry",
      error: "GOOGLE_REPORT_503",
    });
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "retrying",
      entitlement: { active: true },
    });
    vi.setSystemTime(report._creationTime + week + 60_000);
    await t.mutation(state.dispatch, {});
    await t.mutation(state.finish, {
      jobId: report._id,
      attempt: 3,
      outcome: "retry",
      error: "GOOGLE_REPORT_503",
    });
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "action_required",
      entitlement: { active: true },
    });
  });

  it("registers Apple tokens without a checkout and uses the active services token once", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const register = (externalPurchaseId: string) =>
      t.action(external.registerToken, {
        apiKey,
        profileId: appleProfile.id,
        userId: input.userId,
        token: appleToken(externalPurchaseId, {
          tokenExpirationDate: now + week,
          tokenType: "SERVICES",
        }),
      });
    const a = await register("SANDBOX_one");
    expect(await register("SANDBOX_one")).toEqual(a);
    const b = await register("SANDBOX_two");
    expect(await t.run((ctx) => ctx.db.get(b.tokenId))).toMatchObject({
      duplicate: true,
      used: false,
    });
    const { checkoutId } = await create("apple", {
      ...input,
      reporting: {
        store: "apple",
        profileId: appleProfile.id,
        tokenIds: [b.tokenId, a.tokenId],
      },
    });
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    const job = (await jobs()).find((job) => job.task.kind === "purchase")!;
    if (job.task.kind !== "purchase") throw new Error("missing purchase job");
    const context = (await t.query(state.reportContext, {
      paymentId: job.task.paymentId,
    }))!;
    const report = buildAppleReport(
      context.checkout,
      context.transaction,
      context.appleToken!,
      context.initial,
      context.root,
    );
    expect(report).toMatchObject({
      externalPurchaseId: "SANDBOX_one",
      status: "LINE_ITEM",
      lineItems: [
        { eventType: "BUY", amountTaxInclusive: 10000, taxCountry: "DEU" },
      ],
    });
    expect(
      (await jobs()).filter((job) => job.task.kind === "appleToken"),
    ).toHaveLength(2);
  });

  it("verifies initial and recurring invoices and keeps a renewal active after an older refund", async () => {
    const { t, projectId, apiKey, create, jobs, run } = await fixture();
    const start = now / 1000;
    const end = start + 31 * 86400;
    const renewalEnd = end + 30 * 86400;
    const invoice = (id: string, renewal: boolean) =>
      subscriptionInvoice(
        id,
        renewal ? { start: end, end: renewalEnd } : { start, end },
        { renewal, intent: renewal ? "pi_next" : "pi_test" },
      );
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/invoices/in_first": invoice("in_first", false),
        "/v1/invoices/in_next": invoice("in_next", true),
        "/v1/payment_intents/pi_test": { ...paidIntent, invoice: "in_first" },
        ...paidWith("pi_next", "ch_next", "in_next", end),
      }),
    );
    const { checkoutId } = await create("subscription", {
      ...input,
      payment: { ...input.payment, kind: "invoice", reference: "in_first" },
    });
    await t.action(
      external.ingestStripe,
      event("invoice.paid", "in_first", "evt_first"),
    );
    await run("stripe", "evt_first");
    vi.setSystemTime(end * 1000);
    await t.action(
      external.ingestStripe,
      event("invoice.paid", "in_next", "evt_next"),
    );
    await run("stripe", "evt_next");
    await t.action(
      external.ingestStripe,
      event("invoice.paid", "in_next", "evt_next_again"),
    );
    await run("stripe", "evt_next_again");
    expect(
      (await jobs()).filter((job) => job.task.kind === "purchase"),
    ).toHaveLength(2);
    for (const ref of ["re_part", "re_rest"]) {
      await t.action(
        external.ingestStripe,
        event("refund.created", ref, `evt_${ref}`),
      );
      await run("stripe", `evt_${ref}`);
    }
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      entitlement: { active: true, expiresAt: renewalEnd * 1000 },
    });
    // A paid renewal IAPKit can't verify, at once or after a day of retries,
    // and a plan change nobody registers within a day need a manual store
    // report; access runs out with the verified period.
    const reported = (await t.run((ctx) => ctx.db.get(checkoutId)))!;
    // A failed duplicate event for a recorded renewal is not a missed report.
    const duplicate = await t.run((ctx) =>
      ctx.db.insert("externalCheckoutJobs", {
        projectId,
        key: "stripe:duplicate",
        task: {
          kind: "stripe",
          integrationId: integration.id,
          event: "invoice.paid",
          reference: "in_next",
        },
        attempts: 1,
        dueAt: Date.now(),
        checkoutId,
      }),
    );
    await t.mutation(state.finish, {
      jobId: duplicate,
      attempt: 1,
      outcome: "failed",
      error: "STRIPE_HTTP_500",
    });
    expect((await t.run((ctx) => ctx.db.get(checkoutId)))?.failedReports).toBe(
      reported.failedReports,
    );
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        ...paidWith("pi_prorated", "ch_prorated", "in_prorated", end),
        "/v1/invoices/in_prorated": {
          ...invoice("in_prorated", true),
          payment_intent: "pi_prorated",
          lines: {
            has_more: false,
            data: [
              {
                type: "subscription",
                proration: true,
                quantity: 1,
                period: { start: end, end: renewalEnd },
              },
            ],
          },
        },
        // A renewal can't come from a subscription update.
        "/v1/invoices/in_update": {
          ...invoice("in_update", true),
          billing_reason: "subscription_update",
        },
        "/v1/invoices/in_open": { ...invoice("in_open", true), status: "open" },
        // Only a plan change can credit more than it bills.
        "/v1/invoices/in_credit": {
          ...invoice("in_credit", true),
          total: -100,
          tax: 0,
          amount_paid: 0,
          payment_intent: null,
        },
        // A renewal for another order is an unregistered plan change.
        "/v1/invoices/in_change": {
          ...invoice("in_change", true),
          subscription_details: {
            metadata: { ...paidIntent.metadata, orderId: "order_9" },
          },
        },
      }),
    );
    const failing = [
      "in_prorated",
      "in_update",
      "in_credit",
      "in_open",
      "in_change",
    ];
    for (const reference of failing)
      await t.action(
        external.ingestStripe,
        event("invoice.paid", reference, `evt_${reference}`),
      );
    for (const reference of failing) await run("stripe", `evt_${reference}`);
    vi.setSystemTime(end * 1000 + 86_400_000 + 60_000);
    await run("stripe", "evt_in_open");
    await run("stripe", "evt_in_change");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      reportingStatus: "action_required",
      entitlement: { active: true, expiresAt: renewalEnd * 1000 },
    });
    expect(await t.run((ctx) => ctx.db.get(checkoutId))).toMatchObject({
      failedReports: reported.failedReports + failing.length,
      unverified: failing,
    });
    vi.setSystemTime(renewalEnd * 1000);
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      entitlement: { active: false },
    });
  });

  it("starts a subscription with a free trial and counts only paid days for Apple", async () => {
    const { t, apiKey, create, jobs, pay } = await fixture();
    const day = 86_400;
    const start = now / 1000;
    const trialEnd = start + 7 * day;
    const paidEnd = trialEnd + 30 * day;
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/invoices/in_trial": subscriptionInvoice(
          "in_trial",
          { start, end: trialEnd },
          { intent: null, total: 0, tax: 0 },
        ),
        "/v1/invoices/in_paid": subscriptionInvoice(
          "in_paid",
          { start: trialEnd, end: paidEnd },
          { renewal: true, intent: "pi_paid" },
        ),
        "/v1/invoices/in_next": subscriptionInvoice(
          "in_next",
          { start: paidEnd, end: paidEnd + 30 * day },
          { renewal: true, intent: "pi_next" },
        ),
        ...paidWith("pi_paid", "ch_paid", "in_paid", trialEnd),
        ...paidWith("pi_next", "ch_next", "in_next", paidEnd),
      }),
    );
    const { tokenId } = await t.action(external.registerToken, {
      apiKey,
      profileId: appleProfile.id,
      userId: input.userId,
      token: appleToken("SANDBOX_trial"),
    });
    const trial = {
      ...input,
      payment: {
        ...input.payment,
        kind: "invoice" as const,
        reference: "in_trial",
      },
      price: { ...input.price, netMinor: 0, taxMinor: 0 },
      reporting: {
        store: "apple" as const,
        profileId: appleProfile.id,
        tokenIds: [tokenId],
      },
    };
    // Only a subscription invoice can start free.
    await expect(
      create("one-time", { ...trial, payment: input.payment }),
    ).rejects.toThrow("INVALID_INPUT");
    const { checkoutId } = await create("trial", trial);
    await pay("in_trial", start);
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      entitlement: { active: true, expiresAt: trialEnd * 1000 },
    });
    await pay("in_paid", trialEnd);
    await pay("in_next", paidEnd);
    const lines = [];
    for (const job of await jobs()) {
      if (job.task.kind !== "purchase") continue;
      const context = (await t.query(state.reportContext, {
        paymentId: job.task.paymentId,
      }))!;
      lines.push(
        buildAppleReport(
          context.checkout,
          context.transaction,
          context.appleToken!,
          context.initial,
          context.root,
        ).lineItems?.[0],
      );
    }
    expect(lines).toMatchObject([
      {
        subscriptionEvent: "SUBSCRIPTION_START",
        amountTaxInclusive: 0,
        subscriptionDaysOfPaidService: 0,
      },
      {
        subscriptionEvent: "RENEWAL",
        amountTaxInclusive: 10000,
        subscriptionDaysOfPaidService: 0,
      },
      {
        subscriptionEvent: "RENEWAL",
        amountTaxInclusive: 10000,
        subscriptionDaysOfPaidService: 30,
      },
    ]);
  });

  it("reports a free trial to Google as a zero-amount first transaction", async () => {
    const { t, create, jobs, run } = await fixture();
    const start = now / 1000;
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/invoices/in_trial": subscriptionInvoice(
          "in_trial",
          { start, end: start + 7 * 86_400 },
          { intent: null, total: 0, tax: 0 },
        ),
      }),
    );
    await create("trial", {
      ...input,
      payment: { ...input.payment, kind: "invoice", reference: "in_trial" },
      price: { ...input.price, netMinor: 0, taxMinor: 0 },
    });
    await t.action(
      external.ingestStripe,
      event("invoice.paid", "in_trial", "evt_trial"),
    );
    await run("stripe", "evt_trial");
    const job = (await jobs()).find((row) => row.task.kind === "purchase")!;
    if (job.task.kind !== "purchase") throw new Error("missing purchase job");
    const { checkout, transaction, initial } = (await t.query(
      state.reportContext,
      { paymentId: job.task.paymentId },
    ))!;
    expect(transaction.fact.chargeId).toBeUndefined();
    // The retry after a lost response reads a transaction whose zero
    // amounts Google left out.
    const api = {
      createexternaltransaction: vi.fn(async () => {
        throw Object.assign(new Error("exists"), { response: { status: 409 } });
      }),
      getexternaltransaction: vi.fn(async ({ name }: { name?: string }) => ({
        data: {
          externalTransactionId: name?.split("/").pop(),
          packageName: "dev.fixture",
          testPurchase: {},
          originalPreTaxAmount: { currency: "EUR" },
          originalTaxAmount: { currency: "EUR" },
        },
      })),
      refundexternaltransaction: vi.fn(),
    };
    await sendGoogleReport(
      api,
      "dev.fixture",
      integration,
      checkout,
      transaction,
      initial,
      "opaque",
      profile,
    );
    expect(api.createexternaltransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          originalPreTaxAmount: { currency: "EUR", priceMicros: "0" },
          recurringTransaction: expect.objectContaining({
            externalTransactionToken: "opaque",
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it("moves a plan change to a new checkout that takes over the subscription", async () => {
    const { t, apiKey, create, jobs, run, pay } = await fixture();
    const { start, changeAt, end, nextEnd, stripe, change } = planChange();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        ...stripe,
        // Another payment of the old plan before the change.
        "/v1/invoices/in_extra": subscriptionInvoice(
          "in_extra",
          { start, end },
          { renewal: true, intent: "pi_extra" },
        ),
        ...paidWith("pi_extra", "ch_extra", "in_extra", start + 86_400),
        "/v1/invoices/in_second": {
          ...stripe["/v1/invoices/in_upgrade"],
          id: "in_second",
          payment_intent: "pi_second",
          subscription_details: {
            metadata: {
              ...stripe["/v1/invoices/in_upgrade"].subscription_details
                .metadata,
              orderId: "order_3",
            },
          },
        },
        ...paidWith("pi_second", "ch_second", "in_second", changeAt, 500),
      }),
    );
    const { checkoutId: parentId } = await create("subscription", {
      ...input,
      payment: { ...input.payment, kind: "invoice", reference: "in_first" },
    });
    await pay("in_first", start);
    await pay("in_extra", start + 86_400);
    const upgrade = {
      ...change,
      reporting: { ...input.reporting, externalTransactionToken: "upgrade" },
      changeOf: parentId,
    };
    await expect(
      create("not-invoice", {
        ...upgrade,
        payment: { ...upgrade.payment, kind: "payment_intent" },
      }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      create("other-user", { ...upgrade, userId: "user_2" }),
    ).rejects.toThrow("Plan change needs a current subscription");
    // The change's invoice can be paid before its checkout is registered.
    await pay("in_upgrade", changeAt);
    const { checkoutId } = await create("upgrade", upgrade);
    // A second change of the same old plan, still pending.
    const second = await create("second", {
      ...upgrade,
      orderId: "order_3",
      payment: { ...upgrade.payment, reference: "in_second" },
      reporting: { ...input.reporting, externalTransactionToken: "second" },
    });
    await run("stripe", "evt_in_upgrade");
    // Once the first change took the subscription over, the second can't.
    await pay("in_second", changeAt);
    expect(await t.action(external.get, { apiKey, ...second })).toMatchObject({
      paymentStatus: "pending",
      entitlement: { active: false },
    });
    const status = (id: typeof checkoutId) =>
      t.action(external.get, { apiKey, checkoutId: id });
    expect(await status(parentId)).toMatchObject({
      entitlement: { active: false },
    });
    expect(await status(checkoutId)).toMatchObject({
      paymentStatus: "paid",
      entitlement: { active: true, expiresAt: end * 1000 },
    });
    // A full refund of one old-plan payment leaves another, which still
    // doesn't bring the old plan's access back.
    for (const ref of ["re_part", "re_rest"]) {
      await t.action(
        external.ingestStripe,
        event("refund.created", ref, `evt_${ref}`),
      );
      await run("stripe", `evt_${ref}`);
    }
    expect(await status(parentId)).toMatchObject({
      entitlement: { active: false },
    });
    await pay("in_cycle", end);
    expect(await status(checkoutId)).toMatchObject({
      entitlement: { active: true, expiresAt: nextEnd * 1000 },
    });
    // Google reports the change as a new series that later cycles continue.
    const purchases = [];
    for (const job of await jobs()) {
      if (job.task.kind !== "purchase") continue;
      const context = (await t.query(state.reportContext, {
        paymentId: job.task.paymentId,
      }))!;
      purchases.push({
        checkoutId: context.checkout._id,
        initial: context.initial?._id,
        root: context.root,
        payment: context.transaction._id,
        recurring: buildGooglePurchase(
          context.checkout,
          context.transaction,
          context.initial,
          "token",
          profile,
        ).recurringTransaction,
      });
    }
    const [first, , changed, renewal] = purchases;
    expect(first).toMatchObject({
      checkoutId: parentId,
      recurring: { externalTransactionToken: "token" },
    });
    // Its reports never wait for the old series.
    expect(changed).toMatchObject({
      checkoutId,
      root: null,
      recurring: { externalTransactionToken: "token" },
    });
    expect(renewal).toMatchObject({
      checkoutId,
      initial: changed.payment,
      recurring: { initialExternalTransactionId: expect.any(String) },
    });
  });

  it.each([
    { plan: "an upgrade", downgrade: false },
    { plan: "a downgrade paid from credit", downgrade: true },
  ])(
    "reports $plan to Apple within the subscription it changes",
    async ({ downgrade }) => {
      const { t, apiKey, create, jobs, pay } = await fixture();
      const { start, changeAt, end, stripe, change } = planChange();
      vi.stubGlobal(
        "fetch",
        stripeFetch({
          ...stripe,
          // The old plan's unused time outweighs the new plan's, and the
          // customer's credit balance pays part of the next renewal.
          ...(downgrade && {
            "/v1/invoices/in_upgrade": {
              ...stripe["/v1/invoices/in_upgrade"],
              total: -334,
              tax: 0,
              amount_paid: 0,
              payment_intent: null,
            },
            "/v1/invoices/in_cycle": {
              ...stripe["/v1/invoices/in_cycle"],
              amount_paid: 666,
            },
            ...paidWith("pi_cycle", "ch_cycle", "in_cycle", end, 666),
          }),
        }),
      );
      const token = async (externalPurchaseId: string) =>
        (
          await t.action(external.registerToken, {
            apiKey,
            profileId: appleProfile.id,
            userId: input.userId,
            token: appleToken(externalPurchaseId),
          })
        ).tokenId;
      const apple = async (tokenId: string) => ({
        store: "apple" as const,
        profileId: appleProfile.id,
        tokenIds: [tokenId],
      });
      const { checkoutId: parentId } = await create("subscription", {
        ...input,
        payment: { ...input.payment, kind: "invoice", reference: "in_first" },
        reporting: await apple(await token("SANDBOX_first")),
      });
      await pay("in_first", start);
      await create("upgrade", {
        ...change,
        price: downgrade
          ? { ...change.price, netMinor: 0, taxMinor: 0 }
          : change.price,
        reporting: await apple(await token("SANDBOX_upgrade")),
        changeOf: parentId,
      });
      await pay("in_upgrade", changeAt);
      await pay("in_cycle", end);
      const lines: Record<string, string | number>[] = [];
      for (const job of await jobs()) {
        if (job.task.kind !== "purchase") continue;
        const context = (await t.query(state.reportContext, {
          paymentId: job.task.paymentId,
        }))!;
        const report = buildAppleReport(
          context.checkout,
          context.transaction,
          context.appleToken!,
          context.initial,
          context.root,
        );
        lines.push({
          token: report.externalPurchaseId,
          ...report.lineItems?.[0],
        });
      }
      const [started] = lines;
      expect(lines).toMatchObject([
        {
          token: "SANDBOX_first",
          subscriptionEvent: "SUBSCRIPTION_START",
          subscriptionDaysOfPaidService: 0,
        },
        {
          token: "SANDBOX_upgrade",
          subscriptionEvent: "SUBSCRIPTION_CHANGE",
          amountTaxInclusive: downgrade ? 0 : 5000,
          subscriptionDaysOfPaidService: 10,
          referenceLineItemId: started.lineItemId,
        },
        {
          // Only what the customer paid now; the credit was reported with the
          // old plan, whose days still count.
          token: "SANDBOX_upgrade",
          subscriptionEvent: "RENEWAL",
          amountTaxInclusive: downgrade ? 6660 : 10000,
          taxAmount: downgrade ? 1330 : 2000,
          subscriptionDaysOfPaidService: 31,
          referenceLineItemId: started.lineItemId,
        },
      ]);
    },
  );

  it("takes over at renewal when a scheduled plan change is registered late", async () => {
    const { t, apiKey, create, run, pay } = await fixture();
    const { start, end, nextEnd, stripe, change } = planChange();
    // The schedule switches plans at renewal, and the customer's credit
    // balance pays the whole bill.
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        ...stripe,
        "/v1/invoices/in_scheduled": {
          ...stripe["/v1/invoices/in_cycle"],
          id: "in_scheduled",
          amount_paid: 0,
          payment_intent: null,
        },
      }),
    );
    const { checkoutId: parentId } = await create("subscription", {
      ...input,
      payment: { ...input.payment, kind: "invoice", reference: "in_first" },
    });
    const parent = () => t.run((ctx) => ctx.db.get(parentId));
    await pay("in_first", start);
    // Unregistered for a day, the invoice is left for a manual report.
    await pay("in_scheduled", end);
    vi.setSystemTime(end * 1000 + 86_400_000 + 60_000);
    await run("stripe", "evt_in_scheduled");
    expect(await parent()).toMatchObject({
      reportingStatus: "action_required",
      unverified: ["in_scheduled"],
    });
    // Registered late, it is verified and reported instead.
    const { checkoutId } = await create("scheduled", {
      ...change,
      payment: { ...change.payment, reference: "in_scheduled" },
      price: { ...change.price, netMinor: 800, taxMinor: 200 },
      reporting: { ...input.reporting, externalTransactionToken: "scheduled" },
      changeOf: parentId,
    });
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    expect(await parent()).toMatchObject({
      replacedBy: checkoutId,
      failedReports: 0,
      unverified: [],
      reportingStatus: "queued",
    });
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "paid",
      entitlement: { active: true, expiresAt: nextEnd * 1000 },
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("externalCheckoutPayments")
          .withIndex("by_integration_reference", (q) =>
            q
              .eq("integrationId", integration.id)
              .eq("fact.reference", "in_scheduled"),
          )
          .unique(),
      ),
    ).toMatchObject({
      fact: {
        price: { netMinor: 0, taxMinor: 0 },
        subscription: { billed: true },
      },
    });
  });

  it("skips unregistered PaymentIntents and parks unknown refunds without calling Stripe", async () => {
    const { t, jobs, run } = await fixture();
    const fetch = stripeFetch();
    vi.stubGlobal("fetch", fetch);
    await t.action(
      external.ingestStripe,
      event("payment_intent.succeeded", "pi_web", "evt_web", {}),
    );
    expect(await jobs()).toEqual([]);

    // A bound PaymentIntent can arrive before its checkout, and a refund or
    // dispute before its payment is recorded: both wait without Stripe calls.
    for (const [type, reference, object] of [
      ["payment_intent.succeeded", "pi_late", undefined],
      ["refund.created", "re_web", { charge: "ch_web" }],
      ["charge.dispute.closed", "du_web", { charge: "ch_web" }],
    ] as const) {
      await t.action(
        external.ingestStripe,
        event(type, reference, `evt_${reference}`, object),
      );
      const job = await run("stripe", `evt_${reference}`);
      expect((await t.run((ctx) => ctx.db.get(job)))?.dueAt).toBeGreaterThan(
        now,
      );
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports an Apple token again when Apple says an unused token is unreported", async () => {
    const { t, projectId, jobs } = await fixture();
    const register = (externalId: string, userId?: string) =>
      t.mutation(state.registerToken, {
        projectId,
        profileId: appleProfile.id,
        userId,
        externalId,
        createdAt: now - 1000,
      });
    const unused = await register("SANDBOX_unused", input.userId);
    const used = await register("SANDBOX_used", input.userId);
    await t.run(async (ctx) => {
      await ctx.db.patch(used.tokenId, { used: true });
      for (const job of await ctx.db.query("externalCheckoutJobs").collect())
        await ctx.db.patch(job._id, {
          dueAt: undefined,
          attempts: 3,
          startedAt: now - week,
          lastError: "APPLE_NOT_CONFIGURED",
        });
    });
    await register("SANDBOX_unused");
    await register("SANDBOX_used");
    const byToken = new Map((await jobs()).map((job) => [job.key, job]));
    const rearmed = byToken.get(`apple:${unused.tokenId}`)!;
    // Due on the next dispatch.
    expect(rearmed.dueAt).toBeLessThanOrEqual(now + 1000);
    expect(rearmed.attempts).toBe(0);
    expect(rearmed.startedAt).toBeUndefined();
    expect(rearmed.lastError).toBeUndefined();
    const reported = byToken.get(`apple:${used.tokenId}`)!;
    expect(reported.dueAt).toBeUndefined();
    expect(reported.lastError).toBe("APPLE_NOT_CONFIGURED");
  });

  it("rejects mismatched Stripe payment and an invoice marked paid out of band", async () => {
    const { t, apiKey, create, run } = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/charges/ch_test": { ...paidCharge, amount_captured: 1 },
      }),
    );
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    expect(await t.action(external.get, { apiKey, checkoutId })).toMatchObject({
      paymentStatus: "action_required",
      reportingStatus: "pending",
      entitlement: { active: false },
    });
    const checkout = (await t.run((ctx) => ctx.db.get(checkoutId)))!;
    const stripe = new Stripe(integration);
    // A payment for another user doesn't bind to the checkout.
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/payment_intents/pi_test": {
          ...paidIntent,
          metadata: { ...paidIntent.metadata, userId: "user_2" },
        },
      }),
    );
    await expect(stripe.payment(checkout)).rejects.toThrow(
      "STRIPE_CHECKOUT_BINDING_MISMATCH",
    );
    await expect(
      stripe.payment(checkout, {
        id: "in_test",
        status: "paid",
        livemode: false,
        currency: "eur",
        amount_paid: 1000,
        total: 1000,
        tax: 200,
        payment_intent: "pi_test",
        paid_out_of_band: true,
        subscription: "sub_test",
        billing_reason: "subscription_create",
        status_transitions: { paid_at: now / 1000 },
        lines: { has_more: false, data: [] },
      }),
    ).rejects.toThrow("STRIPE_INVOICE_UNSUPPORTED");
  });
});

describe("store report retries", () => {
  it("looks up Apple's existing report after the response was lost", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const base = "https://example.test/reports";
    const report = {
      requestIdentifier: "request",
      externalPurchaseId: "token",
      status: "NO_LINE_ITEM" as const,
    };
    await expect(sendAppleReport(base, "jwt", report, false)).rejects.toThrow(
      "PROVIDER_UNREACHABLE",
    );
    await sendAppleReport(base, "jwt", report, true);
    expect(fetch.mock.calls).toHaveLength(2);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify(report),
    });
    expect(fetch.mock.calls[1][0]).toBe(`${base}/request`);
  });

  it("retries an Apple simultaneous submission conflict", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ errors: [{ errorCode: 26 }] }, { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendAppleReport(
        "https://example.test/reports",
        "jwt",
        {
          requestIdentifier: "request",
          externalPurchaseId: "token",
          status: "NO_LINE_ITEM",
        },
        false,
      ),
    ).rejects.toMatchObject({
      code: "APPLE_SIMULTANEOUS_SUBMISSION",
      retryable: true,
    });
  });

  it("reconciles Google create and refund after the response was lost", async () => {
    const { t, apiKey, create, jobs, run } = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await create();
    await t.action(external.verify, { apiKey, checkoutId });
    await run("verify");
    const job = (await jobs()).find((row) => row.task.kind === "purchase")!;
    if (job.task.kind !== "purchase") throw new Error("missing purchase job");
    const { checkout, transaction, initial } = (await t.query(
      state.reportContext,
      { paymentId: job.task.paymentId },
    ))!;
    let remote: Record<string, unknown> = {};
    const mock = {
      createexternaltransaction: vi.fn(async (args) => {
        if (Object.keys(remote).length)
          throw Object.assign(new Error("exists"), {
            response: { status: 409 },
          });
        remote = {
          ...args.requestBody,
          externalTransactionId: args.externalTransactionId,
          packageName: "dev.fixture",
          testPurchase: {},
          currentPreTaxAmount: { priceMicros: "8000000" },
        };
        throw new Error("connection lost");
      }),
      getexternaltransaction: vi.fn(async () => ({ data: remote })),
      refundexternaltransaction: vi.fn(async () => {
        remote.currentPreTaxAmount = { priceMicros: "6000000" };
        throw new Error("connection lost");
      }),
    };
    const send = (
      refund?: Extract<Doc<"externalCheckoutJobs">["task"], { kind: "refund" }>,
    ) =>
      sendGoogleReport(
        mock,
        "dev.fixture",
        integration,
        checkout,
        transaction,
        initial,
        "opaque",
        profile,
        refund,
      );
    await expect(send()).rejects.toThrow("GOOGLE_REPORT_UNREACHABLE");
    await send();
    expect(mock.createexternaltransaction.mock.calls[0][0]).toEqual(
      mock.createexternaltransaction.mock.calls[1][0],
    );
    const refund = {
      kind: "refund" as const,
      paymentId: transaction._id,
      refund: {
        reference: "re_part",
        chargeId: "ch_test",
        amount: 250,
        currency: "EUR",
        at: now,
      },
      netMinor: 200,
      taxMinor: 50,
      before: 0,
      refundedNet: 200,
      full: false,
    };
    await expect(send(refund)).rejects.toThrow("GOOGLE_REPORT_UNREACHABLE");
    await send(refund);
    expect(mock.refundexternaltransaction).toHaveBeenCalledTimes(1);
    expect(mock.refundexternaltransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          partialRefund: expect.objectContaining({
            refundId: expect.any(String),
            refundPreTaxAmount: { currency: "EUR", priceMicros: "2000000" },
          }),
        }),
      }),
      expect.anything(),
    );

    // The refund that completes earlier partial refunds is a fullRefund of the
    // remainder, and its retry finds the transaction canceled.
    mock.refundexternaltransaction.mockImplementation(async () => {
      remote.currentPreTaxAmount = { currency: "EUR" };
      remote.transactionState = "TRANSACTION_CANCELED";
      throw new Error("connection lost");
    });
    const rest = {
      ...refund,
      refund: { ...refund.refund, reference: "re_rest", amount: 750 },
      netMinor: 600,
      taxMinor: 150,
      before: 250,
      refundedNet: 800,
      full: true,
    };
    await expect(send(rest)).rejects.toThrow("GOOGLE_REPORT_UNREACHABLE");
    await send(rest);
    expect(mock.refundexternaltransaction).toHaveBeenCalledTimes(2);
    expect(mock.refundexternaltransaction).toHaveBeenNthCalledWith(
      2,
      {
        name: expect.any(String),
        requestBody: {
          refundTime: new Date(now).toISOString(),
          fullRefund: {},
        },
      },
      expect.anything(),
    );
  });
});

describe("external checkout guards", () => {
  const start = now / 1000;
  const period = { start, end: start + 30 * 86_400 };
  const first = subscriptionInvoice("in_first", period);
  const renewal = subscriptionInvoice(
    "in_renewal",
    { start: period.end, end: period.end + 30 * 86_400 },
    { renewal: true },
  );
  const lines = (...items: object[]) => ({
    lines: {
      has_more: false,
      data: items.map((item) => ({ ...first.lines.data[0], ...item })),
    },
  });

  // The checkout row each kind of Stripe payment is checked against.
  async function checkouts() {
    const { t, create } = await fixture();
    const { checkoutId } = await create();
    const intent = (await t.run((ctx) => ctx.db.get(checkoutId)))!;
    const invoice = {
      ...intent,
      payment: {
        ...intent.payment,
        kind: "invoice" as const,
        reference: first.id,
      },
    };
    return {
      intent,
      invoice,
      renewal: { ...invoice, subscriptionId: "sub_test" },
      change: { ...invoice, previousCheckoutId: checkoutId },
    };
  }
  type Kind = keyof Awaited<ReturnType<typeof checkouts>>;

  // Stripe as it answers for a paid checkout of that kind.
  function paidFetch(kind: Kind, bill: object, stripe: object = {}) {
    const invoice = { ...(kind === "renewal" ? renewal : first), ...bill };
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        ...(kind === "intent"
          ? {}
          : paidWith(
              "pi_test",
              "ch_test",
              invoice.id,
              start,
              invoice.amount_paid,
            )),
        "/v1/invoices/in_first": invoice,
        ...stripe,
      }),
    );
    return kind === "renewal" ? invoice : undefined;
  }

  type Row = [
    name: string,
    kind: Kind,
    bill: object,
    stripe: object,
    code: string,
    retryable?: boolean,
  ];
  const charge = (fields: object): Row => [
    `a charge with ${JSON.stringify(fields)}`,
    "intent",
    {},
    { "/v1/charges/ch_test": { ...paidCharge, ...fields } },
    "STRIPE_CHARGE_MISMATCH",
  ];
  const unsupported = (
    name: string,
    bill: object,
    kind: Kind = "invoice",
  ): Row => [name, kind, bill, {}, "STRIPE_INVOICE_UNSUPPORTED"];
  const amount = (name: string, bill: object, kind: Kind = "invoice"): Row => [
    name,
    kind,
    bill,
    {},
    "STRIPE_AMOUNT_MISMATCH",
  ];

  it.each<Row>([
    [
      "an unfinished PaymentIntent",
      "intent",
      {},
      {
        "/v1/payment_intents/pi_test": { ...paidIntent, status: "processing" },
      },
      "STRIPE_PAYMENT_PENDING",
      true,
    ],
    [
      "a PaymentIntent that pays an invoice",
      "intent",
      {},
      { "/v1/payment_intents/pi_test": { ...paidIntent, invoice: "in_other" } },
      "STRIPE_PAYMENT_REFERENCE_MISMATCH",
    ],
    [
      "a live-mode PaymentIntent",
      "intent",
      {},
      { "/v1/payment_intents/pi_test": { ...paidIntent, livemode: true } },
      "STRIPE_ENVIRONMENT_MISMATCH",
    ],
    charge({ captured: false }),
    charge({ paid: false }),
    charge({ payment_intent: "pi_other" }),
    charge({ currency: "usd" }),
    charge({ amount_captured: 900 }),
    [
      "an open invoice",
      "invoice",
      { status: "open" },
      {},
      "STRIPE_PAYMENT_PENDING",
      true,
    ],
    unsupported("an invoice paid outside Stripe", { paid_out_of_band: true }),
    unsupported("a charged invoice without a PaymentIntent", {
      payment_intent: null,
    }),
    unsupported("a first invoice billed as a renewal", {
      billing_reason: "subscription_cycle",
    }),
    unsupported(
      "a plan change billed as a new subscription",
      { billing_reason: "subscription_create" },
      "change",
    ),
    unsupported("a truncated line list", {
      lines: { ...first.lines, has_more: true },
    }),
    unsupported("two subscription lines", lines({}, {})),
    unsupported("two units", lines({ quantity: 2 })),
    unsupported("an empty period", lines({ period: { start, end: start } })),
    unsupported(
      "a plan change with a plain invoice item",
      {
        billing_reason: "subscription_update",
        ...lines({ type: "invoiceitem" }),
      },
      "change",
    ),
    amount("an invoice in another currency", { currency: "usd" }),
    amount("an invoice paid beyond its total", { amount_paid: 1200 }),
    [
      "a charge that captured less than the invoice",
      "invoice",
      {},
      paidWith("pi_test", "ch_test", "in_first", start, 900),
      "STRIPE_AMOUNT_MISMATCH",
    ],
    amount("a net amount the checkout didn't register", {
      total: 1100,
      amount_paid: 1100,
    }),
    amount("a tax amount the checkout didn't register", {
      total: 900,
      amount_paid: 900,
      tax: 100,
    }),
    amount(
      "a renewal that taxes more than it bills",
      { total: 100, amount_paid: 100, tax: 200 },
      "renewal",
    ),
    [
      "a renewal of another subscription",
      "renewal",
      { subscription: "sub_other" },
      {},
      "STRIPE_SUBSCRIPTION_MISMATCH",
    ],
  ])(
    "rejects %s",
    async (_name, kind, bill, stripe, code, retryable = false) => {
      const checkout = (await checkouts())[kind];
      const invoice = paidFetch(kind, bill, stripe);
      await expect(
        new Stripe(integration).payment(checkout, invoice),
      ).rejects.toMatchObject({ code, retryable });
    },
  );

  it("reads the latest line, a credit's tax and only succeeded refunds", async () => {
    const { intent, change } = await checkouts();
    const stripe = new Stripe(integration);
    const later = { start, end: period.end + 86_400 };
    paidFetch("change", {
      billing_reason: "subscription_update",
      ...lines(
        { type: "invoiceitem", proration: true, period: later },
        { type: "invoiceitem", proration: true },
      ),
    });
    expect((await stripe.payment(change)).fact.subscription).toMatchObject({
      end: later.end * 1000,
    });

    // A downgrade's credit invoice carries negative tax and bills nothing.
    paidFetch("change", {
      billing_reason: "subscription_update",
      total: -300,
      tax: -60,
      amount_paid: 0,
      payment_intent: null,
    });
    const free = { ...change.price, netMinor: 0, taxMinor: 0 };
    expect(
      (await stripe.payment({ ...change, price: free })).fact,
    ).toMatchObject({ price: free, subscription: { billed: false } });

    const refund = { charge: "ch_test", currency: "eur", created: start };
    paidFetch(
      "intent",
      {},
      {
        "/v1/charges/ch_test": { ...paidCharge, amount_refunded: 250 },
        "/v1/refunds": {
          has_more: false,
          data: [
            { ...refund, id: "re_part", status: "succeeded", amount: 250 },
            { ...refund, id: "re_failed", status: "failed", amount: 100 },
          ],
        },
      },
    );
    expect((await stripe.payment(intent)).refunds).toEqual([
      expect.objectContaining({ reference: "re_part", amount: 250 }),
    ]);
  });

  it("stops reading a refund history that keeps paging", async () => {
    const { intent } = await checkouts();
    const stripe = stripeFetch({
      "/v1/charges/ch_test": { ...paidCharge, amount_refunded: 250 },
    });
    let pages = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        new URL(url).pathname === "/v1/refunds"
          ? Response.json({
              // The sixth page ends the list, so a missing limit can't hang.
              has_more: ++pages < 6,
              data: [
                {
                  id: `re_${pages}`,
                  status: "succeeded",
                  charge: "ch_test",
                  amount: 1,
                  currency: "eur",
                  created: start,
                },
              ],
            })
          : stripe(url),
      ),
    );
    await expect(new Stripe(integration).payment(intent)).rejects.toMatchObject(
      {
        code: "STRIPE_REFUND_HISTORY_UNSUPPORTED",
        retryable: false,
      },
    );
    expect(pages).toBe(3);
  });

  it.each([
    [
      "refund",
      "re_zero",
      { status: "succeeded", amount: 0 },
      "STRIPE_REFUND_INVALID",
      false,
    ],
    [
      "refund",
      "re_wait",
      { status: "pending", amount: 250 },
      "STRIPE_REFUND_PENDING",
      true,
    ],
    [
      "dispute",
      "du_zero",
      dispute("du_zero", "lost", 0),
      "STRIPE_DISPUTE_INVALID",
      false,
    ],
  ] as const)(
    "rejects the %s %s",
    async (kind, id, fields, code, retryable) => {
      vi.stubGlobal(
        "fetch",
        stripeFetch({
          [`/v1/${kind}s/${id}`]: {
            id,
            charge: "ch_test",
            currency: "eur",
            created: start,
            ...fields,
          },
        }),
      );
      await expect(new Stripe(integration)[kind](id)).rejects.toMatchObject({
        code,
        retryable,
      });
    },
  );

  it.each([
    [404, true],
    [429, true],
    [500, true],
    [403, false],
  ])("retries a Stripe %i only when it can pass", async (status, retryable) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status })),
    );
    await expect(new Stripe(integration).verifyAccount()).rejects.toMatchObject(
      { code: `STRIPE_HTTP_${status}`, retryable },
    );
  });

  it("rejects another Stripe account, mode, and an invoice event's charge", async () => {
    vi.stubGlobal(
      "fetch",
      stripeFetch({ "/v1/account": { id: "acct_other" } }),
    );
    await expect(new Stripe(integration).verifyAccount()).rejects.toMatchObject(
      { code: "STRIPE_ACCOUNT_MISMATCH" },
    );

    const paid = event("invoice.paid", "in_first", "evt_paid", {
      charge: "ch_test",
    });
    const read = (fields: object = {}) =>
      stripeEvent(paid.raw, paid.signature, { ...integration, ...fields });
    expect(read()).toMatchObject({ reference: "in_first" });
    expect(read()?.charge).toBeUndefined();
    for (const other of [
      { environment: "production" },
      { accountId: "acct_other" },
    ])
      expect(() => read(other)).toThrow("does not match this integration");
  });
});

describe("store report and job guards", () => {
  const DAY = 86_400_000;
  const start = now / 1000;
  const period = { start, end: start + 30 * 86_400 };
  const invoiceInput = {
    ...input,
    payment: {
      ...input.payment,
      kind: "invoice" as const,
      reference: "in_first",
    },
  };
  type Kit = Awaited<ReturnType<typeof fixture>>;
  type Token = Doc<"externalPurchaseTokens">;
  type Refund = Extract<
    Doc<"externalCheckoutJobs">["task"],
    { kind: "refund" }
  >;
  const refunded = (reference: string, amount: number) => ({
    reference,
    chargeId: "ch_test",
    amount,
    currency: "EUR",
    at: now + 1000,
  });

  // A checkout whose Stripe payment is verified, with what its report reads.
  async function verified(kit: Kit, body: CheckoutInput = input) {
    vi.stubGlobal("fetch", stripeFetch());
    const { checkoutId } = await kit.create("first", body);
    await kit.t.action(external.verify, { apiKey: kit.apiKey, checkoutId });
    await kit.run("verify");
    const payment = (await kit.t.run((ctx) =>
      ctx.db.query("externalCheckoutPayments").first(),
    ))!;
    const context = (await kit.t.query(state.reportContext, {
      paymentId: payment._id,
    }))!;
    return { ...kit, checkoutId, ...context };
  }

  // An Apple checkout bound to one of the user's two one-use tokens.
  async function appleCheckout(fields: Partial<Token> = {}) {
    const kit = await fixture();
    const register = (externalId: string, createdAt: number) =>
      kit.t.mutation(state.registerToken, {
        projectId: kit.projectId,
        profileId: appleProfile.id,
        userId: input.userId,
        externalId,
        createdAt,
      });
    const { tokenId } = await register("SANDBOX_one", now - 1000);
    await register("SANDBOX_spare", now - 2000);
    await kit.t.run((ctx) => ctx.db.patch(tokenId, fields));
    return verified(kit, {
      ...input,
      reporting: {
        store: "apple",
        profileId: appleProfile.id,
        tokenIds: [tokenId],
      },
    });
  }

  // How a queued job ends when run: done, waiting, retrying, or its final error.
  async function outcome(
    kit: Pick<Kit, "t" | "run">,
    ...job: Parameters<Kit["run"]>
  ) {
    const jobId = await kit.run(...job);
    const { dueAt, lastError } = (await kit.t.run((ctx) => ctx.db.get(jobId)))!;
    if (dueAt === undefined) return lastError ?? "done";
    return lastError ? `retry ${lastError}` : "waiting";
  }

  // Play answering every call with the transaction, or failing with a status.
  function play(data: object = {}, status?: number) {
    const answer = async (args: {
      name?: string;
      externalTransactionId?: string;
    }) => {
      if (status)
        throw Object.assign(new Error("failed"), { response: { status } });
      return {
        data: {
          externalTransactionId:
            args.externalTransactionId ?? args.name?.split("/").pop(),
          packageName: "dev.fixture",
          testPurchase: {},
          ...data,
        },
      };
    };
    return {
      createexternaltransaction: vi.fn(answer),
      getexternaltransaction: vi.fn(answer),
      refundexternaltransaction: vi.fn(answer),
    };
  }

  it("builds each Apple line from the payment, its token, and its refund", async () => {
    const { checkout, transaction, appleToken, initial, root } =
      await appleCheckout();
    const token = appleToken!;
    const purchase = buildAppleReport(
      checkout,
      transaction,
      token,
      initial,
      root,
    );
    expect(purchase).toMatchObject({
      externalPurchaseId: "SANDBOX_one",
      lineItems: [{ productType: "ONE_TIME_BUY", creationDate: now }],
    });
    // A token issued within the second Stripe rounds the payment to dates it.
    expect(
      buildAppleReport(
        checkout,
        transaction,
        { ...token, createdAt: now + 500 },
        initial,
        root,
      ).lineItems,
    ).toMatchObject([{ creationDate: now + 500 }]);
    const refund = buildAppleReport(
      checkout,
      transaction,
      token,
      initial,
      root,
      {
        kind: "refund",
        paymentId: transaction._id,
        refund: refunded("re_part", 250),
        netMinor: 200,
        taxMinor: 50,
        before: 0,
        refundedNet: 200,
        full: false,
      },
    );
    expect(refund.lineItems).toMatchObject([
      {
        eventType: "REFUND",
        creationDate: now + 1000,
        netAmountTaxExclusive: 6000,
      },
    ]);
    expect(refund.requestIdentifier).not.toBe(purchase.requestIdentifier);
  });

  it.each([
    ["looks up a retried report Apple answers 400 for, then sends it", true],
    ["accepts a 400 for a report Apple already holds", false],
  ])("%s", async (_, retry) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    await sendAppleReport(
      "https://example.test/reports",
      "jwt",
      {
        requestIdentifier: "request",
        externalPurchaseId: "token",
        status: "NO_LINE_ITEM",
      },
      retry,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["UNRECOGNIZED_TOKEN", {}],
    ["NO_LINE_ITEM", { accountErased: true }],
  ])("reports an unused Apple token as %s", async (status, fields) => {
    const kit = await fixture();
    const fetch = vi.fn().mockImplementation(async () => Response.json({}));
    vi.stubGlobal("fetch", fetch);
    vi.mocked(getAppStoreServerCredentials).mockResolvedValueOnce({
      issuerId: "issuer",
      keyId: "key",
      privateKey: generateKeyPairSync("ec", { namedCurve: "P-256" })
        .privateKey.export({ type: "pkcs8", format: "pem" })
        .toString(),
    });
    const { tokenId } = await kit.t.mutation(state.registerToken, {
      projectId: kit.projectId,
      profileId: appleProfile.id,
      externalId: "SANDBOX_unused",
      createdAt: now - 1000,
    });
    await kit.t.run((ctx) => ctx.db.patch(tokenId, fields));
    expect(await outcome(kit, "appleToken", tokenId)).toBe("done");
    expect(fetch.mock.lastCall?.[1]).toMatchObject({
      body: expect.stringContaining(`"${status}"`),
    });
  });

  it("never reports a production token through a sandbox integration", async () => {
    const kit = await fixture();
    const { tokenId } = await kit.t.mutation(state.registerToken, {
      projectId: kit.projectId,
      profileId: appleProfile.id,
      externalId: "LIVE_token",
      createdAt: now - 1000,
    });
    expect(await outcome(kit, "appleToken", tokenId)).toBe(
      "APPLE_ENVIRONMENT_MISMATCH",
    );
  });

  it.each([
    ["a duplicate", { duplicate: true }],
    ["issued after the payment", { createdAt: now + 1000 }],
    ["expired by the payment", { expiresAt: now }],
  ])("reports no Apple token that is %s", async (_, fields) => {
    const kit = await appleCheckout(fields);
    expect(kit.transaction.appleTokenId).toBeUndefined();
    expect(await outcome(kit, "purchase")).toBe("APPLE_TOKEN_MISSING");
    expect(
      await kit.t.action(external.get, {
        apiKey: kit.apiKey,
        checkoutId: kit.checkoutId,
      }),
    ).toMatchObject({ reportingStatus: "action_required" });
  });

  it("sends Google the tax address and needs the token for a first purchase", async () => {
    const { checkout, transaction } = await verified(await fixture());
    const india = {
      ...transaction,
      fact: {
        ...transaction.fact,
        price: { ...transaction.fact.price, regionCode: "IN" },
      },
    };
    const karnataka = { ...profile, administrativeArea: "KA" };
    expect(
      buildGooglePurchase(checkout, india, india, "token", karnataka)
        .userTaxAddress,
    ).toEqual({ regionCode: "IN", administrativeArea: "KA" });
    expect(
      buildGooglePurchase(
        checkout,
        transaction,
        transaction,
        "token",
        karnataka,
      ).userTaxAddress,
    ).toEqual({ regionCode: "DE" });
    expect(() =>
      buildGooglePurchase(
        checkout,
        transaction,
        transaction,
        undefined,
        profile,
      ),
    ).toThrow("GOOGLE_TOKEN_MISSING");
  });

  it("stops a Google report the store's record disagrees with", async () => {
    const { checkout, transaction, initial } = await verified(await fixture());
    const send = (api: ReturnType<typeof play>, refund?: Refund) =>
      sendGoogleReport(
        api,
        "dev.fixture",
        integration,
        checkout,
        transaction,
        initial,
        "opaque",
        profile,
        refund,
      );
    await expect(send(play({ testPurchase: undefined }))).rejects.toMatchObject(
      { code: "GOOGLE_REPORT_MISMATCH", retryable: false },
    );
    await expect(
      send(
        play({
          currentPreTaxAmount: { currency: "EUR", priceMicros: "7000000" },
        }),
        {
          kind: "refund",
          paymentId: transaction._id,
          refund: refunded("re_part", 250),
          netMinor: 200,
          taxMinor: 50,
          before: 0,
          refundedNet: 200,
          full: false,
        },
      ),
    ).rejects.toMatchObject({
      code: "GOOGLE_REFUND_RECONCILIATION_REQUIRED",
      retryable: false,
    });
    await expect(send(play({}, 404))).rejects.toMatchObject({
      code: "GOOGLE_REPORT_404",
      retryable: true,
    });
    await expect(send(play({}, 403))).rejects.toMatchObject({
      code: "GOOGLE_REPORT_403",
      retryable: false,
    });
  });

  it("retries a report with backoff for a week and ignores a stale attempt", async () => {
    const { t, jobs, checkoutId, transaction } = await verified(
      await fixture(),
    );
    const jobId = (await jobs()).find(
      (job) => job.task.kind === "purchase",
    )!._id;
    await t.run((ctx) => ctx.db.patch(jobId, { attempts: 2, startedAt: now }));
    const finish = (attempt: number, outcome: "done" | "retry") =>
      t.mutation(state.finish, { jobId, attempt, outcome });
    const dueAt = async () => (await t.run((ctx) => ctx.db.get(jobId)))?.dueAt;

    await finish(1, "done");
    expect((await t.run((ctx) => ctx.db.get(transaction._id)))?.reported).toBe(
      false,
    );
    vi.setSystemTime(now + 6 * DAY);
    await finish(2, "retry");
    expect(await dueAt()).toBe(now + 6 * DAY + 60_000);
    vi.setSystemTime(now + week);
    await finish(2, "retry");
    expect(await dueAt()).toBeUndefined();
    expect(
      (await t.run((ctx) => ctx.db.get(checkoutId)))?.reportingStatus,
    ).toBe("action_required");
  });

  it("reports refunds in the order Stripe made them and drops the Google token once used", async () => {
    const kit = await verified(await fixture());
    const { t, jobs, checkoutId, transaction } = kit;
    expect(kit.checkout.googleToken).toBeDefined();
    for (const [reference, amount] of Object.entries(refunds))
      await t.mutation(state.applyRefund, {
        integrationId: integration.id,
        refund: refunded(reference, amount),
      });
    // Marks the job that reports this payment or refund as sent.
    const done = async (key: string) => {
      const job = (await jobs()).find((job) => job.key.endsWith(key))!;
      await t.mutation(state.finish, {
        jobId: job._id,
        attempt: job.attempts,
        outcome: "done",
      });
    };

    await done(transaction._id);
    expect(
      (await t.run((ctx) => ctx.db.get(checkoutId)))?.googleToken,
    ).toBeUndefined();
    expect(await outcome(kit, "refund", "re_rest")).toBe("waiting");
    await done("re_part");
    await done("re_rest");
    expect(
      (await t.run((ctx) => ctx.db.get(transaction._id)))?.reportedRefunded,
    ).toBe(1000);
  });

  it("leaves a verified checkout's verify job finished", async () => {
    const { t, jobs, apiKey, checkoutId } = await verified(await fixture());
    await t.action(external.verify, { apiKey, checkoutId });
    expect(
      (await jobs()).find((job) => job.task.kind === "verify")?.dueAt,
    ).toBeUndefined();
  });

  it("keeps the latest renewal when an earlier one arrives late", async () => {
    const kit = await fixture();
    const { checkoutId } = await kit.create("first", invoiceInput);
    const pay = (reference: string, months: number) => {
      const paidAt = now + months * 30 * DAY;
      return kit.t.mutation(state.applyPayment, {
        checkoutId,
        refunds: [],
        fact: {
          reference,
          chargeId: `ch_${reference}`,
          price: input.price,
          paidAt,
          subscription: {
            id: "sub_test",
            start: paidAt,
            end: paidAt + 30 * DAY,
            billed: true,
          },
        },
      });
    };
    await pay("in_first", 0);
    await pay("in_third", 2);
    await pay("in_second", 1);

    const checkout = (await kit.t.run((ctx) => ctx.db.get(checkoutId)))!;
    const latest = (await kit.t.run((ctx) =>
      ctx.db.get(checkout.latestPaymentId!),
    ))!;
    expect(checkout).toMatchObject({
      latestPaidAt: now + 60 * DAY,
      expiresAt: now + 90 * DAY,
    });
    expect(latest.fact.reference).toBe("in_third");
    // A renewal is reported only after the purchase that started it.
    expect(await outcome(kit, "purchase", latest._id)).toBe("waiting");
  });

  it("splits a refund between net and tax and rejects one the payment can't cover", async () => {
    const { t, jobs, checkoutId } = await verified(await fixture());
    const refund = (reference: string, amount: number, currency = "EUR") =>
      t.mutation(state.applyRefund, {
        integrationId: integration.id,
        refund: { ...refunded(reference, amount), currency },
      });

    await refund("re_zero", 0);
    expect((await jobs()).map((job) => job.task.kind)).not.toContain("refund");
    expect((await t.run((ctx) => ctx.db.get(checkoutId)))?.paymentStatus).toBe(
      "paid",
    );
    await refund("re_one", 1);
    expect((await jobs()).at(-1)?.task).toMatchObject({
      netMinor: 1,
      taxMinor: 0,
    });
    for (const rejected of [
      refund("re_over", 1000),
      refund("re_usd", 100, "USD"),
    ])
      await expect(rejected).rejects.toThrow(
        "Stripe refund differs from verified payment",
      );
  });

  it("fails a Stripe event whose integration now belongs to another project", async () => {
    const kit = await fixture();
    vi.stubGlobal("fetch", stripeFetch());
    await kit.create();
    await kit.t.action(
      external.ingestStripe,
      event("payment_intent.succeeded", "pi_test", "evt_moved"),
    );
    vi.stubEnv(
      "IAPKIT_EXTERNAL_CHECKOUTS_CONFIG",
      JSON.stringify({
        integrations: [{ ...integration, projectId: "another" }],
        profiles: [profile, appleProfile],
      }),
    );
    expect(await outcome(kit, "stripe", "evt_moved")).toBe(
      "STRIPE_INTEGRATION_MISSING",
    );
  });

  it("fails an invoice event Stripe answers with another invoice", async () => {
    const kit = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/invoices/in_first": subscriptionInvoice("in_other", period),
      }),
    );
    await kit.create("first", invoiceInput);
    await kit.t.action(
      external.ingestStripe,
      event("invoice.paid", "in_first", "evt_first"),
    );
    expect(await outcome(kit, "stripe", "evt_first")).toBe(
      "STRIPE_INVOICE_MISMATCH",
    );
  });

  it("holds a paid invoice until a checkout claims it", async () => {
    const kit = await fixture();
    vi.stubGlobal(
      "fetch",
      stripeFetch({
        "/v1/invoices/in_stray": {
          ...subscriptionInvoice("in_stray", period),
          subscription: "sub_stray",
        },
      }),
    );
    await kit.t.action(
      external.ingestStripe,
      event("invoice.paid", "in_stray", "evt_stray"),
    );
    expect(await outcome(kit, "stripe", "evt_stray")).toBe("waiting");
  });
});
