package dev.hyo.openiap

import android.app.Activity
import androidx.test.core.app.ApplicationProvider
import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.BillingFlowParams
import com.meta.horizon.billingclient.api.BillingResult
import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import com.meta.horizon.billingclient.api.ProductDetailsResponseListener
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import com.meta.horizon.billingclient.api.PurchasesResponseListener
import com.meta.horizon.billingclient.api.QueryProductDetailsParams
import com.meta.horizon.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import java.lang.reflect.Field
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper

/** Horizon purchase correlation, launch-result mapping, and already-owned recovery. */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonPurchaseFlowTest {

    @Test
    fun `a new purchase token resolves the request whatever its purchase time`() {
        val client = FlowBillingClient()
        val module = module(client)
        val results = CopyOnWriteArrayList<Result<List<Purchase>>>()
        installLaunchedPurchase(module, client) { results += it }

        // Horizon stamps grant time on Meta's clock; it says nothing about this device's clock.
        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(horizonPurchase(purchaseTime = 1L)),
        )

        assertEquals(1, results.size)
        assertEquals(listOf("purchase-token"), results.single().getOrThrow().map { it.purchaseToken })
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `a token Horizon reported before the launch does not resolve the request`() {
        val client = FlowBillingClient()
        val module = module(client)
        val results = CopyOnWriteArrayList<Result<List<Purchase>>>()
        installLaunchedPurchase(module, client, tokensBeforeLaunch = setOf("purchase-token")) {
            results += it
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(horizonPurchase(purchaseTime = System.currentTimeMillis())),
        )

        assertTrue("an earlier purchase must not resolve the request: $results", results.isEmpty())
    }

    @Test
    fun `already owned from the purchase callback resolves with the owned purchase`() {
        val client = FlowBillingClient(owned = listOf(horizonPurchase(purchaseTime = 1L)))
        val module = module(client)
        val results = CopyOnWriteArrayList<Result<List<Purchase>>>()
        val updates = CopyOnWriteArrayList<Purchase>()
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        installLaunchedPurchase(module, client) { results += it }

        // Horizon's launchBillingFlow reports an owned SKU through the listener with no purchases.
        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED),
            emptyList(),
        )
        awaitCondition { results.isNotEmpty() }

        assertEquals(listOf("purchase-token"), results.single().getOrThrow().map { it.purchaseToken })
        assertEquals(listOf("purchase-token"), updates.map { it.purchaseToken })
        assertTrue("recovery must not publish an error: $errors", errors.isEmpty())
        assertNull(pendingPurchaseField().get(module))
    }

    @Test
    fun `launch result codes map to their OpenIAP errors`() {
        val client = FlowBillingClient(
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
        )
        val module = module(client)
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        val purchases = requestPurchase(module)

        assertEquals(emptyList<Purchase>(), purchases)
        assertTrue("ITEM_UNAVAILABLE must not collapse to PurchaseFailed: $errors", errors.single() is OpenIapError.ItemUnavailable)
    }

    @Test
    fun `already owned from the launch result resolves with the owned purchase`() {
        val client = FlowBillingClient(
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED,
            owned = listOf(horizonPurchase(purchaseTime = 1L)),
        )
        val module = module(client)
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })

        val purchases = requestPurchase(module)

        assertEquals(listOf("purchase-token"), purchases.map { it.purchaseToken })
        assertTrue("recovery must not publish an error: $errors", errors.isEmpty())
    }

    @Test
    fun `delivered once, then already-owned recovery re-delivers`() {
        val client = FlowBillingClient(
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED,
            owned = listOf(horizonPurchase(purchaseTime = 1L)),
        )
        val module = module(client)
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(horizonPurchase(purchaseTime = 1L)),
        )

        // The app failed to validate it and the user taps buy again.
        val purchases = requestPurchase(module)

        assertEquals(listOf("purchase-token"), purchases.map { it.purchaseToken })
        assertEquals(listOf("purchase-token", "purchase-token"), updates.map { it.purchaseToken })
    }

    @Test
    fun `late callback of a previous request after a new request starts is not re-delivered`() {
        val client = FlowBillingClient(
            launchResponseCode = BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
            owned = listOf(horizonPurchase(purchaseTime = 1L)),
        )
        val module = module(client)
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        val update = billingResult(BillingClient.BillingResponseCode.OK)
        module.onPurchasesUpdated(client, 0L, update, listOf(horizonPurchase(purchaseTime = 1L)))

        requestPurchase(module)
        module.onPurchasesUpdated(client, 0L, update, listOf(horizonPurchase(purchaseTime = 1L)))

        assertEquals(listOf("purchase-token"), updates.map { it.purchaseToken })
    }

    private fun requestPurchase(module: OpenIapModule): List<Purchase> {
        module.setActivity(Robolectric.buildActivity(Activity::class.java).create().get())
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(skus = listOf("product-id")),
                ),
            ),
            type = ProductQueryType.InApp,
        )
        val outcome = AtomicReference<Result<RequestPurchaseResult?>>()
        val worker = thread(isDaemon = true) {
            outcome.set(runCatching { runBlocking { module.requestPurchase(props) } })
        }
        awaitCondition { outcome.get() != null }
        worker.join(1_000)
        val result = checkNotNull(outcome.get()) { "requestPurchase never completed" }
        return (result.getOrThrow() as RequestPurchaseResultPurchases).value.orEmpty()
    }

    /** Runs main-looper work posted by the module until [condition] holds. */
    private fun awaitCondition(condition: () -> Boolean) {
        var attempts = 0
        while (!condition() && attempts++ < 500) {
            ShadowLooper.idleMainLooper()
            Thread.sleep(10)
        }
    }

    private fun module(client: BillingClient): OpenIapModule =
        OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>()).also {
            OpenIapModule::class.java.getDeclaredField("billingClient").apply {
                isAccessible = true
                set(it, client)
            }
        }

    private fun pendingPurchaseField(): Field =
        OpenIapModule::class.java.getDeclaredField("pendingPurchase").apply {
            isAccessible = true
        }

    private fun installLaunchedPurchase(
        module: OpenIapModule,
        client: BillingClient,
        tokensBeforeLaunch: Set<String> = emptySet(),
        callback: (Result<List<Purchase>>) -> Unit,
    ) {
        val snapshotClass = Class.forName("dev.hyo.openiap.OpenIapModule\$PendingPurchaseSnapshot")
        val constructor = snapshotClass.declaredConstructors.first { candidate ->
            candidate.parameterTypes.none { it.simpleName == "DefaultConstructorMarker" }
        }
        constructor.isAccessible = true
        pendingPurchaseField().set(
            module,
            constructor.newInstance(
                client,
                callback,
                setOf("product-id"),
                ProductQueryType.InApp,
                emptyMap<String, String>(),
                1.0,
                tokensBeforeLaunch,
            ),
        )
    }

    private fun billingResult(responseCode: Int): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(responseCode)
            .setDebugMessage("")
            .build()

    private fun horizonPurchase(purchaseTime: Long): HorizonPurchase = HorizonPurchase(
        purchaseTime,
        "purchase-token",
        listOf("product-id"),
        "dev.hyo.openiap.test",
        "",
        "order-product-id",
        """{"purchaseState":0,"acknowledged":true,"autoRenewing":false}""",
        1,
        "signature",
    )

    private class FlowBillingClient(
        var launchResponseCode: Int = BillingResponseCode.OK,
        private val owned: List<HorizonPurchase> = emptyList(),
    ) : RecordingBillingClient() {
        override fun queryProductDetailsAsync(
            params: QueryProductDetailsParams,
            listener: ProductDetailsResponseListener,
        ) {
            listener.onProductDetailsResponse(
                result(BillingResponseCode.OK),
                listOf(
                    HorizonProductDetails(
                        "product-id",
                        "Title",
                        "Name",
                        "Description",
                        ProductType.INAPP,
                        HorizonProductDetails.OneTimePurchaseOfferDetails("$1.00", 1_000_000L, "USD"),
                        emptyList(),
                    )
                ),
            )
        }

        override fun launchBillingFlow(activity: Activity, params: BillingFlowParams): BillingResult =
            result(launchResponseCode)

        override fun queryPurchasesAsync(
            queryPurchasesParams: QueryPurchasesParams,
            listener: PurchasesResponseListener,
        ) {
            listener.onQueryPurchasesResponse(result(BillingResponseCode.OK), owned)
        }

        private fun result(code: Int): BillingResult =
            BillingResult.newBuilder().setResponseCode(code).setDebugMessage("").build()
    }
}
