import XCTest
@testable import GodotIap

final class GodotIapHelperTests: XCTestCase {
    func testCanonicalProductQueryTypesPreserveMeaning() throws {
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
    }

    func testRemovedAliasesUnknownValuesAndPurchaseAllAreRejected() {
        for removed in ["inapp", "in_app", "subscription", "subscriptions"] {
            XCTAssertThrowsError(try GodotIapHelper.parseProductQueryType(removed))
        }
        XCTAssertThrowsError(try GodotIapHelper.parseProductQueryType("subscrption"))
        XCTAssertThrowsError(
            try GodotIapHelper.parseProductQueryType("all", allowAll: false)
        )
    }

    func testCanonicalProductRequestDecodes() throws {
        let request = try GodotIapHelper.decodeProductRequest(from: [
            "skus": ["coins.100", "premium.monthly"],
            "type": "all",
        ])

        XCTAssertEqual(request.skus, ["coins.100", "premium.monthly"])
        XCTAssertEqual(request.type, .all)
    }

    func testProductRequestRejectsIndexedSkuCompatibilityShape() {
        XCTAssertThrowsError(
            try GodotIapHelper.decodeProductRequest(from: [
                "0": "coins.100",
                "1": "premium.monthly",
                "type": "in-app",
            ])
        )
    }

    func testProductRequestRejectsNonStringType() {
        XCTAssertThrowsError(
            try GodotIapHelper.decodeProductRequest(from: [
                "skus": ["coins.100"],
                "type": 7,
            ])
        )
    }

    func testCanonicalPurchaseRequestDecodes() throws {
        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestPurchase": [
                "apple": ["sku": "coins.100"],
            ],
            "type": "in-app",
        ])

        guard case let .purchase(platforms) = request.request else {
            return XCTFail("Expected a purchase request")
        }
        XCTAssertEqual(platforms.apple?.sku, "coins.100")
    }

    func testCanonicalSubscriptionRequestDecodes() throws {
        let request = try GodotIapHelper.decodeRequestPurchaseProps(from: [
            "requestSubscription": [
                "apple": ["sku": "premium.monthly"],
            ],
            "type": "subs",
        ])

        guard case let .subscription(platforms) = request.request else {
            return XCTFail("Expected a subscription request")
        }
        XCTAssertEqual(platforms.apple?.sku, "premium.monthly")
    }

    func testRemovedPurchaseRequestShapesAreRejected() {
        let removedPayloads: [[String: Any]] = [
            [
                "request": ["ios": ["sku": "legacy.request"]],
                "type": "in-app",
            ],
            [
                "requestPurchase": ["ios": ["sku": "legacy.ios"]],
                "type": "in-app",
            ],
            [
                "sku": "legacy.top-level",
                "type": "in-app",
            ],
        ]

        for payload in removedPayloads {
            XCTAssertThrowsError(
                try GodotIapHelper.decodeRequestPurchaseProps(from: payload)
            )
        }
    }

    func testConflictingCanonicalBranchesAreRejected() {
        XCTAssertThrowsError(
            try GodotIapHelper.decodeRequestPurchaseProps(from: [
                "requestPurchase": ["apple": ["sku": "coins.100"]],
                "requestSubscription": ["apple": ["sku": "premium.monthly"]],
                "type": "in-app",
            ])
        )
    }

    func testPurchaseRequestRejectsNonStringType() {
        XCTAssertThrowsError(
            try GodotIapHelper.decodeRequestPurchaseProps(from: [
                "requestPurchase": ["apple": ["sku": "coins.100"]],
                "type": 7,
            ])
        )
    }
}
