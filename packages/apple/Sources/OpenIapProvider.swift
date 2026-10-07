import Foundation

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
public protocol OpenIapProviderFactory: AnyObject {
    init()
    var storeId: String { get }
    var coreVersion: String { get }
    var clientProtocolVersion: String { get }
    var capabilities: Set<String> { get }
    func create() throws -> any OpenIapModuleProtocol
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
public extension OpenIapProviderFactory {
    var capabilities: Set<String> { [] }
    var descriptor: StoreProviderDescriptor {
        StoreProviderDescriptor(
            capabilities: capabilities.sorted(), clientProtocolVersion: clientProtocolVersion,
            coreVersion: coreVersion, platform: .ios, storeId: storeId
        )
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
@objc(OpenIapAppleProviderFactory)
public final class OpenIapAppleProviderFactory: NSObject, OpenIapProviderFactory {
    public required override init() { super.init() }
    public var storeId: String { StoreIds.Apple }
    public var coreVersion: String { OpenIapVersion.current }
    public var clientProtocolVersion: String { OpenIapVersion.clientProtocolVersion }
    public var capabilities: Set<String> {
        var supported: Set<String> = ["pendingPurchases"]
        #if targetEnvironment(macCatalyst)
        #if compiler(>=6.4)
        if #available(macCatalyst 27.0, *) { supported.insert("offerCodeRedemption") }
        #endif
        #elseif os(iOS) || os(visionOS)
        supported.insert("offerCodeRedemption")
        #endif
        #if os(iOS) || targetEnvironment(macCatalyst) || os(visionOS)
        if #available(iOS 16.4, macCatalyst 16.4, visionOS 1.0, *) {
            supported.insert("subscriptionBillingIssue")
        }
        #endif
        return supported
    }
    public func create() throws -> any OpenIapModuleProtocol { OpenIapStoreKitModule() }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
struct OpenIapProviderSelection {
    let storeId: String
    let capabilities: Set<String>
    let module: any OpenIapModuleProtocol
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
public enum OpenIapProvider {
    public static let metadataKey = "dev.hyo.openiap.PROVIDER"
    public static var coreVersion: String { OpenIapVersion.current }

    public static func factory(bundle: Bundle = .main) throws -> any OpenIapProviderFactory {
        guard let value = bundle.object(forInfoDictionaryKey: metadataKey) else {
            return OpenIapAppleProviderFactory()
        }
        guard let className = value as? String, !className.isEmpty,
              let type = NSClassFromString(className) as? (NSObject & OpenIapProviderFactory).Type else {
            throw configurationError("Info.plist \(metadataKey) must name a linked NSObject implementing OpenIapProviderFactory with a public no-argument initializer.")
        }
        let factory = type.init()
        try validate(factory.descriptor)
        return factory
    }

    public static func validate(
        storeId: String, providerCoreVersion: String, runtimeCoreVersion: String = coreVersion
    ) throws {
        try validateVersion(
            storeId: storeId, providerVersion: providerCoreVersion,
            runtimeVersion: runtimeCoreVersion, clientProtocol: false
        )
    }

    // One version check serves both contracts; the flag only selects the wording.
    private static func validateVersion(
        storeId: String, providerVersion: String, runtimeVersion: String, clientProtocol: Bool
    ) throws {
        guard storeId.range(of: "^[a-z][a-z0-9_]*$", options: .regularExpression)
                == storeId.startIndex..<storeId.endIndex,
              !["auto", "none", "unknown", "play", "google", "horizon", "amazon"].contains(storeId) else {
            throw configurationError("Invalid Apple provider storeId '\(storeId)'. Use a lowercase stable store id.")
        }
        let pattern = "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\\+[0-9A-Za-z.-]+)?$"
        let field = clientProtocol ? "Client Protocol version" : "core version"
        func parse(_ value: String) throws -> [String] {
            guard value.range(of: pattern, options: .regularExpression) == value.startIndex..<value.endIndex else {
                throw configurationError("Invalid \(field) '\(value)' for provider '\(storeId)'. Use a complete semantic version.")
            }
            return value.split(whereSeparator: { $0 == "-" || $0 == "+" })[0].split(separator: ".").map(String.init)
        }
        let required = try parse(providerVersion)
        let available = try parse(runtimeVersion)
        var newer = false
        for index in 0..<3 where required[index] != available[index] {
            let needed = required[index]
            let linked = available[index]
            newer = needed.count == linked.count ? needed > linked : needed.count > linked.count
            break
        }
        let prerelease = providerVersion.split(separator: "+")[0].contains("-")
            || runtimeVersion.split(separator: "+")[0].contains("-")
        guard required[0] == available[0], !newer,
              !prerelease || providerVersion == runtimeVersion else {
            if clientProtocol {
                throw configurationError("Provider '\(storeId)' requires Client Protocol \(providerVersion); this app links \(runtimeVersion). Update the provider or the OpenIAP runtime to a matching protocol.")
            }
            throw configurationError("Provider '\(storeId)' requires OpenIAP \(providerVersion); this app links \(runtimeVersion). Use a compatible provider or core version.")
        }
    }

    public static func validate(_ descriptor: StoreProviderDescriptor) throws {
        guard descriptor.platform == .ios else { throw configurationError("Apple provider must use the ios platform binding.") }
        try validate(storeId: descriptor.storeId, providerCoreVersion: descriptor.coreVersion)
        try validateVersion(storeId: descriptor.storeId, providerVersion: descriptor.clientProtocolVersion,
                            runtimeVersion: OpenIapVersion.clientProtocolVersion, clientProtocol: true)
        if descriptor.clientProtocolVersion.hasPrefix("0."),
           descriptor.clientProtocolVersion.split(separator: ".")[1]
            != OpenIapVersion.clientProtocolVersion.split(separator: ".")[1] {
            throw configurationError("Provider '\(descriptor.storeId)' must implement Client Protocol \(OpenIapVersion.clientProtocolVersion).")
        }
    }

    static func select(bundle: Bundle) -> Result<OpenIapProviderSelection, PurchaseError> {
        do { return select(factory: try factory(bundle: bundle)) }
        catch { return .failure(configurationError(error.localizedDescription)) }
    }

    static func select(factory: any OpenIapProviderFactory) -> Result<OpenIapProviderSelection, PurchaseError> {
        do {
            try validate(factory.descriptor)
            return .success(OpenIapProviderSelection(
                storeId: factory.storeId, capabilities: factory.capabilities, module: try factory.create()
            ))
        } catch let error as PurchaseError { return .failure(error) }
        catch { return .failure(configurationError("Apple store provider could not load: \(error.localizedDescription)")) }
    }

    private static func configurationError(_ message: String) -> PurchaseError {
        .make(code: .developerError, message: message)
    }
}
