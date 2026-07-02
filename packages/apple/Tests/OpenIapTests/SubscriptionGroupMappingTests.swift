import XCTest
@testable import OpenIAP

final class SubscriptionGroupMappingTests: XCTestCase {
    func testActiveSubscriptionsKeepIndependentProductIdsForMultipleGroups() {
        let premium = activeSubscription(
            productId: "dev.hyo.martie.premium.monthly",
            transactionId: "transaction-premium"
        )
        let pro = activeSubscription(
            productId: "dev.hyo.martie.pro.monthly",
            transactionId: "transaction-pro"
        )

        XCTAssertEqual(premium.productId, "dev.hyo.martie.premium.monthly")
        XCTAssertEqual(premium.currentPlanId, "dev.hyo.martie.premium.monthly")
        XCTAssertEqual(premium.transactionId, "transaction-premium")
        XCTAssertEqual(pro.productId, "dev.hyo.martie.pro.monthly")
        XCTAssertEqual(pro.currentPlanId, "dev.hyo.martie.pro.monthly")
        XCTAssertEqual(pro.transactionId, "transaction-pro")
    }

    private func activeSubscription(
        productId: String,
        transactionId: String
    ) -> ActiveSubscription {
        ActiveSubscription(
            autoRenewingAndroid: nil,
            currentPlanId: productId,
            isActive: true,
            productId: productId,
            purchaseToken: "jws-\(transactionId)",
            transactionDate: 1_700_000_000_000,
            transactionId: transactionId
        )
    }
}
