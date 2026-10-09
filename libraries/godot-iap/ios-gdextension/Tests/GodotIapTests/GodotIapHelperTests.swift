import XCTest
import StoreKit
import OpenIAP
@testable import GodotIap

final class GodotIapHelperTests: XCTestCase {
    func testAppleVerificationPayloadRetainsTopLevelValidityAndReceiptFields() throws {
        for isValid in [false, true] {
            let result = VerifyPurchaseResult.verifyPurchaseResultIos(
                VerifyPurchaseResultIOS(
                    isValid: isValid,
                    jwsRepresentation: "test-jws",
                    receiptData: "test-receipt"
                )
            )
            let payload = try GodotIapHelper.encodeRequired(result)
            XCTAssertEqual(payload["isValid"] as? Bool, isValid)
            XCTAssertEqual(payload["jwsRepresentation"] as? String, "test-jws")
            XCTAssertEqual(payload["receiptData"] as? String, "test-receipt")
            XCTAssertEqual(payload["__typename"] as? String, "VerifyPurchaseResultIOS")
        }
    }

    func testAppleVerificationRejectsANonAppleResult() {
        let result = VerifyPurchaseResult.verifyPurchaseResultHorizon(
            VerifyPurchaseResultHorizon(isValid: true)
        )
        XCTAssertThrowsError(try GodotIapHelper.encodeRequired(result)) { error in
            XCTAssertEqual((error as? PurchaseError)?.code, .featureNotSupported)
        }
    }

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

    func testRestorePreservesCancellationAndKnownErrors() {
        let errors: [Error] = [
            StoreKitError.userCancelled,
            NSError(domain: SKError.errorDomain, code: SKError.paymentCancelled.rawValue),
            PurchaseError.make(code: .userCancelled, message: "Restore cancelled")
        ]
        for error in errors {
            XCTAssertEqual(GodotIapHelper.restoreError(error).code, .userCancelled)
        }
        let serviceError = PurchaseError.make(code: .serviceError, message: "Store unavailable")
        let result = GodotIapHelper.restoreError(serviceError)
        XCTAssertEqual(result.code, .serviceError)
        XCTAssertEqual(result.message, "Store unavailable")
        XCTAssertEqual(
            GodotIapHelper.restoreError(NSError(domain: "restore-test", code: 1)).code,
            .syncError
        )
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

    private func handBuiltPurchase(store: String? = "unknown", storeId: String? = "") -> [String: Any] {
        var purchase: [String: Any] = [
            "id": "tx-coins",
            "productId": "coins",
            "transactionId": "tx-coins",
            "transactionDate": 1.0,
            "purchaseToken": "jws-coins",
            "purchaseState": "purchased",
            "quantity": 1,
            "isAutoRenewing": false,
        ]
        if let store { purchase["store"] = store } else { purchase.removeValue(forKey: "store") }
        if let storeId { purchase["storeId"] = storeId } else { purchase.removeValue(forKey: "storeId") }
        return purchase
    }

    func testHandBuiltBlankIdentityStampsTheConnectedProvider() throws {
        let blanks: [[String: Any]] = [
            handBuiltPurchase(store: "unknown", storeId: ""),
            handBuiltPurchase(store: "unknown", storeId: nil),
            handBuiltPurchase(store: nil, storeId: ""),
            handBuiltPurchase(store: "", storeId: "  "),
        ]
        for input in blanks {
            let stamped = GodotIapHelper.withProviderStoreIdentity(input, providerStoreId: { "apple" })
            XCTAssertEqual(stamped["store"] as? String, "apple")
            XCTAssertEqual(stamped["storeId"] as? String, "apple")
            let decoded = try OpenIapSerialization.purchaseInput(from: stamped)
            guard case let .purchaseIos(purchase) = decoded else {
                XCTFail("Expected an iOS purchase input")
                continue
            }
            XCTAssertEqual(purchase.purchaseToken, "jws-coins")
        }
    }

    func testHandBuiltBlankIdentityStampsCommunityProvidersAsUnknown() throws {
        let stamped = GodotIapHelper.withProviderStoreIdentity(
            handBuiltPurchase(),
            providerStoreId: { "community_fixture" }
        )
        XCTAssertEqual(stamped["store"] as? String, "unknown")
        XCTAssertEqual(stamped["storeId"] as? String, "community_fixture")
        let decoded = try OpenIapSerialization.purchaseInput(from: stamped)
        guard case let .purchaseIos(purchase) = decoded else {
            return XCTFail("Expected an iOS purchase input")
        }
        XCTAssertEqual(purchase.purchaseToken, "jws-coins")
    }

    func testBlankStoreIdWithOfficialStoreDropsTheKeyForDecoderInference() throws {
        for blank in ["", "  "] {
            let dropped = GodotIapHelper.withProviderStoreIdentity(
                handBuiltPurchase(store: "apple", storeId: blank),
                providerStoreId: { "apple" }
            )
            XCTAssertNil(dropped["storeId"])
            XCTAssertEqual(dropped["store"] as? String, "apple")
            let decoded = try OpenIapSerialization.purchaseInput(from: dropped)
            guard case let .purchaseIos(purchase) = decoded else {
                XCTFail("Expected an iOS purchase input")
                continue
            }
            XCTAssertEqual(purchase.storeId, "apple")
            XCTAssertEqual(purchase.purchaseToken, "jws-coins")
        }
    }

    func testExplicitStoreIdPassesThroughUntouched() throws {
        var lookups = 0
        let inputs: [[String: Any]] = [
            handBuiltPurchase(store: "unknown", storeId: "community_fixture"),
            handBuiltPurchase(store: "apple", storeId: "apple"),
        ]
        for input in inputs {
            let passed = GodotIapHelper.withProviderStoreIdentity(input, providerStoreId: {
                lookups += 1
                return "apple"
            })
            XCTAssertEqual(passed.count, input.count)
            XCTAssertEqual(passed["store"] as? String, input["store"] as? String)
            XCTAssertEqual(passed["storeId"] as? String, input["storeId"] as? String)
            XCTAssertEqual(passed["purchaseToken"] as? String, "jws-coins")
        }
        XCTAssertEqual(lookups, 0)
        let decoded = try OpenIapSerialization.purchaseInput(
            from: handBuiltPurchase(store: "unknown", storeId: "community_fixture")
        )
        guard case let .purchaseIos(purchase) = decoded else {
            return XCTFail("Expected an iOS purchase input")
        }
        XCTAssertEqual(purchase.storeId, "community_fixture")
    }

    func testUnreadableProviderLeavesBlankIdentityUntouched() {
        let input = handBuiltPurchase()
        let passed = GodotIapHelper.withProviderStoreIdentity(input, providerStoreId: { nil })
        XCTAssertEqual(passed.count, input.count)
        XCTAssertEqual(passed["store"] as? String, "unknown")
        XCTAssertEqual(passed["storeId"] as? String, "")
    }
}
