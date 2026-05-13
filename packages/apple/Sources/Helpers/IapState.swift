import Foundation
import os.log
import StoreKit

/// Thread-safe state manager for IAP transactions
/// - SeeAlso: https://developer.apple.com/documentation/storekit/transaction
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private struct PurchaseUpdateEmissionHistory {
    private let limit: Int
    private var ids: Set<String> = []
    private var order: [String] = []

    init(limit: Int) {
        self.limit = limit
    }

    mutating func record(_ id: String) -> Bool {
        guard ids.insert(id).inserted else {
            return false
        }

        order.append(id)
        if order.count > limit {
            ids.remove(order.removeFirst())
        }
        return true
    }

    mutating func removeAll() {
        ids.removeAll()
        order.removeAll()
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private struct PurchaseUpdatedListenerRegistration {
    let id: UUID
    let listener: PurchaseUpdatedListener
    let includeDuplicateTransactionUpdatesIOS: Bool
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
actor IapState {
    private static let purchaseUpdateEmissionHistoryLimit = 512

    private(set) var isInitialized: Bool = false
    private var pendingTransactions: [String: Transaction] = [:]
    private var purchaseUpdateEmissionHistory = PurchaseUpdateEmissionHistory(
        limit: purchaseUpdateEmissionHistoryLimit
    )
    private var promotedProductId: String?
    private var pendingPromotedProductReplayId: String?

    // Event listeners
    private var purchaseUpdatedListeners: [PurchaseUpdatedListenerRegistration] = []
    private var purchaseErrorListeners: [(id: UUID, listener: PurchaseErrorListener)] = []
    private var promotedProductListeners: [(id: UUID, listener: PromotedProductListener)] = []
    private var subscriptionBillingIssueListeners: [(id: UUID, listener: SubscriptionBillingIssueListener)] = []

    // MARK: - Init flag
    func setInitialized(_ value: Bool) { isInitialized = value }
    func reset() {
        pendingTransactions.removeAll()
        purchaseUpdateEmissionHistory.removeAll()
        isInitialized = false
        promotedProductId = nil
        pendingPromotedProductReplayId = nil
    }

    // MARK: - Pending Transactions
    func storePending(id: String, transaction: Transaction) { pendingTransactions[id] = transaction }
    func getPending(id: String) -> Transaction? { pendingTransactions[id] }
    func removePending(id: String) { pendingTransactions.removeValue(forKey: id) }
    func pendingSnapshot() -> [Transaction] { Array(pendingTransactions.values) }

    // MARK: - Purchase Update Emissions
    func recordPurchaseUpdateEmission(
        id: String,
        pendingTransaction: Transaction? = nil
    ) -> Bool {
        let shouldEmit = purchaseUpdateEmissionHistory.record(id)
        if shouldEmit, let pendingTransaction {
            pendingTransactions[id] = pendingTransaction
        }
        return shouldEmit
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
    func addPurchaseUpdatedListener(
        id: UUID,
        listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) {
        purchaseUpdatedListeners.append(PurchaseUpdatedListenerRegistration(
            id: id,
            listener: listener,
            includeDuplicateTransactionUpdatesIOS: options?.includeDuplicateTransactionUpdatesIOS == true
        ))
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

    func snapshotPurchaseUpdated(isDuplicate: Bool = false) -> [PurchaseUpdatedListener] {
        purchaseUpdatedListeners.compactMap { registration in
            guard !isDuplicate || registration.includeDuplicateTransactionUpdatesIOS else {
                return nil
            }
            return registration.listener
        }
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
