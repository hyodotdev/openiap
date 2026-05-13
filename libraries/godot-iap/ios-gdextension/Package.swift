// swift-tools-version: 5.9
import PackageDescription
import Foundation

// Read OpenIAP version from openiap-versions.json
let openIapVersion: String = {
    let packageDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    let versionsFile = packageDir.deletingLastPathComponent().appendingPathComponent("openiap-versions.json")

    guard let data = try? Data(contentsOf: versionsFile),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
          let version = json["apple"] else {
        fatalError("Failed to read apple version from openiap-versions.json")
    }
    return version
}()

let swiftSettings: [SwiftSetting] = [
    .unsafeFlags([
        "-Xfrontend", "-internalize-at-link",
        "-Xfrontend", "-lto=llvm-full",
        "-Xfrontend", "-conditional-runtime-records"
    ])
]

let linkerSettings: [LinkerSetting] = [
    .unsafeFlags(["-Xlinker", "-dead_strip"])
]

let packageDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let repoRoot = packageDir
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
let localOpenIapPackage = repoRoot.appendingPathComponent("packages/apple")
let openIapDependency: Package.Dependency
if FileManager.default.fileExists(
    atPath: localOpenIapPackage.appendingPathComponent("Package.swift").path
) {
    openIapDependency = .package(name: "openiap", path: localOpenIapPackage.path)
} else {
    openIapDependency = .package(
        url: "https://github.com/hyodotdev/openiap.git",
        .upToNextMinor(from: Version(stringLiteral: openIapVersion))
    )
}

let package = Package(
    name: "GodotIap",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "GodotIap", type: .dynamic, targets: ["GodotIap"]),
    ],
    dependencies: [
        .package(name: "SwiftGodot", path: "../SwiftGodot"),
        openIapDependency,
    ],
    targets: [
        .target(
            name: "GodotIap",
            dependencies: [
                .product(name: "SwiftGodotRuntime", package: "SwiftGodot"),
                .product(name: "OpenIAP", package: "openiap")
            ],
            swiftSettings: swiftSettings,
            linkerSettings: linkerSettings
        ),
    ]
)
