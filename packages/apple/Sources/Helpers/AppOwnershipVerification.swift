import Foundation
import StoreKit

func appOwnershipResultIOS(_ transaction: AppTransaction, jws: String, revocationChecked: Bool) -> AppOwnershipVerificationResult {
    AppOwnershipVerificationResult(
        appTransactionIOS: transaction,
        reason: revocationChecked ? nil : .backendVerificationRequired,
        signedAppTransactionIOS: jws,
        status: revocationChecked ? (transaction.revocationDate == nil ? .licensed : .unlicensed) : .unknown,
        storeId: StoreIds.Apple
    )
}

func appOwnershipFailureReasonIOS(_ error: Error) -> AppOwnershipVerificationReason {
    if error is URLError { return .networkError }
    if case StoreKitError.networkError = error { return .networkError }
    return .serviceError
}
