// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "FixtureConsumer", platforms: [.macOS(.v14)],
    dependencies: [.package(name: "OpenIAP", path: "../../../../.."), .package(name: "FixtureProvider", path: "..")],
    targets: [.executableTarget(name: "FixtureConsumer", dependencies: [
        .product(name: "OpenIAP", package: "OpenIAP"),
        .product(name: "FixtureProvider", package: "FixtureProvider"),
    ], linkerSettings: [.unsafeFlags(["-Xlinker", "-ObjC", "-Xlinker", "-dead_strip"])])]
)
