import Foundation
import os.log
import StoreKit

/// Thread-safe state manager for IAP transactions
/// - SeeAlso: https://developer.apple.com/documentation/storekit/transaction
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private struct PurchaseUpdateEmissionHistory {
    private let limit: Int
    private var ids: Set<String> = []
    private var ring: [String?]
    private var nextEvictionIndex = 0

    init(limit: Int) {
        self.limit = max(1, limit)
        self.ring = Array(repeating: nil, count: self.limit)
    }

    mutating func record(_ id: String) -> Bool {
        guard ids.insert(id).inserted else {
            return false
        }

        if let evicted = ring[nextEvictionIndex] {
            ids.remove(evicted)
        }
        ring[nextEvictionIndex] = id
        nextEvictionIndex = (nextEvictionIndex + 1) % limit
        return true
    }

    mutating func removeAll() {
        ids.removeAll()
        ring = Array(repeating: nil, count: limit)
        nextEvictionIndex = 0
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private struct PurchaseUpdatedListenerRegistration {
    let id: UUID
    let listener: PurchaseUpdatedListener
    let dedupeTransactionIOS: Bool
}

/// Listener registration is a synchronous API. Keeping callbacks behind a
/// small lock-backed registry makes a returned `Subscription` active
/// immediately and makes `removeListener` take effect before it returns.
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private final class IapListenerRegistry: @unchecked Sendable {
    private let lock = NSLock()
    private var purchaseUpdatedListeners: [PurchaseUpdatedListenerRegistration] = []
    private var purchaseErrorListeners: [(id: UUID, listener: PurchaseErrorListener)] = []
    private var promotedProductListeners: [(id: UUID, listener: PromotedProductListener)] = []
    private var subscriptionBillingIssueListeners: [(id: UUID, listener: SubscriptionBillingIssueListener)] = []
    private var pendingPromotedProductReplayId: String?

    func addPurchaseUpdatedListener(
        id: UUID,
        listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) {
        withLock {
            purchaseUpdatedListeners.append(PurchaseUpdatedListenerRegistration(
                id: id,
                listener: listener,
                dedupeTransactionIOS: options?.dedupeTransactionIOS ?? true
            ))
        }
    }

    func addPurchaseErrorListener(_ pair: (UUID, PurchaseErrorListener)) {
        withLock { purchaseErrorListeners.append((id: pair.0, listener: pair.1)) }
    }

    func addPromotedProductListener(_ pair: (UUID, PromotedProductListener)) -> String? {
        withLock {
            promotedProductListeners.append((id: pair.0, listener: pair.1))
            defer { pendingPromotedProductReplayId = nil }
            return pendingPromotedProductReplayId
        }
    }

    func addSubscriptionBillingIssueListener(_ pair: (UUID, SubscriptionBillingIssueListener)) {
        withLock { subscriptionBillingIssueListeners.append((id: pair.0, listener: pair.1)) }
    }

    func recordPromotedProductAndSnapshotListeners(_ id: String) -> [PromotedProductListener] {
        withLock {
            let listeners = promotedProductListeners.map { $0.listener }
            pendingPromotedProductReplayId = listeners.isEmpty ? id : nil
            return listeners
        }
    }

    func clearPendingPromotedProduct() {
        withLock { pendingPromotedProductReplayId = nil }
    }

    func removeListener(id: UUID, type: IapEvent) {
        withLock {
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
                os_log(.info, "userChoiceBillingAndroid is not supported on iOS (no-op)")
            case .developerProvidedBillingAndroid:
                os_log(.info, "developerProvidedBillingAndroid is not supported on iOS (no-op)")
            @unknown default:
                break
            }
        }
    }

    func removeAllListeners() {
        withLock {
            purchaseUpdatedListeners.removeAll()
            purchaseErrorListeners.removeAll()
            promotedProductListeners.removeAll()
            subscriptionBillingIssueListeners.removeAll()
        }
    }

    func snapshotPurchaseUpdated(isDuplicate: Bool = false) -> [PurchaseUpdatedListener] {
        withLock {
            purchaseUpdatedListeners.compactMap { registration in
                guard !isDuplicate || !registration.dedupeTransactionIOS else {
                    return nil
                }
                return registration.listener
            }
        }
    }

    func snapshotPurchaseError() -> [PurchaseErrorListener] {
        withLock { purchaseErrorListeners.map { $0.listener } }
    }

    func snapshotSubscriptionBillingIssue() -> [SubscriptionBillingIssueListener] {
        withLock { subscriptionBillingIssueListeners.map { $0.listener } }
    }

    func hasSubscriptionBillingIssueListeners() -> Bool {
        withLock { !subscriptionBillingIssueListeners.isEmpty }
    }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
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
    private let listenerRegistry = IapListenerRegistry()

    // MARK: - Init flag
    func setInitialized(_ value: Bool) { isInitialized = value }
    func reset() {
        pendingTransactions.removeAll()
        purchaseUpdateEmissionHistory.removeAll()
        isInitialized = false
        promotedProductId = nil
        listenerRegistry.clearPendingPromotedProduct()
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
            listenerRegistry.clearPendingPromotedProduct()
        }
    }
    func promotedProductIdentifier() -> String? { promotedProductId }
    func recordPromotedProductAndSnapshotListeners(_ id: String) -> [PromotedProductListener] {
        promotedProductId = id
        return listenerRegistry.recordPromotedProductAndSnapshotListeners(id)
    }

    // MARK: - Listeners
    nonisolated func addPurchaseUpdatedListener(
        id: UUID,
        listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) {
        listenerRegistry.addPurchaseUpdatedListener(id: id, listener: listener, options: options)
    }
    nonisolated func addPurchaseErrorListener(_ pair: (UUID, PurchaseErrorListener)) {
        listenerRegistry.addPurchaseErrorListener(pair)
    }
    nonisolated func addPromotedProductListener(_ pair: (UUID, PromotedProductListener)) -> String? {
        listenerRegistry.addPromotedProductListener(pair)
    }
    nonisolated func addSubscriptionBillingIssueListener(_ pair: (UUID, SubscriptionBillingIssueListener)) {
        listenerRegistry.addSubscriptionBillingIssueListener(pair)
    }

    nonisolated func removeListener(id: UUID, type: IapEvent) {
        listenerRegistry.removeListener(id: id, type: type)
    }

    nonisolated func removeAllListeners() {
        listenerRegistry.removeAllListeners()
    }

    nonisolated func snapshotPurchaseUpdated(isDuplicate: Bool = false) -> [PurchaseUpdatedListener] {
        listenerRegistry.snapshotPurchaseUpdated(isDuplicate: isDuplicate)
    }
    nonisolated func snapshotPurchaseError() -> [PurchaseErrorListener] {
        listenerRegistry.snapshotPurchaseError()
    }
    nonisolated func snapshotSubscriptionBillingIssue() -> [SubscriptionBillingIssueListener] {
        listenerRegistry.snapshotSubscriptionBillingIssue()
    }
    nonisolated func hasSubscriptionBillingIssueListeners() -> Bool {
        listenerRegistry.hasSubscriptionBillingIssueListeners()
    }
}
