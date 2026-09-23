import { Hono } from "hono";
import type { Context, Next } from "hono";
import { OAuth2Client } from "google-auth-library";

import { api } from "@/convex";
import {
  isUnauthenticatedPubSubAllowed,
  resolvePubSubOidcAudiences,
} from "../../../convex/webhooks/shared";
import { client, handleConvexError } from "../../convex";
import { hashApiKey } from "./rate-limit";
import { redactApiKeysInPath } from "./request-logger";
import { apiKeyValidationError, isSecretApiKey } from "./middleware";
import {
  isContentLengthOverLimit,
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "./request-body";
import { multiAxisRateLimitMiddleware } from "./rate-limit";

function describeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export function legacyUnsupportedEventReason(error: unknown): string | null {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorMessage.startsWith("UNSUPPORTED_EVENT")
    ? "Unsupported event"
    : null;
}

export function isWebhookBodyTooLarge(contentLengthHeader: string | undefined) {
  return isContentLengthOverLimit(contentLengthHeader, MAX_WEBHOOK_BODY_BYTES);
}

export async function readWebhookJsonBody(request: Request): Promise<unknown> {
  return readJsonBodyWithLimit(
    request,
    MAX_WEBHOOK_BODY_BYTES,
    "Webhook payload is too large",
  );
}

// Inbound webhook receivers for Apple ASN v2 and Google Pub/Sub RTDN.
//
// Auth:
// - Apple ASN can't send an Authorization header, so the project key rides in
//   the path: https://kit.openiap.dev/v1/webhooks/{apiKey}. Rotating the key
//   invalidates the URL. The Convex action checks the signedPayload against
//   Apple's roots, so a leaked URL still accepts only Apple-signed payloads.
// - Google Pub/Sub push sends a Bearer JWT. The Fly edge checks its signature
//   and audience; the Convex action repeats that and requires the token email
//   to match the project's uploaded service account. The path key only
//   resolves the project; it is not source authentication.

const webhooks = new Hono<{
  Variables: { apiKey: string; apiKeyHash?: string };
}>();
const publicApiRateLimit = multiAxisRateLimitMiddleware();

// One URL for both stores, so the dashboard shows a single copy box. The body
// shape picks the handler:
//   - Apple ASN v2: `{ "signedPayload": "<JWS>" }`
//   - Google Pub/Sub push: `{ "message": { "data": "<base64>",
//     "messageId": "..." }, "subscription": "..." }`
// Anything else is a 400 INVALID_INPUT, so a misconfigured sender fails loudly.
const unifiedHandler = async (c: Context) => {
  const apiKey = c.req.param("apiKey");
  if (!apiKey) {
    return c.json(
      {
        errors: [
          { code: "INVALID_INPUT", message: "Missing apiKey path segment" },
        ],
      },
      400,
    );
  }
  let body: unknown;
  try {
    body = await readWebhookJsonBody(c.req.raw);
  } catch (error) {
    if (error instanceof JsonBodyTooLargeError) {
      return webhookPayloadTooLargeResponse(c);
    }
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }

  // Setup checks run inside the ingest actions, which load the project anyway;
  // `mapWebhookError` maps their ConvexError codes to HTTP. A separate query
  // here would cost a round-trip per webhook.
  if (looksLikeApple(body)) {
    return handleAppleNotification(
      c,
      apiKey,
      body as { signedPayload: string },
    );
  }
  if (looksLikeGoogle(body)) {
    return handleGoogleNotification(c, apiKey, body as PubSubPushBody);
  }

  return c.json(
    {
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "Unrecognized payload. Expected Apple ASN v2 ({signedPayload}) or Google Pub/Sub ({message:{data,messageId}}).",
        },
      ],
    },
    400,
  );
};

// Public — paste this URL into both App Store Connect and Google
// Pub/Sub push subscription configuration.
webhooks.post("/:apiKey", pathApiKeyGuard, publicApiRateLimit, unifiedHandler);

// Platform-specific aliases, kept for existing store-console wiring.
webhooks.post(
  "/apple/:apiKey",
  pathApiKeyGuard,
  publicApiRateLimit,
  unifiedHandler,
);
webhooks.post(
  "/google/:apiKey",
  pathApiKeyGuard,
  publicApiRateLimit,
  unifiedHandler,
);

type PubSubPushBody = {
  message: {
    data: string;
    messageId: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
};

function looksLikeApple(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    "signedPayload" in body &&
    typeof (body as Record<string, unknown>).signedPayload === "string"
  );
}

function looksLikeGoogle(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const message = (body as { message?: unknown }).message;
  if (!message || typeof message !== "object") return false;
  const m = message as Record<string, unknown>;
  return typeof m.data === "string" && typeof m.messageId === "string";
}

async function pathApiKeyGuard(c: Context, next: Next) {
  const apiKey = c.req.param("apiKey");
  if (isSecretApiKey(apiKey)) {
    // The caller here is Apple or Pub/Sub, so nobody reads this response body.
    // A server-side warning is the only way an operator learns that a secret
    // key is sitting in a store console — and in every proxy log in between.
    console.warn(
      "[webhooks] a secret key is configured in a store notification URL and must be rotated",
      {
        apiKeyHash: hashApiKey(apiKey ?? ""),
        path: redactApiKeysInPath(c.req.path, apiKey),
      },
    );
    return c.json(
      {
        errors: [
          {
            code: "SECRET_API_KEY_IN_URL",
            message:
              "Secret API keys are not accepted in webhook URLs. Replace this URL with the publishable-key lifecycle URL shown in the IAPKit dashboard, then rotate the exposed secret key.",
          },
        ],
      },
      410,
    );
  }
  const validationError = apiKeyValidationError(apiKey);
  if (validationError) {
    return c.json(
      { errors: [{ code: "INVALID_API_KEY", message: validationError }] },
      403,
    );
  }
  if (
    c.req.method !== "GET" &&
    isWebhookBodyTooLarge(c.req.header("content-length"))
  ) {
    return webhookPayloadTooLargeResponse(c);
  }
  c.set("apiKey", apiKey);
  await next();
}

function webhookPayloadTooLargeResponse(c: Context) {
  return c.json(
    {
      errors: [
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "Webhook payload is too large",
        },
      ],
    },
    413,
  );
}

async function handleAppleNotification(
  c: Context,
  apiKey: string,
  body: { signedPayload: string },
) {
  if (typeof body.signedPayload !== "string" || body.signedPayload.length < 1) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Missing or invalid signedPayload",
          },
        ],
      },
      400,
    );
  }
  try {
    const result = await client.action(api.webhooks.apple.ingestAppleAsnIOS, {
      apiKey,
      signedPayload: body.signedPayload,
    });
    return c.json({
      ok: true,
      eventType: result.type,
      deduped: result.deduped,
    });
  } catch (error) {
    return mapWebhookError(c, error, "apple");
  }
}

async function handleGoogleNotification(
  c: Context,
  apiKey: string,
  body: PubSubPushBody,
) {
  // Pub/Sub sends a Bearer JWT when the subscription has OIDC. Without
  // GOOGLE_PUBSUB_PUSH_AUDIENCE this fails closed; only development may opt
  // out with `KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1`.
  const authHeader = c.req.header("authorization");
  const oidcToken = extractBearerToken(authHeader) ?? undefined;
  const audience = process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
  const allowUnauth = isUnauthenticatedPubSubAllowed(process.env);
  let oidcAudiences: string[] | undefined;
  if (!audience) {
    if (!allowUnauth) {
      console.error(
        "[webhooks/google] GOOGLE_PUBSUB_PUSH_AUDIENCE is unset; rejecting request. Set KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1 only for local dev.",
      );
      return c.json(
        {
          errors: [
            {
              code: "MISCONFIGURED",
              message:
                "Pub/Sub OIDC audience is not configured on this kit instance",
            },
          ],
        },
        503,
      );
    }
    console.warn(
      "[webhooks/google] GOOGLE_PUBSUB_PUSH_AUDIENCE unset and KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1 — accepting unauthenticated Pub/Sub body (dev mode only).",
    );
  } else {
    oidcAudiences = pubSubOidcAudiences(c.req.url, audience);
    const ok = await verifyPubSubOidcToken(authHeader, oidcAudiences);
    if (!ok) {
      return c.json(
        {
          errors: [
            {
              code: "UNAUTHORIZED",
              message: "Pub/Sub OIDC verification failed",
            },
          ],
        },
        401,
      );
    }
  }

  // `rawMessage` keeps the decoded text exactly as Google sent it;
  // re-stringifying would change spacing and key order.
  const decodedMessage = decodePubSubMessageData(body.message.data);
  if (!decodedMessage) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Pub/Sub message.data is not base64-encoded JSON",
          },
        ],
      },
      400,
    );
  }
  const { decodedRaw, decoded } = decodedMessage;

  const payload = {
    messageId: body.message.messageId,
    packageName:
      typeof decoded.packageName === "string" ? decoded.packageName : undefined,
    eventTimeMillis: resolveGoogleEventTimeMillis(
      decoded.eventTimeMillis,
      body.message.publishTime,
    ),
    subscriptionNotification: decoded.subscriptionNotification as
      | undefined
      | {
          version?: string;
          notificationType: number;
          purchaseToken: string;
          subscriptionId?: string;
        },
    oneTimeProductNotification: decoded.oneTimeProductNotification as
      | undefined
      | {
          version?: string;
          notificationType: number;
          purchaseToken: string;
          sku: string;
        },
    voidedPurchaseNotification: decoded.voidedPurchaseNotification as
      | undefined
      | {
          version?: string;
          purchaseToken: string;
          orderId?: string;
          productType?: number;
          refundType?: number;
        },
    testNotification: decoded.testNotification as
      | undefined
      | { version: string },
  };

  try {
    const result = await client.action(api.webhooks.google.ingestGoogleRtdn, {
      apiKey,
      ...(oidcToken ? { oidcToken } : {}),
      rawMessage: decodedRaw,
      payload,
    });
    return c.json({
      ok: true,
      eventType: result.type,
      deduped: result.deduped,
    });
  } catch (error) {
    return mapWebhookError(c, error, "google");
  }
}

const oauth2Client = new OAuth2Client();

async function verifyPubSubOidcToken(
  authHeader: string | undefined,
  audience: string | string[],
): Promise<boolean> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    console.warn("[webhooks/google] OIDC verification failed: missing bearer");
    return false;
  }
  const expectedAudiences = Array.isArray(audience) ? audience : [audience];
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: token,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      console.warn("[webhooks/google] OIDC verification failed: empty payload");
      return false;
    }
    const email = payload.email;
    if (!email || payload.email_verified !== true) {
      console.warn("[webhooks/google] OIDC verification failed: email", {
        audience: sanitizePubSubAudienceForLog(payload.aud),
        email: sanitizeEmailForLog(email),
        emailVerified: payload.email_verified,
        issuer: payload.iss,
      });
      return false;
    }
    // Rejects user identities early; the Convex action then requires the
    // project's uploaded service-account `client_email`.
    if (!isAllowedPubSubServiceAccount(email)) {
      console.warn("[webhooks/google] OIDC principal rejected", {
        audience: sanitizePubSubAudienceForLog(payload.aud),
        email: sanitizeEmailForLog(email),
        expectedAudiences: expectedAudiences.map(sanitizePubSubAudienceForLog),
        issuer: payload.iss,
      });
      return false;
    }
    return true;
  } catch (error) {
    const sanitized =
      error instanceof Error ? error.name : "(unknown error type)";
    console.warn("[webhooks/google] OIDC verification error", {
      error: sanitized,
      expectedAudiences: expectedAudiences.map(sanitizePubSubAudienceForLog),
    });
    return false;
  }
}

export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }
  return parts[1] || null;
}

export function isAllowedPubSubServiceAccount(email: string): boolean {
  return email.endsWith(".gserviceaccount.com");
}

export function decodePubSubMessageData(
  data: string,
): { decodedRaw: string; decoded: Record<string, unknown> } | null {
  const trimmed = data.trim();
  if (!isStrictBase64(trimmed)) return null;

  try {
    const decodedRaw = Buffer.from(trimmed, "base64").toString("utf-8");
    const decoded: unknown = JSON.parse(decodedRaw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return null;
    }
    return { decodedRaw, decoded: decoded as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function resolveGoogleEventTimeMillis(
  eventTimeMillis: unknown,
  publishTime: string | undefined,
  now = Date.now(),
): number {
  const parsedEventTime = parseGoogleMillis(eventTimeMillis);
  if (parsedEventTime !== undefined) return parsedEventTime;

  const parsedPublishTime = Date.parse(publishTime ?? "");
  return Number.isFinite(parsedPublishTime) ? parsedPublishTime : now;
}

function parseGoogleMillis(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 === 1) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;

  const firstPadding = value.indexOf("=");
  if (firstPadding === -1) return true;

  return value.length % 4 === 0 && /^=+$/.test(value.slice(firstPadding));
}

export function pubSubOidcAudiences(
  requestUrl: string,
  configuredAudience: string,
): string[] {
  return resolvePubSubOidcAudiences(requestUrl, configuredAudience);
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const REDACTED_CREDENTIAL = "redacted";

export function sanitizePubSubAudienceForLog(
  audience: unknown,
): string | string[] | undefined {
  if (Array.isArray(audience)) {
    return audience
      .map((value) => sanitizePubSubAudienceForLog(value))
      .filter((value): value is string => typeof value === "string");
  }
  if (typeof audience !== "string") return undefined;
  const parsed = safeUrl(audience);
  if (!parsed) return REDACTED_CREDENTIAL;
  // The audience is the endpoint URL, which carries the project key. Log the
  // route, not the key.
  const path = parsed.pathname.replace(
    /(\/webhooks(?:\/(?:apple|google))?\/)[^/]+/,
    `$1${REDACTED_CREDENTIAL}`,
  );
  const query = new URLSearchParams(parsed.search);
  for (const name of ["apiKey", "token", "id_token", "jwt"]) {
    if (query.has(name)) query.set(name, REDACTED_CREDENTIAL);
  }
  const search = query.toString();
  return `${parsed.origin}${path}${search ? `?${search}` : ""}`;
}

function sanitizeEmailForLog(email: unknown): string | undefined {
  if (typeof email !== "string" || email.length === 0) return undefined;
  return email;
}

function mapWebhookError(
  c: Context,
  error: unknown,
  source: "apple" | "google",
) {
  const convexError = handleConvexError(error);
  if (convexError !== null) {
    // Stores ship new notification types before IAPKit maps them; a 200 stops
    // retries for an event dropped on purpose. Other codes (BUNDLE_ID_MISMATCH,
    // INVALID_SIGNATURE, …) are permanent, so a 4xx makes the operator notice.
    if (convexError.code === "UNSUPPORTED_EVENT") {
      return c.json({ ok: true, dropped: true, reason: convexError.message });
    }
    // Bad / unrecognized API key: 401 with a stable code the dashboard
    // and SDK can branch on without parsing the message.
    if (
      convexError.code === "INVALID_API_KEY" ||
      convexError.code === "UNAUTHORIZED"
    ) {
      return c.json({ errors: [convexError] }, 401);
    }
    // The matching platform isn't set up. Callers already branch on 412.
    if (
      convexError.code === "IOS_NOT_CONFIGURED" ||
      convexError.code === "ANDROID_NOT_CONFIGURED" ||
      convexError.code === "GOOGLE_SERVICE_ACCOUNT_REQUIRED"
    ) {
      return c.json({ errors: [convexError] }, 412);
    }
    return c.json({ errors: [convexError] }, 400);
  }

  const legacyUnsupportedReason = legacyUnsupportedEventReason(error);
  if (legacyUnsupportedReason !== null) {
    // Legacy fallback — kept until all action paths migrate to the
    // ConvexError shape above.
    return c.json({
      ok: true,
      dropped: true,
      reason: legacyUnsupportedReason,
    });
  }

  console.error(`[webhooks/${source}] unexpected error`, describeError(error));
  return c.json(
    {
      errors: [
        {
          code: "WEBHOOK_INTERNAL_ERROR",
          message: "Webhook processing failed",
        },
      ],
    },
    500,
  );
}

export { webhooks as webhooksRoutes };
