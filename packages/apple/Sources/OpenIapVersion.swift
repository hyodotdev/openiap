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

    /// Source-compatibility alias for the 3.4.0 name.
    @available(*, deprecated, message: "Use clientProtocolVersion. Scheduled for removal in client protocol 1.0.0.")
    public static var specVersion: String {
        clientProtocolVersion
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
