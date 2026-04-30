# Webhook Event Mapping (ASN v2 ↔ RTDN ↔ openiap)

This document is the source of truth for how kit normalizes Apple App Store Server
Notifications v2 (ASN v2) and Google Play Real-Time Developer Notifications (RTDN)
into the unified `WebhookEvent` shape defined in [`packages/gql/src/webhook.graphql`](../../packages/gql/src/webhook.graphql).

When kit's webhook receivers are implemented (Phase 1, PR #2), they MUST follow
this table. When extending the spec (new event types, new stores), update this
document in the same PR.

## Subscription lifecycle

| openiap `WebhookEventType` | Apple ASN v2 `notificationType` (`subtype`) | Google RTDN `subscriptionNotification.notificationType` |
|---|---|---|
| `SubscriptionStarted` | `SUBSCRIBED` (`INITIAL_BUY`, `RESUBSCRIBE`) | `SUBSCRIPTION_PURCHASED` (1), `SUBSCRIPTION_RECOVERED` (4)¹ |
| `SubscriptionRenewed` | `DID_RENEW` | `SUBSCRIPTION_RENEWED` (2) |
| `SubscriptionExpired` | `EXPIRED` | `SUBSCRIPTION_EXPIRED` (13) |
| `SubscriptionInGracePeriod` | `DID_FAIL_TO_RENEW` (`GRACE_PERIOD`) | `SUBSCRIPTION_IN_GRACE_PERIOD` (6) |
| `SubscriptionInBillingRetry` | `DID_FAIL_TO_RENEW` (no subtype) | `SUBSCRIPTION_ON_HOLD` (5) |
| `SubscriptionRecovered` | `DID_RENEW` (after a prior failure) | `SUBSCRIPTION_RECOVERED` (4)¹, `SUBSCRIPTION_RESTARTED` (7) |
| `SubscriptionCanceled` | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_DISABLED`) | `SUBSCRIPTION_CANCELED` (3) |
| `SubscriptionUncanceled` | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_ENABLED`) | (no direct equivalent — inferred from `SUBSCRIPTION_RESTARTED` while period still active) |
| `SubscriptionRevoked` | `REVOKE` | `SUBSCRIPTION_REVOKED` (12) |
| `SubscriptionPriceChange` | `PRICE_INCREASE` | `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` (8) |
| `SubscriptionProductChanged` | `DID_CHANGE_RENEWAL_PREF` | `SUBSCRIPTION_DEFERRED` (9), `SUBSCRIPTION_PRODUCT_CHANGED` (no fixed code) |
| `SubscriptionPaused` | (no equivalent — iOS has no pause) | `SUBSCRIPTION_PAUSED` (10), `SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED` (11) |
| `SubscriptionResumed` | (no equivalent) | `SUBSCRIPTION_RECOVERED` (4) following `SUBSCRIPTION_PAUSED` |

¹ `SUBSCRIPTION_RECOVERED` (RTDN code 4) maps to either `SubscriptionStarted`
(when no prior active period existed) or `SubscriptionRecovered` (when recovering
from grace/hold/pause). kit decides based on the prior state in its
`subscriptions` table.

## One-time / common

| openiap `WebhookEventType` | Apple ASN v2 | Google RTDN |
|---|---|---|
| `PurchaseRefunded` | `REFUND` | `oneTimeProductNotification.notificationType = ONE_TIME_PRODUCT_CANCELED` (2), or `voidedPurchaseNotification` |
| `PurchaseConsumptionRequest` | `CONSUMPTION_REQUEST` | (no equivalent — Play handles consumption client-side) |
| `TestNotification` | `TEST` | `testNotification` field present on the RTDN message |

## Field mapping

| `WebhookEvent` field | Apple ASN v2 source | Google RTDN source |
|---|---|---|
| `id` | `notificationUUID` | Pub/Sub `messageId` |
| `occurredAt` | `signedDate` | `eventTimeMillis` |
| `environment` | `data.environment` (`Production` \| `Sandbox` \| `Xcode`) | `testNotification` present → `Sandbox`, else `Production` |
| `purchaseToken` | `data.signedTransactionInfo.originalTransactionId` | `subscriptionNotification.purchaseToken` or `oneTimeProductNotification.purchaseToken` |
| `productId` | `data.signedTransactionInfo.productId` | `subscriptionNotification.subscriptionId` or `oneTimeProductNotification.sku` |
| `expiresAt` | `data.signedRenewalInfo.expirationDate` (decoded JWS) | resolved by calling `purchases.subscriptionsv2.get` (ASN/RTDN do not embed it directly) |
| `renewsAt` | `data.signedRenewalInfo.renewalDate` | resolved by calling `purchases.subscriptionsv2.get` |
| `cancellationReason` | `data.signedTransactionInfo.revocationReason` + ASN `subtype` | `purchases.subscriptionsv2.get` → `canceledStateContext.userInitiatedCancellation` / `systemInitiatedCancellation` |
| `currency` | `data.signedTransactionInfo.currency` | from `purchases.subscriptionsv2.get` linked product price |
| `priceAmountMicros` | `data.signedTransactionInfo.price` × 1000 (ASN reports in millicents; convert to micros) | `purchases.subscriptionsv2.get` → `lineItems[*].autoRenewingPlan.recurringPrice.units` |
| `rawSignedPayload` | The complete `signedPayload` JWS string from the ASN body | The base64-decoded Pub/Sub message `data` (JSON) |

## Validation requirements (kit Phase 1, PR #2)

Both stores require signature verification before any event is emitted:

- **Apple ASN v2**: verify the JWS using Apple's public root certificates (refresh
  via the App Store Connect API). The receiver must reject unverified payloads
  with HTTP 401.
- **Google RTDN**: validate the Pub/Sub push request against the configured
  service account audience (OIDC token verification). Reject missing or invalid
  tokens with HTTP 401.

Idempotency:

- Use `(source, sourceNotificationId)` as the dedup key, where
  `sourceNotificationId` is `notificationUUID` for ASN v2 or `messageId` for
  RTDN. Convex idempotency table records the first-seen event and silently
  acknowledges duplicates with HTTP 200.

Replay window:

- Events MUST be retained for at least 30 days so `webhookEventsSince` can
  service reconnecting clients. Older events are pruned by a Convex cron job.
