import Foundation
import OpenIAP

public struct ProviderErrorCase {
    public let expected: ErrorCode
    public let actual: PurchaseError
    public init(expected: ErrorCode, actual: PurchaseError) {
        self.expected = expected
        self.actual = actual
    }
}

public protocol ProviderConformanceAdapter {
    var factory: any OpenIapProviderFactory { get }
    var provider: any OpenIapModuleProtocol { get }
    var testProductId: String { get }
    var normativeErrorCases: [ProviderErrorCase] { get }
    var unrecognizedError: PurchaseError { get }
    func toActiveSubscription(_ purchase: PurchaseIOS) -> ActiveSubscription
    func billingIssueRetainsEntitlement(_ purchase: PurchaseIOS) -> Bool
    func triggerCapability(_ capability: String) async throws
}

public extension ProviderConformanceAdapter {
    var testProductId: String { "conformance.product" }
    func billingIssueRetainsEntitlement(_ purchase: PurchaseIOS) -> Bool { false }
    func triggerCapability(_ capability: String) async throws {
        throw PurchaseError.make(code: .featureNotSupported, message: "Declared \(capability) needs a sandbox trigger")
    }
}

public struct ProviderConformanceReport: Codable {
    public struct Scope: Codable {
        public let kind: String
        public let requiredBehaviors: [String]
        public let complete: Bool
    }
    public struct Result: Codable {
        public let id: String
        public let outcome: String
    }
    public let suiteVersion: String
    public let clientProtocolVersion: String
    public let storeId: String
    public let store: String
    public let capabilities: [String]
    public let scope: Scope
    public let conformant: Bool
    public let results: [Result]

    public func write(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(self).write(to: url, options: .atomic)
    }
}

private final class EventProbe<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Value] = []
    private var nextIndex = 0
    func receive(_ value: Value) { lock.lock(); values.append(value); lock.unlock() }
    private func take() -> Value? {
        lock.lock()
        defer { lock.unlock() }
        guard nextIndex < values.count else { return nil }
        defer { nextIndex += 1 }
        return values[nextIndex]
    }
    var receivedValues: [Value] {
        lock.lock()
        defer { lock.unlock() }
        return values
    }
    func next(timeout: TimeInterval) async throws -> Value {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let value = take() { return value }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        throw PurchaseError.make(code: .serviceTimeout, message: "Provider event did not arrive")
    }
}

private enum ProviderEvent {
    case purchase(Purchase)
    case error(PurchaseError)
}

public struct ProviderConformanceSuite {
    private let adapter: any ProviderConformanceAdapter
    private let timeout: TimeInterval
    private var expectedStore: IapStore {
        adapter.factory.storeId == StoreIds.Apple ? .apple : .unknown
    }
    public init(adapter: any ProviderConformanceAdapter, eventTimeout: TimeInterval = 5) {
        self.adapter = adapter
        timeout = eventTimeout
    }

    public func run() async -> ProviderConformanceReport {
        let factory = adapter.factory
        let provider = adapter.provider
        let expectedStore = self.expectedStore
        let capabilities = factory.capabilities.sorted()
        let required = (ProviderBehaviors.mapping + ProviderBehaviors.runtime
            + capabilities.compactMap { ProviderBehaviors.capabilities[$0] }).sorted()
        var results: [String: String] = [:]
        for capability in capabilities where ProviderBehaviors.capabilities[capability] == nil {
            results["provider.unknown-capability.\(capability)"] = "fail"
        }
        func check(_ id: String, _ operation: () async throws -> Bool) async {
            do { results[id] = try await operation() ? "pass" : "fail" }
            catch { results[id] = "fail" }
        }
        func report() -> ProviderConformanceReport {
            ProviderConformanceReport(
                suiteVersion: ProviderBehaviors.suiteVersion,
                clientProtocolVersion: ProviderBehaviors.clientProtocolVersion,
                storeId: factory.storeId, store: expectedStore.rawValue,
                capabilities: capabilities,
                scope: .init(kind: "apple-provider", requiredBehaviors: required,
                             complete: required.allSatisfy { results[$0] != nil }),
                conformant: required.allSatisfy { results[$0] == "pass" } && !results.values.contains("fail"),
                results: results.sorted { $0.key < $1.key }.map { .init(id: $0.key, outcome: $0.value) }
            )
        }
        do { try OpenIapProvider.validate(factory.descriptor) }
        catch {
            results["provider.connection"] = "fail"
            return report()
        }
        do {
            guard try await provider.initConnection() else {
                results["provider.connection"] = "fail"
                await check("provider.disconnect") { try await provider.endConnection() }
                return report()
            }
        } catch {
            results["provider.connection"] = "fail"
            await check("provider.disconnect") { try await provider.endConnection() }
            return report()
        }

        await check("subscriptions.active-subscription-is-reported-active") {
            self.adapter.toActiveSubscription(try self.fixture(state: .purchased)).isActive
        }
        await check("subscriptions.pending-subscription-is-not-active") {
            !self.adapter.toActiveSubscription(try self.fixture(state: .pending)).isActive
        }
        await check("subscriptions.unknown-state-subscription-is-not-active") {
            !self.adapter.toActiveSubscription(try self.fixture(state: .unknown)).isActive
        }
        await check("subscriptions.groups-keep-independent-identifiers") {
            for sku in ["conformance.group-a", "conformance.group-b"] {
                let purchase = try self.fixture(sku: sku)
                let active = self.adapter.toActiveSubscription(purchase)
                if active.productId != sku || active.currentPlanId != sku || active.purchaseToken != purchase.purchaseToken { return false }
            }
            return true
        }
        await check("errors.store-codes-normalize-to-spec-error-codes") {
            !self.adapter.normativeErrorCases.isEmpty && self.adapter.normativeErrorCases.allSatisfy { $0.actual.code == $0.expected }
        }
        await check("errors.unrecognized-store-code-normalizes-to-unknown") {
            self.adapter.unrecognizedError.code == .unknown
        }
        await check("identifiers.purchase-carries-a-concrete-store") {
            let purchase = try self.fixture()
            let data = try JSONEncoder().encode(purchase)
            return try JSONDecoder().decode(PurchaseIOS.self, from: data).storeId == factory.storeId
        }
        await check("capabilities.declared-capabilities-match-the-matrix") {
            capabilities.allSatisfy { ProviderBehaviors.capabilities[$0] != nil }
                && (factory.storeId != StoreIds.Apple || Set(capabilities) == OpenIapAppleProviderFactory().capabilities)
        }
        await check("capabilities.unsupported-operations-degrade-predictably") {
            if capabilities.contains("offerCodeRedemption") { return true }
            do { return try await provider.openRedeemOfferCode() == nil }
            catch let error as PurchaseError { return error.code == .featureNotSupported }
        }
        await check("products.fetch-returns-requested-skus") {
            let products = try await provider.fetchProducts(ProductRequest(skus: [self.adapter.testProductId], type: .inApp))
            let ids: [String]
            switch products {
            case .products(let items): ids = items?.map { $0.id } ?? []
            case .subscriptions(let items): ids = items?.map { $0.id } ?? []
            case .all(let items): ids = items?.map {
                switch $0 {
                case .product(let product): return product.id
                case .productSubscription(let subscription): return subscription.id
                }
            } ?? []
            }
            return !ids.isEmpty && ids.allSatisfy { $0 == self.adapter.testProductId }
        }
        var ownedPurchase: Purchase?
        await check("provider.invalid-purchase-emits-error-once") {
            let probe = EventProbe<ProviderEvent>()
            let updates = provider.purchaseUpdatedListener({ probe.receive(.purchase($0)) }, options: nil)
            let errors = provider.purchaseErrorListener { probe.receive(.error($0)) }
            defer { provider.removeListener(updates); provider.removeListener(errors) }
            let request = try OpenIapSerialization.decode(object: [
                "type": "in-app", "requestPurchase": ["apple": ["sku": ""]],
            ], as: RequestPurchaseProps.self)
            var failure: PurchaseError?
            do {
                switch try await provider.requestPurchase(request) {
                case .purchase(let purchase): if purchase != nil { return false }
                case .purchases(let purchases): if purchases?.isEmpty == false { return false }
                case nil: break
                }
            } catch let error as PurchaseError {
                failure = error
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                // The canonical listener event owns a provider's generic failure.
            }
            let events = probe.receivedValues
            guard events.count == 1, case .error(let emitted) = events[0] else { return false }
            if let failure, emitted.code != failure.code { return false }
            try await Task.sleep(nanoseconds: UInt64(self.timeout * 1_000_000_000))
            return probe.receivedValues.count == 1
        }
        await check("purchases.request-emits-purchase-updated-on-success") {
            let purchase = try await self.purchase()
            guard case .purchaseIos = purchase,
                  purchase.storeId == factory.storeId, purchase.productId == self.adapter.testProductId,
                  purchase.purchaseState == .purchased,
                  purchase.store == expectedStore else { return false }
            ownedPurchase = purchase
            return true
        }
        await check("restoration.available-purchases-returns-owned-items") {
            guard let purchased = ownedPurchase else { return false }
            try await provider.restorePurchases()
            return try await provider.getAvailablePurchases(nil).contains {
                if case .purchaseIos = $0 {
                    return $0.id == purchased.id && $0.purchaseToken == purchased.purchaseToken
                        && $0.storeId == factory.storeId && $0.store == purchased.store
                }
                return false
            }
        }
        await check("identifiers.purchase-token-is-stable-across-reads") {
            guard let purchased = ownedPurchase else { return false }
            let first = try await provider.getAvailablePurchases(nil).first { $0.id == purchased.id }
            let second = try await provider.getAvailablePurchases(nil).first { $0.id == purchased.id }
            guard let first, let second, case .purchaseIos = first, case .purchaseIos = second else { return false }
            return first.purchaseToken?.isEmpty == false && first.purchaseToken == purchased.purchaseToken
                && second.purchaseToken == purchased.purchaseToken
                && first.storeId == factory.storeId && second.storeId == factory.storeId
                && first.store == purchased.store && second.store == purchased.store
        }
        await check("completion.finish-is-idempotent") {
            guard let purchased = ownedPurchase else { return false }
            try await provider.finishTransaction(purchase: purchased, isConsumable: false)
            try await provider.finishTransaction(purchase: purchased, isConsumable: false)
            return true
        }
        for capability in capabilities {
            // Unknown capabilities already failed above, before any early return.
            guard let id = ProviderBehaviors.capabilities[capability] else { continue }
            await check(id) {
                let probe = EventProbe<ProviderEvent>()
                let subscription = capability == "subscriptionBillingIssue"
                    ? provider.subscriptionBillingIssueListener { probe.receive(.purchase($0)) }
                    : provider.purchaseUpdatedListener({ probe.receive(.purchase($0)) }, options: nil)
                let errors = provider.purchaseErrorListener { probe.receive(.error($0)) }
                defer { provider.removeListener(subscription); provider.removeListener(errors) }
                if capability == "offerCodeRedemption", let returned = try await provider.openRedeemOfferCode() {
                    guard returned.storeId == factory.storeId,
                          returned.store == expectedStore,
                          returned.purchaseState == .purchased else { return false }
                }
                do { try await self.adapter.triggerCapability(capability) }
                catch let error as PurchaseError where capability == "pendingPurchases" && error.code == .deferredPayment {
                    probe.receive(.error(error))
                }
                let event = try await probe.next(timeout: self.timeout)
                if capability == "pendingPurchases" {
                    try await Task.sleep(nanoseconds: UInt64(self.timeout * 1_000_000_000))
                    return probe.receivedValues.allSatisfy { event in
                        switch event {
                        case .error(let error): return error.code == .deferredPayment
                        case .purchase(let purchase):
                            guard case .purchaseIos(let ios) = purchase else { return false }
                            return purchase.storeId == factory.storeId
                                && purchase.store == expectedStore
                                && purchase.purchaseState == .pending
                                && !self.adapter.toActiveSubscription(ios).isActive
                        }
                    }
                }
                switch event {
                case .error(let error):
                    return capability == "pendingPurchases" && error.code == .deferredPayment
                case .purchase(let purchase):
                    guard case .purchaseIos(let ios) = purchase, purchase.storeId == factory.storeId,
                          purchase.store == expectedStore else { return false }
                    if capability == "offerCodeRedemption" { return purchase.purchaseState == .purchased }
                    let expectedActive = self.adapter.billingIssueRetainsEntitlement(ios)
                    return (purchase.purchaseState == .purchased || !expectedActive)
                        && self.adapter.toActiveSubscription(ios).isActive == expectedActive
                }
            }
        }
        await check("provider.disconnect") { try await provider.endConnection() }
        return report()
    }

    private func purchase() async throws -> Purchase {
        let probe = EventProbe<Purchase>()
        let subscription = adapter.provider.purchaseUpdatedListener({ probe.receive($0) }, options: nil)
        defer { adapter.provider.removeListener(subscription) }
        let request = try OpenIapSerialization.decode(object: [
            "type": "in-app", "requestPurchase": ["apple": ["sku": adapter.testProductId]],
        ], as: RequestPurchaseProps.self)
        _ = try await adapter.provider.requestPurchase(request)
        return try await probe.next(timeout: timeout)
    }

    private func fixture(state: PurchaseState = .purchased, sku: String = "conformance.product") throws -> PurchaseIOS {
        try OpenIapSerialization.decode(object: [
            "id": "txn-\(sku)", "transactionId": "txn-\(sku)", "productId": sku,
            "store": expectedStore.rawValue, "storeId": adapter.factory.storeId,
            "quantity": 1, "isAutoRenewing": true, "currentPlanId": sku, "purchaseState": state.rawValue,
            "purchaseToken": "token-\(sku)", "transactionDate": 1_700_000_000_000.0,
        ], as: PurchaseIOS.self)
    }
}
