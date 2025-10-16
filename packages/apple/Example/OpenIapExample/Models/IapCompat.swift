import OpenIAP

// Maintain previous sample code naming expectations while using generated models
@available(iOS 15.0, *)
typealias OpenIapProduct = ProductIOS
@available(iOS 15.0, *)
typealias OpenIapPurchase = PurchaseIOS
@available(iOS 15.0, *)
typealias OpenIapError = PurchaseError
@available(iOS 15.0, *)
typealias OpenIapActiveSubscription = ActiveSubscription

@available(iOS 15.0, *)
extension PurchaseState {
    var isAcknowledged: Bool {
        switch self {
        case .purchased, .restored:
            return true
        default:
            return false
        }
    }
}

@available(iOS 15.0, *)
extension PurchaseIOS {
    var isSubscription: Bool {
        if expirationDateIOS != nil { return true }
        if isAutoRenewing { return true }
        // Newly purchased subscriptions can report neither expiration nor auto-renew yet,
        // but StoreKit always adds the subscription group identifier for them.
        if let groupId = subscriptionGroupIdIOS, groupId.isEmpty == false { return true }
        return false
    }
}

@available(iOS 15.0, *)
extension ProductIOS {
    var productIdentifier: String { id }
}

@available(iOS 15.0, *)
extension OpenIAP.Product {
    func asIOS() -> OpenIapProduct? {
        if case let .productIos(value) = self {
            return value
        }
        return nil
    }
}

@available(iOS 15.0, *)
extension OpenIAP.Purchase {
    func asIOS() -> OpenIapPurchase? {
        if case let .purchaseIos(value) = self {
            return value
        }
        return nil
    }
}
