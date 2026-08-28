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

    func testStoreKitSDKSymbolsUseMinimumCompilerGuards() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sourceURL = packageRoot.appendingPathComponent(
            "Sources/Helpers/StoreKitTypesBridge.swift"
        )
        let source = try String(contentsOf: sourceURL, encoding: .utf8)
        let xcode265Symbols = [
            "options.insert(.billingPlanType(.monthly))",
            "guard let commitment = info.commitmentInfo",
            "return info.renewalBillingPlanType.map",
            "let terms = info.pricingTerms.map",
            "from terms: StoreKit.Product.SubscriptionInfo.PricingTerms",
            "from type: StoreKit.Product.SubscriptionInfo.BillingPlanType",
            "return transaction.billingPlanType.map",
            "guard let commitment = transaction.commitmentInfo",
            "return transaction.revocationType?.rawValue",
        ]

        for symbol in xcode265Symbols {
            XCTAssertEqual(
                compilerGuard(containing: symbol, in: source),
                "#if compiler(>=6.3.2)",
                "\(symbol) must stay excluded from Xcode 26.4 builds."
            )
        }
        XCTAssertEqual(
            compilerGuard(containing: "compactJWS: jwsOffer.jws", in: source),
            "#if compiler(>=6.3)",
            "The Xcode 26.4-compatible JWS promotional offer must keep its Swift 6.3 guard."
        )
        XCTAssertEqual(
            source.components(separatedBy: "#if compiler(>=6.3.2)").count - 1,
            xcode265Symbols.count
        )
    }

    private func compilerGuard(containing needle: String, in source: String) -> String? {
        var conditions: [String?] = []

        for line in source.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("#if ") {
                conditions.append(
                    trimmed.hasPrefix("#if compiler(") ? trimmed : nil
                )
            }
            if line.contains(needle) {
                return conditions.reversed().compactMap { $0 }.first
            }
            if trimmed.hasPrefix("#endif") {
                conditions.removeLast()
            }
        }
        return nil
    }
}
