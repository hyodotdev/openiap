import XCTest
@testable import GodotIap

final class GodotIapConnectionGenerationsTests: XCTestCase {
    func testASecondWrapperInitKeepsTheLiveListeners() throws {
        var connection = GodotIapConnectionGenerations()
        let first = try XCTUnwrap(connection.beginInit())
        XCTAssertTrue(connection.markConnected(first))

        // Another wrapper initializes while a purchase is being delivered.
        XCTAssertNil(connection.beginInit())
        XCTAssertTrue(connection.isActive(first))
    }

    func testEndingStopsOldListenersAndTheNextInitStartsFresh() throws {
        var connection = GodotIapConnectionGenerations()
        let first = try XCTUnwrap(connection.beginInit())
        XCTAssertTrue(connection.markConnected(first))

        let ended = connection.invalidate()
        XCTAssertFalse(connection.isActive(first))
        XCTAssertFalse(connection.markConnected(first))

        let next = try XCTUnwrap(connection.beginInit())
        XCTAssertGreaterThan(next, ended)
        XCTAssertTrue(connection.markConnected(next))
        XCTAssertTrue(connection.isActive(next))
    }
}
