import StoreKit
import XCTest
@testable import OpenIAP

final class AvailablePurchasesTests: XCTestCase {
    private let module = OpenIapStoreKitModule()

    func testPublicationContinuesPastUnverifiedEntriesAndRejectsTheQuery() async {
        var published: [Int] = []
        do {
            _ = try await collect([
                .unverified(1, .invalidSignature), .verified(2),
                .unverified(3, .invalidDeviceVerification), .verified(4),
            ], shouldPublish: true) { published.append($0) }
            XCTFail("A failed verification must not return a partial inventory")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .transactionValidationFailed)
        } catch { XCTFail("Unexpected error: \(error)") }
        XCTAssertEqual(published, [2, 4])
    }

    func testVerifiedEntriesBeforeAndAfterFailureArePublished() async {
        var published: [Int] = []
        do {
            _ = try await collect([
                .verified(1), .unverified(2, .invalidSignature), .verified(3),
            ], shouldPublish: true) { published.append($0) }
            XCTFail("The query must still fail")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .transactionValidationFailed)
        } catch { XCTFail("Unexpected error: \(error)") }
        XCTAssertEqual(published, [1, 3])
    }

    func testAllUnverifiedEntriesFailWithoutPublishingAnything() async {
        var published: [Int] = []
        do {
            _ = try await collect([
                .unverified(1, .invalidSignature), .unverified(2, .invalidEncoding),
            ], shouldPublish: true) { published.append($0) }
            XCTFail("An unverified inventory is not a successful empty result")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .transactionValidationFailed)
        } catch { XCTFail("Unexpected error: \(error)") }
        XCTAssertTrue(published.isEmpty)
    }

    func testDefaultStrictQueryPreservesCachedInventoryAndPublishesNothing() async {
        var cachedInventory = [99]
        var published: [Int] = []
        do {
            cachedInventory = try await collect([
                .verified(1), .unverified(2, .invalidSignature), .verified(3),
            ], shouldPublish: false) { published.append($0) }
            XCTFail("The strict query must fail")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .transactionValidationFailed)
        } catch { XCTFail("Unexpected error: \(error)") }
        XCTAssertEqual(cachedInventory, [99])
        XCTAssertTrue(published.isEmpty)
    }

    func testCompleteVerifiedInventoryKeepsExistingPublicationOptions() async throws {
        for shouldPublish in [false, true] {
            var published: [Int] = []
            let purchases = try await collect([
                .verified(1), .verified(2),
            ], shouldPublish: shouldPublish) { published.append($0) }
            XCTAssertEqual(purchases, [1, 2])
            XCTAssertEqual(published, shouldPublish ? [1, 2] : [])
        }
    }

    func testEmptyVerifiedInventoryReturnsAnAuthoritativeEmptyResult() async throws {
        var published: [Int] = []
        let purchases = try await collect([], shouldPublish: true) { published.append($0) }
        XCTAssertTrue(purchases.isEmpty)
        XCTAssertTrue(published.isEmpty)
    }

    func testPublicationWaitsForEnumerationAndPreservesTheFirstFailure() async {
        enum Failure: Error { case first, second }
        var visited: [Int] = []
        var published: [Int] = []
        do {
            _ = try await module.collectAvailablePurchases(
                from: stream([1, 2, 3, 4]), shouldPublish: true
            ) { entry -> Int? in
                visited.append(entry)
                if entry == 1 { throw Failure.first }
                if entry == 3 { throw Failure.second }
                return entry == 4 ? nil : entry
            } publish: { entry in
                XCTAssertEqual(visited, [1, 2, 3, 4])
                published.append(entry)
            }
            XCTFail("A failed query must not return the filtered partial result")
        } catch Failure.first {} catch { XCTFail("Expected first failure, got \(error)") }
        XCTAssertEqual(visited, [1, 2, 3, 4])
        XCTAssertEqual(published, [2])
    }

    private func collect(
        _ entries: [VerificationResult<Int>],
        shouldPublish: Bool,
        publish: (Int) -> Void
    ) async throws -> [Int] {
        try await module.collectAvailablePurchases(
            from: stream(entries), shouldPublish: shouldPublish,
            transform: { try self.module.checkVerified($0) }, publish: publish
        )
    }

    private func stream<Item>(_ items: [Item]) -> AsyncStream<Item> {
        AsyncStream { continuation in
            items.forEach { continuation.yield($0) }
            continuation.finish()
        }
    }
}
