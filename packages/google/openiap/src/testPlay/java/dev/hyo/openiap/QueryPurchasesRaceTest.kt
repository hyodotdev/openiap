@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.hyo.openiap

import android.app.Activity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.AcknowledgePurchaseResponseListener
import com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener
import com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener
import com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingConfigResponseListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingProgramAvailabilityListener
import com.android.billingclient.api.BillingProgramReportingDetailsListener
import com.android.billingclient.api.BillingProgramReportingDetailsParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.ConsumeResponseListener
import com.android.billingclient.api.ExternalOfferAvailabilityListener
import com.android.billingclient.api.ExternalOfferInformationDialogListener
import com.android.billingclient.api.ExternalOfferReportingDetailsListener
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResponseListener
import com.android.billingclient.api.LaunchExternalLinkParams
import com.android.billingclient.api.LaunchExternalLinkResponseListener
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.helpers.ProductManager
import dev.hyo.openiap.helpers.queryAlreadyOwnedPurchases
import dev.hyo.openiap.helpers.queryPurchases
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class QueryPurchasesRaceTest {

    @Test
    fun `queryPurchases tolerates duplicate concurrent callbacks`() = runTest {
        val client = DuplicateBillingClient()

        queryPurchases(client, BillingClient.ProductType.INAPP)

        assertTrue(
            "queryPurchases must ignore duplicate concurrent callbacks without double-resuming: " +
                client.callbackFailures.joinToString { it::class.java.simpleName },
            client.callbackFailures.isEmpty()
        )
    }

    @Test
    fun `queryAlreadyOwnedPurchases tolerates duplicate concurrent callbacks`() {
        val client = DuplicateBillingClient()
        val completions = AtomicInteger(0)

        queryAlreadyOwnedPurchases(
            client,
            BillingClient.ProductType.INAPP,
            listOf("product-id")
        ) {
            completions.incrementAndGet()
        }

        assertEquals(1, completions.get())
        assertTrue(
            "queryAlreadyOwnedPurchases must ignore duplicate concurrent callbacks: " +
                client.callbackFailures.joinToString { it::class.java.simpleName },
            client.callbackFailures.isEmpty()
        )
    }

    @Test
    fun `queryAlreadyOwnedPurchases filters purchases by requested sku`() {
        val requested = billingPurchase("requested-product", "requested-token")
        assertEquals(listOf("requested-product"), requested.products)

        val client = DuplicateBillingClient(
            purchases = listOf(
                requested,
                billingPurchase("other-product", "other-token")
            )
        )
        val recoveredProductIds = mutableListOf<String>()

        queryAlreadyOwnedPurchases(
            client,
            BillingClient.ProductType.SUBS,
            listOf("requested-product")
        ) { purchases ->
            recoveredProductIds += purchases.map { it.productId }
        }

        assertEquals(listOf("requested-product"), recoveredProductIds)
    }

    @Test
    fun `ProductManager getOrQuery tolerates duplicate concurrent callbacks`() = runTest {
        val client = DuplicateBillingClient()
        val productManager = ProductManager()

        productManager.getOrQuery(client, listOf("product-id"), BillingClient.ProductType.INAPP)

        assertTrue(
            "getOrQuery must ignore duplicate concurrent callbacks without double-resuming: " +
                client.callbackFailures.joinToString { it::class.java.simpleName },
            client.callbackFailures.isEmpty()
        )
    }

    private fun billingPurchase(productId: String, token: String): Purchase = Purchase(
        """
        {
          "orderId": "order-$productId",
          "packageName": "dev.hyo.openiap.test",
          "productId": "$productId",
          "productIds": ["$productId"],
          "purchaseTime": 1,
          "purchaseState": 0,
          "purchaseToken": "$token",
          "quantity": 1,
          "acknowledged": false
        }
        """.trimIndent(),
        "signature"
    )

    private class DuplicateBillingClient(
        private val purchases: List<Purchase> = emptyList()
    ) : BillingClient() {
        val callbackFailures = Collections.synchronizedList(mutableListOf<Throwable>())

        override fun queryPurchasesAsync(
            params: QueryPurchasesParams,
            listener: PurchasesResponseListener
        ) {
            val result = BillingResult.newBuilder()
                .setResponseCode(BillingResponseCode.OK)
                .build()
            val purchaseList = purchases.ifEmpty {
                CallbackBarrierList(callbackCount = 2)
            }
            runDuplicateCallbacks {
                listener.onQueryPurchasesResponse(result, purchaseList)
            }
        }

        override fun queryProductDetailsAsync(
            params: QueryProductDetailsParams,
            listener: ProductDetailsResponseListener
        ) {
            val billingResult = BillingResult.newBuilder()
                .setResponseCode(BillingResponseCode.OK)
                .build()
            val productDetails = CallbackBarrierList<com.android.billingclient.api.ProductDetails>(
                callbackCount = 2
            )
            val result = QueryProductDetailsResult.create(productDetails, emptyList())
            runDuplicateCallbacks {
                listener.onProductDetailsResponse(billingResult, result)
            }
        }

        /**
         * Blocks callback threads inside purchase mapping, then releases them
         * together. The old implementation entered this block after checking
         * isActive, making both callbacks race into continuation.resume().
         */
        private class CallbackBarrierList<T>(
            private val callbackCount: Int
        ) : AbstractList<T>() {
            private val ready = CountDownLatch(callbackCount)

            override val size: Int = 0

            override fun get(index: Int): T {
                throw IndexOutOfBoundsException(index)
            }

            override fun iterator(): Iterator<T> = object : Iterator<T> {
                override fun hasNext(): Boolean {
                    ready.countDown()
                    ready.await(250, TimeUnit.MILLISECONDS)
                    return false
                }

                override fun next(): T {
                    throw NoSuchElementException()
                }
            }
        }

        private fun runDuplicateCallbacks(callback: () -> Unit) {
            val callbacksReady = CountDownLatch(2)
            val startCallbacks = CountDownLatch(1)
            val callbacks = List(2) {
                thread(start = false) {
                    runCatching {
                        callbacksReady.countDown()
                        check(startCallbacks.await(5, TimeUnit.SECONDS)) {
                            "timed out waiting to start duplicate callbacks"
                        }
                        callback()
                    }.onFailure { callbackFailures += it }
                }
            }

            callbacks.forEach { it.start() }
            check(callbacksReady.await(5, TimeUnit.SECONDS)) {
                "timed out waiting for duplicate callback threads"
            }
            startCallbacks.countDown()
            callbacks.forEach { it.join() }
        }

        override fun isReady(): Boolean = true

        override fun getConnectionState(): Int = ConnectionState.CONNECTED

        override fun isFeatureSupported(feature: String): BillingResult =
            unsupported()

        override fun launchBillingFlow(
            activity: Activity,
            params: BillingFlowParams
        ): BillingResult = unsupported()

        override fun showAlternativeBillingOnlyInformationDialog(
            activity: Activity,
            listener: AlternativeBillingOnlyInformationDialogListener
        ): BillingResult = unsupported()

        override fun showExternalOfferInformationDialog(
            activity: Activity,
            listener: ExternalOfferInformationDialogListener
        ): BillingResult = unsupported()

        override fun showInAppMessages(
            activity: Activity,
            params: InAppMessageParams,
            listener: InAppMessageResponseListener
        ): BillingResult = unsupported()

        override fun acknowledgePurchase(
            params: AcknowledgePurchaseParams,
            listener: AcknowledgePurchaseResponseListener
        ) = unsupportedUnit()

        override fun consumeAsync(
            params: ConsumeParams,
            listener: ConsumeResponseListener
        ) = unsupportedUnit()

        override fun createAlternativeBillingOnlyReportingDetailsAsync(
            listener: AlternativeBillingOnlyReportingDetailsListener
        ) = unsupportedUnit()

        override fun createBillingProgramReportingDetailsAsync(
            params: BillingProgramReportingDetailsParams,
            listener: BillingProgramReportingDetailsListener
        ) = unsupportedUnit()

        override fun createExternalOfferReportingDetailsAsync(
            listener: ExternalOfferReportingDetailsListener
        ) = unsupportedUnit()

        override fun endConnection() = Unit

        override fun getBillingConfigAsync(
            params: GetBillingConfigParams,
            listener: BillingConfigResponseListener
        ) = unsupportedUnit()

        override fun isAlternativeBillingOnlyAvailableAsync(
            listener: AlternativeBillingOnlyAvailabilityListener
        ) = unsupportedUnit()

        override fun isBillingProgramAvailableAsync(
            billingProgram: Int,
            listener: BillingProgramAvailabilityListener
        ) = unsupportedUnit()

        override fun isExternalOfferAvailableAsync(
            listener: ExternalOfferAvailabilityListener
        ) = unsupportedUnit()

        override fun launchExternalLink(
            activity: Activity,
            params: LaunchExternalLinkParams,
            listener: LaunchExternalLinkResponseListener
        ) = unsupportedUnit()

        override fun startConnection(listener: BillingClientStateListener) =
            unsupportedUnit()

        private fun unsupported(): BillingResult = BillingResult.newBuilder()
            .setResponseCode(BillingResponseCode.FEATURE_NOT_SUPPORTED)
            .build()

        private fun unsupportedUnit() = Unit
    }
}
