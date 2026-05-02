import { v } from "convex/values";

// Convex validators for webhook enums. Re-used by both the internal
// mutation arguments and the public query return shape so the schema
// stays in sync without a hand-maintained second copy.
//
// Mirror of the GraphQL enums in `packages/gql/src/webhook.graphql`.

export const webhookEventTypeValidator = v.union(
  v.literal("SubscriptionStarted"),
  v.literal("SubscriptionRenewed"),
  v.literal("SubscriptionExpired"),
  v.literal("SubscriptionInGracePeriod"),
  v.literal("SubscriptionInBillingRetry"),
  v.literal("SubscriptionRecovered"),
  v.literal("SubscriptionCanceled"),
  v.literal("SubscriptionUncanceled"),
  v.literal("SubscriptionRevoked"),
  v.literal("SubscriptionPriceChange"),
  v.literal("SubscriptionProductChanged"),
  v.literal("SubscriptionPaused"),
  v.literal("SubscriptionResumed"),
  v.literal("PurchaseRefunded"),
  v.literal("PurchaseConsumptionRequest"),
  v.literal("TestNotification"),
);

export const webhookEventSourceValidator = v.union(
  v.literal("AppleAppStoreServerNotificationsV2"),
  v.literal("GooglePlayRealTimeDeveloperNotifications"),
  // Synthetic source for Meta Horizon Store. Meta has no webhook /
  // push notification system so kit polls `verify_entitlement` on a
  // cron and emits these synthetic events when an entitlement
  // transitions. SDK consumers see them on the SSE stream alongside
  // real Apple / Google webhooks.
  v.literal("MetaHorizonReconciler"),
);

export const webhookEventEnvironmentValidator = v.union(
  v.literal("Production"),
  v.literal("Sandbox"),
  v.literal("Xcode"),
);

export const webhookEventPlatformValidator = v.union(
  v.literal("IOS"),
  v.literal("Android"),
);

export const subscriptionStateValidator = v.union(
  v.literal("Active"),
  v.literal("InGracePeriod"),
  v.literal("InBillingRetry"),
  v.literal("Expired"),
  v.literal("Revoked"),
  v.literal("Refunded"),
  v.literal("Paused"),
  v.literal("Unknown"),
);

export const webhookCancellationReasonValidator = v.union(
  v.literal("UserCanceled"),
  v.literal("BillingError"),
  v.literal("PriceIncreaseDeclined"),
  v.literal("ProductUnavailable"),
  v.literal("Refunded"),
  v.literal("Other"),
);
