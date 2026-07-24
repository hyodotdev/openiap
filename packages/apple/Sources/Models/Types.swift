// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Refresh this file with the generated-types workflow documented for your checkout.
// ============================================================================

import Foundation

// MARK: - Enums

/// Alternative billing mode for Android
/// Controls which billing system is used
/// Use the user-choice-billing program for user choice billing and external-offer
/// for external digital-content offers.
/// @deprecated Use enableBillingProgramAndroid with BillingProgramAndroid instead. Scheduled for removal in OpenIAP 3.0.
public enum AlternativeBillingModeAndroid: String, Codable, CaseIterable {
    /// Standard Google Play billing (default)
    case none = "none"
    /// User choice billing - user can select between Google Play or alternative
    /// Requires Google Play Billing Library 7.0+
    /// @deprecated Use the user-choice-billing BillingProgramAndroid value instead. Scheduled for removal in OpenIAP 3.0.
    case userChoice = "user-choice"
    /// Alternative billing only - no Google Play billing option
    /// Requires Google Play Billing Library 6.2+
    /// @deprecated Use the external-offer BillingProgramAndroid value instead. Scheduled for removal in OpenIAP 3.0.
    case alternativeOnly = "alternative-only"
}

/// Play Billing choice image layout (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public enum BillingChoiceImageLayoutAndroid: String, Codable, CaseIterable {
    /// Rectangular image with a 4:1 aspect ratio.
    case rectangularFourByOne = "rectangular-four-by-one"
    /// Rectangular image with a 3:1 aspect ratio.
    case rectangularThreeByOne = "rectangular-three-by-one"
    /// Rectangular image with a 2:2 aspect ratio.
    case rectangularTwoByTwo = "rectangular-two-by-two"
}

/// Choice screen renderer for Billing Choice availability (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public enum BillingChoiceScreenTypeAndroid: String, Codable, CaseIterable {
    /// Unspecified choice screen type.
    case unspecified = "unspecified"
    /// Choice screen is rendered by the developer app.
    case developerRendered = "developer-rendered"
    /// Choice screen is rendered by Google Play.
    case googleRendered = "google-rendered"
}

/// Billing program types for Google Play Billing Programs (Android)
/// Available in Google Play Billing Library 8.2.0 (External Offer and External Content Link
/// integrations require 8.2.1+), EXTERNAL_PAYMENTS added in 8.3.0,
/// BILLING_CHOICE added in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
/// (requires Play Billing 9.1.0+).
public enum BillingProgramAndroid: String, Codable, CaseIterable {
    /// Unspecified billing program. Do not use.
    case unspecified = "unspecified"
    /// User Choice Billing program.
    /// User can select between Google Play Billing or alternative billing.
    /// Available in Google Play Billing Library 7.0+
    case userChoiceBilling = "user-choice-billing"
    /// External Content Links program.
    /// Allows linking to external content outside the app.
    /// Available in Google Play Billing Library 8.2.0+
    case externalContentLink = "external-content-link"
    /// External Offers program.
    /// Allows offering digital content purchases outside the app.
    /// Available in Google Play Billing Library 8.2.0+
    case externalOffer = "external-offer"
    /// External Payments program (Japan only).
    /// Allows presenting a side-by-side choice between Google Play Billing and developer's external payment option.
    /// Users can choose to complete the purchase on the developer's website.
    /// Available in Google Play Billing Library 8.3.0+
    case externalPayments = "external-payments"
    /// Billing Choice program.
    /// Allows presenting Google Play Billing alongside an alternative in-app billing system or external web link.
    /// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    case billingChoice = "billing-choice"
}

/// Launch mode for developer billing option (Android)
/// Determines how the external payment URL is launched
/// Available in Google Play Billing Library 8.3.0+
public enum DeveloperBillingLaunchModeAndroid: String, Codable, CaseIterable {
    /// Unspecified launch mode. Do not use.
    case unspecified = "unspecified"
    /// Google Play will launch the link in an external browser or eligible app.
    /// Use this when you want Play to handle launching the external payment URL.
    case launchInExternalBrowserOrApp = "launch-in-external-browser-or-app"
    /// The caller app will launch the link after Play returns control.
    /// Use this when you want to handle launching the external payment URL yourself.
    case callerWillLaunchLink = "caller-will-launch-link"
}

/// Developer-provided billing destination type for Billing Program reporting details (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public enum DeveloperBillingTypeAndroid: String, Codable, CaseIterable {
    /// Unspecified developer billing type. Do not use.
    case developerBillingTypeUnspecified = "developer-billing-type-unspecified"
    /// Developer-provided billing via native in-app experience.
    case inApp = "in-app"
    /// Developer-provided billing via external link or embedded web browsing.
    case externalLink = "external-link"
}

/// Discount offer type enumeration.
/// Categorizes the type of discount or promotional offer.
public enum DiscountOfferType: String, Codable, CaseIterable {
    /// Introductory offer for new subscribers (first-time purchase discount)
    case introductory = "introductory"
    /// Promotional offer for existing or returning subscribers
    case promotional = "promotional"
    /// One-time product discount (Android only, Google Play Billing 8.0+)
    case oneTime = "one-time"
}

public enum ErrorCode: String, Codable, CaseIterable {
    case unknown = "unknown"
    case userCancelled = "user-cancelled"
    case userError = "user-error"
    case itemUnavailable = "item-unavailable"
    case remoteError = "remote-error"
    case networkError = "network-error"
    case serviceError = "service-error"
    /// @deprecated Use PurchaseVerificationFailed instead. Scheduled for removal in OpenIAP 3.0.
    case receiptFailed = "receipt-failed"
    /// @deprecated Use PurchaseVerificationFinished instead. Scheduled for removal in OpenIAP 3.0.
    case receiptFinished = "receipt-finished"
    /// @deprecated Use PurchaseVerificationFinishFailed instead. Scheduled for removal in OpenIAP 3.0.
    case receiptFinishedFailed = "receipt-finished-failed"
    case purchaseVerificationFailed = "purchase-verification-failed"
    case purchaseVerificationFinished = "purchase-verification-finished"
    case purchaseVerificationFinishFailed = "purchase-verification-finish-failed"
    case notPrepared = "not-prepared"
    case notEnded = "not-ended"
    case alreadyOwned = "already-owned"
    case developerError = "developer-error"
    case billingResponseJsonParseError = "billing-response-json-parse-error"
    case deferredPayment = "deferred-payment"
    case interrupted = "interrupted"
    case iapNotAvailable = "iap-not-available"
    case purchaseError = "purchase-error"
    case syncError = "sync-error"
    case transactionValidationFailed = "transaction-validation-failed"
    case activityUnavailable = "activity-unavailable"
    case alreadyPrepared = "already-prepared"
    case pending = "pending"
    case connectionClosed = "connection-closed"
    case initConnection = "init-connection"
    case serviceDisconnected = "service-disconnected"
    case serviceTimeout = "service-timeout"
    case queryProduct = "query-product"
    case skuNotFound = "sku-not-found"
    case skuOfferMismatch = "sku-offer-mismatch"
    case itemNotOwned = "item-not-owned"
    case billingUnavailable = "billing-unavailable"
    case featureNotSupported = "feature-not-supported"
    case emptySkuList = "empty-sku-list"
    case duplicatePurchase = "duplicate-purchase"

    /// Custom initializer to handle both kebab-case and camelCase error codes
    /// This ensures compatibility with react-native-iap and other libraries that may send camelCase
    public init?(rawValue: String) {
        // Try direct match first (kebab-case)
        switch rawValue {
        case "unknown", "Unknown":
            self = .unknown
        case "user-cancelled", "UserCancelled":
            self = .userCancelled
        case "user-error", "UserError":
            self = .userError
        case "item-unavailable", "ItemUnavailable":
            self = .itemUnavailable
        case "remote-error", "RemoteError":
            self = .remoteError
        case "network-error", "NetworkError":
            self = .networkError
        case "service-error", "ServiceError":
            self = .serviceError
        case "receipt-failed", "ReceiptFailed":
            self = .purchaseVerificationFailed // Legacy alias
        case "receipt-finished", "ReceiptFinished":
            self = .receiptFinished
        case "receipt-finished-failed", "ReceiptFinishedFailed":
            self = .receiptFinishedFailed
        case "purchase-verification-failed", "PurchaseVerificationFailed":
            self = .purchaseVerificationFailed
        case "purchase-verification-finished", "PurchaseVerificationFinished":
            self = .purchaseVerificationFinished
        case "purchase-verification-finish-failed", "PurchaseVerificationFinishFailed":
            self = .purchaseVerificationFinishFailed
        case "not-prepared", "NotPrepared":
            self = .notPrepared
        case "not-ended", "NotEnded":
            self = .notEnded
        case "already-owned", "AlreadyOwned":
            self = .alreadyOwned
        case "developer-error", "DeveloperError":
            self = .developerError
        case "billing-response-json-parse-error", "BillingResponseJsonParseError":
            self = .billingResponseJsonParseError
        case "deferred-payment", "DeferredPayment":
            self = .deferredPayment
        case "interrupted", "Interrupted":
            self = .interrupted
        case "iap-not-available", "IapNotAvailable":
            self = .iapNotAvailable
        case "purchase-error", "PurchaseError":
            self = .purchaseError
        case "sync-error", "SyncError":
            self = .syncError
        case "transaction-validation-failed", "TransactionValidationFailed":
            self = .transactionValidationFailed
        case "activity-unavailable", "ActivityUnavailable":
            self = .activityUnavailable
        case "already-prepared", "AlreadyPrepared":
            self = .alreadyPrepared
        case "pending", "Pending":
            self = .pending
        case "connection-closed", "ConnectionClosed":
            self = .connectionClosed
        case "init-connection", "InitConnection":
            self = .initConnection
        case "service-disconnected", "ServiceDisconnected":
            self = .serviceDisconnected
        case "service-timeout", "ServiceTimeout":
            self = .serviceTimeout
        case "query-product", "QueryProduct":
            self = .queryProduct
        case "sku-not-found", "SkuNotFound":
            self = .skuNotFound
        case "sku-offer-mismatch", "SkuOfferMismatch":
            self = .skuOfferMismatch
        case "item-not-owned", "ItemNotOwned":
            self = .itemNotOwned
        case "billing-unavailable", "BillingUnavailable":
            self = .billingUnavailable
        case "feature-not-supported", "FeatureNotSupported":
            self = .featureNotSupported
        case "empty-sku-list", "EmptySkuList":
            self = .emptySkuList
        case "duplicate-purchase", "DuplicatePurchase":
            self = .duplicatePurchase
        default:
            return nil
        }
    }
}

/// Launch mode for external link flow (Android)
/// Determines how the external URL is launched
/// Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link
/// integrations require 8.2.1+ and fresh details immediately before every redirect session.
public enum ExternalLinkLaunchModeAndroid: String, Codable, CaseIterable {
    /// Unspecified launch mode. Do not use.
    case unspecified = "unspecified"
    /// Play will launch the URL in an external browser or eligible app
    case launchInExternalBrowserOrApp = "launch-in-external-browser-or-app"
    /// Play will not launch the URL. The app handles launching the URL after Play returns control.
    case callerWillLaunchLink = "caller-will-launch-link"
}

/// Link type for external link flow (Android)
/// Specifies the type of external link destination
/// Available in Google Play Billing Library 8.2.0+
public enum ExternalLinkTypeAndroid: String, Codable, CaseIterable {
    /// Unspecified link type. Do not use.
    case unspecified = "unspecified"
    /// The link will direct users to a digital content offer
    case linkToDigitalContentOffer = "link-to-digital-content-offer"
    /// The link will direct users to download an app
    case linkToAppDownload = "link-to-app-download"
}

/// Notice types for ExternalPurchaseCustomLink (iOS 18.1+).
/// Determines the style of disclosure notice to display.
/// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/noticetype
public enum ExternalPurchaseCustomLinkNoticeTypeIOS: String, Codable, CaseIterable {
    /// Notice type indicating external purchases will be displayed in a browser
    /// or destination of the app's choice.
    case browser = "browser"
}

/// Token types for ExternalPurchaseCustomLink (iOS 18.1+).
/// Used to request different types of external purchase tokens for reporting to Apple.
/// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
public enum ExternalPurchaseCustomLinkTokenTypeIOS: String, Codable, CaseIterable {
    /// Token for customer acquisition tracking.
    /// Use this when a new customer makes their first purchase through external link.
    case acquisition = "acquisition"
    /// Token for ongoing services tracking.
    /// Use this for existing customers making additional purchases.
    case services = "services"
}

/// User actions on external purchase notice sheet (iOS 17.4+)
public enum ExternalPurchaseNoticeAction: String, Codable, CaseIterable {
    /// User chose to continue to external purchase
    case `continue` = "continue"
    /// User dismissed the notice sheet
    case dismissed = "dismissed"
}

public enum IapEvent: String, Codable, CaseIterable {
    case purchaseUpdated = "purchase-updated"
    case purchaseError = "purchase-error"
    case promotedProductIos = "promoted-product-ios"
    case userChoiceBillingAndroid = "user-choice-billing-android"
    /// Fired for External Payments (8.3.0+) and Google-rendered Billing Choice
    /// developer billing selections on Android. Billing Choice is available in
    /// OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    case developerProvidedBillingAndroid = "developer-provided-billing-android"
    /// Fired when a subscription enters a billing-issue state that requires user attention.
    /// A StoreKit billing-retry subscription may no longer be a current entitlement.
    /// Cross-platform unification of StoreKit 2 Message.billingIssue (iOS 16.4+,
    /// Mac Catalyst 16.4+, visionOS 1.0+) and
    /// Play Billing 8.1+ isSuspended. NOT emitted by Amazon Appstore or the Horizon
    /// flavor, whose Billing Compatibility SDK implements only Play Billing 7.0.
    case subscriptionBillingIssue = "subscription-billing-issue"
}

/// Serialization format of a public IAPKit product client payload.
public enum IapkitClientPayloadFormat: String, Codable, CaseIterable {
    case toml = "toml"
    case json = "json"
    case text = "text"
}

/// Unified purchase states from IAPKit verification response.
public enum IapkitPurchaseState: String, Codable, CaseIterable {
    /// User is entitled to the product (purchase is complete and active).
    case entitled = "entitled"
    /// Receipt is valid but still needs server acknowledgment.
    case pendingAcknowledgment = "pending-acknowledgment"
    /// Purchase is in progress or awaiting confirmation.
    case pending = "pending"
    /// Purchase was cancelled or refunded.
    case canceled = "canceled"
    /// Subscription or entitlement has expired.
    case expired = "expired"
    /// Consumable purchase is ready to be fulfilled.
    case readyToConsume = "ready-to-consume"
    /// Consumable item has been fulfilled/consumed.
    case consumed = "consumed"
    /// Purchase state could not be determined.
    case unknown = "unknown"
    /// Purchase receipt is not authentic (fraudulent or tampered).
    case inauthentic = "inauthentic"
}

public enum IapPlatform: String, Codable, CaseIterable {
    case ios = "ios"
    case android = "android"
}

public enum IapStore: String, Codable, CaseIterable {
    case unknown = "unknown"
    case apple = "apple"
    case google = "google"
    case horizon = "horizon"
    case amazon = "amazon"
}

/// High-level in-app message category (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
/// (upstream API available since Play Billing 4.1.0).
public enum InAppMessageCategoryAndroid: String, Codable, CaseIterable {
    /// Unknown in-app message category.
    case unknownInAppMessageCategoryId = "unknown-in-app-message-category-id"
    /// Transactional billing messages, such as payment issues or pending price-change confirmations.
    case transactional = "transactional"
}

/// Response code from Play billing in-app messages (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
/// (upstream API available since Play Billing 4.1.0).
public enum InAppMessageResponseCodeAndroid: String, Codable, CaseIterable {
    /// Flow finished and no developer action is needed.
    case noActionNeeded = "no-action-needed"
    /// Subscription status changed and the purchase token should be checked.
    case subscriptionStatusUpdated = "subscription-status-updated"
}

/// Payment mode for subscription offers.
/// Determines how the user pays during the offer period.
public enum PaymentMode: String, Codable, CaseIterable {
    /// Free trial period - no charge during offer
    case freeTrial = "free-trial"
    /// Pay each period at reduced price
    case payAsYouGo = "pay-as-you-go"
    /// Pay full discounted amount upfront
    case payUpFront = "pay-up-front"
    /// Unknown or unspecified payment mode
    case unknown = "unknown"
}

public enum PaymentModeIOS: String, Codable, CaseIterable {
    case empty = "empty"
    case freeTrial = "free-trial"
    case payAsYouGo = "pay-as-you-go"
    case payUpFront = "pay-up-front"
}

public enum ProductQueryType: String, Codable, CaseIterable {
    case inApp = "in-app"
    case subs = "subs"
    case all = "all"
}

/// Status code for individual products returned from queryProductDetailsAsync (Android)
/// Prior to 8.0, products that couldn't be fetched were simply not returned.
/// With 8.0+, these products are returned with a status code explaining why.
/// Available in Google Play Billing Library 8.0.0+
public enum ProductStatusAndroid: String, Codable, CaseIterable {
    /// Product was successfully fetched
    case ok = "ok"
    /// Product not found - the SKU doesn't exist in the Play Console
    case notFound = "not-found"
    /// No offers available for the user - product exists but user is not eligible for any offers
    case noOffersAvailable = "no-offers-available"
    /// Unknown error occurred while fetching the product
    case unknown = "unknown"
}

public enum ProductType: String, Codable, CaseIterable {
    case inApp = "in-app"
    case subs = "subs"
}

public enum ProductTypeIOS: String, Codable, CaseIterable {
    case consumable = "consumable"
    case nonConsumable = "non-consumable"
    case autoRenewableSubscription = "auto-renewable-subscription"
    case nonRenewingSubscription = "non-renewing-subscription"
}

public enum PurchaseState: String, Codable, CaseIterable {
    case pending = "pending"
    case purchased = "purchased"
    case unknown = "unknown"
}

public enum PurchaseVerificationProvider: String, Codable, CaseIterable {
    case iapkit = "iapkit"
}

/// Sub-response codes for more granular purchase error information (Android)
/// Available in Google Play Billing Library 8.0.0+
public enum SubResponseCodeAndroid: String, Codable, CaseIterable {
    /// No specific sub-response code applies
    case noApplicableSubResponseCode = "no-applicable-sub-response-code"
    /// User's payment method has insufficient funds
    case paymentDeclinedDueToInsufficientFunds = "payment-declined-due-to-insufficient-funds"
    /// User doesn't meet subscription offer eligibility requirements
    case userIneligible = "user-ineligible"
}

public enum SubscriptionBillingPlanTypeIOS: String, Codable, CaseIterable {
    /// Unknown or unsupported billing plan type.
    case unknown = "unknown"
    /// Monthly billing with a 12-month commitment.
    case monthly = "monthly"
    /// Up-front billing for the full subscription period.
    case upFront = "up-front"
}

public enum SubscriptionOfferTypeIOS: String, Codable, CaseIterable {
    case introductory = "introductory"
    case promotional = "promotional"
    /// Win-back offer type (iOS 18+)
    /// Used to re-engage churned subscribers with a discount or free trial.
    case winBack = "win-back"
}

public enum SubscriptionPeriodIOS: String, Codable, CaseIterable {
    case day = "day"
    case week = "week"
    case month = "month"
    case year = "year"
    case empty = "empty"
}

/// Subscription period unit for cross-platform use.
public enum SubscriptionPeriodUnit: String, Codable, CaseIterable {
    case day = "day"
    case week = "week"
    case month = "month"
    case year = "year"
    case unknown = "unknown"
}

/// Replacement mode for subscription changes (Android)
/// These modes determine how the subscription replacement affects billing.
/// Available in Google Play Billing Library 8.1.0+
public enum SubscriptionReplacementModeAndroid: String, Codable, CaseIterable {
    /// Unknown replacement mode. Do not use.
    case unknownReplacementMode = "unknown-replacement-mode"
    /// Replacement takes effect immediately, and the new expiration time will be prorated.
    case withTimeProration = "with-time-proration"
    /// Replacement takes effect immediately, and the billing cycle remains the same.
    case chargeProratedPrice = "charge-prorated-price"
    /// Replacement takes effect immediately, and the user is charged full price immediately.
    case chargeFullPrice = "charge-full-price"
    /// Replacement takes effect when the old plan expires.
    case withoutProration = "without-proration"
    /// Replacement takes effect when the old plan expires, and the user is not charged.
    case deferred = "deferred"
    /// Keep the existing payment schedule unchanged for the item (8.1.0+)
    case keepExisting = "keep-existing"
}

public enum SubscriptionState: String, Codable, CaseIterable {
    case active = "active"
    case inGracePeriod = "in-grace-period"
    case inBillingRetry = "in-billing-retry"
    case expired = "expired"
    case revoked = "revoked"
    case refunded = "refunded"
    case paused = "paused"
    case unknown = "unknown"
}

public enum WebhookCancellationReason: String, Codable, CaseIterable {
    case userCanceled = "user-canceled"
    case billingError = "billing-error"
    case priceIncreaseDeclined = "price-increase-declined"
    case productUnavailable = "product-unavailable"
    case refunded = "refunded"
    case other = "other"
}

public enum WebhookEventEnvironment: String, Codable, CaseIterable {
    case production = "production"
    case sandbox = "sandbox"
    case xcode = "xcode"
}

public enum WebhookEventSource: String, Codable, CaseIterable {
    case appleAppStoreServerNotificationsV2 = "apple-app-store-server-notifications-v2"
    case googlePlayRealTimeDeveloperNotifications = "google-play-real-time-developer-notifications"
    /// Synthetic source for Meta Horizon Store. Meta has no webhook /
    /// push notification system so kit polls `verify_entitlement` on a
    /// cron and emits these synthetic events when an entitlement
    /// transitions. SDK consumers see them on the SSE stream alongside
    /// real Apple / Google webhooks.
    case metaHorizonReconciler = "meta-horizon-reconciler"
}

public enum WebhookEventType: String, Codable, CaseIterable {
    /// Initial purchase or first conversion from a free trial / intro offer.
    /// iOS: SUBSCRIBED (initialBuy / resubscribe).
    /// Android: SUBSCRIPTION_PURCHASED.
    case subscriptionStarted = "subscription-started"
    /// Auto-renewal succeeded for an existing subscription.
    /// iOS: DID_RENEW.
    /// Android: SUBSCRIPTION_RENEWED.
    case subscriptionRenewed = "subscription-renewed"
    /// Subscription reached its expiration without a successful renewal.
    /// iOS: EXPIRED.
    /// Android: SUBSCRIPTION_EXPIRED.
    case subscriptionExpired = "subscription-expired"
    /// Billing failed; the subscription is in a grace period during which the user
    /// retains entitlement while payment is retried.
    /// iOS: DID_FAIL_TO_RENEW (with grace period active).
    /// Android: SUBSCRIPTION_IN_GRACE_PERIOD.
    case subscriptionInGracePeriod = "subscription-in-grace-period"
    /// Billing failed and the subscription is in account-hold / billing retry,
    /// during which entitlement is paused but the subscription is not yet expired.
    /// iOS: DID_FAIL_TO_RENEW (no grace period; billing retry).
    /// Android: SUBSCRIPTION_ON_HOLD.
    case subscriptionInBillingRetry = "subscription-in-billing-retry"
    /// Subscription returned to active state after a billing issue or pause.
    /// iOS: DID_RECOVER.
    /// Android: SUBSCRIPTION_RECOVERED (1) only — RESTARTED (7) is auto-
    /// renew re-enabled (Uncanceled), not billing recovery.
    case subscriptionRecovered = "subscription-recovered"
    /// User turned off auto-renew. Access continues until the current period ends.
    /// iOS: DID_CHANGE_RENEWAL_STATUS (autoRenew turned off).
    /// Android: SUBSCRIPTION_CANCELED.
    case subscriptionCanceled = "subscription-canceled"
    /// User reactivated auto-renew before the subscription expired.
    /// iOS: DID_CHANGE_RENEWAL_STATUS (autoRenew turned on).
    /// Android: SUBSCRIPTION_RESTARTED (when re-enabled, not after billing recovery).
    case subscriptionUncanceled = "subscription-uncanceled"
    /// Access immediately revoked (family sharing removal, admin action, fraud).
    /// iOS: REVOKE.
    /// Android: SUBSCRIPTION_REVOKED.
    case subscriptionRevoked = "subscription-revoked"
    /// A price change is pending or has been confirmed by the user.
    /// iOS: PRICE_INCREASE.
    /// Android: SUBSCRIPTION_PRICE_CHANGE_CONFIRMED.
    case subscriptionPriceChange = "subscription-price-change"
    /// User upgraded, downgraded, or crossgraded their plan.
    /// iOS: DID_CHANGE_RENEWAL_PREF.
    /// Android: SUBSCRIPTION_DEFERRED / SUBSCRIPTION_PRODUCT_CHANGED.
    case subscriptionProductChanged = "subscription-product-changed"
    /// Subscription paused (Android only feature). Also fired when the
    /// pause schedule is changed — RTDN does not have a separate signal.
    /// Android: SUBSCRIPTION_PAUSED (10), SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED (11).
    case subscriptionPaused = "subscription-paused"
    /// Paused subscription resumed (Android only feature). RTDN signals
    /// resume via SUBSCRIPTION_RECOVERED (1) once the next billing cycle
    /// starts; PAUSE_SCHEDULE_CHANGED is the schedule update, not the
    /// resume.
    /// Android: SUBSCRIPTION_RECOVERED (after pause).
    case subscriptionResumed = "subscription-resumed"
    /// Refund issued for a one-time purchase or subscription period.
    /// iOS: REFUND.
    /// Android: ONE_TIME_PRODUCT_REFUNDED / VOIDED_PURCHASE.
    case purchaseRefunded = "purchase-refunded"
    /// iOS-only: App Store requests a consumption status report for a refund decision.
    /// Servers should respond via the StoreKit consumption API.
    case purchaseConsumptionRequest = "purchase-consumption-request"
    /// Sandbox or test notification fired by the store for diagnostic purposes.
    /// Useful for verifying webhook plumbing without a live transaction.
    case testNotification = "test-notification"
}

// MARK: - Interfaces

public protocol ProductCommon: Codable {
    var currency: String { get }
    var debugDescription: String? { get }
    var description: String { get }
    var displayName: String? { get }
    var displayPrice: String { get }
    var id: String { get }
    var platform: IapPlatform { get }
    var price: Double? { get }
    var title: String { get }
    var type: ProductType { get }
}

public protocol PurchaseCommon: Codable {
    /// The current plan identifier. This is:
    /// - On Android: the basePlanId (e.g., "premium", "premium-year")
    /// - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
    /// This provides a unified way to identify which specific plan/tier the user is subscribed to.
    var currentPlanId: String? { get }
    var id: String { get }
    var ids: [String]? { get }
    var isAutoRenewing: Bool { get }
    /// @deprecated Use store instead. Scheduled for removal in OpenIAP 3.0.
    var platform: IapPlatform { get }
    var productId: String { get }
    var purchaseState: PurchaseState { get }
    /// Unified purchase token (iOS JWS, Android purchaseToken)
    var purchaseToken: String? { get }
    var quantity: Int { get }
    /// Store where purchase was made
    var store: IapStore { get }
    /// Unix timestamp in milliseconds since January 1, 1970 UTC.
    var transactionDate: Double { get }
}

// MARK: - Objects

public struct ActiveSubscription: Codable {
    public var autoRenewingAndroid: Bool? = nil
    public var basePlanIdAndroid: String? = nil
    /// The current plan identifier. This is:
    /// - On Android: the basePlanId (e.g., "premium", "premium-year")
    /// - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
    /// This provides a unified way to identify which specific plan/tier the user is subscribed to.
    public var currentPlanId: String? = nil
    public var daysUntilExpirationIOS: Double? = nil
    public var environmentIOS: String? = nil
    public var expirationDateIOS: Double? = nil
    public var isActive: Bool
    public var productId: String
    public var purchaseToken: String? = nil
    /// Required for subscription upgrade/downgrade on Android
    public var purchaseTokenAndroid: String? = nil
    /// Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,
    /// pending upgrades/downgrades, and auto-renewal preferences.
    public var renewalInfoIOS: RenewalInfoIOS? = nil
    /// Unix timestamp in milliseconds since January 1, 1970 UTC.
    public var transactionDate: Double
    public var transactionId: String
    /// Whether the subscription will expire soon (within 7 days).
    /// Consider using daysUntilExpirationIOS for more precise control.
    /// @deprecated iOS only - use daysUntilExpirationIOS instead. Scheduled for removal in OpenIAP 3.0.
    public var willExpireSoon: Bool? = nil
}

/// Advanced Commerce metadata from a transaction (iOS 18.4+).
/// Contains item details, tax information, and refund data for purchases
/// made through the Advanced Commerce API using generic SKUs.
/// Only present for transactions that use the Advanced Commerce API.
public struct AdvancedCommerceInfoIOS: Codable {
    /// Optional description
    public var description: String? = nil
    /// Optional display name
    public var displayName: String? = nil
    /// Estimated tax amount (decimal string)
    public var estimatedTax: String? = nil
    /// The items purchased as part of this transaction
    public var items: [AdvancedCommerceItemIOS]
    /// Request reference identifier for tracking
    public var requestReferenceId: String? = nil
    /// Tax code for the transaction
    public var taxCode: String? = nil
    /// Price excluding tax (decimal string)
    public var taxExclusivePrice: String? = nil
    /// Tax rate applied (decimal string)
    public var taxRate: String? = nil
}

/// Details of an Advanced Commerce item (iOS 18.4+).
public struct AdvancedCommerceItemDetailsIOS: Codable {
    /// JSON representation of the item details
    public var jsonRepresentation: String? = nil
}

/// An item purchased through the Advanced Commerce API (iOS 18.4+).
/// Represents a developer-defined product within a generic SKU transaction.
public struct AdvancedCommerceItemIOS: Codable {
    /// The item's detail information
    public var details: AdvancedCommerceItemDetailsIOS? = nil
    /// Refunds issued for this item, if any
    public var refunds: [AdvancedCommerceRefundIOS]? = nil
    /// Date access to this item was revoked (milliseconds since epoch)
    public var revocationDate: Double? = nil
}

/// Refund information for an Advanced Commerce item (iOS 18.4+).
public struct AdvancedCommerceRefundIOS: Codable {
    /// JSON representation of the refund details
    public var jsonRepresentation: String? = nil
}

public struct AppTransaction: Codable {
    public var appId: Double
    public var appTransactionId: String? = nil
    public var appVersion: String
    public var appVersionId: Double
    public var bundleId: String
    public var deviceVerification: String
    public var deviceVerificationNonce: String
    public var environment: String
    public var originalAppVersion: String
    public var originalPlatform: String? = nil
    public var originalPurchaseDate: Double
    public var preorderDate: Double? = nil
    public var signedDate: Double
}

/// Display information for developer-rendered Billing Choice screens (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public struct BillingChoiceInfoAndroid: Codable {
    /// URL for the Play Billing choice image matching the requested layout.
    public var playBillingChoiceImageUrl: String
    /// Play Loyalty information for the user.
    public var playBillingLoyaltyInfo: String? = nil
}

/// Result of checking billing program availability (Android)
/// Available in Google Play Billing Library 8.2.0+
public struct BillingProgramAvailabilityResultAndroid: Codable {
    /// The billing program that was checked
    public var billingProgram: BillingProgramAndroid
    /// Billing Choice screen renderer. Populated only for available BILLING_CHOICE results.
    /// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
    public var choiceScreenType: BillingChoiceScreenTypeAndroid? = nil
    /// Whether the billing program is available for the user
    public var isAvailable: Bool
    /// Whether external-link payment is available for Billing Choice.
    /// Populated only for available BILLING_CHOICE results.
    /// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
    public var isExternalLinkAvailable: Bool? = nil
}

/// Reporting details for transactions made outside of Google Play Billing (Android)
/// Contains the external transaction token needed for reporting
/// Available in Google Play Billing Library 8.2.0+
public struct BillingProgramReportingDetailsAndroid: Codable {
    /// The billing program that the reporting details are associated with
    public var billingProgram: BillingProgramAndroid
    /// External transaction token used to report transactions made outside of Google Play Billing.
    /// Do not cache it for a later redirect session. For External Offer, the same token may report
    /// multiple purchases made during the session that generated it.
    public var externalTransactionToken: String
}

/// Extended billing result with sub-response code (Android)
/// Available in Google Play Billing Library 8.0.0+
public struct BillingResultAndroid: Codable {
    /// Debug message from the billing library
    public var debugMessage: String? = nil
    /// The response code from the billing operation
    public var responseCode: Int
    /// Sub-response code for more granular error information (8.0+).
    /// Provides additional context when responseCode indicates an error.
    public var subResponseCode: SubResponseCodeAndroid? = nil
}

/// Details provided when user selects developer billing option (Android)
/// Received via DeveloperProvidedBillingListener callback
/// Available in Google Play Billing Library 8.3.0+
public struct DeveloperProvidedBillingDetailsAndroid: Codable {
    /// External transaction token used to report transactions made through developer billing.
    /// Nullable for flows such as external payments where no token is returned.
    public var externalTransactionToken: String? = nil
    /// URI to launch for an external-link Billing Choice flow, when provided by
    /// Google Play.
    public var linkUri: String? = nil
    /// Original external transaction ID when replacing a subscription that was
    /// purchased through developer billing.
    public var originalExternalTransactionId: String? = nil
    /// Products selected for the developer billing flow.
    public var products: [DeveloperProvidedBillingProductAndroid]
}

/// Product selected for developer-provided billing (Android 9.0+).
public struct DeveloperProvidedBillingProductAndroid: Codable {
    /// Product identifier.
    public var id: String
    /// Subscription offer token, when applicable.
    public var offerToken: String? = nil
    /// Google Play product type (in-app or subscription).
    public var type: ProductType
}

/// Discount amount details for one-time purchase offers (Android)
/// Available in Google Play Billing Library 8.0+
public struct DiscountAmountAndroid: Codable {
    /// Discount amount in micro-units (1,000,000 = 1 unit of currency)
    public var discountAmountMicros: String
    /// Formatted discount amount with currency sign (e.g., "$4.99")
    public var formattedDiscountAmount: String
}

/// Discount display information for one-time purchase offers (Android)
/// Available in Google Play Billing Library 8.0+
public struct DiscountDisplayInfoAndroid: Codable {
    /// Absolute discount amount details
    /// Only returned for fixed amount discounts
    public var discountAmount: DiscountAmountAndroid? = nil
    /// Percentage discount (e.g., 33 for 33% off)
    /// Only returned for percentage-based discounts
    public var percentageDiscount: Int? = nil
}

/// Discount information returned from the store.
/// @see https://openiap.dev/docs/types/subscription-offer
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
public struct DiscountIOS: Codable {
    public var identifier: String
    public var localizedPrice: String? = nil
    public var numberOfPeriods: Int
    public var paymentMode: PaymentModeIOS
    public var price: String
    public var priceAmount: Double
    public var subscriptionPeriod: String
    public var type: String
}

/// Standardized one-time product discount offer.
/// Provides a platform-neutral OpenIAP shape for Google Play one-time product
/// purchase options and offers.
/// 
/// Currently populated only on Android (Google Play Billing 8.0+).
/// iOS does not populate this type.
/// 
/// @see https://openiap.dev/docs/types/discount-offer
public struct DiscountOffer: Codable {
    /// Currency code (ISO 4217, e.g., "USD")
    public var currency: String
    /// [Android] Fixed discount amount in micro-units.
    /// Only present for fixed amount discounts.
    public var discountAmountMicrosAndroid: String? = nil
    /// Formatted display price string (e.g., "$4.99")
    public var displayPrice: String
    /// [Android] Formatted discount amount including its currency sign (e.g., "$5.00").
    public var formattedDiscountAmountAndroid: String? = nil
    /// [Android] Original full price in micro-units before discount.
    /// Divide by 1,000,000 to get the actual price.
    /// Use for displaying strikethrough original price.
    public var fullPriceMicrosAndroid: String? = nil
    /// Unique identifier for the offer.
    /// - iOS: Not applicable (one-time discounts not supported)
    /// - Android: offerId from ProductAndroidOneTimePurchaseOfferDetail
    public var id: String? = nil
    /// [Android] Limited quantity information.
    /// Contains maximumQuantity and remainingQuantity.
    public var limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid? = nil
    /// [Android] List of tags associated with this offer.
    public var offerTagsAndroid: [String]? = nil
    /// [Android] Offer token required for purchase.
    /// Must be passed to requestPurchase() when purchasing with this offer.
    public var offerTokenAndroid: String? = nil
    /// [Android] Percentage discount (e.g., 33 for 33% off).
    /// Only present for percentage-based discounts.
    public var percentageDiscountAndroid: Int? = nil
    /// [Android] Pre-order details if this is a pre-order offer.
    /// Available in Google Play Billing Library 8.1.0+
    public var preorderDetailsAndroid: PreorderDetailsAndroid? = nil
    /// Numeric price value
    public var price: Double
    /// [Android] Purchase option ID for this offer.
    /// Used to identify which purchase option the user selected.
    /// Available in Google Play Billing Library 8.0+
    public var purchaseOptionIdAndroid: String? = nil
    /// [Android] Rental details if this is a rental offer.
    public var rentalDetailsAndroid: RentalDetailsAndroid? = nil
    /// Offer category. DiscountOffer currently represents Android one-time product
    /// offers and is populated as OneTime. Introductory and Promotional are used by
    /// SubscriptionOffer.
    public var type: DiscountOfferType
    /// [Android] Valid time window for the offer.
    /// Contains startTimeMillis and endTimeMillis.
    public var validTimeWindowAndroid: ValidTimeWindowAndroid? = nil
}

/// iOS DiscountOffer (output type).
/// @see https://openiap.dev/docs/types/subscription-offer
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
public struct DiscountOfferIOS: Codable {
    /// Discount identifier
    public var identifier: String
    /// Key identifier for validation
    public var keyIdentifier: String
    /// Cryptographic nonce
    public var nonce: String
    /// Signature for validation
    public var signature: String
    /// Timestamp of discount offer
    public var timestamp: Double
}

public struct EntitlementIOS: Codable {
    public var jsonRepresentation: String
    public var sku: String
    public var transactionId: String
}

/// External offer availability result (Android)
/// Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
/// @deprecated Use BillingProgramAvailabilityResultAndroid from isBillingProgramAvailableAndroid instead. Scheduled for removal in OpenIAP 3.0.
public struct ExternalOfferAvailabilityResultAndroid: Codable {
    /// Whether external offers are available for the user
    public var isAvailable: Bool
}

/// External offer reporting details (Android)
/// Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
/// @deprecated Use BillingProgramReportingDetailsAndroid from createBillingProgramReportingDetailsAndroid instead. Scheduled for removal in OpenIAP 3.0.
public struct ExternalOfferReportingDetailsAndroid: Codable {
    /// External transaction token for reporting external offer transactions
    public var externalTransactionToken: String
}

/// Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).
public struct ExternalPurchaseCustomLinkNoticeResultIOS: Codable {
    /// Whether the user chose to continue to external purchase
    public var continued: Bool
    /// Optional error message if the presentation failed
    public var error: String? = nil
}

/// Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).
public struct ExternalPurchaseCustomLinkTokenResultIOS: Codable {
    /// Optional error message if token retrieval failed
    public var error: String? = nil
    /// The external purchase token string.
    /// Report this token to Apple's External Purchase Server API.
    public var token: String? = nil
}

/// Result of presenting an external purchase link
public struct ExternalPurchaseLinkResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String? = nil
    /// Whether the user completed the external purchase flow
    public var success: Bool
}

/// Result of presenting external purchase notice sheet (iOS 17.4+)
/// Returns the token when user continues to external purchase.
public struct ExternalPurchaseNoticeResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String? = nil
    /// External purchase token returned when user continues (iOS 17.4+).
    /// This token should be reported to Apple's External Purchase Server API.
    /// Only present when result is Continue.
    public var externalPurchaseToken: String? = nil
    /// Notice result indicating user action
    public var result: ExternalPurchaseNoticeAction
}

public enum FetchProductsResult {
    case all([ProductOrSubscription]?)
    case products([Product]?)
    case subscriptions([ProductSubscription]?)
}

/// Public app-facing data attached to one store product in IAPKit.
/// Never place credentials, signing keys, or server-authoritative rules here.
public struct IapkitProductClientPayload: Codable {
    public var body: String
    public var format: IapkitClientPayloadFormat
    public var updatedAt: Double
    public var version: Double
}

/// Result from showing Play billing in-app messages (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
/// (upstream API available since Play Billing 4.1.0).
public struct InAppMessageResultAndroid: Codable {
    /// Purchase token returned when a subscription status changed.
    public var purchaseToken: String? = nil
    /// Response code for the in-app messaging flow.
    public var responseCode: InAppMessageResponseCodeAndroid
}

/// Installment plan details for subscription offers (Android)
/// Contains information about the installment plan commitment.
/// Available in Google Play Billing Library 7.0+
public struct InstallmentPlanDetailsAndroid: Codable {
    /// Committed payments count after a user signs up for this subscription plan.
    /// For example, for a monthly subscription with commitmentPaymentsCount of 12,
    /// users will be charged monthly for 12 months after signup.
    public var commitmentPaymentsCount: Int
    /// Subsequent committed payments count after the subscription plan renews.
    /// For example, for a monthly subscription with subsequentCommitmentPaymentsCount of 12,
    /// users will be committed to another 12 monthly payments when the plan renews.
    /// Returns 0 if the installment plan has no subsequent commitment (reverts to normal plan).
    public var subsequentCommitmentPaymentsCount: Int
}

/// Limited quantity information for one-time purchase offers (Android)
/// Available in Google Play Billing Library 8.0+
public struct LimitedQuantityInfoAndroid: Codable {
    /// Maximum quantity a user can purchase
    public var maximumQuantity: Int
    /// Remaining quantity the user can still purchase
    public var remainingQuantity: Int
}

/// Pending purchase update for subscription upgrades/downgrades (Android)
/// When a user initiates a subscription change (upgrade/downgrade), the new purchase
/// may be pending until the current billing period ends. This type contains the
/// details of the pending change.
/// Available in Google Play Billing Library 5.0+
public struct PendingPurchaseUpdateAndroid: Codable {
    /// Product IDs for the pending purchase update.
    /// These are the new products the user is switching to.
    public var products: [String]
    /// Purchase token for the pending transaction.
    /// Use this token to track or manage the pending purchase update.
    public var purchaseToken: String
}

/// Pre-order details for one-time purchase products (Android)
/// Available in Google Play Billing Library 8.1.0+
public struct PreorderDetailsAndroid: Codable {
    /// Pre-order presale end time in milliseconds since epoch.
    /// This is when the presale period ends and the product will be released.
    public var preorderPresaleEndTimeMillis: String
    /// Pre-order release time in milliseconds since epoch.
    /// This is when the product will be available to users who pre-ordered.
    public var preorderReleaseTimeMillis: String
}

public struct PricingPhaseAndroid: Codable {
    public var billingCycleCount: Int
    public var billingPeriod: String
    public var formattedPrice: String
    public var priceAmountMicros: String
    public var priceCurrencyCode: String
    public var recurrenceMode: Int
}

public struct PricingPhasesAndroid: Codable {
    public var pricingPhaseList: [PricingPhaseAndroid]
}

public struct ProductAndroid: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String? = nil
    public var description: String
    /// Standardized Android one-time product purchase options and offers.
    /// Native metadata uses Android-suffixed fields.
    /// @see https://openiap.dev/docs/types/discount-offer
    public var discountOffers: [DiscountOffer]? = nil
    public var displayName: String? = nil
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    /// One-time purchase offer details including discounts (Android)
    /// Returns all eligible offers. Available in Google Play Billing Library 8.0+
    /// @deprecated Use the standardized discountOffers field instead. Scheduled for removal in OpenIAP 3.0.
    public var oneTimePurchaseOfferDetailsAndroid: [ProductAndroidOneTimePurchaseOfferDetail]? = nil
    public var platform: IapPlatform = .android
    public var price: Double? = nil
    /// Product-level status code indicating fetch result (Android 8.0+)
    /// OK = product fetched successfully
    /// NOT_FOUND = SKU doesn't exist
    /// NO_OFFERS_AVAILABLE = user not eligible for any offers
    /// Available in Google Play Billing Library 8.0.0+
    public var productStatusAndroid: ProductStatusAndroid? = nil
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]? = nil
    /// Standardized subscription offers.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types/subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]? = nil
    public var title: String
    public var type: ProductType = .inApp
}

/// One-time purchase offer details (Android).
/// Available in Google Play Billing Library 8.0+
/// @see https://openiap.dev/docs/types/discount-offer
/// @deprecated Use the standardized DiscountOffer type for Android one-time offers. Scheduled for removal in OpenIAP 3.0.
public struct ProductAndroidOneTimePurchaseOfferDetail: Codable {
    /// Discount display information
    /// Only available for discounted offers
    public var discountDisplayInfo: DiscountDisplayInfoAndroid? = nil
    public var formattedPrice: String
    /// Full (non-discounted) price in micro-units
    /// Only available for discounted offers
    public var fullPriceMicros: String? = nil
    /// Limited quantity information
    public var limitedQuantityInfo: LimitedQuantityInfoAndroid? = nil
    /// Offer ID
    public var offerId: String? = nil
    /// List of offer tags
    public var offerTags: [String]
    /// Offer token for use in BillingFlowParams when purchasing
    public var offerToken: String
    /// Pre-order details for products available for pre-order
    /// Available in Google Play Billing Library 8.1.0+
    public var preorderDetailsAndroid: PreorderDetailsAndroid? = nil
    public var priceAmountMicros: String
    public var priceCurrencyCode: String
    /// Purchase option ID for this offer (Android)
    /// Used to identify which purchase option the user selected.
    /// Available in Google Play Billing Library 8.0+
    public var purchaseOptionId: String? = nil
    /// Rental details for rental offers
    public var rentalDetailsAndroid: RentalDetailsAndroid? = nil
    /// Valid time window for the offer
    public var validTimeWindow: ValidTimeWindowAndroid? = nil
}

public struct ProductIOS: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String? = nil
    public var description: String
    public var displayName: String? = nil
    public var displayNameIOS: String
    public var displayPrice: String
    public var id: String
    public var isFamilyShareableIOS: Bool
    public var jsonRepresentationIOS: String
    public var platform: IapPlatform = .ios
    public var price: Double? = nil
    /// iOS 26.4+ subscription pricing terms, including billing plan metadata for
    /// monthly subscriptions with a 12-month commitment.
    public var pricingTermsIOS: [SubscriptionPricingTermsIOS]? = nil
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
    public var subscriptionInfoIOS: SubscriptionInfoIOS? = nil
    /// Standardized subscription offers.
    /// Cross-platform type with iOS-specific fields using suffix.
    /// Note: iOS does not support one-time product discounts.
    /// @see https://openiap.dev/docs/types/subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]? = nil
    public var title: String
    public var type: ProductType = .inApp
    public var typeIOS: ProductTypeIOS
}

public struct ProductSubscriptionAndroid: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String? = nil
    public var description: String
    /// Nullable compatibility field. Google Play does not return one-time purchase
    /// offer details for subscription products; use subscriptionOffers below.
    public var discountOffers: [DiscountOffer]? = nil
    public var displayName: String? = nil
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    /// Legacy nullable compatibility field. Google Play does not populate one-time
    /// purchase offer details for subscription products.
    /// @deprecated One-time offers belong to ProductAndroid.discountOffers; subscriptions use subscriptionOffers. Scheduled for removal in OpenIAP 3.0.
    public var oneTimePurchaseOfferDetailsAndroid: [ProductAndroidOneTimePurchaseOfferDetail]? = nil
    public var platform: IapPlatform = .android
    public var price: Double? = nil
    /// Product-level status code indicating fetch result (Android 8.0+)
    /// OK = product fetched successfully
    /// NOT_FOUND = SKU doesn't exist
    /// NO_OFFERS_AVAILABLE = user not eligible for any offers
    /// Available in Google Play Billing Library 8.0.0+
    public var productStatusAndroid: ProductStatusAndroid? = nil
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]
    /// Standardized subscription offers.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types/subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]
    public var title: String
    public var type: ProductType = .subs
}

/// Subscription offer details (Android).
/// @see https://openiap.dev/docs/types/subscription-offer
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
public struct ProductSubscriptionAndroidOfferDetails: Codable {
    public var basePlanId: String
    /// Installment plan details for this subscription offer.
    /// Only set for installment subscription plans; null for non-installment plans.
    /// Available in Google Play Billing Library 7.0+
    public var installmentPlanDetails: InstallmentPlanDetailsAndroid? = nil
    public var offerId: String? = nil
    public var offerTags: [String]
    public var offerToken: String
    public var pricingPhases: PricingPhasesAndroid
}

public struct ProductSubscriptionIOS: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String? = nil
    public var description: String
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
    public var discountsIOS: [DiscountIOS]? = nil
    public var displayName: String? = nil
    public var displayNameIOS: String
    public var displayPrice: String
    public var id: String
    public var introductoryPriceAsAmountIOS: String? = nil
    public var introductoryPriceIOS: String? = nil
    public var introductoryPriceNumberOfPeriodsIOS: String? = nil
    public var introductoryPricePaymentModeIOS: PaymentModeIOS
    public var introductoryPriceSubscriptionPeriodIOS: SubscriptionPeriodIOS? = nil
    public var isFamilyShareableIOS: Bool
    public var jsonRepresentationIOS: String
    public var platform: IapPlatform = .ios
    public var price: Double? = nil
    /// iOS 26.4+ subscription pricing terms, including billing plan metadata for
    /// monthly subscriptions with a 12-month commitment.
    public var pricingTermsIOS: [SubscriptionPricingTermsIOS]? = nil
    /// App Store subscription group identifier for intro-offer eligibility checks.
    public var subscriptionGroupIdIOS: String? = nil
    /// @deprecated Use subscriptionOffers for offer metadata and subscriptionGroupIdIOS for the App Store subscription group identifier. Scheduled for removal in OpenIAP 3.0.
    public var subscriptionInfoIOS: SubscriptionInfoIOS? = nil
    /// Standardized subscription offers.
    /// Cross-platform type with iOS-specific fields using suffix.
    /// @see https://openiap.dev/docs/types/subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]? = nil
    public var subscriptionPeriodNumberIOS: String? = nil
    public var subscriptionPeriodUnitIOS: SubscriptionPeriodIOS? = nil
    public var title: String
    public var type: ProductType = .subs
    public var typeIOS: ProductTypeIOS
}

public struct PurchaseAndroid: Codable, PurchaseCommon {
    public var autoRenewingAndroid: Bool? = nil
    public var currentPlanId: String? = nil
    public var dataAndroid: String? = nil
    public var developerPayloadAndroid: String? = nil
    public var id: String
    public var ids: [String]? = nil
    public var isAcknowledgedAndroid: Bool? = nil
    public var isAutoRenewing: Bool
    /// Whether the subscription is suspended (Android)
    /// A suspended subscription means the user's payment method failed and they need to fix it.
    /// Users should be directed to the subscription center to resolve the issue.
    /// Do NOT grant entitlements for suspended subscriptions.
    /// Available in Google Play Billing Library 8.1.0+
    public var isSuspendedAndroid: Bool? = nil
    public var obfuscatedAccountIdAndroid: String? = nil
    public var obfuscatedProfileIdAndroid: String? = nil
    public var packageNameAndroid: String? = nil
    /// Pending purchase update for uncommitted subscription upgrade/downgrade (Android)
    /// Contains the new products and purchase token for the pending transaction.
    /// Returns null if no pending update exists.
    /// Available in Google Play Billing Library 5.0+
    public var pendingPurchaseUpdateAndroid: PendingPurchaseUpdateAndroid? = nil
    /// @deprecated Use store instead. Scheduled for removal in OpenIAP 3.0.
    public var platform: IapPlatform
    public var productId: String
    public var purchaseState: PurchaseState
    public var purchaseToken: String? = nil
    public var quantity: Int
    public var signatureAndroid: String? = nil
    /// Store where purchase was made
    public var store: IapStore
    /// Unix timestamp in milliseconds since January 1, 1970 UTC.
    public var transactionDate: Double
    public var transactionId: String? = nil
}

public struct PurchaseError: Codable {
    public var code: ErrorCode
    public var debugMessage: String? = nil
    public var isEmptyProductList: Bool? = nil
    public var message: String
    public var productId: String? = nil
    public var productIds: [String]? = nil
    public var productType: String? = nil
    public var responseCode: Int? = nil
    public var subResponseCodeAndroid: SubResponseCodeAndroid? = nil
}

public struct PurchaseIOS: Codable, PurchaseCommon {
    /// Advanced Commerce API metadata (iOS 18.4+).
    /// Present only for transactions that use the Advanced Commerce API.
    /// Contains item details, tax information, and refund data for generic SKU purchases.
    public var advancedCommerceInfoIOS: AdvancedCommerceInfoIOS? = nil
    public var appAccountToken: String? = nil
    public var appBundleIdIOS: String? = nil
    /// iOS 26.4+ billing plan selected for this transaction.
    public var billingPlanTypeIOS: SubscriptionBillingPlanTypeIOS? = nil
    /// iOS 26.4+ progress information for monthly subscriptions with a 12-month commitment.
    public var commitmentInfoIOS: TransactionCommitmentInfoIOS? = nil
    public var countryCodeIOS: String? = nil
    public var currencyCodeIOS: String? = nil
    public var currencySymbolIOS: String? = nil
    public var currentPlanId: String? = nil
    public var environmentIOS: String? = nil
    public var expirationDateIOS: Double? = nil
    public var id: String
    public var ids: [String]? = nil
    public var isAutoRenewing: Bool
    public var isUpgradedIOS: Bool? = nil
    public var offerIOS: PurchaseOfferIOS? = nil
    public var originalTransactionDateIOS: Double? = nil
    public var originalTransactionIdentifierIOS: String? = nil
    public var ownershipTypeIOS: String? = nil
    /// @deprecated Use store instead. Scheduled for removal in OpenIAP 3.0.
    public var platform: IapPlatform
    public var productId: String
    public var purchaseState: PurchaseState
    public var purchaseToken: String? = nil
    public var quantity: Int
    public var quantityIOS: Int? = nil
    public var reasonIOS: String? = nil
    public var reasonStringRepresentationIOS: String? = nil
    public var renewalInfoIOS: RenewalInfoIOS? = nil
    public var revocationDateIOS: Double? = nil
    public var revocationReasonIOS: String? = nil
    /// Store where purchase was made
    public var store: IapStore
    public var storefrontCountryCodeIOS: String? = nil
    public var subscriptionGroupIdIOS: String? = nil
    /// Unix timestamp in milliseconds since January 1, 1970 UTC.
    public var transactionDate: Double
    public var transactionId: String
    public var transactionReasonIOS: String? = nil
    public var webOrderLineItemIdIOS: String? = nil
}

public struct PurchaseOfferIOS: Codable {
    public var id: String
    public var paymentMode: String
    public var type: String
}

public struct RefundResultIOS: Codable {
    public var message: String? = nil
    public var status: String
}

public struct RenewalCommitmentInfoIOS: Codable {
    public var commitmentAutoRenewProductId: String
    public var commitmentAutoRenewStatus: Bool
    public var commitmentRenewalBillingPlanType: SubscriptionBillingPlanTypeIOS
    public var commitmentRenewalDate: Double
    public var commitmentRenewalPrice: Double
}

/// Subscription renewal information from Product.SubscriptionInfo.RenewalInfo
/// https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
public struct RenewalInfoIOS: Codable {
    public var autoRenewPreference: String? = nil
    /// iOS 26.4+ renewal commitment metadata for monthly subscriptions with a
    /// 12-month commitment.
    public var commitmentInfo: RenewalCommitmentInfoIOS? = nil
    /// When subscription expires due to cancellation/billing issue
    /// Possible values: "VOLUNTARY", "BILLING_ERROR", "DID_NOT_AGREE_TO_PRICE_INCREASE", "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
    public var expirationReason: String? = nil
    /// Grace period expiration date (milliseconds since epoch)
    /// When set, subscription is in grace period (billing issue but still has access)
    public var gracePeriodExpirationDate: Double? = nil
    /// True if subscription failed to renew due to billing issue and is retrying
    /// StoreKit exposes this directly as RenewalInfo.isInBillingRetry.
    public var isInBillingRetry: Bool? = nil
    public var jsonRepresentation: String? = nil
    /// Product ID that will be used on next renewal (when user upgrades/downgrades)
    /// If set and different from current productId, subscription will change on expiration
    public var pendingUpgradeProductId: String? = nil
    /// User's response to subscription price increase
    /// Possible values: "AGREED", "PENDING", null (no price increase)
    public var priceIncreaseStatus: String? = nil
    /// iOS 26.4+ billing plan that will renew after the current period.
    public var renewalBillingPlanType: SubscriptionBillingPlanTypeIOS? = nil
    /// Expected renewal date (milliseconds since epoch)
    /// For active subscriptions, when the next renewal/charge will occur
    public var renewalDate: Double? = nil
    /// Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)
    public var renewalOfferId: String? = nil
    /// Type of offer applied to next renewal
    /// Possible values: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE", "WIN_BACK", etc.
    public var renewalOfferType: String? = nil
    public var willAutoRenew: Bool
}

/// Rental details for one-time purchase products that can be rented (Android)
/// Available in Google Play Billing Library 8.0+
public struct RentalDetailsAndroid: Codable {
    /// Rental expiration period in ISO 8601 format
    /// Time after rental period ends when user can still extend
    public var rentalExpirationPeriod: String? = nil
    /// Rental period in ISO 8601 format (e.g., P7D for 7 days)
    public var rentalPeriod: String
}

public enum RequestPurchaseResult {
    case purchase(Purchase?)
    case purchases([Purchase]?)
}

public struct RequestVerifyPurchaseWithIapkitResult: Codable {
    /// Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
    /// Public product payload when includeClientPayload was requested, the
    /// Apple or Google receipt is valid, and a payload exists for that product.
    public var clientPayload: IapkitProductClientPayload? = nil
    /// True when the purchase is valid and actionable.
    /// Only entitled, pending-acknowledgment, or ready-to-consume return true.
    /// Callers must still match productId and use the platform plus app-owned product
    /// type to choose the fulfillment path.
    public var isValid: Bool
    /// Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
    /// Store-verified product identifier when the provider returns one.
    public var productId: String? = nil
    /// The current state of the purchase.
    public var state: IapkitPurchaseState
    public var store: IapStore
}

public struct SubscriptionCommitmentInfoIOS: Codable {
    public var displayPrice: String
    public var period: SubscriptionPeriodValueIOS
    public var price: Double
}

public struct SubscriptionInfoIOS: Codable {
    public var introductoryOffer: SubscriptionOfferIOS? = nil
    public var pricingTerms: [SubscriptionPricingTermsIOS]? = nil
    public var promotionalOffers: [SubscriptionOfferIOS]? = nil
    public var subscriptionGroupId: String
    public var subscriptionPeriod: SubscriptionPeriodValueIOS
}

/// Standardized subscription discount/promotional offer.
/// Provides a unified interface for subscription offers across iOS and Android.
/// 
/// Both platforms support subscription offers with different implementations:
/// - iOS: Introductory offers, promotional offers with server-side signatures
/// - Android: Offer tokens with pricing phases
/// 
/// @see https://openiap.dev/docs/types/subscription-offer
public struct SubscriptionOffer: Codable {
    /// [Android] Base plan identifier.
    /// Identifies which base plan this offer belongs to.
    public var basePlanIdAndroid: String? = nil
    /// Currency code (ISO 4217, e.g., "USD")
    public var currency: String? = nil
    /// Formatted display price string (e.g., "$9.99/month")
    public var displayPrice: String
    /// Unique identifier for the offer.
    /// - iOS: Discount identifier from App Store Connect
    /// - Android: offerId from ProductSubscriptionAndroidOfferDetails
    public var id: String
    /// [Android] Installment plan details for this subscription offer.
    /// Only set for installment subscription plans; null for non-installment plans.
    /// Available in Google Play Billing Library 7.0+
    public var installmentPlanDetailsAndroid: InstallmentPlanDetailsAndroid? = nil
    /// [iOS] Key identifier for signature validation.
    /// Used with server-side signature generation for promotional offers.
    public var keyIdentifierIOS: String? = nil
    /// [iOS] Localized price string.
    public var localizedPriceIOS: String? = nil
    /// [iOS] Cryptographic nonce (UUID) for signature validation.
    /// Must be generated server-side for each purchase attempt.
    public var nonceIOS: String? = nil
    /// [iOS] Number of billing periods for this discount.
    public var numberOfPeriodsIOS: Int? = nil
    /// [Android] List of tags associated with this offer.
    public var offerTagsAndroid: [String]? = nil
    /// [Android] Offer token required for purchase.
    /// Must be passed to requestPurchase() when purchasing with this offer.
    public var offerTokenAndroid: String? = nil
    /// Payment mode during the offer period
    public var paymentMode: PaymentMode? = nil
    /// Subscription period for this offer
    public var period: SubscriptionPeriod? = nil
    /// Number of periods the offer applies
    public var periodCount: Int? = nil
    /// Numeric price value
    public var price: Double
    /// [Android] Pricing phases for this subscription offer.
    /// Contains detailed pricing information for each phase (trial, intro, regular).
    public var pricingPhasesAndroid: PricingPhasesAndroid? = nil
    /// [iOS] Server-generated signature for promotional offer validation.
    /// Required when applying promotional offers on iOS.
    public var signatureIOS: String? = nil
    /// [iOS] Timestamp when the signature was generated.
    /// Used for signature validation.
    public var timestampIOS: Double? = nil
    /// Type of subscription offer (Introductory or Promotional)
    public var type: DiscountOfferType
}

/// iOS subscription offer details.
/// @see https://openiap.dev/docs/types/subscription-offer
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility. Scheduled for removal in OpenIAP 3.0.
public struct SubscriptionOfferIOS: Codable {
    public var displayPrice: String
    public var id: String
    public var paymentMode: PaymentModeIOS
    public var period: SubscriptionPeriodValueIOS
    public var periodCount: Int
    public var price: Double
    public var type: SubscriptionOfferTypeIOS
}

/// Subscription period value combining unit and count.
public struct SubscriptionPeriod: Codable {
    /// The period unit (day, week, month, year)
    public var unit: SubscriptionPeriodUnit
    /// The number of units (e.g., 1 for monthly, 3 for quarterly)
    public var value: Int
}

public struct SubscriptionPeriodValueIOS: Codable {
    public var unit: SubscriptionPeriodIOS
    public var value: Int
}

public struct SubscriptionPricingTermsIOS: Codable {
    public var billingDisplayPrice: String
    public var billingPeriod: SubscriptionPeriodValueIOS
    public var billingPlanType: SubscriptionBillingPlanTypeIOS
    public var billingPrice: Double
    public var commitmentInfo: SubscriptionCommitmentInfoIOS
    public var subscriptionOffers: [SubscriptionOffer]? = nil
}

public struct SubscriptionStatusIOS: Codable {
    public var renewalInfo: RenewalInfoIOS? = nil
    public var state: String
}

public struct TransactionCommitmentInfoIOS: Codable {
    public var billingPeriodNumber: Int
    public var commitmentExpiresDate: Double
    public var commitmentPrice: Double
    public var totalBillingPeriods: Int
}

/// User Choice Billing event details (Android)
/// Fired when a user selects alternative billing in the User Choice Billing dialog
public struct UserChoiceBillingDetails: Codable {
    /// Token that must be reported to Google Play within 24 hours
    public var externalTransactionToken: String
    /// External transaction ID of the originating subscription when the user is
    /// upgrading or downgrading a developer-billed subscription. Available in
    /// OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).
    public var originalExternalTransactionId: String? = nil
    /// Structured product details selected in the user-choice flow, including the
    /// product type and offer token. Legacy payloads may omit this field; use
    /// products as the product-ID fallback. Available in OpenIAP Spec 2.3.0 /
    /// openiap-google 2.3.1 (requires Play Billing 9.1+).
    public var productDetailsAndroid: [DeveloperProvidedBillingProductAndroid]? = nil
    /// List of product IDs selected by the user
    public var products: [String]
}

/// Valid time window for when an offer is available (Android)
/// Available in Google Play Billing Library 8.0+
public struct ValidTimeWindowAndroid: Codable {
    /// End time in milliseconds since epoch
    public var endTimeMillis: String
    /// Start time in milliseconds since epoch
    public var startTimeMillis: String
}

public struct VerifyPurchaseResultAndroid: Codable {
    public var autoRenewing: Bool
    public var betaProduct: Bool
    public var cancelDate: Double? = nil
    public var cancelReason: String? = nil
    public var deferredDate: Double? = nil
    public var deferredSku: String? = nil
    public var freeTrialEndDate: Double
    public var gracePeriodEndDate: Double
    public var parentProductId: String
    public var productId: String
    public var productType: String
    public var purchaseDate: Double
    public var quantity: Int
    public var receiptId: String
    public var renewalDate: Double
    public var term: String
    public var termSku: String
    public var testTransaction: Bool
}

/// Result from Meta Horizon verify_entitlement API.
/// Returns verification status and grant time for the entitlement.
public struct VerifyPurchaseResultHorizon: Codable {
    /// Unix timestamp (seconds) when the entitlement was granted.
    public var grantTime: Double? = nil
    /// Whether the entitlement verification succeeded.
    public var success: Bool
}

public struct VerifyPurchaseResultIOS: Codable {
    /// Whether the receipt is valid
    public var isValid: Bool
    /// JWS representation
    public var jwsRepresentation: String
    /// Latest transaction if available
    public var latestTransaction: Purchase? = nil
    /// Receipt data string
    public var receiptData: String
}

public struct VerifyPurchaseWithProviderError: Codable {
    public var code: String? = nil
    public var message: String
}

public struct VerifyPurchaseWithProviderResult: Codable {
    /// Error details if verification failed
    public var errors: [VerifyPurchaseWithProviderError]? = nil
    /// IAPKit verification result
    public var iapkit: RequestVerifyPurchaseWithIapkitResult? = nil
    public var provider: PurchaseVerificationProvider
}

public typealias VoidResult = Void

public struct WebhookEvent: Codable {
    /// Reason for cancellation, when applicable.
    public var cancellationReason: WebhookCancellationReason? = nil
    /// Localized currency code (ISO 4217) at event time, when available.
    public var currency: String? = nil
    public var environment: WebhookEventEnvironment
    /// When the current subscription period ends. Epoch milliseconds.
    public var expiresAt: Double? = nil
    /// Stable identifier suitable for idempotency. Derived from the source notification
    /// UUID where the store provides one (ASN v2 `notificationUUID`, RTDN message id);
    /// otherwise hashed from the canonicalized payload.
    public var id: String
    /// Time the underlying event occurred at the store. Epoch milliseconds.
    public var occurredAt: Double
    public var platform: IapPlatform
    /// Price in micros (1/1,000,000 of the currency unit) at event time, when available.
    /// Matches Google Play's `priceAmountMicros` convention; iOS values are converted.
    public var priceAmountMicros: Double? = nil
    /// Product the event pertains to. May be null for account-level events.
    public var productId: String? = nil
    /// kit project that owns the subscription / purchase this event refers to.
    public var projectId: String
    /// Cross-platform purchase identity used to correlate this event with an existing
    /// purchase record. iOS: `originalTransactionId`. Android: `purchaseToken`.
    /// Null for `TestNotification` events (Apple ASN v2 / Google RTDN test
    /// payloads carry no transaction); always present for every other event type.
    public var purchaseToken: String? = nil
    /// Original signed payload from the store. ASN v2 events expose the JWS string;
    /// RTDN events expose the base64-decoded Pub/Sub message JSON. Provided so that
    /// consumers can independently verify or extract platform-specific fields. kit
    /// always validates this payload before emitting the event.
    public var rawSignedPayload: String? = nil
    /// Time kit ingested and normalized this event. Epoch milliseconds.
    public var receivedAt: Double
    /// When auto-renewal will charge again. Epoch milliseconds.
    public var renewsAt: Double? = nil
    public var source: WebhookEventSource
    /// Normalized subscription state at the time of event, when the event refers to
    /// a subscription. Null for one-time purchase events.
    public var subscriptionState: SubscriptionState? = nil
    public var type: WebhookEventType
}

// MARK: - Input Objects

public struct AndroidSubscriptionOfferInput: Codable {
    /// Offer token
    public var offerToken: String
    /// Product SKU
    public var sku: String

    public init(
        offerToken: String,
        sku: String
    ) {
        self.offerToken = offerToken
        self.sku = sku
    }
}

/// Parameters for showing a billing program information dialog (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public struct BillingProgramInformationDialogParamsAndroid: Codable {
    /// Billing program. Currently only BILLING_CHOICE is supported.
    public var billingProgram: BillingProgramAndroid
    /// External transaction token returned by the Billing Choice reporting-details flow.
    public var externalTransactionToken: String

    public init(
        billingProgram: BillingProgramAndroid = .billingChoice,
        externalTransactionToken: String
    ) {
        self.billingProgram = billingProgram
        self.externalTransactionToken = externalTransactionToken
    }
}

public struct DeepLinkOptions: Codable {
    /// Android package name to target (required on Android)
    public var packageNameAndroid: String?
    /// Android SKU to open (required on Android)
    public var skuAndroid: String?

    public init(
        packageNameAndroid: String? = nil,
        skuAndroid: String? = nil
    ) {
        self.packageNameAndroid = packageNameAndroid
        self.skuAndroid = skuAndroid
    }
}

/// Parameters for a developer billing option in a purchase flow (Android).
/// Used with BillingFlowParams for external payments (8.3.0+) and Billing Choice
/// (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+).
/// Only billingProgram is required; link fields are used when the selected program
/// links outside the app.
public struct DeveloperBillingOptionParamsAndroid: Codable {
    /// The billing program. Use EXTERNAL_PAYMENTS or BILLING_CHOICE.
    public var billingProgram: BillingProgramAndroid
    /// A pre-generated external transaction token for a Billing Choice external-link
    /// flow. Omit it when Google Play should provide the token in the callback.
    public var externalTransactionToken: String?
    /// The launch mode for the external payment link.
    /// Required only when the selected billing program links outside the app.
    public var launchMode: DeveloperBillingLaunchModeAndroid?
    /// The URI where the external payment will be processed.
    /// Required only when the selected billing program links outside the app.
    public var linkUri: String?

    public init(
        billingProgram: BillingProgramAndroid,
        externalTransactionToken: String? = nil,
        launchMode: DeveloperBillingLaunchModeAndroid? = nil,
        linkUri: String? = nil
    ) {
        self.billingProgram = billingProgram
        self.externalTransactionToken = externalTransactionToken
        self.launchMode = launchMode
        self.linkUri = linkUri
    }
}

public struct DiscountOfferInputIOS: Codable {
    /// Discount identifier
    public var identifier: String
    /// Key identifier for validation
    public var keyIdentifier: String
    /// Cryptographic nonce
    public var nonce: String
    /// Signature for validation
    public var signature: String
    /// Timestamp of discount offer
    public var timestamp: Double

    public init(identifier: String, keyIdentifier: String, nonce: String, signature: String, timestamp: Double) {
        self.identifier = identifier
        self.keyIdentifier = keyIdentifier
        self.nonce = nonce
        self.signature = signature
        self.timestamp = timestamp
    }

    private enum CodingKeys: String, CodingKey {
        case identifier, keyIdentifier, nonce, signature, timestamp
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        identifier = try container.decode(String.self, forKey: .identifier)
        keyIdentifier = try container.decode(String.self, forKey: .keyIdentifier)
        nonce = try container.decode(String.self, forKey: .nonce)
        signature = try container.decode(String.self, forKey: .signature)

        // Flexible timestamp decoding: accept Double or String
        if let timestampDouble = try? container.decode(Double.self, forKey: .timestamp) {
            timestamp = timestampDouble
        } else if let timestampString = try? container.decode(String.self, forKey: .timestamp),
                  let timestampDouble = Double(timestampString) {
            timestamp = timestampDouble
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .timestamp,
                in: container,
                debugDescription: "timestamp must be a number or numeric string"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(identifier, forKey: .identifier)
        try container.encode(keyIdentifier, forKey: .keyIdentifier)
        try container.encode(nonce, forKey: .nonce)
        try container.encode(signature, forKey: .signature)
        try container.encode(timestamp, forKey: .timestamp)
    }
}

/// Parameters for fetching Billing Choice display information (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
public struct GetBillingChoiceInfoParamsAndroid: Codable {
    /// Billing program. Currently only BILLING_CHOICE is supported.
    public var billingProgram: BillingProgramAndroid
    /// Desired Play Billing choice image layout.
    public var playBillingChoiceImageLayout: BillingChoiceImageLayoutAndroid
    /// BCP 47 locale tag. If omitted, Play Billing uses the user's default locale.
    public var userLocale: String?

    public init(
        billingProgram: BillingProgramAndroid = .billingChoice,
        playBillingChoiceImageLayout: BillingChoiceImageLayoutAndroid = .rectangularFourByOne,
        userLocale: String? = nil
    ) {
        self.billingProgram = billingProgram
        self.playBillingChoiceImageLayout = playBillingChoiceImageLayout
        self.userLocale = userLocale
    }
}

/// Parameters for showing Play billing in-app messages (Android)
/// Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
/// (upstream API available since Play Billing 4.1.0).
public struct InAppMessageParamsAndroid: Codable {
    /// In-app message categories to show. Defaults to transactional messages.
    public var categories: [InAppMessageCategoryAndroid]?

    public init(
        categories: [InAppMessageCategoryAndroid]? = [.transactional]
    ) {
        self.categories = categories
    }
}

/// Connection initialization configuration
public struct InitConnectionConfig: Codable {
    /// Alternative billing mode for Android
    /// If not specified, defaults to NONE (standard Google Play billing)
    /// Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
    /// @deprecated Use enableBillingProgramAndroid instead. Scheduled for removal in OpenIAP 3.0.
    public var alternativeBillingModeAndroid: AlternativeBillingModeAndroid?
    /// Billing Choice renderer configured in Play Console. Available in OpenIAP
    /// Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    /// GOOGLE_RENDERED registers the developer-provided billing listener so OpenIAP
    /// can emit the selection event. DEVELOPER_RENDERED omits that listener so the
    /// app can render its own choice screen and use the reporting/dialog/link APIs.
    /// Must match choiceScreenType returned by isBillingProgramAvailableAndroid.
    /// Defaults to GOOGLE_RENDERED.
    public var billingChoiceScreenTypeAndroid: BillingChoiceScreenTypeAndroid?
    /// Enable a specific billing program for Android (7.0+)
    /// When set, enables the specified billing program for external transactions.
    /// - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)
    /// - EXTERNAL_CONTENT_LINK: Link to external content (introduced in 8.2.0; use 8.2.1+)
    /// - EXTERNAL_OFFER: External offers for digital content (introduced in 8.2.0; use 8.2.1+)
    /// - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)
    /// - BILLING_CHOICE: Google-rendered or developer-rendered billing choice
    ///   (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+)
    public var enableBillingProgramAndroid: BillingProgramAndroid?

    public init(
        alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = nil,
        billingChoiceScreenTypeAndroid: BillingChoiceScreenTypeAndroid? = .googleRendered,
        enableBillingProgramAndroid: BillingProgramAndroid? = nil
    ) {
        self.alternativeBillingModeAndroid = alternativeBillingModeAndroid
        self.billingChoiceScreenTypeAndroid = billingChoiceScreenTypeAndroid
        self.enableBillingProgramAndroid = enableBillingProgramAndroid
    }
}

/// Parameters for launching an external link (Android)
/// Used with launchExternalLink to initiate external offer, app install, or
/// developer-rendered Billing Choice flows
/// Available in Google Play Billing Library 8.2.0+
public struct LaunchExternalLinkParamsAndroid: Codable {
    /// The billing program (EXTERNAL_CONTENT_LINK, EXTERNAL_OFFER, or BILLING_CHOICE)
    public var billingProgram: BillingProgramAndroid
    /// External transaction token for a developer-rendered Billing Choice external-link
    /// flow. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
    /// (requires Play Billing 9.1.0+). Generate it with createBillingProgramReportingDetailsAndroid.
    public var externalTransactionToken: String?
    /// The external link launch mode
    public var launchMode: ExternalLinkLaunchModeAndroid
    /// The type of the external link
    public var linkType: ExternalLinkTypeAndroid
    /// The URI where the content will be accessed from
    public var linkUri: String

    public init(
        billingProgram: BillingProgramAndroid,
        externalTransactionToken: String? = nil,
        launchMode: ExternalLinkLaunchModeAndroid,
        linkType: ExternalLinkTypeAndroid,
        linkUri: String
    ) {
        self.billingProgram = billingProgram
        self.externalTransactionToken = externalTransactionToken
        self.launchMode = launchMode
        self.linkType = linkType
        self.linkUri = linkUri
    }
}

public struct ProductRequest: Codable {
    public var skus: [String]
    public var type: ProductQueryType?

    public init(
        skus: [String],
        type: ProductQueryType? = .inApp
    ) {
        self.skus = skus
        self.type = type
    }
}

/// JWS promotional offer input for iOS 15+ (StoreKit 2, WWDC 2025).
/// New signature format using compact JWS string for promotional offers.
/// This provides a simpler alternative to the legacy signature-based promotional offers.
/// Back-deployed to iOS 15.
public struct PromotionalOfferJWSInputIOS: Codable {
    /// Compact JWS string signed by your server.
    /// The JWS should contain the promotional offer signature data.
    /// Format: header.payload.signature (base64url encoded)
    public var jws: String
    /// The promotional offer identifier from App Store Connect
    public var offerId: String

    public init(
        jws: String,
        offerId: String
    ) {
        self.jws = jws
        self.offerId = offerId
    }
}

public typealias PurchaseInput = Purchase

public struct PurchaseOptions: Codable {
    /// Also emit results through the iOS event listeners
    public var alsoPublishToEventListenerIOS: Bool?
    /// Include suspended subscriptions in the result (Android 8.1+).
    /// Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
    /// Users should be directed to the subscription center to resolve payment issues.
    /// Default: false (only active subscriptions are returned)
    public var includeSuspendedAndroid: Bool?
    /// Limit to currently active items on iOS
    public var onlyIncludeActiveItemsIOS: Bool?

    public init(
        alsoPublishToEventListenerIOS: Bool? = nil,
        includeSuspendedAndroid: Bool? = nil,
        onlyIncludeActiveItemsIOS: Bool? = nil
    ) {
        self.alsoPublishToEventListenerIOS = alsoPublishToEventListenerIOS
        self.includeSuspendedAndroid = includeSuspendedAndroid
        self.onlyIncludeActiveItemsIOS = onlyIncludeActiveItemsIOS
    }
}

public struct PurchaseUpdatedListenerOptions: Codable {
    /// iOS only. Defaults to true. When false, listener callbacks also receive
    /// StoreKit replay events for a transaction ID that was already emitted during
    /// the current connection session. Android ignores this option.
    public var dedupeTransactionIOS: Bool?

    public init(
        dedupeTransactionIOS: Bool? = nil
    ) {
        self.dedupeTransactionIOS = dedupeTransactionIOS
    }
}

public struct RequestPurchaseAndroidProps: Codable {
    /// Developer billing option parameters for external payments and Billing Choice.
    /// Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
    /// (requires Play Billing 9.1.0+).
    public var developerBillingOption: DeveloperBillingOptionParamsAndroid?
    /// Personalized offer flag.
    /// When true, indicates the price was customized for this user.
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountId: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileId: String?
    /// Offer token for one-time purchase discounts (8.0+).
    /// Pass the offerToken from oneTimePurchaseOfferDetailsAndroid or discountOffers
    /// to apply a discount offer to the purchase.
    public var offerToken: String?
    /// List of product SKUs
    public var skus: [String]

    public init(
        developerBillingOption: DeveloperBillingOptionParamsAndroid? = nil,
        isOfferPersonalized: Bool? = nil,
        obfuscatedAccountId: String? = nil,
        obfuscatedProfileId: String? = nil,
        offerToken: String? = nil,
        skus: [String]
    ) {
        self.developerBillingOption = developerBillingOption
        self.isOfferPersonalized = isOfferPersonalized
        self.obfuscatedAccountId = obfuscatedAccountId
        self.obfuscatedProfileId = obfuscatedProfileId
        self.offerToken = offerToken
        self.skus = skus
    }
}

public struct RequestPurchaseIosProps: Codable {
    /// Advanced commerce data token (iOS 15+).
    /// Used with StoreKit 2's Product.PurchaseOption.custom API for passing
    /// campaign tokens, affiliate IDs, or other attribution data.
    /// The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
    public var advancedCommerceData: String?
    /// Auto-finish transaction (dangerous)
    public var andDangerouslyFinishTransactionAutomatically: Bool?
    /// App account token for user tracking
    public var appAccountToken: String?
    /// Purchase quantity
    public var quantity: Int?
    /// Product SKU
    public var sku: String
    /// Promotional offer to apply (subscriptions only, ignored for one-time purchases).
    /// iOS only supports promotional offers for auto-renewable subscriptions.
    public var withOffer: DiscountOfferInputIOS?

    public init(
        advancedCommerceData: String? = nil,
        andDangerouslyFinishTransactionAutomatically: Bool? = nil,
        appAccountToken: String? = nil,
        quantity: Int? = nil,
        sku: String,
        withOffer: DiscountOfferInputIOS? = nil
    ) {
        self.advancedCommerceData = advancedCommerceData
        self.andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically
        self.appAccountToken = appAccountToken
        self.quantity = quantity
        self.sku = sku
        self.withOffer = withOffer
    }
}

public struct RequestPurchaseProps: Codable {
    public var request: Request
    /// Explicit purchase type hint (defaults to in-app)
    public var type: ProductQueryType
    /// This flag only logs debug info and has no effect on the purchase flow.
    /// @deprecated Use enableBillingProgramAndroid in InitConnectionConfig instead. Scheduled for removal in OpenIAP 3.0.
    public var useAlternativeBilling: Bool?

    public init(request: Request, type: ProductQueryType? = nil, useAlternativeBilling: Bool? = nil) {
        switch request {
        case .purchase:
            let resolved = type ?? .inApp
            precondition(resolved == .inApp, "RequestPurchaseProps.type must be .inApp when request is purchase")
            self.type = resolved
        case .subscription:
            let resolved = type ?? .subs
            precondition(resolved == .subs, "RequestPurchaseProps.type must be .subs when request is subscription")
            self.type = resolved
        }
        self.request = request
        self.useAlternativeBilling = useAlternativeBilling
    }

    private enum CodingKeys: String, CodingKey {
        case requestPurchase
        case requestSubscription
        case type
        case useAlternativeBilling
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedType = try container.decodeIfPresent(ProductQueryType.self, forKey: .type)
        self.useAlternativeBilling = try container.decodeIfPresent(Bool.self, forKey: .useAlternativeBilling)
        let purchase = try container.decodeIfPresent(RequestPurchasePropsByPlatforms.self, forKey: .requestPurchase)
        let subscription = try container.decodeIfPresent(RequestSubscriptionPropsByPlatforms.self, forKey: .requestSubscription)
        guard (purchase == nil) != (subscription == nil) else {
            throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription.")
        }
        if let purchase {
            let finalType = decodedType ?? .inApp
            guard finalType == .inApp else {
                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be IN_APP when requestPurchase is provided")
            }
            self.request = .purchase(purchase)
            self.type = finalType
            return
        }
        if let subscription {
            let finalType = decodedType ?? .subs
            guard finalType == .subs else {
                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be SUBS when requestSubscription is provided")
            }
            self.request = .subscription(subscription)
            self.type = finalType
            return
        }
        throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps branch validation failed.")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch request {
        case let .purchase(value):
            try container.encode(value, forKey: .requestPurchase)
        case let .subscription(value):
            try container.encode(value, forKey: .requestSubscription)
        }
        try container.encode(type, forKey: .type)
        try container.encodeIfPresent(useAlternativeBilling, forKey: .useAlternativeBilling)
    }

    public enum Request {
        /// Per-platform purchase request props
        case purchase(RequestPurchasePropsByPlatforms)
        /// Per-platform subscription request props
        case subscription(RequestSubscriptionPropsByPlatforms)
    }
}

/// Platform-specific purchase request parameters.
/// 
/// Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
/// - apple: Always targets App Store
/// - google: Targets Play Store by default, Horizon when built with horizon flavor,
///   or Fire OS when built with amazon flavor
///   (determined at build time, not runtime)
public struct RequestPurchasePropsByPlatforms: Codable {
    /// @deprecated Use google instead. Scheduled for removal in OpenIAP 3.0.
    public var android: RequestPurchaseAndroidProps?
    /// Apple-specific purchase parameters
    public var apple: RequestPurchaseIosProps?
    /// Google-specific purchase parameters
    public var google: RequestPurchaseAndroidProps?
    /// @deprecated Use apple instead. Scheduled for removal in OpenIAP 3.0.
    public var ios: RequestPurchaseIosProps?

    public init(
        android: RequestPurchaseAndroidProps? = nil,
        apple: RequestPurchaseIosProps? = nil,
        google: RequestPurchaseAndroidProps? = nil,
        ios: RequestPurchaseIosProps? = nil
    ) {
        self.android = android
        self.apple = apple
        self.google = google
        self.ios = ios
    }
}

public struct RequestSubscriptionAndroidProps: Codable {
    /// Developer billing option parameters for external payments and Billing Choice.
    /// Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
    /// (requires Play Billing 9.1.0+).
    public var developerBillingOption: DeveloperBillingOptionParamsAndroid?
    /// Personalized offer flag.
    /// When true, indicates the price was customized for this user.
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountId: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileId: String?
    /// Original external transaction ID for replacing a subscription that was
    /// purchased through developer billing. Available in OpenIAP Spec 2.1.0 /
    /// openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    public var originalExternalTransactionId: String?
    /// Purchase token for upgrades/downgrades
    public var purchaseToken: String?
    /// Replacement mode for subscription changes
    /// @deprecated Use subscriptionProductReplacementParams instead for item-level replacement (8.1.0+). Scheduled for removal in OpenIAP 3.0.
    public var replacementMode: Int?
    /// List of subscription SKUs
    public var skus: [String]
    /// Subscription offers
    public var subscriptionOffers: [AndroidSubscriptionOfferInput]?
    /// Product-level replacement parameters (8.1.0+)
    /// Use this instead of replacementMode for item-level replacement
    /// This singular form requires skus to contain exactly one target product.
    /// Multi-item subscription changes need a per-target replacement mapping and
    /// are rejected rather than applying one oldProductId to multiple products.
    public var subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?

    public init(
        developerBillingOption: DeveloperBillingOptionParamsAndroid? = nil,
        isOfferPersonalized: Bool? = nil,
        obfuscatedAccountId: String? = nil,
        obfuscatedProfileId: String? = nil,
        originalExternalTransactionId: String? = nil,
        purchaseToken: String? = nil,
        replacementMode: Int? = nil,
        skus: [String],
        subscriptionOffers: [AndroidSubscriptionOfferInput]? = nil,
        subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid? = nil
    ) {
        self.developerBillingOption = developerBillingOption
        self.isOfferPersonalized = isOfferPersonalized
        self.obfuscatedAccountId = obfuscatedAccountId
        self.obfuscatedProfileId = obfuscatedProfileId
        self.originalExternalTransactionId = originalExternalTransactionId
        self.purchaseToken = purchaseToken
        self.replacementMode = replacementMode
        self.skus = skus
        self.subscriptionOffers = subscriptionOffers
        self.subscriptionProductReplacementParams = subscriptionProductReplacementParams
    }
}

public struct RequestSubscriptionIosProps: Codable {
    /// Advanced commerce data token (iOS 15+).
    /// Used with StoreKit 2's Product.PurchaseOption.custom API for passing
    /// campaign tokens, affiliate IDs, or other attribution data.
    /// The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
    public var advancedCommerceData: String?
    public var andDangerouslyFinishTransactionAutomatically: Bool?
    public var appAccountToken: String?
    /// Billing plan to use when purchasing an annual subscription that offers
    /// monthly billing with a 12-month commitment (iOS 26.4+).
    public var billingPlanType: SubscriptionBillingPlanTypeIOS?
    /// Compact JWS string for overriding introductory offer eligibility
    /// (iOS 15+, WWDC 2025). When nil, the system determines eligibility.
    /// Generate the JWS on your server and pass it to StoreKit's
    /// introductoryOfferEligibility(compactJWS:) purchase option.
    public var compactJWS: String?
    /// JWS promotional offer (iOS 15+, WWDC 2025).
    /// New signature format using compact JWS string for promotional offers.
    /// Back-deployed to iOS 15.
    public var promotionalOfferJWS: PromotionalOfferJWSInputIOS?
    public var quantity: Int?
    public var sku: String
    /// Win-back offer to apply (iOS 18+)
    /// Used to re-engage churned subscribers with a discount or free trial.
    /// The offer is available when the customer is eligible and can be discovered
    /// via StoreKit Message (automatic) or subscription offer APIs.
    public var winBackOffer: WinBackOfferInputIOS?
    /// Promotional offer to apply for subscription purchases.
    /// Requires server-signed offer with nonce, timestamp, keyId, and signature.
    public var withOffer: DiscountOfferInputIOS?

    public init(
        advancedCommerceData: String? = nil,
        andDangerouslyFinishTransactionAutomatically: Bool? = nil,
        appAccountToken: String? = nil,
        billingPlanType: SubscriptionBillingPlanTypeIOS? = nil,
        compactJWS: String? = nil,
        promotionalOfferJWS: PromotionalOfferJWSInputIOS? = nil,
        quantity: Int? = nil,
        sku: String,
        winBackOffer: WinBackOfferInputIOS? = nil,
        withOffer: DiscountOfferInputIOS? = nil
    ) {
        self.advancedCommerceData = advancedCommerceData
        self.andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically
        self.appAccountToken = appAccountToken
        self.billingPlanType = billingPlanType
        self.compactJWS = compactJWS
        self.promotionalOfferJWS = promotionalOfferJWS
        self.quantity = quantity
        self.sku = sku
        self.winBackOffer = winBackOffer
        self.withOffer = withOffer
    }
}

/// Platform-specific subscription request parameters.
/// 
/// Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
/// - apple: Always targets App Store
/// - google: Targets Play Store by default, Horizon when built with horizon flavor,
///   or Fire OS when built with amazon flavor
///   (determined at build time, not runtime)
public struct RequestSubscriptionPropsByPlatforms: Codable {
    /// @deprecated Use google instead. Scheduled for removal in OpenIAP 3.0.
    public var android: RequestSubscriptionAndroidProps?
    /// Apple-specific subscription parameters
    public var apple: RequestSubscriptionIosProps?
    /// Google-specific subscription parameters
    public var google: RequestSubscriptionAndroidProps?
    /// @deprecated Use apple instead. Scheduled for removal in OpenIAP 3.0.
    public var ios: RequestSubscriptionIosProps?

    public init(
        android: RequestSubscriptionAndroidProps? = nil,
        apple: RequestSubscriptionIosProps? = nil,
        google: RequestSubscriptionAndroidProps? = nil,
        ios: RequestSubscriptionIosProps? = nil
    ) {
        self.android = android
        self.apple = apple
        self.google = google
        self.ios = ios
    }
}

public struct RequestVerifyPurchaseWithIapkitAmazonProps: Codable {
    /// Amazon Appstore receipt id returned by PurchaseResponse.getReceipt().getReceiptId().
    public var receiptId: String
    /// Use Amazon RVS Cloud Sandbox for App Tester receipts.
    public var sandbox: Bool?
    /// Amazon Appstore user id returned by PurchaseResponse.getUserData().getUserId().
    public var userId: String?

    public init(
        receiptId: String,
        sandbox: Bool? = nil,
        userId: String? = nil
    ) {
        self.receiptId = receiptId
        self.sandbox = sandbox
        self.userId = userId
    }
}

public struct RequestVerifyPurchaseWithIapkitAppleProps: Codable {
    /// The JWS token returned with the purchase response.
    public var jws: String

    public init(
        jws: String
    ) {
        self.jws = jws
    }
}

public struct RequestVerifyPurchaseWithIapkitGoogleProps: Codable {
    /// The token provided to the user's device when the product or subscription was purchased.
    public var purchaseToken: String

    public init(
        purchaseToken: String
    ) {
        self.purchaseToken = purchaseToken
    }
}

/// Platform-specific verification parameters for IAPKit.
/// 
/// - apple: Verifies via App Store (JWS token)
/// - google: Verifies via Play Store (purchase token)
/// - amazon: Verifies via Amazon Appstore RVS (userId + receiptId)
public struct RequestVerifyPurchaseWithIapkitProps: Codable {
    /// Amazon Appstore verification parameters.
    public var amazon: RequestVerifyPurchaseWithIapkitAmazonProps?
    /// API key used for the Authorization header (Bearer {apiKey}).
    public var apiKey: String?
    /// Apple App Store verification parameters.
    public var apple: RequestVerifyPurchaseWithIapkitAppleProps?
    /// Available in OpenIAP Spec 2.3.1 / openiap-apple 2.4.0 / openiap-google 2.4.0.
    /// Base URL for the IAPKit server. Defaults to https://kit.openiap.dev.
    /// Set this to a reachable HTTP(S) origin when self-hosting or testing a local IAPKit server.
    /// The apiKey must be issued by the same IAPKit/Convex deployment as this server.
    public var baseUrl: String?
    /// Google Play Store verification parameters.
    public var google: RequestVerifyPurchaseWithIapkitGoogleProps?
    /// Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
    /// Include the product's public IAPKit client payload in a valid Apple or
    /// Google verification response. Defaults to false so existing response
    /// shapes and bandwidth remain unchanged.
    public var includeClientPayload: Bool?

    public init(
        amazon: RequestVerifyPurchaseWithIapkitAmazonProps? = nil,
        apiKey: String? = nil,
        apple: RequestVerifyPurchaseWithIapkitAppleProps? = nil,
        baseUrl: String? = nil,
        google: RequestVerifyPurchaseWithIapkitGoogleProps? = nil,
        includeClientPayload: Bool? = nil
    ) {
        self.amazon = amazon
        self.apiKey = apiKey
        self.apple = apple
        self.baseUrl = baseUrl
        self.google = google
        self.includeClientPayload = includeClientPayload
    }
}

/// Product-level subscription replacement parameters (Android)
/// Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams
/// Available in Google Play Billing Library 8.1.0+
public struct SubscriptionProductReplacementParamsAndroid: Codable {
    /// The old product ID that needs to be replaced
    public var oldProductId: String
    /// The replacement mode for this product change
    public var replacementMode: SubscriptionReplacementModeAndroid

    public init(
        oldProductId: String,
        replacementMode: SubscriptionReplacementModeAndroid
    ) {
        self.oldProductId = oldProductId
        self.replacementMode = replacementMode
    }
}

/// Apple App Store verification parameters.
/// Used for server-side receipt validation via App Store Server API.
public struct VerifyPurchaseAppleOptions: Codable {
    /// Product SKU to validate
    public var sku: String

    public init(
        sku: String
    ) {
        self.sku = sku
    }
}

/// Google Play Store verification parameters.
/// Used for server-side receipt validation via Google Play Developer API.
/// 
/// ⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.
public struct VerifyPurchaseGoogleOptions: Codable {
    /// Google OAuth2 access token for API authentication.
    /// ⚠️ Sensitive: Do not log this value.
    public var accessToken: String
    /// Whether this is a subscription purchase (affects API endpoint used)
    public var isSub: Bool?
    /// Android package name (e.g., com.example.app)
    public var packageName: String
    /// Purchase token from the purchase response.
    /// ⚠️ Sensitive: Do not log this value.
    public var purchaseToken: String
    /// Product SKU to validate
    public var sku: String

    public init(
        accessToken: String,
        isSub: Bool? = nil,
        packageName: String,
        purchaseToken: String,
        sku: String
    ) {
        self.accessToken = accessToken
        self.isSub = isSub
        self.packageName = packageName
        self.purchaseToken = purchaseToken
        self.sku = sku
    }
}

/// Meta Horizon (Quest) verification parameters.
/// Used for server-side entitlement verification via Meta's S2S API.
/// POST https://graph.oculus.com/$APP_ID/verify_entitlement
/// 
/// ⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.
public struct VerifyPurchaseHorizonOptions: Codable {
    /// Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token).
    /// ⚠️ Sensitive: Do not log this value.
    public var accessToken: String
    /// The SKU for the add-on item, defined in Meta Developer Dashboard
    public var sku: String
    /// The user ID of the user whose purchase you want to verify
    public var userId: String

    public init(
        accessToken: String,
        sku: String,
        userId: String
    ) {
        self.accessToken = accessToken
        self.sku = sku
        self.userId = userId
    }
}

/// Platform-specific purchase verification parameters.
/// 
/// - apple: Verifies via App Store Server API
/// - google: Verifies via Google Play Developer API
/// - horizon: Verifies via Meta's S2S API (verify_entitlement endpoint)
public struct VerifyPurchaseProps: Codable {
    /// Apple App Store verification parameters.
    public var apple: VerifyPurchaseAppleOptions?
    /// Google Play Store verification parameters.
    public var google: VerifyPurchaseGoogleOptions?
    /// Meta Horizon (Quest) verification parameters.
    public var horizon: VerifyPurchaseHorizonOptions?

    public init(
        apple: VerifyPurchaseAppleOptions? = nil,
        google: VerifyPurchaseGoogleOptions? = nil,
        horizon: VerifyPurchaseHorizonOptions? = nil
    ) {
        self.apple = apple
        self.google = google
        self.horizon = horizon
    }
}

public struct VerifyPurchaseWithProviderProps: Codable {
    public var iapkit: RequestVerifyPurchaseWithIapkitProps?
    public var provider: PurchaseVerificationProvider

    public init(
        iapkit: RequestVerifyPurchaseWithIapkitProps? = nil,
        provider: PurchaseVerificationProvider
    ) {
        self.iapkit = iapkit
        self.provider = provider
    }
}

/// Win-back offer input for iOS 18+ (StoreKit 2)
/// Win-back offers are used to re-engage churned subscribers.
/// The offer is automatically presented via StoreKit Message when eligible,
/// or can be applied programmatically during purchase.
public struct WinBackOfferInputIOS: Codable {
    /// The win-back offer ID from App Store Connect
    public var offerId: String

    public init(
        offerId: String
    ) {
        self.offerId = offerId
    }
}

// MARK: - Unions

public enum Product: Codable, ProductCommon {
    case productAndroid(ProductAndroid)
    case productIos(ProductIOS)

    public var currency: String {
        switch self {
        case let .productAndroid(value):
            return value.currency
        case let .productIos(value):
            return value.currency
        }
    }

    public var debugDescription: String? {
        switch self {
        case let .productAndroid(value):
            return value.debugDescription
        case let .productIos(value):
            return value.debugDescription
        }
    }

    public var description: String {
        switch self {
        case let .productAndroid(value):
            return value.description
        case let .productIos(value):
            return value.description
        }
    }

    public var displayName: String? {
        switch self {
        case let .productAndroid(value):
            return value.displayName
        case let .productIos(value):
            return value.displayName
        }
    }

    public var displayPrice: String {
        switch self {
        case let .productAndroid(value):
            return value.displayPrice
        case let .productIos(value):
            return value.displayPrice
        }
    }

    public var id: String {
        switch self {
        case let .productAndroid(value):
            return value.id
        case let .productIos(value):
            return value.id
        }
    }

    public var platform: IapPlatform {
        switch self {
        case let .productAndroid(value):
            return value.platform
        case let .productIos(value):
            return value.platform
        }
    }

    public var price: Double? {
        switch self {
        case let .productAndroid(value):
            return value.price
        case let .productIos(value):
            return value.price
        }
    }

    public var title: String {
        switch self {
        case let .productAndroid(value):
            return value.title
        case let .productIos(value):
            return value.title
        }
    }

    public var type: ProductType {
        switch self {
        case let .productAndroid(value):
            return value.type
        case let .productIos(value):
            return value.type
        }
    }
}

public enum ProductOrSubscription: Codable {
    case product(Product)
    case productSubscription(ProductSubscription)
}

public enum ProductSubscription: Codable, ProductCommon {
    case productSubscriptionAndroid(ProductSubscriptionAndroid)
    case productSubscriptionIos(ProductSubscriptionIOS)

    public var currency: String {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.currency
        case let .productSubscriptionIos(value):
            return value.currency
        }
    }

    public var debugDescription: String? {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.debugDescription
        case let .productSubscriptionIos(value):
            return value.debugDescription
        }
    }

    public var description: String {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.description
        case let .productSubscriptionIos(value):
            return value.description
        }
    }

    public var displayName: String? {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.displayName
        case let .productSubscriptionIos(value):
            return value.displayName
        }
    }

    public var displayPrice: String {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.displayPrice
        case let .productSubscriptionIos(value):
            return value.displayPrice
        }
    }

    public var id: String {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.id
        case let .productSubscriptionIos(value):
            return value.id
        }
    }

    public var platform: IapPlatform {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.platform
        case let .productSubscriptionIos(value):
            return value.platform
        }
    }

    public var price: Double? {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.price
        case let .productSubscriptionIos(value):
            return value.price
        }
    }

    public var title: String {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.title
        case let .productSubscriptionIos(value):
            return value.title
        }
    }

    public var type: ProductType {
        switch self {
        case let .productSubscriptionAndroid(value):
            return value.type
        case let .productSubscriptionIos(value):
            return value.type
        }
    }
}

public enum Purchase: Codable, PurchaseCommon {
    case purchaseAndroid(PurchaseAndroid)
    case purchaseIos(PurchaseIOS)

    /// The current plan identifier. This is:
    /// - On Android: the basePlanId (e.g., "premium", "premium-year")
    /// - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
    /// This provides a unified way to identify which specific plan/tier the user is subscribed to.
    public var currentPlanId: String? {
        switch self {
        case let .purchaseAndroid(value):
            return value.currentPlanId
        case let .purchaseIos(value):
            return value.currentPlanId
        }
    }

    public var id: String {
        switch self {
        case let .purchaseAndroid(value):
            return value.id
        case let .purchaseIos(value):
            return value.id
        }
    }

    public var ids: [String]? {
        switch self {
        case let .purchaseAndroid(value):
            return value.ids
        case let .purchaseIos(value):
            return value.ids
        }
    }

    public var isAutoRenewing: Bool {
        switch self {
        case let .purchaseAndroid(value):
            return value.isAutoRenewing
        case let .purchaseIos(value):
            return value.isAutoRenewing
        }
    }

    /// @deprecated Use store instead. Scheduled for removal in OpenIAP 3.0.
    public var platform: IapPlatform {
        switch self {
        case let .purchaseAndroid(value):
            return value.platform
        case let .purchaseIos(value):
            return value.platform
        }
    }

    public var productId: String {
        switch self {
        case let .purchaseAndroid(value):
            return value.productId
        case let .purchaseIos(value):
            return value.productId
        }
    }

    public var purchaseState: PurchaseState {
        switch self {
        case let .purchaseAndroid(value):
            return value.purchaseState
        case let .purchaseIos(value):
            return value.purchaseState
        }
    }

    /// Unified purchase token (iOS JWS, Android purchaseToken)
    public var purchaseToken: String? {
        switch self {
        case let .purchaseAndroid(value):
            return value.purchaseToken
        case let .purchaseIos(value):
            return value.purchaseToken
        }
    }

    public var quantity: Int {
        switch self {
        case let .purchaseAndroid(value):
            return value.quantity
        case let .purchaseIos(value):
            return value.quantity
        }
    }

    /// Store where purchase was made
    public var store: IapStore {
        switch self {
        case let .purchaseAndroid(value):
            return value.store
        case let .purchaseIos(value):
            return value.store
        }
    }

    /// Unix timestamp in milliseconds since January 1, 1970 UTC.
    public var transactionDate: Double {
        switch self {
        case let .purchaseAndroid(value):
            return value.transactionDate
        case let .purchaseIos(value):
            return value.transactionDate
        }
    }
}

public enum VerifyPurchaseResult: Codable {
    case verifyPurchaseResultAndroid(VerifyPurchaseResultAndroid)
    case verifyPurchaseResultIos(VerifyPurchaseResultIOS)
    case verifyPurchaseResultHorizon(VerifyPurchaseResultHorizon)
}

// MARK: - Root Operations

/// GraphQL root mutation operations.
public protocol MutationResolver {
    /// Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
    /// See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
    func acknowledgePurchaseAndroid(_ purchaseToken: String) async throws -> Bool
    /// Present the refund request sheet (iOS 15+). See also Features → Refund.
    /// See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
    func beginRefundRequestIOS(_ sku: String) async throws -> String?
    /// Check whether alternative billing is available for the user. Step 1 of the alternative billing flow.
    /// Returns true if available, false otherwise.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android
    /// @deprecated Use isBillingProgramAvailableAndroid with the external-offer BillingProgramAndroid value instead. Scheduled for removal in OpenIAP 3.0.
    func checkAlternativeBillingAvailabilityAndroid() async throws -> Bool
    /// Clear pending transactions in the queue (sandbox helper).
    /// See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
    func clearTransactionIOS() async throws -> Bool
    /// Consume a consumable purchase so it can be re-bought.
    /// See: https://openiap.dev/docs/apis/android/consume-purchase-android
    func consumePurchaseAndroid(_ purchaseToken: String) async throws -> Bool
    /// Create a reporting token for an alternative billing flow. Step 3 of the alternative billing flow.
    /// Must be called AFTER successful payment in your payment system.
    /// Token must be reported to Google Play backend within 24 hours.
    /// Returns token string, or null if creation failed.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/create-alternative-billing-token-android
    /// @deprecated Use createBillingProgramReportingDetailsAndroid with the external-offer BillingProgramAndroid value instead. Scheduled for removal in OpenIAP 3.0.
    func createAlternativeBillingTokenAndroid() async throws -> String?
    /// Create the reporting details and external transaction token required by a billing program.
    /// Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations
    /// must use 8.2.1+ and create fresh details immediately before every redirect session;
    /// do not cache the token for a later redirect. The same token may report multiple purchases
    /// made during one External Offer session.
    /// Replaces the deprecated createExternalOfferReportingDetailsAsync API.
    /// Returns external transaction token needed for reporting external transactions.
    /// developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted,
    /// native Android defaults it to IN_APP.
    /// The Billing Choice extension is available in OpenIAP Spec 2.1.0 /
    /// openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
    func createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid?) async throws -> BillingProgramReportingDetailsAndroid
    /// Open the platform's subscription management UI.
    /// See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void
    /// Close the store connection and release resources.
    /// See: https://openiap.dev/docs/apis/end-connection
    func endConnection() async throws -> Bool
    /// Complete a transaction after server-side verification. Required on Android within 3 days.
    /// See: https://openiap.dev/docs/apis/finish-transaction
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void
    /// Initialize the store connection. Call before any IAP API.
    /// See: https://openiap.dev/docs/apis/init-connection
    func initConnection(_ config: InitConnectionConfig?) async throws -> Bool
    /// Check whether a billing program (e.g., External Payments) is available for the current user.
    /// Replaces the deprecated isExternalOfferAvailableAsync API.
    /// Introduced in Google Play Billing Library 8.2.0. External Offer and External
    /// Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API.
    /// Returns availability result with isAvailable flag.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
    func isBillingProgramAvailableAndroid(_ program: BillingProgramAndroid) async throws -> BillingProgramAvailabilityResultAndroid
    /// Launch an external content/offer link from inside the Billing Programs flow (introduced in
    /// Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+),
    /// including developer-rendered Billing Choice external-link flows.
    /// Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0
    /// (requires Play Billing 9.1.0+).
    /// Replaces the deprecated showExternalOfferInformationDialog API.
    /// Shows Play Store dialog and optionally launches external URL.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/launch-external-link-android
    func launchExternalLinkAndroid(_ params: LaunchExternalLinkParamsAndroid) async throws -> Bool
    /// Open the Google Play offer/promo code redemption flow so the user can enter a code.
    /// On Google Play builds, launches the Play Store redeem page
    /// (https://play.google.com/redeem). A purchase listener can receive the redeemed
    /// purchase while the app is running with an active billing connection; always
    /// reconcile with getAvailablePurchases when the app resumes.
    /// Does not require the billing client to be initialized (no Play Billing version requirement).
    /// Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0.
    /// Android counterpart of presentCodeRedemptionSheetIOS.
    /// Returns true when the redemption flow was launched, or false when the current
    /// store flavor does not provide an equivalent redemption flow.
    /// See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
    func openRedeemOfferCodeAndroid() async throws -> Bool
    /// Show the App Store offer code redemption sheet.
    /// See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
    func presentCodeRedemptionSheetIOS() async throws -> Bool
    /// Present an external purchase link, StoreKit External (iOS 16+).
    /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
    func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS
    /// Present the external purchase notice sheet (iOS 17.4+).
    /// Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
    /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
    func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS
    /// Initiate a purchase or subscription flow; rely on events for final state.
    /// See: https://openiap.dev/docs/apis/request-purchase
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
    /// Buy the currently promoted product.
    /// 
    /// See: https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios
    /// @deprecated Use the promoted-product listener or callback exposed by your SDK to receive the productId, then call requestPurchase with that SKU instead. In StoreKit 2, promoted products can be purchased directly via the standard purchase flow. Scheduled for removal in OpenIAP 3.0.
    func requestPurchaseOnPromotedProductIOS() async throws -> Bool
    /// Restore non-consumable and active subscription purchases.
    /// See: https://openiap.dev/docs/apis/restore-purchases
    func restorePurchases() async throws -> Void
    /// Display Google's alternative billing information dialog. Step 2 of the alternative billing flow.
    /// Must be called BEFORE processing payment in your payment system.
    /// Returns true if user accepted, false if user canceled.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android
    /// @deprecated Use launchExternalLinkAndroid instead. Scheduled for removal in OpenIAP 3.0.
    func showAlternativeBillingDialogAndroid() async throws -> Bool
    /// Show Google's mandatory information dialog before a developer-rendered,
    /// in-app Billing Choice screen.
    /// OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
    func showBillingProgramInformationDialogAndroid(_ params: BillingProgramInformationDialogParamsAndroid) async throws -> BillingResultAndroid
    /// Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
    /// Call this after a deliberate customer interaction before linking out to external purchases.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
    /// See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
    /// Parameter noticeType: Notice type determining the style of disclosure
    func showExternalPurchaseCustomLinkNoticeIOS(_ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS
    /// Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations.
    /// OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0
    /// (upstream API available since Play Billing 4.1.0).
    /// Returns a response code and, when the subscription status changes, the related purchase token.
    /// Throws OpenIapError.NotPrepared if billing client not ready.
    /// See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
    func showInAppMessagesAndroid(_ params: InAppMessageParamsAndroid?) async throws -> InAppMessageResultAndroid
    /// Present the manage-subscriptions sheet and return changed purchases (iOS 15+).
    /// See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS]
    /// Force sync transactions with the App Store (iOS 15+).
    /// See: https://openiap.dev/docs/apis/ios/sync-ios
    func syncIOS() async throws -> Bool
    /// Deprecated. Validate purchase receipts with the configured providers — use verifyPurchase instead.
    /// See: https://openiap.dev/docs/features/validation#verify-purchase
    /// @deprecated Use verifyPurchase. Scheduled for removal in OpenIAP 3.0.
    func validateReceipt(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    /// Verify a purchase against your own backend. Returns a platform-specific
    /// variant of VerifyPurchaseResult — VerifyPurchaseResultIOS exposes isValid
    /// + receipt/JWS metadata, VerifyPurchaseResultAndroid carries Play Store
    /// receipt fields (no isValid), and VerifyPurchaseResultHorizon uses success.
    /// Inspect the concrete variant before reading fields.
    /// See: https://openiap.dev/docs/features/validation#verify-purchase
    func verifyPurchase(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    /// Verify via a managed provider without standing up your own server. The
    /// PurchaseVerificationProvider enum currently exposes only IAPKit; platform
    /// availability may differ by implementation.
    /// See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
    func verifyPurchaseWithProvider(_ options: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult
}

/// GraphQL root query operations.
public protocol QueryResolver {
    /// Check eligibility for the external purchase notice sheet (iOS 17.4+).
    /// Uses ExternalPurchase.canPresent.
    /// See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
    func canPresentExternalPurchaseNoticeIOS() async throws -> Bool
    /// Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+).
    /// See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
    func currentEntitlementIOS(_ sku: String) async throws -> PurchaseIOS?
    /// Fetch products or subscriptions from the store.
    /// See: https://openiap.dev/docs/apis/fetch-products
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult
    /// Get details of all currently active subscriptions (filters by subscriptionIds when provided).
    /// See: https://openiap.dev/docs/apis/get-active-subscriptions
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]
    /// List every StoreKit transaction (finished + unfinished) for the current user.
    /// Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app
    /// for finished consumables to be included (iOS 18+).
    /// Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape.
    /// See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
    func getAllTransactionsIOS() async throws -> [PurchaseIOS]
    /// Fetch the app transaction (iOS 16+).
    /// See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
    func getAppTransactionIOS() async throws -> AppTransaction?
    /// List active purchases for the current user.
    /// See: https://openiap.dev/docs/apis/get-available-purchases
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase]
    /// Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens.
    /// OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    /// Throws OpenIapError.NotPrepared if billing client is not ready.
    /// See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
    func getBillingChoiceInfoAndroid(_ params: GetBillingChoiceInfoParamsAndroid) async throws -> BillingChoiceInfoAndroid
    /// Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
    /// Use this token to report transactions made through ExternalPurchaseCustomLink.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
    /// See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
    /// Parameter tokenType: Token type: acquisition (new customers) or services (existing customers)
    func getExternalPurchaseCustomLinkTokenIOS(_ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) async throws -> ExternalPurchaseCustomLinkTokenResultIOS
    /// List unfinished StoreKit transactions in the queue.
    /// See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
    func getPendingTransactionsIOS() async throws -> [PurchaseIOS]
    /// Read the App Store-promoted product, if any (iOS 11+).
    /// See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
    func getPromotedProductIOS() async throws -> ProductIOS?
    /// Get base64-encoded receipt data (legacy validation).
    /// See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
    func getReceiptDataIOS() async throws -> String?
    /// Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple
    /// platforms and alpha-2 on Android. The operation fails when the store cannot
    /// provide a value; implementations must not synthesize a locale fallback.
    /// See: https://openiap.dev/docs/apis/get-storefront
    func getStorefront() async throws -> String
    /// Deprecated. Get the current App Store storefront ISO 3166-1 alpha-3 country
    /// code — use cross-platform getStorefront instead.
    /// See: https://openiap.dev/docs/apis/ios/get-storefront-ios
    /// @deprecated Use getStorefront. Scheduled for removal in OpenIAP 3.0.
    func getStorefrontIOS() async throws -> String
    /// Return the JWS string for a transaction (StoreKit 2).
    /// See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
    func getTransactionJwsIOS(_ sku: String) async throws -> String?
    /// Check whether the user has any active subscription.
    /// See: https://openiap.dev/docs/apis/has-active-subscriptions
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool
    /// Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
    /// Returns true if the app can use custom external purchase links.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
    /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
    func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool
    /// Check intro-offer eligibility for a subscription group.
    /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
    func isEligibleForIntroOfferIOS(_ groupID: String) async throws -> Bool
    /// Check whether a transaction's JWS verification passed (StoreKit 2).
    /// See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
    func isTransactionVerifiedIOS(_ sku: String) async throws -> Bool
    /// Get the latest verified transaction for a product, using StoreKit 2.
    /// See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
    func latestTransactionIOS(_ sku: String) async throws -> PurchaseIOS?
    /// Get subscription status objects from StoreKit 2 (iOS 15+).
    /// See: https://openiap.dev/docs/apis/ios/subscription-status-ios
    func subscriptionStatusIOS(_ sku: String) async throws -> [SubscriptionStatusIOS]
    /// Deprecated. Legacy App Store receipt validation — use verifyPurchase instead.
    /// See: https://openiap.dev/docs/apis/ios/validate-receipt-ios
    /// @deprecated Use verifyPurchase. Scheduled for removal in OpenIAP 3.0.
    func validateReceiptIOS(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS
}

/// GraphQL root subscription operations.
public protocol SubscriptionResolver {
    /// Fires when a user selects developer billing in an External Payments or
    /// Billing Choice flow (Android only). The payload can contain an external
    /// transaction token, link URI, original transaction ID, and selected products.
    /// Billing Choice payload fields are available in OpenIAP Spec 2.1.0 /
    /// openiap-google 2.3.0 (requires Play Billing 9.1.0+).
    func developerProvidedBillingAndroid() async throws -> DeveloperProvidedBillingDetailsAndroid
    /// Fires when the App Store surfaces a promoted product (iOS only)
    func promotedProductIOS() async throws -> String
    /// Fires when a purchase fails or is cancelled
    func purchaseError() async throws -> PurchaseError
    /// Fires when a purchase completes successfully or a pending purchase resolves
    /// Options can opt iOS listeners into duplicate StoreKit transaction replays
    /// for diagnostics; default listeners receive one event per transaction ID
    /// during a single connection session.
    func purchaseUpdated(_ options: PurchaseUpdatedListenerOptions?) async throws -> Purchase
    /// Fires when a subscription enters a billing-issue state that needs user action
    /// (payment method failed, card expired, etc.). Cross-platform unification:
    /// 
    /// - iOS 16.4+ / Mac Catalyst 16.4+ / visionOS 1.0+: delivered via StoreKit 2
    ///   `Message.Reason.billingIssue`.
    /// - Android (Play flavor, Billing 8.1+): emitted when `isSuspended == true` is first detected
    ///   on a previously healthy subscription. Requires Google Play Billing Library 8.1.0 or newer.
    /// - Android (Horizon flavor): NOT emitted. The Horizon Billing Compatibility SDK implements
    ///   the Play Billing 7.0 API surface which does not expose a suspended-subscription signal.
    /// - Android (Amazon flavor): NOT emitted. Amazon Appstore IAP does not expose an
    ///   equivalent subscription billing-issue signal.
    /// 
    /// Listeners should not assume the event will fire on every store. Direct users to the
    /// platform subscription management UI (`deepLinkToSubscriptions`) to resolve the issue.
    func subscriptionBillingIssue() async throws -> Purchase
    /// Fires when a user selects alternative billing in the User Choice Billing dialog (Android only)
    /// Only triggered when the user selects alternative billing instead of Google Play billing
    func userChoiceBillingAndroid() async throws -> UserChoiceBillingDetails
}

// MARK: - Root Operation Helpers

// MARK: - Mutation Helpers

public typealias MutationAcknowledgePurchaseAndroidHandler = (_ purchaseToken: String) async throws -> Bool
public typealias MutationBeginRefundRequestIOSHandler = (_ sku: String) async throws -> String?
public typealias MutationCheckAlternativeBillingAvailabilityAndroidHandler = () async throws -> Bool
public typealias MutationClearTransactionIOSHandler = () async throws -> Bool
public typealias MutationConsumePurchaseAndroidHandler = (_ purchaseToken: String) async throws -> Bool
public typealias MutationCreateAlternativeBillingTokenAndroidHandler = () async throws -> String?
public typealias MutationCreateBillingProgramReportingDetailsAndroidHandler = (_ program: BillingProgramAndroid, _ developerBillingType: DeveloperBillingTypeAndroid?) async throws -> BillingProgramReportingDetailsAndroid
public typealias MutationDeepLinkToSubscriptionsHandler = (_ options: DeepLinkOptions?) async throws -> Void
public typealias MutationEndConnectionHandler = () async throws -> Bool
public typealias MutationFinishTransactionHandler = (_ purchase: PurchaseInput, _ isConsumable: Bool?) async throws -> Void
public typealias MutationInitConnectionHandler = (_ config: InitConnectionConfig?) async throws -> Bool
public typealias MutationIsBillingProgramAvailableAndroidHandler = (_ program: BillingProgramAndroid) async throws -> BillingProgramAvailabilityResultAndroid
public typealias MutationLaunchExternalLinkAndroidHandler = (_ params: LaunchExternalLinkParamsAndroid) async throws -> Bool
public typealias MutationOpenRedeemOfferCodeAndroidHandler = () async throws -> Bool
public typealias MutationPresentCodeRedemptionSheetIOSHandler = () async throws -> Bool
public typealias MutationPresentExternalPurchaseLinkIOSHandler = (_ url: String) async throws -> ExternalPurchaseLinkResultIOS
public typealias MutationPresentExternalPurchaseNoticeSheetIOSHandler = () async throws -> ExternalPurchaseNoticeResultIOS
public typealias MutationRequestPurchaseHandler = (_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
public typealias MutationRequestPurchaseOnPromotedProductIOSHandler = () async throws -> Bool
public typealias MutationRestorePurchasesHandler = () async throws -> Void
public typealias MutationShowAlternativeBillingDialogAndroidHandler = () async throws -> Bool
public typealias MutationShowBillingProgramInformationDialogAndroidHandler = (_ params: BillingProgramInformationDialogParamsAndroid) async throws -> BillingResultAndroid
public typealias MutationShowExternalPurchaseCustomLinkNoticeIOSHandler = (_ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS
public typealias MutationShowInAppMessagesAndroidHandler = (_ params: InAppMessageParamsAndroid?) async throws -> InAppMessageResultAndroid
public typealias MutationShowManageSubscriptionsIOSHandler = () async throws -> [PurchaseIOS]
public typealias MutationSyncIOSHandler = () async throws -> Bool
public typealias MutationValidateReceiptHandler = (_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
public typealias MutationVerifyPurchaseHandler = (_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
public typealias MutationVerifyPurchaseWithProviderHandler = (_ options: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult

public struct MutationHandlers {
    public var acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler?
    public var beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler?
    public var checkAlternativeBillingAvailabilityAndroid: MutationCheckAlternativeBillingAvailabilityAndroidHandler?
    public var clearTransactionIOS: MutationClearTransactionIOSHandler?
    public var consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler?
    public var createAlternativeBillingTokenAndroid: MutationCreateAlternativeBillingTokenAndroidHandler?
    public var createBillingProgramReportingDetailsAndroid: MutationCreateBillingProgramReportingDetailsAndroidHandler?
    public var deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler?
    public var endConnection: MutationEndConnectionHandler?
    public var finishTransaction: MutationFinishTransactionHandler?
    public var initConnection: MutationInitConnectionHandler?
    public var isBillingProgramAvailableAndroid: MutationIsBillingProgramAvailableAndroidHandler?
    public var launchExternalLinkAndroid: MutationLaunchExternalLinkAndroidHandler?
    public var openRedeemOfferCodeAndroid: MutationOpenRedeemOfferCodeAndroidHandler?
    public var presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler?
    public var presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler?
    public var presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler?
    public var requestPurchase: MutationRequestPurchaseHandler?
    public var requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler?
    public var restorePurchases: MutationRestorePurchasesHandler?
    public var showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler?
    public var showBillingProgramInformationDialogAndroid: MutationShowBillingProgramInformationDialogAndroidHandler?
    public var showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIOSHandler?
    public var showInAppMessagesAndroid: MutationShowInAppMessagesAndroidHandler?
    public var showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler?
    public var syncIOS: MutationSyncIOSHandler?
    public var validateReceipt: MutationValidateReceiptHandler?
    public var verifyPurchase: MutationVerifyPurchaseHandler?
    public var verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler?

    public init(
        acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler? = nil,
        beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler? = nil,
        checkAlternativeBillingAvailabilityAndroid: MutationCheckAlternativeBillingAvailabilityAndroidHandler? = nil,
        clearTransactionIOS: MutationClearTransactionIOSHandler? = nil,
        consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler? = nil,
        createAlternativeBillingTokenAndroid: MutationCreateAlternativeBillingTokenAndroidHandler? = nil,
        createBillingProgramReportingDetailsAndroid: MutationCreateBillingProgramReportingDetailsAndroidHandler? = nil,
        deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler? = nil,
        endConnection: MutationEndConnectionHandler? = nil,
        finishTransaction: MutationFinishTransactionHandler? = nil,
        initConnection: MutationInitConnectionHandler? = nil,
        isBillingProgramAvailableAndroid: MutationIsBillingProgramAvailableAndroidHandler? = nil,
        launchExternalLinkAndroid: MutationLaunchExternalLinkAndroidHandler? = nil,
        openRedeemOfferCodeAndroid: MutationOpenRedeemOfferCodeAndroidHandler? = nil,
        presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler? = nil,
        presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler? = nil,
        presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler? = nil,
        requestPurchase: MutationRequestPurchaseHandler? = nil,
        requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler? = nil,
        restorePurchases: MutationRestorePurchasesHandler? = nil,
        showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler? = nil,
        showBillingProgramInformationDialogAndroid: MutationShowBillingProgramInformationDialogAndroidHandler? = nil,
        showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIOSHandler? = nil,
        showInAppMessagesAndroid: MutationShowInAppMessagesAndroidHandler? = nil,
        showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler? = nil,
        syncIOS: MutationSyncIOSHandler? = nil,
        validateReceipt: MutationValidateReceiptHandler? = nil,
        verifyPurchase: MutationVerifyPurchaseHandler? = nil,
        verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler? = nil
    ) {
        self.acknowledgePurchaseAndroid = acknowledgePurchaseAndroid
        self.beginRefundRequestIOS = beginRefundRequestIOS
        self.checkAlternativeBillingAvailabilityAndroid = checkAlternativeBillingAvailabilityAndroid
        self.clearTransactionIOS = clearTransactionIOS
        self.consumePurchaseAndroid = consumePurchaseAndroid
        self.createAlternativeBillingTokenAndroid = createAlternativeBillingTokenAndroid
        self.createBillingProgramReportingDetailsAndroid = createBillingProgramReportingDetailsAndroid
        self.deepLinkToSubscriptions = deepLinkToSubscriptions
        self.endConnection = endConnection
        self.finishTransaction = finishTransaction
        self.initConnection = initConnection
        self.isBillingProgramAvailableAndroid = isBillingProgramAvailableAndroid
        self.launchExternalLinkAndroid = launchExternalLinkAndroid
        self.openRedeemOfferCodeAndroid = openRedeemOfferCodeAndroid
        self.presentCodeRedemptionSheetIOS = presentCodeRedemptionSheetIOS
        self.presentExternalPurchaseLinkIOS = presentExternalPurchaseLinkIOS
        self.presentExternalPurchaseNoticeSheetIOS = presentExternalPurchaseNoticeSheetIOS
        self.requestPurchase = requestPurchase
        self.requestPurchaseOnPromotedProductIOS = requestPurchaseOnPromotedProductIOS
        self.restorePurchases = restorePurchases
        self.showAlternativeBillingDialogAndroid = showAlternativeBillingDialogAndroid
        self.showBillingProgramInformationDialogAndroid = showBillingProgramInformationDialogAndroid
        self.showExternalPurchaseCustomLinkNoticeIOS = showExternalPurchaseCustomLinkNoticeIOS
        self.showInAppMessagesAndroid = showInAppMessagesAndroid
        self.showManageSubscriptionsIOS = showManageSubscriptionsIOS
        self.syncIOS = syncIOS
        self.validateReceipt = validateReceipt
        self.verifyPurchase = verifyPurchase
        self.verifyPurchaseWithProvider = verifyPurchaseWithProvider
    }
}

// MARK: - Query Helpers

public typealias QueryCanPresentExternalPurchaseNoticeIOSHandler = () async throws -> Bool
public typealias QueryCurrentEntitlementIOSHandler = (_ sku: String) async throws -> PurchaseIOS?
public typealias QueryFetchProductsHandler = (_ params: ProductRequest) async throws -> FetchProductsResult
public typealias QueryGetActiveSubscriptionsHandler = (_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]
public typealias QueryGetAllTransactionsIOSHandler = () async throws -> [PurchaseIOS]
public typealias QueryGetAppTransactionIOSHandler = () async throws -> AppTransaction?
public typealias QueryGetAvailablePurchasesHandler = (_ options: PurchaseOptions?) async throws -> [Purchase]
public typealias QueryGetBillingChoiceInfoAndroidHandler = (_ params: GetBillingChoiceInfoParamsAndroid) async throws -> BillingChoiceInfoAndroid
public typealias QueryGetExternalPurchaseCustomLinkTokenIOSHandler = (_ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) async throws -> ExternalPurchaseCustomLinkTokenResultIOS
public typealias QueryGetPendingTransactionsIOSHandler = () async throws -> [PurchaseIOS]
public typealias QueryGetPromotedProductIOSHandler = () async throws -> ProductIOS?
public typealias QueryGetReceiptDataIOSHandler = () async throws -> String?
public typealias QueryGetStorefrontHandler = () async throws -> String
public typealias QueryGetStorefrontIOSHandler = () async throws -> String
public typealias QueryGetTransactionJwsIOSHandler = (_ sku: String) async throws -> String?
public typealias QueryHasActiveSubscriptionsHandler = (_ subscriptionIds: [String]?) async throws -> Bool
public typealias QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler = () async throws -> Bool
public typealias QueryIsEligibleForIntroOfferIOSHandler = (_ groupID: String) async throws -> Bool
public typealias QueryIsTransactionVerifiedIOSHandler = (_ sku: String) async throws -> Bool
public typealias QueryLatestTransactionIOSHandler = (_ sku: String) async throws -> PurchaseIOS?
public typealias QuerySubscriptionStatusIOSHandler = (_ sku: String) async throws -> [SubscriptionStatusIOS]
public typealias QueryValidateReceiptIOSHandler = (_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS

public struct QueryHandlers {
    public var canPresentExternalPurchaseNoticeIOS: QueryCanPresentExternalPurchaseNoticeIOSHandler?
    public var currentEntitlementIOS: QueryCurrentEntitlementIOSHandler?
    public var fetchProducts: QueryFetchProductsHandler?
    public var getActiveSubscriptions: QueryGetActiveSubscriptionsHandler?
    public var getAllTransactionsIOS: QueryGetAllTransactionsIOSHandler?
    public var getAppTransactionIOS: QueryGetAppTransactionIOSHandler?
    public var getAvailablePurchases: QueryGetAvailablePurchasesHandler?
    public var getBillingChoiceInfoAndroid: QueryGetBillingChoiceInfoAndroidHandler?
    public var getExternalPurchaseCustomLinkTokenIOS: QueryGetExternalPurchaseCustomLinkTokenIOSHandler?
    public var getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler?
    public var getPromotedProductIOS: QueryGetPromotedProductIOSHandler?
    public var getReceiptDataIOS: QueryGetReceiptDataIOSHandler?
    public var getStorefront: QueryGetStorefrontHandler?
    public var getStorefrontIOS: QueryGetStorefrontIOSHandler?
    public var getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler?
    public var hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler?
    public var isEligibleForExternalPurchaseCustomLinkIOS: QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler?
    public var isEligibleForIntroOfferIOS: QueryIsEligibleForIntroOfferIOSHandler?
    public var isTransactionVerifiedIOS: QueryIsTransactionVerifiedIOSHandler?
    public var latestTransactionIOS: QueryLatestTransactionIOSHandler?
    public var subscriptionStatusIOS: QuerySubscriptionStatusIOSHandler?
    public var validateReceiptIOS: QueryValidateReceiptIOSHandler?

    public init(
        canPresentExternalPurchaseNoticeIOS: QueryCanPresentExternalPurchaseNoticeIOSHandler? = nil,
        currentEntitlementIOS: QueryCurrentEntitlementIOSHandler? = nil,
        fetchProducts: QueryFetchProductsHandler? = nil,
        getActiveSubscriptions: QueryGetActiveSubscriptionsHandler? = nil,
        getAllTransactionsIOS: QueryGetAllTransactionsIOSHandler? = nil,
        getAppTransactionIOS: QueryGetAppTransactionIOSHandler? = nil,
        getAvailablePurchases: QueryGetAvailablePurchasesHandler? = nil,
        getBillingChoiceInfoAndroid: QueryGetBillingChoiceInfoAndroidHandler? = nil,
        getExternalPurchaseCustomLinkTokenIOS: QueryGetExternalPurchaseCustomLinkTokenIOSHandler? = nil,
        getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler? = nil,
        getPromotedProductIOS: QueryGetPromotedProductIOSHandler? = nil,
        getReceiptDataIOS: QueryGetReceiptDataIOSHandler? = nil,
        getStorefront: QueryGetStorefrontHandler? = nil,
        getStorefrontIOS: QueryGetStorefrontIOSHandler? = nil,
        getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler? = nil,
        hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler? = nil,
        isEligibleForExternalPurchaseCustomLinkIOS: QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler? = nil,
        isEligibleForIntroOfferIOS: QueryIsEligibleForIntroOfferIOSHandler? = nil,
        isTransactionVerifiedIOS: QueryIsTransactionVerifiedIOSHandler? = nil,
        latestTransactionIOS: QueryLatestTransactionIOSHandler? = nil,
        subscriptionStatusIOS: QuerySubscriptionStatusIOSHandler? = nil,
        validateReceiptIOS: QueryValidateReceiptIOSHandler? = nil
    ) {
        self.canPresentExternalPurchaseNoticeIOS = canPresentExternalPurchaseNoticeIOS
        self.currentEntitlementIOS = currentEntitlementIOS
        self.fetchProducts = fetchProducts
        self.getActiveSubscriptions = getActiveSubscriptions
        self.getAllTransactionsIOS = getAllTransactionsIOS
        self.getAppTransactionIOS = getAppTransactionIOS
        self.getAvailablePurchases = getAvailablePurchases
        self.getBillingChoiceInfoAndroid = getBillingChoiceInfoAndroid
        self.getExternalPurchaseCustomLinkTokenIOS = getExternalPurchaseCustomLinkTokenIOS
        self.getPendingTransactionsIOS = getPendingTransactionsIOS
        self.getPromotedProductIOS = getPromotedProductIOS
        self.getReceiptDataIOS = getReceiptDataIOS
        self.getStorefront = getStorefront
        self.getStorefrontIOS = getStorefrontIOS
        self.getTransactionJwsIOS = getTransactionJwsIOS
        self.hasActiveSubscriptions = hasActiveSubscriptions
        self.isEligibleForExternalPurchaseCustomLinkIOS = isEligibleForExternalPurchaseCustomLinkIOS
        self.isEligibleForIntroOfferIOS = isEligibleForIntroOfferIOS
        self.isTransactionVerifiedIOS = isTransactionVerifiedIOS
        self.latestTransactionIOS = latestTransactionIOS
        self.subscriptionStatusIOS = subscriptionStatusIOS
        self.validateReceiptIOS = validateReceiptIOS
    }
}

// MARK: - Subscription Helpers

public typealias SubscriptionDeveloperProvidedBillingAndroidHandler = () async throws -> DeveloperProvidedBillingDetailsAndroid
public typealias SubscriptionPromotedProductIOSHandler = () async throws -> String
public typealias SubscriptionPurchaseErrorHandler = () async throws -> PurchaseError
public typealias SubscriptionPurchaseUpdatedHandler = (_ options: PurchaseUpdatedListenerOptions?) async throws -> Purchase
public typealias SubscriptionSubscriptionBillingIssueHandler = () async throws -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = () async throws -> UserChoiceBillingDetails

public struct SubscriptionHandlers {
    public var developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler?
    public var promotedProductIOS: SubscriptionPromotedProductIOSHandler?
    public var purchaseError: SubscriptionPurchaseErrorHandler?
    public var purchaseUpdated: SubscriptionPurchaseUpdatedHandler?
    public var subscriptionBillingIssue: SubscriptionSubscriptionBillingIssueHandler?
    public var userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler?

    public init(
        developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler? = nil,
        promotedProductIOS: SubscriptionPromotedProductIOSHandler? = nil,
        purchaseError: SubscriptionPurchaseErrorHandler? = nil,
        purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = nil,
        subscriptionBillingIssue: SubscriptionSubscriptionBillingIssueHandler? = nil,
        userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = nil
    ) {
        self.developerProvidedBillingAndroid = developerProvidedBillingAndroid
        self.promotedProductIOS = promotedProductIOS
        self.purchaseError = purchaseError
        self.purchaseUpdated = purchaseUpdated
        self.subscriptionBillingIssue = subscriptionBillingIssue
        self.userChoiceBillingAndroid = userChoiceBillingAndroid
    }
}
