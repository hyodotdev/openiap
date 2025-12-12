// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `npm run generate` after updating any *.graphql schema file.
// ============================================================================

@file:Suppress("unused", "UNCHECKED_CAST")
package dev.hyo.openiap

// MARK: - Enums

/**
 * Alternative billing mode for Android
 * Controls which billing system is used
 */
public enum class AlternativeBillingModeAndroid(val rawValue: String) {
    /**
     * Standard Google Play billing (default)
     */
    None("none"),
    /**
     * User choice billing - user can select between Google Play or alternative
     * Requires Google Play Billing Library 7.0+
     */
    UserChoice("user-choice"),
    /**
     * Alternative billing only - no Google Play billing option
     * Requires Google Play Billing Library 6.2+
     */
    AlternativeOnly("alternative-only");

    companion object {
        fun fromJson(value: String): AlternativeBillingModeAndroid = when (value) {
            "none" -> AlternativeBillingModeAndroid.None
            "None" -> AlternativeBillingModeAndroid.None
            "user-choice" -> AlternativeBillingModeAndroid.UserChoice
            "UserChoice" -> AlternativeBillingModeAndroid.UserChoice
            "alternative-only" -> AlternativeBillingModeAndroid.AlternativeOnly
            "AlternativeOnly" -> AlternativeBillingModeAndroid.AlternativeOnly
            else -> throw IllegalArgumentException("Unknown AlternativeBillingModeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Billing program types for external content links and external offers (Android)
 * Available in Google Play Billing Library 8.2.0+
 */
public enum class BillingProgramAndroid(val rawValue: String) {
    /**
     * Unspecified billing program. Do not use.
     */
    Unspecified("unspecified"),
    /**
     * External Content Links program.
     * Allows linking to external content outside the app.
     */
    ExternalContentLink("external-content-link"),
    /**
     * External Offers program.
     * Allows offering digital content purchases outside the app.
     */
    ExternalOffer("external-offer");

    companion object {
        fun fromJson(value: String): BillingProgramAndroid = when (value) {
            "unspecified" -> BillingProgramAndroid.Unspecified
            "Unspecified" -> BillingProgramAndroid.Unspecified
            "external-content-link" -> BillingProgramAndroid.ExternalContentLink
            "ExternalContentLink" -> BillingProgramAndroid.ExternalContentLink
            "external-offer" -> BillingProgramAndroid.ExternalOffer
            "ExternalOffer" -> BillingProgramAndroid.ExternalOffer
            else -> throw IllegalArgumentException("Unknown BillingProgramAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ErrorCode(val rawValue: String) {
    Unknown("unknown"),
    UserCancelled("user-cancelled"),
    UserError("user-error"),
    ItemUnavailable("item-unavailable"),
    RemoteError("remote-error"),
    NetworkError("network-error"),
    ServiceError("service-error"),
    ReceiptFailed("receipt-failed"),
    ReceiptFinished("receipt-finished"),
    ReceiptFinishedFailed("receipt-finished-failed"),
    PurchaseVerificationFailed("purchase-verification-failed"),
    PurchaseVerificationFinished("purchase-verification-finished"),
    PurchaseVerificationFinishFailed("purchase-verification-finish-failed"),
    NotPrepared("not-prepared"),
    NotEnded("not-ended"),
    AlreadyOwned("already-owned"),
    DeveloperError("developer-error"),
    BillingResponseJsonParseError("billing-response-json-parse-error"),
    DeferredPayment("deferred-payment"),
    Interrupted("interrupted"),
    IapNotAvailable("iap-not-available"),
    PurchaseError("purchase-error"),
    SyncError("sync-error"),
    TransactionValidationFailed("transaction-validation-failed"),
    ActivityUnavailable("activity-unavailable"),
    AlreadyPrepared("already-prepared"),
    Pending("pending"),
    ConnectionClosed("connection-closed"),
    InitConnection("init-connection"),
    ServiceDisconnected("service-disconnected"),
    QueryProduct("query-product"),
    SkuNotFound("sku-not-found"),
    SkuOfferMismatch("sku-offer-mismatch"),
    ItemNotOwned("item-not-owned"),
    BillingUnavailable("billing-unavailable"),
    FeatureNotSupported("feature-not-supported"),
    EmptySkuList("empty-sku-list");

    companion object {
        fun fromJson(value: String): ErrorCode = when (value) {
            "unknown" -> ErrorCode.Unknown
            "Unknown" -> ErrorCode.Unknown
            "user-cancelled" -> ErrorCode.UserCancelled
            "UserCancelled" -> ErrorCode.UserCancelled
            "user-error" -> ErrorCode.UserError
            "UserError" -> ErrorCode.UserError
            "item-unavailable" -> ErrorCode.ItemUnavailable
            "ItemUnavailable" -> ErrorCode.ItemUnavailable
            "remote-error" -> ErrorCode.RemoteError
            "RemoteError" -> ErrorCode.RemoteError
            "network-error" -> ErrorCode.NetworkError
            "NetworkError" -> ErrorCode.NetworkError
            "service-error" -> ErrorCode.ServiceError
            "ServiceError" -> ErrorCode.ServiceError
            "receipt-failed" -> ErrorCode.ReceiptFailed
            "ReceiptFailed" -> ErrorCode.ReceiptFailed
            "receipt-finished" -> ErrorCode.ReceiptFinished
            "ReceiptFinished" -> ErrorCode.ReceiptFinished
            "receipt-finished-failed" -> ErrorCode.ReceiptFinishedFailed
            "ReceiptFinishedFailed" -> ErrorCode.ReceiptFinishedFailed
            "purchase-verification-failed" -> ErrorCode.PurchaseVerificationFailed
            "PurchaseVerificationFailed" -> ErrorCode.PurchaseVerificationFailed
            "purchase-verification-finished" -> ErrorCode.PurchaseVerificationFinished
            "PurchaseVerificationFinished" -> ErrorCode.PurchaseVerificationFinished
            "purchase-verification-finish-failed" -> ErrorCode.PurchaseVerificationFinishFailed
            "PurchaseVerificationFinishFailed" -> ErrorCode.PurchaseVerificationFinishFailed
            "not-prepared" -> ErrorCode.NotPrepared
            "NotPrepared" -> ErrorCode.NotPrepared
            "not-ended" -> ErrorCode.NotEnded
            "NotEnded" -> ErrorCode.NotEnded
            "already-owned" -> ErrorCode.AlreadyOwned
            "AlreadyOwned" -> ErrorCode.AlreadyOwned
            "developer-error" -> ErrorCode.DeveloperError
            "DeveloperError" -> ErrorCode.DeveloperError
            "billing-response-json-parse-error" -> ErrorCode.BillingResponseJsonParseError
            "BillingResponseJsonParseError" -> ErrorCode.BillingResponseJsonParseError
            "deferred-payment" -> ErrorCode.DeferredPayment
            "DeferredPayment" -> ErrorCode.DeferredPayment
            "interrupted" -> ErrorCode.Interrupted
            "Interrupted" -> ErrorCode.Interrupted
            "iap-not-available" -> ErrorCode.IapNotAvailable
            "IapNotAvailable" -> ErrorCode.IapNotAvailable
            "purchase-error" -> ErrorCode.PurchaseError
            "PurchaseError" -> ErrorCode.PurchaseError
            "sync-error" -> ErrorCode.SyncError
            "SyncError" -> ErrorCode.SyncError
            "transaction-validation-failed" -> ErrorCode.TransactionValidationFailed
            "TransactionValidationFailed" -> ErrorCode.TransactionValidationFailed
            "activity-unavailable" -> ErrorCode.ActivityUnavailable
            "ActivityUnavailable" -> ErrorCode.ActivityUnavailable
            "already-prepared" -> ErrorCode.AlreadyPrepared
            "AlreadyPrepared" -> ErrorCode.AlreadyPrepared
            "pending" -> ErrorCode.Pending
            "Pending" -> ErrorCode.Pending
            "connection-closed" -> ErrorCode.ConnectionClosed
            "ConnectionClosed" -> ErrorCode.ConnectionClosed
            "init-connection" -> ErrorCode.InitConnection
            "InitConnection" -> ErrorCode.InitConnection
            "service-disconnected" -> ErrorCode.ServiceDisconnected
            "ServiceDisconnected" -> ErrorCode.ServiceDisconnected
            "query-product" -> ErrorCode.QueryProduct
            "QueryProduct" -> ErrorCode.QueryProduct
            "sku-not-found" -> ErrorCode.SkuNotFound
            "SkuNotFound" -> ErrorCode.SkuNotFound
            "sku-offer-mismatch" -> ErrorCode.SkuOfferMismatch
            "SkuOfferMismatch" -> ErrorCode.SkuOfferMismatch
            "item-not-owned" -> ErrorCode.ItemNotOwned
            "ItemNotOwned" -> ErrorCode.ItemNotOwned
            "billing-unavailable" -> ErrorCode.BillingUnavailable
            "BillingUnavailable" -> ErrorCode.BillingUnavailable
            "feature-not-supported" -> ErrorCode.FeatureNotSupported
            "FeatureNotSupported" -> ErrorCode.FeatureNotSupported
            "empty-sku-list" -> ErrorCode.EmptySkuList
            "EmptySkuList" -> ErrorCode.EmptySkuList
            else -> throw IllegalArgumentException("Unknown ErrorCode value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Launch mode for external link flow (Android)
 * Determines how the external URL is launched
 * Available in Google Play Billing Library 8.2.0+
 */
public enum class ExternalLinkLaunchModeAndroid(val rawValue: String) {
    /**
     * Unspecified launch mode. Do not use.
     */
    Unspecified("unspecified"),
    /**
     * Play will launch the URL in an external browser or eligible app
     */
    LaunchInExternalBrowserOrApp("launch-in-external-browser-or-app"),
    /**
     * Play will not launch the URL. The app handles launching the URL after Play returns control.
     */
    CallerWillLaunchLink("caller-will-launch-link");

    companion object {
        fun fromJson(value: String): ExternalLinkLaunchModeAndroid = when (value) {
            "unspecified" -> ExternalLinkLaunchModeAndroid.Unspecified
            "UNSPECIFIED" -> ExternalLinkLaunchModeAndroid.Unspecified
            "launch-in-external-browser-or-app" -> ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp
            "LAUNCH_IN_EXTERNAL_BROWSER_OR_APP" -> ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp
            "caller-will-launch-link" -> ExternalLinkLaunchModeAndroid.CallerWillLaunchLink
            "CALLER_WILL_LAUNCH_LINK" -> ExternalLinkLaunchModeAndroid.CallerWillLaunchLink
            else -> throw IllegalArgumentException("Unknown ExternalLinkLaunchModeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Link type for external link flow (Android)
 * Specifies the type of external link destination
 * Available in Google Play Billing Library 8.2.0+
 */
public enum class ExternalLinkTypeAndroid(val rawValue: String) {
    /**
     * Unspecified link type. Do not use.
     */
    Unspecified("unspecified"),
    /**
     * The link will direct users to a digital content offer
     */
    LinkToDigitalContentOffer("link-to-digital-content-offer"),
    /**
     * The link will direct users to download an app
     */
    LinkToAppDownload("link-to-app-download");

    companion object {
        fun fromJson(value: String): ExternalLinkTypeAndroid = when (value) {
            "unspecified" -> ExternalLinkTypeAndroid.Unspecified
            "Unspecified" -> ExternalLinkTypeAndroid.Unspecified
            "link-to-digital-content-offer" -> ExternalLinkTypeAndroid.LinkToDigitalContentOffer
            "LinkToDigitalContentOffer" -> ExternalLinkTypeAndroid.LinkToDigitalContentOffer
            "link-to-app-download" -> ExternalLinkTypeAndroid.LinkToAppDownload
            "LinkToAppDownload" -> ExternalLinkTypeAndroid.LinkToAppDownload
            else -> throw IllegalArgumentException("Unknown ExternalLinkTypeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * User actions on external purchase notice sheet (iOS 18.2+)
 */
public enum class ExternalPurchaseNoticeAction(val rawValue: String) {
    /**
     * User chose to continue to external purchase
     */
    Continue("continue"),
    /**
     * User dismissed the notice sheet
     */
    Dismissed("dismissed");

    companion object {
        fun fromJson(value: String): ExternalPurchaseNoticeAction = when (value) {
            "continue" -> ExternalPurchaseNoticeAction.Continue
            "Continue" -> ExternalPurchaseNoticeAction.Continue
            "dismissed" -> ExternalPurchaseNoticeAction.Dismissed
            "Dismissed" -> ExternalPurchaseNoticeAction.Dismissed
            else -> throw IllegalArgumentException("Unknown ExternalPurchaseNoticeAction value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class IapEvent(val rawValue: String) {
    PurchaseUpdated("purchase-updated"),
    PurchaseError("purchase-error"),
    PromotedProductIos("promoted-product-ios"),
    UserChoiceBillingAndroid("user-choice-billing-android");

    companion object {
        fun fromJson(value: String): IapEvent = when (value) {
            "purchase-updated" -> IapEvent.PurchaseUpdated
            "PurchaseUpdated" -> IapEvent.PurchaseUpdated
            "purchase-error" -> IapEvent.PurchaseError
            "PurchaseError" -> IapEvent.PurchaseError
            "promoted-product-ios" -> IapEvent.PromotedProductIos
            "PromotedProductIos" -> IapEvent.PromotedProductIos
            "PromotedProductIOS" -> IapEvent.PromotedProductIos
            "user-choice-billing-android" -> IapEvent.UserChoiceBillingAndroid
            "UserChoiceBillingAndroid" -> IapEvent.UserChoiceBillingAndroid
            else -> throw IllegalArgumentException("Unknown IapEvent value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Unified purchase states from IAPKit verification response.
 */
public enum class IapkitPurchaseState(val rawValue: String) {
    /**
     * User is entitled to the product (purchase is complete and active).
     */
    Entitled("entitled"),
    /**
     * Receipt is valid but still needs server acknowledgment.
     */
    PendingAcknowledgment("pending-acknowledgment"),
    /**
     * Purchase is in progress or awaiting confirmation.
     */
    Pending("pending"),
    /**
     * Purchase was cancelled or refunded.
     */
    Canceled("canceled"),
    /**
     * Subscription or entitlement has expired.
     */
    Expired("expired"),
    /**
     * Consumable purchase is ready to be fulfilled.
     */
    ReadyToConsume("ready-to-consume"),
    /**
     * Consumable item has been fulfilled/consumed.
     */
    Consumed("consumed"),
    /**
     * Purchase state could not be determined.
     */
    Unknown("unknown"),
    /**
     * Purchase receipt is not authentic (fraudulent or tampered).
     */
    Inauthentic("inauthentic");

    companion object {
        fun fromJson(value: String): IapkitPurchaseState = when (value) {
            "entitled" -> IapkitPurchaseState.Entitled
            "Entitled" -> IapkitPurchaseState.Entitled
            "pending-acknowledgment" -> IapkitPurchaseState.PendingAcknowledgment
            "PendingAcknowledgment" -> IapkitPurchaseState.PendingAcknowledgment
            "pending" -> IapkitPurchaseState.Pending
            "Pending" -> IapkitPurchaseState.Pending
            "canceled" -> IapkitPurchaseState.Canceled
            "Canceled" -> IapkitPurchaseState.Canceled
            "expired" -> IapkitPurchaseState.Expired
            "Expired" -> IapkitPurchaseState.Expired
            "ready-to-consume" -> IapkitPurchaseState.ReadyToConsume
            "ReadyToConsume" -> IapkitPurchaseState.ReadyToConsume
            "consumed" -> IapkitPurchaseState.Consumed
            "Consumed" -> IapkitPurchaseState.Consumed
            "unknown" -> IapkitPurchaseState.Unknown
            "Unknown" -> IapkitPurchaseState.Unknown
            "inauthentic" -> IapkitPurchaseState.Inauthentic
            "Inauthentic" -> IapkitPurchaseState.Inauthentic
            else -> throw IllegalArgumentException("Unknown IapkitPurchaseState value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class IapPlatform(val rawValue: String) {
    Ios("ios"),
    Android("android");

    companion object {
        fun fromJson(value: String): IapPlatform = when (value) {
            "ios" -> IapPlatform.Ios
            "Ios" -> IapPlatform.Ios
            "IOS" -> IapPlatform.Ios
            "android" -> IapPlatform.Android
            "Android" -> IapPlatform.Android
            else -> throw IllegalArgumentException("Unknown IapPlatform value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class IapStore(val rawValue: String) {
    Unknown("unknown"),
    Apple("apple"),
    Google("google"),
    Horizon("horizon");

    companion object {
        fun fromJson(value: String): IapStore = when (value) {
            "unknown" -> IapStore.Unknown
            "Unknown" -> IapStore.Unknown
            "apple" -> IapStore.Apple
            "Apple" -> IapStore.Apple
            "google" -> IapStore.Google
            "Google" -> IapStore.Google
            "horizon" -> IapStore.Horizon
            "Horizon" -> IapStore.Horizon
            else -> throw IllegalArgumentException("Unknown IapStore value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PaymentModeIOS(val rawValue: String) {
    Empty("empty"),
    FreeTrial("free-trial"),
    PayAsYouGo("pay-as-you-go"),
    PayUpFront("pay-up-front");

    companion object {
        fun fromJson(value: String): PaymentModeIOS = when (value) {
            "empty" -> PaymentModeIOS.Empty
            "Empty" -> PaymentModeIOS.Empty
            "free-trial" -> PaymentModeIOS.FreeTrial
            "FreeTrial" -> PaymentModeIOS.FreeTrial
            "pay-as-you-go" -> PaymentModeIOS.PayAsYouGo
            "PayAsYouGo" -> PaymentModeIOS.PayAsYouGo
            "pay-up-front" -> PaymentModeIOS.PayUpFront
            "PayUpFront" -> PaymentModeIOS.PayUpFront
            else -> throw IllegalArgumentException("Unknown PaymentModeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ProductQueryType(val rawValue: String) {
    InApp("in-app"),
    Subs("subs"),
    All("all");

    companion object {
        fun fromJson(value: String): ProductQueryType = when (value) {
            "in-app" -> ProductQueryType.InApp
            "InApp" -> ProductQueryType.InApp
            "subs" -> ProductQueryType.Subs
            "Subs" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            "All" -> ProductQueryType.All
            else -> throw IllegalArgumentException("Unknown ProductQueryType value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ProductType(val rawValue: String) {
    InApp("in-app"),
    Subs("subs");

    companion object {
        fun fromJson(value: String): ProductType = when (value) {
            "in-app" -> ProductType.InApp
            "InApp" -> ProductType.InApp
            "subs" -> ProductType.Subs
            "Subs" -> ProductType.Subs
            else -> throw IllegalArgumentException("Unknown ProductType value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ProductTypeIOS(val rawValue: String) {
    Consumable("consumable"),
    NonConsumable("non-consumable"),
    AutoRenewableSubscription("auto-renewable-subscription"),
    NonRenewingSubscription("non-renewing-subscription");

    companion object {
        fun fromJson(value: String): ProductTypeIOS = when (value) {
            "consumable" -> ProductTypeIOS.Consumable
            "Consumable" -> ProductTypeIOS.Consumable
            "non-consumable" -> ProductTypeIOS.NonConsumable
            "NonConsumable" -> ProductTypeIOS.NonConsumable
            "auto-renewable-subscription" -> ProductTypeIOS.AutoRenewableSubscription
            "AutoRenewableSubscription" -> ProductTypeIOS.AutoRenewableSubscription
            "non-renewing-subscription" -> ProductTypeIOS.NonRenewingSubscription
            "NonRenewingSubscription" -> ProductTypeIOS.NonRenewingSubscription
            else -> throw IllegalArgumentException("Unknown ProductTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PurchaseState(val rawValue: String) {
    Pending("pending"),
    Purchased("purchased"),
    Failed("failed"),
    Restored("restored"),
    Deferred("deferred"),
    Unknown("unknown");

    companion object {
        fun fromJson(value: String): PurchaseState = when (value) {
            "pending" -> PurchaseState.Pending
            "Pending" -> PurchaseState.Pending
            "purchased" -> PurchaseState.Purchased
            "Purchased" -> PurchaseState.Purchased
            "failed" -> PurchaseState.Failed
            "Failed" -> PurchaseState.Failed
            "restored" -> PurchaseState.Restored
            "Restored" -> PurchaseState.Restored
            "deferred" -> PurchaseState.Deferred
            "Deferred" -> PurchaseState.Deferred
            "unknown" -> PurchaseState.Unknown
            "Unknown" -> PurchaseState.Unknown
            else -> throw IllegalArgumentException("Unknown PurchaseState value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PurchaseVerificationProvider(val rawValue: String) {
    Iapkit("iapkit");

    companion object {
        fun fromJson(value: String): PurchaseVerificationProvider = when (value) {
            "iapkit" -> PurchaseVerificationProvider.Iapkit
            "Iapkit" -> PurchaseVerificationProvider.Iapkit
            else -> throw IllegalArgumentException("Unknown PurchaseVerificationProvider value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class SubscriptionOfferTypeIOS(val rawValue: String) {
    Introductory("introductory"),
    Promotional("promotional");

    companion object {
        fun fromJson(value: String): SubscriptionOfferTypeIOS = when (value) {
            "introductory" -> SubscriptionOfferTypeIOS.Introductory
            "Introductory" -> SubscriptionOfferTypeIOS.Introductory
            "promotional" -> SubscriptionOfferTypeIOS.Promotional
            "Promotional" -> SubscriptionOfferTypeIOS.Promotional
            else -> throw IllegalArgumentException("Unknown SubscriptionOfferTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class SubscriptionPeriodIOS(val rawValue: String) {
    Day("day"),
    Week("week"),
    Month("month"),
    Year("year"),
    Empty("empty");

    companion object {
        fun fromJson(value: String): SubscriptionPeriodIOS = when (value) {
            "day" -> SubscriptionPeriodIOS.Day
            "Day" -> SubscriptionPeriodIOS.Day
            "week" -> SubscriptionPeriodIOS.Week
            "Week" -> SubscriptionPeriodIOS.Week
            "month" -> SubscriptionPeriodIOS.Month
            "Month" -> SubscriptionPeriodIOS.Month
            "year" -> SubscriptionPeriodIOS.Year
            "Year" -> SubscriptionPeriodIOS.Year
            "empty" -> SubscriptionPeriodIOS.Empty
            "Empty" -> SubscriptionPeriodIOS.Empty
            else -> throw IllegalArgumentException("Unknown SubscriptionPeriodIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Replacement mode for subscription changes (Android)
 * These modes determine how the subscription replacement affects billing.
 * Available in Google Play Billing Library 8.1.0+
 */
public enum class SubscriptionReplacementModeAndroid(val rawValue: String) {
    /**
     * Unknown replacement mode. Do not use.
     */
    UnknownReplacementMode("unknown-replacement-mode"),
    /**
     * Replacement takes effect immediately, and the new expiration time will be prorated.
     */
    WithTimeProration("with-time-proration"),
    /**
     * Replacement takes effect immediately, and the billing cycle remains the same.
     */
    ChargeProratedPrice("charge-prorated-price"),
    /**
     * Replacement takes effect immediately, and the user is charged full price immediately.
     */
    ChargeFullPrice("charge-full-price"),
    /**
     * Replacement takes effect when the old plan expires.
     */
    WithoutProration("without-proration"),
    /**
     * Replacement takes effect when the old plan expires, and the user is not charged.
     */
    Deferred("deferred"),
    /**
     * Keep the existing payment schedule unchanged for the item (8.1.0+)
     */
    KeepExisting("keep-existing");

    companion object {
        fun fromJson(value: String): SubscriptionReplacementModeAndroid = when (value) {
            "unknown-replacement-mode" -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
            "UnknownReplacementMode" -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
            "with-time-proration" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "WithTimeProration" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "charge-prorated-price" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "ChargeProratedPrice" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "charge-full-price" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "ChargeFullPrice" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "without-proration" -> SubscriptionReplacementModeAndroid.WithoutProration
            "WithoutProration" -> SubscriptionReplacementModeAndroid.WithoutProration
            "deferred" -> SubscriptionReplacementModeAndroid.Deferred
            "Deferred" -> SubscriptionReplacementModeAndroid.Deferred
            "keep-existing" -> SubscriptionReplacementModeAndroid.KeepExisting
            "KeepExisting" -> SubscriptionReplacementModeAndroid.KeepExisting
            else -> throw IllegalArgumentException("Unknown SubscriptionReplacementModeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

// MARK: - Interfaces

public interface ProductCommon {
    val currency: String
    val debugDescription: String?
    val description: String
    val displayName: String?
    val displayPrice: String
    val id: String
    val platform: IapPlatform
    val price: Double?
    val title: String
    val type: ProductType
}

public interface PurchaseCommon {
    /**
     * The current plan identifier. This is:
     * - On Android: the basePlanId (e.g., "premium", "premium-year")
     * - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
     * This provides a unified way to identify which specific plan/tier the user is subscribed to.
     */
    val currentPlanId: String?
    val id: String
    val ids: List<String>?
    val isAutoRenewing: Boolean
    val platform: IapPlatform
    val productId: String
    val purchaseState: PurchaseState
    /**
     * Unified purchase token (iOS JWS, Android purchaseToken)
     */
    val purchaseToken: String?
    val quantity: Int
    /**
     * Store where purchase was made
     */
    val store: IapStore
    val transactionDate: Double
}

// MARK: - Objects

public data class ActiveSubscription(
    val autoRenewingAndroid: Boolean? = null,
    val basePlanIdAndroid: String? = null,
    /**
     * The current plan identifier. This is:
     * - On Android: the basePlanId (e.g., "premium", "premium-year")
     * - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
     * This provides a unified way to identify which specific plan/tier the user is subscribed to.
     */
    val currentPlanId: String? = null,
    val daysUntilExpirationIOS: Double? = null,
    val environmentIOS: String? = null,
    val expirationDateIOS: Double? = null,
    val isActive: Boolean,
    val productId: String,
    val purchaseToken: String? = null,
    /**
     * Required for subscription upgrade/downgrade on Android
     */
    val purchaseTokenAndroid: String? = null,
    /**
     * Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,
     * pending upgrades/downgrades, and auto-renewal preferences.
     */
    val renewalInfoIOS: RenewalInfoIOS? = null,
    val transactionDate: Double,
    val transactionId: String,
    /**
     * @deprecated iOS only - use daysUntilExpirationIOS instead.
     * Whether the subscription will expire soon (within 7 days).
     * Consider using daysUntilExpirationIOS for more precise control.
     */
    val willExpireSoon: Boolean? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ActiveSubscription {
            return ActiveSubscription(
                autoRenewingAndroid = json["autoRenewingAndroid"] as Boolean?,
                basePlanIdAndroid = json["basePlanIdAndroid"] as String?,
                currentPlanId = json["currentPlanId"] as String?,
                daysUntilExpirationIOS = (json["daysUntilExpirationIOS"] as Number?)?.toDouble(),
                environmentIOS = json["environmentIOS"] as String?,
                expirationDateIOS = (json["expirationDateIOS"] as Number?)?.toDouble(),
                isActive = json["isActive"] as Boolean,
                productId = json["productId"] as String,
                purchaseToken = json["purchaseToken"] as String?,
                purchaseTokenAndroid = json["purchaseTokenAndroid"] as String?,
                renewalInfoIOS = (json["renewalInfoIOS"] as Map<String, Any?>?)?.let { RenewalInfoIOS.fromJson(it) },
                transactionDate = (json["transactionDate"] as Number).toDouble(),
                transactionId = json["transactionId"] as String,
                willExpireSoon = json["willExpireSoon"] as Boolean?,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ActiveSubscription",
        "autoRenewingAndroid" to autoRenewingAndroid,
        "basePlanIdAndroid" to basePlanIdAndroid,
        "currentPlanId" to currentPlanId,
        "daysUntilExpirationIOS" to daysUntilExpirationIOS,
        "environmentIOS" to environmentIOS,
        "expirationDateIOS" to expirationDateIOS,
        "isActive" to isActive,
        "productId" to productId,
        "purchaseToken" to purchaseToken,
        "purchaseTokenAndroid" to purchaseTokenAndroid,
        "renewalInfoIOS" to renewalInfoIOS?.toJson(),
        "transactionDate" to transactionDate,
        "transactionId" to transactionId,
        "willExpireSoon" to willExpireSoon,
    )
}

public data class AppTransaction(
    val appId: Double,
    val appTransactionId: String? = null,
    val appVersion: String,
    val appVersionId: Double,
    val bundleId: String,
    val deviceVerification: String,
    val deviceVerificationNonce: String,
    val environment: String,
    val originalAppVersion: String,
    val originalPlatform: String? = null,
    val originalPurchaseDate: Double,
    val preorderDate: Double? = null,
    val signedDate: Double
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): AppTransaction {
            return AppTransaction(
                appId = (json["appId"] as Number).toDouble(),
                appTransactionId = json["appTransactionId"] as String?,
                appVersion = json["appVersion"] as String,
                appVersionId = (json["appVersionId"] as Number).toDouble(),
                bundleId = json["bundleId"] as String,
                deviceVerification = json["deviceVerification"] as String,
                deviceVerificationNonce = json["deviceVerificationNonce"] as String,
                environment = json["environment"] as String,
                originalAppVersion = json["originalAppVersion"] as String,
                originalPlatform = json["originalPlatform"] as String?,
                originalPurchaseDate = (json["originalPurchaseDate"] as Number).toDouble(),
                preorderDate = (json["preorderDate"] as Number?)?.toDouble(),
                signedDate = (json["signedDate"] as Number).toDouble(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "AppTransaction",
        "appId" to appId,
        "appTransactionId" to appTransactionId,
        "appVersion" to appVersion,
        "appVersionId" to appVersionId,
        "bundleId" to bundleId,
        "deviceVerification" to deviceVerification,
        "deviceVerificationNonce" to deviceVerificationNonce,
        "environment" to environment,
        "originalAppVersion" to originalAppVersion,
        "originalPlatform" to originalPlatform,
        "originalPurchaseDate" to originalPurchaseDate,
        "preorderDate" to preorderDate,
        "signedDate" to signedDate,
    )
}

/**
 * Result of checking billing program availability (Android)
 * Available in Google Play Billing Library 8.2.0+
 */
public data class BillingProgramAvailabilityResultAndroid(
    /**
     * The billing program that was checked
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * Whether the billing program is available for the user
     */
    val isAvailable: Boolean
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BillingProgramAvailabilityResultAndroid {
            return BillingProgramAvailabilityResultAndroid(
                billingProgram = BillingProgramAndroid.fromJson(json["billingProgram"] as String),
                isAvailable = json["isAvailable"] as Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BillingProgramAvailabilityResultAndroid",
        "billingProgram" to billingProgram.toJson(),
        "isAvailable" to isAvailable,
    )
}

/**
 * Reporting details for transactions made outside of Google Play Billing (Android)
 * Contains the external transaction token needed for reporting
 * Available in Google Play Billing Library 8.2.0+
 */
public data class BillingProgramReportingDetailsAndroid(
    /**
     * The billing program that the reporting details are associated with
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * External transaction token used to report transactions made outside of Google Play Billing.
     * This token must be used when reporting the external transaction to Google.
     */
    val externalTransactionToken: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BillingProgramReportingDetailsAndroid {
            return BillingProgramReportingDetailsAndroid(
                billingProgram = BillingProgramAndroid.fromJson(json["billingProgram"] as String),
                externalTransactionToken = json["externalTransactionToken"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BillingProgramReportingDetailsAndroid",
        "billingProgram" to billingProgram.toJson(),
        "externalTransactionToken" to externalTransactionToken,
    )
}

/**
 * Discount amount details for one-time purchase offers (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class DiscountAmountAndroid(
    /**
     * Discount amount in micro-units (1,000,000 = 1 unit of currency)
     */
    val discountAmountMicros: String,
    /**
     * Formatted discount amount with currency sign (e.g., "$4.99")
     */
    val formattedDiscountAmount: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountAmountAndroid {
            return DiscountAmountAndroid(
                discountAmountMicros = json["discountAmountMicros"] as String,
                formattedDiscountAmount = json["formattedDiscountAmount"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountAmountAndroid",
        "discountAmountMicros" to discountAmountMicros,
        "formattedDiscountAmount" to formattedDiscountAmount,
    )
}

/**
 * Discount display information for one-time purchase offers (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class DiscountDisplayInfoAndroid(
    /**
     * Absolute discount amount details
     * Only returned for fixed amount discounts
     */
    val discountAmount: DiscountAmountAndroid? = null,
    /**
     * Percentage discount (e.g., 33 for 33% off)
     * Only returned for percentage-based discounts
     */
    val percentageDiscount: Int? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountDisplayInfoAndroid {
            return DiscountDisplayInfoAndroid(
                discountAmount = (json["discountAmount"] as Map<String, Any?>?)?.let { DiscountAmountAndroid.fromJson(it) },
                percentageDiscount = (json["percentageDiscount"] as Number?)?.toInt(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountDisplayInfoAndroid",
        "discountAmount" to discountAmount?.toJson(),
        "percentageDiscount" to percentageDiscount,
    )
}

public data class DiscountIOS(
    val identifier: String,
    val localizedPrice: String? = null,
    val numberOfPeriods: Int,
    val paymentMode: PaymentModeIOS,
    val price: String,
    val priceAmount: Double,
    val subscriptionPeriod: String,
    val type: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountIOS {
            return DiscountIOS(
                identifier = json["identifier"] as String,
                localizedPrice = json["localizedPrice"] as String?,
                numberOfPeriods = (json["numberOfPeriods"] as Number).toInt(),
                paymentMode = (json["paymentMode"] as String?)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                price = json["price"] as String,
                priceAmount = (json["priceAmount"] as Number).toDouble(),
                subscriptionPeriod = json["subscriptionPeriod"] as String,
                type = json["type"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountIOS",
        "identifier" to identifier,
        "localizedPrice" to localizedPrice,
        "numberOfPeriods" to numberOfPeriods,
        "paymentMode" to paymentMode.toJson(),
        "price" to price,
        "priceAmount" to priceAmount,
        "subscriptionPeriod" to subscriptionPeriod,
        "type" to type,
    )
}

public data class DiscountOfferIOS(
    /**
     * Discount identifier
     */
    val identifier: String,
    /**
     * Key identifier for validation
     */
    val keyIdentifier: String,
    /**
     * Cryptographic nonce
     */
    val nonce: String,
    /**
     * Signature for validation
     */
    val signature: String,
    /**
     * Timestamp of discount offer
     */
    val timestamp: Double
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountOfferIOS {
            return DiscountOfferIOS(
                identifier = json["identifier"] as String,
                keyIdentifier = json["keyIdentifier"] as String,
                nonce = json["nonce"] as String,
                signature = json["signature"] as String,
                timestamp = (json["timestamp"] as Number).toDouble(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountOfferIOS",
        "identifier" to identifier,
        "keyIdentifier" to keyIdentifier,
        "nonce" to nonce,
        "signature" to signature,
        "timestamp" to timestamp,
    )
}

public data class EntitlementIOS(
    val jsonRepresentation: String,
    val sku: String,
    val transactionId: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): EntitlementIOS {
            return EntitlementIOS(
                jsonRepresentation = json["jsonRepresentation"] as String,
                sku = json["sku"] as String,
                transactionId = json["transactionId"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "EntitlementIOS",
        "jsonRepresentation" to jsonRepresentation,
        "sku" to sku,
        "transactionId" to transactionId,
    )
}

/**
 * External offer availability result (Android)
 * @deprecated Use BillingProgramAvailabilityResultAndroid with isBillingProgramAvailableAsync instead
 * Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
 */
public data class ExternalOfferAvailabilityResultAndroid(
    /**
     * Whether external offers are available for the user
     */
    val isAvailable: Boolean
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalOfferAvailabilityResultAndroid {
            return ExternalOfferAvailabilityResultAndroid(
                isAvailable = json["isAvailable"] as Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalOfferAvailabilityResultAndroid",
        "isAvailable" to isAvailable,
    )
}

/**
 * External offer reporting details (Android)
 * @deprecated Use BillingProgramReportingDetailsAndroid with createBillingProgramReportingDetailsAsync instead
 * Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
 */
public data class ExternalOfferReportingDetailsAndroid(
    /**
     * External transaction token for reporting external offer transactions
     */
    val externalTransactionToken: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalOfferReportingDetailsAndroid {
            return ExternalOfferReportingDetailsAndroid(
                externalTransactionToken = json["externalTransactionToken"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalOfferReportingDetailsAndroid",
        "externalTransactionToken" to externalTransactionToken,
    )
}

/**
 * Result of presenting an external purchase link (iOS 18.2+)
 */
public data class ExternalPurchaseLinkResultIOS(
    /**
     * Optional error message if the presentation failed
     */
    val error: String? = null,
    /**
     * Whether the user completed the external purchase flow
     */
    val success: Boolean
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalPurchaseLinkResultIOS {
            return ExternalPurchaseLinkResultIOS(
                error = json["error"] as String?,
                success = json["success"] as Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalPurchaseLinkResultIOS",
        "error" to error,
        "success" to success,
    )
}

/**
 * Result of presenting external purchase notice sheet (iOS 18.2+)
 */
public data class ExternalPurchaseNoticeResultIOS(
    /**
     * Optional error message if the presentation failed
     */
    val error: String? = null,
    /**
     * Notice result indicating user action
     */
    val result: ExternalPurchaseNoticeAction
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalPurchaseNoticeResultIOS {
            return ExternalPurchaseNoticeResultIOS(
                error = json["error"] as String?,
                result = ExternalPurchaseNoticeAction.fromJson(json["result"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalPurchaseNoticeResultIOS",
        "error" to error,
        "result" to result.toJson(),
    )
}

public sealed interface FetchProductsResult

public data class FetchProductsResultAll(val value: List<ProductOrSubscription>?) : FetchProductsResult

public data class FetchProductsResultProducts(val value: List<Product>?) : FetchProductsResult

public data class FetchProductsResultSubscriptions(val value: List<ProductSubscription>?) : FetchProductsResult

/**
 * Limited quantity information for one-time purchase offers (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class LimitedQuantityInfoAndroid(
    /**
     * Maximum quantity a user can purchase
     */
    val maximumQuantity: Int,
    /**
     * Remaining quantity the user can still purchase
     */
    val remainingQuantity: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): LimitedQuantityInfoAndroid {
            return LimitedQuantityInfoAndroid(
                maximumQuantity = (json["maximumQuantity"] as Number).toInt(),
                remainingQuantity = (json["remainingQuantity"] as Number).toInt(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "LimitedQuantityInfoAndroid",
        "maximumQuantity" to maximumQuantity,
        "remainingQuantity" to remainingQuantity,
    )
}

/**
 * Pre-order details for one-time purchase products (Android)
 * Available in Google Play Billing Library 8.1.0+
 */
public data class PreorderDetailsAndroid(
    /**
     * Pre-order presale end time in milliseconds since epoch.
     * This is when the presale period ends and the product will be released.
     */
    val preorderPresaleEndTimeMillis: String,
    /**
     * Pre-order release time in milliseconds since epoch.
     * This is when the product will be available to users who pre-ordered.
     */
    val preorderReleaseTimeMillis: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PreorderDetailsAndroid {
            return PreorderDetailsAndroid(
                preorderPresaleEndTimeMillis = json["preorderPresaleEndTimeMillis"] as String,
                preorderReleaseTimeMillis = json["preorderReleaseTimeMillis"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PreorderDetailsAndroid",
        "preorderPresaleEndTimeMillis" to preorderPresaleEndTimeMillis,
        "preorderReleaseTimeMillis" to preorderReleaseTimeMillis,
    )
}

public data class PricingPhaseAndroid(
    val billingCycleCount: Int,
    val billingPeriod: String,
    val formattedPrice: String,
    val priceAmountMicros: String,
    val priceCurrencyCode: String,
    val recurrenceMode: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PricingPhaseAndroid {
            return PricingPhaseAndroid(
                billingCycleCount = (json["billingCycleCount"] as Number).toInt(),
                billingPeriod = json["billingPeriod"] as String,
                formattedPrice = json["formattedPrice"] as String,
                priceAmountMicros = json["priceAmountMicros"] as String,
                priceCurrencyCode = json["priceCurrencyCode"] as String,
                recurrenceMode = (json["recurrenceMode"] as Number).toInt(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PricingPhaseAndroid",
        "billingCycleCount" to billingCycleCount,
        "billingPeriod" to billingPeriod,
        "formattedPrice" to formattedPrice,
        "priceAmountMicros" to priceAmountMicros,
        "priceCurrencyCode" to priceCurrencyCode,
        "recurrenceMode" to recurrenceMode,
    )
}

public data class PricingPhasesAndroid(
    val pricingPhaseList: List<PricingPhaseAndroid>
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PricingPhasesAndroid {
            return PricingPhasesAndroid(
                pricingPhaseList = (json["pricingPhaseList"] as List<*>).map { PricingPhaseAndroid.fromJson((it as Map<String, Any?>)) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PricingPhasesAndroid",
        "pricingPhaseList" to pricingPhaseList.map { it.toJson() },
    )
}

public data class ProductAndroid(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
    /**
     * One-time purchase offer details including discounts (Android)
     * Returns all eligible offers. Available in Google Play Billing Library 7.0+
     */
    val oneTimePurchaseOfferDetailsAndroid: List<ProductAndroidOneTimePurchaseOfferDetail>? = null,
    override val platform: IapPlatform = IapPlatform.Android,
    override val price: Double? = null,
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>? = null,
    override val title: String,
    override val type: ProductType = ProductType.InApp
) : ProductCommon, Product {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductAndroid {
            return ProductAndroid(
                currency = json["currency"] as String,
                debugDescription = json["debugDescription"] as String?,
                description = json["description"] as String,
                displayName = json["displayName"] as String?,
                displayPrice = json["displayPrice"] as String,
                id = json["id"] as String,
                nameAndroid = json["nameAndroid"] as String,
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as List<*>?)?.map { ProductAndroidOneTimePurchaseOfferDetail.fromJson((it as Map<String, Any?>)) },
                platform = IapPlatform.fromJson(json["platform"] as String),
                price = (json["price"] as Number?)?.toDouble(),
                subscriptionOfferDetailsAndroid = (json["subscriptionOfferDetailsAndroid"] as List<*>?)?.map { ProductSubscriptionAndroidOfferDetails.fromJson((it as Map<String, Any?>)) },
                title = json["title"] as String,
                type = ProductType.fromJson(json["type"] as String),
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductAndroid",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "nameAndroid" to nameAndroid,
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.map { it.toJson() },
        "platform" to platform.toJson(),
        "price" to price,
        "subscriptionOfferDetailsAndroid" to subscriptionOfferDetailsAndroid?.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

/**
 * One-time purchase offer details (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class ProductAndroidOneTimePurchaseOfferDetail(
    /**
     * Discount display information
     * Only available for discounted offers
     */
    val discountDisplayInfo: DiscountDisplayInfoAndroid? = null,
    val formattedPrice: String,
    /**
     * Full (non-discounted) price in micro-units
     * Only available for discounted offers
     */
    val fullPriceMicros: String? = null,
    /**
     * Limited quantity information
     */
    val limitedQuantityInfo: LimitedQuantityInfoAndroid? = null,
    /**
     * Offer ID
     */
    val offerId: String? = null,
    /**
     * List of offer tags
     */
    val offerTags: List<String>,
    /**
     * Offer token for use in BillingFlowParams when purchasing
     */
    val offerToken: String,
    /**
     * Pre-order details for products available for pre-order
     * Available in Google Play Billing Library 8.1.0+
     */
    val preorderDetailsAndroid: PreorderDetailsAndroid? = null,
    val priceAmountMicros: String,
    val priceCurrencyCode: String,
    /**
     * Rental details for rental offers
     */
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    /**
     * Valid time window for the offer
     */
    val validTimeWindow: ValidTimeWindowAndroid? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductAndroidOneTimePurchaseOfferDetail {
            return ProductAndroidOneTimePurchaseOfferDetail(
                discountDisplayInfo = (json["discountDisplayInfo"] as Map<String, Any?>?)?.let { DiscountDisplayInfoAndroid.fromJson(it) },
                formattedPrice = json["formattedPrice"] as String,
                fullPriceMicros = json["fullPriceMicros"] as String?,
                limitedQuantityInfo = (json["limitedQuantityInfo"] as Map<String, Any?>?)?.let { LimitedQuantityInfoAndroid.fromJson(it) },
                offerId = json["offerId"] as String?,
                offerTags = (json["offerTags"] as List<*>).map { it as String },
                offerToken = json["offerToken"] as String,
                preorderDetailsAndroid = (json["preorderDetailsAndroid"] as Map<String, Any?>?)?.let { PreorderDetailsAndroid.fromJson(it) },
                priceAmountMicros = json["priceAmountMicros"] as String,
                priceCurrencyCode = json["priceCurrencyCode"] as String,
                rentalDetailsAndroid = (json["rentalDetailsAndroid"] as Map<String, Any?>?)?.let { RentalDetailsAndroid.fromJson(it) },
                validTimeWindow = (json["validTimeWindow"] as Map<String, Any?>?)?.let { ValidTimeWindowAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductAndroidOneTimePurchaseOfferDetail",
        "discountDisplayInfo" to discountDisplayInfo?.toJson(),
        "formattedPrice" to formattedPrice,
        "fullPriceMicros" to fullPriceMicros,
        "limitedQuantityInfo" to limitedQuantityInfo?.toJson(),
        "offerId" to offerId,
        "offerTags" to offerTags.map { it },
        "offerToken" to offerToken,
        "preorderDetailsAndroid" to preorderDetailsAndroid?.toJson(),
        "priceAmountMicros" to priceAmountMicros,
        "priceCurrencyCode" to priceCurrencyCode,
        "rentalDetailsAndroid" to rentalDetailsAndroid?.toJson(),
        "validTimeWindow" to validTimeWindow?.toJson(),
    )
}

public data class ProductIOS(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    override val displayName: String? = null,
    val displayNameIOS: String,
    override val displayPrice: String,
    override val id: String,
    val isFamilyShareableIOS: Boolean,
    val jsonRepresentationIOS: String,
    override val platform: IapPlatform = IapPlatform.Ios,
    override val price: Double? = null,
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    override val title: String,
    override val type: ProductType = ProductType.InApp,
    val typeIOS: ProductTypeIOS
) : ProductCommon, Product {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductIOS {
            return ProductIOS(
                currency = json["currency"] as String,
                debugDescription = json["debugDescription"] as String?,
                description = json["description"] as String,
                displayName = json["displayName"] as String?,
                displayNameIOS = json["displayNameIOS"] as String,
                displayPrice = json["displayPrice"] as String,
                id = json["id"] as String,
                isFamilyShareableIOS = json["isFamilyShareableIOS"] as Boolean,
                jsonRepresentationIOS = json["jsonRepresentationIOS"] as String,
                platform = IapPlatform.fromJson(json["platform"] as String),
                price = (json["price"] as Number?)?.toDouble(),
                subscriptionInfoIOS = (json["subscriptionInfoIOS"] as Map<String, Any?>?)?.let { SubscriptionInfoIOS.fromJson(it) },
                title = json["title"] as String,
                type = ProductType.fromJson(json["type"] as String),
                typeIOS = ProductTypeIOS.fromJson(json["typeIOS"] as String),
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductIOS",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "displayName" to displayName,
        "displayNameIOS" to displayNameIOS,
        "displayPrice" to displayPrice,
        "id" to id,
        "isFamilyShareableIOS" to isFamilyShareableIOS,
        "jsonRepresentationIOS" to jsonRepresentationIOS,
        "platform" to platform.toJson(),
        "price" to price,
        "subscriptionInfoIOS" to subscriptionInfoIOS?.toJson(),
        "title" to title,
        "type" to type.toJson(),
        "typeIOS" to typeIOS.toJson(),
    )
}

public data class ProductSubscriptionAndroid(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
    /**
     * One-time purchase offer details including discounts (Android)
     * Returns all eligible offers. Available in Google Play Billing Library 7.0+
     */
    val oneTimePurchaseOfferDetailsAndroid: List<ProductAndroidOneTimePurchaseOfferDetail>? = null,
    override val platform: IapPlatform = IapPlatform.Android,
    override val price: Double? = null,
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>,
    override val title: String,
    override val type: ProductType = ProductType.Subs
) : ProductCommon, ProductSubscription {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscriptionAndroid {
            return ProductSubscriptionAndroid(
                currency = json["currency"] as String,
                debugDescription = json["debugDescription"] as String?,
                description = json["description"] as String,
                displayName = json["displayName"] as String?,
                displayPrice = json["displayPrice"] as String,
                id = json["id"] as String,
                nameAndroid = json["nameAndroid"] as String,
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as List<*>?)?.map { ProductAndroidOneTimePurchaseOfferDetail.fromJson((it as Map<String, Any?>)) },
                platform = IapPlatform.fromJson(json["platform"] as String),
                price = (json["price"] as Number?)?.toDouble(),
                subscriptionOfferDetailsAndroid = (json["subscriptionOfferDetailsAndroid"] as List<*>).map { ProductSubscriptionAndroidOfferDetails.fromJson((it as Map<String, Any?>)) },
                title = json["title"] as String,
                type = ProductType.fromJson(json["type"] as String),
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductSubscriptionAndroid",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "nameAndroid" to nameAndroid,
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.map { it.toJson() },
        "platform" to platform.toJson(),
        "price" to price,
        "subscriptionOfferDetailsAndroid" to subscriptionOfferDetailsAndroid.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

public data class ProductSubscriptionAndroidOfferDetails(
    val basePlanId: String,
    val offerId: String? = null,
    val offerTags: List<String>,
    val offerToken: String,
    val pricingPhases: PricingPhasesAndroid
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscriptionAndroidOfferDetails {
            return ProductSubscriptionAndroidOfferDetails(
                basePlanId = json["basePlanId"] as String,
                offerId = json["offerId"] as String?,
                offerTags = (json["offerTags"] as List<*>).map { it as String },
                offerToken = json["offerToken"] as String,
                pricingPhases = PricingPhasesAndroid.fromJson((json["pricingPhases"] as Map<String, Any?>)),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductSubscriptionAndroidOfferDetails",
        "basePlanId" to basePlanId,
        "offerId" to offerId,
        "offerTags" to offerTags.map { it },
        "offerToken" to offerToken,
        "pricingPhases" to pricingPhases.toJson(),
    )
}

public data class ProductSubscriptionIOS(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    val discountsIOS: List<DiscountIOS>? = null,
    override val displayName: String? = null,
    val displayNameIOS: String,
    override val displayPrice: String,
    override val id: String,
    val introductoryPriceAsAmountIOS: String? = null,
    val introductoryPriceIOS: String? = null,
    val introductoryPriceNumberOfPeriodsIOS: String? = null,
    val introductoryPricePaymentModeIOS: PaymentModeIOS,
    val introductoryPriceSubscriptionPeriodIOS: SubscriptionPeriodIOS? = null,
    val isFamilyShareableIOS: Boolean,
    val jsonRepresentationIOS: String,
    override val platform: IapPlatform = IapPlatform.Ios,
    override val price: Double? = null,
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    val subscriptionPeriodNumberIOS: String? = null,
    val subscriptionPeriodUnitIOS: SubscriptionPeriodIOS? = null,
    override val title: String,
    override val type: ProductType = ProductType.Subs,
    val typeIOS: ProductTypeIOS
) : ProductCommon, ProductSubscription {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscriptionIOS {
            return ProductSubscriptionIOS(
                currency = json["currency"] as String,
                debugDescription = json["debugDescription"] as String?,
                description = json["description"] as String,
                discountsIOS = (json["discountsIOS"] as List<*>?)?.map { DiscountIOS.fromJson((it as Map<String, Any?>)) },
                displayName = json["displayName"] as String?,
                displayNameIOS = json["displayNameIOS"] as String,
                displayPrice = json["displayPrice"] as String,
                id = json["id"] as String,
                introductoryPriceAsAmountIOS = json["introductoryPriceAsAmountIOS"] as String?,
                introductoryPriceIOS = json["introductoryPriceIOS"] as String?,
                introductoryPriceNumberOfPeriodsIOS = json["introductoryPriceNumberOfPeriodsIOS"] as String?,
                introductoryPricePaymentModeIOS = (json["introductoryPricePaymentModeIOS"] as String?)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                introductoryPriceSubscriptionPeriodIOS = (json["introductoryPriceSubscriptionPeriodIOS"] as String?)?.let { SubscriptionPeriodIOS.fromJson(it) },
                isFamilyShareableIOS = json["isFamilyShareableIOS"] as Boolean,
                jsonRepresentationIOS = json["jsonRepresentationIOS"] as String,
                platform = IapPlatform.fromJson(json["platform"] as String),
                price = (json["price"] as Number?)?.toDouble(),
                subscriptionInfoIOS = (json["subscriptionInfoIOS"] as Map<String, Any?>?)?.let { SubscriptionInfoIOS.fromJson(it) },
                subscriptionPeriodNumberIOS = json["subscriptionPeriodNumberIOS"] as String?,
                subscriptionPeriodUnitIOS = (json["subscriptionPeriodUnitIOS"] as String?)?.let { SubscriptionPeriodIOS.fromJson(it) },
                title = json["title"] as String,
                type = ProductType.fromJson(json["type"] as String),
                typeIOS = ProductTypeIOS.fromJson(json["typeIOS"] as String),
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductSubscriptionIOS",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "discountsIOS" to discountsIOS?.map { it.toJson() },
        "displayName" to displayName,
        "displayNameIOS" to displayNameIOS,
        "displayPrice" to displayPrice,
        "id" to id,
        "introductoryPriceAsAmountIOS" to introductoryPriceAsAmountIOS,
        "introductoryPriceIOS" to introductoryPriceIOS,
        "introductoryPriceNumberOfPeriodsIOS" to introductoryPriceNumberOfPeriodsIOS,
        "introductoryPricePaymentModeIOS" to introductoryPricePaymentModeIOS.toJson(),
        "introductoryPriceSubscriptionPeriodIOS" to introductoryPriceSubscriptionPeriodIOS?.toJson(),
        "isFamilyShareableIOS" to isFamilyShareableIOS,
        "jsonRepresentationIOS" to jsonRepresentationIOS,
        "platform" to platform.toJson(),
        "price" to price,
        "subscriptionInfoIOS" to subscriptionInfoIOS?.toJson(),
        "subscriptionPeriodNumberIOS" to subscriptionPeriodNumberIOS,
        "subscriptionPeriodUnitIOS" to subscriptionPeriodUnitIOS?.toJson(),
        "title" to title,
        "type" to type.toJson(),
        "typeIOS" to typeIOS.toJson(),
    )
}

public data class PurchaseAndroid(
    val autoRenewingAndroid: Boolean? = null,
    override val currentPlanId: String? = null,
    val dataAndroid: String? = null,
    val developerPayloadAndroid: String? = null,
    override val id: String,
    override val ids: List<String>? = null,
    val isAcknowledgedAndroid: Boolean? = null,
    override val isAutoRenewing: Boolean,
    /**
     * Whether the subscription is suspended (Android)
     * A suspended subscription means the user's payment method failed and they need to fix it.
     * Users should be directed to the subscription center to resolve the issue.
     * Do NOT grant entitlements for suspended subscriptions.
     * Available in Google Play Billing Library 8.1.0+
     */
    val isSuspendedAndroid: Boolean? = null,
    val obfuscatedAccountIdAndroid: String? = null,
    val obfuscatedProfileIdAndroid: String? = null,
    val packageNameAndroid: String? = null,
    override val platform: IapPlatform,
    override val productId: String,
    override val purchaseState: PurchaseState,
    override val purchaseToken: String? = null,
    override val quantity: Int,
    val signatureAndroid: String? = null,
    /**
     * Store where purchase was made
     */
    override val store: IapStore,
    override val transactionDate: Double,
    val transactionId: String? = null
) : PurchaseCommon, Purchase {

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseAndroid {
            return PurchaseAndroid(
                autoRenewingAndroid = json["autoRenewingAndroid"] as Boolean?,
                currentPlanId = json["currentPlanId"] as String?,
                dataAndroid = json["dataAndroid"] as String?,
                developerPayloadAndroid = json["developerPayloadAndroid"] as String?,
                id = json["id"] as String,
                ids = (json["ids"] as List<*>?)?.map { it as String },
                isAcknowledgedAndroid = json["isAcknowledgedAndroid"] as Boolean?,
                isAutoRenewing = json["isAutoRenewing"] as Boolean,
                isSuspendedAndroid = json["isSuspendedAndroid"] as Boolean?,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as String?,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as String?,
                packageNameAndroid = json["packageNameAndroid"] as String?,
                platform = IapPlatform.fromJson(json["platform"] as String),
                productId = json["productId"] as String,
                purchaseState = PurchaseState.fromJson(json["purchaseState"] as String),
                purchaseToken = json["purchaseToken"] as String?,
                quantity = (json["quantity"] as Number).toInt(),
                signatureAndroid = json["signatureAndroid"] as String?,
                store = IapStore.fromJson(json["store"] as String),
                transactionDate = (json["transactionDate"] as Number).toDouble(),
                transactionId = json["transactionId"] as String?,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PurchaseAndroid",
        "autoRenewingAndroid" to autoRenewingAndroid,
        "currentPlanId" to currentPlanId,
        "dataAndroid" to dataAndroid,
        "developerPayloadAndroid" to developerPayloadAndroid,
        "id" to id,
        "ids" to ids?.map { it },
        "isAcknowledgedAndroid" to isAcknowledgedAndroid,
        "isAutoRenewing" to isAutoRenewing,
        "isSuspendedAndroid" to isSuspendedAndroid,
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "packageNameAndroid" to packageNameAndroid,
        "platform" to platform.toJson(),
        "productId" to productId,
        "purchaseState" to purchaseState.toJson(),
        "purchaseToken" to purchaseToken,
        "quantity" to quantity,
        "signatureAndroid" to signatureAndroid,
        "store" to store.toJson(),
        "transactionDate" to transactionDate,
        "transactionId" to transactionId,
    )
}

public data class PurchaseError(
    val code: ErrorCode,
    val message: String,
    val productId: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseError {
            return PurchaseError(
                code = ErrorCode.fromJson(json["code"] as String),
                message = json["message"] as String,
                productId = json["productId"] as String?,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PurchaseError",
        "code" to code.toJson(),
        "message" to message,
        "productId" to productId,
    )
}

public data class PurchaseIOS(
    val appAccountToken: String? = null,
    val appBundleIdIOS: String? = null,
    val countryCodeIOS: String? = null,
    val currencyCodeIOS: String? = null,
    val currencySymbolIOS: String? = null,
    override val currentPlanId: String? = null,
    val environmentIOS: String? = null,
    val expirationDateIOS: Double? = null,
    override val id: String,
    override val ids: List<String>? = null,
    override val isAutoRenewing: Boolean,
    val isUpgradedIOS: Boolean? = null,
    val offerIOS: PurchaseOfferIOS? = null,
    val originalTransactionDateIOS: Double? = null,
    val originalTransactionIdentifierIOS: String? = null,
    val ownershipTypeIOS: String? = null,
    override val platform: IapPlatform,
    override val productId: String,
    override val purchaseState: PurchaseState,
    override val purchaseToken: String? = null,
    override val quantity: Int,
    val quantityIOS: Int? = null,
    val reasonIOS: String? = null,
    val reasonStringRepresentationIOS: String? = null,
    val renewalInfoIOS: RenewalInfoIOS? = null,
    val revocationDateIOS: Double? = null,
    val revocationReasonIOS: String? = null,
    /**
     * Store where purchase was made
     */
    override val store: IapStore,
    val storefrontCountryCodeIOS: String? = null,
    val subscriptionGroupIdIOS: String? = null,
    override val transactionDate: Double,
    val transactionId: String,
    val transactionReasonIOS: String? = null,
    val webOrderLineItemIdIOS: String? = null
) : PurchaseCommon, Purchase {

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseIOS {
            return PurchaseIOS(
                appAccountToken = json["appAccountToken"] as String?,
                appBundleIdIOS = json["appBundleIdIOS"] as String?,
                countryCodeIOS = json["countryCodeIOS"] as String?,
                currencyCodeIOS = json["currencyCodeIOS"] as String?,
                currencySymbolIOS = json["currencySymbolIOS"] as String?,
                currentPlanId = json["currentPlanId"] as String?,
                environmentIOS = json["environmentIOS"] as String?,
                expirationDateIOS = (json["expirationDateIOS"] as Number?)?.toDouble(),
                id = json["id"] as String,
                ids = (json["ids"] as List<*>?)?.map { it as String },
                isAutoRenewing = json["isAutoRenewing"] as Boolean,
                isUpgradedIOS = json["isUpgradedIOS"] as Boolean?,
                offerIOS = (json["offerIOS"] as Map<String, Any?>?)?.let { PurchaseOfferIOS.fromJson(it) },
                originalTransactionDateIOS = (json["originalTransactionDateIOS"] as Number?)?.toDouble(),
                originalTransactionIdentifierIOS = json["originalTransactionIdentifierIOS"] as String?,
                ownershipTypeIOS = json["ownershipTypeIOS"] as String?,
                platform = IapPlatform.fromJson(json["platform"] as String),
                productId = json["productId"] as String,
                purchaseState = PurchaseState.fromJson(json["purchaseState"] as String),
                purchaseToken = json["purchaseToken"] as String?,
                quantity = (json["quantity"] as Number).toInt(),
                quantityIOS = (json["quantityIOS"] as Number?)?.toInt(),
                reasonIOS = json["reasonIOS"] as String?,
                reasonStringRepresentationIOS = json["reasonStringRepresentationIOS"] as String?,
                renewalInfoIOS = (json["renewalInfoIOS"] as Map<String, Any?>?)?.let { RenewalInfoIOS.fromJson(it) },
                revocationDateIOS = (json["revocationDateIOS"] as Number?)?.toDouble(),
                revocationReasonIOS = json["revocationReasonIOS"] as String?,
                store = IapStore.fromJson(json["store"] as String),
                storefrontCountryCodeIOS = json["storefrontCountryCodeIOS"] as String?,
                subscriptionGroupIdIOS = json["subscriptionGroupIdIOS"] as String?,
                transactionDate = (json["transactionDate"] as Number).toDouble(),
                transactionId = json["transactionId"] as String,
                transactionReasonIOS = json["transactionReasonIOS"] as String?,
                webOrderLineItemIdIOS = json["webOrderLineItemIdIOS"] as String?,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PurchaseIOS",
        "appAccountToken" to appAccountToken,
        "appBundleIdIOS" to appBundleIdIOS,
        "countryCodeIOS" to countryCodeIOS,
        "currencyCodeIOS" to currencyCodeIOS,
        "currencySymbolIOS" to currencySymbolIOS,
        "currentPlanId" to currentPlanId,
        "environmentIOS" to environmentIOS,
        "expirationDateIOS" to expirationDateIOS,
        "id" to id,
        "ids" to ids?.map { it },
        "isAutoRenewing" to isAutoRenewing,
        "isUpgradedIOS" to isUpgradedIOS,
        "offerIOS" to offerIOS?.toJson(),
        "originalTransactionDateIOS" to originalTransactionDateIOS,
        "originalTransactionIdentifierIOS" to originalTransactionIdentifierIOS,
        "ownershipTypeIOS" to ownershipTypeIOS,
        "platform" to platform.toJson(),
        "productId" to productId,
        "purchaseState" to purchaseState.toJson(),
        "purchaseToken" to purchaseToken,
        "quantity" to quantity,
        "quantityIOS" to quantityIOS,
        "reasonIOS" to reasonIOS,
        "reasonStringRepresentationIOS" to reasonStringRepresentationIOS,
        "renewalInfoIOS" to renewalInfoIOS?.toJson(),
        "revocationDateIOS" to revocationDateIOS,
        "revocationReasonIOS" to revocationReasonIOS,
        "store" to store.toJson(),
        "storefrontCountryCodeIOS" to storefrontCountryCodeIOS,
        "subscriptionGroupIdIOS" to subscriptionGroupIdIOS,
        "transactionDate" to transactionDate,
        "transactionId" to transactionId,
        "transactionReasonIOS" to transactionReasonIOS,
        "webOrderLineItemIdIOS" to webOrderLineItemIdIOS,
    )
}

public data class PurchaseOfferIOS(
    val id: String,
    val paymentMode: String,
    val type: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseOfferIOS {
            return PurchaseOfferIOS(
                id = json["id"] as String,
                paymentMode = json["paymentMode"] as String,
                type = json["type"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PurchaseOfferIOS",
        "id" to id,
        "paymentMode" to paymentMode,
        "type" to type,
    )
}

public data class RefundResultIOS(
    val message: String? = null,
    val status: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RefundResultIOS {
            return RefundResultIOS(
                message = json["message"] as String?,
                status = json["status"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RefundResultIOS",
        "message" to message,
        "status" to status,
    )
}

/**
 * Subscription renewal information from Product.SubscriptionInfo.RenewalInfo
 * https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
 */
public data class RenewalInfoIOS(
    val autoRenewPreference: String? = null,
    /**
     * When subscription expires due to cancellation/billing issue
     * Possible values: "VOLUNTARY", "BILLING_ERROR", "DID_NOT_AGREE_TO_PRICE_INCREASE", "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
     */
    val expirationReason: String? = null,
    /**
     * Grace period expiration date (milliseconds since epoch)
     * When set, subscription is in grace period (billing issue but still has access)
     */
    val gracePeriodExpirationDate: Double? = null,
    /**
     * True if subscription failed to renew due to billing issue and is retrying
     * Note: Not directly available in RenewalInfo, available in Status
     */
    val isInBillingRetry: Boolean? = null,
    val jsonRepresentation: String? = null,
    /**
     * Product ID that will be used on next renewal (when user upgrades/downgrades)
     * If set and different from current productId, subscription will change on expiration
     */
    val pendingUpgradeProductId: String? = null,
    /**
     * User's response to subscription price increase
     * Possible values: "AGREED", "PENDING", null (no price increase)
     */
    val priceIncreaseStatus: String? = null,
    /**
     * Expected renewal date (milliseconds since epoch)
     * For active subscriptions, when the next renewal/charge will occur
     */
    val renewalDate: Double? = null,
    /**
     * Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)
     */
    val renewalOfferId: String? = null,
    /**
     * Type of offer applied to next renewal
     * Possible values: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE", "WIN_BACK", etc.
     */
    val renewalOfferType: String? = null,
    val willAutoRenew: Boolean
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RenewalInfoIOS {
            return RenewalInfoIOS(
                autoRenewPreference = json["autoRenewPreference"] as String?,
                expirationReason = json["expirationReason"] as String?,
                gracePeriodExpirationDate = (json["gracePeriodExpirationDate"] as Number?)?.toDouble(),
                isInBillingRetry = json["isInBillingRetry"] as Boolean?,
                jsonRepresentation = json["jsonRepresentation"] as String?,
                pendingUpgradeProductId = json["pendingUpgradeProductId"] as String?,
                priceIncreaseStatus = json["priceIncreaseStatus"] as String?,
                renewalDate = (json["renewalDate"] as Number?)?.toDouble(),
                renewalOfferId = json["renewalOfferId"] as String?,
                renewalOfferType = json["renewalOfferType"] as String?,
                willAutoRenew = json["willAutoRenew"] as Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RenewalInfoIOS",
        "autoRenewPreference" to autoRenewPreference,
        "expirationReason" to expirationReason,
        "gracePeriodExpirationDate" to gracePeriodExpirationDate,
        "isInBillingRetry" to isInBillingRetry,
        "jsonRepresentation" to jsonRepresentation,
        "pendingUpgradeProductId" to pendingUpgradeProductId,
        "priceIncreaseStatus" to priceIncreaseStatus,
        "renewalDate" to renewalDate,
        "renewalOfferId" to renewalOfferId,
        "renewalOfferType" to renewalOfferType,
        "willAutoRenew" to willAutoRenew,
    )
}

/**
 * Rental details for one-time purchase products that can be rented (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class RentalDetailsAndroid(
    /**
     * Rental expiration period in ISO 8601 format
     * Time after rental period ends when user can still extend
     */
    val rentalExpirationPeriod: String? = null,
    /**
     * Rental period in ISO 8601 format (e.g., P7D for 7 days)
     */
    val rentalPeriod: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RentalDetailsAndroid {
            return RentalDetailsAndroid(
                rentalExpirationPeriod = json["rentalExpirationPeriod"] as String?,
                rentalPeriod = json["rentalPeriod"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RentalDetailsAndroid",
        "rentalExpirationPeriod" to rentalExpirationPeriod,
        "rentalPeriod" to rentalPeriod,
    )
}

public sealed interface RequestPurchaseResult

public data class RequestPurchaseResultPurchase(val value: Purchase?) : RequestPurchaseResult

public data class RequestPurchaseResultPurchases(val value: List<Purchase>?) : RequestPurchaseResult

public data class RequestVerifyPurchaseWithIapkitResult(
    /**
     * Whether the purchase is valid (not falsified).
     */
    val isValid: Boolean,
    /**
     * The current state of the purchase.
     */
    val state: IapkitPurchaseState,
    val store: IapStore
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitResult {
            return RequestVerifyPurchaseWithIapkitResult(
                isValid = json["isValid"] as Boolean,
                state = IapkitPurchaseState.fromJson(json["state"] as String),
                store = IapStore.fromJson(json["store"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RequestVerifyPurchaseWithIapkitResult",
        "isValid" to isValid,
        "state" to state.toJson(),
        "store" to store.toJson(),
    )
}

public data class SubscriptionInfoIOS(
    val introductoryOffer: SubscriptionOfferIOS? = null,
    val promotionalOffers: List<SubscriptionOfferIOS>? = null,
    val subscriptionGroupId: String,
    val subscriptionPeriod: SubscriptionPeriodValueIOS
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionInfoIOS {
            return SubscriptionInfoIOS(
                introductoryOffer = (json["introductoryOffer"] as Map<String, Any?>?)?.let { SubscriptionOfferIOS.fromJson(it) },
                promotionalOffers = (json["promotionalOffers"] as List<*>?)?.map { SubscriptionOfferIOS.fromJson((it as Map<String, Any?>)) },
                subscriptionGroupId = json["subscriptionGroupId"] as String,
                subscriptionPeriod = SubscriptionPeriodValueIOS.fromJson((json["subscriptionPeriod"] as Map<String, Any?>)),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionInfoIOS",
        "introductoryOffer" to introductoryOffer?.toJson(),
        "promotionalOffers" to promotionalOffers?.map { it.toJson() },
        "subscriptionGroupId" to subscriptionGroupId,
        "subscriptionPeriod" to subscriptionPeriod.toJson(),
    )
}

public data class SubscriptionOfferIOS(
    val displayPrice: String,
    val id: String,
    val paymentMode: PaymentModeIOS,
    val period: SubscriptionPeriodValueIOS,
    val periodCount: Int,
    val price: Double,
    val type: SubscriptionOfferTypeIOS
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionOfferIOS {
            return SubscriptionOfferIOS(
                displayPrice = json["displayPrice"] as String,
                id = json["id"] as String,
                paymentMode = (json["paymentMode"] as String?)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                period = SubscriptionPeriodValueIOS.fromJson((json["period"] as Map<String, Any?>)),
                periodCount = (json["periodCount"] as Number).toInt(),
                price = (json["price"] as Number).toDouble(),
                type = SubscriptionOfferTypeIOS.fromJson(json["type"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionOfferIOS",
        "displayPrice" to displayPrice,
        "id" to id,
        "paymentMode" to paymentMode.toJson(),
        "period" to period.toJson(),
        "periodCount" to periodCount,
        "price" to price,
        "type" to type.toJson(),
    )
}

public data class SubscriptionPeriodValueIOS(
    val unit: SubscriptionPeriodIOS,
    val value: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionPeriodValueIOS {
            return SubscriptionPeriodValueIOS(
                unit = (json["unit"] as String?)?.let { SubscriptionPeriodIOS.fromJson(it) } ?: SubscriptionPeriodIOS.Empty,
                value = (json["value"] as Number).toInt(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionPeriodValueIOS",
        "unit" to unit.toJson(),
        "value" to value,
    )
}

public data class SubscriptionStatusIOS(
    val renewalInfo: RenewalInfoIOS? = null,
    val state: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionStatusIOS {
            return SubscriptionStatusIOS(
                renewalInfo = (json["renewalInfo"] as Map<String, Any?>?)?.let { RenewalInfoIOS.fromJson(it) },
                state = json["state"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionStatusIOS",
        "renewalInfo" to renewalInfo?.toJson(),
        "state" to state,
    )
}

/**
 * User Choice Billing event details (Android)
 * Fired when a user selects alternative billing in the User Choice Billing dialog
 */
public data class UserChoiceBillingDetails(
    /**
     * Token that must be reported to Google Play within 24 hours
     */
    val externalTransactionToken: String,
    /**
     * List of product IDs selected by the user
     */
    val products: List<String>
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): UserChoiceBillingDetails {
            return UserChoiceBillingDetails(
                externalTransactionToken = json["externalTransactionToken"] as String,
                products = (json["products"] as List<*>).map { it as String },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "UserChoiceBillingDetails",
        "externalTransactionToken" to externalTransactionToken,
        "products" to products.map { it },
    )
}

/**
 * Valid time window for when an offer is available (Android)
 * Available in Google Play Billing Library 7.0+
 */
public data class ValidTimeWindowAndroid(
    /**
     * End time in milliseconds since epoch
     */
    val endTimeMillis: String,
    /**
     * Start time in milliseconds since epoch
     */
    val startTimeMillis: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ValidTimeWindowAndroid {
            return ValidTimeWindowAndroid(
                endTimeMillis = json["endTimeMillis"] as String,
                startTimeMillis = json["startTimeMillis"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ValidTimeWindowAndroid",
        "endTimeMillis" to endTimeMillis,
        "startTimeMillis" to startTimeMillis,
    )
}

public data class VerifyPurchaseResultAndroid(
    val autoRenewing: Boolean,
    val betaProduct: Boolean,
    val cancelDate: Double? = null,
    val cancelReason: String? = null,
    val deferredDate: Double? = null,
    val deferredSku: String? = null,
    val freeTrialEndDate: Double,
    val gracePeriodEndDate: Double,
    val parentProductId: String,
    val productId: String,
    val productType: String,
    val purchaseDate: Double,
    val quantity: Int,
    val receiptId: String,
    val renewalDate: Double,
    val term: String,
    val termSku: String,
    val testTransaction: Boolean
) : VerifyPurchaseResult {

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseResultAndroid {
            return VerifyPurchaseResultAndroid(
                autoRenewing = json["autoRenewing"] as Boolean,
                betaProduct = json["betaProduct"] as Boolean,
                cancelDate = (json["cancelDate"] as Number?)?.toDouble(),
                cancelReason = json["cancelReason"] as String?,
                deferredDate = (json["deferredDate"] as Number?)?.toDouble(),
                deferredSku = json["deferredSku"] as String?,
                freeTrialEndDate = (json["freeTrialEndDate"] as Number).toDouble(),
                gracePeriodEndDate = (json["gracePeriodEndDate"] as Number).toDouble(),
                parentProductId = json["parentProductId"] as String,
                productId = json["productId"] as String,
                productType = json["productType"] as String,
                purchaseDate = (json["purchaseDate"] as Number).toDouble(),
                quantity = (json["quantity"] as Number).toInt(),
                receiptId = json["receiptId"] as String,
                renewalDate = (json["renewalDate"] as Number).toDouble(),
                term = json["term"] as String,
                termSku = json["termSku"] as String,
                testTransaction = json["testTransaction"] as Boolean,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "VerifyPurchaseResultAndroid",
        "autoRenewing" to autoRenewing,
        "betaProduct" to betaProduct,
        "cancelDate" to cancelDate,
        "cancelReason" to cancelReason,
        "deferredDate" to deferredDate,
        "deferredSku" to deferredSku,
        "freeTrialEndDate" to freeTrialEndDate,
        "gracePeriodEndDate" to gracePeriodEndDate,
        "parentProductId" to parentProductId,
        "productId" to productId,
        "productType" to productType,
        "purchaseDate" to purchaseDate,
        "quantity" to quantity,
        "receiptId" to receiptId,
        "renewalDate" to renewalDate,
        "term" to term,
        "termSku" to termSku,
        "testTransaction" to testTransaction,
    )
}

/**
 * Result from Meta Horizon verify_entitlement API.
 * Returns verification status and grant time for the entitlement.
 */
public data class VerifyPurchaseResultHorizon(
    /**
     * Unix timestamp (seconds) when the entitlement was granted.
     */
    val grantTime: Double? = null,
    /**
     * Whether the entitlement verification succeeded.
     */
    val success: Boolean
) : VerifyPurchaseResult {

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseResultHorizon {
            return VerifyPurchaseResultHorizon(
                grantTime = (json["grantTime"] as Number?)?.toDouble(),
                success = json["success"] as Boolean,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "VerifyPurchaseResultHorizon",
        "grantTime" to grantTime,
        "success" to success,
    )
}

public data class VerifyPurchaseResultIOS(
    /**
     * Whether the receipt is valid
     */
    val isValid: Boolean,
    /**
     * JWS representation
     */
    val jwsRepresentation: String,
    /**
     * Latest transaction if available
     */
    val latestTransaction: Purchase? = null,
    /**
     * Receipt data string
     */
    val receiptData: String
) : VerifyPurchaseResult {

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseResultIOS {
            return VerifyPurchaseResultIOS(
                isValid = json["isValid"] as Boolean,
                jwsRepresentation = json["jwsRepresentation"] as String,
                latestTransaction = (json["latestTransaction"] as Map<String, Any?>?)?.let { Purchase.fromJson(it) },
                receiptData = json["receiptData"] as String,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "VerifyPurchaseResultIOS",
        "isValid" to isValid,
        "jwsRepresentation" to jwsRepresentation,
        "latestTransaction" to latestTransaction?.toJson(),
        "receiptData" to receiptData,
    )
}

public data class VerifyPurchaseWithProviderError(
    val code: String? = null,
    val message: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseWithProviderError {
            return VerifyPurchaseWithProviderError(
                code = json["code"] as String?,
                message = json["message"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "VerifyPurchaseWithProviderError",
        "code" to code,
        "message" to message,
    )
}

public data class VerifyPurchaseWithProviderResult(
    /**
     * Error details if verification failed
     */
    val errors: List<VerifyPurchaseWithProviderError>? = null,
    /**
     * IAPKit verification result
     */
    val iapkit: RequestVerifyPurchaseWithIapkitResult? = null,
    val provider: PurchaseVerificationProvider
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseWithProviderResult {
            return VerifyPurchaseWithProviderResult(
                errors = (json["errors"] as List<*>?)?.map { VerifyPurchaseWithProviderError.fromJson((it as Map<String, Any?>)) },
                iapkit = (json["iapkit"] as Map<String, Any?>?)?.let { RequestVerifyPurchaseWithIapkitResult.fromJson(it) },
                provider = PurchaseVerificationProvider.fromJson(json["provider"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "VerifyPurchaseWithProviderResult",
        "errors" to errors?.map { it.toJson() },
        "iapkit" to iapkit?.toJson(),
        "provider" to provider.toJson(),
    )
}

public typealias VoidResult = Unit

// MARK: - Input Objects

public data class AndroidSubscriptionOfferInput(
    /**
     * Offer token
     */
    val offerToken: String,
    /**
     * Product SKU
     */
    val sku: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): AndroidSubscriptionOfferInput {
            return AndroidSubscriptionOfferInput(
                offerToken = json["offerToken"] as String,
                sku = json["sku"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "offerToken" to offerToken,
        "sku" to sku,
    )
}

public data class DeepLinkOptions(
    /**
     * Android package name to target (required on Android)
     */
    val packageNameAndroid: String? = null,
    /**
     * Android SKU to open (required on Android)
     */
    val skuAndroid: String? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): DeepLinkOptions {
            return DeepLinkOptions(
                packageNameAndroid = json["packageNameAndroid"] as String?,
                skuAndroid = json["skuAndroid"] as String?,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "packageNameAndroid" to packageNameAndroid,
        "skuAndroid" to skuAndroid,
    )
}

public data class DiscountOfferInputIOS(
    /**
     * Discount identifier
     */
    val identifier: String,
    /**
     * Key identifier for validation
     */
    val keyIdentifier: String,
    /**
     * Cryptographic nonce
     */
    val nonce: String,
    /**
     * Signature for validation
     */
    val signature: String,
    /**
     * Timestamp of discount offer
     */
    val timestamp: Double
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountOfferInputIOS {
            return DiscountOfferInputIOS(
                identifier = json["identifier"] as String,
                keyIdentifier = json["keyIdentifier"] as String,
                nonce = json["nonce"] as String,
                signature = json["signature"] as String,
                timestamp = (json["timestamp"] as Number).toDouble(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "identifier" to identifier,
        "keyIdentifier" to keyIdentifier,
        "nonce" to nonce,
        "signature" to signature,
        "timestamp" to timestamp,
    )
}

/**
 * Connection initialization configuration
 */
public data class InitConnectionConfig(
    /**
     * Alternative billing mode for Android
     * If not specified, defaults to NONE (standard Google Play billing)
     */
    val alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): InitConnectionConfig {
            return InitConnectionConfig(
                alternativeBillingModeAndroid = (json["alternativeBillingModeAndroid"] as String?)?.let { AlternativeBillingModeAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "alternativeBillingModeAndroid" to alternativeBillingModeAndroid?.toJson(),
    )
}

/**
 * Parameters for launching an external link (Android)
 * Used with launchExternalLink to initiate external offer or app install flows
 * Available in Google Play Billing Library 8.2.0+
 */
public data class LaunchExternalLinkParamsAndroid(
    /**
     * The billing program (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * The external link launch mode
     */
    val launchMode: ExternalLinkLaunchModeAndroid,
    /**
     * The type of the external link
     */
    val linkType: ExternalLinkTypeAndroid,
    /**
     * The URI where the content will be accessed from
     */
    val linkUri: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): LaunchExternalLinkParamsAndroid {
            return LaunchExternalLinkParamsAndroid(
                billingProgram = BillingProgramAndroid.fromJson(json["billingProgram"] as String),
                launchMode = ExternalLinkLaunchModeAndroid.fromJson(json["launchMode"] as String),
                linkType = ExternalLinkTypeAndroid.fromJson(json["linkType"] as String),
                linkUri = json["linkUri"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "launchMode" to launchMode.toJson(),
        "linkType" to linkType.toJson(),
        "linkUri" to linkUri,
    )
}

public data class ProductRequest(
    val skus: List<String>,
    val type: ProductQueryType? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): ProductRequest {
            return ProductRequest(
                skus = (json["skus"] as List<*>).map { it as String },
                type = (json["type"] as String?)?.let { ProductQueryType.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "skus" to skus.map { it },
        "type" to type?.toJson(),
    )
}

public typealias PurchaseInput = Purchase

public data class PurchaseOptions(
    /**
     * Also emit results through the iOS event listeners
     */
    val alsoPublishToEventListenerIOS: Boolean? = null,
    /**
     * Limit to currently active items on iOS
     */
    val onlyIncludeActiveItemsIOS: Boolean? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseOptions {
            return PurchaseOptions(
                alsoPublishToEventListenerIOS = json["alsoPublishToEventListenerIOS"] as Boolean?,
                onlyIncludeActiveItemsIOS = json["onlyIncludeActiveItemsIOS"] as Boolean?,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "alsoPublishToEventListenerIOS" to alsoPublishToEventListenerIOS,
        "onlyIncludeActiveItemsIOS" to onlyIncludeActiveItemsIOS,
    )
}

public data class RequestPurchaseAndroidProps(
    /**
     * Personalized offer flag
     */
    val isOfferPersonalized: Boolean? = null,
    /**
     * Obfuscated account ID
     */
    val obfuscatedAccountIdAndroid: String? = null,
    /**
     * Obfuscated profile ID
     */
    val obfuscatedProfileIdAndroid: String? = null,
    /**
     * List of product SKUs
     */
    val skus: List<String>
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseAndroidProps {
            return RequestPurchaseAndroidProps(
                isOfferPersonalized = json["isOfferPersonalized"] as Boolean?,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as String?,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as String?,
                skus = (json["skus"] as List<*>).map { it as String },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "skus" to skus.map { it },
    )
}

public data class RequestPurchaseIosProps(
    /**
     * Auto-finish transaction (dangerous)
     */
    val andDangerouslyFinishTransactionAutomatically: Boolean? = null,
    /**
     * App account token for user tracking
     */
    val appAccountToken: String? = null,
    /**
     * Purchase quantity
     */
    val quantity: Int? = null,
    /**
     * Product SKU
     */
    val sku: String,
    /**
     * Discount offer to apply
     */
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseIosProps {
            return RequestPurchaseIosProps(
                andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as Boolean?,
                appAccountToken = json["appAccountToken"] as String?,
                quantity = (json["quantity"] as Number?)?.toInt(),
                sku = json["sku"] as String,
                withOffer = (json["withOffer"] as Map<String, Any?>?)?.let { DiscountOfferInputIOS.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "quantity" to quantity,
        "sku" to sku,
        "withOffer" to withOffer?.toJson(),
    )
}

public data class RequestPurchaseProps(
    val request: Request,
    val type: ProductQueryType,
    val useAlternativeBilling: Boolean? = null
) {
    init {
        when (request) {
            is Request.Purchase -> require(type == ProductQueryType.InApp) { "type must be IN_APP when request is purchase" }
            is Request.Subscription -> require(type == ProductQueryType.Subs) { "type must be SUBS when request is subscription" }
        }
    }

    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseProps {
            val rawType = (json["type"] as String?)?.let { ProductQueryType.fromJson(it) }
            val useAlternativeBilling = json["useAlternativeBilling"] as Boolean?
            val purchaseJson = json["requestPurchase"] as Map<String, Any?>?
            if (purchaseJson != null) {
                val request = Request.Purchase(RequestPurchasePropsByPlatforms.fromJson(purchaseJson))
                val finalType = rawType ?: ProductQueryType.InApp
                require(finalType == ProductQueryType.InApp) { "type must be IN_APP when requestPurchase is provided" }
                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)
            }
            val subscriptionJson = json["requestSubscription"] as Map<String, Any?>?
            if (subscriptionJson != null) {
                val request = Request.Subscription(RequestSubscriptionPropsByPlatforms.fromJson(subscriptionJson))
                val finalType = rawType ?: ProductQueryType.Subs
                require(finalType == ProductQueryType.Subs) { "type must be SUBS when requestSubscription is provided" }
                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)
            }
            throw IllegalArgumentException("RequestPurchaseProps requires requestPurchase or requestSubscription")
        }
    }

    fun toJson(): Map<String, Any?> = when (request) {
        is Request.Purchase -> mapOf(
            "requestPurchase" to request.value.toJson(),
            "type" to type.toJson(),
            "useAlternativeBilling" to useAlternativeBilling,
        )
        is Request.Subscription -> mapOf(
            "requestSubscription" to request.value.toJson(),
            "type" to type.toJson(),
            "useAlternativeBilling" to useAlternativeBilling,
        )
    }

    sealed class Request {
        data class Purchase(val value: RequestPurchasePropsByPlatforms) : Request()
        data class Subscription(val value: RequestSubscriptionPropsByPlatforms) : Request()
    }
}

/**
 * Platform-specific purchase request parameters.
 * 
 * Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
 * - apple: Always targets App Store
 * - google: Targets Play Store by default, or Horizon when built with horizon flavor
 *   (determined at build time, not runtime)
 */
public data class RequestPurchasePropsByPlatforms(
    /**
     * @deprecated Use google instead
     */
    val android: RequestPurchaseAndroidProps? = null,
    /**
     * Apple-specific purchase parameters
     */
    val apple: RequestPurchaseIosProps? = null,
    /**
     * Google-specific purchase parameters
     */
    val google: RequestPurchaseAndroidProps? = null,
    /**
     * @deprecated Use apple instead
     */
    val ios: RequestPurchaseIosProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchasePropsByPlatforms {
            return RequestPurchasePropsByPlatforms(
                android = (json["android"] as Map<String, Any?>?)?.let { RequestPurchaseAndroidProps.fromJson(it) },
                apple = (json["apple"] as Map<String, Any?>?)?.let { RequestPurchaseIosProps.fromJson(it) },
                google = (json["google"] as Map<String, Any?>?)?.let { RequestPurchaseAndroidProps.fromJson(it) },
                ios = (json["ios"] as Map<String, Any?>?)?.let { RequestPurchaseIosProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "android" to android?.toJson(),
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
        "ios" to ios?.toJson(),
    )
}

public data class RequestSubscriptionAndroidProps(
    /**
     * Personalized offer flag
     */
    val isOfferPersonalized: Boolean? = null,
    /**
     * Obfuscated account ID
     */
    val obfuscatedAccountIdAndroid: String? = null,
    /**
     * Obfuscated profile ID
     */
    val obfuscatedProfileIdAndroid: String? = null,
    /**
     * Purchase token for upgrades/downgrades
     */
    val purchaseTokenAndroid: String? = null,
    /**
     * Replacement mode for subscription changes
     * @deprecated Use subscriptionProductReplacementParams instead for item-level replacement (8.1.0+)
     */
    val replacementModeAndroid: Int? = null,
    /**
     * List of subscription SKUs
     */
    val skus: List<String>,
    /**
     * Subscription offers
     */
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>? = null,
    /**
     * Product-level replacement parameters (8.1.0+)
     * Use this instead of replacementModeAndroid for item-level replacement
     */
    val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionAndroidProps {
            return RequestSubscriptionAndroidProps(
                isOfferPersonalized = json["isOfferPersonalized"] as Boolean?,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as String?,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as String?,
                purchaseTokenAndroid = json["purchaseTokenAndroid"] as String?,
                replacementModeAndroid = (json["replacementModeAndroid"] as Number?)?.toInt(),
                skus = (json["skus"] as List<*>).map { it as String },
                subscriptionOffers = (json["subscriptionOffers"] as List<*>?)?.map { AndroidSubscriptionOfferInput.fromJson((it as Map<String, Any?>)) },
                subscriptionProductReplacementParams = (json["subscriptionProductReplacementParams"] as Map<String, Any?>?)?.let { SubscriptionProductReplacementParamsAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "purchaseTokenAndroid" to purchaseTokenAndroid,
        "replacementModeAndroid" to replacementModeAndroid,
        "skus" to skus.map { it },
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
        "subscriptionProductReplacementParams" to subscriptionProductReplacementParams?.toJson(),
    )
}

public data class RequestSubscriptionIosProps(
    val andDangerouslyFinishTransactionAutomatically: Boolean? = null,
    val appAccountToken: String? = null,
    val quantity: Int? = null,
    val sku: String,
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionIosProps {
            return RequestSubscriptionIosProps(
                andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as Boolean?,
                appAccountToken = json["appAccountToken"] as String?,
                quantity = (json["quantity"] as Number?)?.toInt(),
                sku = json["sku"] as String,
                withOffer = (json["withOffer"] as Map<String, Any?>?)?.let { DiscountOfferInputIOS.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "quantity" to quantity,
        "sku" to sku,
        "withOffer" to withOffer?.toJson(),
    )
}

/**
 * Platform-specific subscription request parameters.
 * 
 * Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
 * - apple: Always targets App Store
 * - google: Targets Play Store by default, or Horizon when built with horizon flavor
 *   (determined at build time, not runtime)
 */
public data class RequestSubscriptionPropsByPlatforms(
    /**
     * @deprecated Use google instead
     */
    val android: RequestSubscriptionAndroidProps? = null,
    /**
     * Apple-specific subscription parameters
     */
    val apple: RequestSubscriptionIosProps? = null,
    /**
     * Google-specific subscription parameters
     */
    val google: RequestSubscriptionAndroidProps? = null,
    /**
     * @deprecated Use apple instead
     */
    val ios: RequestSubscriptionIosProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionPropsByPlatforms {
            return RequestSubscriptionPropsByPlatforms(
                android = (json["android"] as Map<String, Any?>?)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
                apple = (json["apple"] as Map<String, Any?>?)?.let { RequestSubscriptionIosProps.fromJson(it) },
                google = (json["google"] as Map<String, Any?>?)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
                ios = (json["ios"] as Map<String, Any?>?)?.let { RequestSubscriptionIosProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "android" to android?.toJson(),
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
        "ios" to ios?.toJson(),
    )
}

public data class RequestVerifyPurchaseWithIapkitAppleProps(
    /**
     * The JWS token returned with the purchase response.
     */
    val jws: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitAppleProps {
            return RequestVerifyPurchaseWithIapkitAppleProps(
                jws = json["jws"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "jws" to jws,
    )
}

public data class RequestVerifyPurchaseWithIapkitGoogleProps(
    /**
     * The token provided to the user's device when the product or subscription was purchased.
     */
    val purchaseToken: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitGoogleProps {
            return RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = json["purchaseToken"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "purchaseToken" to purchaseToken,
    )
}

/**
 * Platform-specific verification parameters for IAPKit.
 * 
 * - apple: Verifies via App Store (JWS token)
 * - google: Verifies via Play Store (purchase token)
 */
public data class RequestVerifyPurchaseWithIapkitProps(
    /**
     * API key used for the Authorization header (Bearer {apiKey}).
     */
    val apiKey: String? = null,
    /**
     * Apple App Store verification parameters.
     */
    val apple: RequestVerifyPurchaseWithIapkitAppleProps? = null,
    /**
     * Google Play Store verification parameters.
     */
    val google: RequestVerifyPurchaseWithIapkitGoogleProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitProps {
            return RequestVerifyPurchaseWithIapkitProps(
                apiKey = json["apiKey"] as String?,
                apple = (json["apple"] as Map<String, Any?>?)?.let { RequestVerifyPurchaseWithIapkitAppleProps.fromJson(it) },
                google = (json["google"] as Map<String, Any?>?)?.let { RequestVerifyPurchaseWithIapkitGoogleProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "apiKey" to apiKey,
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
    )
}

/**
 * Product-level subscription replacement parameters (Android)
 * Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams
 * Available in Google Play Billing Library 8.1.0+
 */
public data class SubscriptionProductReplacementParamsAndroid(
    /**
     * The old product ID that needs to be replaced
     */
    val oldProductId: String,
    /**
     * The replacement mode for this product change
     */
    val replacementMode: SubscriptionReplacementModeAndroid
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionProductReplacementParamsAndroid {
            return SubscriptionProductReplacementParamsAndroid(
                oldProductId = json["oldProductId"] as String,
                replacementMode = SubscriptionReplacementModeAndroid.fromJson(json["replacementMode"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "oldProductId" to oldProductId,
        "replacementMode" to replacementMode.toJson(),
    )
}

/**
 * Apple App Store verification parameters.
 * Used for server-side receipt validation via App Store Server API.
 */
public data class VerifyPurchaseAppleOptions(
    /**
     * Product SKU to validate
     */
    val sku: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseAppleOptions {
            return VerifyPurchaseAppleOptions(
                sku = json["sku"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "sku" to sku,
    )
}

/**
 * Google Play Store verification parameters.
 * Used for server-side receipt validation via Google Play Developer API.
 * 
 * ⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.
 */
public data class VerifyPurchaseGoogleOptions(
    /**
     * Google OAuth2 access token for API authentication.
     * ⚠️ Sensitive: Do not log this value.
     */
    val accessToken: String,
    /**
     * Whether this is a subscription purchase (affects API endpoint used)
     */
    val isSub: Boolean? = null,
    /**
     * Android package name (e.g., com.example.app)
     */
    val packageName: String,
    /**
     * Purchase token from the purchase response.
     * ⚠️ Sensitive: Do not log this value.
     */
    val purchaseToken: String,
    /**
     * Product SKU to validate
     */
    val sku: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseGoogleOptions {
            return VerifyPurchaseGoogleOptions(
                accessToken = json["accessToken"] as String,
                isSub = json["isSub"] as Boolean?,
                packageName = json["packageName"] as String,
                purchaseToken = json["purchaseToken"] as String,
                sku = json["sku"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "accessToken" to accessToken,
        "isSub" to isSub,
        "packageName" to packageName,
        "purchaseToken" to purchaseToken,
        "sku" to sku,
    )
}

/**
 * Meta Horizon (Quest) verification parameters.
 * Used for server-side entitlement verification via Meta's S2S API.
 * POST https://graph.oculus.com/$APP_ID/verify_entitlement
 * 
 * ⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.
 */
public data class VerifyPurchaseHorizonOptions(
    /**
     * Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token).
     * ⚠️ Sensitive: Do not log this value.
     */
    val accessToken: String,
    /**
     * The SKU for the add-on item, defined in Meta Developer Dashboard
     */
    val sku: String,
    /**
     * The user ID of the user whose purchase you want to verify
     */
    val userId: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseHorizonOptions {
            return VerifyPurchaseHorizonOptions(
                accessToken = json["accessToken"] as String,
                sku = json["sku"] as String,
                userId = json["userId"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "accessToken" to accessToken,
        "sku" to sku,
        "userId" to userId,
    )
}

/**
 * Platform-specific purchase verification parameters.
 * 
 * - apple: Verifies via App Store Server API
 * - google: Verifies via Google Play Developer API
 * - horizon: Verifies via Meta's S2S API (verify_entitlement endpoint)
 */
public data class VerifyPurchaseProps(
    /**
     * Apple App Store verification parameters.
     */
    val apple: VerifyPurchaseAppleOptions? = null,
    /**
     * Google Play Store verification parameters.
     */
    val google: VerifyPurchaseGoogleOptions? = null,
    /**
     * Meta Horizon (Quest) verification parameters.
     */
    val horizon: VerifyPurchaseHorizonOptions? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseProps {
            return VerifyPurchaseProps(
                apple = (json["apple"] as Map<String, Any?>?)?.let { VerifyPurchaseAppleOptions.fromJson(it) },
                google = (json["google"] as Map<String, Any?>?)?.let { VerifyPurchaseGoogleOptions.fromJson(it) },
                horizon = (json["horizon"] as Map<String, Any?>?)?.let { VerifyPurchaseHorizonOptions.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
        "horizon" to horizon?.toJson(),
    )
}

public data class VerifyPurchaseWithProviderProps(
    val iapkit: RequestVerifyPurchaseWithIapkitProps? = null,
    val provider: PurchaseVerificationProvider
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseWithProviderProps {
            return VerifyPurchaseWithProviderProps(
                iapkit = (json["iapkit"] as Map<String, Any?>?)?.let { RequestVerifyPurchaseWithIapkitProps.fromJson(it) },
                provider = PurchaseVerificationProvider.fromJson(json["provider"] as String),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "iapkit" to iapkit?.toJson(),
        "provider" to provider.toJson(),
    )
}

// MARK: - Unions

public sealed interface Product : ProductCommon {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): Product {
            return when (json["__typename"] as String?) {
                "ProductAndroid" -> ProductAndroid.fromJson(json)
                "ProductIOS" -> ProductIOS.fromJson(json)
                else -> throw IllegalArgumentException("Unknown __typename for Product: ${json["__typename"]}")
            }
        }
    }
}

public sealed interface ProductOrSubscription {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductOrSubscription {
            return when (json["__typename"] as String?) {
                "ProductAndroid" -> ProductItem(Product.fromJson(json))
                "ProductIOS" -> ProductItem(Product.fromJson(json))
                "ProductSubscriptionAndroid" -> ProductSubscriptionItem(ProductSubscription.fromJson(json))
                "ProductSubscriptionIOS" -> ProductSubscriptionItem(ProductSubscription.fromJson(json))
                else -> throw IllegalArgumentException("Unknown __typename for ProductOrSubscription: ${json["__typename"]}")
            }
        }
    }

    data class ProductItem(val value: Product) : ProductOrSubscription {
        override fun toJson() = value.toJson()
    }

    data class ProductSubscriptionItem(val value: ProductSubscription) : ProductOrSubscription {
        override fun toJson() = value.toJson()
    }
}

public sealed interface ProductSubscription : ProductCommon {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscription {
            return when (json["__typename"] as String?) {
                "ProductSubscriptionAndroid" -> ProductSubscriptionAndroid.fromJson(json)
                "ProductSubscriptionIOS" -> ProductSubscriptionIOS.fromJson(json)
                else -> throw IllegalArgumentException("Unknown __typename for ProductSubscription: ${json["__typename"]}")
            }
        }
    }
}

public sealed interface Purchase : PurchaseCommon {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): Purchase {
            return when (json["__typename"] as String?) {
                "PurchaseAndroid" -> PurchaseAndroid.fromJson(json)
                "PurchaseIOS" -> PurchaseIOS.fromJson(json)
                else -> throw IllegalArgumentException("Unknown __typename for Purchase: ${json["__typename"]}")
            }
        }
    }
}

public sealed interface VerifyPurchaseResult {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseResult {
            return when (json["__typename"] as String?) {
                "VerifyPurchaseResultAndroid" -> VerifyPurchaseResultAndroid.fromJson(json)
                "VerifyPurchaseResultHorizon" -> VerifyPurchaseResultHorizon.fromJson(json)
                "VerifyPurchaseResultIOS" -> VerifyPurchaseResultIOS.fromJson(json)
                else -> throw IllegalArgumentException("Unknown __typename for VerifyPurchaseResult: ${json["__typename"]}")
            }
        }
    }
}

// MARK: - Root Operations

/**
 * GraphQL root mutation operations.
 */
public interface MutationResolver {
    /**
     * Acknowledge a non-consumable purchase or subscription
     */
    suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean
    /**
     * Initiate a refund request for a product (iOS 15+)
     */
    suspend fun beginRefundRequestIOS(sku: String): String?
    /**
     * Check if alternative billing is available for this user/device
     * Step 1 of alternative billing flow
     * 
     * Returns true if available, false otherwise
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean
    /**
     * Clear pending transactions from the StoreKit payment queue
     */
    suspend fun clearTransactionIOS(): Boolean
    /**
     * Consume a purchase token so it can be repurchased
     */
    suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean
    /**
     * Create external transaction token for Google Play reporting
     * Step 3 of alternative billing flow
     * Must be called AFTER successful payment in your payment system
     * Token must be reported to Google Play backend within 24 hours
     * 
     * Returns token string, or null if creation failed
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun createAlternativeBillingTokenAndroid(): String?
    /**
     * Open the native subscription management surface
     */
    suspend fun deepLinkToSubscriptions(options: DeepLinkOptions? = null): Unit
    /**
     * Close the platform billing connection
     */
    suspend fun endConnection(): Boolean
    /**
     * Finish a transaction after validating receipts
     */
    suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean? = null): Unit
    /**
     * Establish the platform billing connection
     */
    suspend fun initConnection(config: InitConnectionConfig? = null): Boolean
    /**
     * Present the App Store code redemption sheet
     */
    suspend fun presentCodeRedemptionSheetIOS(): Boolean
    /**
     * Present external purchase custom link with StoreKit UI (iOS 18.2+)
     */
    suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS
    /**
     * Present external purchase notice sheet (iOS 18.2+)
     */
    suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS
    /**
     * Initiate a purchase flow; rely on events for final state
     */
    suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult?
    /**
     * Purchase the promoted product surfaced by the App Store
     */
    suspend fun requestPurchaseOnPromotedProductIOS(): Boolean
    /**
     * Restore completed purchases across platforms
     */
    suspend fun restorePurchases(): Unit
    /**
     * Show alternative billing information dialog to user
     * Step 2 of alternative billing flow
     * Must be called BEFORE processing payment in your payment system
     * 
     * Returns true if user accepted, false if user canceled
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun showAlternativeBillingDialogAndroid(): Boolean
    /**
     * Open subscription management UI and return changed purchases (iOS 15+)
     */
    suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS>
    /**
     * Force a StoreKit sync for transactions (iOS 15+)
     */
    suspend fun syncIOS(): Boolean
    /**
     * Validate purchase receipts with the configured providers
     */
    suspend fun validateReceipt(options: VerifyPurchaseProps): VerifyPurchaseResult
    /**
     * Verify purchases with the configured providers
     */
    suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult
    /**
     * Verify purchases with a specific provider (e.g., IAPKit)
     */
    suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult
}

/**
 * GraphQL root query operations.
 */
public interface QueryResolver {
    /**
     * Check if external purchase notice sheet can be presented (iOS 18.2+)
     */
    suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean
    /**
     * Get current StoreKit 2 entitlements (iOS 15+)
     */
    suspend fun currentEntitlementIOS(sku: String): PurchaseIOS?
    /**
     * Retrieve products or subscriptions from the store
     */
    suspend fun fetchProducts(params: ProductRequest): FetchProductsResult
    /**
     * Get active subscriptions (filters by subscriptionIds when provided)
     */
    suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>
    /**
     * Fetch the current app transaction (iOS 16+)
     */
    suspend fun getAppTransactionIOS(): AppTransaction?
    /**
     * Get all available purchases for the current user
     */
    suspend fun getAvailablePurchases(options: PurchaseOptions? = null): List<Purchase>
    /**
     * Retrieve all pending transactions in the StoreKit queue
     */
    suspend fun getPendingTransactionsIOS(): List<PurchaseIOS>
    /**
     * Get the currently promoted product (iOS 11+)
     */
    suspend fun getPromotedProductIOS(): ProductIOS?
    /**
     * Get base64-encoded receipt data for validation
     */
    suspend fun getReceiptDataIOS(): String?
    /**
     * Get the current storefront country code
     */
    suspend fun getStorefront(): String
    /**
     * Get the current App Store storefront country code
     */
    suspend fun getStorefrontIOS(): String
    /**
     * Get the transaction JWS (StoreKit 2)
     */
    suspend fun getTransactionJwsIOS(sku: String): String?
    /**
     * Check whether the user has active subscriptions
     */
    suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean
    /**
     * Check introductory offer eligibility for a subscription group
     */
    suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean
    /**
     * Verify a StoreKit 2 transaction signature
     */
    suspend fun isTransactionVerifiedIOS(sku: String): Boolean
    /**
     * Get the latest transaction for a product using StoreKit 2
     */
    suspend fun latestTransactionIOS(sku: String): PurchaseIOS?
    /**
     * Get StoreKit 2 subscription status details (iOS 15+)
     */
    suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS>
    /**
     * Validate a receipt for a specific product
     */
    suspend fun validateReceiptIOS(options: VerifyPurchaseProps): VerifyPurchaseResultIOS
}

/**
 * GraphQL root subscription operations.
 */
public interface SubscriptionResolver {
    /**
     * Fires when the App Store surfaces a promoted product (iOS only)
     */
    suspend fun promotedProductIOS(): String
    /**
     * Fires when a purchase fails or is cancelled
     */
    suspend fun purchaseError(): PurchaseError
    /**
     * Fires when a purchase completes successfully or a pending purchase resolves
     */
    suspend fun purchaseUpdated(): Purchase
    /**
     * Fires when a user selects alternative billing in the User Choice Billing dialog (Android only)
     * Only triggered when the user selects alternative billing instead of Google Play billing
     */
    suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails
}

// MARK: - Root Operation Helpers

// MARK: - Mutation Helpers

public typealias MutationAcknowledgePurchaseAndroidHandler = suspend (purchaseToken: String) -> Boolean
public typealias MutationBeginRefundRequestIOSHandler = suspend (sku: String) -> String?
public typealias MutationCheckAlternativeBillingAvailabilityAndroidHandler = suspend () -> Boolean
public typealias MutationClearTransactionIOSHandler = suspend () -> Boolean
public typealias MutationConsumePurchaseAndroidHandler = suspend (purchaseToken: String) -> Boolean
public typealias MutationCreateAlternativeBillingTokenAndroidHandler = suspend () -> String?
public typealias MutationDeepLinkToSubscriptionsHandler = suspend (options: DeepLinkOptions?) -> Unit
public typealias MutationEndConnectionHandler = suspend () -> Boolean
public typealias MutationFinishTransactionHandler = suspend (purchase: PurchaseInput, isConsumable: Boolean?) -> Unit
public typealias MutationInitConnectionHandler = suspend (config: InitConnectionConfig?) -> Boolean
public typealias MutationPresentCodeRedemptionSheetIOSHandler = suspend () -> Boolean
public typealias MutationPresentExternalPurchaseLinkIOSHandler = suspend (url: String) -> ExternalPurchaseLinkResultIOS
public typealias MutationPresentExternalPurchaseNoticeSheetIOSHandler = suspend () -> ExternalPurchaseNoticeResultIOS
public typealias MutationRequestPurchaseHandler = suspend (params: RequestPurchaseProps) -> RequestPurchaseResult?
public typealias MutationRequestPurchaseOnPromotedProductIOSHandler = suspend () -> Boolean
public typealias MutationRestorePurchasesHandler = suspend () -> Unit
public typealias MutationShowAlternativeBillingDialogAndroidHandler = suspend () -> Boolean
public typealias MutationShowManageSubscriptionsIOSHandler = suspend () -> List<PurchaseIOS>
public typealias MutationSyncIOSHandler = suspend () -> Boolean
public typealias MutationValidateReceiptHandler = suspend (options: VerifyPurchaseProps) -> VerifyPurchaseResult
public typealias MutationVerifyPurchaseHandler = suspend (options: VerifyPurchaseProps) -> VerifyPurchaseResult
public typealias MutationVerifyPurchaseWithProviderHandler = suspend (options: VerifyPurchaseWithProviderProps) -> VerifyPurchaseWithProviderResult

public data class MutationHandlers(
    val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler? = null,
    val beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler? = null,
    val checkAlternativeBillingAvailabilityAndroid: MutationCheckAlternativeBillingAvailabilityAndroidHandler? = null,
    val clearTransactionIOS: MutationClearTransactionIOSHandler? = null,
    val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler? = null,
    val createAlternativeBillingTokenAndroid: MutationCreateAlternativeBillingTokenAndroidHandler? = null,
    val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler? = null,
    val endConnection: MutationEndConnectionHandler? = null,
    val finishTransaction: MutationFinishTransactionHandler? = null,
    val initConnection: MutationInitConnectionHandler? = null,
    val presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler? = null,
    val presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler? = null,
    val presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler? = null,
    val requestPurchase: MutationRequestPurchaseHandler? = null,
    val requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler? = null,
    val restorePurchases: MutationRestorePurchasesHandler? = null,
    val showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler? = null,
    val showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler? = null,
    val syncIOS: MutationSyncIOSHandler? = null,
    val validateReceipt: MutationValidateReceiptHandler? = null,
    val verifyPurchase: MutationVerifyPurchaseHandler? = null,
    val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler? = null
)

// MARK: - Query Helpers

public typealias QueryCanPresentExternalPurchaseNoticeIOSHandler = suspend () -> Boolean
public typealias QueryCurrentEntitlementIOSHandler = suspend (sku: String) -> PurchaseIOS?
public typealias QueryFetchProductsHandler = suspend (params: ProductRequest) -> FetchProductsResult
public typealias QueryGetActiveSubscriptionsHandler = suspend (subscriptionIds: List<String>?) -> List<ActiveSubscription>
public typealias QueryGetAppTransactionIOSHandler = suspend () -> AppTransaction?
public typealias QueryGetAvailablePurchasesHandler = suspend (options: PurchaseOptions?) -> List<Purchase>
public typealias QueryGetPendingTransactionsIOSHandler = suspend () -> List<PurchaseIOS>
public typealias QueryGetPromotedProductIOSHandler = suspend () -> ProductIOS?
public typealias QueryGetReceiptDataIOSHandler = suspend () -> String?
public typealias QueryGetStorefrontHandler = suspend () -> String
public typealias QueryGetStorefrontIOSHandler = suspend () -> String
public typealias QueryGetTransactionJwsIOSHandler = suspend (sku: String) -> String?
public typealias QueryHasActiveSubscriptionsHandler = suspend (subscriptionIds: List<String>?) -> Boolean
public typealias QueryIsEligibleForIntroOfferIOSHandler = suspend (groupID: String) -> Boolean
public typealias QueryIsTransactionVerifiedIOSHandler = suspend (sku: String) -> Boolean
public typealias QueryLatestTransactionIOSHandler = suspend (sku: String) -> PurchaseIOS?
public typealias QuerySubscriptionStatusIOSHandler = suspend (sku: String) -> List<SubscriptionStatusIOS>
public typealias QueryValidateReceiptIOSHandler = suspend (options: VerifyPurchaseProps) -> VerifyPurchaseResultIOS

public data class QueryHandlers(
    val canPresentExternalPurchaseNoticeIOS: QueryCanPresentExternalPurchaseNoticeIOSHandler? = null,
    val currentEntitlementIOS: QueryCurrentEntitlementIOSHandler? = null,
    val fetchProducts: QueryFetchProductsHandler? = null,
    val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler? = null,
    val getAppTransactionIOS: QueryGetAppTransactionIOSHandler? = null,
    val getAvailablePurchases: QueryGetAvailablePurchasesHandler? = null,
    val getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler? = null,
    val getPromotedProductIOS: QueryGetPromotedProductIOSHandler? = null,
    val getReceiptDataIOS: QueryGetReceiptDataIOSHandler? = null,
    val getStorefront: QueryGetStorefrontHandler? = null,
    val getStorefrontIOS: QueryGetStorefrontIOSHandler? = null,
    val getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler? = null,
    val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler? = null,
    val isEligibleForIntroOfferIOS: QueryIsEligibleForIntroOfferIOSHandler? = null,
    val isTransactionVerifiedIOS: QueryIsTransactionVerifiedIOSHandler? = null,
    val latestTransactionIOS: QueryLatestTransactionIOSHandler? = null,
    val subscriptionStatusIOS: QuerySubscriptionStatusIOSHandler? = null,
    val validateReceiptIOS: QueryValidateReceiptIOSHandler? = null
)

// MARK: - Subscription Helpers

public typealias SubscriptionPromotedProductIOSHandler = suspend () -> String
public typealias SubscriptionPurchaseErrorHandler = suspend () -> PurchaseError
public typealias SubscriptionPurchaseUpdatedHandler = suspend () -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = suspend () -> UserChoiceBillingDetails

public data class SubscriptionHandlers(
    val promotedProductIOS: SubscriptionPromotedProductIOSHandler? = null,
    val purchaseError: SubscriptionPurchaseErrorHandler? = null,
    val purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = null,
    val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = null
)
