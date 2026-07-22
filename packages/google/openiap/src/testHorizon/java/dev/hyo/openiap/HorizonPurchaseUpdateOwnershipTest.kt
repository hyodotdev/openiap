@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.hyo.openiap

import android.app.Activity
import androidx.test.core.app.ApplicationProvider
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
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import java.lang.reflect.Field
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonPurchaseUpdateOwnershipTest {

    @After
    fun tearDown() {
        OpenIapLog.setHandler(null)
        OpenIapLog.enable(false)
    }

    @Test
    fun `active connection still delivers when only pending request clears`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client) { results += it }
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        val cleared = AtomicBoolean(false)
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { _, message, _ ->
            if (message == "=== HORIZON onPurchasesUpdated ===" &&
                cleared.compareAndSet(false, true)
            ) {
                pendingPurchaseField().set(module, null)
            }
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase()),
        )

        assertTrue("test hook must clear the pending request", cleared.get())
        assertEquals(listOf("product-id"), updates.map { it.productId })
        assertTrue("cleared request must not be completed: $results", results.isEmpty())
    }

    @Test
    fun `connection invalidated during dispatch does not deliver stale update`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client) { results += it }
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        val invalidated = AtomicBoolean(false)
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { _, message, _ ->
            if (message == "=== HORIZON onPurchasesUpdated ===" &&
                invalidated.compareAndSet(false, true)
            ) {
                runBlocking { module.endConnection() }
            }
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase()),
        )

        assertTrue("test hook must invalidate the active connection", invalidated.get())
        assertTrue("stale client update must not reach listeners: $updates", updates.isEmpty())
        assertEquals(1, results.size)
        assertTrue(
            "endConnection must fail the pending request: $results",
            results.single().exceptionOrNull() is OpenIapError.ServiceDisconnected,
        )
        assertNull(pendingPurchaseField().get(module))
    }

    private fun module(): OpenIapModule =
        OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

    private fun setBillingClient(module: OpenIapModule, client: BillingClient?) {
        OpenIapModule::class.java.getDeclaredField("billingClient").apply {
            isAccessible = true
            set(module, client)
        }
    }

    private fun pendingPurchaseField(): Field =
        OpenIapModule::class.java.getDeclaredField("pendingPurchase").apply {
            isAccessible = true
        }

    private fun installPendingPurchase(
        module: OpenIapModule,
        client: BillingClient,
        callback: (Result<List<Purchase>>) -> Unit,
    ) {
        val snapshotClass = Class.forName("dev.hyo.openiap.OpenIapModule\$PendingPurchaseSnapshot")
        val constructor = snapshotClass.declaredConstructors.first { candidate ->
            candidate.parameterTypes.none { it.simpleName == "DefaultConstructorMarker" }
        }
        constructor.isAccessible = true
        val snapshot = constructor.newInstance(
            client,
            callback,
            setOf("product-id"),
            ProductQueryType.InApp,
            emptyMap<String, String>(),
            1.0,
        )
        pendingPurchaseField().set(module, snapshot)
    }

    private fun billingResult(responseCode: Int): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(responseCode)
            .setDebugMessage("")
            .build()

    private fun billingPurchase(): HorizonPurchase = HorizonPurchase(
        5L,
        "purchase-token",
        listOf("product-id"),
        "dev.hyo.openiap.test",
        "",
        "order-product-id",
        """{"purchaseState":0,"acknowledged":false,"autoRenewing":false}""",
        1,
        "signature",
    )

    private class RecordingBillingClient : BillingClient() {
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
}
