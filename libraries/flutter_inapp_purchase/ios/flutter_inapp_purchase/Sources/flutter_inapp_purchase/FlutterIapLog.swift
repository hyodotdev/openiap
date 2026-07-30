import Foundation
#if canImport(os)
import os
#endif

enum FlutterIapLog {
    private static let sensitiveKeyFragments: Set<String> = [
        "token",
        "apikey",
        "secret",
        "jws",
        "receipt",
        "clientpayload",
        "userid",
        "password",
        "bearer",
    ]
    private static let sensitiveAuthKeys: Set<String> = [
        "auth",
        "authorization",
        "authheader",
    ]

    enum Level: String {
        case debug
        case info
        case warn
        case error
    }

    private static var isEnabled: Bool = {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }()

    private static var handler: ((Level, String) -> Void)?
    static func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }

    static func setHandler(_ newHandler: ((Level, String) -> Void)?) {
        handler = newHandler
    }

    static func debug(_ message: String) { log(.debug, message) }
    static func info(_ message: String) { log(.info, message) }
    static func warn(_ message: String) { log(.warn, message) }
    static func error(_ message: String) { log(.error, message) }

    static func payload(_ name: String, payload: Any?) {
        log(.debug, "\(name) payload: \(stringify(payload))")
    }

    static func result(_ name: String, value: Any?) {
        log(.debug, "\(name) result: \(stringify(value))")
    }

    static func failure(_ name: String, error: Error) {
        log(.error, "\(name) failed: \(error.localizedDescription)")
    }

    private static func log(_ level: Level, _ message: String) {
        guard isEnabled else { return }

        emit(level, message)
    }

    private static func emit(_ level: Level, _ message: String) {
        if let handler {
            handler(level, message)
            return
        }

        #if canImport(os)
        if #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *) {
            let logger = Logger(subsystem: "dev.hyo.flutter-inapp-purchase", category: "FlutterIap")
            let formatted = "[FlutterIap] \(message)"
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
        } else {
            NSLog("[FlutterIap][%@] %@", level.rawValue.uppercased(), message)
        }
        #else
        NSLog("[FlutterIap][%@] %@", level.rawValue.uppercased(), message)
        #endif
    }

    private static func stringify(_ value: Any?) -> String {
        guard let bridgeSafeValue = FlutterIapHelper.sanitizeValue(value),
              let sanitized = sanitizeForLogging(bridgeSafeValue) else {
            return "null"
        }

        if let jsonObject = sanitized as? [String: Any],
           JSONSerialization.isValidJSONObject(jsonObject),
           let data = try? JSONSerialization.data(withJSONObject: jsonObject, options: []) {
            return String(data: data, encoding: .utf8) ?? String(describing: sanitized)
        }

        if let jsonArray = sanitized as? [Any],
           JSONSerialization.isValidJSONObject(jsonArray),
           let data = try? JSONSerialization.data(withJSONObject: jsonArray, options: []) {
            return String(data: data, encoding: .utf8) ?? String(describing: sanitized)
        }

        return String(describing: sanitized)
    }

    private static func sanitizeForLogging(_ value: Any?) -> Any? {
        guard let value else { return nil }

        if let string = value as? String {
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.first == "{" || trimmed.first == "[",
                  let data = trimmed.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) else {
                return string
            }
            return sanitizeForLogging(json) ?? string
        }

        if let dictionary = value as? [String: Any] {
            return dictionary.reduce(into: [String: Any]()) { redacted, entry in
                let key = entry.key.lowercased().filter { $0.isLetter || $0.isNumber }
                if sensitiveKeyFragments.contains(where: { key.contains($0) }) ||
                    sensitiveAuthKeys.contains(key) {
                    redacted[entry.key] = "hidden"
                } else {
                    redacted[entry.key] = sanitizeForLogging(entry.value)
                }
            }
        }

        if let array = value as? [Any] {
            return array.compactMap { sanitizeForLogging($0) }
        }

        return value
    }
}
