import XCTest
import OpenIAP
@testable import GodotIap

final class GodotIapHelperTests: XCTestCase {
    func testSuccessfulInvalidVerificationPreservesItsErrorNotification() async {
        let forwarded = expectation(description: "sku-not-found remains observable")
        let result = await GodotIapHelper.withCompletionErrors {
            GodotIapHelper.completionErrorOwner?.receive { forwarded.fulfill() }
            return false
        }
        XCTAssertFalse(result)
        await fulfillment(of: [forwarded], timeout: 1)
        XCTAssertNil(GodotIapHelper.completionErrorOwner)
    }

    func testFailedCompletionSuppressesEarlyAndLateInheritedCallbacks() async {
        let owner = GodotIapHelper.CompletionErrorOwner()
        let unexpected = expectation(description: "completion already carries the error")
        unexpected.isInverted = true
        let late = GodotIapHelper.$completionErrorOwner.withValue(owner) {
            owner.receive { unexpected.fulfill() }
            return Task {
                await Task.yield()
                return await Task { @MainActor in GodotIapHelper.completionErrorOwner }.value
            }
        }
        owner.complete(succeeded: false)
        let inherited = await late.value
        XCTAssertTrue(inherited === owner)
        inherited?.receive { unexpected.fulfill() }
        await fulfillment(of: [unexpected], timeout: 0.05)
        XCTAssertNil(GodotIapHelper.completionErrorOwner)
    }

    func testConcurrentOperationOwnersDoNotSuppressEachOther() async {
        let failed = GodotIapHelper.CompletionErrorOwner()
        let successful = GodotIapHelper.CompletionErrorOwner()
        let forwarded = expectation(description: "successful operation notification")
        let suppressed = expectation(description: "failed operation notification")
        suppressed.isInverted = true
        failed.receive { suppressed.fulfill() }
        successful.receive { forwarded.fulfill() }
        failed.complete(succeeded: false)
        successful.complete(succeeded: true)
        successful.receive { }
        failed.receive { suppressed.fulfill() }
        await fulfillment(of: [forwarded, suppressed], timeout: 0.05)
    }

    func testThrownOperationClosesItsErrorOwner() async {
        let suppressed = expectation(description: "thrown error belongs to completion")
        suppressed.isInverted = true
        var captured: GodotIapHelper.CompletionErrorOwner?
        do {
            let _: Bool = try await GodotIapHelper.withCompletionErrors {
                captured = GodotIapHelper.completionErrorOwner
                captured?.receive { suppressed.fulfill() }
                throw PurchaseError.make(code: .notPrepared)
            }
            XCTFail("Expected the provider failure")
        } catch {
            XCTAssertEqual((error as? PurchaseError)?.code, .notPrepared)
        }
        captured?.receive { suppressed.fulfill() }
        await fulfillment(of: [suppressed], timeout: 0.05)
        XCTAssertNil(GodotIapHelper.completionErrorOwner)
    }

    func testProviderErrorsRetainTheirCodeAndGenericErrorsUseTheFallback() {
        let unsupported = PurchaseError.make(code: .featureNotSupported, message: "Use the vendor backend")
        XCTAssertEqual(GodotIapHelper.errorCode(unsupported, fallback: .purchaseVerificationFailed), "feature-not-supported")
        XCTAssertEqual(GodotIapHelper.errorCode(NSError(domain: "Vendor", code: 1), fallback: .purchaseVerificationFailed), "purchase-verification-failed")
    }

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
