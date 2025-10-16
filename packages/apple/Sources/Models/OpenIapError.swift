import Foundation

public extension PurchaseError {
    // MARK: - Default Messages

    static func defaultMessage(for code: ErrorCode) -> String {
        switch code {
        case .unknown: return "Unknown error occurred"
        case .userCancelled: return "User cancelled the purchase flow"
        case .userError: return "User action error"
        case .itemUnavailable: return "Item unavailable"
        case .remoteError: return "Remote service error"
        case .networkError: return "Network connection error"
        case .serviceError: return "Store service error"
        case .receiptFailed: return "Receipt validation failed"
        case .receiptFinished: return "Receipt already finished"
        case .receiptFinishedFailed: return "Receipt finish failed"
        case .notPrepared: return "Billing is not prepared"
        case .notEnded: return "Billing connection not ended"
        case .alreadyOwned: return "Item already owned"
        case .developerError: return "Developer configuration error"
        case .billingResponseJsonParseError: return "Failed to parse billing response"
        case .deferredPayment: return "Payment was deferred (pending approval)"
        case .interrupted: return "Purchase flow interrupted"
        case .iapNotAvailable: return "In-app purchases not available on this device"
        case .purchaseError: return "Purchase error"
        case .syncError: return "Sync error"
        case .transactionValidationFailed: return "Transaction validation failed"
        case .activityUnavailable: return "Required activity is unavailable"
        case .alreadyPrepared: return "Billing already prepared"
        case .pending: return "Transaction pending"
        case .connectionClosed: return "Connection closed"
        case .initConnection: return "Failed to initialize billing connection"
        case .serviceDisconnected: return "Billing service disconnected"
        case .queryProduct: return "Failed to query product"
        case .skuNotFound: return "SKU not found"
        case .skuOfferMismatch: return "SKU offer mismatch"
        case .itemNotOwned: return "Item not owned"
        case .billingUnavailable: return "Billing unavailable"
        case .featureNotSupported: return "Feature not supported on this platform"
        case .emptySkuList: return "Empty SKU list provided"
        }
    }

    static func defaultMessage(for rawCode: String) -> String {
        if let parsed = ErrorCode(rawValue: rawCode) {
            return defaultMessage(for: parsed)
        }
        return "Unknown error occurred"
    }

    static func make(
        code: ErrorCode,
        productId: String? = nil,
        message: String? = nil
    ) -> PurchaseError {
        PurchaseError(
            code: code,
            message: message ?? defaultMessage(for: code),
            productId: productId
        )
    }

    // MARK: - Convenience Constructors

    static func make(
        code: String,
        productId: String? = nil,
        message: String? = nil
    ) -> PurchaseError {
        let resolved = ErrorCode(rawValue: code) ?? .unknown
        return make(code: resolved, productId: productId, message: message)
    }

    static func emptySkuList(message: String? = nil) -> PurchaseError {
        make(code: .emptySkuList, message: message)
    }

    static func purchaseError(message: String? = nil, productId: String? = nil) -> PurchaseError {
        make(code: .purchaseError, productId: productId, message: message)
    }

    /// Returns the canonical set of error codes mapped to their default messages.
    static func errorCodeTable() -> [String: String] {
        ErrorCode.allCases.reduce(into: [String: String]()) { result, code in
            result[code.rawValue] = defaultMessage(for: code)
        }
    }

    /// Wraps any error into a `PurchaseError`, preserving existing instances.
    static func wrap(
        _ error: Error,
        fallback: ErrorCode = .purchaseError,
        productId: String? = nil
    ) -> PurchaseError {
        if let purchaseError = error as? PurchaseError {
            return purchaseError
        }
        return make(code: fallback, productId: productId, message: error.localizedDescription)
    }
}
