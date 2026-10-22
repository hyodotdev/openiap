@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package dev.hyo.openiap

import android.app.Activity
import android.os.Looper
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
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.Purchase as BillingPurchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.helpers.finishPurchaseToken
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import java.lang.reflect.Field
import java.time.Duration
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowLooper

/**
 * Covers Play purchase recovery, request ownership, and alternative billing.
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
    fun `listener NETWORK_ERROR retries transient ownership query failures`() {
        val purchaseResponseCodes = listOf(
            BillingClient.BillingResponseCode.NETWORK_ERROR,
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.OK,
        )
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("product-id", "purchase-token", purchaseTime = 1_001)
            ),
            purchaseResponseCodes = purchaseResponseCodes,
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
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )
        assertEquals(1, client.queryPurchasesCalls.get())
        assertTrue("retry result must remain pending until the delay elapses", results.isEmpty())
        repeat(purchaseResponseCodes.lastIndex) {
            ShadowLooper.runMainLooperToNextTask()
        }

        assertEquals(purchaseResponseCodes.size, client.queryPurchasesCalls.get())
        assertEquals(listOf("purchase-token"), updates.map { it.purchaseToken })
        assertEquals(
            listOf("purchase-token"),
            results.single().getOrThrow().map { it.purchaseToken },
        )
        assertTrue("successful retry must not emit purchase errors: $errors", errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `listener NETWORK_ERROR preserves original error after retries exhaust`() {
        val purchaseResponseCodes = listOf(
            BillingClient.BillingResponseCode.NETWORK_ERROR,
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.NETWORK_ERROR,
        )
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("product-id", "purchase-token", purchaseTime = 1_001)
            ),
            purchaseResponseCodes = purchaseResponseCodes,
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
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )
        assertEquals(1, client.queryPurchasesCalls.get())
        assertTrue("retry result must remain pending until the delay elapses", results.isEmpty())
        repeat(purchaseResponseCodes.lastIndex) {
            ShadowLooper.runMainLooperToNextTask()
        }

        assertEquals(purchaseResponseCodes.size, client.queryPurchasesCalls.get())
        assertTrue("failed retries must not deliver purchases: $updates", updates.isEmpty())
        assertEquals(emptyList<Purchase>(), results.single().getOrThrow())
        assertEquals(1, errors.size)
        assertTrue(errors.single() is OpenIapError.NetworkFailure)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `listener NETWORK_ERROR does not retry a fatal ownership query failure`() {
        val client = RecordingBillingClient(
            purchaseResponseCodes = listOf(
                BillingClient.BillingResponseCode.DEVELOPER_ERROR,
            ),
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
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        assertEquals(emptyList<Purchase>(), results.single().getOrThrow())
        assertEquals(1, errors.size)
        assertTrue(errors.single() is OpenIapError.NetworkFailure)
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
            ownedPurchases = listOf(billingPurchase("subscription-id", "old-token", purchaseTime = 1_001))
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
            tokensBeforeLaunch = setOf("old-token"),
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
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

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
        assertEquals("endConnection must publish one terminal purchase error", 1, errors.size)
        assertTrue(errors.single() is OpenIapError.ServiceDisconnected)
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

    @Test
    fun `a matching purchase stamped before the launch still resolves the request`() {
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
            launchStartedAtMillis = 10_000.0,
        )

        // The device clock runs ahead of Play, which stamps purchaseTime.
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "purchase-token", purchaseTime = 5_000)),
        )

        assertEquals(1, results.size)
        assertEquals(listOf("purchase-token"), results.single().getOrThrow().map { it.purchaseToken })
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a purchase Play reported before the launch does not resolve the request`() {
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
            launchStartedAtMillis = 1_000.0,
            tokensBeforeLaunch = setOf("stale-token"),
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        // An unconsumed purchase from a crashed session, stamped after the launch.
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "stale-token", purchaseTime = 5_000)),
        )

        assertEquals(listOf("stale-token"), updates.map { it.purchaseToken })
        assertTrue("an earlier purchase must not resolve the request: $results", results.isEmpty())
    }

    @Test
    fun `a new pending purchase resolves the request`() {
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
            launchStartedAtMillis = 1_000.0,
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "pending-token", pending = true)),
        )

        assertEquals(listOf(PurchaseState.Pending), updates.map { it.purchaseState })
        assertEquals(
            listOf(PurchaseState.Pending),
            results.single().getOrThrow().map { it.purchaseState },
        )
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a pending prepaid top-up resolves the request through its pending update`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("prepaid-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
            tokensBeforeLaunch = setOf("current-token"),
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        // Play reports the existing purchase; the top-up's token is in the pending update.
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(
                billingPurchase(
                    "prepaid-id",
                    "current-token",
                    purchaseTime = 500,
                    acknowledged = true,
                    pendingUpdate = "prepaid-id" to "top-up-token",
                )
            ),
        )

        assertEquals(listOf("current-token"), updates.map { it.purchaseToken })
        val resolved = results.single().getOrThrow().single() as PurchaseAndroid
        assertEquals("current-token", resolved.purchaseToken)
        assertEquals("top-up-token", resolved.pendingPurchaseUpdateAndroid?.purchaseToken)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a pending upgrade to another product resolves the request through its pending update`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("premium-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
            tokensBeforeLaunch = setOf("basic-token"),
        )

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(
                billingPurchase(
                    "basic-id",
                    "basic-token",
                    purchaseTime = 500,
                    acknowledged = true,
                    pendingUpdate = "premium-id" to "upgrade-token",
                )
            ),
        )

        val resolved = results.single().getOrThrow().single() as PurchaseAndroid
        assertEquals("basic-id", resolved.productId)
        assertEquals(listOf("premium-id"), resolved.pendingPurchaseUpdateAndroid?.products)
        assertEquals("upgrade-token", resolved.pendingPurchaseUpdateAndroid?.purchaseToken)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a pending plan change does not give the existing purchase the unpaid plan`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("prepaid-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
            selectedBasePlanIdsBySku = mapOf("prepaid-id" to "yearly"),
            tokensBeforeLaunch = setOf("current-token"),
        )
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        // Same product, new base plan: Play reports the existing purchase, still on its old plan.
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(
                billingPurchase(
                    "prepaid-id",
                    "current-token",
                    purchaseTime = 500,
                    acknowledged = true,
                    pendingUpdate = "prepaid-id" to "change-token",
                )
            ),
        )

        val resolved = results.single().getOrThrow().single() as PurchaseAndroid
        assertEquals("change-token", resolved.pendingPurchaseUpdateAndroid?.purchaseToken)
        assertTrue(
            "the unpaid plan must not reach the existing purchase: ${resolved.currentPlanId}",
            resolved.currentPlanId != "yearly" && updates.single().currentPlanId != "yearly",
        )
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a pending update Play reported before the launch does not resolve the request`() {
        // An unpaid top-up left over from an earlier session.
        val existing = billingPurchase(
            "product-id",
            "current-token",
            acknowledged = true,
            pendingUpdate = "product-id" to "leftover-token",
        )
        val client = RecordingBillingClient(
            ownedPurchases = listOf(existing),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.OK,
        )
        val module = module()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        val purchases = requestPurchaseUntilFlowTimeout(module, client) {
            module.onPurchasesUpdated(billingResult(BillingClient.BillingResponseCode.OK), listOf(existing))
        }

        assertEquals(emptyList<Purchase>(), purchases)
        assertTrue("timeout must be published: $errors", errors.single() is OpenIapError.ServiceTimeout)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `listener NETWORK_ERROR recovers a pending update on the existing purchase`() {
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase(
                    "prepaid-id",
                    "current-token",
                    purchaseTime = 500,
                    acknowledged = true,
                    pendingUpdate = "prepaid-id" to "top-up-token",
                )
            )
        )
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module = module,
            client = client,
            callback = { results += it },
            skus = setOf("prepaid-id"),
            productType = BillingClient.ProductType.SUBS,
            launchStartedAtMillis = 1_000.0,
            selectedBasePlanIdsBySku = mapOf("prepaid-id" to "yearly"),
            tokensBeforeLaunch = setOf("current-token"),
        )
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.NETWORK_ERROR, "network lost"),
            null,
        )

        assertEquals(1, client.queryPurchasesCalls.get())
        val resolved = results.single().getOrThrow().single() as PurchaseAndroid
        assertEquals("current-token", resolved.purchaseToken)
        assertEquals("top-up-token", resolved.pendingPurchaseUpdateAndroid?.purchaseToken)
        assertTrue(
            "the unpaid plan must not reach the existing purchase: ${resolved.currentPlanId}",
            resolved.currentPlanId != "yearly",
        )
        assertTrue("successful recovery must not emit purchase errors: $errors", errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a launched purchase Play never resolves frees the slot after the flow timeout`() {
        // Earlier purchases Play still reports: a pending one and an unconsumed one.
        val client = RecordingBillingClient(
            ownedPurchases = listOf(
                billingPurchase("product-id", "stale-pending-token", pending = true),
                billingPurchase("product-id", "stale-unconsumed-token"),
            ),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.OK,
        )
        val module = module()
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        val purchases = requestPurchaseUntilFlowTimeout(module, client)

        assertEquals(emptyList<Purchase>(), purchases)
        assertEquals("ownership is read at launch and at the timeout", 2, client.queryPurchasesCalls.get())
        assertTrue("timeout must be published: $errors", errors.single() is OpenIapError.ServiceTimeout)
        assertNull("the slot must be free for the next purchase", pendingPurchaseField().get(module))
    }

    @Test
    fun `a flow timeout resolves with a new purchase Play never reported`() {
        val stale = billingPurchase("product-id", "stale-unconsumed-token")
        val client = RecordingBillingClient(
            ownedPurchases = listOf(stale),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.OK,
        )
        val module = module()
        val errors = mutableListOf<OpenIapError>()
        val updates = mutableListOf<Purchase>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        val missed = billingPurchase("product-id", "missed-token")

        val purchases = requestPurchaseUntilFlowTimeout(module, client) {
            client.ownedPurchases = listOf(stale, missed)
        }
        // Play reports the same purchase after recovery resolved it.
        module.onPurchasesUpdated(billingResult(BillingClient.BillingResponseCode.OK), listOf(missed))

        assertEquals(listOf("missed-token"), purchases.map { it.purchaseToken })
        assertEquals("listeners get the recovered purchase once", listOf("missed-token"), updates.map { it.purchaseToken })
        assertTrue("recovery must not publish an error: $errors", errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a refused consume surfaces Play's mapped error through finishPurchaseToken`() {
        val client = RecordingBillingClient(
            consumeResponseCode = BillingClient.BillingResponseCode.ITEM_NOT_OWNED,
        )
        val module = module()
        setBillingClient(module, client)

        val thrown = runCatching {
            runBlocking { (module as OpenIapProtocol).finishPurchaseToken("token", isConsumable = true) }
        }.exceptionOrNull()

        assertTrue("$thrown", thrown is OpenIapError.ItemNotOwned)
        assertEquals("refused", (thrown as OpenIapError).debugMessage)
        assertEquals(false, runBlocking { module.consumePurchaseAndroid("token") })
    }

    @Test
    fun `delivered once, then already-owned recovery re-delivers`() {
        val owned = billingPurchase("product-id", "owned-token")
        val client = RecordingBillingClient(
            ownedPurchases = listOf(owned),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED,
        )
        val module = module()
        setBillingClient(module, client)
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.onPurchasesUpdated(billingResult(BillingClient.BillingResponseCode.OK), listOf(owned))

        // The app failed to validate it and the user taps buy again.
        val outcome = startPurchase(module, client)
        pumpMainLooperUntil { outcome.get() != null }

        assertEquals(listOf("owned-token"), purchasesOf(outcome).map { it.purchaseToken })
        assertEquals(listOf("owned-token", "owned-token"), updates.map { it.purchaseToken })
    }

    @Test
    fun `already owned reported by both the listener and the launch result is delivered once`() {
        val owned = billingPurchase("product-id", "owned-token")
        val client = RecordingBillingClient(
            ownedPurchases = listOf(owned),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED,
        )
        val module = module()
        // Play also posts the refusal to the purchases listener.
        client.onLaunch = {
            module.onPurchasesUpdated(
                billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED),
                null,
            )
        }
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        val outcome = startPurchase(module, client)
        pumpMainLooperUntil { outcome.get() != null }

        assertEquals(listOf("owned-token"), purchasesOf(outcome).map { it.purchaseToken })
        assertEquals(listOf("owned-token"), updates.map { it.purchaseToken })
    }

    @Test
    fun `late callback of a previous request after a new request starts is not re-delivered`() {
        val purchase = billingPurchase("product-id", "delivered-token")
        val client = RecordingBillingClient(
            ownedPurchases = listOf(purchase),
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
        )
        val module = module()
        setBillingClient(module, client)
        val updates = mutableListOf<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.onPurchasesUpdated(billingResult(BillingClient.BillingResponseCode.OK), listOf(purchase))

        val outcome = startPurchase(module, client)
        pumpMainLooperUntil { outcome.get() != null }
        module.onPurchasesUpdated(billingResult(BillingClient.BillingResponseCode.OK), listOf(purchase))

        assertEquals(listOf("delivered-token"), updates.map { it.purchaseToken })
    }

    @Test
    fun `a resolved purchase leaves no flow timeout scheduled`() {
        val client = RecordingBillingClient(
            productDetails = listOf(inAppProductDetails("product-id")),
            launchResponseCode = BillingClient.BillingResponseCode.OK,
        )
        val module = module()

        val outcome = startPurchase(module, client)
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "new-token")),
        )
        pumpMainLooperUntil { outcome.get() != null }

        assertEquals(listOf("new-token"), purchasesOf(outcome).map { it.purchaseToken })
        assertEquals(Duration.ZERO, shadowOf(Looper.getMainLooper()).nextScheduledTaskTime)
    }

    /** Launches a purchase Play never answers and runs the main looper past the flow timeout. */
    private fun requestPurchaseUntilFlowTimeout(
        module: OpenIapModule,
        client: RecordingBillingClient,
        afterLaunch: () -> Unit = {},
    ): List<Purchase> {
        val outcome = startPurchase(module, client)
        afterLaunch()
        ShadowLooper.idleMainLooper(14, TimeUnit.MINUTES)
        assertNull("the request waits for Play inside the window", outcome.get())

        ShadowLooper.idleMainLooper(1, TimeUnit.MINUTES)
        pumpMainLooperUntil { outcome.get() != null }
        return purchasesOf(outcome)
    }

    /** Starts requestPurchase on a worker and runs main-looper work until Play launches it. */
    private fun startPurchase(
        module: OpenIapModule,
        client: RecordingBillingClient,
    ): AtomicReference<Result<RequestPurchaseResult?>> {
        setBillingClient(module, client)
        module.setActivity(Robolectric.buildActivity(Activity::class.java).create().get())
        val outcome = AtomicReference<Result<RequestPurchaseResult?>>()
        thread(isDaemon = true) {
            outcome.set(runCatching { runBlocking { module.requestPurchase(purchaseProps()) } })
        }
        pumpMainLooperUntil { client.launchCalls.get() > 0 }
        assertEquals("the purchase flow must launch", 1, client.launchCalls.get())
        return outcome
    }

    private fun pumpMainLooperUntil(condition: () -> Boolean) {
        var attempts = 0
        while (!condition() && attempts++ < 500) {
            ShadowLooper.idleMainLooper()
            Thread.sleep(10)
        }
    }

    private fun purchasesOf(outcome: AtomicReference<Result<RequestPurchaseResult?>>): List<Purchase> {
        val result = checkNotNull(outcome.get()) { "the request never completed" }
        return (result.getOrThrow() as RequestPurchaseResultPurchases).value.orEmpty()
    }

    private fun purchaseProps() = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
                google = RequestPurchaseAndroidProps(skus = listOf("product-id")),
            ),
        ),
        type = ProductQueryType.InApp,
    )

    @Test
    fun `a connection replaced before launch resolves empty with one terminal error`() {
        val module = module()
        val invalidated = AtomicBoolean(false)
        val client = RecordingBillingClient(
            onReadyCheck = {
                if (invalidated.compareAndSet(false, true)) {
                    setBillingClient(module, null)
                }
            },
        )
        setBillingClient(module, client)
        module.setActivity(Robolectric.buildActivity(Activity::class.java).create().get())
        val errors = mutableListOf<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        val result = runBlocking { module.requestPurchase(purchaseProps()) }

        assertTrue("readiness hook must replace the client", invalidated.get())
        assertEquals(emptyList<Purchase>(), (result as RequestPurchaseResultPurchases).value)
        assertEquals("the ownership read and outer catch share one event gate", 1, errors.size)
        assertTrue(errors.single() is OpenIapError.ServiceDisconnected)
        assertEquals("nothing launches without the ownership read", 0, client.launchCalls.get())
    }

    @Test
    fun `user choice completes the Play request without a purchase or error`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        val choices = mutableListOf<UserChoiceBillingDetails>()
        val updates = mutableListOf<Purchase>()
        val errors = mutableListOf<OpenIapError>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        val details = userChoiceDetails()

        module.handleUserChoiceBilling(client, 0L, details)
        module.handleUserChoiceBilling(client, 0L, details)

        assertEquals(listOf(details), choices)
        assertEquals(1, results.size)
        assertTrue(results.single().getOrThrow().isEmpty())
        assertTrue(updates.isEmpty())
        assertTrue(errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `user choice releases the old request before a listener starts another`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val firstResults = mutableListOf<Result<List<Purchase>>>()
        val nextResults = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client, { firstResults += it }, setOf("product-id"), "inapp", 1.0)
        val details = userChoiceDetails()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener {
            choices += it
            assertNull("the next request must not be blocked", pendingPurchaseField().get(module))
            installPendingPurchase(module, client, { nextResults += it }, setOf("product-id"), "inapp", 2.0)
            if (choices.size == 1) module.handleUserChoiceBilling(client, 0L, details)
        })

        module.handleUserChoiceBilling(client, 0L, details)
        module.handleUserChoiceBilling(client, 0L, details)

        assertEquals(listOf(details), choices)
        assertEquals(1, firstResults.size)
        assertTrue(firstResults.single().getOrThrow().isEmpty())
        assertTrue("the UCB callback must not complete the new request", nextResults.isEmpty())
        module.onPurchasesUpdated(
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(billingPurchase("product-id", "next-token", purchaseTime = 3)),
        )
        assertEquals(listOf("next-token"), nextResults.single().getOrThrow().map { it.purchaseToken })
    }

    @Test
    fun `a fresh user choice token completes the next request for the same product`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        val firstChoice = userChoiceDetails()
        val nextChoice = firstChoice.copy(externalTransactionToken = "next-external-token")

        for (details in listOf(firstChoice, nextChoice)) {
            installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
            module.handleUserChoiceBilling(client, 0L, details)
            module.handleUserChoiceBilling(client, 0L, details)
        }

        assertEquals(listOf(firstChoice, nextChoice), choices)
        assertEquals(2, results.size)
        assertTrue(results.all { it.getOrThrow().isEmpty() })
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `user choice fails when the connection ends after claiming the request`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        val errors = mutableListOf<OpenIapError>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        val disconnected = AtomicBoolean(false)
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { _, message, _ ->
            if (message == "User selected alternative billing" &&
                disconnected.compareAndSet(false, true)
            ) {
                assertNull("the request must already be claimed", pendingPurchaseField().get(module))
                runBlocking { module.endConnection() }
            }
        }

        module.handleUserChoiceBilling(client, 0L, userChoiceDetails())

        assertTrue("test hook must end the connection", disconnected.get())
        assertTrue(choices.isEmpty())
        assertEquals(1, results.size)
        val error = results.single().exceptionOrNull()
        assertTrue(error is OpenIapError.ServiceDisconnected)
        assertEquals(listOf(error), errors)
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `user choice ignores stale connections and generations`() {
        val client = RecordingBillingClient()
        val staleClient = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        val choices = mutableListOf<UserChoiceBillingDetails>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        val pending = pendingPurchaseField().get(module)

        module.handleUserChoiceBilling(staleClient, 0L, userChoiceDetails())
        module.handleUserChoiceBilling(client, -1L, userChoiceDetails())

        assertEquals(pending, pendingPurchaseField().get(module))
        assertTrue(results.isEmpty())
        assertTrue(choices.isEmpty())
    }

    @Test
    fun `user choice does not claim an unlaunched or different product request`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        for ((product, launchedAt) in listOf("product-id" to null, "other-product" to 1.0)) {
            installPendingPurchase(module, client, { results += it }, setOf(product), "inapp", launchedAt)
            val pending = pendingPurchaseField().get(module)

            module.handleUserChoiceBilling(client, 0L, userChoiceDetails())

            assertEquals(pending, pendingPurchaseField().get(module))
            assertTrue(results.isEmpty())
            assertTrue(choices.isEmpty())
        }
    }

    @Test
    fun `throwing user choice listener cannot strand the purchase request`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { error("listener failed") })
        val choices = mutableListOf<UserChoiceBillingDetails>()
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })

        module.handleUserChoiceBilling(client, 0L, userChoiceDetails())

        assertEquals(1, choices.size)
        assertEquals(1, results.size)
        assertTrue(results.single().getOrThrow().isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `redelivered token cannot complete a later request after reconnect`() {
        val firstClient = RecordingBillingClient()
        val module = module()
        setBillingClient(module, firstClient)
        val firstResults = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, firstClient, { firstResults += it }, setOf("product-id"), "inapp", 1.0)
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { })
        val details = userChoiceDetails()

        module.handleUserChoiceBilling(firstClient, 0L, details)
        assertEquals(1, firstResults.size)
        assertTrue(firstResults.single().getOrThrow().isEmpty())

        // Reconnect through the real transition path, then start a new request.
        val replace = OpenIapModule::class.java.getDeclaredMethod(
            "replaceBillingClientLocked",
            BillingClient::class.java,
        ).apply { isAccessible = true }
        replace.invoke(module, null as Any?)
        val nextClient = RecordingBillingClient()
        replace.invoke(module, nextClient)
        OpenIapModule::class.java.getDeclaredField("connectionGeneration").apply {
            isAccessible = true
            setLong(module, 1L)
        }
        val nextResults = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(
            module, nextClient, { nextResults += it }, setOf("product-id"), "inapp", 2.0,
            generation = 1L,
        )
        val pending = pendingPurchaseField().get(module)

        module.handleUserChoiceBilling(nextClient, 1L, details)

        assertEquals(pending, pendingPurchaseField().get(module))
        assertTrue(nextResults.isEmpty())
    }

    @Test
    fun `duplicate token in the same generation cannot complete a later request`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val firstResults = mutableListOf<Result<List<Purchase>>>()
        val nextResults = mutableListOf<Result<List<Purchase>>>()
        installPendingPurchase(module, client, { firstResults += it }, setOf("product-id"), "inapp", 1.0)
        val details = userChoiceDetails()

        module.handleUserChoiceBilling(client, 0L, details)
        assertEquals(1, firstResults.size)

        installPendingPurchase(module, client, { nextResults += it }, setOf("product-id"), "inapp", 2.0)
        val pending = pendingPurchaseField().get(module)
        module.handleUserChoiceBilling(client, 0L, details)

        assertEquals(pending, pendingPurchaseField().get(module))
        assertTrue(nextResults.isEmpty())
    }

    @Test
    fun `blank token fails the launched request instead of stranding it`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        val errors = mutableListOf<OpenIapError>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.handleUserChoiceBilling(client, 0L, userChoiceDetails(token = ""))

        assertEquals(1, results.size)
        val error = results.single().exceptionOrNull()
        assertTrue(error is OpenIapError.PurchaseFailed)
        assertEquals(listOf(error), errors)
        assertTrue(choices.isEmpty())
        assertNull(pendingPurchaseField().get(module))

        // A blank token must not poison dedup: a valid token still completes the retry.
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 2.0)
        module.handleUserChoiceBilling(client, 0L, userChoiceDetails())

        assertEquals(2, results.size)
        assertTrue(results.last().getOrThrow().isEmpty())
        assertEquals(1, choices.size)
    }

    @Test
    fun `empty products fail the launched request instead of stranding it`() {
        val client = RecordingBillingClient()
        val module = module()
        setBillingClient(module, client)
        val results = mutableListOf<Result<List<Purchase>>>()
        val choices = mutableListOf<UserChoiceBillingDetails>()
        val errors = mutableListOf<OpenIapError>()
        installPendingPurchase(module, client, { results += it }, setOf("product-id"), "inapp", 1.0)
        module.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { choices += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        module.handleUserChoiceBilling(client, 0L, userChoiceDetails(products = emptyList()))

        assertEquals(1, results.size)
        val error = results.single().exceptionOrNull()
        assertTrue(error is OpenIapError.PurchaseFailed)
        assertEquals(listOf(error), errors)
        assertTrue(choices.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    private fun userChoiceDetails(
        token: String = "external-token",
        products: List<String> = listOf("product-id"),
    ) = UserChoiceBillingDetails(
        externalTransactionToken = token,
        products = products,
    )

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

    /** Generation 0 matches a fresh module's launched request. */
    private fun installPendingPurchase(
        module: OpenIapModule,
        client: BillingClient,
        callback: (Result<List<Purchase>>) -> Unit,
        skus: Set<String>,
        productType: String,
        launchStartedAtMillis: Double?,
        selectedBasePlanIdsBySku: Map<String, String?> = emptyMap(),
        generation: Long = 0L,
        tokensBeforeLaunch: Set<String> = emptySet(),
    ) {
        val snapshotClass = Class.forName("dev.hyo.openiap.OpenIapModule\$PendingPurchaseSnapshot")
        val gateClass = Class.forName("dev.hyo.openiap.OpenIapModule\$PurchaseErrorEventGate")
        val emitMethod = OpenIapModule::class.java.getDeclaredMethod(
            "emitPurchaseError",
            OpenIapError::class.java,
        ).apply { isAccessible = true }
        val publisher: (OpenIapError) -> Unit = { error ->
            emitMethod.invoke(module, error)
        }
        val gateConstructor = gateClass.declaredConstructors.single().apply {
            isAccessible = true
        }
        val errorEventGate = gateConstructor.newInstance(publisher)
        val constructor = snapshotClass.declaredConstructors.first { candidate ->
            candidate.parameterTypes.none { it.simpleName == "DefaultConstructorMarker" }
        }
        constructor.isAccessible = true
        val snapshot = constructor.newInstance(
            client,
            generation,
            callback,
            errorEventGate,
            skus,
            productType,
            selectedBasePlanIdsBySku,
            launchStartedAtMillis,
            tokensBeforeLaunch,
        )
        pendingPurchaseField().set(module, snapshot)
    }

    private fun inAppProductDetails(productId: String): ProductDetails =
        ProductDetails::class.java.getDeclaredConstructor(String::class.java).apply {
            isAccessible = true
        }.newInstance(
            """
            {
              "productId": "$productId",
              "type": "inapp",
              "title": "Title",
              "name": "Name",
              "description": "Description",
              "skuDetailsToken": "sku-details-token",
              "oneTimePurchaseOfferDetails": {
                "priceAmountMicros": 1000000,
                "priceCurrencyCode": "USD",
                "formattedPrice": "${'$'}1.00",
                "offerIdToken": "offer-token"
              }
            }
            """.trimIndent()
        )

    private fun billingResult(responseCode: Int, debugMessage: String = ""): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(responseCode)
            .setDebugMessage(debugMessage)
            .build()

    private fun billingPurchase(
        productId: String,
        token: String,
        purchaseTime: Long = 1,
        pending: Boolean = false,
        acknowledged: Boolean = false,
        pendingUpdate: Pair<String, String>? = null,
    ): BillingPurchase = BillingPurchase(
        """
        {
          "orderId": "order-$productId",
          "packageName": "dev.hyo.openiap.test",
          "productId": "$productId",
          "productIds": ["$productId"],
          "purchaseTime": $purchaseTime,
          "purchaseState": ${if (pending) 4 else 0},
          "purchaseToken": "$token",
          "quantity": 1,
          "acknowledged": $acknowledged${pendingUpdate?.let { (updateProduct, updateToken) ->
            """,
          "pendingPurchaseUpdate": {
            "productIds": ["$updateProduct"],
            "purchaseToken": "$updateToken"
          }"""
        }.orEmpty()}
        }
        """.trimIndent(),
        "signature"
    )

    private class RecordingBillingClient(
        var ownedPurchases: List<BillingPurchase> = emptyList(),
        purchaseResponseCodes: List<Int> = emptyList(),
        private val onReadyCheck: (() -> Unit)? = null,
        private val productDetails: List<ProductDetails> = emptyList(),
        private val launchResponseCode: Int = BillingResponseCode.FEATURE_NOT_SUPPORTED,
        private val consumeResponseCode: Int? = null,
    ) : BillingClient() {
        val queryPurchasesCalls = AtomicInteger(0)
        val launchCalls = AtomicInteger(0)
        var onLaunch: (() -> Unit)? = null
        var beforeQueryPurchasesResponse: (() -> Unit)? = null
        private val purchaseResponseCodes =
            java.util.concurrent.ConcurrentLinkedQueue(purchaseResponseCodes)

        override fun queryPurchasesAsync(
            params: QueryPurchasesParams,
            listener: PurchasesResponseListener
        ) {
            queryPurchasesCalls.incrementAndGet()
            beforeQueryPurchasesResponse?.invoke()
            val result = BillingResult.newBuilder()
                .setResponseCode(
                    purchaseResponseCodes.poll() ?: BillingResponseCode.OK
                )
                .build()
            listener.onQueryPurchasesResponse(result, ownedPurchases)
        }

        override fun isReady(): Boolean {
            onReadyCheck?.invoke()
            return true
        }

        override fun getConnectionState(): Int = ConnectionState.CONNECTED

        override fun isFeatureSupported(feature: String): BillingResult =
            unsupported()

        override fun launchBillingFlow(
            activity: Activity,
            params: BillingFlowParams
        ): BillingResult {
            launchCalls.incrementAndGet()
            onLaunch?.invoke()
            return BillingResult.newBuilder().setResponseCode(launchResponseCode).build()
        }

        override fun queryProductDetailsAsync(
            params: QueryProductDetailsParams,
            listener: ProductDetailsResponseListener
        ) {
            if (productDetails.isEmpty()) return
            listener.onProductDetailsResponse(
                BillingResult.newBuilder().setResponseCode(BillingResponseCode.OK).build(),
                QueryProductDetailsResult.create(productDetails, emptyList()),
            )
        }

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
        ) {
            val code = consumeResponseCode ?: return
            listener.onConsumeResponse(
                BillingResult.newBuilder().setResponseCode(code).setDebugMessage("refused").build(),
                params.purchaseToken,
            )
        }

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
