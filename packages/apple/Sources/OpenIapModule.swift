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

@available(iOS 15.0, macOS 14.0, *)
public final class OpenIapModule: NSObject, OpenIapModuleProtocol {
    public static let shared = OpenIapModule()

    private var updateListenerTask: Task<Void, Error>?
    private var productManager: ProductManager?
    private let state = IapState()
    private var initTask: Task<Bool, Error>?
    // iOS-only: SKPaymentQueue observer for promoted in-app purchases
    // Reference: https://developer.apple.com/documentation/storekit/promoting-in-app-purchases
    #if os(iOS)
    private var didRegisterPaymentQueueObserver = false
    #endif

    private override init() {
        super.init()
    }

    deinit { updateListenerTask?.cancel() }

    // MARK: - Connection Management

    public func initConnection() async throws -> Bool {
        if let task = initTask {
            return try await task.value
        }

        let task = Task<Bool, Error> { [weak self] () -> Bool in
            guard let self else { return false }

            await self.cleanupExistingState()
            self.productManager = ProductManager()

            // iOS-only: Register SKPaymentQueue observer for promoted in-app purchases
            // Reference: https://developer.apple.com/documentation/storekit/promoting-in-app-purchases
            #if os(iOS)
            if !self.didRegisterPaymentQueueObserver {
                await MainActor.run {
                    SKPaymentQueue.default().add(self)
                }
                self.didRegisterPaymentQueueObserver = true
            }
            #endif // os(iOS)

            guard AppStore.canMakePayments else {
                self.emitPurchaseError(self.makePurchaseError(code: .iapNotAvailable))
                await self.state.setInitialized(false)
                return false
            }

            await self.state.setInitialized(true)
            self.startTransactionListener()
            await self.processUnfinishedTransactions()
            return true
        }
        initTask = task

        do {
            let value = try await task.value
            initTask = nil
            return value
        } catch {
            initTask = nil
            throw error
        }
    }

    public func endConnection() async throws -> Bool {
        initTask?.cancel()
        initTask = nil
        await cleanupExistingState()
        return true
    }

    // MARK: - Product Management

    public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult {
        guard !params.skus.isEmpty else {
            let error = makePurchaseError(code: .emptySkuList)
            emitPurchaseError(error)
            throw error
        }

        try await ensureConnection()
        guard let productManager else {
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
            let purchaseError = makePurchaseError(code: .queryProduct, message: error.localizedDescription)
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

        switch params.type ?? .all {
        case .subs:
            // Only return products that are actually subscriptions
            let validSubs = subscriptionEntries.filter { sub in
                fetchedProducts.contains { product in
                    product.id == sub.id && product.subscription != nil
                }
            }
            return .subscriptions(validSubs.isEmpty ? nil : validSubs)
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
            let wrapped = makePurchaseError(code: .queryProduct, productId: sku, message: error.localizedDescription)
            emitPurchaseError(wrapped)
            await state.setPromotedProductId(nil)
            throw wrapped
        }
        #else
        return nil
        #endif // os(iOS)
    }

    // MARK: - Purchase Management

    public func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        try await ensureConnection()
        let iosProps = try resolveIosPurchaseProps(from: params)
        let sku = iosProps.sku
        let product = try await storeProduct(for: sku)
        let options = try StoreKitTypesBridge.purchaseOptions(from: iosProps)

        // Check if subscription is already owned before attempting purchase
        // This prevents iOS from showing "You're already subscribed" alert
        if product.type == .autoRenewable {
            // Check current entitlements for this product
            if let currentEntitlement = await product.currentEntitlement {
                do {
                    let transaction = try checkVerified(currentEntitlement)

                    // Check if the subscription is active (not expired)
                    let isActive: Bool
                    if let expirationDate = transaction.expirationDate {
                        isActive = expirationDate > Date()
                    } else {
                        // No expiration date means it's active
                        isActive = true
                    }

                    if isActive {
                        // Check if subscription is cancelled (will not auto-renew)
                        // If cancelled, allow repurchase even though subscription is still active
                        var willAutoRenew = true
                        if let subscription = product.subscription {
                            do {
                                let statuses = try await subscription.status
                                if let status = statuses.first {
                                    switch status.renewalInfo {
                                    case .verified(let info):
                                        willAutoRenew = info.willAutoRenew
                                    case .unverified:
                                        willAutoRenew = true
                                    }
                                }
                            } catch {
                                OpenIapLog.debug("⚠️ Failed to check renewal status: \(error.localizedDescription)")
                            }
                        }

                        // Only block purchase if subscription is active AND will auto-renew
                        // Allow purchase if user has cancelled their subscription (willAutoRenew = false)
                        if willAutoRenew {
                            OpenIapLog.debug("""
                                ⚠️ [requestPurchase] Subscription already owned:
                                - SKU: \(sku)
                                - Transaction ID: \(transaction.id)
                                - Expiration: \(transaction.expirationDate?.description ?? "none")
                                - Will Auto-Renew: \(willAutoRenew)
                                """)
                            let error = makePurchaseError(code: .alreadyOwned, productId: sku)
                            emitPurchaseError(error)
                            throw error
                        } else {
                            OpenIapLog.debug("""
                                ✅ [requestPurchase] Allowing repurchase of cancelled subscription:
                                - SKU: \(sku)
                                - Transaction ID: \(transaction.id)
                                - Expiration: \(transaction.expirationDate?.description ?? "none")
                                - Will Auto-Renew: \(willAutoRenew)
                                """)
                        }
                    }
                } catch let purchaseError as PurchaseError {
                    // Always emit error for library user to handle
                    emitPurchaseError(purchaseError)

                    // If it's an alreadyOwned error, re-throw it to stop purchase flow
                    if purchaseError.code == .alreadyOwned {
                        throw purchaseError
                    }
                    // For other errors (like transactionValidationFailed), log and continue with purchase
                    OpenIapLog.debug("⚠️ Current entitlement verification failed: \(purchaseError.message)")
                } catch {
                    // For verification errors, emit error but continue with purchase
                    let verificationError = makePurchaseError(
                        code: .transactionValidationFailed,
                        productId: sku,
                        message: "Current entitlement check failed: \(error.localizedDescription)"
                    )
                    OpenIapLog.debug("⚠️ Current entitlement check failed: \(error.localizedDescription)")
                    emitPurchaseError(verificationError)
                }
            }
        }

        let result: StoreKit.Product.PurchaseResult
        do {
            // iOS 17.0+, tvOS 17.0+, macOS 15.2+: Use purchase(confirmIn:options:) for better purchase confirmation UI
            // Reference: https://developer.apple.com/documentation/storekit/product/purchase(confirmin:options:)-6dj6y
            #if canImport(UIKit)
            // iOS/tvOS: Use UIWindowScene
            if #available(iOS 17.0, tvOS 17.0, *) {
                let scene: UIWindowScene? = await MainActor.run {
                    UIApplication.shared.connectedScenes.first as? UIWindowScene
                }
                guard let scene else {
                    let error = makePurchaseError(code: .purchaseError, message: "Could not find window scene")
                    emitPurchaseError(error)
                    throw error
                }
                result = try await product.purchase(confirmIn: scene, options: options)
            } else {
                result = try await product.purchase(options: options)
            }
            #elseif canImport(AppKit)
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
                    message: enhancedMessage
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

            if shouldAutoFinish {
                await transaction.finish()
            } else {
                await state.storePending(id: transactionId, transaction: transaction)
            }

            // Emit purchase update
            // Note: Transaction.updates will NOT fire for purchases initiated via product.purchase()
            // It only fires for background events (renewals, restores, external purchases)
            emitPurchaseUpdate(purchase)

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

    public func requestPurchaseOnPromotedProductIOS() async throws -> Bool {
        throw makePurchaseError(code: .featureNotSupported)
    }

    public func restorePurchases() async throws -> Void {
        _ = try await syncIOS()
    }

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

    // MARK: - Transaction Management

    public func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void {
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

        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                if transaction.id == numericId {
                    await transaction.finish()
                    return
                }
            } catch {
                continue
            }
        }

        for await result in Transaction.unfinished {
            do {
                let transaction = try checkVerified(result)
                if transaction.id == numericId {
                    await transaction.finish()
                    return
                }
            } catch {
                continue
            }
        }

        let error = makePurchaseError(code: .purchaseError, message: "Transaction not found")
        emitPurchaseError(error)
        throw error
    }

    public func getPendingTransactionsIOS() async throws -> [PurchaseIOS] {
        let snapshot = await state.pendingSnapshot()
        var purchases: [PurchaseIOS] = []
        for transaction in snapshot {
            purchases.append(await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: nil))
        }
        return purchases
    }

    public func clearTransactionIOS() async throws -> Bool {
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

    public func isTransactionVerifiedIOS(sku: String) async throws -> Bool {
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else { return false }
        do {
            _ = try checkVerified(result)
            return true
        } catch {
            return false
        }
    }

    public func getTransactionJwsIOS(sku: String) async throws -> String? {
        let product = try await storeProduct(for: sku)
        guard let result = await product.latestTransaction else {
            let error = makePurchaseError(code: .skuNotFound, productId: sku)
            emitPurchaseError(error)
            throw error
        }
        return result.jwsRepresentation
    }

    // MARK: - Validation

    public func getReceiptDataIOS() async throws -> String? {
        guard let receiptURL = Bundle.main.appStoreReceiptURL,
              FileManager.default.fileExists(atPath: receiptURL.path) else {
            return nil
        }
        let data = try Data(contentsOf: receiptURL)
        return data.base64EncodedString()
    }

    public func validateReceiptIOS(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResultIOS {
        let receiptData = (try? await getReceiptDataIOS()) ?? ""
        var latestPurchase: Purchase? = nil
        var jws: String = ""
        var isValid = false

        do {
            let product = try await storeProduct(for: props.sku)
            if let result = await product.latestTransaction {
                jws = result.jwsRepresentation
                let transaction = try checkVerified(result)
                latestPurchase = .purchaseIos(await StoreKitTypesBridge.purchaseIOS(from: transaction, jwsRepresentation: result.jwsRepresentation))
                isValid = true
            }
        } catch {
            isValid = false
        }

        return ReceiptValidationResultIOS(
            isValid: isValid,
            jwsRepresentation: jws,
            latestTransaction: latestPurchase,
            receiptData: receiptData
        )
    }

    public func validateReceipt(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResult {
        let iosResult = try await validateReceiptIOS(props)
        return .receiptValidationResultIos(iosResult)
    }

    // MARK: - Store Information

    public func getStorefrontIOS() async throws -> String {
        guard let storefront = await Storefront.current else {
            let error = makePurchaseError(code: .unknown)
            emitPurchaseError(error)
            throw error
        }
        return storefront.countryCode
    }

    /// Get the app transaction that represents the user's purchase of the app
    /// - Note: Available on iOS 16.0+, macOS 14.0+, tvOS 16.0+, watchOS 9.0+
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/apptransaction
    @available(iOS 16.0, macOS 14.0, tvOS 16.0, watchOS 9.0, *)
    public func getAppTransactionIOS() async throws -> AppTransaction? {
        let verification = try await StoreKit.AppTransaction.shared
        switch verification {
        case .verified(let transaction):
            return mapAppTransaction(transaction)
        case .unverified:
            return nil
        }
    }

    // MARK: - Subscription Management

    public func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] {
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
                if #available(iOS 16.0, macOS 14.0, tvOS 16.0, watchOS 9.0, *) {
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

    public func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool {
        let subscriptions = try await getActiveSubscriptions(subscriptionIds)
        return subscriptions.contains { $0.isActive }
    }

    /// Show the subscription management interface
    /// - Note: Available on iOS 15.0+, iPadOS 15.0+, Mac Catalyst 15.0+, macOS 14.0+, visionOS 1.0+. Not available on tvOS (subscriptions are managed in Settings > Accounts) or watchOS.
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)
    public func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {
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

    public func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] {
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

    public func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS? {
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

    public func latestTransactionIOS(sku: String) async throws -> PurchaseIOS? {
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
    public func beginRefundRequestIOS(sku: String) async throws -> String? {
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
    public func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool {
        await StoreKit.Product.SubscriptionInfo.isEligibleForIntroOffer(for: groupID)
    }

    /// Sync the user's in-app purchases with the App Store
    /// - SeeAlso: https://developer.apple.com/documentation/storekit/appstore/sync()
    public func syncIOS() async throws -> Bool {
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
    public func presentCodeRedemptionSheetIOS() async throws -> Bool {
        // tvOS: SKPaymentQueue.presentCodeRedemptionSheet explicitly unavailable on tvOS
        #if canImport(UIKit) && !os(tvOS)
        await MainActor.run {
            SKPaymentQueue.default().presentCodeRedemptionSheet()
        }
        return true
        #else
        throw makePurchaseError(code: .featureNotSupported)
        #endif // canImport(UIKit) && !os(tvOS)
    }

    public func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] {
        try await deepLinkToSubscriptions(nil)
        return []
    }

    // MARK: - External Purchase (iOS 15.4+, macOS 14.4+, tvOS 17.4+)

    public func canPresentExternalPurchaseNoticeIOS() async throws -> Bool {
        // iOS 17.4+, macOS 15.4+, tvOS 17.4+, watchOS 10.4+: ExternalPurchase.canPresent
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchase/canpresent
        if #available(iOS 17.4, macOS 15.4, tvOS 17.4, watchOS 10.4, *) {
            return await ExternalPurchase.canPresent
        } else {
            return false
        }
    }

    public func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS {
        // iOS 15.4+, macOS 14.4+, tvOS 17.4+, watchOS 10.4+: ExternalPurchase.presentNoticeSheet
        // Note: canPresent is iOS 17.4+, so we check it conditionally
        // Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
        if #available(iOS 15.4, macOS 14.4, tvOS 17.4, watchOS 10.4, *) {
            // canPresent requires iOS 17.4+, so only check on supported versions
            if #available(iOS 17.4, macOS 15.4, tvOS 17.4, watchOS 10.4, *) {
                guard await ExternalPurchase.canPresent else {
                    throw makePurchaseError(
                        code: .featureNotSupported,
                        message: "External purchase notice sheet is not available"
                    )
                }
            }

            do {
                let result = try await ExternalPurchase.presentNoticeSheet()
                switch result {
                case .continuedWithExternalPurchaseToken(_):
                    return ExternalPurchaseNoticeResultIOS(error: nil, result: .continue)
                default:
                    // Unexpected result type - should not normally happen
                    throw makePurchaseError(
                        code: .unknown,
                        message: "Unexpected result from external purchase notice sheet"
                    )
                }
            } catch let error as PurchaseError {
                return ExternalPurchaseNoticeResultIOS(
                    error: error.message,
                    result: .dismissed
                )
            } catch {
                let purchaseError = makePurchaseError(
                    code: .serviceError,
                    message: "Failed to present external purchase notice: \(error.localizedDescription)"
                )
                return ExternalPurchaseNoticeResultIOS(
                    error: purchaseError.message,
                    result: .dismissed
                )
            }
        } else {
            throw makePurchaseError(
                code: .featureNotSupported,
                message: "External purchase notice sheet requires iOS 15.4+, macOS 14.4+, tvOS 17.4+, or watchOS 10.4+"
            )
        }
    }

    public func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS {
        // UIKit platforms: Open external link using UIApplication.open
        // Reference: https://developer.apple.com/documentation/uikit/uiapplication/1648685-open
        #if canImport(UIKit)
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
        #endif // canImport(UIKit)
    }

    // MARK: - Event Listener Registration

    public func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener) -> Subscription {
        let subscription = Subscription(eventType: .purchaseUpdated)
        Task { await state.addPurchaseUpdatedListener((subscription.id, listener)) }
        return subscription
    }

    public func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        let subscription = Subscription(eventType: .purchaseError)
        Task { await state.addPurchaseErrorListener((subscription.id, listener)) }
        return subscription
    }

    public func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        let subscription = Subscription(eventType: .promotedProductIos)
        Task { await state.addPromotedProductListener((subscription.id, listener)) }
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

    private func ensureConnection() async throws {
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
        updateListenerTask?.cancel()
        updateListenerTask = nil
        await state.reset()
        // iOS-only: Remove SKPaymentQueue observer for promoted in-app purchases
        // Reference: https://developer.apple.com/documentation/storekit/promoting-in-app-purchases
        #if os(iOS)
        if didRegisterPaymentQueueObserver {
            await MainActor.run {
                SKPaymentQueue.default().remove(self)
            }
            didRegisterPaymentQueueObserver = false
        }
        #endif // os(iOS)
        if let manager = productManager { await manager.removeAll() }
        productManager = nil
    }

    private func storeProduct(for sku: String) async throws -> StoreKit.Product {
        guard let productManager else {
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

    private func resolveIosPurchaseProps(from params: RequestPurchaseProps) throws -> RequestPurchaseIosProps {
        switch params.request {
        case let .purchase(platforms):
            if let ios = platforms.ios {
                return ios
            }
        case let .subscription(platforms):
            if let ios = platforms.ios {
                return RequestPurchaseIosProps(
                    andDangerouslyFinishTransactionAutomatically: ios.andDangerouslyFinishTransactionAutomatically,
                    appAccountToken: ios.appAccountToken,
                    quantity: ios.quantity,
                    sku: ios.sku,
                    withOffer: ios.withOffer
                )
            }
        }
        throw makePurchaseError(code: .purchaseError, message: "Missing iOS purchase parameters")
    }

    private func startTransactionListener() {
        OpenIapLog.debug("🎧 [TransactionListener] Starting Transaction.updates listener...")
        updateListenerTask = Task { [weak self] in
            guard let self else {
                OpenIapLog.debug("⚠️ [TransactionListener] Self is nil, exiting listener")
                return
            }
            OpenIapLog.debug("✅ [TransactionListener] Listener task started, waiting for transactions...")
            for await verification in Transaction.updates {
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

                    // Skip revoked transactions
                    if transaction.revocationDate != nil {
                        OpenIapLog.debug("⏭️ Skipping revoked transaction: \(transactionId)")
                        continue
                    }

                    // Store pending and emit
                    await self.state.storePending(id: transactionId, transaction: transaction)
                    let purchase = await StoreKitTypesBridge.purchase(from: transaction, jwsRepresentation: verification.jwsRepresentation)

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

    private func processUnfinishedTransactions() async {
        for await verification in Transaction.unfinished {
            do {
                let transaction = try checkVerified(verification)
                await state.storePending(id: String(transaction.id), transaction: transaction)
            } catch {
                continue
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw makePurchaseError(code: .transactionValidationFailed, message: "Transaction verification failed")
        }
    }

    private func emitPurchaseUpdate(_ purchase: Purchase) {
        Task { [state] in
            let listeners = await state.snapshotPurchaseUpdated()
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
            let listeners = await state.snapshotPromoted()
            await MainActor.run {
                listeners.forEach { $0(sku) }
            }
        }
    }

    private func makePurchaseError(code: ErrorCode, productId: String? = nil, message: String? = nil) -> PurchaseError {
        PurchaseError(
            code: code,
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
        case .receiptFailed: return "Receipt validation failed"
        case .receiptFinished: return "Receipt already finished"
        case .receiptFinishedFailed: return "Receipt finish failed"
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
        case .queryProduct: return "Failed to query product"
        case .skuNotFound: return "SKU not found"
        case .skuOfferMismatch: return "SKU offer mismatch"
        case .itemNotOwned: return "Item not owned"
        case .billingUnavailable: return "Billing unavailable"
        case .featureNotSupported: return "Feature not supported on this platform"
        case .emptySkuList: return "Empty SKU list provided"
        }
    }

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
            await self.state.setPromotedProductId(product.productIdentifier)
            self.emitPromotedProduct(product.productIdentifier)
        }
        return false
    }
}
#endif // os(iOS)
