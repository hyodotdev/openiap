import { Hono, type Context } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import { validator } from "./validator";
import { apiKeyMiddleware } from "./middleware";
import {
  multiAxisRateLimitMiddleware,
  sourceRateLimitMiddleware,
} from "./rate-limit";

const external = api.externalCheckouts.action;
const app = new Hono<{ Variables: { apiKey: string; apiKeyHash: string } }>();
const secured = new Hono<{
  Variables: { apiKey: string; apiKeyHash: string };
}>();
const text = v.string();
const checkout = v.strictObject({
  orderId: text,
  userId: text,
  productId: text,
  payment: v.strictObject({
    provider: v.literal("stripe"),
    kind: v.picklist(["payment_intent", "invoice"]),
    reference: text,
  }),
  price: v.strictObject({
    currency: text,
    netMinor: v.number(),
    taxMinor: v.number(),
    regionCode: text,
  }),
  reporting: v.variant("store", [
    v.strictObject({
      store: v.literal("apple"),
      profileId: text,
      tokenIds: v.array(text),
    }),
    v.strictObject({
      store: v.literal("google"),
      profileId: text,
      externalTransactionToken: text,
    }),
  ]),
  changeOf: v.optional(text),
});
const token = v.strictObject({ profileId: text, userId: text, token: text });
const accepted = v.object({ checkoutId: text });
const status = v.object({
  paymentStatus: v.picklist([
    "pending",
    "paid",
    "partially_refunded",
    "refunded",
    "action_required",
  ]),
  reportingStatus: v.picklist([
    "pending",
    "queued",
    "retrying",
    "reported",
    "action_required",
  ]),
  entitlement: v.object({
    active: v.boolean(),
    expiresAt: v.optional(v.number()),
  }),
});

function operation(
  summary: string,
  code: number,
  output: v.GenericSchema,
  idempotency = false,
) {
  return describeRoute({
    tags: ["External checkouts"],
    security: [{ apiKey: [] }],
    summary,
    ...(idempotency
      ? {
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 128 },
            },
          ],
        }
      : {}),
    responses: {
      [code]: {
        description: summary,
        content: { "application/json": { schema: resolver(output) } },
      },
      400: { description: "Invalid request" },
      401: { description: "Missing project secret key" },
      403: { description: "Invalid project secret key" },
      404: { description: "Profile or checkout unavailable" },
      409: { description: "Conflicting replay" },
      429: { description: "Rate limit exceeded" },
      503: { description: "External checkout service unavailable" },
    },
  });
}

function errorResponse(c: Context, error: unknown) {
  const result = handleConvexError(error);
  const statuses = {
    INVALID_INPUT: 400,
    INVALID_SIGNATURE: 400,
    INVALID_API_KEY: 403,
    INSUFFICIENT_SCOPE: 403,
    NOT_FOUND: 404,
    IDEMPOTENCY_CONFLICT: 409,
  } as const;
  const code = result?.code;
  if (code && Object.prototype.hasOwnProperty.call(statuses, code))
    return c.json(
      { errors: [{ code, message: result.message }] },
      statuses[code as keyof typeof statuses],
    );
  return c.json(
    {
      errors: [
        {
          code: "SERVICE_BUSY",
          message: "External checkout service unavailable",
        },
      ],
    },
    503,
  );
}

function invalid(c: Context) {
  return c.json(
    {
      errors: [
        { code: "INVALID_INPUT", message: "Invalid external checkout request" },
      ],
    },
    400,
  );
}

app.post(
  "/webhooks/stripe/:integrationId",
  describeRoute({
    tags: ["External checkouts"],
    summary: "Receive a signed Stripe event",
    security: [],
    parameters: [
      {
        name: "integrationId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "Stripe-Signature",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: { description: "Event accepted or already recorded" },
      400: { description: "Invalid signature or event" },
      429: { description: "Rate limit exceeded; Stripe retries" },
      503: { description: "Event could not be queued" },
    },
  }),
  // Anyone can call this before the signature check, so the source limits
  // keep a flood away from Convex.
  sourceRateLimitMiddleware(),
  bodyLimit({ maxSize: 262_144 }),
  async (c) => {
    try {
      return c.json(
        await client.action(external.ingestStripe, {
          integrationId: c.req.param("integrationId"),
          raw: await c.req.text(),
          signature: c.req.header("Stripe-Signature") ?? "",
        }),
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  },
);

for (const path of ["/external-checkouts/*", "/external-purchase-tokens"]) {
  secured.use(
    path,
    async (c, next) => {
      c.header("Cache-Control", "private, no-store");
      await next();
    },
    apiKeyMiddleware,
    multiAxisRateLimitMiddleware(),
  );
}
secured.post(
  "/external-purchase-tokens",
  operation(
    "Register an Apple external purchase token",
    201,
    v.object({ tokenId: text }),
  ),
  validator(token),
  async (c) => {
    const input = c.req.valid("json" as never) as v.InferOutput<typeof token>;
    try {
      return c.json(
        await client.action(external.registerToken, {
          apiKey: c.get("apiKey"),
          ...input,
        }),
        201,
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  },
);
secured.post(
  "/external-checkouts",
  operation("Register an external checkout", 201, accepted, true),
  validator(checkout),
  async (c) => {
    const input = c.req.valid("json" as never) as v.InferOutput<
      typeof checkout
    >;
    const key = c.req.header("Idempotency-Key");
    if (!key) return invalid(c);
    try {
      return c.json(
        await client.action(external.create, {
          apiKey: c.get("apiKey"),
          key,
          input,
        }),
        201,
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  },
);
secured.post(
  "/external-checkouts/:checkoutId/verify",
  operation("Enqueue Stripe payment verification", 202, accepted),
  async (c) => {
    try {
      return c.json(
        await client.action(external.verify, {
          apiKey: c.get("apiKey"),
          checkoutId: c.req.param("checkoutId"),
        }),
        202,
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  },
);
secured.get(
  "/external-checkouts/:checkoutId",
  operation("Read external checkout status", 200, status),
  async (c) => {
    try {
      return c.json(
        await client.action(external.get, {
          apiKey: c.get("apiKey"),
          checkoutId: c.req.param("checkoutId"),
        }),
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  },
);

export const externalCheckoutRoutes = app.route("/", secured);
