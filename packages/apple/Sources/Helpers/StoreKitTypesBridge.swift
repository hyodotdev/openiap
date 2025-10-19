import Foundation
import StoreKit

@available(iOS 15.0, macOS 14.0, *)
enum StoreKitTypesBridge {
    static func product(from product: StoreKit.Product) async -> Product {
        .productIos(await productIOS(from: product))
    }

    static func productSubscription(from product: StoreKit.Product) async -> ProductSubscription? {
        guard let subscription = await productSubscriptionIOS(from: product) else { return nil }
        return .productSubscriptionIos(subscription)
    }

    static func productIOS(from product: StoreKit.Product) async -> ProductIOS {
        ProductIOS(
            currency: product.priceFormatStyle.currencyCode,
            debugDescription: product.description,
            description: product.description,
            displayName: product.displayName,
            displayNameIOS: product.displayName,
            displayPrice: product.displayPrice,
            id: product.id,
            isFamilyShareableIOS: product.isFamilyShareable,
            jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
            platform: .ios,
            price: NSDecimalNumber(decimal: product.price).doubleValue,
            subscriptionInfoIOS: makeSubscriptionInfo(from: product.subscription),
            title: product.displayName,
            type: productType(from: product.type),
            typeIOS: productTypeIOS(from: product.type)
        )
    }

    static func productSubscriptionIOS(from product: StoreKit.Product) async -> ProductSubscriptionIOS? {
        guard let subscription = product.subscription else { return nil }

        // Get introductory offer payment mode
        // If introductoryOffer is nil but there are discounts, use the first introductory discount's payment mode
        let introPaymentMode: PaymentModeIOS? = {
            if let offer = subscription.introductoryOffer {
                return offer.paymentMode.paymentModeIOS
            }
            // Fallback: check if there's an introductory discount in the discounts array
            // This handles edge cases where introductoryOffer might be nil but discounts exist
            let discounts = makeDiscounts(from: subscription)
            return discounts?.first(where: { $0.type == "introductory" })?.paymentMode
        }()

        return ProductSubscriptionIOS(
            currency: product.priceFormatStyle.currencyCode,
            debugDescription: product.description,
            description: product.description,
            discountsIOS: makeDiscounts(from: subscription),
            displayName: product.displayName,
            displayNameIOS: product.displayName,
            displayPrice: product.displayPrice,
            id: product.id,
            introductoryPriceAsAmountIOS: introductoryPriceAmount(from: subscription.introductoryOffer),
            introductoryPriceIOS: subscription.introductoryOffer?.displayPrice,
            introductoryPriceNumberOfPeriodsIOS: introductoryPeriods(from: subscription.introductoryOffer),
            introductoryPricePaymentModeIOS: introPaymentMode,
            introductoryPriceSubscriptionPeriodIOS: subscription.introductoryOffer?.period.unit.subscriptionPeriodIOS,
            isFamilyShareableIOS: product.isFamilyShareable,
            jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
            platform: .ios,
            price: NSDecimalNumber(decimal: product.price).doubleValue,
            subscriptionInfoIOS: makeSubscriptionInfo(from: product.subscription),
            subscriptionPeriodNumberIOS: String(subscription.subscriptionPeriod.value),
            subscriptionPeriodUnitIOS: subscription.subscriptionPeriod.unit.subscriptionPeriodIOS,
            title: product.displayName,
            type: .subs,
            typeIOS: productTypeIOS(from: product.type)
        )
    }

    static func purchase(from transaction: StoreKit.Transaction, jwsRepresentation: String?) async -> Purchase {
        .purchaseIos(await purchaseIOS(from: transaction, jwsRepresentation: jwsRepresentation))
    }

    static func purchaseIOS(from transaction: StoreKit.Transaction, jwsRepresentation: String?) async -> PurchaseIOS {
        let transactionId = String(transaction.id)
        let purchaseState: PurchaseState = .purchased
        let expirationDate = transaction.expirationDate?.milliseconds
        let revocationDate = transaction.revocationDate?.milliseconds
        let renewalInfoIOS = await subscriptionRenewalInfoIOS(for: transaction)
        // Default to false if renewalInfo unavailable - safer to underreport than falsely claim auto-renewal
        let autoRenewing = renewalInfoIOS?.willAutoRenew ?? false
        let environment: String?
        if #available(iOS 16.0, *) {
            environment = transaction.environment.rawValue
        } else {
            environment = nil
        }
        let offerInfo: PurchaseOfferIOS?
        if #available(iOS 17.2, macOS 14.2, *) {
            offerInfo = makePurchaseOffer(from: transaction.offer)
        } else {
            offerInfo = nil
        }

        let ownershipDescription = ownershipTypeDescription(from: transaction.ownershipType)
        let reasonDetails = transactionReasonDetails(from: transaction)

        return PurchaseIOS(
            appAccountToken: transaction.appAccountToken?.uuidString,
            appBundleIdIOS: transaction.appBundleID,
            countryCodeIOS: {
                if #available(iOS 17.0, *) {
                    transaction.storefront.countryCode
                } else {
                    transaction.storefrontCountryCode
                }
            }(),
            currencyCodeIOS: nil,
            currencySymbolIOS: nil,
            environmentIOS: environment,
            expirationDateIOS: expirationDate,
            id: transactionId,
            ids: nil,
            isAutoRenewing: autoRenewing,
            isUpgradedIOS: transaction.isUpgraded,
            offerIOS: offerInfo,
            originalTransactionDateIOS: transaction.originalPurchaseDate.milliseconds,
            originalTransactionIdentifierIOS: transaction.originalID != 0 ? String(transaction.originalID) : nil,
            ownershipTypeIOS: ownershipDescription,
            platform: .ios,
            productId: transaction.productID,
            purchaseState: purchaseState,
            purchaseToken: jwsRepresentation ?? transactionId,
            quantity: transaction.purchasedQuantity,
            quantityIOS: transaction.purchasedQuantity,
            reasonIOS: reasonDetails.lowercased,
            reasonStringRepresentationIOS: reasonDetails.string,
            renewalInfoIOS: renewalInfoIOS,
            revocationDateIOS: revocationDate,
            revocationReasonIOS: transaction.revocationReason?.rawValue.description,
            storefrontCountryCodeIOS: {
                if #available(iOS 17.0, *) {
                    transaction.storefront.countryCode
                } else {
                    transaction.storefrontCountryCode
                }
            }(),
            subscriptionGroupIdIOS: transaction.subscriptionGroupID,
            transactionDate: transaction.purchaseDate.milliseconds,
            transactionId: transactionId,
            transactionReasonIOS: reasonDetails.uppercased,
            webOrderLineItemIdIOS: transaction.webOrderLineItemID.map { String($0) }
        )
    }

    private static func determineAutoRenewStatus(for transaction: StoreKit.Transaction) async -> Bool {
        guard transaction.productType == .autoRenewable else { return false }

        if let resolved = await subscriptionAutoRenewState(for: transaction) {
            return resolved
        }

        return true
    }

    private static func subscriptionAutoRenewState(for transaction: StoreKit.Transaction) async -> Bool? {
        guard let groupId = transaction.subscriptionGroupID else { return nil }

        do {
            let statuses = try await StoreKit.Product.SubscriptionInfo.status(for: groupId)
            for status in statuses {
                guard case .verified(let statusTransaction) = status.transaction else { continue }
                guard statusTransaction.productID == transaction.productID else { continue }

                switch status.renewalInfo {
                case .verified(let info):
                    return info.willAutoRenew
                case .unverified(let info, _):
                    return info.willAutoRenew
                }
            }
        } catch {
            return nil
        }

        return nil
    }

    static func subscriptionRenewalInfoIOS(for transaction: StoreKit.Transaction) async -> RenewalInfoIOS? {
        guard transaction.productType == .autoRenewable else {
            return nil
        }
        guard let groupId = transaction.subscriptionGroupID else {
            return nil
        }

        do {
            let statuses = try await StoreKit.Product.SubscriptionInfo.status(for: groupId)

            // First, try to find exact product match
            var targetStatus: StoreKit.Product.SubscriptionInfo.Status?
            for status in statuses {
                guard case .verified(let statusTransaction) = status.transaction else { continue }

                if statusTransaction.productID == transaction.productID {
                    targetStatus = status
                    break
                }
            }

            // If no exact match, use the first status from the same group
            // This handles cases where a subscription is cancelled but still active
            if targetStatus == nil, let firstStatus = statuses.first {
                targetStatus = firstStatus
            }

            guard let status = targetStatus else {
                return nil
            }

            // Process the found status (exact match or fallback)
            switch status.renewalInfo {
            case .verified(let info):
                    // Only set pendingUpgradeProductId if it's different from current product
                    // autoRenewPreference = product that will renew next
                    // If different from current, it means upgrade/downgrade is pending
                    let currentProductId: String? = {
                        guard case .verified(let txn) = status.transaction else { return nil }
                        return txn.productID
                    }()

                    let pendingProductId: String? = {
                        // If subscription is cancelled, there's no pending change
                        guard info.willAutoRenew else { return nil }
                        guard let current = currentProductId else { return nil }
                        // Only return pendingUpgradeProductId if it's different from current
                        return info.autoRenewPreference != current ? info.autoRenewPreference : nil
                    }()
                    let offerInfo: (id: String?, type: String?)?
                    #if swift(>=6.1)
                    if #available(iOS 18.0, macOS 15.0, *) {
                        // Map type only when present to avoid "nil" literal strings
                        let offerTypeString = info.offer.map { String(describing: $0.type) }
                        offerInfo = (id: info.offer?.id, type: offerTypeString)
                    } else {
                    #endif
                        // Fallback to deprecated properties
                        #if compiler(>=5.9)
                        let offerTypeString = info.offerType.map { String(describing: $0) }
                        offerInfo = (id: info.offerID, type: offerTypeString)
                        #else
                        offerInfo = nil
                        #endif
                    #if swift(>=6.1)
                    }
                    #endif
                    // priceIncreaseStatus only available on iOS 15.0+
                    let priceIncrease: String? = {
                        if #available(iOS 15.0, macOS 12.0, *) {
                            return String(describing: info.priceIncreaseStatus)
                        }
                        return nil
                    }()
                    let renewalInfo = RenewalInfoIOS(
                        autoRenewPreference: info.autoRenewPreference,
                        expirationReason: info.expirationReason?.rawValue.description,
                        gracePeriodExpirationDate: info.gracePeriodExpirationDate?.milliseconds,
                        isInBillingRetry: nil,  // Not available in RenewalInfo, available in Status
                        jsonRepresentation: nil,
                        pendingUpgradeProductId: pendingProductId,
                        priceIncreaseStatus: priceIncrease,
                        renewalDate: info.renewalDate?.milliseconds,
                        renewalOfferId: offerInfo?.id,
                        renewalOfferType: offerInfo?.type,
                        willAutoRenew: info.willAutoRenew
                    )
                    return renewalInfo
                case .unverified(let info, _):
                    // Only set pendingUpgradeProductId if it's different from current product
                    let currentProductId: String? = {
                        guard case .verified(let txn) = status.transaction else { return nil }
                        return txn.productID
                    }()

                    let pendingProductId: String? = {
                        // If subscription is cancelled, there's no pending change
                        guard info.willAutoRenew else { return nil }
                        guard let current = currentProductId else { return nil }
                        return info.autoRenewPreference != current ? info.autoRenewPreference : nil
                    }()
                    let offerInfo: (id: String?, type: String?)?
                    #if swift(>=6.1)
                    if #available(iOS 18.0, macOS 15.0, *) {
                        // Map type only when present to avoid "nil" literal strings
                        let offerTypeString = info.offer.map { String(describing: $0.type) }
                        offerInfo = (id: info.offer?.id, type: offerTypeString)
                    } else {
                    #endif
                        // Fallback to deprecated properties
                        #if compiler(>=5.9)
                        let offerTypeString = info.offerType.map { String(describing: $0) }
                        offerInfo = (id: info.offerID, type: offerTypeString)
                        #else
                        offerInfo = nil
                        #endif
                    #if swift(>=6.1)
                    }
                    #endif
                    // priceIncreaseStatus only available on iOS 15.0+
                    let priceIncrease: String? = {
                        if #available(iOS 15.0, macOS 12.0, *) {
                            return String(describing: info.priceIncreaseStatus)
                        }
                        return nil
                    }()
                    let renewalInfo = RenewalInfoIOS(
                        autoRenewPreference: info.autoRenewPreference,
                        expirationReason: info.expirationReason?.rawValue.description,
                        gracePeriodExpirationDate: info.gracePeriodExpirationDate?.milliseconds,
                        isInBillingRetry: nil,  // Not available in RenewalInfo, available in Status
                        jsonRepresentation: nil,
                        pendingUpgradeProductId: pendingProductId,
                        priceIncreaseStatus: priceIncrease,
                        renewalDate: info.renewalDate?.milliseconds,
                        renewalOfferId: offerInfo?.id,
                        renewalOfferType: offerInfo?.type,
                        willAutoRenew: info.willAutoRenew
                    )
                    return renewalInfo
            }

        } catch {
            OpenIapLog.debug("⚠️ Failed to fetch renewalInfo: \(error.localizedDescription)")
            return nil
        }
    }

    static func purchaseOptions(from props: RequestPurchaseIosProps) throws -> Set<StoreKit.Product.PurchaseOption> {
        var options: Set<StoreKit.Product.PurchaseOption> = []
        if let quantity = props.quantity, quantity > 1 {
            options.insert(.quantity(quantity))
        }
        if let token = props.appAccountToken, let uuid = UUID(uuidString: token) {
            options.insert(.appAccountToken(uuid))
        }
        if let offerInput = props.withOffer {
            guard let option = promotionalOffer(from: offerInput) else {
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "Invalid promotional offer: nonce must be valid UUID and signature must be base64 encoded"
                )
            }
            options.insert(option)
        }
        return options
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension StoreKitTypesBridge {
    static func makeSubscriptionInfo(from info: StoreKit.Product.SubscriptionInfo?) -> SubscriptionInfoIOS? {
        guard let info else { return nil }
        let intro = info.introductoryOffer.map { makeSubscriptionOffer(from: $0, type: .introductory) }
        let promos = makeSubscriptionOffers(from: info.promotionalOffers, type: .promotional)
        return SubscriptionInfoIOS(
            introductoryOffer: intro,
            promotionalOffers: promos.isEmpty ? nil : promos,
            subscriptionGroupId: info.subscriptionGroupID,
            subscriptionPeriod: SubscriptionPeriodValueIOS(
                unit: info.subscriptionPeriod.unit.subscriptionPeriodIOS,
                value: info.subscriptionPeriod.value
            )
        )
    }

    static func makeSubscriptionOffers(from offers: [StoreKit.Product.SubscriptionOffer], type: SubscriptionOfferTypeIOS) -> [SubscriptionOfferIOS] {
        offers.map { makeSubscriptionOffer(from: $0, type: type) }
    }

    static func makeSubscriptionOffer(from offer: StoreKit.Product.SubscriptionOffer, type: SubscriptionOfferTypeIOS) -> SubscriptionOfferIOS {
        SubscriptionOfferIOS(
            displayPrice: offer.displayPrice,
            id: offer.id ?? "",
            paymentMode: offer.paymentMode.paymentModeIOS,
            period: SubscriptionPeriodValueIOS(
                unit: offer.period.unit.subscriptionPeriodIOS,
                value: offer.period.value
            ),
            periodCount: offer.periodCount,
            price: NSDecimalNumber(decimal: offer.price).doubleValue,
            type: type
        )
    }

    static func makeDiscounts(from subscription: StoreKit.Product.SubscriptionInfo) -> [DiscountIOS]? {
        var discounts: [DiscountIOS] = []
        if let intro = subscription.introductoryOffer {
            discounts.append(makeDiscount(from: intro, type: "introductory"))
        }
        let promotional = subscription.promotionalOffers.map { makeDiscount(from: $0, type: "promotional") }
        discounts.append(contentsOf: promotional)
        return discounts.isEmpty ? nil : discounts
    }

    static func makeDiscount(from offer: StoreKit.Product.SubscriptionOffer, type: String) -> DiscountIOS {
        DiscountIOS(
            identifier: offer.id ?? "",
            localizedPrice: offer.displayPrice,
            numberOfPeriods: offer.periodCount,
            paymentMode: offer.paymentMode.paymentModeIOS,
            price: offer.displayPrice,
            priceAmount: NSDecimalNumber(decimal: offer.price).doubleValue,
            subscriptionPeriod: offer.period.iso8601,
            type: type
        )
    }

    static func introductoryPriceAmount(from offer: StoreKit.Product.SubscriptionOffer?) -> String? {
        guard let price = offer?.price else { return nil }
        return String(NSDecimalNumber(decimal: price).doubleValue)
    }

    static func introductoryPeriods(from offer: StoreKit.Product.SubscriptionOffer?) -> String? {
        guard let periodCount = offer?.periodCount else { return nil }
        return String(periodCount)
    }

    static func productType(from type: StoreKit.Product.ProductType) -> ProductType {
        switch type {
        case .autoRenewable, .nonRenewable:
            return .subs
        case .consumable, .nonConsumable:
            return .inApp
        default:
            return .inApp
        }
    }

    static func productTypeIOS(from type: StoreKit.Product.ProductType) -> ProductTypeIOS {
        switch type {
        case .consumable:
            return .consumable
        case .nonConsumable:
            return .nonConsumable
        case .autoRenewable:
            return .autoRenewableSubscription
        case .nonRenewable:
            return .nonRenewingSubscription
        default:
            return .consumable
        }
    }

    static func promotionalOffer(from offer: DiscountOfferInputIOS) -> StoreKit.Product.PurchaseOption? {
        guard let nonce = UUID(uuidString: offer.nonce) else {
            OpenIapLog.error("❌ Invalid nonce format: \(offer.nonce)")
            return nil
        }

        guard let signature = Data(base64Encoded: offer.signature) else {
            OpenIapLog.error("❌ Invalid signature format (must be base64): \(offer.signature)")
            return nil
        }

        let timestamp = Int(offer.timestamp)
        OpenIapLog.debug("✅ Creating promotional offer - ID: \(offer.identifier), KeyID: \(offer.keyIdentifier), Timestamp: \(timestamp)")

        return .promotionalOffer(
            offerID: offer.identifier,
            keyID: offer.keyIdentifier,
            nonce: nonce,
            signature: signature,
            timestamp: timestamp
        )
    }

    @available(iOS 17.2, macOS 14.2, *)
    static func makePurchaseOffer(from offer: StoreKit.Transaction.Offer?) -> PurchaseOfferIOS? {
        guard let offer else { return nil }
        return PurchaseOfferIOS(
            id: offer.id ?? "",
            paymentMode: offer.paymentMode?.rawValue ?? "",
            type: String(describing: offer.type)
        )
    }

    static func ownershipTypeDescription(from ownership: StoreKit.Transaction.OwnershipType) -> String {
        switch ownership {
        case .purchased:
            return "purchased"
        case .familyShared:
            return "family_shared"  // Maintain backward compatibility
        default:
            return "purchased"  // Default to purchased for compatibility
        }
    }

    struct TransactionReason {
        let lowercased: String
        let string: String
        let uppercased: String
    }
    
    struct JSONTransactionReason: Codable {
        let transactionReason: String
    }

    static func transactionReasonDetails(from transaction: StoreKit.Transaction) -> TransactionReason {
        if let revocation = transaction.revocationReason {
            // Map revocation reasons to expected strings
            let reasonString: String
            switch revocation {
            case .developerIssue:
                reasonString = "developer_issue"
            case .other:
                reasonString = "other"
            default:
                reasonString = "unknown"
            }
            return TransactionReason(
                lowercased: reasonString,
                string: reasonString,
                uppercased: reasonString.uppercased()
            )
        }

        if transaction.isUpgraded {
            return TransactionReason(lowercased: "upgrade", string: "upgrade", uppercased: "UPGRADE")
        }

        // Try to infer renewal for iOS <17
        if let decodedReason = try? JSONDecoder().decode(JSONTransactionReason.self, from: transaction.jsonRepresentation),
            decodedReason.transactionReason == "RENEWAL" {
            return TransactionReason(lowercased: "renewal", string: "renewal", uppercased: "RENEWAL")
        }

        return TransactionReason(lowercased: "purchase", string: "purchase", uppercased: "PURCHASE")
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension StoreKit.Product.SubscriptionOffer.PaymentMode {
    var paymentModeIOS: PaymentModeIOS {
        switch self {
        case .freeTrial: return .freeTrial
        case .payAsYouGo: return .payAsYouGo
        case .payUpFront: return .payUpFront
        default: return .empty
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension StoreKit.Product.SubscriptionPeriod.Unit {
    var subscriptionPeriodIOS: SubscriptionPeriodIOS {
        switch self {
        case .day: return .day
        case .week: return .week
        case .month: return .month
        case .year: return .year
        default: return .empty
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension StoreKit.Product.SubscriptionPeriod {
    var iso8601: String { "P\(value)\(unit.isoComponent)" }
}

@available(iOS 15.0, macOS 14.0, *)
private extension StoreKit.Product.SubscriptionPeriod.Unit {
    var isoComponent: String {
        switch self {
        case .day: return "D"
        case .week: return "W"
        case .month: return "M"
        case .year: return "Y"
        default: return "D"
        }
    }
}

extension Date {
    var milliseconds: Double { timeIntervalSince1970 * 1000 }
}
