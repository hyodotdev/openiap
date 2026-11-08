import StoreKit
import XCTest
@testable import OpenIAP

/// Apple's binding into the OpenIAP conformance suite.
///
/// Test method names map to generated behavior IDs in the coverage report.
///
/// Purchase, completion, and restoration behaviors are absent by necessity:
/// driving them requires a live StoreKit session (StoreKitTest + a .storekit
/// configuration in an Xcode test target), which SwiftPM cannot provide. Those
/// ids are declared in `notCoveredBehaviors` with the reason, so the coverage
/// aggregator reports them as gaps instead of treating silence as success.
final class StoreConformanceTests: XCTestCase {

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
        ConformanceBehaviors.capabilitiesUnsupportedOperationsDegradePredictably: "no unsupported Apple operation is exposed by this Swift package",
    ]

    func testErrorsStoreCodesNormalizeToSpecErrorCodes() {
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

    func testErrorsUnrecognizedStoreCodeNormalizesToUnknown() {
        // An error outside the StoreKit domain must not be mapped at all, so
        // the caller's fallback applies instead of a fabricated code.
        let foreign = NSError(domain: "com.example.other", code: 4242)
        XCTAssertNil(PurchaseError.skErrorCode(from: foreign))
        XCTAssertEqual(PurchaseError.wrap(foreign, fallback: .unknown).code, .unknown)
    }

    func testErrorsUnsupportedCodesAreNotSynthesized() {
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

    func testIdentifiersPurchaseCarriesAConcreteStore() throws {
        let json = """
        {
          "id": "txn-1",
          "productId": "dev.hyo.martie.premium",
          "ids": ["dev.hyo.martie.premium"],
          "isAutoRenewing": true,
          "purchaseState": "purchased",
          "quantity": 1,
          "store": "apple",
            "storeId": "apple",
          "transactionDate": 1700000000000,
          "transactionId": "txn-1"
        }
        """
        let purchase = try JSONDecoder().decode(PurchaseIOS.self, from: Data(json.utf8))

        XCTAssertNotEqual(purchase.store, .unknown, "a purchase must declare a concrete store")
        XCTAssertEqual(purchase.store, .apple)
        XCTAssertEqual(purchase.storeId, "apple")
        XCTAssertFalse(purchase.storeId.isEmpty, "storeId must never be empty")

        // A community provider reports Unknown with its own stable id.
        let communityJson = """
        {
          "id": "txn-community-1",
          "productId": "dev.hyo.martie.premium",
          "ids": ["dev.hyo.martie.premium"],
          "isAutoRenewing": true,
          "purchaseState": "purchased",
          "quantity": 1,
          "store": "unknown",
          "storeId": "community_fixture",
          "transactionDate": 1700000000000,
          "transactionId": "txn-community-1"
        }
        """
        let community = try JSONDecoder().decode(PurchaseIOS.self, from: Data(communityJson.utf8))

        XCTAssertEqual(community.store, .unknown)
        XCTAssertEqual(community.storeId, "community_fixture")
        XCTAssertFalse(community.storeId.isEmpty, "storeId must never be empty")
    }

    func testVerificationResultExposesUniformValidity() {
        // Each variant answers validity the same way, so a caller does not have
        // to switch on the concrete type before gating entitlement.
        let ios = VerifyPurchaseResultIOS(
            isValid: true,
            jwsRepresentation: "jws",
            latestTransaction: nil,
            receiptData: "receipt"
        )
        let horizon = VerifyPurchaseResultHorizon(grantTime: nil, isValid: false)

        XCTAssertTrue(ios.isValid)
        XCTAssertFalse(horizon.isValid)
    }

}
