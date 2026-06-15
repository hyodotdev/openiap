// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "flutter_inapp_purchase",
    platforms: [
        .iOS("15.0"),
    ],
    products: [
        .library(name: "flutter-inapp-purchase", targets: ["flutter_inapp_purchase"])
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework"),
        .package(url: "https://github.com/hyodotdev/openiap.git", from: "2.2.1"),
    ],
    targets: [
        .target(
            name: "flutter_inapp_purchase",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework"),
                .product(name: "OpenIAP", package: "OpenIAP"),
            ],
            path: "Sources/flutter_inapp_purchase"
        )
    ]
)
