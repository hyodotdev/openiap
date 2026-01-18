// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `npm run generate` after updating any *.graphql schema file.
// ============================================================================

@file:Suppress("unused", "UNCHECKED_CAST")

// MARK: - Enums

/**
 * Alternative billing mode for Android
 * Controls which billing system is used
 * @deprecated Use enableBillingProgramAndroid with BillingProgramAndroid instead.
 * Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
 */
public enum class AlternativeBillingModeAndroid(val rawValue: String) {
    /**
     * Standard Google Play billing (default)
     */
    None("none"),
    /**
     * User choice billing - user can select between Google Play or alternative
     * Requires Google Play Billing Library 7.0+
     * @deprecated Use BillingProgramAndroid.USER_CHOICE_BILLING instead
     */
    UserChoice("user-choice"),
    /**
     * Alternative billing only - no Google Play billing option
     * Requires Google Play Billing Library 6.2+
     * @deprecated Use BillingProgramAndroid.EXTERNAL_OFFER instead
     */
    AlternativeOnly("alternative-only")

    companion object {
        fun fromJson(value: String): AlternativeBillingModeAndroid = when (value) {
            "none" -> AlternativeBillingModeAndroid.None
            "NONE" -> AlternativeBillingModeAndroid.None
            "user-choice" -> AlternativeBillingModeAndroid.UserChoice
            "USER_CHOICE" -> AlternativeBillingModeAndroid.UserChoice
            "alternative-only" -> AlternativeBillingModeAndroid.AlternativeOnly
            "ALTERNATIVE_ONLY" -> AlternativeBillingModeAndroid.AlternativeOnly
            else -> throw IllegalArgumentException("Unknown AlternativeBillingModeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Billing program types for external content links, external offers, and external payments (Android)
 * Available in Google Play Billing Library 8.2.0+, EXTERNAL_PAYMENTS added in 8.3.0
 */
public enum class BillingProgramAndroid(val rawValue: String) {
    /**
     * Unspecified billing program. Do not use.
     */
    Unspecified("unspecified"),
    /**
     * User Choice Billing program.
     * User can select between Google Play Billing or alternative billing.
     * Available in Google Play Billing Library 7.0+
     */
    UserChoiceBilling("user-choice-billing"),
    /**
     * External Content Links program.
     * Allows linking to external content outside the app.
     * Available in Google Play Billing Library 8.2.0+
     */
    ExternalContentLink("external-content-link"),
    /**
     * External Offers program.
     * Allows offering digital content purchases outside the app.
     * Available in Google Play Billing Library 8.2.0+
     */
    ExternalOffer("external-offer"),
    /**
     * External Payments program (Japan only).
     * Allows presenting a side-by-side choice between Google Play Billing and developer's external payment option.
     * Users can choose to complete the purchase on the developer's website.
     * Available in Google Play Billing Library 8.3.0+
     */
    ExternalPayments("external-payments")

    companion object {
        fun fromJson(value: String): BillingProgramAndroid = when (value) {
            "unspecified" -> BillingProgramAndroid.Unspecified
            "UNSPECIFIED" -> BillingProgramAndroid.Unspecified
            "user-choice-billing" -> BillingProgramAndroid.UserChoiceBilling
            "USER_CHOICE_BILLING" -> BillingProgramAndroid.UserChoiceBilling
            "external-content-link" -> BillingProgramAndroid.ExternalContentLink
            "EXTERNAL_CONTENT_LINK" -> BillingProgramAndroid.ExternalContentLink
            "external-offer" -> BillingProgramAndroid.ExternalOffer
            "EXTERNAL_OFFER" -> BillingProgramAndroid.ExternalOffer
            "external-payments" -> BillingProgramAndroid.ExternalPayments
            "EXTERNAL_PAYMENTS" -> BillingProgramAndroid.ExternalPayments
            else -> throw IllegalArgumentException("Unknown BillingProgramAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Launch mode for developer billing option (Android)
 * Determines how the external payment URL is launched
 * Available in Google Play Billing Library 8.3.0+
 */
public enum class DeveloperBillingLaunchModeAndroid(val rawValue: String) {
    /**
     * Unspecified launch mode. Do not use.
     */
    Unspecified("unspecified"),
    /**
     * Google Play will launch the link in an external browser or eligible app.
     * Use this when you want Play to handle launching the external payment URL.
     */
    LaunchInExternalBrowserOrApp("launch-in-external-browser-or-app"),
    /**
     * The caller app will launch the link after Play returns control.
     * Use this when you want to handle launching the external payment URL yourself.
     */
    CallerWillLaunchLink("caller-will-launch-link")

    companion object {
        fun fromJson(value: String): DeveloperBillingLaunchModeAndroid = when (value) {
            "unspecified" -> DeveloperBillingLaunchModeAndroid.Unspecified
            "UNSPECIFIED" -> DeveloperBillingLaunchModeAndroid.Unspecified
            "launch-in-external-browser-or-app" -> DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
            "LAUNCH_IN_EXTERNAL_BROWSER_OR_APP" -> DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
            "caller-will-launch-link" -> DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink
            "CALLER_WILL_LAUNCH_LINK" -> DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink
            else -> throw IllegalArgumentException("Unknown DeveloperBillingLaunchModeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Discount offer type enumeration.
 * Categorizes the type of discount or promotional offer.
 */
public enum class DiscountOfferType(val rawValue: String) {
    /**
     * Introductory offer for new subscribers (first-time purchase discount)
     */
    Introductory("introductory"),
    /**
     * Promotional offer for existing or returning subscribers
     */
    Promotional("promotional"),
    /**
     * One-time product discount (Android only, Google Play Billing 7.0+)
     */
    OneTime("one-time")

    companion object {
        fun fromJson(value: String): DiscountOfferType = when (value) {
            "introductory" -> DiscountOfferType.Introductory
            "INTRODUCTORY" -> DiscountOfferType.Introductory
            "Introductory" -> DiscountOfferType.Introductory
            "promotional" -> DiscountOfferType.Promotional
            "PROMOTIONAL" -> DiscountOfferType.Promotional
            "Promotional" -> DiscountOfferType.Promotional
            "one-time" -> DiscountOfferType.OneTime
            "ONE_TIME" -> DiscountOfferType.OneTime
            "OneTime" -> DiscountOfferType.OneTime
            else -> throw IllegalArgumentException("Unknown DiscountOfferType value: $value")
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
    EmptySkuList("empty-sku-list")

    companion object {
        fun fromJson(value: String): ErrorCode = when (value) {
            "unknown" -> ErrorCode.Unknown
            "UNKNOWN" -> ErrorCode.Unknown
            "Unknown" -> ErrorCode.Unknown
            "user-cancelled" -> ErrorCode.UserCancelled
            "USER_CANCELLED" -> ErrorCode.UserCancelled
            "UserCancelled" -> ErrorCode.UserCancelled
            "user-error" -> ErrorCode.UserError
            "USER_ERROR" -> ErrorCode.UserError
            "UserError" -> ErrorCode.UserError
            "item-unavailable" -> ErrorCode.ItemUnavailable
            "ITEM_UNAVAILABLE" -> ErrorCode.ItemUnavailable
            "ItemUnavailable" -> ErrorCode.ItemUnavailable
            "remote-error" -> ErrorCode.RemoteError
            "REMOTE_ERROR" -> ErrorCode.RemoteError
            "RemoteError" -> ErrorCode.RemoteError
            "network-error" -> ErrorCode.NetworkError
            "NETWORK_ERROR" -> ErrorCode.NetworkError
            "NetworkError" -> ErrorCode.NetworkError
            "service-error" -> ErrorCode.ServiceError
            "SERVICE_ERROR" -> ErrorCode.ServiceError
            "ServiceError" -> ErrorCode.ServiceError
            "receipt-failed" -> ErrorCode.ReceiptFailed
            "RECEIPT_FAILED" -> ErrorCode.ReceiptFailed
            "ReceiptFailed" -> ErrorCode.ReceiptFailed
            "receipt-finished" -> ErrorCode.ReceiptFinished
            "RECEIPT_FINISHED" -> ErrorCode.ReceiptFinished
            "ReceiptFinished" -> ErrorCode.ReceiptFinished
            "receipt-finished-failed" -> ErrorCode.ReceiptFinishedFailed
            "RECEIPT_FINISHED_FAILED" -> ErrorCode.ReceiptFinishedFailed
            "ReceiptFinishedFailed" -> ErrorCode.ReceiptFinishedFailed
            "purchase-verification-failed" -> ErrorCode.PurchaseVerificationFailed
            "PURCHASE_VERIFICATION_FAILED" -> ErrorCode.PurchaseVerificationFailed
            "PurchaseVerificationFailed" -> ErrorCode.PurchaseVerificationFailed
            "purchase-verification-finished" -> ErrorCode.PurchaseVerificationFinished
            "PURCHASE_VERIFICATION_FINISHED" -> ErrorCode.PurchaseVerificationFinished
            "PurchaseVerificationFinished" -> ErrorCode.PurchaseVerificationFinished
            "purchase-verification-finish-failed" -> ErrorCode.PurchaseVerificationFinishFailed
            "PURCHASE_VERIFICATION_FINISH_FAILED" -> ErrorCode.PurchaseVerificationFinishFailed
            "PurchaseVerificationFinishFailed" -> ErrorCode.PurchaseVerificationFinishFailed
            "not-prepared" -> ErrorCode.NotPrepared
            "NOT_PREPARED" -> ErrorCode.NotPrepared
            "NotPrepared" -> ErrorCode.NotPrepared
            "not-ended" -> ErrorCode.NotEnded
            "NOT_ENDED" -> ErrorCode.NotEnded
            "NotEnded" -> ErrorCode.NotEnded
            "already-owned" -> ErrorCode.AlreadyOwned
            "ALREADY_OWNED" -> ErrorCode.AlreadyOwned
            "AlreadyOwned" -> ErrorCode.AlreadyOwned
            "developer-error" -> ErrorCode.DeveloperError
            "DEVELOPER_ERROR" -> ErrorCode.DeveloperError
            "DeveloperError" -> ErrorCode.DeveloperError
            "billing-response-json-parse-error" -> ErrorCode.BillingResponseJsonParseError
            "BILLING_RESPONSE_JSON_PARSE_ERROR" -> ErrorCode.BillingResponseJsonParseError
            "BillingResponseJsonParseError" -> ErrorCode.BillingResponseJsonParseError
            "deferred-payment" -> ErrorCode.DeferredPayment
            "DEFERRED_PAYMENT" -> ErrorCode.DeferredPayment
            "DeferredPayment" -> ErrorCode.DeferredPayment
            "interrupted" -> ErrorCode.Interrupted
            "INTERRUPTED" -> ErrorCode.Interrupted
            "Interrupted" -> ErrorCode.Interrupted
            "iap-not-available" -> ErrorCode.IapNotAvailable
            "IAP_NOT_AVAILABLE" -> ErrorCode.IapNotAvailable
            "IapNotAvailable" -> ErrorCode.IapNotAvailable
            "purchase-error" -> ErrorCode.PurchaseError
            "PURCHASE_ERROR" -> ErrorCode.PurchaseError
            "PurchaseError" -> ErrorCode.PurchaseError
            "sync-error" -> ErrorCode.SyncError
            "SYNC_ERROR" -> ErrorCode.SyncError
            "SyncError" -> ErrorCode.SyncError
            "transaction-validation-failed" -> ErrorCode.TransactionValidationFailed
            "TRANSACTION_VALIDATION_FAILED" -> ErrorCode.TransactionValidationFailed
            "TransactionValidationFailed" -> ErrorCode.TransactionValidationFailed
            "activity-unavailable" -> ErrorCode.ActivityUnavailable
            "ACTIVITY_UNAVAILABLE" -> ErrorCode.ActivityUnavailable
            "ActivityUnavailable" -> ErrorCode.ActivityUnavailable
            "already-prepared" -> ErrorCode.AlreadyPrepared
            "ALREADY_PREPARED" -> ErrorCode.AlreadyPrepared
            "AlreadyPrepared" -> ErrorCode.AlreadyPrepared
            "pending" -> ErrorCode.Pending
            "PENDING" -> ErrorCode.Pending
            "Pending" -> ErrorCode.Pending
            "connection-closed" -> ErrorCode.ConnectionClosed
            "CONNECTION_CLOSED" -> ErrorCode.ConnectionClosed
            "ConnectionClosed" -> ErrorCode.ConnectionClosed
            "init-connection" -> ErrorCode.InitConnection
            "INIT_CONNECTION" -> ErrorCode.InitConnection
            "InitConnection" -> ErrorCode.InitConnection
            "service-disconnected" -> ErrorCode.ServiceDisconnected
            "SERVICE_DISCONNECTED" -> ErrorCode.ServiceDisconnected
            "ServiceDisconnected" -> ErrorCode.ServiceDisconnected
            "query-product" -> ErrorCode.QueryProduct
            "QUERY_PRODUCT" -> ErrorCode.QueryProduct
            "QueryProduct" -> ErrorCode.QueryProduct
            "sku-not-found" -> ErrorCode.SkuNotFound
            "SKU_NOT_FOUND" -> ErrorCode.SkuNotFound
            "SkuNotFound" -> ErrorCode.SkuNotFound
            "sku-offer-mismatch" -> ErrorCode.SkuOfferMismatch
            "SKU_OFFER_MISMATCH" -> ErrorCode.SkuOfferMismatch
            "SkuOfferMismatch" -> ErrorCode.SkuOfferMismatch
            "item-not-owned" -> ErrorCode.ItemNotOwned
            "ITEM_NOT_OWNED" -> ErrorCode.ItemNotOwned
            "ItemNotOwned" -> ErrorCode.ItemNotOwned
            "billing-unavailable" -> ErrorCode.BillingUnavailable
            "BILLING_UNAVAILABLE" -> ErrorCode.BillingUnavailable
            "BillingUnavailable" -> ErrorCode.BillingUnavailable
            "feature-not-supported" -> ErrorCode.FeatureNotSupported
            "FEATURE_NOT_SUPPORTED" -> ErrorCode.FeatureNotSupported
            "FeatureNotSupported" -> ErrorCode.FeatureNotSupported
            "empty-sku-list" -> ErrorCode.EmptySkuList
            "EMPTY_SKU_LIST" -> ErrorCode.EmptySkuList
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
    CallerWillLaunchLink("caller-will-launch-link")

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
    LinkToAppDownload("link-to-app-download")

    companion object {
        fun fromJson(value: String): ExternalLinkTypeAndroid = when (value) {
            "unspecified" -> ExternalLinkTypeAndroid.Unspecified
            "UNSPECIFIED" -> ExternalLinkTypeAndroid.Unspecified
            "link-to-digital-content-offer" -> ExternalLinkTypeAndroid.LinkToDigitalContentOffer
            "LINK_TO_DIGITAL_CONTENT_OFFER" -> ExternalLinkTypeAndroid.LinkToDigitalContentOffer
            "link-to-app-download" -> ExternalLinkTypeAndroid.LinkToAppDownload
            "LINK_TO_APP_DOWNLOAD" -> ExternalLinkTypeAndroid.LinkToAppDownload
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
    Dismissed("dismissed")

    companion object {
        fun fromJson(value: String): ExternalPurchaseNoticeAction = when (value) {
            "continue" -> ExternalPurchaseNoticeAction.Continue
            "CONTINUE" -> ExternalPurchaseNoticeAction.Continue
            "Continue" -> ExternalPurchaseNoticeAction.Continue
            "dismissed" -> ExternalPurchaseNoticeAction.Dismissed
            "DISMISSED" -> ExternalPurchaseNoticeAction.Dismissed
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
    UserChoiceBillingAndroid("user-choice-billing-android"),
    /**
     * Fired when user selects developer-provided billing option in external payments flow.
     * Available on Android with Google Play Billing Library 8.3.0+
     */
    DeveloperProvidedBillingAndroid("developer-provided-billing-android")

    companion object {
        fun fromJson(value: String): IapEvent = when (value) {
            "purchase-updated" -> IapEvent.PurchaseUpdated
            "PURCHASE_UPDATED" -> IapEvent.PurchaseUpdated
            "PurchaseUpdated" -> IapEvent.PurchaseUpdated
            "purchase-error" -> IapEvent.PurchaseError
            "PURCHASE_ERROR" -> IapEvent.PurchaseError
            "PurchaseError" -> IapEvent.PurchaseError
            "promoted-product-ios" -> IapEvent.PromotedProductIos
            "PROMOTED_PRODUCT_IOS" -> IapEvent.PromotedProductIos
            "PromotedProductIOS" -> IapEvent.PromotedProductIos
            "user-choice-billing-android" -> IapEvent.UserChoiceBillingAndroid
            "USER_CHOICE_BILLING_ANDROID" -> IapEvent.UserChoiceBillingAndroid
            "UserChoiceBillingAndroid" -> IapEvent.UserChoiceBillingAndroid
            "developer-provided-billing-android" -> IapEvent.DeveloperProvidedBillingAndroid
            "DEVELOPER_PROVIDED_BILLING_ANDROID" -> IapEvent.DeveloperProvidedBillingAndroid
            "DeveloperProvidedBillingAndroid" -> IapEvent.DeveloperProvidedBillingAndroid
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
    Inauthentic("inauthentic")

    companion object {
        fun fromJson(value: String): IapkitPurchaseState = when (value) {
            "entitled" -> IapkitPurchaseState.Entitled
            "ENTITLED" -> IapkitPurchaseState.Entitled
            "pending-acknowledgment" -> IapkitPurchaseState.PendingAcknowledgment
            "PENDING_ACKNOWLEDGMENT" -> IapkitPurchaseState.PendingAcknowledgment
            "pending" -> IapkitPurchaseState.Pending
            "PENDING" -> IapkitPurchaseState.Pending
            "canceled" -> IapkitPurchaseState.Canceled
            "CANCELED" -> IapkitPurchaseState.Canceled
            "expired" -> IapkitPurchaseState.Expired
            "EXPIRED" -> IapkitPurchaseState.Expired
            "ready-to-consume" -> IapkitPurchaseState.ReadyToConsume
            "READY_TO_CONSUME" -> IapkitPurchaseState.ReadyToConsume
            "consumed" -> IapkitPurchaseState.Consumed
            "CONSUMED" -> IapkitPurchaseState.Consumed
            "unknown" -> IapkitPurchaseState.Unknown
            "UNKNOWN" -> IapkitPurchaseState.Unknown
            "inauthentic" -> IapkitPurchaseState.Inauthentic
            "INAUTHENTIC" -> IapkitPurchaseState.Inauthentic
            else -> throw IllegalArgumentException("Unknown IapkitPurchaseState value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class IapPlatform(val rawValue: String) {
    Ios("ios"),
    Android("android")

    companion object {
        fun fromJson(value: String): IapPlatform = when (value) {
            "ios" -> IapPlatform.Ios
            "IOS" -> IapPlatform.Ios
            "android" -> IapPlatform.Android
            "ANDROID" -> IapPlatform.Android
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
    Horizon("horizon")

    companion object {
        fun fromJson(value: String): IapStore = when (value) {
            "unknown" -> IapStore.Unknown
            "UNKNOWN" -> IapStore.Unknown
            "Unknown" -> IapStore.Unknown
            "apple" -> IapStore.Apple
            "APPLE" -> IapStore.Apple
            "Apple" -> IapStore.Apple
            "google" -> IapStore.Google
            "GOOGLE" -> IapStore.Google
            "Google" -> IapStore.Google
            "horizon" -> IapStore.Horizon
            "HORIZON" -> IapStore.Horizon
            "Horizon" -> IapStore.Horizon
            else -> throw IllegalArgumentException("Unknown IapStore value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Payment mode for subscription offers.
 * Determines how the user pays during the offer period.
 */
public enum class PaymentMode(val rawValue: String) {
    /**
     * Free trial period - no charge during offer
     */
    FreeTrial("free-trial"),
    /**
     * Pay each period at reduced price
     */
    PayAsYouGo("pay-as-you-go"),
    /**
     * Pay full discounted amount upfront
     */
    PayUpFront("pay-up-front"),
    /**
     * Unknown or unspecified payment mode
     */
    Unknown("unknown")

    companion object {
        fun fromJson(value: String): PaymentMode = when (value) {
            "free-trial" -> PaymentMode.FreeTrial
            "FREE_TRIAL" -> PaymentMode.FreeTrial
            "FreeTrial" -> PaymentMode.FreeTrial
            "pay-as-you-go" -> PaymentMode.PayAsYouGo
            "PAY_AS_YOU_GO" -> PaymentMode.PayAsYouGo
            "PayAsYouGo" -> PaymentMode.PayAsYouGo
            "pay-up-front" -> PaymentMode.PayUpFront
            "PAY_UP_FRONT" -> PaymentMode.PayUpFront
            "PayUpFront" -> PaymentMode.PayUpFront
            "unknown" -> PaymentMode.Unknown
            "UNKNOWN" -> PaymentMode.Unknown
            "Unknown" -> PaymentMode.Unknown
            else -> throw IllegalArgumentException("Unknown PaymentMode value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PaymentModeIOS(val rawValue: String) {
    Empty("empty"),
    FreeTrial("free-trial"),
    PayAsYouGo("pay-as-you-go"),
    PayUpFront("pay-up-front")

    companion object {
        fun fromJson(value: String): PaymentModeIOS = when (value) {
            "empty" -> PaymentModeIOS.Empty
            "EMPTY" -> PaymentModeIOS.Empty
            "Empty" -> PaymentModeIOS.Empty
            "free-trial" -> PaymentModeIOS.FreeTrial
            "FREE_TRIAL" -> PaymentModeIOS.FreeTrial
            "FreeTrial" -> PaymentModeIOS.FreeTrial
            "pay-as-you-go" -> PaymentModeIOS.PayAsYouGo
            "PAY_AS_YOU_GO" -> PaymentModeIOS.PayAsYouGo
            "PayAsYouGo" -> PaymentModeIOS.PayAsYouGo
            "pay-up-front" -> PaymentModeIOS.PayUpFront
            "PAY_UP_FRONT" -> PaymentModeIOS.PayUpFront
            "PayUpFront" -> PaymentModeIOS.PayUpFront
            else -> throw IllegalArgumentException("Unknown PaymentModeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ProductQueryType(val rawValue: String) {
    InApp("in-app"),
    Subs("subs"),
    All("all")

    companion object {
        fun fromJson(value: String): ProductQueryType = when (value) {
            "in-app" -> ProductQueryType.InApp
            "IN_APP" -> ProductQueryType.InApp
            "InApp" -> ProductQueryType.InApp
            "subs" -> ProductQueryType.Subs
            "SUBS" -> ProductQueryType.Subs
            "Subs" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            "ALL" -> ProductQueryType.All
            "All" -> ProductQueryType.All
            else -> throw IllegalArgumentException("Unknown ProductQueryType value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Status code for individual products returned from queryProductDetailsAsync (Android)
 * Prior to 8.0, products that couldn't be fetched were simply not returned.
 * With 8.0+, these products are returned with a status code explaining why.
 * Available in Google Play Billing Library 8.0.0+
 */
public enum class ProductStatusAndroid(val rawValue: String) {
    /**
     * Product was successfully fetched
     */
    Ok("ok"),
    /**
     * Product not found - the SKU doesn't exist in the Play Console
     */
    NotFound("not-found"),
    /**
     * No offers available for the user - product exists but user is not eligible for any offers
     */
    NoOffersAvailable("no-offers-available"),
    /**
     * Unknown error occurred while fetching the product
     */
    Unknown("unknown")

    companion object {
        fun fromJson(value: String): ProductStatusAndroid = when (value) {
            "ok" -> ProductStatusAndroid.Ok
            "OK" -> ProductStatusAndroid.Ok
            "not-found" -> ProductStatusAndroid.NotFound
            "NOT_FOUND" -> ProductStatusAndroid.NotFound
            "no-offers-available" -> ProductStatusAndroid.NoOffersAvailable
            "NO_OFFERS_AVAILABLE" -> ProductStatusAndroid.NoOffersAvailable
            "unknown" -> ProductStatusAndroid.Unknown
            "UNKNOWN" -> ProductStatusAndroid.Unknown
            else -> throw IllegalArgumentException("Unknown ProductStatusAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class ProductType(val rawValue: String) {
    InApp("in-app"),
    Subs("subs")

    companion object {
        fun fromJson(value: String): ProductType = when (value) {
            "in-app" -> ProductType.InApp
            "IN_APP" -> ProductType.InApp
            "InApp" -> ProductType.InApp
            "subs" -> ProductType.Subs
            "SUBS" -> ProductType.Subs
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
    NonRenewingSubscription("non-renewing-subscription")

    companion object {
        fun fromJson(value: String): ProductTypeIOS = when (value) {
            "consumable" -> ProductTypeIOS.Consumable
            "CONSUMABLE" -> ProductTypeIOS.Consumable
            "Consumable" -> ProductTypeIOS.Consumable
            "non-consumable" -> ProductTypeIOS.NonConsumable
            "NON_CONSUMABLE" -> ProductTypeIOS.NonConsumable
            "NonConsumable" -> ProductTypeIOS.NonConsumable
            "auto-renewable-subscription" -> ProductTypeIOS.AutoRenewableSubscription
            "AUTO_RENEWABLE_SUBSCRIPTION" -> ProductTypeIOS.AutoRenewableSubscription
            "AutoRenewableSubscription" -> ProductTypeIOS.AutoRenewableSubscription
            "non-renewing-subscription" -> ProductTypeIOS.NonRenewingSubscription
            "NON_RENEWING_SUBSCRIPTION" -> ProductTypeIOS.NonRenewingSubscription
            "NonRenewingSubscription" -> ProductTypeIOS.NonRenewingSubscription
            else -> throw IllegalArgumentException("Unknown ProductTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PurchaseState(val rawValue: String) {
    Pending("pending"),
    Purchased("purchased"),
    Unknown("unknown")

    companion object {
        fun fromJson(value: String): PurchaseState = when (value) {
            "pending" -> PurchaseState.Pending
            "PENDING" -> PurchaseState.Pending
            "Pending" -> PurchaseState.Pending
            "purchased" -> PurchaseState.Purchased
            "PURCHASED" -> PurchaseState.Purchased
            "Purchased" -> PurchaseState.Purchased
            "unknown" -> PurchaseState.Unknown
            "UNKNOWN" -> PurchaseState.Unknown
            "Unknown" -> PurchaseState.Unknown
            else -> throw IllegalArgumentException("Unknown PurchaseState value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PurchaseVerificationProvider(val rawValue: String) {
    Iapkit("iapkit")

    companion object {
        fun fromJson(value: String): PurchaseVerificationProvider = when (value) {
            "iapkit" -> PurchaseVerificationProvider.Iapkit
            "IAPKIT" -> PurchaseVerificationProvider.Iapkit
            "Iapkit" -> PurchaseVerificationProvider.Iapkit
            else -> throw IllegalArgumentException("Unknown PurchaseVerificationProvider value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Sub-response codes for more granular purchase error information (Android)
 * Available in Google Play Billing Library 8.0.0+
 */
public enum class SubResponseCodeAndroid(val rawValue: String) {
    /**
     * No specific sub-response code applies
     */
    NoApplicableSubResponseCode("no-applicable-sub-response-code"),
    /**
     * User's payment method has insufficient funds
     */
    PaymentDeclinedDueToInsufficientFunds("payment-declined-due-to-insufficient-funds"),
    /**
     * User doesn't meet subscription offer eligibility requirements
     */
    UserIneligible("user-ineligible")

    companion object {
        fun fromJson(value: String): SubResponseCodeAndroid = when (value) {
            "no-applicable-sub-response-code" -> SubResponseCodeAndroid.NoApplicableSubResponseCode
            "NO_APPLICABLE_SUB_RESPONSE_CODE" -> SubResponseCodeAndroid.NoApplicableSubResponseCode
            "payment-declined-due-to-insufficient-funds" -> SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds
            "PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS" -> SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds
            "user-ineligible" -> SubResponseCodeAndroid.UserIneligible
            "USER_INELIGIBLE" -> SubResponseCodeAndroid.UserIneligible
            else -> throw IllegalArgumentException("Unknown SubResponseCodeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class SubscriptionOfferTypeIOS(val rawValue: String) {
    Introductory("introductory"),
    Promotional("promotional"),
    /**
     * Win-back offer type (iOS 18+)
     * Used to re-engage churned subscribers with a discount or free trial.
     */
    WinBack("win-back")

    companion object {
        fun fromJson(value: String): SubscriptionOfferTypeIOS = when (value) {
            "introductory" -> SubscriptionOfferTypeIOS.Introductory
            "INTRODUCTORY" -> SubscriptionOfferTypeIOS.Introductory
            "Introductory" -> SubscriptionOfferTypeIOS.Introductory
            "promotional" -> SubscriptionOfferTypeIOS.Promotional
            "PROMOTIONAL" -> SubscriptionOfferTypeIOS.Promotional
            "Promotional" -> SubscriptionOfferTypeIOS.Promotional
            "win-back" -> SubscriptionOfferTypeIOS.WinBack
            "WIN_BACK" -> SubscriptionOfferTypeIOS.WinBack
            "WinBack" -> SubscriptionOfferTypeIOS.WinBack
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
    Empty("empty")

    companion object {
        fun fromJson(value: String): SubscriptionPeriodIOS = when (value) {
            "day" -> SubscriptionPeriodIOS.Day
            "DAY" -> SubscriptionPeriodIOS.Day
            "Day" -> SubscriptionPeriodIOS.Day
            "week" -> SubscriptionPeriodIOS.Week
            "WEEK" -> SubscriptionPeriodIOS.Week
            "Week" -> SubscriptionPeriodIOS.Week
            "month" -> SubscriptionPeriodIOS.Month
            "MONTH" -> SubscriptionPeriodIOS.Month
            "Month" -> SubscriptionPeriodIOS.Month
            "year" -> SubscriptionPeriodIOS.Year
            "YEAR" -> SubscriptionPeriodIOS.Year
            "Year" -> SubscriptionPeriodIOS.Year
            "empty" -> SubscriptionPeriodIOS.Empty
            "EMPTY" -> SubscriptionPeriodIOS.Empty
            "Empty" -> SubscriptionPeriodIOS.Empty
            else -> throw IllegalArgumentException("Unknown SubscriptionPeriodIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Subscription period unit for cross-platform use.
 */
public enum class SubscriptionPeriodUnit(val rawValue: String) {
    Day("day"),
    Week("week"),
    Month("month"),
    Year("year"),
    Unknown("unknown")

    companion object {
        fun fromJson(value: String): SubscriptionPeriodUnit = when (value) {
            "day" -> SubscriptionPeriodUnit.Day
            "DAY" -> SubscriptionPeriodUnit.Day
            "Day" -> SubscriptionPeriodUnit.Day
            "week" -> SubscriptionPeriodUnit.Week
            "WEEK" -> SubscriptionPeriodUnit.Week
            "Week" -> SubscriptionPeriodUnit.Week
            "month" -> SubscriptionPeriodUnit.Month
            "MONTH" -> SubscriptionPeriodUnit.Month
            "Month" -> SubscriptionPeriodUnit.Month
            "year" -> SubscriptionPeriodUnit.Year
            "YEAR" -> SubscriptionPeriodUnit.Year
            "Year" -> SubscriptionPeriodUnit.Year
            "unknown" -> SubscriptionPeriodUnit.Unknown
            "UNKNOWN" -> SubscriptionPeriodUnit.Unknown
            "Unknown" -> SubscriptionPeriodUnit.Unknown
            else -> throw IllegalArgumentException("Unknown SubscriptionPeriodUnit value: $value")
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
    KeepExisting("keep-existing")

    companion object {
        fun fromJson(value: String): SubscriptionReplacementModeAndroid = when (value) {
            "unknown-replacement-mode" -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
            "UNKNOWN_REPLACEMENT_MODE" -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
            "with-time-proration" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "WITH_TIME_PRORATION" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "charge-prorated-price" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "CHARGE_PRORATED_PRICE" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "charge-full-price" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "CHARGE_FULL_PRICE" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "without-proration" -> SubscriptionReplacementModeAndroid.WithoutProration
            "WITHOUT_PRORATION" -> SubscriptionReplacementModeAndroid.WithoutProration
            "deferred" -> SubscriptionReplacementModeAndroid.Deferred
            "DEFERRED" -> SubscriptionReplacementModeAndroid.Deferred
            "keep-existing" -> SubscriptionReplacementModeAndroid.KeepExisting
            "KEEP_EXISTING" -> SubscriptionReplacementModeAndroid.KeepExisting
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
                autoRenewingAndroid = json["autoRenewingAndroid"] as? Boolean,
                basePlanIdAndroid = json["basePlanIdAndroid"] as? String,
                currentPlanId = json["currentPlanId"] as? String,
                daysUntilExpirationIOS = (json["daysUntilExpirationIOS"] as? Number)?.toDouble(),
                environmentIOS = json["environmentIOS"] as? String,
                expirationDateIOS = (json["expirationDateIOS"] as? Number)?.toDouble(),
                isActive = json["isActive"] as? Boolean ?: false,
                productId = json["productId"] as? String ?: "",
                purchaseToken = json["purchaseToken"] as? String,
                purchaseTokenAndroid = json["purchaseTokenAndroid"] as? String,
                renewalInfoIOS = (json["renewalInfoIOS"] as? Map<String, Any?>)?.let { RenewalInfoIOS.fromJson(it) },
                transactionDate = (json["transactionDate"] as? Number)?.toDouble() ?: 0.0,
                transactionId = json["transactionId"] as? String ?: "",
                willExpireSoon = json["willExpireSoon"] as? Boolean,
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
                appId = (json["appId"] as? Number)?.toDouble() ?: 0.0,
                appTransactionId = json["appTransactionId"] as? String,
                appVersion = json["appVersion"] as? String ?: "",
                appVersionId = (json["appVersionId"] as? Number)?.toDouble() ?: 0.0,
                bundleId = json["bundleId"] as? String ?: "",
                deviceVerification = json["deviceVerification"] as? String ?: "",
                deviceVerificationNonce = json["deviceVerificationNonce"] as? String ?: "",
                environment = json["environment"] as? String ?: "",
                originalAppVersion = json["originalAppVersion"] as? String ?: "",
                originalPlatform = json["originalPlatform"] as? String,
                originalPurchaseDate = (json["originalPurchaseDate"] as? Number)?.toDouble() ?: 0.0,
                preorderDate = (json["preorderDate"] as? Number)?.toDouble(),
                signedDate = (json["signedDate"] as? Number)?.toDouble() ?: 0.0,
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
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified,
                isAvailable = json["isAvailable"] as? Boolean ?: false,
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
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified,
                externalTransactionToken = json["externalTransactionToken"] as? String ?: "",
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
 * Extended billing result with sub-response code (Android)
 * Available in Google Play Billing Library 8.0.0+
 */
public data class BillingResultAndroid(
    /**
     * Debug message from the billing library
     */
    val debugMessage: String? = null,
    /**
     * The response code from the billing operation
     */
    val responseCode: Int,
    /**
     * Sub-response code for more granular error information (8.0+).
     * Provides additional context when responseCode indicates an error.
     */
    val subResponseCode: SubResponseCodeAndroid? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BillingResultAndroid {
            return BillingResultAndroid(
                debugMessage = json["debugMessage"] as? String,
                responseCode = (json["responseCode"] as? Number)?.toInt() ?: 0,
                subResponseCode = (json["subResponseCode"] as? String)?.let { SubResponseCodeAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BillingResultAndroid",
        "debugMessage" to debugMessage,
        "responseCode" to responseCode,
        "subResponseCode" to subResponseCode?.toJson(),
    )
}

/**
 * Details provided when user selects developer billing option (Android)
 * Received via DeveloperProvidedBillingListener callback
 * Available in Google Play Billing Library 8.3.0+
 */
public data class DeveloperProvidedBillingDetailsAndroid(
    /**
     * External transaction token used to report transactions made through developer billing.
     * This token must be used when reporting the external transaction to Google Play.
     * Must be reported within 24 hours of the transaction.
     */
    val externalTransactionToken: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DeveloperProvidedBillingDetailsAndroid {
            return DeveloperProvidedBillingDetailsAndroid(
                externalTransactionToken = json["externalTransactionToken"] as? String ?: "",
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DeveloperProvidedBillingDetailsAndroid",
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
                discountAmountMicros = json["discountAmountMicros"] as? String ?: "",
                formattedDiscountAmount = json["formattedDiscountAmount"] as? String ?: "",
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
                discountAmount = (json["discountAmount"] as? Map<String, Any?>)?.let { DiscountAmountAndroid.fromJson(it) },
                percentageDiscount = (json["percentageDiscount"] as? Number)?.toInt(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountDisplayInfoAndroid",
        "discountAmount" to discountAmount?.toJson(),
        "percentageDiscount" to percentageDiscount,
    )
}

/**
 * Discount information returned from the store.
 * @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
 * @see https://openiap.dev/docs/types#subscription-offer
 */
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
                identifier = json["identifier"] as? String ?: "",
                localizedPrice = json["localizedPrice"] as? String,
                numberOfPeriods = (json["numberOfPeriods"] as? Number)?.toInt() ?: 0,
                paymentMode = (json["paymentMode"] as? String)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                price = json["price"] as? String ?: "",
                priceAmount = (json["priceAmount"] as? Number)?.toDouble() ?: 0.0,
                subscriptionPeriod = json["subscriptionPeriod"] as? String ?: "",
                type = json["type"] as? String ?: "",
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

/**
 * Standardized one-time product discount offer.
 * Provides a unified interface for one-time purchase discounts across platforms.
 * 
 * Currently supported on Android (Google Play Billing 7.0+).
 * iOS does not support one-time purchase discounts in the same way.
 * 
 * @see https://openiap.dev/docs/features/discount
 */
public data class DiscountOffer(
    /**
     * Currency code (ISO 4217, e.g., "USD")
     */
    val currency: String,
    /**
     * [Android] Fixed discount amount in micro-units.
     * Only present for fixed amount discounts.
     */
    val discountAmountMicrosAndroid: String? = null,
    /**
     * Formatted display price string (e.g., "$4.99")
     */
    val displayPrice: String,
    /**
     * [Android] Formatted discount amount string (e.g., "$5.00 OFF").
     */
    val formattedDiscountAmountAndroid: String? = null,
    /**
     * [Android] Original full price in micro-units before discount.
     * Divide by 1,000,000 to get the actual price.
     * Use for displaying strikethrough original price.
     */
    val fullPriceMicrosAndroid: String? = null,
    /**
     * Unique identifier for the offer.
     * - iOS: Not applicable (one-time discounts not supported)
     * - Android: offerId from ProductAndroidOneTimePurchaseOfferDetail
     */
    val id: String? = null,
    /**
     * [Android] Limited quantity information.
     * Contains maximumQuantity and remainingQuantity.
     */
    val limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid? = null,
    /**
     * [Android] List of tags associated with this offer.
     */
    val offerTagsAndroid: List<String>? = null,
    /**
     * [Android] Offer token required for purchase.
     * Must be passed to requestPurchase() when purchasing with this offer.
     */
    val offerTokenAndroid: String? = null,
    /**
     * [Android] Percentage discount (e.g., 33 for 33% off).
     * Only present for percentage-based discounts.
     */
    val percentageDiscountAndroid: Int? = null,
    /**
     * [Android] Pre-order details if this is a pre-order offer.
     * Available in Google Play Billing Library 8.1.0+
     */
    val preorderDetailsAndroid: PreorderDetailsAndroid? = null,
    /**
     * Numeric price value
     */
    val price: Double,
    /**
     * [Android] Rental details if this is a rental offer.
     */
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    /**
     * Type of discount offer
     */
    val type: DiscountOfferType,
    /**
     * [Android] Valid time window for the offer.
     * Contains startTimeMillis and endTimeMillis.
     */
    val validTimeWindowAndroid: ValidTimeWindowAndroid? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DiscountOffer {
            return DiscountOffer(
                currency = json["currency"] as? String ?: "",
                discountAmountMicrosAndroid = json["discountAmountMicrosAndroid"] as? String,
                displayPrice = json["displayPrice"] as? String ?: "",
                formattedDiscountAmountAndroid = json["formattedDiscountAmountAndroid"] as? String,
                fullPriceMicrosAndroid = json["fullPriceMicrosAndroid"] as? String,
                id = json["id"] as? String,
                limitedQuantityInfoAndroid = (json["limitedQuantityInfoAndroid"] as? Map<String, Any?>)?.let { LimitedQuantityInfoAndroid.fromJson(it) },
                offerTagsAndroid = (json["offerTagsAndroid"] as? List<*>)?.mapNotNull { it as? String },
                offerTokenAndroid = json["offerTokenAndroid"] as? String,
                percentageDiscountAndroid = (json["percentageDiscountAndroid"] as? Number)?.toInt(),
                preorderDetailsAndroid = (json["preorderDetailsAndroid"] as? Map<String, Any?>)?.let { PreorderDetailsAndroid.fromJson(it) },
                price = (json["price"] as? Number)?.toDouble() ?: 0.0,
                rentalDetailsAndroid = (json["rentalDetailsAndroid"] as? Map<String, Any?>)?.let { RentalDetailsAndroid.fromJson(it) },
                type = (json["type"] as? String)?.let { DiscountOfferType.fromJson(it) } ?: DiscountOfferType.Introductory,
                validTimeWindowAndroid = (json["validTimeWindowAndroid"] as? Map<String, Any?>)?.let { ValidTimeWindowAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DiscountOffer",
        "currency" to currency,
        "discountAmountMicrosAndroid" to discountAmountMicrosAndroid,
        "displayPrice" to displayPrice,
        "formattedDiscountAmountAndroid" to formattedDiscountAmountAndroid,
        "fullPriceMicrosAndroid" to fullPriceMicrosAndroid,
        "id" to id,
        "limitedQuantityInfoAndroid" to limitedQuantityInfoAndroid?.toJson(),
        "offerTagsAndroid" to offerTagsAndroid,
        "offerTokenAndroid" to offerTokenAndroid,
        "percentageDiscountAndroid" to percentageDiscountAndroid,
        "preorderDetailsAndroid" to preorderDetailsAndroid?.toJson(),
        "price" to price,
        "rentalDetailsAndroid" to rentalDetailsAndroid?.toJson(),
        "type" to type.toJson(),
        "validTimeWindowAndroid" to validTimeWindowAndroid?.toJson(),
    )
}

/**
 * iOS DiscountOffer (output type).
 * @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
 * @see https://openiap.dev/docs/types#subscription-offer
 */
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
                identifier = json["identifier"] as? String ?: "",
                keyIdentifier = json["keyIdentifier"] as? String ?: "",
                nonce = json["nonce"] as? String ?: "",
                signature = json["signature"] as? String ?: "",
                timestamp = (json["timestamp"] as? Number)?.toDouble() ?: 0.0,
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
                jsonRepresentation = json["jsonRepresentation"] as? String ?: "",
                sku = json["sku"] as? String ?: "",
                transactionId = json["transactionId"] as? String ?: "",
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
                isAvailable = json["isAvailable"] as? Boolean ?: false,
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
                externalTransactionToken = json["externalTransactionToken"] as? String ?: "",
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
                error = json["error"] as? String,
                success = json["success"] as? Boolean ?: false,
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
                error = json["error"] as? String,
                result = (json["result"] as? String)?.let { ExternalPurchaseNoticeAction.fromJson(it) } ?: ExternalPurchaseNoticeAction.Continue,
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
                maximumQuantity = (json["maximumQuantity"] as? Number)?.toInt() ?: 0,
                remainingQuantity = (json["remainingQuantity"] as? Number)?.toInt() ?: 0,
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
                preorderPresaleEndTimeMillis = json["preorderPresaleEndTimeMillis"] as? String ?: "",
                preorderReleaseTimeMillis = json["preorderReleaseTimeMillis"] as? String ?: "",
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
                billingCycleCount = (json["billingCycleCount"] as? Number)?.toInt() ?: 0,
                billingPeriod = json["billingPeriod"] as? String ?: "",
                formattedPrice = json["formattedPrice"] as? String ?: "",
                priceAmountMicros = json["priceAmountMicros"] as? String ?: "",
                priceCurrencyCode = json["priceCurrencyCode"] as? String ?: "",
                recurrenceMode = (json["recurrenceMode"] as? Number)?.toInt() ?: 0,
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
                pricingPhaseList = (json["pricingPhaseList"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { PricingPhaseAndroid.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for PricingPhaseAndroid") } ?: emptyList(),
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
    /**
     * Standardized discount offers for one-time products.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types#discount-offer
     */
    val discountOffers: List<DiscountOffer>? = null,
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
    /**
     * One-time purchase offer details including discounts (Android)
     * Returns all eligible offers. Available in Google Play Billing Library 7.0+
     * @deprecated Use discountOffers instead for cross-platform compatibility.
     */
    val oneTimePurchaseOfferDetailsAndroid: List<ProductAndroidOneTimePurchaseOfferDetail>? = null,
    override val platform: IapPlatform = IapPlatform.Android,
    override val price: Double? = null,
    /**
     * Product-level status code indicating fetch result (Android 8.0+)
     * OK = product fetched successfully
     * NOT_FOUND = SKU doesn't exist
     * NO_OFFERS_AVAILABLE = user not eligible for any offers
     * Available in Google Play Billing Library 8.0.0+
     */
    val productStatusAndroid: ProductStatusAndroid? = null,
    /**
     * @deprecated Use subscriptionOffers instead for cross-platform compatibility.
     */
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>? = null,
    /**
     * Standardized subscription offers.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types#subscription-offer
     */
    val subscriptionOffers: List<SubscriptionOffer>? = null,
    override val title: String,
    override val type: ProductType = ProductType.InApp
) : ProductCommon, Product {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductAndroid {
            return ProductAndroid(
                currency = json["currency"] as? String ?: "",
                debugDescription = json["debugDescription"] as? String,
                description = json["description"] as? String ?: "",
                discountOffers = (json["discountOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { DiscountOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for DiscountOffer") },
                displayName = json["displayName"] as? String,
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                nameAndroid = json["nameAndroid"] as? String ?: "",
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { ProductAndroidOneTimePurchaseOfferDetail.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for ProductAndroidOneTimePurchaseOfferDetail") },
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                productStatusAndroid = (json["productStatusAndroid"] as? String)?.let { ProductStatusAndroid.fromJson(it) },
                subscriptionOfferDetailsAndroid = (json["subscriptionOfferDetailsAndroid"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { ProductSubscriptionAndroidOfferDetails.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for ProductSubscriptionAndroidOfferDetails") },
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOffer") },
                title = json["title"] as? String ?: "",
                type = (json["type"] as? String)?.let { ProductType.fromJson(it) } ?: ProductType.InApp,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductAndroid",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "discountOffers" to discountOffers?.map { it.toJson() },
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "nameAndroid" to nameAndroid,
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.map { it.toJson() },
        "platform" to platform.toJson(),
        "price" to price,
        "productStatusAndroid" to productStatusAndroid?.toJson(),
        "subscriptionOfferDetailsAndroid" to subscriptionOfferDetailsAndroid?.map { it.toJson() },
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

/**
 * One-time purchase offer details (Android).
 * Available in Google Play Billing Library 7.0+
 * @deprecated Use the standardized DiscountOffer type instead for cross-platform compatibility.
 * @see https://openiap.dev/docs/types#discount-offer
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
                discountDisplayInfo = (json["discountDisplayInfo"] as? Map<String, Any?>)?.let { DiscountDisplayInfoAndroid.fromJson(it) },
                formattedPrice = json["formattedPrice"] as? String ?: "",
                fullPriceMicros = json["fullPriceMicros"] as? String,
                limitedQuantityInfo = (json["limitedQuantityInfo"] as? Map<String, Any?>)?.let { LimitedQuantityInfoAndroid.fromJson(it) },
                offerId = json["offerId"] as? String,
                offerTags = (json["offerTags"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                offerToken = json["offerToken"] as? String ?: "",
                preorderDetailsAndroid = (json["preorderDetailsAndroid"] as? Map<String, Any?>)?.let { PreorderDetailsAndroid.fromJson(it) },
                priceAmountMicros = json["priceAmountMicros"] as? String ?: "",
                priceCurrencyCode = json["priceCurrencyCode"] as? String ?: "",
                rentalDetailsAndroid = (json["rentalDetailsAndroid"] as? Map<String, Any?>)?.let { RentalDetailsAndroid.fromJson(it) },
                validTimeWindow = (json["validTimeWindow"] as? Map<String, Any?>)?.let { ValidTimeWindowAndroid.fromJson(it) },
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
        "offerTags" to offerTags,
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
    /**
     * @deprecated Use subscriptionOffers instead for cross-platform compatibility.
     */
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    /**
     * Standardized subscription offers.
     * Cross-platform type with iOS-specific fields using suffix.
     * Note: iOS does not support one-time product discounts.
     * @see https://openiap.dev/docs/types#subscription-offer
     */
    val subscriptionOffers: List<SubscriptionOffer>? = null,
    override val title: String,
    override val type: ProductType = ProductType.InApp,
    val typeIOS: ProductTypeIOS
) : ProductCommon, Product {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductIOS {
            return ProductIOS(
                currency = json["currency"] as? String ?: "",
                debugDescription = json["debugDescription"] as? String,
                description = json["description"] as? String ?: "",
                displayName = json["displayName"] as? String,
                displayNameIOS = json["displayNameIOS"] as? String ?: "",
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                isFamilyShareableIOS = json["isFamilyShareableIOS"] as? Boolean ?: false,
                jsonRepresentationIOS = json["jsonRepresentationIOS"] as? String ?: "",
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                subscriptionInfoIOS = (json["subscriptionInfoIOS"] as? Map<String, Any?>)?.let { SubscriptionInfoIOS.fromJson(it) },
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOffer") },
                title = json["title"] as? String ?: "",
                type = (json["type"] as? String)?.let { ProductType.fromJson(it) } ?: ProductType.InApp,
                typeIOS = (json["typeIOS"] as? String)?.let { ProductTypeIOS.fromJson(it) } ?: ProductTypeIOS.Consumable,
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
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
        "typeIOS" to typeIOS.toJson(),
    )
}

public data class ProductSubscriptionAndroid(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    /**
     * Standardized discount offers for one-time products.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types#discount-offer
     */
    val discountOffers: List<DiscountOffer>? = null,
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
    /**
     * One-time purchase offer details including discounts (Android)
     * Returns all eligible offers. Available in Google Play Billing Library 7.0+
     * @deprecated Use discountOffers instead for cross-platform compatibility.
     */
    val oneTimePurchaseOfferDetailsAndroid: List<ProductAndroidOneTimePurchaseOfferDetail>? = null,
    override val platform: IapPlatform = IapPlatform.Android,
    override val price: Double? = null,
    /**
     * Product-level status code indicating fetch result (Android 8.0+)
     * OK = product fetched successfully
     * NOT_FOUND = SKU doesn't exist
     * NO_OFFERS_AVAILABLE = user not eligible for any offers
     * Available in Google Play Billing Library 8.0.0+
     */
    val productStatusAndroid: ProductStatusAndroid? = null,
    /**
     * @deprecated Use subscriptionOffers instead for cross-platform compatibility.
     */
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>,
    /**
     * Standardized subscription offers.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types#subscription-offer
     */
    val subscriptionOffers: List<SubscriptionOffer>,
    override val title: String,
    override val type: ProductType = ProductType.Subs
) : ProductCommon, ProductSubscription {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscriptionAndroid {
            return ProductSubscriptionAndroid(
                currency = json["currency"] as? String ?: "",
                debugDescription = json["debugDescription"] as? String,
                description = json["description"] as? String ?: "",
                discountOffers = (json["discountOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { DiscountOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for DiscountOffer") },
                displayName = json["displayName"] as? String,
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                nameAndroid = json["nameAndroid"] as? String ?: "",
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { ProductAndroidOneTimePurchaseOfferDetail.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for ProductAndroidOneTimePurchaseOfferDetail") },
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                productStatusAndroid = (json["productStatusAndroid"] as? String)?.let { ProductStatusAndroid.fromJson(it) },
                subscriptionOfferDetailsAndroid = (json["subscriptionOfferDetailsAndroid"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { ProductSubscriptionAndroidOfferDetails.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for ProductSubscriptionAndroidOfferDetails") } ?: emptyList(),
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOffer") } ?: emptyList(),
                title = json["title"] as? String ?: "",
                type = (json["type"] as? String)?.let { ProductType.fromJson(it) } ?: ProductType.InApp,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductSubscriptionAndroid",
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
        "discountOffers" to discountOffers?.map { it.toJson() },
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "nameAndroid" to nameAndroid,
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.map { it.toJson() },
        "platform" to platform.toJson(),
        "price" to price,
        "productStatusAndroid" to productStatusAndroid?.toJson(),
        "subscriptionOfferDetailsAndroid" to subscriptionOfferDetailsAndroid.map { it.toJson() },
        "subscriptionOffers" to subscriptionOffers.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

/**
 * Subscription offer details (Android).
 * @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
 * @see https://openiap.dev/docs/types#subscription-offer
 */
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
                basePlanId = json["basePlanId"] as? String ?: "",
                offerId = json["offerId"] as? String,
                offerTags = (json["offerTags"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                offerToken = json["offerToken"] as? String ?: "",
                pricingPhases = (json["pricingPhases"] as? Map<String, Any?>)?.let { PricingPhasesAndroid.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for PricingPhasesAndroid"),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductSubscriptionAndroidOfferDetails",
        "basePlanId" to basePlanId,
        "offerId" to offerId,
        "offerTags" to offerTags,
        "offerToken" to offerToken,
        "pricingPhases" to pricingPhases.toJson(),
    )
}

public data class ProductSubscriptionIOS(
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
    /**
     * @deprecated Use subscriptionOffers instead for cross-platform compatibility.
     */
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
    /**
     * @deprecated Use subscriptionOffers instead for cross-platform compatibility.
     */
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    /**
     * Standardized subscription offers.
     * Cross-platform type with iOS-specific fields using suffix.
     * @see https://openiap.dev/docs/types#subscription-offer
     */
    val subscriptionOffers: List<SubscriptionOffer>? = null,
    val subscriptionPeriodNumberIOS: String? = null,
    val subscriptionPeriodUnitIOS: SubscriptionPeriodIOS? = null,
    override val title: String,
    override val type: ProductType = ProductType.Subs,
    val typeIOS: ProductTypeIOS
) : ProductCommon, ProductSubscription {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductSubscriptionIOS {
            return ProductSubscriptionIOS(
                currency = json["currency"] as? String ?: "",
                debugDescription = json["debugDescription"] as? String,
                description = json["description"] as? String ?: "",
                discountsIOS = (json["discountsIOS"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { DiscountIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for DiscountIOS") },
                displayName = json["displayName"] as? String,
                displayNameIOS = json["displayNameIOS"] as? String ?: "",
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                introductoryPriceAsAmountIOS = json["introductoryPriceAsAmountIOS"] as? String,
                introductoryPriceIOS = json["introductoryPriceIOS"] as? String,
                introductoryPriceNumberOfPeriodsIOS = json["introductoryPriceNumberOfPeriodsIOS"] as? String,
                introductoryPricePaymentModeIOS = (json["introductoryPricePaymentModeIOS"] as? String)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                introductoryPriceSubscriptionPeriodIOS = (json["introductoryPriceSubscriptionPeriodIOS"] as? String)?.let { SubscriptionPeriodIOS.fromJson(it) },
                isFamilyShareableIOS = json["isFamilyShareableIOS"] as? Boolean ?: false,
                jsonRepresentationIOS = json["jsonRepresentationIOS"] as? String ?: "",
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                subscriptionInfoIOS = (json["subscriptionInfoIOS"] as? Map<String, Any?>)?.let { SubscriptionInfoIOS.fromJson(it) },
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOffer") },
                subscriptionPeriodNumberIOS = json["subscriptionPeriodNumberIOS"] as? String,
                subscriptionPeriodUnitIOS = (json["subscriptionPeriodUnitIOS"] as? String)?.let { SubscriptionPeriodIOS.fromJson(it) },
                title = json["title"] as? String ?: "",
                type = (json["type"] as? String)?.let { ProductType.fromJson(it) } ?: ProductType.InApp,
                typeIOS = (json["typeIOS"] as? String)?.let { ProductTypeIOS.fromJson(it) } ?: ProductTypeIOS.Consumable,
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
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
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
                autoRenewingAndroid = json["autoRenewingAndroid"] as? Boolean,
                currentPlanId = json["currentPlanId"] as? String,
                dataAndroid = json["dataAndroid"] as? String,
                developerPayloadAndroid = json["developerPayloadAndroid"] as? String,
                id = json["id"] as? String ?: "",
                ids = (json["ids"] as? List<*>)?.mapNotNull { it as? String },
                isAcknowledgedAndroid = json["isAcknowledgedAndroid"] as? Boolean,
                isAutoRenewing = json["isAutoRenewing"] as? Boolean ?: false,
                isSuspendedAndroid = json["isSuspendedAndroid"] as? Boolean,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as? String,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as? String,
                packageNameAndroid = json["packageNameAndroid"] as? String,
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                productId = json["productId"] as? String ?: "",
                purchaseState = (json["purchaseState"] as? String)?.let { PurchaseState.fromJson(it) } ?: PurchaseState.Pending,
                purchaseToken = json["purchaseToken"] as? String,
                quantity = (json["quantity"] as? Number)?.toInt() ?: 0,
                signatureAndroid = json["signatureAndroid"] as? String,
                store = (json["store"] as? String)?.let { IapStore.fromJson(it) } ?: IapStore.Unknown,
                transactionDate = (json["transactionDate"] as? Number)?.toDouble() ?: 0.0,
                transactionId = json["transactionId"] as? String,
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
        "ids" to ids,
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
                code = (json["code"] as? String)?.let { ErrorCode.fromJson(it) } ?: ErrorCode.Unknown,
                message = json["message"] as? String ?: "",
                productId = json["productId"] as? String,
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
                appAccountToken = json["appAccountToken"] as? String,
                appBundleIdIOS = json["appBundleIdIOS"] as? String,
                countryCodeIOS = json["countryCodeIOS"] as? String,
                currencyCodeIOS = json["currencyCodeIOS"] as? String,
                currencySymbolIOS = json["currencySymbolIOS"] as? String,
                currentPlanId = json["currentPlanId"] as? String,
                environmentIOS = json["environmentIOS"] as? String,
                expirationDateIOS = (json["expirationDateIOS"] as? Number)?.toDouble(),
                id = json["id"] as? String ?: "",
                ids = (json["ids"] as? List<*>)?.mapNotNull { it as? String },
                isAutoRenewing = json["isAutoRenewing"] as? Boolean ?: false,
                isUpgradedIOS = json["isUpgradedIOS"] as? Boolean,
                offerIOS = (json["offerIOS"] as? Map<String, Any?>)?.let { PurchaseOfferIOS.fromJson(it) },
                originalTransactionDateIOS = (json["originalTransactionDateIOS"] as? Number)?.toDouble(),
                originalTransactionIdentifierIOS = json["originalTransactionIdentifierIOS"] as? String,
                ownershipTypeIOS = json["ownershipTypeIOS"] as? String,
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                productId = json["productId"] as? String ?: "",
                purchaseState = (json["purchaseState"] as? String)?.let { PurchaseState.fromJson(it) } ?: PurchaseState.Pending,
                purchaseToken = json["purchaseToken"] as? String,
                quantity = (json["quantity"] as? Number)?.toInt() ?: 0,
                quantityIOS = (json["quantityIOS"] as? Number)?.toInt(),
                reasonIOS = json["reasonIOS"] as? String,
                reasonStringRepresentationIOS = json["reasonStringRepresentationIOS"] as? String,
                renewalInfoIOS = (json["renewalInfoIOS"] as? Map<String, Any?>)?.let { RenewalInfoIOS.fromJson(it) },
                revocationDateIOS = (json["revocationDateIOS"] as? Number)?.toDouble(),
                revocationReasonIOS = json["revocationReasonIOS"] as? String,
                store = (json["store"] as? String)?.let { IapStore.fromJson(it) } ?: IapStore.Unknown,
                storefrontCountryCodeIOS = json["storefrontCountryCodeIOS"] as? String,
                subscriptionGroupIdIOS = json["subscriptionGroupIdIOS"] as? String,
                transactionDate = (json["transactionDate"] as? Number)?.toDouble() ?: 0.0,
                transactionId = json["transactionId"] as? String ?: "",
                transactionReasonIOS = json["transactionReasonIOS"] as? String,
                webOrderLineItemIdIOS = json["webOrderLineItemIdIOS"] as? String,
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
        "ids" to ids,
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
                id = json["id"] as? String ?: "",
                paymentMode = json["paymentMode"] as? String ?: "",
                type = json["type"] as? String ?: "",
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
                message = json["message"] as? String,
                status = json["status"] as? String ?: "",
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
                autoRenewPreference = json["autoRenewPreference"] as? String,
                expirationReason = json["expirationReason"] as? String,
                gracePeriodExpirationDate = (json["gracePeriodExpirationDate"] as? Number)?.toDouble(),
                isInBillingRetry = json["isInBillingRetry"] as? Boolean,
                jsonRepresentation = json["jsonRepresentation"] as? String,
                pendingUpgradeProductId = json["pendingUpgradeProductId"] as? String,
                priceIncreaseStatus = json["priceIncreaseStatus"] as? String,
                renewalDate = (json["renewalDate"] as? Number)?.toDouble(),
                renewalOfferId = json["renewalOfferId"] as? String,
                renewalOfferType = json["renewalOfferType"] as? String,
                willAutoRenew = json["willAutoRenew"] as? Boolean ?: false,
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
                rentalExpirationPeriod = json["rentalExpirationPeriod"] as? String,
                rentalPeriod = json["rentalPeriod"] as? String ?: "",
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
                isValid = json["isValid"] as? Boolean ?: false,
                state = (json["state"] as? String)?.let { IapkitPurchaseState.fromJson(it) } ?: IapkitPurchaseState.Entitled,
                store = (json["store"] as? String)?.let { IapStore.fromJson(it) } ?: IapStore.Unknown,
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
                introductoryOffer = (json["introductoryOffer"] as? Map<String, Any?>)?.let { SubscriptionOfferIOS.fromJson(it) },
                promotionalOffers = (json["promotionalOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOfferIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOfferIOS") },
                subscriptionGroupId = json["subscriptionGroupId"] as? String ?: "",
                subscriptionPeriod = (json["subscriptionPeriod"] as? Map<String, Any?>)?.let { SubscriptionPeriodValueIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPeriodValueIOS"),
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

/**
 * Standardized subscription discount/promotional offer.
 * Provides a unified interface for subscription offers across iOS and Android.
 * 
 * Both platforms support subscription offers with different implementations:
 * - iOS: Introductory offers, promotional offers with server-side signatures
 * - Android: Offer tokens with pricing phases
 * 
 * @see https://openiap.dev/docs/types/ios#discount-offer
 * @see https://openiap.dev/docs/types/android#subscription-offer
 */
public data class SubscriptionOffer(
    /**
     * [Android] Base plan identifier.
     * Identifies which base plan this offer belongs to.
     */
    val basePlanIdAndroid: String? = null,
    /**
     * Currency code (ISO 4217, e.g., "USD")
     */
    val currency: String? = null,
    /**
     * Formatted display price string (e.g., "$9.99/month")
     */
    val displayPrice: String,
    /**
     * Unique identifier for the offer.
     * - iOS: Discount identifier from App Store Connect
     * - Android: offerId from ProductSubscriptionAndroidOfferDetails
     */
    val id: String,
    /**
     * [iOS] Key identifier for signature validation.
     * Used with server-side signature generation for promotional offers.
     */
    val keyIdentifierIOS: String? = null,
    /**
     * [iOS] Localized price string.
     */
    val localizedPriceIOS: String? = null,
    /**
     * [iOS] Cryptographic nonce (UUID) for signature validation.
     * Must be generated server-side for each purchase attempt.
     */
    val nonceIOS: String? = null,
    /**
     * [iOS] Number of billing periods for this discount.
     */
    val numberOfPeriodsIOS: Int? = null,
    /**
     * [Android] List of tags associated with this offer.
     */
    val offerTagsAndroid: List<String>? = null,
    /**
     * [Android] Offer token required for purchase.
     * Must be passed to requestPurchase() when purchasing with this offer.
     */
    val offerTokenAndroid: String? = null,
    /**
     * Payment mode during the offer period
     */
    val paymentMode: PaymentMode? = null,
    /**
     * Subscription period for this offer
     */
    val period: SubscriptionPeriod? = null,
    /**
     * Number of periods the offer applies
     */
    val periodCount: Int? = null,
    /**
     * Numeric price value
     */
    val price: Double,
    /**
     * [Android] Pricing phases for this subscription offer.
     * Contains detailed pricing information for each phase (trial, intro, regular).
     */
    val pricingPhasesAndroid: PricingPhasesAndroid? = null,
    /**
     * [iOS] Server-generated signature for promotional offer validation.
     * Required when applying promotional offers on iOS.
     */
    val signatureIOS: String? = null,
    /**
     * [iOS] Timestamp when the signature was generated.
     * Used for signature validation.
     */
    val timestampIOS: Double? = null,
    /**
     * Type of subscription offer (Introductory or Promotional)
     */
    val type: DiscountOfferType
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionOffer {
            return SubscriptionOffer(
                basePlanIdAndroid = json["basePlanIdAndroid"] as? String,
                currency = json["currency"] as? String,
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                keyIdentifierIOS = json["keyIdentifierIOS"] as? String,
                localizedPriceIOS = json["localizedPriceIOS"] as? String,
                nonceIOS = json["nonceIOS"] as? String,
                numberOfPeriodsIOS = (json["numberOfPeriodsIOS"] as? Number)?.toInt(),
                offerTagsAndroid = (json["offerTagsAndroid"] as? List<*>)?.mapNotNull { it as? String },
                offerTokenAndroid = json["offerTokenAndroid"] as? String,
                paymentMode = (json["paymentMode"] as? String)?.let { PaymentMode.fromJson(it) },
                period = (json["period"] as? Map<String, Any?>)?.let { SubscriptionPeriod.fromJson(it) },
                periodCount = (json["periodCount"] as? Number)?.toInt(),
                price = (json["price"] as? Number)?.toDouble() ?: 0.0,
                pricingPhasesAndroid = (json["pricingPhasesAndroid"] as? Map<String, Any?>)?.let { PricingPhasesAndroid.fromJson(it) },
                signatureIOS = json["signatureIOS"] as? String,
                timestampIOS = (json["timestampIOS"] as? Number)?.toDouble(),
                type = (json["type"] as? String)?.let { DiscountOfferType.fromJson(it) } ?: DiscountOfferType.Introductory,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionOffer",
        "basePlanIdAndroid" to basePlanIdAndroid,
        "currency" to currency,
        "displayPrice" to displayPrice,
        "id" to id,
        "keyIdentifierIOS" to keyIdentifierIOS,
        "localizedPriceIOS" to localizedPriceIOS,
        "nonceIOS" to nonceIOS,
        "numberOfPeriodsIOS" to numberOfPeriodsIOS,
        "offerTagsAndroid" to offerTagsAndroid,
        "offerTokenAndroid" to offerTokenAndroid,
        "paymentMode" to paymentMode?.toJson(),
        "period" to period?.toJson(),
        "periodCount" to periodCount,
        "price" to price,
        "pricingPhasesAndroid" to pricingPhasesAndroid?.toJson(),
        "signatureIOS" to signatureIOS,
        "timestampIOS" to timestampIOS,
        "type" to type.toJson(),
    )
}

/**
 * iOS subscription offer details.
 * @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
 * @see https://openiap.dev/docs/types#subscription-offer
 */
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
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                paymentMode = (json["paymentMode"] as? String)?.let { PaymentModeIOS.fromJson(it) } ?: PaymentModeIOS.Empty,
                period = (json["period"] as? Map<String, Any?>)?.let { SubscriptionPeriodValueIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPeriodValueIOS"),
                periodCount = (json["periodCount"] as? Number)?.toInt() ?: 0,
                price = (json["price"] as? Number)?.toDouble() ?: 0.0,
                type = (json["type"] as? String)?.let { SubscriptionOfferTypeIOS.fromJson(it) } ?: SubscriptionOfferTypeIOS.Introductory,
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

/**
 * Subscription period value combining unit and count.
 */
public data class SubscriptionPeriod(
    /**
     * The period unit (day, week, month, year)
     */
    val unit: SubscriptionPeriodUnit,
    /**
     * The number of units (e.g., 1 for monthly, 3 for quarterly)
     */
    val value: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionPeriod {
            return SubscriptionPeriod(
                unit = (json["unit"] as? String)?.let { SubscriptionPeriodUnit.fromJson(it) } ?: SubscriptionPeriodUnit.Day,
                value = (json["value"] as? Number)?.toInt() ?: 0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionPeriod",
        "unit" to unit.toJson(),
        "value" to value,
    )
}

public data class SubscriptionPeriodValueIOS(
    val unit: SubscriptionPeriodIOS,
    val value: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionPeriodValueIOS {
            return SubscriptionPeriodValueIOS(
                unit = (json["unit"] as? String)?.let { SubscriptionPeriodIOS.fromJson(it) } ?: SubscriptionPeriodIOS.Empty,
                value = (json["value"] as? Number)?.toInt() ?: 0,
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
                renewalInfo = (json["renewalInfo"] as? Map<String, Any?>)?.let { RenewalInfoIOS.fromJson(it) },
                state = json["state"] as? String ?: "",
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
                externalTransactionToken = json["externalTransactionToken"] as? String ?: "",
                products = (json["products"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "UserChoiceBillingDetails",
        "externalTransactionToken" to externalTransactionToken,
        "products" to products,
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
                endTimeMillis = json["endTimeMillis"] as? String ?: "",
                startTimeMillis = json["startTimeMillis"] as? String ?: "",
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
                autoRenewing = json["autoRenewing"] as? Boolean ?: false,
                betaProduct = json["betaProduct"] as? Boolean ?: false,
                cancelDate = (json["cancelDate"] as? Number)?.toDouble(),
                cancelReason = json["cancelReason"] as? String,
                deferredDate = (json["deferredDate"] as? Number)?.toDouble(),
                deferredSku = json["deferredSku"] as? String,
                freeTrialEndDate = (json["freeTrialEndDate"] as? Number)?.toDouble() ?: 0.0,
                gracePeriodEndDate = (json["gracePeriodEndDate"] as? Number)?.toDouble() ?: 0.0,
                parentProductId = json["parentProductId"] as? String ?: "",
                productId = json["productId"] as? String ?: "",
                productType = json["productType"] as? String ?: "",
                purchaseDate = (json["purchaseDate"] as? Number)?.toDouble() ?: 0.0,
                quantity = (json["quantity"] as? Number)?.toInt() ?: 0,
                receiptId = json["receiptId"] as? String ?: "",
                renewalDate = (json["renewalDate"] as? Number)?.toDouble() ?: 0.0,
                term = json["term"] as? String ?: "",
                termSku = json["termSku"] as? String ?: "",
                testTransaction = json["testTransaction"] as? Boolean ?: false,
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
                grantTime = (json["grantTime"] as? Number)?.toDouble(),
                success = json["success"] as? Boolean ?: false,
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
                isValid = json["isValid"] as? Boolean ?: false,
                jwsRepresentation = json["jwsRepresentation"] as? String ?: "",
                latestTransaction = (json["latestTransaction"] as? Map<String, Any?>)?.let { Purchase.fromJson(it) },
                receiptData = json["receiptData"] as? String ?: "",
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
                code = json["code"] as? String,
                message = json["message"] as? String ?: "",
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
                errors = (json["errors"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { VerifyPurchaseWithProviderError.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for VerifyPurchaseWithProviderError") },
                iapkit = (json["iapkit"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitResult.fromJson(it) },
                provider = (json["provider"] as? String)?.let { PurchaseVerificationProvider.fromJson(it) } ?: PurchaseVerificationProvider.Iapkit,
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
                offerToken = json["offerToken"] as? String ?: "",
                sku = json["sku"] as? String ?: "",
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
                packageNameAndroid = json["packageNameAndroid"] as? String,
                skuAndroid = json["skuAndroid"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "packageNameAndroid" to packageNameAndroid,
        "skuAndroid" to skuAndroid,
    )
}

/**
 * Parameters for developer billing option in purchase flow (Android)
 * Used with BillingFlowParams to enable external payments flow
 * Available in Google Play Billing Library 8.3.0+
 */
public data class DeveloperBillingOptionParamsAndroid(
    /**
     * The billing program (should be EXTERNAL_PAYMENTS for external payments flow)
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * The launch mode for the external payment link
     */
    val launchMode: DeveloperBillingLaunchModeAndroid,
    /**
     * The URI where the external payment will be processed
     */
    val linkUri: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): DeveloperBillingOptionParamsAndroid {
            return DeveloperBillingOptionParamsAndroid(
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified,
                launchMode = (json["launchMode"] as? String)?.let { DeveloperBillingLaunchModeAndroid.fromJson(it) } ?: DeveloperBillingLaunchModeAndroid.Unspecified,
                linkUri = json["linkUri"] as? String ?: "",
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "launchMode" to launchMode.toJson(),
        "linkUri" to linkUri,
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
                identifier = json["identifier"] as? String ?: "",
                keyIdentifier = json["keyIdentifier"] as? String ?: "",
                nonce = json["nonce"] as? String ?: "",
                signature = json["signature"] as? String ?: "",
                timestamp = (json["timestamp"] as? Number)?.toDouble() ?: 0.0,
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
     * @deprecated Use enableBillingProgramAndroid instead.
     * Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
     */
    val alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = null,
    /**
     * Enable a specific billing program for Android (7.0+)
     * When set, enables the specified billing program for external transactions.
     * - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)
     * - EXTERNAL_CONTENT_LINK: Link to external content (8.2.0+)
     * - EXTERNAL_OFFER: External offers for digital content (8.2.0+)
     * - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)
     */
    val enableBillingProgramAndroid: BillingProgramAndroid? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): InitConnectionConfig {
            return InitConnectionConfig(
                alternativeBillingModeAndroid = (json["alternativeBillingModeAndroid"] as? String)?.let { AlternativeBillingModeAndroid.fromJson(it) },
                enableBillingProgramAndroid = (json["enableBillingProgramAndroid"] as? String)?.let { BillingProgramAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "alternativeBillingModeAndroid" to alternativeBillingModeAndroid?.toJson(),
        "enableBillingProgramAndroid" to enableBillingProgramAndroid?.toJson(),
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
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified,
                launchMode = (json["launchMode"] as? String)?.let { ExternalLinkLaunchModeAndroid.fromJson(it) } ?: ExternalLinkLaunchModeAndroid.Unspecified,
                linkType = (json["linkType"] as? String)?.let { ExternalLinkTypeAndroid.fromJson(it) } ?: ExternalLinkTypeAndroid.Unspecified,
                linkUri = json["linkUri"] as? String ?: "",
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
                skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                type = (json["type"] as? String)?.let { ProductQueryType.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "skus" to skus,
        "type" to type?.toJson(),
    )
}

/**
 * JWS promotional offer input for iOS 15+ (StoreKit 2, WWDC 2025).
 * New signature format using compact JWS string for promotional offers.
 * This provides a simpler alternative to the legacy signature-based promotional offers.
 * Back-deployed to iOS 15.
 */
public data class PromotionalOfferJWSInputIOS(
    /**
     * Compact JWS string signed by your server.
     * The JWS should contain the promotional offer signature data.
     * Format: header.payload.signature (base64url encoded)
     */
    val jws: String,
    /**
     * The promotional offer identifier from App Store Connect
     */
    val offerId: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): PromotionalOfferJWSInputIOS {
            return PromotionalOfferJWSInputIOS(
                jws = json["jws"] as? String ?: "",
                offerId = json["offerId"] as? String ?: "",
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "jws" to jws,
        "offerId" to offerId,
    )
}

public typealias PurchaseInput = Purchase

public data class PurchaseOptions(
    /**
     * Also emit results through the iOS event listeners
     */
    val alsoPublishToEventListenerIOS: Boolean? = null,
    /**
     * Include suspended subscriptions in the result (Android 8.1+).
     * Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
     * Users should be directed to the subscription center to resolve payment issues.
     * Default: false (only active subscriptions are returned)
     */
    val includeSuspendedAndroid: Boolean? = null,
    /**
     * Limit to currently active items on iOS
     */
    val onlyIncludeActiveItemsIOS: Boolean? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseOptions {
            return PurchaseOptions(
                alsoPublishToEventListenerIOS = json["alsoPublishToEventListenerIOS"] as? Boolean,
                includeSuspendedAndroid = json["includeSuspendedAndroid"] as? Boolean,
                onlyIncludeActiveItemsIOS = json["onlyIncludeActiveItemsIOS"] as? Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "alsoPublishToEventListenerIOS" to alsoPublishToEventListenerIOS,
        "includeSuspendedAndroid" to includeSuspendedAndroid,
        "onlyIncludeActiveItemsIOS" to onlyIncludeActiveItemsIOS,
    )
}

public data class RequestPurchaseAndroidProps(
    /**
     * Developer billing option parameters for external payments flow (8.3.0+).
     * When provided, the purchase flow will show a side-by-side choice between
     * Google Play Billing and the developer's external payment option.
     */
    val developerBillingOption: DeveloperBillingOptionParamsAndroid? = null,
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
                developerBillingOption = (json["developerBillingOption"] as? Map<String, Any?>)?.let { DeveloperBillingOptionParamsAndroid.fromJson(it) },
                isOfferPersonalized = json["isOfferPersonalized"] as? Boolean,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as? String,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as? String,
                skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "developerBillingOption" to developerBillingOption?.toJson(),
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "skus" to skus,
    )
}

public data class RequestPurchaseIosProps(
    /**
     * Advanced commerce data token (iOS 15+).
     * Used with StoreKit 2's Product.PurchaseOption.custom API for passing
     * campaign tokens, affiliate IDs, or other attribution data.
     * The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
     */
    val advancedCommerceData: String? = null,
    /**
     * Auto-finish transaction (dangerous)
     */
    val andDangerouslyFinishTransactionAutomatically: Boolean? = null,
    /**
     * App account token for user tracking
     */
    val appAccountToken: String? = null,
    /**
     * Override introductory offer eligibility (iOS 15+, WWDC 2025).
     * Set to true to indicate the user is eligible for introductory offer,
     * or false to indicate they are not. When nil, the system determines eligibility.
     * Back-deployed to iOS 15.
     */
    val introductoryOfferEligibility: Boolean? = null,
    /**
     * JWS promotional offer (iOS 15+, WWDC 2025).
     * New signature format using compact JWS string for promotional offers.
     * Back-deployed to iOS 15.
     */
    val promotionalOfferJWS: PromotionalOfferJWSInputIOS? = null,
    /**
     * Purchase quantity
     */
    val quantity: Int? = null,
    /**
     * Product SKU
     */
    val sku: String,
    /**
     * Win-back offer to apply (iOS 18+)
     * Used to re-engage churned subscribers with a discount or free trial.
     * Note: Win-back offers only apply to subscription products.
     */
    val winBackOffer: WinBackOfferInputIOS? = null,
    /**
     * Discount offer to apply
     */
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseIosProps {
            return RequestPurchaseIosProps(
                advancedCommerceData = json["advancedCommerceData"] as? String,
                andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as? Boolean,
                appAccountToken = json["appAccountToken"] as? String,
                introductoryOfferEligibility = json["introductoryOfferEligibility"] as? Boolean,
                promotionalOfferJWS = (json["promotionalOfferJWS"] as? Map<String, Any?>)?.let { PromotionalOfferJWSInputIOS.fromJson(it) },
                quantity = (json["quantity"] as? Number)?.toInt(),
                sku = json["sku"] as? String ?: "",
                winBackOffer = (json["winBackOffer"] as? Map<String, Any?>)?.let { WinBackOfferInputIOS.fromJson(it) },
                withOffer = (json["withOffer"] as? Map<String, Any?>)?.let { DiscountOfferInputIOS.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "advancedCommerceData" to advancedCommerceData,
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "introductoryOfferEligibility" to introductoryOfferEligibility,
        "promotionalOfferJWS" to promotionalOfferJWS?.toJson(),
        "quantity" to quantity,
        "sku" to sku,
        "winBackOffer" to winBackOffer?.toJson(),
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
                android = (json["android"] as? Map<String, Any?>)?.let { RequestPurchaseAndroidProps.fromJson(it) },
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestPurchaseIosProps.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { RequestPurchaseAndroidProps.fromJson(it) },
                ios = (json["ios"] as? Map<String, Any?>)?.let { RequestPurchaseIosProps.fromJson(it) },
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
     * Developer billing option parameters for external payments flow (8.3.0+).
     * When provided, the purchase flow will show a side-by-side choice between
     * Google Play Billing and the developer's external payment option.
     */
    val developerBillingOption: DeveloperBillingOptionParamsAndroid? = null,
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
                developerBillingOption = (json["developerBillingOption"] as? Map<String, Any?>)?.let { DeveloperBillingOptionParamsAndroid.fromJson(it) },
                isOfferPersonalized = json["isOfferPersonalized"] as? Boolean,
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as? String,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as? String,
                purchaseTokenAndroid = json["purchaseTokenAndroid"] as? String,
                replacementModeAndroid = (json["replacementModeAndroid"] as? Number)?.toInt(),
                skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { AndroidSubscriptionOfferInput.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for AndroidSubscriptionOfferInput") },
                subscriptionProductReplacementParams = (json["subscriptionProductReplacementParams"] as? Map<String, Any?>)?.let { SubscriptionProductReplacementParamsAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "developerBillingOption" to developerBillingOption?.toJson(),
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "purchaseTokenAndroid" to purchaseTokenAndroid,
        "replacementModeAndroid" to replacementModeAndroid,
        "skus" to skus,
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
        "subscriptionProductReplacementParams" to subscriptionProductReplacementParams?.toJson(),
    )
}

public data class RequestSubscriptionIosProps(
    /**
     * Advanced commerce data token (iOS 15+).
     * Used with StoreKit 2's Product.PurchaseOption.custom API for passing
     * campaign tokens, affiliate IDs, or other attribution data.
     * The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
     */
    val advancedCommerceData: String? = null,
    val andDangerouslyFinishTransactionAutomatically: Boolean? = null,
    val appAccountToken: String? = null,
    /**
     * Override introductory offer eligibility (iOS 15+, WWDC 2025).
     * Set to true to indicate the user is eligible for introductory offer,
     * or false to indicate they are not. When nil, the system determines eligibility.
     * Back-deployed to iOS 15.
     */
    val introductoryOfferEligibility: Boolean? = null,
    /**
     * JWS promotional offer (iOS 15+, WWDC 2025).
     * New signature format using compact JWS string for promotional offers.
     * Back-deployed to iOS 15.
     */
    val promotionalOfferJWS: PromotionalOfferJWSInputIOS? = null,
    val quantity: Int? = null,
    val sku: String,
    /**
     * Win-back offer to apply (iOS 18+)
     * Used to re-engage churned subscribers with a discount or free trial.
     * The offer is available when the customer is eligible and can be discovered
     * via StoreKit Message (automatic) or subscription offer APIs.
     */
    val winBackOffer: WinBackOfferInputIOS? = null,
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionIosProps {
            return RequestSubscriptionIosProps(
                advancedCommerceData = json["advancedCommerceData"] as? String,
                andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as? Boolean,
                appAccountToken = json["appAccountToken"] as? String,
                introductoryOfferEligibility = json["introductoryOfferEligibility"] as? Boolean,
                promotionalOfferJWS = (json["promotionalOfferJWS"] as? Map<String, Any?>)?.let { PromotionalOfferJWSInputIOS.fromJson(it) },
                quantity = (json["quantity"] as? Number)?.toInt(),
                sku = json["sku"] as? String ?: "",
                winBackOffer = (json["winBackOffer"] as? Map<String, Any?>)?.let { WinBackOfferInputIOS.fromJson(it) },
                withOffer = (json["withOffer"] as? Map<String, Any?>)?.let { DiscountOfferInputIOS.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "advancedCommerceData" to advancedCommerceData,
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "introductoryOfferEligibility" to introductoryOfferEligibility,
        "promotionalOfferJWS" to promotionalOfferJWS?.toJson(),
        "quantity" to quantity,
        "sku" to sku,
        "winBackOffer" to winBackOffer?.toJson(),
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
                android = (json["android"] as? Map<String, Any?>)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestSubscriptionIosProps.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
                ios = (json["ios"] as? Map<String, Any?>)?.let { RequestSubscriptionIosProps.fromJson(it) },
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
                jws = json["jws"] as? String ?: "",
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
                purchaseToken = json["purchaseToken"] as? String ?: "",
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
                apiKey = json["apiKey"] as? String,
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitAppleProps.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitGoogleProps.fromJson(it) },
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
                oldProductId = json["oldProductId"] as? String ?: "",
                replacementMode = (json["replacementMode"] as? String)?.let { SubscriptionReplacementModeAndroid.fromJson(it) } ?: SubscriptionReplacementModeAndroid.UnknownReplacementMode,
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
                sku = json["sku"] as? String ?: "",
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
                accessToken = json["accessToken"] as? String ?: "",
                isSub = json["isSub"] as? Boolean,
                packageName = json["packageName"] as? String ?: "",
                purchaseToken = json["purchaseToken"] as? String ?: "",
                sku = json["sku"] as? String ?: "",
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
                accessToken = json["accessToken"] as? String ?: "",
                sku = json["sku"] as? String ?: "",
                userId = json["userId"] as? String ?: "",
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
                apple = (json["apple"] as? Map<String, Any?>)?.let { VerifyPurchaseAppleOptions.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { VerifyPurchaseGoogleOptions.fromJson(it) },
                horizon = (json["horizon"] as? Map<String, Any?>)?.let { VerifyPurchaseHorizonOptions.fromJson(it) },
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
                iapkit = (json["iapkit"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitProps.fromJson(it) },
                provider = (json["provider"] as? String)?.let { PurchaseVerificationProvider.fromJson(it) } ?: PurchaseVerificationProvider.Iapkit,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "iapkit" to iapkit?.toJson(),
        "provider" to provider.toJson(),
    )
}

/**
 * Win-back offer input for iOS 18+ (StoreKit 2)
 * Win-back offers are used to re-engage churned subscribers.
 * The offer is automatically presented via StoreKit Message when eligible,
 * or can be applied programmatically during purchase.
 */
public data class WinBackOfferInputIOS(
    /**
     * The win-back offer ID from App Store Connect
     */
    val offerId: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): WinBackOfferInputIOS {
            return WinBackOfferInputIOS(
                offerId = json["offerId"] as? String ?: "",
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "offerId" to offerId,
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
     * Create reporting details for a billing program
     * Replaces the deprecated createExternalOfferReportingDetailsAsync API
     * 
     * Available in Google Play Billing Library 8.2.0+
     * Returns external transaction token needed for reporting external transactions
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid): BillingProgramReportingDetailsAndroid
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
     * Check if a billing program is available for the current user
     * Replaces the deprecated isExternalOfferAvailableAsync API
     * 
     * Available in Google Play Billing Library 8.2.0+
     * Returns availability result with isAvailable flag
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid
    /**
     * Launch external link flow for external billing programs
     * Replaces the deprecated showExternalOfferInformationDialog API
     * 
     * Available in Google Play Billing Library 8.2.0+
     * Shows Play Store dialog and optionally launches external URL
     * Throws OpenIapError.NotPrepared if billing client not ready
     */
    suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean
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
     * Purchase the promoted product surfaced by the App Store.
     * 
     * @deprecated Use promotedProductListenerIOS to receive the productId,
     * then call requestPurchase with that SKU instead. In StoreKit 2,
     * promoted products can be purchased directly via the standard purchase flow.
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
     * Fires when a user selects developer billing in the External Payments flow (Android only)
     * Triggered when the user chooses to pay via the developer's external payment option
     * instead of Google Play Billing in the side-by-side choice dialog.
     * Contains the externalTransactionToken needed to report the transaction.
     * Available in Google Play Billing Library 8.3.0+
     */
    suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid
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
public typealias MutationCreateBillingProgramReportingDetailsAndroidHandler = suspend (program: BillingProgramAndroid) -> BillingProgramReportingDetailsAndroid
public typealias MutationDeepLinkToSubscriptionsHandler = suspend (options: DeepLinkOptions?) -> Unit
public typealias MutationEndConnectionHandler = suspend () -> Boolean
public typealias MutationFinishTransactionHandler = suspend (purchase: PurchaseInput, isConsumable: Boolean?) -> Unit
public typealias MutationInitConnectionHandler = suspend (config: InitConnectionConfig?) -> Boolean
public typealias MutationIsBillingProgramAvailableAndroidHandler = suspend (program: BillingProgramAndroid) -> BillingProgramAvailabilityResultAndroid
public typealias MutationLaunchExternalLinkAndroidHandler = suspend (params: LaunchExternalLinkParamsAndroid) -> Boolean
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
    val createBillingProgramReportingDetailsAndroid: MutationCreateBillingProgramReportingDetailsAndroidHandler? = null,
    val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler? = null,
    val endConnection: MutationEndConnectionHandler? = null,
    val finishTransaction: MutationFinishTransactionHandler? = null,
    val initConnection: MutationInitConnectionHandler? = null,
    val isBillingProgramAvailableAndroid: MutationIsBillingProgramAvailableAndroidHandler? = null,
    val launchExternalLinkAndroid: MutationLaunchExternalLinkAndroidHandler? = null,
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

public typealias SubscriptionDeveloperProvidedBillingAndroidHandler = suspend () -> DeveloperProvidedBillingDetailsAndroid
public typealias SubscriptionPromotedProductIOSHandler = suspend () -> String
public typealias SubscriptionPurchaseErrorHandler = suspend () -> PurchaseError
public typealias SubscriptionPurchaseUpdatedHandler = suspend () -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = suspend () -> UserChoiceBillingDetails

public data class SubscriptionHandlers(
    val developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler? = null,
    val promotedProductIOS: SubscriptionPromotedProductIOSHandler? = null,
    val purchaseError: SubscriptionPurchaseErrorHandler? = null,
    val purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = null,
    val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = null
)
