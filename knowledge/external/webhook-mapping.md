# IAPKit Internal Webhook Mapping (ASN v2 ↔ RTDN)

This document is the source of truth for how kit normalizes Apple App Store Server
Notifications v2 (ASN v2) and Google Play Real-Time Developer Notifications (RTDN)
for its internal subscription state machine and persisted event records. These
types are not part of the OpenIAP native or framework SDK contract.

Kit's inbound receivers and internal state machine MUST follow this table. When
adding an internal lifecycle type or store source, update this document and the
corresponding normalization tests in the same PR.

## Subscription lifecycle

| IAPKit internal event type              | Apple ASN v2 `notificationType` (`subtype`)         | Google RTDN `subscriptionNotification.notificationType`                                                                                               |
| --------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionStarted`                   | `SUBSCRIBED` (`INITIAL_BUY`, `RESUBSCRIBE`)         | `SUBSCRIPTION_PURCHASED` (4)                                                                                                                          |
| `SubscriptionRenewed`                   | `DID_RENEW`                                         | `SUBSCRIPTION_RENEWED` (2)                                                                                                                            |
| `SubscriptionExpired`                   | `EXPIRED`                                           | `SUBSCRIPTION_EXPIRED` (13)                                                                                                                           |
| `SubscriptionInGracePeriod`             | `DID_FAIL_TO_RENEW` (`GRACE_PERIOD`)                | `SUBSCRIPTION_IN_GRACE_PERIOD` (6)                                                                                                                    |
| `SubscriptionInBillingRetry`            | `DID_FAIL_TO_RENEW` (no subtype)                    | `SUBSCRIPTION_ON_HOLD` (5)                                                                                                                            |
| `SubscriptionRecovered`                 | `DID_RENEW` (after a prior failure)                 | `SUBSCRIPTION_RECOVERED` (1)                                                                                                                          |
| `SubscriptionCanceled`                  | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_DISABLED`) | `SUBSCRIPTION_CANCELED` (3), `SUBSCRIPTION_CANCELLATION_SCHEDULED` (18) — access continues until the current period or installment commitment ends    |
| `SubscriptionUncanceled`                | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_ENABLED`)  | `SUBSCRIPTION_RESTARTED` (7) — fired when auto-renew is re-enabled while the period is still active                                                   |
| `SubscriptionRevoked`                   | `REVOKE`                                            | `SUBSCRIPTION_REVOKED` (12)                                                                                                                           |
| `SubscriptionPriceChange`               | `PRICE_INCREASE`                                    | `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` (8), `SUBSCRIPTION_PRICE_CHANGE_UPDATED` (19)                                                                   |
| `SubscriptionProductChanged`            | `DID_CHANGE_RENEWAL_PREF`                           | `SUBSCRIPTION_ITEMS_CHANGED` (17)                                                                                                                     |
| `SubscriptionDeferred`                  | (no equivalent)                                     | `SUBSCRIPTION_DEFERRED` (9) — extends recurrence time without changing products                                                                       |
| `SubscriptionPaused`                    | (no equivalent — iOS has no pause)                  | `SUBSCRIPTION_PAUSED` (10)                                                                                                                            |
| `SubscriptionPauseScheduleChanged`      | (no equivalent)                                     | `SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED` (11) — schedule metadata only; it does not revoke current entitlement                                           |
| `SubscriptionPendingPurchaseCanceled`   | (no equivalent)                                     | `SUBSCRIPTION_PENDING_PURCHASE_CANCELED` (20) — audit-only; no completed purchase or entitlement exists                                               |
| `SubscriptionPriceStepUpConsentChanged` | (no equivalent)                                     | `SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED` (22) — audit-only consent metadata; it does not itself change entitlement or catalog price               |
| `SubscriptionResumed`                   | (no equivalent)                                     | `SUBSCRIPTION_RECOVERED` (1) when fired after a `SUBSCRIPTION_PAUSED` — kit chooses Resumed vs Recovered based on the prior `subscriptions` row state |

PR #123 review caught the earlier draft where codes 1 and 4 were swapped
(`SUBSCRIPTION_RECOVERED` is code 1, `SUBSCRIPTION_PURCHASED` is code 4)
and where `SUBSCRIPTION_RESTARTED` (7) was incorrectly mapped to
`SubscriptionRecovered` instead of `SubscriptionUncanceled`. The mapping
above reflects the corrected RTDN reference.

## One-time / common

| IAPKit internal event type   | Apple ASN v2          | Google RTDN                                                                                                    |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PurchaseRefunded`           | `REFUND`              | `oneTimeProductNotification.notificationType = ONE_TIME_PRODUCT_CANCELED` (2), or `voidedPurchaseNotification` |
| `PurchaseConsumptionRequest` | `CONSUMPTION_REQUEST` | (no equivalent — Play handles consumption client-side)                                                         |
| `TestNotification`           | `TEST`                | `testNotification` field present on the RTDN message                                                           |

## Field mapping

| Internal event field    | Apple ASN v2 source                                                                                                                                       | Google RTDN source                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | `notificationUUID`                                                                                                                                        | Pub/Sub `messageId`                                                                                                                                                                      |
| `occurredAt`            | `signedDate`                                                                                                                                              | `eventTimeMillis`                                                                                                                                                                        |
| `environment`           | `data.environment` (`Production` \| `Sandbox` \| `Xcode`)                                                                                                 | `testNotification` present → `Sandbox`, else `Production`                                                                                                                                |
| `purchaseToken`         | `data.signedTransactionInfo.originalTransactionId`                                                                                                        | `subscriptionNotification.purchaseToken` or `oneTimeProductNotification.purchaseToken`                                                                                                   |
| `transactionId`         | `data.signedTransactionInfo.transactionId`                                                                                                                | `voidedPurchaseNotification.orderId` when present; a Play purchase token is never labeled as a transaction id                                                                            |
| `originalTransactionId` | `data.signedTransactionInfo.originalTransactionId`                                                                                                        | not present in RTDN                                                                                                                                                                      |
| `productId`             | `data.signedRenewalInfo.autoRenewProductId` for `DID_CHANGE_RENEWAL_PREF`, otherwise `data.signedTransactionInfo.productId`                               | selected `purchases.subscriptionsv2.get` line item (legacy `subscriptionNotification.subscriptionId` fallback), or `oneTimeProductNotification.sku`                                     |
| `expiresAt`             | `data.signedTransactionInfo.expiresDate`                                                                                                                   | resolved by calling `purchases.subscriptionsv2.get` (RTDN does not embed it directly)                                                                                                    |
| `renewsAt`              | `data.signedRenewalInfo.renewalDate`                                                                                                                      | resolved by calling `purchases.subscriptionsv2.get`                                                                                                                                      |
| `cancellationReason`    | `data.signedTransactionInfo.revocationReason` + ASN `subtype`                                                                                             | `purchases.subscriptionsv2.get` → `canceledStateContext.userInitiatedCancellation` / `systemInitiatedCancellation`                                                                       |
| `currency`              | current transaction currency; renewal-info currency for price/product changes                                                                             | selected line item's current recurring currency, or `priceChangeDetails.newPrice.currencyCode` for price changes                                                                        |
| `priceAmountMicros`     | current transaction price × 1000; renewal price × 1000 for price/product changes (Apple values are milliunits)                                            | selected line item's current recurring price, or `priceChangeDetails.newPrice` for price changes; `units * 1_000_000 + Math.round(nanos / 1000)`                                         |
| `rawSignedPayload`      | The complete `signedPayload` JWS string from the ASN body                                                                                                 | The base64-decoded Pub/Sub message `data` (JSON)                                                                                                                                         |

For Apple `DID_CHANGE_RENEWAL_PREF`, the mapped `productId` describes the next
billing period. The canonical subscription keeps its current product until the
renewal transaction takes effect.

## Validation requirements

Both stores require signature verification before any event is accepted:

- **Apple ASN v2**: verify the JWS certificate chain against IAPKit's embedded
  Apple public root certificates. Online OCSP/CRL checks are disabled so
  transient network failures do not create webhook retry storms. The receiver
  rejects an invalid signature with HTTP 400 as a permanent payload failure.
- **Google RTDN**: validate the Pub/Sub push request against the configured
  service account audience (OIDC token verification). Reject missing or invalid
  tokens with HTTP 401.

Idempotency:

- Use `(projectId, source, sourceNotificationId)` as the dedup key, where
  `sourceNotificationId` is `notificationUUID` for ASN v2 or `messageId` for
  RTDN. Convex idempotency table records the first-seen event and silently
  acknowledges duplicates with HTTP 200.

Retention:

- Events are retained for the bounded IAPKit operational window and pruned by a
  Convex cron job. They are not exposed as a public replay stream.

Meta Horizon has no inbound webhook or background lifecycle lane in IAPKit.
`POST /v1/purchase/verify` performs a synchronous entitlement check only. The
`MetaHorizonReconciler` source remains schema-compatible for legacy retained
rows, but those synthetic events are excluded from current revenue rollups.

Amazon RVS also has no inbound webhook receiver in IAPKit. A bounded purchase
reconciler schedules active Amazon receipt rows for revisits on a 48-hour due
cadence, but backlog, retries, and lease recovery mean it does not guarantee
that every row is checked within 72 hours. It updates state only from
authoritative RVS outcomes and preserves the last confirmed state across
transient or malformed responses.
