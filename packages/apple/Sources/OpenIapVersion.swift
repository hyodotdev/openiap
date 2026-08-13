/// OpenIAP version management
public struct OpenIapVersion {
    /// Current OpenIAP Apple SDK version
    public static var current: String {
        OpenIapGeneratedVersion.apple
    }

    /// Current OpenIAP specification version
    public static var specVersion: String {
        OpenIapGeneratedVersion.spec
    }
}

// MARK: - Version Info

/// Namespace for OpenIAP version information
public enum OpenIapVersionInfo {
    /// Current OpenIAP Apple SDK version
    public static var sdkVersion: String {
        OpenIapVersion.current
    }

}
