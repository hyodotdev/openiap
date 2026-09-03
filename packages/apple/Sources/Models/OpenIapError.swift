import Foundation
import StoreKit

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
        case .purchaseVerificationFailed: return "Purchase verification failed"
        case .purchaseVerificationFinished: return "Transaction already finished"
        case .purchaseVerificationFinishFailed: return "Transaction finish failed"
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
        case .serviceTimeout: return "Billing service request timed out"
        case .queryProduct: return "Failed to query product"
        case .skuNotFound: return "SKU not found"
        case .skuOfferMismatch: return "SKU offer mismatch"
        case .itemNotOwned: return "Item not owned"
        case .billingUnavailable: return "Billing unavailable"
        case .featureNotSupported: return "Feature not supported on this platform"
        case .emptySkuList: return "Empty SKU list provided"
        case .duplicatePurchase: return "Duplicate purchase update detected"
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
        make(
            code: code,
            productId: productId,
            message: message,
            debugMessage: nil
        )
    }

    static func make(
        code: ErrorCode,
        productId: String? = nil,
        message: String? = nil,
        debugMessage: String?
    ) -> PurchaseError {
        PurchaseError(
            code: code,
            debugMessage: debugMessage,
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
        make(
            code: code,
            productId: productId,
            message: message,
            debugMessage: nil
        )
    }

    static func make(
        code: String,
        productId: String? = nil,
        message: String? = nil,
        debugMessage: String?
    ) -> PurchaseError {
        let resolved = ErrorCode(rawValue: code) ?? .unknown
        return make(
            code: resolved,
            productId: productId,
            message: message,
            debugMessage: debugMessage
        )
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
    /// Automatically maps StoreKit errors to appropriate PurchaseError codes.
    static func wrap(
        _ error: Error,
        fallback: ErrorCode = .purchaseError,
        productId: String? = nil
    ) -> PurchaseError {
        func isStoreKitCancellation(_ error: Error) -> Bool {
            if let storeKitError = error as? StoreKitError {
                switch storeKitError {
                case .userCancelled:
                    return true
                case .systemError(let underlyingError):
                    return isStoreKitCancellation(underlyingError)
                default:
                    return false
                }
            }

            if let skError = error as? SKError {
                return skError.code == .paymentCancelled
            }

            let nsError = error as NSError
            return nsError.domain == SKError.errorDomain &&
                nsError.code == SKError.Code.paymentCancelled.rawValue
        }

        // If already a PurchaseError, return as-is
        if let purchaseError = error as? PurchaseError {
            return purchaseError
        }

        if isStoreKitCancellation(error) {
            return make(
                code: .userCancelled,
                productId: productId,
                message: error.localizedDescription,
                debugMessage: error.localizedDescription
            )
        }

        // Map StoreKit 2 errors to PurchaseError
        if let storeKitError = error as? StoreKitError {
            let mappedCode: ErrorCode
            switch storeKitError {
            case .userCancelled:
                mappedCode = .userCancelled
            case .networkError:
                mappedCode = .networkError
            case .notAvailableInStorefront:
                mappedCode = .itemUnavailable
            case .notEntitled:
                mappedCode = .itemNotOwned
            case .systemError(let underlyingError):
                if let skErrorCode = skErrorCode(from: underlyingError) {
                    mappedCode = errorCode(for: skErrorCode) ?? .serviceError
                } else {
                    mappedCode = .serviceError
                }
            case .unknown:
                mappedCode = .unknown
            case .unsupported:
                mappedCode = .featureNotSupported
            @unknown default:
                mappedCode = fallback
            }
            return make(
                code: mappedCode,
                productId: productId,
                message: error.localizedDescription,
                debugMessage: error.localizedDescription
            )
        }

        // StoreKit 1 conditions reach `wrap` through promoted purchases,
        // offer-code redemption, and the legacy payment queue.
        if let skErrorCode = skErrorCode(from: error) {
            return make(
                code: errorCode(for: skErrorCode) ?? fallback,
                productId: productId,
                message: error.localizedDescription,
                debugMessage: error.localizedDescription
            )
        }

        // Fallback for other error types
        return make(
            code: fallback,
            productId: productId,
            message: error.localizedDescription,
            debugMessage: error.localizedDescription
        )
    }

    /// Accepts a typed `SKError` or a bridged `NSError` in the StoreKit domain.
    static func skErrorCode(from error: Error) -> SKError.Code? {
        if let skError = error as? SKError {
            return skError.code
        }
        let nsError = error as NSError
        guard nsError.domain == SKError.errorDomain else { return nil }
        return SKError.Code(rawValue: nsError.code)
    }

    /// Normative StoreKit 1 error mapping. Returns `nil` when no OpenIAP code
    /// faithfully represents the condition, so the caller's `fallback` applies
    /// rather than a fabricated mapping.
    ///
    /// `.alreadyOwned`, `.billingUnavailable`, `.serviceDisconnected`, and
    /// `.serviceTimeout` are deliberately unreachable here — StoreKit has no
    /// equivalent condition. See `specs/client/src/capability-matrix.mjs`.
    static func errorCode(for code: SKError.Code) -> ErrorCode? {
        switch code {
        case .paymentCancelled:
            return .userCancelled
        case .paymentNotAllowed:
            // Parental controls or MDM restriction, not a transient failure.
            return .iapNotAvailable
        case .storeProductNotAvailable:
            return .itemUnavailable
        case .clientInvalid, .paymentInvalid:
            return .developerError
        case .cloudServiceNetworkConnectionFailed:
            return .networkError
        case .cloudServicePermissionDenied, .cloudServiceRevoked, .privacyAcknowledgementRequired:
            return .serviceError
        case .invalidOfferIdentifier, .invalidOfferPrice, .missingOfferParams:
            return .skuOfferMismatch
        case .invalidSignature, .unauthorizedRequestData:
            return .transactionValidationFailed
        case .unknown:
            return .unknown
        default:
            return nil
        }
    }
}
