import Foundation
import OpenIAP
import XCTest

final class OpenIapExceptionTests: XCTestCase {
    @objc func testAllPurchaseErrorFieldsSurviveSerialization() throws {
        let payload = PurchaseError(
            code: .queryProduct,
            debugMessage: "Store returned an empty list",
            isEmptyProductList: false,
            message: "Query failed",
            productId: "premium",
            productIds: ["premium", "monthly"],
            productType: "subs",
            responseCode: -1,
            subResponseCodeAndroid: .userIneligible
        )
        let error = OpenIapException.from(payload)
        let decoded = try JSONDecoder().decode(PurchaseError.self, from: Data(error.localizedDescription.utf8))

        XCTAssertEqual(decoded.code, payload.code)
        XCTAssertEqual(decoded.message, payload.message)
        XCTAssertEqual(decoded.debugMessage, payload.debugMessage)
        XCTAssertEqual(decoded.isEmptyProductList, payload.isEmptyProductList)
        XCTAssertEqual(decoded.productId, payload.productId)
        XCTAssertEqual(decoded.productIds, payload.productIds)
        XCTAssertEqual(decoded.productType, payload.productType)
        XCTAssertEqual(decoded.responseCode, payload.responseCode)
        XCTAssertEqual(decoded.subResponseCodeAndroid, payload.subResponseCodeAndroid)
        XCTAssertEqual(error.domain, OpenIapException.domain)
        XCTAssertEqual(error.code, -1)
    }

    @objc func testMakeEscapesMessagesAndOmitsAbsentDiagnostics() throws {
        let messages = [
            "Quotes: \"cancelled\" and braces: {nested}",
            "Backslashes: C:\\billing\\ and escaped quote: \\\"",
            "Line one\nLine two\r\t\u{0}끝 🎉",
            "NSLocalizedDescription={\"code\":\"user-cancelled\"}",
            "",
        ]
        for message in messages {
            let error = OpenIapException.make(code: .serviceDisconnected, message: message)
            let data = Data(error.localizedDescription.utf8)
            let decoded = try JSONDecoder().decode(PurchaseError.self, from: data)
            XCTAssertEqual(decoded.code, .serviceDisconnected)
            XCTAssertEqual(decoded.message, message)
            let dictionary = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            XCTAssertEqual(Set(dictionary.keys), ["code", "message"])
        }

        let error = OpenIapException.make(code: .userCancelled)
        let decoded = try JSONDecoder().decode(PurchaseError.self, from: Data(error.localizedDescription.utf8))
        XCTAssertEqual(decoded.message, ErrorCode.userCancelled.rawValue)
    }
}

@main
private enum OpenIapExceptionTestRunner {
    static func main() {
        let suite = XCTestSuite(name: "OpenIapException")
        suite.addTest(OpenIapExceptionTests(selector: #selector(OpenIapExceptionTests.testAllPurchaseErrorFieldsSurviveSerialization)))
        suite.addTest(OpenIapExceptionTests(selector: #selector(OpenIapExceptionTests.testMakeEscapesMessagesAndOmitsAbsentDiagnostics)))
        suite.addTest(RequestPurchaseErrorObservationTests(selector: #selector(RequestPurchaseErrorObservationTests.testNoCallbackLeavesNoSuppressionForLaterSamePayload)))
        suite.addTest(RequestPurchaseErrorObservationTests(selector: #selector(RequestPurchaseErrorObservationTests.testOnlyOneAlreadyQueuedIdenticalPayloadIsSuppressed)))
        suite.addTest(RequestPurchaseErrorObservationTests(selector: #selector(RequestPurchaseErrorObservationTests.testGenericFailureOwnershipStillMatchesTheRequestedProduct)))
        suite.run()
        precondition(suite.testRun?.hasSucceeded == true)
    }
}
