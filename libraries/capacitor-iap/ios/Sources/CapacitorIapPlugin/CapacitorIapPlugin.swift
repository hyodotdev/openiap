import Capacitor
import Foundation
import OpenIAP

/// Bridges the capacitor-iap JavaScript API to OpenIAP's StoreKit 2 module.
/// Every method resolves `{ value }` and rejects with the OpenIAP error code,
/// carrying the full PurchaseError payload as the rejection's data.
@objc(CapacitorIapPlugin)
public class CapacitorIapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorIapPlugin"
    public let jsName = "CapacitorIap"
    public let pluginMethods: [CAPPluginMethod] = [
        "initConnection",
        "endConnection",
        "fetchProducts",
        "requestPurchase",
        "finishTransaction",
        "getAvailablePurchases",
        "getActiveSubscriptions",
        "hasActiveSubscriptions",
        "restorePurchases",
        "deepLinkToSubscriptions",
        "openRedeemOfferCode",
        "getStorefront",
        "verifyPurchase",
        "verifyPurchaseWithProvider",
        "verifyAppOwnership",
        "setPurchaseUpdatedListenerOptions",
        "claimFirstPurchaseNotice",
        "syncIOS",
        "isEligibleForIntroOfferIOS",
        "subscriptionStatusIOS",
        "currentEntitlementIOS",
        "latestTransactionIOS",
        "beginRefundRequestIOS",
        "showManageSubscriptionsIOS",
        "getReceiptDataIOS",
        "requestReceiptRefreshIOS",
        "isTransactionVerifiedIOS",
        "getTransactionJwsIOS",
        "getAppTransactionIOS",
        "getPromotedProductIOS",
        "getPendingTransactionsIOS",
        "getAllTransactionsIOS",
        "clearTransactionIOS",
        "canPresentExternalPurchaseNoticeIOS",
        "presentExternalPurchaseNoticeSheetIOS",
        "presentExternalPurchaseLinkIOS",
        "isEligibleForExternalPurchaseCustomLinkIOS",
        "getExternalPurchaseCustomLinkTokenIOS",
        "showExternalPurchaseCustomLinkNoticeIOS",
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    private let store = OpenIapModule.shared
    private let listeners = CapacitorIapListeners()

    override public func load() {
        listeners.attach(to: self, store: store)
    }

    deinit {
        listeners.detach(from: store)
    }

    // MARK: - Connection

    @objc func initConnection(_ call: CAPPluginCall) {
        // iOS ignores the config; it has no alternative billing parameter.
        respond(call, "initConnection", fallback: .initConnection) { [store] in
            try await store.initConnection()
        }
    }

    @objc func endConnection(_ call: CAPPluginCall) {
        respond(call, "endConnection") { [store] in
            try await store.endConnection()
        }
    }

    // MARK: - Products and purchases

    @objc func fetchProducts(_ call: CAPPluginCall) {
        let skus = call.getArray("skus", String.self) ?? []
        let type = ProductQueryType(rawValue: call.getString("type") ?? "") ?? .inApp
        respond(call, "fetchProducts", fallback: .queryProduct) { [store] in
            let request = try OpenIapSerialization.productRequest(skus: skus, type: type)
            return OpenIapSerialization.products(try await store.fetchProducts(request))
        }
    }

    @objc func requestPurchase(_ call: CAPPluginCall) {
        let request = Self.object(call, "request")
        respond(call, "requestPurchase", fallback: .purchaseError) { [store] in
            let props = try OpenIapSerialization.requestPurchaseProps(from: request ?? [:])
            switch try await store.requestPurchase(props) {
            case .purchase(let purchase):
                return purchase.map(OpenIapSerialization.purchase)
            case .purchases(let purchases):
                return purchases.map(OpenIapSerialization.purchases)
            case nil:
                return nil
            }
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        let purchase = Self.object(call, "purchase")
        let isConsumable = call.getBool("isConsumable") ?? false
        respond(call, "finishTransaction", productId: purchase?["productId"] as? String) { [store] in
            let input = try OpenIapSerialization.purchaseInput(from: purchase ?? [:])
            try await store.finishTransaction(purchase: input, isConsumable: isConsumable)
            return true
        }
    }

    @objc func getAvailablePurchases(_ call: CAPPluginCall) {
        let options = Self.object(call, "options") ?? [:]
        respond(call, "getAvailablePurchases") { [store] in
            let purchaseOptions = try OpenIapSerialization.purchaseOptions(from: options)
            return try OpenIapSerialization.purchasesRequired(
                try await store.getAvailablePurchases(purchaseOptions)
            )
        }
    }

    @objc func getActiveSubscriptions(_ call: CAPPluginCall) {
        let ids = call.getArray("subscriptionIds", String.self)
        respond(call, "getActiveSubscriptions") { [store] in
            try await store.getActiveSubscriptions(ids).map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func hasActiveSubscriptions(_ call: CAPPluginCall) {
        let ids = call.getArray("subscriptionIds", String.self)
        respond(call, "hasActiveSubscriptions") { [store] in
            try await store.hasActiveSubscriptions(ids)
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        respond(call, "restorePurchases", fallback: .syncError) { [store] in
            try await store.restorePurchases()
            return true
        }
    }

    @objc func deepLinkToSubscriptions(_ call: CAPPluginCall) {
        respond(call, "deepLinkToSubscriptions") { [store] in
            try await store.deepLinkToSubscriptions(nil)
            return true
        }
    }

    @objc func openRedeemOfferCode(_ call: CAPPluginCall) {
        respond(call, "openRedeemOfferCode", fallback: .purchaseError) { [store] in
            try await store.openRedeemOfferCode().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func getStorefront(_ call: CAPPluginCall) {
        respond(call, "getStorefront") { [store] in
            try await store.getStorefront()
        }
    }

    @objc func verifyPurchase(_ call: CAPPluginCall) {
        let props = Self.object(call, "props") ?? [:]
        respond(call, "verifyPurchase", fallback: .purchaseVerificationFailed) { [store] in
            let verifyProps = try OpenIapSerialization.verifyPurchaseProps(from: props)
            // The VerifyPurchaseResult union encodes flat, with `__typename`.
            return OpenIapSerialization.encode(try await store.verifyPurchase(verifyProps))
        }
    }

    @objc func verifyPurchaseWithProvider(_ call: CAPPluginCall) {
        let props = Self.object(call, "props") ?? [:]
        respond(call, "verifyPurchaseWithProvider", fallback: .purchaseVerificationFailed) { [store] in
            let providerProps = try OpenIapSerialization.decode(
                object: props,
                as: VerifyPurchaseWithProviderProps.self
            )
            return OpenIapSerialization.encode(try await store.verifyPurchaseWithProvider(providerProps))
        }
    }

    @objc func verifyAppOwnership(_ call: CAPPluginCall) {
        let options = Self.object(call, "options") ?? [:]
        respond(call, "verifyAppOwnership") { [store] in
            let props = try OpenIapSerialization.decode(object: options, as: VerifyAppOwnershipProps.self)
            return OpenIapSerialization.encode(try await store.verifyAppOwnership(props))
        }
    }

    @objc func setPurchaseUpdatedListenerOptions(_ call: CAPPluginCall) {
        listeners.setPurchaseUpdatedOptions(
            PurchaseUpdatedListenerOptions(dedupeTransactionIOS: call.getBool("dedupeTransactionIOS")),
            plugin: self,
            store: store
        )
        call.resolve(["value": true])
    }

    // Internal: backs the JS first-purchase notice; not app API.
    @objc func claimFirstPurchaseNotice(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["value": OpenIapFirstPurchaseNotice.claim()])
        #else
        call.resolve(["value": false])
        #endif
    }

    // MARK: - iOS

    @objc func syncIOS(_ call: CAPPluginCall) {
        respond(call, "syncIOS", fallback: .syncError) { [store] in
            try await store.syncIOS()
        }
    }

    @objc func isEligibleForIntroOfferIOS(_ call: CAPPluginCall) {
        let groupID = call.getString("groupID") ?? ""
        respond(call, "isEligibleForIntroOfferIOS") { [store] in
            try await store.isEligibleForIntroOfferIOS(groupID: groupID)
        }
    }

    @objc func subscriptionStatusIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "subscriptionStatusIOS") { [store] in
            try await store.subscriptionStatusIOS(sku: sku).map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func currentEntitlementIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "currentEntitlementIOS", fallback: .skuNotFound, productId: sku) { [store] in
            try await store.currentEntitlementIOS(sku: sku).map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func latestTransactionIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "latestTransactionIOS", fallback: .skuNotFound, productId: sku) { [store] in
            try await store.latestTransactionIOS(sku: sku).map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func beginRefundRequestIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "beginRefundRequestIOS") { [store] in
            try await store.beginRefundRequestIOS(sku: sku)
        }
    }

    @objc func showManageSubscriptionsIOS(_ call: CAPPluginCall) {
        respond(call, "showManageSubscriptionsIOS") { [store] in
            try await store.showManageSubscriptionsIOS().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func getReceiptDataIOS(_ call: CAPPluginCall) {
        respond(call, "getReceiptDataIOS") { [store] in
            try await store.getReceiptDataIOS() ?? ""
        }
    }

    @objc func requestReceiptRefreshIOS(_ call: CAPPluginCall) {
        respond(call, "requestReceiptRefreshIOS", fallback: .syncError) { [store] in
            _ = try await store.syncIOS()
            return try await store.getReceiptDataIOS() ?? ""
        }
    }

    @objc func isTransactionVerifiedIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "isTransactionVerifiedIOS") { [store] in
            try await store.isTransactionVerifiedIOS(sku: sku)
        }
    }

    @objc func getTransactionJwsIOS(_ call: CAPPluginCall) {
        let sku = call.getString("sku") ?? ""
        respond(call, "getTransactionJwsIOS") { [store] in
            try await store.getTransactionJwsIOS(sku: sku)
        }
    }

    @objc func getAppTransactionIOS(_ call: CAPPluginCall) {
        respond(call, "getAppTransactionIOS") { [store] in
            guard #available(iOS 16.0, *) else { return nil }
            return try await store.getAppTransactionIOS().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func getPromotedProductIOS(_ call: CAPPluginCall) {
        respond(call, "getPromotedProductIOS") { [store] in
            try await store.getPromotedProductIOS().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func getPendingTransactionsIOS(_ call: CAPPluginCall) {
        respond(call, "getPendingTransactionsIOS") { [store] in
            try await store.getPendingTransactionsIOS().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func getAllTransactionsIOS(_ call: CAPPluginCall) {
        respond(call, "getAllTransactionsIOS") { [store] in
            try await store.getAllTransactionsIOS().map(OpenIapSerialization.encodeRequired)
        }
    }

    @objc func clearTransactionIOS(_ call: CAPPluginCall) {
        respond(call, "clearTransactionIOS") { [store] in
            try await store.clearTransactionIOS()
        }
    }

    @objc func canPresentExternalPurchaseNoticeIOS(_ call: CAPPluginCall) {
        respond(call, "canPresentExternalPurchaseNoticeIOS") { [store] in
            try await store.canPresentExternalPurchaseNoticeIOS()
        }
    }

    @objc func presentExternalPurchaseNoticeSheetIOS(_ call: CAPPluginCall) {
        respond(call, "presentExternalPurchaseNoticeSheetIOS") { [store] in
            OpenIapSerialization.encode(try await store.presentExternalPurchaseNoticeSheetIOS())
        }
    }

    @objc func presentExternalPurchaseLinkIOS(_ call: CAPPluginCall) {
        let url = call.getString("url") ?? ""
        respond(call, "presentExternalPurchaseLinkIOS") { [store] in
            OpenIapSerialization.encode(try await store.presentExternalPurchaseLinkIOS(url))
        }
    }

    @objc func isEligibleForExternalPurchaseCustomLinkIOS(_ call: CAPPluginCall) {
        respond(call, "isEligibleForExternalPurchaseCustomLinkIOS") { [store] in
            try await store.isEligibleForExternalPurchaseCustomLinkIOS()
        }
    }

    @objc func getExternalPurchaseCustomLinkTokenIOS(_ call: CAPPluginCall) {
        let rawType = call.getString("tokenType") ?? ""
        respond(call, "getExternalPurchaseCustomLinkTokenIOS") { [store] in
            guard let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: rawType) else {
                throw PurchaseError.make(
                    code: .developerError,
                    message: "Invalid token type: \(rawType). Must be 'acquisition' or 'services'"
                )
            }
            return OpenIapSerialization.encode(try await store.getExternalPurchaseCustomLinkTokenIOS(tokenType))
        }
    }

    @objc func showExternalPurchaseCustomLinkNoticeIOS(_ call: CAPPluginCall) {
        let rawType = call.getString("noticeType") ?? ""
        respond(call, "showExternalPurchaseCustomLinkNoticeIOS") { [store] in
            guard let noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS(rawValue: rawType) else {
                throw PurchaseError.make(
                    code: .developerError,
                    message: "Invalid notice type: \(rawType). Must be 'browser'"
                )
            }
            return OpenIapSerialization.encode(try await store.showExternalPurchaseCustomLinkNoticeIOS(noticeType))
        }
    }

    // MARK: - Bridging

    private static func object(_ call: CAPPluginCall, _ key: String) -> [String: Any]? {
        call.options[key] as? [String: Any]
    }

    /// Runs `body` and resolves `{ value }`, or rejects with the OpenIAP error payload.
    private func respond(
        _ call: CAPPluginCall,
        _ name: String,
        fallback: ErrorCode = .serviceError,
        productId: String? = nil,
        _ body: @escaping () async throws -> Any?
    ) {
        Task {
            do {
                let value = try await body()
                call.resolve(["value": value ?? NSNull()])
            } catch {
                let purchaseError = Self.purchaseError(for: error, name: name, fallback: fallback, productId: productId)
                call.reject(
                    purchaseError.message,
                    purchaseError.code.rawValue,
                    error,
                    CapacitorIapListeners.payload(for: purchaseError)
                )
            }
        }
    }

    static func purchaseError(
        for error: Error,
        name: String,
        fallback: ErrorCode,
        productId: String?
    ) -> PurchaseError {
        // A DecodingError means JS passed arguments the schema rejects.
        guard error is DecodingError else {
            return PurchaseError.wrap(error, fallback: fallback, productId: productId)
        }
        return PurchaseError.make(
            code: .developerError,
            message: "Invalid arguments for \(name)",
            debugMessage: String(describing: error)
        )
    }
}
