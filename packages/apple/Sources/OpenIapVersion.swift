import Foundation

private final class OpenIapVersionBundleToken {}

/// OpenIAP version management
public struct OpenIapVersion {
    /// Current OpenIAP Apple SDK version
    public static var current: String {
        version(for: "apple")
    }

    /// Current OpenIAP specification version
    public static var specVersion: String {
        version(for: "spec")
    }

    /// OpenIAP GraphQL version for reference
    @available(*, deprecated, renamed: "specVersion")
    public static var gqlVersion: String {
        specVersion
    }

    private static func version(for key: String) -> String {
        let versionURL: URL?

        #if SWIFT_PACKAGE
        versionURL = Bundle.module.url(forResource: "openiap-versions", withExtension: "json")
        #else
        versionURL = cocoaPodsVersionURL()
        #endif

        guard
            let url = versionURL,
            let data = try? Data(contentsOf: url),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let version = json[key] as? String,
            !version.isEmpty
        else {
            fatalError("OpenIAP: missing \(key) version in openiap-versions.json")
        }
        return version
    }

    private static func cocoaPodsVersionURL() -> URL? {
        let bundles = [Bundle(for: OpenIapVersionBundleToken.self), Bundle.main] + Bundle.allBundles

        for bundle in bundles {
            if let url = bundle.url(forResource: "openiap-versions", withExtension: "json") {
                return url
            }

            if
                let bundleURL = bundle.url(forResource: "OpenIAP", withExtension: "bundle"),
                let resourceBundle = Bundle(url: bundleURL),
                let url = resourceBundle.url(forResource: "openiap-versions", withExtension: "json")
            {
                return url
            }
        }

        return nil
    }
}

// MARK: - Version Info

/// Namespace for OpenIAP version information
public enum OpenIapVersionInfo {
    /// Current OpenIAP Apple SDK version
    public static var sdkVersion: String {
        OpenIapVersion.current
    }

    /// OpenIAP GraphQL version for reference
    @available(*, deprecated, renamed: "specVersion")
    public static var gqlVersion: String {
        OpenIapVersion.specVersion
    }
}
