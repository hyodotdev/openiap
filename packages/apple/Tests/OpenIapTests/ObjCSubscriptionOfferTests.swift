import Foundation
import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class ObjCSubscriptionOfferTests: XCTestCase {
    private let validOffer: [String: Any] = [
        "identifier": "promo",
        "keyIdentifier": "KEY",
        "nonce": "550e8400-e29b-41d4-a716-446655440000",
        "signature": "c2ln",
        "timestamp": 1_700_000_000_000,
    ]

    func testMalformedPromotionalOfferFailsInsteadOfBuyingAtFullPrice() async {
        var missingSignature = validOffer
        missingSignature["signature"] = nil
        for (offer, jws) in [
            (missingSignature, nil),
            ([:], nil),
            (nil, ["offerId": "promo"]),
            (nil, ["offerId": "promo", "jws": ""]),
        ] as [([String: Any]?, [String: Any]?)] {
            let factory = RecordingProviderFactory()
            let error = await requestSubscription(factory, offer: offer, promotionalOfferJWS: jws).error
            XCTAssertEqual((error as? PurchaseError)?.code, .developerError)
            XCTAssertEqual((error as? PurchaseError)?.productId, "sub")
            XCTAssertTrue(factory.provider.requests.isEmpty)
        }
    }

    func testWellFormedOffersReachTheProvider() async throws {
        let factory = RecordingProviderFactory()
        let error = await requestSubscription(
            factory, offer: validOffer, promotionalOfferJWS: ["offerId": "jws-promo", "jws": "a.b.c"]
        ).error
        XCTAssertNil(error)
        guard case let .subscription(platforms) = try XCTUnwrap(factory.provider.requests.first).request else {
            return XCTFail("Expected a subscription request")
        }
        let props = try XCTUnwrap(platforms.apple)
        XCTAssertEqual(props.withOffer?.identifier, "promo")
        XCTAssertEqual(props.withOffer?.timestamp, 1_700_000_000_000)
        XCTAssertEqual(props.promotionalOfferJWS?.offerId, "jws-promo")
        XCTAssertEqual(props.promotionalOfferJWS?.jws, "a.b.c")
    }

    func testRequestPurchaseWithSkuSendsSubsAsASubscriptionRequest() async throws {
        for type in ["subs", "in-app", nil] as [String?] {
            let factory = RecordingProviderFactory()
            let module = OpenIapModule(factory: factory)
            let error: Error? = await withCheckedContinuation { continuation in
                module.requestPurchaseWithSku("sku", quantity: 2, type: type) { _, error in
                    continuation.resume(returning: error)
                }
            }
            XCTAssertNil(error)
            let props = try XCTUnwrap(factory.provider.requests.first)
            switch props.request {
            case let .subscription(platforms):
                XCTAssertEqual(type, "subs")
                XCTAssertEqual(props.type, .subs)
                XCTAssertEqual(platforms.apple?.sku, "sku")
                XCTAssertEqual(platforms.apple?.quantity, 2)
            case let .purchase(platforms):
                XCTAssertNotEqual(type, "subs")
                XCTAssertEqual(props.type, .inApp)
                XCTAssertEqual(platforms.apple?.sku, "sku")
                XCTAssertEqual(platforms.apple?.quantity, 2)
            }
        }
    }

    private func requestSubscription(
        _ factory: RecordingProviderFactory,
        offer: [String: Any]?,
        promotionalOfferJWS: [String: Any]?
    ) async -> (result: Any?, error: Error?) {
        let module = OpenIapModule(factory: factory)
        return await withCheckedContinuation { continuation in
            module.requestSubscriptionWithSku(
                "sub", offer: offer, compactJWS: nil, promotionalOfferJWS: promotionalOfferJWS,
                winBackOfferId: nil, billingPlanType: nil
            ) { result, error in
                continuation.resume(returning: (result, error))
            }
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private final class RecordingProviderFactory: NSObject, OpenIapProviderFactory {
    let provider = RecordingProvider()
    required override init() { super.init() }
    var storeId: String { "community_fixture" }
    var coreVersion: String { OpenIapVersion.current }
    var clientProtocolVersion: String { OpenIapVersion.clientProtocolVersion }
    func create() throws -> any OpenIapModuleProtocol { provider }
}

@available(iOS 15.0, macOS 14.0, *)
private final class RecordingProvider: OpenIapModuleProtocol {
    private(set) var requests: [RequestPurchaseProps] = []

    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        requests.append(params)
        return nil
    }

    // MARK: - Unused
    func initConnection() async throws -> Bool { true }
    func endConnection() async throws -> Bool { true }
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult { .products(nil) }
    func restorePurchases() async throws -> Void {}
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] { [] }
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void {}
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        throw PurchaseError(code: .featureNotSupported, message: "unused")
    }
    func getStorefront() async throws -> String { "DEU" }
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] { [] }
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool { false }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {}
    func purchaseUpdatedListener(
        _ listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) -> Subscription { Subscription(eventType: .purchaseUpdated) }
    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        Subscription(eventType: .purchaseError)
    }
    func removeListener(_ subscription: Subscription) {}
    func removeAllListeners() {}
}
