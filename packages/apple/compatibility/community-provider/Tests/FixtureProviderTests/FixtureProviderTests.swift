import Foundation
import XCTest
import OpenIAP
import OpenIapConformance
import FixtureProvider

private struct Adapter: ProviderConformanceAdapter {
    var factory: any OpenIapProviderFactory = FixtureFactory()
    let module: FixtureModule
    var omitCapability: String?
    var provider: any OpenIapModuleProtocol { module }
    var normativeErrorCases: [ProviderErrorCase] {
        [ProviderErrorCase(expected: .userCancelled, actual: module.normalizeError("cancelled")),
         ProviderErrorCase(expected: .skuNotFound, actual: module.normalizeError("missing-sku"))]
    }
    var unrecognizedError: PurchaseError { module.normalizeError("unknown-native-code") }
    func toActiveSubscription(_ purchase: PurchaseIOS) -> ActiveSubscription { module.toActiveSubscription(purchase) }
    func billingIssueRetainsEntitlement(_ purchase: PurchaseIOS) -> Bool { module.billingGracePeriod }
    func triggerCapability(_ capability: String) async throws {
        if capability != omitCapability { try module.trigger(capability) }
    }
}

final class FixtureProviderTests: XCTestCase {
    func testPublicConformancePassesEveryDeclaredBehavior() async throws {
        let report = await ProviderConformanceSuite(adapter: Adapter(module: FixtureModule())).run()
        XCTAssertTrue(report.conformant)
        XCTAssertTrue(report.scope.complete)
        XCTAssertEqual(report.scope.requiredBehaviors.count, 18)
        XCTAssertEqual(report.clientProtocolVersion, OpenIapVersion.clientProtocolVersion)
        if let path = ProcessInfo.processInfo.environment["OPENIAP_PROVIDER_REPORT"] {
            try report.write(to: URL(fileURLWithPath: path))
        }
    }

    func testConformanceReusesAnOwnedPurchase() async {
        let provider = FixtureModule()
        provider.rejectOwnedPurchase = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider)).run()
        XCTAssertTrue(report.conformant)
        XCTAssertTrue(report.scope.complete)
    }

    func testInvalidRequestRequiresExactlyOneFailureEventAndNoPurchase() async {
        for mode in ["missing", "duplicate", "purchase"] {
            let provider = FixtureModule()
            provider.failureEventCount = mode == "missing" ? 0 : mode == "duplicate" ? 2 : 1
            provider.purchaseOnFailure = mode == "purchase"
            let report = await ProviderConformanceSuite(adapter: Adapter(module: provider), eventTimeout: 0.05).run()
            XCTAssertFalse(report.conformant, mode)
            XCTAssertEqual(report.results.first { $0.id == "provider.invalid-purchase-emits-error-once" }?.outcome, "fail", mode)
        }
    }

    func testRepeatedReadTokensMustMatchThePurchaseCallback() async {
        let provider = FixtureModule()
        provider.rotateTokenAfterFirstRead = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider), eventTimeout: 0.05).run()
        XCTAssertEqual(report.results.first { $0.id == "restoration.available-purchases-returns-owned-items" }?.outcome, "pass")
        XCTAssertEqual(report.results.first { $0.id == "identifiers.purchase-token-is-stable-across-reads" }?.outcome, "fail")
        XCTAssertFalse(report.conformant)
    }

    func testFailureEventMayAccompanyAnEmptyResult() async {
        let provider = FixtureModule()
        provider.returnFailureInsteadOfThrow = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider), eventTimeout: 0.05).run()
        XCTAssertTrue(report.conformant)
        XCTAssertEqual(report.results.first { $0.id == "provider.invalid-purchase-emits-error-once" }?.outcome, "pass")
    }

    func testGenericThrowStillRequiresExactlyOneCanonicalFailureEvent() async {
        for count in [0, 1, 2] {
            let provider = FixtureModule()
            provider.genericRequestFailure = NSError(domain: "CommunityProvider", code: 1)
            provider.failureEventCount = count
            let report = await ProviderConformanceSuite(
                adapter: Adapter(module: provider), eventTimeout: 0.05
            ).run()
            XCTAssertEqual(report.conformant, count == 1)
            XCTAssertEqual(
                report.results.first { $0.id == "provider.invalid-purchase-emits-error-once" }?.outcome,
                count == 1 ? "pass" : "fail"
            )
        }
    }

    func testConformanceRejectsAndroidPurchasesOnApple() async {
        let provider = FixtureModule()
        provider.emitAndroidPurchase = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider)).run()
        XCTAssertFalse(report.conformant)
        XCTAssertEqual(report.results.first { $0.id == "purchases.request-emits-purchase-updated-on-success" }?.outcome, "fail")
    }

    func testObjCRequestJSONPreservesBooleanOptionsAndDictionaryCompatibility() async throws {
        for useJSON in [true, false] {
            let provider = FixtureModule()
            let module = OpenIapModule(factory: FixedFactory(provider))
            _ = try await module.initConnection()
            let payload: [String: Any] = ["type": "in-app", "requestPurchase": ["apple": [
                "sku": "conformance.product", "andDangerouslyFinishTransactionAutomatically": false
            ]]]
            let completed = expectation(description: "Objective-C request")
            let completion: (Any?, Error?) -> Void = { result, error in
                XCTAssertNil(error)
                XCTAssertNotNil(result)
                completed.fulfill()
            }
            if useJSON {
                let data = try JSONSerialization.data(withJSONObject: payload)
                module.requestPurchaseWithJSON(String(decoding: data, as: UTF8.self), completion: completion)
            } else { module.requestPurchaseWithPayload(payload, completion: completion) }
            await fulfillment(of: [completed], timeout: 2)
            guard case .purchase(let request) = provider.lastRequest?.request else {
                XCTFail("Provider did not receive a purchase request")
                continue
            }
            XCTAssertEqual(request.apple?.andDangerouslyFinishTransactionAutomatically, false)
        }
    }

    func testFailedConnectionAttemptsDisconnect() async {
        for throwsError in [false, true] {
            let provider = FixtureModule()
            provider.connectionResult = false
            if throwsError { provider.connectionError = PurchaseError.make(code: .initConnection) }
            let report = await ProviderConformanceSuite(adapter: Adapter(module: provider)).run()
            XCTAssertFalse(report.conformant)
            XCTAssertFalse(report.scope.complete)
            XCTAssertEqual(report.results.first { $0.id == "provider.connection" }?.outcome, "fail")
            XCTAssertEqual(report.results.first { $0.id == "provider.disconnect" }?.outcome, "pass")
            XCTAssertEqual(provider.disconnectCount, 1)
            XCTAssertFalse(provider.isConnected)
        }
    }

    func testDeferredErrorsAndBillingGraceRetainTheirPlatformSemantics() async {
        let provider = FixtureModule()
        provider.deferredPending = true
        provider.billingGracePeriod = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider)).run()
        XCTAssertTrue(report.conformant)
    }

    func testDeclaredCapabilityCannotPassWithoutItsEvent() async {
        let report = await ProviderConformanceSuite(
            adapter: Adapter(module: FixtureModule(), omitCapability: "subscriptionBillingIssue"), eventTimeout: 0.05
        ).run()
        XCTAssertFalse(report.conformant)
        XCTAssertTrue(report.scope.complete)
        XCTAssertEqual(report.results.first { $0.id == "apple-provider.subscription-billing-issue" }?.outcome, "fail")
    }

    func testPendingRejectsPurchasedAfterDeferredError() async {
        let provider = FixtureModule()
        provider.deferredThenPurchased = true
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider), eventTimeout: 0.05).run()
        XCTAssertFalse(report.conformant)
        XCTAssertEqual(report.results.first { $0.id == ProviderBehaviors.capabilities["pendingPurchases"] }?.outcome, "fail")
    }

    func testCapabilityEventsRequireConsistentStoreIdentity() async {
        let provider = FixtureModule()
        provider.capabilityStore = .apple
        let report = await ProviderConformanceSuite(adapter: Adapter(module: provider), eventTimeout: 0.05).run()
        XCTAssertFalse(report.conformant)
        XCTAssertEqual(report.results.filter { $0.outcome == "fail" }.count, 3)
    }

    func testFilteredBooleanUsesProviderResultInsteadOfListLength() async throws {
        let provider = FixtureModule()
        provider.inactiveSubscriptions = true
        provider.forcedHasActive = false
        let module = OpenIapModule(factory: FixedFactory(provider))
        _ = try await module.initConnection()
        let request = try OpenIapSerialization.decode(object: ["type": "in-app", "requestPurchase": ["apple": ["sku": "conformance.product"]]], as: RequestPurchaseProps.self)
        _ = try await module.requestPurchase(request)
        let subscriptions = try await module.getActiveSubscriptions(["conformance.product"])
        XCTAssertEqual(subscriptions.count, 1)
        XCTAssertFalse(try XCTUnwrap(subscriptions.first).isActive)
        let completed = expectation(description: "Filtered native boolean")
        module.hasActiveSubscriptionsWithSubscriptionIds(["conformance.product"]) { active, error in
            XCTAssertNil(error)
            XCTAssertFalse(active)
            completed.fulfill()
        }
        await fulfillment(of: [completed], timeout: 2)
        XCTAssertEqual(provider.lastSubscriptionIds, ["conformance.product"])
    }

    func testFacadePreservesOpaqueIdentityAndFullCompletion() async throws {
        let provider = FixtureModule()
        let module = OpenIapModule(factory: FixedFactory(provider))
        let connected = try await module.initConnection()
        XCTAssertTrue(connected)
        let request = try OpenIapSerialization.decode(object: ["type": "in-app", "requestPurchase": ["apple": ["sku": "conformance.product"]]], as: RequestPurchaseProps.self)
        _ = try await module.requestPurchase(request)
        try await module.restorePurchases()
        _ = try await module.presentCodeRedemptionSheetIOS()
        let owned = try await module.getAvailablePurchases(nil)
        let purchase = try XCTUnwrap(owned.first)
        XCTAssertEqual(purchase.storeId, "community_fixture")
        XCTAssertEqual(purchase.store, .unknown)
        let expectation = expectation(description: "Objective-C completion")
        let data = try JSONEncoder().encode(purchase)
        // The public union and flattened payload paths must both preserve identity.
        module.finishTransactionWithPurchaseJSON(String(decoding: data, as: UTF8.self), isConsumable: false) { error in
            XCTAssertNil(error)
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2)
        XCTAssertEqual(provider.finished[purchase.id]?.purchaseToken, purchase.purchaseToken)
        let legacy = self.expectation(description: "Legacy completion")
        module.finishTransactionWithPurchaseId(purchase.id, productId: purchase.productId, isConsumable: false) { error in
            XCTAssertNil(error)
            legacy.fulfill()
        }
        await fulfillment(of: [legacy], timeout: 2)
        do { _ = try await module.getReceiptDataIOS(); XCTFail("Optional StoreKit operation must be unsupported") }
        catch let error as PurchaseError { XCTAssertEqual(error.code, .featureNotSupported) }
        let disconnected = try await module.endConnection()
        XCTAssertTrue(disconnected)
    }

    func testUnknownDeclaredCapabilityFailsConformance() async {
        let report = await ProviderConformanceSuite(
            adapter: Adapter(factory: UnknownCapabilityFactory(), module: FixtureModule()), eventTimeout: 0.05
        ).run()
        XCTAssertFalse(report.conformant)
        XCTAssertTrue(report.capabilities.contains("mysteryCapability"))
        XCTAssertEqual(report.results.first { $0.id == "provider.unknown-capability.mysteryCapability" }?.outcome, "fail")
        XCTAssertEqual(report.results.first { $0.id == "capabilities.declared-capabilities-match-the-matrix" }?.outcome, "fail")
    }

    func testUnknownDeclaredCapabilityFailsEvenWhenConnectionFails() async {
        let provider = FixtureModule()
        provider.connectionResult = false
        let report = await ProviderConformanceSuite(
            adapter: Adapter(factory: UnknownCapabilityFactory(), module: provider), eventTimeout: 0.05
        ).run()
        XCTAssertFalse(report.conformant)
        XCTAssertEqual(report.results.first { $0.id == "provider.unknown-capability.mysteryCapability" }?.outcome, "fail")
        XCTAssertEqual(report.results.first { $0.id == "provider.connection" }?.outcome, "fail")
    }

    func testLegacyCompletionFinishesAnUnfinishedPurchase() async throws {
        let provider = FixtureModule()
        let module = OpenIapModule(factory: FixedFactory(provider))
        _ = try await module.initConnection()
        let request = try OpenIapSerialization.decode(object: ["type": "in-app", "requestPurchase": ["apple": ["sku": "conformance.second"]]], as: RequestPurchaseProps.self)
        _ = try await module.requestPurchase(request)
        let owned = try await module.getAvailablePurchases(nil)
        let purchase = try XCTUnwrap(owned.first { $0.productId == "conformance.second" })
        XCTAssertNil(provider.finished[purchase.id])
        let completed = expectation(description: "Legacy completion finishes")
        module.finishTransactionWithPurchaseId(purchase.id, productId: purchase.productId, isConsumable: false) { error in
            XCTAssertNil(error)
            completed.fulfill()
        }
        await fulfillment(of: [completed], timeout: 2)
        XCTAssertEqual(provider.finished[purchase.id]?.purchaseToken, purchase.purchaseToken)
    }

    func testFinishRejectsPurchaseFromAnotherProvider() async throws {
        let provider = FixtureModule()
        let module = OpenIapModule(factory: FixedFactory(provider))
        _ = try await module.initConnection()
        let foreign = try OpenIapSerialization.decode(object: [
            "id": "txn-other", "transactionId": "txn-other", "productId": "conformance.product",
            "store": "apple", "storeId": "apple", "quantity": 1, "isAutoRenewing": false,
            "purchaseState": "purchased", "purchaseToken": "token-other", "transactionDate": 1.0,
        ], as: PurchaseIOS.self)
        do {
            try await module.finishTransaction(purchase: .purchaseIos(foreign), isConsumable: false)
            XCTFail("A purchase from another provider must not finish")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .developerError)
            XCTAssertTrue(error.message.contains("differs"), "wrong guard: \(error.message)")
        }
        XCTAssertTrue(provider.finished.isEmpty)
    }

    func testFinishRejectsNonIOSPurchase() async throws {
        let provider = FixtureModule()
        let module = OpenIapModule(factory: FixedFactory(provider))
        _ = try await module.initConnection()
        let android = Purchase.purchaseAndroid(PurchaseAndroid(
            id: "txn-android", isAutoRenewing: false, productId: "conformance.product",
            purchaseState: .purchased, purchaseToken: "fixture-token-android", quantity: 1,
            store: .unknown, storeId: "community_fixture", transactionDate: 1.0
        ))
        do {
            try await module.finishTransaction(purchase: android, isConsumable: false)
            XCTFail("A non-iOS purchase must not finish")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .developerError)
            XCTAssertTrue(error.message.contains("iOS purchase"), "wrong guard: \(error.message)")
        }
        XCTAssertTrue(provider.finished.isEmpty)
    }

    func testRemovingListenersStopsProviderEvents() async throws {
        let provider = FixtureModule()
        let count = Count()
        let subscription = provider.purchaseUpdatedListener({ _ in count.increment() }, options: nil)
        try provider.trigger("pendingPurchases")
        XCTAssertEqual(count.value, 1)
        provider.removeListener(subscription)
        try provider.trigger("pendingPurchases")
        XCTAssertEqual(count.value, 1)
    }
}

private final class Count: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    func increment() { lock.lock(); count += 1; lock.unlock() }
    var value: Int { lock.lock(); defer { lock.unlock() }; return count }
}
private final class UnknownCapabilityFactory: OpenIapProviderFactory {
    private let base = FixtureFactory()
    required init() {}
    var storeId: String { base.storeId }
    var coreVersion: String { base.coreVersion }
    var clientProtocolVersion: String { base.clientProtocolVersion }
    var capabilities: Set<String> { base.capabilities.union(["mysteryCapability"]) }
    func create() throws -> any OpenIapModuleProtocol { FixtureModule() }
}
private final class FixedFactory: OpenIapProviderFactory {
    let module: FixtureModule
    required init() { module = FixtureModule() }
    init(_ module: FixtureModule) { self.module = module }
    var storeId: String { "community_fixture" }
    var coreVersion: String { FixtureFactory().coreVersion }
    var clientProtocolVersion: String { FixtureFactory().clientProtocolVersion }
    func create() throws -> any OpenIapModuleProtocol { module }
}
