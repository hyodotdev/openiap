package dev.hyo.openiap

import android.app.Activity
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener

/**
 * Shared contract implemented by platform-specific OpenIAP billing modules.
 * Provides access to generated handler typealiases so the store can remain provider-agnostic.
 */
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
    @Deprecated("Use verifyPurchase")
    val validateReceipt: MutationValidateReceiptHandler
    val verifyPurchase: MutationVerifyPurchaseHandler
    val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler

    val queryHandlers: QueryHandlers
    val mutationHandlers: MutationHandlers
    val subscriptionHandlers: SubscriptionHandlers

    fun setActivity(activity: Activity?)

    fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener)
    fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener)

    // Alternative Billing (Google Play only)
    @Deprecated("Use isBillingProgramAvailable with BillingProgramAndroid.ExternalOffer instead")
    suspend fun checkAlternativeBillingAvailability(): Boolean
    @Deprecated("Use launchExternalLink instead")
    suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean
    @Deprecated("Use createBillingProgramReportingDetails with BillingProgramAndroid.ExternalOffer instead")
    suspend fun createAlternativeBillingReportingToken(): String?
    fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?)
    fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)
    fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)

    // Billing Programs (Google Play Billing Library 8.2.0+)
    /**
     * Check if a billing program is available for this user/device.
     * Replaces checkAlternativeBillingAvailability() for external offers.
     *
     * @param program The billing program to check (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)
     * @return Result containing availability information
     */
    suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid

    /**
     * Create reporting details for transactions made outside of Google Play Billing.
     * Replaces createAlternativeBillingReportingToken() for external offers.
     *
     * @param program The billing program (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)
     * @return Reporting details containing the external transaction token
     */
    suspend fun createBillingProgramReportingDetails(program: BillingProgramAndroid): BillingProgramReportingDetailsAndroid

    /**
     * Launch an external link for external offer or app download.
     * Replaces showAlternativeBillingInformationDialog() for external offers.
     *
     * @param activity Current activity context
     * @param params Parameters for the external link
     * @return true if launch was successful, false otherwise
     */
    suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean
}
