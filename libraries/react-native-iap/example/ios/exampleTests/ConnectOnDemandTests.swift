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

    func testOnDemandConnectIsNotRepeatedOnEveryCall() async throws {
        let hybrid = HybridRnIap()

        _ = try await hybrid.getAvailablePurchases(options: nil).await()
        let epochAfterFirst = inspectEpoch(hybrid)

        _ = try await hybrid.getAvailablePurchases(options: nil).await()

        XCTAssertEqual(
            inspectEpoch(hybrid),
            epochAfterFirst,
            "the second call must reuse the open connection, not reconnect"
        )

        _ = try await hybrid.endConnection().await()
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

    private func inspectEpoch(_ hybrid: HybridRnIap) -> UInt64 {
        childValue(hybrid, label: "connectionEpoch") as? UInt64 ?? .max
    }

    private func childValue(_ object: Any, label: String) -> Any? {
        Mirror(reflecting: object)
            .children
            .first { $0.label == label }?
            .value
    }
}
