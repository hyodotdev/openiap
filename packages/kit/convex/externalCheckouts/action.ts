"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import * as validate from "valibot";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { assertCliScope } from "../cli/scope";
import { getProjectByApiKey } from "../purchases/shared";
import {
  decryptVerificationJob,
  encryptVerificationJob,
} from "../purchases/verificationJobCrypto";
import { checkoutInput, fail, paymentEvents, validPrice } from "./model";
import { findIntegration, requireProfile } from "./config";
import {
  appleCountries,
  reportAppleToken,
  reportTransaction,
} from "./reporters";
import {
  bindsCheckout,
  ExternalJobError,
  Stripe,
  stripeEvent,
  stripeId,
} from "./stripe";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const state = internal.externalCheckouts.state;

async function projectFor(ctx: ActionCtx, apiKey: string) {
  await assertCliScope(ctx, "admin");
  return getProjectByApiKey(ctx, apiKey, "admin");
}

function identifier(value: string, max = 128) {
  return (
    value.length <= max &&
    !!value.trim() &&
    ![...value].some((char) => char < " " || char === "\x7f")
  );
}

const appleTokenSchema = validate.object({
  appAppleId: validate.number(),
  bundleId: validate.string(),
  externalPurchaseId: validate.string(),
  tokenCreationDate: validate.number(),
  tokenType: validate.optional(validate.string()),
  tokenExpirationDate: validate.optional(validate.number()),
});

export const registerToken = action({
  args: {
    apiKey: v.string(),
    profileId: v.string(),
    userId: v.string(),
    token: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ tokenId: Id<"externalPurchaseTokens"> }> => {
    const project = await projectFor(ctx, args.apiKey);
    const { integration } = requireProfile(args.profileId, project, "apple");
    if (
      !identifier(args.userId) ||
      args.token.length > 8192 ||
      !/^[\w-]+={0,2}$/.test(args.token)
    )
      fail("INVALID_INPUT", "Apple token is invalid");
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        Buffer.from(args.token, "base64url").toString("utf8"),
      );
    } catch {
      fail("INVALID_INPUT", "Apple token is invalid");
    }
    const parsed = validate.safeParse(appleTokenSchema, decoded);
    if (!parsed.success) fail("INVALID_INPUT", "Apple token is invalid");
    const token = parsed.output;
    const now = Date.now();
    if (
      token.appAppleId !== project.iosAppAppleId ||
      token.bundleId !== project.iosBundleId ||
      token.externalPurchaseId.startsWith("SANDBOX") !==
        (integration.environment === "sandbox") ||
      !identifier(token.externalPurchaseId) ||
      !Number.isSafeInteger(token.tokenCreationDate) ||
      token.tokenCreationDate <= 0 ||
      token.tokenCreationDate > now + 5 * 60_000 ||
      (token.tokenExpirationDate !== undefined &&
        (!Number.isSafeInteger(token.tokenExpirationDate) ||
          token.tokenExpirationDate <= token.tokenCreationDate ||
          token.tokenExpirationDate > now + 400 * 86_400_000))
    )
      fail(
        "INVALID_INPUT",
        "Apple token does not match this app and environment",
      );
    const { tokenId } = await ctx.runMutation(state.registerToken, {
      projectId: project._id,
      profileId: args.profileId,
      userId: args.userId,
      externalId: token.externalPurchaseId,
      createdAt: token.tokenCreationDate,
      expiresAt: token.tokenExpirationDate,
      tokenType: token.tokenType,
    });
    return { tokenId };
  },
});

export const create = action({
  args: { apiKey: v.string(), key: v.string(), input: checkoutInput },
  handler: async (
    ctx,
    { apiKey, key, input },
  ): Promise<{ checkoutId: Id<"externalCheckouts"> }> => {
    const project = await projectFor(ctx, apiKey);
    const { orderId, productId, userId, payment, price, reporting, changeOf } =
      input;
    const { profile, integration } = requireProfile(
      reporting.profileId,
      project,
      reporting.store,
    );
    if (
      ![orderId, productId, userId].every((value) => identifier(value)) ||
      !/^[!-~]{1,128}$/.test(key) ||
      !stripeId(
        payment.reference,
        payment.kind === "invoice" ? "in_" : "pi_",
      ) ||
      // Only an invoice can bill nothing, such as a free trial.
      !validPrice(price, payment.kind === "invoice") ||
      !profile.regions.includes(price.regionCode) ||
      (changeOf !== undefined &&
        (payment.kind !== "invoice" || !identifier(changeOf)))
    )
      fail("INVALID_INPUT", "Checkout fields are invalid");
    if (
      reporting.store === "apple" &&
      (!appleCountries[price.regionCode] ||
        !reporting.tokenIds.length ||
        reporting.tokenIds.length > 8 ||
        !reporting.tokenIds.every((id) => identifier(id)))
    )
      fail("INVALID_INPUT", "Apple checkout requires valid token IDs");
    if (
      reporting.store === "google" &&
      (!identifier(reporting.externalTransactionToken, 8192) ||
        (price.regionCode === "IN" && !profile.administrativeArea))
    )
      fail(
        "INVALID_INPUT",
        "Google checkout requires a token and supported tax address",
      );
    const token =
      reporting.store === "google"
        ? reporting.externalTransactionToken
        : undefined;
    const appleTokenIds =
      reporting.store === "apple"
        ? [...new Set(reporting.tokenIds)].sort()
        : undefined;
    const googleTokenHash = token ? hash(token) : undefined;
    const requestHash = hash(
      JSON.stringify([
        orderId,
        productId,
        userId,
        payment.provider,
        payment.kind,
        payment.reference,
        price.currency,
        price.netMinor,
        price.taxMinor,
        price.regionCode,
        profile.id,
        integration.id,
        reporting.store,
        appleTokenIds ?? googleTokenHash,
        changeOf,
      ]),
    );
    const googleToken = token
      ? encryptVerificationJob(token, `external:${project._id}:${requestHash}`)
      : undefined;
    return {
      checkoutId: await ctx.runMutation(state.create, {
        projectId: project._id,
        integrationId: integration.id,
        profileId: profile.id,
        store: reporting.store,
        orderId,
        userId,
        productId,
        payment,
        price,
        key: hash(key),
        requestHash,
        appleTokenIds,
        googleToken,
        googleTokenHash,
        changeOf,
      }),
    };
  },
});

async function getCheckout(
  ctx: ActionCtx,
  args: { apiKey: string; checkoutId: string },
) {
  const project = await projectFor(ctx, args.apiKey);
  const checkout = await ctx.runQuery(state.get, {
    projectId: project._id,
    checkoutId: args.checkoutId,
  });
  if (!checkout) fail("NOT_FOUND", "Checkout not found");
  return checkout;
}

type Status = {
  paymentStatus: Doc<"externalCheckouts">["paymentStatus"];
  reportingStatus: Doc<"externalCheckouts">["reportingStatus"];
  entitlement: { active: boolean; expiresAt?: number };
};

export const get = action({
  args: { apiKey: v.string(), checkoutId: v.string() },
  handler: async (ctx, args): Promise<Status> => {
    const checkout = await getCheckout(ctx, args);
    return {
      paymentStatus: checkout.paymentStatus,
      reportingStatus: checkout.reportingStatus,
      entitlement: {
        active:
          !!checkout.userId &&
          checkout.active &&
          (checkout.expiresAt === undefined || checkout.expiresAt > Date.now()),
        expiresAt: checkout.expiresAt,
      },
    };
  },
});

export const verify = action({
  args: { apiKey: v.string(), checkoutId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ checkoutId: Id<"externalCheckouts"> }> => {
    const checkout = await getCheckout(ctx, args);
    await ctx.runMutation(state.verify, {
      checkoutId: checkout._id,
      projectId: checkout.projectId,
    });
    return { checkoutId: checkout._id };
  },
});

export const ingestStripe = action({
  args: { integrationId: v.string(), raw: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<{ received: true }> => {
    const integration = findIntegration(args.integrationId);
    if (
      !integration ||
      args.raw.length > 262_144 ||
      args.signature.length > 2048
    )
      fail("INVALID_SIGNATURE", "Stripe signature is invalid");
    const event = stripeEvent(args.raw, args.signature, integration);
    if (event) {
      const projectId = await ctx.runQuery(state.projectId, {
        projectId: integration.projectId,
      });
      if (!projectId) fail("SERVICE_BUSY", "Stripe project unavailable");
      await ctx.runMutation(state.stripeEvent, {
        projectId,
        integrationId: integration.id,
        ...event,
      });
    }
    return { received: true };
  },
});

async function process(
  ctx: ActionCtx,
  job: Doc<"externalCheckoutJobs">,
  project: Doc<"projects">,
) {
  const work = job.task;
  if (work.kind === "appleToken") {
    const token = await ctx.runQuery(state.tokenContext, {
      tokenId: work.tokenId,
    });
    if (!token || token.used) return;
    const { integration } = requireProfile(token.profileId, project, "apple");
    await reportAppleToken(ctx, project, integration, token, job.attempts > 1);
    return;
  }
  if (work.kind === "purchase" || work.kind === "refund") {
    const data = await ctx.runQuery(state.reportContext, {
      paymentId: work.paymentId,
    });
    if (!data) return;
    const { checkout, transaction, initial, root } = data;
    const refund = work.kind === "refund" ? work : undefined;
    // A report waits for the earlier reports it refers to: the refunded
    // payment, the checkout's first payment, and the subscription's first.
    if (
      refund
        ? !transaction.reported ||
          transaction.reportedRefunded !== refund.before
        : [initial, root].some(
            (earlier) =>
              earlier && earlier._id !== transaction._id && !earlier.reported,
          )
    )
      return "wait";
    const { integration, profile } = requireProfile(
      checkout.profileId,
      project,
      checkout.store,
    );
    if (integration.id !== checkout.integrationId)
      throw new ExternalJobError("PROFILE_INTEGRATION_CHANGED", false);
    const token =
      checkout.googleToken &&
      decryptVerificationJob(
        checkout.googleToken,
        `external:${project._id}:${checkout.requestHash}`,
      );
    await reportTransaction(
      ctx,
      project,
      integration,
      profile,
      data,
      token,
      job.attempts > 1,
      refund,
    );
    return;
  }
  if (work.kind === "verify") {
    const checkout = await ctx.runQuery(state.get, {
      projectId: project._id,
      checkoutId: work.checkoutId,
    });
    if (!checkout || checkout.initialPaymentId) return;
    const { integration } = requireProfile(
      checkout.profileId,
      project,
      checkout.store,
    );
    if (integration.id !== checkout.integrationId)
      throw new ExternalJobError("PROFILE_INTEGRATION_CHANGED", false);
    const stripe = new Stripe(integration);
    await stripe.verifyAccount();
    await ctx.runMutation(state.applyPayment, {
      checkoutId: checkout._id,
      ...(await stripe.payment(checkout)),
    });
    return;
  }
  const integration = findIntegration(work.integrationId);
  if (!integration || integration.projectId !== project._id)
    throw new ExternalJobError("STRIPE_INTEGRATION_MISSING", false);
  const stripe = new Stripe(integration);
  const kind = paymentEvents[work.event];
  if (!kind) {
    // A refund or dispute waits, without calling Stripe, until its payment
    // is recorded; verification also reads the charge's refunds and disputes.
    if (
      work.charge &&
      !(await ctx.runQuery(state.hasPayment, {
        integrationId: integration.id,
        charge: work.charge,
      }))
    )
      return "wait";
    await stripe.verifyAccount();
    const refund =
      work.event === "charge.dispute.closed"
        ? await stripe.dispute(work.reference)
        : await stripe.refund(work.reference);
    if (
      refund &&
      !(await ctx.runMutation(state.applyRefund, {
        integrationId: integration.id,
        refund,
      }))
    )
      return "wait";
    return;
  }
  // A bound PaymentIntent can arrive before its checkout is registered; wait
  // without calling Stripe until the checkout exists.
  if (
    kind === "payment_intent" &&
    !(await ctx.runQuery(state.paymentTarget, {
      integrationId: integration.id,
      kind,
      reference: work.reference,
    }))
  )
    return "wait";
  await stripe.verifyAccount();
  const invoice =
    kind === "invoice" ? await stripe.invoice(work.reference) : undefined;
  if (invoice && invoice.id !== work.reference)
    throw new ExternalJobError("STRIPE_INVOICE_MISMATCH", false);
  const checkout = await ctx.runQuery(state.paymentTarget, {
    integrationId: integration.id,
    kind,
    reference: work.reference,
    subscriptionId: invoice?.subscription ?? undefined,
  });
  if (!checkout) return "wait";
  const configured = requireProfile(
    checkout.profileId,
    project,
    checkout.store,
  );
  if (configured.integration.id !== integration.id)
    throw new ExternalJobError("PROFILE_INTEGRATION_CHANGED", false);
  await ctx.runMutation(state.bindJob, {
    jobId: job._id,
    attempt: job.attempts,
    checkoutId: checkout._id,
  });
  // A renewal that names another order belongs to a plan change, which can
  // be registered after its invoice.
  if (
    invoice &&
    invoice.id !== checkout.payment.reference &&
    !bindsCheckout(invoice.subscription_details?.metadata, checkout)
  )
    return "wait";
  await ctx.runMutation(state.applyPayment, {
    checkoutId: checkout._id,
    ...(await stripe.payment(checkout, invoice)),
  });
}

export const run = internalAction({
  args: { jobId: v.id("externalCheckoutJobs"), attempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const claimed = await ctx.runQuery(state.work, args);
    if (!claimed) return;
    try {
      const outcome = await process(ctx, claimed.job, claimed.project);
      await ctx.runMutation(state.finish, {
        ...args,
        outcome: outcome ?? "done",
      });
    } catch (error) {
      const classified = error instanceof ExternalJobError;
      await ctx.runMutation(state.finish, {
        ...args,
        outcome: classified && !error.retryable ? "failed" : "retry",
        error: classified ? error.code : "EXTERNAL_CHECKOUT_JOB_FAILED",
      });
    }
  },
});
