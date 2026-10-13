import XCTest
@testable import OpenIAP

/// Wire-shape checks for the generated unions, enums, and inputs in Types.swift.
final class GeneratedTypeCodingTests: XCTestCase {
    private let purchasePayload: [String: Any] = [
        "__typename": "PurchaseIOS", "store": "apple", "storeId": "apple", "platform": "ios",
        "id": "txn", "transactionId": "txn", "productId": "sku", "quantity": 1,
        "isAutoRenewing": false, "purchaseState": "purchased", "transactionDate": 1.0,
    ]

    private func json(_ object: Any) throws -> Data {
        try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    private func dictionary<T: Encodable>(_ value: T) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func testVerifyResultWithLatestTransactionRoundTripsFlat() throws {
        // Same shape Kotlin, Dart, and C# emit: member fields plus __typename, nested unions too.
        let wire: [String: Any] = [
            "__typename": "VerifyPurchaseResultIOS", "isValid": true,
            "jwsRepresentation": "jws", "receiptData": "receipt", "latestTransaction": purchasePayload,
        ]
        let result = try JSONDecoder().decode(VerifyPurchaseResult.self, from: try json(wire))
        guard case let .verifyPurchaseResultIos(ios) = result else { return XCTFail("Expected the iOS member") }
        guard case let .purchaseIos(latest)? = ios.latestTransaction else { return XCTFail("Expected latestTransaction") }
        XCTAssertEqual(latest.id, "txn")
        XCTAssertTrue(result.isValid)

        let encoded = try dictionary(result)
        XCTAssertEqual(encoded["__typename"] as? String, "VerifyPurchaseResultIOS")
        XCTAssertNil(encoded["verifyPurchaseResultIos"])
        let nested = try XCTUnwrap(encoded["latestTransaction"] as? [String: Any])
        XCTAssertEqual(nested["__typename"] as? String, "PurchaseIOS")
        XCTAssertEqual(nested["id"] as? String, "txn")
        XCTAssertEqual(try json(encoded), try json(try dictionary(JSONDecoder().decode(VerifyPurchaseResult.self, from: try json(encoded)))))
    }

    func testSerializationKeepsTheMemberTypename() throws {
        let purchase = try OpenIapSerialization.decode(object: purchasePayload, as: PurchaseIOS.self)
        let result = VerifyPurchaseResult.verifyPurchaseResultIos(
            VerifyPurchaseResultIOS(isValid: true, jwsRepresentation: "jws", latestTransaction: .purchaseIos(purchase), receiptData: "r")
        )
        let encoded = OpenIapSerialization.encode(result)
        XCTAssertEqual(encoded["__typename"] as? String, "VerifyPurchaseResultIOS")
        XCTAssertEqual(encoded["isValid"] as? Bool, true)
        XCTAssertEqual((encoded["latestTransaction"] as? [String: Any])?["__typename"] as? String, "PurchaseIOS")
        XCTAssertEqual(try OpenIapSerialization.encodeRequired(result)["__typename"] as? String, "VerifyPurchaseResultIOS")
        XCTAssertEqual(OpenIapSerialization.encode(purchase)["__typename"] as? String, "PurchaseIOS")
    }

    func testNestedUnionDispatchesOnTheLeafTypename() throws {
        let product: [String: Any] = [
            "__typename": "ProductSubscriptionIOS", "id": "sub", "title": "Sub", "description": "d",
            "displayPrice": "$1", "currency": "USD", "platform": "ios", "type": "subs",
            "displayNameIOS": "Sub", "isFamilyShareableIOS": false, "jsonRepresentationIOS": "{}",
            "introductoryPricePaymentModeIOS": "empty", "typeIOS": "auto-renewable-subscription",
        ]
        let item: ProductOrSubscription
        do {
            item = try JSONDecoder().decode(ProductOrSubscription.self, from: try json(product))
        } catch {
            return XCTFail("Leaf typename should select the nested union: \(error)")
        }
        guard case .productSubscription(.productSubscriptionIos) = item else { return XCTFail("Expected the subscription leaf") }
        XCTAssertEqual(try dictionary(item)["__typename"] as? String, "ProductSubscriptionIOS")

        var unknown = purchasePayload
        unknown["__typename"] = "PurchaseVision"
        XCTAssertThrowsError(try JSONDecoder().decode(Purchase.self, from: try json(unknown)))
    }

    func testLegacyWrappedUnionJSONStillDecodesAndReencodesFlat() throws {
        // Shape synthesized Codable wrote before flat unions; cached copies must keep decoding.
        var member = purchasePayload
        member.removeValue(forKey: "__typename")
        let wrappedPurchase: [String: Any] = ["purchaseIos": ["_0": member]]
        let wrappedResult: [String: Any] = [
            "verifyPurchaseResultIos": ["_0": [
                "isValid": true, "jwsRepresentation": "jws", "receiptData": "r", "latestTransaction": wrappedPurchase,
            ]],
            // OpenIapSerialization.encode used to tag the wrapper with the Swift union name.
            "__typename": "VerifyPurchaseResult",
        ]

        let result = try JSONDecoder().decode(VerifyPurchaseResult.self, from: try json(wrappedResult))
        guard case let .verifyPurchaseResultIos(ios) = result, case let .purchaseIos(latest)? = ios.latestTransaction else {
            return XCTFail("Expected the wrapped iOS result and transaction")
        }
        XCTAssertEqual(latest.id, "txn")
        let encoded = try dictionary(result)
        XCTAssertEqual(encoded["__typename"] as? String, "VerifyPurchaseResultIOS")
        XCTAssertEqual((encoded["latestTransaction"] as? [String: Any])?["__typename"] as? String, "PurchaseIOS")

        guard case .purchaseIos = try OpenIapSerialization.purchaseInput(from: wrappedPurchase) else {
            return XCTFail("Expected iOS purchase input")
        }

        let product: [String: Any] = [
            "id": "sku", "title": "T", "description": "d", "displayPrice": "$1", "currency": "USD",
            "platform": "ios", "type": "in-app", "displayNameIOS": "T", "isFamilyShareableIOS": false,
            "jsonRepresentationIOS": "{}", "typeIOS": "consumable",
        ]
        let nested = try JSONDecoder().decode(
            ProductOrSubscription.self,
            from: try json(["product": ["_0": ["productIos": ["_0": product]]]])
        )
        guard case .product(.productIos) = nested else { return XCTFail("Expected the nested wrapped product") }
        XCTAssertEqual(try dictionary(nested)["__typename"] as? String, "ProductIOS")
    }

    func testOutputEnumsFallBackToUnknownAndAcceptLegacySpellings() throws {
        XCTAssertEqual(try JSONDecoder().decode([PurchaseState].self, from: Data(#"["future-state","PURCHASED","Purchased"]"#.utf8)),
                       [.unknown, .purchased, .purchased])
        XCTAssertEqual(PurchaseState(rawValue: "future-state"), nil)
        XCTAssertThrowsError(try JSONDecoder().decode(ProductQueryType.self, from: Data(#""future""#.utf8)))
        XCTAssertEqual(try JSONDecoder().decode(ErrorCode.self, from: Data(#""USER_CANCELLED""#.utf8)), .userCancelled)
    }

    func testInputsApplySchemaDefaultsAndRejectUnknownEnums() throws {
        let request = try OpenIapSerialization.decode(object: ["skus": ["sku"]], as: ProductRequest.self)
        XCTAssertEqual(request.type, .inApp)
        let explicitNull = try OpenIapSerialization.decode(object: ["skus": ["sku"], "type": NSNull()], as: ProductRequest.self)
        XCTAssertEqual(explicitNull.type, .inApp)
        XCTAssertEqual(try OpenIapSerialization.decode(object: [:], as: InAppMessageParamsAndroid.self).categories, [.transactional])
        let choice = try OpenIapSerialization.decode(object: [:], as: GetBillingChoiceInfoParamsAndroid.self)
        XCTAssertEqual(choice.billingProgram, .billingChoice)
        XCTAssertEqual(choice.playBillingChoiceImageLayout, .rectangularFourByOne)

        XCTAssertThrowsError(
            try OpenIapSerialization.decode(object: ["oldProductId": "a", "replacementMode": "future-mode"], as: SubscriptionProductReplacementParamsAndroid.self)
        )
        XCTAssertThrowsError(try OpenIapSerialization.decode(object: ["categories": ["future"]], as: InAppMessageParamsAndroid.self))
        XCTAssertEqual(try JSONDecoder().decode(SubscriptionReplacementModeAndroid.self, from: Data(#""future-mode""#.utf8)), .unknownReplacementMode)
    }
}
