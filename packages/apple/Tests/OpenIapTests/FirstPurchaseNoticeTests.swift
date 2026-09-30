import XCTest
@testable import OpenIAP

private final class Tally: @unchecked Sendable {
    private let lock = NSLock()
    private var total = 0

    func add() {
        lock.lock()
        total += 1
        lock.unlock()
    }

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return total
    }
}

/// Holds a reader that has just read the flag until a second reader has read it too,
/// or 300 ms pass. Without the claim lock, both readers see "not shown".
private final class RacingDefaults: UserDefaults {
    private let condition = NSCondition()
    private var reads = 0

    override func bool(forKey defaultName: String) -> Bool {
        let stored = super.bool(forKey: defaultName)
        condition.lock()
        reads += 1
        condition.broadcast()
        let deadline = Date(timeIntervalSinceNow: 0.3)
        while reads < 2, condition.wait(until: deadline) {}
        condition.unlock()
        return stored
    }
}

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

    func testTwoClaimsThatRaceHaveExactlyOneWinner() throws {
        let defaults = try XCTUnwrap(RacingDefaults(suiteName: suiteName))
        let winners = Tally()
        let done = DispatchGroup()
        for _ in 0..<2 {
            DispatchQueue.global().async(group: done) {
                if OpenIapFirstPurchaseNotice.claim(defaults: defaults) { winners.add() }
            }
        }
        done.wait()
        XCTAssertEqual(winners.count, 1)
    }

    func testTheStoredFlagSurvivesARelaunch() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        XCTAssertTrue(OpenIapFirstPurchaseNotice.claim(defaults: defaults))
        let relaunched = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        XCTAssertFalse(OpenIapFirstPurchaseNotice.claim(defaults: relaunched))
    }
}
