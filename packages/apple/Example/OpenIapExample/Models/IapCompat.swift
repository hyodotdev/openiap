import Foundation
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
        case .purchased:
            return true
        default:
            return false
        }
    }
}

@available(iOS 15.0, *)
extension PurchaseIOS {
    func matchesVerifiedPendingTransaction(in purchases: [PurchaseIOS]) -> Bool {
        guard store == .apple, storeId == "apple", !id.isEmpty else { return false }
        return purchases.contains {
            $0.store == .apple && $0.storeId == "apple" && $0.id == id && $0.productId == productId &&
            (environmentIOS == nil || $0.environmentIOS == environmentIOS) &&
            $0.revocationDateIOS == nil && $0.isUpgradedIOS != true &&
            ($0.expirationDateIOS ?? .infinity) > Date().timeIntervalSince1970 * 1000
        }
    }

    func acceptsIapkitVerification(_ result: RequestVerifyPurchaseWithIapkitResult?, isConsumable: Bool) -> Bool {
        guard let result, result.isValid, result.store == .apple, result.storeId == storeId,
              result.productId == productId,
              result.state == (isConsumable ? .readyToConsume : .entitled) else { return false }
        if let expected = environmentIOS { return result.environment == expected }
        return true
    }

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
