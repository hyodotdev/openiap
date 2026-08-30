import XCTest
import OpenIAP
@testable import NitroIap

/// Verifies on-demand StoreKit operations use the bridge lifecycle and listeners.
@available(iOS 15.0, macOS 14.0, tvOS 15.0, watchOS 8.0, *)
final class ConnectOnDemandTests: XCTestCase {

    func testStoreCallWithoutInitConnectionConnectsAndAttachesListeners() async throws {
        let hybrid = HybridRnIap()

        try hybrid.addSubscriptionBillingIssueListener { _ in }
        XCTAssertFalse(inspectInitialized(hybrid))
        XCTAssertNil(
            inspectSub(hybrid),
            "precondition: nothing is attached before a connection exists"
        )

        // No initConnection() — this is the call an app makes on mount.
        _ = try await hybrid.getAvailablePurchases(options: nil).await()

        XCTAssertTrue(
            inspectInitialized(hybrid),
            "a guarded store call must open the connection instead of refusing"
        )
        XCTAssertNotNil(
            inspectSub(hybrid),
            "the on-demand connect must attach listeners, or purchase events are lost"
        )

        _ = try await hybrid.endConnection().await()
    }

    func testOnDemandConnectReusesAttachedListeners() async throws {
        let hybrid = HybridRnIap()

        try hybrid.addSubscriptionBillingIssueListener { _ in }
        _ = try await hybrid.getAvailablePurchases(options: nil).await()
        let subAfterFirst = try XCTUnwrap(inspectSub(hybrid))

        _ = try await hybrid.getAvailablePurchases(options: nil).await()
        let subAfterSecond = try XCTUnwrap(inspectSub(hybrid))

        XCTAssertEqual(
            ObjectIdentifier(subAfterSecond as AnyObject),
            ObjectIdentifier(subAfterFirst as AnyObject),
            "the second call must reuse the attached listener"
        )

        _ = try await hybrid.endConnection().await()
    }

    func testPurchaseCallbackDuringInitIsDeliveredAfterConnectionSucceeds() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        let purchase = try makePurchase(id: "during-init")
        let holder = DeliveryTaskHolder()

        let connection = hybrid.enqueueConnectOperation {
            XCTAssertNotNil(
                self.inspectPurchaseUpdatedSub(hybrid),
                "the bridge listener must be attached before StoreKit initialization"
            )
            let delivery = hybrid.enqueuePurchaseUpdateDelivery(
                purchase,
                expectedEpoch: hybrid.currentConnectionEpoch(),
                includeDuplicateListeners: false
            )
            await holder.set(delivery)
            return true
        }

        let connected = try await connection.value
        XCTAssertTrue(connected)
        let heldDelivery = await holder.task
        let delivery = try XCTUnwrap(heldDelivery)
        _ = try await delivery.value
        XCTAssertTrue(probe.events.isEmpty)

        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in probe.record(purchase.id) },
            options: nil
        )
        _ = try await hybrid.enqueueLifecycleBarrier().value
        XCTAssertEqual(probe.events, ["during-init"])

        _ = try await hybrid.endConnection().await()
    }

    func testPurchaseErrorCallbackDuringFailedInitIsDelivered() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        let purchaseError = PurchaseError.make(
            code: .iapNotAvailable,
            message: "Store unavailable"
        )
        let holder = DeliveryTaskHolder()

        let connection = hybrid.enqueueConnectOperation {
            XCTAssertNotNil(
                self.inspectPurchaseErrorSub(hybrid),
                "the error listener must be attached before StoreKit initialization"
            )
            let delivery = hybrid.enqueuePurchaseErrorDelivery(
                purchaseError,
                expectedEpoch: hybrid.currentConnectionEpoch()
            )
            await holder.set(delivery)
            return false
        }

        let connected = try await connection.value
        XCTAssertFalse(connected)
        let heldDelivery = await holder.task
        let delivery = try XCTUnwrap(heldDelivery)
        _ = try await delivery.value
        XCTAssertTrue(probe.events.isEmpty)

        try hybrid.addPurchaseErrorListener { error in
            probe.record(error.code)
        }
        _ = try await hybrid.enqueueLifecycleBarrier().value
        XCTAssertEqual(probe.events, [ErrorCode.iapNotAvailable.rawValue])

        _ = try await hybrid.endConnection().await()
    }

    func testOnDemandInitErrorIsOwnedByTheCallingOperation() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        try hybrid.addPurchaseErrorListener { error in
            probe.record(error.code)
        }
        let purchaseError = PurchaseError.make(
            code: .iapNotAvailable,
            message: "Store unavailable"
        )

        let connection = hybrid.enqueueOnDemandConnectOperation { false }

        let connected = try await connection.value
        XCTAssertFalse(connected)
        let delivery = hybrid.enqueuePurchaseErrorDelivery(
            purchaseError,
            expectedEpoch: hybrid.currentConnectionEpoch()
        )
        _ = try await delivery.value
        XCTAssertTrue(
            probe.events.isEmpty,
            "on-demand initialization failures belong to the calling operation"
        )

        _ = try await hybrid.enqueueEndOperation { true }.value
    }

    func testPendingPurchaseUpdatesAreBoundedAndFlushInOrder() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.enqueueConnectOperation { true }.value
        XCTAssertTrue(connected)
        let epoch = hybrid.currentConnectionEpoch()

        for index in 0...200 {
            let purchase = try makePurchase(id: "buffered-\(index)")
            _ = try await hybrid.enqueuePurchaseUpdateDelivery(
                purchase,
                expectedEpoch: epoch,
                includeDuplicateListeners: false
            ).value
        }

        let probe = EventProbe()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in probe.record(purchase.id) },
            options: nil
        )
        _ = try await hybrid.enqueueLifecycleBarrier().value
        XCTAssertEqual(probe.events.count, 200)
        XCTAssertEqual(probe.events.first, "buffered-1")
        XCTAssertEqual(probe.events.last, "buffered-200")

        _ = try await hybrid.endConnection().await()
    }

    func testBufferedReplayFinishesBeforeCallbackTriggeredTeardown() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.enqueueConnectOperation { true }.value
        XCTAssertTrue(connected)
        let epoch = hybrid.currentConnectionEpoch()

        for id in ["replay-first", "replay-second"] {
            _ = try await hybrid.enqueuePurchaseUpdateDelivery(
                try makePurchase(id: id),
                expectedEpoch: epoch,
                includeDuplicateListeners: false
            ).value
        }

        let probe = EventProbe()
        let endHolder = EndTaskHolder()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in
                probe.record(purchase.id)
                if purchase.id == "replay-first" {
                    endHolder.set(hybrid.enqueueEndOperation { true })
                }
            },
            options: nil
        )
        _ = try await hybrid.enqueueLifecycleBarrier().value
        let endTask = try XCTUnwrap(endHolder.task)
        _ = try await endTask.value
        probe.record("end")

        XCTAssertEqual(probe.events, ["replay-first", "replay-second", "end"])
    }

    func testListenerRegisteredDuringReplayOnlyReceivesLaterEvents() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.enqueueConnectOperation { true }.value
        XCTAssertTrue(connected)
        let epoch = hybrid.currentConnectionEpoch()
        let livePurchase = try makePurchase(id: "live")

        for id in ["buffered-first", "buffered-second"] {
            _ = try await hybrid.enqueuePurchaseUpdateDelivery(
                try makePurchase(id: id),
                expectedEpoch: epoch,
                includeDuplicateListeners: false
            ).value
        }

        let firstProbe = EventProbe()
        let reentrantProbe = EventProbe()
        let liveDeliveryHolder = VoidTaskHolder()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in
                firstProbe.record(purchase.id)
                if purchase.id == "buffered-first" {
                    do {
                        _ = try hybrid.addPurchaseUpdatedListener(
                            listener: { laterPurchase in
                                reentrantProbe.record(laterPurchase.id)
                            },
                            options: nil
                        )
                    } catch {
                        reentrantProbe.record("listener-registration-failed")
                    }
                    liveDeliveryHolder.set(
                        hybrid.enqueuePurchaseUpdateDelivery(
                            livePurchase,
                            expectedEpoch: epoch,
                            includeDuplicateListeners: false
                        )
                    )
                }
            },
            options: nil
        )
        _ = try await hybrid.enqueueLifecycleBarrier().value
        let liveDelivery = try XCTUnwrap(liveDeliveryHolder.task)
        _ = try await liveDelivery.value
        XCTAssertEqual(firstProbe.events, ["buffered-first", "buffered-second", "live"])
        XCTAssertEqual(reentrantProbe.events, ["live"])

        _ = try await hybrid.endConnection().await()
    }

    func testQueuedTeardownPreventsLateStoreDelegation() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)

        let endPromise = try hybrid.endConnection()
        let probe = DelegationProbe()
        let operation = hybrid.enqueueConnectedOperation {
            probe.markDelegated()
            return true
        }

        _ = try await endPromise.await()
        do {
            _ = try await operation.value
            XCTFail("a store operation queued after teardown must not run")
        } catch let error as OpenIapException {
            XCTAssertEqual(error.domain, OpenIapException.domain)
            XCTAssertTrue(error.localizedDescription.contains(ErrorCode.initConnection.rawValue))
        }
        XCTAssertFalse(probe.wasDelegated)
    }

    func testTeardownWaitsForConnectedOperationDelivery() async throws {
        let hybrid = HybridRnIap()
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let gate = DeliveryGate()
        let probe = EventProbe()

        let operation = hybrid.enqueueConnectedOperation {
            await gate.waitUntilReleased()
            probe.record("delivery")
            return true
        }
        while !(await gate.hasStarted) {
            await Task.yield()
        }

        let endPromise = try hybrid.endConnection()
        let endTask = Task {
            _ = try await endPromise.await()
            probe.record("end")
        }
        await gate.release()

        _ = try await operation.value
        try await endTask.value
        XCTAssertEqual(probe.events, ["delivery", "end"])
    }

    func testFailedTeardownPreservesListenerDeliveryAcrossReconnect() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in probe.record(purchase.id) },
            options: nil
        )
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let subscriptionBeforeFailure = try XCTUnwrap(inspectPurchaseUpdatedSub(hybrid))
        let teardownFailure = NSError(domain: "ConnectOnDemandTests", code: 1)

        let failedEnd = hybrid.enqueueEndOperation { throw teardownFailure }
        do {
            _ = try await failedEnd.value
            XCTFail("the injected teardown failure must be preserved")
        } catch {
            XCTAssertEqual((error as NSError).domain, teardownFailure.domain)
            XCTAssertEqual((error as NSError).code, teardownFailure.code)
        }

        XCTAssertTrue(inspectInitialized(hybrid))
        XCTAssertEqual(inspectPurchaseUpdatedListeners(hybrid).count, 1)
        let reconnected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(reconnected)
        let subscriptionAfterReconnect = try XCTUnwrap(inspectPurchaseUpdatedSub(hybrid))
        XCTAssertEqual(
            ObjectIdentifier(subscriptionAfterReconnect as AnyObject),
            ObjectIdentifier(subscriptionBeforeFailure as AnyObject)
        )

        let purchase = RnIapHelper.convertPurchaseDictionary([
            "id": "preserved-transaction",
            "transactionId": "preserved-transaction",
            "productId": "premium",
            "transactionDate": 1,
            "store": "apple",
            "quantity": 1,
            "purchaseState": "purchased",
            "isAutoRenewing": false
        ])
        inspectPurchaseUpdatedListeners(hybrid).first?(purchase)
        XCTAssertEqual(probe.events, ["preserved-transaction"])

        _ = try await hybrid.endConnection().await()
    }

    func testReturnedPurchaseReachesNonDedupingListenerBeforeTeardown() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in probe.record(purchase.id) },
            options: PurchaseUpdatedListenerOptions(
                dedupeTransactionIOS: .second(false)
            )
        )
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let purchase = try makePurchase(id: "returned-transaction")

        _ = try await hybrid.runRequestPurchaseOperation {
            .purchase(purchase)
        }
        _ = try await hybrid.runRequestPurchaseOperation {
            .purchase(purchase)
        }
        XCTAssertEqual(probe.events, ["returned-transaction", "returned-transaction"])

        let epoch = hybrid.currentConnectionEpoch()
        let firstCallback = hybrid.enqueuePurchaseUpdateDelivery(
            purchase,
            expectedEpoch: epoch,
            includeDuplicateListeners: true
        )
        let secondCallback = hybrid.enqueuePurchaseUpdateDelivery(
            purchase,
            expectedEpoch: epoch,
            includeDuplicateListeners: true
        )
        _ = try await firstCallback.value
        _ = try await secondCallback.value
        XCTAssertEqual(
            probe.events,
            ["returned-transaction", "returned-transaction"],
            "each direct delivery must suppress its matching asynchronous callback"
        )
        let replay = hybrid.enqueuePurchaseUpdateDelivery(
            purchase,
            expectedEpoch: epoch,
            includeDuplicateListeners: true
        )
        _ = try await replay.value
        XCTAssertEqual(
            probe.events,
            ["returned-transaction", "returned-transaction", "returned-transaction"],
            "later StoreKit replays must still reach non-deduping listeners"
        )

        _ = try await hybrid.endConnection().await()
    }

    func testNativeCallbackQueuedDuringRequestDoesNotDuplicateFallback() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        _ = try hybrid.addPurchaseUpdatedListener(
            listener: { purchase in probe.record(purchase.id) },
            options: nil
        )
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let purchase = try makePurchase(id: "native-winner")
        let epoch = hybrid.currentConnectionEpoch()
        let holder = DeliveryTaskHolder()

        _ = try await hybrid.runRequestPurchaseOperation {
            let delivery = hybrid.enqueuePurchaseUpdateDelivery(
                purchase,
                expectedEpoch: epoch,
                includeDuplicateListeners: false
            )
            await holder.set(delivery)
            return .purchase(purchase)
        }
        let heldTask = await holder.task
        let queuedDelivery = try XCTUnwrap(heldTask)
        _ = try await queuedDelivery.value
        let endPromise = try hybrid.endConnection()
        _ = try await endPromise.await()
        probe.record("end")
        XCTAssertEqual(probe.events, ["native-winner", "end"])
    }

    func testDelayedPurchaseErrorCallbacksAreSuppressedBeforeTeardown() async throws {
        let hybrid = HybridRnIap()
        let probe = EventProbe()
        try hybrid.addPurchaseErrorListener { error in
            probe.record(error.code)
        }
        let connected = try await hybrid.initConnection(config: nil).await()
        XCTAssertTrue(connected)
        let purchaseError = PurchaseError.make(
            code: .userCancelled,
            productId: "premium",
            message: "cancelled"
        )
        let epoch = hybrid.currentConnectionEpoch()

        for _ in 0..<2 {
            do {
                _ = try await hybrid.runRequestPurchaseOperation {
                    throw purchaseError
                }
                XCTFail("the injected purchase error must be preserved")
            } catch let error as PurchaseError {
                XCTAssertEqual(error.code, .userCancelled)
            }
        }

        _ = hybrid.enqueueConnectedOperation {
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        let firstNativeDelivery = hybrid.enqueuePurchaseErrorDelivery(
            purchaseError,
            expectedEpoch: epoch
        )
        let secondNativeDelivery = hybrid.enqueuePurchaseErrorDelivery(
            purchaseError,
            expectedEpoch: epoch
        )
        _ = try await firstNativeDelivery.value
        _ = try await secondNativeDelivery.value
        _ = try await hybrid.endConnection().await()
        XCTAssertEqual(
            probe.events,
            [ErrorCode.userCancelled.rawValue, ErrorCode.userCancelled.rawValue]
        )
    }

    func testConnectionRequiringCallsUseBridgeOwnedOperations() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceURL = packageRoot.appendingPathComponent("ios/HybridRnIap.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)
        let guardedMethods = [
            "fetchProducts",
            "getAvailablePurchases",
            "getActiveSubscriptions",
            "hasActiveSubscriptions",
            "finishTransaction",
            "verifyPurchase",
            "verifyPurchaseWithProvider",
            "getStorefront",
            "getAppTransactionIOS",
            "getPromotedProductIOS",
            "presentCodeRedemptionSheetIOS",
            "clearTransactionIOS",
            "subscriptionStatusIOS",
            "currentEntitlementIOS",
            "latestTransactionIOS",
            "getPendingTransactionsIOS",
            "getAllTransactionsIOS",
            "syncIOS",
            "showManageSubscriptionsIOS",
            "deepLinkToSubscriptionsIOS",
            "isEligibleForIntroOfferIOS",
            "getReceiptDataIOS",
            "requestReceiptRefreshIOS",
            "isTransactionVerifiedIOS",
            "getTransactionJwsIOS",
            "beginRefundRequestIOS",
            "canPresentExternalPurchaseNoticeIOS",
            "presentExternalPurchaseNoticeSheetIOS",
            "presentExternalPurchaseLinkIOS",
            "isEligibleForExternalPurchaseCustomLinkIOS",
            "getExternalPurchaseCustomLinkTokenIOS",
            "showExternalPurchaseCustomLinkNoticeIOS"
        ]

        for method in guardedMethods {
            let body = try methodBody(method, in: source)
            XCTAssertTrue(
                body.contains("runConnectedOperation"),
                "\(method) must not delegate around the bridge lifecycle queue"
            )
        }

        let requestPurchaseBody = try methodBody("requestPurchase", in: source)
        XCTAssertTrue(requestPurchaseBody.contains("runRequestPurchaseOperation"))
        let requestOperationBody = try methodBody(
            "runRequestPurchaseOperation",
            in: source
        )
        XCTAssertTrue(requestOperationBody.contains("runConnectedOperation"))
        let nativeResult = try XCTUnwrap(
            requestOperationBody.range(of: "let result = try await operation()")
        )
        let delivery = try XCTUnwrap(
            requestOperationBody.range(
                of: "deliverRequestPurchaseResultIfNeeded",
                range: nativeResult.upperBound..<requestOperationBody.endIndex
            )
        )
        XCTAssertLessThan(
            requestOperationBody.distance(
                from: requestOperationBody.startIndex,
                to: nativeResult.lowerBound
            ),
            requestOperationBody.distance(
                from: requestOperationBody.startIndex,
                to: delivery.lowerBound
            )
        )
        XCTAssertTrue(requestOperationBody.contains("deliverRequestPurchaseError"))

        let enqueueConnectBody = try closureBody(
            after: "    private func enqueueConnect",
            in: source
        )
        XCTAssertTrue(
            enqueueConnectBody.contains("if isCurrent, !reuseExistingConnection"),
            "on-demand connection failure must be reported only by the calling operation"
        )
    }

    // MARK: - Private reflection helpers

    private func inspectSub(_ hybrid: HybridRnIap) -> Any? {
        guard let child = childValue(hybrid, label: "subscriptionBillingIssueSub") else {
            XCTFail("HybridRnIap no longer exposes subscriptionBillingIssueSub — test needs update")
            return nil
        }
        let mirror = Mirror(reflecting: child)
        if mirror.displayStyle == .optional {
            return mirror.children.first?.value
        }
        return child
    }

    private func inspectInitialized(_ hybrid: HybridRnIap) -> Bool {
        childValue(hybrid, label: "isInitialized") as? Bool ?? false
    }

    private func inspectPurchaseUpdatedSub(_ hybrid: HybridRnIap) -> Any? {
        guard let child = childValue(hybrid, label: "purchaseUpdatedSub") else {
            XCTFail("HybridRnIap no longer exposes purchaseUpdatedSub — test needs update")
            return nil
        }
        let mirror = Mirror(reflecting: child)
        if mirror.displayStyle == .optional {
            return mirror.children.first?.value
        }
        return child
    }

    private func inspectPurchaseErrorSub(_ hybrid: HybridRnIap) -> Any? {
        guard let child = childValue(hybrid, label: "purchaseErrorSub") else {
            XCTFail("HybridRnIap no longer exposes purchaseErrorSub — test needs update")
            return nil
        }
        let mirror = Mirror(reflecting: child)
        if mirror.displayStyle == .optional {
            return mirror.children.first?.value
        }
        return child
    }

    private func inspectPurchaseUpdatedListeners(
        _ hybrid: HybridRnIap
    ) -> [(NitroPurchase) -> Void] {
        guard let registrations = childValue(
            hybrid,
            label: "purchaseUpdatedListeners"
        ) as? [(token: Double, listener: (NitroPurchase) -> Void)] else {
            XCTFail("HybridRnIap no longer exposes purchaseUpdatedListeners — test needs update")
            return []
        }
        return registrations.map { $0.listener }
    }

    private func childValue(_ object: Any, label: String) -> Any? {
        Mirror(reflecting: object)
            .children
            .first { $0.label == label }?
            .value
    }

    private func makePurchase(id: String) throws -> OpenIAP.Purchase {
        let data = try JSONSerialization.data(withJSONObject: [
            "id": id,
            "isAutoRenewing": false,
            "productId": "premium",
            "purchaseState": "purchased",
            "quantity": 1,
            "store": "apple",
            "transactionDate": 1,
            "transactionId": id
        ])
        let purchase = try JSONDecoder().decode(OpenIAP.PurchaseIOS.self, from: data)
        return .purchaseIos(purchase)
    }

    private func methodBody(_ name: String, in source: String) throws -> Substring {
        try closureBody(after: "    func \(name)", in: source)
    }

    private func closureBody(after marker: String, in source: String) throws -> Substring {
        let markerRange = try XCTUnwrap(source.range(of: marker))
        let openingBrace = try XCTUnwrap(
            source.range(of: "{", range: markerRange.upperBound..<source.endIndex)
        )
        var depth = 0
        var index = openingBrace.lowerBound
        while index < source.endIndex {
            switch source[index] {
            case "{":
                depth += 1
            case "}":
                depth -= 1
                if depth == 0 {
                    return source[openingBrace.lowerBound...index]
                }
            default:
                break
            }
            index = source.index(after: index)
        }
        throw NSError(domain: "ConnectOnDemandTests", code: 2)
    }

    private final class DelegationProbe: @unchecked Sendable {
        private let lock = NSLock()
        private var delegated = false

        var wasDelegated: Bool {
            lock.lock()
            defer { lock.unlock() }
            return delegated
        }

        func markDelegated() {
            lock.lock()
            delegated = true
            lock.unlock()
        }
    }

    private actor DeliveryGate {
        private(set) var hasStarted = false
        private var continuation: CheckedContinuation<Void, Never>?

        func waitUntilReleased() async {
            hasStarted = true
            await withCheckedContinuation { continuation = $0 }
        }

        func release() {
            continuation?.resume()
            continuation = nil
        }
    }

    private actor DeliveryTaskHolder {
        private(set) var task: Task<Void, Error>?

        func set(_ task: Task<Void, Error>) {
            self.task = task
        }
    }

    private final class EndTaskHolder: @unchecked Sendable {
        private let lock = NSLock()
        private var storedTask: Task<Bool, Error>?

        var task: Task<Bool, Error>? {
            lock.lock()
            defer { lock.unlock() }
            return storedTask
        }

        func set(_ task: Task<Bool, Error>) {
            lock.lock()
            storedTask = task
            lock.unlock()
        }
    }

    private final class VoidTaskHolder: @unchecked Sendable {
        private let lock = NSLock()
        private var storedTask: Task<Void, Error>?

        var task: Task<Void, Error>? {
            lock.lock()
            defer { lock.unlock() }
            return storedTask
        }

        func set(_ task: Task<Void, Error>) {
            lock.lock()
            storedTask = task
            lock.unlock()
        }
    }

    private final class EventProbe: @unchecked Sendable {
        private let lock = NSLock()
        private var recordedEvents: [String] = []

        var events: [String] {
            lock.lock()
            defer { lock.unlock() }
            return recordedEvents
        }

        func record(_ event: String) {
            lock.lock()
            recordedEvents.append(event)
            lock.unlock()
        }
    }
}
