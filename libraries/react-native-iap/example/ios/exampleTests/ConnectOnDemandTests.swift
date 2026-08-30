import XCTest
import OpenIAP
@testable import NitroIap

/// A store call made without `initConnection()` must still arrive with the
/// bridge's listeners attached.
///
/// StoreKit has no connection to open, so the bridge connects on demand rather
/// than refusing. That is only safe if the on-demand path is the same one
/// `initConnection()` uses — otherwise a purchase would run with no subscription
/// observing it, and the app would never call `finishTransaction`.
///
/// Reflection note: matches SubscriptionBillingIssueReconnectTests — the state is
/// `private` in HybridRnIap, and `Mirror` reads it without widening the API.
@available(iOS 15.0, macOS 14.0, tvOS 15.0, watchOS 8.0, *)
final class ConnectOnDemandTests: XCTestCase {

    func testStoreCallWithoutInitConnectionConnectsAndAttachesListeners() async throws {
        let hybrid = HybridRnIap()

        try hybrid.addSubscriptionBillingIssueListener { _ in }
        XCTAssertFalse(inspectInitialized(hybrid))
        XCTAssertNil(
            inspectSub(hybrid),
            "precondition: nothing is attached before a connection exists"
        )

        // No initConnection() — this is the call an app makes on mount.
        _ = try await hybrid.getAvailablePurchases(options: nil).await()

        XCTAssertTrue(
            inspectInitialized(hybrid),
            "a guarded store call must open the connection instead of refusing"
        )
        XCTAssertNotNil(
            inspectSub(hybrid),
            "the on-demand connect must attach listeners, or purchase events are lost"
        )

        _ = try await hybrid.endConnection().await()
    }

    func testOnDemandConnectReusesAttachedListeners() async throws {
        let hybrid = HybridRnIap()

        try hybrid.addSubscriptionBillingIssueListener { _ in }
        _ = try await hybrid.getAvailablePurchases(options: nil).await()
        let subAfterFirst = try XCTUnwrap(inspectSub(hybrid))

        _ = try await hybrid.getAvailablePurchases(options: nil).await()
        let subAfterSecond = try XCTUnwrap(inspectSub(hybrid))

        XCTAssertEqual(
            ObjectIdentifier(subAfterSecond as AnyObject),
            ObjectIdentifier(subAfterFirst as AnyObject),
            "the second call must reuse the attached listener"
        )

        _ = try await hybrid.endConnection().await()
    }

    func testQueuedTeardownPreventsLateStoreDelegation() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)

        let endPromise = try hybrid.endConnection()
        let probe = DelegationProbe()
        let operation = hybrid.enqueueConnectedOperation {
            probe.markDelegated()
            return true
        }

        _ = try await endPromise.await()
        do {
            _ = try await operation.value
            XCTFail("a store operation queued after teardown must not run")
        } catch let error as OpenIapException {
            XCTAssertEqual(error.domain, OpenIapException.domain)
            XCTAssertTrue(error.localizedDescription.contains(ErrorCode.initConnection.rawValue))
        }
        XCTAssertFalse(probe.wasDelegated)
    }

    func testTeardownWaitsForConnectedOperationDelivery() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let gate = DeliveryGate()
        let probe = EventProbe()

        let operation = hybrid.enqueueConnectedOperation {
            await gate.waitUntilReleased()
            probe.record("delivery")
            return true
        }
        while !(await gate.hasStarted) {
            await Task.yield()
        }

        let endPromise = try hybrid.endConnection()
        let endTask = Task {
            _ = try await endPromise.await()
            probe.record("end")
        }
        await gate.release()

        _ = try await operation.value
        try await endTask.value
        XCTAssertEqual(probe.events, ["delivery", "end"])
    }

    func testConnectionRequiringCallsUseBridgeOwnedOperations() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceURL = packageRoot.appendingPathComponent("ios/HybridRnIap.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)
        let guardedMethods = [
            "fetchProducts",
            "requestPurchase",
            "getAvailablePurchases",
            "getActiveSubscriptions",
            "hasActiveSubscriptions",
            "finishTransaction",
            "verifyPurchase",
            "verifyPurchaseWithProvider",
            "getStorefront",
            "getAppTransactionIOS",
            "getPromotedProductIOS",
            "presentCodeRedemptionSheetIOS",
            "clearTransactionIOS",
            "subscriptionStatusIOS",
            "currentEntitlementIOS",
            "latestTransactionIOS",
            "getPendingTransactionsIOS",
            "getAllTransactionsIOS",
            "syncIOS",
            "showManageSubscriptionsIOS",
            "deepLinkToSubscriptionsIOS",
            "isEligibleForIntroOfferIOS",
            "getReceiptDataIOS",
            "requestReceiptRefreshIOS",
            "isTransactionVerifiedIOS",
            "getTransactionJwsIOS",
            "beginRefundRequestIOS",
            "canPresentExternalPurchaseNoticeIOS",
            "presentExternalPurchaseNoticeSheetIOS",
            "presentExternalPurchaseLinkIOS",
            "isEligibleForExternalPurchaseCustomLinkIOS",
            "getExternalPurchaseCustomLinkTokenIOS",
            "showExternalPurchaseCustomLinkNoticeIOS"
        ]

        for method in guardedMethods {
            let body = try methodBody(method, in: source)
            XCTAssertTrue(
                body.contains("runConnectedOperation"),
                "\(method) must not delegate around the bridge lifecycle queue"
            )
        }

        let requestPurchaseBody = String(try methodBody("requestPurchase", in: source))
        let operationBody = try closureBody(
            after: "runConnectedOperation",
            in: requestPurchaseBody
        )
        let nativeRequest = try XCTUnwrap(
            operationBody.range(of: "OpenIapModule.shared.requestPurchase")
        )
        let delivery = try XCTUnwrap(
            operationBody.range(
                of: "deliverRequestPurchaseResultIfNeeded",
                range: nativeRequest.upperBound..<operationBody.endIndex
            )
        )
        XCTAssertLessThan(
            operationBody.distance(from: operationBody.startIndex, to: nativeRequest.lowerBound),
            operationBody.distance(from: operationBody.startIndex, to: delivery.lowerBound)
        )
    }

    // MARK: - Private reflection helpers

    private func inspectSub(_ hybrid: HybridRnIap) -> Any? {
        guard let child = childValue(hybrid, label: "subscriptionBillingIssueSub") else {
            XCTFail("HybridRnIap no longer exposes subscriptionBillingIssueSub — test needs update")
            return nil
        }
        let mirror = Mirror(reflecting: child)
        if mirror.displayStyle == .optional {
            return mirror.children.first?.value
        }
        return child
    }

    private func inspectInitialized(_ hybrid: HybridRnIap) -> Bool {
        childValue(hybrid, label: "isInitialized") as? Bool ?? false
    }

    private func childValue(_ object: Any, label: String) -> Any? {
        Mirror(reflecting: object)
            .children
            .first { $0.label == label }?
            .value
    }

    private func methodBody(_ name: String, in source: String) throws -> Substring {
        try closureBody(after: "    func \(name)", in: source)
    }

    private func closureBody(after marker: String, in source: String) throws -> Substring {
        let markerRange = try XCTUnwrap(source.range(of: marker))
        let openingBrace = try XCTUnwrap(
            source.range(of: "{", range: markerRange.upperBound..<source.endIndex)
        )
        var depth = 0
        var index = openingBrace.lowerBound
        while index < source.endIndex {
            switch source[index] {
            case "{":
                depth += 1
            case "}":
                depth -= 1
                if depth == 0 {
                    return source[openingBrace.lowerBound...index]
                }
            default:
                break
            }
            index = source.index(after: index)
        }
        throw NSError(domain: "ConnectOnDemandTests", code: 2)
    }

    private final class DelegationProbe: @unchecked Sendable {
        private let lock = NSLock()
        private var delegated = false

        var wasDelegated: Bool {
            lock.lock()
            defer { lock.unlock() }
            return delegated
        }

        func markDelegated() {
            lock.lock()
            delegated = true
            lock.unlock()
        }
    }

    private actor DeliveryGate {
        private(set) var hasStarted = false
        private var continuation: CheckedContinuation<Void, Never>?

        func waitUntilReleased() async {
            hasStarted = true
            await withCheckedContinuation { continuation = $0 }
        }

        func release() {
            continuation?.resume()
            continuation = nil
        }
    }

    private final class EventProbe: @unchecked Sendable {
        private let lock = NSLock()
        private var recordedEvents: [String] = []

        var events: [String] {
            lock.lock()
            defer { lock.unlock() }
            return recordedEvents
        }

        func record(_ event: String) {
            lock.lock()
            recordedEvents.append(event)
            lock.unlock()
        }
    }
}
