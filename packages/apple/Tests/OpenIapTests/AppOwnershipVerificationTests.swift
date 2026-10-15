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

    func testRefreshRequiresAnExplicitOption() throws {
        let decoder = JSONDecoder()
        for payload in ["{}", "{\"apple\":null}", "{\"apple\":{}}", "{\"apple\":{\"refresh\":null}}"] {
            XCTAssertNil(try decoder.decode(VerifyAppOwnershipProps.self, from: Data(payload.utf8)).apple?.refresh)
        }
        let disabled = try decoder.decode(VerifyAppOwnershipProps.self, from: Data("{\"apple\":{\"refresh\":false}}".utf8))
        XCTAssertEqual(disabled.apple?.refresh, false)
        let options = try decoder.decode(VerifyAppOwnershipProps.self, from: Data("{\"apple\":{\"refresh\":true}}".utf8))
        XCTAssertEqual(options.apple?.refresh, true)
        let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(options)) as? [String: Any]
        XCTAssertEqual((encoded?["apple"] as? [String: Any])?["refresh"] as? Bool, true)
        XCTAssertThrowsError(try decoder.decode(VerifyAppOwnershipProps.self, from: Data("{\"apple\":{\"refresh\":\"true\"}}".utf8)))
    }

    func testNetworkAndServiceFailuresRemainDistinct() {
        XCTAssertEqual(appOwnershipFailureReasonIOS(URLError(.notConnectedToInternet)), .networkError)
        XCTAssertEqual(appOwnershipFailureReasonIOS(NSError(domain: "store", code: 1)), .serviceError)
    }
}
