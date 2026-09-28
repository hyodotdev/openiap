import XCTest
@testable import OpenIAP

final class FirstPurchaseNoticeTests: XCTestCase {
    private var suiteName = ""

    override func setUp() {
        super.setUp()
        suiteName = "FirstPurchaseNoticeTests.\(UUID().uuidString)"
    }

    override func tearDown() {
        UserDefaults().removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    func testClaimsOncePerInstall() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        XCTAssertTrue(OpenIapFirstPurchaseNotice.claim(defaults: defaults))
        XCTAssertFalse(OpenIapFirstPurchaseNotice.claim(defaults: defaults))
    }

    func testTheStoredFlagSurvivesARelaunch() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        XCTAssertTrue(OpenIapFirstPurchaseNotice.claim(defaults: defaults))
        let relaunched = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        XCTAssertFalse(OpenIapFirstPurchaseNotice.claim(defaults: relaunched))
    }
}
