import Foundation
import StoreKit
// UIKit: Required for UIApplication, UIWindowScene on iOS/tvOS/visionOS
#if canImport(UIKit)
import UIKit
#endif
// AppKit: Required for NSApplication, NSWindow on macOS
#if canImport(AppKit)
import AppKit
#endif

/// - SeeAlso: https://developer.apple.com/documentation/storekit/in-app_purchase
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
@objc(OpenIapModule)
public final class OpenIapModule: NSObject, OpenIapModuleProtocol {
    public static let shared = OpenIapModule()

    /// Objective-C accessor for [OpenIapModule.shared]. Exists so the .NET MAUI
    /// binding (`OpenIap.Maui.Bindings.iOS`) can surface the singleton via
    /// `[OpenIapModule sharedInstance]`; Swift's static stored properties
    /// aren't @objc-bridged automatically.
    @objc public class func sharedInstance() -> OpenIapModule { shared }

    private let state = IapState()
    private let connection = OpenIapConnectionLifecycle()
    private static let initRetryDelayNanoseconds: UInt64 = 1_000_000
    private static let subscriptionPreflightTimeoutNanoseconds: UInt64 = 750_000_000

    #if os(iOS)
    private let promotedPurchaseObserverLock = NSLock()
    private var didRegisterPromotedPurchaseObserver = false
    private var isPromotedPurchaseObserverTransitionInFlight = false
    #endif

    private enum SubscriptionPreflightOutcome {
        case completed
        case timedOut
    }

    private override init() {
        super.init()
        registerPromotedPurchaseObserverIfNeeded()
    }

    deinit {
        unregisterPromotedPurchaseObserverIfNeeded()
        cancelConnectionTasksForDeinit()
    }

    // MARK: - Connection Management

    /// Initialize the store connection. Must be called before any other IAP API.
    ///
    /// - Returns: `true` once StoreKit is connected.
    /// - Throws: When StoreKit fails to initialize.
    /// - Note: This wraps `OpenIapStoreKit2.initialize()`. Safe to call multiple times — the
    ///   second call is a no-op.
    ///
    /// See: https://openiap.dev/docs/apis/init-connection
    public func initConnection() async throws -> Bool {
        while true {
            if let endTask = connection.currentEndTask() {
                await endTask.value
                continue
            }

            if await state.isInitialized {
                return true
            }

            guard let initWork = connection.makeInitTask(operation: { [weak self] generation in
                guard let self else { return false }
                return try await self.performInitConnection(generation: generation)
            }) else {
                if let endTask = connection.currentEndTask() {
                    await endTask.value
                } else {
                    try await Task.sleep(nanoseconds: Self.initRetryDelayNanoseconds)
                }
                continue
            }

            do {
                let value = try await initWork.task.value
                connection.clearInitTask(generation: initWork.generation)
                return value
            } catch is CancellationError {
                connection.clearInitTask(generation: initWork.generation)
                return false
            } catch {
                connection.clearInitTask(generation: initWork.generation)
                throw error
            }
        }
    }

    /// Close the store connection and release resources.
    /// See: https://openiap.dev/docs/apis/end-connection
    public func endConnection() async throws -> Bool {
        let task = connection.makeEndTask { [weak self] in
            guard let self else { return }
            await self.cleanupExistingState()
        }
        await task.value
        return true
    }

    // MARK: - Product Management

    /// Retrieve products or subscriptions from the App Store by SKU.
    ///
    /// - Parameter params: `ProductRequest` with `skus` (the product identifiers) and an
    ///   optional `type` (`.inApp`, `.subs`, or `.all`; defaults to `.inApp` when omitted —
    ///   matches the cross-platform Flutter / expo-iap / react-native-iap / godot SDKs).
    /// - Returns: A `FetchProductsResult` variant — `Product[]` for `.inApp`,
    ///   `ProductSubscription[]` for `.subs`, or a mixed list for `.all`.
    /// - Throws: When the store rejects the request (unknown SKU, network failure, not connected).
    /// - Note: This is a regular promise-based call. Do not confuse with `request*` APIs,
    ///   which are event-based.
    ///
    /// See: https://openiap.dev/docs/apis/fetch-products
    public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult {
        guard !params.skus.isEmpty else {
            let error = makePurchaseError(code: .emptySkuList)
            emitPurchaseError(error)
            throw error
        }

        try await ensureConnection()
        guard let productManager = connection.currentProductManager() else {
            let error = makePurchaseError(code: .notPrepared)
            emitPurchaseError(error)
            throw error
        }

        let fetchedProducts: [StoreKit.Product]
        do {
            fetchedProducts = try await StoreKit.Product.products(for: params.skus)
            for product in fetchedProducts {
                await productManager.addProduct(product)
            }
        } catch {
            let purchaseError = makePurchaseError(
                code: .queryProduct,
                message: error.localizedDescription,
                debugMessage: error.localizedDescription
            )
            emitPurchaseError(purchaseError)
            throw purchaseError
        }

        // Only process products that were actually requested, not all cached products
        var productEntries: [OpenIAP.Product] = []
        var subscriptionEntries: [OpenIAP.ProductSubscription] = []

        for product in fetchedProducts {
            productEntries.append(await StoreKitTypesBridge.product(from: product))
            if let subscription = await StoreKitTypesBridge.productSubscription(from: product) {
                subscriptionEntries.append(subscription)
            }
        }

        switch params.type ?? .inApp {
        case .subs:
            // Return products that are subscriptions (both auto-renewable and non-renewing)
            // Auto-renewable subscriptions have product.subscription != nil and use subscriptionEntries
            // Non-renewing subscriptions have product.type == .nonRenewable but no subscription metadata
            let autoRenewableSubs = subscriptionEntries.filter { sub in
                fetchedProducts.contains { product in
                    product.id == sub.id && product.subscription != nil
                }
            }

            // Include non-renewing subscriptions as ProductSubscriptionIOS
            // Note: Non-renewing subscriptions in StoreKit 2 don't have subscription metadata
            // (no discounts, intro offers, subscription period, or subscription group).
            // This is a StoreKit limitation, not missing data - we include all available product info.
            let nonRenewingSubs: [ProductSubscription] = fetchedProducts.compactMap { product in
                guard product.type == .nonRenewable else { return nil }
                return .productSubscriptionIos(ProductSubscriptionIOS(
                    currency: StoreKitTypesBridge.currencyCode(from: product) ?? "",
                    debugDescription: product.description,
                    description: product.description,
                    discountsIOS: nil,  // StoreKit: Non-renewing subscriptions don't support discounts
                    displayName: product.displayName,
                    displayNameIOS: product.displayName,
                    displayPrice: product.displayPrice,
                    id: product.id,
                    introductoryPriceAsAmountIOS: nil,  // StoreKit: Non-renewing subscriptions don't support intro offers
                    introductoryPriceIOS: nil,
                    introductoryPriceNumberOfPeriodsIOS: nil,
                    introductoryPricePaymentModeIOS: .empty,
                    introductoryPriceSubscriptionPeriodIOS: nil,
                    isFamilyShareableIOS: product.isFamilyShareable,
                    jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
                    platform: .ios,
                    price: NSDecimalNumber(decimal: product.price).doubleValue,
                    subscriptionGroupIdIOS: nil,
                    subscriptionInfoIOS: nil,  // StoreKit: Non-renewing subscriptions have no subscription metadata
                    subscriptionPeriodNumberIOS: nil,
                    subscriptionPeriodUnitIOS: nil,
                    title: product.displayName,
                    type: .subs,
                    typeIOS: .nonRenewingSubscription
                ))
            }

            let allSubs = autoRenewableSubs + nonRenewingSubs
            return .subscriptions(allSubs.isEmpty ? nil : allSubs)
        case .inApp:
            let inApp = productEntries.compactMap { entry -> OpenIAP.Product? in
                guard case let .productIos(value) = entry, value.type == .inApp else { return nil }
                return entry
            }
            return .products(inApp.isEmpty ? nil : inApp)
        case .all:
            return .products(productEntries.isEmpty ? nil : productEntries)
        }
    }

    /// Read the App Store-promoted product, if any.
    /// See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
    public func getPromotedProductIOS() async throws -> ProductIOS? {
        // iOS-only: Promoted in-app purchases (App Store promotional purchases) only available on iOS
        // Reference: https://developer.apple.com/documentation/storekit/promoting-in-app-purchases
        #if os(iOS)
        let sku = await state.promotedProductIdentifier()
        guard let sku else { return nil }

        do {
            try await ensureConnection()
        } catch let purchaseError as PurchaseError {
            throw purchaseError
        }

        await state.setPromotedProductId(sku)

        do {
            let product = try await storeProduct(for: sku)
            return await StoreKitTypesBridge.productIOS(from: product)
        } catch let purchaseError as PurchaseError {
            await state.setPromotedProductId(nil)
            throw purchaseError
        } catch {
            let wrapped = makePurchaseError(
                code: .queryProduct,
                productId: sku,
                message: error.localizedDescription,
                debugMessage: error.localizedDescription
            )
            emitPurchaseError(wrapped)
            await state.setPromotedProductId(nil)
            throw wrapped
        }
        #else
        return nil
        #endif // os(iOS)
    }

    // MARK: - Purchase Management

    /// Initiate a purchase flow. The result is delivered via the purchase update listener,
    /// NOT through the return value.
    ///
    /// - Parameter params: `RequestPurchaseProps` — discriminated by `type`:
    ///   `.inApp` for one-time products (use `request.apple.sku`), `.subs` for subscriptions.
    /// - Returns: The dispatched request payload. Do not rely on this for the purchase outcome.
    /// - Throws: Synchronous rejections from StoreKit (e.g. user cancel before sheet, not prepared).
    /// - Warning: Event-based. Listen via `purchaseUpdatedListener` / `purchaseErrorListener`.
    ///
    /// See: https://openiap.dev/docs/apis/request-purchase
    public func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        try await ensureConnection()
        let iosProps = try resolveIOSPurchaseProps(from: params)
        let sku = iosProps.sku
        let product = try await storeProduct(for: sku)
        let options = try StoreKitTypesBridge.purchaseOptions(from: iosProps, product: product)

        if product.type == .autoRenewable {
            await preflightInactiveUnfinishedSubscriptions(productId: sku)
        }

        let result: StoreKit.Product.PurchaseResult
        do {
            // iOS 17.0+, tvOS 17.0+, macOS 15.2+: Use purchase(confirmIn:options:) for better purchase confirmation UI
            // Reference: https://developer.apple.com/documentation/storekit/product/purchase(confirmin:options:)-6dj6y
            #if os(iOS) || os(tvOS) || os(visionOS)
            // iOS/tvOS/visionOS: Use UIWindowScene (not available on watchOS)
            if #available(iOS 17.0, tvOS 17.0, visionOS 1.0, *) {
                result = try await purchaseWithActiveScene(product: product, options: options, sku: sku)
            } else {
                result = try await product.purchase(options: options)
            }
            #elseif os(macOS)
            // macOS: Use NSWindow (macOS 15.2+)
            if #available(macOS 15.2, *) {
                let window: NSWindow? = await MainActor.run {
                    NSApplication.shared.windows.first
                }
                guard let window else {
                    let error = makePurchaseError(code: .purchaseError, message: "Could not find window")
                    emitPurchaseError(error)
                    throw error
                }
                result = try await product.purchase(confirmIn: window, options: options)
            } else {
                result = try await product.purchase(options: options)
            }
            #else
            result = try await product.purchase(options: options)
            #endif
        } catch {
            // Enhanced error handling for promotional offers
            if iosProps.withOffer != nil {
                OpenIapLog.error("Purchase with promotional offer failed: \(error.localizedDescription)")
                let enhancedMessage = """
                    Promotional offer purchase failed: \(error.localizedDescription)

                    Common causes:
                    1. Invalid signature - verify server generates correct signature with exact parameter order
                    2. Empty appAccountToken - ensure empty string ('') is used in signature, not null
                    3. Sandbox testing - ensure current subscription has expired before testing offers
                    4. Offer eligibility - user may not be eligible for this promotional offer
                    """
                let purchaseError = makePurchaseError(
                    code: .purchaseError,
                    productId: sku,
                    message: enhancedMessage,
                    debugMessage: error.localizedDescription
                )
                emitPurchaseError(purchaseError)
                throw purchaseError
            }

            // Use PurchaseError.wrap to automatically map errors (including StoreKitError.userCancelled)
            let purchaseError = PurchaseError.wrap(error, fallback: .purchaseError, productId: sku)
            emitPurchaseError(purchaseError)
            throw purchaseError
        }

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            if product.type == .autoRenewable, isInactiveSubscriptionTransaction(transaction) {
                await transaction.finish()
                await state.removePending(id: String(transaction.id))
                OpenIapLog.debug("""
                    🧹 [requestPurchase] Finished inactive subscription transaction before emitting:
                    - SKU: \(transaction.productID)
                    - Transaction ID: \(transaction.id)
                    - Expiration: \(transaction.expirationDate?.description ?? "none")
                    - Revoked: \(transaction.revocationDate?.description ?? "none")
                    - Upgraded: \(transaction.isUpgraded)
                    """)
                let error = makePurchaseError(
                    code: .purchaseError,
                    productId: sku,
                    message: "Finished an inactive subscription transaction. Please retry the purchase."
                )
                emitPurchaseError(error)
                throw error
            }
            let purchase = await StoreKitTypesBridge.purchase(from: transaction, jwsRepresentation: verification.jwsRepresentation)
            let transactionId = String(transaction.id)
            let shouldAutoFinish = iosProps.andDangerouslyFinishTransactionAutomatically == true

            let isSubscription = product.type == .autoRenewable

            OpenIapLog.debug("""
                🎯 [requestPurchase] Purchase successful:
                - Requested SKU: \(sku)
                - Returned Product: \(transaction.productID)
                - Transaction ID: \(transactionId)
                - Purchase Date: \(transaction.purchaseDate)
                - Product Type: \(product.type == .autoRenewable ? "subscription" : "non-subscription")
                - SKU matches: \(transaction.productID == sku)
                - Note: \(isSubscription ? "Subscription transactions will be emitted via Transaction.updates" : "Emitting directly")
                """)

            let shouldEmit = await state.recordPurchaseUpdateEmission(
                id: transactionId,
                pendingTransaction: shouldAutoFinish ? nil : transaction
            )
            // Dedupe only controls listener delivery; auto-finish must still
            // complete the StoreKit transaction lifecycle for replayed updates.
            if shouldAutoFinish {
                await transaction.finish()
                await state.removePending(id: transactionId)
            }

            // StoreKit can replay unfinished transactions through multiple paths during a
            // connection session. Default listeners receive each transaction id once;
            // non-deduping listeners can opt into the replay for diagnostics.
            emitPurchaseUpdate(
                purchase,
                isDuplicate: !shouldEmit,
                duplicateSource: "requestPurchase",
                duplicateTransactionId: transactionId
            )

            return .purchase(purchase)

        case .userCancelled:
            let error = makePurchaseError(code: .userCancelled, productId: sku)
            emitPurchaseError(error)
            throw error

        case .pending:
            let error = makePurchaseError(code: .deferredPayment, productId: sku)
            emitPurchaseError(error)
            throw error

        @unknown default:
            let error = makePurchaseError(code: .unknown, productId: sku)
            emitPurchaseError(error)
            throw error
        }
    }

    /// Buy the currently promoted product.
    /// See: https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios
    @available(*, deprecated, message: "Use promotedProductListenerIOS + requestPurchase instead")
    public func requestPurchaseOnPromotedProductIOS() async throws -> Bool {
        #if os(iOS)
        guard let sku = await state.promotedProductIdentifier() else {
            return false
        }

        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        let request: RequestPurchaseProps

        switch product.type {
        case .autoRenewable, .nonRenewable:
            let iosProps = RequestSubscriptionIosProps(sku: sku)
            request = RequestPurchaseProps(
                request: .subscription(RequestSubscriptionPropsByPlatforms(android: nil, ios: iosProps)),
                type: .subs
            )
        default:
            let iosProps = RequestPurchaseIosProps(sku: sku)
            request = RequestPurchaseProps(
                request: .purchase(RequestPurchasePropsByPlatforms(android: nil, ios: iosProps)),
                type: .inApp
            )
        }

        _ = try await requestPurchase(request)
        return true
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif
    }

    /// Restore non-consumable and active subscription purchases.
    /// See: https://openiap.dev/docs/apis/restore-purchases
    public func restorePurchases() async throws -> Void {
        _ = try await syncIOS()
    }

    /// List the user's purchases held by StoreKit. By default reads `Transaction.all` (the
    /// full history including refunded / revoked entries). Pass
    /// `onlyIncludeActiveItemsIOS = true` to switch to `Transaction.currentEntitlements`,
    /// which narrows the result to active non-consumables and live subscriptions.
    ///
    /// - Parameter options: Optional iOS-specific flags. `onlyIncludeActiveItemsIOS`
    ///   toggles between `Transaction.all` (default) and `Transaction.currentEntitlements`.
    ///   `alsoPublishToEventListenerIOS` re-emits each purchase on the update listener.
    /// - Returns: An array of `Purchase` values matching the selected scope.
    /// - Throws: When the StoreKit query fails.
    ///
    /// See: https://openiap.dev/docs/apis/get-available-purchases
    public func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] {
        try await ensureConnection()
        let onlyActive = options?.onlyIncludeActiveItemsIOS ?? false
        var purchasedItems: [Purchase] = []

        for await verification in (onlyActive ? Transaction.currentEntitlements : Transaction.all) {
            do {
                let transaction = try checkVerified(verification)

                if onlyActive, let expirationDate = transaction.expirationDate, expirationDate <= Date() {
                    continue
                }

                let purchase = await StoreKitTypesBridge.purchase(
                    from: transaction,
                    jwsRepresentation: verification.jwsRepresentation
                )
                purchasedItems.append(purchase)
            } catch {
                OpenIapLog.error("getAvailablePurchases: failed to verify transaction: \(error)")
                continue
            }
        }

        OpenIapLog.debug("🔍 getAvailablePurchases: \(purchasedItems.count) purchases (onlyActive=\(onlyActive))")
        return purchasedItems
    }

    /// Get the full StoreKit 2 transaction history as `PurchaseIOS` values.
    /// Requires the SK2ConsumableTransactionHistory Info.plist key in the host app
    /// for finished consumables to be included in `Transaction.all` (iOS 18+).
    /// Unlike `getAvailablePurchases(_:)`, this method always reads from
    /// `Transaction.all` and returns the iOS-specific `PurchaseIOS` shape rather than
    /// the cross-platform `Purchase` type.
    ///
    /// See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
    public func getAllTransactionsIOS() async throws -> [PurchaseIOS] {
        try await ensureConnection()
        var transactions: [PurchaseIOS] = []

        for await verification in Transaction.all {
            do {
                let transaction = try checkVerified(verification)
                let purchase = await StoreKitTypesBridge.purchaseIOS(
                    from: transaction,
                    jwsRepresentation: verification.jwsRepresentation
                )
                transactions.append(purchase)
            } catch {
                OpenIapLog.error("getAllTransactionsIOS: failed to verify transaction: \(error)")
                continue
            }
        }

        OpenIapLog.debug("🔍 getAllTransactionsIOS: \(transactions.count) transactions")
        return transactions
    }

    // MARK: - Transaction Management

    /// Complete a purchase transaction. Call after server-side verification to remove it
    /// from the StoreKit queue.
    ///
    /// - Parameters:
    ///   - purchase: The `PurchaseInput` to finalize.
    ///   - isConsumable: Pass `true` for consumables (re-buyable like coins), `false` for
    ///     subscriptions and non-consumables. Affects only Android consume vs acknowledge;
    ///     iOS always calls `Transaction.finish()`.
    /// - Throws: When the platform finalization fails.
    /// - Important: iOS unfinished transactions replay on every app launch. (Android purchases
    ///   must be acknowledged within 3 days, but that path lives in the Android module.)
    ///
    /// See: https://openiap.dev/docs/apis/finish-transaction
    public func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void {
        try await ensureConnection()
        let identifier = purchase.id

        if let pending = await state.getPending(id: identifier) {
            await pending.finish()
            await state.removePending(id: identifier)
            return
        }

        guard let numericId = UInt64(identifier) else {
            let error = makePurchaseError(code: .purchaseError, message: "Invalid transaction identifier")
            emitPurchaseError(error)
            throw error
        }

        for await result in Transaction.unfinished {
            do {
                let transaction = try checkVerified(result)
                if transaction.id == numericId {
                    await transaction.finish()
                    await state.removePending(id: identifier)
                    return
                }
            } catch {
                OpenIapLog.debug("⚠️ finishTransaction unfinished lookup failed: \(error.localizedDescription)")
            }
        }

        if let result = await Transaction.latest(for: purchase.productId) {
            do {
                let transaction = try checkVerified(result)
                if transaction.id == numericId {
                    await transaction.finish()
                    await state.removePending(id: identifier)
                    return
                }
            } catch {
                OpenIapLog.debug("⚠️ finishTransaction latest lookup failed: \(error.localizedDescription)")
            }
        }

        OpenIapLog.debug("ℹ️ finishTransaction skipped: transaction \(identifier) is not pending/unfinished/latest; treating as already finished")
    }

    /// List unfinished StoreKit transactions.
    /// See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
    public func getPendingTransactionsIOS() async throws -> [PurchaseIOS] {
        try await ensureConnection()
        let snapshot = await state.pendingSnapshot()
        var purchases: [PurchaseIOS] = []
        for transaction in snapshot {
            purchases.append(await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: nil))
        }
        return purchases
    }

    /// Clear pending transactions in the queue (sandbox helper).
    /// See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
    public func clearTransactionIOS() async throws -> Bool {
        try await ensureConnection()
        for await result in Transaction.unfinished {
            do {
                let transaction = try checkVerified(result)
                await transaction.finish()
                await state.removePending(id: String(transaction.id))
            } catch {
                continue
            }
        }
        return true
    }

    /// Check whether a transaction's JWS verification passed.
    /// See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
    public func isTransactionVerifiedIOS(sku: String) async throws -> Bool {
        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else { return false }
        do {
            _ = try checkVerified(result)
            return true
        } catch {
            return false
        }
    }

    /// Return the JWS string for a transaction.
    /// See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
    public func getTransactionJwsIOS(sku: String) async throws -> String? {
        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else {
            let error = makePurchaseError(code: .skuNotFound, productId: sku)
            emitPurchaseError(error)
            throw error
        }
        return result.jwsRepresentation
    }

    // MARK: - Validation

    /// Get base64 receipt data (legacy validation).
    /// See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
    public func getReceiptDataIOS() async throws -> String? {
        guard let receiptURL = Bundle.main.appStoreReceiptURL,
              FileManager.default.fileExists(atPath: receiptURL.path) else {
            return nil
        }
        let data = try Data(contentsOf: receiptURL)
        return data.base64EncodedString()
    }

    /// Deprecated. Legacy App Store receipt validation. Use `verifyPurchase` instead.
    /// See: https://openiap.dev/docs/apis/ios/validate-receipt-ios
    @available(*, deprecated, message: "Use verifyPurchase")
    public func validateReceiptIOS(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS {
        try await performVerifyPurchaseIOS(props)
    }

    private func performVerifyPurchaseIOS(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS {
        let receiptData = (try? await getReceiptDataIOS()) ?? ""
        var latestPurchase: Purchase? = nil
        var jws: String = ""
        var isValid = false

        // Apple options with sku is required
        guard let appleOptions = props.apple, !appleOptions.sku.isEmpty else {
            throw makePurchaseError(
                code: .developerError,
                message: "Apple verification requires apple options with sku"
            )
        }

        do {
            let product = try await storeProduct(for: appleOptions.sku)
            if let result = await product.latestTransaction {
                jws = result.jwsRepresentation
                let transaction = try checkVerified(result)
                latestPurchase = .purchaseIos(await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: result.jwsRepresentation))
                isValid = true
            }
        } catch {
            isValid = false
        }

        return VerifyPurchaseResultIOS(
            isValid: isValid,
            jwsRepresentation: jws,
            latestTransaction: latestPurchase,
            receiptData: receiptData
        )
    }

    /// Deprecated. Use verifyPurchase instead — same input/output shape.
    /// See: https://openiap.dev/docs/apis/validate-receipt
    @available(*, deprecated, message: "Use verifyPurchase")
    public func validateReceipt(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        try await verifyPurchase(props)
    }

    /// Verify a purchase against your own backend (returns isValid + raw store metadata).
    /// See: https://openiap.dev/docs/features/validation#verify-purchase
    public func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        try await ensureConnection()
        let iosResult = try await performVerifyPurchaseIOS(props)
        return .verifyPurchaseResultIos(iosResult)
    }

    /// Verify via a managed provider (currently IAPKit; the PurchaseVerificationProvider enum exposes only Iapkit today).
    /// See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
    public func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        try await ensureConnection()
        guard props.provider == .iapkit else {
            throw makePurchaseError(code: .featureNotSupported, message: "Provider \(props.provider.rawValue) is not supported")
        }
        guard let iapkit = props.iapkit else {
            throw makePurchaseError(code: .developerError, message: "Missing IAPKit verification parameters")
        }
        let result = try await verifyPurchaseWithIapkit(props: iapkit)
        return VerifyPurchaseWithProviderResult(
            iapkit: result,
            provider: props.provider
        )
    }

    // NOTE: This Apple module intentionally sends only Apple payloads to IAPKit.
    // The buildIapkitPayload function has a .google branch for type completeness,
    // but it is never invoked from this module.
    private func verifyPurchaseWithIapkit(props: RequestVerifyPurchaseWithIapkitProps) async throws -> RequestVerifyPurchaseWithIapkitResult {
        // URL is a constant and cannot fail, so force unwrap is safe
        let url = URL(string: "https://kit.openiap.dev/v1/purchase/verify")!

        // On Apple, only Apple verification is supported
        guard props.apple != nil else {
            throw makePurchaseError(code: .developerError, message: "IAPKit verification on Apple requires an apple payload")
        }
        let store: IapStore = .apple
        let body = try buildIapkitPayload(props: props, store: store)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey = props.apiKey, apiKey.isEmpty == false {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body

        // Log request details for debugging
        OpenIapLog.debug("IAPKit request URL: \(url.absoluteString)")
        let requestBody = String(data: body, encoding: .utf8) ?? "<\(body.count) non-UTF8 bytes>"
        OpenIapLog.debug("IAPKit request body: \(requestBody), bytes=\(body.count)")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw makePurchaseError(code: .networkError, message: "Invalid response")
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            let responseBody = String(data: data, encoding: .utf8) ?? ""
            OpenIapLog.warn("verifyPurchaseWithProvider failed (HTTP \(httpResponse.statusCode))")
            // Extract concise error message from IAPKit response
            var errorMessage = "HTTP \(httpResponse.statusCode)"
            if let jsonData = responseBody.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                errorMessage = extractIapkitErrorMessage(from: json) ?? errorMessage
            }
            throw makePurchaseError(code: .receiptFailed, message: errorMessage)
        }

        // Log only response metadata; the body can contain receipt details.
        OpenIapLog.debug("IAPKit verification response received: bytes=\(data.count)")

        // Parse manually to handle extra fields from IAPKit
        // API response format: { "store": "apple", "isValid": true, "state": "PURCHASED" }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            OpenIapLog.warn("Failed to parse IAPKit verification response")
            throw makePurchaseError(code: .receiptFailed, message: "Unable to parse verification response")
        }

        // Check for error response format: { "errors": [{ "code": "...", "message": "..." }] }
        if let errors = json["errors"] as? [[String: Any]], let firstError = errors.first {
            let errorMessage = firstError["message"] as? String ?? "Unknown error"
            let errorCode = firstError["code"] as? String ?? "unknown"
            OpenIapLog.warn("IAPKit verification error: \(errorCode) - \(errorMessage)")
            throw makePurchaseError(code: .receiptFailed, message: errorMessage)
        }

        let isValid = (json["isValid"] as? Bool) ?? false
        let stateString = json["state"] as? String ?? "UNKNOWN"
        // IAPKit API returns UPPER_SNAKE_CASE (e.g., "PURCHASED", "PENDING_ACKNOWLEDGMENT")
        // Swift enum expects lower-kebab-case (e.g., "purchased", "pending-acknowledgment")
        let normalizedState = stateString.lowercased().replacingOccurrences(of: "_", with: "-")
        let parsedState = IapkitPurchaseState(rawValue: normalizedState) ?? .unknown
        let storeString = json["store"] as? String
        let parsedStore = storeString.flatMap { IapStore(rawValue: $0) } ?? store
        OpenIapLog.info("IAPKit verification result: store=\(parsedStore.rawValue), isValid=\(isValid), state=\(parsedState.rawValue)")
        return RequestVerifyPurchaseWithIapkitResult(isValid: isValid, state: parsedState, store: parsedStore)
    }

    private struct IapkitApplePayload: Codable {
        let store: IapStore
        let jws: String
    }

    private struct IapkitGooglePayload: Codable {
        let store: IapStore
        let purchaseToken: String
    }

    private func buildIapkitPayload(props: RequestVerifyPurchaseWithIapkitProps, store: IapStore) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        switch store {
        case .apple:
            guard let apple = props.apple else {
                throw makePurchaseError(code: .developerError, message: "Apple verification parameters are required")
            }
            guard apple.jws.isEmpty == false else {
                throw makePurchaseError(code: .developerError, message: "JWS is required")
            }
            let payload = IapkitApplePayload(
                store: store,
                jws: apple.jws
            )
            return try encoder.encode(payload)
        case .google, .horizon:
            guard let google = props.google else {
                throw makePurchaseError(code: .developerError, message: "Google verification parameters are required")
            }
            guard google.purchaseToken.isEmpty == false else {
                throw makePurchaseError(code: .developerError, message: "purchaseToken is required")
            }
            let payload = IapkitGooglePayload(
                store: store,
                purchaseToken: google.purchaseToken
            )
            return try encoder.encode(payload)
        case .unknown:
            throw makePurchaseError(code: .developerError, message: "Unknown store type")
        }
    }

    /// Extract concise error message from IAPKit error response.
    /// IAPKit returns nested error structures - we extract the deepest originalError for clarity.
    private func extractIapkitErrorMessage(from json: [String: Any]) -> String? {
        // Try to get details.originalError first (deepest level)
        if let details = json["details"] as? [String: Any],
           let originalError = details["originalError"] as? String {
            // originalError might be a JSON string, try to parse it
            if let data = originalError.data(using: .utf8),
               let nested = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                return extractIapkitErrorMessage(from: nested) ?? originalError
            }
            return originalError
        }

        // Try errors array format: { "errors": [{ "message": "..." }] }
        if let errors = json["errors"] as? [[String: Any]], let firstError = errors.first {
            return extractIapkitErrorMessage(from: firstError)
        }

        // Try message field, but avoid the verbose nested JSON string
        if let message = json["message"] as? String, !message.contains("{\"error\"") {
            return message
        }

        // Fallback to error code
        return json["error"] as? String
    }

    // MARK: - Store Information

    /// Return the user's storefront country code.
    /// See: https://openiap.dev/docs/apis/get-storefront
    public func getStorefront() async throws -> String {
        try await ensureConnection()
        guard let storefront = await Storefront.current else {
            let error = makePurchaseError(code: .unknown)
            emitPurchaseError(error)
            throw error
        }
        return storefront.countryCode
    }

    /// Deprecated. Use cross-platform `getStorefront` instead.
    /// See: https://openiap.dev/docs/apis/ios/get-storefront-ios
    public func getStorefrontIOS() async throws -> String {
        try await getStorefront()
    }

    /// Get the app transaction that represents the user's purchase of the app
    /// - Note: Available on iOS 16.0+, macOS 14.0+, tvOS 16.0+, watchOS 9.0+
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/apptransaction
    ///
    /// See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
    @available(iOS 16.0, macOS 14.0, tvOS 16.0, watchOS 9.0, *)
    public func getAppTransactionIOS() async throws -> AppTransaction? {
        try await ensureConnection()
        let verification = try await StoreKit.AppTransaction.shared
        switch verification {
        case .verified(let transaction):
            return mapAppTransaction(transaction)
        case .unverified:
            return nil
        }
    }

    // MARK: - Subscription Management

    /// Get details of all currently active subscriptions.
    /// See: https://openiap.dev/docs/apis/get-active-subscriptions
    public func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] {
        try await ensureConnection()
        var allSubscriptions: [ActiveSubscription] = []
        for await verification in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(verification)
                guard transaction.productType == .autoRenewable else { continue }

                // Skip upgraded subscriptions - they've been replaced
                if transaction.isUpgraded {
                    continue
                }

                if let ids = subscriptionIds, ids.contains(transaction.productID) == false {
                    continue
                }
                let expiration = transaction.expirationDate
                // If expiration date is nil, treat as inactive (expired or invalid)
                // This prevents treating subscriptions without expiration dates as active
                let isActive = expiration.map { $0 > Date() } ?? false
                let dayDelta = expiration.map { Calendar.current.dateComponents([.day], from: Date(), to: $0).day ?? 0 }
                let daysUntilExpiration = dayDelta.map { Double($0) }
                let willExpireSoon = dayDelta.map { $0 < 7 } ?? false
                let environment: String?
                if #available(iOS 16.0, tvOS 16.0, watchOS 9.0, *) {
                    environment = transaction.environment.rawValue
                } else {
                    environment = nil
                }

                // Fetch renewal info for subscription
                let renewalInfo = await StoreKitTypesBridge.subscriptionRenewalInfoIOS(for: transaction)

                allSubscriptions.append(
                    ActiveSubscription(
                        autoRenewingAndroid: nil,
                        daysUntilExpirationIOS: daysUntilExpiration,
                        environmentIOS: environment,
                        expirationDateIOS: expiration?.milliseconds,
                        isActive: isActive,
                        productId: transaction.productID,
                        purchaseToken: verification.jwsRepresentation,
                        renewalInfoIOS: renewalInfo,
                        transactionDate: transaction.purchaseDate.milliseconds,
                        transactionId: String(transaction.id),
                        willExpireSoon: willExpireSoon
                    )
                )
            } catch {
                continue
            }
        }

        OpenIapLog.debug("📊 Returning \(allSubscriptions.count) active subscriptions")

        // Upgraded subscriptions are already filtered out by transaction.isUpgraded check
        // Return all remaining subscriptions (active, downgraded, and cancelled)
        return allSubscriptions
    }

    /// Check whether the user has any active subscription.
    /// See: https://openiap.dev/docs/apis/has-active-subscriptions
    public func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool {
        let subscriptions = try await getActiveSubscriptions(subscriptionIds)
        return subscriptions.contains { $0.isActive }
    }

    /// Show the subscription management interface
    /// - Note: Available on iOS 15.0+, iPadOS 15.0+, Mac Catalyst 15.0+, macOS 14.0+, visionOS 1.0+. Not available on tvOS (subscriptions are managed in Settings > Accounts) or watchOS.
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)
    ///
    /// See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
    public func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {
        try await ensureConnection()
        // tvOS: AppStore.showManageSubscriptions not available on tvOS (subscriptions managed in Settings > Accounts)
        // watchOS: No window scene UI for showManageSubscriptions
        #if !os(tvOS) && !os(watchOS)
            #if canImport(UIKit)
            let scene: UIWindowScene? = await MainActor.run {
                UIApplication.shared.connectedScenes.first as? UIWindowScene
            }
            guard let scene else {
                throw makePurchaseError(code: .unknown)
            }
            try await AppStore.showManageSubscriptions(in: scene)
            #elseif canImport(AppKit)
            // macOS: Needs NSWindow for showManageSubscriptions
            // For now, throw unsupported - will need proper window integration
            throw makePurchaseError(code: .featureNotSupported, message: "macOS window integration required")
            #endif
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif // !os(tvOS) && !os(watchOS)
    }

    /// Get subscription status objects from StoreKit 2.
    /// See: https://openiap.dev/docs/apis/ios/subscription-status-ios
    public func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] {
        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        guard let subscription = product.subscription else {
            let error = makePurchaseError(code: .skuNotFound, productId: sku)
            emitPurchaseError(error)
            throw error
        }

        do {
            let statuses = try await subscription.status
            return statuses.map { status in
                let renewalInfo: RenewalInfoIOS?
                switch status.renewalInfo {
                case .verified(let info):
                    let jsonString = String(data: info.jsonRepresentation, encoding: .utf8) ?? info.jsonRepresentation.base64EncodedString()
                    renewalInfo = RenewalInfoIOS(
                        autoRenewPreference: info.autoRenewPreference,
                        jsonRepresentation: jsonString,
                        willAutoRenew: info.willAutoRenew
                    )
                case .unverified:
                    renewalInfo = nil
                }
                return SubscriptionStatusIOS(
                    renewalInfo: renewalInfo,
                    state: String(describing: status.state)
                )
            }
        } catch {
            let purchaseError = makePurchaseError(code: .serviceError, message: error.localizedDescription)
            emitPurchaseError(purchaseError)
            throw purchaseError
        }
    }

    /// Get the user's current entitlement for a product.
    /// See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
    public func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS? {
        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        guard let result = await product.currentEntitlement else { return nil }
        do {
            let transaction = try checkVerified(result)
            return await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: result.jwsRepresentation)
        } catch {
            let error = makePurchaseError(code: .transactionValidationFailed, message: error.localizedDescription)
            emitPurchaseError(error)
            throw error
        }
    }

    /// Get the latest verified transaction for a product.
    /// See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
    public func latestTransactionIOS(sku: String) async throws -> PurchaseIOS? {
        try await ensureConnection()
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else { return nil }
        do {
            let transaction = try checkVerified(result)
            return await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: result.jwsRepresentation)
        } catch {
            let error = makePurchaseError(code: .transactionValidationFailed, message: error.localizedDescription)
            emitPurchaseError(error)
            throw error
        }
    }

    // MARK: - Refunds

    /// Begin a refund request for a transaction
    /// - Note: Available on iOS 15.0+, iPadOS 15.0+, Mac Catalyst 15.0+, macOS 12.0+, visionOS 1.0+. Not available on tvOS or watchOS.
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/transaction/3803220-beginrefundrequest
    ///
    /// See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
    public func beginRefundRequestIOS(sku: String) async throws -> String? {
        try await ensureConnection()
        // tvOS: Transaction.beginRefundRequest not available on tvOS
        // watchOS: Transaction.beginRefundRequest not available on watchOS
        #if !os(tvOS) && !os(watchOS)
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else {
            let error = makePurchaseError(code: .skuNotFound, productId: sku)
            emitPurchaseError(error)
            throw error
        }

        let transaction = try checkVerified(result)

        #if canImport(UIKit)
        let scene: UIWindowScene? = await MainActor.run {
            UIApplication.shared.connectedScenes.first as? UIWindowScene
        }
        guard let scene else {
            let error = makePurchaseError(code: .purchaseError, message: "Cannot find window scene")
            emitPurchaseError(error)
            throw error
        }
        let status = try await transaction.beginRefundRequest(in: scene)
        switch status {
        case .success:
            return "success"
        case .userCancelled:
            return "userCancelled"
        @unknown default:
            return nil
        }
        #elseif canImport(AppKit)
        // macOS: Needs NSViewController for beginRefundRequest
        // For now, throw unsupported - will need proper window integration
        throw makePurchaseError(code: .featureNotSupported, message: "macOS window integration required")
        #endif
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif // !os(tvOS) && !os(watchOS)
    }

    // MARK: - Misc

    /// Check if the user is eligible for an introductory offer for a subscription group
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/product/subscriptioninfo/iseligibleforintrooffer(for:)
    ///
    /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
    public func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool {
        try await ensureConnection()
        return await StoreKit.Product.SubscriptionInfo.isEligibleForIntroOffer(for: groupID)
    }

    /// Sync the user's in-app purchases with the App Store
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/appstore/sync()
    ///
    /// See: https://openiap.dev/docs/apis/ios/sync-ios
    public func syncIOS() async throws -> Bool {
        try await ensureConnection()
        do {
            try await AppStore.sync()
            return true
        } catch {
            throw makePurchaseError(code: .serviceError, message: error.localizedDescription)
        }
    }

    /// Present a sheet for redeeming subscription offer codes
    /// - Note: Only available on iOS 14.0+ and Mac Catalyst. Not available on tvOS, macOS, or watchOS
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/skpaymentqueue/3566726-presentcoderedemptionsheet
    ///
    /// See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
    public func presentCodeRedemptionSheetIOS() async throws -> Bool {
        try await ensureConnection()
        // presentCodeRedemptionSheet is only available on iOS, not tvOS/watchOS/macOS
        #if os(iOS)
        await MainActor.run {
            SKPaymentQueue.default().presentCodeRedemptionSheet()
        }
        return true
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif // os(iOS)
    }

    /// Present the manage-subscriptions sheet.
    /// See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
    public func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] {
        try await deepLinkToSubscriptions(nil)
        return []
    }

    // MARK: - External Purchase (iOS 17.4+, macOS 14.4+, tvOS 17.4+, visionOS 1.1+)

    /// Check eligibility for the external purchase notice sheet (iOS 17.4+).
    /// See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
    public func canPresentExternalPurchaseNoticeIOS() async throws -> Bool {
        try await ensureConnection()
        // iOS 17.4+, macOS 14.4+, tvOS 17.4+, watchOS 10.4+, visionOS 1.1+: ExternalPurchase.canPresent
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchase/canpresent
        if #available(iOS 17.4, macOS 14.4, tvOS 17.4, watchOS 10.4, visionOS 1.1, *) {
            return await ExternalPurchase.canPresent
        } else {
            return false
        }
    }

    /// Present the external purchase notice sheet (iOS 17.4+).
    /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
    public func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS {
        try await ensureConnection()
        // iOS 17.4+, macOS 14.4+, tvOS 17.4+, watchOS 10.4+, visionOS 1.1+: ExternalPurchase.presentNoticeSheet
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
        if #available(iOS 17.4, macOS 14.4, tvOS 17.4, watchOS 10.4, visionOS 1.1, *) {
            guard await ExternalPurchase.canPresent else {
                throw makePurchaseError(
                    code: .featureNotSupported,
                    message: "External purchase notice sheet is not available"
                )
            }

            do {
                let result = try await ExternalPurchase.presentNoticeSheet()
                switch result {
                case .continuedWithExternalPurchaseToken(let token):
                    // Return the token for reporting to Apple's External Purchase Server API
                    // The token is a String type in StoreKit
                    return ExternalPurchaseNoticeResultIOS(
                        error: nil,
                        externalPurchaseToken: token,
                        result: .continue
                    )
                case .cancelled:
                    // User dismissed the notice sheet
                    return ExternalPurchaseNoticeResultIOS(
                        error: nil,
                        externalPurchaseToken: nil,
                        result: .dismissed
                    )
                @unknown default:
                    // Handle future cases gracefully
                    throw makePurchaseError(
                        code: .unknown,
                        message: "Unexpected result from external purchase notice sheet"
                    )
                }
            } catch let error as PurchaseError {
                return ExternalPurchaseNoticeResultIOS(
                    error: error.message,
                    externalPurchaseToken: nil,
                    result: .dismissed
                )
            } catch {
                let purchaseError = makePurchaseError(
                    code: .serviceError,
                    message: "Failed to present external purchase notice: \(error.localizedDescription)"
                )
                return ExternalPurchaseNoticeResultIOS(
                    error: purchaseError.message,
                    externalPurchaseToken: nil,
                    result: .dismissed
                )
            }
        } else {
            throw makePurchaseError(
                code: .featureNotSupported,
                message: "External purchase notice sheet requires iOS 17.4+, macOS 14.4+, tvOS 17.4+, watchOS 10.4+, or visionOS 1.1+"
            )
        }
    }

    /// Present an external purchase link, StoreKit External (iOS 16+).
    /// See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
    public func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS {
        try await ensureConnection()
        // UIApplication.open is available on iOS/tvOS/visionOS but not watchOS/macOS
        // Reference: https://developer.apple.com/documentation/uikit/uiapplication/1648685-open
        #if os(iOS) || os(tvOS) || os(visionOS)
        guard let customLink = URL(string: url) else {
            return ExternalPurchaseLinkResultIOS(
                error: "Invalid URL",
                success: false
            )
        }

        return await MainActor.run {
            if UIApplication.shared.canOpenURL(customLink) {
                UIApplication.shared.open(customLink, options: [:]) { success in
                    // Completion handler - link opened
                }
                return ExternalPurchaseLinkResultIOS(error: nil, success: true)
            } else {
                return ExternalPurchaseLinkResultIOS(
                    error: "Cannot open URL",
                    success: false
                )
            }
        }
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif // os(iOS) || os(tvOS) || os(visionOS)
    }

    // MARK: - ExternalPurchaseCustomLink (iOS 18.1+)

    /// Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
    /// See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
    public func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool {
        try await ensureConnection()
        // iOS 18.1+: ExternalPurchaseCustomLink.isEligible
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *) {
            return await ExternalPurchaseCustomLink.isEligible
        } else {
            return false
        }
    }

    /// Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
    /// See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
    public func getExternalPurchaseCustomLinkTokenIOS(
        _ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
    ) async throws -> ExternalPurchaseCustomLinkTokenResultIOS {
        try await ensureConnection()
        // iOS 18.1+: ExternalPurchaseCustomLink.token(for:)
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *) {
            guard await ExternalPurchaseCustomLink.isEligible else {
                return ExternalPurchaseCustomLinkTokenResultIOS(
                    error: "App is not eligible for ExternalPurchaseCustomLink",
                    token: nil
                )
            }

            do {
                // Token type is a String parameter, use enum's rawValue directly
                guard let token = try await ExternalPurchaseCustomLink.token(for: tokenType.rawValue) else {
                    return ExternalPurchaseCustomLinkTokenResultIOS(
                        error: "Failed to retrieve external purchase token",
                        token: nil
                    )
                }
                return ExternalPurchaseCustomLinkTokenResultIOS(
                    error: nil,
                    token: token.value
                )
            } catch {
                return ExternalPurchaseCustomLinkTokenResultIOS(
                    error: "Failed to get external purchase token: \(error.localizedDescription)",
                    token: nil
                )
            }
        } else {
            throw makePurchaseError(
                code: .featureNotSupported,
                message: "ExternalPurchaseCustomLink requires iOS 18.1+, macOS 15.1+, tvOS 18.1+, watchOS 11.1+, or visionOS 2.1+"
            )
        }
    }

    /// Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
    /// See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
    public func showExternalPurchaseCustomLinkNoticeIOS(
        _ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
    ) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS {
        try await ensureConnection()
        // iOS 18.1+: ExternalPurchaseCustomLink.showNotice(type:)
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, watchOS 11.1, visionOS 2.1, *) {
            guard await ExternalPurchaseCustomLink.isEligible else {
                return ExternalPurchaseCustomLinkNoticeResultIOS(
                    continued: false,
                    error: "App is not eligible for ExternalPurchaseCustomLink"
                )
            }

            do {
                let storeKitNoticeType: ExternalPurchaseCustomLink.NoticeType = switch noticeType {
                case .browser:
                    .browser
                }

                let result = try await ExternalPurchaseCustomLink.showNotice(type: storeKitNoticeType)
                switch result {
                case .continued:
                    return ExternalPurchaseCustomLinkNoticeResultIOS(
                        continued: true,
                        error: nil
                    )
                case .cancelled:
                    return ExternalPurchaseCustomLinkNoticeResultIOS(
                        continued: false,
                        error: nil
                    )
                @unknown default:
                    return ExternalPurchaseCustomLinkNoticeResultIOS(
                        continued: false,
                        error: "Unknown notice result"
                    )
                }
            } catch {
                return ExternalPurchaseCustomLinkNoticeResultIOS(
                    continued: false,
                    error: "Failed to show notice: \(error.localizedDescription)"
                )
            }
        } else {
            throw makePurchaseError(
                code: .featureNotSupported,
                message: "ExternalPurchaseCustomLink requires iOS 18.1+, macOS 15.1+, tvOS 18.1+, watchOS 11.1+, or visionOS 2.1+"
            )
        }
    }

    // MARK: - Event Listener Registration

    public func purchaseUpdatedListener(
        _ listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions? = nil
    ) -> Subscription {
        let subscription = Subscription(eventType: .purchaseUpdated)
        Task {
            await state.addPurchaseUpdatedListener(
                id: subscription.id,
                listener: listener,
                options: options
            )
        }
        return subscription
    }

    public func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        let subscription = Subscription(eventType: .purchaseError)
        Task { await state.addPurchaseErrorListener((subscription.id, listener)) }
        return subscription
    }

    public func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        let subscription = Subscription(eventType: .promotedProductIos)
        Task { [state] in
            let pendingSku = await state.addPromotedProductListener((subscription.id, listener))
            guard let pendingSku else { return }
            await MainActor.run {
                listener(pendingSku)
            }
        }
        return subscription
    }

    public func subscriptionBillingIssueListener(_ listener: @escaping SubscriptionBillingIssueListener) -> Subscription {
        let subscription = Subscription(eventType: .subscriptionBillingIssue)
        Task { await state.addSubscriptionBillingIssueListener((subscription.id, listener)) }
        startMessageListener()
        return subscription
    }

    public func removeListener(_ subscription: Subscription) {
        Task { await state.removeListener(id: subscription.id, type: subscription.eventType) }
        Task { await MainActor.run { subscription.onRemove?() } }
    }

    public func removeAllListeners() {
        Task { await state.removeAllListeners() }
    }

    // MARK: - Private Helpers

    private func performInitConnection(generation: UInt64) async throws -> Bool {
        try Task.checkCancellation()
        try connection.ensureCurrent(generation)

        if await state.isInitialized {
            return true
        }

        _ = try connection.getOrCreateProductManager(generation: generation)

        registerPromotedPurchaseObserverIfNeeded()

        try Task.checkCancellation()
        try connection.ensureCurrent(generation)
        if await state.isInitialized {
            return true
        }

        guard AppStore.canMakePayments else {
            emitPurchaseError(makePurchaseError(code: .iapNotAvailable))
            await state.setInitialized(false)
            return false
        }

        try Task.checkCancellation()
        try connection.ensureCurrent(generation)

        await state.setInitialized(true)
        try startTransactionListener(generation: generation)
        try startUnfinishedTransactionProcessing(generation: generation)
        let hasSubscriptionBillingIssueListeners = await state.hasSubscriptionBillingIssueListeners()
        try Task.checkCancellation()
        try connection.ensureCurrent(generation)
        if hasSubscriptionBillingIssueListeners {
            try startMessageListener(generation: generation)
        }
        try Task.checkCancellation()
        try connection.ensureCurrent(generation)
        return true
    }

    private func cancelConnectionTasksForDeinit() {
        let resources = connection.detachTasksForDeinit()
        resources.initTask?.cancel()
        resources.endTask?.cancel()
        resources.updateListenerTask?.cancel()
        resources.messageListenerTask?.cancel()
        resources.unfinishedTransactionTask?.cancel()
    }

    private func registerPromotedPurchaseObserverIfNeeded() {
        #if os(iOS)
        promotedPurchaseObserverLock.lock()
        let shouldRegister = !didRegisterPromotedPurchaseObserver &&
            !isPromotedPurchaseObserverTransitionInFlight
        if shouldRegister {
            isPromotedPurchaseObserverTransitionInFlight = true
        }
        promotedPurchaseObserverLock.unlock()

        guard shouldRegister else { return }

        let addObserver = {
            SKPaymentQueue.default().add(self)
        }

        if Thread.isMainThread {
            addObserver()
        } else {
            DispatchQueue.main.sync(execute: addObserver)
        }

        promotedPurchaseObserverLock.lock()
        didRegisterPromotedPurchaseObserver = true
        isPromotedPurchaseObserverTransitionInFlight = false
        promotedPurchaseObserverLock.unlock()
        #endif // os(iOS)
    }

    private func unregisterPromotedPurchaseObserverIfNeeded() {
        #if os(iOS)
        promotedPurchaseObserverLock.lock()
        let shouldUnregister = didRegisterPromotedPurchaseObserver &&
            !isPromotedPurchaseObserverTransitionInFlight
        if shouldUnregister {
            isPromotedPurchaseObserverTransitionInFlight = true
        }
        promotedPurchaseObserverLock.unlock()

        guard shouldUnregister else { return }

        let removeObserver = {
            SKPaymentQueue.default().remove(self)
        }

        if Thread.isMainThread {
            removeObserver()
        } else {
            DispatchQueue.main.sync(execute: removeObserver)
        }

        promotedPurchaseObserverLock.lock()
        didRegisterPromotedPurchaseObserver = false
        isPromotedPurchaseObserverTransitionInFlight = false
        promotedPurchaseObserverLock.unlock()
        #endif // os(iOS)
    }

    private func ensureConnection() async throws {
        if let endTask = connection.currentEndTask() {
            await endTask.value
        }

        if await state.isInitialized == false {
            _ = try await initConnection()
        }

        guard await state.isInitialized else {
            let error = makePurchaseError(code: .initConnection)
            emitPurchaseError(error)
            throw error
        }

        guard AppStore.canMakePayments else {
            let error = makePurchaseError(code: .iapNotAvailable)
            emitPurchaseError(error)
            throw error
        }
    }

    private func cleanupExistingState() async {
        let resources = connection.detachResourcesForCleanup()
        resources.updateListenerTask?.cancel()
        resources.messageListenerTask?.cancel()
        resources.unfinishedTransactionTask?.cancel()
        await state.reset()
        if let manager = resources.productManager { await manager.removeAll() }
    }

    private func storeProduct(for sku: String) async throws -> StoreKit.Product {
        guard let productManager = connection.currentProductManager() else {
            let error = makePurchaseError(code: .notPrepared)
            emitPurchaseError(error)
            throw error
        }

        if let product = await productManager.getProduct(productID: sku) {
            return product
        }

        let products = try await StoreKit.Product.products(for: [sku])
        guard let first = products.first else {
            let error = makePurchaseError(code: .skuNotFound, productId: sku)
            emitPurchaseError(error)
            throw error
        }
        await productManager.addProduct(first)
        return first
    }

    /// Resolves iOS purchase props from request params.
    /// Returns either RequestPurchaseIosProps or RequestSubscriptionIosProps based on request type.
    func resolveIOSPurchaseProps(from params: RequestPurchaseProps) throws -> any IosPropsProtocol {
        switch params.request {
        case let .purchase(platforms):
            if let ios = platforms.apple ?? platforms.ios {
                return ios
            }
        case let .subscription(platforms):
            if let ios = platforms.apple ?? platforms.ios {
                return ios
            }
        }
        throw makePurchaseError(code: .purchaseError, message: "Missing iOS purchase parameters")
    }

    private func startTransactionListener(generation: UInt64) throws {
        try connection.startTransactionListenerTask(generation: generation) {
            OpenIapLog.debug("🎧 [TransactionListener] Starting Transaction.updates listener...")
            return Task<Void, Error> { [weak self] in
                guard let self else {
                    OpenIapLog.debug("⚠️ [TransactionListener] Self is nil, exiting listener")
                    return
                }
                OpenIapLog.debug("✅ [TransactionListener] Listener task started, waiting for transactions...")
                for await verification in Transaction.updates {
                    if Task.isCancelled { return }
                    do {
                        guard await self.state.isInitialized else { continue }
                        let transaction = try self.checkVerified(verification)
                        let transactionId = String(transaction.id)

                        // Log all transaction details for debugging
                        OpenIapLog.debug("""
                            📦 Transaction received:
                            - ID: \(transactionId)
                            - Product: \(transaction.productID)
                            - purchaseDate: \(transaction.purchaseDate)
                            - subscriptionGroupID: \(transaction.subscriptionGroupID ?? "nil")
                            - revocationDate: \(transaction.revocationDate?.description ?? "nil")
                            """)

                        if transaction.productType == .autoRenewable,
                           self.isInactiveSubscriptionTransaction(transaction) {
                            await transaction.finish()
                            await self.state.removePending(id: transactionId)
                            OpenIapLog.debug("""
                                🧹 [TransactionListener] Finished inactive subscription update without emitting:
                                - SKU: \(transaction.productID)
                                - Transaction ID: \(transaction.id)
                                - Expiration: \(transaction.expirationDate?.description ?? "none")
                                - Revoked: \(transaction.revocationDate?.description ?? "none")
                                - Upgraded: \(transaction.isUpgraded)
                                """)
                            continue
                        }

                        if transaction.revocationDate != nil {
                            OpenIapLog.debug("⏭️ Skipping revoked transaction: \(transactionId)")
                            continue
                        }

                        let purchase = await StoreKitTypesBridge.purchase(from: transaction, jwsRepresentation: verification.jwsRepresentation)

                        // Default listeners receive each transaction id once per connection
                        // session. Non-deduping listeners can opt into StoreKit replays.
                        guard await self.state.recordPurchaseUpdateEmission(
                            id: transactionId,
                            pendingTransaction: transaction
                        ) else {
                            self.emitPurchaseUpdate(
                                purchase,
                                isDuplicate: true,
                                duplicateSource: "Transaction.updates",
                                duplicateTransactionId: transactionId
                            )
                            continue
                        }
                        OpenIapLog.debug("✅ [TransactionListener] Emitting transaction: \(transactionId) for product: \(transaction.productID)")
                        self.emitPurchaseUpdate(purchase)
                    } catch {
                        let purchaseError: PurchaseError
                        if let existing = error as? PurchaseError {
                            purchaseError = existing
                        } else {
                            purchaseError = makePurchaseError(code: .transactionValidationFailed, message: error.localizedDescription)
                        }
                        self.emitPurchaseError(purchaseError)
                    }
                }
            }
        }
    }

    private func startUnfinishedTransactionProcessing(generation: UInt64) throws {
        try connection.startUnfinishedTransactionTask(generation: generation) {
            Task { [weak self] in
                guard let self else { return }
                defer { self.connection.clearUnfinishedTransactionTask(generation: generation) }
                await self.processUnfinishedTransactions()
            }
        }
    }

    private func processUnfinishedTransactions() async {
        for await verification in Transaction.unfinished {
            if Task.isCancelled { return }
            guard await state.isInitialized else { return }
            do {
                let transaction = try checkVerified(verification)
                if transaction.productType == .autoRenewable, isInactiveSubscriptionTransaction(transaction) {
                    await transaction.finish()
                    await state.removePending(id: String(transaction.id))
                    OpenIapLog.debug("""
                        🧹 [processUnfinishedTransactions] Finished inactive subscription transaction:
                        - SKU: \(transaction.productID)
                        - Transaction ID: \(transaction.id)
                        - Expiration: \(transaction.expirationDate?.description ?? "none")
                        - Revoked: \(transaction.revocationDate?.description ?? "none")
                        - Upgraded: \(transaction.isUpgraded)
                        """)
                    continue
                }
                await state.storePending(id: String(transaction.id), transaction: transaction)
            } catch {
                continue
            }
        }
    }

    private func finishInactiveUnfinishedSubscriptions(productId: String) async {
        for await verification in Transaction.unfinished {
            if Task.isCancelled { return }

            do {
                let transaction = try checkVerified(verification)
                guard transaction.productType == .autoRenewable,
                      transaction.productID == productId,
                      isInactiveSubscriptionTransaction(transaction)
                else {
                    continue
                }

                await transaction.finish()
                await state.removePending(id: String(transaction.id))
                OpenIapLog.debug("""
                    🧹 [requestPurchase] Cleared inactive unfinished subscription before purchase:
                    - SKU: \(transaction.productID)
                    - Transaction ID: \(transaction.id)
                    - Expiration: \(transaction.expirationDate?.description ?? "none")
                    - Revoked: \(transaction.revocationDate?.description ?? "none")
                    - Upgraded: \(transaction.isUpgraded)
                    """)
            } catch {
                OpenIapLog.debug("⚠️ Failed to clear inactive unfinished subscription: \(error.localizedDescription)")
                continue
            }
        }
    }

    private func preflightInactiveUnfinishedSubscriptions(productId: String) async {
        let outcome = await withTaskGroup(
            of: SubscriptionPreflightOutcome.self,
            returning: SubscriptionPreflightOutcome.self
        ) { group in
            group.addTask { [weak self] in
                guard let self else { return .completed }
                await self.finishInactiveUnfinishedSubscriptions(productId: productId)
                return .completed
            }

            group.addTask {
                do {
                    try await Task.sleep(nanoseconds: Self.subscriptionPreflightTimeoutNanoseconds)
                    return .timedOut
                } catch {
                    return .completed
                }
            }

            let outcome = await group.next() ?? .completed
            group.cancelAll()
            return outcome
        }

        if case .timedOut = outcome {
            OpenIapLog.debug("⚠️ [requestPurchase] Inactive subscription cleanup timed out; continuing purchase flow")
        }
    }

    private func isInactiveSubscriptionTransaction(_ transaction: StoreKit.Transaction) -> Bool {
        if transaction.revocationDate != nil || transaction.isUpgraded {
            return true
        }

        if let expirationDate = transaction.expirationDate {
            return expirationDate <= Date()
        }

        return false
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw makePurchaseError(code: .transactionValidationFailed, message: "Transaction verification failed")
        }
    }

    private func logDuplicatePurchaseUpdate(
        source: String,
        transactionId: String,
        productId: String,
        listenerCount: Int
    ) {
        let action = listenerCount > 0
            ? "Delivered duplicate purchase-updated event to \(listenerCount) non-deduping listener(s)."
            : "Suppressed duplicate purchase-updated listener emission."
        let message = """
            [PurchaseUpdateDedup] \(action)
            - Source: \(source)
            - Product: \(productId)
            - Transaction ID: \(transactionId)
            - Reason: this transaction id was already emitted during the current connection session.
            - Scope: listeners dedupe by transaction id by default; listeners registered with dedupeTransactionIOS: false receive StoreKit replays.
            """
        if listenerCount > 0 {
            OpenIapLog.info(message)
        } else {
            OpenIapLog.debug(message)
        }
    }

    private func emitPurchaseUpdate(
        _ purchase: Purchase,
        isDuplicate: Bool = false,
        duplicateSource: String? = nil,
        duplicateTransactionId: String? = nil
    ) {
        Task { [state] in
            let listeners = await state.snapshotPurchaseUpdated(isDuplicate: isDuplicate)
            if isDuplicate {
                self.logDuplicatePurchaseUpdate(
                    source: duplicateSource ?? "unknown",
                    transactionId: duplicateTransactionId ?? purchase.id,
                    productId: purchase.productId,
                    listenerCount: listeners.count
                )
                if listeners.isEmpty {
                    return
                }
            }
            OpenIapLog.debug("✅ Emitting purchase update: Product=\(purchase.productId), Listeners=\(listeners.count)")
            await MainActor.run {
                listeners.forEach { $0(purchase) }
            }
        }
    }

    private func emitPurchaseError(_ error: PurchaseError) {
        Task { [state] in
            let listeners = await state.snapshotPurchaseError()
            await MainActor.run {
                listeners.forEach { $0(error) }
            }
        }
    }

    private func emitPromotedProduct(_ sku: String) {
        Task { [state] in
            let listeners = await state.recordPromotedProductAndSnapshotListeners(sku)
            await MainActor.run {
                listeners.forEach { $0(sku) }
            }
        }
    }

    private func emitSubscriptionBillingIssue(_ purchase: Purchase) {
        Task { [state] in
            let listeners = await state.snapshotSubscriptionBillingIssue()
            await MainActor.run {
                listeners.forEach { $0(purchase) }
            }
        }
    }

    /// Starts the StoreKit 2 Message listener for subscription-billing-issue events.
    ///
    /// The `.billingIssue` reason (what we care about) ships on iOS 18.0+ and Mac Catalyst
    /// 18.0+, so this method only starts the `Message.messages` loop when that availability
    /// holds. On macOS, tvOS, watchOS and visionOS the Message API is not available at all,
    /// making this a silent no-op on those platforms.
    ///
    /// References:
    /// - https://developer.apple.com/documentation/storekit/message
    /// - https://developer.apple.com/documentation/storekit/message/reason-swift.struct/billingissue
    private func startMessageListener() {
        try? startMessageListener(generation: nil)
    }

    private func startMessageListener(generation: UInt64) throws {
        try startMessageListener(generation: Optional(generation))
    }

    private func startMessageListener(generation: UInt64?) throws {
        #if os(iOS) || targetEnvironment(macCatalyst)
        if #available(iOS 18.0, macCatalyst 18.0, *) {
            try connection.startMessageListenerTask(generation: generation) {
                OpenIapLog.debug("🔔 [MessageListener] Starting Message.messages listener (iOS 18+)")
                return Task { [weak self] in
                    guard let self else { return }
                    for await message in StoreKit.Message.messages {
                        if Task.isCancelled { return }
                        OpenIapLog.debug("🔔 [MessageListener] Received message: reason=\(message.reason)")
                        guard await self.state.isInitialized else {
                            OpenIapLog.debug("🔔 [MessageListener] Skipping — not initialized")
                            continue
                        }
                        guard case .billingIssue = message.reason else {
                            OpenIapLog.debug("🔔 [MessageListener] Skipping non-billingIssue message")
                            continue
                        }
                        OpenIapLog.debug("🔔 [MessageListener] billingIssue received — dispatching")
                        await self.dispatchBillingIssueMessage()
                    }
                }
            }
        } else {
            OpenIapLog.debug("🔔 [MessageListener] Skipped — iOS < 18.0")
        }
        #else
        OpenIapLog.debug("🔔 [MessageListener] Skipped — not iOS/macCatalyst")
        #endif
    }

    /// Resolves the affected subscription(s) from current entitlements and emits the event.
    ///
    /// `StoreKit.Message` doesn't carry a transaction reference, so we cross-reference
    /// `Transaction.currentEntitlements` (auto-renewable only) and emit for every subscription
    /// whose `Product.SubscriptionInfo.status` array contains an entry in `.inBillingRetryPeriod`
    /// or `.inGracePeriod`. The status array is unordered across subscription-group members, so
    /// we must iterate every element rather than inspect `.first`. Product lookups are batched
    /// into a single `Product.products(for:)` call per message.
    ///
    /// Reference: https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status(for:)
    @available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
    private func dispatchBillingIssueMessage() async {
        var entitlements: [(Transaction, String)] = []
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  transaction.productType == .autoRenewable else { continue }
            entitlements.append((transaction, verification.jwsRepresentation))
        }
        guard !entitlements.isEmpty else {
            OpenIapLog.debug("🔔 [MessageListener] billingIssue received but no auto-renewable entitlements present")
            return
        }

        let productIds = Array(Set(entitlements.map { $0.0.productID }))
        let products: [StoreKit.Product]
        do {
            products = try await StoreKit.Product.products(for: productIds)
        } catch {
            OpenIapLog.debug("🔔 [MessageListener] Product.products(for:) failed: \(error.localizedDescription)")
            return
        }
        let productBySku: [String: StoreKit.Product] = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })

        var emitted = false
        for (transaction, jws) in entitlements {
            guard let subscription = productBySku[transaction.productID]?.subscription else { continue }
            let statusArray: [StoreKit.Product.SubscriptionInfo.Status]
            do {
                statusArray = try await subscription.status
            } catch {
                continue
            }
            var hasBillingIssue = false
            for status in statusArray {
                if status.state == .inBillingRetryPeriod || status.state == .inGracePeriod {
                    hasBillingIssue = true
                    break
                }
            }
            guard hasBillingIssue else { continue }
            let purchase = await StoreKitTypesBridge.purchase(
                from: transaction,
                jwsRepresentation: jws
            )
            emitSubscriptionBillingIssue(purchase)
            emitted = true
        }
        if !emitted {
            OpenIapLog.debug("🔔 [MessageListener] billingIssue received but no subscription currently reports retry/grace state")
        }
    }

    private func makePurchaseError(
        code: ErrorCode,
        productId: String? = nil,
        message: String? = nil,
        debugMessage: String? = nil
    ) -> PurchaseError {
        PurchaseError(
            code: code,
            debugMessage: debugMessage,
            message: message ?? defaultMessage(for: code),
            productId: productId
        )
    }

    private func defaultMessage(for code: ErrorCode) -> String {
        switch code {
        case .unknown: return "Unknown error occurred"
        case .userCancelled: return "User cancelled the purchase flow"
        case .userError: return "User action error"
        case .itemUnavailable: return "Item unavailable"
        case .remoteError: return "Remote service error"
        case .networkError: return "Network connection error"
        case .serviceError: return "Store service error"
        // Deprecated - use purchaseVerification* variants instead
        case .receiptFailed: return "Purchase verification failed"
        case .receiptFinished: return "Transaction already finished"
        case .receiptFinishedFailed: return "Transaction finish failed"
        case .purchaseVerificationFailed: return "Purchase verification failed"
        case .purchaseVerificationFinished: return "Transaction already finished"
        case .purchaseVerificationFinishFailed: return "Transaction finish failed"
        case .notPrepared: return "Billing is not prepared"
        case .notEnded: return "Billing connection not ended"
        case .alreadyOwned: return "Item already owned"
        case .developerError: return "Developer configuration error"
        case .billingResponseJsonParseError: return "Failed to parse billing response"
        case .deferredPayment: return "Payment was deferred (pending approval)"
        case .interrupted: return "Purchase flow interrupted"
        case .iapNotAvailable: return "In-app purchases not available on this device"
        case .purchaseError: return "Purchase error"
        case .syncError: return "Sync error"
        case .transactionValidationFailed: return "Transaction validation failed"
        case .activityUnavailable: return "Required activity is unavailable"
        case .alreadyPrepared: return "Billing already prepared"
        case .pending: return "Transaction pending"
        case .connectionClosed: return "Connection closed"
        case .initConnection: return "Failed to initialize billing connection"
        case .serviceDisconnected: return "Billing service disconnected"
        case .serviceTimeout: return "Billing service request timed out"
        case .queryProduct: return "Failed to query product"
        case .skuNotFound: return "SKU not found"
        case .skuOfferMismatch: return "SKU offer mismatch"
        case .itemNotOwned: return "Item not owned"
        case .billingUnavailable: return "Billing unavailable"
        case .featureNotSupported: return "Feature not supported on this platform"
        case .emptySkuList: return "Empty SKU list provided"
        case .duplicatePurchase: return "Duplicate purchase update detected"
        }
    }

    #if os(iOS) || os(tvOS) || os(visionOS)
    @available(iOS 17.0, tvOS 17.0, visionOS 1.0, *)
    @MainActor
    private func purchaseWithActiveScene(
        product: StoreKit.Product,
        options: Set<StoreKit.Product.PurchaseOption>,
        sku: String
    ) async throws -> StoreKit.Product.PurchaseResult {
        guard let scene = activeWindowScene() else {
            let error = makePurchaseError(code: .purchaseError, productId: sku, message: "Could not find active window scene")
            emitPurchaseError(error)
            throw error
        }

        OpenIapLog.debug("""
            🛒 [requestPurchase] Presenting StoreKit purchase sheet:
            - SKU: \(sku)
            - Scene state: \(scene.activationState.rawValue)
            """)
        return try await product.purchase(confirmIn: scene, options: options)
    }

    @MainActor
    private func activeWindowScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive }
            ?? scenes.first { $0.activationState == .foregroundInactive }
            ?? scenes.first
    }
    #endif

    @available(iOS 16.0, macOS 14.0, tvOS 16.0, watchOS 9.0, *)
    private func mapAppTransaction(_ transaction: StoreKit.AppTransaction) -> AppTransaction {
        let appVersionId = transaction.appVersionID.map(Double.init) ?? 0
        let appVersion = transaction.appVersion
        let appId = transaction.appID.map(Double.init) ?? 0
        
        // iOS 18.4+ properties - only compile with Xcode 16.4+ (Swift 6.1+)
        // This prevents build failures on Xcode 16.3 and below
        var appTransactionId: String? = nil
        var originalPlatformValue: String? = nil

        // Swift 6.1+ (Xcode 16.4+): AppTransaction.appTransactionID and originalPlatform available
        #if swift(>=6.1)
        if #available(iOS 18.4, *) {
            appTransactionId = String(transaction.appTransactionID)
            originalPlatformValue = transaction.originalPlatform.rawValue
        }
        #endif // swift(>=6.1)
        
        return AppTransaction(
            appId: appId,
            appTransactionId: appTransactionId,
            appVersion: appVersion,
            appVersionId: appVersionId,
            bundleId: transaction.bundleID,
            deviceVerification: transaction.deviceVerification.base64EncodedString(),
            deviceVerificationNonce: transaction.deviceVerificationNonce.uuidString,
            environment: transaction.environment.rawValue,
            originalAppVersion: transaction.originalAppVersion,
            originalPlatform: originalPlatformValue,
            originalPurchaseDate: transaction.originalPurchaseDate.milliseconds,
            preorderDate: transaction.preorderDate?.milliseconds,
            signedDate: transaction.signedDate.milliseconds
        )
    }
}

// iOS-only: SKPaymentTransactionObserver extension for promoted in-app purchases
// Reference: https://developer.apple.com/documentation/storekit/promoting-in-app-purchases
#if os(iOS)
extension OpenIapModule: SKPaymentTransactionObserver {
    public func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        // StoreKit 2 handles transactions via Transaction.updates; nothing to do here.
    }

    public func paymentQueue(_ queue: SKPaymentQueue, shouldAddStorePayment payment: SKPayment, for product: SKProduct) -> Bool {
        Task { [weak self] in
            guard let self else { return }
            self.emitPromotedProduct(product.productIdentifier)
        }
        return false
    }
}
#endif // os(iOS)
