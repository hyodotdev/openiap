/**************************************************************************/
/*  GodotIapLog.swift                                                     */
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
#if canImport(os)
import os
#endif

/// Internal logging utility for GodotIap plugin.
/// This enum is intentionally `internal` as it's only used within the GodotIap module.
///
/// Logs are only visible when DEBUG is set to true (during library development).
/// Token values are automatically hidden for security.
///
/// - Note: `setEnabled` and `setHandler` should be called once at app startup
///   before any logging occurs. They are not thread-safe for concurrent writes.
enum GodotIapLog {
    enum Level: String {
        case debug
        case info
        case warn
        case error
    }

    /// Set to true during library development to enable debug logging.
    /// Should be false for production releases.
    private static var isEnabled: Bool = {
        #if DEBUG
        true
        #else
        false
        #endif
    }()

    private static var customHandler: ((Level, String) -> Void)?

    #if canImport(os)
    private static let logger = Logger(subsystem: "dev.hyo.godot-iap", category: "GodotIap")
    #endif

    static func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }

    static func setHandler(_ handler: ((Level, String) -> Void)?) {
        customHandler = handler
    }

    static func debug(_ message: String) { log(.debug, message) }
    static func info(_ message: String) { log(.info, message) }
    static func warn(_ message: String) { log(.warn, message) }
    static func error(_ message: String) { log(.error, message) }

    static func payload(_ name: String, payload: Any?) {
        debug("\(name) payload: \(stringify(payload))")
    }

    static func result(_ name: String, value: Any?) {
        debug("\(name) result: \(stringify(value))")
    }

    static func failure(_ name: String, error: Error) {
        GodotIapLog.error("\(name) failed: \(error.localizedDescription)")
    }

    private static func log(_ level: Level, _ message: String) {
        guard isEnabled else { return }

        if let handler = customHandler {
            handler(level, message)
            return
        }

        #if canImport(os)
        let formatted = "[GodotIap] \(message)"
        switch level {
        case .debug:
            logger.debug("\(formatted, privacy: .public)")
        case .info:
            logger.info("\(formatted, privacy: .public)")
        case .warn:
            logger.warning("\(formatted, privacy: .public)")
        case .error:
            logger.error("\(formatted, privacy: .public)")
        }
        #else
        NSLog("[GodotIap][%@] %@", level.rawValue.uppercased(), message)
        #endif
    }

    private static func stringify(_ value: Any?) -> String {
        guard let sanitized = sanitize(value) else {
            return "null"
        }

        if JSONSerialization.isValidJSONObject(sanitized),
           let data = try? JSONSerialization.data(withJSONObject: sanitized, options: []) {
            return String(data: data, encoding: .utf8) ?? String(describing: sanitized)
        }

        return String(describing: sanitized)
    }

    private static func sanitize(_ value: Any?) -> Any? {
        guard let value else { return nil }

        if let dictionary = value as? [String: Any] {
            return sanitizeDictionary(dictionary)
        }

        if let optionalDictionary = value as? [String: Any?] {
            var compact: [String: Any] = [:]
            for (key, optionalValue) in optionalDictionary {
                if let optionalValue {
                    compact[key] = optionalValue
                }
            }
            return sanitizeDictionary(compact)
        }

        if let array = value as? [Any] {
            return array.compactMap { sanitize($0) }
        }

        if let optionalArray = value as? [Any?] {
            return optionalArray.compactMap { sanitize($0) }
        }

        return value
    }

    private static func sanitizeDictionary(_ dictionary: [String: Any]) -> [String: Any] {
        var sanitized: [String: Any] = [:]
        for (key, value) in dictionary {
            if key.lowercased().contains("token") {
                sanitized[key] = "hidden"
            } else if let sanitizedValue = sanitize(value) {
                sanitized[key] = sanitizedValue
            }
        }
        return sanitized
    }
}
