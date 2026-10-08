package dev.hyo.openiap

import android.app.Activity
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener

/** Store providers implement the generated handlers and public operations. */
interface OpenIapProtocol {
    val initConnection: MutationInitConnectionHandler
    val endConnection: MutationEndConnectionHandler

    val fetchProducts: QueryFetchProductsHandler
    val getAvailablePurchases: QueryGetAvailablePurchasesHandler
    val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler
    val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler

    val requestPurchase: MutationRequestPurchaseHandler
    val finishTransaction: MutationFinishTransactionHandler
    val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler
    val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler
    val restorePurchases: MutationRestorePurchasesHandler
    val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler
    val verifyPurchase: MutationVerifyPurchaseHandler
    val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler

    val queryHandlers: QueryHandlers
    val mutationHandlers: MutationHandlers
    val subscriptionHandlers: SubscriptionHandlers

    suspend fun getStorefront(): String = queryHandlers.getStorefront?.invoke()
        ?: throw OpenIapError.FeatureNotSupported("Storefront query is unavailable")

    suspend fun getAvailableItems(type: ProductQueryType): List<Purchase> =
        throw OpenIapError.FeatureNotSupported("Use getAvailablePurchases without a product-type filter")

    fun setActivity(activity: Activity?)

    fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener)
    fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener)

    fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)
    fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)

    /** Listen for developer-provided billing selections. */
    fun addDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener)
    fun removeDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener)

    /** Listen for subscription billing issues reported by the provider. */
    fun addSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener)
    fun removeSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener)

    fun addConnectionStateListener(listener: OpenIapConnectionStateListener)
    fun removeConnectionStateListener(listener: OpenIapConnectionStateListener)

    // Billing Programs (Google Play Billing Library 8.2.0+)
    /**
     * Enable a billing program for the next connection; call before initConnection.
     * Providers that support billing programs override this default.
     */
    fun enableBillingProgram(program: BillingProgramAndroid) {}

    /**
     * Check if a billing program is available for this user/device.
     *
     * @param program The billing program to check, including BILLING_CHOICE on 9.1.0+
     * @return Result containing availability information
     */
    suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid

    /**
     * Create reporting details for transactions made outside of Google Play Billing.
     *
     * @param program The billing program, including BILLING_CHOICE on 9.1.0+
     * @return Reporting details containing the external transaction token
     */
    suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid? = null
    ): BillingProgramReportingDetailsAndroid

    /**
     * Launch an external link for external offer or app download.
     *
     * @param activity Current activity context
     * @param params Parameters for the external link
     * @return true if launch was successful, false otherwise
     */
    suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean

    /**
     * Fetch Play Billing choice display assets for developer-rendered Billing Choice.
     */
    suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid

    /**
     * Show the mandatory information dialog before a developer-rendered,
     * in-app Billing Choice screen.
     */
    suspend fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid

    /**
     * Show Play billing in-app messages such as payment issues or price-change confirmations.
     */
    suspend fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParamsAndroid? = null
    ): InAppMessageResultAndroid

    /**
     * Launch the provider's offer-code redemption flow, returning whether it opened.
     * Keep purchase listeners active and reconcile owned purchases when the app resumes.
     */
    suspend fun openRedeemOfferCode(activity: Activity): Boolean
}
