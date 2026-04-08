/**************************************************************************/
/*  GodotIapHelper.swift                                                  */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT IAP                                  */
/*                     https://github.com/hyochan/godot-iap               */
/**************************************************************************/
/* Copyright (c) 2024-present                                             */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

import Foundation
import OpenIAP

/// Helper utilities for GodotIap plugin.
/// Provides parsing functions for request parameters and sanitization utilities.
/// Mirrors ExpoIapHelper for consistency across platforms.
enum GodotIapHelper {

    // MARK: - Sanitization

    /// Sanitize a dictionary by removing null values.
    /// Similar to ExpoIapHelper.sanitizeDictionary() for consistency.
    static func sanitizeDictionary(_ dictionary: [String: Any?]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in dictionary {
            if let value {
                result[key] = value
            }
        }
        return result
    }

    /// Sanitize an array of dictionaries by removing null values from each.
    static func sanitizeArray(_ array: [[String: Any?]]) -> [[String: Any]] {
        array.map { sanitizeDictionary($0) }
    }

    /// Overload to support already-sanitized payloads (e.g., serialized OpenIAP responses)
    static func sanitizeDictionary(_ dictionary: [String: Any]) -> [String: Any] {
        dictionary
    }

    /// Overload to support already-sanitized arrays
    static func sanitizeArray(_ array: [[String: Any]]) -> [[String: Any]] {
        array
    }

    // MARK: - Parsing

    /// Parse product query type from string.
    /// Handles various formats: "subs", "in-app", "inapp", "all"
    static func parseProductQueryType(_ rawValue: String?) -> ProductQueryType {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty
        else {
            return .all
        }
        switch raw.lowercased() {
        case "inapp", "in-app", ProductQueryType.inApp.rawValue:
            return .inApp
        case "subs", "subscription", ProductQueryType.subs.rawValue:
            return .subs
        case ProductQueryType.all.rawValue:
            return .all
        default:
            return .all
        }
    }

    /// Decode ProductRequest from JSON dictionary.
    static func decodeProductRequest(from payload: [String: Any]) throws -> ProductRequest {
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = parseProductQueryType(payload["type"] as? String)
            return try OpenIapSerialization.productRequest(skus: skus, type: type)
        }

        // Handle indexed SKUs (0, 1, 2, ...)
        let indexedSkus = payload.keys
            .compactMap { Int($0) }
            .sorted()
            .compactMap { payload[String($0)] as? String }

        if !indexedSkus.isEmpty {
            return try OpenIapSerialization.productRequest(skus: indexedSkus, type: .all)
        }

        // Try direct decode
        if let request = try? OpenIapSerialization.decode(object: payload, as: ProductRequest.self) {
            return request
        }

        throw PurchaseError.emptySkuList()
    }

    /// Decode RequestPurchaseProps from JSON dictionary.
    static func decodeRequestPurchaseProps(from payload: [String: Any]) throws -> RequestPurchaseProps {
        // Check for explicit requestPurchase or requestSubscription
        if payload["requestPurchase"] != nil || payload["requestSubscription"] != nil {
            return try OpenIapSerialization.decode(object: payload, as: RequestPurchaseProps.self)
        }

        // Handle "request" wrapper
        if let request = payload["request"] {
            let parsedType = parseProductQueryType(payload["type"] as? String)
            let purchaseType: ProductQueryType = parsedType == .all ? .inApp : parsedType
            var normalized: [String: Any] = ["type": purchaseType.rawValue]
            switch purchaseType {
            case .subs:
                normalized["requestSubscription"] = request
            case .inApp:
                normalized["requestPurchase"] = request
            case .all:
                break
            }
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        // Handle simple SKU-based request
        if payload["sku"] != nil {
            let normalized: [String: Any] = [
                "type": ProductQueryType.inApp.rawValue,
                "requestPurchase": ["ios": payload],
            ]
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid request payload")
    }
}
