import Foundation
import XCTest
import OpenIAP
import FixtureProvider

final class OpenIapStoreLifecycleTests: XCTestCase {
    @MainActor
    func testCancelledReinitializationPreservesTheActiveSession() async throws {
        let gate = DisconnectGate()
        let provider = LifecycleProvider()
        let delivered = expectation(description: "Active listener survives cancelled init")
        let store = OpenIapStore(onPurchaseSuccess: { _ in delivered.fulfill() }, module: provider)
        try await store.initConnection()
        let retry = Task {
            await gate.wait()
            try await store.initConnection()
        }
        await gate.waitUntilEntered()
        retry.cancel()
        await gate.release()
        do {
            try await retry.value
            XCTFail("Cancelled initialization must reject")
        } catch is CancellationError { }
        XCTAssertTrue(store.isConnected)
        XCTAssertTrue(provider.isConnected)
        XCTAssertEqual(provider.connectionCount, 1)
        provider.emit(.purchaseIos(try FixtureModule().makePurchase()))
        await fulfillment(of: [delivered], timeout: 1)
        try await store.endConnection()
    }

    @MainActor
    func testFailedReinitializationPreservesTheActiveSession() async throws {
        let provider = LifecycleProvider()
        let store = OpenIapStore(module: provider)
        try await store.initConnection()
        provider.initError = PurchaseError(code: .networkError, message: "Retry connection")
        do {
            try await store.initConnection()
            XCTFail("Failed initialization must reject")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .networkError)
        }
        XCTAssertTrue(store.isConnected)
        XCTAssertTrue(provider.isConnected)
        XCTAssertEqual(provider.listenerCount, 1)
        try await store.endConnection()
    }

    @MainActor
    func testSecondTeardownWaitsForReconnectAndKeepsStateConsistent() async throws {
        try await assertReconnectThenTeardown(requestBeforeReconnect: false)
    }

    @MainActor
    func testTeardownQueuedAfterReconnectDoesNotShareEarlierTeardown() async throws {
        try await assertReconnectThenTeardown(requestBeforeReconnect: true)
    }

    @MainActor
    private func assertReconnectThenTeardown(requestBeforeReconnect: Bool) async throws {
        let firstEnd = DisconnectGate()
        let reconnect = DisconnectGate()
        let earlyTeardown = expectation(description: "Teardown cannot overtake initialization")
        earlyTeardown.isInverted = true
        let reconnectRequested = expectation(description: "Reconnect requested")
        let requested = expectation(description: "Second teardown requested")
        let delivered = expectation(description: "Next connection owns a working listener")
        let provider = LifecycleProvider(
            initGates: [nil, reconnect], endGates: [firstEnd],
            onDisconnect: { if $0 == 2 { earlyTeardown.fulfill() } }
        )
        let store = OpenIapStore(onPurchaseSuccess: { _ in delivered.fulfill() }, module: provider)
        try await store.initConnection()
        let ending = Task { try await store.endConnection() }
        await firstEnd.waitUntilEntered()
        let reconnecting = Task {
            reconnectRequested.fulfill()
            try await store.initConnection()
        }
        await fulfillment(of: [reconnectRequested], timeout: 1)
        if !requestBeforeReconnect {
            await firstEnd.release()
            try await ending.value
            await reconnect.waitUntilEntered()
        }
        let endingAgain = Task {
            requested.fulfill()
            try await store.endConnection()
        }
        await fulfillment(of: [requested], timeout: 1)
        if requestBeforeReconnect {
            await firstEnd.release()
            try await ending.value
            await reconnect.waitUntilEntered()
        }
        await fulfillment(of: [earlyTeardown], timeout: 0.05)
        await reconnect.release()
        try await reconnecting.value
        try await endingAgain.value
        XCTAssertFalse(provider.isConnected)
        XCTAssertFalse(store.isConnected)
        XCTAssertEqual(provider.listenerCount, 0)
        XCTAssertEqual(provider.disconnectCount, 2)
        try await store.initConnection()
        provider.emit(.purchaseIos(try FixtureModule().makePurchase()))
        await fulfillment(of: [delivered], timeout: 1)
        XCTAssertTrue(provider.isConnected)
        XCTAssertTrue(store.isConnected)
        try await store.endConnection()
    }

    @MainActor
    func testCancelledQueuedReconnectDoesNotReopenAfterTeardown() async throws {
        let gate = DisconnectGate()
        let requested = expectation(description: "Reconnect requested")
        let provider = LifecycleProvider(endGates: [gate])
        let store = OpenIapStore(module: provider)
        try await store.initConnection()
        let ending = Task { try await store.endConnection() }
        await gate.waitUntilEntered()
        let reconnecting = Task {
            requested.fulfill()
            try await store.initConnection()
        }
        await fulfillment(of: [requested], timeout: 1)
        reconnecting.cancel()
        await gate.release()
        try await ending.value
        do {
            try await reconnecting.value
            XCTFail("Cancelled reconnect must reject")
        } catch is CancellationError { }
        XCTAssertFalse(store.isConnected)
        XCTAssertFalse(provider.isConnected)
        XCTAssertEqual(provider.connectionCount, 1)
        XCTAssertEqual(provider.listenerCount, 0)
    }

    @MainActor
    func testFailedDisconnectPreservesSessionAndAllowsRetry() async throws {
        for thrown in [false, true] {
            let provider = LifecycleProvider()
            provider.endResult = false
            provider.endError = thrown ? PurchaseError(code: .networkError, message: "Retry teardown") : nil
            let delivered = expectation(description: "Failed teardown keeps listeners")
            let store = OpenIapStore(onPurchaseSuccess: { _ in delivered.fulfill() }, module: provider)
            try await store.initConnection()
            do {
                try await store.endConnection()
                XCTFail("Failed teardown must reject")
            } catch let error as PurchaseError {
                XCTAssertEqual(error.code, thrown ? .networkError : .notEnded)
            }
            XCTAssertTrue(store.isConnected)
            XCTAssertEqual(provider.listenerCount, 1)
            provider.emit(.purchaseIos(try FixtureModule().makePurchase()))
            await fulfillment(of: [delivered], timeout: 1)
            provider.endError = nil
            provider.endResult = true
            try await store.endConnection()
            XCTAssertFalse(store.isConnected)
            XCTAssertEqual(provider.listenerCount, 0)
        }
    }

    @MainActor
    func testPendingDisconnectCannotStartAutomaticRefresh() async throws {
        let gate = DisconnectGate()
        let unexpected = expectation(description: "No automatic query during teardown")
        unexpected.isInverted = true
        let provider = LifecycleProvider(endGates: [gate], onAvailableRead: { unexpected.fulfill() })
        let delivered = expectation(description: "Pending session still delivers purchase")
        let store = OpenIapStore(onPurchaseSuccess: { _ in delivered.fulfill() }, module: provider)
        try await store.initConnection()
        let ending = Task { try await store.endConnection() }
        await gate.waitUntilEntered()
        provider.emit(.purchaseIos(try FixtureModule().makePurchase()))
        await fulfillment(of: [delivered], timeout: 1)
        await fulfillment(of: [unexpected], timeout: 0.05)
        await gate.release()
        try await ending.value
        XCTAssertFalse(store.isConnected)
        XCTAssertEqual(provider.listenerCount, 0)
    }

    @MainActor
    func testReconnectWaitsForPendingDisconnect() async throws {
        let gate = DisconnectGate()
        let provider = LifecycleProvider(endGates: [gate])
        let store = OpenIapStore(module: provider)
        try await store.initConnection()
        let ending = Task { try await store.endConnection() }
        await gate.waitUntilEntered()
        let reconnecting = Task { try await store.initConnection() }
        await gate.release()
        try await ending.value
        try await reconnecting.value
        XCTAssertTrue(store.isConnected)
        XCTAssertEqual(provider.connectionCount, 2)
        XCTAssertEqual(provider.listenerCount, 1)
    }

    @MainActor
    func testAutomaticRefreshCannotPublishOrReconnectAfterDisconnect() async throws {
        let gate = PurchaseQueryGate()
        let unexpected = expectation(description: "No subscription query after disconnect")
        unexpected.isInverted = true
        let provider = LifecycleProvider(gates: [gate], onActiveRead: { unexpected.fulfill() })
        let store = OpenIapStore(module: provider)
        try await store.initConnection()
        let original = Purchase.purchaseIos(try FixtureModule().makePurchase(sku: "original"))
        provider.emit(original)
        await gate.waitUntilEntered()
        try await store.endConnection()
        await gate.release([.purchaseIos(try FixtureModule().makePurchase(sku: "stale"))])
        await fulfillment(of: [unexpected], timeout: 0.05)
        XCTAssertEqual(store.availablePurchases.map(\.id), [original.id])
        XCTAssertFalse(store.isConnected)
        XCTAssertEqual(provider.connectionCount, 1)
    }

    @MainActor
    func testSuspendedAutomaticReadDoesNotRetainTheStore() async throws {
        let gate = PurchaseQueryGate()
        let provider = LifecycleProvider(gates: [gate])
        var store: OpenIapStore? = OpenIapStore(module: provider)
        try await store?.initConnection()
        provider.emit(.purchaseIos(try FixtureModule().makePurchase()))
        await gate.waitUntilEntered()
        weak var releasedStore = store
        store = nil
        XCTAssertNil(releasedStore)
        XCTAssertEqual(provider.listenerCount, 0)
        await gate.release([])
    }

    @MainActor
    func testNewerAutomaticRefreshWinsWhenOlderReadCompletesLast() async throws {
        let first = PurchaseQueryGate()
        let second = PurchaseQueryGate()
        let refreshed = expectation(description: "Latest refresh completes")
        let provider = LifecycleProvider(gates: [first, second], onActiveRead: { refreshed.fulfill() })
        let store = OpenIapStore(module: provider)
        try await store.initConnection()
        provider.emit(.purchaseIos(try FixtureModule().makePurchase(sku: "first")))
        await first.waitUntilEntered()
        provider.emit(.purchaseIos(try FixtureModule().makePurchase(sku: "second")))
        await second.waitUntilEntered()
        let latest = Purchase.purchaseIos(try FixtureModule().makePurchase(sku: "latest"))
        await second.release([latest])
        await fulfillment(of: [refreshed], timeout: 1)
        await first.release([.purchaseIos(try FixtureModule().makePurchase(sku: "stale"))])
        let unexpected = expectation(description: "Older refresh stays cancelled")
        unexpected.isInverted = true
        provider.onActiveRead = { unexpected.fulfill() }
        await fulfillment(of: [unexpected], timeout: 0.05)
        XCTAssertEqual(store.availablePurchases.map(\.id), [latest.id])
        try await store.endConnection()
    }

    @MainActor
    func testReconnectReceivesProviderReplayDuringInitialization() async throws {
        let provider = LifecycleProvider()
        let replayed = expectation(description: "Reconnected provider replay")
        let store = OpenIapStore(onPurchaseSuccess: { _ in replayed.fulfill() }, module: provider)
        try await store.initConnection()
        try await store.endConnection()
        let replay = Purchase.purchaseIos(try FixtureModule().makePurchase(sku: "restored"))
        provider.initReplay = replay
        try await store.initConnection()
        await fulfillment(of: [replayed], timeout: 1)
        XCTAssertEqual(store.currentPurchase?.id, replay.id)
        try await store.endConnection()
    }

    @MainActor
    func testCapturedCallbackIsIgnoredAfterDisconnect() async throws {
        let provider = LifecycleProvider()
        let unexpected = expectation(description: "Removed listener stays removed")
        unexpected.isInverted = true
        let store = OpenIapStore(onPurchaseSuccess: { _ in unexpected.fulfill() }, module: provider)
        try await store.initConnection()
        let delivery = provider.captureDelivery(.purchaseIos(try FixtureModule().makePurchase()))
        try await store.endConnection()
        delivery()
        await fulfillment(of: [unexpected], timeout: 0.05)
        XCTAssertNil(store.currentPurchase)
    }
}

private actor DisconnectGate {
    private var result: CheckedContinuation<Void, Never>?
    private var entered: CheckedContinuation<Void, Never>?
    func wait() async {
        await withCheckedContinuation {
            result = $0
            entered?.resume()
            entered = nil
        }
    }
    func waitUntilEntered() async {
        if result != nil { return }
        await withCheckedContinuation { entered = $0 }
    }
    func release() {
        result?.resume()
        result = nil
    }
}

private actor PurchaseQueryGate {
    private var result: CheckedContinuation<[Purchase], Never>?
    private var entered: CheckedContinuation<Void, Never>?
    func read() async -> [Purchase] {
        await withCheckedContinuation {
            result = $0
            entered?.resume()
            entered = nil
        }
    }
    func waitUntilEntered() async {
        if result != nil { return }
        await withCheckedContinuation { entered = $0 }
    }
    func release(_ purchases: [Purchase]) {
        result?.resume(returning: purchases)
        result = nil
    }
}

private final class LifecycleProvider: OpenIapModuleProtocol, @unchecked Sendable {
    private let fixture = FixtureModule()
    private let lock = NSLock()
    private var updates: [UUID: PurchaseUpdatedListener] = [:]
    private var connections = 0
    private var disconnects = 0
    private var connected = false
    private var reads = 0
    private let gates: [PurchaseQueryGate]
    private let initGates: [DisconnectGate?]
    private let endGates: [DisconnectGate]
    private let onDisconnect: @Sendable (Int) -> Void
    private let onAvailableRead: @Sendable () -> Void
    private var disconnectResult = true
    private var disconnectError: PurchaseError?
    private var connectionError: PurchaseError?
    var initError: PurchaseError? {
        get { synchronized { connectionError } }
        set { synchronized { connectionError = newValue } }
    }
    var endResult: Bool {
        get { synchronized { disconnectResult } }
        set { synchronized { disconnectResult = newValue } }
    }
    var endError: PurchaseError? {
        get { synchronized { disconnectError } }
        set { synchronized { disconnectError = newValue } }
    }
    var initReplay: Purchase?
    private var activeRead: @Sendable () -> Void
    var onActiveRead: @Sendable () -> Void {
        get { synchronized { activeRead } }
        set { synchronized { activeRead = newValue } }
    }
    init(
        gates: [PurchaseQueryGate] = [],
        initGates: [DisconnectGate?] = [],
        endGates: [DisconnectGate] = [],
        onDisconnect: @escaping @Sendable (Int) -> Void = { _ in },
        onAvailableRead: @escaping @Sendable () -> Void = {},
        onActiveRead: @escaping @Sendable () -> Void = {}
    ) {
        self.gates = gates
        self.initGates = initGates
        self.endGates = endGates
        self.onDisconnect = onDisconnect
        self.onAvailableRead = onAvailableRead
        activeRead = onActiveRead
    }
    private func synchronized<T>(_ work: () -> T) -> T {
        lock.lock(); defer { lock.unlock() }; return work()
    }
    var connectionCount: Int { synchronized { connections } }
    var disconnectCount: Int { synchronized { disconnects } }
    var listenerCount: Int { synchronized { updates.count } }
    var isConnected: Bool { synchronized { connected } }
    func initConnection() async throws -> Bool {
        try Task.checkCancellation()
        if let initError { throw initError }
        let index = synchronized { defer { connections += 1 }; return connections }
        if index < initGates.count, let gate = initGates[index] { await gate.wait() }
        synchronized { connected = true }
        if let initReplay { emit(initReplay) }
        return true
    }
    func endConnection() async throws -> Bool {
        let index = synchronized { defer { disconnects += 1 }; return disconnects }
        onDisconnect(index + 1)
        if index < endGates.count { await endGates[index].wait() }
        if let endError { throw endError }
        let result = endResult
        if result { synchronized { connected = false } }
        return result
    }
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult { try await fixture.fetchProducts(params) }
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? { nil }
    func restorePurchases() async throws {}
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] {
        onAvailableRead()
        let index = synchronized { defer { reads += 1 }; return reads }
        return index < gates.count ? await gates[index].read() : []
    }
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws {}
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] { onActiveRead(); return [] }
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool { false }
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult { try await fixture.verifyPurchase(props) }
    func getStorefront() async throws -> String { "US" }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws {}
    func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener, options: PurchaseUpdatedListenerOptions?) -> Subscription {
        let token = Subscription(eventType: .purchaseUpdated)
        synchronized { updates[token.id] = listener }
        return token
    }
    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription { Subscription(eventType: .purchaseError) }
    func removeListener(_ subscription: Subscription) { _ = synchronized { updates.removeValue(forKey: subscription.id) } }
    func removeAllListeners() { synchronized { updates.removeAll() } }
    func captureDelivery(_ purchase: Purchase) -> @Sendable () -> Void {
        let listeners = synchronized { Array(updates.values) }
        return { listeners.forEach { $0(purchase) } }
    }
    func emit(_ purchase: Purchase) { captureDelivery(purchase)() }
}
