// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "_library",
  platforms: [
    .iOS("15.0")
  ],
  products: [
    .library(
      name: "_library",
      type: .none,
      targets: ["_library"]
    )
  ],
  dependencies: [
    .package(
      path: "../../../../../../../packages/apple"
    )
  ],
  targets: [
    .target(
      name: "_library",
      dependencies: [
        .product(
          name: "OpenIAP",
          package: "apple"
        )
      ]
    )
  ]
)
