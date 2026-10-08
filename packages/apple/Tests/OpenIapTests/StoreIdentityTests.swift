import XCTest
@testable import OpenIAP

final class StoreIdentityTests: XCTestCase {
    private func payload(_ store: String) -> [String: Any] {
        ["store": store, "id": "txn", "transactionId": "txn", "productId": "sku", "quantity": 1,
         "isAutoRenewing": false, "purchaseState": "purchased", "transactionDate": 1.0]
    }

    func testLegacyOfficialIdentityAndPurchaseInput() throws {
        for (store, id) in [("apple", "apple"), ("google", "play"), ("horizon", "horizon"), ("amazon", "amazon")] {
            let purchase = try OpenIapSerialization.decode(object: payload(store), as: PurchaseIOS.self)
            XCTAssertEqual(purchase.storeId, id)
            XCTAssertEqual(OpenIapSerialization.encode(purchase)["storeId"] as? String, id)
        }
        for value in [payload("apple"), ["purchaseIos": ["_0": payload("apple")]]] {
            let purchase = try OpenIapSerialization.purchaseInput(from: value)
            guard case .purchaseIos(let ios) = purchase else { return XCTFail("Expected iOS purchase") }
            XCTAssertEqual(ios.storeId, "apple")
        }
    }

    func testCommunityIdentityAndMalformedIdentity() throws {
        var value = payload("unknown")
        value["storeId"] = "community_fixture"
        XCTAssertEqual(try OpenIapSerialization.decode(object: value, as: PurchaseIOS.self).storeId, "community_fixture")
        for id in ["", "auto", "none", "unknown", "apple", "play", "google", "amazon", "horizon", "Bad id", "store\n"] {
            value["storeId"] = id
            XCTAssertThrowsError(try OpenIapSerialization.decode(object: value, as: PurchaseIOS.self))
        }
        value.removeValue(forKey: "storeId")
        XCTAssertThrowsError(try OpenIapSerialization.decode(object: value, as: PurchaseIOS.self))
        value["store"] = "apple"
        value["storeId"] = "other"
        XCTAssertThrowsError(try OpenIapSerialization.decode(object: value, as: PurchaseIOS.self))
    }
}
