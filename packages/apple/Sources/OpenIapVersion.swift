/// OpenIAP version management
public struct OpenIapVersion {
    /// Current OpenIAP Apple SDK version
    public static var current: String {
        OpenIapGeneratedVersion.apple
    }

    /// Client Protocol version this build implements.
    public static var clientProtocolVersion: String {
        OpenIapGeneratedVersion.clientProtocol
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
