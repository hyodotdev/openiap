"use node";

import { ConvexError, v } from "convex/values";
import * as valibot from "valibot";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { assertCliScope } from "../cli/scope";
import { sha256Hex } from "../utils/sha256";
import {
  assertVerificationJobSource,
  verificationJobSource,
} from "./verificationJobSource";
import {
  decryptVerificationJob,
  encryptVerificationJob,
} from "./verificationJobCrypto";
import {
  verifyPurchaseInputSchema,
  type VerificationInput,
} from "./verificationInput";
import { verifyAppStoreReceipt } from "./ios";
import { verifyGooglePlayReceipt } from "./android";
import { verifyAmazonReceipt } from "./amazon";
import { verifyHorizonReceipt } from "./horizon";
import { verifyRecordingIssues } from "../purchaseIssues/shared";
import type { ReceiptResponse } from "./shared";
import type {
  VerificationJobError,
  VerificationJobView,
} from "./verificationJobModel";

const IDEMPOTENCY_PATTERN = /^[a-f0-9]{64}$/;

function validIdempotencyKey(key: string): void {
  if (!IDEMPOTENCY_PATTERN.test(key))
    throw new ConvexError({
      code: "INVALID_INPUT",
      message:
        "Idempotency-Key must be 32 random bytes encoded as 64 lowercase hex characters.",
    });
}

function canonicalInput(input: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

export const enqueue = action({
  args: {
    apiKey: v.string(),
    idempotencyKey: v.string(),
    inputJson: v.string(),
    requestIp: v.optional(v.string()),
    correlationId: v.string(),
    sourceAuth: verificationJobSource,
  },
  returns: v.object({ jobId: v.id("verificationJobs"), deduped: v.boolean() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ jobId: Id<"verificationJobs">; deduped: boolean }> => {
    await assertCliScope(ctx, "write");
    const { sourceAuth, ...request } = args;
    await assertVerificationJobSource("enqueue", request, sourceAuth);
    validIdempotencyKey(args.idempotencyKey);
    if (
      args.inputJson.length > 20_000 ||
      args.apiKey.length > 128 ||
      args.correlationId.length > 128 ||
      (args.requestIp?.length ?? 0) > 128
    )
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Verification request is too large.",
      });
    let input: VerificationInput;
    try {
      input = valibot.parse(
        verifyPurchaseInputSchema,
        JSON.parse(args.inputJson),
      );
    } catch {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Invalid purchase verification request.",
      });
    }
    const apiKeyHash = await sha256Hex(args.apiKey);
    const idempotencyHash = await sha256Hex(args.idempotencyKey);
    const requestHash = await sha256Hex(canonicalInput(input));
    const verdictHash = await sha256Hex(
      canonicalInput(
        Object.fromEntries(
          Object.entries(input).filter(
            ([key]) =>
              !["includeClientPayload", "includeTransactionDetails"].includes(
                key,
              ),
          ),
        ),
      ),
    );
    const evidence = Object.fromEntries(
      Object.entries(input).filter(
        ([key]) =>
          ![
            "includeClientPayload",
            "includeTransactionDetails",
            "expectedProductId",
          ].includes(key),
      ),
    );
    const evidenceHash = await sha256Hex(canonicalInput(evidence));
    const payload = encryptVerificationJob(
      JSON.stringify({ apiKey: args.apiKey, input, requestIp: args.requestIp }),
      JSON.stringify([apiKeyHash, idempotencyHash, requestHash]),
    );
    return ctx.runMutation(internal.purchases.verificationJobQueue.enqueue, {
      apiKey: args.apiKey,
      idempotencyHash,
      requestHash,
      evidenceHash,
      verdictHash,
      payload,
      store: input.store,
      includeClientPayload: input.includeClientPayload,
      includeTransactionDetails: input.includeTransactionDetails,
      correlationId: args.correlationId,
    });
  },
});

export const read = action({
  args: {
    apiKey: v.string(),
    idempotencyKey: v.string(),
    jobId: v.string(),
    sourceAuth: verificationJobSource,
  },
  handler: async (ctx, args): Promise<VerificationJobView> => {
    await assertCliScope(ctx, "read");
    const { sourceAuth, ...request } = args;
    await assertVerificationJobSource("read", request, sourceAuth);
    validIdempotencyKey(args.idempotencyKey);
    if (args.apiKey.length > 128 || args.jobId.length > 128)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Verification job not found.",
      });
    return ctx.runMutation(
      internal.purchases.verificationJobQueue.read,
      request,
    );
  },
});

async function verifyQueuedReceipt(
  ctx: ActionCtx,
  apiKey: string,
  input: VerificationInput,
  requestIp: string | undefined,
  correlationId: string,
): Promise<ReceiptResponse> {
  const base = { apiKey, requestIp, correlationId };
  return verifyRecordingIssues(
    ctx,
    {
      apiKey,
      evidence: input,
      expectedProductId:
        "expectedProductId" in input ? input.expectedProductId : undefined,
      correlationId,
    },
    async () => {
      switch (input.store) {
        case "apple":
          return verifyAppStoreReceipt(ctx, {
            ...base,
            jws: input.jws,
            expectedProductId: input.expectedProductId,
          });
        case "google":
          return verifyGooglePlayReceipt(ctx, {
            ...base,
            purchaseToken: input.purchaseToken,
            expectedProductId: input.expectedProductId,
          });
        case "amazon":
          return verifyAmazonReceipt(ctx, {
            ...base,
            userId: input.userId,
            receiptId: input.receiptId,
            sandbox: input.sandbox,
            expectedProductId: input.expectedProductId,
          });
        case "horizon":
          return verifyHorizonReceipt(ctx, {
            ...base,
            userId: input.userId,
            sku: input.sku,
          });
      }
    },
  );
}

export function verificationJobFailure(error: unknown): {
  error: VerificationJobError;
  retryAfterSec?: number;
} {
  let data: unknown = error instanceof ConvexError ? error.data : undefined;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = undefined;
    }
  }
  const parsed = valibot.safeParse(
    valibot.object({
      code: valibot.optional(valibot.string()),
      error: valibot.optional(valibot.string()),
      retryAfterSec: valibot.optional(valibot.number()),
    }),
    data,
  );
  const raw = parsed.success ? parsed.output : {};
  const candidate = raw.code ?? raw.error;
  const code =
    candidate && /^[A-Z][A-Z0-9_]{0,79}$/.test(candidate)
      ? candidate
      : "VERIFICATION_FAILED";
  const retryAfterSec =
    typeof raw.retryAfterSec === "number" &&
    Number.isFinite(raw.retryAfterSec) &&
    raw.retryAfterSec > 0
      ? Math.min(900, raw.retryAfterSec)
      : code === "RATE_LIMITED"
        ? 2
        : undefined;
  return {
    error: {
      code,
      message:
        retryAfterSec !== undefined
          ? "Verification is temporarily unavailable."
          : "Verification could not finish. Check the project configuration or contact support.",
    },
    ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
  };
}

export const run = internalAction({
  args: { jobId: v.id("verificationJobs"), lease: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.runMutation(
      internal.purchases.verificationJobQueue.forWorker,
      args,
    );
    if (!job) return null;
    if (
      !job.payload ||
      job.status !== "running" ||
      job.expiresAt <= Date.now()
    ) {
      await ctx.runMutation(internal.purchases.verificationJobQueue.complete, {
        ...args,
        error: {
          code: "VERIFICATION_EXPIRED",
          message: "Verification did not finish before its deadline.",
        },
      });
      return null;
    }
    try {
      const decoded: unknown = JSON.parse(
        decryptVerificationJob(
          job.payload,
          JSON.stringify([
            job.apiKeyHash,
            job.idempotencyHash,
            job.requestHash,
          ]),
        ),
      );
      const payload = valibot.parse(
        valibot.object({
          apiKey: valibot.string(),
          input: verifyPurchaseInputSchema,
          requestIp: valibot.optional(valibot.string()),
        }),
        decoded,
      );
      const receipt = await verifyQueuedReceipt(
        ctx,
        payload.apiKey,
        payload.input,
        payload.requestIp,
        job.correlationId,
      );
      await ctx.runMutation(internal.purchases.verificationJobQueue.complete, {
        ...args,
        receipt,
      });
    } catch (error) {
      await ctx.runMutation(internal.purchases.verificationJobQueue.complete, {
        ...args,
        ...verificationJobFailure(error),
      });
    }
    return null;
  },
});
