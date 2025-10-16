import Foundation
import StoreKit

/// Thread-safe product manager backed by Swift actor
@available(iOS 15.0, macOS 12.0, *)
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
