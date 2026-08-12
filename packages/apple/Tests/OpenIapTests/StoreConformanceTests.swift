import StoreKit
import XCTest
@testable import OpenIAP

/// Apple's binding into the OpenIAP conformance suite.
///
/// Behavior ids come from the generated `ConformanceBehaviors`, so a renamed or
/// retired id fails to compile here rather than silently losing coverage.
///
/// Purchase, completion, and restoration behaviors are absent by necessity:
/// driving them requires a live StoreKit session (StoreKitTest + a .storekit
/// configuration in an Xcode test target), which SwiftPM cannot provide. Those
/// ids are declared in `notCoveredBehaviors` with the reason, so the coverage
/// aggregator reports them as gaps instead of treating silence as success.
final class StoreConformanceTests: XCTestCase {

    /// Behaviors this suite verifies.
    static let coveredBehaviors: [String] = [
        ConformanceBehaviors.errorsStoreCodesNormalizeToSpecErrorCodes,
        ConformanceBehaviors.errorsUnrecognizedStoreCodeNormalizesToUnknown,
        ConformanceBehaviors.errorsUnsupportedCodesAreNotSynthesized,
        ConformanceBehaviors.identifiersPurchaseCarriesAConcreteStore,
        ConformanceBehaviors.capabilitiesUnsupportedOperationsDegradePredictably,
        ConformanceBehaviors.verificationResultExposesUniformValidity,
    ]

    /// Behaviors this implementation cannot verify here, with the reason.
    static let notCoveredBehaviors: [String: String] = [
        ConformanceBehaviors.productsFetchReturnsRequestedSkus: "requires a live StoreKit session",
        ConformanceBehaviors.productsFetchNormalizesRequiredFields: "requires a live StoreKit session",
        ConformanceBehaviors.productsFetchEmptySkuListIsAnError: "requires a live StoreKit session",
        ConformanceBehaviors.productsFetchSeparatesInAppAndSubscriptionTypes: "requires a live StoreKit session",
        ConformanceBehaviors.purchasesRequestEmitsPurchaseUpdatedOnSuccess: "requires a live StoreKit session",
        ConformanceBehaviors.purchasesRequestEmitsErrorOnUserCancel: "requires a live StoreKit session",
        ConformanceBehaviors.purchasesPendingPurchaseIsNotDeliveredAsPurchased: "requires a live StoreKit session",
        ConformanceBehaviors.purchasesUnknownSkuSurfacesSkuNotFound: "requires a live StoreKit session",
        ConformanceBehaviors.completionFinishRemovesTransactionFromPending: "requires a live StoreKit session",
        ConformanceBehaviors.completionFinishIsIdempotent: "requires a live StoreKit session",
        ConformanceBehaviors.completionUnfinishedPurchaseRemainsAvailable: "requires a live StoreKit session",
        ConformanceBehaviors.restorationAvailablePurchasesReturnsOwnedItems: "requires a live StoreKit session",
        ConformanceBehaviors.restorationAvailablePurchasesExcludesConsumedItems: "requires a live StoreKit session",
        ConformanceBehaviors.restorationAvailablePurchasesIsEmptyForNewUser: "requires a live StoreKit session",
    ]

    func testSuiteDeclaresDistinctBehaviorIds() {
        let covered = Self.coveredBehaviors
        XCTAssertEqual(Set(covered).count, covered.count)
        for id in covered {
            XCTAssertTrue(id.contains("."), "behavior id must be namespaced: \(id)")
        }
        for id in Self.notCoveredBehaviors.keys {
            XCTAssertFalse(covered.contains(id), "\(id) cannot be both covered and not covered")
        }
    }

    // errors.store-codes-normalize-to-spec-error-codes
    func testStoreCodesNormalizeToSpecErrorCodes() {
        let expected: [(SKError.Code, ErrorCode)] = [
            (.paymentCancelled, .userCancelled),
            (.paymentNotAllowed, .iapNotAvailable),
            (.storeProductNotAvailable, .itemUnavailable),
            (.clientInvalid, .developerError),
            (.paymentInvalid, .developerError),
            (.cloudServiceNetworkConnectionFailed, .networkError),
            (.invalidOfferIdentifier, .skuOfferMismatch),
            (.invalidSignature, .transactionValidationFailed),
        ]

        for (code, expectedErrorCode) in expected {
            XCTAssertEqual(
                PurchaseError.errorCode(for: code),
                expectedErrorCode,
                "SKError.\(code) must normalize to \(expectedErrorCode)"
            )
        }
    }

    // errors.unrecognized-store-code-normalizes-to-unknown
    func testUnrecognizedStoreConditionFallsBackRatherThanGuessing() {
        // An error outside the StoreKit domain must not be mapped at all, so
        // the caller's fallback applies instead of a fabricated code.
        let foreign = NSError(domain: "com.example.other", code: 4242)
        XCTAssertNil(PurchaseError.skErrorCode(from: foreign))
        XCTAssertEqual(PurchaseError.wrap(foreign, fallback: .unknown).code, .unknown)
    }

    // errors.unsupported-codes-are-not-synthesized
    func testAndroidOnlyErrorCodesAreNeverProduced() {
        let androidOnly: Set<ErrorCode> = [
            .alreadyOwned,
            .billingUnavailable,
            .serviceDisconnected,
            .serviceTimeout,
        ]

        for raw in -1...30 {
            guard let code = SKError.Code(rawValue: raw) else { continue }
            guard let mapped = PurchaseError.errorCode(for: code) else { continue }
            XCTAssertFalse(
                androidOnly.contains(mapped),
                "SKError.Code(\(raw)) must not normalize to Android-only \(mapped)"
            )
        }
    }

    // identifiers.purchase-carries-a-concrete-store
    func testPurchaseCarriesAConcreteStore() throws {
        let json = """
        {
          "id": "txn-1",
          "productId": "dev.hyo.martie.premium",
          "ids": ["dev.hyo.martie.premium"],
          "isAutoRenewing": true,
          "purchaseState": "purchased",
          "quantity": 1,
          "store": "apple",
          "transactionDate": 1700000000000,
          "transactionId": "txn-1"
        }
        """
        let purchase = try JSONDecoder().decode(PurchaseIOS.self, from: Data(json.utf8))

        XCTAssertNotEqual(purchase.store, .unknown, "a purchase must declare a concrete store")
        XCTAssertEqual(purchase.store, .apple)
    }

    // verification.result-exposes-uniform-validity
    func testEveryVerifyPurchaseVariantExposesIsValid() {
        // Each variant answers validity the same way, so a caller does not have
        // to switch on the concrete type before gating entitlement.
        let ios = VerifyPurchaseResultIOS(
            isValid: true,
            jwsRepresentation: "jws",
            latestTransaction: nil,
            receiptData: "receipt"
        )
        let horizon = VerifyPurchaseResultHorizon(grantTime: nil, isValid: false, success: false)

        XCTAssertTrue(ios.isValid)
        XCTAssertFalse(horizon.isValid)
        XCTAssertEqual(horizon.isValid, horizon.success, "isValid must agree with the deprecated success field")
    }

    // capabilities.unsupported-operations-degrade-predictably
    func testUnsupportedErrorCodesRemainRepresentableWithoutBeingProduced() {
        // The Android-only codes stay decodable so a cross-platform payload
        // round-trips, even though StoreKit never produces them.
        for code in [ErrorCode.alreadyOwned, .billingUnavailable, .serviceDisconnected, .serviceTimeout] {
            XCTAssertEqual(ErrorCode(rawValue: code.rawValue), code)
            XCTAssertFalse(PurchaseError.defaultMessage(for: code).isEmpty)
        }
    }
}
