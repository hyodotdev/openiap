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
    val validateReceipt: MutationValidateReceiptHandler

    val queryHandlers: QueryHandlers
    val mutationHandlers: MutationHandlers
    val subscriptionHandlers: SubscriptionHandlers

    fun setActivity(activity: Activity?)

    fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
    fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener)
    fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener)

    // Alternative Billing (Google Play only)
    suspend fun checkAlternativeBillingAvailability(): Boolean
    suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean
    suspend fun createAlternativeBillingReportingToken(): String?
    fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?)
    fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)
    fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener)
}
