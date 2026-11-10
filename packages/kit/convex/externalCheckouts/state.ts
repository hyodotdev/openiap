import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  disputePrefixes,
  fail,
  payment,
  paymentEvents,
  paymentFact,
  price,
  refundFact,
  total,
} from "./model";
import { verificationJobCiphertext } from "../purchases/verificationJobModel";

import type { RefundFact } from "./model";
import { isUserErasureRequested } from "../subscriptions/erasure";

type Checkout = Doc<"externalCheckouts">;
type Job = Doc<"externalCheckoutJobs">;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// The whole days that periods cover before a time, counting overlaps once.
function coveredDays(
  periods: { start: number; end: number }[],
  before: number,
) {
  let covered = 0;
  let reached = -Infinity;
  for (const { start, end } of periods.sort((a, b) => a.start - b.start)) {
    const to = Math.min(end, before);
    covered += Math.max(0, to - Math.max(start, reached));
    reached = Math.max(reached, to);
  }
  return Math.floor(covered / DAY);
}

function findJob(ctx: MutationCtx, projectId: Id<"projects">, key: string) {
  return ctx.db
    .query("externalCheckoutJobs")
    .withIndex("by_project_key", (q) =>
      q.eq("projectId", projectId).eq("key", key),
    )
    .unique();
}

function checkoutFor(
  ctx: QueryCtx,
  integrationId: string,
  kind: Checkout["payment"]["kind"],
  reference: string,
) {
  return ctx.db
    .query("externalCheckouts")
    .withIndex("by_integration_payment", (q) =>
      q
        .eq("integrationId", integrationId)
        .eq("payment.kind", kind)
        .eq("payment.reference", reference),
    )
    .unique();
}

function paymentByReference(
  ctx: QueryCtx,
  integrationId: string,
  reference: string,
) {
  return ctx.db
    .query("externalCheckoutPayments")
    .withIndex("by_integration_reference", (q) =>
      q.eq("integrationId", integrationId).eq("fact.reference", reference),
    )
    .first();
}

function paymentFor(ctx: QueryCtx, integrationId: string, chargeId: string) {
  return ctx.db
    .query("externalCheckoutPayments")
    .withIndex("by_integration_charge", (q) =>
      q.eq("integrationId", integrationId).eq("fact.chargeId", chargeId),
    )
    .unique();
}

// The checkouts of one subscription, from this one back to its first.
async function lineage(ctx: QueryCtx, checkout: Checkout) {
  const checkouts = [checkout];
  let id = checkout.previousCheckoutId;
  while (id) {
    const previous = await ctx.db.get(id);
    if (!previous) break;
    checkouts.push(previous);
    id = previous.previousCheckoutId;
  }
  return checkouts;
}

// Runs a finished job again from its first attempt.
async function restart(ctx: MutationCtx, job: Job | null) {
  if (job && job.dueAt === undefined)
    await ctx.db.patch(job._id, {
      dueAt: Date.now(),
      attempts: 0,
      startedAt: undefined,
      lastError: undefined,
    });
}

async function enqueue(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  key: string,
  work: Job["task"],
  dueAt = Date.now(),
) {
  if (await findJob(ctx, projectId, key)) return false;
  await ctx.db.insert("externalCheckoutJobs", {
    projectId,
    key,
    task: work,
    dueAt,
    attempts: 0,
  });
  return true;
}

export const registerToken = internalMutation({
  args: {
    projectId: v.id("projects"),
    profileId: v.string(),
    userId: v.optional(v.string()),
    externalId: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    tokenType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.pendingDeletion)
      fail("NOT_FOUND", "Project not found");
    if (
      args.userId &&
      (await isUserErasureRequested(ctx, project, args.userId))
    )
      fail("NOT_FOUND", "App user is unavailable");
    const previous = await ctx.db
      .query("externalPurchaseTokens")
      .withIndex("by_project_external", (q) =>
        q.eq("projectId", args.projectId).eq("externalId", args.externalId),
      )
      .unique();
    if (previous) {
      if (
        args.userId &&
        previous.userId &&
        (previous.userId !== args.userId ||
          previous.profileId !== args.profileId)
      )
        fail(
          "IDEMPOTENCY_CONFLICT",
          "External purchase token is already bound",
        );
      if (args.userId && previous.accountErased)
        fail("NOT_FOUND", "External purchase token is unavailable");
      if (args.userId && !previous.userId)
        await ctx.db.patch(previous._id, { ...args, duplicate: false });
      // Apple notifies about tokens it has no report for, so an unused
      // token's finished report runs again.
      if (!args.userId && !previous.used)
        await restart(
          ctx,
          await findJob(ctx, args.projectId, `apple:${previous._id}`),
        );
      return { tokenId: previous._id, deduped: true };
    }
    const custom =
      args.expiresAt !== undefined &&
      ["SERVICES", "ACQUISITION"].includes(args.tokenType ?? "");
    const period =
      custom && args.userId
        ? await ctx.db
            .query("externalPurchaseTokens")
            .withIndex("by_period", (q) =>
              q
                .eq("projectId", args.projectId)
                .eq("profileId", args.profileId)
                .eq("userId", args.userId)
                .eq("createdAt", args.createdAt)
                .eq("tokenType", args.tokenType),
            )
            .first()
        : null;
    const duplicate = !!period && period.expiresAt === args.expiresAt;
    const tokenId = await ctx.db.insert("externalPurchaseTokens", {
      ...args,
      duplicate,
      used: false,
    });
    const due =
      !args.userId || duplicate
        ? Date.now()
        : (args.expiresAt ?? args.createdAt + 10 * DAY);
    await enqueue(
      ctx,
      args.projectId,
      `apple:${tokenId}`,
      { kind: "appleToken", tokenId },
      due,
    );
    return { tokenId, deduped: false };
  },
});

export const create = internalMutation({
  args: {
    projectId: v.id("projects"),
    integrationId: v.string(),
    profileId: v.string(),
    store: v.union(v.literal("apple"), v.literal("google")),
    orderId: v.string(),
    userId: v.string(),
    productId: v.string(),
    payment,
    price,
    key: v.string(),
    requestHash: v.string(),
    appleTokenIds: v.optional(v.array(v.string())),
    googleToken: v.optional(verificationJobCiphertext),
    googleTokenHash: v.optional(v.string()),
    changeOf: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { key, appleTokenIds, changeOf, ...checkout } = args;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.pendingDeletion)
      fail("NOT_FOUND", "Project not found");
    if (await isUserErasureRequested(ctx, project, args.userId))
      fail("NOT_FOUND", "App user is unavailable");
    const previous = await ctx.db
      .query("externalCheckoutKeys")
      .withIndex("by_project_key", (q) =>
        q.eq("projectId", args.projectId).eq("key", key),
      )
      .unique();
    if (previous) {
      if (previous.requestHash !== args.requestHash)
        fail("IDEMPOTENCY_CONFLICT", "Idempotency key was already used");
      return previous.checkoutId;
    }
    const order = await ctx.db
      .query("externalCheckouts")
      .withIndex("by_project_order", (q) =>
        q.eq("projectId", args.projectId).eq("orderId", args.orderId),
      )
      .unique();
    if (order && order.requestHash !== args.requestHash)
      fail("IDEMPOTENCY_CONFLICT", "Order was already registered");
    if (order) {
      await ctx.db.insert("externalCheckoutKeys", {
        projectId: args.projectId,
        key,
        requestHash: args.requestHash,
        checkoutId: order._id,
      });
      return order._id;
    }
    const reference = await checkoutFor(
      ctx,
      args.integrationId,
      args.payment.kind,
      args.payment.reference,
    );
    if (reference)
      fail("IDEMPOTENCY_CONFLICT", "Stripe payment was already registered");
    if (args.googleTokenHash) {
      const token = await ctx.db
        .query("externalCheckouts")
        .withIndex("by_project_token", (q) =>
          q
            .eq("projectId", args.projectId)
            .eq("googleTokenHash", args.googleTokenHash),
        )
        .first();
      if (token)
        fail("IDEMPOTENCY_CONFLICT", "Google token was already registered");
    }
    let previousCheckoutId: Id<"externalCheckouts"> | undefined;
    if (changeOf !== undefined) {
      const id = ctx.db.normalizeId("externalCheckouts", changeOf);
      const previous = id && (await ctx.db.get(id));
      // A plan change continues the user's current subscription in the same
      // reporting profile.
      if (
        !previous ||
        previous.projectId !== args.projectId ||
        previous.userId !== args.userId ||
        previous.profileId !== args.profileId ||
        previous.integrationId !== args.integrationId ||
        !previous.subscriptionId ||
        previous.replacedBy
      )
        fail("INVALID_INPUT", "Plan change needs a current subscription");
      previousCheckoutId = previous._id;
    }
    const normalized = [];
    for (const raw of appleTokenIds ?? []) {
      const id = ctx.db.normalizeId("externalPurchaseTokens", raw);
      const token = id && (await ctx.db.get(id));
      if (
        !token ||
        token.projectId !== args.projectId ||
        token.profileId !== args.profileId ||
        token.userId !== args.userId
      )
        fail("INVALID_INPUT", "Apple token does not belong to this checkout");
      normalized.push(token._id);
    }
    const checkoutId = await ctx.db.insert("externalCheckouts", {
      ...checkout,
      previousCheckoutId,
      appleTokenIds: normalized.length ? normalized : undefined,
      paymentStatus: "pending",
      reportingStatus: "pending",
      active: false,
      pendingReports: 0,
      retryingReports: 0,
      failedReports: 0,
    });
    await ctx.db.insert("externalCheckoutKeys", {
      projectId: args.projectId,
      key,
      requestHash: args.requestHash,
      checkoutId,
    });
    return checkoutId;
  },
});

export const get = internalQuery({
  args: { projectId: v.id("projects"), checkoutId: v.string() },
  handler: async (ctx, { projectId, checkoutId }) => {
    const id = ctx.db.normalizeId("externalCheckouts", checkoutId);
    const checkout = id && (await ctx.db.get(id));
    return checkout && checkout.projectId === projectId ? checkout : null;
  },
});

export const verify = internalMutation({
  args: { checkoutId: v.id("externalCheckouts"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const checkout = await ctx.db.get(args.checkoutId);
    if (!checkout || checkout.projectId !== args.projectId)
      fail("NOT_FOUND", "Checkout not found");
    if (checkout.initialPaymentId) return;
    const key = `verify:${checkout._id}`;
    if (
      !(await enqueue(ctx, args.projectId, key, {
        kind: "verify",
        checkoutId: checkout._id,
      }))
    )
      await restart(ctx, await findJob(ctx, args.projectId, key));
  },
});

export const stripeEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    integrationId: v.string(),
    eventId: v.string(),
    event: v.string(),
    reference: v.string(),
    charge: v.optional(v.string()),
    bound: v.boolean(),
  },
  handler: async (ctx, { projectId, eventId, bound, ...work }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.pendingDeletion) return false;
    // The account also carries payments IAPKit never registered. A
    // PaymentIntent is skipped unless it carries a checkout binding or a
    // checkout references it; refunds and disputes wait for their payment.
    if (
      paymentEvents[work.event] === "payment_intent" &&
      !bound &&
      !(await checkoutFor(
        ctx,
        work.integrationId,
        "payment_intent",
        work.reference,
      ))
    )
      return false;
    return enqueue(ctx, projectId, `stripe:${work.integrationId}:${eventId}`, {
      kind: "stripe",
      ...work,
    });
  },
});

export const dispatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const jobs = await ctx.db
      .query("externalCheckoutJobs")
      .withIndex("by_due", (q) => q.gt("dueAt", undefined).lte("dueAt", now))
      .take(32);
    for (const job of jobs) {
      const attempt = job.attempts + 1;
      await ctx.db.patch(job._id, {
        dueAt: now + 12 * 60_000,
        attempts: attempt,
        startedAt: job.startedAt ?? now,
      });
      await ctx.scheduler.runAfter(0, internal.externalCheckouts.action.run, {
        jobId: job._id,
        attempt,
      });
    }
  },
});

export const work = internalQuery({
  args: { jobId: v.id("externalCheckoutJobs"), attempt: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.attempts !== args.attempt || job.dueAt === undefined)
      return null;
    const project = await ctx.db.get(job.projectId);
    if (!project || project.pendingDeletion) return null;
    return { job, project };
  },
});

export const hasPayment = internalQuery({
  args: { integrationId: v.string(), charge: v.string() },
  handler: async (ctx, args) =>
    !!(await paymentFor(ctx, args.integrationId, args.charge)),
});

export const paymentTarget = internalQuery({
  args: {
    integrationId: v.string(),
    kind: payment.fields.kind,
    reference: v.string(),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const initial = await checkoutFor(
      ctx,
      args.integrationId,
      args.kind,
      args.reference,
    );
    if (initial || !args.subscriptionId) return initial;
    return ctx.db
      .query("externalCheckouts")
      .withIndex("by_integration_subscription", (q) =>
        q
          .eq("integrationId", args.integrationId)
          .eq("subscriptionId", args.subscriptionId),
      )
      .unique();
  },
});

function reportStatus(
  pending: number,
  retrying: number,
  failed: number,
): Checkout["reportingStatus"] {
  if (failed) return "action_required";
  if (retrying) return "retrying";
  return pending ? "queued" : "reported";
}

// Leaves a Stripe invoice or refund IAPKit couldn't verify for a manual
// report, or clears that once it is verified.
async function markUnverified(
  ctx: MutationCtx,
  checkout: Checkout,
  reference: string,
  unverified: boolean,
): Promise<Checkout> {
  const listed = checkout.unverified ?? [];
  if (listed.includes(reference) === unverified) return checkout;
  const failedReports = checkout.failedReports + (unverified ? 1 : -1);
  const changes = {
    unverified: unverified
      ? [...listed, reference]
      : listed.filter((item) => item !== reference),
    failedReports,
    reportingStatus: reportStatus(
      checkout.pendingReports,
      checkout.retryingReports,
      failedReports,
    ),
  };
  await ctx.db.patch(checkout._id, changes);
  return { ...checkout, ...changes };
}

async function addReport(
  ctx: MutationCtx,
  checkout: Checkout,
  key: string,
  work: Job["task"],
) {
  if (!(await enqueue(ctx, checkout.projectId, key, work))) return;
  const pendingReports = checkout.pendingReports + 1;
  await ctx.db.patch(checkout._id, {
    pendingReports,
    reportingStatus: reportStatus(
      pendingReports,
      checkout.retryingReports,
      checkout.failedReports,
    ),
  });
}

export const applyPayment = internalMutation({
  args: {
    checkoutId: v.id("externalCheckouts"),
    fact: paymentFact,
    refunds: v.array(refundFact),
  },
  handler: async (ctx, { checkoutId, fact, refunds }) => {
    const checkout = await ctx.db.get(checkoutId);
    if (!checkout) return;
    const project = await ctx.db.get(checkout.projectId);
    if (!project || project.pendingDeletion) return;
    const existing = await paymentByReference(
      ctx,
      checkout.integrationId,
      fact.reference,
    );
    if (existing) {
      if (existing.checkoutId !== checkoutId)
        fail("IDEMPOTENCY_CONFLICT", "Stripe payment was already bound");
      for (const refund of refunds)
        await recordRefund(ctx, checkout.integrationId, refund);
      return;
    }
    const initial = !checkout.initialPaymentId;
    if (initial && fact.reference !== checkout.payment.reference)
      fail("INVALID_INPUT", "Initial payment is missing");
    if (
      !initial &&
      (!fact.subscription || fact.subscription.id !== checkout.subscriptionId)
    )
      fail(
        "INVALID_INPUT",
        "Payment does not belong to the checkout subscription",
      );
    if (initial && fact.subscription) {
      const subscriptionId = fact.subscription.id;
      const linked = await ctx.db
        .query("externalCheckouts")
        .withIndex("by_integration_subscription", (q) =>
          q
            .eq("integrationId", checkout.integrationId)
            .eq("subscriptionId", subscriptionId),
        )
        .unique();
      // A plan change takes the subscription over from its previous checkout.
      if (
        checkout.previousCheckoutId
          ? linked?._id !== checkout.previousCheckoutId
          : linked
      )
        fail("IDEMPOTENCY_CONFLICT", "Stripe subscription was already bound");
    }

    let appleTokenId: Id<"externalPurchaseTokens"> | undefined;
    if (checkout.store === "apple") {
      const bound = await Promise.all(
        (checkout.appleTokenIds ?? []).map((id) => ctx.db.get(id)),
      );
      const custom = checkout.userId
        ? await ctx.db
            .query("externalPurchaseTokens")
            .withIndex("by_period", (q) =>
              q
                .eq("projectId", checkout.projectId)
                .eq("profileId", checkout.profileId)
                .eq("userId", checkout.userId)
                .lte("createdAt", fact.paidAt + 999),
            )
            .order("desc")
            .take(32)
        : [];
      const candidate = [
        ...bound,
        ...custom.filter((token) => token.expiresAt !== undefined),
      ]
        .filter(
          (token) =>
            token &&
            !token.duplicate &&
            token.createdAt <= fact.paidAt + 999 &&
            (token.expiresAt === undefined || token.expiresAt > fact.paidAt),
        )
        .sort(
          (a, b) =>
            Number(b?.tokenType === "SERVICES") -
            Number(a?.tokenType === "SERVICES"),
        )[0];
      appleTokenId = candidate?._id;
      if (appleTokenId) await ctx.db.patch(appleTokenId, { used: true });
    }

    // Apple counts the days before this period that billed periods cover,
    // across plan changes.
    let daysOfPaidService: number | undefined;
    if (fact.subscription) {
      const billed: { start: number; end: number }[] = [];
      for (const link of await lineage(ctx, checkout))
        for (const earlier of await ctx.db
          .query("externalCheckoutPayments")
          .withIndex("by_checkout_expiry", (q) =>
            q.eq("checkoutId", link._id).eq("fullyRefunded", false),
          )
          .collect())
          if (earlier.fact.subscription?.billed)
            billed.push(earlier.fact.subscription);
      daysOfPaidService = coveredDays(billed, fact.subscription.start);
    }

    const paymentId = await ctx.db.insert("externalCheckoutPayments", {
      projectId: checkout.projectId,
      integrationId: checkout.integrationId,
      checkoutId,
      fact,
      appleTokenId,
      daysOfPaidService,
      fullyRefunded: false,
      expiresAt: fact.subscription?.end,
      refunded: 0,
      refundedNet: 0,
      reported: false,
      reportedRefunded: 0,
    });
    const expiresAt =
      fact.subscription &&
      Math.max(checkout.expiresAt ?? 0, fact.subscription.end);
    const latest =
      !checkout.latestPaidAt || fact.paidAt >= checkout.latestPaidAt;
    const previous =
      initial && checkout.previousCheckoutId
        ? await ctx.db.get(checkout.previousCheckoutId)
        : null;
    if (previous) {
      await ctx.db.patch(previous._id, {
        subscriptionId: undefined,
        replacedBy: checkoutId,
        active: false,
      });
      // A change registered after its invoice was left for a manual report
      // is reported now instead.
      await markUnverified(ctx, previous, fact.reference, false);
    }
    await ctx.db.patch(checkoutId, {
      active: !!checkout.userId,
      expiresAt,
      latestPaidAt: latest ? fact.paidAt : checkout.latestPaidAt,
      ...(latest ? { paymentStatus: "paid", latestPaymentId: paymentId } : {}),
      ...(initial
        ? { initialPaymentId: paymentId, subscriptionId: fact.subscription?.id }
        : {}),
    });
    await addReport(ctx, checkout, `purchase:${paymentId}`, {
      kind: "purchase",
      paymentId,
    });
    for (const refund of refunds)
      await recordRefund(ctx, checkout.integrationId, refund);
  },
});

function refundByReference(
  ctx: QueryCtx,
  integrationId: string,
  reference: string,
) {
  return ctx.db
    .query("externalCheckoutRefunds")
    .withIndex("by_reference", (q) =>
      q.eq("integrationId", integrationId).eq("reference", reference),
    )
    .unique();
}

async function recordRefund(
  ctx: MutationCtx,
  integrationId: string,
  fact: RefundFact,
) {
  if (await refundByReference(ctx, integrationId, fact.reference)) return true;
  const transaction = await paymentFor(ctx, integrationId, fact.chargeId);
  if (!transaction) return false;
  const flagged = await ctx.db.get(transaction.checkoutId);
  if (!flagged) return false;
  const project = await ctx.db.get(flagged.projectId);
  if (!project || project.pendingDeletion) return false;
  // A refund recorded now needs no manual report, whichever event read it.
  const checkout = await markUnverified(ctx, flagged, fact.reference, false);
  const price = transaction.fact.price;
  const original = total(price);
  // A lost dispute can cover an amount already refunded; the customer gets
  // back at most what they paid.
  const refund = disputePrefixes.some((prefix) =>
    fact.reference.startsWith(prefix),
  )
    ? {
        ...fact,
        amount: Math.min(fact.amount, original - transaction.refunded),
      }
    : fact;
  const refunded = transaction.refunded + refund.amount;
  if (refunded > original || refund.currency !== price.currency)
    fail("INVALID_INPUT", "Stripe refund differs from verified payment");
  const refundedNet = Number(
    (BigInt(refunded) * BigInt(price.netMinor) +
      BigInt(Math.floor(original / 2))) /
      BigInt(original),
  );
  const netMinor = refundedNet - transaction.refundedNet;
  const full = refunded === original;
  await ctx.db.insert("externalCheckoutRefunds", {
    projectId: checkout.projectId,
    integrationId,
    reference: refund.reference,
  });
  if (!refund.amount) return true;
  await ctx.db.patch(transaction._id, { refunded, refundedNet });
  const live = await ctx.db
    .query("externalCheckoutPayments")
    .withIndex("by_checkout_expiry", (q) =>
      q.eq("checkoutId", checkout._id).eq("fullyRefunded", false),
    )
    .order("desc")
    .first();
  if (full) {
    await ctx.db.patch(transaction._id, { fullyRefunded: true });
    const remaining =
      live?._id === transaction._id
        ? await ctx.db
            .query("externalCheckoutPayments")
            .withIndex("by_checkout_expiry", (q) =>
              q.eq("checkoutId", checkout._id).eq("fullyRefunded", false),
            )
            .order("desc")
            .first()
        : live;
    await ctx.db.patch(checkout._id, {
      active: !!checkout.userId && !!remaining && !checkout.replacedBy,
      expiresAt: remaining?.expiresAt,
    });
  }
  if (transaction._id === checkout.latestPaymentId)
    await ctx.db.patch(checkout._id, {
      paymentStatus: full ? "refunded" : "partially_refunded",
    });
  await addReport(ctx, checkout, `refund:${refund.reference}`, {
    kind: "refund",
    paymentId: transaction._id,
    refund,
    netMinor,
    taxMinor: refund.amount - netMinor,
    full,
    before: transaction.refunded,
    refundedNet,
  });
  return true;
}

export const bindJob = internalMutation({
  args: {
    jobId: v.id("externalCheckoutJobs"),
    attempt: v.number(),
    checkoutId: v.id("externalCheckouts"),
  },
  handler: async (ctx, { jobId, attempt, checkoutId }) => {
    const job = await ctx.db.get(jobId);
    if (job && job.attempts === attempt)
      await ctx.db.patch(jobId, { checkoutId });
  },
});

export const applyRefund = internalMutation({
  args: { integrationId: v.string(), refund: refundFact },
  handler: (ctx, { integrationId, refund }) =>
    recordRefund(ctx, integrationId, refund),
});

export const reportContext = internalQuery({
  args: { paymentId: v.id("externalCheckoutPayments") },
  handler: async (ctx, { paymentId }) => {
    const transaction = await ctx.db.get(paymentId);
    const checkout = transaction && (await ctx.db.get(transaction.checkoutId));
    if (!transaction || !checkout) return null;
    const appleToken =
      transaction.appleTokenId && (await ctx.db.get(transaction.appleTokenId));
    const initial =
      checkout.initialPaymentId &&
      (await ctx.db.get(checkout.initialPaymentId));
    // Apple ties every period of a subscription to its first payment, while
    // Google starts a new series with each plan.
    const first =
      checkout.store === "apple"
        ? (await lineage(ctx, checkout)).at(-1)
        : undefined;
    const root =
      first?.initialPaymentId && (await ctx.db.get(first.initialPaymentId));
    return {
      transaction,
      checkout,
      appleToken: appleToken || null,
      initial: initial || null,
      root: root || null,
    };
  },
});

export const tokenContext = internalQuery({
  args: { tokenId: v.id("externalPurchaseTokens") },
  handler: (ctx, { tokenId }) => ctx.db.get(tokenId),
});

export const finish = internalMutation({
  args: {
    jobId: v.id("externalCheckoutJobs"),
    attempt: v.number(),
    outcome: v.union(
      v.literal("done"),
      v.literal("retry"),
      v.literal("failed"),
      v.literal("wait"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, attempt, outcome, error }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.attempts !== attempt || job.dueAt === undefined) return;
    const work = job.task;
    const now = Date.now();
    const report = work.kind === "purchase" || work.kind === "refund";
    const retry = outcome === "wait" || outcome === "retry";
    const expired =
      now - (job.startedAt ?? job._creationTime) >=
      (report || work.kind === "appleToken" ? 7 * DAY : DAY);
    const pending = retry && !expired;
    await ctx.db.patch(jobId, {
      dueAt: pending
        ? now + Math.min(2 ** Math.min(attempt, 10) * 15_000, HOUR)
        : undefined,
      lastError: error,
    });
    if (report) {
      const transaction = await ctx.db.get(work.paymentId);
      const checkout =
        transaction && (await ctx.db.get(transaction.checkoutId));
      if (!transaction || !checkout) return;
      if (
        outcome === "done" &&
        work.kind === "purchase" &&
        transaction._id === checkout.initialPaymentId &&
        checkout.googleToken
      )
        await ctx.db.patch(checkout._id, { googleToken: undefined });
      if (outcome === "done")
        await ctx.db.patch(
          transaction._id,
          work.kind === "purchase"
            ? { reported: true }
            : { reportedRefunded: work.before + work.refund.amount },
        );
      const hadRetry = !!job.lastError;
      const retryingReports =
        checkout.retryingReports +
        Number(pending && !!error) -
        Number(hadRetry);
      const pendingReports = checkout.pendingReports - Number(!pending);
      const failedReports =
        checkout.failedReports + Number(!pending && outcome !== "done");
      await ctx.db.patch(checkout._id, {
        pendingReports,
        retryingReports,
        failedReports,
        reportingStatus: reportStatus(
          pendingReports,
          retryingReports,
          failedReports,
        ),
      });
    } else if (!pending) {
      const failed = outcome !== "done";
      if (work.kind === "stripe" && work.charge) {
        // A refund or dispute of a recorded payment that IAPKit couldn't
        // verify needs a manual store report until a later event settles it.
        const transaction = await paymentFor(
          ctx,
          work.integrationId,
          work.charge,
        );
        const checkout =
          transaction && (await ctx.db.get(transaction.checkoutId));
        if (checkout)
          await markUnverified(
            ctx,
            checkout,
            work.reference,
            failed &&
              !(await refundByReference(
                ctx,
                work.integrationId,
                work.reference,
              )),
          );
        return;
      }
      if (!failed) return;
      const kind = work.kind === "stripe" && paymentEvents[work.event];
      const checkout =
        work.kind === "verify"
          ? await ctx.db.get(work.checkoutId)
          : job.checkoutId
            ? await ctx.db.get(job.checkoutId)
            : work.kind === "stripe" && kind
              ? await checkoutFor(ctx, work.integrationId, kind, work.reference)
              : null;
      if (!checkout) return;
      if (!checkout.initialPaymentId)
        await ctx.db.patch(checkout._id, { paymentStatus: "action_required" });
      else if (
        work.kind === "stripe" &&
        work.reference !== checkout.payment.reference &&
        !(await paymentByReference(ctx, work.integrationId, work.reference))
      )
        // A paid renewal IAPKit couldn't verify needs a manual store report,
        // which later payments must not hide. Another event for the same
        // invoice may already have recorded it.
        await markUnverified(ctx, checkout, work.reference, true);
    }
  },
});

export const projectId = internalQuery({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("projects", args.projectId);
    const project = id && (await ctx.db.get(id));
    return project && !project.pendingDeletion ? project._id : null;
  },
});
