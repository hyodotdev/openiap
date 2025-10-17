import Foundation

/// OpenIAP version management
public struct OpenIapVersion {
    /// Current OpenIAP Apple SDK version
    /// This version is managed in monorepo root versions.json
    public static let current: String = "1.2.23"

    /// OpenIAP GraphQL version for reference
    /// This version is managed in monorepo root versions.json
    public static let gqlVersion: String = "1.2.2"

}

// MARK: - Version Info

/// Namespace for OpenIAP version information
public enum OpenIapVersionInfo {
    /// Current OpenIAP Apple SDK version
    public static var sdkVersion: String {
        OpenIapVersion.current
    }

    /// OpenIAP GraphQL version for reference
    public static var gqlVersion: String {
        OpenIapVersion.gqlVersion
    }
}