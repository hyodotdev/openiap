import XCTest
@testable import GodotIap

final class GodotIapLogTests: XCTestCase {
    func testNullSensitiveValuesAreOmittedAndPresentValuesAreMasked() {
        let payload: [String: Any?] = [
            "purchaseToken": nil,
            "userIdAmazon": NSNull(),
            "apiKey": "known-api-key",
        ]
        let output = GodotIapLog.stringify(payload)

        XCTAssertFalse(output.contains("purchaseToken"))
        XCTAssertFalse(output.contains("userIdAmazon"))
        XCTAssertTrue(output.contains("\"apiKey\":\"hidden\""))
        XCTAssertFalse(output.contains("known-api-key"))
    }
}
