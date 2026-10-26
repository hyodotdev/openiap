import OpenIAP
import XCTest

final class RequestPurchaseErrorObservationTests: XCTestCase {
    @objc func testNoCallbackLeavesNoSuppressionForLaterSamePayload() {
        let observation = RequestPurchaseErrorObservation(productId: "premium")
        let error = PurchaseError(code: .userCancelled, message: "Cancelled", productId: "premium")
        observation.suppressQueuedDuplicate(of: error)

        XCTAssertFalse(observation.record(error).isSuppressed)
        XCTAssertFalse(RequestPurchaseErrorObservation(productId: "premium").record(error).isSuppressed)
    }

    @objc func testOnlyOneAlreadyQueuedIdenticalPayloadIsSuppressed() {
        let observation = RequestPurchaseErrorObservation(productId: "premium")
        let error = PurchaseError(code: .networkError, message: "Offline", productId: "premium")
        let first = observation.record(error)
        let second = observation.record(error)
        let different = observation.record(PurchaseError(
            code: .networkError,
            debugMessage: "Independent failure",
            message: "Offline",
            productId: "premium"
        ))
        observation.suppressQueuedDuplicate(of: error)

        XCTAssertTrue(first.isSuppressed)
        XCTAssertFalse(second.isSuppressed)
        XCTAssertFalse(different.isSuppressed)
        XCTAssertFalse(observation.record(error).isSuppressed)
    }

    @objc func testGenericFailureOwnershipStillMatchesTheRequestedProduct() {
        let observation = RequestPurchaseErrorObservation(productId: "premium")
        XCTAssertFalse(observation.hasEnqueuedError)
        _ = observation.record(PurchaseError(code: .networkError, message: "Background", productId: "other"))
        XCTAssertFalse(observation.hasEnqueuedError)
        _ = observation.record(PurchaseError(code: .networkError, message: "Request", productId: "premium"))
        XCTAssertTrue(observation.hasEnqueuedError)
    }
}
