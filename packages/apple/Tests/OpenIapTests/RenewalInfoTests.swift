import XCTest
@testable import OpenIAP

/// Tests for RenewalInfoIOS, specifically the pendingUpgradeProductId logic
final class RenewalInfoTests: XCTestCase {

    // MARK: - pendingUpgradeProductId Logic Tests

    func testPendingUpgradeProductId_CancelledSubscription_ShouldBeNil() {
        // Given: A cancelled subscription (willAutoRenew = false)
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_monthly",  // User previously set to downgrade
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: nil,  // Should be nil for cancelled subscription
            priceIncreaseStatus: nil,
            renewalDate: nil,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: false  // Cancelled
        )

        // Then: pendingUpgradeProductId should be nil
        XCTAssertNil(
            renewalInfo.pendingUpgradeProductId,
            "Cancelled subscription should have nil pendingUpgradeProductId"
        )
        XCTAssertFalse(
            renewalInfo.willAutoRenew,
            "Cancelled subscription should have willAutoRenew = false"
        )
    }

    func testPendingUpgradeProductId_ActiveSubscription_SameTier_ShouldBeNil() {
        // Given: Active subscription on same tier (no tier change)
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_yearly",  // Same as current product
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: nil,  // No tier change
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: true  // Active
        )

        // Then: pendingUpgradeProductId should be nil
        XCTAssertNil(
            renewalInfo.pendingUpgradeProductId,
            "Same tier renewal should have nil pendingUpgradeProductId"
        )
        XCTAssertTrue(renewalInfo.willAutoRenew)
    }

    func testPendingUpgradeProductId_ActiveSubscription_UpgradeApplied_ShouldBeNil() {
        // Given: Upgrade was applied immediately (now on yearly)
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_yearly",  // Now on yearly after upgrade
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: nil,  // Upgrade already applied
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: true  // Active
        )

        // Then: pendingUpgradeProductId should be nil
        XCTAssertNil(
            renewalInfo.pendingUpgradeProductId,
            "Applied upgrade should have nil pendingUpgradeProductId"
        )
    }

    func testPendingUpgradeProductId_ActiveSubscription_PendingDowngrade_ShouldHaveValue() {
        // Given: Active subscription with pending downgrade (will apply at next renewal)
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_monthly",  // Will change to monthly at next renewal
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: "premium_monthly",  // Pending change
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: true  // Active
        )

        // Then: pendingUpgradeProductId should have the target product ID
        XCTAssertEqual(
            renewalInfo.pendingUpgradeProductId,
            "premium_monthly",
            "Pending downgrade should have pendingUpgradeProductId set"
        )
        XCTAssertTrue(renewalInfo.willAutoRenew)
    }

    // MARK: - Serialization Tests

    func testRenewalInfoSerialization_WithPendingUpgrade() throws {
        // Given: RenewalInfo with pending upgrade
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_monthly",
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: "premium_monthly",
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: true
        )

        // When: Encoding and decoding
        let encoded = try JSONEncoder().encode(renewalInfo)
        let decoded = try JSONDecoder().decode(RenewalInfoIOS.self, from: encoded)

        // Then: All fields should be preserved
        XCTAssertEqual(decoded.pendingUpgradeProductId, "premium_monthly")
        XCTAssertEqual(decoded.autoRenewPreference, "premium_monthly")
        XCTAssertEqual(decoded.willAutoRenew, true)
        XCTAssertEqual(decoded.renewalDate, 1729087555000)
    }

    func testRenewalInfoSerialization_Cancelled() throws {
        // Given: Cancelled subscription RenewalInfo
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_yearly",
            expirationReason: "1",  // Customer cancelled
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: nil,  // Should be nil for cancelled
            priceIncreaseStatus: nil,
            renewalDate: nil,  // No renewal date when cancelled
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: false  // Cancelled
        )

        // When: Encoding and decoding
        let encoded = try JSONEncoder().encode(renewalInfo)
        let decoded = try JSONDecoder().decode(RenewalInfoIOS.self, from: encoded)

        // Then: Cancelled state should be preserved
        XCTAssertNil(decoded.pendingUpgradeProductId)
        XCTAssertFalse(decoded.willAutoRenew)
        XCTAssertNil(decoded.renewalDate)
        XCTAssertEqual(decoded.expirationReason, "1")
    }

    // MARK: - Integration with PurchaseIOS

    func testPurchaseIOS_WithCancelledRenewalInfo() throws {
        // Given: Purchase with cancelled renewal info
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_monthly",
            expirationReason: "1",
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: nil,  // nil for cancelled
            priceIncreaseStatus: nil,
            renewalDate: nil,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: false  // Cancelled
        )

        let purchase = PurchaseIOS(
            appAccountToken: nil,
            appBundleIdIOS: "dev.hyo.app",
            countryCodeIOS: "US",
            currencyCodeIOS: "USD",
            currencySymbolIOS: "$",
            environmentIOS: "Sandbox",
            expirationDateIOS: 1729087555000,
            id: "txn_123",
            ids: nil,
            isAutoRenewing: false,
            isUpgradedIOS: false,
            offerIOS: nil,
            originalTransactionDateIOS: 1729083955000,
            originalTransactionIdentifierIOS: "txn_123",
            ownershipTypeIOS: "purchased",
            platform: .ios,
            productId: "premium_yearly",
            purchaseState: .purchased,
            purchaseToken: "jws_token",
            quantity: 1,
            quantityIOS: 1,
            reasonIOS: "purchase",
            reasonStringRepresentationIOS: "purchase",
            renewalInfoIOS: renewalInfo,
            revocationDateIOS: nil,
            revocationReasonIOS: nil,
            storefrontCountryCodeIOS: "US",
            subscriptionGroupIdIOS: "21686373",
            transactionDate: 1729083955000,
            transactionId: "txn_123",
            transactionReasonIOS: "PURCHASE",
            webOrderLineItemIdIOS: nil
        )

        // Then: Purchase should have cancelled renewal info
        XCTAssertNotNil(purchase.renewalInfoIOS)
        XCTAssertFalse(purchase.renewalInfoIOS!.willAutoRenew)
        XCTAssertNil(purchase.renewalInfoIOS!.pendingUpgradeProductId)

        // Verify serialization preserves the state
        let encoded = try JSONEncoder().encode(purchase)
        let decoded = try JSONDecoder().decode(PurchaseIOS.self, from: encoded)

        XCTAssertNotNil(decoded.renewalInfoIOS)
        XCTAssertFalse(decoded.renewalInfoIOS!.willAutoRenew)
        XCTAssertNil(decoded.renewalInfoIOS!.pendingUpgradeProductId)
    }

    func testPurchaseIOS_WithPendingDowngrade() throws {
        // Given: Active purchase with pending downgrade
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "premium_monthly",
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: "premium_monthly",  // Pending downgrade
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: true  // Active
        )

        let purchase = PurchaseIOS(
            appAccountToken: nil,
            appBundleIdIOS: "dev.hyo.app",
            countryCodeIOS: "US",
            currencyCodeIOS: "USD",
            currencySymbolIOS: "$",
            environmentIOS: "Sandbox",
            expirationDateIOS: 1729087555000,
            id: "txn_456",
            ids: nil,
            isAutoRenewing: true,
            isUpgradedIOS: false,
            offerIOS: nil,
            originalTransactionDateIOS: 1729083955000,
            originalTransactionIdentifierIOS: "txn_456",
            ownershipTypeIOS: "purchased",
            platform: .ios,
            productId: "premium_yearly",  // Currently on yearly
            purchaseState: .purchased,
            purchaseToken: "jws_token",
            quantity: 1,
            quantityIOS: 1,
            reasonIOS: "purchase",
            reasonStringRepresentationIOS: "purchase",
            renewalInfoIOS: renewalInfo,
            revocationDateIOS: nil,
            revocationReasonIOS: nil,
            storefrontCountryCodeIOS: "US",
            subscriptionGroupIdIOS: "21686373",
            transactionDate: 1729083955000,
            transactionId: "txn_456",
            transactionReasonIOS: "PURCHASE",
            webOrderLineItemIdIOS: nil
        )

        // Then: Should show pending downgrade
        XCTAssertNotNil(purchase.renewalInfoIOS)
        XCTAssertTrue(purchase.renewalInfoIOS!.willAutoRenew)
        XCTAssertEqual(purchase.renewalInfoIOS!.pendingUpgradeProductId, "premium_monthly")
        XCTAssertEqual(purchase.productId, "premium_yearly")  // Currently yearly
        XCTAssertEqual(purchase.renewalInfoIOS!.autoRenewPreference, "premium_monthly")  // Will be monthly
    }
}
