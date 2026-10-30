package com.margelo.nitro.iap

import com.margelo.nitro.core.Promise
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseError as OpenIapPurchaseError
import dev.hyo.openiap.ErrorCode as OpenIapErrorCode

class HybridRnIapProtocol: HybridRnIapProtocolSpec() {
    private val implementation = HybridRnIap()
    override val core: HybridRnIapSpec get() = implementation

    private fun <Value, Outcome> lift(
        operation: () -> Promise<Value>,
        success: (Value) -> Outcome,
        failure: (NitroPurchaseError) -> Outcome,
    ): Promise<Outcome> {
        val result = Promise<Outcome>()
        try {
            operation().then { result.resolve(success(it)) }
                .catch { result.resolve(failure(protocolPurchaseError(it))) }
        } catch (error: Throwable) {
            result.resolve(failure(protocolPurchaseError(error)))
        }
        return result
    }

    override fun initConnection(config: Variant_NullType_InitConnectionConfig?): Promise<NitroBooleanOutcome> =
        lift({ implementation.initConnection(config) },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun endConnection(): Promise<NitroBooleanOutcome> =
        lift({ implementation.endConnection() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun fetchProducts(skus: Array<String>, type: String): Promise<NitroProductListOutcome> =
        lift({ implementation.fetchProducts(skus, type) },
            { NitroProductListOutcome(value = it, error = null) },
            { NitroProductListOutcome(value = null, error = it) })

    override fun requestPurchase(request: NitroPurchaseRequest): Promise<NitroRequestPurchaseResultOutcome> =
        lift({ implementation.requestPurchase(request) },
            { NitroRequestPurchaseResultOutcome(value = protocolPurchaseResult(it), error = null) },
            { NitroRequestPurchaseResultOutcome(value = null, error = it) })

    override fun getAvailablePurchases(options: NitroAvailablePurchasesOptions?): Promise<NitroPurchaseListOutcome> =
        lift({ implementation.getAvailablePurchases(options) },
            { NitroPurchaseListOutcome(value = it, error = null) },
            { NitroPurchaseListOutcome(value = null, error = it) })

    override fun getActiveSubscriptions(subscriptionIds: Array<String>?): Promise<NitroActiveSubscriptionListOutcome> =
        lift({ implementation.getActiveSubscriptions(subscriptionIds) },
            { NitroActiveSubscriptionListOutcome(value = it, error = null) },
            { NitroActiveSubscriptionListOutcome(value = null, error = it) })

    override fun hasActiveSubscriptions(subscriptionIds: Array<String>?): Promise<NitroBooleanOutcome> =
        lift({ implementation.hasActiveSubscriptions(subscriptionIds) },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun finishTransaction(params: NitroFinishTransactionParams): Promise<NitroFinishTransactionOutcome> =
        lift({ implementation.finishTransaction(params) },
            { NitroFinishTransactionOutcome(value = it, error = null) },
            { NitroFinishTransactionOutcome(value = null, error = it) })

    override fun verifyAppOwnership(optionsJson: String): Promise<NitroStringOutcome> =
        lift({ implementation.verifyAppOwnership(optionsJson) },
            { NitroStringOutcome(value = it, error = null) },
            { NitroStringOutcome(value = null, error = it) })

    override fun openRedeemOfferCode(): Promise<NitroOpenRedeemOfferCodeOutcome> =
        lift({ implementation.openRedeemOfferCode() },
            { NitroOpenRedeemOfferCodeOutcome(value = it, error = null) },
            { NitroOpenRedeemOfferCodeOutcome(value = null, error = it) })

    override fun restorePurchases(): Promise<NitroBooleanOutcome> =
        lift({ implementation.restorePurchases() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun verifyPurchase(params: NitroPurchaseVerificationParams): Promise<NitroVerifyPurchaseOutcome> =
        lift({ implementation.verifyPurchase(params) },
            { NitroVerifyPurchaseOutcome(value = it, error = null) },
            { NitroVerifyPurchaseOutcome(value = null, error = it) })

    override fun verifyPurchaseWithProvider(params: NitroVerifyPurchaseWithProviderProps): Promise<NitroVerifyPurchaseWithProviderResultOutcome> =
        lift({ implementation.verifyPurchaseWithProvider(params) },
            { NitroVerifyPurchaseWithProviderResultOutcome(value = it, error = null) },
            { NitroVerifyPurchaseWithProviderResultOutcome(value = null, error = it) })

    override fun getStorefront(): Promise<NitroStringOutcome> =
        lift({ implementation.getStorefront() },
            { NitroStringOutcome(value = it, error = null) },
            { NitroStringOutcome(value = null, error = it) })

    override fun getAppTransactionIOS(): Promise<NitroGetAppTransactionIOSOutcome> =
        lift({ implementation.getAppTransactionIOS() },
            { NitroGetAppTransactionIOSOutcome(value = it, error = null) },
            { NitroGetAppTransactionIOSOutcome(value = null, error = it) })

    override fun getPromotedProductIOS(): Promise<NitroGetPromotedProductIOSOutcome> =
        lift({ implementation.getPromotedProductIOS() },
            { NitroGetPromotedProductIOSOutcome(value = it, error = null) },
            { NitroGetPromotedProductIOSOutcome(value = null, error = it) })

    override fun clearTransactionIOS(): Promise<NitroVoidOutcome> =
        lift({ implementation.clearTransactionIOS() },
            { NitroVoidOutcome(error = null) },
            { NitroVoidOutcome(error = it) })

    override fun beginRefundRequestIOS(sku: String): Promise<NitroGetAppTransactionIOSOutcome> =
        lift({ implementation.beginRefundRequestIOS(sku) },
            { NitroGetAppTransactionIOSOutcome(value = it, error = null) },
            { NitroGetAppTransactionIOSOutcome(value = null, error = it) })

    override fun subscriptionStatusIOS(sku: String): Promise<NitroSubscriptionStatusIOSOutcome> =
        lift({ implementation.subscriptionStatusIOS(sku) },
            { NitroSubscriptionStatusIOSOutcome(value = it, error = null) },
            { NitroSubscriptionStatusIOSOutcome(value = null, error = it) })

    override fun currentEntitlementIOS(sku: String): Promise<NitroOpenRedeemOfferCodeOutcome> =
        lift({ implementation.currentEntitlementIOS(sku) },
            { NitroOpenRedeemOfferCodeOutcome(value = it, error = null) },
            { NitroOpenRedeemOfferCodeOutcome(value = null, error = it) })

    override fun latestTransactionIOS(sku: String): Promise<NitroOpenRedeemOfferCodeOutcome> =
        lift({ implementation.latestTransactionIOS(sku) },
            { NitroOpenRedeemOfferCodeOutcome(value = it, error = null) },
            { NitroOpenRedeemOfferCodeOutcome(value = null, error = it) })

    override fun getPendingTransactionsIOS(): Promise<NitroPurchaseListOutcome> =
        lift({ implementation.getPendingTransactionsIOS() },
            { NitroPurchaseListOutcome(value = it, error = null) },
            { NitroPurchaseListOutcome(value = null, error = it) })

    override fun getAllTransactionsIOS(): Promise<NitroPurchaseListOutcome> =
        lift({ implementation.getAllTransactionsIOS() },
            { NitroPurchaseListOutcome(value = it, error = null) },
            { NitroPurchaseListOutcome(value = null, error = it) })

    override fun syncIOS(): Promise<NitroBooleanOutcome> =
        lift({ implementation.syncIOS() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun showManageSubscriptionsIOS(): Promise<NitroPurchaseListOutcome> =
        lift({ implementation.showManageSubscriptionsIOS() },
            { NitroPurchaseListOutcome(value = it, error = null) },
            { NitroPurchaseListOutcome(value = null, error = it) })

    override fun deepLinkToSubscriptionsIOS(): Promise<NitroBooleanOutcome> =
        lift({ implementation.deepLinkToSubscriptionsIOS() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun isEligibleForIntroOfferIOS(groupID: String): Promise<NitroBooleanOutcome> =
        lift({ implementation.isEligibleForIntroOfferIOS(groupID) },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun getReceiptDataIOS(): Promise<NitroStringOutcome> =
        lift({ implementation.getReceiptDataIOS() },
            { NitroStringOutcome(value = it, error = null) },
            { NitroStringOutcome(value = null, error = it) })

    override fun requestReceiptRefreshIOS(): Promise<NitroStringOutcome> =
        lift({ implementation.requestReceiptRefreshIOS() },
            { NitroStringOutcome(value = it, error = null) },
            { NitroStringOutcome(value = null, error = it) })

    override fun isTransactionVerifiedIOS(sku: String): Promise<NitroBooleanOutcome> =
        lift({ implementation.isTransactionVerifiedIOS(sku) },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun getTransactionJwsIOS(sku: String): Promise<NitroGetAppTransactionIOSOutcome> =
        lift({ implementation.getTransactionJwsIOS(sku) },
            { NitroGetAppTransactionIOSOutcome(value = it, error = null) },
            { NitroGetAppTransactionIOSOutcome(value = null, error = it) })

    override fun canPresentExternalPurchaseNoticeIOS(): Promise<NitroBooleanOutcome> =
        lift({ implementation.canPresentExternalPurchaseNoticeIOS() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun presentExternalPurchaseNoticeSheetIOS(): Promise<NitroExternalPurchaseNoticeResultIOSOutcome> =
        lift({ implementation.presentExternalPurchaseNoticeSheetIOS() },
            { NitroExternalPurchaseNoticeResultIOSOutcome(value = it, error = null) },
            { NitroExternalPurchaseNoticeResultIOSOutcome(value = null, error = it) })

    override fun presentExternalPurchaseLinkIOS(url: String): Promise<NitroExternalPurchaseLinkResultIOSOutcome> =
        lift({ implementation.presentExternalPurchaseLinkIOS(url) },
            { NitroExternalPurchaseLinkResultIOSOutcome(value = it, error = null) },
            { NitroExternalPurchaseLinkResultIOSOutcome(value = null, error = it) })

    override fun isEligibleForExternalPurchaseCustomLinkIOS(): Promise<NitroBooleanOutcome> =
        lift({ implementation.isEligibleForExternalPurchaseCustomLinkIOS() },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })

    override fun getExternalPurchaseCustomLinkTokenIOS(tokenType: ExternalPurchaseCustomLinkTokenTypeIOS): Promise<NitroExternalPurchaseCustomLinkTokenResultIOSOutcome> =
        lift({ implementation.getExternalPurchaseCustomLinkTokenIOS(tokenType) },
            { NitroExternalPurchaseCustomLinkTokenResultIOSOutcome(value = it, error = null) },
            { NitroExternalPurchaseCustomLinkTokenResultIOSOutcome(value = null, error = it) })

    override fun showExternalPurchaseCustomLinkNoticeIOS(noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS): Promise<NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome> =
        lift({ implementation.showExternalPurchaseCustomLinkNoticeIOS(noticeType) },
            { NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome(value = it, error = null) },
            { NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome(value = null, error = it) })

    override fun deepLinkToSubscriptionsAndroid(options: NitroDeepLinkOptionsAndroid): Promise<NitroVoidOutcome> =
        lift({ implementation.deepLinkToSubscriptionsAndroid(options) },
            { NitroVoidOutcome(error = null) },
            { NitroVoidOutcome(error = it) })

    override fun enableBillingProgramAndroid(program: BillingProgramAndroid): NitroVoidOutcome = try {
        implementation.enableBillingProgramAndroid(program)
        NitroVoidOutcome(error = null)
    } catch (error: Throwable) {
        NitroVoidOutcome(error = protocolPurchaseError(error))
    }

    override fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): Promise<NitroBillingProgramAvailabilityResultAndroidOutcome> =
        lift({ implementation.isBillingProgramAvailableAndroid(program) },
            { NitroBillingProgramAvailabilityResultAndroidOutcome(value = it, error = null) },
            { NitroBillingProgramAvailabilityResultAndroidOutcome(value = null, error = it) })

    override fun getBillingChoiceInfoAndroid(params: NitroGetBillingChoiceInfoParamsAndroid): Promise<NitroBillingChoiceInfoAndroidOutcome> =
        lift({ implementation.getBillingChoiceInfoAndroid(params) },
            { NitroBillingChoiceInfoAndroidOutcome(value = it, error = null) },
            { NitroBillingChoiceInfoAndroidOutcome(value = null, error = it) })

    override fun createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid?): Promise<NitroBillingProgramReportingDetailsAndroidOutcome> =
        lift({ implementation.createBillingProgramReportingDetailsAndroid(program, developerBillingType) },
            { NitroBillingProgramReportingDetailsAndroidOutcome(value = it, error = null) },
            { NitroBillingProgramReportingDetailsAndroidOutcome(value = null, error = it) })

    override fun showBillingProgramInformationDialogAndroid(params: NitroBillingProgramInformationDialogParamsAndroid): Promise<NitroBillingResultAndroidOutcome> =
        lift({ implementation.showBillingProgramInformationDialogAndroid(params) },
            { NitroBillingResultAndroidOutcome(value = it, error = null) },
            { NitroBillingResultAndroidOutcome(value = null, error = it) })

    override fun showInAppMessagesAndroid(params: Variant_NullType_NitroInAppMessageParamsAndroid?): Promise<NitroInAppMessageResultAndroidOutcome> =
        lift({ implementation.showInAppMessagesAndroid(params) },
            { NitroInAppMessageResultAndroidOutcome(value = it, error = null) },
            { NitroInAppMessageResultAndroidOutcome(value = null, error = it) })

    override fun launchExternalLinkAndroid(params: NitroLaunchExternalLinkParamsAndroid): Promise<NitroBooleanOutcome> =
        lift({ implementation.launchExternalLinkAndroid(params) },
            { NitroBooleanOutcome(value = it, error = null) },
            { NitroBooleanOutcome(value = null, error = it) })
}

internal fun protocolPurchaseError(error: Throwable): NitroPurchaseError {
    val purchaseError = (error as? OpenIapException)?.purchaseError
        ?: (error as? OpenIapError)?.let { toPurchaseError(it) }
        ?: OpenIapPurchaseError(code = OpenIapErrorCode.Unknown, message = error.message ?: "Unknown error occurred")
    return NitroPurchaseError(
        code = purchaseError.code.rawValue,
        debugMessage = purchaseError.debugMessage?.let { Variant_NullType_String.Second(it) },
        isEmptyProductList = purchaseError.isEmptyProductList?.let { Variant_NullType_Boolean.Second(it) },
        message = purchaseError.message,
        productId = purchaseError.productId?.let { Variant_NullType_String.Second(it) },
        productIds = purchaseError.productIds?.let { Variant_NullType_Array_String_.Second(it.toTypedArray()) },
        productType = purchaseError.productType?.let { Variant_NullType_String.Second(it) },
        responseCode = purchaseError.responseCode?.let { Variant_NullType_Double.Second(it.toDouble()) },
        subResponseCodeAndroid = mapSubResponseCode(purchaseError.subResponseCodeAndroid),
    )
}

private fun protocolPurchaseResult(value: RequestPurchaseResult): Variant_NullType_PurchaseAndroid_PurchaseIOS_Array_Purchase_ =
    value.match(
        { Variant_NullType_PurchaseAndroid_PurchaseIOS_Array_Purchase_.First(it) },
        { Variant_NullType_PurchaseAndroid_PurchaseIOS_Array_Purchase_.Second(it) },
        { Variant_NullType_PurchaseAndroid_PurchaseIOS_Array_Purchase_.Third(it) },
        { Variant_NullType_PurchaseAndroid_PurchaseIOS_Array_Purchase_.Fourth(it) },
    )
