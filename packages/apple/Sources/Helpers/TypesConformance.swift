import Foundation

extension PurchaseError: LocalizedError, CustomNSError {
    public static var errorDomain: String { "OpenIAP" }

    public var errorCode: Int { 0 }

    public var errorDescription: String? { message }

    public var errorUserInfo: [String: Any] {
        var info: [String: Any] = [
            "code": code.rawValue,
            "message": message,
            NSLocalizedDescriptionKey: message,
        ]
        if let productId {
            info["productId"] = productId
        }
        if let debugMessage {
            info["debugMessage"] = debugMessage
        }
        return info
    }
}
