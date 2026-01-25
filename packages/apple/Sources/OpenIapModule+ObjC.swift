import Foundation
import StoreKit

// MARK: - Objective-C Bridge for Kotlin Multiplatform

@available(iOS 15.0, macOS 14.0, *)
@objc public extension OpenIapModule {

    // MARK: - Connection Management

    @objc func initConnectionWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let result = try await initConnection()
                completion(result, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @objc func endConnectionWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let result = try await endConnection()
                completion(result, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    // MARK: - Product Management

    @objc func fetchProductsWithSkus(
        _ skus: [String],
        type: String?,
        completion: @escaping ([Any]?, Error?) -> Void
    ) {
        Task {
            do {
                let productType = type.flatMap { ProductQueryType(rawValue: $0) }
                let request = ProductRequest(skus: skus, type: productType)
                let result = try await fetchProducts(request)

                switch result {
                case .products(let products):
                    // Extract ProductIOS from Product enum and convert to dictionaries
                    let productIOS = (products ?? []).compactMap { product -> ProductIOS? in
                        guard case let .productIos(value) = product else { return nil }
                        return value
                    }
                    print("[OpenIAP] Fetched \(productIOS.count) products")
                    let dictionaries = productIOS.map { OpenIapSerialization.encode($0) }
                    completion(dictionaries, nil)

                case .subscriptions(let subscriptions):
                    // Extract ProductSubscriptionIOS from ProductSubscription enum and convert to dictionaries
                    let subscriptionIOS = (subscriptions ?? []).compactMap { subscription -> ProductSubscriptionIOS? in
                        guard case let .productSubscriptionIos(value) = subscription else { return nil }
                        return value
                    }
                    print("[OpenIAP] Fetched \(subscriptionIOS.count) subscriptions")
                    let dictionaries = subscriptionIOS.map { OpenIapSerialization.encode($0) }
                    completion(dictionaries, nil)

                case .all(let items):
                    // Extract both products and subscriptions from ProductOrSubscription union
                    let allItems = items ?? []
                    let productIOS = allItems.compactMap { item -> ProductIOS? in
                        guard case .product(let product) = item,
                              case .productIos(let value) = product
                        else { return nil }
                        return value
                    }
                    let subscriptionIOS = allItems.compactMap { item -> ProductSubscriptionIOS? in
                        guard case .productSubscription(.productSubscriptionIos(let value)) = item
                        else { return nil }
                        return value
                    }
                    print("[OpenIAP] Fetched \(productIOS.count) products and \(subscriptionIOS.count) subscriptions")
                    // Combine both into a single array of dictionaries
                    let productDictionaries = productIOS.map { OpenIapSerialization.encode($0) }
                    let subscriptionDictionaries = subscriptionIOS.map { OpenIapSerialization.encode($0) }
                    completion(productDictionaries + subscriptionDictionaries, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func getPromotedProductIOSWithCompletion(_ completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let product = try await getPromotedProductIOS()
                if let productIOS = product {
                    // Convert ProductIOS to dictionary
                    let dictionary = OpenIapSerialization.encode(productIOS)
                    completion(dictionary, nil)
                } else {
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    // MARK: - Purchase Management

    @objc func requestPurchaseWithSku(
        _ sku: String,
        quantity: Int,
        type: String?,
        completion: @escaping (Any?, Error?) -> Void
    ) {
        Task {
            do {
                // For purchase request, type must be .inApp
                let iosProps = RequestPurchaseIosProps(
                    andDangerouslyFinishTransactionAutomatically: nil,
                    appAccountToken: nil,
                    quantity: quantity,
                    sku: sku,
                    withOffer: nil
                )
                let props = RequestPurchaseProps(
                    request: .purchase(
                        RequestPurchasePropsByPlatforms(android: nil, ios: iosProps)
                    ),
                    type: .inApp
                )

                let result = try await requestPurchase(props)

                switch result {
                case .purchase(let purchase):
                    if let purchase = purchase {
                        let dictionary = OpenIapSerialization.purchase(purchase)
                        completion(dictionary, nil)
                    } else {
                        completion(nil, nil)
                    }
                case .purchases(let purchases):
                    if let firstPurchase = purchases?.first {
                        let dictionary = OpenIapSerialization.purchase(firstPurchase)
                        completion(dictionary, nil)
                    } else {
                        completion(nil, nil)
                    }
                case .none:
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func requestSubscriptionWithSku(
        _ sku: String,
        offer: [String: Any]?,
        completion: @escaping (Any?, Error?) -> Void
    ) {
        // Call the full method with nil for new options (backward compatibility)
        requestSubscriptionWithSku(
            sku,
            offer: offer,
            introductoryOfferEligibility: nil,
            promotionalOfferJWS: nil,
            winBackOfferId: nil,
            completion: completion
        )
    }

    /// Extended subscription request with iOS 15+ / iOS 18+ options
    /// - Parameters:
    ///   - sku: The product SKU
    ///   - offer: Legacy promotional offer (DiscountOfferInputIOS)
    ///   - introductoryOfferEligibility: Override introductory offer eligibility (iOS 15+, WWDC 2025)
    ///   - promotionalOfferJWS: JWS promotional offer dict with "offerId" and "jws" keys (iOS 15+, WWDC 2025)
    ///   - winBackOfferId: Win-back offer ID (iOS 18+)
    ///   - completion: Completion handler
    @objc func requestSubscriptionWithSku(
        _ sku: String,
        offer: [String: Any]?,
        introductoryOfferEligibility: NSNumber?,
        promotionalOfferJWS: [String: Any]?,
        winBackOfferId: String?,
        completion: @escaping (Any?, Error?) -> Void
    ) {
        Task {
            do {
                // Parse legacy promotional offer
                let discountOffer: DiscountOfferInputIOS? = if let offer = offer,
                    let identifier = offer["identifier"] as? String,
                    let keyIdentifier = offer["keyIdentifier"] as? String,
                    let nonce = offer["nonce"] as? String,
                    let signature = offer["signature"] as? String,
                    let timestamp = offer["timestamp"] as? Double {
                    DiscountOfferInputIOS(
                        identifier: identifier,
                        keyIdentifier: keyIdentifier,
                        nonce: nonce,
                        signature: signature,
                        timestamp: timestamp
                    )
                } else {
                    nil
                }

                // Parse JWS promotional offer (iOS 15+, WWDC 2025)
                let jwsOffer: PromotionalOfferJWSInputIOS? = if let jwsDict = promotionalOfferJWS,
                    let offerId = jwsDict["offerId"] as? String,
                    let jws = jwsDict["jws"] as? String {
                    PromotionalOfferJWSInputIOS(jws: jws, offerId: offerId)
                } else {
                    nil
                }

                // Parse win-back offer (iOS 18+)
                let winBack: WinBackOfferInputIOS? = if let offerId = winBackOfferId {
                    WinBackOfferInputIOS(offerId: offerId)
                } else {
                    nil
                }

                let iosProps = RequestSubscriptionIosProps(
                    andDangerouslyFinishTransactionAutomatically: nil,
                    appAccountToken: nil,
                    introductoryOfferEligibility: introductoryOfferEligibility?.boolValue,
                    promotionalOfferJWS: jwsOffer,
                    sku: sku,
                    winBackOffer: winBack,
                    withOffer: discountOffer
                )
                let props = RequestPurchaseProps(
                    request: .subscription(
                        RequestSubscriptionPropsByPlatforms(android: nil, ios: iosProps)
                    ),
                    type: .subs
                )

                let result = try await requestPurchase(props)

                switch result {
                case .purchase(let purchase):
                    if let purchase = purchase {
                        let dictionary = OpenIapSerialization.purchase(purchase)
                        completion(dictionary, nil)
                    } else {
                        completion(nil, nil)
                    }
                case .purchases(let purchases):
                    if let firstPurchase = purchases?.first {
                        let dictionary = OpenIapSerialization.purchase(firstPurchase)
                        completion(dictionary, nil)
                    } else {
                        completion(nil, nil)
                    }
                case .none:
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func restorePurchasesWithCompletion(_ completion: @escaping (Error?) -> Void) {
        Task {
            do {
                try await restorePurchases()
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }

    @objc func getAvailablePurchasesWithCompletion(_ completion: @escaping ([Any]?, Error?) -> Void) {
        Task {
            do {
                let purchases = try await getAvailablePurchases(nil)
                let dictionaries = OpenIapSerialization.purchases(purchases)
                completion(dictionaries, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func syncIOSWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let result = try await syncIOS()
                completion(result, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    // MARK: - Transaction Management

    @objc func finishTransactionWithPurchaseId(
        _ purchaseId: String,
        productId: String,
        isConsumable: Bool,
        completion: @escaping (Error?) -> Void
    ) {
        Task {
            do {
                // Try to find the actual transaction from pending transactions
                let pendingTransactions = try await getPendingTransactionsIOS()

                // Use full transaction data if available in pending
                if let purchaseIOS = pendingTransactions.first(where: {
                    $0.transactionId == purchaseId || $0.id == purchaseId
                }) {
                    let purchaseInput = Purchase.purchaseIos(purchaseIOS)
                    try await finishTransaction(purchase: purchaseInput, isConsumable: isConsumable)
                    completion(nil)
                    return
                }

                // Not in pending - finishTransaction will search currentEntitlements
                // Create minimal PurchaseIOS (only purchase.id is used by finishTransaction)
                let minimalPurchase = PurchaseIOS(
                    appAccountToken: nil,
                    appBundleIdIOS: nil,
                    countryCodeIOS: nil,
                    currencyCodeIOS: nil,
                    currencySymbolIOS: nil,
                    currentPlanId: nil,
                    environmentIOS: nil,
                    expirationDateIOS: nil,
                    id: purchaseId,
                    ids: nil,
                    isAutoRenewing: false,
                    isUpgradedIOS: nil,
                    offerIOS: nil,
                    originalTransactionDateIOS: nil,
                    originalTransactionIdentifierIOS: nil,
                    ownershipTypeIOS: nil,
                    platform: .ios,
                    productId: productId,
                    purchaseState: .purchased,
                    purchaseToken: nil,
                    quantity: 1,
                    quantityIOS: nil,
                    reasonIOS: nil,
                    reasonStringRepresentationIOS: nil,
                    revocationDateIOS: nil,
                    revocationReasonIOS: nil,
                    store: .apple,
                    storefrontCountryCodeIOS: nil,
                    subscriptionGroupIdIOS: nil,
                    transactionDate: Date().timeIntervalSince1970,
                    transactionId: purchaseId,
                    transactionReasonIOS: nil,
                    webOrderLineItemIdIOS: nil
                )
                let purchaseInput = Purchase.purchaseIos(minimalPurchase)
                try await finishTransaction(purchase: purchaseInput, isConsumable: isConsumable)
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }

    @objc func getPendingTransactionsIOSWithCompletion(_ completion: @escaping ([Any]?, Error?) -> Void) {
        Task {
            do {
                let transactions = try await getPendingTransactionsIOS()
                // Convert [PurchaseIOS] to dictionaries directly
                let dictionaries = transactions.map { OpenIapSerialization.encode($0) }
                completion(dictionaries, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func clearTransactionIOSWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let result = try await clearTransactionIOS()
                completion(result, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    // MARK: - Validation

    @objc func getReceiptDataIOSWithCompletion(_ completion: @escaping (String?, Error?) -> Void) {
        Task {
            do {
                let receipt = try await getReceiptDataIOS()
                completion(receipt, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func verifyPurchaseWithSku(
        _ sku: String,
        completion: @escaping ([String: Any]?, Error?) -> Void
    ) {
        Task {
            do {
                let props = VerifyPurchaseProps(apple: VerifyPurchaseAppleOptions(sku: sku))
                let result = try await verifyPurchase(props)

                if case let .verifyPurchaseResultIos(iosResult) = result {
                    let dictionary = OpenIapSerialization.encode(iosResult)
                    completion(dictionary, nil)
                } else {
                    let error = PurchaseError(
                        code: .featureNotSupported,
                        message: "verifyPurchase did not return an iOS result"
                    )
                    completion(nil, error)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    /// Verify purchase with external provider (e.g., IAPKit)
    /// - Parameters:
    ///   - provider: The provider name (currently only "iapkit" is supported)
    ///   - apiKey: Optional API key for the provider
    ///   - jws: JWS token from StoreKit 2 purchase (for Apple verification)
    ///   - completion: Callback with verification result dictionary or error
    @objc func verifyPurchaseWithProviderObjC(
        provider: String,
        apiKey: String?,
        jws: String?,
        completion: @escaping ([String: Any]?, Error?) -> Void
    ) {
        Task {
            do {
                guard let providerEnum = PurchaseVerificationProvider(rawValue: provider) else {
                    throw PurchaseError(code: .featureNotSupported, message: "Provider '\(provider)' is not supported")
                }

                var appleProps: RequestVerifyPurchaseWithIapkitAppleProps?
                if let jws = jws, !jws.isEmpty {
                    appleProps = RequestVerifyPurchaseWithIapkitAppleProps(jws: jws)
                }

                let iapkitProps = RequestVerifyPurchaseWithIapkitProps(
                    apiKey: apiKey,
                    apple: appleProps,
                    google: nil
                )

                let props = VerifyPurchaseWithProviderProps(
                    iapkit: iapkitProps,
                    provider: providerEnum
                )

                let result = try await verifyPurchaseWithProvider(props)
                let dictionary = result.iapkit.map { OpenIapSerialization.encode($0) }
                completion(dictionary, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    // MARK: - Store Information

    @objc func getStorefrontIOSWithCompletion(_ completion: @escaping (String?, Error?) -> Void) {
        Task {
            do {
                let storefront = try await getStorefrontIOS()
                completion(storefront, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    // MARK: - Subscription Management

    @objc func getActiveSubscriptionsWithCompletion(_ completion: @escaping ([Any]?, Error?) -> Void) {
        Task {
            do {
                let subscriptions = try await getActiveSubscriptions(nil)
                let dictionaries = subscriptions.map { OpenIapSerialization.encode($0) }
                completion(dictionaries, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func hasActiveSubscriptionsWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let hasActive = try await hasActiveSubscriptions(nil)
                completion(hasActive, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @objc func subscriptionStatusIOSWithSku(_ sku: String, completion: @escaping ([Any]?, Error?) -> Void) {
        Task {
            do {
                let statuses = try await subscriptionStatusIOS(sku: sku)
                let dictionaries = statuses.map { OpenIapSerialization.encode($0) }
                completion(dictionaries, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func currentEntitlementIOSWithSku(_ sku: String, completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let purchase = try await currentEntitlementIOS(sku: sku)
                if let purchaseIOS = purchase {
                    let dictionary = OpenIapSerialization.encode(purchaseIOS)
                    completion(dictionary, nil)
                } else {
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func latestTransactionIOSWithSku(_ sku: String, completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let purchase = try await latestTransactionIOS(sku: sku)
                if let purchaseIOS = purchase {
                    let dictionary = OpenIapSerialization.encode(purchaseIOS)
                    completion(dictionary, nil)
                } else {
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func beginRefundRequestIOSWithSku(_ sku: String, completion: @escaping (String?, Error?) -> Void) {
        Task {
            do {
                let result = try await beginRefundRequestIOS(sku: sku)
                completion(result, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc func isEligibleForIntroOfferIOSWithGroupID(_ groupID: String, completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let isEligible = try await isEligibleForIntroOfferIOS(groupID: groupID)
                completion(isEligible, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @objc func isTransactionVerifiedIOSWithSku(_ sku: String, completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let isVerified = try await isTransactionVerifiedIOS(sku: sku)
                completion(isVerified, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @objc func getTransactionJwsIOSWithSku(_ sku: String, completion: @escaping (String?, Error?) -> Void) {
        Task {
            do {
                let jws = try await getTransactionJwsIOS(sku: sku)
                completion(jws, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @available(iOS 16.0, macOS 14.0, *)
    @objc func getAppTransactionIOSWithCompletion(_ completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let transaction = try await getAppTransactionIOS()
                if let appTransaction = transaction {
                    let dictionary = OpenIapSerialization.encode(appTransaction)
                    completion(dictionary, nil)
                } else {
                    completion(nil, nil)
                }
            } catch {
                completion(nil, error)
            }
        }
    }

    // MARK: - UI

    // tvOS: presentCodeRedemptionSheet is unavailable on tvOS
    // tvOS: showManageSubscriptions requires window scene UI not available on tvOS (subscriptions managed in Settings)
    #if !os(tvOS)
    @objc func presentCodeRedemptionSheetIOSWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let result = try await presentCodeRedemptionSheetIOS()
                completion(result, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @objc func showManageSubscriptionsIOSWithCompletion(_ completion: @escaping ([Any]?, Error?) -> Void) {
        Task {
            do {
                let purchases = try await showManageSubscriptionsIOS()
                // Convert [PurchaseIOS] to dictionaries directly
                let dictionaries = purchases.map { OpenIapSerialization.encode($0) }
                completion(dictionaries, nil)
            } catch {
                completion(nil, error)
            }
        }
    }
    #endif // !os(tvOS)

    @available(iOS 16.0, macOS 14.0, *)
    @objc func presentExternalPurchaseLinkIOSWithUrl(_ url: String, completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let result = try await presentExternalPurchaseLinkIOS(url)
                let dictionary = OpenIapSerialization.encode(result)
                completion(dictionary, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @available(iOS 17.4, macOS 14.4, *)
    @objc func presentExternalPurchaseNoticeSheetIOSWithCompletion(_ completion: @escaping (Any?, Error?) -> Void) {
        Task {
            do {
                let result = try await presentExternalPurchaseNoticeSheetIOS()
                let dictionary = OpenIapSerialization.encode(result)
                completion(dictionary, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @available(iOS 17.4, macOS 14.4, *)
    @objc func canPresentExternalPurchaseNoticeIOSWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let canPresent = try await canPresentExternalPurchaseNoticeIOS()
                completion(canPresent, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    // MARK: - ExternalPurchaseCustomLink (iOS 18.1+)

    @available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *)
    @objc func isEligibleForExternalPurchaseCustomLinkIOSWithCompletion(_ completion: @escaping (Bool, Error?) -> Void) {
        Task {
            do {
                let isEligible = try await isEligibleForExternalPurchaseCustomLinkIOS()
                completion(isEligible, nil)
            } catch {
                completion(false, error)
            }
        }
    }

    @available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *)
    @objc func getExternalPurchaseCustomLinkTokenIOSWithTokenType(
        _ tokenTypeString: String,
        completion: @escaping (Any?, Error?) -> Void
    ) {
        Task {
            do {
                guard let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: tokenTypeString) else {
                    let error = PurchaseError(
                        code: .developerError,
                        message: "Invalid token type: \(tokenTypeString). Use 'acquisition' or 'services'"
                    )
                    throw error
                }
                let result = try await getExternalPurchaseCustomLinkTokenIOS(tokenType)
                let dictionary = OpenIapSerialization.encode(result)
                completion(dictionary, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *)
    @objc func showExternalPurchaseCustomLinkNoticeIOSWithNoticeType(
        _ noticeTypeString: String,
        completion: @escaping (Any?, Error?) -> Void
    ) {
        Task {
            do {
                guard let noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS(rawValue: noticeTypeString) else {
                    let error = PurchaseError(
                        code: .developerError,
                        message: "Invalid notice type: \(noticeTypeString). Use 'browser'"
                    )
                    throw error
                }
                let result = try await showExternalPurchaseCustomLinkNoticeIOS(noticeType)
                let dictionary = OpenIapSerialization.encode(result)
                completion(dictionary, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    // MARK: - Event Listeners

    @objc func addPurchaseUpdatedListener(_ callback: @escaping (NSDictionary) -> Void) -> NSObject {
        let subscription = purchaseUpdatedListener { purchase in
            let dictionary = OpenIapSerialization.purchase(purchase)
            callback(dictionary as NSDictionary)
        }
        return subscription as NSObject
    }

    @objc func addPurchaseErrorListener(_ callback: @escaping (NSDictionary) -> Void) -> NSObject {
        let subscription = purchaseErrorListener { error in
            let dictionary = OpenIapSerialization.encode(error)
            callback(dictionary as NSDictionary)
        }
        return subscription as NSObject
    }

    @objc func addPromotedProductListener(_ callback: @escaping (String?) -> Void) -> NSObject {
        let subscription = promotedProductListenerIOS { sku in
            callback(sku)
        }
        return subscription as NSObject
    }

    @objc func removeListener(_ subscription: NSObject) {
        if let sub = subscription as? Subscription {
            removeListener(sub)
        }
    }

    @objc func removeAllListenersObjC() {
        removeAllListeners()
    }
}
