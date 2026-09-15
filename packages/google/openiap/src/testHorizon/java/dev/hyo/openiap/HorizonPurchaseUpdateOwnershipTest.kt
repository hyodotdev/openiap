package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.BillingResult
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
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
}
