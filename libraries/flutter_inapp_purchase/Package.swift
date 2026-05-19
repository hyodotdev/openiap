// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "flutter_inapp_purchase",
    platforms: [
        .iOS("15.0"),
        .macOS("14.0"),
    ],
    products: [
        .library(name: "flutter_inapp_purchase", targets: ["flutter_inapp_purchase"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/hyodotdev/openiap.git",
            exact: "2.2.1"
        ),
    ],
    targets: [
        .target(
            name: "flutter_inapp_purchase",
            dependencies: [
                .product(name: "OpenIAP", package: "openiap"),
            ],
            path: "ios/Classes"
        ),
    ]
)
