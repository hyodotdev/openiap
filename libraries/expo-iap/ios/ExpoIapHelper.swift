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

    static func parseProductQueryType(_ rawValue: String?) -> ProductQueryType {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty
        else {
            return .inApp
        }
        switch raw.lowercased() {
        case "inapp", ProductQueryType.inApp.rawValue:
            return .inApp
        case ProductQueryType.subs.rawValue:
            return .subs
        case ProductQueryType.all.rawValue:
            return .all
        default:
            return .all
        }
    }

    static func decodeProductRequest(from payload: [String: Any]) throws -> ProductRequest {
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = parseProductQueryType(payload["type"] as? String)
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
           let requestPurchase = payload["requestPurchase"]
        {
            var normalized = payload
            normalized["requestPurchase"] = normalizeApplePlatformKey(in: requestPurchase)
            return try OpenIapSerialization.decode(
                object: normalized, as: RequestPurchaseProps.self)
        }
        if payload.keys.contains("requestSubscription"),
           let requestSubscription = payload["requestSubscription"]
        {
            var normalized = payload
            normalized["requestSubscription"] =
                normalizeApplePlatformKey(in: requestSubscription)
            return try OpenIapSerialization.decode(
                object: normalized, as: RequestPurchaseProps.self)
        }

        if payload.keys.contains("request"), let request = payload["request"] {
            let normalizedRequest = normalizeApplePlatformKey(in: request)
            let parsedType = parseProductQueryType(payload["type"] as? String)
            let purchaseType: ProductQueryType = parsedType == .all ? .inApp : parsedType
            var normalized: [String: Any] = ["type": purchaseType.rawValue]
            switch purchaseType {
            case .subs:
                normalized["requestSubscription"] = normalizedRequest
            case .inApp:
                normalized["requestPurchase"] = normalizedRequest
            case .all:
                break
            }
            // Include useAlternativeBilling if present
            if let useAlternativeBilling = payload["useAlternativeBilling"] {
                normalized["useAlternativeBilling"] = useAlternativeBilling
            }
            return try OpenIapSerialization.decode(
                object: normalized, as: RequestPurchaseProps.self)
        }

        if payload["sku"] != nil {
            let normalized: [String: Any] = [
                "type": ProductQueryType.inApp.rawValue,
                "requestPurchase": ["ios": payload],
            ]
            return try OpenIapSerialization.decode(
                object: normalized, as: RequestPurchaseProps.self)
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid request payload")
    }

    private static func normalizeApplePlatformKey(in value: Any) -> Any {
        guard var request = value as? [String: Any] else {
            return value
        }

        if request.keys.contains("apple") {
            request.removeValue(forKey: "ios")
            return request
        }

        if request.keys.contains("ios") {
            ExpoIapLog.deprecation(
                "request-purchase.ios",
                "`request.ios` is deprecated and will be removed in expo-iap 5.0.0. Use `request.apple` instead."
            )
        }

        return request
    }

    static func setupListeners(
        module: ExpoIapModule,
        purchaseUpdated: @escaping (Purchase) -> Void,
        purchaseError: @escaping (PurchaseError) -> Void,
        promotedProduct: @escaping (String) async -> Void,
        subscriptionBillingIssue: @escaping (Purchase) -> Void
    ) {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        // Clean up any existing listeners first
        cleanupListenersLocked()

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

    static func cleanupListeners() {
        listenerLock.lock()
        defer { listenerLock.unlock() }

        cleanupListenersLocked()
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

    static func setupStore(module: ExpoIapModule) {
        setupListeners(
            module: module,
            purchaseUpdated: { [weak module] purchase in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.purchase(purchase))
                module.sendEvent(OpenIapEvent.purchaseUpdated.rawValue, payload)
            },
            purchaseError: { [weak module] error in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.encode(error))
                module.sendEvent(OpenIapEvent.purchaseError.rawValue, payload)
            },
            promotedProduct: { [weak module] productId in
                guard let module else { return }
                do {
                    if let product = try await OpenIapModule.shared.getPromotedProductIOS() {
                        let sanitized = sanitizeDictionary(OpenIapSerialization.encode(product))
                        module.sendEvent(OpenIapEvent.promotedProductIos.rawValue, sanitized)
                        return
                    }
                } catch {
                    ExpoIapLog.failure("promotedProductListenerIOS", error: error)
                }

                module.sendEvent(
                    OpenIapEvent.promotedProductIos.rawValue,
                    ["productId": productId]
                )
            },
            subscriptionBillingIssue: { [weak module] purchase in
                guard let module else { return }
                let payload = sanitizeDictionary(OpenIapSerialization.purchase(purchase))
                module.sendEvent(OpenIapEvent.subscriptionBillingIssue.rawValue, payload)
            }
        )
    }

    static func cleanupStore() async {
        cleanupListeners()
        _ = try? await OpenIapModule.shared.endConnection()
    }
}
