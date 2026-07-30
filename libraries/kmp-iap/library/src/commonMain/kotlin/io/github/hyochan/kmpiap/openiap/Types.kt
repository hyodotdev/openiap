// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Refresh this file with the generated-types workflow documented for your checkout.
// ============================================================================

// Generated JSON decoders use unchecked casts for nested wire values.
@file:Suppress("UNCHECKED_CAST")

package io.github.hyochan.kmpiap.openiap

// MARK: - Enums

/**
 * Play Billing choice image layout (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public enum class BillingChoiceImageLayoutAndroid(val rawValue: String) {
    /**
     * Rectangular image with a 4:1 aspect ratio.
     */
    RectangularFourByOne("rectangular-four-by-one"),
    /**
     * Rectangular image with a 3:1 aspect ratio.
     */
    RectangularThreeByOne("rectangular-three-by-one"),
    /**
     * Rectangular image with a 2:2 aspect ratio.
     */
    RectangularTwoByTwo("rectangular-two-by-two");

    companion object {
        fun fromJson(value: String): BillingChoiceImageLayoutAndroid = when (value) {
            "rectangular-four-by-one" -> BillingChoiceImageLayoutAndroid.RectangularFourByOne
            "RECTANGULAR_FOUR_BY_ONE" -> BillingChoiceImageLayoutAndroid.RectangularFourByOne
            "rectangular-three-by-one" -> BillingChoiceImageLayoutAndroid.RectangularThreeByOne
            "RECTANGULAR_THREE_BY_ONE" -> BillingChoiceImageLayoutAndroid.RectangularThreeByOne
            "rectangular-two-by-two" -> BillingChoiceImageLayoutAndroid.RectangularTwoByTwo
            "RECTANGULAR_TWO_BY_TWO" -> BillingChoiceImageLayoutAndroid.RectangularTwoByTwo
            else -> throw IllegalArgumentException("Unknown BillingChoiceImageLayoutAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Choice screen renderer for Billing Choice availability (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public enum class BillingChoiceScreenTypeAndroid(val rawValue: String) {
    /**
     * Unspecified choice screen type.
     */
    Unspecified("unspecified"),
    /**
     * Choice screen is rendered by the developer app.
     */
    DeveloperRendered("developer-rendered"),
    /**
     * Choice screen is rendered by Google Play.
     */
    GoogleRendered("google-rendered");

    companion object {
        fun fromJson(value: String): BillingChoiceScreenTypeAndroid = when (value) {
            "unspecified" -> BillingChoiceScreenTypeAndroid.Unspecified
            "UNSPECIFIED" -> BillingChoiceScreenTypeAndroid.Unspecified
            "developer-rendered" -> BillingChoiceScreenTypeAndroid.DeveloperRendered
            "DEVELOPER_RENDERED" -> BillingChoiceScreenTypeAndroid.DeveloperRendered
            "google-rendered" -> BillingChoiceScreenTypeAndroid.GoogleRendered
            "GOOGLE_RENDERED" -> BillingChoiceScreenTypeAndroid.GoogleRendered
            else -> throw IllegalArgumentException("Unknown BillingChoiceScreenTypeAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Billing program types for Google Play Billing Programs (Android)
 * Available in Google Play Billing Library 8.2.0 (External Offer and External Content Link
 * integrations require 8.2.1+), EXTERNAL_PAYMENTS added in 8.3.0,
 * BILLING_CHOICE added in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (requires Play Billing 9.1.0+).
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
    ExternalPayments("external-payments"),
    /**
     * Billing Choice program.
     * Allows presenting Google Play Billing alongside an alternative in-app billing system or external web link.
     * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     */
    BillingChoice("billing-choice");

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
            "billing-choice" -> BillingProgramAndroid.BillingChoice
            "BILLING_CHOICE" -> BillingProgramAndroid.BillingChoice
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
    CallerWillLaunchLink("caller-will-launch-link");

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
 * Developer-provided billing destination type for Billing Program reporting details (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public enum class DeveloperBillingTypeAndroid(val rawValue: String) {
    /**
     * Unspecified developer billing type. Do not use.
     */
    DeveloperBillingTypeUnspecified("developer-billing-type-unspecified"),
    /**
     * Developer-provided billing via native in-app experience.
     */
    InApp("in-app"),
    /**
     * Developer-provided billing via external link or embedded web browsing.
     */
    ExternalLink("external-link");

    companion object {
        fun fromJson(value: String): DeveloperBillingTypeAndroid = when (value) {
            "developer-billing-type-unspecified" -> DeveloperBillingTypeAndroid.DeveloperBillingTypeUnspecified
            "DEVELOPER_BILLING_TYPE_UNSPECIFIED" -> DeveloperBillingTypeAndroid.DeveloperBillingTypeUnspecified
            "in-app" -> DeveloperBillingTypeAndroid.InApp
            "IN_APP" -> DeveloperBillingTypeAndroid.InApp
            "external-link" -> DeveloperBillingTypeAndroid.ExternalLink
            "EXTERNAL_LINK" -> DeveloperBillingTypeAndroid.ExternalLink
            else -> throw IllegalArgumentException("Unknown DeveloperBillingTypeAndroid value: $value")
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
     * One-time product discount (Android only, Google Play Billing 8.0+)
     */
    OneTime("one-time");

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
    ServiceTimeout("service-timeout"),
    QueryProduct("query-product"),
    SkuNotFound("sku-not-found"),
    SkuOfferMismatch("sku-offer-mismatch"),
    ItemNotOwned("item-not-owned"),
    BillingUnavailable("billing-unavailable"),
    FeatureNotSupported("feature-not-supported"),
    EmptySkuList("empty-sku-list"),
    DuplicatePurchase("duplicate-purchase");

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
            "service-timeout" -> ErrorCode.ServiceTimeout
            "SERVICE_TIMEOUT" -> ErrorCode.ServiceTimeout
            "ServiceTimeout" -> ErrorCode.ServiceTimeout
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
            "duplicate-purchase" -> ErrorCode.DuplicatePurchase
            "DUPLICATE_PURCHASE" -> ErrorCode.DuplicatePurchase
            "DuplicatePurchase" -> ErrorCode.DuplicatePurchase
            else -> throw IllegalArgumentException("Unknown ErrorCode value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Launch mode for external link flow (Android)
 * Determines how the external URL is launched
 * Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link
 * integrations require 8.2.1+ and fresh details immediately before every redirect session.
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
 * Notice types for ExternalPurchaseCustomLink (iOS 18.1+).
 * Determines the style of disclosure notice to display.
 * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/noticetype
 */
public enum class ExternalPurchaseCustomLinkNoticeTypeIOS(val rawValue: String) {
    /**
     * Notice type indicating external purchases will be displayed in a browser
     * or destination of the app's choice.
     */
    Browser("browser");

    companion object {
        fun fromJson(value: String): ExternalPurchaseCustomLinkNoticeTypeIOS = when (value) {
            "browser" -> ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
            "BROWSER" -> ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
            "Browser" -> ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
            else -> throw IllegalArgumentException("Unknown ExternalPurchaseCustomLinkNoticeTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Token types for ExternalPurchaseCustomLink (iOS 18.1+).
 * Used to request different types of external purchase tokens for reporting to Apple.
 * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
 */
public enum class ExternalPurchaseCustomLinkTokenTypeIOS(val rawValue: String) {
    /**
     * Token for customer acquisition tracking.
     * Use this when a new customer makes their first purchase through external link.
     */
    Acquisition("acquisition"),
    /**
     * Token for ongoing services tracking.
     * Use this for existing customers making additional purchases.
     */
    Services("services");

    companion object {
        fun fromJson(value: String): ExternalPurchaseCustomLinkTokenTypeIOS = when (value) {
            "acquisition" -> ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition
            "ACQUISITION" -> ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition
            "Acquisition" -> ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition
            "services" -> ExternalPurchaseCustomLinkTokenTypeIOS.Services
            "SERVICES" -> ExternalPurchaseCustomLinkTokenTypeIOS.Services
            "Services" -> ExternalPurchaseCustomLinkTokenTypeIOS.Services
            else -> throw IllegalArgumentException("Unknown ExternalPurchaseCustomLinkTokenTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * User actions on external purchase notice sheet (iOS 17.4+)
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
     * Fired for External Payments (8.3.0+) and Google-rendered Billing Choice
     * developer billing selections on Android. Billing Choice is available in
     * OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     */
    DeveloperProvidedBillingAndroid("developer-provided-billing-android"),
    /**
     * Fired when a subscription enters a billing-issue state that requires user attention.
     * A StoreKit billing-retry subscription may no longer be a current entitlement.
     * Cross-platform unification of StoreKit 2 Message.billingIssue (iOS 16.4+,
     * Mac Catalyst 16.4+, visionOS 1.0+) and
     * Play Billing 8.1+ isSuspended. NOT emitted by Amazon Appstore or the Horizon
     * flavor, whose Billing Compatibility SDK implements only Play Billing 7.0.
     */
    SubscriptionBillingIssue("subscription-billing-issue");

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
            "subscription-billing-issue" -> IapEvent.SubscriptionBillingIssue
            "SUBSCRIPTION_BILLING_ISSUE" -> IapEvent.SubscriptionBillingIssue
            "SubscriptionBillingIssue" -> IapEvent.SubscriptionBillingIssue
            else -> throw IllegalArgumentException("Unknown IapEvent value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Serialization format of a public IAPKit product client payload.
 */
public enum class IapkitClientPayloadFormat(val rawValue: String) {
    Toml("toml"),
    Json("json"),
    Text("text");

    companion object {
        fun fromJson(value: String): IapkitClientPayloadFormat = when (value) {
            "toml" -> IapkitClientPayloadFormat.Toml
            "TOML" -> IapkitClientPayloadFormat.Toml
            "Toml" -> IapkitClientPayloadFormat.Toml
            "json" -> IapkitClientPayloadFormat.Json
            "JSON" -> IapkitClientPayloadFormat.Json
            "Json" -> IapkitClientPayloadFormat.Json
            "text" -> IapkitClientPayloadFormat.Text
            "TEXT" -> IapkitClientPayloadFormat.Text
            "Text" -> IapkitClientPayloadFormat.Text
            else -> throw IllegalArgumentException("Unknown IapkitClientPayloadFormat value: $value")
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
    Android("android");

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
    Horizon("horizon"),
    Amazon("amazon");

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
            "amazon" -> IapStore.Amazon
            "AMAZON" -> IapStore.Amazon
            "Amazon" -> IapStore.Amazon
            else -> throw IllegalArgumentException("Unknown IapStore value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * High-level in-app message category (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
public enum class InAppMessageCategoryAndroid(val rawValue: String) {
    /**
     * Unknown in-app message category.
     */
    UnknownInAppMessageCategoryId("unknown-in-app-message-category-id"),
    /**
     * Transactional billing messages, such as payment issues or pending price-change confirmations.
     */
    Transactional("transactional");

    companion object {
        fun fromJson(value: String): InAppMessageCategoryAndroid = when (value) {
            "unknown-in-app-message-category-id" -> InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId
            "UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID" -> InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId
            "transactional" -> InAppMessageCategoryAndroid.Transactional
            "TRANSACTIONAL" -> InAppMessageCategoryAndroid.Transactional
            else -> throw IllegalArgumentException("Unknown InAppMessageCategoryAndroid value: $value")
        }
    }

    fun toJson(): String = rawValue
}

/**
 * Response code from Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
public enum class InAppMessageResponseCodeAndroid(val rawValue: String) {
    /**
     * Flow finished and no developer action is needed.
     */
    NoActionNeeded("no-action-needed"),
    /**
     * Subscription status changed and the purchase token should be checked.
     */
    SubscriptionStatusUpdated("subscription-status-updated");

    companion object {
        fun fromJson(value: String): InAppMessageResponseCodeAndroid = when (value) {
            "no-action-needed" -> InAppMessageResponseCodeAndroid.NoActionNeeded
            "NO_ACTION_NEEDED" -> InAppMessageResponseCodeAndroid.NoActionNeeded
            "subscription-status-updated" -> InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated
            "SUBSCRIPTION_STATUS_UPDATED" -> InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated
            else -> throw IllegalArgumentException("Unknown InAppMessageResponseCodeAndroid value: $value")
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
    Unknown("unknown");

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
    PayUpFront("pay-up-front");

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
    All("all");

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
    Unknown("unknown");

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
    Subs("subs");

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
    NonRenewingSubscription("non-renewing-subscription"),
    /**
     * A group of independently purchasable subscriptions sold together (Apple 27+ beta).
     */
    SubscriptionBundle("subscription-bundle"),
    /**
     * A group of subscriptions that are available only as one suite (Apple 27+ beta).
     */
    SubscriptionSuite("subscription-suite");

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
            "subscription-bundle" -> ProductTypeIOS.SubscriptionBundle
            "SUBSCRIPTION_BUNDLE" -> ProductTypeIOS.SubscriptionBundle
            "SubscriptionBundle" -> ProductTypeIOS.SubscriptionBundle
            "subscription-suite" -> ProductTypeIOS.SubscriptionSuite
            "SUBSCRIPTION_SUITE" -> ProductTypeIOS.SubscriptionSuite
            "SubscriptionSuite" -> ProductTypeIOS.SubscriptionSuite
            else -> throw IllegalArgumentException("Unknown ProductTypeIOS value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class PurchaseState(val rawValue: String) {
    Pending("pending"),
    Purchased("purchased"),
    Unknown("unknown");

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
    Iapkit("iapkit");

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
    UserIneligible("user-ineligible");

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

public enum class SubscriptionBillingPlanTypeIOS(val rawValue: String) {
    /**
     * Unknown or unsupported billing plan type.
     */
    Unknown("unknown"),
    /**
     * Monthly billing with a 12-month commitment.
     */
    Monthly("monthly"),
    /**
     * Up-front billing for the full subscription period.
     */
    UpFront("up-front");

    companion object {
        fun fromJson(value: String): SubscriptionBillingPlanTypeIOS = when (value) {
            "unknown" -> SubscriptionBillingPlanTypeIOS.Unknown
            "UNKNOWN" -> SubscriptionBillingPlanTypeIOS.Unknown
            "Unknown" -> SubscriptionBillingPlanTypeIOS.Unknown
            "monthly" -> SubscriptionBillingPlanTypeIOS.Monthly
            "MONTHLY" -> SubscriptionBillingPlanTypeIOS.Monthly
            "Monthly" -> SubscriptionBillingPlanTypeIOS.Monthly
            "up-front" -> SubscriptionBillingPlanTypeIOS.UpFront
            "UP_FRONT" -> SubscriptionBillingPlanTypeIOS.UpFront
            "UpFront" -> SubscriptionBillingPlanTypeIOS.UpFront
            else -> throw IllegalArgumentException("Unknown SubscriptionBillingPlanTypeIOS value: $value")
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
    WinBack("win-back");

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
    Empty("empty");

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
    Unknown("unknown");

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
    KeepExisting("keep-existing");

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
    /**
     * Unix timestamp in milliseconds since January 1, 1970 UTC.
     */
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
    /**
     * Unix timestamp in milliseconds since January 1, 1970 UTC.
     */
    val transactionDate: Double,
    val transactionId: String
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
    )
}

/**
 * Advanced Commerce metadata from a transaction (iOS 18.4+).
 * Contains item details, tax information, and refund data for purchases
 * made through the Advanced Commerce API using generic SKUs.
 * Only present for transactions that use the Advanced Commerce API.
 */
public data class AdvancedCommerceInfoIOS(
    /**
     * Optional description
     */
    val description: String? = null,
    /**
     * Optional display name
     */
    val displayName: String? = null,
    /**
     * Estimated tax amount (decimal string)
     */
    val estimatedTax: String? = null,
    /**
     * The items purchased as part of this transaction
     */
    val items: List<AdvancedCommerceItemIOS>,
    /**
     * Request reference identifier for tracking
     */
    val requestReferenceId: String? = null,
    /**
     * Tax code for the transaction
     */
    val taxCode: String? = null,
    /**
     * Price excluding tax (decimal string)
     */
    val taxExclusivePrice: String? = null,
    /**
     * Tax rate applied (decimal string)
     */
    val taxRate: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): AdvancedCommerceInfoIOS {
            return AdvancedCommerceInfoIOS(
                description = json["description"] as? String,
                displayName = json["displayName"] as? String,
                estimatedTax = json["estimatedTax"] as? String,
                items = (json["items"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { AdvancedCommerceItemIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for AdvancedCommerceItemIOS") } ?: emptyList(),
                requestReferenceId = json["requestReferenceId"] as? String,
                taxCode = json["taxCode"] as? String,
                taxExclusivePrice = json["taxExclusivePrice"] as? String,
                taxRate = json["taxRate"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "AdvancedCommerceInfoIOS",
        "description" to description,
        "displayName" to displayName,
        "estimatedTax" to estimatedTax,
        "items" to items.map { it.toJson() },
        "requestReferenceId" to requestReferenceId,
        "taxCode" to taxCode,
        "taxExclusivePrice" to taxExclusivePrice,
        "taxRate" to taxRate,
    )
}

/**
 * Details of an Advanced Commerce item (iOS 18.4+).
 */
public data class AdvancedCommerceItemDetailsIOS(
    /**
     * JSON representation of the item details
     */
    val jsonRepresentation: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): AdvancedCommerceItemDetailsIOS {
            return AdvancedCommerceItemDetailsIOS(
                jsonRepresentation = json["jsonRepresentation"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "AdvancedCommerceItemDetailsIOS",
        "jsonRepresentation" to jsonRepresentation,
    )
}

/**
 * An item purchased through the Advanced Commerce API (iOS 18.4+).
 * Represents a developer-defined product within a generic SKU transaction.
 */
public data class AdvancedCommerceItemIOS(
    /**
     * The item's detail information
     */
    val details: AdvancedCommerceItemDetailsIOS? = null,
    /**
     * Refunds issued for this item, if any
     */
    val refunds: List<AdvancedCommerceRefundIOS>? = null,
    /**
     * Date access to this item was revoked (milliseconds since epoch)
     */
    val revocationDate: Double? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): AdvancedCommerceItemIOS {
            return AdvancedCommerceItemIOS(
                details = (json["details"] as? Map<String, Any?>)?.let { AdvancedCommerceItemDetailsIOS.fromJson(it) },
                refunds = (json["refunds"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { AdvancedCommerceRefundIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for AdvancedCommerceRefundIOS") },
                revocationDate = (json["revocationDate"] as? Number)?.toDouble(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "AdvancedCommerceItemIOS",
        "details" to details?.toJson(),
        "refunds" to refunds?.map { it.toJson() },
        "revocationDate" to revocationDate,
    )
}

/**
 * Refund information for an Advanced Commerce item (iOS 18.4+).
 */
public data class AdvancedCommerceRefundIOS(
    /**
     * JSON representation of the refund details
     */
    val jsonRepresentation: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): AdvancedCommerceRefundIOS {
            return AdvancedCommerceRefundIOS(
                jsonRepresentation = json["jsonRepresentation"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "AdvancedCommerceRefundIOS",
        "jsonRepresentation" to jsonRepresentation,
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
    /**
     * Original App Store platform raw value. Xcode 27 adds the back-deployed managed
     * acquisition-platform value.
     */
    val originalPlatform: String? = null,
    val originalPurchaseDate: Double,
    val preorderDate: Double? = null,
    /**
     * Date the app-acquisition transaction was revoked (epoch milliseconds).
     * Available through the Xcode 27 SDK and back-deployed to Apple 16+.
     */
    val revocationDate: Double? = null,
    val signedDate: Double,
    /**
     * Store channel of the original app purchase: consumer, education, enterprise,
     * or another future StoreKit value (Apple 27+ beta).
     */
    val storeType: String? = null
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
                revocationDate = (json["revocationDate"] as? Number)?.toDouble(),
                signedDate = (json["signedDate"] as? Number)?.toDouble() ?: 0.0,
                storeType = json["storeType"] as? String,
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
        "revocationDate" to revocationDate,
        "signedDate" to signedDate,
        "storeType" to storeType,
    )
}

/**
 * Display information for developer-rendered Billing Choice screens (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public data class BillingChoiceInfoAndroid(
    /**
     * URL for the Play Billing choice image matching the requested layout.
     */
    val playBillingChoiceImageUrl: String,
    /**
     * Play Loyalty information for the user.
     */
    val playBillingLoyaltyInfo: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BillingChoiceInfoAndroid {
            return BillingChoiceInfoAndroid(
                playBillingChoiceImageUrl = json["playBillingChoiceImageUrl"] as? String ?: "",
                playBillingLoyaltyInfo = json["playBillingLoyaltyInfo"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BillingChoiceInfoAndroid",
        "playBillingChoiceImageUrl" to playBillingChoiceImageUrl,
        "playBillingLoyaltyInfo" to playBillingLoyaltyInfo,
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
     * Billing Choice screen renderer. Populated only for available BILLING_CHOICE results.
     * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
     */
    val choiceScreenType: BillingChoiceScreenTypeAndroid? = null,
    /**
     * Whether the billing program is available for the user
     */
    val isAvailable: Boolean,
    /**
     * Whether external-link payment is available for Billing Choice.
     * Populated only for available BILLING_CHOICE results.
     * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
     */
    val isExternalLinkAvailable: Boolean? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BillingProgramAvailabilityResultAndroid {
            return BillingProgramAvailabilityResultAndroid(
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified,
                choiceScreenType = (json["choiceScreenType"] as? String)?.let { BillingChoiceScreenTypeAndroid.fromJson(it) },
                isAvailable = json["isAvailable"] as? Boolean ?: false,
                isExternalLinkAvailable = json["isExternalLinkAvailable"] as? Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BillingProgramAvailabilityResultAndroid",
        "billingProgram" to billingProgram.toJson(),
        "choiceScreenType" to choiceScreenType?.toJson(),
        "isAvailable" to isAvailable,
        "isExternalLinkAvailable" to isExternalLinkAvailable,
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
     * Do not cache it for a later redirect session. For External Offer, the same token may report
     * multiple purchases made during the session that generated it.
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
 * Metadata for one auto-renewable subscription included in an Apple
 * subscription bundle (Apple 27+ beta).
 */
public data class BundledSubscriptionIOS(
    val description: String,
    val displayName: String,
    val displayPrice: String,
    val id: String,
    val isFamilyShareable: Boolean,
    val price: Double,
    val subscriptionGroupDisplayName: String,
    val subscriptionGroupId: String,
    val subscriptionGroupLevel: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): BundledSubscriptionIOS {
            return BundledSubscriptionIOS(
                description = json["description"] as? String ?: "",
                displayName = json["displayName"] as? String ?: "",
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                isFamilyShareable = json["isFamilyShareable"] as? Boolean ?: false,
                price = (json["price"] as? Number)?.toDouble() ?: 0.0,
                subscriptionGroupDisplayName = json["subscriptionGroupDisplayName"] as? String ?: "",
                subscriptionGroupId = json["subscriptionGroupId"] as? String ?: "",
                subscriptionGroupLevel = (json["subscriptionGroupLevel"] as? Number)?.toInt() ?: 0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "BundledSubscriptionIOS",
        "description" to description,
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "isFamilyShareable" to isFamilyShareable,
        "price" to price,
        "subscriptionGroupDisplayName" to subscriptionGroupDisplayName,
        "subscriptionGroupId" to subscriptionGroupId,
        "subscriptionGroupLevel" to subscriptionGroupLevel,
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
     * Nullable for flows such as external payments where no token is returned.
     */
    val externalTransactionToken: String? = null,
    /**
     * URI to launch for an external-link Billing Choice flow, when provided by
     * Google Play.
     */
    val linkUri: String? = null,
    /**
     * Original external transaction ID when replacing a subscription that was
     * purchased through developer billing.
     */
    val originalExternalTransactionId: String? = null,
    /**
     * Products selected for the developer billing flow.
     */
    val products: List<DeveloperProvidedBillingProductAndroid>
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DeveloperProvidedBillingDetailsAndroid {
            return DeveloperProvidedBillingDetailsAndroid(
                externalTransactionToken = json["externalTransactionToken"] as? String,
                linkUri = json["linkUri"] as? String,
                originalExternalTransactionId = json["originalExternalTransactionId"] as? String,
                products = (json["products"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { DeveloperProvidedBillingProductAndroid.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for DeveloperProvidedBillingProductAndroid") } ?: emptyList(),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DeveloperProvidedBillingDetailsAndroid",
        "externalTransactionToken" to externalTransactionToken,
        "linkUri" to linkUri,
        "originalExternalTransactionId" to originalExternalTransactionId,
        "products" to products.map { it.toJson() },
    )
}

/**
 * Product selected for developer-provided billing (Android 9.0+).
 */
public data class DeveloperProvidedBillingProductAndroid(
    /**
     * Product identifier.
     */
    val id: String,
    /**
     * Subscription offer token, when applicable.
     */
    val offerToken: String? = null,
    /**
     * Google Play product type (in-app or subscription).
     */
    val type: ProductType
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): DeveloperProvidedBillingProductAndroid {
            return DeveloperProvidedBillingProductAndroid(
                id = json["id"] as? String ?: "",
                offerToken = json["offerToken"] as? String,
                type = (json["type"] as? String)?.let { ProductType.fromJson(it) } ?: ProductType.InApp,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "DeveloperProvidedBillingProductAndroid",
        "id" to id,
        "offerToken" to offerToken,
        "type" to type.toJson(),
    )
}

/**
 * Discount amount details for one-time purchase offers (Android)
 * Available in Google Play Billing Library 8.0+
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
 * Available in Google Play Billing Library 8.0+
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
 * Standardized one-time product discount offer.
 * Provides a platform-neutral OpenIAP shape for Google Play one-time product
 * purchase options and offers.
 *
 * Currently populated only on Android (Google Play Billing 8.0+).
 * iOS does not populate this type.
 *
 * @see https://openiap.dev/docs/types/discount-offer
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
     * [Android] Formatted discount amount including its currency sign (e.g., "$5.00").
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
     * - Android: offerId from the Google Play one-time purchase option
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
     * [Android] Purchase option ID for this offer.
     * Used to identify which purchase option the user selected.
     * Available in Google Play Billing Library 8.0+
     */
    val purchaseOptionIdAndroid: String? = null,
    /**
     * [Android] Rental details if this is a rental offer.
     */
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    /**
     * Offer category. DiscountOffer currently represents Android one-time product
     * offers and is populated as OneTime. Introductory and Promotional are used by
     * SubscriptionOffer.
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
                purchaseOptionIdAndroid = json["purchaseOptionIdAndroid"] as? String,
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
        "purchaseOptionIdAndroid" to purchaseOptionIdAndroid,
        "rentalDetailsAndroid" to rentalDetailsAndroid?.toJson(),
        "type" to type.toJson(),
        "validTimeWindowAndroid" to validTimeWindowAndroid?.toJson(),
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
 * Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).
 */
public data class ExternalPurchaseCustomLinkNoticeResultIOS(
    /**
     * Whether the user chose to continue to external purchase
     */
    val continued: Boolean,
    /**
     * Optional error message if the presentation failed
     */
    val error: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalPurchaseCustomLinkNoticeResultIOS {
            return ExternalPurchaseCustomLinkNoticeResultIOS(
                continued = json["continued"] as? Boolean ?: false,
                error = json["error"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalPurchaseCustomLinkNoticeResultIOS",
        "continued" to continued,
        "error" to error,
    )
}

/**
 * Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).
 */
public data class ExternalPurchaseCustomLinkTokenResultIOS(
    /**
     * Optional error message if token retrieval failed
     */
    val error: String? = null,
    /**
     * The external purchase token string.
     * Report this token to Apple's External Purchase Server API.
     */
    val token: String? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalPurchaseCustomLinkTokenResultIOS {
            return ExternalPurchaseCustomLinkTokenResultIOS(
                error = json["error"] as? String,
                token = json["token"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalPurchaseCustomLinkTokenResultIOS",
        "error" to error,
        "token" to token,
    )
}

/**
 * Result of presenting an external purchase link
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
 * Result of presenting external purchase notice sheet (iOS 17.4+)
 * Returns the token when user continues to external purchase.
 */
public data class ExternalPurchaseNoticeResultIOS(
    /**
     * Optional error message if the presentation failed
     */
    val error: String? = null,
    /**
     * External purchase token returned when user continues (iOS 17.4+).
     * This token should be reported to Apple's External Purchase Server API.
     * Only present when result is Continue.
     */
    val externalPurchaseToken: String? = null,
    /**
     * Notice result indicating user action
     */
    val result: ExternalPurchaseNoticeAction
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ExternalPurchaseNoticeResultIOS {
            return ExternalPurchaseNoticeResultIOS(
                error = json["error"] as? String,
                externalPurchaseToken = json["externalPurchaseToken"] as? String,
                result = (json["result"] as? String)?.let { ExternalPurchaseNoticeAction.fromJson(it) } ?: ExternalPurchaseNoticeAction.Continue,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ExternalPurchaseNoticeResultIOS",
        "error" to error,
        "externalPurchaseToken" to externalPurchaseToken,
        "result" to result.toJson(),
    )
}

public sealed interface FetchProductsResult

public data class FetchProductsResultAll(val value: List<ProductOrSubscription>?) : FetchProductsResult

public data class FetchProductsResultProducts(val value: List<Product>?) : FetchProductsResult

public data class FetchProductsResultSubscriptions(val value: List<ProductSubscription>?) : FetchProductsResult

/**
 * Public app-facing data attached to one store product in IAPKit.
 * Never place credentials, signing keys, or server-authoritative rules here.
 */
public data class IapkitProductClientPayload(
    val body: String,
    val format: IapkitClientPayloadFormat,
    val updatedAt: Double,
    val version: Double
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): IapkitProductClientPayload {
            return IapkitProductClientPayload(
                body = json["body"] as? String ?: "",
                format = (json["format"] as? String)?.let { IapkitClientPayloadFormat.fromJson(it) } ?: IapkitClientPayloadFormat.Toml,
                updatedAt = (json["updatedAt"] as? Number)?.toDouble() ?: 0.0,
                version = (json["version"] as? Number)?.toDouble() ?: 0.0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "IapkitProductClientPayload",
        "body" to body,
        "format" to format.toJson(),
        "updatedAt" to updatedAt,
        "version" to version,
    )
}

/**
 * Result from showing Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
public data class InAppMessageResultAndroid(
    /**
     * Purchase token returned when a subscription status changed.
     */
    val purchaseToken: String? = null,
    /**
     * Response code for the in-app messaging flow.
     */
    val responseCode: InAppMessageResponseCodeAndroid
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): InAppMessageResultAndroid {
            return InAppMessageResultAndroid(
                purchaseToken = json["purchaseToken"] as? String,
                responseCode = (json["responseCode"] as? String)?.let { InAppMessageResponseCodeAndroid.fromJson(it) } ?: InAppMessageResponseCodeAndroid.NoActionNeeded,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "InAppMessageResultAndroid",
        "purchaseToken" to purchaseToken,
        "responseCode" to responseCode.toJson(),
    )
}

/**
 * Installment plan details for subscription offers (Android)
 * Contains information about the installment plan commitment.
 * Available in Google Play Billing Library 7.0+
 */
public data class InstallmentPlanDetailsAndroid(
    /**
     * Committed payments count after a user signs up for this subscription plan.
     * For example, for a monthly subscription with commitmentPaymentsCount of 12,
     * users will be charged monthly for 12 months after signup.
     */
    val commitmentPaymentsCount: Int,
    /**
     * Subsequent committed payments count after the subscription plan renews.
     * For example, for a monthly subscription with subsequentCommitmentPaymentsCount of 12,
     * users will be committed to another 12 monthly payments when the plan renews.
     * Returns 0 if the installment plan has no subsequent commitment (reverts to normal plan).
     */
    val subsequentCommitmentPaymentsCount: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): InstallmentPlanDetailsAndroid {
            return InstallmentPlanDetailsAndroid(
                commitmentPaymentsCount = (json["commitmentPaymentsCount"] as? Number)?.toInt() ?: 0,
                subsequentCommitmentPaymentsCount = (json["subsequentCommitmentPaymentsCount"] as? Number)?.toInt() ?: 0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "InstallmentPlanDetailsAndroid",
        "commitmentPaymentsCount" to commitmentPaymentsCount,
        "subsequentCommitmentPaymentsCount" to subsequentCommitmentPaymentsCount,
    )
}

/**
 * Limited quantity information for one-time purchase offers (Android)
 * Available in Google Play Billing Library 8.0+
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
 * Pending purchase update for subscription upgrades/downgrades (Android)
 * When a user initiates a subscription change (upgrade/downgrade), the new purchase
 * may be pending until the current billing period ends. This type contains the
 * details of the pending change.
 * Available in Google Play Billing Library 5.0+
 */
public data class PendingPurchaseUpdateAndroid(
    /**
     * Product IDs for the pending purchase update.
     * These are the new products the user is switching to.
     */
    val products: List<String>,
    /**
     * Purchase token for the pending transaction.
     * Use this token to track or manage the pending purchase update.
     */
    val purchaseToken: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): PendingPurchaseUpdateAndroid {
            return PendingPurchaseUpdateAndroid(
                products = (json["products"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                purchaseToken = json["purchaseToken"] as? String ?: "",
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PendingPurchaseUpdateAndroid",
        "products" to products,
        "purchaseToken" to purchaseToken,
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
     * Standardized Android one-time product purchase options and offers.
     * Native metadata uses Android-suffixed fields.
     * @see https://openiap.dev/docs/types/discount-offer
     */
    val discountOffers: List<DiscountOffer>? = null,
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
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
     * Standardized subscription offers.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types/subscription-offer
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
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                productStatusAndroid = (json["productStatusAndroid"] as? String)?.let { runCatching { ProductStatusAndroid.fromJson(it) }.getOrNull() ?: ProductStatusAndroid.Unknown },
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
        "platform" to platform.toJson(),
        "price" to price,
        "productStatusAndroid" to productStatusAndroid?.toJson(),
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
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
     * iOS 26.4+ subscription pricing terms, including billing plan metadata for
     * monthly subscriptions with a 12-month commitment.
     */
    val pricingTermsIOS: List<SubscriptionPricingTermsIOS>? = null,
    /**
     * Standardized subscription offers.
     * Cross-platform type with iOS-specific fields using suffix.
     * Note: iOS does not support one-time product discounts.
     * @see https://openiap.dev/docs/types/subscription-offer
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
                pricingTermsIOS = (json["pricingTermsIOS"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionPricingTermsIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPricingTermsIOS") },
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
        "pricingTermsIOS" to pricingTermsIOS?.map { it.toJson() },
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
    override val displayName: String? = null,
    override val displayPrice: String,
    override val id: String,
    val nameAndroid: String,
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
     * Standardized subscription offers.
     * Cross-platform type with Android-specific fields using suffix.
     * @see https://openiap.dev/docs/types/subscription-offer
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
                displayName = json["displayName"] as? String,
                displayPrice = json["displayPrice"] as? String ?: "",
                id = json["id"] as? String ?: "",
                nameAndroid = json["nameAndroid"] as? String ?: "",
                platform = (json["platform"] as? String)?.let { IapPlatform.fromJson(it) } ?: IapPlatform.Ios,
                price = (json["price"] as? Number)?.toDouble(),
                productStatusAndroid = (json["productStatusAndroid"] as? String)?.let { runCatching { ProductStatusAndroid.fromJson(it) }.getOrNull() ?: ProductStatusAndroid.Unknown },
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
        "displayName" to displayName,
        "displayPrice" to displayPrice,
        "id" to id,
        "nameAndroid" to nameAndroid,
        "platform" to platform.toJson(),
        "price" to price,
        "productStatusAndroid" to productStatusAndroid?.toJson(),
        "subscriptionOffers" to subscriptionOffers.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

public data class ProductSubscriptionIOS(
    /**
     * Subscriptions included in this Apple subscription bundle. Empty or null for
     * every other product type (Apple 27+ beta).
     */
    val bundledSubscriptionsIOS: List<BundledSubscriptionIOS>? = null,
    override val currency: String,
    override val debugDescription: String? = null,
    override val description: String,
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
     * iOS 26.4+ subscription pricing terms, including billing plan metadata for
     * monthly subscriptions with a 12-month commitment.
     */
    val pricingTermsIOS: List<SubscriptionPricingTermsIOS>? = null,
    /**
     * App Store subscription group identifier for intro-offer eligibility checks.
     */
    val subscriptionGroupIdIOS: String? = null,
    /**
     * Standardized subscription offers.
     * Cross-platform type with iOS-specific fields using suffix.
     * @see https://openiap.dev/docs/types/subscription-offer
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
                bundledSubscriptionsIOS = (json["bundledSubscriptionsIOS"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { BundledSubscriptionIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for BundledSubscriptionIOS") },
                currency = json["currency"] as? String ?: "",
                debugDescription = json["debugDescription"] as? String,
                description = json["description"] as? String ?: "",
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
                pricingTermsIOS = (json["pricingTermsIOS"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionPricingTermsIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPricingTermsIOS") },
                subscriptionGroupIdIOS = json["subscriptionGroupIdIOS"] as? String,
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
        "bundledSubscriptionsIOS" to bundledSubscriptionsIOS?.map { it.toJson() },
        "currency" to currency,
        "debugDescription" to debugDescription,
        "description" to description,
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
        "pricingTermsIOS" to pricingTermsIOS?.map { it.toJson() },
        "subscriptionGroupIdIOS" to subscriptionGroupIdIOS,
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
    /**
     * Pending purchase update for uncommitted subscription upgrade/downgrade (Android)
     * Contains the new products and purchase token for the pending transaction.
     * Returns null if no pending update exists.
     * Available in Google Play Billing Library 5.0+
     */
    val pendingPurchaseUpdateAndroid: PendingPurchaseUpdateAndroid? = null,
    override val productId: String,
    override val purchaseState: PurchaseState,
    override val purchaseToken: String? = null,
    override val quantity: Int,
    val signatureAndroid: String? = null,
    /**
     * Store where purchase was made
     */
    override val store: IapStore,
    /**
     * Unix timestamp in milliseconds since January 1, 1970 UTC.
     */
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
                pendingPurchaseUpdateAndroid = (json["pendingPurchaseUpdateAndroid"] as? Map<String, Any?>)?.let { PendingPurchaseUpdateAndroid.fromJson(it) },
                productId = json["productId"] as? String ?: "",
                purchaseState = runCatching { (json["purchaseState"] as? String)?.let { PurchaseState.fromJson(it) } }.getOrNull() ?: PurchaseState.Unknown,
                purchaseToken = json["purchaseToken"] as? String,
                quantity = (json["quantity"] as? Number)?.toInt() ?: 0,
                signatureAndroid = json["signatureAndroid"] as? String,
                store = runCatching { (json["store"] as? String)?.let { IapStore.fromJson(it) } }.getOrNull() ?: IapStore.Unknown,
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
        "pendingPurchaseUpdateAndroid" to pendingPurchaseUpdateAndroid?.toJson(),
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
    val debugMessage: String? = null,
    val isEmptyProductList: Boolean? = null,
    val message: String,
    val productId: String? = null,
    val productIds: List<String>? = null,
    val productType: String? = null,
    val responseCode: Int? = null
) {

    var subResponseCodeAndroid: SubResponseCodeAndroid? = null
        private set

    constructor(
        code: ErrorCode,
        debugMessage: String? = null,
        isEmptyProductList: Boolean? = null,
        message: String,
        productId: String? = null,
        productIds: List<String>? = null,
        productType: String? = null,
        responseCode: Int? = null,
        subResponseCodeAndroid: SubResponseCodeAndroid?,
    ) : this(
        code = code,
        debugMessage = debugMessage,
        isEmptyProductList = isEmptyProductList,
        message = message,
        productId = productId,
        productIds = productIds,
        productType = productType,
        responseCode = responseCode,
    ) {
        this.subResponseCodeAndroid = subResponseCodeAndroid
    }

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseError {
            return PurchaseError(
                code = runCatching { (json["code"] as? String)?.let { ErrorCode.fromJson(it) } }.getOrNull() ?: ErrorCode.Unknown,
                debugMessage = json["debugMessage"] as? String,
                isEmptyProductList = json["isEmptyProductList"] as? Boolean,
                message = json["message"] as? String ?: "",
                productId = json["productId"] as? String,
                productIds = (json["productIds"] as? List<*>)?.mapNotNull { it as? String },
                productType = json["productType"] as? String,
                responseCode = (json["responseCode"] as? Number)?.toInt(),
                subResponseCodeAndroid = (json["subResponseCodeAndroid"] as? String)?.let { SubResponseCodeAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "PurchaseError",
        "code" to code.toJson(),
        "message" to message,
        "productId" to productId,
        "debugMessage" to debugMessage,
        "responseCode" to responseCode,
        "subResponseCodeAndroid" to subResponseCodeAndroid?.toJson(),
        "productIds" to productIds,
        "productType" to productType,
        "isEmptyProductList" to isEmptyProductList,
    )
}

public data class PurchaseIOS(
    /**
     * Advanced Commerce API metadata (iOS 18.4+).
     * Present only for transactions that use the Advanced Commerce API.
     * Contains item details, tax information, and refund data for generic SKU purchases.
     */
    val advancedCommerceInfoIOS: AdvancedCommerceInfoIOS? = null,
    val appAccountToken: String? = null,
    val appBundleIdIOS: String? = null,
    /**
     * iOS 26.4+ billing plan selected for this transaction.
     */
    val billingPlanTypeIOS: SubscriptionBillingPlanTypeIOS? = null,
    /**
     * Original transaction identifier for the subscription bundle that produced
     * this transaction (Apple 27+ SDK; back-deployed by StoreKit).
     */
    val bundleOriginalTransactionIdIOS: String? = null,
    /**
     * Product identifier of the subscription bundle that produced this transaction.
     */
    val bundleProductIdIOS: String? = null,
    /**
     * Subscription-group identifier of the bundle that produced this transaction.
     */
    val bundleSubscriptionGroupIdIOS: String? = null,
    /**
     * Bundle transaction identifier associated with this component transaction.
     */
    val bundleTransactionIdIOS: String? = null,
    /**
     * iOS 26.4+ progress information for monthly subscriptions with a 12-month commitment.
     */
    val commitmentInfoIOS: TransactionCommitmentInfoIOS? = null,
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
    /**
     * StoreKit ownership raw value. Xcode 27 adds the back-deployed assigned value.
     */
    val ownershipTypeIOS: String? = null,
    /**
     * Original transaction identifier replaced when moving between a standalone
     * subscription and a subscription bundle.
     */
    val previousOriginalTransactionIdIOS: String? = null,
    override val productId: String,
    override val purchaseState: PurchaseState,
    override val purchaseToken: String? = null,
    override val quantity: Int,
    val quantityIOS: Int? = null,
    val reasonIOS: String? = null,
    val reasonStringRepresentationIOS: String? = null,
    val renewalInfoIOS: RenewalInfoIOS? = null,
    val revocationDateIOS: Double? = null,
    /**
     * Normalized StoreKit revocation reason, including upgraded_to_bundle.
     */
    val revocationReasonIOS: String? = null,
    /**
     * StoreKit revocation type, including assignment-revocation on Apple 26.4+
     * when compiled with the Xcode 27 SDK.
     */
    val revocationTypeIOS: String? = null,
    /**
     * Store where purchase was made
     */
    override val store: IapStore,
    val storefrontCountryCodeIOS: String? = null,
    val subscriptionGroupIdIOS: String? = null,
    /**
     * Unix timestamp in milliseconds since January 1, 1970 UTC.
     */
    override val transactionDate: Double,
    val transactionId: String,
    val transactionReasonIOS: String? = null,
    val webOrderLineItemIdIOS: String? = null
) : PurchaseCommon, Purchase {

    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseIOS {
            return PurchaseIOS(
                advancedCommerceInfoIOS = (json["advancedCommerceInfoIOS"] as? Map<String, Any?>)?.let { AdvancedCommerceInfoIOS.fromJson(it) },
                appAccountToken = json["appAccountToken"] as? String,
                appBundleIdIOS = json["appBundleIdIOS"] as? String,
                billingPlanTypeIOS = (json["billingPlanTypeIOS"] as? String)?.let { runCatching { SubscriptionBillingPlanTypeIOS.fromJson(it) }.getOrNull() ?: SubscriptionBillingPlanTypeIOS.Unknown },
                bundleOriginalTransactionIdIOS = json["bundleOriginalTransactionIdIOS"] as? String,
                bundleProductIdIOS = json["bundleProductIdIOS"] as? String,
                bundleSubscriptionGroupIdIOS = json["bundleSubscriptionGroupIdIOS"] as? String,
                bundleTransactionIdIOS = json["bundleTransactionIdIOS"] as? String,
                commitmentInfoIOS = (json["commitmentInfoIOS"] as? Map<String, Any?>)?.let { TransactionCommitmentInfoIOS.fromJson(it) },
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
                previousOriginalTransactionIdIOS = json["previousOriginalTransactionIdIOS"] as? String,
                productId = json["productId"] as? String ?: "",
                purchaseState = runCatching { (json["purchaseState"] as? String)?.let { PurchaseState.fromJson(it) } }.getOrNull() ?: PurchaseState.Unknown,
                purchaseToken = json["purchaseToken"] as? String,
                quantity = (json["quantity"] as? Number)?.toInt() ?: 0,
                quantityIOS = (json["quantityIOS"] as? Number)?.toInt(),
                reasonIOS = json["reasonIOS"] as? String,
                reasonStringRepresentationIOS = json["reasonStringRepresentationIOS"] as? String,
                renewalInfoIOS = (json["renewalInfoIOS"] as? Map<String, Any?>)?.let { RenewalInfoIOS.fromJson(it) },
                revocationDateIOS = (json["revocationDateIOS"] as? Number)?.toDouble(),
                revocationReasonIOS = json["revocationReasonIOS"] as? String,
                revocationTypeIOS = json["revocationTypeIOS"] as? String,
                store = runCatching { (json["store"] as? String)?.let { IapStore.fromJson(it) } }.getOrNull() ?: IapStore.Unknown,
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
        "advancedCommerceInfoIOS" to advancedCommerceInfoIOS?.toJson(),
        "appAccountToken" to appAccountToken,
        "appBundleIdIOS" to appBundleIdIOS,
        "billingPlanTypeIOS" to billingPlanTypeIOS?.toJson(),
        "bundleOriginalTransactionIdIOS" to bundleOriginalTransactionIdIOS,
        "bundleProductIdIOS" to bundleProductIdIOS,
        "bundleSubscriptionGroupIdIOS" to bundleSubscriptionGroupIdIOS,
        "bundleTransactionIdIOS" to bundleTransactionIdIOS,
        "commitmentInfoIOS" to commitmentInfoIOS?.toJson(),
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
        "previousOriginalTransactionIdIOS" to previousOriginalTransactionIdIOS,
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
        "revocationTypeIOS" to revocationTypeIOS,
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

public data class RenewalCommitmentInfoIOS(
    val commitmentAutoRenewProductId: String,
    val commitmentAutoRenewStatus: Boolean,
    val commitmentRenewalBillingPlanType: SubscriptionBillingPlanTypeIOS,
    val commitmentRenewalDate: Double,
    val commitmentRenewalPrice: Double
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RenewalCommitmentInfoIOS {
            return RenewalCommitmentInfoIOS(
                commitmentAutoRenewProductId = json["commitmentAutoRenewProductId"] as? String ?: "",
                commitmentAutoRenewStatus = json["commitmentAutoRenewStatus"] as? Boolean ?: false,
                commitmentRenewalBillingPlanType = runCatching { (json["commitmentRenewalBillingPlanType"] as? String)?.let { SubscriptionBillingPlanTypeIOS.fromJson(it) } }.getOrNull() ?: SubscriptionBillingPlanTypeIOS.Unknown,
                commitmentRenewalDate = (json["commitmentRenewalDate"] as? Number)?.toDouble() ?: 0.0,
                commitmentRenewalPrice = (json["commitmentRenewalPrice"] as? Number)?.toDouble() ?: 0.0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RenewalCommitmentInfoIOS",
        "commitmentAutoRenewProductId" to commitmentAutoRenewProductId,
        "commitmentAutoRenewStatus" to commitmentAutoRenewStatus,
        "commitmentRenewalBillingPlanType" to commitmentRenewalBillingPlanType.toJson(),
        "commitmentRenewalDate" to commitmentRenewalDate,
        "commitmentRenewalPrice" to commitmentRenewalPrice,
    )
}

/**
 * Subscription renewal information from Product.SubscriptionInfo.RenewalInfo
 * https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
 */
public data class RenewalInfoIOS(
    val autoRenewPreference: String? = null,
    /**
     * Original transaction identifier for the bundle used by the next renewal.
     */
    val bundleOriginalTransactionId: String? = null,
    /**
     * Product identifier for the bundle used by the next renewal.
     */
    val bundleProductId: String? = null,
    /**
     * Subscription-group identifier for the bundle used by the next renewal.
     */
    val bundleSubscriptionGroupId: String? = null,
    /**
     * iOS 26.4+ renewal commitment metadata for monthly subscriptions with a
     * 12-month commitment.
     */
    val commitmentInfo: RenewalCommitmentInfoIOS? = null,
    /**
     * StoreKit's raw integer expiration-reason value represented as a string.
     * Xcode 27 adds the back-deployed unbundled case. Preserve unknown future values.
     */
    val expirationReason: String? = null,
    /**
     * Grace period expiration date (milliseconds since epoch)
     * When set, subscription is in grace period (billing issue but still has access)
     */
    val gracePeriodExpirationDate: Double? = null,
    /**
     * True if subscription failed to renew due to billing issue and is retrying
     * StoreKit exposes this directly as RenewalInfo.isInBillingRetry.
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
     * iOS 26.4+ billing plan that will renew after the current period.
     */
    val renewalBillingPlanType: SubscriptionBillingPlanTypeIOS? = null,
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
    val willAutoRenew: Boolean,
    /**
     * Whether this subscription will leave its bundle and renew standalone.
     */
    val willUnbundle: Boolean? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): RenewalInfoIOS {
            return RenewalInfoIOS(
                autoRenewPreference = json["autoRenewPreference"] as? String,
                bundleOriginalTransactionId = json["bundleOriginalTransactionId"] as? String,
                bundleProductId = json["bundleProductId"] as? String,
                bundleSubscriptionGroupId = json["bundleSubscriptionGroupId"] as? String,
                commitmentInfo = (json["commitmentInfo"] as? Map<String, Any?>)?.let { RenewalCommitmentInfoIOS.fromJson(it) },
                expirationReason = json["expirationReason"] as? String,
                gracePeriodExpirationDate = (json["gracePeriodExpirationDate"] as? Number)?.toDouble(),
                isInBillingRetry = json["isInBillingRetry"] as? Boolean,
                jsonRepresentation = json["jsonRepresentation"] as? String,
                pendingUpgradeProductId = json["pendingUpgradeProductId"] as? String,
                priceIncreaseStatus = json["priceIncreaseStatus"] as? String,
                renewalBillingPlanType = (json["renewalBillingPlanType"] as? String)?.let { runCatching { SubscriptionBillingPlanTypeIOS.fromJson(it) }.getOrNull() ?: SubscriptionBillingPlanTypeIOS.Unknown },
                renewalDate = (json["renewalDate"] as? Number)?.toDouble(),
                renewalOfferId = json["renewalOfferId"] as? String,
                renewalOfferType = json["renewalOfferType"] as? String,
                willAutoRenew = json["willAutoRenew"] as? Boolean ?: false,
                willUnbundle = json["willUnbundle"] as? Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RenewalInfoIOS",
        "autoRenewPreference" to autoRenewPreference,
        "bundleOriginalTransactionId" to bundleOriginalTransactionId,
        "bundleProductId" to bundleProductId,
        "bundleSubscriptionGroupId" to bundleSubscriptionGroupId,
        "commitmentInfo" to commitmentInfo?.toJson(),
        "expirationReason" to expirationReason,
        "gracePeriodExpirationDate" to gracePeriodExpirationDate,
        "isInBillingRetry" to isInBillingRetry,
        "jsonRepresentation" to jsonRepresentation,
        "pendingUpgradeProductId" to pendingUpgradeProductId,
        "priceIncreaseStatus" to priceIncreaseStatus,
        "renewalBillingPlanType" to renewalBillingPlanType?.toJson(),
        "renewalDate" to renewalDate,
        "renewalOfferId" to renewalOfferId,
        "renewalOfferType" to renewalOfferType,
        "willAutoRenew" to willAutoRenew,
        "willUnbundle" to willUnbundle,
    )
}

/**
 * Rental details for one-time purchase products that can be rented (Android)
 * Available in Google Play Billing Library 8.0+
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
     * True when the purchase is valid and actionable.
     * Only entitled, pending-acknowledgment, or ready-to-consume return true.
     * Callers must still match productId and use the platform plus app-owned product
     * type to choose the fulfillment path.
     */
    val isValid: Boolean,
    /**
     * The current state of the purchase.
     */
    val state: IapkitPurchaseState,
    val store: IapStore
) {

    /**
     * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
     * Public product payload when includeClientPayload was requested, the
     * Apple or Google receipt is valid, and a payload exists for that product.
     */
    var clientPayload: IapkitProductClientPayload? = null
        private set

    /**
     * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
     * Store-verified product identifier when the provider returns one.
     */
    var productId: String? = null
        private set

    constructor(
        isValid: Boolean,
        state: IapkitPurchaseState,
        store: IapStore,
        clientPayload: IapkitProductClientPayload?,
        productId: String? = null,
    ) : this(
        isValid = isValid,
        state = state,
        store = store,
    ) {
        this.clientPayload = clientPayload
        this.productId = productId
    }

    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitResult {
            return RequestVerifyPurchaseWithIapkitResult(
                isValid = json["isValid"] as? Boolean ?: false,
                state = runCatching { (json["state"] as? String)?.let { IapkitPurchaseState.fromJson(it) } }.getOrNull() ?: IapkitPurchaseState.Unknown,
                store = runCatching { (json["store"] as? String)?.let { IapStore.fromJson(it) } }.getOrNull() ?: IapStore.Unknown,
                clientPayload = (json["clientPayload"] as? Map<String, Any?>)?.let { IapkitProductClientPayload.fromJson(it) },
                productId = json["productId"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "RequestVerifyPurchaseWithIapkitResult",
        "store" to store.toJson(),
        "isValid" to isValid,
        "state" to state.toJson(),
        "productId" to productId,
        "clientPayload" to clientPayload?.toJson(),
    )
}

public data class SubscriptionCommitmentInfoIOS(
    val displayPrice: String,
    val period: SubscriptionPeriodValueIOS,
    val price: Double
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionCommitmentInfoIOS {
            return SubscriptionCommitmentInfoIOS(
                displayPrice = json["displayPrice"] as? String ?: "",
                period = (json["period"] as? Map<String, Any?>)?.let { SubscriptionPeriodValueIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPeriodValueIOS"),
                price = (json["price"] as? Number)?.toDouble() ?: 0.0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionCommitmentInfoIOS",
        "displayPrice" to displayPrice,
        "period" to period.toJson(),
        "price" to price,
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
 * @see https://openiap.dev/docs/types/subscription-offer
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
     * - Android: offerId from the Google Play subscription offer
     */
    val id: String,
    /**
     * [Android] Installment plan details for this subscription offer.
     * Only set for installment subscription plans; null for non-installment plans.
     * Available in Google Play Billing Library 7.0+
     */
    val installmentPlanDetailsAndroid: InstallmentPlanDetailsAndroid? = null,
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
                installmentPlanDetailsAndroid = (json["installmentPlanDetailsAndroid"] as? Map<String, Any?>)?.let { InstallmentPlanDetailsAndroid.fromJson(it) },
                keyIdentifierIOS = json["keyIdentifierIOS"] as? String,
                localizedPriceIOS = json["localizedPriceIOS"] as? String,
                nonceIOS = json["nonceIOS"] as? String,
                numberOfPeriodsIOS = (json["numberOfPeriodsIOS"] as? Number)?.toInt(),
                offerTagsAndroid = (json["offerTagsAndroid"] as? List<*>)?.mapNotNull { it as? String },
                offerTokenAndroid = json["offerTokenAndroid"] as? String,
                paymentMode = (json["paymentMode"] as? String)?.let { runCatching { PaymentMode.fromJson(it) }.getOrNull() ?: PaymentMode.Unknown },
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
        "installmentPlanDetailsAndroid" to installmentPlanDetailsAndroid?.toJson(),
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
                unit = runCatching { (json["unit"] as? String)?.let { SubscriptionPeriodUnit.fromJson(it) } }.getOrNull() ?: SubscriptionPeriodUnit.Unknown,
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

public data class SubscriptionPricingTermsIOS(
    val billingDisplayPrice: String,
    val billingPeriod: SubscriptionPeriodValueIOS,
    val billingPlanType: SubscriptionBillingPlanTypeIOS,
    val billingPrice: Double,
    val commitmentInfo: SubscriptionCommitmentInfoIOS,
    val subscriptionOffers: List<SubscriptionOffer>? = null
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): SubscriptionPricingTermsIOS {
            return SubscriptionPricingTermsIOS(
                billingDisplayPrice = json["billingDisplayPrice"] as? String ?: "",
                billingPeriod = (json["billingPeriod"] as? Map<String, Any?>)?.let { SubscriptionPeriodValueIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionPeriodValueIOS"),
                billingPlanType = runCatching { (json["billingPlanType"] as? String)?.let { SubscriptionBillingPlanTypeIOS.fromJson(it) } }.getOrNull() ?: SubscriptionBillingPlanTypeIOS.Unknown,
                billingPrice = (json["billingPrice"] as? Number)?.toDouble() ?: 0.0,
                commitmentInfo = (json["commitmentInfo"] as? Map<String, Any?>)?.let { SubscriptionCommitmentInfoIOS.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionCommitmentInfoIOS"),
                subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { SubscriptionOffer.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for SubscriptionOffer") },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "SubscriptionPricingTermsIOS",
        "billingDisplayPrice" to billingDisplayPrice,
        "billingPeriod" to billingPeriod.toJson(),
        "billingPlanType" to billingPlanType.toJson(),
        "billingPrice" to billingPrice,
        "commitmentInfo" to commitmentInfo.toJson(),
        "subscriptionOffers" to subscriptionOffers?.map { it.toJson() },
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

public data class TransactionCommitmentInfoIOS(
    val billingPeriodNumber: Int,
    val commitmentExpiresDate: Double,
    val commitmentPrice: Double,
    val totalBillingPeriods: Int
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): TransactionCommitmentInfoIOS {
            return TransactionCommitmentInfoIOS(
                billingPeriodNumber = (json["billingPeriodNumber"] as? Number)?.toInt() ?: 0,
                commitmentExpiresDate = (json["commitmentExpiresDate"] as? Number)?.toDouble() ?: 0.0,
                commitmentPrice = (json["commitmentPrice"] as? Number)?.toDouble() ?: 0.0,
                totalBillingPeriods = (json["totalBillingPeriods"] as? Number)?.toInt() ?: 0,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "TransactionCommitmentInfoIOS",
        "billingPeriodNumber" to billingPeriodNumber,
        "commitmentExpiresDate" to commitmentExpiresDate,
        "commitmentPrice" to commitmentPrice,
        "totalBillingPeriods" to totalBillingPeriods,
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

    /**
     * Structured product details selected in the user-choice flow, including the
     * product type and offer token. Legacy payloads may omit this field; use
     * products as the product-ID fallback. Available in OpenIAP Spec 2.3.0 /
     * openiap-google 2.3.1 (requires Play Billing 9.1+).
     */
    var productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>? = null
        private set

    /**
     * External transaction ID of the originating subscription when the user is
     * upgrading or downgrading a developer-billed subscription. Available in
     * OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).
     */
    var originalExternalTransactionId: String? = null
        private set

    constructor(
        externalTransactionToken: String,
        products: List<String>,
        productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>?,
        originalExternalTransactionId: String? = null,
    ) : this(
        externalTransactionToken = externalTransactionToken,
        products = products,
    ) {
        this.productDetailsAndroid = productDetailsAndroid
        this.originalExternalTransactionId = originalExternalTransactionId
    }

    companion object {
        fun fromJson(json: Map<String, Any?>): UserChoiceBillingDetails {
            return UserChoiceBillingDetails(
                externalTransactionToken = json["externalTransactionToken"] as? String ?: "",
                products = (json["products"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                productDetailsAndroid = (json["productDetailsAndroid"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { DeveloperProvidedBillingProductAndroid.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for DeveloperProvidedBillingProductAndroid") },
                originalExternalTransactionId = json["originalExternalTransactionId"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "UserChoiceBillingDetails",
        "externalTransactionToken" to externalTransactionToken,
        "originalExternalTransactionId" to originalExternalTransactionId,
        "products" to products,
        "productDetailsAndroid" to productDetailsAndroid?.map { it.toJson() },
    )
}

/**
 * Valid time window for when an offer is available (Android)
 * Available in Google Play Billing Library 8.0+
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
        fun fromJson(json: Map<String, Any?>): AndroidSubscriptionOfferInput? {
            val offerToken = json["offerToken"] as? String
            val sku = json["sku"] as? String
            if (offerToken == null || sku == null) return null
            return AndroidSubscriptionOfferInput(
                offerToken = offerToken,
                sku = sku,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "offerToken" to offerToken,
        "sku" to sku,
    )
}

/**
 * Parameters for showing a billing program information dialog (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public data class BillingProgramInformationDialogParamsAndroid(
    /**
     * Billing program. Currently only BILLING_CHOICE is supported.
     */
    val billingProgram: BillingProgramAndroid = BillingProgramAndroid.BillingChoice,
    /**
     * External transaction token returned by the Billing Choice reporting-details flow.
     */
    val externalTransactionToken: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): BillingProgramInformationDialogParamsAndroid? {
            val billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.BillingChoice
            val externalTransactionToken = json["externalTransactionToken"] as? String
            if (externalTransactionToken == null) return null
            return BillingProgramInformationDialogParamsAndroid(
                billingProgram = billingProgram,
                externalTransactionToken = externalTransactionToken,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "externalTransactionToken" to externalTransactionToken,
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
 * Parameters for a developer billing option in a purchase flow (Android).
 * Used with BillingFlowParams for external payments (8.3.0+) and Billing Choice
 * (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+).
 * Only billingProgram is required; link fields are used when the selected program
 * links outside the app.
 */
public data class DeveloperBillingOptionParamsAndroid(
    /**
     * The billing program. Use EXTERNAL_PAYMENTS or BILLING_CHOICE.
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * A pre-generated external transaction token for a Billing Choice external-link
     * flow. Omit it when Google Play should provide the token in the callback.
     */
    val externalTransactionToken: String? = null,
    /**
     * The launch mode for the external payment link.
     * Required only when the selected billing program links outside the app.
     */
    val launchMode: DeveloperBillingLaunchModeAndroid? = null,
    /**
     * The URI where the external payment will be processed.
     * Required only when the selected billing program links outside the app.
     */
    val linkUri: String? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): DeveloperBillingOptionParamsAndroid? {
            val billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified
            val externalTransactionToken = json["externalTransactionToken"] as? String
            val launchMode = (json["launchMode"] as? String)?.let { DeveloperBillingLaunchModeAndroid.fromJson(it) }
            val linkUri = json["linkUri"] as? String
            return DeveloperBillingOptionParamsAndroid(
                billingProgram = billingProgram,
                externalTransactionToken = externalTransactionToken,
                launchMode = launchMode,
                linkUri = linkUri,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "externalTransactionToken" to externalTransactionToken,
        "launchMode" to launchMode?.toJson(),
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
        fun fromJson(json: Map<String, Any?>): DiscountOfferInputIOS? {
            val identifier = json["identifier"] as? String
            val keyIdentifier = json["keyIdentifier"] as? String
            val nonce = json["nonce"] as? String
            val signature = json["signature"] as? String
            val timestamp = (json["timestamp"] as? Number)?.toDouble()
            if (identifier == null || keyIdentifier == null || nonce == null || signature == null || timestamp == null) return null
            return DiscountOfferInputIOS(
                identifier = identifier,
                keyIdentifier = keyIdentifier,
                nonce = nonce,
                signature = signature,
                timestamp = timestamp,
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
 * Parameters for fetching Billing Choice display information (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
public data class GetBillingChoiceInfoParamsAndroid(
    /**
     * Billing program. Currently only BILLING_CHOICE is supported.
     */
    val billingProgram: BillingProgramAndroid = BillingProgramAndroid.BillingChoice,
    /**
     * Desired Play Billing choice image layout.
     */
    val playBillingChoiceImageLayout: BillingChoiceImageLayoutAndroid = BillingChoiceImageLayoutAndroid.RectangularFourByOne,
    /**
     * BCP 47 locale tag. If omitted, Play Billing uses the user's default locale.
     */
    val userLocale: String? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): GetBillingChoiceInfoParamsAndroid {
            return GetBillingChoiceInfoParamsAndroid(
                billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.BillingChoice,
                playBillingChoiceImageLayout = (json["playBillingChoiceImageLayout"] as? String)?.let { BillingChoiceImageLayoutAndroid.fromJson(it) } ?: BillingChoiceImageLayoutAndroid.RectangularFourByOne,
                userLocale = json["userLocale"] as? String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "playBillingChoiceImageLayout" to playBillingChoiceImageLayout.toJson(),
        "userLocale" to userLocale,
    )
}

/**
 * Parameters for showing Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
public data class InAppMessageParamsAndroid(
    /**
     * In-app message categories to show. Defaults to transactional messages.
     */
    val categories: List<InAppMessageCategoryAndroid>? = listOf(InAppMessageCategoryAndroid.Transactional)
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): InAppMessageParamsAndroid {
            return InAppMessageParamsAndroid(
                categories = (json["categories"] as? List<*>)?.mapNotNull { runCatching { (it as? String)?.let { InAppMessageCategoryAndroid.fromJson(it) } }.getOrNull() ?: InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId } ?: listOf(InAppMessageCategoryAndroid.Transactional),
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "categories" to categories?.map { it.toJson() },
    )
}

/**
 * Connection initialization configuration
 */
public data class InitConnectionConfig(
    /**
     * Billing Choice renderer configured in Play Console. Available in OpenIAP
     * Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * GOOGLE_RENDERED registers the developer-provided billing listener so OpenIAP
     * can emit the selection event. DEVELOPER_RENDERED omits that listener so the
     * app can render its own choice screen and use the reporting/dialog/link APIs.
     * Must match choiceScreenType returned by isBillingProgramAvailableAndroid.
     * Defaults to GOOGLE_RENDERED.
     */
    val billingChoiceScreenTypeAndroid: BillingChoiceScreenTypeAndroid? = BillingChoiceScreenTypeAndroid.GoogleRendered,
    /**
     * Enable a specific billing program for Android (7.0+)
     * When set, enables the specified billing program for external transactions.
     * - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)
     * - EXTERNAL_CONTENT_LINK: Link to external content (introduced in 8.2.0; use 8.2.1+)
     * - EXTERNAL_OFFER: External offers for digital content (introduced in 8.2.0; use 8.2.1+)
     * - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)
     * - BILLING_CHOICE: Google-rendered or developer-rendered billing choice
     *   (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+)
     */
    val enableBillingProgramAndroid: BillingProgramAndroid? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): InitConnectionConfig {
            return InitConnectionConfig(
                billingChoiceScreenTypeAndroid = (json["billingChoiceScreenTypeAndroid"] as? String)?.let { BillingChoiceScreenTypeAndroid.fromJson(it) } ?: BillingChoiceScreenTypeAndroid.GoogleRendered,
                enableBillingProgramAndroid = (json["enableBillingProgramAndroid"] as? String)?.let { BillingProgramAndroid.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingChoiceScreenTypeAndroid" to billingChoiceScreenTypeAndroid?.toJson(),
        "enableBillingProgramAndroid" to enableBillingProgramAndroid?.toJson(),
    )
}

/**
 * Parameters for launching an external link (Android)
 * Used with launchExternalLink to initiate external offer, app install, or
 * developer-rendered Billing Choice flows
 * Available in Google Play Billing Library 8.2.0+
 */
public data class LaunchExternalLinkParamsAndroid(
    /**
     * The billing program (EXTERNAL_CONTENT_LINK, EXTERNAL_OFFER, or BILLING_CHOICE)
     */
    val billingProgram: BillingProgramAndroid,
    /**
     * External transaction token for a developer-rendered Billing Choice external-link
     * flow. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
     * (requires Play Billing 9.1.0+). Generate it with createBillingProgramReportingDetailsAndroid.
     */
    val externalTransactionToken: String? = null,
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
        fun fromJson(json: Map<String, Any?>): LaunchExternalLinkParamsAndroid? {
            val billingProgram = (json["billingProgram"] as? String)?.let { BillingProgramAndroid.fromJson(it) } ?: BillingProgramAndroid.Unspecified
            val externalTransactionToken = json["externalTransactionToken"] as? String
            val launchMode = (json["launchMode"] as? String)?.let { ExternalLinkLaunchModeAndroid.fromJson(it) } ?: ExternalLinkLaunchModeAndroid.Unspecified
            val linkType = (json["linkType"] as? String)?.let { ExternalLinkTypeAndroid.fromJson(it) } ?: ExternalLinkTypeAndroid.Unspecified
            val linkUri = json["linkUri"] as? String
            if (linkUri == null) return null
            return LaunchExternalLinkParamsAndroid(
                billingProgram = billingProgram,
                externalTransactionToken = externalTransactionToken,
                launchMode = launchMode,
                linkType = linkType,
                linkUri = linkUri,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "billingProgram" to billingProgram.toJson(),
        "externalTransactionToken" to externalTransactionToken,
        "launchMode" to launchMode.toJson(),
        "linkType" to linkType.toJson(),
        "linkUri" to linkUri,
    )
}

public data class ProductRequest(
    val skus: List<String>,
    val type: ProductQueryType? = ProductQueryType.InApp
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): ProductRequest? {
            val skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String }
            val type = (json["type"] as? String)?.let { ProductQueryType.fromJson(it) } ?: ProductQueryType.InApp
            if (skus == null) return null
            return ProductRequest(
                skus = skus,
                type = type,
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
        fun fromJson(json: Map<String, Any?>): PromotionalOfferJWSInputIOS? {
            val jws = json["jws"] as? String
            val offerId = json["offerId"] as? String
            if (jws == null || offerId == null) return null
            return PromotionalOfferJWSInputIOS(
                jws = jws,
                offerId = offerId,
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

public data class PurchaseUpdatedListenerOptions(
    /**
     * iOS only. Defaults to true. When false, listener callbacks also receive
     * StoreKit replay events for a transaction ID that was already emitted during
     * the current connection session. Android ignores this option.
     */
    val dedupeTransactionIOS: Boolean? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): PurchaseUpdatedListenerOptions {
            return PurchaseUpdatedListenerOptions(
                dedupeTransactionIOS = json["dedupeTransactionIOS"] as? Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "dedupeTransactionIOS" to dedupeTransactionIOS,
    )
}

public data class RequestPurchaseAndroidProps(
    /**
     * Developer billing option parameters for external payments and Billing Choice.
     * Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
     * (requires Play Billing 9.1.0+).
     */
    val developerBillingOption: DeveloperBillingOptionParamsAndroid? = null,
    /**
     * Personalized offer flag.
     * When true, indicates the price was customized for this user.
     */
    val isOfferPersonalized: Boolean? = null,
    /**
     * Obfuscated account ID
     */
    val obfuscatedAccountId: String? = null,
    /**
     * Obfuscated profile ID
     */
    val obfuscatedProfileId: String? = null,
    /**
     * Offer token for one-time purchase discounts (8.0+).
     * Pass the offerToken from discountOffers
     * to apply a discount offer to the purchase.
     */
    val offerToken: String? = null,
    /**
     * List of product SKUs
     */
    val skus: List<String>
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseAndroidProps? {
            val developerBillingOption = (json["developerBillingOption"] as? Map<String, Any?>)?.let { DeveloperBillingOptionParamsAndroid.fromJson(it) }
            val isOfferPersonalized = json["isOfferPersonalized"] as? Boolean
            val obfuscatedAccountId = json["obfuscatedAccountId"] as? String
            val obfuscatedProfileId = json["obfuscatedProfileId"] as? String
            val offerToken = json["offerToken"] as? String
            val skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String }
            if (skus == null) return null
            return RequestPurchaseAndroidProps(
                developerBillingOption = developerBillingOption,
                isOfferPersonalized = isOfferPersonalized,
                obfuscatedAccountId = obfuscatedAccountId,
                obfuscatedProfileId = obfuscatedProfileId,
                offerToken = offerToken,
                skus = skus,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "developerBillingOption" to developerBillingOption?.toJson(),
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountId" to obfuscatedAccountId,
        "obfuscatedProfileId" to obfuscatedProfileId,
        "offerToken" to offerToken,
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
     * Purchase quantity
     */
    val quantity: Int? = null,
    /**
     * Product SKU
     */
    val sku: String,
    /**
     * Promotional offer to apply (subscriptions only, ignored for one-time purchases).
     * iOS only supports promotional offers for auto-renewable subscriptions.
     */
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchaseIosProps? {
            val advancedCommerceData = json["advancedCommerceData"] as? String
            val andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as? Boolean
            val appAccountToken = json["appAccountToken"] as? String
            val quantity = (json["quantity"] as? Number)?.toInt()
            val sku = json["sku"] as? String
            val withOffer = (json["withOffer"] as? Map<String, Any?>)?.let { DiscountOfferInputIOS.fromJson(it) }
            if (sku == null) return null
            return RequestPurchaseIosProps(
                advancedCommerceData = advancedCommerceData,
                andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically,
                appAccountToken = appAccountToken,
                quantity = quantity,
                sku = sku,
                withOffer = withOffer,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "advancedCommerceData" to advancedCommerceData,
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "quantity" to quantity,
        "sku" to sku,
        "withOffer" to withOffer?.toJson(),
    )
}

public data class RequestPurchaseProps(
    val request: Request,
    /**
     * Explicit purchase type hint (defaults to in-app)
     */
    val type: ProductQueryType
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
            val purchaseJson = json["requestPurchase"] as Map<String, Any?>?
            val subscriptionJson = json["requestSubscription"] as Map<String, Any?>?
            require((purchaseJson == null) != (subscriptionJson == null)) {
                "RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription"
            }
            if (purchaseJson != null) {
                val request = Request.Purchase(RequestPurchasePropsByPlatforms.fromJson(purchaseJson))
                val finalType = rawType ?: ProductQueryType.InApp
                require(finalType == ProductQueryType.InApp) { "type must be IN_APP when requestPurchase is provided" }
                return RequestPurchaseProps(request = request, type = finalType)
            }
            if (subscriptionJson != null) {
                val request = Request.Subscription(RequestSubscriptionPropsByPlatforms.fromJson(subscriptionJson))
                val finalType = rawType ?: ProductQueryType.Subs
                require(finalType == ProductQueryType.Subs) { "type must be SUBS when requestSubscription is provided" }
                return RequestPurchaseProps(request = request, type = finalType)
            }
            error("RequestPurchaseProps branch validation failed")
        }
    }

    fun toJson(): Map<String, Any?> = when (request) {
        is Request.Purchase -> mapOf(
            "requestPurchase" to request.value.toJson(),
            "type" to type.toJson(),
        )
        is Request.Subscription -> mapOf(
            "requestSubscription" to request.value.toJson(),
            "type" to type.toJson(),
        )
    }

    sealed class Request {
        /**
         * Per-platform purchase request props
         */
        data class Purchase(val value: RequestPurchasePropsByPlatforms) : Request()
        /**
         * Per-platform subscription request props
         */
        data class Subscription(val value: RequestSubscriptionPropsByPlatforms) : Request()
    }
}

/**
 * Platform-specific purchase request parameters.
 *
 * Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
 * - apple: Always targets App Store
 * - google: Targets Play Store by default, Horizon when built with horizon flavor,
 *   or Fire OS when built with amazon flavor
 *   (determined at build time, not runtime)
 */
public data class RequestPurchasePropsByPlatforms(
    /**
     * Apple-specific purchase parameters
     */
    val apple: RequestPurchaseIosProps? = null,
    /**
     * Google-specific purchase parameters
     */
    val google: RequestPurchaseAndroidProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchasePropsByPlatforms {
            return RequestPurchasePropsByPlatforms(
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestPurchaseIosProps.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { RequestPurchaseAndroidProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
    )
}

public data class RequestSubscriptionAndroidProps(
    /**
     * Developer billing option parameters for external payments and Billing Choice.
     * Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
     * (requires Play Billing 9.1.0+).
     */
    val developerBillingOption: DeveloperBillingOptionParamsAndroid? = null,
    /**
     * Personalized offer flag.
     * When true, indicates the price was customized for this user.
     */
    val isOfferPersonalized: Boolean? = null,
    /**
     * Obfuscated account ID
     */
    val obfuscatedAccountId: String? = null,
    /**
     * Obfuscated profile ID
     */
    val obfuscatedProfileId: String? = null,
    /**
     * Original external transaction ID for replacing a subscription that was
     * purchased through developer billing. Available in OpenIAP Spec 2.1.0 /
     * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     */
    val originalExternalTransactionId: String? = null,
    /**
     * Purchase token for upgrades/downgrades
     */
    val purchaseToken: String? = null,
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
     * Use this instead of replacementMode for item-level replacement
     * This singular form requires skus to contain exactly one target product.
     * Multi-item subscription changes need a per-target replacement mapping and
     * are rejected rather than applying one oldProductId to multiple products.
     */
    val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionAndroidProps? {
            val developerBillingOption = (json["developerBillingOption"] as? Map<String, Any?>)?.let { DeveloperBillingOptionParamsAndroid.fromJson(it) }
            val isOfferPersonalized = json["isOfferPersonalized"] as? Boolean
            val obfuscatedAccountId = json["obfuscatedAccountId"] as? String
            val obfuscatedProfileId = json["obfuscatedProfileId"] as? String
            val originalExternalTransactionId = json["originalExternalTransactionId"] as? String
            val purchaseToken = json["purchaseToken"] as? String
            val skus = (json["skus"] as? List<*>)?.mapNotNull { it as? String }
            val subscriptionOffers = (json["subscriptionOffers"] as? List<*>)?.mapNotNull { (it as? Map<String, Any?>)?.let { AndroidSubscriptionOfferInput.fromJson(it) } }
            val subscriptionProductReplacementParams = (json["subscriptionProductReplacementParams"] as? Map<String, Any?>)?.let { SubscriptionProductReplacementParamsAndroid.fromJson(it) }
            if (skus == null) return null
            return RequestSubscriptionAndroidProps(
                developerBillingOption = developerBillingOption,
                isOfferPersonalized = isOfferPersonalized,
                obfuscatedAccountId = obfuscatedAccountId,
                obfuscatedProfileId = obfuscatedProfileId,
                originalExternalTransactionId = originalExternalTransactionId,
                purchaseToken = purchaseToken,
                skus = skus,
                subscriptionOffers = subscriptionOffers,
                subscriptionProductReplacementParams = subscriptionProductReplacementParams,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "developerBillingOption" to developerBillingOption?.toJson(),
        "isOfferPersonalized" to isOfferPersonalized,
        "obfuscatedAccountId" to obfuscatedAccountId,
        "obfuscatedProfileId" to obfuscatedProfileId,
        "originalExternalTransactionId" to originalExternalTransactionId,
        "purchaseToken" to purchaseToken,
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
     * Billing plan to use when purchasing an annual subscription that offers
     * monthly billing with a 12-month commitment (iOS 26.4+).
     */
    val billingPlanType: SubscriptionBillingPlanTypeIOS? = null,
    /**
     * Compact JWS string for overriding introductory offer eligibility
     * (iOS 15+, WWDC 2025). When nil, the system determines eligibility.
     * Generate the JWS on your server and pass it to StoreKit's
     * introductoryOfferEligibility(compactJWS:) purchase option.
     */
    val compactJWS: String? = null,
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
    /**
     * Promotional offer to apply for subscription purchases.
     * Requires server-signed offer with nonce, timestamp, keyId, and signature.
     */
    val withOffer: DiscountOfferInputIOS? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionIosProps? {
            val advancedCommerceData = json["advancedCommerceData"] as? String
            val andDangerouslyFinishTransactionAutomatically = json["andDangerouslyFinishTransactionAutomatically"] as? Boolean
            val appAccountToken = json["appAccountToken"] as? String
            val billingPlanType = (json["billingPlanType"] as? String)?.let { runCatching { SubscriptionBillingPlanTypeIOS.fromJson(it) }.getOrNull() ?: SubscriptionBillingPlanTypeIOS.Unknown }
            val compactJWS = json["compactJWS"] as? String
            val promotionalOfferJWS = (json["promotionalOfferJWS"] as? Map<String, Any?>)?.let { PromotionalOfferJWSInputIOS.fromJson(it) }
            val quantity = (json["quantity"] as? Number)?.toInt()
            val sku = json["sku"] as? String
            val winBackOffer = (json["winBackOffer"] as? Map<String, Any?>)?.let { WinBackOfferInputIOS.fromJson(it) }
            val withOffer = (json["withOffer"] as? Map<String, Any?>)?.let { DiscountOfferInputIOS.fromJson(it) }
            if (sku == null) return null
            return RequestSubscriptionIosProps(
                advancedCommerceData = advancedCommerceData,
                andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically,
                appAccountToken = appAccountToken,
                billingPlanType = billingPlanType,
                compactJWS = compactJWS,
                promotionalOfferJWS = promotionalOfferJWS,
                quantity = quantity,
                sku = sku,
                winBackOffer = winBackOffer,
                withOffer = withOffer,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "advancedCommerceData" to advancedCommerceData,
        "andDangerouslyFinishTransactionAutomatically" to andDangerouslyFinishTransactionAutomatically,
        "appAccountToken" to appAccountToken,
        "billingPlanType" to billingPlanType?.toJson(),
        "compactJWS" to compactJWS,
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
 * - google: Targets Play Store by default, Horizon when built with horizon flavor,
 *   or Fire OS when built with amazon flavor
 *   (determined at build time, not runtime)
 */
public data class RequestSubscriptionPropsByPlatforms(
    /**
     * Apple-specific subscription parameters
     */
    val apple: RequestSubscriptionIosProps? = null,
    /**
     * Google-specific subscription parameters
     */
    val google: RequestSubscriptionAndroidProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionPropsByPlatforms {
            return RequestSubscriptionPropsByPlatforms(
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestSubscriptionIosProps.fromJson(it) },
                google = (json["google"] as? Map<String, Any?>)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
    )
}

public data class RequestVerifyPurchaseWithIapkitAmazonProps(
    /**
     * Amazon Appstore receipt id returned by PurchaseResponse.getReceipt().getReceiptId().
     */
    val receiptId: String,
    /**
     * Use Amazon RVS Cloud Sandbox for App Tester receipts.
     */
    val sandbox: Boolean? = null,
    /**
     * Amazon Appstore user id returned by PurchaseResponse.getUserData().getUserId().
     */
    val userId: String? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitAmazonProps? {
            val receiptId = json["receiptId"] as? String
            val sandbox = json["sandbox"] as? Boolean
            val userId = json["userId"] as? String
            if (receiptId == null) return null
            return RequestVerifyPurchaseWithIapkitAmazonProps(
                receiptId = receiptId,
                sandbox = sandbox,
                userId = userId,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "receiptId" to receiptId,
        "sandbox" to sandbox,
        "userId" to userId,
    )
}

public data class RequestVerifyPurchaseWithIapkitAppleProps(
    /**
     * The JWS token returned with the purchase response.
     */
    val jws: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitAppleProps? {
            val jws = json["jws"] as? String
            if (jws == null) return null
            return RequestVerifyPurchaseWithIapkitAppleProps(
                jws = jws,
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
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitGoogleProps? {
            val purchaseToken = json["purchaseToken"] as? String
            if (purchaseToken == null) return null
            return RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchaseToken,
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
 * - amazon: Verifies via Amazon Appstore RVS (userId + receiptId)
 */
public data class RequestVerifyPurchaseWithIapkitProps(
    /**
     * Amazon Appstore verification parameters.
     */
    val amazon: RequestVerifyPurchaseWithIapkitAmazonProps? = null,
    /**
     * API key used for the Authorization header (Bearer {apiKey}).
     */
    val apiKey: String? = null,
    /**
     * Apple App Store verification parameters.
     */
    val apple: RequestVerifyPurchaseWithIapkitAppleProps? = null,
    /**
     * Available in OpenIAP Spec 2.3.1 / openiap-apple 2.4.0 / openiap-google 2.4.0.
     * Base URL for the IAPKit server. Defaults to https://kit.openiap.dev.
     * Set this to a reachable HTTP(S) origin when self-hosting or testing a local IAPKit server.
     * The apiKey must be issued by the same IAPKit/Convex deployment as this server.
     */
    val baseUrl: String? = null,
    /**
     * Google Play Store verification parameters.
     */
    val google: RequestVerifyPurchaseWithIapkitGoogleProps? = null
) {

    /**
     * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
     * Include the product's public IAPKit client payload in a valid Apple or
     * Google verification response. Defaults to false so existing response
     * shapes and bandwidth remain unchanged.
     */
    var includeClientPayload: Boolean? = null
        private set

    constructor(
        amazon: RequestVerifyPurchaseWithIapkitAmazonProps? = null,
        apiKey: String? = null,
        apple: RequestVerifyPurchaseWithIapkitAppleProps? = null,
        baseUrl: String? = null,
        google: RequestVerifyPurchaseWithIapkitGoogleProps? = null,
        includeClientPayload: Boolean?,
    ) : this(
        amazon = amazon,
        apiKey = apiKey,
        apple = apple,
        baseUrl = baseUrl,
        google = google,
    ) {
        this.includeClientPayload = includeClientPayload
    }

    companion object {
        fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitProps {
            return RequestVerifyPurchaseWithIapkitProps(
                amazon = (json["amazon"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitAmazonProps.fromJson(it) },
                apiKey = json["apiKey"] as? String,
                apple = (json["apple"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitAppleProps.fromJson(it) },
                baseUrl = json["baseUrl"] as? String,
                google = (json["google"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitGoogleProps.fromJson(it) },
                includeClientPayload = json["includeClientPayload"] as? Boolean,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "apiKey" to apiKey,
        "baseUrl" to baseUrl,
        "includeClientPayload" to includeClientPayload,
        "apple" to apple?.toJson(),
        "google" to google?.toJson(),
        "amazon" to amazon?.toJson(),
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
        fun fromJson(json: Map<String, Any?>): SubscriptionProductReplacementParamsAndroid? {
            val oldProductId = json["oldProductId"] as? String
            val replacementMode = runCatching { (json["replacementMode"] as? String)?.let { SubscriptionReplacementModeAndroid.fromJson(it) } }.getOrNull() ?: SubscriptionReplacementModeAndroid.UnknownReplacementMode
            if (oldProductId == null) return null
            return SubscriptionProductReplacementParamsAndroid(
                oldProductId = oldProductId,
                replacementMode = replacementMode,
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
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseAppleOptions? {
            val sku = json["sku"] as? String
            if (sku == null) return null
            return VerifyPurchaseAppleOptions(
                sku = sku,
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
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseGoogleOptions? {
            val accessToken = json["accessToken"] as? String
            val isSub = json["isSub"] as? Boolean
            val packageName = json["packageName"] as? String
            val purchaseToken = json["purchaseToken"] as? String
            val sku = json["sku"] as? String
            if (accessToken == null || packageName == null || purchaseToken == null || sku == null) return null
            return VerifyPurchaseGoogleOptions(
                accessToken = accessToken,
                isSub = isSub,
                packageName = packageName,
                purchaseToken = purchaseToken,
                sku = sku,
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
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseHorizonOptions? {
            val accessToken = json["accessToken"] as? String
            val sku = json["sku"] as? String
            val userId = json["userId"] as? String
            if (accessToken == null || sku == null || userId == null) return null
            return VerifyPurchaseHorizonOptions(
                accessToken = accessToken,
                sku = sku,
                userId = userId,
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
        fun fromJson(json: Map<String, Any?>): VerifyPurchaseWithProviderProps? {
            val iapkit = (json["iapkit"] as? Map<String, Any?>)?.let { RequestVerifyPurchaseWithIapkitProps.fromJson(it) }
            val provider = (json["provider"] as? String)?.let { PurchaseVerificationProvider.fromJson(it) } ?: PurchaseVerificationProvider.Iapkit
            return VerifyPurchaseWithProviderProps(
                iapkit = iapkit,
                provider = provider,
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
        fun fromJson(json: Map<String, Any?>): WinBackOfferInputIOS? {
            val offerId = json["offerId"] as? String
            if (offerId == null) return null
            return WinBackOfferInputIOS(
                offerId = offerId,
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
     * Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
     * See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
     */
    suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean
    /**
     * Present the refund request sheet (iOS 15+). See also Features → Refund.
     * See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
     */
    suspend fun beginRefundRequestIOS(sku: String): String?
    /**
     * Clear pending transactions in the queue (sandbox helper).
     * See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
     */
    suspend fun clearTransactionIOS(): Boolean
    /**
     * Consume a consumable purchase so it can be re-bought.
     * See: https://openiap.dev/docs/apis/android/consume-purchase-android
     */
    suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean
    /**
     * Create the reporting details and external transaction token required by a billing program.
     * Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations
     * must use 8.2.1+ and create fresh details immediately before every redirect session;
     * do not cache the token for a later redirect. The same token may report multiple purchases
     * made during one External Offer session.
     * Replaces the deprecated createExternalOfferReportingDetailsAsync API.
     * Returns external transaction token needed for reporting external transactions.
     * developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted,
     * native Android defaults it to IN_APP.
     * The Billing Choice extension is available in OpenIAP Spec 2.1.0 /
     * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
     */
    suspend fun createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid? = null): BillingProgramReportingDetailsAndroid
    /**
     * Open the platform's subscription management UI.
     * See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
     */
    suspend fun deepLinkToSubscriptions(options: DeepLinkOptions? = null): Unit
    /**
     * Close the store connection and release resources.
     * See: https://openiap.dev/docs/apis/end-connection
     */
    suspend fun endConnection(): Boolean
    /**
     * Complete a transaction after server-side verification. Required on Android within 3 days.
     * See: https://openiap.dev/docs/apis/finish-transaction
     */
    suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean? = null): Unit
    /**
     * Initialize the store connection. Call before any IAP API.
     * See: https://openiap.dev/docs/apis/init-connection
     */
    suspend fun initConnection(config: InitConnectionConfig? = null): Boolean
    /**
     * Check whether a billing program (e.g., External Payments) is available for the current user.
     * Replaces the deprecated isExternalOfferAvailableAsync API.
     * Introduced in Google Play Billing Library 8.2.0. External Offer and External
     * Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API.
     * Returns availability result with isAvailable flag.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
     */
    suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid
    /**
     * Launch an external content/offer link from inside the Billing Programs flow (introduced in
     * Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+),
     * including developer-rendered Billing Choice external-link flows.
     * Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0
     * (requires Play Billing 9.1.0+).
     * Replaces the deprecated showExternalOfferInformationDialog API.
     * Shows Play Store dialog and optionally launches external URL.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/launch-external-link-android
     */
    suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean
    /**
     * Open the Google Play offer/promo code redemption flow so the user can enter a code.
     * On Google Play builds, launches the Play Store redeem page
     * (https://play.google.com/redeem). A purchase listener can receive the redeemed
     * purchase while the app is running with an active billing connection; always
     * reconcile with getAvailablePurchases when the app resumes.
     * Does not require the billing client to be initialized (no Play Billing version requirement).
     * Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0.
     * Android counterpart of presentCodeRedemptionSheetIOS.
     * Returns true when the redemption flow was launched, or false when the current
     * store flavor does not provide an equivalent redemption flow.
     * See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
     */
    suspend fun openRedeemOfferCodeAndroid(): Boolean
    /**
     * Show the App Store offer code redemption sheet.
     * On iOS 27+, Mac Catalyst 27+, and visionOS 27+, returns the verified
     * transaction produced by the redemption. Earlier iOS and Mac Catalyst
     * versions present the legacy sheet and return null; reconcile purchases
     * through the normal transaction listener or an explicit available-purchases
     * refresh.
     * See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
     */
    suspend fun presentCodeRedemptionSheetIOS(): PurchaseIOS?
    /**
     * Present an external purchase link, StoreKit External (iOS 16+).
     * See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
     */
    suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS
    /**
     * Present the external purchase notice sheet (iOS 17.4+).
     * Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
     * See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
     */
    suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS
    /**
     * Initiate a purchase or subscription flow; rely on events for final state.
     * See: https://openiap.dev/docs/apis/request-purchase
     */
    suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult?
    /**
     * Restore non-consumable and active subscription purchases.
     * See: https://openiap.dev/docs/apis/restore-purchases
     */
    suspend fun restorePurchases(): Unit
    /**
     * Show Google's mandatory information dialog before a developer-rendered,
     * in-app Billing Choice screen.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
     */
    suspend fun showBillingProgramInformationDialogAndroid(params: BillingProgramInformationDialogParamsAndroid): BillingResultAndroid
    /**
     * Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
     * Call this after a deliberate customer interaction before linking out to external purchases.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
     * See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
     * Parameter noticeType: Notice type determining the style of disclosure
     */
    suspend fun showExternalPurchaseCustomLinkNoticeIOS(noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS): ExternalPurchaseCustomLinkNoticeResultIOS
    /**
     * Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0
     * (upstream API available since Play Billing 4.1.0).
     * Returns a response code and, when the subscription status changes, the related purchase token.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
     */
    suspend fun showInAppMessagesAndroid(params: InAppMessageParamsAndroid? = null): InAppMessageResultAndroid
    /**
     * Present the manage-subscriptions sheet and return changed purchases (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
     */
    suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS>
    /**
     * Force sync transactions with the App Store (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/sync-ios
     */
    suspend fun syncIOS(): Boolean
    /**
     * Verify a purchase against your own backend. Returns a platform-specific
     * variant of VerifyPurchaseResult — VerifyPurchaseResultIOS exposes isValid
     * + receipt/JWS metadata, VerifyPurchaseResultAndroid carries Play Store
     * receipt fields (no isValid), and VerifyPurchaseResultHorizon uses success.
     * Inspect the concrete variant before reading fields.
     * See: https://openiap.dev/docs/features/validation#verify-purchase
     */
    suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult
    /**
     * Verify via a managed provider without standing up your own server. The
     * PurchaseVerificationProvider enum currently exposes only IAPKit; platform
     * availability may differ by implementation.
     * See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
     */
    suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult
}

/**
 * GraphQL root query operations.
 */
public interface QueryResolver {
    /**
     * Check eligibility for the external purchase notice sheet (iOS 17.4+).
     * Uses ExternalPurchase.canPresent.
     * See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
     */
    suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean
    /**
     * Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
     */
    suspend fun currentEntitlementIOS(sku: String): PurchaseIOS?
    /**
     * Fetch products or subscriptions from the store.
     * See: https://openiap.dev/docs/apis/fetch-products
     */
    suspend fun fetchProducts(params: ProductRequest): FetchProductsResult
    /**
     * Get details of all currently active subscriptions (filters by subscriptionIds when provided).
     * See: https://openiap.dev/docs/apis/get-active-subscriptions
     */
    suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>
    /**
     * List every StoreKit transaction (finished + unfinished) for the current user.
     * Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app
     * for finished consumables to be included (iOS 18+).
     * Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape.
     * See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
     */
    suspend fun getAllTransactionsIOS(): List<PurchaseIOS>
    /**
     * Fetch the app transaction (iOS 16+).
     * See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
     */
    suspend fun getAppTransactionIOS(): AppTransaction?
    /**
     * List active purchases for the current user.
     * See: https://openiap.dev/docs/apis/get-available-purchases
     */
    suspend fun getAvailablePurchases(options: PurchaseOptions? = null): List<Purchase>
    /**
     * Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client is not ready.
     * See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
     */
    suspend fun getBillingChoiceInfoAndroid(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid
    /**
     * Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
     * Use this token to report transactions made through ExternalPurchaseCustomLink.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
     * See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
     * Parameter tokenType: Token type: acquisition (new customers) or services (existing customers)
     */
    suspend fun getExternalPurchaseCustomLinkTokenIOS(tokenType: ExternalPurchaseCustomLinkTokenTypeIOS): ExternalPurchaseCustomLinkTokenResultIOS
    /**
     * List unfinished StoreKit transactions in the queue.
     * See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
     */
    suspend fun getPendingTransactionsIOS(): List<PurchaseIOS>
    /**
     * Read the App Store-promoted product, if any (iOS 11+).
     * See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
     */
    suspend fun getPromotedProductIOS(): ProductIOS?
    /**
     * Get base64-encoded receipt data (legacy validation).
     * See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
     */
    suspend fun getReceiptDataIOS(): String?
    /**
     * Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple
     * platforms and alpha-2 on Android. The operation fails when the store cannot
     * provide a value; implementations must not synthesize a locale fallback.
     * See: https://openiap.dev/docs/apis/get-storefront
     */
    suspend fun getStorefront(): String
    /**
     * Return the JWS string for a transaction (StoreKit 2).
     * See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
     */
    suspend fun getTransactionJwsIOS(sku: String): String?
    /**
     * Check whether the user has any active subscription.
     * See: https://openiap.dev/docs/apis/has-active-subscriptions
     */
    suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean
    /**
     * Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
     * Returns true if the app can use custom external purchase links.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
     * See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
     */
    suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean
    /**
     * Check intro-offer eligibility for a subscription group.
     * See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
     */
    suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean
    /**
     * Check whether a transaction's JWS verification passed (StoreKit 2).
     * See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
     */
    suspend fun isTransactionVerifiedIOS(sku: String): Boolean
    /**
     * Get the latest verified transaction for a product, using StoreKit 2.
     * See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
     */
    suspend fun latestTransactionIOS(sku: String): PurchaseIOS?
    /**
     * Get subscription status objects from StoreKit 2 (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/subscription-status-ios
     */
    suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS>
}

/**
 * GraphQL root subscription operations.
 */
public interface SubscriptionResolver {
    /**
     * Fires when a user selects developer billing in an External Payments or
     * Billing Choice flow (Android only). The payload can contain an external
     * transaction token, link URI, original transaction ID, and selected products.
     * Billing Choice payload fields are available in OpenIAP Spec 2.1.0 /
     * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
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
     * Options can opt iOS listeners into duplicate StoreKit transaction replays
     * for diagnostics; default listeners receive one event per transaction ID
     * during a single connection session.
     */
    suspend fun purchaseUpdated(options: PurchaseUpdatedListenerOptions? = null): Purchase
    /**
     * Fires when a subscription enters a billing-issue state that needs user action
     * (payment method failed, card expired, etc.). Cross-platform unification:
     *
     * - iOS 16.4+ / Mac Catalyst 16.4+ / visionOS 1.0+: delivered via StoreKit 2
     *   `Message.Reason.billingIssue`.
     * - Android (Play flavor, Billing 8.1+): emitted when `isSuspended == true` is first detected
     *   on a previously healthy subscription. Requires Google Play Billing Library 8.1.0 or newer.
     * - Android (Horizon flavor): NOT emitted. The Horizon Billing Compatibility SDK implements
     *   the Play Billing 7.0 API surface which does not expose a suspended-subscription signal.
     * - Android (Amazon flavor): NOT emitted. Amazon Appstore IAP does not expose an
     *   equivalent subscription billing-issue signal.
     *
     * Listeners should not assume the event will fire on every store. Direct users to the
     * platform subscription management UI (`deepLinkToSubscriptions`) to resolve the issue.
     */
    suspend fun subscriptionBillingIssue(): Purchase
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
public typealias MutationClearTransactionIOSHandler = suspend () -> Boolean
public typealias MutationConsumePurchaseAndroidHandler = suspend (purchaseToken: String) -> Boolean
public typealias MutationCreateBillingProgramReportingDetailsAndroidHandler = suspend (program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid?) -> BillingProgramReportingDetailsAndroid
public typealias MutationDeepLinkToSubscriptionsHandler = suspend (options: DeepLinkOptions?) -> Unit
public typealias MutationEndConnectionHandler = suspend () -> Boolean
public typealias MutationFinishTransactionHandler = suspend (purchase: PurchaseInput, isConsumable: Boolean?) -> Unit
public typealias MutationInitConnectionHandler = suspend (config: InitConnectionConfig?) -> Boolean
public typealias MutationIsBillingProgramAvailableAndroidHandler = suspend (program: BillingProgramAndroid) -> BillingProgramAvailabilityResultAndroid
public typealias MutationLaunchExternalLinkAndroidHandler = suspend (params: LaunchExternalLinkParamsAndroid) -> Boolean
public typealias MutationOpenRedeemOfferCodeAndroidHandler = suspend () -> Boolean
public typealias MutationPresentCodeRedemptionSheetIOSHandler = suspend () -> PurchaseIOS?
public typealias MutationPresentExternalPurchaseLinkIOSHandler = suspend (url: String) -> ExternalPurchaseLinkResultIOS
public typealias MutationPresentExternalPurchaseNoticeSheetIOSHandler = suspend () -> ExternalPurchaseNoticeResultIOS
public typealias MutationRequestPurchaseHandler = suspend (params: RequestPurchaseProps) -> RequestPurchaseResult?
public typealias MutationRestorePurchasesHandler = suspend () -> Unit
public typealias MutationShowBillingProgramInformationDialogAndroidHandler = suspend (params: BillingProgramInformationDialogParamsAndroid) -> BillingResultAndroid
public typealias MutationShowExternalPurchaseCustomLinkNoticeIOSHandler = suspend (noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) -> ExternalPurchaseCustomLinkNoticeResultIOS
public typealias MutationShowInAppMessagesAndroidHandler = suspend (params: InAppMessageParamsAndroid?) -> InAppMessageResultAndroid
public typealias MutationShowManageSubscriptionsIOSHandler = suspend () -> List<PurchaseIOS>
public typealias MutationSyncIOSHandler = suspend () -> Boolean
public typealias MutationVerifyPurchaseHandler = suspend (options: VerifyPurchaseProps) -> VerifyPurchaseResult
public typealias MutationVerifyPurchaseWithProviderHandler = suspend (options: VerifyPurchaseWithProviderProps) -> VerifyPurchaseWithProviderResult

public data class MutationHandlers(
    /**
     * Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
     * See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
     */
    val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler? = null,
    /**
     * Present the refund request sheet (iOS 15+). See also Features → Refund.
     * See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
     */
    val beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler? = null,
    /**
     * Clear pending transactions in the queue (sandbox helper).
     * See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
     */
    val clearTransactionIOS: MutationClearTransactionIOSHandler? = null,
    /**
     * Consume a consumable purchase so it can be re-bought.
     * See: https://openiap.dev/docs/apis/android/consume-purchase-android
     */
    val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler? = null,
    /**
     * Create the reporting details and external transaction token required by a billing program.
     * Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations
     * must use 8.2.1+ and create fresh details immediately before every redirect session;
     * do not cache the token for a later redirect. The same token may report multiple purchases
     * made during one External Offer session.
     * Replaces the deprecated createExternalOfferReportingDetailsAsync API.
     * Returns external transaction token needed for reporting external transactions.
     * developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted,
     * native Android defaults it to IN_APP.
     * The Billing Choice extension is available in OpenIAP Spec 2.1.0 /
     * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
     */
    val createBillingProgramReportingDetailsAndroid: MutationCreateBillingProgramReportingDetailsAndroidHandler? = null,
    /**
     * Open the platform's subscription management UI.
     * See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
     */
    val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler? = null,
    /**
     * Close the store connection and release resources.
     * See: https://openiap.dev/docs/apis/end-connection
     */
    val endConnection: MutationEndConnectionHandler? = null,
    /**
     * Complete a transaction after server-side verification. Required on Android within 3 days.
     * See: https://openiap.dev/docs/apis/finish-transaction
     */
    val finishTransaction: MutationFinishTransactionHandler? = null,
    /**
     * Initialize the store connection. Call before any IAP API.
     * See: https://openiap.dev/docs/apis/init-connection
     */
    val initConnection: MutationInitConnectionHandler? = null,
    /**
     * Check whether a billing program (e.g., External Payments) is available for the current user.
     * Replaces the deprecated isExternalOfferAvailableAsync API.
     * Introduced in Google Play Billing Library 8.2.0. External Offer and External
     * Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API.
     * Returns availability result with isAvailable flag.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
     */
    val isBillingProgramAvailableAndroid: MutationIsBillingProgramAvailableAndroidHandler? = null,
    /**
     * Launch an external content/offer link from inside the Billing Programs flow (introduced in
     * Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+),
     * including developer-rendered Billing Choice external-link flows.
     * Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0
     * (requires Play Billing 9.1.0+).
     * Replaces the deprecated showExternalOfferInformationDialog API.
     * Shows Play Store dialog and optionally launches external URL.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/launch-external-link-android
     */
    val launchExternalLinkAndroid: MutationLaunchExternalLinkAndroidHandler? = null,
    /**
     * Open the Google Play offer/promo code redemption flow so the user can enter a code.
     * On Google Play builds, launches the Play Store redeem page
     * (https://play.google.com/redeem). A purchase listener can receive the redeemed
     * purchase while the app is running with an active billing connection; always
     * reconcile with getAvailablePurchases when the app resumes.
     * Does not require the billing client to be initialized (no Play Billing version requirement).
     * Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0.
     * Android counterpart of presentCodeRedemptionSheetIOS.
     * Returns true when the redemption flow was launched, or false when the current
     * store flavor does not provide an equivalent redemption flow.
     * See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
     */
    val openRedeemOfferCodeAndroid: MutationOpenRedeemOfferCodeAndroidHandler? = null,
    /**
     * Show the App Store offer code redemption sheet.
     * On iOS 27+, Mac Catalyst 27+, and visionOS 27+, returns the verified
     * transaction produced by the redemption. Earlier iOS and Mac Catalyst
     * versions present the legacy sheet and return null; reconcile purchases
     * through the normal transaction listener or an explicit available-purchases
     * refresh.
     * See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
     */
    val presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler? = null,
    /**
     * Present an external purchase link, StoreKit External (iOS 16+).
     * See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
     */
    val presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler? = null,
    /**
     * Present the external purchase notice sheet (iOS 17.4+).
     * Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
     * See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
     */
    val presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler? = null,
    /**
     * Initiate a purchase or subscription flow; rely on events for final state.
     * See: https://openiap.dev/docs/apis/request-purchase
     */
    val requestPurchase: MutationRequestPurchaseHandler? = null,
    /**
     * Restore non-consumable and active subscription purchases.
     * See: https://openiap.dev/docs/apis/restore-purchases
     */
    val restorePurchases: MutationRestorePurchasesHandler? = null,
    /**
     * Show Google's mandatory information dialog before a developer-rendered,
     * in-app Billing Choice screen.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
     */
    val showBillingProgramInformationDialogAndroid: MutationShowBillingProgramInformationDialogAndroidHandler? = null,
    /**
     * Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
     * Call this after a deliberate customer interaction before linking out to external purchases.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
     * See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
     * Parameter noticeType: Notice type determining the style of disclosure
     */
    val showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIOSHandler? = null,
    /**
     * Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0
     * (upstream API available since Play Billing 4.1.0).
     * Returns a response code and, when the subscription status changes, the related purchase token.
     * Throws OpenIapError.NotPrepared if billing client not ready.
     * See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
     */
    val showInAppMessagesAndroid: MutationShowInAppMessagesAndroidHandler? = null,
    /**
     * Present the manage-subscriptions sheet and return changed purchases (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
     */
    val showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler? = null,
    /**
     * Force sync transactions with the App Store (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/sync-ios
     */
    val syncIOS: MutationSyncIOSHandler? = null,
    /**
     * Verify a purchase against your own backend. Returns a platform-specific
     * variant of VerifyPurchaseResult — VerifyPurchaseResultIOS exposes isValid
     * + receipt/JWS metadata, VerifyPurchaseResultAndroid carries Play Store
     * receipt fields (no isValid), and VerifyPurchaseResultHorizon uses success.
     * Inspect the concrete variant before reading fields.
     * See: https://openiap.dev/docs/features/validation#verify-purchase
     */
    val verifyPurchase: MutationVerifyPurchaseHandler? = null,
    /**
     * Verify via a managed provider without standing up your own server. The
     * PurchaseVerificationProvider enum currently exposes only IAPKit; platform
     * availability may differ by implementation.
     * See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
     */
    val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler? = null
)

// MARK: - Query Helpers

public typealias QueryCanPresentExternalPurchaseNoticeIOSHandler = suspend () -> Boolean
public typealias QueryCurrentEntitlementIOSHandler = suspend (sku: String) -> PurchaseIOS?
public typealias QueryFetchProductsHandler = suspend (params: ProductRequest) -> FetchProductsResult
public typealias QueryGetActiveSubscriptionsHandler = suspend (subscriptionIds: List<String>?) -> List<ActiveSubscription>
public typealias QueryGetAllTransactionsIOSHandler = suspend () -> List<PurchaseIOS>
public typealias QueryGetAppTransactionIOSHandler = suspend () -> AppTransaction?
public typealias QueryGetAvailablePurchasesHandler = suspend (options: PurchaseOptions?) -> List<Purchase>
public typealias QueryGetBillingChoiceInfoAndroidHandler = suspend (params: GetBillingChoiceInfoParamsAndroid) -> BillingChoiceInfoAndroid
public typealias QueryGetExternalPurchaseCustomLinkTokenIOSHandler = suspend (tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) -> ExternalPurchaseCustomLinkTokenResultIOS
public typealias QueryGetPendingTransactionsIOSHandler = suspend () -> List<PurchaseIOS>
public typealias QueryGetPromotedProductIOSHandler = suspend () -> ProductIOS?
public typealias QueryGetReceiptDataIOSHandler = suspend () -> String?
public typealias QueryGetStorefrontHandler = suspend () -> String
public typealias QueryGetTransactionJwsIOSHandler = suspend (sku: String) -> String?
public typealias QueryHasActiveSubscriptionsHandler = suspend (subscriptionIds: List<String>?) -> Boolean
public typealias QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler = suspend () -> Boolean
public typealias QueryIsEligibleForIntroOfferIOSHandler = suspend (groupID: String) -> Boolean
public typealias QueryIsTransactionVerifiedIOSHandler = suspend (sku: String) -> Boolean
public typealias QueryLatestTransactionIOSHandler = suspend (sku: String) -> PurchaseIOS?
public typealias QuerySubscriptionStatusIOSHandler = suspend (sku: String) -> List<SubscriptionStatusIOS>

public data class QueryHandlers(
    /**
     * Check eligibility for the external purchase notice sheet (iOS 17.4+).
     * Uses ExternalPurchase.canPresent.
     * See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
     */
    val canPresentExternalPurchaseNoticeIOS: QueryCanPresentExternalPurchaseNoticeIOSHandler? = null,
    /**
     * Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
     */
    val currentEntitlementIOS: QueryCurrentEntitlementIOSHandler? = null,
    /**
     * Fetch products or subscriptions from the store.
     * See: https://openiap.dev/docs/apis/fetch-products
     */
    val fetchProducts: QueryFetchProductsHandler? = null,
    /**
     * Get details of all currently active subscriptions (filters by subscriptionIds when provided).
     * See: https://openiap.dev/docs/apis/get-active-subscriptions
     */
    val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler? = null,
    /**
     * List every StoreKit transaction (finished + unfinished) for the current user.
     * Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app
     * for finished consumables to be included (iOS 18+).
     * Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape.
     * See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
     */
    val getAllTransactionsIOS: QueryGetAllTransactionsIOSHandler? = null,
    /**
     * Fetch the app transaction (iOS 16+).
     * See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
     */
    val getAppTransactionIOS: QueryGetAppTransactionIOSHandler? = null,
    /**
     * List active purchases for the current user.
     * See: https://openiap.dev/docs/apis/get-available-purchases
     */
    val getAvailablePurchases: QueryGetAvailablePurchasesHandler? = null,
    /**
     * Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens.
     * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     * Throws OpenIapError.NotPrepared if billing client is not ready.
     * See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
     */
    val getBillingChoiceInfoAndroid: QueryGetBillingChoiceInfoAndroidHandler? = null,
    /**
     * Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
     * Use this token to report transactions made through ExternalPurchaseCustomLink.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
     * See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
     * Parameter tokenType: Token type: acquisition (new customers) or services (existing customers)
     */
    val getExternalPurchaseCustomLinkTokenIOS: QueryGetExternalPurchaseCustomLinkTokenIOSHandler? = null,
    /**
     * List unfinished StoreKit transactions in the queue.
     * See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
     */
    val getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler? = null,
    /**
     * Read the App Store-promoted product, if any (iOS 11+).
     * See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
     */
    val getPromotedProductIOS: QueryGetPromotedProductIOSHandler? = null,
    /**
     * Get base64-encoded receipt data (legacy validation).
     * See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
     */
    val getReceiptDataIOS: QueryGetReceiptDataIOSHandler? = null,
    /**
     * Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple
     * platforms and alpha-2 on Android. The operation fails when the store cannot
     * provide a value; implementations must not synthesize a locale fallback.
     * See: https://openiap.dev/docs/apis/get-storefront
     */
    val getStorefront: QueryGetStorefrontHandler? = null,
    /**
     * Return the JWS string for a transaction (StoreKit 2).
     * See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
     */
    val getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler? = null,
    /**
     * Check whether the user has any active subscription.
     * See: https://openiap.dev/docs/apis/has-active-subscriptions
     */
    val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler? = null,
    /**
     * Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
     * Returns true if the app can use custom external purchase links.
     * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
     * See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
     */
    val isEligibleForExternalPurchaseCustomLinkIOS: QueryIsEligibleForExternalPurchaseCustomLinkIOSHandler? = null,
    /**
     * Check intro-offer eligibility for a subscription group.
     * See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
     */
    val isEligibleForIntroOfferIOS: QueryIsEligibleForIntroOfferIOSHandler? = null,
    /**
     * Check whether a transaction's JWS verification passed (StoreKit 2).
     * See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
     */
    val isTransactionVerifiedIOS: QueryIsTransactionVerifiedIOSHandler? = null,
    /**
     * Get the latest verified transaction for a product, using StoreKit 2.
     * See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
     */
    val latestTransactionIOS: QueryLatestTransactionIOSHandler? = null,
    /**
     * Get subscription status objects from StoreKit 2 (iOS 15+).
     * See: https://openiap.dev/docs/apis/ios/subscription-status-ios
     */
    val subscriptionStatusIOS: QuerySubscriptionStatusIOSHandler? = null
)

// MARK: - Subscription Helpers

public typealias SubscriptionDeveloperProvidedBillingAndroidHandler = suspend () -> DeveloperProvidedBillingDetailsAndroid
public typealias SubscriptionPromotedProductIOSHandler = suspend () -> String
public typealias SubscriptionPurchaseErrorHandler = suspend () -> PurchaseError
public typealias SubscriptionPurchaseUpdatedHandler = suspend (options: PurchaseUpdatedListenerOptions?) -> Purchase
public typealias SubscriptionSubscriptionBillingIssueHandler = suspend () -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = suspend () -> UserChoiceBillingDetails

public data class SubscriptionHandlers(
    /**
     * Fires when a user selects developer billing in an External Payments or
     * Billing Choice flow (Android only). The payload can contain an external
     * transaction token, link URI, original transaction ID, and selected products.
     * Billing Choice payload fields are available in OpenIAP Spec 2.1.0 /
     * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
     */
    val developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler? = null,
    /**
     * Fires when the App Store surfaces a promoted product (iOS only)
     */
    val promotedProductIOS: SubscriptionPromotedProductIOSHandler? = null,
    /**
     * Fires when a purchase fails or is cancelled
     */
    val purchaseError: SubscriptionPurchaseErrorHandler? = null,
    /**
     * Fires when a purchase completes successfully or a pending purchase resolves
     * Options can opt iOS listeners into duplicate StoreKit transaction replays
     * for diagnostics; default listeners receive one event per transaction ID
     * during a single connection session.
     */
    val purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = null,
    /**
     * Fires when a subscription enters a billing-issue state that needs user action
     * (payment method failed, card expired, etc.). Cross-platform unification:
     *
     * - iOS 16.4+ / Mac Catalyst 16.4+ / visionOS 1.0+: delivered via StoreKit 2
     *   `Message.Reason.billingIssue`.
     * - Android (Play flavor, Billing 8.1+): emitted when `isSuspended == true` is first detected
     *   on a previously healthy subscription. Requires Google Play Billing Library 8.1.0 or newer.
     * - Android (Horizon flavor): NOT emitted. The Horizon Billing Compatibility SDK implements
     *   the Play Billing 7.0 API surface which does not expose a suspended-subscription signal.
     * - Android (Amazon flavor): NOT emitted. Amazon Appstore IAP does not expose an
     *   equivalent subscription billing-issue signal.
     *
     * Listeners should not assume the event will fire on every store. Direct users to the
     * platform subscription management UI (`deepLinkToSubscriptions`) to resolve the issue.
     */
    val subscriptionBillingIssue: SubscriptionSubscriptionBillingIssueHandler? = null,
    /**
     * Fires when a user selects alternative billing in the User Choice Billing dialog (Android only)
     * Only triggered when the user selects alternative billing instead of Google Play billing
     */
    val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = null
)
