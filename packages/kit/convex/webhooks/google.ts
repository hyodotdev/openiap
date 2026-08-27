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

// Module-level cache for the Play Developer API client per project.
// Convex "use node" actions reuse the underlying process for warm
// starts — a fresh service-account fetch + JSON parse + GoogleAuth
// initialization on every webhook adds 50-200ms latency per
// notification and burns Convex storage I/O proportional to traffic.
// Caching the authenticated client survives across consecutive
// webhook invocations on the same machine; cold starts re-build it.
//
// TTL keeps the cache fresh enough that an operator-initiated
// service-account rotation reaches us within an hour without manual
// intervention — credentials don't change often, and a hung-on-old-
// key state would surface as Play API 401s on the affected webhooks
// (which then expire the cache via the catch path below).
const PLAY_CLIENT_TTL_MS = 60 * 60 * 1000;
// Bounded LRU cache. Convex action containers are reused across
// projects, and an unbounded `Map<projectId, client>` would grow
// without limit on a multi-tenant deployment — eventually leaking
// memory in the long-running Node process. The cap keeps the cache
// hot for the working set (most webhook traffic concentrates on a
// small subset of high-volume projects) while stopping the long
// tail of one-off projects from accumulating forever (PR #124
// (https://github.com/hyodotdev/openiap/pull/124) review).
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

// `Map` preserves insertion order, so the first key in iteration is
// the least-recently-set. We re-set on every cache hit (see below)
// to bump the entry to the end, turning the Map into an LRU.
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

// HTTP receiver invoked from `server/api/v1/webhooks.ts`. The route performs
// an early OIDC check, and this public Convex boundary repeats it while binding
// the sender to this project's uploaded Google service account.
//
// The action expects the *parsed* RTDN body — the route is responsible
// for base64-decoding `message.data` and shaping it into our
// GoogleRtdnPayload. From here we optionally enrich with a fetch to
// `androidpublisher.purchases.subscriptionsv2.get` (needs the project's
// service-account JSON) and then call the idempotent insert mutation.
//
// At-least-once Pub/Sub delivery means we'll see duplicate `messageId`s
// on retries; `recordWebhookEvent` collapses those into `deduped: true`.
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

    // Setup-status gate. Previously the HTTP layer ran a separate
    // `getSetupStatus` query before invoking this action; inlining the
    // check here cuts the second Convex round-trip per webhook.
    // `mapWebhookError` translates "ANDROID_NOT_CONFIGURED" → 412 so
    // the operator sees the same structured error the prior pre-check
    // produced.
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
      // Permanent input/config mismatch — Pub/Sub will retry forever
      // unless we surface this as a 4xx. ConvexError → mapWebhookError
      // → 400 so Google stops retrying a notification that can never
      // succeed against this project.
      throw new ConvexError({
        code: "PACKAGE_NAME_MISMATCH",
        message: `Package name mismatch: notification ${args.payload.packageName} vs project ${project.androidPackageName}`,
      });
    }

    // Pre-flight idempotency probe: if this messageId already resolves through
    // the source-aware webhookEvents index (or the phase-1 idempotency-key
    // fallback), this is a Pub/Sub redelivery for an event we already
    // recorded. Reapply the stored event BEFORE returning so a retry repairs
    // the gap where the first attempt wrote webhookEvents and then failed
    // before updating subscriptions. Still skip maybeFetchSubscriptionInfo so
    // retries don't burn Play Developer
    // API quota on every redelivery — kit's webhook receiver becomes a
    // multiplier of Play API calls otherwise (one Pub/Sub retry per
    // outage minute → one Play API call per retry). The downstream mutation
    // reads the stored event and atomically marks its transition applied.
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
          // Modern RTDN omits subscriptionId. If neither Play enrichment nor an
          // existing canonical token supplies identity, recording the message
          // would make preflight dedupe permanently suppress the useful retry.
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
        // Only `UnknownEventType` is "unsupported but well-formed" —
        // ACK with a 200-class so Pub/Sub stops re-delivering it (the
        // IAPKit state model has no transition for one-off notification kinds
        // we don't model). The other two codes
        // (`MissingNotificationId`, `MissingPurchaseToken`) indicate a
        // malformed payload we genuinely cannot route — surface them
        // as ConvexError so `mapWebhookError` translates to 4xx and
        // the operator sees the rejection in their pubsub metrics
        // instead of having broken events silently swallowed.
        if (error.code === "UnknownEventType") {
          console.warn(
            "[webhooks/google] dropping unsupported notification",
            error.code,
            error.message,
          );
          // Throw a ConvexError so the route layer's `mapWebhookError`
          // translates `UNSUPPORTED_EVENT` to a 200 ACK
          // (webhooks.ts:788) instead of letting a plain Error 500 the
          // Pub/Sub push and trigger Google's exponential retry loop
          // on a payload kit will never accept. Matches the Apple
          // path's ConvexError shape (PR #124
          // (https://github.com/hyodotdev/openiap/pull/124) review).
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

    // Always run applySubscriptionEvent — see the matching note in
    // webhooks/apple.ts. The mutation is idempotent on webhookEvents.appliedAt,
    // but skipping on dedup left the
    // subscription stranded if a previous attempt persisted the event
    // then crashed before patching the subscription row (every Google
    // RTDN retry would dedup before reaching the state mutation).
    //
    // TestNotification has no purchaseToken. Every purchase-bearing event goes
    // through the single apply handler; it marks one-time rows applied without
    // creating subscription state or commerce events.
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

// Enrichment with subscriptionsv2.get. Returns null when:
// - the project has no Play service account configured (the caller permits
//   only terminal lifecycle events to continue without enrichment),
// - the notification is one-time / voided / test (no subscription to
//   look up).
// Transient Play API failures are rethrown so Pub/Sub retries before the
// message is recorded with incomplete lifecycle data.
/**
 * `Date.parse` returns NaN for any input it can't parse — and since
 * `webhookEvents.expiresAt`/`renewsAt` is typed as `v.number()` in the
 * schema, a NaN reaches Convex's validator and 500s the receiver. This
 * helper passes only finite numbers through; everything else collapses
 * to undefined so the downstream path uses the wall-clock dedup
 * heuristic instead.
 */
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

    // Per-request timeout — googleapis defaults to no timeout, and a
    // hung Play Developer API call would otherwise stall this Pub/Sub
    // ack until Convex's 10-min action ceiling kills the whole
    // pipeline. 10s is generous for what's usually a sub-second request. A
    // timeout rejects ingest so Pub/Sub retries without recording an
    // under-enriched event first.
    const response = await androidpublisher.purchases.subscriptionsv2.get(
      {
        packageName,
        token: payload.subscriptionNotification.purchaseToken,
      },
      { timeout: 10_000 },
    );

    const data = response.data;
    // `subscriptionsv2.get` always returns the v2 shape with
    // per-line-item `expiryTime`; the legacy `purchases.subscriptions.get`
    // had a root-level `expiryTimeMillis`, but we never call that
    // endpoint here.
    //
    // The current canonical model is singular. Never project one arbitrary
    // line item from a base-plan/add-on bundle onto the whole subscription.
    //
    // We deliberately do NOT match by `latestSuccessfulOrderId`: that
    // field carries a GPA Order ID, while the notification carries a
    // `purchaseToken` (different identifier — PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review). The
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
      // `Date.parse` returns NaN on malformed input, which would
      // hit Convex's number validator and 500 the webhook ingest.
      // Drop NaN to undefined so the receiver path falls back to the
      // wall-clock dedup heuristic (PR #124
      // (https://github.com/hyodotdev/openiap/pull/124) review).
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
    // Re-throw structured configuration errors so the route layer can map them
    // to an actionable 4xx. Ordinary API failures are sanitized below and
    // retried by Pub/Sub without recording the event first.
    if (error instanceof ConvexError) {
      throw error;
    }
    // Sanitized: only the error name is logged. The full
    // googleapis error object can include the original request URL with
    // an OAuth bearer token and the response body — neither belongs in
    // logs that get shipped to error aggregation.
    const sanitized =
      error instanceof Error ? error.name : "(unknown error type)";
    const errorTextForDetection = error instanceof Error ? error.message : "";
    // Auth-shaped failures (401/403, "invalid_grant", "Invalid JWT")
    // typically mean the operator rotated the service account. Drop
    // the cached client so the next webhook re-reads the file and
    // picks up the new credentials immediately instead of waiting
    // out the full TTL on a known-bad key. Prefer the structured
    // error properties (`code` / `status`) the googleapis library
    // ships on its GaxiosError shape — substring matching the
    // serialized message also catches the case but is brittle
    // (Google has changed wording across SDK versions). The string
    // checks stay as a fallback for unwrapped errors.
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
