import StoreKit
import XCTest
@testable import OpenIAP

/// StoreKit values reach the wire as the strings the schema and docs promise,
/// never as Swift debug descriptions such as "RenewalState(rawValue: 1)".
final class StoreKitValueMappingTests: XCTestCase {
    func testSubscriptionStateUsesStoreKitCaseNames() {
        let expected: [(StoreKit.Product.SubscriptionInfo.RenewalState, String)] = [
            (.subscribed, "subscribed"),
            (.expired, "expired"),
            (.inBillingRetryPeriod, "inBillingRetryPeriod"),
            (.inGracePeriod, "inGracePeriod"),
            (.revoked, "revoked"),
            (.init(rawValue: 99), "unknown"),
        ]
        for (state, name) in expected {
            XCTAssertEqual(StoreKitTypesBridge.subscriptionStateIOS(from: state), name)
        }
    }

    func testPriceIncreaseStatusUsesSchemaValues() {
        XCTAssertEqual(StoreKitTypesBridge.priceIncreaseStatusIOS(from: .agreed), "AGREED")
        XCTAssertEqual(StoreKitTypesBridge.priceIncreaseStatusIOS(from: .pending), "PENDING")
        XCTAssertNil(StoreKitTypesBridge.priceIncreaseStatusIOS(from: .noIncreasePending))
    }

    func testRenewalOfferTypeUsesAppStoreNames() {
        XCTAssertEqual(StoreKitTypesBridge.offerTypeNameIOS(from: .introductory), "INTRODUCTORY")
        XCTAssertEqual(StoreKitTypesBridge.offerTypeNameIOS(from: .promotional), "PROMOTIONAL")
        XCTAssertEqual(StoreKitTypesBridge.offerTypeNameIOS(from: .code), "SUBSCRIPTION_OFFER_CODE")
        XCTAssertEqual(StoreKitTypesBridge.offerTypeNameIOS(from: .init(rawValue: 99)), "UNKNOWN")
        #if compiler(>=6.1)
        XCTAssertEqual(StoreKitTypesBridge.offerTypeNameIOS(from: .winBack), "WIN_BACK")
        #endif
    }

    func testPurchaseOfferTypeKeepsTheKebabCaseEnumSpelling() {
        var offerTypes: [(StoreKit.Transaction.OfferType, SubscriptionOfferTypeIOS)] = [
            (.introductory, .introductory),
            (.promotional, .promotional),
        ]
        #if compiler(>=6.1)
        offerTypes.append((.winBack, .winBack))
        #endif
        for (storeKitType, openIapType) in offerTypes {
            XCTAssertEqual(StoreKitTypesBridge.purchaseOfferTypeStringIOS(from: storeKitType), openIapType.rawValue)
        }
        XCTAssertEqual(StoreKitTypesBridge.purchaseOfferTypeStringIOS(from: .code), "subscription-offer-code")
        XCTAssertEqual(StoreKitTypesBridge.purchaseOfferTypeStringIOS(from: .init(rawValue: 99)), "unknown")
    }
}
