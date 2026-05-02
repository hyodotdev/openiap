// Pure normalization helpers that map Apple ASN v2 and Google RTDN
// payloads to the unified `WebhookEvent` shape defined in
// `packages/gql/src/webhook.graphql`.
//
// This file is intentionally framework-free (no "use node", no Convex
// imports, no Apple/Google SDK imports) so it can run in the browser-
// safe Convex runtime, in vitest, and inside the Hono server bundle.
// The verifying receivers in `apple.ts` / `google.ts` decode the JWS
// (Apple) or Pub/Sub envelope (Google) and then hand the decoded
// payload here.
//
// SSOT for the mapping is `knowledge/external/webhook-mapping.md`.

// ---------------------------------------------------------------------------
// Generated GraphQL spec mirrors. These literals MUST stay in sync with
// the enum values in `packages/gql/src/webhook.graphql`.
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | "SubscriptionStarted"
  | "SubscriptionRenewed"
  | "SubscriptionExpired"
  | "SubscriptionInGracePeriod"
  | "SubscriptionInBillingRetry"
  | "SubscriptionRecovered"
  | "SubscriptionCanceled"
  | "SubscriptionUncanceled"
  | "SubscriptionRevoked"
  | "SubscriptionPriceChange"
  | "SubscriptionProductChanged"
  | "SubscriptionPaused"
  | "SubscriptionResumed"
  | "PurchaseRefunded"
  | "PurchaseConsumptionRequest"
  | "TestNotification";

export type WebhookEventSource =
  | "AppleAppStoreServerNotificationsV2"
  | "GooglePlayRealTimeDeveloperNotifications";

export type WebhookEventEnvironment = "Production" | "Sandbox" | "Xcode";

export type SubscriptionState =
  | "Active"
  | "InGracePeriod"
  | "InBillingRetry"
  | "Expired"
  | "Revoked"
  | "Refunded"
  | "Paused"
  | "Unknown";

export type WebhookCancellationReason =
  | "UserCanceled"
  | "BillingError"
  | "PriceIncreaseDeclined"
  | "ProductUnavailable"
  | "Refunded"
  | "Other";

export type IapPlatform = "IOS" | "Android";

// Result returned by the pure normalizers. Mirrors the GraphQL
// `WebhookEvent` payload minus `id` / `projectId` / `receivedAt` /
// `rawSignedPayload`, which the action layer fills in.
export type NormalizedWebhookEvent = {
  type: WebhookEventType;
  source: WebhookEventSource;
  platform: IapPlatform;
  environment: WebhookEventEnvironment;
  // TestNotification carries no transaction; all other event types
  // populate this. The purchaseToken-or-throw guard lives in the
  // platform-specific normalizers (normalizeAppleEvent /
  // normalizeGoogleEvent).
  purchaseToken: string | undefined;
  productId?: string;
  subscriptionState?: SubscriptionState;
  expiresAt?: number;
  renewsAt?: number;
  cancellationReason?: WebhookCancellationReason;
  currency?: string;
  priceAmountMicros?: number;
  occurredAt: number;
  // Stable per-notification identifier used for idempotency. ASN v2
  // `notificationUUID` or RTDN `messageId`.
  sourceNotificationId: string;
};

// ---------------------------------------------------------------------------
// Apple ASN v2
// ---------------------------------------------------------------------------

// Subset of the @apple/app-store-server-library types we care about,
// re-declared as plain shapes so this file can be imported from non-
// node Convex contexts (the SDK itself imports node:crypto).

export type AppleAsnPayload = {
  notificationType: string;
  subtype?: string | null;
  notificationUUID: string;
  signedDate: number;
  data?: AppleAsnData | null;
};

export type AppleAsnData = {
  environment?: string | null;
  bundleId?: string | null;
  appAppleId?: number | null;
  signedTransactionInfo?: string | null;
  signedRenewalInfo?: string | null;
};

// Decoded JWS payloads — Apple's library exposes these via verifier
// methods. Only the fields the normalizer reads are listed.
export type AppleDecodedTransaction = {
  originalTransactionId?: string | null;
  transactionId?: string | null;
  productId?: string | null;
  expiresDate?: number | null;
  revocationReason?: number | null;
  currency?: string | null;
  // ASN v2 reports `price` in **milliunits** — 1/1000 of a currency
  // unit. Apple's docs use "milliunits" (NOT "millicents"). $9.99 is
  // 9990 milliunits; convert to micros (1/1_000_000 of a unit) by
  // multiplying by 1000.
  // https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload/price
  price?: number | null;
};

export type AppleDecodedRenewalInfo = {
  autoRenewStatus?: number | null;
  autoRenewProductId?: string | null;
  expirationIntent?: number | null;
  gracePeriodExpiresDate?: number | null;
  isInBillingRetryPeriod?: boolean | null;
  renewalDate?: number | null;
  recentSubscriptionStartDate?: number | null;
};

const APPLE_ENV_MAP: Record<string, WebhookEventEnvironment> = {
  Production: "Production",
  Sandbox: "Sandbox",
  Xcode: "Xcode",
  // Apple's docs show capitalized values, but defensive lower-case
  // handling avoids spurious "Unknown" mappings if Apple ever ships
  // a sandbox quirk.
  production: "Production",
  sandbox: "Sandbox",
  xcode: "Xcode",
};

function mapAppleEnvironment(
  value: string | null | undefined,
): WebhookEventEnvironment {
  if (!value) {
    return "Production";
  }
  return APPLE_ENV_MAP[value] ?? "Production";
}

// Maps (notificationType, subtype) -> WebhookEventType. Returns null
// when the combination is not observable in the openiap spec yet
// (e.g. OFFER_REDEEMED, RENEWAL_EXTENDED) — kit will record but not
// emit those.
export function mapAppleNotificationType(
  notificationType: string,
  subtype?: string | null,
): WebhookEventType | null {
  switch (notificationType) {
    case "SUBSCRIBED":
      // INITIAL_BUY and RESUBSCRIBE both surface as SubscriptionStarted.
      return "SubscriptionStarted";
    case "DID_RENEW":
      // BILLING_RECOVERY subtype indicates the subscription is back from
      // a failure state, not a routine renewal.
      return subtype === "BILLING_RECOVERY"
        ? "SubscriptionRecovered"
        : "SubscriptionRenewed";
    case "EXPIRED":
      return "SubscriptionExpired";
    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD"
        ? "SubscriptionInGracePeriod"
        : "SubscriptionInBillingRetry";
    case "GRACE_PERIOD_EXPIRED":
      // Grace period ended with no successful renewal — the subscription
      // is now in billing retry / on hold.
      return "SubscriptionInBillingRetry";
    case "DID_CHANGE_RENEWAL_STATUS":
      if (subtype === "AUTO_RENEW_DISABLED") {
        return "SubscriptionCanceled";
      }
      if (subtype === "AUTO_RENEW_ENABLED") {
        return "SubscriptionUncanceled";
      }
      return null;
    case "DID_CHANGE_RENEWAL_PREF":
      return "SubscriptionProductChanged";
    case "PRICE_INCREASE":
      return "SubscriptionPriceChange";
    case "REVOKE":
      return "SubscriptionRevoked";
    case "REFUND":
      return "PurchaseRefunded";
    case "REFUND_REVERSED":
      // Refund reversed means the user retains their purchase — surface
      // as a fresh "Started" so consumers re-grant entitlement. The raw
      // payload still describes the reversal for consumers that need it.
      return "SubscriptionStarted";
    case "CONSUMPTION_REQUEST":
      return "PurchaseConsumptionRequest";
    case "TEST":
      return "TestNotification";
    default:
      return null;
  }
}

function mapAppleCancellationReason(
  notificationType: string,
  subtype: string | null | undefined,
  renewalInfo: AppleDecodedRenewalInfo | null | undefined,
): WebhookCancellationReason | undefined {
  if (notificationType === "REFUND" || notificationType === "REVOKE") {
    return "Refunded";
  }
  if (
    notificationType === "DID_CHANGE_RENEWAL_STATUS" &&
    subtype === "AUTO_RENEW_DISABLED"
  ) {
    return "UserCanceled";
  }
  // Apple `expirationIntent`:
  //   1: customer canceled, 2: billing error, 3: price increase
  //   declined, 4: product unavailable at renewal time, 5: unknown
  if (renewalInfo?.expirationIntent != null) {
    switch (renewalInfo.expirationIntent) {
      case 1:
        return "UserCanceled";
      case 2:
        return "BillingError";
      case 3:
        return "PriceIncreaseDeclined";
      case 4:
        return "ProductUnavailable";
      case 5:
        return "Other";
    }
  }
  return undefined;
}

function deriveAppleSubscriptionState(
  type: WebhookEventType,
): SubscriptionState | undefined {
  switch (type) {
    case "SubscriptionStarted":
    case "SubscriptionRenewed":
    case "SubscriptionRecovered":
    case "SubscriptionUncanceled":
    case "SubscriptionResumed":
    case "SubscriptionPriceChange":
    case "SubscriptionProductChanged":
      return "Active";
    case "SubscriptionInGracePeriod":
      return "InGracePeriod";
    case "SubscriptionInBillingRetry":
      return "InBillingRetry";
    case "SubscriptionExpired":
      return "Expired";
    case "SubscriptionRevoked":
      return "Revoked";
    case "SubscriptionCanceled":
      // User turned off auto-renew — access continues until expiry, so
      // the subscription is still Active until the period ends.
      return "Active";
    case "PurchaseRefunded":
      return "Refunded";
    case "SubscriptionPaused":
      return "Paused";
    default:
      return undefined;
  }
}

export type NormalizeAppleInput = {
  payload: AppleAsnPayload;
  transaction?: AppleDecodedTransaction | null;
  renewalInfo?: AppleDecodedRenewalInfo | null;
};

export class WebhookNormalizationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UnknownEventType"
      | "MissingPurchaseToken"
      | "MissingNotificationId",
  ) {
    super(message);
    this.name = "WebhookNormalizationError";
  }
}

export function normalizeAppleAsn(
  input: NormalizeAppleInput,
): NormalizedWebhookEvent {
  const { payload, transaction, renewalInfo } = input;

  if (!payload.notificationUUID) {
    throw new WebhookNormalizationError(
      "Apple ASN v2 payload is missing notificationUUID",
      "MissingNotificationId",
    );
  }

  const type = mapAppleNotificationType(
    payload.notificationType,
    payload.subtype ?? null,
  );

  if (type === null) {
    throw new WebhookNormalizationError(
      `Unsupported Apple notificationType: ${payload.notificationType} / subtype: ${payload.subtype ?? "<none>"}`,
      "UnknownEventType",
    );
  }

  // TestNotification has no transaction/renewal data and therefore no
  // purchaseToken — the schema's purchaseToken column is optional so
  // we leave it undefined for those rows instead of synthesizing a
  // placeholder (which would pollute by-token lookups). Dedup uses
  // (projectId, source, sourceNotificationId) and doesn't depend on
  // purchaseToken either, so the test event still flows end-to-end.
  const purchaseToken =
    transaction?.originalTransactionId ??
    transaction?.transactionId ??
    undefined;

  if (!purchaseToken && type !== "TestNotification") {
    throw new WebhookNormalizationError(
      "Apple ASN v2 payload missing originalTransactionId for non-test notification",
      "MissingPurchaseToken",
    );
  }

  // Apple reports `price` in milliunits (1/1000 of a currency unit —
  // see the note on AppleDecodedTransaction.price above). openiap
  // exposes micros (1/1_000_000) to match Google's
  // `priceAmountMicros` convention, so milliunits → micros is a 1000×
  // multiplier (e.g. $9.99 → 9990 milliunits → 9_990_000 micros).
  const priceAmountMicros =
    typeof transaction?.price === "number"
      ? transaction.price * 1000
      : undefined;

  return {
    type,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: mapAppleEnvironment(payload.data?.environment ?? null),
    purchaseToken,
    productId: transaction?.productId ?? undefined,
    subscriptionState: deriveAppleSubscriptionState(type),
    expiresAt: transaction?.expiresDate ?? undefined,
    renewsAt: renewalInfo?.renewalDate ?? undefined,
    cancellationReason: mapAppleCancellationReason(
      payload.notificationType,
      payload.subtype ?? null,
      renewalInfo ?? null,
    ),
    currency: transaction?.currency ?? undefined,
    priceAmountMicros,
    occurredAt: payload.signedDate,
    sourceNotificationId: payload.notificationUUID,
  };
}

// ---------------------------------------------------------------------------
// Google RTDN
// ---------------------------------------------------------------------------

// RTDN payload shape — see
// https://developer.android.com/google/play/billing/rtdn-reference

export type GoogleRtdnPayload = {
  // Pub/Sub message id (used for idempotency).
  messageId: string;
  // ISO-8601 string from Pub/Sub publishTime; we accept either that or
  // the RTDN body's `eventTimeMillis` and prefer the latter.
  publishTimeMs?: number;
  packageName?: string;
  eventTimeMillis: number;
  subscriptionNotification?: GoogleSubscriptionNotification | null;
  oneTimeProductNotification?: GoogleOneTimeProductNotification | null;
  voidedPurchaseNotification?: GoogleVoidedPurchaseNotification | null;
  testNotification?: GoogleTestNotification | null;
};

export type GoogleSubscriptionNotification = {
  // RTDN numeric type — see SUBSCRIPTION_NOTIFICATION_TYPE in the
  // mapping doc.
  notificationType: number;
  purchaseToken: string;
  subscriptionId: string;
};

export type GoogleOneTimeProductNotification = {
  notificationType: number;
  purchaseToken: string;
  sku: string;
};

export type GoogleVoidedPurchaseNotification = {
  purchaseToken: string;
  orderId?: string;
  productType?: number;
  refundType?: number;
};

export type GoogleTestNotification = {
  version: string;
};

// Optional supplemental data, fetched separately by the action via
// `androidpublisher.purchases.subscriptionsv2.get` because RTDN does
// not embed expiry / price information.
export type GoogleSubscriptionInfo = {
  expiryTimeMillis?: number;
  // Auto-renewing plans expose the next renewal time inline; one-off
  // prepaid plans don't carry one.
  autoRenewingPlanRenewsTimeMillis?: number;
  state?: string;
  cancelReason?: string;
  currency?: string;
  priceAmountMicros?: number;
};

// RTDN numeric codes per
// https://developer.android.com/google/play/billing/rtdn-reference#sub
// Codes 1 and 4 were swapped in an earlier draft (caught in PR #123
// review) — `1 = RECOVERED` and `4 = PURCHASED`. Code 7 = RESTARTED
// means the user re-enabled auto-renew while the subscription was
// still in its active period, which matches the
// `SubscriptionUncanceled` semantics, not `Started`. Code 11 =
// PAUSE_SCHEDULE_CHANGED fires when a pause is scheduled / changed,
// not on resume — collapsing it onto `Paused` keeps the event log
// honest (the actual end-of-pause appears as RENEWED/RECOVERED).
const GOOGLE_SUB_TYPE_MAP: Record<number, WebhookEventType | null> = {
  1: "SubscriptionRecovered", // SUBSCRIPTION_RECOVERED
  2: "SubscriptionRenewed", // SUBSCRIPTION_RENEWED
  3: "SubscriptionCanceled", // SUBSCRIPTION_CANCELED
  4: "SubscriptionStarted", // SUBSCRIPTION_PURCHASED
  5: "SubscriptionInBillingRetry", // SUBSCRIPTION_ON_HOLD
  6: "SubscriptionInGracePeriod", // SUBSCRIPTION_IN_GRACE_PERIOD
  7: "SubscriptionUncanceled", // SUBSCRIPTION_RESTARTED — auto-renew re-enabled
  8: "SubscriptionPriceChange", // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
  9: "SubscriptionProductChanged", // SUBSCRIPTION_DEFERRED
  10: "SubscriptionPaused", // SUBSCRIPTION_PAUSED
  11: "SubscriptionPaused", // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED — schedule change, not resume
  12: "SubscriptionRevoked", // SUBSCRIPTION_REVOKED
  13: "SubscriptionExpired", // SUBSCRIPTION_EXPIRED
  // 19 = SUBSCRIPTION_PRICE_CHANGE_UPDATED — alias for code 8
  19: "SubscriptionPriceChange",
  // 20 = SUBSCRIPTION_PENDING_PURCHASE_CANCELED
  20: "SubscriptionCanceled",
};

const GOOGLE_ONE_TIME_TYPE_MAP: Record<number, WebhookEventType | null> = {
  // ONE_TIME_PRODUCT_PURCHASED — initial purchase. We re-use Started
  // since openiap doesn't currently distinguish one-time activation.
  1: "SubscriptionStarted",
  2: "PurchaseRefunded", // ONE_TIME_PRODUCT_CANCELED
};

export function mapGoogleSubscriptionNotificationType(
  notificationType: number,
): WebhookEventType | null {
  return GOOGLE_SUB_TYPE_MAP[notificationType] ?? null;
}

export function mapGoogleOneTimeNotificationType(
  notificationType: number,
): WebhookEventType | null {
  return GOOGLE_ONE_TIME_TYPE_MAP[notificationType] ?? null;
}

function deriveGoogleSubscriptionState(
  type: WebhookEventType,
  info: GoogleSubscriptionInfo | null | undefined,
): SubscriptionState | undefined {
  if (info?.state) {
    // androidpublisher.subscriptionsv2 state values:
    //   SUBSCRIPTION_STATE_ACTIVE, SUBSCRIPTION_STATE_CANCELED,
    //   SUBSCRIPTION_STATE_IN_GRACE_PERIOD, SUBSCRIPTION_STATE_ON_HOLD,
    //   SUBSCRIPTION_STATE_PAUSED, SUBSCRIPTION_STATE_EXPIRED,
    //   SUBSCRIPTION_STATE_PENDING.
    switch (info.state) {
      case "SUBSCRIPTION_STATE_ACTIVE":
        return "Active";
      case "SUBSCRIPTION_STATE_CANCELED":
        // Auto-renew off but still has access until expiry — Active.
        return "Active";
      case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
        return "InGracePeriod";
      case "SUBSCRIPTION_STATE_ON_HOLD":
        return "InBillingRetry";
      case "SUBSCRIPTION_STATE_PAUSED":
        return "Paused";
      case "SUBSCRIPTION_STATE_EXPIRED":
        return "Expired";
    }
  }
  // Fallback when subscriptionsv2 was not fetched (e.g. action didn't
  // have credentials yet, or this is a one-time / test notification).
  switch (type) {
    case "SubscriptionStarted":
    case "SubscriptionRenewed":
    case "SubscriptionRecovered":
    case "SubscriptionResumed":
    case "SubscriptionUncanceled":
    case "SubscriptionPriceChange":
    case "SubscriptionProductChanged":
      return "Active";
    case "SubscriptionInGracePeriod":
      return "InGracePeriod";
    case "SubscriptionInBillingRetry":
      return "InBillingRetry";
    case "SubscriptionExpired":
      return "Expired";
    case "SubscriptionRevoked":
      return "Revoked";
    case "SubscriptionPaused":
      return "Paused";
    case "SubscriptionCanceled":
      return "Active";
    case "PurchaseRefunded":
      return "Refunded";
    default:
      return undefined;
  }
}

function mapGoogleCancellationReason(
  type: WebhookEventType,
  info: GoogleSubscriptionInfo | null | undefined,
): WebhookCancellationReason | undefined {
  if (type === "PurchaseRefunded" || type === "SubscriptionRevoked") {
    return "Refunded";
  }
  if (info?.cancelReason) {
    switch (info.cancelReason) {
      case "USER_CANCELED":
        return "UserCanceled";
      case "BILLING_ERROR":
      case "SYSTEM_INITIATED_CANCELLATION":
        return "BillingError";
      case "NEW_PRICE_REJECTED":
        return "PriceIncreaseDeclined";
      case "DEVELOPER_CANCELED":
        return "ProductUnavailable";
      default:
        return "Other";
    }
  }
  if (type === "SubscriptionCanceled") {
    return "UserCanceled";
  }
  return undefined;
}

export type NormalizeGoogleInput = {
  payload: GoogleRtdnPayload;
  subscriptionInfo?: GoogleSubscriptionInfo | null;
};

export function normalizeGoogleRtdn(
  input: NormalizeGoogleInput,
): NormalizedWebhookEvent {
  const { payload, subscriptionInfo } = input;

  if (!payload.messageId) {
    throw new WebhookNormalizationError(
      "Google RTDN payload missing messageId",
      "MissingNotificationId",
    );
  }

  // Determine the event flavor first — RTDN messages carry exactly one
  // of (subscriptionNotification | oneTimeProductNotification |
  // voidedPurchaseNotification | testNotification).
  let type: WebhookEventType | null = null;
  let purchaseToken: string | null = null;
  let productId: string | undefined;

  if (payload.testNotification) {
    type = "TestNotification";
    // RTDN test payloads carry no purchaseToken — leave it null so the
    // optional schema column stays empty, matching the Apple side.
    purchaseToken = null;
  } else if (payload.subscriptionNotification) {
    type = mapGoogleSubscriptionNotificationType(
      payload.subscriptionNotification.notificationType,
    );
    purchaseToken = payload.subscriptionNotification.purchaseToken;
    productId = payload.subscriptionNotification.subscriptionId;
  } else if (payload.oneTimeProductNotification) {
    type = mapGoogleOneTimeNotificationType(
      payload.oneTimeProductNotification.notificationType,
    );
    purchaseToken = payload.oneTimeProductNotification.purchaseToken;
    productId = payload.oneTimeProductNotification.sku;
  } else if (payload.voidedPurchaseNotification) {
    // VOIDED_PURCHASE always means the purchase was refunded /
    // chargebacked — collapse to PurchaseRefunded regardless of code.
    type = "PurchaseRefunded";
    purchaseToken = payload.voidedPurchaseNotification.purchaseToken;
  }

  if (type === null) {
    throw new WebhookNormalizationError(
      "Unsupported Google RTDN payload variant",
      "UnknownEventType",
    );
  }
  if (!purchaseToken && type !== "TestNotification") {
    throw new WebhookNormalizationError(
      "Google RTDN payload missing purchaseToken",
      "MissingPurchaseToken",
    );
  }

  // RTDN does not surface sandbox vs production — testNotification
  // implies sandbox, otherwise prod.
  const environment: WebhookEventEnvironment = payload.testNotification
    ? "Sandbox"
    : "Production";

  return {
    type,
    source: "GooglePlayRealTimeDeveloperNotifications",
    platform: "Android",
    environment,
    purchaseToken: purchaseToken ?? undefined,
    productId,
    subscriptionState: deriveGoogleSubscriptionState(
      type,
      subscriptionInfo ?? null,
    ),
    expiresAt: subscriptionInfo?.expiryTimeMillis,
    renewsAt: subscriptionInfo?.autoRenewingPlanRenewsTimeMillis,
    cancellationReason: mapGoogleCancellationReason(
      type,
      subscriptionInfo ?? null,
    ),
    currency: subscriptionInfo?.currency,
    priceAmountMicros: subscriptionInfo?.priceAmountMicros,
    occurredAt: payload.eventTimeMillis,
    sourceNotificationId: payload.messageId,
  };
}
