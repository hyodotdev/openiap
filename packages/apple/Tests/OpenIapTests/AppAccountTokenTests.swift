import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class AppAccountTokenTests: XCTestCase {

    // MARK: - Valid UUID Format Tests

    func testAppAccountToken_ValidUUID_DoesNotThrow() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "550e8400-e29b-41d4-a716-446655440000",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        // Should not throw for valid UUID
        XCTAssertNoThrow(try StoreKitTypesBridge.purchaseOptions(from: props))
    }

    func testAppAccountToken_ValidUUID_Uppercase_DoesNotThrow() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "550E8400-E29B-41D4-A716-446655440000",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        // Should not throw for valid uppercase UUID
        XCTAssertNoThrow(try StoreKitTypesBridge.purchaseOptions(from: props))
    }

    func testAppAccountToken_GeneratedUUID_DoesNotThrow() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: UUID().uuidString,
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        // Should not throw for UUID generated from Foundation
        XCTAssertNoThrow(try StoreKitTypesBridge.purchaseOptions(from: props))
    }

    func testAppAccountToken_Nil_DoesNotThrow() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: nil,
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        // Should not throw when appAccountToken is nil
        XCTAssertNoThrow(try StoreKitTypesBridge.purchaseOptions(from: props))
    }

    // MARK: - Invalid UUID Format Tests

    func testAppAccountToken_InvalidFormat_UserID_ThrowsDeveloperError() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "user-123",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        // Should throw developerError for non-UUID format
        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
            XCTAssertEqual(purchaseError.productId, "dev.hyo.premium")
            XCTAssertTrue(purchaseError.message.contains("UUID"))
            XCTAssertTrue(purchaseError.message.contains("user-123"))
        }
    }

    func testAppAccountToken_InvalidFormat_PlainString_ThrowsDeveloperError() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "my-account-token",
            quantity: nil,
            sku: "dev.hyo.consumable",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
            XCTAssertEqual(purchaseError.productId, "dev.hyo.consumable")
        }
    }

    func testAppAccountToken_InvalidFormat_NumericString_ThrowsDeveloperError() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "12345678",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
        }
    }

    func testAppAccountToken_InvalidFormat_EmptyString_ThrowsDeveloperError() throws {
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
        }
    }

    func testAppAccountToken_InvalidFormat_MalformedUUID_ThrowsDeveloperError() throws {
        // UUID with wrong number of characters in a group
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "550e8400-e29b-41d4-a716-44665544000",  // Missing one character
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
        }
    }

    func testAppAccountToken_InvalidFormat_UUIDWithoutDashes_ThrowsDeveloperError() throws {
        // UUID without dashes is not valid for Foundation's UUID(uuidString:)
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "550e8400e29b41d4a716446655440000",
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
        }
    }

    // MARK: - Subscription Props Tests

    func testAppAccountToken_SubscriptionProps_ValidUUID_DoesNotThrow() throws {
        let props = RequestSubscriptionIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            quantity: nil,
            sku: "dev.hyo.subscription.monthly",
            withOffer: nil
        )

        XCTAssertNoThrow(try StoreKitTypesBridge.purchaseOptions(from: props))
    }

    func testAppAccountToken_SubscriptionProps_InvalidUUID_ThrowsDeveloperError() throws {
        let props = RequestSubscriptionIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: "user_account_123",
            quantity: nil,
            sku: "dev.hyo.subscription.monthly",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError, got \(type(of: error))")
                return
            }
            XCTAssertEqual(purchaseError.code, .developerError)
            XCTAssertEqual(purchaseError.productId, "dev.hyo.subscription.monthly")
            XCTAssertTrue(purchaseError.message.contains("UUID"))
        }
    }

    // MARK: - Error Message Content Tests

    func testAppAccountToken_ErrorMessage_ContainsGuidance() throws {
        let invalidToken = "my-custom-user-id"
        let props = RequestPurchaseIosProps(
            advancedCommerceData: nil,
            andDangerouslyFinishTransactionAutomatically: nil,
            appAccountToken: invalidToken,
            quantity: nil,
            sku: "dev.hyo.premium",
            withOffer: nil
        )

        XCTAssertThrowsError(try StoreKitTypesBridge.purchaseOptions(from: props)) { error in
            guard let purchaseError = error as? PurchaseError else {
                XCTFail("Expected PurchaseError")
                return
            }
            // Error message should contain helpful information
            XCTAssertTrue(purchaseError.message.contains("UUID"), "Error should mention UUID requirement")
            XCTAssertTrue(purchaseError.message.contains(invalidToken), "Error should show the invalid value")
            XCTAssertTrue(purchaseError.message.lowercased().contains("apple"), "Error should mention Apple behavior")
        }
    }
}
