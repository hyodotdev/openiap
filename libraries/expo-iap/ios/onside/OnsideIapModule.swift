import ExpoModulesCore
import Foundation
import UIKit
import OpenIAP

private enum OnsideEvent: String {
    case purchaseUpdated = "purchase-updated"
    case purchaseError = "purchase-error"
    case promotedProductIOS = "promoted-product-ios"
    case subscriptionBillingIssue = "subscription-billing-issue"
}

private enum OnsideBridgeError: Error, LocalizedError {
    case sdkUnavailable
    case notInitialized
    case emptySkuList
    case productNotFound(String)
    case transactionNotFound(String)
    case restoreInProgress
    case queueError(String)

    var errorDescription: String? {
        switch self {
        case .sdkUnavailable:
            return "OnsideKit is not installed. Enable ios.onside.enabled to use this functionality."
        case .notInitialized:
            return "Connection not initialized. Call initConnection() first."
        case .emptySkuList:
            return "No product identifiers provided."
        case .productNotFound(let sku):
            return "Product with identifier \(sku) was not fetched. Call fetchProducts() first."
        case .transactionNotFound(let id):
            return "Could not locate transaction with id \(id)."
        case .restoreInProgress:
            return "A restore operation is already in progress."
        case .queueError(let message):
            return message
        }
    }
}

#if canImport(OnsideKit)
@preconcurrency import OnsideKit

@available(iOS 16.0, *)
@MainActor
public final class ExpoIapOnsideModule: Module {
    private var isInitialized = false
    private var restoreContinuation: CheckedContinuation<Bool, Error>?
    private let transactionObserver = OnsideTransactionObserverBridge()
    private let productFetcher = OnsideProductFetcher()
    private var productCache: [String: OnsideProduct] = [:]
    private var transactionDateCache: [String: Date] = [:]

    nonisolated public func definition() -> ModuleDefinition {
        Name("ExpoIapOnside")

        Constants {
            var constants: [String: Any] = [:]
            let errorCodes = OpenIapSerialization.errorCodes()
            constants["ERROR_CODES"] = errorCodes
            errorCodes.forEach { key, value in
                constants[key] = value
            }
            constants["IS_ONSIDE_KIT_INSTALLED_IOS"] = true
            return constants
        }

        Events(
            OnsideEvent.purchaseUpdated.rawValue,
            OnsideEvent.purchaseError.rawValue,
            OnsideEvent.promotedProductIOS.rawValue,
            OnsideEvent.subscriptionBillingIssue.rawValue
        )

        OnCreate { [weak self] in
            Task { @MainActor [weak self] in
                self?.configureObserverCallbacks()
            }
        }

        OnDestroy { [weak self] in
            guard let self else { return }
            Task { @MainActor [self] in
                self.cleanup()
            }
        }

        AsyncFunction("initConnection") { (config: [String: Any]?) async throws -> Bool in
            ExpoIapLog.payload("initConnectionOnside", payload: config)
            try await ensureObserverRegistered()
            return true
        }

        AsyncFunction("endConnection") { () async throws -> Bool in
            ExpoIapLog.payload("endConnectionOnside", payload: nil)
            await cleanup()
            return true
        }

        AsyncFunction("setPurchaseUpdatedListenerOptions") { (_: [String: Any]?) async throws -> Void in
            // OnsideKit does not replay StoreKit 2 transactions through OpenIAP,
            // so the StoreKit dedupe option is intentionally a no-op here.
        }

        AsyncFunction("fetchProducts") { (params: [String: Any]) async throws -> [[String: Any]] in
            ExpoIapLog.payload("fetchProductsOnside", payload: params)
            let request = try ExpoIapHelper.decodeProductRequest(from: params)
            guard !request.skus.isEmpty else {
                throw OnsideBridgeError.emptySkuList
            }
            try await ensureObserverRegistered()

            var storefront = await Onside.defaultPaymentQueue().storefront
            if storefront == nil {
                #if DEBUG
                print("[ExpoIapOnsideModule] Storefront is nil, requesting login...")
                #endif

                let canOpenOnsideStore: Bool
                if let onsideURL = URL(string: "onside://") {
                    canOpenOnsideStore = await MainActor.run {
                        UIApplication.shared.canOpenURL(onsideURL)
                    }
                } else {
                    canOpenOnsideStore = false
                }

                if canOpenOnsideStore {
                    #if DEBUG
                    print("[ExpoIapOnsideModule] ✅ Onside Store app is installed")
                    #endif
                } else {
                    #if DEBUG
                    print("[ExpoIapOnsideModule] ⚠️ Onside Store app is NOT installed!")
                    print("[ExpoIapOnsideModule] Please install Onside Store from https://onside.io")
                    #endif
                    throw OnsideBridgeError.queueError("Onside Store app is not installed. Please install it from https://onside.io")
                }

                await Onside.requestLogin()
                #if DEBUG
                print("[ExpoIapOnsideModule] requestLogin completed, waiting for storefront...")
                #endif

                // Poll for storefront with timeout
                let timeoutNanos: UInt64 = 5_000_000_000 // 5 seconds
                let intervalNanos: UInt64 = 500_000_000  // 0.5 seconds
                var elapsed: UInt64 = 0

                while elapsed < timeoutNanos {
                    if let sf = await Onside.defaultPaymentQueue().storefront {
                        #if DEBUG
                        print("[ExpoIapOnsideModule] ✅ Storefront available: \(sf.countryCode)")
                        #endif
                        storefront = sf
                        break
                    }
                    try await Task.sleep(nanoseconds: intervalNanos)
                    elapsed += intervalNanos
                }

                if storefront == nil {
                    #if DEBUG
                    print("[ExpoIapOnsideModule] ⚠️ Storefront is still nil after timeout!")
                    print("[ExpoIapOnsideModule] User may have cancelled login or login failed")
                    #endif
                    throw OnsideBridgeError.queueError("Login was not completed. Please try again.")
                }
            }

            let response = try await productFetcher.fetch(identifiers: Set(request.skus))

            if !response.invalidProductIdentifiers.isEmpty {
                throw OnsideBridgeError.productNotFound(response.invalidProductIdentifiers.joined(separator: ", "))
            }

            let matchingProducts = response.products.filter { product in
                switch request.type ?? .inApp {
                case .subs:
                    return product.subscriptionPeriod != nil
                case .inApp:
                    return product.subscriptionPeriod == nil
                case .all:
                    return true
                }
            }
            let payload: [[String: Any]] = try await MainActor.run {
                for p in matchingProducts {
                    productCache[p.productIdentifier] = p
                }
                return try matchingProducts.map { try serializeProduct($0) }
            }
            ExpoIapLog.result("fetchProductsOnside", value: payload)
            return payload
        }

        AsyncFunction("requestPurchase") { (payload: [String: Any]) async throws -> Any? in
            ExpoIapLog.payload("requestPurchaseOnside", payload: payload)

            let purchaseRequest = try ExpoIapHelper.decodeRequestPurchaseProps(from: payload)
            let sku = try resolveSku(from: purchaseRequest)

            try await ensureObserverRegistered()

            try await ensureProductAvailable(sku: sku)

            let product: OnsideProduct = try await MainActor.run {
                guard let p = productCache[sku] else {
                    throw OnsideBridgeError.productNotFound(sku)
                }

                return p
            }

            let payment = OnsidePayment(product: product)

            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                Task { @MainActor in
                    Onside.defaultPaymentQueue().add(payment) { result in
                        switch result {
                        case .success:
                            continuation.resume()
                        case .failure(let error):
                            continuation.resume(throwing: OnsideBridgeError.queueError(error.localizedDescription))
                        }
                    }
                }
            }

            ExpoIapLog.result("requestPurchaseOnside", value: nil as Any?)
            return nil
        }

        AsyncFunction("finishTransaction") { (purchasePayload: [String: Any], _: Bool?) async throws -> Bool in
            ExpoIapLog.payload("finishTransactionOnside", payload: purchasePayload)
            try await ensureObserverRegistered()

            let productId = purchasePayload["productId"] as? String
            let txId = purchasePayload["transactionId"] as? String

            let transaction: OnsidePaymentTransaction? = await MainActor.run {
                let queue = Onside.defaultPaymentQueue()
                if let txId, !txId.isEmpty {
                    return queue.transactions.first(where: { $0.transactionIdentifier == txId })
                }

                // 2) fallback: if txId is not available yet — search by productId (less reliable!)
                if let productId, !productId.isEmpty {
                    return queue.transactions.first(where: {
                        $0.payment.product.productIdentifier == productId
                        && ($0.transactionState == .purchased || $0.transactionState == .restored)
                    })
                }

                return nil
            }

            guard let transaction else {
                throw OnsideBridgeError.transactionNotFound(txId ?? productId ?? "")
            }

            await MainActor.run {
                Onside.defaultPaymentQueue().finishTransaction(transaction)
            }
            ExpoIapLog.result("finishTransactionOnside", value: true)
            return true
        }

        AsyncFunction("restorePurchases") { () async throws -> Bool in
            ExpoIapLog.payload("restorePurchasesOnside", payload: nil)
            try await ensureObserverRegistered()

            try await MainActor.run {
                if self.restoreContinuation != nil {
                    throw OnsideBridgeError.restoreInProgress
                }
            }

            return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
                Task { @MainActor [weak self] in
                    guard let self else {
                        continuation.resume(returning: false)
                        return
                    }
                    self.restoreContinuation = continuation

                    Onside.defaultPaymentQueue().restoreCompletedTransactions { result in
                        Task { @MainActor [weak self] in
                            guard let self else { return }
                            let cont = self.restoreContinuation
                            self.restoreContinuation = nil
                            switch result {
                            case .success:
                                cont?.resume(returning: true)
                            case .failure(let error):
                                cont?.resume(
                                    throwing: OnsideBridgeError.queueError(error.localizedDescription)
                                )
                            }
                        }
                    }
                }
            }
        }

        AsyncFunction("getAvailableItems") { (alsoPublish: Bool, onlyIncludeActive: Bool) async throws -> [[String: Any]] in
            ExpoIapLog.payload(
                "getAvailableItemsOnside",
                payload: [
                    "alsoPublishToEventListenerIOS": alsoPublish,
                    "onlyIncludeActiveItemsIOS": onlyIncludeActive,
                ]
            )
            try await ensureObserverRegistered()
            let payload: [[String: Any]] = try await MainActor.run {
                let queue = Onside.defaultPaymentQueue()
                let items = try queue.transactions.compactMap { transaction -> [String: Any]? in
                    switch transaction.transactionState {
                    case .purchased, .restored:
                        return try serialize(transaction: transaction)
                    default:
                        return nil
                    }
                }
                if alsoPublish {
                    items.forEach {
                        sendEvent(OnsideEvent.purchaseUpdated.rawValue, $0)
                    }
                }
                return items
            }
            ExpoIapLog.result("getAvailableItemsOnside", value: payload)
            return payload
        }

        AsyncFunction("getStorefront") { () async throws -> String in
            try await getOnsideStorefront()
        }

    }

    private func getOnsideStorefront() async throws -> String {
        ExpoIapLog.payload("getStorefrontOnside", payload: nil)
        try await ensureObserverRegistered()
        guard let storefront = Onside.defaultPaymentQueue().storefront?.countryCode,
              !storefront.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw IapException.from(
                PurchaseError.make(
                    code: .serviceError,
                    message: "Storefront lookup returned no country code"
                )
            )
        }
        ExpoIapLog.result("getStorefrontOnside", value: storefront)
        return storefront
    }

    private func ensureObserverRegistered() async throws {
        if !isInitialized {
            Onside.defaultPaymentQueue().add(observer: transactionObserver)
            isInitialized = true
        }
    }

    private func ensureProductAvailable(sku: String) async throws {
        if productCache[sku] != nil {
            return
        }
        let response = try await productFetcher.fetch(identifiers: [sku])
        if !response.invalidProductIdentifiers.isEmpty {
            throw OnsideBridgeError.productNotFound(sku)
        }
        response.products.forEach { productCache[$0.productIdentifier] = $0 }
    }

    private func configureObserverCallbacks() {
        transactionObserver.onTransactionsUpdated = { [weak self] transactions in
            Task { @MainActor [weak self] in
                guard let self else { return }
                transactions.forEach { transaction in
                    self.handle(transaction: transaction)
                }
            }
        }

        transactionObserver.onRestoreFinished = { [weak self] in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let cont = self.restoreContinuation
                self.restoreContinuation = nil
                cont?.resume(returning: true)
            }
        }

        transactionObserver.onRestoreFailed = { [weak self] error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let cont = self.restoreContinuation
                self.restoreContinuation = nil
                cont?.resume(
                    throwing: OnsideBridgeError.queueError(error.localizedDescription)
                )
            }
        }
    }

    private func cleanup() {
        if isInitialized {
            Onside.defaultPaymentQueue().remove(observer: transactionObserver)
            isInitialized = false
        }
        productCache.removeAll()
        transactionDateCache.removeAll()
        let cont = restoreContinuation
        restoreContinuation = nil
        cont?.resume(returning: false)
    }

    private func handle(transaction: OnsidePaymentTransaction) {
        do {
            let payload = try serialize(transaction: transaction)
            switch transaction.transactionState {
            case .purchased, .restored:
                sendEvent(OnsideEvent.purchaseUpdated.rawValue, payload)
            case .failed:
                let error = transaction.error
                #if DEBUG
                print("[ExpoIapOnsideModule] Transaction failed: \(transaction.payment.product.productIdentifier), error: \(error?.localizedDescription ?? "unknown")")
                #endif

                let errorPayload: [String: Any] = [
                    "code": ErrorCode.purchaseError.rawValue,
                    "message": (error?.localizedDescription ?? "Purchase failed"),
                    "productId": transaction.payment.product.productIdentifier,
                ]
                sendEvent(OnsideEvent.purchaseError.rawValue, errorPayload)
            case .purchasing:
                break
            @unknown default:
                break
            }
        } catch {
            ExpoIapLog.failure("handleTransactionOnside", error: error)
        }
    }

    private func serializeProduct(_ product: OnsideProduct) throws -> [String: Any] {
        var dictionary: [String: Any?] = [:]
        dictionary["id"] = product.productIdentifier
        dictionary["platform"] = "ios"
        dictionary["title"] = product.localizedTitle
        dictionary["description"] = product.localizedDescription
        dictionary["displayName"] = product.localizedTitle
        dictionary["displayNameIOS"] = product.localizedTitle
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = product.price.currencyCode
        let priceNumber = makePriceNumber(from: product)
        let formattedPrice = formatter.string(from: priceNumber) ?? "\(product.price.value)"
        dictionary["displayPrice"] = formattedPrice
        dictionary["currency"] = product.price.currencyCode
        dictionary["price"] = priceNumber
        let subscriptionPeriod = product.subscriptionPeriod.map {
            subscriptionPeriodComponentsIOS($0)
        }
        let isSubscription = subscriptionPeriod != nil
        dictionary["type"] = isSubscription ? "subs" : "in-app"
        dictionary["typeIOS"] = isSubscription ? "auto-renewable-subscription" : "non-consumable"
        dictionary["isFamilyShareableIOS"] = false
        dictionary["subscriptionGroupIdIOS"] = product.subscriptionGroupIdentifier
        if let subscriptionPeriod {
            dictionary["subscriptionPeriodNumberIOS"] = String(subscriptionPeriod.value)
            dictionary["subscriptionPeriodUnitIOS"] = subscriptionPeriod.unit
        }
        if let introductoryPrice = product.introductoryPrice {
            let introductoryPeriod = subscriptionPeriodComponentsIOS(introductoryPrice.period)
            dictionary["introductoryPriceAsAmountIOS"] = String(introductoryPrice.price.value)
            dictionary["introductoryPriceIOS"] = formatPriceIOS(introductoryPrice.price)
            dictionary["introductoryPriceNumberOfPeriodsIOS"] = String(introductoryPeriod.value)
            dictionary["introductoryPricePaymentModeIOS"] =
                introductoryPricePaymentModeIOS(for: introductoryPrice).rawValue
            dictionary["introductoryPriceSubscriptionPeriodIOS"] = introductoryPeriod.unit
        } else if isSubscription {
            dictionary["introductoryPricePaymentModeIOS"] = PaymentModeIOS.empty.rawValue
        }
        // Avoid JSONEncoder on non-Encodable SDK type: build JSON string from known fields
        dictionary["jsonRepresentationIOS"] = try makeProductJSONRepresentation(from: product)
        dictionary["debugDescription"] = product.description
        return sanitize(dictionary)
    }

    private func serialize(transaction: OnsidePaymentTransaction) throws -> [String: Any] {
        let product = transaction.payment.product
        var dictionary: [String: Any?] = [:]
        dictionary["id"] = transaction.transactionIdentifier ?? ""
        dictionary["transactionId"] = transaction.transactionIdentifier ?? ""
        dictionary["productId"] = transaction.payment.product.productIdentifier
        dictionary["platform"] = "ios"
        // Onside is an alternative iOS marketplace and does not yet have a
        // dedicated IapStore enum value. Preserve the required store
        // discriminator without reporting the purchase as App Store traffic.
        dictionary["store"] = "unknown"
        if product.subscriptionPeriod == nil {
            dictionary["currentPlanId"] = NSNull()
        } else {
            dictionary["currentPlanId"] = product.productIdentifier
        }
        dictionary["quantity"] = 1
        dictionary["quantityIOS"] = 1
        dictionary["isAutoRenewing"] = false
        dictionary["purchaseState"] = mapPurchaseState(transaction.transactionState)
        let txDate = fallbackTransactionDate(for: transaction)
        dictionary["transactionDate"] = Int(txDate.timeIntervalSince1970 * 1000)
        dictionary["currencyCodeIOS"] = product.price.currencyCode
        let currencyFormatter = NumberFormatter()
        currencyFormatter.numberStyle = .currency
        currencyFormatter.currencyCode = product.price.currencyCode
        dictionary["currencySymbolIOS"] = currencyFormatter.currencySymbol ?? ""

        dictionary["countryCodeIOS"] = transaction.storefront.countryCode
        dictionary["storefrontCountryCodeIOS"] = transaction.storefront.countryCode
        dictionary["subscriptionGroupIdIOS"] = product.subscriptionGroupIdentifier
        dictionary["originalTransactionIdentifierIOS"] =
            transaction.originalTransactionIdentifier
        dictionary["purchaseToken"] = nil
        // Onside exposes storefront identity, not StoreKit's Sandbox/Production
        // environment. Do not mislabel a marketplace/storefront identifier.
        dictionary["environmentIOS"] = NSNull()
        if let error = transaction.error {
            dictionary["reasonIOS"] = error.localizedDescription
        }
        return sanitize(dictionary)
    }

    // Build a JSON string from known product fields (no Encodable conformance required)
    private func makeProductJSONRepresentation(from product: OnsideProduct) throws -> String {
        let priceFormatter = NumberFormatter()
        priceFormatter.numberStyle = .currency
        priceFormatter.currencyCode = product.price.currencyCode
        let priceNumber = makePriceNumber(from: product)
        let formattedPrice = priceFormatter.string(from: priceNumber) ?? "\(product.price.value)"
        let subscriptionPeriod = product.subscriptionPeriod.map {
            subscriptionPeriodComponentsIOS($0)
        }
        var jsonObject: [String: Any] = [
            "id": product.productIdentifier,
            "title": product.localizedTitle,
            "description": product.localizedDescription,
            "price": [
                "value": priceNumber,
                "currencyCode": product.price.currencyCode,
                "formatted": formattedPrice,
            ],
            "isFamilyShareable": false,
            "platform": "ios",
            "type": subscriptionPeriod == nil ? "in-app" : "subs",
        ]
        if let subscriptionGroupIdentifier = product.subscriptionGroupIdentifier {
            jsonObject["subscriptionGroupIdentifier"] = subscriptionGroupIdentifier
        }
        if let subscriptionPeriod {
            jsonObject["subscriptionPeriod"] = [
                "value": subscriptionPeriod.value,
                "unit": subscriptionPeriod.unit,
            ]
        }
        let data = try JSONSerialization.data(withJSONObject: jsonObject, options: [])
        guard let json = String(data: data, encoding: .utf8) else {
            throw OnsideBridgeError.queueError("Unable to encode JSON string")
        }
        return json
    }

    private func makePriceNumber(from product: OnsideProduct) -> NSDecimalNumber {
        NSDecimalNumber(string: String(product.price.value))
    }

    private func formatPriceIOS(_ price: OnsidePrice) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = price.currencyCode
        let number = NSDecimalNumber(string: String(price.value))
        return formatter.string(from: number) ?? "\(price.value)"
    }

    private func introductoryPricePaymentModeIOS(
        for offer: OnsidePricePeriod
    ) -> PaymentModeIOS {
        if offer.price.value == 0 {
            return .freeTrial
        }

        // OnsideKit exposes only price and period for introductory offers, so
        // paid offers cannot be distinguished as pay-as-you-go or pay-up-front.
        return .empty
    }

    private func subscriptionPeriodComponentsIOS(
        _ period: OnsidePeriod
    ) -> (value: Int, unit: String) {
        switch period {
        case .day(let value):
            return (Int(value), "day")
        case .week(let value):
            return (Int(value), "week")
        case .month(let value):
            return (Int(value), "month")
        case .year(let value):
            return (Int(value), "year")
        @unknown default:
            return (0, "empty")
        }
    }

    private func fallbackTransactionDate(for transaction: OnsidePaymentTransaction) -> Date {
        let cacheKey = transaction.transactionIdentifier
            ?? transaction.originalTransactionIdentifier
            ?? transaction.payment.product.productIdentifier
        if let cachedDate = transactionDateCache[cacheKey] {
            return cachedDate
        }

        let date = Date()
        transactionDateCache[cacheKey] = date
        return date
    }

    private func sanitize(_ dictionary: [String: Any?]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in dictionary {
            if let value {
                result[key] = value
            }
        }
        return result
    }

    private func mapPurchaseState(_ state: OnsidePaymentTransactionState) -> String {
        switch state {
        case .purchased:
            return "purchased"
        case .restored:
            return "purchased"
        case .failed:
            return "unknown"
        case .purchasing:
            return "pending"
        @unknown default:
            return "unknown"
        }
    }

    nonisolated private func resolveSku(from request: RequestPurchaseProps) throws -> String {
        let sku: String?
        switch (request.type, request.request) {
        case (.inApp, .purchase(let platforms)):
            sku = platforms.apple?.sku
        case (.subs, .subscription(let platforms)):
            sku = platforms.apple?.sku
        default:
            throw PurchaseError.make(
                code: .developerError,
                message: "Purchase type must match the request branch."
            )
        }
        guard let sku, !sku.isEmpty else {
            throw OnsideBridgeError.emptySkuList
        }
        return sku
    }
}

@available(iOS 16.0, *)
private final class OnsideTransactionObserverBridge: NSObject, OnsidePaymentTransactionObserver {
    var onTransactionsUpdated: (([OnsidePaymentTransaction]) -> Void)?
    var onRestoreFinished: (() -> Void)?
    var onRestoreFailed: ((OnsideTransactionsRestoreError) -> Void)?

    func onsidePaymentQueue(_ queue: OnsidePaymentQueue, updatedTransactions transactions: [OnsidePaymentTransaction]) {
        onTransactionsUpdated?(transactions)
    }

    func onsidePaymentQueue(_ queue: OnsidePaymentQueue, removedTransactions: [OnsidePaymentTransaction]) {}

    func onsidePaymentQueueRestoreCompletedTransactionsFinished(_ queue: OnsidePaymentQueue) {
        onRestoreFinished?()
    }

    func onsidePaymentQueue(
    _ queue: OnsidePaymentQueue,
    restoreCompletedTransactionsFailedWithError error: OnsideTransactionsRestoreError
    ) {
        onRestoreFailed?(error)
    }

    func onsidePaymentQueueDidChangeStorefront(_ queue: OnsidePaymentQueue) {}
}

@available(iOS 16.0, *)
private final class OnsideProductFetcher: NSObject, OnsideProductsRequestDelegate {
    private var continuation: CheckedContinuation<OnsideProductsResponse, Error>?
    private var request: OnsideProductsRequest?

    @MainActor
    func fetch(identifiers: Set<String>) async throws -> OnsideProductsResponse {
        guard !identifiers.isEmpty else {
            throw OnsideBridgeError.emptySkuList
        }
        guard continuation == nil else {
            throw OnsideBridgeError.queueError(
                "A product request is already in progress."
            )
        }

        return try await withCheckedThrowingContinuation { continuation in
            let request = Onside.makeProductsRequest(productIdentifiers: identifiers)
            self.request = request
            self.continuation = continuation
            request.delegate = self
            request.start()
        }
    }

    func onsideProductsRequest(_ request: OnsideProductsRequest, didReceive response: OnsideProductsResponse) {
        Task { @MainActor [weak self] in
            self?.complete(.success(response))
        }
    }

    func onsideProductsRequestRequest(
    _ request: OnsideProductsRequest,
    didFailWithError error: OnsideProductsRequestError
    ) {
        Task { @MainActor [weak self] in
            self?.complete(
                .failure(OnsideBridgeError.queueError(error.localizedDescription))
            )
        }
    }

    func onsideProductsRequestDidFinish(_ request: OnsideProductsRequest) {
        Task { @MainActor [weak self] in
            self?.complete(
                .failure(
                    OnsideBridgeError.queueError(
                        "Product request finished without a response."
                    )
                )
            )
        }
    }

    @MainActor
    private func complete(_ result: Result<OnsideProductsResponse, Error>) {
        guard let continuation else {
            cleanup()
            return
        }
        self.continuation = nil
        cleanup()
        switch result {
        case .success(let response):
            continuation.resume(returning: response)
        case .failure(let error):
            continuation.resume(throwing: error)
        }
    }

    @MainActor
    private func cleanup() {
        request?.delegate = nil
        request?.stop()
        request = nil
    }
}

#else

@available(iOS 15.0, tvOS 15.0, *)
@MainActor
public final class ExpoIapOnsideModule: Module {
    nonisolated public func definition() -> ModuleDefinition {
        Name("ExpoIapOnside")

        Constant("ERROR_CODES") {
            OpenIapSerialization.errorCodes()
        }

        Constant("IS_ONSIDE_KIT_INSTALLED_IOS") {
            false
        }

        Events(
            OnsideEvent.purchaseUpdated.rawValue,
            OnsideEvent.purchaseError.rawValue,
            OnsideEvent.promotedProductIOS.rawValue,
            OnsideEvent.subscriptionBillingIssue.rawValue
        )

        AsyncFunction("initConnection") { (_: [String: Any]?) async throws -> Bool in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("endConnection") { () async throws -> Bool in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("setPurchaseUpdatedListenerOptions") { (_: [String: Any]?) async throws -> Void in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("fetchProducts") { (_: [String: Any]) async throws -> [[String: Any]] in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("requestPurchase") { (_: [String: Any]) async throws -> Any? in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("finishTransaction") { (_: [String: Any], _: Bool?) async throws -> Bool in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("restorePurchases") { () async throws -> Bool in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("getAvailableItems") { (_: Bool, _: Bool) async throws -> [[String: Any]] in
            throw OnsideBridgeError.sdkUnavailable
        }

        AsyncFunction("getStorefront") { () async throws -> String in
            throw OnsideBridgeError.sdkUnavailable
        }

    }
}

#endif
