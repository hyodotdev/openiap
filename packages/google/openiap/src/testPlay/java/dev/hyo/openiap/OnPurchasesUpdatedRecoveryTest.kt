@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.hyo.openiap

import android.app.Activity
import androidx.test.core.app.ApplicationProvider
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
import com.android.billingclient.api.BillingProgramInformationDialogListener
import com.android.billingclient.api.BillingProgramInformationDialogParams
import com.android.billingclient.api.BillingProgramReportingDetailsListener
import com.android.billingclient.api.BillingProgramReportingDetailsParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.ConsumeResponseListener
import com.android.billingclient.api.ExternalOfferAvailabilityListener
import com.android.billingclient.api.ExternalOfferInformationDialogListener
import com.android.billingclient.api.ExternalOfferReportingDetailsListener
import com.android.billingclient.api.GetBillingChoiceInfoParams
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.BillingChoiceInfoResponseListener
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResponseListener
import com.android.billingclient.api.LaunchExternalLinkParams
import com.android.billingclient.api.LaunchExternalLinkResponseListener
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.Purchase as BillingPurchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import java.lang.reflect.Field
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Covers the asynchronous PurchasesUpdatedListener path of the Play-flavor
 * OpenIapModule (GitHub issue #166):
 *
 * - Ambiguous, retriable purchase-flow errors must query current ownership and
 *   recover only matching purchases created during the in-flight request.
 * - ITEM_ALREADY_OWNED delivered via the listener (instead of the synchronous
 *   launchBillingFlow result) must recover the owned purchases, notify
 *   purchase-update listeners, and resolve the pending request.
 * - Without a pending request the pre-existing failure behavior stays intact.
 * - A successful purchase update must reach purchase-update listeners even
 *   when the pending request was claimed/cleared concurrently (the old
 *   `?: return` dropped the event entirely).
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class OnPurchasesUpdatedRecoveryTest {

    @After
    fun tearDown() {
        OpenIapLog.setHandler(null)
        OpenIapLog.enable(false)
    }

    @Test
    fun `listener NETWORK_ERROR recovers a newly purchased subscription`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("subscription-id", "subscription-token", purchaseTime = 1_001)
            )
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("subscription-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
            selectedBasePlanIdsBySku = mapOf("subscription-id" to "premium-monthly"),
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertEquals(listOf("subscription-id"), updates.map { it.productId })
        assertEquals(listOf("premium-monthly"), updates.map { it.currentPlanId })
        assertEquals(1, results.size)
        assertEquals(
            listOf("subscription-token"),
            results.single().getOrThrow().map { it.purchaseToken },
        )
        assertTrue("successful recovery must not emit purchase errors: $errors", errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `ambiguous purchase errors reconcile current ownership`() {
        val ambiguousCodes = listOf(
            BillingClient.BillingResponseCode.NETWORK_ERROR,
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
            BillingClient.BillingResponseCode.ERROR,
        )

        for (responseCode in ambiguousCodes) {
            val client = RecordingBillingClient(
                ownedPurchases = listOf(
                    billingPurchase("product-id", "token-$responseCode", purchaseTime = 1_001)
                )
            )
            val module = module()
            setBillingClient(module, client)
            val results = mutableListOf<Result<List<Purchase>>>()
            installPendingPurchase(
                module = module,
                client = client,
                callback = { results += it },
                skus = setOf("product-id"),
                productType = BillingClient.ProductType.INAPP,
                launchStartedAtMillis = 1_000.0,
            )
            val updates = mutableListOf<Purchase>()
            module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

            module.onPurchasesUpdated(billingResult(responseCode, "ambiguous"), null)

            assertEquals("responseCode=$responseCode", 1, client.queryPurchasesCalls.get())
            assertEquals("responseCode=$responseCode", 1, results.size)
            assertEquals(
                "responseCode=$responseCode",
                listOf("token-$responseCode"),
                results.single().getOrThrow().map { it.purchaseToken },
            )
            assertEquals(
                "responseCode=$responseCode",
                listOf("token-$responseCode"),
                updates.map { it.purchaseToken },
            )
        }
    }

    @Test
    fun `listener NETWORK_ERROR does not recover pre-existing ownership`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("subscription-id", "old-token", purchaseTime = 999)
            )
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("subscription-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertTrue("old ownership must not be delivered: $updates", updates.isEmpty())
        assertEquals(1, results.size)
        assertEquals(emptyList<Purchase>(), results.single().getOrThrow())
        assertEquals(1, errors.size)
        assertTrue(errors.single() is OpenIapError.NetworkFailure)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `non ambiguous purchase error does not query ownership`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("product-id", "owned-token", purchaseTime = 1_001)
            )
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1_000.0,
        )

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.BILLING_UNAVAILABLE, "unavailable"),
            null,
        )

        assertEquals(0, client.queryPurchasesCalls.get())
        assertEquals(1, results.size)
        assertEquals(emptyList<Purchase>(), results.single().getOrThrow())
    }

    @Test
    fun `ambiguous recovery does not duplicate a purchase completed during query`() {
        val recovered = billingPurchase("product-id", "purchase-token", purchaseTime = 1_001)
        val client = RecordingBillingClient(ownedPurchases = listOf(recovered))
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1_000.0,
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        client.beforeQueryPurchasesResponse = {
            module.onPurchasesUpdated(
                billingResult(BillingClient.BillingResponseCode.OK),
                listOf(recovered),
            )
        }

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertEquals(1, results.size)
        assertEquals(
            "the same purchase must only reach listeners once",
            listOf("purchase-token"),
            updates.map { it.purchaseToken },
        )
    }

    @Test
    fun `listener ITEM_ALREADY_OWNED with pending request recovers owned purchases`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(billingPurchase("product-id", "owned-token"))
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, "already owned"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertEquals(listOf("product-id"), updates.map { it.productId })
        assertEquals(1, results.size)
        assertEquals(
            listOf("product-id"),
            results.single().getOrThrow().map { it.productId },
        )
        assertTrue(
            "successful recovery must not emit a purchase error: $errors",
            errors.isEmpty(),
        )
        assertNull(
            "pending purchase must be claimed by the recovery",
            pendingPurchaseField().get(module),
        )
    }

    @Test
    fun `listener ITEM_ALREADY_OWNED still delivers recovery when request clears during query`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(billingPurchase("product-id", "owned-token"))
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        client.beforeQueryPurchasesResponse = {
            pendingPurchaseField().set(module, null)
        }

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, "already owned"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertEquals(
            "recovered store purchase must still reach active listeners",
            listOf("product-id"),
            updates.map { it.productId },
        )
        assertTrue("cleared request must not be completed: $results", results.isEmpty())
        assertTrue("successful listener recovery must not emit errors: $errors", errors.isEmpty())
    }

    @Test
    fun `listener ITEM_ALREADY_OWNED without pending request keeps existing behavior`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(billingPurchase("product-id", "owned-token"))
        )
        val module = module()
        setBillingClient(module, client)
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, "already owned"),
            null,
        )

        assertEquals(
            "recovery must not run without a pending request",
            0,
            client.queryPurchasesCalls.get(),
        )
        assertTrue(updates.isEmpty())
        assertTrue(errors.isEmpty())
    }

    @Test
    fun `listener ITEM_ALREADY_OWNED with empty recovery falls back to the error path`() {
        val client = RecordingBillingClient(ownedPurchases = emptyList())
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, "already owned"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertTrue(updates.isEmpty())
        assertEquals(1, results.size)
        assertEquals(emptyList<Purchase>(), results.single().getOrThrow())
        assertEquals(1, errors.size)
        assertTrue(
            "empty recovery must keep the ItemAlreadyOwned error: ${errors.single()}",
            errors.single() is OpenIapError.ItemAlreadyOwned,
        )
    }

    @Test
    fun `purchase update reaches listeners when the pending request is cleared mid dispatch`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        // Simulate a polling/completion path clearing only the pending request
        // after onPurchasesUpdated snapshotted it but before callback claim.
        // The BillingClient remains active, so listener delivery must continue.
        val cleared = AtomicBoolean(false)
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { _, message, _ ->
            if (message.startsWith("onPurchasesUpdated:") && cleared.compareAndSet(false, true)) {
                pendingPurchaseField().set(module, null)
            }
        }

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "purchase-token", purchaseTime = 5)),
        )

        assertTrue("test hook must have cleared the pending request", cleared.get())
        assertEquals(
            "listeners must still receive the store purchase",
            listOf("product-id"),
            updates.map { it.productId },
        )
        assertTrue(
            "cleared request must not be resolved by this dispatch: $results",
            results.isEmpty(),
        )
        assertTrue(errors.isEmpty())
    }

    @Test
    fun `purchase update from a connection invalidated during dispatch is not delivered`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        val invalidated = AtomicBoolean(false)
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { _, message, _ ->
            if (message.startsWith("onPurchasesUpdated:") &&
                invalidated.compareAndSet(false, true)
            ) {
                runBlocking { module.endConnection() }
            }
        }

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "purchase-token", purchaseTime = 5)),
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

    @Test
    fun `purchase update resolves the pending request and reaches listeners`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("product-id"),
            productType = BillingClient.ProductType.INAPP,
            launchStartedAtMillis = 1.0,
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "purchase-token", purchaseTime = 5)),
        )

        assertEquals(listOf("product-id"), updates.map { it.productId })
        assertEquals(1, results.size)
        assertEquals(
            listOf("product-id"),
            results.single().getOrThrow().map { it.productId },
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

    /**
     * Installs the module-private PendingPurchaseSnapshot the way a launched
     * requestPurchase would leave it (generation 0 matches a fresh module).
     */
    private fun installPendingPurchase(
        module: OpenIapModule,
        client: BillingClient,
        callback: (Result<List<Purchase>>) -> Unit,
        skus: Set<String>,
        productType: String,
        launchStartedAtMillis: Double?,
        selectedBasePlanIdsBySku: Map<String, String?> = emptyMap(),
    ) {
        val snapshotClass = Class.forName("dev.hyo.openiap.OpenIapModule\$PendingPurchaseSnapshot")
        val constructor = snapshotClass.declaredConstructors.first { candidate ->
            candidate.parameterTypes.none { it.simpleName == "DefaultConstructorMarker" }
        }
        constructor.isAccessible = true
        val snapshot = constructor.newInstance(
            client,
            0L,
            callback,
            skus,
            productType,
            selectedBasePlanIdsBySku,
            launchStartedAtMillis,
        )
        pendingPurchaseField().set(module, snapshot)
    }

    private fun billingResult(responseCode: Int, debugMessage: String = ""): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(responseCode)
            .setDebugMessage(debugMessage)
            .build()

    private fun billingPurchase(
        productId: String,
        token: String,
        purchaseTime: Long = 1,
    ): BillingPurchase = BillingPurchase(
        """
        {
          "orderId": "order-$productId",
          "packageName": "dev.hyo.openiap.test",
          "productId": "$productId",
          "productIds": ["$productId"],
          "purchaseTime": $purchaseTime,
          "purchaseState": 0,
          "purchaseToken": "$token",
          "quantity": 1,
          "acknowledged": false
        }
        """.trimIndent(),
        "signature"
    )

    private class RecordingBillingClient(
        private val ownedPurchases: List<BillingPurchase> = emptyList(),
    ) : BillingClient() {
        val queryPurchasesCalls = AtomicInteger(0)
        var beforeQueryPurchasesResponse: (() -> Unit)? = null

        override fun queryPurchasesAsync(
            params: QueryPurchasesParams,
            listener: PurchasesResponseListener
        ) {
            queryPurchasesCalls.incrementAndGet()
            beforeQueryPurchasesResponse?.invoke()
            val result = BillingResult.newBuilder()
                .setResponseCode(BillingResponseCode.OK)
                .build()
            listener.onQueryPurchasesResponse(result, ownedPurchases)
        }

        override fun isReady(): Boolean = true

        override fun getConnectionState(): Int = ConnectionState.CONNECTED

        override fun isFeatureSupported(feature: String): BillingResult =
            unsupported()

        override fun launchBillingFlow(
            activity: Activity,
            params: BillingFlowParams
        ): BillingResult = unsupported()

        override fun queryProductDetailsAsync(
            params: QueryProductDetailsParams,
            listener: ProductDetailsResponseListener
        ) = unsupportedUnit()

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

        override fun showBillingProgramInformationDialog(
            activity: Activity,
            params: BillingProgramInformationDialogParams,
            listener: BillingProgramInformationDialogListener
        ) = unsupportedUnit()

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

        override fun getBillingChoiceInfoAsync(
            params: GetBillingChoiceInfoParams,
            listener: BillingChoiceInfoResponseListener
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
