import Foundation

extension PurchaseError: LocalizedError {
    public var errorDescription: String? { message }
}
