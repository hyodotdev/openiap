import Foundation

/// Utilities to bridge OpenIAP models to dictionary payloads and decode
/// dynamic dictionaries back into strongly typed models.
/// - SeeAlso: https://developer.apple.com/documentation/storekit
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
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
    ///
    /// Tags the dictionary with `__typename`, the discriminator Dart, Kotlin, and C#
    /// dispatch on. A union keeps its member's name; any other type gets `T`'s name.
    public static func encode<T: Encodable>(_ value: T) -> [String: Any] {
        do {
            let data = try encoder.encode(value)
            guard var json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                OpenIapLog.warn("⚠️ [OpenIapSerialization] Failed to deserialize JSON to dictionary for type: \(T.self)")
                return [:]
            }
            json["__typename"] = json["__typename"] ?? String(describing: T.self)
            return json
        } catch {
            OpenIapLog.error("⚠️ [OpenIapSerialization] Encoding failed for type \(T.self): \(error)")
            return [:]
        }
    }

    /// Strict encoding for authoritative query results. Unlike `encode`, this
    /// never turns a serialization failure into an empty success dictionary.
    public static func encodeRequired<T: Encodable>(_ value: T) throws -> [String: Any] {
        do {
            let data = try encoder.encode(value)
            guard var json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw PurchaseError.make(
                    code: .billingResponseJsonParseError,
                    message: "Failed to serialize native \(T.self) payload"
                )
            }
            json["__typename"] = json["__typename"] ?? String(describing: T.self)
            return json
        } catch let error as PurchaseError {
            throw error
        } catch {
            throw PurchaseError.make(
                code: .billingResponseJsonParseError,
                message: "Failed to serialize native \(T.self) payload"
            )
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
            throw PurchaseError.make(code: .developerError, message: "Purchase must be a dictionary")
        }

        // Unions used to encode wrapped as {"purchaseIos": {"_0": {...}}}; keep accepting that shape.
        for (caseKey, typename) in [("purchaseIos", "PurchaseIOS"), ("purchaseAndroid", "PurchaseAndroid")] {
            if let member = (dict[caseKey] as? [String: Any])?["_0"] as? [String: Any] {
                return try decode(object: member.merging(["__typename": typename]) { _, new in new }, as: PurchaseInput.self)
            }
        }

        do {
            return .purchaseIos(try decode(object: dict, as: PurchaseIOS.self))
        } catch {
            OpenIapLog.error("[OpenIapSerialization] purchaseInput decode failed: \(error), keys: \(dict.keys.sorted())")
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

            return iosSubscriptions.map { encode($0) }

        case .all(let items):
            return (items ?? []).compactMap { item in
                switch item {
                case .product(.productIos(let product)):
                    logger?("Product: \(product.id) - \(product.title) - \(product.displayPrice)")
                    return encode(product)
                case .productSubscription(.productSubscriptionIos(let subscription)):
                    logger?("Subscription: \(subscription.id) - \(subscription.title) - \(subscription.displayPrice)")
                    return encode(subscription)
                default:
                    return nil
                }
            }
        }
    }

    public static func purchases(_ items: [Purchase]) -> [[String: Any]] {
        items.map { purchase($0) }
    }

    public static func purchasesRequired(_ items: [Purchase]) throws -> [[String: Any]] {
        try items.map { item in
            switch item {
            case let .purchaseIos(value):
                return try encodeRequired(value)
            case let .purchaseAndroid(value):
                return try encodeRequired(value)
            }
        }
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
