// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `bun run generate` after updating any *.graphql schema file.
// ============================================================================

import Foundation

// MARK: - Enums

/// Alternative billing mode for Android
/// Controls which billing system is used
/// @deprecated Use enableBillingProgramAndroid with BillingProgramAndroid instead.
/// Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
public enum AlternativeBillingModeAndroid: String, Codable, CaseIterable {
    /// Standard Google Play billing (default)
    case none = "none"
    /// User choice billing - user can select between Google Play or alternative
    /// Requires Google Play Billing Library 7.0+
    /// @deprecated Use BillingProgramAndroid.USER_CHOICE_BILLING instead
    case userChoice = "user-choice"
    /// Alternative billing only - no Google Play billing option
    /// Requires Google Play Billing Library 6.2+
    /// @deprecated Use BillingProgramAndroid.EXTERNAL_OFFER instead
    case alternativeOnly = "alternative-only"
}

/// Billing program types for external content links, external offers, and external payments (Android)
/// Available in Google Play Billing Library 8.2.0+, EXTERNAL_PAYMENTS added in 8.3.0
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

/// Discount offer type enumeration.
/// Categorizes the type of discount or promotional offer.
public enum DiscountOfferType: String, Codable, CaseIterable {
    /// Introductory offer for new subscribers (first-time purchase discount)
    case introductory = "introductory"
    /// Promotional offer for existing or returning subscribers
    case promotional = "promotional"
    /// One-time product discount (Android only, Google Play Billing 7.0+)
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
    case receiptFailed = "receipt-failed"
    case receiptFinished = "receipt-finished"
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
    case queryProduct = "query-product"
    case skuNotFound = "sku-not-found"
    case skuOfferMismatch = "sku-offer-mismatch"
    case itemNotOwned = "item-not-owned"
    case billingUnavailable = "billing-unavailable"
    case featureNotSupported = "feature-not-supported"
    case emptySkuList = "empty-sku-list"

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
        default:
            return nil
        }
    }
}

/// Launch mode for external link flow (Android)
/// Determines how the external URL is launched
/// Available in Google Play Billing Library 8.2.0+
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

/// User actions on external purchase notice sheet (iOS 15.4+)
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
    /// Fired when user selects developer-provided billing option in external payments flow.
    /// Available on Android with Google Play Billing Library 8.3.0+
    case developerProvidedBillingAndroid = "developer-provided-billing-android"
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
    /// Store where purchase was made
    var store: IapStore { get }
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
    /// @deprecated iOS only - use daysUntilExpirationIOS instead.
    /// Whether the subscription will expire soon (within 7 days).
    /// Consider using daysUntilExpirationIOS for more precise control.
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

/// Result of checking billing program availability (Android)
/// Available in Google Play Billing Library 8.2.0+
public struct BillingProgramAvailabilityResultAndroid: Codable {
    /// The billing program that was checked
    public var billingProgram: BillingProgramAndroid
    /// Whether the billing program is available for the user
    public var isAvailable: Bool
}

/// Reporting details for transactions made outside of Google Play Billing (Android)
/// Contains the external transaction token needed for reporting
/// Available in Google Play Billing Library 8.2.0+
public struct BillingProgramReportingDetailsAndroid: Codable {
    /// The billing program that the reporting details are associated with
    public var billingProgram: BillingProgramAndroid
    /// External transaction token used to report transactions made outside of Google Play Billing.
    /// This token must be used when reporting the external transaction to Google.
    public var externalTransactionToken: String
}

/// Extended billing result with sub-response code (Android)
/// Available in Google Play Billing Library 8.0.0+
public struct BillingResultAndroid: Codable {
    /// Debug message from the billing library
    public var debugMessage: String?
    /// The response code from the billing operation
    public var responseCode: Int
    /// Sub-response code for more granular error information (8.0+).
    /// Provides additional context when responseCode indicates an error.
    public var subResponseCode: SubResponseCodeAndroid?
}

/// Details provided when user selects developer billing option (Android)
/// Received via DeveloperProvidedBillingListener callback
/// Available in Google Play Billing Library 8.3.0+
public struct DeveloperProvidedBillingDetailsAndroid: Codable {
    /// External transaction token used to report transactions made through developer billing.
    /// This token must be used when reporting the external transaction to Google Play.
    /// Must be reported within 24 hours of the transaction.
    public var externalTransactionToken: String
}

/// Discount amount details for one-time purchase offers (Android)
/// Available in Google Play Billing Library 7.0+
public struct DiscountAmountAndroid: Codable {
    /// Discount amount in micro-units (1,000,000 = 1 unit of currency)
    public var discountAmountMicros: String
    /// Formatted discount amount with currency sign (e.g., "$4.99")
    public var formattedDiscountAmount: String
}

/// Discount display information for one-time purchase offers (Android)
/// Available in Google Play Billing Library 7.0+
public struct DiscountDisplayInfoAndroid: Codable {
    /// Absolute discount amount details
    /// Only returned for fixed amount discounts
    public var discountAmount: DiscountAmountAndroid?
    /// Percentage discount (e.g., 33 for 33% off)
    /// Only returned for percentage-based discounts
    public var percentageDiscount: Int?
}

/// Discount information returned from the store.
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
/// @see https://openiap.dev/docs/types#subscription-offer
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

/// Standardized one-time product discount offer.
/// Provides a unified interface for one-time purchase discounts across platforms.
/// 
/// Currently supported on Android (Google Play Billing 7.0+).
/// iOS does not support one-time purchase discounts in the same way.
/// 
/// @see https://openiap.dev/docs/features/discount
public struct DiscountOffer: Codable {
    /// Currency code (ISO 4217, e.g., "USD")
    public var currency: String
    /// [Android] Fixed discount amount in micro-units.
    /// Only present for fixed amount discounts.
    public var discountAmountMicrosAndroid: String?
    /// Formatted display price string (e.g., "$4.99")
    public var displayPrice: String
    /// [Android] Formatted discount amount string (e.g., "$5.00 OFF").
    public var formattedDiscountAmountAndroid: String?
    /// [Android] Original full price in micro-units before discount.
    /// Divide by 1,000,000 to get the actual price.
    /// Use for displaying strikethrough original price.
    public var fullPriceMicrosAndroid: String?
    /// Unique identifier for the offer.
    /// - iOS: Not applicable (one-time discounts not supported)
    /// - Android: offerId from ProductAndroidOneTimePurchaseOfferDetail
    public var id: String?
    /// [Android] Limited quantity information.
    /// Contains maximumQuantity and remainingQuantity.
    public var limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid?
    /// [Android] List of tags associated with this offer.
    public var offerTagsAndroid: [String]?
    /// [Android] Offer token required for purchase.
    /// Must be passed to requestPurchase() when purchasing with this offer.
    public var offerTokenAndroid: String?
    /// [Android] Percentage discount (e.g., 33 for 33% off).
    /// Only present for percentage-based discounts.
    public var percentageDiscountAndroid: Int?
    /// [Android] Pre-order details if this is a pre-order offer.
    /// Available in Google Play Billing Library 8.1.0+
    public var preorderDetailsAndroid: PreorderDetailsAndroid?
    /// Numeric price value
    public var price: Double
    /// [Android] Rental details if this is a rental offer.
    public var rentalDetailsAndroid: RentalDetailsAndroid?
    /// Type of discount offer
    public var type: DiscountOfferType
    /// [Android] Valid time window for the offer.
    /// Contains startTimeMillis and endTimeMillis.
    public var validTimeWindowAndroid: ValidTimeWindowAndroid?
}

/// iOS DiscountOffer (output type).
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
/// @see https://openiap.dev/docs/types#subscription-offer
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
/// @deprecated Use BillingProgramAvailabilityResultAndroid with isBillingProgramAvailableAsync instead
/// Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
public struct ExternalOfferAvailabilityResultAndroid: Codable {
    /// Whether external offers are available for the user
    public var isAvailable: Bool
}

/// External offer reporting details (Android)
/// @deprecated Use BillingProgramReportingDetailsAndroid with createBillingProgramReportingDetailsAsync instead
/// Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0
public struct ExternalOfferReportingDetailsAndroid: Codable {
    /// External transaction token for reporting external offer transactions
    public var externalTransactionToken: String
}

/// Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).
public struct ExternalPurchaseCustomLinkNoticeResultIOS: Codable {
    /// Whether the user chose to continue to external purchase
    public var continued: Bool
    /// Optional error message if the presentation failed
    public var error: String?
}

/// Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).
public struct ExternalPurchaseCustomLinkTokenResultIOS: Codable {
    /// Optional error message if token retrieval failed
    public var error: String?
    /// The external purchase token string.
    /// Report this token to Apple's External Purchase Server API.
    public var token: String?
}

/// Result of presenting an external purchase link
public struct ExternalPurchaseLinkResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String?
    /// Whether the user completed the external purchase flow
    public var success: Bool
}

/// Result of presenting external purchase notice sheet (iOS 15.4+)
/// Returns the token when user continues to external purchase.
public struct ExternalPurchaseNoticeResultIOS: Codable {
    /// Optional error message if the presentation failed
    public var error: String?
    /// External purchase token returned when user continues (iOS 15.4+).
    /// This token should be reported to Apple's External Purchase Server API.
    /// Only present when result is Continue.
    public var externalPurchaseToken: String?
    /// Notice result indicating user action
    public var result: ExternalPurchaseNoticeAction
}

public enum FetchProductsResult {
    case all([ProductOrSubscription]?)
    case products([Product]?)
    case subscriptions([ProductSubscription]?)
}

/// Limited quantity information for one-time purchase offers (Android)
/// Available in Google Play Billing Library 7.0+
public struct LimitedQuantityInfoAndroid: Codable {
    /// Maximum quantity a user can purchase
    public var maximumQuantity: Int
    /// Remaining quantity the user can still purchase
    public var remainingQuantity: Int
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
    public var debugDescription: String?
    public var description: String
    /// Standardized discount offers for one-time products.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types#discount-offer
    public var discountOffers: [DiscountOffer]?
    public var displayName: String?
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    /// One-time purchase offer details including discounts (Android)
    /// Returns all eligible offers. Available in Google Play Billing Library 7.0+
    /// @deprecated Use discountOffers instead for cross-platform compatibility.
    public var oneTimePurchaseOfferDetailsAndroid: [ProductAndroidOneTimePurchaseOfferDetail]?
    public var platform: IapPlatform = .android
    public var price: Double?
    /// Product-level status code indicating fetch result (Android 8.0+)
    /// OK = product fetched successfully
    /// NOT_FOUND = SKU doesn't exist
    /// NO_OFFERS_AVAILABLE = user not eligible for any offers
    /// Available in Google Play Billing Library 8.0.0+
    public var productStatusAndroid: ProductStatusAndroid?
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility.
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]?
    /// Standardized subscription offers.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types#subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]?
    public var title: String
    public var type: ProductType = .inApp
}

/// One-time purchase offer details (Android).
/// Available in Google Play Billing Library 7.0+
/// @deprecated Use the standardized DiscountOffer type instead for cross-platform compatibility.
/// @see https://openiap.dev/docs/types#discount-offer
public struct ProductAndroidOneTimePurchaseOfferDetail: Codable {
    /// Discount display information
    /// Only available for discounted offers
    public var discountDisplayInfo: DiscountDisplayInfoAndroid?
    public var formattedPrice: String
    /// Full (non-discounted) price in micro-units
    /// Only available for discounted offers
    public var fullPriceMicros: String?
    /// Limited quantity information
    public var limitedQuantityInfo: LimitedQuantityInfoAndroid?
    /// Offer ID
    public var offerId: String?
    /// List of offer tags
    public var offerTags: [String]
    /// Offer token for use in BillingFlowParams when purchasing
    public var offerToken: String
    /// Pre-order details for products available for pre-order
    /// Available in Google Play Billing Library 8.1.0+
    public var preorderDetailsAndroid: PreorderDetailsAndroid?
    public var priceAmountMicros: String
    public var priceCurrencyCode: String
    /// Rental details for rental offers
    public var rentalDetailsAndroid: RentalDetailsAndroid?
    /// Valid time window for the offer
    public var validTimeWindow: ValidTimeWindowAndroid?
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
    public var platform: IapPlatform = .ios
    public var price: Double?
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility.
    public var subscriptionInfoIOS: SubscriptionInfoIOS?
    /// Standardized subscription offers.
    /// Cross-platform type with iOS-specific fields using suffix.
    /// Note: iOS does not support one-time product discounts.
    /// @see https://openiap.dev/docs/types#subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]?
    public var title: String
    public var type: ProductType = .inApp
    public var typeIOS: ProductTypeIOS
}

public struct ProductSubscriptionAndroid: Codable, ProductCommon {
    public var currency: String
    public var debugDescription: String?
    public var description: String
    /// Standardized discount offers for one-time products.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types#discount-offer
    public var discountOffers: [DiscountOffer]?
    public var displayName: String?
    public var displayPrice: String
    public var id: String
    public var nameAndroid: String
    /// One-time purchase offer details including discounts (Android)
    /// Returns all eligible offers. Available in Google Play Billing Library 7.0+
    /// @deprecated Use discountOffers instead for cross-platform compatibility.
    public var oneTimePurchaseOfferDetailsAndroid: [ProductAndroidOneTimePurchaseOfferDetail]?
    public var platform: IapPlatform = .android
    public var price: Double?
    /// Product-level status code indicating fetch result (Android 8.0+)
    /// OK = product fetched successfully
    /// NOT_FOUND = SKU doesn't exist
    /// NO_OFFERS_AVAILABLE = user not eligible for any offers
    /// Available in Google Play Billing Library 8.0.0+
    public var productStatusAndroid: ProductStatusAndroid?
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility.
    public var subscriptionOfferDetailsAndroid: [ProductSubscriptionAndroidOfferDetails]
    /// Standardized subscription offers.
    /// Cross-platform type with Android-specific fields using suffix.
    /// @see https://openiap.dev/docs/types#subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]
    public var title: String
    public var type: ProductType = .subs
}

/// Subscription offer details (Android).
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
/// @see https://openiap.dev/docs/types#subscription-offer
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
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility.
    public var discountsIOS: [DiscountIOS]?
    public var displayName: String?
    public var displayNameIOS: String
    public var displayPrice: String
    public var id: String
    public var introductoryPriceAsAmountIOS: String?
    public var introductoryPriceIOS: String?
    public var introductoryPriceNumberOfPeriodsIOS: String?
    public var introductoryPricePaymentModeIOS: PaymentModeIOS
    public var introductoryPriceSubscriptionPeriodIOS: SubscriptionPeriodIOS?
    public var isFamilyShareableIOS: Bool
    public var jsonRepresentationIOS: String
    public var platform: IapPlatform = .ios
    public var price: Double?
    /// @deprecated Use subscriptionOffers instead for cross-platform compatibility.
    public var subscriptionInfoIOS: SubscriptionInfoIOS?
    /// Standardized subscription offers.
    /// Cross-platform type with iOS-specific fields using suffix.
    /// @see https://openiap.dev/docs/types#subscription-offer
    public var subscriptionOffers: [SubscriptionOffer]?
    public var subscriptionPeriodNumberIOS: String?
    public var subscriptionPeriodUnitIOS: SubscriptionPeriodIOS?
    public var title: String
    public var type: ProductType = .subs
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
    /// Whether the subscription is suspended (Android)
    /// A suspended subscription means the user's payment method failed and they need to fix it.
    /// Users should be directed to the subscription center to resolve the issue.
    /// Do NOT grant entitlements for suspended subscriptions.
    /// Available in Google Play Billing Library 8.1.0+
    public var isSuspendedAndroid: Bool?
    public var obfuscatedAccountIdAndroid: String?
    public var obfuscatedProfileIdAndroid: String?
    public var packageNameAndroid: String?
    public var platform: IapPlatform
    public var productId: String
    public var purchaseState: PurchaseState
    public var purchaseToken: String?
    public var quantity: Int
    public var signatureAndroid: String?
    /// Store where purchase was made
    public var store: IapStore
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
    /// Store where purchase was made
    public var store: IapStore
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

/// Rental details for one-time purchase products that can be rented (Android)
/// Available in Google Play Billing Library 7.0+
public struct RentalDetailsAndroid: Codable {
    /// Rental expiration period in ISO 8601 format
    /// Time after rental period ends when user can still extend
    public var rentalExpirationPeriod: String?
    /// Rental period in ISO 8601 format (e.g., P7D for 7 days)
    public var rentalPeriod: String
}

public enum RequestPurchaseResult {
    case purchase(Purchase?)
    case purchases([Purchase]?)
}

public struct RequestVerifyPurchaseWithIapkitResult: Codable {
    /// Whether the purchase is valid (not falsified).
    public var isValid: Bool
    /// The current state of the purchase.
    public var state: IapkitPurchaseState
    public var store: IapStore
}

public struct SubscriptionInfoIOS: Codable {
    public var introductoryOffer: SubscriptionOfferIOS?
    public var promotionalOffers: [SubscriptionOfferIOS]?
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
/// @see https://openiap.dev/docs/types/ios#discount-offer
/// @see https://openiap.dev/docs/types/android#subscription-offer
public struct SubscriptionOffer: Codable {
    /// [Android] Base plan identifier.
    /// Identifies which base plan this offer belongs to.
    public var basePlanIdAndroid: String?
    /// Currency code (ISO 4217, e.g., "USD")
    public var currency: String?
    /// Formatted display price string (e.g., "$9.99/month")
    public var displayPrice: String
    /// Unique identifier for the offer.
    /// - iOS: Discount identifier from App Store Connect
    /// - Android: offerId from ProductSubscriptionAndroidOfferDetails
    public var id: String
    /// [iOS] Key identifier for signature validation.
    /// Used with server-side signature generation for promotional offers.
    public var keyIdentifierIOS: String?
    /// [iOS] Localized price string.
    public var localizedPriceIOS: String?
    /// [iOS] Cryptographic nonce (UUID) for signature validation.
    /// Must be generated server-side for each purchase attempt.
    public var nonceIOS: String?
    /// [iOS] Number of billing periods for this discount.
    public var numberOfPeriodsIOS: Int?
    /// [Android] List of tags associated with this offer.
    public var offerTagsAndroid: [String]?
    /// [Android] Offer token required for purchase.
    /// Must be passed to requestPurchase() when purchasing with this offer.
    public var offerTokenAndroid: String?
    /// Payment mode during the offer period
    public var paymentMode: PaymentMode?
    /// Subscription period for this offer
    public var period: SubscriptionPeriod?
    /// Number of periods the offer applies
    public var periodCount: Int?
    /// Numeric price value
    public var price: Double
    /// [Android] Pricing phases for this subscription offer.
    /// Contains detailed pricing information for each phase (trial, intro, regular).
    public var pricingPhasesAndroid: PricingPhasesAndroid?
    /// [iOS] Server-generated signature for promotional offer validation.
    /// Required when applying promotional offers on iOS.
    public var signatureIOS: String?
    /// [iOS] Timestamp when the signature was generated.
    /// Used for signature validation.
    public var timestampIOS: Double?
    /// Type of subscription offer (Introductory or Promotional)
    public var type: DiscountOfferType
}

/// iOS subscription offer details.
/// @deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.
/// @see https://openiap.dev/docs/types#subscription-offer
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

/// Valid time window for when an offer is available (Android)
/// Available in Google Play Billing Library 7.0+
public struct ValidTimeWindowAndroid: Codable {
    /// End time in milliseconds since epoch
    public var endTimeMillis: String
    /// Start time in milliseconds since epoch
    public var startTimeMillis: String
}

public struct VerifyPurchaseResultAndroid: Codable {
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

/// Result from Meta Horizon verify_entitlement API.
/// Returns verification status and grant time for the entitlement.
public struct VerifyPurchaseResultHorizon: Codable {
    /// Unix timestamp (seconds) when the entitlement was granted.
    public var grantTime: Double?
    /// Whether the entitlement verification succeeded.
    public var success: Bool
}

public struct VerifyPurchaseResultIOS: Codable {
    /// Whether the receipt is valid
    public var isValid: Bool
    /// JWS representation
    public var jwsRepresentation: String
    /// Latest transaction if available
    public var latestTransaction: Purchase?
    /// Receipt data string
    public var receiptData: String
}

public struct VerifyPurchaseWithProviderError: Codable {
    public var code: String?
    public var message: String
}

public struct VerifyPurchaseWithProviderResult: Codable {
    /// Error details if verification failed
    public var errors: [VerifyPurchaseWithProviderError]?
    /// IAPKit verification result
    public var iapkit: RequestVerifyPurchaseWithIapkitResult?
    public var provider: PurchaseVerificationProvider
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

/// Parameters for developer billing option in purchase flow (Android)
/// Used with BillingFlowParams to enable external payments flow
/// Available in Google Play Billing Library 8.3.0+
public struct DeveloperBillingOptionParamsAndroid: Codable {
    /// The billing program (should be EXTERNAL_PAYMENTS for external payments flow)
    public var billingProgram: BillingProgramAndroid
    /// The launch mode for the external payment link
    public var launchMode: DeveloperBillingLaunchModeAndroid
    /// The URI where the external payment will be processed
    public var linkUri: String

    public init(
        billingProgram: BillingProgramAndroid,
        launchMode: DeveloperBillingLaunchModeAndroid,
        linkUri: String
    ) {
        self.billingProgram = billingProgram
        self.launchMode = launchMode
        self.linkUri = linkUri
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
    /// @deprecated Use enableBillingProgramAndroid instead.
    /// Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.
    public var alternativeBillingModeAndroid: AlternativeBillingModeAndroid?
    /// Enable a specific billing program for Android (7.0+)
    /// When set, enables the specified billing program for external transactions.
    /// - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)
    /// - EXTERNAL_CONTENT_LINK: Link to external content (8.2.0+)
    /// - EXTERNAL_OFFER: External offers for digital content (8.2.0+)
    /// - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)
    public var enableBillingProgramAndroid: BillingProgramAndroid?

    public init(
        alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = nil,
        enableBillingProgramAndroid: BillingProgramAndroid? = nil
    ) {
        self.alternativeBillingModeAndroid = alternativeBillingModeAndroid
        self.enableBillingProgramAndroid = enableBillingProgramAndroid
    }
}

/// Parameters for launching an external link (Android)
/// Used with launchExternalLink to initiate external offer or app install flows
/// Available in Google Play Billing Library 8.2.0+
public struct LaunchExternalLinkParamsAndroid: Codable {
    /// The billing program (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)
    public var billingProgram: BillingProgramAndroid
    /// The external link launch mode
    public var launchMode: ExternalLinkLaunchModeAndroid
    /// The type of the external link
    public var linkType: ExternalLinkTypeAndroid
    /// The URI where the content will be accessed from
    public var linkUri: String

    public init(
        billingProgram: BillingProgramAndroid,
        launchMode: ExternalLinkLaunchModeAndroid,
        linkType: ExternalLinkTypeAndroid,
        linkUri: String
    ) {
        self.billingProgram = billingProgram
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
        type: ProductQueryType? = nil
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

public struct RequestPurchaseAndroidProps: Codable {
    /// Developer billing option parameters for external payments flow (8.3.0+).
    /// When provided, the purchase flow will show a side-by-side choice between
    /// Google Play Billing and the developer's external payment option.
    public var developerBillingOption: DeveloperBillingOptionParamsAndroid?
    /// Personalized offer flag.
    /// When true, indicates the price was customized for this user.
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountId: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileId: String?
    /// Offer token for one-time purchase discounts (7.0+).
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

/// Platform-specific purchase request parameters.
/// 
/// Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
/// - apple: Always targets App Store
/// - google: Targets Play Store by default, or Horizon when built with horizon flavor
///   (determined at build time, not runtime)
public struct RequestPurchasePropsByPlatforms: Codable {
    /// @deprecated Use google instead
    public var android: RequestPurchaseAndroidProps?
    /// Apple-specific purchase parameters
    public var apple: RequestPurchaseIosProps?
    /// Google-specific purchase parameters
    public var google: RequestPurchaseAndroidProps?
    /// @deprecated Use apple instead
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
    /// Developer billing option parameters for external payments flow (8.3.0+).
    /// When provided, the purchase flow will show a side-by-side choice between
    /// Google Play Billing and the developer's external payment option.
    public var developerBillingOption: DeveloperBillingOptionParamsAndroid?
    /// Personalized offer flag.
    /// When true, indicates the price was customized for this user.
    public var isOfferPersonalized: Bool?
    /// Obfuscated account ID
    public var obfuscatedAccountId: String?
    /// Obfuscated profile ID
    public var obfuscatedProfileId: String?
    /// Purchase token for upgrades/downgrades
    public var purchaseToken: String?
    /// Replacement mode for subscription changes
    /// @deprecated Use subscriptionProductReplacementParams instead for item-level replacement (8.1.0+)
    public var replacementMode: Int?
    /// List of subscription SKUs
    public var skus: [String]
    /// Subscription offers
    public var subscriptionOffers: [AndroidSubscriptionOfferInput]?
    /// Product-level replacement parameters (8.1.0+)
    /// Use this instead of replacementMode for item-level replacement
    public var subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?

    public init(
        developerBillingOption: DeveloperBillingOptionParamsAndroid? = nil,
        isOfferPersonalized: Bool? = nil,
        obfuscatedAccountId: String? = nil,
        obfuscatedProfileId: String? = nil,
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
    /// Override introductory offer eligibility (iOS 15+, WWDC 2025).
    /// Set to true to indicate the user is eligible for introductory offer,
    /// or false to indicate they are not. When nil, the system determines eligibility.
    /// Back-deployed to iOS 15.
    public var introductoryOfferEligibility: Bool?
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
        introductoryOfferEligibility: Bool? = nil,
        promotionalOfferJWS: PromotionalOfferJWSInputIOS? = nil,
        quantity: Int? = nil,
        sku: String,
        winBackOffer: WinBackOfferInputIOS? = nil,
        withOffer: DiscountOfferInputIOS? = nil
    ) {
        self.advancedCommerceData = advancedCommerceData
        self.andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically
        self.appAccountToken = appAccountToken
        self.introductoryOfferEligibility = introductoryOfferEligibility
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
/// - google: Targets Play Store by default, or Horizon when built with horizon flavor
///   (determined at build time, not runtime)
public struct RequestSubscriptionPropsByPlatforms: Codable {
    /// @deprecated Use google instead
    public var android: RequestSubscriptionAndroidProps?
    /// Apple-specific subscription parameters
    public var apple: RequestSubscriptionIosProps?
    /// Google-specific subscription parameters
    public var google: RequestSubscriptionAndroidProps?
    /// @deprecated Use apple instead
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
public struct RequestVerifyPurchaseWithIapkitProps: Codable {
    /// API key used for the Authorization header (Bearer {apiKey}).
    public var apiKey: String?
    /// Apple App Store verification parameters.
    public var apple: RequestVerifyPurchaseWithIapkitAppleProps?
    /// Google Play Store verification parameters.
    public var google: RequestVerifyPurchaseWithIapkitGoogleProps?

    public init(
        apiKey: String? = nil,
        apple: RequestVerifyPurchaseWithIapkitAppleProps? = nil,
        google: RequestVerifyPurchaseWithIapkitGoogleProps? = nil
    ) {
        self.apiKey = apiKey
        self.apple = apple
        self.google = google
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
    /// Create reporting details for a billing program
    /// Replaces the deprecated createExternalOfferReportingDetailsAsync API
    /// 
    /// Available in Google Play Billing Library 8.2.0+
    /// Returns external transaction token needed for reporting external transactions
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func createBillingProgramReportingDetailsAndroid(_ program: BillingProgramAndroid) async throws -> BillingProgramReportingDetailsAndroid
    /// Open the native subscription management surface
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void
    /// Close the platform billing connection
    func endConnection() async throws -> Bool
    /// Finish a transaction after validating receipts
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void
    /// Establish the platform billing connection
    func initConnection(_ config: InitConnectionConfig?) async throws -> Bool
    /// Check if a billing program is available for the current user
    /// Replaces the deprecated isExternalOfferAvailableAsync API
    /// 
    /// Available in Google Play Billing Library 8.2.0+
    /// Returns availability result with isAvailable flag
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func isBillingProgramAvailableAndroid(_ program: BillingProgramAndroid) async throws -> BillingProgramAvailabilityResultAndroid
    /// Launch external link flow for external billing programs
    /// Replaces the deprecated showExternalOfferInformationDialog API
    /// 
    /// Available in Google Play Billing Library 8.2.0+
    /// Shows Play Store dialog and optionally launches external URL
    /// Throws OpenIapError.NotPrepared if billing client not ready
    func launchExternalLinkAndroid(_ params: LaunchExternalLinkParamsAndroid) async throws -> Bool
    /// Present the App Store code redemption sheet
    func presentCodeRedemptionSheetIOS() async throws -> Bool
    /// Present external purchase custom link with StoreKit UI
    func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS
    /// Present external purchase notice sheet (iOS 15.4+).
    /// Uses ExternalPurchase.presentNoticeSheet() which returns a token when user continues.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
    func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS
    /// Initiate a purchase flow; rely on events for final state
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
    /// Purchase the promoted product surfaced by the App Store.
    /// 
    /// @deprecated Use promotedProductListenerIOS to receive the productId,
    /// then call requestPurchase with that SKU instead. In StoreKit 2,
    /// promoted products can be purchased directly via the standard purchase flow.
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
    /// Show ExternalPurchaseCustomLink notice sheet (iOS 18.1+).
    /// Displays the system disclosure notice sheet for custom external purchase links.
    /// Call this after a deliberate customer interaction before linking out to external purchases.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
    func showExternalPurchaseCustomLinkNoticeIOS(_ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS
    /// Open subscription management UI and return changed purchases (iOS 15+)
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS]
    /// Force a StoreKit sync for transactions (iOS 15+)
    func syncIOS() async throws -> Bool
    /// Validate purchase receipts with the configured providers
    func validateReceipt(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    /// Verify purchases with the configured providers
    func verifyPurchase(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    /// Verify purchases with a specific provider (e.g., IAPKit)
    func verifyPurchaseWithProvider(_ options: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult
}

/// GraphQL root query operations.
public protocol QueryResolver {
    /// Check if external purchase notice sheet can be presented (iOS 17.4+)
    /// Uses ExternalPurchase.canPresent
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
    /// Get external purchase token for reporting to Apple (iOS 18.1+).
    /// Use this token with Apple's External Purchase Server API to report transactions.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
    func getExternalPurchaseCustomLinkTokenIOS(_ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) async throws -> ExternalPurchaseCustomLinkTokenResultIOS
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
    /// Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
    /// Returns true if the app can use custom external purchase links.
    /// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
    func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool
    /// Check introductory offer eligibility for a subscription group
    func isEligibleForIntroOfferIOS(_ groupID: String) async throws -> Bool
    /// Verify a StoreKit 2 transaction signature
    func isTransactionVerifiedIOS(_ sku: String) async throws -> Bool
    /// Get the latest transaction for a product using StoreKit 2
    func latestTransactionIOS(_ sku: String) async throws -> PurchaseIOS?
    /// Get StoreKit 2 subscription status details (iOS 15+)
    func subscriptionStatusIOS(_ sku: String) async throws -> [SubscriptionStatusIOS]
    /// Validate a receipt for a specific product
    func validateReceiptIOS(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS
}

/// GraphQL root subscription operations.
public protocol SubscriptionResolver {
    /// Fires when a user selects developer billing in the External Payments flow (Android only)
    /// Triggered when the user chooses to pay via the developer's external payment option
    /// instead of Google Play Billing in the side-by-side choice dialog.
    /// Contains the externalTransactionToken needed to report the transaction.
    /// Available in Google Play Billing Library 8.3.0+
    func developerProvidedBillingAndroid() async throws -> DeveloperProvidedBillingDetailsAndroid
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
public typealias MutationCreateBillingProgramReportingDetailsAndroidHandler = (_ program: BillingProgramAndroid) async throws -> BillingProgramReportingDetailsAndroid
public typealias MutationDeepLinkToSubscriptionsHandler = (_ options: DeepLinkOptions?) async throws -> Void
public typealias MutationEndConnectionHandler = () async throws -> Bool
public typealias MutationFinishTransactionHandler = (_ purchase: PurchaseInput, _ isConsumable: Bool?) async throws -> Void
public typealias MutationInitConnectionHandler = (_ config: InitConnectionConfig?) async throws -> Bool
public typealias MutationIsBillingProgramAvailableAndroidHandler = (_ program: BillingProgramAndroid) async throws -> BillingProgramAvailabilityResultAndroid
public typealias MutationLaunchExternalLinkAndroidHandler = (_ params: LaunchExternalLinkParamsAndroid) async throws -> Bool
public typealias MutationPresentCodeRedemptionSheetIOSHandler = () async throws -> Bool
public typealias MutationPresentExternalPurchaseLinkIOSHandler = (_ url: String) async throws -> ExternalPurchaseLinkResultIOS
public typealias MutationPresentExternalPurchaseNoticeSheetIOSHandler = () async throws -> ExternalPurchaseNoticeResultIOS
public typealias MutationRequestPurchaseHandler = (_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
public typealias MutationRequestPurchaseOnPromotedProductIOSHandler = () async throws -> Bool
public typealias MutationRestorePurchasesHandler = () async throws -> Void
public typealias MutationShowAlternativeBillingDialogAndroidHandler = () async throws -> Bool
public typealias MutationShowExternalPurchaseCustomLinkNoticeIOSHandler = (_ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS
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
    public var presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler?
    public var presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler?
    public var presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler?
    public var requestPurchase: MutationRequestPurchaseHandler?
    public var requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler?
    public var restorePurchases: MutationRestorePurchasesHandler?
    public var showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler?
    public var showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIOSHandler?
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
        presentCodeRedemptionSheetIOS: MutationPresentCodeRedemptionSheetIOSHandler? = nil,
        presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIOSHandler? = nil,
        presentExternalPurchaseNoticeSheetIOS: MutationPresentExternalPurchaseNoticeSheetIOSHandler? = nil,
        requestPurchase: MutationRequestPurchaseHandler? = nil,
        requestPurchaseOnPromotedProductIOS: MutationRequestPurchaseOnPromotedProductIOSHandler? = nil,
        restorePurchases: MutationRestorePurchasesHandler? = nil,
        showAlternativeBillingDialogAndroid: MutationShowAlternativeBillingDialogAndroidHandler? = nil,
        showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIOSHandler? = nil,
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
        self.presentCodeRedemptionSheetIOS = presentCodeRedemptionSheetIOS
        self.presentExternalPurchaseLinkIOS = presentExternalPurchaseLinkIOS
        self.presentExternalPurchaseNoticeSheetIOS = presentExternalPurchaseNoticeSheetIOS
        self.requestPurchase = requestPurchase
        self.requestPurchaseOnPromotedProductIOS = requestPurchaseOnPromotedProductIOS
        self.restorePurchases = restorePurchases
        self.showAlternativeBillingDialogAndroid = showAlternativeBillingDialogAndroid
        self.showExternalPurchaseCustomLinkNoticeIOS = showExternalPurchaseCustomLinkNoticeIOS
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
public typealias QueryGetAppTransactionIOSHandler = () async throws -> AppTransaction?
public typealias QueryGetAvailablePurchasesHandler = (_ options: PurchaseOptions?) async throws -> [Purchase]
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
    public var getAppTransactionIOS: QueryGetAppTransactionIOSHandler?
    public var getAvailablePurchases: QueryGetAvailablePurchasesHandler?
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
        getAppTransactionIOS: QueryGetAppTransactionIOSHandler? = nil,
        getAvailablePurchases: QueryGetAvailablePurchasesHandler? = nil,
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
        self.getAppTransactionIOS = getAppTransactionIOS
        self.getAvailablePurchases = getAvailablePurchases
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
public typealias SubscriptionPurchaseUpdatedHandler = () async throws -> Purchase
public typealias SubscriptionUserChoiceBillingAndroidHandler = () async throws -> UserChoiceBillingDetails

public struct SubscriptionHandlers {
    public var developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler?
    public var promotedProductIOS: SubscriptionPromotedProductIOSHandler?
    public var purchaseError: SubscriptionPurchaseErrorHandler?
    public var purchaseUpdated: SubscriptionPurchaseUpdatedHandler?
    public var userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler?

    public init(
        developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler? = nil,
        promotedProductIOS: SubscriptionPromotedProductIOSHandler? = nil,
        purchaseError: SubscriptionPurchaseErrorHandler? = nil,
        purchaseUpdated: SubscriptionPurchaseUpdatedHandler? = nil,
        userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler? = nil
    ) {
        self.developerProvidedBillingAndroid = developerProvidedBillingAndroid
        self.promotedProductIOS = promotedProductIOS
        self.purchaseError = purchaseError
        self.purchaseUpdated = purchaseUpdated
        self.userChoiceBillingAndroid = userChoiceBillingAndroid
    }
}
