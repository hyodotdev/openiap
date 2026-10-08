// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "FixtureProvider",
    platforms: [.iOS(.v15), .macOS(.v14)],
    products: [.library(name: "FixtureProvider", targets: ["FixtureProvider"])],
    dependencies: [.package(name: "OpenIAP", path: "../../../..")],
    targets: [
        .target(name: "FixtureProvider", dependencies: [.product(name: "OpenIAP", package: "OpenIAP")], plugins: ["FixtureBuildMetadata"]),
        .executableTarget(name: "FixtureBuildMetadataGenerator"),
        .plugin(name: "FixtureBuildMetadata", capability: .buildTool(), dependencies: ["FixtureBuildMetadataGenerator"]),
        .testTarget(name: "FixtureProviderTests", dependencies: ["FixtureProvider", .product(name: "OpenIapConformance", package: "OpenIAP")]),
    ]
)
