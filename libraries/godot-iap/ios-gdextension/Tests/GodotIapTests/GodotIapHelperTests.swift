import XCTest
@testable import GodotIap

final class GodotIapHelperTests: XCTestCase {
    override func tearDown() {
        GodotIapLog.setHandler(nil)
        GodotIapLog.setEnabled(false)
        GodotIapLog.resetDeprecationsForTests()
        super.tearDown()
    }

    func testCanonicalProductQueryTypesPreserveMeaning() throws {
        var warnings: [String] = []
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }
        XCTAssertEqual(
            try GodotIapHelper.parseProductQueryType("in-app", defaultType: .all),
            .inApp
        )
        XCTAssertEqual(
            try GodotIapHelper.parseProductQueryType("subs", defaultType: .all),
            .subs
        )
        XCTAssertEqual(
            try GodotIapHelper.parseProductQueryType("all", defaultType: .inApp),
            .all
        )
        XCTAssertTrue(warnings.isEmpty)
    }

    func testKnownAliasesWarnAndNormalize() throws {
        var warnings: [String] = []
        GodotIapLog.setEnabled(true)
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        XCTAssertEqual(try GodotIapHelper.parseProductQueryType("in_app"), .inApp)
        XCTAssertEqual(try GodotIapHelper.parseProductQueryType("subscription"), .subs)
        XCTAssertEqual(try GodotIapHelper.parseProductQueryType("in_app"), .inApp)
        XCTAssertTrue(warnings.contains { $0.contains("`in_app`") && $0.contains("`in-app`") })
        XCTAssertTrue(warnings.contains { $0.contains("`subscription`") && $0.contains("`subs`") })
        XCTAssertEqual(warnings.count, 2)
    }

    func testUnknownAndPurchaseAllTypesAreRejected() {
        XCTAssertThrowsError(try GodotIapHelper.parseProductQueryType("subscrption"))
        XCTAssertThrowsError(
            try GodotIapHelper.parseProductQueryType("all", allowAll: false)
        )
    }

    func testIndexedProductRequestRemainsCompatibleAndWarns() throws {
        var warnings: [String] = []
        GodotIapLog.setEnabled(true)
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        let request = try GodotIapHelper.decodeProductRequest(from: [
            "0": "coins.100",
            "1": "premium.monthly",
            "type": "inapp",
        ])

        XCTAssertEqual(request.skus, ["coins.100", "premium.monthly"])
        XCTAssertEqual(request.type, .inApp)
        XCTAssertTrue(warnings.contains { $0.contains("indexed SKU keys") })
        XCTAssertTrue(warnings.contains { $0.contains("`inapp`") && $0.contains("`in-app`") })
    }

    func testCanonicalProductRequestWinsOverIndexedSkuFallbackAndWarns() throws {
        var warnings: [String] = []
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        let request = try GodotIapHelper.decodeProductRequest(from: [
            "skus": ["canonical"],
            "0": "legacy",
            "type": "in-app",
        ])

        XCTAssertEqual(request.skus, ["canonical"])
        XCTAssertTrue(warnings.contains { $0.contains("indexed SKU keys") })
    }

    func testLegacyRequestWrapperAndIosKeyNormalizeToApple() throws {
        var warnings: [String] = []
        GodotIapLog.setEnabled(true)
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "request": [
                "ios": ["sku": "legacy.ios"],
            ],
            "type": "inapp",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "legacy.ios")
        XCTAssertNil(platforms.ios)
        XCTAssertTrue(warnings.contains { $0.contains("`request`") })
        XCTAssertTrue(warnings.contains { $0.contains("`ios`") && $0.contains("`apple`") })
    }

    func testCanonicalAppleWinsWhenLegacyIosIsAlsoPresent() throws {
        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestPurchase": [
                "apple": ["sku": "canonical.apple"],
                "ios": ["sku": "legacy.ios"],
            ],
            "type": "in-app",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "canonical.apple")
        XCTAssertNil(platforms.ios)
    }

    func testCanonicalApplePurchaseDoesNotEmitCompatibilityWarnings() throws {
        var warnings: [String] = []
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestPurchase": [
                "apple": ["sku": "canonical.apple"],
            ],
            "type": "in-app",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "canonical.apple")
        XCTAssertTrue(warnings.isEmpty)
    }

    func testCanonicalPurchaseBranchWinsOverOtherLegacyEnvelopesAndWarns() throws {
        var warnings: [String] = []
        GodotIapLog.setHandler { level, message in
            if level == .warn {
                warnings.append(message)
            }
        }

        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestPurchase": ["apple": ["sku": "canonical.apple"]],
            "request": ["ios": ["sku": "legacy.request"]],
            "sku": "legacy.top-level",
            "type": "in-app",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "canonical.apple")
        XCTAssertTrue(warnings.contains { $0.contains("`request`") })
        XCTAssertTrue(warnings.contains { $0.contains("top-level sku purchase payload") })
    }

    func testTopLevelSkuNormalizesToCanonicalAppleEnvelope() throws {
        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "sku": "legacy.simple",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "legacy.simple")
        XCTAssertNil(platforms.ios)
    }

    func testAmbiguousCanonicalPurchaseBranchesAreRejected() {
        XCTAssertThrowsError(try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestPurchase": ["apple": ["sku": "one-time"]],
            "requestSubscription": ["apple": ["sku": "subscription"]],
        ]))
    }
}
