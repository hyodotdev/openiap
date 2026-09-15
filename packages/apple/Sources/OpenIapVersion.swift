/// OpenIAP version management
public struct OpenIapVersion {
    /// Current OpenIAP Apple SDK version
    public static var current: String {
        OpenIapGeneratedVersion.apple
    }

    /// Client protocol version this build implements.
    /// Named `specVersion` for the `X-OpenIAP-Spec` header shipped SDKs send.
    public static var specVersion: String {
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
