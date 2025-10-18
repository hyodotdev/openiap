package dev.hyo.openiap.horizon

import android.app.Activity
import android.content.Context
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationHandlers
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.QueryFetchProductsHandler
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.QueryHandlers
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import dev.hyo.openiap.SubscriptionHandlers
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener

/**
 * Play flavor stub that reuses the Play Billing pipeline.
 * Build the `horizon` product flavor to include Horizon billing dependencies.
 */
@Suppress("UNUSED_PARAMETER")
class OpenIapHorizonModule(
    context: Context,
    appId: String? = null
) : OpenIapProtocol {

    private val delegate = OpenIapModule(context)

    override fun setActivity(activity: Activity?) {
        delegate.setActivity(activity)
    }

    override val initConnection: MutationInitConnectionHandler
        get() = delegate.initConnection

    override val endConnection: MutationEndConnectionHandler
        get() = delegate.endConnection

    override val fetchProducts: QueryFetchProductsHandler
        get() = delegate.fetchProducts

    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler
        get() = delegate.getAvailablePurchases

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler
        get() = delegate.getActiveSubscriptions

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler
        get() = delegate.hasActiveSubscriptions

    override val requestPurchase: MutationRequestPurchaseHandler
        get() = delegate.requestPurchase

    override val finishTransaction: MutationFinishTransactionHandler
        get() = delegate.finishTransaction

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler
        get() = delegate.acknowledgePurchaseAndroid

    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler
        get() = delegate.consumePurchaseAndroid

    override val restorePurchases: MutationRestorePurchasesHandler
        get() = delegate.restorePurchases

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler
        get() = delegate.deepLinkToSubscriptions

    override val validateReceipt: MutationValidateReceiptHandler
        get() = delegate.validateReceipt

    override val queryHandlers: QueryHandlers
        get() = delegate.queryHandlers

    override val mutationHandlers: MutationHandlers
        get() = delegate.mutationHandlers

    override val subscriptionHandlers: SubscriptionHandlers
        get() = delegate.subscriptionHandlers

    override fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) {
        delegate.addPurchaseUpdateListener(listener)
    }

    override fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) {
        delegate.removePurchaseUpdateListener(listener)
    }

    override fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {
        delegate.addPurchaseErrorListener(listener)
    }

    override fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {
        delegate.removePurchaseErrorListener(listener)
    }

    // Alternative Billing (delegate to OpenIapModule)
    override suspend fun checkAlternativeBillingAvailability(): Boolean {
        return delegate.checkAlternativeBillingAvailability()
    }

    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean {
        return delegate.showAlternativeBillingInformationDialog(activity)
    }

    override suspend fun createAlternativeBillingReportingToken(): String? {
        return delegate.createAlternativeBillingReportingToken()
    }

    override fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        delegate.setUserChoiceBillingListener(listener)
    }

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        delegate.addUserChoiceBillingListener(listener)
    }

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        delegate.removeUserChoiceBillingListener(listener)
    }
}
