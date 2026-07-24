/**************************************************************************/
/*  GodotIapHelper.swift                                                  */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT IAP                                  */
/*                     https://github.com/hyodotdev/openiap               */
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

    /// Parse an OpenIAP product query type without silently changing an
    /// unknown value into another query class.
    static func parseProductQueryType(
        _ rawValue: String?,
        defaultType: ProductQueryType = .all,
        allowAll: Bool = true
    ) throws -> ProductQueryType {
        guard let raw = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty
        else {
            return defaultType
        }

        let parsed: ProductQueryType
        switch raw.lowercased() {
        case ProductQueryType.inApp.rawValue:
            parsed = .inApp
        case ProductQueryType.subs.rawValue:
            parsed = .subs
        case ProductQueryType.all.rawValue:
            parsed = .all
        case "inapp", "in_app":
            warnLegacyWireInput(raw, replacement: ProductQueryType.inApp.rawValue)
            parsed = .inApp
        case "subscription", "subscriptions":
            warnLegacyWireInput(raw, replacement: ProductQueryType.subs.rawValue)
            parsed = .subs
        default:
            throw PurchaseError.make(
                code: .developerError,
                message: "Unknown product query type '\(rawValue ?? "")'. Expected in-app, subs, or all."
            )
        }

        if !allowAll, parsed == .all {
            throw PurchaseError.make(
                code: .developerError,
                message: "Product query type 'all' is not valid for a purchase request."
            )
        }
        return parsed
    }

    /// Decode ProductRequest from JSON dictionary.
    static func decodeProductRequest(from payload: [String: Any]) throws -> ProductRequest {
        let hasIndexedSkus = payload.keys.contains { Int($0) != nil }
        if hasIndexedSkus {
            warnLegacyWireInput("indexed SKU keys", replacement: "skus")
        }
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = try parseProductQueryType(
                payload["type"] as? String,
                defaultType: .all
            )
            return try OpenIapSerialization.productRequest(skus: skus, type: type)
        }

        // Handle indexed SKUs (0, 1, 2, ...)
        let indexedSkus = payload.keys
            .compactMap { Int($0) }
            .sorted()
            .compactMap { payload[String($0)] as? String }

        if !indexedSkus.isEmpty {
            let type = try parseProductQueryType(
                payload["type"] as? String,
                defaultType: .all
            )
            return try OpenIapSerialization.productRequest(skus: indexedSkus, type: type)
        }

        // Try direct decode
        var normalized = payload
        if payload["type"] != nil {
            normalized["type"] = try parseProductQueryType(
                payload["type"] as? String,
                defaultType: .all
            ).rawValue
        }
        if let request = try? OpenIapSerialization.decode(object: normalized, as: ProductRequest.self) {
            return request
        }

        throw PurchaseError.emptySkuList()
    }

    /// Decode RequestPurchaseProps from JSON dictionary.
    static func decodeRequestPurchaseProps(from payload: [String: Any]) throws -> RequestPurchaseProps {
        if payload["request"] != nil {
            warnLegacyWireInput(
                "request",
                replacement: "requestPurchase or requestSubscription"
            )
        }
        if payload["sku"] != nil {
            warnLegacyWireInput(
                "top-level sku purchase payload",
                replacement: "requestPurchase.apple.sku"
            )
        }

        // Check for explicit requestPurchase or requestSubscription
        if payload["requestPurchase"] != nil || payload["requestSubscription"] != nil {
            if payload["requestPurchase"] != nil, payload["requestSubscription"] != nil {
                throw PurchaseError.make(
                    code: .developerError,
                    message: "Choose either requestPurchase or requestSubscription, not both."
                )
            }
            var normalized = payload
            let hasSubscription = payload["requestSubscription"] != nil
            let branch = hasSubscription ? "requestSubscription" : "requestPurchase"
            if let platformPayload = payload[branch] {
                normalized[branch] = normalizeApplePlatformPayload(platformPayload)
            }
            normalized["type"] = try parseProductQueryType(
                payload["type"] as? String,
                defaultType: hasSubscription ? .subs : .inApp,
                allowAll: false
            ).rawValue
            warnDeprecatedPurchaseFlag(in: payload)
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        // Handle "request" wrapper
        if let request = payload["request"] {
            let purchaseType = try parseProductQueryType(
                payload["type"] as? String,
                defaultType: .inApp,
                allowAll: false
            )
            var normalized: [String: Any] = ["type": purchaseType.rawValue]
            switch purchaseType {
            case .subs:
                normalized["requestSubscription"] = normalizeApplePlatformPayload(request)
            case .inApp:
                normalized["requestPurchase"] = normalizeApplePlatformPayload(request)
            case .all:
                break
            }
            warnDeprecatedPurchaseFlag(in: payload)
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        // Handle simple SKU-based request
        if payload["sku"] != nil {
            let normalized: [String: Any] = [
                "type": ProductQueryType.inApp.rawValue,
                "requestPurchase": ["apple": payload],
            ]
            return try OpenIapSerialization.decode(object: normalized, as: RequestPurchaseProps.self)
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid request payload")
    }

    private static func normalizeApplePlatformPayload(_ payload: Any) -> Any {
        guard var platforms = payload as? [String: Any] else {
            return payload
        }
        if let legacy = platforms["ios"] {
            warnLegacyWireInput("ios", replacement: "apple")
            if platforms["apple"] == nil {
                platforms["apple"] = legacy
            }
            platforms.removeValue(forKey: "ios")
        }
        return platforms
    }

    private static func warnDeprecatedPurchaseFlag(in payload: [String: Any]) {
        if payload["useAlternativeBilling"] != nil {
            warnLegacyWireInput(
                "useAlternativeBilling",
                replacement: "enableBillingProgramAndroid in InitConnectionConfig"
            )
        }
    }

    private static func warnLegacyWireInput(
        _ legacyName: String,
        replacement: String
    ) {
        GodotIapLog.deprecation(
            "wire:\(legacyName)",
            "`\(legacyName)` is deprecated and will be removed in godot-iap 3.0.0; " +
                "use `\(replacement)` instead."
        )
    }
}
