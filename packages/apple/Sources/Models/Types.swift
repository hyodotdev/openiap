// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `npm run generate` after updating any *.graphql schema file.
// ============================================================================

import Foundation

// MARK: - Enums

/// Alternative billing mode for Android
/// Controls which billing system is used
public enum AlternativeBillingModeAndroid: String, Codable, CaseIterable {
    /// Standard Google Play billing (default)
    case none = "none"
    /// User choice billing - user can select between Google Play or alternative
    /// Requires Google Play Billing Library 7.0+
    case userChoice = "user-choice"
    /// Alternative billing only - no Google Play billing option
    /// Requires Google Play Billing Library 6.2+
    case alternativeOnly = "alternative-only"
}

public enum ErrorCode: String, Codable, CaseIterable {
    case unknown = "unknown"
    case userCancelled = "user-cancelled"
    case userError = "user-error"
    case itemUnavailable = "item-unavailable"
    case remoteError = "remote-error"
    case networkError = "network-error"
    case serviceError = "service-error"
    case receiptFailed = "receipt-failed"
    case receiptFinished = "receipt-finished"
    case receiptFinishedFailed = "receipt-finished-failed"
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
    case queryProduct = "query-product"
    case skuNotFound = "sku-not-found"
    case skuOfferMismatch = "sku-offer-mismatch"
    case itemNotOwned = "item-not-owned"
    case billingUnavailable = "billing-unavailable"
    case featureNotSupported = "feature-not-supported"
    case emptySkuList = "empty-sku-list"
}

/// User actions on external purchase notice sheet (iOS 18.2+)
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
}

public enum IapPlatform: String, Codable, CaseIterable {
    case ios = "ios"
    case android = "android"
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
    case failed = "failed"
    case restored = "restored"
    case deferred = "deferred"
    case unknown = "unknown"
}

public enum SubscriptionOfferTypeIOS: String, Codable, CaseIterable {
    case introductory = "introductory"
    case promotional = "promotional"
}

public enum SubscriptionPeriodIOS: String, Codable, CaseIterable {
    case day = "day"
    case week = "week"
    case month = "month"
    case year = "year"
    case empty = "empty"
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
    var platform: IapPlatform { get }
    var productId: String { get }
    var purchaseState: PurchaseState { get }
    /// Unified purchase token (iOS JWS, Android purchaseToken)
    var purchaseToken: String? { get }
    var quantity: Int { get }
    var transactionDate: Double { get }
}

// MARK: - Objects

public struct ActiveSubscription: Codable {
    public var autoRenewingAndroid: Bool?
    public var basePlanIdAndroid: String?
    /// The current plan identifier. This is:
    /// - On Android: the basePlanId (e.g., "premium", "premium-year")
    /// - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
    /// This provides a unified way to identify which specific plan/tier the user is subscribed to.
    public var currentPlanId: String?
    public var daysUntilExpirationIOS: Double?
    public var environmentIOS: String?
    public var expirationDateIOS: Double?
    public var isActive: Bool
    public var productId: String
    public var purchaseToken: String?
    /// Required for subscription upgrade/downgrade on Android
    public var purchaseTokenAndroid: String?
    /// Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,
    /// pending upgrades/downgrades, and auto-renewal preferences.
    public var renewalInfoIOS: RenewalInfoIOS?
    public var transactionDate: Double
    public var transactionId: String
    public var willExpireSoon: Bool?
}

public struct AppTransaction: Codable {
    public var appId: Double
    public var appTransactionId: String?
    public var appVersion: String
    public var appVersionId: Double
    public var bundleId: String
    public var deviceVerification: String
    public var deviceVerificationNonce: String
    public var environment: String
    public var originalAppVersion: String
    public var originalPlatform: String?
    public var originalPurchaseDate: Double
    public var preorderDate: Double?
    public var signedDate: Double
}

public struct DiscountIOS: Codable {
    public var identifier: String
    public var localizedPrice: String?
    public var numberOfPeriods: Int
    public var paymentMode: PaymentModeIOS
    public var price: String
    public var priceAmount: Double
    public var subscriptionPeriod: String
    public var type: String
}

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

/// Result of presenting an external purchase link (iOS 18.2+)
public struct ExternalPurchaseLinkResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String?
    /// Whether the user completed the external purchase flow
    public var success: Bool
}

/// Result of presenting external purchase notice sheet (iOS 18.2+)
public struct ExternalPurchaseNoticeResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String?
    /// Notice result indicating user action
    public var result: ExternalPurchaseNoticeAction
}

public enum FetchProductsResult {
    case products([Product]?)
    case subscriptions([ProductSubscription]?)
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
    public var debugDescription: String?
    public var description: String
    public var displayName: String?
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    public var oneTimePurchaseOfferDetailsAndroid: ProductAndroidOneTimePurchaseOfferDetail?
    public var platform: IapPlatform
    public var price: Double?
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]?
    public var title: String
    public var type: ProductType
}

public struct ProductAndroidOneTimePurchaseOfferDetail: Codable {
    public var formattedPrice: String
    public var priceAmountMicros: String
    public var priceCurrencyCode: String
}

public struct ProductIOS: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String?
    public var description: String
    public var displayName: String?
    public var displayNameIOS: String
    public var displayPrice: String
    public var id: String
    public var isFamilyShareableIOS: Bool
    public var jsonRepresentationIOS: String
    public var platform: IapPlatform
    public var price: Double?
    public var subscriptionInfoIOS: SubscriptionInfoIOS?
    public var title: String
    public var type: ProductType
    public var typeIOS: ProductTypeIOS
}

public struct ProductSubscriptionAndroid: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String?
    public var description: String
    public var displayName: String?
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    public var oneTimePurchaseOfferDetailsAndroid: ProductAndroidOneTimePurchaseOfferDetail?
    public var platform: IapPlatform
    public var price: Double?
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]
    public var title: String
    public var type: ProductType
}

public struct ProductSubscriptionAndroidOfferDetails: Codable {
    public var basePlanId: String
    public var offerId: String?
    public var offerTags: [String]
    public var offerToken: String
    public var pricingPhases: PricingPhasesAndroid
}

public struct ProductSubscriptionIOS: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String?
    public var description: String
    public var discountsIOS: [DiscountIOS]?
    public var displayName: String?
    public var displayNameIOS: String
    public var displayPrice: String
    public var id: String
    public var introductoryPriceAsAmountIOS: String?
    public var introductoryPriceIOS: String?
    public var introductoryPriceNumberOfPeriodsIOS: String?
    public var introductoryPricePaymentModeIOS: PaymentModeIOS?
    public var introductoryPriceSubscriptionPeriodIOS: SubscriptionPeriodIOS?
    public var isFamilyShareableIOS: Bool
    public var jsonRepresentationIOS: String
    public var platform: IapPlatform
    public var price: Double?
    public var subscriptionInfoIOS: SubscriptionInfoIOS?
    public var subscriptionPeriodNumberIOS: String?
    public var subscriptionPeriodUnitIOS: SubscriptionPeriodIOS?
    public var title: String
    public var type: ProductType
    public var typeIOS: ProductTypeIOS
}

public struct PurchaseAndroid: Codable, PurchaseCommon {
    public var autoRenewingAndroid: Bool?
    public var currentPlanId: String?
    public var dataAndroid: String?
    public var developerPayloadAndroid: String?
    public var id: String
    public var ids: [String]?
    public var isAcknowledgedAndroid: Bool?
    public var isAutoRenewing: Bool
    public var obfuscatedAccountIdAndroid: String?
    public var obfuscatedProfileIdAndroid: String?
    public var packageNameAndroid: String?
    public var platform: IapPlatform
    public var productId: String
    public var purchaseState: PurchaseState
    public var purchaseToken: String?
    public var quantity: Int
    public var signatureAndroid: String?
    public var transactionDate: Double
    public var transactionId: String?
}

public struct PurchaseError: Codable {
    public var code: ErrorCode
    public var message: String
    public var productId: String?
}

public struct PurchaseIOS: Codable, PurchaseCommon {
    public var appAccountToken: String?
    public var appBundleIdIOS: String?
    public var countryCodeIOS: String?
    public var currencyCodeIOS: String?
    public var currencySymbolIOS: String?
    public var currentPlanId: String?
    public var environmentIOS: String?
    public var expirationDateIOS: Double?
    public var id: String
    public var ids: [String]?
    public var isAutoRenewing: Bool
    public var isUpgradedIOS: Bool?
    public var offerIOS: PurchaseOfferIOS?
    public var originalTransactionDateIOS: Double?
    public var originalTransactionIdentifierIOS: String?
    public var ownershipTypeIOS: String?
    public var platform: IapPlatform
    public var productId: String
    public var purchaseState: PurchaseState
    public var purchaseToken: String?
    public var quantity: Int
    public var quantityIOS: Int?
    public var reasonIOS: String?
    public var reasonStringRepresentationIOS: String?
    public var renewalInfoIOS: RenewalInfoIOS?
    public var revocationDateIOS: Double?
    public var revocationReasonIOS: String?
    public var storefrontCountryCodeIOS: String?
    public var subscriptionGroupIdIOS: String?
    public var transactionDate: Double
    public var transactionId: String
    public var transactionReasonIOS: String?
    public var webOrderLineItemIdIOS: String?
}

public struct PurchaseOfferIOS: Codable {
    public var id: String
    public var paymentMode: String
    public var type: String
}

public struct ReceiptValidationResultAndroid: Codable {
    public var autoRenewing: Bool
    public var betaProduct: Bool
    public var cancelDate: Double?
    public var cancelReason: String?
    public var deferredDate: Double?
    public var deferredSku: String?
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

public struct ReceiptValidationResultIOS: Codable {
    /// Whether the receipt is valid
    public var isValid: Bool
    /// JWS representation
    public var jwsRepresentation: String
    /// Latest transaction if available
    public var latestTransaction: Purchase?
    /// Receipt data string
    public var receiptData: String
}

public struct RefundResultIOS: Codable {
    public var message: String?
    public var status: String
}

/// Subscription renewal information from Product.SubscriptionInfo.RenewalInfo
/// https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
public struct RenewalInfoIOS: Codable {
    public var autoRenewPreference: String?
    /// When subscription expires due to cancellation/billing issue
    /// Possible values: "VOLUNTARY", "BILLING_ERROR", "DID_NOT_AGREE_TO_PRICE_INCREASE", "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
    public var expirationReason: String?
    /// Grace period expiration date (milliseconds since epoch)
    /// When set, subscription is in grace period (billing issue but still has access)
    public var gracePeriodExpirationDate: Double?
    /// True if subscription failed to renew due to billing issue and is retrying
    /// Note: Not directly available in RenewalInfo, available in Status
    public var isInBillingRetry: Bool?
    public var jsonRepresentation: String?
    /// Product ID that will be used on next renewal (when user upgrades/downgrades)
    /// If set and different from current productId, subscription will change on expiration
    public var pendingUpgradeProductId: String?
    /// User's response to subscription price increase
    /// Possible values: "AGREED", "PENDING", null (no price increase)
    public var priceIncreaseStatus: String?
    /// Expected renewal date (milliseconds since epoch)
    /// For active subscriptions, when the next renewal/charge will occur
    public var renewalDate: Double?
    /// Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)
    public var renewalOfferId: String?
    /// Type of offer applied to next renewal
    /// Possible values: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE", "WIN_BACK", etc.
    public var renewalOfferType: String?
    public var willAutoRenew: Bool
}

public enum RequestPurchaseResult {
    case purchase(Purchase?)
    case purchases([Purchase]?)
}

public struct SubscriptionInfoIOS: Codable {
    public var introductoryOffer: SubscriptionOfferIOS?
    public var promotionalOffers: [SubscriptionOfferIOS]?
    public var subscriptionGroupId: String
    public var subscriptionPeriod: SubscriptionPeriodValueIOS
}

public struct SubscriptionOfferIOS: Codable {
    public var displayPrice: String
    public var id: String
    public var paymentMode: PaymentModeIOS
    public var period: SubscriptionPeriodValueIOS
    public var periodCount: Int
    public var price: Double
    public var type: SubscriptionOfferTypeIOS
}

public struct SubscriptionPeriodValueIOS: Codable {
    public var unit: SubscriptionPeriodIOS
    public var value: Int
}

public struct SubscriptionStatusIOS: Codable {
    public var renewalInfo: RenewalInfoIOS?
    public var state: String
}

/// User Choice Billing event details (Android)
/// Fired when a user selects alternative billing in the User Choice Billing dialog
public struct UserChoiceBillingDetails: Codable {
    /// Token that must be reported to Google Play within 24 hours
    public var externalTransactionToken: String
    /// List of product IDs selected by the user
    public var products: [String]
}

public typealias VoidResult = Void

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

public struct DiscountOfferInputIOS: Codable {
    public var identifier: String
    public var keyIdentifier: String
    public var nonce: String
    public var signature: String
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

/// Connection initialization configuration
public struct InitConnectionConfig: Codable {
    /// Alternative billing mode for Android
    /// If not specified, defaults to NONE (standard Google Play billing)
    public var alternativeBillingModeAndroid: AlternativeBillingModeAndroid?

    public init(
        alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = nil
    ) {
        self.alternativeBillingModeAndroid = alternativeBillingModeAndroid
    }
}

public struct ProductRequest: Codable {
    public var skus: [String]
    public var type: ProductQueryType?

    public init(
        skus: [String],
        type: ProductQueryType? = nil
    ) {
        self.skus = skus
        self.type = type
    }
}

public typealias PurchaseInput = Purchase

public struct PurchaseOptions: Codable {
    /// Also emit results through the iOS event listeners
    public var alsoPublishToEventListenerIOS: Bool?
    /// Limit to currently active items on iOS
    public var onlyIncludeActiveItemsIOS: Bool?

    public init(
        alsoPublishToEventListenerIOS: Bool? = nil,
        onlyIncludeActiveItemsIOS: Bool? = nil
    ) {
        self.alsoPublishToEventListenerIOS = alsoPublishToEventListenerIOS
        self.onlyIncludeActiveItemsIOS = onlyIncludeActiveItemsIOS
    }
}

public struct ReceiptValidationAndroidOptions: Codable {
    public var accessToken: String
    public var isSub: Bool?
    public var packageName: String
    public var productToken: String

    public init(
        accessToken: String,
        isSub: Bool? = nil,
        packageName: String,
        productToken: String
    ) {
        self.accessToken = accessToken
        self.isSub = isSub
        self.packageName = packageName
        self.productToken = productToken
    }
}

public struct ReceiptValidationProps: Codable {
    /// Android-specific validation options
    public var androidOptions: ReceiptValidationAndroidOptions?
    /// Product SKU to validate
    public var sku: String

    public init(
        androidOptions: ReceiptValidationAndroidOptions? = nil,
        sku: String
    ) {
        self.androidOptions = androidOptions
        self.sku = sku
    }
}

public struct RequestPurchaseAndroidProps: Codable {
    /// Personalized offer flag
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountIdAndroid: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileIdAndroid: String?
    /// List of product SKUs
    public var skus: [String]

    public init(
        isOfferPersonalized: Bool? = nil,
        obfuscatedAccountIdAndroid: String? = nil,
        obfuscatedProfileIdAndroid: String? = nil,
        skus: [String]
    ) {
        self.isOfferPersonalized = isOfferPersonalized
        self.obfuscatedAccountIdAndroid = obfuscatedAccountIdAndroid
        self.obfuscatedProfileIdAndroid = obfuscatedProfileIdAndroid
        self.skus = skus
    }
}

public struct RequestPurchaseIosProps: Codable {
    /// Auto-finish transaction (dangerous)
    public var andDangerouslyFinishTransactionAutomatically: Bool?
    /// App account token for user tracking
    public var appAccountToken: String?
    /// Purchase quantity
    public var quantity: Int?
    /// Product SKU
    public var sku: String
    /// Discount offer to apply
    public var withOffer: DiscountOfferInputIOS?

    public init(
        andDangerouslyFinishTransactionAutomatically: Bool? = nil,
        appAccountToken: String? = nil,
        quantity: Int? = nil,
        sku: String,
        withOffer: DiscountOfferInputIOS? = nil
    ) {
        self.andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically
        self.appAccountToken = appAccountToken
        self.quantity = quantity
        self.sku = sku
        self.withOffer = withOffer
    }
}

public struct RequestPurchaseProps: Codable {
    public var request: Request
    public var type: ProductQueryType
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
        if let purchase = try container.decodeIfPresent(RequestPurchasePropsByPlatforms.self, forKey: .requestPurchase) {
            let finalType = decodedType ?? .inApp
            guard finalType == .inApp else {
                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be IN_APP when requestPurchase is provided")
            }
            self.request = .purchase(purchase)
            self.type = finalType
            return
        }
        if let subscription = try container.decodeIfPresent(RequestSubscriptionPropsByPlatforms.self, forKey: .requestSubscription) {
            let finalType = decodedType ?? .subs
            guard finalType == .subs else {
                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be SUBS when requestSubscription is provided")
            }
            self.request = .subscription(subscription)
            self.type = finalType
            return
        }
        throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps requires requestPurchase or requestSubscription.")
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
        case purchase(RequestPurchasePropsByPlatforms)
        case subscription(RequestSubscriptionPropsByPlatforms)
    }
}

public struct RequestPurchasePropsByPlatforms: Codable {
    /// Android-specific purchase parameters
    public var android: RequestPurchaseAndroidProps?
    /// iOS-specific purchase parameters
    public var ios: RequestPurchaseIosProps?

    public init(
        android: RequestPurchaseAndroidProps? = nil,
        ios: RequestPurchaseIosProps? = nil
    ) {
        self.android = android
        self.ios = ios
    }
}

public struct RequestSubscriptionAndroidProps: Codable {
    /// Personalized offer flag
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountIdAndroid: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileIdAndroid: String?
    /// Purchase token for upgrades/downgrades
    public var purchaseTokenAndroid: String?
    /// Replacement mode for subscription changes
    public var replacementModeAndroid: Int?
    /// List of subscription SKUs
    public var skus: [String]
    /// Subscription offers
    public var subscriptionOffers: [AndroidSubscriptionOfferInput]?

    public init(
        isOfferPersonalized: Bool? = nil,
        obfuscatedAccountIdAndroid: String? = nil,
        obfuscatedProfileIdAndroid: String? = nil,
        purchaseTokenAndroid: String? = nil,
        replacementModeAndroid: Int? = nil,
        skus: [String],
        subscriptionOffers: [AndroidSubscriptionOfferInput]? = nil
    ) {
        self.isOfferPersonalized = isOfferPersonalized
        self.obfuscatedAccountIdAndroid = obfuscatedAccountIdAndroid
        self.obfuscatedProfileIdAndroid = obfuscatedProfileIdAndroid
        self.purchaseTokenAndroid = purchaseTokenAndroid
        self.replacementModeAndroid = replacementModeAndroid
        self.skus = skus
        self.subscriptionOffers = subscriptionOffers
    }
}

public struct RequestSubscriptionIosProps: Codable {
    public var andDangerouslyFinishTransactionAutomatically: Bool?
    public var appAccountToken: String?
    public var quantity: Int?
    public var sku: String
    public var withOffer: DiscountOfferInputIOS?

    public init(
        andDangerouslyFinishTransactionAutomatically: Bool? = nil,
        appAccountToken: String? = nil,
        quantity: Int? = nil,
        sku: String,
        withOffer: DiscountOfferInputIOS? = nil
    ) {
        self.andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically
        self.appAccountToken = appAccountToken
        self.quantity = quantity
        self.sku = sku
        self.withOffer = withOffer
    }
}

public struct RequestSubscriptionPropsByPlatforms: Codable {
    /// Android-specific subscription parameters
    public var android: RequestSubscriptionAndroidProps?
    /// iOS-specific subscription parameters
    public var ios: RequestSubscriptionIosProps?

    public init(
        android: RequestSubscriptionAndroidProps? = nil,
        ios: RequestSubscriptionIosProps? = nil
    ) {
        self.android = android
        self.ios = ios
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

    public var transactionDate: Double {
        switch self {
        case let .purchaseAndroid(value):
            return value.transactionDate
        case let .purchaseIos(value):
            return value.transactionDate
        }
    }
}

public enum ReceiptValidationResult: Codable {
    case receiptValidationResultAndroid(ReceiptValidationResultAndroid)
    case receiptValidationResultIos(ReceiptValidationResultIOS)
}

// MARK: - Root Operations

/// GraphQL root mutation operations.
public protocol MutationResolver {
    /// Acknowledge a non-consumable purchase or subscription
    func acknowledgePurchaseAndroid(_ purchaseToken: String) async throws -> Bool
    /// Initiate a refund request for a product (iOS 15+)
    func beginRefundRequestIOS(_ sku: String) async throws -> String?
    /// Check if alternative billing is available for this user/device
    /// Step 1 of alternative billing flow
    /// 
    /// Returns true if available, false otherwise
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func checkAlternativeBillingAvailabilityAndroid() async throws -> Bool
    /// Clear pending transactions from the StoreKit payment queue
    func clearTransactionIOS() async throws -> Bool
    /// Consume a purchase token so it can be repurchased
    func consumePurchaseAndroid(_ purchaseToken: String) async throws -> Bool
    /// Create external transaction token for Google Play reporting
    /// Step 3 of alternative billing flow
    /// Must be called AFTER successful payment in your payment system
    /// Token must be reported to Google Play backend within 24 hours
    /// 
    /// Returns token string, or null if creation failed
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func createAlternativeBillingTokenAndroid() async throws -> String?
    /// Open the native subscription management surface
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void
    /// Close the platform billing connection
    func endConnection() async throws -> Bool
    /// Finish a transaction after validating receipts
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void
    /// Establish the platform billing connection
    func initConnection(_ config: InitConnectionConfig?) async throws -> Bool
    /// Present the App Store code redemption sheet
    func presentCodeRedemptionSheetIOS() async throws -> Bool
    /// Present external purchase custom link with StoreKit UI (iOS 18.2+)
    func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS
    /// Present external purchase notice sheet (iOS 18.2+)
    func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS
    /// Initiate a purchase flow; rely on events for final state
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
    /// Purchase the promoted product surfaced by the App Store
    func requestPurchaseOnPromotedProductIOS() async throws -> Bool
    /// Restore completed purchases across platforms
    func restorePurchases() async throws -> Void
    /// Show alternative billing information dialog to user
    /// Step 2 of alternative billing flow
    /// Must be called BEFORE processing payment in your payment system
    /// 
    /// Returns true if user accepted, false if user canceled
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func showAlternativeBillingDialogAndroid() async throws -> Bool
    /// Open subscription management UI and return changed purchases (iOS 15+)
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS]
    /// Force a StoreKit sync for transactions (iOS 15+)
    func syncIOS() async throws -> Bool
    /// Validate purchase receipts with the configured providers
    func validateReceipt(_ options: ReceiptValidationProps) async throws -> ReceiptValidationResult
}

/// GraphQL root query operations.
public protocol QueryResolver {
    /// Check if external purchase notice sheet can be presented (iOS 18.2+)
    func canPresentExternalPurchaseNoticeIOS() async throws -> Bool
    /// Get current StoreKit 2 entitlements (iOS 15+)
    func currentEntitlementIOS(_ sku: String) async throws -> PurchaseIOS?
    /// Retrieve products or subscriptions from the store
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult
    /// Get active subscriptions (filters by subscriptionIds when provided)
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]
    /// Fetch the current app transaction (iOS 16+)
    func getAppTransactionIOS() async throws -> AppTransaction?
    /// Get all available purchases for the current user
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase]
    /// Retrieve all pending transactions in the StoreKit queue
    func getPendingTransactionsIOS() async throws -> [PurchaseIOS]
    /// Get the currently promoted product (iOS 11+)
    func getPromotedProductIOS() async throws -> ProductIOS?
    /// Get base64-encoded receipt data for validation
    func getReceiptDataIOS() async throws -> String?
    /// Get the current storefront country code
    func getStorefront() async throws -> String
    /// Get the current App Store storefront country code
    func getStorefrontIOS() async throws -> String
    /// Get the transaction JWS (StoreKit 2)
    func getTransactionJwsIOS(_ sku: String) async throws -> String?
    /// Check whether the user has active subscriptions
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool
    /// Check introductory offer eligibility for a subscription group
    func isEligibleForIntroOfferIOS(_ groupID: String) async throws -> Bool
    /// Verify a StoreKit 2 transaction signature
    func isTransactionVerifiedIOS(_ sku: String) async throws -> Bool
    /// Get the latest transaction for a product using StoreKit 2
    func latestTransactionIOS(_ sku: String) async throws -> PurchaseIOS?
    /// Get StoreKit 2 subscription status details (iOS 15+)
    func subscriptionStatusIOS(_ sku: String) async throws -> [SubscriptionStatusIOS]
    /// Validate a receipt for a specific product
    func validateReceiptIOS(_ options: ReceiptValidationProps) async throws -> ReceiptValidationResultIOS
}

/// GraphQL root subscription operations.
public protocol SubscriptionResolver {
    /// Fires when the App Store surfaces a promoted product (iOS only)
    func promotedProductIOS() async throws -> String
    /// Fires when a purchase fails or is cancelled
    func purchaseError() async throws -> PurchaseError
    /// Fires when a purchase completes successfully or a pending purchase resolves
    func purchaseUpdated() async throws -> Purchase
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
public typealias MutationDeepLinkToSubscriptionsHandler = (_ options: DeepLinkOptions?) async throws -> Void
public typealias MutationEndConnectionHandler = () async throws -> Bool
public typealias MutationFinishTransactionHandler = (_ purchase: PurchaseInput, _ isConsumable: Bool?) async throws -> Void
public typealias MutationInitConnectionHandler = (_ config: InitConnectionConfig?) async throws -> Bool
public typealias MutationPresentCodeRedemptionSheetIOSHandler = () async throws -> Bool
public typealias MutationPresentExternalPurchaseLinkIOSHandler = (_ url: String) async throws -> ExternalPurchaseLinkResultIOS
public typealias MutationPresentExternalPurchaseNoticeSheetIOSHandler = () async throws -> ExternalPurchaseNoticeResultIOS
public typealias MutationRequestPurchaseHandler = (_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
public typealias MutationRequestPurchaseOnPromotedProductIOSHandler = () async throws -> Bool
public typealias MutationRestorePurchasesHandler = () async throws -> Void
public typealias MutationShowAlternativeBillingDialogAndroidHandler = () async throws -> Bool
public typealias MutationShowManageSubscriptionsIOSHandler = () async throws -> [PurchaseIOS]
public typealias MutationSyncIOSHandler = () async throws -> Bool
public typealias MutationValidateReceiptHandler = (_ options: ReceiptValidationProps) async throws -> ReceiptValidationResult

public struct MutationHandlers {
    public var acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler?
    public var beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler?
    public var checkAlternativeBillingAvailabilityAndroid: MutationCheckAlternativeBillingAvailabilityAndroidHandler?
    public var clearTransactionIOS: MutationClearTransactionIOSHandler?
    public var consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler?
    public var createAlternativeBillingTokenAndroid: MutationCreateAlternativeBillingTokenAndroidHandler?
    public var deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler?
    public var endConnection: MutationEndConnectionHandler?
    public var finishTransaction: MutationFinishTransactionHandler?
    public var initConnection: MutationInitConnectionHandler?
    public var presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler?
    public var presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler?
    public var presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler?
    public var requestPurchase: MutationRequestPurchaseHandler?
    public var requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler?
    public var restorePurchases: MutationRestorePurchasesHandler?
    public var showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler?
    public var showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler?
    public var syncIOS: MutationSyncIOSHandler?
    public var validateReceipt: MutationValidateReceiptHandler?

    public init(
        acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler? = nil,
        beginRefundRequestIOS: MutationBeginRefundRequestIOSHandler? = nil,
        checkAlternativeBillingAvailabilityAndroid: MutationCheckAlternativeBillingAvailabilityAndroidHandler? = nil,
        clearTransactionIOS: MutationClearTransactionIOSHandler? = nil,
        consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler? = nil,
        createAlternativeBillingTokenAndroid: MutationCreateAlternativeBillingTokenAndroidHandler? = nil,
        deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler? = nil,
        endConnection: MutationEndConnectionHandler? = nil,
        finishTransaction: MutationFinishTransactionHandler? = nil,
        initConnection: MutationInitConnectionHandler? = nil,
        presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler? = nil,
        presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler? = nil,
        presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler? = nil,
        requestPurchase: MutationRequestPurchaseHandler? = nil,
        requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler? = nil,
        restorePurchases: MutationRestorePurchasesHandler? = nil,
        showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler? = nil,
        showManageSubscriptionsIOS: MutationShowManageSubscriptionsIOSHandler? = nil,
        syncIOS: MutationSyncIOSHandler? = nil,
        validateReceipt: MutationValidateReceiptHandler? = nil
    ) {
        self.acknowledgePurchaseAndroid = acknowledgePurchaseAndroid
        self.beginRefundRequestIOS = beginRefundRequestIOS
        self.checkAlternativeBillingAvailabilityAndroid = checkAlternativeBillingAvailabilityAndroid
        self.clearTransactionIOS = clearTransactionIOS
        self.consumePurchaseAndroid = consumePurchaseAndroid
        self.createAlternativeBillingTokenAndroid = createAlternativeBillingTokenAndroid
        self.deepLinkToSubscriptions = deepLinkToSubscriptions
        self.endConnection = endConnection
        self.finishTransaction = finishTransaction
        self.initConnection = initConnection
        self.presentCodeRedemptionSheetIOS = presentCodeRedemptionSheetIOS
        self.presentExternalPurchaseLinkIOS = presentExternalPurchaseLinkIOS
        self.presentExternalPurchaseNoticeSheetIOS = presentExternalPurchaseNoticeSheetIOS
        self.requestPurchase = requestPurchase
        self.requestPurchaseOnPromotedProductIOS = requestPurchaseOnPromotedProductIOS
        self.restorePurchases = restorePurchases
        self.showAlternativeBillingDialogAndroid = showAlternativeBillingDialogAndroid
        self.showManageSubscriptionsIOS = showManageSubscriptionsIOS
        self.syncIOS = syncIOS
        self.validateReceipt = validateReceipt
    }
}

// MARK: - Query Helpers

public typealias QueryCanPresentExternalPurchaseNoticeIOSHandler = () async throws -> Bool
public typealias QueryCurrentEntitlementIOSHandler = (_ sku: String) async throws -> PurchaseIOS?
public typealias QueryFetchProductsHandler = (_ params: ProductRequest) async throws -> FetchProductsResult
public typealias QueryGetActiveSubscriptionsHandler = (_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]
public typealias QueryGetAppTransactionIOSHandler = () async throws -> AppTransaction?
public typealias QueryGetAvailablePurchasesHandler = (_ options: PurchaseOptions?) async throws -> [Purchase]
public typealias QueryGetPendingTransactionsIOSHandler = () async throws -> [PurchaseIOS]
public typealias QueryGetPromotedProductIOSHandler = () async throws -> ProductIOS?
public typealias QueryGetReceiptDataIOSHandler = () async throws -> String?
public typealias QueryGetStorefrontHandler = () async throws -> String
public typealias QueryGetStorefrontIOSHandler = () async throws -> String
public typealias QueryGetTransactionJwsIOSHandler = (_ sku: String) async throws -> String?
public typealias QueryHasActiveSubscriptionsHandler = (_ subscriptionIds: [String]?) async throws -> Bool
public typealias QueryIsEligibleForIntroOfferIOSHandler = (_ groupID: String) async throws -> Bool
public typealias QueryIsTransactionVerifiedIOSHandler = (_ sku: String) async throws -> Bool
public typealias QueryLatestTransactionIOSHandler = (_ sku: String) async throws -> PurchaseIOS?
public typealias QuerySubscriptionStatusIOSHandler = (_ sku: String) async throws -> [SubscriptionStatusIOS]
public typealias QueryValidateReceiptIOSHandler = (_ options: ReceiptValidationProps) async throws -> ReceiptValidationResultIOS

public struct QueryHandlers {
    public var canPresentExternalPurchaseNoticeIOS: QueryCanPresentExternalPurchaseNoticeIOSHandler?
    public var currentEntitlementIOS: QueryCurrentEntitlementIOSHandler?
    public var fetchProducts: QueryFetchProductsHandler?
    public var getActiveSubscriptions: QueryGetActiveSubscriptionsHandler?
    public var getAppTransactionIOS: QueryGetAppTransactionIOSHandler?
    public var getAvailablePurchases: QueryGetAvailablePurchasesHandler?
    public var getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler?
    public var getPromotedProductIOS: QueryGetPromotedProductIOSHandler?
    public var getReceiptDataIOS: QueryGetReceiptDataIOSHandler?
    public var getStorefront: QueryGetStorefrontHandler?
    public var getStorefrontIOS: QueryGetStorefrontIOSHandler?
    public var getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler?
    public var hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler?
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
        getAppTransactionIOS: QueryGetAppTransactionIOSHandler? = nil,
        getAvailablePurchases: QueryGetAvailablePurchasesHandler? = nil,
        getPendingTransactionsIOS: QueryGetPendingTransactionsIOSHandler? = nil,
        getPromotedProductIOS: QueryGetPromotedProductIOSHandler? = nil,
        getReceiptDataIOS: QueryGetReceiptDataIOSHandler? = nil,
        getStorefront: QueryGetStorefrontHandler? = nil,
        getStorefrontIOS: QueryGetStorefrontIOSHandler? = nil,
        getTransactionJwsIOS: QueryGetTransactionJwsIOSHandler? = nil,
        hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler? = nil,
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
        self.getAppTransactionIOS = getAppTransactionIOS
        self.getAvailablePurchases = getAvailablePurchases
        self.getPendingTransactionsIOS = getPendingTransactionsIOS
        self.getPromotedProductIOS = getPromotedProductIOS
        self.getReceiptDataIOS = getReceiptDataIOS
        self.getStorefront = getStorefront
        self.getStorefrontIOS = getStorefrontIOS
        self.getTransactionJwsIOS = getTransactionJwsIOS
        self.hasActiveSubscriptions = hasActiveSubscriptions
        self.isEligibleForIntroOfferIOS = isEligibleForIntroOfferIOS
        self.isTransactionVerifiedIOS = isTransactionVerifiedIOS
        self.latestTransactionIOS = latestTransactionIOS
        self.subscriptionStatusIOS = subscriptionStatusIOS
        self.validateReceiptIOS = validateReceiptIOS
    }
}

// MARK: - Subscription Helpers

public typealias SubscriptionPromotedProductIOSHandler = () async throws -> String
public typealias SubscriptionPurchaseErrorHandler = () async throws -> PurchaseError
public typealias SubscriptionPurchaseUpdatedHandler = () async throws -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = () async throws -> UserChoiceBillingDetails

public struct SubscriptionHandlers {
    public var promotedProductIOS: SubscriptionPromotedProductIOSHandler?
    public var purchaseError: SubscriptionPurchaseErrorHandler?
    public var purchaseUpdated: SubscriptionPurchaseUpdatedHandler?
    public var userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler?

    public init(
        promotedProductIOS: SubscriptionPromotedProductIOSHandler? = nil,
        purchaseError: SubscriptionPurchaseErrorHandler? = nil,
        purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = nil,
        userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = nil
    ) {
        self.promotedProductIOS = promotedProductIOS
        self.purchaseError = purchaseError
        self.purchaseUpdated = purchaseUpdated
        self.userChoiceBillingAndroid = userChoiceBillingAndroid
    }
}
