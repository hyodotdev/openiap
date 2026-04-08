// swift-tools-version: 5.9

import PackageDescription

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
        .package(url: "https://github.com/hyodotdev/openiap.git", from: "1.2.5")
    ],
    targets: [
        .target(
            name: "InAppPurchaseBridge",
            dependencies: [
                .product(name: "OpenIAP", package: "openiap")
            ])
    ]
)
