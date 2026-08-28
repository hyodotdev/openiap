import XCTest

final class CompilerGuardTests: XCTestCase {
    func testStoreKitFeatureGuardsUseCompilerVersion() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceFiles = [
            "Sources/Helpers/StoreKitTypesBridge.swift",
            "Sources/OpenIapModule.swift",
        ]
        let forbiddenGuard = "#if " + "swi" + "ft(>="
        let forbiddenEndifComment = "#endif // " + "swi" + "ft("

        for sourceFile in sourceFiles {
            let sourceURL = packageRoot.appendingPathComponent(sourceFile)
            let source = try String(contentsOf: sourceURL, encoding: .utf8)

            XCTAssertFalse(
                source.contains(forbiddenGuard),
                "\(sourceFile) must use compiler(>=...) for StoreKit SDK feature guards so Swift 5 language-mode builds do not strip modern toolchain code."
            )
            XCTAssertFalse(
                source.contains(forbiddenEndifComment),
                "\(sourceFile) must not leave stale swift(...) conditional comments behind."
            )
        }
    }

    func testXcode265StoreKitFeaturesUseSwift632Guard() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceURL = packageRoot.appendingPathComponent(
            "Sources/Helpers/StoreKitTypesBridge.swift"
        )
        let source = try String(contentsOf: sourceURL, encoding: .utf8)
        let sdkGuardCount = source.components(
            separatedBy: "#if compiler(>=6.3.2)"
        ).count - 1
        let swift63GuardCount = source.components(
            separatedBy: "#if compiler(>=6.3)"
        ).count - 1

        XCTAssertEqual(
            sdkGuardCount,
            8,
            "Xcode 26.5 StoreKit paths must stay excluded from Xcode 26.4 builds."
        )
        XCTAssertEqual(
            swift63GuardCount,
            1,
            "The Xcode 26.4-compatible JWS promotional offer must keep its Swift 6.3 guard."
        )
    }
}
