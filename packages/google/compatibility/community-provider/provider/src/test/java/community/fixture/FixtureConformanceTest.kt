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
    override val factory: OpenIapProviderFactory = FixtureFactory()
    protected val fixture = FixtureProvider()
    override val provider: OpenIapProtocol = fixture
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Unknown
        override val storeId get() = factory.storeId
        override val capabilities = StoreCapability.entries.toSet()
        override fun toActiveSubscription(purchase: PurchaseAndroid) = fixture.toActiveSubscription(purchase)
        override val normativeErrorCases = listOf(
            StoreErrorCase("cancelled", ErrorCode.UserCancelled, fixture.mapError("cancelled")),
            StoreErrorCase("missing", ErrorCode.ItemUnavailable, fixture.mapError("missing")),
        )
        override val unrecognizedError = fixture.mapError("unrecognized")
        override fun unsupportedOperationResult(): Boolean? = null
    }
    override suspend fun triggerCapability(capability: StoreCapability) {
        when (capability) {
            StoreCapability.PendingPurchases -> fixture.emitPending()
            StoreCapability.SubscriptionBillingIssue -> fixture.emitBillingIssue()
            StoreCapability.OfferCodeRedemption -> fixture.emitRedemption()
        }
    }
    @Test fun `merged library metadata discovers a class in an independent namespace`() {
        val context: Context = ApplicationProvider.getApplicationContext()
        assertEquals(factory.storeId, OpenIapProvider.factory(context).storeId)
        assertTrue(OpenIapProvider.create(context) is FixtureProvider)
    }

    @Test fun `suite rejects an incompatible Client Protocol build`() {
        val actualFactory = factory
        val incompatible = object : FixtureConformanceTest() {
            override val factory = object : OpenIapProviderFactory {
                override val storeId = actualFactory.storeId
                override val coreVersion = actualFactory.coreVersion
                override val clientProtocolVersion = "0.1.1"
                override val capabilities = actualFactory.capabilities
                override fun create(context: Context) = FixtureProvider()
            }
        }
        assertThrows(OpenIapError.ProviderConfiguration::class.java) { incompatible.connectProvider() }
    }

    @Test fun `suite rejects a provider that cannot restore`() {
        val actualProvider = provider
        val unsupported = object : FixtureConformanceTest() {
            override val provider = object : OpenIapProtocol by actualProvider {
                override val restorePurchases: MutationRestorePurchasesHandler = { throw OpenIapError.FeatureNotSupported() }
            }
        }
        assertThrows(OpenIapError.FeatureNotSupported::class.java) { unsupported.`owned purchase remains available`() }
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
