import Foundation
import StoreKit

/// Thread-safe product manager backed by Swift actor
/// - SeeAlso: https://developer.apple.com/documentation/storekit/product
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
actor ProductManager {
    private var products: [String: StoreKit.Product] = [:]
    
    func addProduct(_ product: StoreKit.Product) {
        products[product.id] = product
    }
    
    func getProduct(productID: String) -> StoreKit.Product? {
        return products[productID]
    }
    
    func getAllProducts() -> [StoreKit.Product] {
        return Array(products.values)
    }
    
    func removeAll() {
        products.removeAll()
    }
    
    func remove(productID: String) {
        products.removeValue(forKey: productID)
    }
}
