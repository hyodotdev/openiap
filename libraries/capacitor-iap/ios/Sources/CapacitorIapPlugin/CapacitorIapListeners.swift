import Capacitor
import Foundation
import OpenIAP

/// Forwards OpenIAP store events to JavaScript. Purchases and promoted
/// products are retained until a JavaScript listener consumes them, so one
/// delivered before the app subscribes (an unfinished transaction at launch) is
/// not lost; other events go only to current listeners.
final class CapacitorIapListeners {
    private let lock = NSLock()
    private var subscriptions: [OpenIAP.Subscription] = []
    private var purchaseUpdated: OpenIAP.Subscription?
    private var purchaseUpdatedOptions = PurchaseUpdatedListenerOptions()

    static func payload(for error: PurchaseError) -> [String: Any] {
        var payload = OpenIapSerialization.encode(error)
        payload["platform"] = "ios"
        return payload
    }

    func attach(to plugin: CAPPlugin, store: OpenIapModule) {
        lock.lock()
        defer { lock.unlock() }

        attachPurchaseUpdatedLocked(plugin: plugin, store: store)
        subscriptions = [
            store.purchaseErrorListener { [weak plugin] error in
                plugin?.notifyListeners(IapEvent.purchaseError.rawValue, data: Self.payload(for: error))
            },
            store.promotedProductListenerIOS { [weak plugin, store] productId in
                Task {
                    // Send the product when it loads; otherwise its id, and
                    // JavaScript reads it with getPromotedProductIOS.
                    let product = try? await store.getPromotedProductIOS()
                    plugin?.notifyListeners(
                        IapEvent.promotedProductIos.rawValue,
                        data: product.flatMap { try? OpenIapSerialization.encodeRequired($0) }
                            ?? ["productId": productId],
                        retainUntilConsumed: true
                    )
                }
            },
            store.subscriptionBillingIssueListener { [weak plugin] purchase in
                plugin?.notifyListeners(
                    IapEvent.subscriptionBillingIssue.rawValue,
                    data: OpenIapSerialization.purchase(purchase)
                )
            },
        ]
    }

    func setPurchaseUpdatedOptions(
        _ options: PurchaseUpdatedListenerOptions,
        plugin: CAPPlugin,
        store: OpenIapModule
    ) {
        lock.lock()
        defer { lock.unlock() }

        purchaseUpdatedOptions = options
        // Attach the replacement first so no store delivery falls in between.
        let previous = purchaseUpdated
        attachPurchaseUpdatedLocked(plugin: plugin, store: store)
        if let previous { store.removeListener(previous) }
    }

    func detach(from store: OpenIapModule) {
        lock.lock()
        defer { lock.unlock() }

        if let purchaseUpdated {
            store.removeListener(purchaseUpdated)
            self.purchaseUpdated = nil
        }
        subscriptions.forEach(store.removeListener)
        subscriptions.removeAll()
    }

    private func attachPurchaseUpdatedLocked(plugin: CAPPlugin, store: OpenIapModule) {
        purchaseUpdated = store.purchaseUpdatedListener({ [weak plugin] purchase in
            plugin?.notifyListeners(
                IapEvent.purchaseUpdated.rawValue,
                data: OpenIapSerialization.purchase(purchase),
                retainUntilConsumed: true
            )
        }, options: purchaseUpdatedOptions)
    }
}
