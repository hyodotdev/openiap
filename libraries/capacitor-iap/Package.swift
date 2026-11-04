// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorIap",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapacitorIap", targets: ["CapacitorIapPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/hyodotdev/openiap.git", exact: "4.0.9"),
    ],
    targets: [
        .target(
            name: "CapacitorIapPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "OpenIAP", package: "OpenIAP"),
            ],
            path: "ios/Sources/CapacitorIapPlugin"
        ),
        .testTarget(
            name: "CapacitorIapPluginTests",
            dependencies: ["CapacitorIapPlugin"],
            path: "ios/Tests/CapacitorIapPluginTests"
        ),
    ]
)
