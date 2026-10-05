import Foundation
import XCTest
@testable import OpenIAP

final class ProviderDiscoveryTests: XCTestCase {
    func testNativeVersionCompatibility() throws {
        for (built, runtime) in [("3.6.1", "3.6.2"), ("4.0.0", "4.1.0"), ("4.0.0-rc.1", "4.0.0-rc.1")] {
            try OpenIapProvider.validate(storeId: "community-fixture", providerCoreVersion: built, runtimeCoreVersion: runtime)
        }
        for (built, runtime) in [("3.6.3", "3.6.2"), ("3.6.1", "4.0.0"), ("4.0.0-rc.1", "4.0.0"), ("4.0.0", "4.0.0-rc.1"), ("bad", "4.0.0"), ("4.0", "4.0.0")] {
            XCTAssertThrowsError(try OpenIapProvider.validate(storeId: "community-fixture", providerCoreVersion: built, runtimeCoreVersion: runtime))
        }
        for id in ["", "unknown", "google", "play", "none", "auto", "amazon", "horizon", "Bad id", "store\n"] {
            XCTAssertThrowsError(try OpenIapProvider.validate(storeId: id, providerCoreVersion: "4.0.0", runtimeCoreVersion: "4.0.0"))
        }
    }

    func testDescriptorChecksBothContractsAndPlatform() throws {
        let descriptor = OpenIapAppleProviderFactory().descriptor
        XCTAssertEqual(descriptor.platform, .ios)
        XCTAssertEqual(descriptor.clientProtocolVersion, "0.2.0")
        try OpenIapProvider.validate(descriptor)
        var invalid = descriptor
        invalid.platform = .android
        XCTAssertThrowsError(try OpenIapProvider.validate(invalid))
        invalid = descriptor
        invalid.clientProtocolVersion = "0.1.1"
        XCTAssertThrowsError(try OpenIapProvider.validate(invalid))
        invalid.clientProtocolVersion = "0.3.0"
        XCTAssertThrowsError(try OpenIapProvider.validate(invalid))
    }

    func testOfficialCapabilitiesMatchAvailablePlatformFeatures() {
        let capabilities = OpenIapAppleProviderFactory().capabilities
        XCTAssertTrue(capabilities.contains("pendingPurchases"))
        #if os(macOS) || os(tvOS) || os(watchOS)
        XCTAssertEqual(capabilities, ["pendingPurchases"])
        #else
        #if targetEnvironment(macCatalyst)
        #if compiler(>=6.4)
        if #available(macCatalyst 27.0, *) { XCTAssertTrue(capabilities.contains("offerCodeRedemption")) }
        else { XCTAssertFalse(capabilities.contains("offerCodeRedemption")) }
        #else
        XCTAssertFalse(capabilities.contains("offerCodeRedemption"))
        #endif
        #else
        XCTAssertTrue(capabilities.contains("offerCodeRedemption"))
        #endif
        if #available(iOS 16.4, macCatalyst 16.4, visionOS 1.0, *) {
            XCTAssertTrue(capabilities.contains("subscriptionBillingIssue"))
        } else {
            XCTAssertFalse(capabilities.contains("subscriptionBillingIssue"))
        }
        #endif
    }

    func testAbsentSelectionUsesOfficialFactory() throws {
        try withBundle(value: nil) { bundle in
            XCTAssertTrue(try OpenIapProvider.factory(bundle: bundle) is OpenIapAppleProviderFactory)
        }
    }

    func testMalformedSelectionFailsAtConnectionWithoutFallback() async throws {
        let purchase = try OpenIapSerialization.purchaseInput(from: [
            "store": "apple", "id": "txn", "transactionId": "txn", "productId": "sku",
            "quantity": 1, "isAutoRenewing": false, "purchaseState": "purchased", "transactionDate": 1.0,
        ])
        for value in ["", "MissingFactory", "NSObject", 123] as [Any] {
            let selection = try withBundle(value: value) { OpenIapProvider.select(bundle: $0) }
            let module = OpenIapModule(selection: selection)
            let subscription = module.purchaseUpdatedListener({ _ in }, options: nil)
            module.removeListener(subscription)
            module.removeAllListeners()
            XCTAssertNil(module.storeId)
            do { _ = try await module.initConnection(); XCTFail("Invalid provider must not connect") }
            catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
            do {
                try await module.finishTransaction(purchase: purchase, isConsumable: false)
                XCTFail("Finish on a failed selection must report the configuration cause")
            } catch let error as PurchaseError {
                XCTAssertEqual(error.code, .developerError)
                XCTAssertTrue(error.message.contains("Info.plist"), "finish hid the cause: \(error.message)")
            }
        }
    }

    func testSelectRejectsFactoryWithIncompatibleContract() async throws {
        for factory in [DiscoveryIncompatibleCoreFactory(), DiscoveryIncompatibleClientProtocolFactory()] as [any OpenIapProviderFactory] {
            do {
                _ = try OpenIapProvider.select(factory: factory).get()
                XCTFail("Incompatible factory must not be selected")
            } catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
            let module = OpenIapModule(factory: factory)
            do { _ = try await module.initConnection(); XCTFail("Incompatible factory must not connect") }
            catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
        }
    }

    func testSelectSurfacesFactoryCreateFailure() async throws {
        let factory = DiscoveryThrowingCreateFactory()
        do {
            _ = try OpenIapProvider.select(factory: factory).get()
            XCTFail("Factory that cannot create must not be selected")
        } catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
        let module = OpenIapModule(factory: factory)
        do { _ = try await module.initConnection(); XCTFail("Factory that cannot create must not connect") }
        catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
    }

    func testInfoPlistSelectionOfFailingFactoryFailsOperations() async throws {
        let purchase = try OpenIapSerialization.purchaseInput(from: [
            "store": "apple", "id": "txn", "transactionId": "txn", "productId": "sku",
            "quantity": 1, "isAutoRenewing": false, "purchaseState": "purchased", "transactionDate": 1.0,
        ])
        for name in ["DiscoveryIncompatibleCoreFactory", "DiscoveryThrowingCreateFactory"] {
            let module = try withBundle(value: name) { OpenIapModule(selection: OpenIapProvider.select(bundle: $0)) }
            XCTAssertNil(module.storeId)
            do { _ = try await module.initConnection(); XCTFail("\(name) must not connect") }
            catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
            do {
                try await module.finishTransaction(purchase: purchase, isConsumable: false)
                XCTFail("\(name) must not finish")
            } catch let error as PurchaseError { XCTAssertEqual(error.code, .developerError) }
        }
    }

    func testRejectedRequestDeliversOneErrorBeforeThrowing() async throws {
        let module = OpenIapStoreKitModule()
        let events = RequestEvents()
        let errorListener = module.purchaseErrorListener { error in events.record(error.code) }
        let purchaseListener = module.purchaseUpdatedListener({ _ in events.recordPurchase() }, options: nil)
        defer {
            module.removeListener(errorListener)
            module.removeListener(purchaseListener)
        }
        let request = RequestPurchaseProps(
            request: .purchase(RequestPurchasePropsByPlatforms()),
            type: .inApp
        )
        for count in 1...2 {
            do {
                _ = try await module.requestPurchase(request)
                XCTFail("Missing Apple purchase arguments must fail")
            } catch let error as PurchaseError {
                XCTAssertEqual(error.code, .purchaseError)
                XCTAssertEqual(events.errors, Array(repeating: .purchaseError, count: count))
                XCTAssertEqual(events.purchases, 0)
            }
        }
    }

    func testCancelledStoreQueryCannotInitializeAConnection() async throws {
        let module = OpenIapStoreKitModule()
        let ready = expectation(description: "Query task ready")
        let gate = QueryStartGate()
        let query = Task {
            await gate.wait(ready: ready)
            return try await module.getActiveSubscriptions(nil)
        }
        await fulfillment(of: [ready], timeout: 1)
        query.cancel()
        await gate.release()
        do {
            _ = try await query.value
            XCTFail("Cancelled queries must not connect to StoreKit")
        } catch is CancellationError {
        }
    }

    private func withBundle<T>(value: Any?, operation: (Bundle) throws -> T) throws -> T {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".bundle")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: url) }
        var info: [String: Any] = ["CFBundleIdentifier": "dev.hyo.provider-tests"]
        info[OpenIapProvider.metadataKey] = value
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try data.write(to: url.appendingPathComponent("Info.plist"))
        return try operation(XCTUnwrap(Bundle(url: url)))
    }
}

@objc(DiscoveryIncompatibleCoreFactory)
private final class DiscoveryIncompatibleCoreFactory: NSObject, OpenIapProviderFactory {
    required override init() { super.init() }
    var storeId: String { "community-fixture" }
    var coreVersion: String { "999.0.0" }
    var clientProtocolVersion: String { OpenIapVersion.clientProtocolVersion }
    func create() throws -> any OpenIapModuleProtocol { OpenIapStoreKitModule() }
}

@objc(DiscoveryIncompatibleClientProtocolFactory)
private final class DiscoveryIncompatibleClientProtocolFactory: NSObject, OpenIapProviderFactory {
    required override init() { super.init() }
    var storeId: String { "community-fixture" }
    var coreVersion: String { OpenIapVersion.current }
    var clientProtocolVersion: String { "0.99.0" }
    func create() throws -> any OpenIapModuleProtocol { OpenIapStoreKitModule() }
}

@objc(DiscoveryThrowingCreateFactory)
private final class DiscoveryThrowingCreateFactory: NSObject, OpenIapProviderFactory {
    required override init() { super.init() }
    var storeId: String { "community-fixture" }
    var coreVersion: String { OpenIapVersion.current }
    var clientProtocolVersion: String { OpenIapVersion.clientProtocolVersion }
    func create() throws -> any OpenIapModuleProtocol {
        throw PurchaseError.make(code: .developerError, message: "Fixture factory cannot create a module")
    }
}

private final class RequestEvents: @unchecked Sendable {
    private let lock = NSLock()
    private var codes: [ErrorCode] = []
    private var purchaseCount = 0
    func record(_ code: ErrorCode) { lock.lock(); codes.append(code); lock.unlock() }
    func recordPurchase() { lock.lock(); purchaseCount += 1; lock.unlock() }
    var errors: [ErrorCode] { lock.lock(); defer { lock.unlock() }; return codes }
    var purchases: Int { lock.lock(); defer { lock.unlock() }; return purchaseCount }
}

private actor QueryStartGate {
    private var continuation: CheckedContinuation<Void, Never>?
    func wait(ready: XCTestExpectation) async {
        await withCheckedContinuation {
            continuation = $0
            ready.fulfill()
        }
    }
    func release() {
        continuation?.resume()
        continuation = nil
    }
}
