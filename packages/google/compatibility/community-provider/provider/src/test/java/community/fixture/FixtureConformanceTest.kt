package community.fixture

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.*
import dev.hyo.openiap.conformance.*
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
open class FixtureConformanceTest : ProviderConformanceSuite() {
    override val factory = FixtureFactory()
    override val provider = FixtureProvider()
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Unknown
        override val storeId = factory.storeId
        override val capabilities = StoreCapability.entries.toSet()
        override fun toActiveSubscription(purchase: PurchaseAndroid) = provider.toActiveSubscription(purchase)
        override val normativeErrorCases = listOf(
            StoreErrorCase("cancelled", ErrorCode.UserCancelled, provider.mapError("cancelled")),
            StoreErrorCase("missing", ErrorCode.ItemUnavailable, provider.mapError("missing")),
        )
        override val unrecognizedError = provider.mapError("unrecognized")
        override fun unsupportedOperationResult(): Boolean? = null
    }
    override suspend fun triggerCapability(capability: StoreCapability) {
        when (capability) {
            StoreCapability.PendingPurchases -> provider.emitPending()
            StoreCapability.SubscriptionBillingIssue -> provider.emitBillingIssue()
            StoreCapability.OfferCodeRedemption -> provider.emitRedemption()
        }
    }
    @Test fun `merged library metadata discovers a class in an independent namespace`() {
        val context: Context = ApplicationProvider.getApplicationContext()
        assertEquals(factory.storeId, OpenIapProvider.factory(context).storeId)
        assertTrue(OpenIapProvider.create(context) is FixtureProvider)
    }
    @Test fun `repurchasing a consumed item creates a new transaction`() = runBlocking {
        val request = RequestPurchaseProps.fromJson(mapOf(
            "requestPurchase" to mapOf("google" to mapOf("skus" to listOf("conformance.product"))), "type" to "in-app",
        ))
        val first = (provider.requestPurchase(request) as RequestPurchaseResultPurchase).value!!
        provider.finishTransaction(first, true)
        val second = (provider.requestPurchase(request) as RequestPurchaseResultPurchase).value!!
        assertNotEquals(first.id, second.id)
        assertNotEquals(first.purchaseToken, second.purchaseToken)
    }
}
