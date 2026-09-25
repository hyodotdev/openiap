"use node";
import { ConvexError, v } from "convex/values";
import { OAuth2Client } from "google-auth-library";
import { google, type androidpublisher_v3 } from "googleapis";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { moneyToMicros } from "../products/play";
import { getProjectByApiKey } from "../purchases/shared";
import {
  isUnauthenticatedPubSubAllowed,
  normalizeGoogleRtdn,
  mapGoogleSubscriptionNotificationType,
  WebhookNormalizationError,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
} from "./shared";

// Per-project Play client cache. Warm "use node" processes keep it, saving
// 50-200ms and a storage read per webhook.
//
// Rotations are rare, so an hour's delay is fine; a Play auth failure drops
// the entry sooner (see the catch in maybeFetchSubscriptionInfo).
const PLAY_CLIENT_TTL_MS = 60 * 60 * 1000;
// Capped: containers are shared across projects, so an unbounded map leaks
// memory. Traffic concentrates on a few projects, so 100 covers the hot set.
const PLAY_CLIENT_CACHE_MAX_ENTRIES = 100;
const playClientCache = new Map<
  string,
  {
    client: androidpublisher_v3.Androidpublisher;
    fileId: string;
    principal: string;
    expiresAt: number;
  }
>();
const pubSubOidcClient = new OAuth2Client();
const MAX_PUBSUB_OIDC_TOKEN_LENGTH = 16 * 1024;
const MAX_PUBSUB_OIDC_AUDIENCES = 8;

// LRU: Map keeps insertion order, and a hit re-inserts the entry at the end.
function trimPlayClientCacheLru(): void {
  while (playClientCache.size > PLAY_CLIENT_CACHE_MAX_ENTRIES) {
    const oldestKey = playClientCache.keys().next().value;
    if (oldestKey === undefined) break;
    playClientCache.delete(oldestKey);
  }
}

type GoogleActionContext = {
  runAction: any;
  runMutation: any;
  runQuery: any;
};

async function getPlayProjectAuth(
  ctx: Pick<GoogleActionContext, "runAction" | "runQuery">,
  projectId: unknown,
): Promise<{
  client: androidpublisher_v3.Androidpublisher;
  principal: string;
} | null> {
  const cacheKey = String(projectId);
  const serviceAccountFile = await ctx.runQuery(
    internal.files.internal.getGooglePlayFileByProjectInternal,
    { projectId },
  );
  if (!serviceAccountFile) {
    playClientCache.delete(cacheKey);
    return null;
  }
  const fileId = String(serviceAccountFile._id);
  const cached = playClientCache.get(cacheKey);
  if (cached && cached.fileId === fileId && cached.expiresAt > Date.now()) {
    playClientCache.delete(cacheKey);
    playClientCache.set(cacheKey, cached);
    return cached;
  }
  playClientCache.delete(cacheKey);
  const fileContent = await ctx.runAction(
    internal.files.internal.readFileAsText,
    { fileId: serviceAccountFile._id },
  );
  if (!fileContent?.content) return null;

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(fileContent.content) as Record<string, unknown>;
  } catch {
    throw new ConvexError({
      code: "INVALID_SERVICE_ACCOUNT_JSON",
      message:
        "Google Play service account JSON is malformed — re-upload the file generated from Google Cloud Console.",
    });
  }
  const principal =
    typeof credentials.client_email === "string"
      ? credentials.client_email.trim().toLowerCase()
      : "";
  if (!principal.endsWith(".gserviceaccount.com")) {
    throw new ConvexError({
      code: "INVALID_SERVICE_ACCOUNT_JSON",
      message: "Google Play service account JSON has no valid client_email.",
    });
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const entry = {
    client: google.androidpublisher({ version: "v3", auth }),
    fileId,
    principal,
    expiresAt: Date.now() + PLAY_CLIENT_TTL_MS,
  };
  playClientCache.set(cacheKey, entry);
  trimPlayClientCacheLru();
  return entry;
}

type PlayProjectAuth = NonNullable<
  Awaited<ReturnType<typeof getPlayProjectAuth>>
>;

type VerifyPubSubOidc = (
  token: string,
  audiences: string[],
) => Promise<{
  email?: string;
  email_verified?: boolean;
}>;

export async function verifyPubSubOidcPrincipal(
  token: string | undefined,
  audiences: string[] | undefined,
  verify: VerifyPubSubOidc = async (idToken, expectedAudiences) => {
    const ticket = await pubSubOidcClient.verifyIdToken({
      idToken,
      audience: expectedAudiences,
    });
    return ticket.getPayload() ?? {};
  },
): Promise<string> {
  if (
    !token ||
    token.length > MAX_PUBSUB_OIDC_TOKEN_LENGTH ||
    !audiences ||
    audiences.length === 0 ||
    audiences.length > MAX_PUBSUB_OIDC_AUDIENCES ||
    audiences.some((audience) => !audience || audience.length > 2_048)
  ) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Google Pub/Sub OIDC authentication failed.",
    });
  }
  try {
    const payload = await verify(token, audiences);
    const principal = payload.email?.trim().toLowerCase();
    if (payload.email_verified !== true || !principal) throw new Error();
    return principal;
  } catch {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Google Pub/Sub OIDC authentication failed.",
    });
  }
}

function assertProjectBoundPrincipal(
  principal: string,
  expectedPrincipal: string,
): void {
  if (principal !== expectedPrincipal.trim().toLowerCase()) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Google Pub/Sub OIDC authentication failed.",
    });
  }
}

export function projectPubSubOidcAudiences(
  apiKey: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const publicBase =
    env.IAPKIT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://kit.openiap.dev";
  const configuredAudience =
    env.GOOGLE_PUBSUB_PUSH_AUDIENCE?.trim() || publicBase;
  let publicOrigin: string;
  try {
    publicOrigin = new URL(publicBase).origin;
  } catch {
    return [];
  }
  const trustedOrigins = configuredAudience
    .split(",")
    .map((value) => {
      try {
        return new URL(value.trim()).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => value !== null);
  if (!trustedOrigins.includes(publicOrigin)) return [];

  const encodedApiKey = encodeURIComponent(apiKey);
  return [
    `${publicOrigin}/v1/webhooks/${encodedApiKey}`,
    `${publicOrigin}/v1/webhooks/google/${encodedApiKey}`,
  ];
}

type IngestResult = {
  eventId: Id<"webhookEvents">;
  type: string;
  deduped: boolean;
};

// Called from server/api/v1/webhooks.ts with message.data already decoded.
// The route checks OIDC early; this public boundary checks it again and binds
// the sender to the project's uploaded service account.
//
// Pub/Sub delivers at least once; recordWebhookEvent returns deduped: true
// for a repeated messageId.
export const ingestGoogleRtdn = action({
  args: {
    apiKey: v.string(),
    oidcToken: v.optional(v.string()),
    rawMessage: v.string(),
    payload: v.object({
      messageId: v.string(),
      packageName: v.optional(v.string()),
      eventTimeMillis: v.number(),
      subscriptionNotification: v.optional(
        v.object({
          version: v.optional(v.string()),
          notificationType: v.number(),
          purchaseToken: v.string(),
          subscriptionId: v.optional(v.string()),
        }),
      ),
      oneTimeProductNotification: v.optional(
        v.object({
          version: v.optional(v.string()),
          notificationType: v.number(),
          purchaseToken: v.string(),
          sku: v.string(),
        }),
      ),
      voidedPurchaseNotification: v.optional(
        v.object({
          version: v.optional(v.string()),
          purchaseToken: v.string(),
          orderId: v.optional(v.string()),
          productType: v.optional(v.number()),
          refundType: v.optional(v.number()),
        }),
      ),
      testNotification: v.optional(v.object({ version: v.string() })),
    }),
  },
  returns: v.object({
    eventId: v.id("webhookEvents"),
    type: v.string(),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args): Promise<IngestResult> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);
    let authenticatedPlayAuth: PlayProjectAuth | undefined;
    if (!isUnauthenticatedPubSubAllowed(process.env)) {
      const oidcPrincipal = await verifyPubSubOidcPrincipal(
        args.oidcToken,
        projectPubSubOidcAudiences(args.apiKey),
      );
      const playAuth = await getPlayProjectAuth(ctx, project._id);
      if (!playAuth) {
        throw new ConvexError({
          code: "GOOGLE_SERVICE_ACCOUNT_REQUIRED",
          message:
            "Upload the Google Play service account and use its client_email for Pub/Sub push authentication.",
        });
      }
      assertProjectBoundPrincipal(oidcPrincipal, playAuth.principal);
      authenticatedPlayAuth = playAuth;
    }

    // Checked here, not in the route, to save a Convex round-trip.
    // mapWebhookError maps ANDROID_NOT_CONFIGURED to 412.
    if (!project.androidPackageName) {
      throw new ConvexError({
        code: "ANDROID_NOT_CONFIGURED",
        message:
          "Google RTDN received but Android is not configured for this project. Missing: androidPackageName.",
      });
    }

    if (
      project.androidPackageName &&
      args.payload.packageName &&
      args.payload.packageName !== project.androidPackageName
    ) {
      // Permanent mismatch: mapWebhookError returns 400 so Pub/Sub stops
      // retrying a notification that can never succeed for this project.
      throw new ConvexError({
        code: "PACKAGE_NAME_MISMATCH",
        message: `Package name mismatch: notification ${args.payload.packageName} vs project ${project.androidPackageName}`,
      });
    }

    // A known messageId is a Pub/Sub redelivery. Reapply the stored event
    // (idempotent) in case the first attempt recorded it but failed before
    // updating the subscription, and skip the Play fetch so retries cost no
    // API quota.
    const preFlightEvent = await ctx.runQuery(
      internal.webhooks.internal.lookupExistingEvent,
      {
        projectId: project._id,
        source: "google",
        sourceNotificationId: args.payload.messageId,
      },
    );
    if (preFlightEvent) {
      if (preFlightEvent.purchaseToken) {
        await ctx.runMutation(
          internal.subscriptions.internal.applySubscriptionEvent,
          {
            projectId: project._id,
            eventId: preFlightEvent.eventId,
          },
        );
      }
      return {
        eventId: preFlightEvent.eventId,
        type: preFlightEvent.type,
        deduped: true,
      };
    }

    const googleSubscriptionType = args.payload.subscriptionNotification
      ? mapGoogleSubscriptionNotificationType(
          args.payload.subscriptionNotification.notificationType,
        )
      : null;
    let subscriptionInfo =
      args.payload.subscriptionNotification && !googleSubscriptionType
        ? null
        : await maybeFetchSubscriptionInfo(
            ctx,
            project._id,
            project.androidPackageName,
            args.payload,
            authenticatedPlayAuth,
          );
    const enrichmentOptional =
      googleSubscriptionType === "SubscriptionExpired" ||
      googleSubscriptionType === "SubscriptionRevoked" ||
      googleSubscriptionType === "SubscriptionPendingPurchaseCanceled";
    if (
      args.payload.subscriptionNotification &&
      googleSubscriptionType &&
      !enrichmentOptional &&
      !subscriptionInfo
    ) {
      throw new Error(
        "Google Play service account is required for lifecycle enrichment",
      );
    }
    if (
      args.payload.subscriptionNotification &&
      googleSubscriptionType &&
      !args.payload.subscriptionNotification.subscriptionId &&
      !subscriptionInfo?.productId
    ) {
      if (
        subscriptionInfo?.ambiguousLineItems &&
        googleSubscriptionType !== "SubscriptionProductChanged"
      ) {
        throw new Error(
          "Google multi-item subscription has no canonical product",
        );
      }
      if (!subscriptionInfo?.ambiguousLineItems) {
        const existingProductId = await ctx.runQuery(
          internal.subscriptions.internal.getSourceProductIdByToken,
          {
            projectId: project._id,
            purchaseToken: args.payload.subscriptionNotification.purchaseToken,
          },
        );
        if (existingProductId) {
          subscriptionInfo = {
            ...(subscriptionInfo ?? {}),
            productId: existingProductId,
          };
        } else {
          // Modern RTDN omits subscriptionId. With no product from Play or a
          // stored token, throw rather than record: preflight dedupe would
          // skip every retry.
          throw new Error("Google subscription product enrichment unavailable");
        }
      }
    }

    let normalized;
    try {
      normalized = normalizeGoogleRtdn({
        payload: args.payload,
        subscriptionInfo,
      });
    } catch (error) {
      if (error instanceof WebhookNormalizationError) {
        // UnknownEventType is well-formed but unmodeled: ACK it so Pub/Sub
        // stops redelivering. The other codes mean a malformed payload; a
        // 4xx puts the rejection in the operator's Pub/Sub metrics.
        if (error.code === "UnknownEventType") {
          console.warn(
            "[webhooks/google] dropping unsupported notification",
            error.code,
            error.message,
          );
          // mapWebhookError ACKs this with 200, as on the Apple path; a plain
          // Error would 500 and trigger Google's exponential retry.
          throw new ConvexError({
            code: "UNSUPPORTED_EVENT",
            message: error.message,
          });
        }
        throw new ConvexError({ code: error.code, message: error.message });
      }
      throw error;
    }

    const result = await ctx.runMutation(
      internal.webhooks.internal.recordWebhookEvent,
      {
        projectId: project._id,
        source: "google",
        sourceNotificationId: normalized.sourceNotificationId,
        event: {
          type: normalized.type,
          sourceFull: normalized.source,
          platform: normalized.platform,
          environment: normalized.environment,
          purchaseToken: normalized.purchaseToken,
          linkedPurchaseToken: normalized.linkedPurchaseToken,
          transactionId: normalized.transactionId,
          originalTransactionId: normalized.originalTransactionId,
          applicationId: normalized.applicationId,
          productKind: normalized.productKind,
          productId: normalized.productId,
          subscriptionState: normalized.subscriptionState,
          expiresAt: normalized.expiresAt,
          renewsAt: normalized.renewsAt,
          willRenew: normalized.willRenew,
          cancellationReason: normalized.cancellationReason,
          currency: normalized.currency,
          priceAmountMicros: normalized.priceAmountMicros,
          amountProvenance: normalized.amountProvenance,
          occurredAt: normalized.occurredAt,
          rawSignedPayload: args.rawMessage,
        },
      },
    );

    // Apply even when deduped, as apple.ts does: an earlier attempt may have
    // recorded the event and crashed before updating the subscription. The
    // mutation is idempotent on webhookEvents.appliedAt.
    //
    // TestNotification has no purchaseToken. One-time purchases use the same
    // handler, which marks them applied without creating subscription state or
    // commerce events.
    if (normalized.purchaseToken) {
      await ctx.runMutation(
        internal.subscriptions.internal.applySubscriptionEvent,
        {
          projectId: project._id,
          eventId: result.eventId,
        },
      );
    }

    return {
      eventId: result.eventId,
      type: normalized.type,
      deduped: result.deduped,
    };
  },
});

/** Date.parse, but undefined instead of NaN for missing or bad input. */
function parseEpochMs(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : undefined;
}

export function selectLongestDatedLineItem<
  T extends { expiryTime?: string | null },
>(lineItems: T[]): T | undefined {
  return (
    lineItems.reduce<T | undefined>((acc, item) => {
      if (!item.expiryTime) return acc;
      const score = Date.parse(item.expiryTime);
      if (!Number.isFinite(score)) return acc;
      const accScore = acc?.expiryTime ? Date.parse(acc.expiryTime) : -Infinity;
      return score > accScore ? item : acc;
    }, undefined) ?? lineItems[0]
  );
}

function replacementMetadata(item: unknown): {
  productId?: string;
  mode?: string;
} {
  const replacement = (item as { itemReplacement?: unknown } | null)
    ?.itemReplacement;
  if (!replacement || typeof replacement !== "object") return {};
  const productId = (replacement as { productId?: unknown }).productId;
  const mode = (replacement as { replacementMode?: unknown }).replacementMode;
  return {
    ...(typeof productId === "string" ? { productId } : {}),
    ...(typeof mode === "string" ? { mode } : {}),
  };
}

export function selectSubscriptionMoney<T>(
  plan:
    | {
        recurringPrice?: T;
        priceChangeDetails?: { newPrice?: T } | null;
      }
    | null
    | undefined,
  notificationType: number,
): T | undefined {
  return notificationType === 8 || notificationType === 19
    ? plan?.priceChangeDetails?.newPrice
    : plan?.recurringPrice;
}

// Null for non-subscription notifications or a project with no service
// account (the caller then admits only terminal events). Transient Play
// failures throw so Pub/Sub retries before an incomplete event is recorded.
async function maybeFetchSubscriptionInfo(
  ctx: { runAction: any; runQuery: any },
  projectId: unknown,
  packageName: string | undefined,
  payload: GoogleRtdnPayload,
  authenticatedPlayAuth?: PlayProjectAuth,
): Promise<GoogleSubscriptionInfo | null> {
  if (!payload.subscriptionNotification || !packageName) {
    return null;
  }

  try {
    const playAuth =
      authenticatedPlayAuth ?? (await getPlayProjectAuth(ctx, projectId));
    if (!playAuth) return null;
    const androidpublisher = playAuth.client;

    // googleapis has no default timeout; a hung call would hold the Pub/Sub
    // ack until Convex's 10-minute action limit. The call is usually
    // sub-second, and a timeout throws so Pub/Sub retries before recording.
    const response = await androidpublisher.purchases.subscriptionsv2.get(
      {
        packageName,
        token: payload.subscriptionNotification.purchaseToken,
      },
      { timeout: 10_000 },
    );

    const data = response.data;
    // v2 has expiryTime per line item, not the legacy root expiryTimeMillis.
    //
    // The canonical model holds one product, so never project an arbitrary
    // line item of a base-plan/add-on bundle onto the whole subscription.
    //
    // Don't match on latestSuccessfulOrderId: it is a GPA order ID, while the
    // notification carries a purchaseToken.
    const lineItems = data.lineItems ?? [];
    const ambiguousLineItems = lineItems.length > 1;
    let matched = ambiguousLineItems
      ? undefined
      : selectLongestDatedLineItem(lineItems);
    if (ambiguousLineItems) {
      const sourceProductId =
        payload.subscriptionNotification.subscriptionId ??
        (await ctx.runQuery(
          internal.subscriptions.internal.getSourceProductIdByToken,
          {
            projectId,
            purchaseToken: payload.subscriptionNotification.purchaseToken,
          },
        ));
      const linkedProductId = data.linkedPurchaseToken
        ? await ctx.runQuery(
            internal.subscriptions.internal.getCurrentProductIdByToken,
            {
              projectId,
              purchaseToken: data.linkedPurchaseToken,
            },
          )
        : null;
      const canonicalProductId =
        payload.subscriptionNotification.notificationType === 4 &&
        data.linkedPurchaseToken
          ? (linkedProductId ?? sourceProductId)
          : (sourceProductId ?? linkedProductId);
      const exactReplacements = canonicalProductId
        ? lineItems.filter(
            (item) =>
              replacementMetadata(item).productId === canonicalProductId,
          )
        : [];
      const immediateReplacements = exactReplacements.filter((item) => {
        const mode = replacementMetadata(item).mode?.toUpperCase();
        return (
          item.productId !== canonicalProductId &&
          (parseEpochMs(item.expiryTime) ?? -Infinity) >
            payload.eventTimeMillis &&
          mode !== "DEFERRED" &&
          mode !== "KEEP_EXISTING"
        );
      });
      if (payload.subscriptionNotification.notificationType === 17) {
        matched =
          immediateReplacements.length === 1
            ? immediateReplacements[0]
            : undefined;
      } else {
        matched = canonicalProductId
          ? lineItems.find((item) => item.productId === canonicalProductId)
          : undefined;
        if (
          payload.subscriptionNotification.notificationType === 4 &&
          data.linkedPurchaseToken
        ) {
          matched =
            immediateReplacements.length === 1
              ? immediateReplacements[0]
              : immediateReplacements.length === 0
                ? matched
                : undefined;
        }
        const matchedExpiry = parseEpochMs(matched?.expiryTime);
        if (
          payload.subscriptionNotification.notificationType === 2 &&
          matched &&
          matchedExpiry !== undefined &&
          matchedExpiry <= payload.eventTimeMillis
        ) {
          const futureSuccessors = lineItems.filter(
            (item) =>
              item !== matched &&
              (parseEpochMs(item.expiryTime) ?? -Infinity) >
                payload.eventTimeMillis,
          );
          const replacementSuccessors = canonicalProductId
            ? futureSuccessors.filter(
                (item) =>
                  replacementMetadata(item).productId === canonicalProductId,
              )
            : [];
          matched =
            replacementSuccessors.length === 1
              ? replacementSuccessors[0]
              : replacementSuccessors.length === 0 &&
                  futureSuccessors.length === 1
                ? futureSuccessors[0]
                : undefined;
        }
      }
    }
    const expiry = matched?.expiryTime ?? undefined;
    // The plan object identifies plan type; only autoRenewEnabled says whether
    // another charge is scheduled. Proto JSON can omit its false default.
    const willRenew = matched?.autoRenewingPlan
      ? matched.autoRenewingPlan.autoRenewEnabled === true
      : matched?.prepaidPlan
        ? false
        : undefined;
    const renews = willRenew === true ? (expiry ?? undefined) : undefined;
    const price = selectSubscriptionMoney(
      matched?.autoRenewingPlan,
      payload.subscriptionNotification.notificationType,
    );
    const storePriceAmountMicros = moneyToMicros(price);
    const catalogPrice =
      storePriceAmountMicros === undefined &&
      matched?.prepaidPlan &&
      matched.productId
        ? await ctx.runQuery(internal.products.query.getCatalogPriceInternal, {
            projectId,
            platform: "Android",
            productId: matched.productId,
          })
        : null;
    const usesStorePrice = storePriceAmountMicros !== undefined;

    return {
      productId: matched?.productId ?? undefined,
      ...(ambiguousLineItems ? { ambiguousLineItems: true } : {}),
      linkedPurchaseToken: data.linkedPurchaseToken ?? undefined,
      state: data.subscriptionState ?? undefined,
      cancelReason: data.canceledStateContext?.userInitiatedCancellation
        ? "USER_CANCELED"
        : data.canceledStateContext?.systemInitiatedCancellation
          ? "SYSTEM_INITIATED_CANCELLATION"
          : undefined,
      // NaN would fail Convex's number validator and 500 the ingest;
      // undefined falls back to wall-clock dedup.
      expiryTimeMillis: parseEpochMs(expiry),
      autoRenewingPlanRenewsTimeMillis: parseEpochMs(renews),
      willRenew,
      currency: usesStorePrice ? price?.currencyCode : catalogPrice?.currency,
      priceAmountMicros: usesStorePrice
        ? storePriceAmountMicros
        : catalogPrice?.priceAmountMicros,
      amountProvenance:
        storePriceAmountMicros === undefined && !catalogPrice
          ? undefined
          : usesStorePrice
            ? "store"
            : "catalog",
    };
  } catch (error) {
    // Structured config errors pass through for the route to map to a 4xx;
    // other failures are sanitized below and retried by Pub/Sub.
    if (error instanceof ConvexError) {
      throw error;
    }
    // Only the error name reaches the aggregated logs: a googleapis error can
    // carry the request URL with an OAuth bearer token, and the response body.
    const sanitized =
      error instanceof Error ? error.name : "(unknown error type)";
    const errorTextForDetection = error instanceof Error ? error.message : "";
    // An auth failure usually means a rotated service account: drop the cached
    // client so the next webhook reloads it instead of waiting out the TTL.
    // GaxiosError's code/status is checked first because Google has reworded
    // these messages across SDK versions; the strings cover unwrapped errors.
    const errorCode =
      typeof error === "object" && error !== null
        ? ((error as { code?: unknown }).code ??
          (error as { status?: unknown }).status)
        : undefined;
    const numericAuthFailure =
      errorCode === 401 ||
      errorCode === 403 ||
      errorCode === "401" ||
      errorCode === "403";
    if (
      numericAuthFailure ||
      errorTextForDetection.includes("invalid_grant") ||
      errorTextForDetection.includes("Invalid JWT")
    ) {
      playClientCache.delete(String(projectId));
    }
    console.warn(
      "[webhooks/google] subscriptionsv2 fetch failed; requesting Pub/Sub retry",
      sanitized,
    );
    throw new Error("Google Play subscription enrichment failed");
  }
}
