import ExpoModulesCore
import Foundation
import OpenIAP

/// Exception wrapper for PurchaseError that preserves OpenIAP error codes
/// This ensures consistent error format between try-catch and onPurchaseError callback
final class IapException: GenericException<(code: String, envelope: String)>, @unchecked Sendable {
    private static let envelopePrefix = "OPENIAP_ERROR_JSON:"

    override var code: String { param.code }
    override var reason: String { param.envelope }

    static func from(_ error: PurchaseError) -> IapException {
        var payload = OpenIapSerialization.encode(error)
        payload["platform"] = "ios"

        let code = payload["code"] as? String ?? "unknown"
        if JSONSerialization.isValidJSONObject(payload),
           let data = try? JSONSerialization.data(withJSONObject: payload),
           let json = String(data: data, encoding: .utf8) {
            return IapException((code: code, envelope: envelopePrefix + json))
        }

        let fallbackPayload: [String: String] = [
            "code": code,
            "message": error.message,
            "platform": "ios"
        ]
        let fallbackData = try? JSONSerialization.data(withJSONObject: fallbackPayload)
        let fallbackJson = fallbackData.flatMap { String(data: $0, encoding: .utf8) }
            ?? "{\"code\":\"unknown\",\"message\":\"Unknown error occurred\",\"platform\":\"ios\"}"
        return IapException((code: code, envelope: envelopePrefix + fallbackJson))
    }
}

enum ExpoIapHelper {
    // Disambiguate Subscription type to the one provided by OpenIAP
    private static let listenerLock = NSRecursiveLock()
    private static var listeners: [OpenIAP.Subscription] = []
    private static var purchaseUpdatedSub: OpenIAP.Subscription?
    private static var purchaseUpdatedHandler: ((Purchase) -> Void)?
    private static var purchaseUpdatedOptions = PurchaseUpdatedListenerOptions()
    private static var listenerGeneration: UInt64 = 0
    private static var activeListenerGeneration: UInt64?
    private static var pendingConnectionCleanup: (
        generation: UInt64,
        task: Task<Void, Never>
    )?

    static func sanitizeDictionary(_ dictionary: [String: Any?]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in dictionary {
            if let value {
                result[key] = value
            }
        }
        return result
    }

    static func sanitizeArray(_ array: [[String: Any?]]) -> [[String: Any]] {
        array.map { sanitizeDictionary($0) }
    }

    // Overloads to support already-sanitized payloads (e.g., serialized OpenIAP responses)
    static func sanitizeDictionary(_ dictionary: [String: Any]) -> [String: Any] {
        dictionary
    }

    static func sanitizeArray(_ array: [[String: Any]]) -> [[String: Any]] {
        array
    }

    // Keep Expo IAP compatible with the currently published OpenIAP native
    // package while treating authoritative query serialization atomically.
    // Its non-throwing helpers use an empty dictionary as the failure sentinel.
    static func encodeRequired<T: Encodable>(_ value: T) throws -> [String: Any] {
        let encoded = OpenIapSerialization.encode(value)
        guard !encoded.isEmpty else {
            throw PurchaseError.make(
                code: .billingResponseJsonParseError,
                message: "Failed to serialize native \(T.self) payload"
            )
        }
        return encoded
    }

    static func purchasesRequired(_ purchases: [Purchase]) throws -> [[String: Any]] {
        try purchases.map { purchase in
            let encoded = OpenIapSerialization.purchase(purchase)
            guard !encoded.isEmpty else {
                throw PurchaseError.make(
                    code: .billingResponseJsonParseError,
                    message: "Failed to serialize native purchase payload"
                )
            }
            return encoded
        }
    }

    static func parseProductQueryType(_ rawValue: String?) throws -> ProductQueryType {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty
        else {
            return .inApp
        }
        switch raw.lowercased() {
        case ProductQueryType.inApp.rawValue:
            return .inApp
        case ProductQueryType.subs.rawValue:
            return .subs
        case ProductQueryType.all.rawValue:
            return .all
        default:
            throw PurchaseError.make(
                code: .developerError,
                message: "Unsupported product type: \(raw). Use in-app, subs, or all."
            )
        }
    }

    static func decodeProductRequest(from payload: [String: Any]) throws -> ProductRequest {
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = try parseProductQueryType(payload["type"] as? String)
            return try OpenIapSerialization.productRequest(skus: skus, type: type)
        }

        let indexedSkus = payload.keys
            .compactMap { Int($0) }
            .sorted()
            .compactMap { payload[String($0)] as? String }

        if !indexedSkus.isEmpty {
            return try OpenIapSerialization.productRequest(skus: indexedSkus, type: .all)
        }

        if let request = try? OpenIapSerialization.decode(object: payload, as: ProductRequest.self)
        {
            return request
        }

        throw PurchaseError.emptySkuList()
    }

    static func decodeRequestPurchaseProps(from payload: [String: Any]) throws
        -> RequestPurchaseProps
    {
        if payload.keys.contains("requestPurchase"),
           payload["requestPurchase"] != nil
        {
            return try OpenIapSerialization.decode(
                object: payload, as: RequestPurchaseProps.self)
        }
        if payload.keys.contains("requestSubscription"),
           payload["requestSubscription"] != nil
        {
            return try OpenIapSerialization.decode(
                object: payload, as: RequestPurchaseProps.self)
        }

        if payload.keys.contains("request"), let request = payload["request"] {
            let parsedType = try parseProductQueryType(payload["type"] as? String)
            let purchaseType: ProductQueryType = parsedType == .all ? .inApp : parsedType
            var normalized: [String: Any] = ["type": purchaseType.rawValue]
            switch purchaseType {
            case .subs:
                normalized["requestSubscription"] = request
            case .inApp:
                normalized["requestPurchase"] = request
            case .all:
                break
            }
            return try OpenIapSerialization.decode(
                object: normalized, as: RequestPurchaseProps.self)
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid request payload")
    }

    static func setupListeners(
        purchaseUpdated: @escaping (Purchase) -> Void,
        purchaseError: @escaping (PurchaseError) -> Void,
        promotedProduct: @escaping (String) async -> Void,
        subscriptionBillingIssue: @escaping (Purchase) -> Void
    ) -> UInt64 {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        cleanupListenersLocked()
        listenerGeneration &+= 1
        let generation = listenerGeneration
        activeListenerGeneration = generation

        purchaseUpdatedHandler = purchaseUpdated
        attachPurchaseUpdatedListenerLocked()

        let purchaseErrorSub = OpenIapModule.shared.purchaseErrorListener { error in
            Task { @MainActor in
                purchaseError(error)
            }
        }

        let promotedProductSub = OpenIapModule.shared.promotedProductListenerIOS { productId in
            Task { @MainActor in
                await promotedProduct(productId)
            }
        }

        let billingIssueSub = OpenIapModule.shared.subscriptionBillingIssueListener { purchase in
            Task { @MainActor in
                subscriptionBillingIssue(purchase)
            }
        }

        listeners = [
            purchaseErrorSub,
            promotedProductSub,
            billingIssueSub,
        ]
        return generation
    }

    static func setPurchaseUpdatedListenerOptions(_ options: PurchaseUpdatedListenerOptions?) {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        purchaseUpdatedOptions = options ?? PurchaseUpdatedListenerOptions()
        guard purchaseUpdatedHandler != nil else { return }
        if let purchaseUpdatedSub {
            OpenIapModule.shared.removeListener(purchaseUpdatedSub)
            self.purchaseUpdatedSub = nil
        }
        attachPurchaseUpdatedListenerLocked()
    }

    private static func attachPurchaseUpdatedListenerLocked() {
        guard let purchaseUpdatedHandler, purchaseUpdatedSub == nil else { return }

        purchaseUpdatedSub = OpenIapModule.shared.purchaseUpdatedListener({ purchase in
            Task { @MainActor in
                purchaseUpdatedHandler(purchase)
            }
        }, options: purchaseUpdatedOptions)
    }

    private static func beginStoreCleanup(
        ifOwnedBy listenerGeneration: UInt64
    ) -> Task<Void, Never>? {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        guard activeListenerGeneration == listenerGeneration else { return nil }
        cleanupListenersLocked()
        activeListenerGeneration = nil
        let task = Task {
            _ = try? await OpenIapModule.shared.endConnection()
        }
        pendingConnectionCleanup = (listenerGeneration, task)
        return task
    }

    private static func pendingConnectionCleanupTask() -> Task<Void, Never>? {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        return pendingConnectionCleanup?.task
    }

    private static func finishStoreCleanup(listenerGeneration: UInt64) {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        guard pendingConnectionCleanup?.generation == listenerGeneration else { return }
        pendingConnectionCleanup = nil
    }

    private static func cleanupListenersLocked() {
        if let purchaseUpdatedSub {
            OpenIapModule.shared.removeListener(purchaseUpdatedSub)
            self.purchaseUpdatedSub = nil
        }
        for subscription in listeners {
            OpenIapModule.shared.removeListener(subscription)
        }
        listeners.removeAll()
        purchaseUpdatedHandler = nil
        purchaseUpdatedOptions = PurchaseUpdatedListenerOptions()
    }

    static func setupStore(module: ExpoIapModule) -> UInt64 {
        setupListeners(
            purchaseUpdated: { [weak module] purchase in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.purchase(purchase))
                module.sendEvent(IapEvent.purchaseUpdated.rawValue, payload)
            },
            purchaseError: { [weak module] error in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.encode(error))
                module.sendEvent(IapEvent.purchaseError.rawValue, payload)
            },
            promotedProduct: { [weak module] productId in
                guard let module else { return }
                do {
                    if let product = try await OpenIapModule.shared.getPromotedProductIOS() {
                        let sanitized = sanitizeDictionary(OpenIapSerialization.encode(product))
                        module.sendEvent(IapEvent.promotedProductIos.rawValue, sanitized)
                        return
                    }
                } catch {
                    ExpoIapLog.failure("promotedProductListenerIOS", error: error)
                }

                module.sendEvent(
                    IapEvent.promotedProductIos.rawValue,
                    ["productId": productId]
                )
            },
            subscriptionBillingIssue: { [weak module] purchase in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.purchase(purchase))
                module.sendEvent(IapEvent.subscriptionBillingIssue.rawValue, payload)
            }
        )
    }

    static func cleanupStore(listenerGeneration: UInt64) async {
        guard let task = beginStoreCleanup(ifOwnedBy: listenerGeneration) else { return }
        await task.value
        finishStoreCleanup(listenerGeneration: listenerGeneration)
    }

    static func waitForStoreCleanup() async {
        await pendingConnectionCleanupTask()?.value
    }
}
