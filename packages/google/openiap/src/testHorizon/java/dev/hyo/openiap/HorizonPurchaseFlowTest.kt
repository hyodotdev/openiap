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
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
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
    fun `a subscription purchased under its virtual sku resolves the base sku request`() {
        val client = FlowBillingClient()
        val module = module(client)
        val results = CopyOnWriteArrayList<Result<List<Purchase>>>()
        installLaunchedPurchase(module, client, sku = "premium", type = ProductQueryType.Subs) {
            results += it
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.OK),
            listOf(horizonPurchase(purchaseTime = 1L, productId = VIRTUAL_SUBSCRIPTION_SKU)),
        )

        assertEquals(
            listOf(VIRTUAL_SUBSCRIPTION_SKU),
            results.single().getOrThrow().map { it.productId },
        )
    }

    @Test
    fun `already-owned recovery finds a subscription owned under its virtual sku`() {
        val client = FlowBillingClient(
            owned = listOf(horizonPurchase(purchaseTime = 1L, productId = VIRTUAL_SUBSCRIPTION_SKU)),
        )
        val module = module(client)
        val results = CopyOnWriteArrayList<Result<List<Purchase>>>()
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        installLaunchedPurchase(module, client, sku = "premium", type = ProductQueryType.Subs) {
            results += it
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED),
            emptyList(),
        )
        awaitCondition { results.isNotEmpty() }

        assertEquals(
            listOf(VIRTUAL_SUBSCRIPTION_SKU),
            results.single().getOrThrow().map { it.productId },
        )
        assertTrue("recovery must not publish an error: $errors", errors.isEmpty())
    }

    @Test
    fun `an active subscription owned under its virtual sku reports its base plan`() = runBlocking {
        // Horizon merges each term into one base-SKU product whose offers carry that base plan.
        val premium = HorizonProductDetails(
            "premium",
            "Premium",
            "Premium",
            "Premium",
            BillingClient.ProductType.SUBS,
            null,
            listOf(
                HorizonProductDetails.SubscriptionOfferDetails(
                    "premium",
                    HorizonProductDetails.InstallmentPlanDetails(0, 0),
                    null,
                    emptyList(),
                    "SUBSCRIPTION__MONTHLY",
                    HorizonProductDetails.PricingPhases(emptyList()),
                )
            ),
        )
        val client = FlowBillingClient(
            owned = listOf(horizonPurchase(purchaseTime = 1L, productId = VIRTUAL_SUBSCRIPTION_SKU)),
            details = listOf(premium),
        )
        val module = module(client)

        val subscription = module.getActiveSubscriptions(listOf("premium")).single()

        assertEquals(VIRTUAL_SUBSCRIPTION_SKU, subscription.productId)
        assertEquals("premium", subscription.basePlanIdAndroid)
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

    @Test
    fun `a late callback for a purchase polling delivered does not resolve the next request`() {
        val client = FlowBillingClient()
        val module = module(client)
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })

        // Polling finds A before Horizon's callback for it arrives.
        client.purchaseOnLaunch = horizonPurchase(purchaseTime = 1L, token = "token-a")
        assertEquals(listOf("token-a"), requestPurchase(module).map { it.purchaseToken })

        // The app consumes A and buys the same SKU again; then A's callback arrives late.
        client.owned = emptyList()
        client.purchaseOnLaunch = null
        val second = startPurchase(module)
        awaitCondition { client.launches == 2 }
        val update = billingResult(BillingClient.BillingResponseCode.OK)
        module.onPurchasesUpdated(client, 0L, update, listOf(horizonPurchase(1L, token = "token-a")))
        module.onPurchasesUpdated(client, 0L, update, listOf(horizonPurchase(2L, token = "token-b")))
        awaitCondition { second.get() != null }

        assertEquals(listOf("token-b"), purchasesOf(second).map { it.purchaseToken })
        assertEquals(listOf("token-a", "token-b"), updates.map { it.purchaseToken })
    }

    @Test
    fun `a callback whose connection drops before delivery is not claimed`() {
        val client = FlowBillingClient()
        val module = module(client)
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        val update = billingResult(BillingClient.BillingResponseCode.OK)
        val dropped = AtomicBoolean(false)
        val logging = OpenIapLog.isEnabled
        // The last log line before delivery is the only seam between the owner check and delivery.
        OpenIapLog.setHandler { _, message, _ ->
            if (message.startsWith("Mapped ") && dropped.compareAndSet(false, true)) {
                module.handleBillingServiceDisconnected(client)
            }
        }
        OpenIapLog.enable(true)
        try {
            module.onPurchasesUpdated(client, 0L, update, listOf(horizonPurchase(1L)))
        } finally {
            OpenIapLog.setHandler(null)
            OpenIapLog.enable(logging)
        }
        assertTrue(dropped.get())
        assertTrue("an inactive connection must not deliver: $updates", updates.isEmpty())

        // The next connection reports the same purchase; it must still reach listeners.
        billingClientField().set(module, client)
        module.onPurchasesUpdated(client, 1L, update, listOf(horizonPurchase(1L)))

        assertEquals(listOf("purchase-token"), updates.map { it.purchaseToken })
    }

    @Test
    fun `polling redelivers a delivered owned purchase it resolves`() {
        val client = FlowBillingClient(owned = listOf(horizonPurchase(1L, token = "token-a")))
        val module = module(client)
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        val ok = billingResult(BillingClient.BillingResponseCode.OK)
        module.onPurchasesUpdated(client, 0L, ok, listOf(horizonPurchase(1L, token = "token-a")))

        // Offline, the prelaunch query returns Meta's durable cache, which never holds consumables.
        client.durableCacheOnce.set(listOf(horizonPurchase(1L, "durable-id", "token-d")))
        // Horizon may never send ITEM_ALREADY_OWNED, so polling settles and redelivers.
        val retry = startPurchase(module)
        awaitCondition { retry.get() != null }

        assertEquals(listOf("token-a"), purchasesOf(retry).map { it.purchaseToken })
        assertEquals(listOf("token-a", "token-a"), updates.map { it.purchaseToken })
    }

    @Test
    fun `a completed request resumes only after its purchase is recorded as delivered`() {
        val client = FlowBillingClient(owned = listOf(horizonPurchase(1L, token = "token-a")))
        val module = module(client)
        val first = CopyOnWriteArrayList<Result<List<Purchase>>>()
        val second = CopyOnWriteArrayList<Result<List<Purchase>>>()
        installLaunchedPurchase(module, client) { result ->
            first += result
            // Once resumed, the app consumes A and buys the same SKU; A's callback then arrives late.
            client.owned = emptyList()
            installLaunchedPurchase(module, client) { second += it }
            module.onPurchasesUpdated(
                client,
                0L,
                billingResult(BillingClient.BillingResponseCode.OK),
                listOf(horizonPurchase(1L, token = "token-a")),
            )
        }

        module.onPurchasesUpdated(
            client,
            0L,
            billingResult(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED),
            emptyList(),
        )
        awaitCondition { first.isNotEmpty() }

        assertEquals(listOf("token-a"), first.single().getOrThrow().map { it.purchaseToken })
        assertTrue("A's late callback must not complete B: $second", second.isEmpty())
    }

    private fun requestPurchase(module: OpenIapModule): List<Purchase> {
        val outcome = startPurchase(module)
        awaitCondition { outcome.get() != null }
        return purchasesOf(outcome)
    }

    private fun startPurchase(module: OpenIapModule): AtomicReference<Result<RequestPurchaseResult?>> {
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
        thread(isDaemon = true) {
            outcome.set(runCatching { runBlocking { module.requestPurchase(props) } })
        }
        return outcome
    }

    private fun purchasesOf(outcome: AtomicReference<Result<RequestPurchaseResult?>>): List<Purchase> {
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
            billingClientField().set(it, client)
        }

    private fun billingClientField(): Field =
        OpenIapModule::class.java.getDeclaredField("billingClient").apply { isAccessible = true }

    private fun pendingPurchaseField(): Field =
        OpenIapModule::class.java.getDeclaredField("pendingPurchase").apply {
            isAccessible = true
        }

    private fun installLaunchedPurchase(
        module: OpenIapModule,
        client: BillingClient,
        tokensBeforeLaunch: Set<String> = emptySet(),
        sku: String = "product-id",
        type: ProductQueryType = ProductQueryType.InApp,
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
                setOf(sku),
                type,
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

    private fun horizonPurchase(
        purchaseTime: Long,
        productId: String = "product-id",
        token: String = "purchase-token",
    ): HorizonPurchase = HorizonPurchase(
        purchaseTime,
        token,
        listOf(productId),
        "dev.hyo.openiap.test",
        "",
        "order-product-id",
        """{"purchaseState":0,"acknowledged":true,"autoRenewing":false}""",
        1,
        "signature",
    )

    private class FlowBillingClient(
        var launchResponseCode: Int = BillingResponseCode.OK,
        @Volatile var owned: List<HorizonPurchase> = emptyList(),
        private val details: List<HorizonProductDetails> = listOf(
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
    ) : RecordingBillingClient() {
        override fun queryProductDetailsAsync(
            params: QueryProductDetailsParams,
            listener: ProductDetailsResponseListener,
        ) {
            listener.onProductDetailsResponse(result(BillingResponseCode.OK), details)
        }

        /** Owned once the flow launches, as when the user completes the purchase. */
        var purchaseOnLaunch: HorizonPurchase? = null

        @Volatile var launches = 0

        override fun launchBillingFlow(activity: Activity, params: BillingFlowParams): BillingResult {
            launches += 1
            purchaseOnLaunch?.let { owned = owned + it }
            return result(launchResponseCode)
        }

        val durableCacheOnce = AtomicReference<List<HorizonPurchase>?>()
        val queries = AtomicInteger()

        override fun queryPurchasesAsync(
            queryPurchasesParams: QueryPurchasesParams,
            listener: PurchasesResponseListener,
        ) {
            queries.incrementAndGet()
            val cache = durableCacheOnce.getAndSet(null)
            if (cache != null) {
                listener.onQueryPurchasesResponse(result(BillingResponseCode.SERVICE_UNAVAILABLE), cache)
            } else {
                listener.onQueryPurchasesResponse(result(BillingResponseCode.OK), owned)
            }
        }

        private fun result(code: Int): BillingResult =
            BillingResult.newBuilder().setResponseCode(code).setDebugMessage("").build()
    }

    private companion object {
        // Horizon 2.0.0 reports a subscription purchase under base SKU + term suffix.
        const val VIRTUAL_SUBSCRIPTION_SKU = "premium:SUBSCRIPTION__MONTHLY"
    }
}
