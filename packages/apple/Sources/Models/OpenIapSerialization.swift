import Foundation

/// Utilities to bridge OpenIAP models to dictionary payloads and decode
/// dynamic dictionaries back into strongly typed models.
@available(iOS 15.0, tvOS 15.0, macOS 12.0, *)
public enum OpenIapSerialization {
    // MARK: - Shared Encoder / Decoder

    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()

    // MARK: - Error Helpers

    /// Exposes the canonical error-code -> message table.
    public static func errorCodes() -> [String: String] {
        PurchaseError.errorCodeTable()
    }

    // MARK: - Encoding Helpers

    /// Encodes any encodable value into a `[String: Any]` dictionary (non-nullable).
    /// Filters out nil values to ensure compatibility with JSONSerialization.
    public static func encode<T: Encodable>(_ value: T) -> [String: Any] {
        do {
            let data = try encoder.encode(value)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                OpenIapLog.warn("⚠️ [OpenIapSerialization] Failed to deserialize JSON to dictionary for type: \(T.self)")
                return [:]
            }
            return json
        } catch {
            OpenIapLog.error("⚠️ [OpenIapSerialization] Encoding failed for type \(T.self): \(error)")
            return [:]
        }
    }

    // MARK: - Decoding Helpers

    public static func decode<Payload: Encodable, Output: Decodable>(
        _ payload: Payload,
        as type: Output.Type
    ) throws -> Output {
        let data = try encoder.encode(payload)
        return try decoder.decode(Output.self, from: data)
    }

    public static func decode<Output: Decodable>(
        object: Any,
        as type: Output.Type
    ) throws -> Output {
        guard JSONSerialization.isValidJSONObject(object) else {
            throw PurchaseError.make(code: .developerError, message: "Invalid payload serialization")
        }
        let data = try JSONSerialization.data(withJSONObject: object)
        return try decoder.decode(Output.self, from: data)
    }

    // MARK: - Request Builders

    public static func productRequest(
        skus: [String],
        type: ProductQueryType
    ) throws -> ProductRequest {
        struct Payload: Encodable {
            let skus: [String]
            let type: ProductQueryType?
        }

        return try decode(Payload(skus: skus, type: type), as: ProductRequest.self)
    }

    public static func requestPurchaseProps(from object: [String: Any]) throws -> RequestPurchaseProps {
        try decode(object: object, as: RequestPurchaseProps.self)
    }

    public static func purchaseInput(from object: Any) throws -> PurchaseInput {
        guard let dict = object as? [String: Any] else {
            print("❌ [OpenIapSerialization] purchaseInput: object is not a dictionary - \(type(of: object))")
            throw PurchaseError.make(code: .developerError, message: "Purchase must be a dictionary")
        }

        print("📦 [OpenIapSerialization] purchaseInput received dict keys: \(dict.keys.sorted())")

        // Check if already wrapped as Purchase union
        if dict["purchaseIos"] != nil || dict["purchaseAndroid"] != nil {
            print("✅ [OpenIapSerialization] Already wrapped as Purchase union")
            // Already wrapped, decode as-is
            return try decode(object: dict, as: PurchaseInput.self)
        }

        print("🔄 [OpenIapSerialization] Auto-wrapping as iOS purchase")

        // Map common field aliases for backward compatibility
        var normalizedDict = dict
        if normalizedDict["transactionId"] == nil, let id = normalizedDict["id"] {
            normalizedDict["transactionId"] = id
        }

        // Decode as PurchaseIOS first, then wrap in Purchase enum
        do {
            let purchaseIOS = try decode(object: normalizedDict, as: PurchaseIOS.self)
            let result = Purchase.purchaseIos(purchaseIOS)
            print("✅ [OpenIapSerialization] Successfully decoded and wrapped PurchaseInput")
            return result
        } catch {
            print("❌ [OpenIapSerialization] Decode failed: \(error)")
            print("📦 [OpenIapSerialization] Dict keys: \(dict.keys.sorted())")
            throw error
        }
    }

    public static func purchaseOptions(from object: Any) throws -> PurchaseOptions {
        try decode(object: object, as: PurchaseOptions.self)
    }

    public static func verifyPurchaseProps(from object: Any) throws -> VerifyPurchaseProps {
        try decode(object: object, as: VerifyPurchaseProps.self)
    }

    // MARK: - Discount Helpers

    public static func discountOffer(from dictionary: [String: Any]) -> DiscountOfferInputIOS? {
        struct Payload: Encodable {
            let identifier: String
            let keyIdentifier: String
            let nonce: String
            let signature: String
            let timestamp: Double
        }

        let identifier = ((dictionary["identifier"] as? String) ?? (dictionary["id"] as? String))?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let keyIdentifier = (dictionary["keyIdentifier"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let nonce = (dictionary["nonce"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let signature = (dictionary["signature"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let timestamp: Double?
        if let value = dictionary["timestamp"] as? Double {
            timestamp = value
        } else if let value = dictionary["timestamp"] as? Int {
            timestamp = Double(value)
        } else if let value = dictionary["timestamp"] as? String {
            timestamp = Double(value)
        } else {
            timestamp = nil
        }

        guard !identifier.isEmpty,
              !keyIdentifier.isEmpty,
              !nonce.isEmpty,
              !signature.isEmpty,
              let timestampValue = timestamp else {
            return nil
        }

        return try? decode(
            Payload(
                identifier: identifier,
                keyIdentifier: keyIdentifier,
                nonce: nonce,
                signature: signature,
                timestamp: timestampValue
            ),
            as: DiscountOfferInputIOS.self
        )
    }

    // MARK: - Serialization Helpers

    public static func products(
        _ result: FetchProductsResult,
        logger: ((String) -> Void)? = nil
    ) -> [[String: Any]] {
        switch result {
        case .products(let maybeProducts):
            let iosProducts = (maybeProducts ?? []).compactMap { product -> ProductIOS? in
                guard case let .productIos(value) = product else { return nil }
                return value
            }
            iosProducts.forEach {
                logger?("Product: \($0.id) - \($0.title) - \($0.displayPrice)")
            }
            return iosProducts.map { encode($0) }

        case .subscriptions(let maybeSubscriptions):
            let iosSubscriptions = (maybeSubscriptions ?? []).compactMap { subscription -> ProductSubscriptionIOS? in
                guard case let .productSubscriptionIos(value) = subscription else { return nil }
                return value
            }
            iosSubscriptions.forEach {
                logger?("Subscription: \($0.id) - \($0.title) - \($0.displayPrice)")
            }

            // 🔍 DEBUG: Check encoded dictionaries
            let encoded = iosSubscriptions.map { encode($0) }
            encoded.forEach { dict in
                if dict["id"] != nil {
                    OpenIapLog.debug("OpenIapSerialization: discounts.isEmpty = \((dict["discountsIOS"] as? [[String: Any]])?.isEmpty ?? true)")
                }
            }

            return encoded

        case .all(let items):
            let allItems = items ?? []
            let iosProducts = allItems.compactMap { item -> ProductIOS? in
                guard case .product(let product) = item,
                      case .productIos(let value) = product
                else { return nil }
                return value
            }
            let iosSubscriptions = allItems.compactMap { item -> ProductSubscriptionIOS? in
                guard case .productSubscription(.productSubscriptionIos(let value)) = item
                else { return nil }
                return value
            }
            iosProducts.forEach {
                logger?("Product: \($0.id) - \($0.title) - \($0.displayPrice)")
            }
            iosSubscriptions.forEach {
                logger?("Subscription: \($0.id) - \($0.title) - \($0.displayPrice)")
            }

            // Combine both products and subscriptions
            let productEncoded = iosProducts.map { encode($0) }
            let subscriptionEncoded = iosSubscriptions.map { encode($0) }
            return productEncoded + subscriptionEncoded
        }
    }

    public static func purchases(_ items: [Purchase]) -> [[String: Any]] {
        items.map { purchase($0) }
    }

    public static func purchase(_ purchase: Purchase) -> [String: Any] {
        switch purchase {
        case let .purchaseIos(value):
            return encode(value)
        case let .purchaseAndroid(value):
            return encode(value)
        }
    }
}
