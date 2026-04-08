import Foundation
import StoreKit

@available(iOS 15.0, *)
func serializeTransaction(_ transaction: Transaction, jwsRepresentationIOS: String? = nil) -> [String: Any?] {
    let _ =
        transaction.productType.rawValue.lowercased().contains("renewable")
        || transaction.expirationDate != nil

    var transactionReasonIOS: String? = nil
    var webOrderLineItemId: Int? = nil
    var jsonData: [String: Any]? = nil
    var jwsReceipt: String = ""

    let jsonRep = transaction.jsonRepresentation
    jwsReceipt = String(data: jsonRep, encoding: .utf8) ?? ""

    do {
        if let jsonObj = try JSONSerialization.jsonObject(with: jsonRep) as? [String: Any] {
            jsonData = jsonObj
            transactionReasonIOS = jsonObj["transactionReason"] as? String
            if let webOrderId = jsonObj["webOrderLineItemId"] as? NSNumber {
                webOrderLineItemId = webOrderId.intValue
            }
        }
    } catch {
        print("Error parsing JSON representation: \(error)")
    }

    var purchaseMap: [String: Any?] = [
        "id": String(transaction.id),
        "productId": transaction.productID,
        "ids": [transaction.productID],
        "transactionId": String(transaction.id), // @deprecated - use id instead
        "transactionDate": transaction.purchaseDate.timeIntervalSince1970,
        "transactionReceipt": jwsReceipt,
        "platform": "ios",
        // Existing iOS-specific fields
        "quantityIOS": transaction.purchasedQuantity,
        "originalTransactionDateIOS": transaction.originalPurchaseDate.timeIntervalSince1970 * 1000,
        "originalTransactionIdentifierIOS": String(transaction.originalID),
        "appAccountToken": transaction.appAccountToken?.uuidString,

        "appBundleIdIOS": transaction.appBundleID,
        "productTypeIOS": transaction.productType.rawValue,
        "subscriptionGroupIdIOS": transaction.subscriptionGroupID,

        "webOrderLineItemIdIOS": webOrderLineItemId,

        "expirationDateIOS": transaction.expirationDate.map { $0.timeIntervalSince1970 * 1000 },

        "isUpgradedIOS": transaction.isUpgraded,
        "ownershipTypeIOS": transaction.ownershipType.rawValue,

        "revocationDateIOS": transaction.revocationDate.map { $0.timeIntervalSince1970 * 1000 },
        "revocationReasonIOS": transaction.revocationReason?.rawValue,
        "transactionReasonIOS": transactionReasonIOS,
        
        // NEW MISSING FIELDS ADDED
        "signedDateIOS": transaction.signedDate.timeIntervalSince1970 * 1000,
        "deviceVerificationIOS": transaction.deviceVerification?.base64EncodedString(),
        "deviceVerificationNonceIOS": transaction.deviceVerificationNonce?.uuidString,
        "offerIdIOS": transaction.offerID, // Promotional offer identifier
        "jsonRepresentationIOS": jwsReceipt, // Store the JSON representation as string
    ]

    let unifiedToken = jwsRepresentationIOS ?? String(transaction.id)

    if let jws = jwsRepresentationIOS {
        logDebug("serializeTransaction adding jwsRepresentationIOS with length: \(jws.count)")
        purchaseMap["jwsRepresentationIOS"] = jws
    } else {
        logDebug("serializeTransaction jwsRepresentationIOS is nil; falling back to transaction.id")
    }

    purchaseMap["purchaseToken"] = unifiedToken
    
    if #available(iOS 15.4, *) {
        // Add offer type if available
        purchaseMap["offerTypeIOS"] = transaction.offerType?.rawValue
        
        // Add subscription period if available
        if let period = transaction.subscriptionPeriod {
            purchaseMap["subscriptionPeriodIOS"] = period.unit.rawValue
            purchaseMap["subscriptionPeriodValueIOS"] = period.value
        }
    }
    
    if #available(iOS 16.0, *) {
        purchaseMap["environmentIOS"] = transaction.environment.rawValue
    }

    if #available(iOS 17.0, *) {
        purchaseMap["storefrontCountryCodeIOS"] = transaction.storefront.countryCode
        purchaseMap["reasonIOS"] = transaction.reason.rawValue
    }

    if #available(iOS 17.2, *) {
        if let offer = transaction.offer {
            purchaseMap["offerIOS"] = [
                "id": offer.id ?? "",
                "type": offer.type.rawValue,
                "paymentMode": offer.paymentMode?.rawValue ?? "",
            ]
        }
    }

    if #available(iOS 15.4, *), let jsonData = jsonData {
        if let price = jsonData["price"] as? NSNumber {
            purchaseMap["priceIOS"] = price.doubleValue
        }
        if let currency = jsonData["currency"] as? String {
            purchaseMap["currencyIOS"] = currency
        }
    }

    return purchaseMap
}