import Foundation
import OpenIAP

// HybridRnIap's listener lock owns access; queued callbacks retain their own delivery.
@available(iOS 15.0, *)
final class RequestPurchaseErrorObservation {
    final class Delivery {
        let productId: String?
        fileprivate let payload: Data?
        fileprivate(set) var isSuppressed = false

        fileprivate init(_ error: PurchaseError) {
            productId = error.productId
            payload = RequestPurchaseErrorObservation.encode(error)
        }
    }

    private let productId: String?
    private var deliveries: [Delivery] = []

    init(productId: String?) {
        self.productId = productId
    }

    var hasEnqueuedError: Bool {
        deliveries.contains { $0.productId == productId }
    }

    func record(_ error: PurchaseError) -> Delivery {
        let delivery = Delivery(error)
        deliveries.append(delivery)
        return delivery
    }

    func suppressQueuedDuplicate(of error: PurchaseError) {
        guard let payload = Self.encode(error) else { return }
        deliveries.first { !$0.isSuppressed && $0.payload == payload }?.isSuppressed = true
    }

    private static func encode(_ error: PurchaseError) -> Data? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return try? encoder.encode(error)
    }
}
