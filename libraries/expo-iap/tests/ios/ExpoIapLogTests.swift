import XCTest

final class ExpoIapLogTests: XCTestCase {
    override func tearDown() {
        ExpoIapLog.setHandler(nil)
        super.tearDown()
    }

    @objc func testNullSensitiveValuesAreOmittedAndPresentValuesAreMasked() {
        var output = ""
        ExpoIapLog.setEnabled(true)
        ExpoIapLog.setHandler { _, message in output = message }

        let payload: [String: Any?] = [
            "purchaseToken": nil,
            "userIdAmazon": NSNull(),
            "apiKey": "known-api-key",
        ]
        ExpoIapLog.payload("requestPurchase", payload: payload)

        XCTAssertFalse(output.contains("purchaseToken"))
        XCTAssertFalse(output.contains("userIdAmazon"))
        XCTAssertTrue(output.contains("\"apiKey\":\"hidden\""))
        XCTAssertFalse(output.contains("known-api-key"))
    }
}

@main
private enum ExpoIapLogTestRunner {
    static func main() {
        let test = ExpoIapLogTests(
            selector: #selector(ExpoIapLogTests.testNullSensitiveValuesAreOmittedAndPresentValuesAreMasked)
        )
        test.run()
        precondition(test.testRun?.hasSucceeded == true)
    }
}
