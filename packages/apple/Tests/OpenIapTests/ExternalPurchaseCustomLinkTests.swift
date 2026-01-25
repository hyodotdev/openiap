import XCTest
@testable import OpenIAP

/// Tests for ExternalPurchaseCustomLink API support (iOS 18.1+)
/// Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink
@available(iOS 15.0, macOS 14.0, *)
final class ExternalPurchaseCustomLinkTests: XCTestCase {

    // MARK: - Token Type Enum Tests

    func testTokenType_Acquisition_RawValue() {
        let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS.acquisition
        XCTAssertEqual(tokenType.rawValue, "acquisition")
    }

    func testTokenType_Services_RawValue() {
        let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS.services
        XCTAssertEqual(tokenType.rawValue, "services")
    }

    func testTokenType_InitFromRawValue_Acquisition() {
        let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: "acquisition")
        XCTAssertNotNil(tokenType)
        XCTAssertEqual(tokenType, .acquisition)
    }

    func testTokenType_InitFromRawValue_Services() {
        let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: "services")
        XCTAssertNotNil(tokenType)
        XCTAssertEqual(tokenType, .services)
    }

    func testTokenType_InitFromRawValue_Invalid() {
        let tokenType = ExternalPurchaseCustomLinkTokenTypeIOS(rawValue: "invalid")
        XCTAssertNil(tokenType)
    }

    // MARK: - Notice Type Enum Tests

    func testNoticeType_Browser_RawValue() {
        let noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS.browser
        XCTAssertEqual(noticeType.rawValue, "browser")
    }

    func testNoticeType_InitFromRawValue_Browser() {
        let noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS(rawValue: "browser")
        XCTAssertNotNil(noticeType)
        XCTAssertEqual(noticeType, .browser)
    }

    func testNoticeType_InitFromRawValue_Invalid() {
        let noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS(rawValue: "invalid")
        XCTAssertNil(noticeType)
    }

    // MARK: - Token Result Type Tests

    func testTokenResult_WithToken() {
        let result = ExternalPurchaseCustomLinkTokenResultIOS(
            error: nil,
            token: "test-token-value"
        )
        XCTAssertNil(result.error)
        XCTAssertEqual(result.token, "test-token-value")
    }

    func testTokenResult_WithError() {
        let result = ExternalPurchaseCustomLinkTokenResultIOS(
            error: "App is not eligible for ExternalPurchaseCustomLink",
            token: nil
        )
        XCTAssertNotNil(result.error)
        XCTAssertNil(result.token)
        XCTAssertEqual(result.error, "App is not eligible for ExternalPurchaseCustomLink")
    }

    func testTokenResult_Codable() throws {
        let result = ExternalPurchaseCustomLinkTokenResultIOS(
            error: nil,
            token: "encoded-token"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(result)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExternalPurchaseCustomLinkTokenResultIOS.self, from: data)

        XCTAssertEqual(decoded.token, result.token)
        XCTAssertEqual(decoded.error, result.error)
    }

    // MARK: - Notice Result Type Tests

    func testNoticeResult_Continued() {
        let result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued: true,
            error: nil
        )
        XCTAssertTrue(result.continued)
        XCTAssertNil(result.error)
    }

    func testNoticeResult_Cancelled() {
        let result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued: false,
            error: nil
        )
        XCTAssertFalse(result.continued)
        XCTAssertNil(result.error)
    }

    func testNoticeResult_WithError() {
        let result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued: false,
            error: "Failed to show notice"
        )
        XCTAssertFalse(result.continued)
        XCTAssertNotNil(result.error)
    }

    func testNoticeResult_Codable() throws {
        let result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued: true,
            error: nil
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(result)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExternalPurchaseCustomLinkNoticeResultIOS.self, from: data)

        XCTAssertEqual(decoded.continued, result.continued)
        XCTAssertEqual(decoded.error, result.error)
    }

    // MARK: - ExternalPurchaseNoticeResultIOS Tests (Updated with token field)

    func testExternalPurchaseNoticeResult_WithToken() {
        let result = ExternalPurchaseNoticeResultIOS(
            error: nil,
            externalPurchaseToken: "external-purchase-token-123",
            result: .continue
        )
        XCTAssertNil(result.error)
        XCTAssertEqual(result.externalPurchaseToken, "external-purchase-token-123")
        XCTAssertEqual(result.result, .continue)
    }

    func testExternalPurchaseNoticeResult_Dismissed() {
        let result = ExternalPurchaseNoticeResultIOS(
            error: nil,
            externalPurchaseToken: nil,
            result: .dismissed
        )
        XCTAssertNil(result.error)
        XCTAssertNil(result.externalPurchaseToken)
        XCTAssertEqual(result.result, .dismissed)
    }

    func testExternalPurchaseNoticeResult_Codable() throws {
        let result = ExternalPurchaseNoticeResultIOS(
            error: nil,
            externalPurchaseToken: "token-for-apple-server",
            result: .continue
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(result)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExternalPurchaseNoticeResultIOS.self, from: data)

        XCTAssertEqual(decoded.result, result.result)
        XCTAssertEqual(decoded.externalPurchaseToken, result.externalPurchaseToken)
        XCTAssertEqual(decoded.error, result.error)
    }

    // MARK: - Serialization Tests

    func testTokenResult_Serialization() {
        let result = ExternalPurchaseCustomLinkTokenResultIOS(
            error: nil,
            token: "serialization-test-token"
        )

        let dictionary = OpenIapSerialization.encode(result)

        XCTAssertEqual(dictionary["token"] as? String, "serialization-test-token")
        XCTAssertNil(dictionary["error"])
    }

    func testNoticeResult_Serialization() {
        let result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued: true,
            error: nil
        )

        let dictionary = OpenIapSerialization.encode(result)

        XCTAssertEqual(dictionary["continued"] as? Bool, true)
        XCTAssertNil(dictionary["error"])
    }

    // MARK: - All Cases Tests

    func testTokenType_AllCases() {
        let allCases = ExternalPurchaseCustomLinkTokenTypeIOS.allCases
        XCTAssertEqual(allCases.count, 2)
        XCTAssertTrue(allCases.contains(.acquisition))
        XCTAssertTrue(allCases.contains(.services))
    }

    func testNoticeType_AllCases() {
        let allCases = ExternalPurchaseCustomLinkNoticeTypeIOS.allCases
        XCTAssertEqual(allCases.count, 1)
        XCTAssertTrue(allCases.contains(.browser))
    }
}
