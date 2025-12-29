import Foundation
import os.log
import StoreKit

@available(iOS 15.0, macOS 14.0, *)
actor IapState {
    private(set) var isInitialized: Bool = false
    private var pendingTransactions: [String: Transaction] = [:]
    private var promotedProductId: String?

    // Event listeners
    private var purchaseUpdatedListeners: [(id: UUID, listener: PurchaseUpdatedListener)] = []
    private var purchaseErrorListeners: [(id: UUID, listener: PurchaseErrorListener)] = []
    private var promotedProductListeners: [(id: UUID, listener: PromotedProductListener)] = []

    // MARK: - Init flag
    func setInitialized(_ value: Bool) { isInitialized = value }
    func reset() {
        pendingTransactions.removeAll()
        isInitialized = false
        promotedProductId = nil
    }

    // MARK: - Pending Transactions
    func storePending(id: String, transaction: Transaction) { pendingTransactions[id] = transaction }
    func getPending(id: String) -> Transaction? { pendingTransactions[id] }
    func removePending(id: String) { pendingTransactions.removeValue(forKey: id) }
    func pendingSnapshot() -> [Transaction] { Array(pendingTransactions.values) }

    // MARK: - Promoted Products
    func setPromotedProductId(_ id: String?) { promotedProductId = id }
    func promotedProductIdentifier() -> String? { promotedProductId }

    // MARK: - Listeners
    func addPurchaseUpdatedListener(_ pair: (UUID, PurchaseUpdatedListener)) {
        purchaseUpdatedListeners.append((id: pair.0, listener: pair.1))
    }
    func addPurchaseErrorListener(_ pair: (UUID, PurchaseErrorListener)) {
        purchaseErrorListeners.append((id: pair.0, listener: pair.1))
    }
    func addPromotedProductListener(_ pair: (UUID, PromotedProductListener)) {
        promotedProductListeners.append((id: pair.0, listener: pair.1))
    }

    func removeListener(id: UUID, type: IapEvent) {
        switch type {
        case .purchaseUpdated:
            purchaseUpdatedListeners.removeAll { $0.id == id }
        case .purchaseError:
            purchaseErrorListeners.removeAll { $0.id == id }
        case .promotedProductIos:
            promotedProductListeners.removeAll { $0.id == id }
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
}
