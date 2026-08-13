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

    /// Current OpenIAP specification version, or nil when the bundled
    /// `openiap-versions.json` cannot be located. Callers on the purchase path
    /// must use this rather than `specVersion`: the resource is bundled
    /// differently by SwiftPM, CocoaPods and the xcframework, and reporting a
    /// version is never worth trapping in the middle of a purchase.
    public static var specVersionIfAvailable: String? {
        optionalVersion(for: "spec")
    }

    private static func version(for key: String) -> String {
        guard let version = optionalVersion(for: key) else {
            fatalError("OpenIAP: missing \(key) version in openiap-versions.json")
        }
        return version
    }

    private static func optionalVersion(for key: String) -> String? {
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
            return nil
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

}
