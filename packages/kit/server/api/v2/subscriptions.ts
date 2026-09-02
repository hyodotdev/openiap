import { Hono, type Context } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import {
  isValidSubscriptionUserId,
  MAX_SUBSCRIPTION_USER_ID_LENGTH,
} from "../../../convex/subscriptions/limits";
import {
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
} from "../v1/middleware";
import {
  multiAxisRateLimitMiddleware,
  sourceRateLimitMiddleware,
} from "../v1/rate-limit";
import {
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "../v1/request-body";
import {
  apiErrorResponseSchemaV2,
  subscriptionEntitlementsResponseSchemaV2,
  subscriptionStatusResponseSchemaV2,
  userErasureAcceptedResponseSchemaV2,
  userErasureStatusResponseSchemaV2,
} from "./route-schemas";

const subscriptions = new Hono<{
  Variables: { apiKey: string; apiKeyHash?: string };
}>();
const rateLimit = multiAxisRateLimitMiddleware();
const sourceRateLimit = sourceRateLimitMiddleware() as never;
const USER_ID_LIMIT_MESSAGE = `userId must be ≤ ${MAX_SUBSCRIPTION_USER_ID_LENGTH} chars`;
const MAX_USER_ERASURE_BODY_BYTES = 4 * 1024;
const secretAdminSecurity = [{ apiKey: [] }];
const userIdParameter = {
  in: "query" as const,
  name: "userId",
  required: true,
  description:
    "Opaque app-scoped user identifier selected by the authenticated developer backend.",
  schema: {
    type: "string" as const,
    minLength: 1,
    maxLength: MAX_SUBSCRIPTION_USER_ID_LENGTH,
  },
};
const commonErrorResponses = {
  400: {
    description: "Invalid input or API key",
    content: {
      "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
    },
  },
  401: {
    description: "Missing bearer token",
    content: {
      "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
    },
  },
  403: {
    description: "A secret admin key is required",
    content: {
      "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
    },
  },
  429: {
    description: "Rate limit exceeded",
    content: {
      "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
    },
  },
  500: {
    description: "Internal server error",
    content: {
      "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
    },
  },
};

subscriptions.use(
  "*",
  sourceRateLimit,
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
);

subscriptions.get(
  "/status",
  describeRoute({
    operationId: "getSubscriptionStatusV2",
    description:
      "Read one user's tokenless subscription status. This server-to-server endpoint requires a secret admin key.",
    security: secretAdminSecurity,
    parameters: [userIdParameter],
    responses: {
      200: {
        description: "Tokenless subscription status",
        content: {
          "application/json": {
            schema: resolver(subscriptionStatusResponseSchemaV2),
          },
        },
      },
      ...commonErrorResponses,
    },
  }),
  async (c) => {
    const userId = validateUserId(c);
    if (typeof userId !== "string") return userId;

    try {
      const result = await client.query(
        api.subscriptions.query.subscriptionStatusV2,
        { apiKey: c.var.apiKey, userId, now: Date.now() },
      );
      c.header("Vary", "Authorization");
      return c.json(result);
    } catch (error) {
      return subscriptionRouteError(
        c,
        error,
        "SUBSCRIPTION_STATUS_FAILED",
        "Subscription status lookup failed",
      );
    }
  },
);

subscriptions.get(
  "/entitlements",
  describeRoute({
    operationId: "getSubscriptionEntitlementsV2",
    description:
      "Read one user's active tokenless entitlements. This server-to-server endpoint requires a secret admin key.",
    security: secretAdminSecurity,
    parameters: [userIdParameter],
    responses: {
      200: {
        description: "Tokenless active entitlements",
        content: {
          "application/json": {
            schema: resolver(subscriptionEntitlementsResponseSchemaV2),
          },
        },
      },
      ...commonErrorResponses,
    },
  }),
  async (c) => {
    const userId = validateUserId(c);
    if (typeof userId !== "string") return userId;

    try {
      const result = await client.query(
        api.subscriptions.query.entitlementsV2,
        { apiKey: c.var.apiKey, userId, now: Date.now() },
      );
      c.header("Vary", "Authorization");
      return c.json(result);
    } catch (error) {
      return subscriptionRouteError(
        c,
        error,
        "SUBSCRIPTION_ENTITLEMENTS_FAILED",
        "Subscription entitlements lookup failed",
      );
    }
  },
);

subscriptions.post(
  "/user-erasure",
  describeRoute({
    operationId: "requestSubscriptionUserErasureV2",
    description:
      "Schedule removal of an app user identifier from subscription and commerce-event rows. The job is durable and bounded.",
    security: secretAdminSecurity,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["userId"],
            properties: {
              userId: {
                type: "string",
                minLength: 1,
                maxLength: MAX_SUBSCRIPTION_USER_ID_LENGTH,
              },
            },
            additionalProperties: false,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Erasure job accepted",
        content: {
          "application/json": {
            schema: resolver(userErasureAcceptedResponseSchemaV2),
          },
        },
      },
      413: {
        description: "Request body exceeds 4 KB",
        content: {
          "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
        },
      },
      ...commonErrorResponses,
    },
  }),
  async (c) => {
    let body: unknown;
    try {
      body = await readJsonBodyWithLimit(
        c.req.raw,
        MAX_USER_ERASURE_BODY_BYTES,
        "User-erasure payload is too large",
      );
    } catch (error) {
      if (error instanceof JsonBodyTooLargeError) {
        return c.json(
          {
            errors: [
              {
                code: "PAYLOAD_TOO_LARGE",
                message: "User-erasure payload is too large",
              },
            ],
          },
          413,
        );
      }
      return invalidInput(c, "Body is not JSON");
    }
    const userId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { userId?: unknown }).userId
        : undefined;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      return invalidInput(c, "userId is required");
    }
    if (!isValidSubscriptionUserId(userId)) {
      return invalidInput(c, USER_ID_LIMIT_MESSAGE);
    }

    try {
      const result = await client.mutation(
        api.subscriptions.mutation.requestUserErasure,
        { apiKey: c.var.apiKey, userId },
      );
      return c.json(result, 202);
    } catch (error) {
      return subscriptionRouteError(
        c,
        error,
        "SUBSCRIPTION_USER_ERASURE_FAILED",
        "Subscription user erasure could not be scheduled",
      );
    }
  },
);

subscriptions.get(
  "/user-erasure/:jobId",
  describeRoute({
    operationId: "getSubscriptionUserErasureStatusV2",
    description:
      "Poll a user-erasure job. Completed job metadata remains available for seven days.",
    security: secretAdminSecurity,
    parameters: [
      {
        in: "path",
        name: "jobId",
        required: true,
        schema: { type: "string" as const, maxLength: 256 },
      },
    ],
    responses: {
      200: {
        description: "Erasure job status",
        content: {
          "application/json": {
            schema: resolver(userErasureStatusResponseSchemaV2),
          },
        },
      },
      404: {
        description: "Erasure job not found or no longer retained",
        content: {
          "application/json": { schema: resolver(apiErrorResponseSchemaV2) },
        },
      },
      ...commonErrorResponses,
    },
  }),
  async (c) => {
    const jobId = c.req.param("jobId");
    if (!jobId || jobId.length > 256) {
      return invalidInput(c, "jobId is invalid");
    }

    try {
      const result = await client.query(
        api.subscriptions.query.userErasureStatusV2,
        {
          apiKey: c.var.apiKey,
          jobId,
        },
      );
      if (!result) {
        return c.json(
          { errors: [{ code: "NOT_FOUND", message: "Erasure job not found" }] },
          404,
        );
      }
      return c.json(result);
    } catch (error) {
      return subscriptionRouteError(
        c,
        error,
        "SUBSCRIPTION_USER_ERASURE_STATUS_FAILED",
        "Subscription user erasure status lookup failed",
      );
    }
  },
);

function validateUserId(c: Context): string | Response {
  const userId = c.req.query("userId");
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return invalidInput(c, "userId is required");
  }
  if (!isValidSubscriptionUserId(userId)) {
    return invalidInput(c, USER_ID_LIMIT_MESSAGE);
  }
  return userId;
}

function invalidInput(c: Context, message: string): Response {
  return c.json({ errors: [{ code: "INVALID_INPUT", message }] }, 400);
}

function subscriptionRouteError(
  c: Context,
  error: unknown,
  code: string,
  fallbackMessage: string,
): Response {
  const convexError = handleConvexError(error);
  if (convexError) {
    return c.json(
      { errors: [convexError] },
      convexError.code === "INSUFFICIENT_SCOPE" ? 403 : 400,
    );
  }

  console.error(`[subscriptions/v2] ${code}`, describeErrorForLog(error));
  return c.json({ errors: [{ code, message: fallbackMessage }] }, 500);
}

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export { subscriptions as subscriptionsRoutesV2 };
