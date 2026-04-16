import XCTest
import OpenIAP
@testable import NitroIap

/// Reconnect regression coverage for the iOS subscriptionBillingIssue listener.
///
/// The bug: `cleanupExistingState()` (invoked by `endConnection()`) used to leave
/// `subscriptionBillingIssueSub` non-nil and `subscriptionBillingIssueListeners`
/// non-empty, even though `OpenIapModule.shared.endConnection()` resets its
/// listener registry. On reconnect, `attachSubscriptionBillingIssueSubIfNeeded()`
/// would skip re-registration because the guard `subscriptionBillingIssueSub == nil`
/// was still false — and users would never see another billing-issue event after
/// a disconnect/reconnect cycle on the same HybridRnIap instance.
///
/// Reflection note: the sub + listeners are `private` in HybridRnIap so `@testable`
/// alone cannot read them. `Mirror` ignores Swift access control at runtime, so we
/// use it to assert the post-conditions without widening the production API surface.
@available(iOS 15.0, macOS 14.0, tvOS 15.0, watchOS 8.0, *)
final class SubscriptionBillingIssueReconnectTests: XCTestCase {

    func testEndConnectionClearsBillingIssueSubAndListenersAndReconnectReRegisters() async throws {
        let hybrid = HybridRnIap()

        // 1. Register a listener — attaches the OpenIAP subscription token.
        try hybrid.addSubscriptionBillingIssueListener { _ in }
        XCTAssertNotNil(
            inspectSub(hybrid),
            "addSubscriptionBillingIssueListener must attach subscriptionBillingIssueSub"
        )
        XCTAssertEqual(
            inspectListenerCount(hybrid),
            1,
            "listener must be appended to subscriptionBillingIssueListeners"
        )

        // 2. endConnection → cleanupExistingState. This is the regression: the old
        //    implementation only reset the three original subs (purchaseUpdated,
        //    purchaseError, promotedProduct) and left the billing-issue slot dirty.
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

        // 3. Reconnect: register again on the same instance. If step 2 failed to
        //    nil the sub, `attachSubscriptionBillingIssueSubIfNeeded()`'s guard
        //    `subscriptionBillingIssueSub == nil` would short-circuit and the
        //    OpenIAP listener registry would never see the new token.
        try hybrid.addSubscriptionBillingIssueListener { _ in }

        XCTAssertNotNil(
            inspectSub(hybrid),
            "after endConnection + re-register, subscriptionBillingIssueSub must re-attach"
        )
        XCTAssertEqual(
            inspectListenerCount(hybrid),
            1,
            "after re-register, subscriptionBillingIssueListeners must hold the new callback"
        )
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

    private func childValue(_ object: Any, label: String) -> Any? {
        Mirror(reflecting: object)
            .children
            .first { $0.label == label }?
            .value
    }
}
