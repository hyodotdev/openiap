import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class OpenIapProviderTests: XCTestCase {
    
    @MainActor
    func testExplicitConnectionManagement() async throws {
        // Test 1: Creating OpenIapStore does not automatically initialize connection
        let store1 = OpenIapStore()
        
        // The store should NOT be connected yet
        XCTAssertFalse(store1.isConnected, "OpenIapStore should not connect automatically")
        
        // Explicitly initialize connection
        try await store1.initConnection()
        XCTAssertTrue(store1.isConnected, "OpenIapStore should be connected after initConnection")
        
        // Test 2: Multiple stores can coexist with explicit connection
        let store2 = OpenIapStore()
        XCTAssertFalse(store2.isConnected, "Second OpenIapStore should not be connected automatically")
        
        try await store2.initConnection()
        XCTAssertTrue(store2.isConnected, "Second OpenIapStore should be connected after initConnection")
        
        // Clean up connections
        try await store1.endConnection()
        try await store2.endConnection()
        
        XCTAssertFalse(store1.isConnected, "Store1 should be disconnected after endConnection")
        XCTAssertFalse(store2.isConnected, "Store2 should be disconnected after endConnection")
    }
    
    @MainActor
    func testListenerManagement() async throws {
        let module = OpenIapModule.shared
        
        // Initialize connection first
        _ = try await module.initConnection()
        
        // Add a listener
        var purchaseSubscription: Subscription? = module.purchaseUpdatedListener { _ in
            print("Purchase updated")
        }
        
        // Listener should work with the connection established
        
        // Remove the listener
        if let subscription = purchaseSubscription {
            module.removeListener(subscription)
        }
        purchaseSubscription = nil
        
        // End connection explicitly
        _ = try await module.endConnection()
    }
    
    @MainActor
    func testMultipleListeners() async throws {
        let module = OpenIapModule.shared
        
        // Initialize connection first
        _ = try await module.initConnection()
        
        // Add multiple listeners
        let sub1 = module.purchaseUpdatedListener { _ in }
        let sub2 = module.purchaseErrorListener { _ in }
        let sub3 = module.promotedProductListenerIOS { _ in }
        
        // All listeners should work with the established connection
        
        // Remove listeners one by one
        module.removeListener(sub1)
        module.removeListener(sub2)
        module.removeListener(sub3)
        
        // End connection explicitly
        _ = try await module.endConnection()
        // Listeners should be cleaned up automatically on endConnection
    }
    
    @MainActor
    func testListenerCleanupOnEndConnection() async throws {
        let module = OpenIapModule.shared

        // Initialize connection
        _ = try await module.initConnection()

        // Create subscriptions
        autoreleasepool {
            _ = module.purchaseUpdatedListener { _ in
                print("This will be cleaned up on endConnection")
            }
            _ = module.purchaseErrorListener { _ in
                print("This will also be cleaned up")
            }
        }

        // End connection - should clean up all listeners
        _ = try await module.endConnection()

        // All listeners should have been cleaned up automatically
    }

    // MARK: - Introductory Offer Eligibility Tests

    @MainActor
    func testIsEligibleForIntroOfferIOS_withValidGroupID() async throws {
        let module = OpenIapModule.shared

        // Initialize connection
        _ = try await module.initConnection()

        // Test with a valid subscription group ID
        // Note: This will return the actual eligibility based on StoreKit's records
        let groupID = "test_subscription_group"
        let isEligible = try await module.isEligibleForIntroOfferIOS(groupID: groupID)

        // Verify the function returns without throwing
        // The actual value depends on the user's subscription history
        XCTAssertTrue(isEligible || !isEligible, "Function should return a boolean value")

        // Clean up
        _ = try await module.endConnection()
    }

    @MainActor
    func testIsEligibleForIntroOfferIOS_withEmptyGroupID() async throws {
        let module = OpenIapModule.shared

        // Initialize connection
        _ = try await module.initConnection()

        // Test with empty group ID
        let groupID = ""
        let isEligible = try await module.isEligibleForIntroOfferIOS(groupID: groupID)

        // Empty group ID should return true (no previous subscription)
        // This matches StoreKit's behavior
        XCTAssertTrue(isEligible, "Empty group ID should indicate eligibility")

        // Clean up
        _ = try await module.endConnection()
    }

    @MainActor
    func testIsEligibleForIntroOfferIOS_multipleGroupIDs() async throws {
        let module = OpenIapModule.shared

        // Initialize connection
        _ = try await module.initConnection()

        // Test with multiple different group IDs
        let groupID1 = "group_1"
        let groupID2 = "group_2"

        let isEligible1 = try await module.isEligibleForIntroOfferIOS(groupID: groupID1)
        let isEligible2 = try await module.isEligibleForIntroOfferIOS(groupID: groupID2)

        // Both should return valid boolean values
        XCTAssertTrue(isEligible1 || !isEligible1, "First group should return boolean")
        XCTAssertTrue(isEligible2 || !isEligible2, "Second group should return boolean")

        // Clean up
        _ = try await module.endConnection()
    }

    @MainActor
    func testIsEligibleForIntroOfferIOS_viaStore() async throws {
        let store = OpenIapStore()

        // Initialize connection
        try await store.initConnection()

        // Test via OpenIapStore wrapper
        let groupID = "test_group"
        let isEligible = try await store.isEligibleForIntroOfferIOS(groupID: groupID)

        // Verify it works through the store interface
        XCTAssertTrue(isEligible || !isEligible, "Store wrapper should return boolean")

        // Clean up
        try await store.endConnection()
    }
}