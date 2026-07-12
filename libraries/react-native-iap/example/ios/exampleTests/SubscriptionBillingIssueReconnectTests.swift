import XCTest
import OpenIAP
@testable import NitroIap

/// Reconnect regression coverage for the iOS subscriptionBillingIssue listener.
///
/// Covers listener attachment and cleanup across a disconnect/reconnect cycle.
/// Native subscriptions must only exist for an initialized connection, and a
/// completed `endConnection()` must leave no stale subscription or callback.
///
/// Reflection note: the sub + listeners are `private` in HybridRnIap so `@testable`
/// alone cannot read them. `Mirror` ignores Swift access control at runtime, so we
/// use it to assert the post-conditions without widening the production API surface.
@available(iOS 15.0, macOS 14.0, tvOS 15.0, watchOS 8.0, *)
final class SubscriptionBillingIssueReconnectTests: XCTestCase {

    func testEndConnectionClearsBillingIssueSubAndListenersAndReconnectReRegisters() async throws {
        let hybrid = HybridRnIap()

        // 1. Registration before init stores the callback without attaching a
        //    native subscription to an inactive connection.
        try hybrid.addSubscriptionBillingIssueListener { _ in }
        XCTAssertNil(inspectSub(hybrid))
        XCTAssertEqual(inspectListenerCount(hybrid), 1)

        // 2. Initialization attaches the pending callback exactly once.
        let initialConnectionResult = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(initialConnectionResult)
        XCTAssertNotNil(
            inspectSub(hybrid),
            "initConnection must attach subscriptionBillingIssueSub"
        )
        XCTAssertEqual(
            inspectListenerCount(hybrid),
            1,
            "listener must be appended to subscriptionBillingIssueListeners"
        )

        // 3. endConnection awaits core cleanup before returning.
        _ = try await hybrid.endConnection().await()

        XCTAssertNil(
            inspectSub(hybrid),
            "endConnection() must nil subscriptionBillingIssueSub so reconnect can re-register"
        )
        XCTAssertEqual(
            inspectListenerCount(hybrid),
            0,
            "endConnection() must clear subscriptionBillingIssueListeners"
        )

        // 4. A new pre-init registration stays detached, then reconnect attaches it.
        try hybrid.addSubscriptionBillingIssueListener { _ in }
        XCTAssertNil(inspectSub(hybrid))
        let reconnectResult = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(reconnectResult)

        XCTAssertNotNil(
            inspectSub(hybrid),
            "after endConnection + re-register, subscriptionBillingIssueSub must re-attach"
        )
        XCTAssertEqual(
            inspectListenerCount(hybrid),
            1,
            "after re-register, subscriptionBillingIssueListeners must hold the new callback"
        )
        _ = try await hybrid.endConnection().await()
    }

    func testInitSubmittedDuringEndRunsAfterTeardown() async throws {
        let hybrid = HybridRnIap()
        let initialConnectionResult = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(initialConnectionResult)

        // Submit reconnect before awaiting end. Wrapper FIFO ordering must let end
        // finish core teardown first, then leave both wrapper and core connected.
        let endPromise = try hybrid.endConnection()
        await Task.yield()
        let reconnectPromise = try hybrid.initConnection(config: nil)

        let endResult = try await endPromise.await()
        let reconnectResult = try await reconnectPromise.await()
        XCTAssertTrue(endResult)
        XCTAssertTrue(reconnectResult)
        XCTAssertTrue(inspectInitialized(hybrid))
        _ = try await OpenIapModule.shared.getPendingTransactionsIOS()

        _ = try await hybrid.endConnection().await()
    }

    // MARK: - Private reflection helpers

    private func inspectSub(_ hybrid: HybridRnIap) -> Any? {
        guard let child = childValue(hybrid, label: "subscriptionBillingIssueSub") else {
            XCTFail("HybridRnIap no longer exposes subscriptionBillingIssueSub — test needs update")
            return nil
        }
        let mirror = Mirror(reflecting: child)
        // Optional<Subscription>.none surfaces as an Optional mirror with zero children.
        if mirror.displayStyle == .optional {
            return mirror.children.first?.value
        }
        return child
    }

    private func inspectListenerCount(_ hybrid: HybridRnIap) -> Int {
        guard let child = childValue(hybrid, label: "subscriptionBillingIssueListeners") else {
            XCTFail("HybridRnIap no longer exposes subscriptionBillingIssueListeners — test needs update")
            return -1
        }
        return Mirror(reflecting: child).children.count
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
}
