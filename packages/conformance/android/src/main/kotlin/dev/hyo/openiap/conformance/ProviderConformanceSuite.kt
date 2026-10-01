package dev.hyo.openiap.conformance

import dev.hyo.openiap.*
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*

/** Run against a fresh provider with a purchasable test SKU and an isolated test user. */
abstract class ProviderConformanceSuite : StoreConformanceSuite() {
    protected abstract val factory: OpenIapProviderFactory
    protected abstract val provider: OpenIapProtocol
    protected open val testProductId: String = "conformance.product"
    protected open val timeoutMillis: Long = 5_000

    /** Drive the store's sandbox or fake backend after the suite attaches listeners. */
    protected open suspend fun triggerCapability(capability: StoreCapability) {
        error("Declared ${capability.id} requires a sandbox trigger in this test adapter")
    }

    override val reportScope get() = "android-provider"
    override val requiredReportBehaviors get() = super.requiredReportBehaviors + REQUIRED_BEHAVIORS +
        adapter.capabilities.map { capabilityBehavior(it) }

    @Before fun connectProvider() = runBlocking {
        OpenIapProvider.validate(factory.descriptor)
        assertEquals(factory.storeId, adapter.storeId)
        assertEquals(factory.capabilities, adapter.capabilities.map { it.id }.toSet())
        assertTrue(provider.initConnection(null))
    }
    @After fun disconnectProvider() = runBlocking { assertTrue(provider.endConnection()) }

    @Test
    @ConformanceBehavior(ConformanceBehaviors.PRODUCTS_FETCH_RETURNS_REQUESTED_SKUS)
    fun `fetch returns the requested product`() = runBlocking {
        val result = provider.fetchProducts(ProductRequest(skus = listOf(testProductId), type = ProductQueryType.InApp))
        val ids = when (result) {
            is FetchProductsResultProducts -> result.value.orEmpty().map { it.id }
            is FetchProductsResultAll -> result.value.orEmpty().map {
                when (it) {
                    is ProductOrSubscription.ProductItem -> it.value.id
                    is ProductOrSubscription.ProductSubscriptionItem -> it.value.id
                }
            }
            is FetchProductsResultSubscriptions -> result.value.orEmpty().map { it.id }
            null -> emptyList()
        }
        assertTrue(ids.contains(testProductId))
        assertTrue(ids.all { it == testProductId })
    }

    @Test
    @ConformanceBehavior(ConformanceBehaviors.PURCHASES_REQUEST_EMITS_PURCHASE_UPDATED_ON_SUCCESS)
    fun `purchase emits its stable store identity`() = runBlocking {
        val purchase = purchase()
        assertEquals(testProductId, purchase.productId)
        assertEquals(adapter.store, purchase.store)
        assertEquals(factory.storeId, purchase.storeId)
        assertEquals(purchase.storeId, Purchase.fromJson(purchase.toJson()).storeId)
        assertEquals(PurchaseState.Purchased, purchase.purchaseState)
    }

    @Test
    @ConformanceBehavior(ConformanceBehaviors.RESTORATION_AVAILABLE_PURCHASES_RETURNS_OWNED_ITEMS)
    fun `owned purchase remains available`() = runBlocking {
        val purchased = purchase()
        provider.restorePurchases()
        assertTrue(provider.getAvailablePurchases(null).any { it.purchaseToken == purchased.purchaseToken && it.storeId == factory.storeId })
    }

    @Test
    @ConformanceBehavior(ConformanceBehaviors.IDENTIFIERS_PURCHASE_TOKEN_IS_STABLE_ACROSS_READS)
    fun `repeated reads preserve the purchase token`() = runBlocking {
        val purchased = purchase()
        val first = provider.getAvailablePurchases(null).first { it.id == purchased.id }
        val second = provider.getAvailablePurchases(null).first { it.id == purchased.id }
        assertFalse(first.purchaseToken.isNullOrBlank())
        assertEquals(first.purchaseToken, second.purchaseToken)
    }

    @Test
    @ConformanceBehavior(ConformanceBehaviors.COMPLETION_FINISH_IS_IDEMPOTENT)
    fun `finishing twice is safe`() = runBlocking {
        val purchased = purchase()
        provider.finishTransaction(purchased, false)
        provider.finishTransaction(purchased, false)
    }

    @Test
    @ConformanceBehavior(PENDING_BEHAVIOR)
    fun `declared pending capability never grants an entitlement`() = runBlocking {
        assumeTrue(StoreCapability.PendingPurchases in adapter.capabilities)
        val received = CompletableDeferred<Purchase>()
        val errors = CompletableDeferred<OpenIapError>()
        val invalid = AtomicBoolean(false)
        val listener = OpenIapPurchaseUpdateListener {
            if (it !is PurchaseAndroid || it.store != adapter.store || it.storeId != factory.storeId ||
                it.purchaseState != PurchaseState.Pending || adapter.toActiveSubscription(it).isActive) invalid.set(true)
            received.complete(it)
        }
        val errorListener = OpenIapPurchaseErrorListener {
            if (it.code != ErrorCode.DeferredPayment.rawValue) invalid.set(true)
            errors.complete(it)
        }
        provider.addPurchaseUpdateListener(listener)
        provider.addPurchaseErrorListener(errorListener)
        try {
            try { triggerCapability(StoreCapability.PendingPurchases) }
            catch (error: OpenIapError) {
                if (error.code != ErrorCode.DeferredPayment.rawValue) throw error
                errors.complete(error)
            }
            withTimeout(timeoutMillis) {
                kotlinx.coroutines.selects.select<Unit> {
                    received.onAwait { purchase ->
                        assertEquals(PurchaseState.Pending, purchase.purchaseState)
                        assertEquals(factory.storeId, purchase.storeId)
                        assertEquals(adapter.store, purchase.store)
                        assertFalse(adapter.toActiveSubscription(purchase as PurchaseAndroid).isActive)
                    }
                    errors.onAwait { error -> assertEquals(ErrorCode.DeferredPayment.rawValue, error.code) }
                }
            }
            delay(timeoutMillis)
            assertFalse("Pending trigger emitted a purchased or contradictory event", invalid.get())
        } finally {
            provider.removePurchaseUpdateListener(listener)
            provider.removePurchaseErrorListener(errorListener)
        }
    }

    @Test
    @ConformanceBehavior(BILLING_ISSUE_BEHAVIOR)
    fun `declared billing issue capability emits a suspended purchase`() = runBlocking {
        assumeTrue(StoreCapability.SubscriptionBillingIssue in adapter.capabilities)
        val received = CompletableDeferred<Purchase>()
        val listener = OpenIapSubscriptionBillingIssueListener { received.complete(it) }
        provider.addSubscriptionBillingIssueListener(listener)
        try {
            triggerCapability(StoreCapability.SubscriptionBillingIssue)
            val purchase = withTimeout(timeoutMillis) { received.await() } as PurchaseAndroid
            assertEquals(factory.storeId, purchase.storeId)
            assertEquals(adapter.store, purchase.store)
            assertEquals(true, purchase.isSuspendedAndroid)
            assertFalse(adapter.toActiveSubscription(purchase).isActive)
        } finally { provider.removeSubscriptionBillingIssueListener(listener) }
    }

    @Test
    @ConformanceBehavior(REDEMPTION_BEHAVIOR)
    fun `declared redemption capability reaches the purchase listener`() = runBlocking {
        assumeTrue(StoreCapability.OfferCodeRedemption in adapter.capabilities)
        val received = CompletableDeferred<Purchase>()
        val listener = OpenIapPurchaseUpdateListener { received.complete(it) }
        provider.addPurchaseUpdateListener(listener)
        try {
            val redeem = provider.mutationHandlers.openRedeemOfferCodeAndroid
                ?: error("Declared offerCodeRedemption requires its public mutation handler")
            assertTrue(redeem())
            triggerCapability(StoreCapability.OfferCodeRedemption)
            val purchase = withTimeout(timeoutMillis) { received.await() }
            assertEquals(factory.storeId, purchase.storeId)
            assertEquals(adapter.store, purchase.store)
            assertEquals(PurchaseState.Purchased, purchase.purchaseState)
        } finally { provider.removePurchaseUpdateListener(listener) }
    }

    private suspend fun purchase(): Purchase {
        val received = CompletableDeferred<Purchase>()
        val listener = OpenIapPurchaseUpdateListener { received.complete(it) }
        provider.addPurchaseUpdateListener(listener)
        try {
            provider.requestPurchase(RequestPurchaseProps.fromJson(mapOf(
                "type" to "in-app",
                "requestPurchase" to mapOf("google" to mapOf("skus" to listOf(testProductId))),
            )))
            return withTimeout(timeoutMillis) { received.await() }
        } finally { provider.removePurchaseUpdateListener(listener) }
    }

    companion object {
        const val PENDING_BEHAVIOR = ConformanceBehaviors.PURCHASES_PENDING_PURCHASE_IS_NOT_DELIVERED_AS_PURCHASED
        const val BILLING_ISSUE_BEHAVIOR = ConformanceBehaviors.ANDROID_PROVIDER_SUBSCRIPTION_BILLING_ISSUE
        const val REDEMPTION_BEHAVIOR = ConformanceBehaviors.ANDROID_PROVIDER_OFFER_CODE_REDEMPTION
        val REQUIRED_BEHAVIORS = ConformanceBehaviors.ANDROID_PROVIDER_BEHAVIORS
        fun capabilityBehavior(capability: StoreCapability): String =
            ConformanceBehaviors.PROVIDER_CAPABILITY_BEHAVIORS.getValue(capability.id)
    }
}
