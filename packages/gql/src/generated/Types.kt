// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `npm run generate` after updating any *.graphql schema file.
// ============================================================================

@file:Suppress("unused", "UNCHECKED_CAST")

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
    UserChoiceBillingAndroid("user-choice-billing-android")

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
            else -> throw IllegalArgumentException("Unknown IapEvent value: $value")
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
    Failed("failed"),
    Restored("restored"),
    Deferred("deferred"),
    Unknown("unknown")

    companion object {
        fun fromJson(value: String): PurchaseState = when (value) {
            "pending" -> PurchaseState.Pending
            "PENDING" -> PurchaseState.Pending
            "Pending" -> PurchaseState.Pending
            "purchased" -> PurchaseState.Purchased
            "PURCHASED" -> PurchaseState.Purchased
            "Purchased" -> PurchaseState.Purchased
            "failed" -> PurchaseState.Failed
            "FAILED" -> PurchaseState.Failed
            "Failed" -> PurchaseState.Failed
            "restored" -> PurchaseState.Restored
            "RESTORED" -> PurchaseState.Restored
            "Restored" -> PurchaseState.Restored
            "deferred" -> PurchaseState.Deferred
            "DEFERRED" -> PurchaseState.Deferred
            "Deferred" -> PurchaseState.Deferred
            "unknown" -> PurchaseState.Unknown
            "UNKNOWN" -> PurchaseState.Unknown
            "Unknown" -> PurchaseState.Unknown
            else -> throw IllegalArgumentException("Unknown PurchaseState value: $value")
        }
    }

    fun toJson(): String = rawValue
}

public enum class SubscriptionOfferTypeIOS(val rawValue: String) {
    Introductory("introductory"),
    Promotional("promotional")

    companion object {
        fun fromJson(value: String): SubscriptionOfferTypeIOS = when (value) {
            "introductory" -> SubscriptionOfferTypeIOS.Introductory
            "INTRODUCTORY" -> SubscriptionOfferTypeIOS.Introductory
            "Introductory" -> SubscriptionOfferTypeIOS.Introductory
            "promotional" -> SubscriptionOfferTypeIOS.Promotional
            "PROMOTIONAL" -> SubscriptionOfferTypeIOS.Promotional
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

public data class FetchProductsResultProducts(val value: List<Product>?) : FetchProductsResult

public data class FetchProductsResultSubscriptions(val value: List<ProductSubscription>?) : FetchProductsResult

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
    val currency: String,
    val debugDescription: String? = null,
    val description: String,
    val displayName: String? = null,
    val displayPrice: String,
    val id: String,
    val nameAndroid: String,
    val oneTimePurchaseOfferDetailsAndroid: ProductAndroidOneTimePurchaseOfferDetail? = null,
    val platform: IapPlatform = IapPlatform.Android,
    val price: Double? = null,
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>? = null,
    val title: String,
    val type: ProductType = ProductType.InApp
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
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as Map<String, Any?>?)?.let { ProductAndroidOneTimePurchaseOfferDetail.fromJson(it) },
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
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.toJson(),
        "platform" to platform.toJson(),
        "price" to price,
        "subscriptionOfferDetailsAndroid" to subscriptionOfferDetailsAndroid?.map { it.toJson() },
        "title" to title,
        "type" to type.toJson(),
    )
}

public data class ProductAndroidOneTimePurchaseOfferDetail(
    val formattedPrice: String,
    val priceAmountMicros: String,
    val priceCurrencyCode: String
) {

    companion object {
        fun fromJson(json: Map<String, Any?>): ProductAndroidOneTimePurchaseOfferDetail {
            return ProductAndroidOneTimePurchaseOfferDetail(
                formattedPrice = json["formattedPrice"] as String,
                priceAmountMicros = json["priceAmountMicros"] as String,
                priceCurrencyCode = json["priceCurrencyCode"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ProductAndroidOneTimePurchaseOfferDetail",
        "formattedPrice" to formattedPrice,
        "priceAmountMicros" to priceAmountMicros,
        "priceCurrencyCode" to priceCurrencyCode,
    )
}

public data class ProductIOS(
    val currency: String,
    val debugDescription: String? = null,
    val description: String,
    val displayName: String? = null,
    val displayNameIOS: String,
    val displayPrice: String,
    val id: String,
    val isFamilyShareableIOS: Boolean,
    val jsonRepresentationIOS: String,
    val platform: IapPlatform = IapPlatform.Ios,
    val price: Double? = null,
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    val title: String,
    val type: ProductType = ProductType.InApp,
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
    val currency: String,
    val debugDescription: String? = null,
    val description: String,
    val displayName: String? = null,
    val displayPrice: String,
    val id: String,
    val nameAndroid: String,
    val oneTimePurchaseOfferDetailsAndroid: ProductAndroidOneTimePurchaseOfferDetail? = null,
    val platform: IapPlatform = IapPlatform.Android,
    val price: Double? = null,
    val subscriptionOfferDetailsAndroid: List<ProductSubscriptionAndroidOfferDetails>,
    val title: String,
    val type: ProductType = ProductType.Subs
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
                oneTimePurchaseOfferDetailsAndroid = (json["oneTimePurchaseOfferDetailsAndroid"] as Map<String, Any?>?)?.let { ProductAndroidOneTimePurchaseOfferDetail.fromJson(it) },
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
        "oneTimePurchaseOfferDetailsAndroid" to oneTimePurchaseOfferDetailsAndroid?.toJson(),
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
    val currency: String,
    val debugDescription: String? = null,
    val description: String,
    val discountsIOS: List<DiscountIOS>? = null,
    val displayName: String? = null,
    val displayNameIOS: String,
    val displayPrice: String,
    val id: String,
    val introductoryPriceAsAmountIOS: String? = null,
    val introductoryPriceIOS: String? = null,
    val introductoryPriceNumberOfPeriodsIOS: String? = null,
    val introductoryPricePaymentModeIOS: PaymentModeIOS,
    val introductoryPriceSubscriptionPeriodIOS: SubscriptionPeriodIOS? = null,
    val isFamilyShareableIOS: Boolean,
    val jsonRepresentationIOS: String,
    val platform: IapPlatform = IapPlatform.Ios,
    val price: Double? = null,
    val subscriptionInfoIOS: SubscriptionInfoIOS? = null,
    val subscriptionPeriodNumberIOS: String? = null,
    val subscriptionPeriodUnitIOS: SubscriptionPeriodIOS? = null,
    val title: String,
    val type: ProductType = ProductType.Subs,
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
    val currentPlanId: String? = null,
    val dataAndroid: String? = null,
    val developerPayloadAndroid: String? = null,
    val id: String,
    val ids: List<String>? = null,
    val isAcknowledgedAndroid: Boolean? = null,
    val isAutoRenewing: Boolean,
    val obfuscatedAccountIdAndroid: String? = null,
    val obfuscatedProfileIdAndroid: String? = null,
    val packageNameAndroid: String? = null,
    val platform: IapPlatform,
    val productId: String,
    val purchaseState: PurchaseState,
    val purchaseToken: String? = null,
    val quantity: Int,
    val signatureAndroid: String? = null,
    val transactionDate: Double,
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
                obfuscatedAccountIdAndroid = json["obfuscatedAccountIdAndroid"] as String?,
                obfuscatedProfileIdAndroid = json["obfuscatedProfileIdAndroid"] as String?,
                packageNameAndroid = json["packageNameAndroid"] as String?,
                platform = IapPlatform.fromJson(json["platform"] as String),
                productId = json["productId"] as String,
                purchaseState = PurchaseState.fromJson(json["purchaseState"] as String),
                purchaseToken = json["purchaseToken"] as String?,
                quantity = (json["quantity"] as Number).toInt(),
                signatureAndroid = json["signatureAndroid"] as String?,
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
        "obfuscatedAccountIdAndroid" to obfuscatedAccountIdAndroid,
        "obfuscatedProfileIdAndroid" to obfuscatedProfileIdAndroid,
        "packageNameAndroid" to packageNameAndroid,
        "platform" to platform.toJson(),
        "productId" to productId,
        "purchaseState" to purchaseState.toJson(),
        "purchaseToken" to purchaseToken,
        "quantity" to quantity,
        "signatureAndroid" to signatureAndroid,
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
    val currentPlanId: String? = null,
    val environmentIOS: String? = null,
    val expirationDateIOS: Double? = null,
    val id: String,
    val ids: List<String>? = null,
    val isAutoRenewing: Boolean,
    val isUpgradedIOS: Boolean? = null,
    val offerIOS: PurchaseOfferIOS? = null,
    val originalTransactionDateIOS: Double? = null,
    val originalTransactionIdentifierIOS: String? = null,
    val ownershipTypeIOS: String? = null,
    val platform: IapPlatform,
    val productId: String,
    val purchaseState: PurchaseState,
    val purchaseToken: String? = null,
    val quantity: Int,
    val quantityIOS: Int? = null,
    val reasonIOS: String? = null,
    val reasonStringRepresentationIOS: String? = null,
    val renewalInfoIOS: RenewalInfoIOS? = null,
    val revocationDateIOS: Double? = null,
    val revocationReasonIOS: String? = null,
    val storefrontCountryCodeIOS: String? = null,
    val subscriptionGroupIdIOS: String? = null,
    val transactionDate: Double,
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

public data class ReceiptValidationResultAndroid(
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
) : ReceiptValidationResult {

    companion object {
        fun fromJson(json: Map<String, Any?>): ReceiptValidationResultAndroid {
            return ReceiptValidationResultAndroid(
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
        "__typename" to "ReceiptValidationResultAndroid",
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

public data class ReceiptValidationResultIOS(
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
) : ReceiptValidationResult {

    companion object {
        fun fromJson(json: Map<String, Any?>): ReceiptValidationResultIOS {
            return ReceiptValidationResultIOS(
                isValid = json["isValid"] as Boolean,
                jwsRepresentation = json["jwsRepresentation"] as String,
                latestTransaction = (json["latestTransaction"] as Map<String, Any?>?)?.let { Purchase.fromJson(it) },
                receiptData = json["receiptData"] as String,
            )
        }
    }

    override fun toJson(): Map<String, Any?> = mapOf(
        "__typename" to "ReceiptValidationResultIOS",
        "isValid" to isValid,
        "jwsRepresentation" to jwsRepresentation,
        "latestTransaction" to latestTransaction?.toJson(),
        "receiptData" to receiptData,
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

public sealed interface RequestPurchaseResult

public data class RequestPurchaseResultPurchase(val value: Purchase?) : RequestPurchaseResult

public data class RequestPurchaseResultPurchases(val value: List<Purchase>?) : RequestPurchaseResult

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

public data class ReceiptValidationAndroidOptions(
    val accessToken: String,
    val isSub: Boolean? = null,
    val packageName: String,
    val productToken: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): ReceiptValidationAndroidOptions {
            return ReceiptValidationAndroidOptions(
                accessToken = json["accessToken"] as String,
                isSub = json["isSub"] as Boolean?,
                packageName = json["packageName"] as String,
                productToken = json["productToken"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "accessToken" to accessToken,
        "isSub" to isSub,
        "packageName" to packageName,
        "productToken" to productToken,
    )
}

public data class ReceiptValidationProps(
    /**
     * Android-specific validation options
     */
    val androidOptions: ReceiptValidationAndroidOptions? = null,
    /**
     * Product SKU to validate
     */
    val sku: String
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): ReceiptValidationProps {
            return ReceiptValidationProps(
                androidOptions = (json["androidOptions"] as Map<String, Any?>?)?.let { ReceiptValidationAndroidOptions.fromJson(it) },
                sku = json["sku"] as String,
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "androidOptions" to androidOptions?.toJson(),
        "sku" to sku,
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

public data class RequestPurchasePropsByPlatforms(
    /**
     * Android-specific purchase parameters
     */
    val android: RequestPurchaseAndroidProps? = null,
    /**
     * iOS-specific purchase parameters
     */
    val ios: RequestPurchaseIosProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestPurchasePropsByPlatforms {
            return RequestPurchasePropsByPlatforms(
                android = (json["android"] as Map<String, Any?>?)?.let { RequestPurchaseAndroidProps.fromJson(it) },
                ios = (json["ios"] as Map<String, Any?>?)?.let { RequestPurchaseIosProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "android" to android?.toJson(),
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
     */
    val replacementModeAndroid: Int? = null,
    /**
     * List of subscription SKUs
     */
    val skus: List<String>,
    /**
     * Subscription offers
     */
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>? = null
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

public data class RequestSubscriptionPropsByPlatforms(
    /**
     * Android-specific subscription parameters
     */
    val android: RequestSubscriptionAndroidProps? = null,
    /**
     * iOS-specific subscription parameters
     */
    val ios: RequestSubscriptionIosProps? = null
) {
    companion object {
        fun fromJson(json: Map<String, Any?>): RequestSubscriptionPropsByPlatforms {
            return RequestSubscriptionPropsByPlatforms(
                android = (json["android"] as Map<String, Any?>?)?.let { RequestSubscriptionAndroidProps.fromJson(it) },
                ios = (json["ios"] as Map<String, Any?>?)?.let { RequestSubscriptionIosProps.fromJson(it) },
            )
        }
    }

    fun toJson(): Map<String, Any?> = mapOf(
        "android" to android?.toJson(),
        "ios" to ios?.toJson(),
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

public sealed interface ReceiptValidationResult {
    fun toJson(): Map<String, Any?>

    companion object {
        fun fromJson(json: Map<String, Any?>): ReceiptValidationResult {
            return when (json["__typename"] as String?) {
                "ReceiptValidationResultAndroid" -> ReceiptValidationResultAndroid.fromJson(json)
                "ReceiptValidationResultIOS" -> ReceiptValidationResultIOS.fromJson(json)
                else -> throw IllegalArgumentException("Unknown __typename for ReceiptValidationResult: ${json["__typename"]}")
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
    suspend fun validateReceipt(options: ReceiptValidationProps): ReceiptValidationResult
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
    suspend fun validateReceiptIOS(options: ReceiptValidationProps): ReceiptValidationResultIOS
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
public typealias MutationValidateReceiptHandler = suspend (options: ReceiptValidationProps) -> ReceiptValidationResult

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
    val validateReceipt: MutationValidateReceiptHandler? = null
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
public typealias QueryValidateReceiptIOSHandler = suspend (options: ReceiptValidationProps) -> ReceiptValidationResultIOS

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
