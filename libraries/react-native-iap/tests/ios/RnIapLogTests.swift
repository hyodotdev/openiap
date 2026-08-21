import XCTest

final class RnIapLogTests: XCTestCase {
    override func tearDown() {
        RnIapLog.setHandler(nil)
        super.tearDown()
    }

    @objc func testNullSensitiveValuesAreOmittedAndPresentValuesAreMasked() {
        var output = ""
        RnIapLog.setEnabled(true)
        RnIapLog.setHandler { _, message in output = message }

        let payload: [String: Any?] = [
            "purchaseToken": nil,
            "userIdAmazon": NSNull(),
            "apiKey": "known-api-key",
        ]
        RnIapLog.payload("requestPurchase", payload)

        XCTAssertFalse(output.contains("purchaseToken"))
        XCTAssertFalse(output.contains("userIdAmazon"))
        XCTAssertTrue(output.contains("\"apiKey\":\"hidden\""))
        XCTAssertFalse(output.contains("known-api-key"))
    }
}

@main
private enum RnIapLogTestRunner {
    static func main() {
        let test = RnIapLogTests(
            selector: #selector(RnIapLogTests.testNullSensitiveValuesAreOmittedAndPresentValuesAreMasked)
        )
        test.run()
        precondition(test.testRun?.hasSucceeded == true)
    }
}
