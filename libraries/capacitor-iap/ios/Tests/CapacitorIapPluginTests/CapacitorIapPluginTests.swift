import OpenIAP
import XCTest
@testable import CapacitorIapPlugin

final class CapacitorIapPluginTests: XCTestCase {
    func testDecodingErrorBecomesDeveloperError() throws {
        let decodingError = DecodingError.keyNotFound(
            AnyCodingKey("sku"),
            .init(codingPath: [], debugDescription: "missing sku")
        )

        let error = CapacitorIapPlugin.purchaseError(
            for: decodingError,
            name: "requestPurchase",
            fallback: .purchaseError,
            productId: nil
        )

        XCTAssertEqual(error.code, .developerError)
        XCTAssertEqual(error.message, "Invalid arguments for requestPurchase")
    }

    func testPurchaseErrorKeepsItsCode() {
        let cancelled = PurchaseError(code: .userCancelled, message: "cancelled", productId: "coins")

        let error = CapacitorIapPlugin.purchaseError(
            for: cancelled,
            name: "requestPurchase",
            fallback: .purchaseError,
            productId: "coins"
        )

        XCTAssertEqual(error.code, .userCancelled)
        XCTAssertEqual(error.productId, "coins")
    }

    func testUnknownErrorUsesTheFallback() {
        struct Unexpected: Error {}

        let error = CapacitorIapPlugin.purchaseError(
            for: Unexpected(),
            name: "fetchProducts",
            fallback: .queryProduct,
            productId: nil
        )

        XCTAssertEqual(error.code, .queryProduct)
    }

    func testRejectionPayloadCarriesTheCanonicalError() {
        let payload = CapacitorIapListeners.payload(
            for: PurchaseError(code: .alreadyOwned, message: "owned", productId: "coins")
        )

        XCTAssertEqual(payload["code"] as? String, "already-owned")
        XCTAssertEqual(payload["productId"] as? String, "coins")
        XCTAssertEqual(payload["platform"] as? String, "ios")
    }
}

private struct AnyCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(_ value: String) { stringValue = value }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}
