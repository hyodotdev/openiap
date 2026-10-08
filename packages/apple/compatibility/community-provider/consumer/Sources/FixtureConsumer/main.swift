import Foundation
import OpenIAP

@main struct Smoke {
    static func main() async throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".bundle")
        try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: path) }
        let info: [String: Any] = ["CFBundleIdentifier": "dev.hyo.provider-fixture", OpenIapProvider.metadataKey: "CommunityFixtureFactory"]
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try data.write(to: path.appendingPathComponent("Info.plist"))
        guard let bundle = Bundle(url: path) else { fatalError("Fixture bundle did not load") }
        let module = OpenIapModule(factory: try OpenIapProvider.factory(bundle: bundle))
        guard module.storeId == "community_fixture", try await module.initConnection() else { fatalError("Provider did not load") }
        let request = try OpenIapSerialization.decode(object: ["type": "in-app", "requestPurchase": ["apple": ["sku": "conformance.product"]]], as: RequestPurchaseProps.self)
        _ = try await module.requestPurchase(request)
        guard let purchase = try await module.getAvailablePurchases(nil).first, purchase.store == .unknown else { fatalError("Provider purchase did not survive") }
        try await module.finishTransaction(purchase: purchase, isConsumable: false)
        _ = try await module.endConnection()
        print("Release discovery, purchase identity and completion passed")
    }
}
