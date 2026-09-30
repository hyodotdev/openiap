import Foundation

/// Remembers, once per app install, that a framework library printed its
/// first-purchase notice. For OpenIAP's framework libraries only; not part of
/// the Client Protocol.
public enum OpenIapFirstPurchaseNotice {
    static let key = "dev.hyo.openiap.firstPurchaseNoticeShown"
    private static let lock = NSLock()

    /// True on the first call on this install, false on every later one.
    public static func claim(defaults: UserDefaults = .standard) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if defaults.bool(forKey: key) { return false }
        defaults.set(true, forKey: key)
        return true
    }
}
