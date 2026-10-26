import Foundation
import NitroModules
import OpenIAP

@available(iOS 15.0, macOS 14.0, tvOS 15.0, watchOS 8.0, *)
final class HybridRnIapProtocol: HybridRnIapProtocolSpec {
    private let implementation = HybridRnIap()
    var core: any HybridRnIapSpec { implementation }

    private func lift<Value, Outcome>(
        _ operation: () throws -> Promise<Value>,
        success: @escaping (Value) -> Outcome,
        failure: @escaping (NitroPurchaseError) -> Outcome
    ) -> Promise<Outcome> {
        let result = Promise<Outcome>()
        do {
            try operation().then { result.resolve(withResult: success($0)) }
                .catch { result.resolve(withResult: failure(protocolPurchaseError($0))) }
        } catch {
            result.resolve(withResult: failure(protocolPurchaseError(error)))
        }
        return result
    }

    func initConnection(config: Variant_NullType_InitConnectionConfig?) -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.initConnection(config: config) },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func endConnection() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.endConnection() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func fetchProducts(skus: [String], type: String) -> Promise<NitroProductListOutcome> {
        lift({ try implementation.fetchProducts(skus: skus, type: type) },
             success: { NitroProductListOutcome(value: $0, error: nil) },
             failure: { NitroProductListOutcome(value: nil, error: $0) })
    }

    func requestPurchase(request: NitroPurchaseRequest) -> Promise<NitroRequestPurchaseResultOutcome> {
        lift({ try implementation.requestPurchase(request: request) },
             success: { NitroRequestPurchaseResultOutcome(value: protocolPurchaseResult($0), error: nil) },
             failure: { NitroRequestPurchaseResultOutcome(value: nil, error: $0) })
    }

    func getAvailablePurchases(options: NitroAvailablePurchasesOptions?) -> Promise<NitroPurchaseListOutcome> {
        lift({ try implementation.getAvailablePurchases(options: options) },
             success: { NitroPurchaseListOutcome(value: $0, error: nil) },
             failure: { NitroPurchaseListOutcome(value: nil, error: $0) })
    }

    func getActiveSubscriptions(subscriptionIds: [String]?) -> Promise<NitroActiveSubscriptionListOutcome> {
        lift({ try implementation.getActiveSubscriptions(subscriptionIds: subscriptionIds) },
             success: { NitroActiveSubscriptionListOutcome(value: $0, error: nil) },
             failure: { NitroActiveSubscriptionListOutcome(value: nil, error: $0) })
    }

    func hasActiveSubscriptions(subscriptionIds: [String]?) -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.hasActiveSubscriptions(subscriptionIds: subscriptionIds) },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func finishTransaction(params: NitroFinishTransactionParams) -> Promise<NitroFinishTransactionOutcome> {
        lift({ try implementation.finishTransaction(params: params) },
             success: { NitroFinishTransactionOutcome(value: $0, error: nil) },
             failure: { NitroFinishTransactionOutcome(value: nil, error: $0) })
    }

    func getAppTransactionIOS() -> Promise<NitroGetAppTransactionIOSOutcome> {
        lift({ try implementation.getAppTransactionIOS() },
             success: { NitroGetAppTransactionIOSOutcome(value: $0, error: nil) },
             failure: { NitroGetAppTransactionIOSOutcome(value: nil, error: $0) })
    }

    func getPromotedProductIOS() -> Promise<NitroGetPromotedProductIOSOutcome> {
        lift({ try implementation.getPromotedProductIOS() },
             success: { NitroGetPromotedProductIOSOutcome(value: $0, error: nil) },
             failure: { NitroGetPromotedProductIOSOutcome(value: nil, error: $0) })
    }

    func verifyAppOwnership(optionsJson: String) -> Promise<NitroStringOutcome> {
        lift({ try implementation.verifyAppOwnership(optionsJson: optionsJson) },
             success: { NitroStringOutcome(value: $0, error: nil) },
             failure: { NitroStringOutcome(value: nil, error: $0) })
    }

    func openRedeemOfferCode() -> Promise<NitroOpenRedeemOfferCodeOutcome> {
        lift({ try implementation.openRedeemOfferCode() },
             success: { NitroOpenRedeemOfferCodeOutcome(value: $0, error: nil) },
             failure: { NitroOpenRedeemOfferCodeOutcome(value: nil, error: $0) })
    }

    func clearTransactionIOS() -> Promise<NitroVoidOutcome> {
        lift({ try implementation.clearTransactionIOS() },
             success: { _ in NitroVoidOutcome(error: nil) },
             failure: { NitroVoidOutcome(error: $0) })
    }

    func beginRefundRequestIOS(sku: String) -> Promise<NitroGetAppTransactionIOSOutcome> {
        lift({ try implementation.beginRefundRequestIOS(sku: sku) },
             success: { NitroGetAppTransactionIOSOutcome(value: $0, error: nil) },
             failure: { NitroGetAppTransactionIOSOutcome(value: nil, error: $0) })
    }

    func subscriptionStatusIOS(sku: String) -> Promise<NitroSubscriptionStatusIOSOutcome> {
        lift({ try implementation.subscriptionStatusIOS(sku: sku) },
             success: { NitroSubscriptionStatusIOSOutcome(value: $0, error: nil) },
             failure: { NitroSubscriptionStatusIOSOutcome(value: nil, error: $0) })
    }

    func currentEntitlementIOS(sku: String) -> Promise<NitroOpenRedeemOfferCodeOutcome> {
        lift({ try implementation.currentEntitlementIOS(sku: sku) },
             success: { NitroOpenRedeemOfferCodeOutcome(value: $0, error: nil) },
             failure: { NitroOpenRedeemOfferCodeOutcome(value: nil, error: $0) })
    }

    func latestTransactionIOS(sku: String) -> Promise<NitroOpenRedeemOfferCodeOutcome> {
        lift({ try implementation.latestTransactionIOS(sku: sku) },
             success: { NitroOpenRedeemOfferCodeOutcome(value: $0, error: nil) },
             failure: { NitroOpenRedeemOfferCodeOutcome(value: nil, error: $0) })
    }

    func getPendingTransactionsIOS() -> Promise<NitroPurchaseListOutcome> {
        lift({ try implementation.getPendingTransactionsIOS() },
             success: { NitroPurchaseListOutcome(value: $0, error: nil) },
             failure: { NitroPurchaseListOutcome(value: nil, error: $0) })
    }

    func getAllTransactionsIOS() -> Promise<NitroPurchaseListOutcome> {
        lift({ try implementation.getAllTransactionsIOS() },
             success: { NitroPurchaseListOutcome(value: $0, error: nil) },
             failure: { NitroPurchaseListOutcome(value: nil, error: $0) })
    }

    func restorePurchases() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.restorePurchases() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func syncIOS() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.syncIOS() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func showManageSubscriptionsIOS() -> Promise<NitroPurchaseListOutcome> {
        lift({ try implementation.showManageSubscriptionsIOS() },
             success: { NitroPurchaseListOutcome(value: $0, error: nil) },
             failure: { NitroPurchaseListOutcome(value: nil, error: $0) })
    }

    func deepLinkToSubscriptionsIOS() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.deepLinkToSubscriptionsIOS() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func isEligibleForIntroOfferIOS(groupID: String) -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.isEligibleForIntroOfferIOS(groupID: groupID) },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func getReceiptDataIOS() -> Promise<NitroStringOutcome> {
        lift({ try implementation.getReceiptDataIOS() },
             success: { NitroStringOutcome(value: $0, error: nil) },
             failure: { NitroStringOutcome(value: nil, error: $0) })
    }

    func requestReceiptRefreshIOS() -> Promise<NitroStringOutcome> {
        lift({ try implementation.requestReceiptRefreshIOS() },
             success: { NitroStringOutcome(value: $0, error: nil) },
             failure: { NitroStringOutcome(value: nil, error: $0) })
    }

    func isTransactionVerifiedIOS(sku: String) -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.isTransactionVerifiedIOS(sku: sku) },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func getTransactionJwsIOS(sku: String) -> Promise<NitroGetAppTransactionIOSOutcome> {
        lift({ try implementation.getTransactionJwsIOS(sku: sku) },
             success: { NitroGetAppTransactionIOSOutcome(value: $0, error: nil) },
             failure: { NitroGetAppTransactionIOSOutcome(value: nil, error: $0) })
    }

    func verifyPurchase(params: NitroPurchaseVerificationParams) -> Promise<NitroVerifyPurchaseOutcome> {
        lift({ try implementation.verifyPurchase(params: params) },
             success: { NitroVerifyPurchaseOutcome(value: $0, error: nil) },
             failure: { NitroVerifyPurchaseOutcome(value: nil, error: $0) })
    }

    func verifyPurchaseWithProvider(params: NitroVerifyPurchaseWithProviderProps) -> Promise<NitroVerifyPurchaseWithProviderResultOutcome> {
        lift({ try implementation.verifyPurchaseWithProvider(params: params) },
             success: { NitroVerifyPurchaseWithProviderResultOutcome(value: $0, error: nil) },
             failure: { NitroVerifyPurchaseWithProviderResultOutcome(value: nil, error: $0) })
    }

    func getStorefront() -> Promise<NitroStringOutcome> {
        lift({ try implementation.getStorefront() },
             success: { NitroStringOutcome(value: $0, error: nil) },
             failure: { NitroStringOutcome(value: nil, error: $0) })
    }

    func deepLinkToSubscriptionsAndroid(options: NitroDeepLinkOptionsAndroid) -> Promise<NitroVoidOutcome> {
        lift({ try implementation.deepLinkToSubscriptionsAndroid(options: options) },
             success: { _ in NitroVoidOutcome(error: nil) },
             failure: { NitroVoidOutcome(error: $0) })
    }

    func enableBillingProgramAndroid(program: BillingProgramAndroid) -> NitroVoidOutcome {
        do {
            try implementation.enableBillingProgramAndroid(program: program)
            return NitroVoidOutcome(error: nil)
        } catch {
            return NitroVoidOutcome(error: protocolPurchaseError(error))
        }
    }

    func isBillingProgramAvailableAndroid(program: BillingProgramAndroid) -> Promise<NitroBillingProgramAvailabilityResultAndroidOutcome> {
        lift({ try implementation.isBillingProgramAvailableAndroid(program: program) },
             success: { NitroBillingProgramAvailabilityResultAndroidOutcome(value: $0, error: nil) },
             failure: { NitroBillingProgramAvailabilityResultAndroidOutcome(value: nil, error: $0) })
    }

    func getBillingChoiceInfoAndroid(params: NitroGetBillingChoiceInfoParamsAndroid) -> Promise<NitroBillingChoiceInfoAndroidOutcome> {
        lift({ try implementation.getBillingChoiceInfoAndroid(params: params) },
             success: { NitroBillingChoiceInfoAndroidOutcome(value: $0, error: nil) },
             failure: { NitroBillingChoiceInfoAndroidOutcome(value: nil, error: $0) })
    }

    func createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid?) -> Promise<NitroBillingProgramReportingDetailsAndroidOutcome> {
        lift({ try implementation.createBillingProgramReportingDetailsAndroid(program: program, developerBillingType: developerBillingType) },
             success: { NitroBillingProgramReportingDetailsAndroidOutcome(value: $0, error: nil) },
             failure: { NitroBillingProgramReportingDetailsAndroidOutcome(value: nil, error: $0) })
    }

    func showBillingProgramInformationDialogAndroid(params: NitroBillingProgramInformationDialogParamsAndroid) -> Promise<NitroBillingResultAndroidOutcome> {
        lift({ try implementation.showBillingProgramInformationDialogAndroid(params: params) },
             success: { NitroBillingResultAndroidOutcome(value: $0, error: nil) },
             failure: { NitroBillingResultAndroidOutcome(value: nil, error: $0) })
    }

    func showInAppMessagesAndroid(params: Variant_NullType_NitroInAppMessageParamsAndroid?) -> Promise<NitroInAppMessageResultAndroidOutcome> {
        lift({ try implementation.showInAppMessagesAndroid(params: params) },
             success: { NitroInAppMessageResultAndroidOutcome(value: $0, error: nil) },
             failure: { NitroInAppMessageResultAndroidOutcome(value: nil, error: $0) })
    }

    func launchExternalLinkAndroid(params: NitroLaunchExternalLinkParamsAndroid) -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.launchExternalLinkAndroid(params: params) },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func canPresentExternalPurchaseNoticeIOS() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.canPresentExternalPurchaseNoticeIOS() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func presentExternalPurchaseNoticeSheetIOS() -> Promise<NitroExternalPurchaseNoticeResultIOSOutcome> {
        lift({ try implementation.presentExternalPurchaseNoticeSheetIOS() },
             success: { NitroExternalPurchaseNoticeResultIOSOutcome(value: $0, error: nil) },
             failure: { NitroExternalPurchaseNoticeResultIOSOutcome(value: nil, error: $0) })
    }

    func presentExternalPurchaseLinkIOS(url: String) -> Promise<NitroExternalPurchaseLinkResultIOSOutcome> {
        lift({ try implementation.presentExternalPurchaseLinkIOS(url: url) },
             success: { NitroExternalPurchaseLinkResultIOSOutcome(value: $0, error: nil) },
             failure: { NitroExternalPurchaseLinkResultIOSOutcome(value: nil, error: $0) })
    }

    func isEligibleForExternalPurchaseCustomLinkIOS() -> Promise<NitroBooleanOutcome> {
        lift({ try implementation.isEligibleForExternalPurchaseCustomLinkIOS() },
             success: { NitroBooleanOutcome(value: $0, error: nil) },
             failure: { NitroBooleanOutcome(value: nil, error: $0) })
    }

    func getExternalPurchaseCustomLinkTokenIOS(tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) -> Promise<NitroExternalPurchaseCustomLinkTokenResultIOSOutcome> {
        lift({ try implementation.getExternalPurchaseCustomLinkTokenIOS(tokenType: tokenType) },
             success: { NitroExternalPurchaseCustomLinkTokenResultIOSOutcome(value: $0, error: nil) },
             failure: { NitroExternalPurchaseCustomLinkTokenResultIOSOutcome(value: nil, error: $0) })
    }

    func showExternalPurchaseCustomLinkNoticeIOS(noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) -> Promise<NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome> {
        lift({ try implementation.showExternalPurchaseCustomLinkNoticeIOS(noticeType: noticeType) },
             success: { NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome(value: $0, error: nil) },
             failure: { NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome(value: nil, error: $0) })
    }

}

@available(iOS 15.0, *)
func protocolPurchaseError(_ error: Error) -> NitroPurchaseError {
    let purchaseError = (error as? OpenIapException)?.purchaseError
        ?? (error as? OpenIAP.PurchaseError)
        ?? OpenIAP.PurchaseError(code: .unknown, message: error.localizedDescription)
    return NitroPurchaseError(
        code: purchaseError.code.rawValue,
        debugMessage: purchaseError.debugMessage.map { .second($0) },
        isEmptyProductList: purchaseError.isEmptyProductList.map { .second($0) },
        message: purchaseError.message,
        productId: purchaseError.productId.map { .second($0) },
        productIds: purchaseError.productIds.map { .second($0) },
        productType: purchaseError.productType.map { .second($0) },
        responseCode: purchaseError.responseCode.map { .second(Double($0)) },
        subResponseCodeAndroid: purchaseError.subResponseCodeAndroid.flatMap { SubResponseCodeAndroid(fromString: $0.rawValue) }
    )
}

private func protocolPurchaseResult(_ value: RequestPurchaseResult) -> Variant_NullType_PurchaseAndroid_PurchaseIOS__Purchase_ {
    switch value {
    case .first(let value): return .first(value)
    case .second(let value): return .second(value)
    case .third(let value): return .third(value)
    case .fourth(let values): return .fourth(values)
    }
}
