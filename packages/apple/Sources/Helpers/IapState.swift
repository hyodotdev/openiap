import Foundation
import os.log
import StoreKit

/// Thread-safe state manager for IAP transactions
/// - SeeAlso: https://developer.apple.com/documentation/storekit/transaction
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
actor IapState {
    private(set) var isInitialized: Bool = false
    private var pendingTransactions: [String: Transaction] = [:]
    private var emittedPurchaseUpdateIds: Set<String> = []
    private var emittedPurchaseUpdateOrder: [String] = []
    private var promotedProductId: String?
    private var pendingPromotedProductReplayId: String?
    private let purchaseUpdateEmissionLimit = 512

    // Event listeners
    private var purchaseUpdatedListeners: [(id: UUID, listener: PurchaseUpdatedListener)] = []
    private var purchaseErrorListeners: [(id: UUID, listener: PurchaseErrorListener)] = []
    private var promotedProductListeners: [(id: UUID, listener: PromotedProductListener)] = []
    private var subscriptionBillingIssueListeners: [(id: UUID, listener: SubscriptionBillingIssueListener)] = []

    // MARK: - Init flag
    func setInitialized(_ value: Bool) { isInitialized = value }
    func reset() {
        pendingTransactions.removeAll()
        emittedPurchaseUpdateIds.removeAll()
        emittedPurchaseUpdateOrder.removeAll()
        isInitialized = false
        promotedProductId = nil
        pendingPromotedProductReplayId = nil
    }

    // MARK: - Pending Transactions
    func storePending(id: String, transaction: Transaction) { pendingTransactions[id] = transaction }
    func getPending(id: String) -> Transaction? { pendingTransactions[id] }
    func removePending(id: String) { pendingTransactions.removeValue(forKey: id) }
    func pendingSnapshot() -> [Transaction] { Array(pendingTransactions.values) }
    func storePendingAndRecordPurchaseUpdateEmission(id: String, transaction: Transaction) -> Bool {
        pendingTransactions[id] = transaction
        return recordPurchaseUpdateEmission(id: id)
    }

    // MARK: - Purchase Update Emissions
    func recordPurchaseUpdateEmission(id: String) -> Bool {
        guard !emittedPurchaseUpdateIds.contains(id) else {
            return false
        }

        emittedPurchaseUpdateIds.insert(id)
        emittedPurchaseUpdateOrder.append(id)
        if emittedPurchaseUpdateOrder.count > purchaseUpdateEmissionLimit {
            let removed = emittedPurchaseUpdateOrder.removeFirst()
            emittedPurchaseUpdateIds.remove(removed)
        }
        return true
    }

    // MARK: - Promoted Products
    func setPromotedProductId(_ id: String?) {
        promotedProductId = id
        if id == nil {
            pendingPromotedProductReplayId = nil
        }
    }
    func promotedProductIdentifier() -> String? { promotedProductId }
    func recordPromotedProductAndSnapshotListeners(_ id: String) -> [PromotedProductListener] {
        promotedProductId = id
        let listeners = promotedProductListeners.map { $0.listener }
        pendingPromotedProductReplayId = listeners.isEmpty ? id : nil
        return listeners
    }

    // MARK: - Listeners
    func addPurchaseUpdatedListener(_ pair: (UUID, PurchaseUpdatedListener)) {
        purchaseUpdatedListeners.append((id: pair.0, listener: pair.1))
    }
    func addPurchaseErrorListener(_ pair: (UUID, PurchaseErrorListener)) {
        purchaseErrorListeners.append((id: pair.0, listener: pair.1))
    }
    func addPromotedProductListener(_ pair: (UUID, PromotedProductListener)) -> String? {
        promotedProductListeners.append((id: pair.0, listener: pair.1))
        let pendingProductId = pendingPromotedProductReplayId
        pendingPromotedProductReplayId = nil
        return pendingProductId
    }
    func addSubscriptionBillingIssueListener(_ pair: (UUID, SubscriptionBillingIssueListener)) {
        subscriptionBillingIssueListeners.append((id: pair.0, listener: pair.1))
    }

    func removeListener(id: UUID, type: IapEvent) {
        switch type {
        case .purchaseUpdated:
            purchaseUpdatedListeners.removeAll { $0.id == id }
        case .purchaseError:
            purchaseErrorListeners.removeAll { $0.id == id }
        case .promotedProductIos:
            promotedProductListeners.removeAll { $0.id == id }
        case .subscriptionBillingIssue:
            subscriptionBillingIssueListeners.removeAll { $0.id == id }
        case .userChoiceBillingAndroid:
            // No-op: User Choice Billing is an Android-only feature
            os_log(.info, "userChoiceBillingAndroid is not supported on iOS (no-op)")
        case .developerProvidedBillingAndroid:
            // No-op: Developer Provided Billing is an Android-only feature (Google Play 8.3.0+)
            os_log(.info, "developerProvidedBillingAndroid is not supported on iOS (no-op)")
        @unknown default:
            break
        }
    }

    func removeAllListeners() {
        purchaseUpdatedListeners.removeAll()
        purchaseErrorListeners.removeAll()
        promotedProductListeners.removeAll()
        subscriptionBillingIssueListeners.removeAll()
    }

    func snapshotPurchaseUpdated() -> [PurchaseUpdatedListener] {
        purchaseUpdatedListeners.map { $0.listener }
    }
    func snapshotPurchaseError() -> [PurchaseErrorListener] {
        purchaseErrorListeners.map { $0.listener }
    }
    func snapshotPromoted() -> [PromotedProductListener] {
        promotedProductListeners.map { $0.listener }
    }
    func snapshotSubscriptionBillingIssue() -> [SubscriptionBillingIssueListener] {
        subscriptionBillingIssueListeners.map { $0.listener }
    }
    func hasSubscriptionBillingIssueListeners() -> Bool {
        !subscriptionBillingIssueListeners.isEmpty
    }
}
