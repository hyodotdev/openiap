import { Hono, type Context } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import * as v from "valibot";
import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import { withVerificationJobSource } from "../../../convex/purchases/verificationJobSource";
import { VERIFICATION_JOB_POLL_SECONDS } from "../../../convex/purchases/verificationJobModel";
import { verifyPurchaseInputSchema } from "./route-input-schemas";
import {
  apiErrorResponseSchema,
  verifyPurchaseSuccessResponseSchema,
} from "./route-response-schemas";
import { apiKeyMiddleware } from "./middleware";
import { getRequestIp, multiAxisRateLimitMiddleware } from "./rate-limit";
import { validator } from "./validator";
import { verificationResult } from "./verification-result";
import type { VerificationInput } from "../../../convex/purchases/verificationInput";

const statusFields = {
  jobId: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
};
const terminalFields = { ...statusFields, completedAt: v.number() };
const failure = v.object({ code: v.string(), message: v.string() });
const responseSchema = v.variant("status", [
  v.object({ ...statusFields, status: v.literal("queued") }),
  v.object({ ...statusFields, status: v.literal("running") }),
  v.object({
    ...terminalFields,
    status: v.literal("succeeded"),
    result: verifyPurchaseSuccessResponseSchema,
  }),
  v.object({ ...terminalFields, status: v.literal("failed"), error: failure }),
  v.object({ ...terminalFields, status: v.literal("expired"), error: failure }),
]);
const acceptedSchema = v.object({ jobId: v.string(), deduped: v.boolean() });

interface JobEnv {
  Variables: { apiKey: string; apiKeyHash: string };
}
const app = new Hono<JobEnv>();
app.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});
app.use("*", apiKeyMiddleware, multiAxisRateLimitMiddleware());
app.use("*", async (c, next) => {
  if (!/^[a-f0-9]{64}$/.test(c.req.header("Idempotency-Key") ?? ""))
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message:
              "Idempotency-Key must be 32 random bytes encoded as 64 lowercase hex characters.",
          },
        ],
      },
      400,
    );
  await next();
});

function failureResponse(error: unknown): {
  body: { errors: { code: string; message: string; retryAfterSec?: number }[] };
  status: 400 | 403 | 404 | 409 | 429 | 500 | 503;
  retryAfterSec?: number;
} {
  const parsed = handleConvexError(error);
  const statuses = {
    INVALID_INPUT: 400,
    INVALID_API_KEY: 403,
    INSUFFICIENT_SCOPE: 403,
    NOT_FOUND: 404,
    IDEMPOTENCY_CONFLICT: 409,
    RATE_LIMITED: 429,
    SERVICE_BUSY: 503,
    UNKNOWN_ERROR: 503,
  } as const;
  const code = parsed?.code;
  if (code && code in statuses) {
    const status = statuses[code as keyof typeof statuses];
    return {
      body: {
        errors: [
          {
            code,
            message: parsed.message,
            ...(parsed.retryAfterSec !== undefined
              ? { retryAfterSec: parsed.retryAfterSec }
              : {}),
          },
        ],
      },
      status,
      retryAfterSec: parsed.retryAfterSec,
    };
  }
  return {
    body: {
      errors: [
        {
          code: "UNKNOWN_ERROR",
          message: "Verification is temporarily unavailable.",
        },
      ],
    },
    status: 500,
  };
}

const errorResponses = Object.fromEntries(
  [400, 401, 403, 404, 409, 429, 500, 503].map((status) => [
    status,
    {
      description:
        "The request was not accepted or cannot be read. Retry 429/503 after Retry-After.",
      content: {
        "application/json": { schema: resolver(apiErrorResponseSchema) },
      },
    },
  ]),
);

app.post(
  "/",
  describeRoute({
    operationId: "enqueuePurchaseVerification",
    tags: ["Purchase verification jobs"],
    description:
      "Durably accepts purchase verification. Retain the same secret random Idempotency-Key for acknowledgment retries and result reads. Acceptance grants no entitlement. Existing synchronous verification is unchanged.",
    parameters: [
      {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
    ],
    responses: {
      202: {
        description: "Work persisted. A duplicate returns the original jobId.",
        content: { "application/json": { schema: resolver(acceptedSchema) } },
      },
      ...errorResponses,
    },
  }),
  validator(verifyPurchaseInputSchema),
  async (
    c: Context<
      JobEnv,
      string,
      { in: { json: VerificationInput }; out: { json: VerificationInput } }
    >,
  ) => {
    try {
      const result = await client.action(
        api.purchases.verificationJobs.enqueue,
        await withVerificationJobSource("enqueue", {
          apiKey: c.var.apiKey,
          idempotencyKey: c.req.header("Idempotency-Key")!,
          inputJson: JSON.stringify(c.req.valid("json")),
          requestIp: getRequestIp(c),
          correlationId: crypto.randomUUID(),
        }),
      );
      return c.json(result, 202);
    } catch (error) {
      const failure = failureResponse(error);
      if (failure.retryAfterSec !== undefined)
        c.header("Retry-After", String(failure.retryAfterSec));
      return c.json(failure.body, failure.status);
    }
  },
);

app.get(
  "/:jobId",
  describeRoute({
    operationId: "getPurchaseVerificationJob",
    tags: ["Purchase verification jobs"],
    description:
      "Reads only this job with its original API credential and Idempotency-Key. Pending work is not a store payment-pending verdict. A succeeded job can contain an invalid receipt. Results describe completedAt, not current entitlement standing; retained for 24 hours after completion.",
    parameters: [
      {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
      { name: "jobId", in: "path", required: true, schema: { type: "string" } },
    ],
    responses: {
      200: {
        description: "Job status. Pending responses include Retry-After: 2.",
        content: { "application/json": { schema: resolver(responseSchema) } },
      },
      ...errorResponses,
    },
  }),
  async (c) => {
    try {
      const job = await client.action(
        api.purchases.verificationJobs.read,
        await withVerificationJobSource("read", {
          apiKey: c.var.apiKey,
          idempotencyKey: c.req.header("Idempotency-Key")!,
          jobId: c.req.param("jobId"),
        }),
      );
      const result = job.receipt
        ? await verificationResult({
            apiKey: c.var.apiKey,
            store: job.store,
            receipt: job.receipt,
            input: job,
            correlationId: job.correlationId,
          })
        : undefined;
      if (result && !result.ok) throw new Error("Invalid verification result");
      const body = v.parse(responseSchema, {
        jobId: job.jobId,
        status: job.status,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        ...(job.completedAt !== undefined
          ? { completedAt: job.completedAt }
          : {}),
        ...(job.error ? { error: job.error } : {}),
        ...(result?.ok ? { result: result.response } : {}),
      });
      if (job.status === "queued" || job.status === "running")
        c.header("Retry-After", String(VERIFICATION_JOB_POLL_SECONDS));
      return c.json(body);
    } catch (error) {
      const failure = failureResponse(error);
      if (failure.retryAfterSec !== undefined)
        c.header("Retry-After", String(failure.retryAfterSec));
      return c.json(failure.body, failure.status);
    }
  },
);

export { app as verificationJobRoutes };
