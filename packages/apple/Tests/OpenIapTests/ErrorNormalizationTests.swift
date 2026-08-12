import StoreKit
import XCTest
@testable import OpenIAP

/// Normative StoreKit -> OpenIAP ErrorCode normalization.
final class ErrorNormalizationTests: XCTestCase {

    // MARK: - StoreKit 1 (SKError)

    func testPaymentNotAllowedNormalizesToIapNotAvailable() {
        XCTAssertEqual(PurchaseError.errorCode(for: .paymentNotAllowed), .iapNotAvailable)
    }

    func testStoreProductNotAvailableNormalizesToItemUnavailable() {
        XCTAssertEqual(PurchaseError.errorCode(for: .storeProductNotAvailable), .itemUnavailable)
    }

    func testInvalidClientAndPaymentNormalizeToDeveloperError() {
        XCTAssertEqual(PurchaseError.errorCode(for: .clientInvalid), .developerError)
        XCTAssertEqual(PurchaseError.errorCode(for: .paymentInvalid), .developerError)
    }

    func testCloudServiceNetworkFailureNormalizesToNetworkError() {
        XCTAssertEqual(
            PurchaseError.errorCode(for: .cloudServiceNetworkConnectionFailed),
            .networkError
        )
    }

    func testOfferProblemsNormalizeToSkuOfferMismatch() {
        XCTAssertEqual(PurchaseError.errorCode(for: .invalidOfferIdentifier), .skuOfferMismatch)
        XCTAssertEqual(PurchaseError.errorCode(for: .invalidOfferPrice), .skuOfferMismatch)
        XCTAssertEqual(PurchaseError.errorCode(for: .missingOfferParams), .skuOfferMismatch)
    }

    func testSignatureProblemsNormalizeToTransactionValidationFailed() {
        XCTAssertEqual(PurchaseError.errorCode(for: .invalidSignature), .transactionValidationFailed)
        XCTAssertEqual(
            PurchaseError.errorCode(for: .unauthorizedRequestData),
            .transactionValidationFailed
        )
    }

    func testPaymentCancelledNormalizesToUserCancelled() {
        XCTAssertEqual(PurchaseError.errorCode(for: .paymentCancelled), .userCancelled)
    }

    /// These four are Android-only by design; assert no SKError code drifts
    /// into them.
    func testAndroidOnlyCodesAreNeverSynthesizedFromStoreKit() {
        let androidOnly: Set<ErrorCode> = [
            .alreadyOwned,
            .billingUnavailable,
            .serviceDisconnected,
            .serviceTimeout,
        ]

        let allSKErrorCodes = (-1...30).compactMap { SKError.Code(rawValue: $0) }
        for code in allSKErrorCodes {
            guard let mapped = PurchaseError.errorCode(for: code) else { continue }
            XCTAssertFalse(
                androidOnly.contains(mapped),
                "SKError.Code(\(code.rawValue)) must not normalize to Android-only \(mapped)"
            )
        }
    }

    // MARK: - Bridged NSError extraction

    func testBridgedNSErrorInStoreKitDomainIsRecognized() {
        let bridged = NSError(
            domain: SKError.errorDomain,
            code: SKError.Code.paymentNotAllowed.rawValue
        )

        XCTAssertEqual(PurchaseError.skErrorCode(from: bridged), .paymentNotAllowed)
    }

    func testForeignDomainErrorIsNotTreatedAsStoreKit() {
        let foreign = NSError(domain: "com.example.other", code: 2)

        XCTAssertNil(PurchaseError.skErrorCode(from: foreign))
    }

    // MARK: - End-to-end through wrap()

    func testWrapNormalizesPaymentNotAllowedRatherThanFallingBack() {
        let error = NSError(
            domain: SKError.errorDomain,
            code: SKError.Code.paymentNotAllowed.rawValue
        )

        XCTAssertEqual(PurchaseError.wrap(error).code, .iapNotAvailable)
    }

    func testWrapNormalizesPaymentNotAllowedInsideStoreKitSystemError() {
        let error = StoreKitError.systemError(SKError(.paymentNotAllowed))

        XCTAssertEqual(PurchaseError.wrap(error).code, .iapNotAvailable)
    }

    func testWrapStillFallsBackForUnmappedConditions() {
        let unmapped = NSError(domain: "com.example.other", code: 99)

        XCTAssertEqual(PurchaseError.wrap(unmapped, fallback: .purchaseError).code, .purchaseError)
    }

    func testWrapPreservesAnExistingPurchaseError() {
        let original = PurchaseError.make(code: .developerError, productId: "p1")

        XCTAssertEqual(PurchaseError.wrap(original).code, .developerError)
    }
}
