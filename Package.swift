// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "OpenIAP",
    platforms: [
        .iOS(.v15),
        .macOS(.v14),
        .tvOS(.v16),
        .watchOS(.v8)
    ],
    products: [
        .library(
            name: "OpenIAP",
            targets: ["OpenIAP"]),
        .library(name: "OpenIapConformance", targets: ["OpenIapConformance"]),
    ],
    dependencies: [],
    targets: [
        .target(name: "OpenIapConformance", dependencies: ["OpenIAP"],
                path: "packages/conformance/apple/Sources"),
        .target(
            name: "OpenIAP",
            dependencies: [],
            path: "packages/apple/Sources",
            resources: [
                .copy("openiap-versions.json")
            ]),
        .testTarget(
            name: "OpenIapTests",
            dependencies: ["OpenIAP"],
            path: "packages/apple/Tests"),
    ],
    swiftLanguageVersions: [.v5]
)
