import XCTest
@testable import OpenIAP

final class AppOwnershipVerificationTests: XCTestCase {
    func testVerifiedAndRevokedAcquisitionsPreserveEvidence() throws {
        let payload = Data("""
        {"appId":123,"appVersionId":1,"appVersion":"1.0","bundleId":"dev.hyo.test",
         "deviceVerification":"device","deviceVerificationNonce":"nonce","environment":"Production",
         "originalAppVersion":"1.0","originalPurchaseDate":1000,"signedDate":2000}
        """.utf8)
        var transaction = try JSONDecoder().decode(AppTransaction.self, from: payload)
        let owned = appOwnershipResultIOS(transaction, jws: "signed-app", revocationChecked: true)
        XCTAssertEqual(owned.status, .licensed)
        XCTAssertEqual(owned.signedAppTransactionIOS, "signed-app")
        XCTAssertEqual(owned.appTransactionIOS?.bundleId, "dev.hyo.test")
        XCTAssertNil(owned.integrityTokenAndroid)
        XCTAssertNil(owned.reason)
        let inconclusive = appOwnershipResultIOS(transaction, jws: "signed-app", revocationChecked: false)
        XCTAssertEqual(inconclusive.status, .unknown)
        XCTAssertEqual(inconclusive.reason, .backendVerificationRequired)
        XCTAssertEqual(inconclusive.signedAppTransactionIOS, "signed-app")
        transaction.revocationDate = 3000
        let revoked = appOwnershipResultIOS(transaction, jws: "revoked-app", revocationChecked: true)
        XCTAssertEqual(revoked.status, .unlicensed)
        XCTAssertEqual(revoked.appTransactionIOS?.revocationDate, 3000)
    }

    func testNetworkAndServiceFailuresRemainDistinct() {
        XCTAssertEqual(appOwnershipFailureReasonIOS(URLError(.notConnectedToInternet)), .networkError)
        XCTAssertEqual(appOwnershipFailureReasonIOS(NSError(domain: "store", code: 1)), .serviceError)
    }
}
