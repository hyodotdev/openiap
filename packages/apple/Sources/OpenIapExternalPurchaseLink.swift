import Foundation

// Shared external purchase link flow built on the platform primitives, so every
// provider gets the same disclosure-first behavior.
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
public extension OpenIapModuleProtocol {
    /// See: https://openiap.dev/docs/apis/is-external-purchase-link-available
    func isExternalPurchaseLinkAvailable() async throws -> Bool {
        try await externalPurchaseLinkRoute() != nil
    }

    /// The URL opens only after the store disclosure continues.
    /// See: https://openiap.dev/docs/apis/open-external-purchase-link
    func openExternalPurchaseLink(_ request: ExternalPurchaseLinkRequest) async throws -> ExternalPurchaseLinkResult {
        let token: String
        switch try await externalPurchaseLinkRoute() {
        case nil:
            return ExternalPurchaseLinkResult(platform: .ios, status: .unavailable)
        case .customLink:
            let notice = try await showExternalPurchaseCustomLinkNoticeIOS(.browser)
            if let error = notice.error { throw externalPurchaseLinkError(error) }
            guard notice.continued else {
                return ExternalPurchaseLinkResult(platform: .ios, status: .cancelled)
            }
            let result = try await getExternalPurchaseCustomLinkTokenIOS(request.apple?.tokenType ?? .acquisition)
            guard let value = result.token else {
                throw externalPurchaseLinkError(result.error ?? "StoreKit returned no external purchase token")
            }
            token = value
        case .noticeSheet:
            let notice = try await presentExternalPurchaseNoticeSheetIOS()
            if let error = notice.error { throw externalPurchaseLinkError(error) }
            guard notice.result == .continue else {
                return ExternalPurchaseLinkResult(platform: .ios, status: .cancelled)
            }
            guard let value = notice.externalPurchaseToken else {
                throw externalPurchaseLinkError("StoreKit returned no external purchase token")
            }
            token = value
        }
        let link = try await presentExternalPurchaseLinkIOS(request.url)
        guard link.success else {
            throw externalPurchaseLinkError(link.error ?? "Cannot open URL")
        }
        return ExternalPurchaseLinkResult(platform: .ios, reportToken: token, status: .opened)
    }
}

private enum ExternalPurchaseLinkRoute {
    case customLink
    case noticeSheet
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension OpenIapModuleProtocol {
    // Prefer the iOS 18.1+ custom link; fall back to the iOS 17.4+ notice sheet.
    func externalPurchaseLinkRoute() async throws -> ExternalPurchaseLinkRoute? {
        if try await unlessUnsupported(isEligibleForExternalPurchaseCustomLinkIOS) { return .customLink }
        if try await unlessUnsupported(canPresentExternalPurchaseNoticeIOS) { return .noticeSheet }
        return nil
    }

    func unlessUnsupported(_ check: () async throws -> Bool) async throws -> Bool {
        do {
            return try await check()
        } catch let error as PurchaseError where error.code == .featureNotSupported {
            return false
        }
    }

    func externalPurchaseLinkError(_ message: String) -> PurchaseError {
        PurchaseError.make(code: .serviceError, message: message)
    }
}
