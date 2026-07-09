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
}
