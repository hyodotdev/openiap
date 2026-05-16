// swift-tools-version: 5.9

import Foundation
import PackageDescription

func resolveOpenIapAppleVersion() -> String {
    let packageFile = URL(fileURLWithPath: #filePath)
    let versionsFile = packageFile
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("openiap-versions.json")

    guard
        let data = try? Data(contentsOf: versionsFile),
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let version = json["apple"] as? String,
        !version.isEmpty
    else {
        fatalError("kmp-iap native bridge: failed to read apple version from openiap-versions.json")
    }
    return version
}

let openIapAppleVersion = resolveOpenIapAppleVersion()
func resolveOpenIapApplePackageVersion(_ version: String) -> Version {
    guard let packageVersion = Version(version) else {
        fatalError("kmp-iap native bridge: invalid apple version in openiap-versions.json")
    }
    return packageVersion
}

let openIapApplePackageVersion = resolveOpenIapApplePackageVersion(openIapAppleVersion)

let package = Package(
    name: "InAppPurchaseBridge",
    platforms: [
        .iOS(.v15),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "InAppPurchaseBridge",
            type: .static,
            targets: ["InAppPurchaseBridge"]),
    ],
    dependencies: [
        .package(url: "https://github.com/hyodotdev/openiap.git", from: openIapApplePackageVersion)
    ],
    targets: [
        .target(
            name: "InAppPurchaseBridge",
            dependencies: [
                .product(name: "OpenIAP", package: "openiap")
            ])
    ]
)
