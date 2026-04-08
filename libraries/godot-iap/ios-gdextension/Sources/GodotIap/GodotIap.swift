/**************************************************************************/
/*  GodotIap.swift                                                        */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT IAP                                  */
/*                     https://github.com/hyochan/godot-iap               */
/**************************************************************************/
/* Copyright (c) 2024-present                                             */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

@preconcurrency import SwiftGodotRuntime
import OpenIAP
import Foundation
import StoreKit

@Godot
@available(iOS 15.0, macOS 14.0, *)
public class GodotIap: RefCounted, @unchecked Sendable {

    // MARK: - Signals
    @Signal("resultDict")
    var purchaseUpdated: SignalWithArguments<VariantDictionary>

    @Signal("errorDict")
    var purchaseError: SignalWithArguments<VariantDictionary>

    @Signal("resultDict")
    var productsFetched: SignalWithArguments<VariantDictionary>

    @Signal("statusCode")
    var connected: SignalWithArguments<Int>

    @Signal("statusCode")
    var disconnected: SignalWithArguments<Int>

    @Signal("productId")
    var promotedProduct: SignalWithArguments<String>

    // MARK: - Properties
    private let openIap = OpenIapModule.shared
    private var isConnected: Bool = false
    private var purchaseUpdateSubscription: Subscription?
    private var purchaseErrorSubscription: Subscription?
    private var promotedProductSubscription: Subscription?

    // MARK: - Initialization
    required init(_ context: InitContext) {
        super.init(context)
        GodotIapLog.info("Plugin initialized with OpenIAP")
    }

    deinit {
        removeListeners()
        GodotIapLog.info("Plugin deinitialized")
    }

    // MARK: - Connection Methods

    @Callable
    public func initConnection() -> Bool {
        GodotIapLog.payload("initConnection", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.initConnection()

                if result {
                    self.setupListeners()
                    await MainActor.run { [self] in
                        self.isConnected = true
                        self.connected.emit(1)
                    }
                    GodotIapLog.result("initConnection", value: true)
                } else {
                    await MainActor.run { [self] in
                        self.isConnected = false
                        self.connected.emit(0)
                    }
                }
            } catch {
                GodotIapLog.failure("initConnection", error: error)
                await MainActor.run { [self] in
                    self.isConnected = false
                    self.connected.emit(0)
                }
            }
        }

        return true // Return optimistically, actual result via signal
    }

    @Callable
    public func endConnection() -> Bool {
        GodotIapLog.payload("endConnection", payload: nil)

        removeListeners()

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let _ = try await self.openIap.endConnection()
                await MainActor.run { [self] in
                    self.isConnected = false
                    self.disconnected.emit(0)
                }
                GodotIapLog.result("endConnection", value: true)
            } catch {
                GodotIapLog.failure("endConnection", error: error)
            }
        }

        return true
    }

    // MARK: - Product Methods

    @Callable
    public func fetchProducts(argsJson: String) -> String {
        GodotIapLog.payload("fetchProducts", payload: argsJson)

        // Parse arguments
        guard let data = argsJson.data(using: .utf8),
              let args = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let skus = args["skus"] as? [String] else {
            let errorResult: [String: Any] = ["error": "Invalid arguments", "products": []]
            if let jsonData = try? JSONSerialization.data(withJSONObject: errorResult),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                return jsonString
            }
            return "{\"error\": \"Invalid arguments\", \"products\": []}"
        }

        let typeStr = args["type"] as? String ?? "all"
        let queryType: ProductQueryType
        switch typeStr {
        case "inapp", "in-app":
            queryType = .inApp
        case "subs", "subscription":
            queryType = .subs
        default:
            queryType = .all
        }

        Task { [weak self] in
            do {
                let request = ProductRequest(skus: skus, type: queryType)
                let result = try await self?.openIap.fetchProducts(request)

                var productDicts: [[String: Any]] = []

                switch result {
                case .products(let products):
                    productDicts = products?.map { self?.productToDictionary($0) ?? [:] } ?? []
                case .subscriptions(let subs):
                    productDicts = subs?.map { self?.subscriptionToDictionary($0) ?? [:] } ?? []
                case .all(let items):
                    productDicts = items?.compactMap { item -> [String: Any]? in
                        switch item {
                        case .product(let p):
                            return self?.productToDictionary(p)
                        case .productSubscription(let s):
                            return self?.subscriptionToDictionary(s)
                        }
                    } ?? []
                case .none:
                    break
                }

                await self?.emitProductsFetched(success: true, products: productDicts)

            } catch {
                GodotIapLog.failure("fetchProducts", error: error)
                await self?.emitProductsFetched(success: false, error: error.localizedDescription)
            }
        }

        return "{\"status\": \"pending\"}"
    }

    // MARK: - Purchase Methods

    @Callable
    public func requestPurchase(sku: String) -> String {
        GodotIapLog.payload("requestPurchase", payload: sku)

        Task { [weak self] in
            do {
                guard !sku.isEmpty else {
                    await self?.emitPurchaseError(code: "MISSING_SKU", message: "SKU not provided")
                    return
                }

                // Create purchase request for the SKU
                // Note: Use `ios:` parameter (not `apple:`) as the library implementation checks for `platforms.ios`
                let purchaseProps = RequestPurchaseProps(
                    request: .purchase(RequestPurchasePropsByPlatforms(
                        ios: RequestPurchaseIosProps(sku: sku)
                    ))
                )

                let result = try await self?.openIap.requestPurchase(purchaseProps)

                // Note: Don't emit purchaseUpdated here.
                // The purchaseUpdatedListener will handle it to avoid duplicate signals.
                switch result {
                case .purchase(let purchase):
                    if purchase == nil {
                        await self?.emitPurchaseError(code: "USER_CANCELLED", message: "Purchase was cancelled")
                    }
                    // If purchase succeeded, purchaseUpdatedListener will emit the signal
                case .purchases(let purchases):
                    if purchases?.isEmpty ?? true {
                        await self?.emitPurchaseError(code: "USER_CANCELLED", message: "Purchase was cancelled")
                    }
                    // If purchases succeeded, purchaseUpdatedListener will emit the signal
                case .none:
                    await self?.emitPurchaseError(code: "USER_CANCELLED", message: "Purchase was cancelled")
                }

            } catch let error as PurchaseError {
                await self?.emitPurchaseError(code: error.code.rawValue, message: error.message)
            } catch {
                await self?.emitPurchaseError(code: "PURCHASE_FAILED", message: error.localizedDescription)
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func finishTransaction(argsJson: String) -> String {
        GodotIapLog.payload("finishTransaction", payload: argsJson)

        Task { [weak self] in
            do {
                guard let data = argsJson.data(using: .utf8),
                      let args = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let purchaseDict = args["purchase"] as? [String: Any] else {
                    GodotIapLog.warn("finishTransaction: Invalid arguments")
                    return
                }

                let isConsumable = args["isConsumable"] as? Bool ?? false

                // Use OpenIapSerialization to create PurchaseInput
                let purchaseInput = try OpenIapSerialization.purchaseInput(from: purchaseDict)

                try await self?.openIap.finishTransaction(purchase: purchaseInput, isConsumable: isConsumable)
                GodotIapLog.result("finishTransaction", value: true)
            } catch {
                GodotIapLog.failure("finishTransaction", error: error)
            }
        }

        return "{\"success\": true}"
    }

    @Callable
    public func restorePurchases() -> String {
        GodotIapLog.payload("Restoring purchases", payload: nil)

        Task { [weak self] in
            do {
                try await self?.openIap.restorePurchases()

                // Get available purchases after restore
                let purchases = try await self?.openIap.getAvailablePurchases(nil) ?? []

                for purchase in purchases {
                    await self?.emitPurchaseUpdated(purchase: purchase)
                }

                GodotIapLog.debug("[GodotIap] Restore completed with \(purchases.count) purchases")
            } catch {
                await self?.emitPurchaseError(code: "RESTORE_FAILED", message: error.localizedDescription)
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getAvailablePurchases() -> String {
        GodotIapLog.payload("Getting available purchases", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchases = try await self.openIap.getAvailablePurchases(nil) ?? []
                let purchaseDicts = purchases.map { self.purchaseToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["purchasesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getAvailablePurchases error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    // MARK: - Subscription Methods

    @Callable
    public func getActiveSubscriptions(subscriptionIdsJson: String) -> String {
        GodotIapLog.payload("Getting active subscriptions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var subscriptionIds: [String]? = nil
                if !subscriptionIdsJson.isEmpty,
                   let data = subscriptionIdsJson.data(using: .utf8),
                   let ids = try? JSONDecoder().decode([String].self, from: data) {
                    subscriptionIds = ids
                }

                let subscriptions = try await self.openIap.getActiveSubscriptions(subscriptionIds) ?? []
                let subDicts: [[String: Any]] = subscriptions.map { sub in
                    return [
                        "productId": sub.productId,
                        "isActive": sub.isActive,
                        "transactionId": sub.transactionId,
                        "transactionDate": sub.transactionDate,
                        "expirationDate": sub.expirationDateIOS as Any
                    ]
                }

                if let jsonData = try? JSONSerialization.data(withJSONObject: subDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["subscriptionsJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getActiveSubscriptions error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func hasActiveSubscriptions(subscriptionIdsJson: String) -> String {
        GodotIapLog.payload("Checking active subscriptions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var subscriptionIds: [String]? = nil
                if !subscriptionIdsJson.isEmpty,
                   let data = subscriptionIdsJson.data(using: .utf8),
                   let ids = try? JSONDecoder().decode([String].self, from: data) {
                    subscriptionIds = ids
                }

                let hasActive = try await self.openIap.hasActiveSubscriptions(subscriptionIds) ?? false

                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["hasActive"] = Variant(hasActive)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] hasActiveSubscriptions error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    // MARK: - iOS Specific Methods

    @Callable
    public func syncIOS() -> String {
        GodotIapLog.payload("Syncing with App Store", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.syncIOS() ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
                GodotIapLog.debug("[GodotIap] Sync completed: \(result)")
            } catch {
                GodotIapLog.debug("[GodotIap] syncIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func clearTransactionIOS() -> String {
        GodotIapLog.payload("Clearing transactions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.clearTransactionIOS() ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
                GodotIapLog.debug("[GodotIap] Clear transactions completed: \(result)")
            } catch {
                GodotIapLog.debug("[GodotIap] clearTransactionIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getPendingTransactionsIOS() -> String {
        GodotIapLog.payload("Getting pending transactions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let transactions = try await self.openIap.getPendingTransactionsIOS() ?? []
                let transactionDicts = transactions.map { self.purchaseIOSToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: transactionDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["transactionsJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getPendingTransactionsIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func presentCodeRedemptionSheetIOS() -> String {
        GodotIapLog.payload("Presenting code redemption sheet", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.presentCodeRedemptionSheetIOS() ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentCodeRedemptionSheetIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func showManageSubscriptionsIOS() -> String {
        GodotIapLog.payload("Showing manage subscriptions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchases = try await self.openIap.showManageSubscriptionsIOS() ?? []
                let purchaseDicts = purchases.map { self.purchaseIOSToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["purchasesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] showManageSubscriptionsIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func beginRefundRequestIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Beginning refund request for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.beginRefundRequestIOS(sku: sku)
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["status"] = Variant(result ?? "unknown")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] beginRefundRequestIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func currentEntitlementIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting current entitlement for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchase = try await self.openIap.currentEntitlementIOS(sku: sku)
                if let purchase = purchase {
                    let purchaseDict = self.purchaseIOSToDictionary(purchase)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = VariantDictionary()
                            dict["success"] = Variant(true)
                            dict["purchaseJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["purchaseJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] currentEntitlementIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func latestTransactionIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting latest transaction for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchase = try await self.openIap.latestTransactionIOS(sku: sku)
                if let purchase = purchase {
                    let purchaseDict = self.purchaseIOSToDictionary(purchase)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = VariantDictionary()
                            dict["success"] = Variant(true)
                            dict["purchaseJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["purchaseJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] latestTransactionIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getStorefrontIOS() -> String {
        GodotIapLog.payload("Getting storefront", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let storefront = try await self.openIap.getStorefrontIOS() ?? ""
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["storefront"] = Variant(storefront)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getStorefrontIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getAppTransactionIOS() -> String {
        GodotIapLog.payload("Getting app transaction", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let appTransaction = try await self.openIap.getAppTransactionIOS()
                if let appTransaction = appTransaction {
                    let transactionDict: [String: Any] = [
                        "bundleId": appTransaction.bundleId,
                        "appVersion": appTransaction.appVersion,
                        "originalAppVersion": appTransaction.originalAppVersion,
                        "originalPurchaseDate": appTransaction.originalPurchaseDate,
                        "deviceVerification": appTransaction.deviceVerification,
                        "deviceVerificationNonce": appTransaction.deviceVerificationNonce
                    ]
                    if let jsonData = try? JSONSerialization.data(withJSONObject: transactionDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = VariantDictionary()
                            dict["success"] = Variant(true)
                            dict["appTransactionJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["appTransactionJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getAppTransactionIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func subscriptionStatusIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting subscription status for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let statuses = try await self.openIap.subscriptionStatusIOS(sku: sku) ?? []
                let statusDicts: [[String: Any]] = statuses.map { status in
                    return OpenIapSerialization.encode(status)
                }

                if let jsonData = try? JSONSerialization.data(withJSONObject: statusDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["statusesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] subscriptionStatusIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func isEligibleForIntroOfferIOS(groupId: String) -> String {
        GodotIapLog.debug("[GodotIap] Checking intro offer eligibility for group: \(groupId)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let isEligible = try await self.openIap.isEligibleForIntroOfferIOS(groupID: groupId) ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["isEligible"] = Variant(isEligible)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] isEligibleForIntroOfferIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getPromotedProductIOS() -> String {
        GodotIapLog.payload("Getting promoted product", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let product = try await self.openIap.getPromotedProductIOS()
                if let product = product {
                    let productDict = self.productIOSToDictionary(product)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: productDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = VariantDictionary()
                            dict["success"] = Variant(true)
                            dict["productJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(true)
                        dict["productJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getPromotedProductIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func requestPurchaseOnPromotedProductIOS() -> String {
        GodotIapLog.payload("Requesting purchase on promoted product", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.requestPurchaseOnPromotedProductIOS() ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] requestPurchaseOnPromotedProductIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func canPresentExternalPurchaseNoticeIOS() -> String {
        GodotIapLog.payload("Checking if can present external purchase notice", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let canPresent = try await self.openIap.canPresentExternalPurchaseNoticeIOS() ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["canPresent"] = Variant(canPresent)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] canPresentExternalPurchaseNoticeIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func presentExternalPurchaseNoticeSheetIOS() -> String {
        GodotIapLog.payload("Presenting external purchase notice sheet", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.presentExternalPurchaseNoticeSheetIOS()
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["result"] = Variant(result.result.rawValue)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentExternalPurchaseNoticeSheetIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func presentExternalPurchaseLinkIOS(url: String) -> String {
        GodotIapLog.debug("[GodotIap] Presenting external purchase link: \(url)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.presentExternalPurchaseLinkIOS(url)
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: OpenIapSerialization.encode(result)),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["resultJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentExternalPurchaseLinkIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func deepLinkToSubscriptions(optionsJson: String) -> String {
        GodotIapLog.payload("Deep linking to subscriptions", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var options: DeepLinkOptions? = nil
                if !optionsJson.isEmpty,
                   let data = optionsJson.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    options = DeepLinkOptions(
                        packageNameAndroid: json["packageNameAndroid"] as? String,
                        skuAndroid: json["skuAndroid"] as? String
                    )
                }

                try await self.openIap.deepLinkToSubscriptions(options)
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] deepLinkToSubscriptions error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    // MARK: - Verification Methods

    @Callable
    public func verifyPurchase(propsJson: String) -> String {
        GodotIapLog.payload("Verifying purchase", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                guard let data = propsJson.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(false)
                        dict["error"] = Variant("Invalid arguments")
                        self.productsFetched.emit(dict)
                    }
                    return
                }

                // Create VerifyPurchaseProps from JSON using OpenIapSerialization
                let props = try OpenIapSerialization.verifyPurchaseProps(from: json)
                let result = try await self.openIap.verifyPurchase(props)

                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    let resultDict = OpenIapSerialization.encode(result)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: resultDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["resultJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] verifyPurchase error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getReceiptDataIOS() -> String {
        GodotIapLog.payload("Getting receipt data", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let receiptData = try await self.openIap.getReceiptDataIOS()
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["receiptData"] = Variant(receiptData ?? "")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getReceiptDataIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func isTransactionVerifiedIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Checking if transaction is verified for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let isVerified = try await self.openIap.isTransactionVerifiedIOS(sku: sku) ?? false
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["isVerified"] = Variant(isVerified)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] isTransactionVerifiedIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func getTransactionJwsIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting transaction JWS for: \(sku)")

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let jws = try await self.openIap.getTransactionJwsIOS(sku: sku)
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    dict["jws"] = Variant(jws ?? "")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getTransactionJwsIOS error: \(error.localizedDescription)")
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func verifyPurchaseWithProvider(propsJson: String) -> String {
        GodotIapLog.payload("Verifying purchase with provider", payload: nil)

        Task { [weak self] in
            guard let self = self else { return }
            do {
                guard let data = propsJson.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["success"] = Variant(false)
                        dict["error"] = Variant("Invalid arguments")
                        self.productsFetched.emit(dict)
                    }
                    return
                }

                // Create VerifyPurchaseWithProviderProps from JSON
                let jsonData = try JSONSerialization.data(withJSONObject: json)
                let props = try JSONDecoder().decode(VerifyPurchaseWithProviderProps.self, from: jsonData)
                let result = try await self.openIap.verifyPurchaseWithProvider(props)

                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(true)
                    let resultDict = OpenIapSerialization.encode(result)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: resultDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["resultJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] verifyPurchaseWithProvider error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\"}"
    }

    // MARK: - Private Helpers

    private func setupListeners() {
        purchaseUpdateSubscription = openIap.purchaseUpdatedListener { [weak self] purchase in
            Task { @MainActor in
                self?.emitPurchaseUpdated(purchase: purchase)
            }
        }

        purchaseErrorSubscription = openIap.purchaseErrorListener { [weak self] error in
            Task { @MainActor in
                let dict = VariantDictionary()
                dict["code"] = Variant(error.code.rawValue)
                dict["message"] = Variant(error.message)
                self?.purchaseError.emit(dict)
            }
        }

        promotedProductSubscription = openIap.promotedProductListenerIOS { [weak self] productId in
            Task { @MainActor in
                self?.promotedProduct.emit(productId)
            }
        }
    }

    private func removeListeners() {
        if let sub = purchaseUpdateSubscription {
            openIap.removeListener(sub)
            purchaseUpdateSubscription = nil
        }
        if let sub = purchaseErrorSubscription {
            openIap.removeListener(sub)
            purchaseErrorSubscription = nil
        }
        if let sub = promotedProductSubscription {
            openIap.removeListener(sub)
            promotedProductSubscription = nil
        }
    }

    @MainActor
    private func emitPurchaseUpdated(purchase: Purchase) {
        // Extract all required fields from the underlying type
        let transactionId: String
        let purchaseId: String
        let transactionDate: Double
        let quantity: Int
        let isAutoRenewing: Bool
        let store: String

        switch purchase {
        case .purchaseIos(let p):
            transactionId = p.transactionId
            purchaseId = p.id
            transactionDate = p.transactionDate
            quantity = p.quantity
            isAutoRenewing = p.isAutoRenewing
            store = p.store.rawValue
        case .purchaseAndroid(let p):
            transactionId = p.transactionId ?? ""
            purchaseId = p.id
            transactionDate = p.transactionDate
            quantity = p.quantity
            isAutoRenewing = p.isAutoRenewing
            store = p.store.rawValue
        }

        let dict = VariantDictionary()
        dict["id"] = Variant(purchaseId)
        dict["productId"] = Variant(purchase.productId)
        dict["transactionId"] = Variant(transactionId)
        dict["transactionDate"] = Variant(transactionDate)
        dict["purchaseState"] = Variant(purchase.purchaseState.rawValue)
        dict["platform"] = Variant("ios")
        dict["store"] = Variant(store)
        dict["quantity"] = Variant(quantity)
        dict["isAutoRenewing"] = Variant(isAutoRenewing)

        if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseToDictionary(purchase)),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            dict["purchaseJson"] = Variant(jsonString)
        }

        self.purchaseUpdated.emit(dict)
    }

    @MainActor
    private func emitPurchaseError(code: String, message: String) {
        let dict = VariantDictionary()
        dict["code"] = Variant(code)
        dict["message"] = Variant(message)
        self.purchaseError.emit(dict)
    }

    @MainActor
    private func emitProductsFetched(success: Bool, products: [[String: Any]]? = nil, error: String? = nil) {
        let dict = VariantDictionary()
        dict["success"] = Variant(success)

        if let products = products,
           let jsonData = try? JSONSerialization.data(withJSONObject: products),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            dict["productsJson"] = Variant(jsonString)
        }

        if let error = error {
            dict["error"] = Variant(error)
        }

        self.productsFetched.emit(dict)
    }

    private func productToDictionary(_ product: OpenIAP.Product) -> [String: Any] {
        return [
            "id": product.id,
            "title": product.title,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": product.price ?? 0,
            "currency": product.currency,
            "type": product.type.rawValue,
            "platform": "ios"
        ]
    }

    private func productIOSToDictionary(_ product: ProductIOS) -> [String: Any] {
        return [
            "id": product.id,
            "title": product.title,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": product.price ?? 0,
            "currency": product.currency,
            "type": product.type.rawValue,
            "platform": "ios"
        ]
    }

    private func subscriptionToDictionary(_ subscription: ProductSubscription) -> [String: Any] {
        return [
            "id": subscription.id,
            "title": subscription.title,
            "description": subscription.description,
            "displayPrice": subscription.displayPrice,
            "price": subscription.price ?? 0,
            "currency": subscription.currency,
            "type": "subs",
            "platform": "ios"
        ]
    }

    private func purchaseToDictionary(_ purchase: Purchase) -> [String: Any] {
        var transactionId: String = ""
        switch purchase {
        case .purchaseIos(let p):
            transactionId = p.transactionId
        case .purchaseAndroid(let p):
            transactionId = p.transactionId ?? ""
        }

        return [
            "id": purchase.id,
            "productId": purchase.productId,
            "transactionId": transactionId,
            "transactionDate": purchase.transactionDate,
            "purchaseState": purchase.purchaseState.rawValue,
            "quantity": purchase.quantity,
            "platform": "ios",
            "store": purchase.store.rawValue
        ]
    }

    private func purchaseIOSToDictionary(_ purchase: PurchaseIOS) -> [String: Any] {
        // Use OpenIapSerialization to get proper dictionary representation
        var dict = OpenIapSerialization.encode(purchase)
        dict["platform"] = "ios"
        return dict
    }
}
