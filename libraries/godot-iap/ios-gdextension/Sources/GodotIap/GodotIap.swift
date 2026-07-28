/**************************************************************************/
/*  GodotIap.swift                                                        */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT IAP                                  */
/*                     https://github.com/hyodotdev/openiap               */
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

    @Signal("resultDict")
    var subscriptionBillingIssue: SignalWithArguments<VariantDictionary>

    // MARK: - Properties
    private let openIap = OpenIapModule.shared
    private let lifecycleLock = NSLock()
    private var lifecycleTail: Task<Void, Never>?
    private var lifecycleGeneration: UInt64 = 0
    private var isConnected: Bool = false
    private var purchaseUpdateSubscription: Subscription?
    private var purchaseErrorSubscription: Subscription?
    private var promotedProductSubscription: Subscription?
    private var subscriptionBillingIssueSubscription: Subscription?
    private var dedupeTransactionIOS = true

    // MARK: - Initialization
    required init(_ context: InitContext) {
        super.init(context)
        GodotIapLog.info("Plugin initialized with OpenIAP")
    }

    deinit {
        let lifecycle = advanceConnectionGeneration()
        removeListeners(lifecycle.listeners)
        GodotIapLog.info("Plugin deinitialized")
    }

    // MARK: - Connection Methods

    @Callable
    public func initConnection() -> String {
        GodotIapLog.payload("initConnection", payload: nil)
        let requestId = UUID().uuidString
        enqueueLifecycleOperation { [weak self] generation in
            guard let self else { return }
            do {
                let result = try await self.openIap.initConnection()

                if result {
                    guard self.installListenersIfOwned(
                        generation: generation
                    ) else { return }
                    await self.emitInitConnectionSuccess(
                        generation: generation,
                        requestId: requestId
                    )
                    GodotIapLog.result("initConnection", value: true)
                } else {
                    await self.emitInitConnectionFailure(
                        generation: generation,
                        requestId: requestId,
                        message: "Store connection was not established"
                    )
                }
            } catch {
                GodotIapLog.failure("initConnection", error: error)
                await self.emitInitConnectionFailure(
                    generation: generation,
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }
        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func setPurchaseUpdatedListenerOptions(optionsJson: String) -> Bool {
        let data = Data(optionsJson.utf8)
        guard
            let decoded = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else {
            GodotIapLog.warn("setPurchaseUpdatedListenerOptions: invalid JSON")
            return false
        }
        let dedupeTransactionIOS = decoded["dedupeTransactionIOS"] as? Bool ?? true
        let previousSubscription = replacePurchaseUpdatedListener(
            dedupeTransactionIOS: dedupeTransactionIOS
        )

        if let subscription = previousSubscription {
            openIap.removeListener(subscription)
        }

        return true
    }

    @Callable
    public func endConnection() -> String {
        GodotIapLog.payload("endConnection", payload: nil)
        let requestId = UUID().uuidString
        enqueueLifecycleOperation { [weak self] generation in
            guard let self else { return }
            do {
                let _ = try await self.openIap.endConnection()
                await self.emitEndConnectionSuccess(
                    generation: generation,
                    requestId: requestId
                )
                GodotIapLog.result("endConnection", value: true)
            } catch {
                GodotIapLog.failure("endConnection", error: error)
                await self.emitEndConnectionFailure(
                    generation: generation,
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }
        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - Product Methods

    @Callable
    public func fetchProducts(argsJson: String) -> String {
        GodotIapLog.payload("fetchProducts", payload: argsJson)
        let requestId = UUID().uuidString

        // Parse arguments
        guard let data = argsJson.data(using: .utf8),
              let args = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let skus = args["skus"] as? [String] else {
            Task { [weak self] in
                await self?.emitAsyncFailure(
                    method: "fetchProducts",
                    requestId: requestId,
                    message: "Invalid arguments"
                )
            }
            return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
        }

        let queryType: ProductQueryType
        do {
            queryType = try GodotIapHelper.parseProductQueryType(
                args["type"] as? String,
                defaultType: .all
            )
        } catch {
            Task { [weak self] in
                await self?.emitAsyncFailure(
                    method: "fetchProducts",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
            return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
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

                await self?.emitProductsFetched(
                    success: true,
                    products: productDicts,
                    method: "fetchProducts",
                    requestId: requestId
                )

            } catch {
                GodotIapLog.failure("fetchProducts", error: error)
                await self?.emitProductsFetched(
                    success: false,
                    error: error.localizedDescription,
                    method: "fetchProducts",
                    requestId: requestId
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - Purchase Methods

    @Callable
    public func requestPurchaseWithPayload(argsJson: String) -> String {
        GodotIapLog.payload("requestPurchaseWithPayload", payload: argsJson)

        guard let data = argsJson.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return jsonString([
                "success": false,
                "code": ErrorCode.developerError.rawValue,
                "error": "Invalid request payload"
            ])
        }

        let purchaseProps: RequestPurchaseProps
        do {
            purchaseProps = try GodotIapHelper.decodeRequestPurchaseProps(from: payload)
        } catch {
            return jsonString([
                "success": false,
                "code": ErrorCode.developerError.rawValue,
                "error": error.localizedDescription
            ])
        }
        let productId = purchaseProductId(from: purchaseProps)

        Task { [weak self] in
            do {
                let result = try await self?.openIap.requestPurchase(purchaseProps)

                switch result {
                case .purchase(let purchase):
                    if purchase == nil {
                        await self?.emitPurchaseError(
                            code: ErrorCode.userCancelled.rawValue,
                            message: "Purchase was cancelled",
                            productId: productId
                        )
                    }
                case .purchases(let purchases):
                    if purchases?.isEmpty ?? true {
                        await self?.emitPurchaseError(
                            code: ErrorCode.userCancelled.rawValue,
                            message: "Purchase was cancelled",
                            productId: productId
                        )
                    }
                case .none:
                    await self?.emitPurchaseError(
                        code: ErrorCode.userCancelled.rawValue,
                        message: "Purchase was cancelled",
                        productId: productId
                    )
                }
            } catch let error as PurchaseError {
                // OpenIAP requestPurchase emits its canonical error exactly once
                // through purchaseErrorListener before throwing.
                GodotIapLog.failure("requestPurchaseWithPayload", error: error)
            } catch {
                GodotIapLog.failure("requestPurchaseWithPayload", error: error)
            }
        }

        return "{\"status\": \"pending\"}"
    }

    @Callable
    public func finishTransaction(argsJson: String) -> String {
        GodotIapLog.payload("finishTransaction", payload: argsJson)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                guard let data = argsJson.data(using: .utf8),
                      let args = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let purchaseDict = args["purchase"] as? [String: Any] else {
                    await self.emitAsyncFailure(
                        method: "finishTransaction",
                        requestId: requestId,
                        message: "Invalid arguments"
                    )
                    return
                }

                let isConsumable = args["isConsumable"] as? Bool ?? false

                // Use OpenIapSerialization to create PurchaseInput
                let purchaseInput = try OpenIapSerialization.purchaseInput(from: purchaseDict)

                try await self.openIap.finishTransaction(purchase: purchaseInput, isConsumable: isConsumable)
                GodotIapLog.result("finishTransaction", value: true)
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "finishTransaction",
                        requestId: requestId
                    )
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.failure("finishTransaction", error: error)
                await self.emitAsyncFailure(
                    method: "finishTransaction",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func restorePurchases() -> String {
        GodotIapLog.payload("Restoring purchases", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                try await self.openIap.restorePurchases()

                // Get available purchases after restore
                let purchases = try await self.openIap.getAvailablePurchases(
                    PurchaseOptions(onlyIncludeActiveItemsIOS: true)
                )

                for purchase in purchases {
                    await self.emitPurchaseUpdated(purchase: purchase)
                }

                GodotIapLog.debug("[GodotIap] Restore completed with \(purchases.count) purchases")
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "restorePurchases",
                        requestId: requestId
                    )
                    self.productsFetched.emit(dict)
                }
            } catch {
                await self.emitPurchaseError(code: ErrorCode.syncError.rawValue, message: error.localizedDescription)
                await self.emitAsyncFailure(
                    method: "restorePurchases",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getAvailablePurchases(optionsJson: String) -> String {
        GodotIapLog.payload("Getting available purchases", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var options: PurchaseOptions? = nil
                if !optionsJson.isEmpty {
                    guard let data = optionsJson.data(using: .utf8),
                          let object = try? JSONSerialization.jsonObject(with: data) else {
                        throw PurchaseError.make(
                            code: .developerError,
                            message: "Invalid purchase options"
                        )
                    }
                    options = try OpenIapSerialization.purchaseOptions(from: object)
                }
                let purchases = try await self.openIap.getAvailablePurchases(options)
                let purchaseDicts = purchases.map { self.purchaseToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "getAvailablePurchases",
                            requestId: requestId
                        )
                        dict["purchasesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await self.emitAsyncFailure(
                        method: "getAvailablePurchases",
                        requestId: requestId,
                        message: "Failed to serialize available purchases"
                    )
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getAvailablePurchases error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getAvailablePurchases",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - Subscription Methods

    @Callable
    public func getActiveSubscriptions(subscriptionIdsJson: String) -> String {
        GodotIapLog.payload("Getting active subscriptions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var subscriptionIds: [String]? = nil
                if !subscriptionIdsJson.isEmpty,
                   let data = subscriptionIdsJson.data(using: .utf8),
                   let ids = try? JSONDecoder().decode([String].self, from: data) {
                    subscriptionIds = ids.isEmpty ? nil : ids
                }

                let subscriptions = try await self.openIap.getActiveSubscriptions(subscriptionIds)
                let subDicts = subscriptions.map { OpenIapSerialization.encode($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: subDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "getActiveSubscriptions",
                            requestId: requestId
                        )
                        dict["subscriptionsJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await self.emitAsyncFailure(
                        method: "getActiveSubscriptions",
                        requestId: requestId,
                        message: "Failed to serialize active subscriptions"
                    )
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getActiveSubscriptions error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getActiveSubscriptions",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func hasActiveSubscriptions(subscriptionIdsJson: String) -> String {
        GodotIapLog.payload("Checking active subscriptions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                var subscriptionIds: [String]? = nil
                if !subscriptionIdsJson.isEmpty,
                   let data = subscriptionIdsJson.data(using: .utf8),
                   let ids = try? JSONDecoder().decode([String].self, from: data) {
                    subscriptionIds = ids.isEmpty ? nil : ids
                }

                let hasActive = try await self.openIap.hasActiveSubscriptions(subscriptionIds)

                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "hasActiveSubscriptions",
                        requestId: requestId
                    )
                    dict["hasActive"] = Variant(hasActive)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] hasActiveSubscriptions error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "hasActiveSubscriptions",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getStorefront() -> String {
        GodotIapLog.payload("Getting storefront", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let countryCode = try await self.openIap.getStorefront()
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "getStorefront",
                        requestId: requestId
                    )
                    dict["countryCode"] = Variant(countryCode)
                    self.productsFetched.emit(dict)
                }
            } catch {
                await self.emitAsyncFailure(
                    method: "getStorefront",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - iOS Specific Methods

    @Callable
    public func syncIOS() -> String {
        GodotIapLog.payload("Syncing with App Store", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.syncIOS()
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("syncIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
                GodotIapLog.debug("[GodotIap] Sync completed: \(result)")
            } catch {
                GodotIapLog.debug("[GodotIap] syncIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("syncIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func clearTransactionIOS() -> String {
        GodotIapLog.payload("Clearing transactions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.clearTransactionIOS()
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("clearTransactionIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(result)
                    self.productsFetched.emit(dict)
                }
                GodotIapLog.debug("[GodotIap] Clear transactions completed: \(result)")
            } catch {
                GodotIapLog.debug("[GodotIap] clearTransactionIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("clearTransactionIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getPendingTransactionsIOS() -> String {
        GodotIapLog.payload("Getting pending transactions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let transactions = try await self.openIap.getPendingTransactionsIOS()
                let transactionDicts = transactions.map { self.purchaseIOSToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: transactionDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("getPendingTransactionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(true)
                        dict["transactionsJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("getPendingTransactionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(false)
                        dict["error"] = Variant("Failed to serialize pending transactions")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getPendingTransactionsIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("getPendingTransactionsIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getAllTransactionsIOS() -> String {
        GodotIapLog.payload("Getting all transactions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let transactions = try await self.openIap.getAllTransactionsIOS()
                let transactionDicts = transactions.map { self.purchaseIOSToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: transactionDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("getAllTransactionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(true)
                        dict["transactionsJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("getAllTransactionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(false)
                        dict["error"] = Variant("Failed to serialize all transactions")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getAllTransactionsIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("getAllTransactionsIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func presentCodeRedemptionSheetIOS() -> String {
        GodotIapLog.payload("Presenting code redemption sheet", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchase = try await self.openIap.presentCodeRedemptionSheetIOS()
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("presentCodeRedemptionSheetIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(true)
                    if let purchase,
                       let jsonData = try? JSONSerialization.data(
                           withJSONObject: self.purchaseIOSToDictionary(purchase)
                       ),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["purchaseJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentCodeRedemptionSheetIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("presentCodeRedemptionSheetIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func showManageSubscriptionsIOS() -> String {
        GodotIapLog.payload("Showing manage subscriptions", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchases = try await self.openIap.showManageSubscriptionsIOS()
                let purchaseDicts = purchases.map { self.purchaseIOSToDictionary($0) }

                if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("showManageSubscriptionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(true)
                        dict["purchasesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("showManageSubscriptionsIOS")
                        dict["requestId"] = Variant(requestId)
                        dict["success"] = Variant(false)
                        dict["error"] = Variant("Failed to serialize changed purchases")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] showManageSubscriptionsIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("showManageSubscriptionsIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func beginRefundRequestIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Beginning refund request for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.beginRefundRequestIOS(sku: sku)
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("beginRefundRequestIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(true)
                    dict["status"] = Variant(result ?? "unknown")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] beginRefundRequestIOS error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("beginRefundRequestIOS")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func currentEntitlementIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting current entitlement for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchase = try await self.openIap.currentEntitlementIOS(sku: sku)
                if let purchase = purchase {
                    let purchaseDict = self.purchaseIOSToDictionary(purchase)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = self.asyncResultDictionary(
                                method: "currentEntitlementIOS",
                                requestId: requestId
                            )
                            dict["purchaseJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    } else {
                        await self.emitAsyncFailure(
                            method: "currentEntitlementIOS",
                            requestId: requestId,
                            message: "Failed to serialize current entitlement"
                        )
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "currentEntitlementIOS",
                            requestId: requestId
                        )
                        dict["purchaseJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] currentEntitlementIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "currentEntitlementIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func latestTransactionIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting latest transaction for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let purchase = try await self.openIap.latestTransactionIOS(sku: sku)
                if let purchase = purchase {
                    let purchaseDict = self.purchaseIOSToDictionary(purchase)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = self.asyncResultDictionary(
                                method: "latestTransactionIOS",
                                requestId: requestId
                            )
                            dict["purchaseJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    } else {
                        await self.emitAsyncFailure(
                            method: "latestTransactionIOS",
                            requestId: requestId,
                            message: "Failed to serialize latest transaction"
                        )
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "latestTransactionIOS",
                            requestId: requestId
                        )
                        dict["purchaseJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] latestTransactionIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "latestTransactionIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getAppTransactionIOS() -> String {
        GodotIapLog.payload("Getting app transaction", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let appTransaction = try await self.openIap.getAppTransactionIOS()
                if let appTransaction = appTransaction {
                    let transactionDict = OpenIapSerialization.encode(appTransaction)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: transactionDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = self.asyncResultDictionary(
                                method: "getAppTransactionIOS",
                                requestId: requestId
                            )
                            dict["appTransactionJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    } else {
                        await self.emitAsyncFailure(
                            method: "getAppTransactionIOS",
                            requestId: requestId,
                            message: "Failed to serialize app transaction"
                        )
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "getAppTransactionIOS",
                            requestId: requestId
                        )
                        dict["appTransactionJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getAppTransactionIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getAppTransactionIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func subscriptionStatusIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting subscription status for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let statuses = try await self.openIap.subscriptionStatusIOS(sku: sku)
                let statusDicts: [[String: Any]] = statuses.map { status in
                    return OpenIapSerialization.encode(status)
                }

                if let jsonData = try? JSONSerialization.data(withJSONObject: statusDicts),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "subscriptionStatusIOS",
                            requestId: requestId
                        )
                        dict["statusesJson"] = Variant(jsonString)
                        self.productsFetched.emit(dict)
                    }
                } else {
                    await self.emitAsyncFailure(
                        method: "subscriptionStatusIOS",
                        requestId: requestId,
                        message: "Failed to serialize subscription status"
                    )
                }
            } catch {
                GodotIapLog.debug("[GodotIap] subscriptionStatusIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "subscriptionStatusIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func isEligibleForIntroOfferIOS(groupId: String) -> String {
        GodotIapLog.debug("[GodotIap] Checking intro offer eligibility for group: \(groupId)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let isEligible = try await self.openIap.isEligibleForIntroOfferIOS(groupID: groupId)
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "isEligibleForIntroOfferIOS",
                        requestId: requestId
                    )
                    dict["isEligible"] = Variant(isEligible)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] isEligibleForIntroOfferIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "isEligibleForIntroOfferIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getPromotedProductIOS() -> String {
        GodotIapLog.payload("Getting promoted product", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let product = try await self.openIap.getPromotedProductIOS()
                if let product = product {
                    let productDict = self.productIOSToDictionary(product)
                    if let jsonData = try? JSONSerialization.data(withJSONObject: productDict),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        await MainActor.run { [self] in
                            let dict = self.asyncResultDictionary(
                                method: "getPromotedProductIOS",
                                requestId: requestId
                            )
                            dict["productJson"] = Variant(jsonString)
                            self.productsFetched.emit(dict)
                        }
                    } else {
                        await self.emitAsyncFailure(
                            method: "getPromotedProductIOS",
                            requestId: requestId,
                            message: "Failed to serialize promoted product"
                        )
                    }
                } else {
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "getPromotedProductIOS",
                            requestId: requestId
                        )
                        dict["productJson"] = Variant("null")
                        self.productsFetched.emit(dict)
                    }
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getPromotedProductIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getPromotedProductIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func canPresentExternalPurchaseNoticeIOS() -> String {
        GodotIapLog.payload("Checking if can present external purchase notice", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let canPresent = try await self.openIap.canPresentExternalPurchaseNoticeIOS()
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "canPresentExternalPurchaseNoticeIOS",
                        requestId: requestId
                    )
                    dict["canPresent"] = Variant(canPresent)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] canPresentExternalPurchaseNoticeIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "canPresentExternalPurchaseNoticeIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func presentExternalPurchaseNoticeSheetIOS() -> String {
        GodotIapLog.payload("Presenting external purchase notice sheet", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.presentExternalPurchaseNoticeSheetIOS()
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "presentExternalPurchaseNoticeSheetIOS",
                        requestId: requestId
                    )
                    if let jsonData = try? JSONSerialization.data(
                        withJSONObject: OpenIapSerialization.encode(result)
                    ), let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["resultJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentExternalPurchaseNoticeSheetIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "presentExternalPurchaseNoticeSheetIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func presentExternalPurchaseLinkIOS(url: String) -> String {
        GodotIapLog.debug("[GodotIap] Presenting external purchase link: \(url)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let result = try await self.openIap.presentExternalPurchaseLinkIOS(url)
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "presentExternalPurchaseLinkIOS",
                        requestId: requestId
                    )
                    if let jsonData = try? JSONSerialization.data(withJSONObject: OpenIapSerialization.encode(result)),
                       let jsonString = String(data: jsonData, encoding: .utf8) {
                        dict["resultJson"] = Variant(jsonString)
                    }
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] presentExternalPurchaseLinkIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "presentExternalPurchaseLinkIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func deepLinkToSubscriptions(optionsJson: String) -> String {
        GodotIapLog.payload("Deep linking to subscriptions", payload: nil)
        let requestId = UUID().uuidString

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
                    dict["method"] = Variant("deepLinkToSubscriptions")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(true)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] deepLinkToSubscriptions error: \(error.localizedDescription)")
                await MainActor.run { [self] in
                    let dict = VariantDictionary()
                    dict["method"] = Variant("deepLinkToSubscriptions")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - Verification Methods

    @Callable
    public func verifyPurchase(propsJson: String) -> String {
        GodotIapLog.payload("Verifying purchase", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                guard let data = propsJson.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("verifyPurchase")
                        dict["requestId"] = Variant(requestId)
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
                    dict["method"] = Variant("verifyPurchase")
                    dict["requestId"] = Variant(requestId)
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
                    dict["method"] = Variant("verifyPurchase")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getReceiptDataIOS() -> String {
        GodotIapLog.payload("Getting receipt data", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let receiptData = try await self.openIap.getReceiptDataIOS()
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "getReceiptDataIOS",
                        requestId: requestId
                    )
                    dict["receiptData"] = Variant(receiptData ?? "")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getReceiptDataIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getReceiptDataIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func isTransactionVerifiedIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Checking if transaction is verified for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let isVerified = try await self.openIap.isTransactionVerifiedIOS(sku: sku)
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "isTransactionVerifiedIOS",
                        requestId: requestId
                    )
                    dict["isVerified"] = Variant(isVerified)
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] isTransactionVerifiedIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "isTransactionVerifiedIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getTransactionJwsIOS(sku: String) -> String {
        GodotIapLog.debug("[GodotIap] Getting transaction JWS for: \(sku)")
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                let jws = try await self.openIap.getTransactionJwsIOS(sku: sku)
                await MainActor.run { [self] in
                    let dict = self.asyncResultDictionary(
                        method: "getTransactionJwsIOS",
                        requestId: requestId
                    )
                    dict["jws"] = Variant(jws ?? "")
                    self.productsFetched.emit(dict)
                }
            } catch {
                GodotIapLog.debug("[GodotIap] getTransactionJwsIOS error: \(error.localizedDescription)")
                await self.emitAsyncFailure(
                    method: "getTransactionJwsIOS",
                    requestId: requestId,
                    message: error.localizedDescription
                )
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func verifyPurchaseWithProvider(propsJson: String) -> String {
        GodotIapLog.payload("Verifying purchase with provider", payload: nil)
        let requestId = UUID().uuidString

        Task { [weak self] in
            guard let self = self else { return }
            do {
                guard let data = propsJson.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    await MainActor.run { [self] in
                        let dict = VariantDictionary()
                        dict["method"] = Variant("verifyPurchaseWithProvider")
                        dict["requestId"] = Variant(requestId)
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
                    dict["method"] = Variant("verifyPurchaseWithProvider")
                    dict["requestId"] = Variant(requestId)
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
                    dict["method"] = Variant("verifyPurchaseWithProvider")
                    dict["requestId"] = Variant(requestId)
                    dict["success"] = Variant(false)
                    dict["error"] = Variant(error.localizedDescription)
                    self.productsFetched.emit(dict)
                }
            }
        }

        return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - ExternalPurchaseCustomLink (iOS 18.1+)

    /// Check eligibility asynchronously. Returns a pending-status JSON string
    /// immediately and emits the actual result through ``productsFetched`` with
    /// ``eligible`` set to true/false. Avoids the main-thread deadlock that a
    /// blocking ``DispatchSemaphore`` would cause when ``OpenIapModule`` hops
    /// back to the main actor.
    @Callable
    public func isEligibleForExternalPurchaseCustomLinkIOS() -> String {
        GodotIapLog.payload("isEligibleForExternalPurchaseCustomLinkIOS", payload: nil)
        let requestId = UUID().uuidString
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, *) {
            Task { [weak self] in
                guard let self = self else { return }
                do {
                    let eligible = try await self.openIap.isEligibleForExternalPurchaseCustomLinkIOS()
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "isEligibleForExternalPurchaseCustomLinkIOS",
                            requestId: requestId
                        )
                        dict["eligible"] = Variant(eligible)
                        self.productsFetched.emit(dict)
                    }
                } catch {
                    GodotIapLog.debug("[GodotIap] isEligibleForExternalPurchaseCustomLinkIOS error: \(error.localizedDescription)")
                    await self.emitAsyncFailure(
                        method: "isEligibleForExternalPurchaseCustomLinkIOS",
                        requestId: requestId,
                        message: error.localizedDescription
                    )
                }
            }
            return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
        }
        // Unsupported OS: still emit the signal so awaiting GDScript wrappers
        // unblock with success=false, error="unsupported" instead of deadlocking.
        Task { [weak self] in
            await self?.emitAsyncFailure(
                method: "isEligibleForExternalPurchaseCustomLinkIOS",
                requestId: requestId,
                message: "unsupported"
            )
        }
        return "{\"status\": \"unsupported\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func getExternalPurchaseCustomLinkTokenIOS(tokenType: String) -> String {
        GodotIapLog.payload("getExternalPurchaseCustomLinkTokenIOS", payload: tokenType)
        let requestId = UUID().uuidString
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, *) {
            Task { [weak self] in
                guard let self = self else { return }
                do {
                    guard let type = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: tokenType) else {
                        throw NSError(domain: "GodotIap", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid token type: \(tokenType)"])
                    }
                    let result = try await self.openIap.getExternalPurchaseCustomLinkTokenIOS(type)
                    let resultDict = OpenIapSerialization.encode(result)
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "getExternalPurchaseCustomLinkTokenIOS",
                            requestId: requestId
                        )
                        if let jsonData = try? JSONSerialization.data(withJSONObject: resultDict),
                           let jsonString = String(data: jsonData, encoding: .utf8) {
                            dict["resultJson"] = Variant(jsonString)
                        }
                        self.productsFetched.emit(dict)
                    }
                } catch {
                    GodotIapLog.debug("[GodotIap] getExternalPurchaseCustomLinkTokenIOS error: \(error.localizedDescription)")
                    await self.emitAsyncFailure(
                        method: "getExternalPurchaseCustomLinkTokenIOS",
                        requestId: requestId,
                        message: error.localizedDescription
                    )
                }
            }
            return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
        }
        Task { [weak self] in
            await self?.emitAsyncFailure(
                method: "getExternalPurchaseCustomLinkTokenIOS",
                requestId: requestId,
                message: "unsupported"
            )
        }
        return "{\"status\": \"unsupported\", \"requestId\": \"\(requestId)\"}"
    }

    @Callable
    public func showExternalPurchaseCustomLinkNoticeIOS(noticeType: String) -> String {
        GodotIapLog.payload("showExternalPurchaseCustomLinkNoticeIOS", payload: noticeType)
        let requestId = UUID().uuidString
        if #available(iOS 18.1, macOS 15.1, tvOS 18.1, *) {
            Task { [weak self] in
                guard let self = self else { return }
                do {
                    guard let type = ExternalPurchaseCustomLinkNoticeTypeIOS(rawValue: noticeType) else {
                        throw NSError(domain: "GodotIap", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid notice type: \(noticeType)"])
                    }
                    let result = try await self.openIap.showExternalPurchaseCustomLinkNoticeIOS(type)
                    let resultDict = OpenIapSerialization.encode(result)
                    await MainActor.run { [self] in
                        let dict = self.asyncResultDictionary(
                            method: "showExternalPurchaseCustomLinkNoticeIOS",
                            requestId: requestId
                        )
                        if let jsonData = try? JSONSerialization.data(withJSONObject: resultDict),
                           let jsonString = String(data: jsonData, encoding: .utf8) {
                            dict["resultJson"] = Variant(jsonString)
                        }
                        self.productsFetched.emit(dict)
                    }
                } catch {
                    GodotIapLog.debug("[GodotIap] showExternalPurchaseCustomLinkNoticeIOS error: \(error.localizedDescription)")
                    await self.emitAsyncFailure(
                        method: "showExternalPurchaseCustomLinkNoticeIOS",
                        requestId: requestId,
                        message: error.localizedDescription
                    )
                }
            }
            return "{\"status\": \"pending\", \"requestId\": \"\(requestId)\"}"
        }
        Task { [weak self] in
            await self?.emitAsyncFailure(
                method: "showExternalPurchaseCustomLinkNoticeIOS",
                requestId: requestId,
                message: "unsupported"
            )
        }
        return "{\"status\": \"unsupported\", \"requestId\": \"\(requestId)\"}"
    }

    // MARK: - Private Helpers

    @MainActor
    private func asyncResultDictionary(
        method: String,
        requestId: String,
        success: Bool = true
    ) -> VariantDictionary {
        let dict = VariantDictionary()
        dict["method"] = Variant(method)
        dict["requestId"] = Variant(requestId)
        dict["success"] = Variant(success)
        return dict
    }

    @MainActor
    private func emitAsyncFailure(
        method: String,
        requestId: String,
        message: String
    ) {
        let dict = asyncResultDictionary(
            method: method,
            requestId: requestId,
            success: false
        )
        dict["error"] = Variant(message)
        self.productsFetched.emit(dict)
    }

    private func withLifecycleLock<T>(_ operation: () -> T) -> T {
        lifecycleLock.lock()
        defer { lifecycleLock.unlock() }
        return operation()
    }

    private func advanceConnectionGeneration() -> (
        generation: UInt64,
        listeners: [Subscription]
    ) {
        withLifecycleLock { advanceConnectionGenerationLocked() }
    }

    private func advanceConnectionGenerationLocked() -> (
        generation: UInt64,
        listeners: [Subscription]
    ) {
        lifecycleGeneration &+= 1
        isConnected = false
        return (lifecycleGeneration, takeListenersLocked())
    }

    private func enqueueLifecycleOperation(
        _ operation: @escaping (UInt64) async -> Void
    ) {
        withLifecycleLock {
            let predecessor = lifecycleTail
            let task = Task { [weak self] in
                if let predecessor {
                    await predecessor.value
                }
                guard let self else { return }
                let lifecycle = self.advanceConnectionGeneration()
                self.removeListeners(lifecycle.listeners)
                await operation(lifecycle.generation)
            }
            lifecycleTail = task
        }
    }

    private func takeListenersLocked() -> [Subscription] {
        let listeners = [
            purchaseUpdateSubscription,
            purchaseErrorSubscription,
            promotedProductSubscription,
            subscriptionBillingIssueSubscription,
        ].compactMap { $0 }
        purchaseUpdateSubscription = nil
        purchaseErrorSubscription = nil
        promotedProductSubscription = nil
        subscriptionBillingIssueSubscription = nil
        return listeners
    }

    private func removeListeners(_ listeners: [Subscription]) {
        for subscription in listeners {
            openIap.removeListener(subscription)
        }
    }

    private func installListenersIfOwned(generation: UInt64) -> Bool {
        withLifecycleLock {
            guard lifecycleGeneration == generation else { return false }

            purchaseUpdateSubscription = makePurchaseUpdatedListener(
                generation: generation,
                dedupeTransactionIOS: dedupeTransactionIOS
            )
            purchaseErrorSubscription = openIap.purchaseErrorListener { [weak self] error in
                Task { @MainActor [weak self] in
                    guard let self,
                          self.isConnectionActive(generation: generation) else { return }
                    self.emitPurchaseError(error)
                }
            }
            promotedProductSubscription = openIap.promotedProductListenerIOS { [weak self] productId in
                Task { @MainActor [weak self] in
                    guard let self,
                          self.isConnectionActive(generation: generation) else { return }
                    self.promotedProduct.emit(productId)
                }
            }
            subscriptionBillingIssueSubscription = openIap.subscriptionBillingIssueListener { [weak self] purchase in
                Task { @MainActor [weak self] in
                    guard let self,
                          self.isConnectionActive(generation: generation) else { return }
                    self.emitSubscriptionBillingIssue(purchase: purchase)
                }
            }
            isConnected = true
            return true
        }
    }

    private func replacePurchaseUpdatedListener(
        dedupeTransactionIOS: Bool
    ) -> Subscription? {
        withLifecycleLock {
            self.dedupeTransactionIOS = dedupeTransactionIOS
            guard isConnected else { return nil }

            let previousSubscription = purchaseUpdateSubscription
            purchaseUpdateSubscription = makePurchaseUpdatedListener(
                generation: lifecycleGeneration,
                dedupeTransactionIOS: dedupeTransactionIOS
            )
            return previousSubscription
        }
    }

    private func makePurchaseUpdatedListener(
        generation: UInt64,
        dedupeTransactionIOS: Bool
    ) -> Subscription {
        let options = PurchaseUpdatedListenerOptions(
            dedupeTransactionIOS: dedupeTransactionIOS
        )
        return openIap.purchaseUpdatedListener({ [weak self] purchase in
            Task { @MainActor [weak self] in
                guard let self,
                      self.isConnectionActive(generation: generation) else { return }
                self.emitPurchaseUpdated(purchase: purchase)
            }
        }, options: options)
    }

    private func isConnectionGenerationCurrent(_ generation: UInt64) -> Bool {
        withLifecycleLock { lifecycleGeneration == generation }
    }

    private func isConnectionActive(generation: UInt64) -> Bool {
        withLifecycleLock {
            lifecycleGeneration == generation && isConnected
        }
    }

    @MainActor
    private func emitInitConnectionSuccess(
        generation: UInt64,
        requestId: String
    ) {
        guard isConnectionActive(generation: generation) else { return }
        connected.emit(1)
        let dict = asyncResultDictionary(
            method: "initConnection",
            requestId: requestId
        )
        productsFetched.emit(dict)
    }

    @MainActor
    private func emitInitConnectionFailure(
        generation: UInt64,
        requestId: String,
        message: String
    ) {
        guard isConnectionGenerationCurrent(generation) else { return }
        connected.emit(0)
        emitAsyncFailure(
            method: "initConnection",
            requestId: requestId,
            message: message
        )
    }

    @MainActor
    private func emitEndConnectionSuccess(
        generation: UInt64,
        requestId: String
    ) {
        guard isConnectionGenerationCurrent(generation) else { return }
        disconnected.emit(0)
        let dict = asyncResultDictionary(
            method: "endConnection",
            requestId: requestId
        )
        productsFetched.emit(dict)
    }

    @MainActor
    private func emitEndConnectionFailure(
        generation: UInt64,
        requestId: String,
        message: String
    ) {
        guard isConnectionGenerationCurrent(generation) else { return }
        emitAsyncFailure(
            method: "endConnection",
            requestId: requestId,
            message: message
        )
    }

    private func purchaseProductId(from props: RequestPurchaseProps) -> String? {
        switch props.request {
        case .purchase(let platforms):
            return platforms.apple?.sku
        case .subscription(let platforms):
            return platforms.apple?.sku
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
    private func emitSubscriptionBillingIssue(purchase: Purchase) {
        let dict = VariantDictionary()
        dict["productId"] = Variant(purchase.productId)
        dict["purchaseState"] = Variant(purchase.purchaseState.rawValue)
        switch purchase {
        case .purchaseIos(let p):
            dict["id"] = Variant(p.id)
            dict["transactionId"] = Variant(p.transactionId)
            dict["transactionDate"] = Variant(p.transactionDate)
            dict["store"] = Variant(p.store.rawValue)
        case .purchaseAndroid(let p):
            dict["id"] = Variant(p.id)
            dict["transactionId"] = Variant(p.transactionId ?? "")
            dict["transactionDate"] = Variant(p.transactionDate)
            dict["store"] = Variant(p.store.rawValue)
        }
        if let jsonData = try? JSONSerialization.data(withJSONObject: purchaseToDictionary(purchase)),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            dict["purchaseJson"] = Variant(jsonString)
        }
        self.subscriptionBillingIssue.emit(dict)
    }

    @MainActor
    private func purchaseErrorDictionary(
        _ error: PurchaseError,
        fallbackProductId: String? = nil
    ) -> VariantDictionary {
        let dict = VariantDictionary()
        dict["code"] = Variant(error.code.rawValue)
        dict["message"] = Variant(error.message)
        if let debugMessage = error.debugMessage {
            dict["debugMessage"] = Variant(debugMessage)
        }
        if let productId = error.productId ?? fallbackProductId {
            dict["productId"] = Variant(productId)
        }
        if let productIds = error.productIds {
            dict["productIds"] = productIds.toVariant()
        }
        if let productType = error.productType {
            dict["productType"] = Variant(productType)
        }
        if let isEmptyProductList = error.isEmptyProductList {
            dict["isEmptyProductList"] = Variant(isEmptyProductList)
        }
        if let responseCode = error.responseCode {
            dict["responseCode"] = Variant(responseCode)
        }
        if let subResponseCode = error.subResponseCodeAndroid {
            dict["subResponseCodeAndroid"] = Variant(subResponseCode.rawValue)
        }
        return dict
    }

    @MainActor
    private func emitPurchaseError(
        _ error: PurchaseError,
        fallbackProductId: String? = nil
    ) {
        self.purchaseError.emit(
            purchaseErrorDictionary(error, fallbackProductId: fallbackProductId)
        )
    }

    @MainActor
    private func emitPurchaseError(
        code: String,
        message: String,
        productId: String? = nil,
        debugMessage: String? = nil
    ) {
        let dict = VariantDictionary()
        dict["code"] = Variant(code)
        dict["message"] = Variant(message)
        if let productId {
            dict["productId"] = Variant(productId)
        }
        if let debugMessage {
            dict["debugMessage"] = Variant(debugMessage)
        }
        self.purchaseError.emit(dict)
    }

    @MainActor
    private func emitProductsFetched(
        success: Bool,
        products: [[String: Any]]? = nil,
        error: String? = nil,
        method: String,
        requestId: String
    ) {
        let dict = asyncResultDictionary(
            method: method,
            requestId: requestId,
            success: success
        )

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
        switch product {
        case .productIos(let ios):
            return OpenIapSerialization.encode(ios)
        case .productAndroid(let android):
            return OpenIapSerialization.encode(android)
        }
    }

    private func productIOSToDictionary(_ product: ProductIOS) -> [String: Any] {
        return OpenIapSerialization.encode(product)
    }

    private func subscriptionToDictionary(_ subscription: ProductSubscription) -> [String: Any] {
        switch subscription {
        case .productSubscriptionIos(let ios):
            return OpenIapSerialization.encode(ios)
        case .productSubscriptionAndroid(let android):
            return OpenIapSerialization.encode(android)
        }
    }

    private func jsonString(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let string = String(data: data, encoding: .utf8) else {
            return "{\"success\": false, \"code\": \"unknown\", \"error\": \"JSON serialization failed\"}"
        }
        return string
    }

    private func purchaseToDictionary(_ purchase: Purchase) -> [String: Any] {
        switch purchase {
        case .purchaseIos(let p):
            return OpenIapSerialization.encode(p)
        case .purchaseAndroid(let p):
            return OpenIapSerialization.encode(p)
        }
    }

    private func purchaseIOSToDictionary(_ purchase: PurchaseIOS) -> [String: Any] {
        OpenIapSerialization.encode(purchase)
    }
}
