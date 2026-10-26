import Foundation
import OpenIAP

/// Carries the canonical PurchaseError payload through Nitro's NSError bridge.
@available(iOS 15.0, *)
class OpenIapException: NSError, @unchecked Sendable {
    static let domain = "com.margelo.nitro.rniap"

    convenience init(_ json: String) {
        self.init(domain: OpenIapException.domain, code: -1, userInfo: [NSLocalizedDescriptionKey: json])
    }

    static func make(
        code: ErrorCode,
        message: String? = nil,
        productId: String? = nil,
        debugMessage: String? = nil
    ) -> OpenIapException {
        from(PurchaseError(
            code: code,
            debugMessage: debugMessage,
            message: message ?? code.rawValue,
            productId: productId
        ))
    }

    static func from(_ error: PurchaseError) -> OpenIapException {
        guard let data = try? JSONEncoder().encode(error) else {
            return OpenIapException(#"{"code":"unknown","message":"Failed to serialize native purchase error"}"#)
        }
        return OpenIapException(String(decoding: data, as: UTF8.self))
    }
}
