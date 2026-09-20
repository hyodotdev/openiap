@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.hyo.openiap

import android.app.Activity
import com.meta.horizon.billingclient.api.AcknowledgePurchaseParams
import com.meta.horizon.billingclient.api.AcknowledgePurchaseResponseListener
import com.meta.horizon.billingclient.api.AgeCategoryResponseListener
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyAvailabilityListener
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyInformationDialogListener
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyReportingDetailsListener
import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.BillingClientStateListener
import com.meta.horizon.billingclient.api.BillingConfigResponseListener
import com.meta.horizon.billingclient.api.BillingFlowParams
import com.meta.horizon.billingclient.api.BillingResult
import com.meta.horizon.billingclient.api.ConsumeParams
import com.meta.horizon.billingclient.api.ConsumeResponseListener
import com.meta.horizon.billingclient.api.ExternalOfferAvailabilityListener
import com.meta.horizon.billingclient.api.ExternalOfferInformationDialogListener
import com.meta.horizon.billingclient.api.ExternalOfferReportingDetailsListener
import com.meta.horizon.billingclient.api.GetBillingConfigParams
import com.meta.horizon.billingclient.api.InAppMessageParams
import com.meta.horizon.billingclient.api.InAppMessageResponseListener
import com.meta.horizon.billingclient.api.PriceChangeConfirmationListener
import com.meta.horizon.billingclient.api.PriceChangeFlowParams
import com.meta.horizon.billingclient.api.ProductDetailsResponseListener
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import com.meta.horizon.billingclient.api.PurchaseHistoryResponseListener
import com.meta.horizon.billingclient.api.PurchasesResponseListener
import com.meta.horizon.billingclient.api.QueryProductDetailsParams
import com.meta.horizon.billingclient.api.QueryPurchaseHistoryParams
import com.meta.horizon.billingclient.api.QueryPurchasesParams
import com.meta.horizon.billingclient.api.SkuDetailsParams
import com.meta.horizon.billingclient.api.SkuDetailsResponseListener

/** Inert Horizon BillingClient. The module only compares it by identity. */
internal open class RecordingBillingClient : BillingClient() {
    override fun acknowledgePurchase(
        params: AcknowledgePurchaseParams,
        listener: AcknowledgePurchaseResponseListener,
    ) = Unit

    override fun consumeAsync(params: ConsumeParams, listener: ConsumeResponseListener) = Unit

    override fun createAlternativeBillingOnlyReportingDetailsAsync(
        listener: AlternativeBillingOnlyReportingDetailsListener,
    ) = Unit

    override fun createExternalOfferReportingDetailsAsync(
        listener: ExternalOfferReportingDetailsListener,
    ) = Unit

    override fun endConnection() = Unit

    override fun getBillingConfigAsync(
        params: GetBillingConfigParams,
        listener: BillingConfigResponseListener,
    ) = Unit

    override fun getConnectionState(): Int = ConnectionState.CONNECTED

    override fun isAlternativeBillingOnlyAvailableAsync(
        listener: AlternativeBillingOnlyAvailabilityListener,
    ) = Unit

    override fun isExternalOfferAvailableAsync(listener: ExternalOfferAvailabilityListener) = Unit

    override fun isFeatureSupported(feature: String): BillingResult = unsupported()

    override fun isReady(): Boolean = true

    override fun launchBillingFlow(
        activity: Activity,
        params: BillingFlowParams,
    ): BillingResult = unsupported()

    override fun launchPriceChangeConfirmationFlow(
        activity: Activity,
        params: PriceChangeFlowParams,
        listener: PriceChangeConfirmationListener,
    ) = Unit

    override fun queryAgeCategoryAsync(listener: AgeCategoryResponseListener) = Unit

    override fun queryProductDetailsAsync(
        params: QueryProductDetailsParams,
        listener: ProductDetailsResponseListener,
    ) = Unit

    override fun queryPurchaseHistoryAsync(
        queryPurchaseHistoryParams: QueryPurchaseHistoryParams,
        listener: PurchaseHistoryResponseListener,
    ) = Unit

    override fun queryPurchaseHistoryAsync(
        skuType: String,
        listener: PurchaseHistoryResponseListener,
    ) = Unit

    override fun queryPurchasesAsync(
        skuType: String,
        listener: PurchasesResponseListener,
    ) = Unit

    override fun queryPurchasesAsync(
        queryPurchasesParams: QueryPurchasesParams,
        listener: PurchasesResponseListener,
    ) = Unit

    override fun querySkuDetailsAsync(
        params: SkuDetailsParams,
        listener: SkuDetailsResponseListener,
    ) = Unit

    override fun showAlternativeBillingOnlyInformationDialog(
        activity: Activity,
        listener: AlternativeBillingOnlyInformationDialogListener,
    ): BillingResult = unsupported()

    override fun showExternalOfferInformationDialog(
        activity: Activity,
        listener: ExternalOfferInformationDialogListener,
    ): BillingResult = unsupported()

    override fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParams,
        listener: InAppMessageResponseListener,
    ): BillingResult = unsupported()

    override fun startConnection(listener: BillingClientStateListener) = Unit

    private fun unsupported(): BillingResult = BillingResult.newBuilder()
        .setResponseCode(BillingResponseCode.FEATURE_NOT_SUPPORTED)
        .setDebugMessage("unsupported")
        .build()
}
