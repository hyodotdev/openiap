import Foundation
import OpenIAP

enum FlutterIapHelper {
    // MARK: - Sanitization

    private static let identifierKeys: Set<String> = [
        "id",
        "transactionId",
        "productId",
        "offerId",
        "originalTransactionIdentifierIOS",
        "subscriptionGroupIdIOS",
        "webOrderLineItemIdIOS",
        "orderIdAndroid",
        "obfuscatedAccountIdAndroid",
        "obfuscatedProfileIdAndroid"
    ]

    static func sanitizeDictionary(_ dictionary: [String: Any?]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in dictionary {
            guard let sanitizedValue = sanitizeValue(value) else { continue }

            if let number = sanitizedValue as? NSNumber, identifierKeys.contains(key) {
                result[key] = number.stringValue
            } else {
                result[key] = sanitizedValue
            }
        }
        return result
    }

    static func sanitizeArray(_ array: [[String: Any?]]) -> [[String: Any]] {
        array.map { sanitizeDictionary($0) }
    }

    static func sanitizeValue(_ value: Any?) -> Any? {
        guard let value else { return nil }

        if let dictionary = value as? [String: Any?] {
            return sanitizeDictionary(dictionary)
        }

        if let dictionary = value as? [String: Any] {
            let optionalDictionary = dictionary.reduce(into: [String: Any?]()) { result, element in
                result[element.key] = element.value
            }
            return sanitizeDictionary(optionalDictionary)
        }

        if let array = value as? [Any?] {
            return array.compactMap { sanitizeValue($0) }
        }

        if let array = value as? [Any] {
            return array.compactMap { sanitizeValue($0) }
        }

        return value
    }

    static func jsonString(from value: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(value) else { return nil }
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: []) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // Keep the framework compatible with the currently published OpenIAP
    // native package while still treating serialization as all-or-nothing.
    // OpenIapSerialization.encode/purchase return an empty dictionary when
    // encoding fails, so reject that sentinel instead of reporting success.
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

    // MARK: - Parsing helpers

    static func parseProductQueryType(_ rawValue: String?) throws -> ProductQueryType {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return .all
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
                message: "Invalid product type. Expected in-app, subs, or all."
            )
        }
    }

    static func decodeProductRequest(from payload: [String: Any]) throws -> ProductRequest {
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = try parseProductQueryType(payload["type"] as? String)
            return try OpenIapSerialization.productRequest(skus: skus, type: type)
        }

        return try OpenIapSerialization.decode(object: payload, as: ProductRequest.self)
    }

    static func decodePurchaseOptions(from dictionary: [String: Any]) throws -> PurchaseOptions {
        try OpenIapSerialization.purchaseOptions(from: dictionary)
    }

    static func decodePurchaseOptions(alsoPublish: Bool, onlyIncludeActive: Bool) throws -> PurchaseOptions {
        try decodePurchaseOptions(from: [
            "alsoPublishToEventListenerIOS": alsoPublish,
            "onlyIncludeActiveItemsIOS": onlyIncludeActive
        ])
    }

    static func decodeRequestPurchaseProps(from payload: [String: Any]) throws -> RequestPurchaseProps {
        if payload["requestPurchase"] != nil || payload["requestSubscription"] != nil {
            FlutterIapLog.payload("decodeRequestPurchaseProps.normalized", payload: sanitizeValue(payload))
            return try OpenIapSerialization.decode(object: payload, as: RequestPurchaseProps.self)
        }

        if let sku = payload["sku"] as? String, !sku.isEmpty {
            let parsedType = try parseProductQueryType(payload["type"] as? String)
            let purchaseType: ProductQueryType = parsedType == .subs ? .subs : .inApp
            let normalized: [String: Any] = [
                "type": purchaseType.rawValue,
                purchaseType == .subs ? "requestSubscription" : "requestPurchase": [
                    "apple": sanitizeDictionary(payload)
                ]
            ]
            FlutterIapLog.payload("decodeRequestPurchaseProps.normalized", payload: sanitizeValue(normalized))
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid purchase request payload")
    }

    static func decodePurchaseInput(from payload: Any) throws -> PurchaseInput {
        try OpenIapSerialization.purchaseInput(from: payload)
    }

    static func fallbackPurchaseInput(for transactionId: String) throws -> PurchaseInput {
        let payload: [String: Any] = [
            "id": transactionId,
            "ids": [],
            "isAutoRenewing": false,
            "productId": "",
            "purchaseState": PurchaseState.purchased.rawValue,
            "purchaseToken": transactionId,
            "quantity": 1,
            "transactionDate": 0
        ]
        return try decodePurchaseInput(from: payload)
    }

}
