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
    @TaskLocal static var completionErrorOwner: CompletionErrorOwner?

    // Only errors represented by a failed completion suppress their listener callbacks.
    final class CompletionErrorOwner: @unchecked Sendable {
        private let lock = NSLock()
        private var completionSucceeded: Bool?
        private var callbacks: [@Sendable () -> Void] = []

        func receive(_ callback: @escaping @Sendable () -> Void) {
            lock.lock()
            guard let succeeded = completionSucceeded else {
                callbacks.append(callback)
                lock.unlock()
                return
            }
            lock.unlock()
            if succeeded { callback() }
        }

        func complete(succeeded: Bool) {
            lock.lock()
            completionSucceeded = succeeded
            let pending = callbacks
            callbacks.removeAll()
            lock.unlock()
            if succeeded {
                for callback in pending { callback() }
            }
        }
    }

    static func withCompletionErrors<T>(_ operation: () async throws -> T) async rethrows -> T {
        let owner = CompletionErrorOwner()
        do {
            let result = try await $completionErrorOwner.withValue(owner) {
                try await operation()
            }
            owner.complete(succeeded: true)
            return result
        } catch {
            owner.complete(succeeded: false)
            throw error
        }
    }

    static func errorCode(_ error: Error, fallback: ErrorCode = .serviceError) -> String {
        (error as? PurchaseError)?.code.rawValue ?? fallback.rawValue
    }

    // Hand-built finish inputs carry blank store identity; stamp the connected
    // provider's so decoding reaches the purchase token.
    static func withProviderStoreIdentity(
        _ purchase: [String: Any],
        providerStoreId: () -> String?
    ) -> [String: Any] {
        let storeIdValue = purchase["storeId"]
        if let rawId = storeIdValue as? String, !isBlank(rawId) {
            return purchase
        }
        if storeIdValue != nil, !(storeIdValue is NSNull), !(storeIdValue is String) {
            return purchase
        }
        let storeRaw = trimmed((purchase["store"] as? String) ?? "")
        switch storeRaw {
        case IapStore.apple.rawValue, IapStore.google.rawValue,
            IapStore.horizon.rawValue, IapStore.amazon.rawValue:
            // An official store with a blank id decodes once the blank key is gone.
            guard storeIdValue is String else { return purchase }
            var dropped = purchase
            dropped.removeValue(forKey: "storeId")
            return dropped
        default:
            guard let storeId = providerStoreId(), !isBlank(storeId) else {
                return purchase
            }
            var stamped = purchase
            stamped["store"] = legacyStore(for: storeId)
            stamped["storeId"] = storeId
            return stamped
        }
    }

    private static func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isBlank(_ value: String) -> Bool {
        trimmed(value).isEmpty
    }

    private static func legacyStore(for providerStoreId: String) -> String {
        switch providerStoreId {
        case StoreIds.Apple: return IapStore.apple.rawValue
        case StoreIds.Play: return IapStore.google.rawValue
        case StoreIds.Horizon: return IapStore.horizon.rawValue
        case StoreIds.Amazon: return IapStore.amazon.rawValue
        default: return IapStore.unknown.rawValue
        }
    }

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

    // Preserve compatibility with the currently published native OpenIAP
    // package while making authoritative query serialization all-or-nothing.
    // Its non-throwing helpers return an empty dictionary on encoding failure.
    static func encodeRequired<T: Encodable>(_ value: T) throws -> [String: Any] {
        let encoded = OpenIapSerialization.encode(value)
        guard !encoded.isEmpty else {
            throw PurchaseError.make(
                code: .billingResponseJsonParseError,
                message: "Failed to serialize native \(T.self) payload"
            )
        }
        return encoded
    }

    static func purchasesRequired(_ purchases: [Purchase]) throws -> [[String: Any]] {
        try purchases.map { purchase in
            let encoded = OpenIapSerialization.purchase(purchase)
            guard !encoded.isEmpty else {
                throw PurchaseError.make(
                    code: .billingResponseJsonParseError,
                    message: "Failed to serialize native purchase payload"
                )
            }
            return encoded
        }
    }

    // MARK: - Parsing

    /// Parse an OpenIAP product query type without silently changing an
    /// unknown value into another query class.
    static func parseProductQueryType(
        _ rawValue: Any?,
        defaultType: ProductQueryType = .all,
        allowAll: Bool = true
    ) throws -> ProductQueryType {
        if rawValue == nil || rawValue is NSNull {
            return defaultType
        }
        guard let stringValue = rawValue as? String else {
            throw PurchaseError.make(
                code: .developerError,
                message: "Product query type must be a string."
            )
        }
        let raw = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty {
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
        default:
            throw PurchaseError.make(
                code: .developerError,
                message: "Unknown product query type '\(stringValue)'. Expected in-app, subs, or all."
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
        if let skus = payload["skus"] as? [String], !skus.isEmpty {
            let type = try parseProductQueryType(
                payload["type"],
                defaultType: .all
            )
            return try OpenIapSerialization.productRequest(skus: skus, type: type)
        }

        // Try direct decode
        var normalized = payload
        if payload["type"] != nil {
            normalized["type"] = try parseProductQueryType(
                payload["type"],
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
        // Check for explicit requestPurchase or requestSubscription.
        if payload["requestPurchase"] != nil || payload["requestSubscription"] != nil {
            if payload["requestPurchase"] != nil, payload["requestSubscription"] != nil {
                throw PurchaseError.make(
                    code: .developerError,
                    message: "Choose either requestPurchase or requestSubscription, not both."
                )
            }
            var normalized = payload
            let hasSubscription = payload["requestSubscription"] != nil
            normalized["type"] = try parseProductQueryType(
                payload["type"],
                defaultType: hasSubscription ? .subs : .inApp,
                allowAll: false
            ).rawValue
            let request = try OpenIapSerialization.decode(
                object: normalized,
                as: RequestPurchaseProps.self
            )
            let hasAppleRequest: Bool
            switch request.request {
            case .purchase(let platforms):
                hasAppleRequest = platforms.apple != nil
            case .subscription(let platforms):
                hasAppleRequest = platforms.apple != nil
            }
            guard hasAppleRequest else {
                throw PurchaseError.make(
                    code: .developerError,
                    message: "An apple request is required"
                )
            }
            return request
        }

        throw PurchaseError.make(code: .developerError, message: "Invalid request payload")
    }
}
