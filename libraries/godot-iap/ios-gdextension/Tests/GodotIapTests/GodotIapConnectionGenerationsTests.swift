import XCTest
import OpenIAP
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

    func testPurchasesAreRefusedUntilAConnectionIsLive() throws {
        var connection = GodotIapConnectionGenerations()
        XCTAssertEqual(connection.purchaseRefusal?["code"] as? String, "not-prepared")

        // An init still in flight has installed no listeners yet.
        let generation = try XCTUnwrap(connection.beginInit())
        XCTAssertEqual(connection.purchaseRefusal?["success"] as? Bool, false)
        XCTAssertEqual(connection.purchaseRefusal?["error"] as? String, "IAP connection is not initialized")

        XCTAssertTrue(connection.markConnected(generation))
        XCTAssertNil(connection.purchaseRefusal)

        _ = connection.invalidate()
        XCTAssertEqual(connection.purchaseRefusal?["code"] as? String, "not-prepared")
    }

    func testADeadConnectionRejectsAValidPurchasePayloadBeforeDispatch() throws {
        let payload = #"{"requestPurchase":{"apple":{"sku":"coins.100"}},"type":"in-app"}"#
        var connection = GodotIapConnectionGenerations()

        for argsJson in [payload, "not json"] {
            guard case let .reply(reply) = GodotIapHelper.purchaseDispatch(
                argsJson: argsJson, connection: connection
            ) else {
                return XCTFail("Expected a refusal while not connected")
            }
            XCTAssertEqual(reply["code"] as? String, "not-prepared")
        }

        XCTAssertTrue(connection.markConnected(try XCTUnwrap(connection.beginInit())))
        guard case let .request(props) = GodotIapHelper.purchaseDispatch(
            argsJson: payload, connection: connection
        ), case let .purchase(platforms) = props.request else {
            return XCTFail("Expected the purchase to be dispatched once connected")
        }
        XCTAssertEqual(platforms.apple?.sku, "coins.100")

        guard case let .reply(reply) = GodotIapHelper.purchaseDispatch(
            argsJson: "not json", connection: connection
        ) else {
            return XCTFail("Expected a malformed payload to be rejected")
        }
        XCTAssertEqual(reply["code"] as? String, "developer-error")
        XCTAssertEqual(reply["error"] as? String, "Invalid request payload")
    }
}
