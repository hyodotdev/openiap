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
    ],
    dependencies: [],
    targets: [
        .target(
            name: "OpenIAP",
            dependencies: [],
            path: "Sources",
            resources: [
                .copy("openiap-versions.json")
            ]),
        .testTarget(
            name: "OpenIapTests",
            dependencies: ["OpenIAP"],
            path: "Tests"),
    ],
    swiftLanguageVersions: [.v5]
)