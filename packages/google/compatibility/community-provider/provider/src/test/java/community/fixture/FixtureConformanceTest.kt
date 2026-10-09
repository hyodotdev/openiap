package community.fixture

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.*
import dev.hyo.openiap.conformance.*
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Robolectric
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
open class FixtureConformanceTest : ProviderConformanceSuite() {
    override val factory: OpenIapProviderFactory = FixtureFactory()
    protected val fixture = FixtureProvider()
    override val provider: OpenIapProtocol = fixture
    override val redemptionActivity: Activity = Robolectric.buildActivity(Activity::class.java).setup().get()
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

    @Test fun `suite rejects the reserved Google id for a community provider`() {
        val actualAdapter = adapter
        val invalid = object : StoreConformanceSuite() {
            override val adapter = object : StoreConformanceAdapter by actualAdapter {
                override val storeId = "google"
            }
        }
        assertThrows(AssertionError::class.java) {
            invalid.`adapter declares a concrete store discriminator`()
        }
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
        assertThrows(OpenIapError.FeatureNotSupported::class.java) { unsupported.`purchase restores and finishes with a stable identity`() }
    }
    @Test fun `suite rejects missing duplicate or contradictory failure events`() {
        for (mode in listOf("missing", "duplicate", "purchase", "returned", "generic", "generic-missing", "generic-duplicate")) {
            val invalid = object : FixtureConformanceTest() {
                override val timeoutMillis = 50L
                override val provider = object : OpenIapProtocol by fixture {
                    private var errors: dev.hyo.openiap.listener.OpenIapPurchaseErrorListener? = null
                    private var updates: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener? = null
                    override fun addPurchaseErrorListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseErrorListener) { errors = listener }
                    override fun removePurchaseErrorListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseErrorListener) { errors = null }
                    override fun addPurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updates = listener }
                    override fun removePurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updates = null }
                    override val requestPurchase: MutationRequestPurchaseHandler = {
                        val error = OpenIapError.EmptySkuList
                        if (mode != "missing" && mode != "generic-missing") errors?.onPurchaseError(error)
                        if (mode == "duplicate" || mode == "generic-duplicate") errors?.onPurchaseError(error)
                        if (mode == "purchase") updates?.onPurchaseUpdated(fixture.purchase("conformance.product"))
                        if (mode.startsWith("generic")) throw IllegalStateException("Vendor failure")
                        if (mode == "returned") RequestPurchaseResultPurchases(emptyList()) else throw error
                    }
                }
            }
            if (mode == "returned" || mode == "generic") invalid.`invalid purchase emits one error before completion`()
            else assertThrows(AssertionError::class.java) { invalid.`invalid purchase emits one error before completion`() }
        }
    }
    @Test fun `conformance only buys an owned product once`() {
        val actualProvider = provider
        var requests = 0
        val persistent = object : FixtureConformanceTest() {
            override val provider = object : OpenIapProtocol by actualProvider {
                override val requestPurchase: MutationRequestPurchaseHandler = { props ->
                    if (++requests > 1) throw OpenIapError.ItemAlreadyOwned()
                    actualProvider.requestPurchase(props)
                }
            }
        }
        persistent.`purchase restores and finishes with a stable identity`()
        assertEquals(1, requests)
    }
    @Test fun `suite rejects purchase updates from the wrong platform`() {
        val actualProvider = provider
        val invalid = object : FixtureConformanceTest() {
            override val provider = object : OpenIapProtocol by actualProvider {
                private var updateListener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener? = null
                override fun addPurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updateListener = listener }
                override fun removePurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updateListener = null }
                override val requestPurchase: MutationRequestPurchaseHandler = {
                    val purchase = PurchaseIOS.fromJson(fixture.purchase("conformance.product").toJson())
                    updateListener?.onPurchaseUpdated(purchase)
                    RequestPurchaseResultPurchase(purchase)
                }
            }
        }
        assertThrows(AssertionError::class.java) { invalid.`purchase restores and finishes with a stable identity`() }
    }
    @Test fun `suite rejects altered restored purchase identities and tokens`() {
        val actualProvider = provider
        for (field in listOf("storeId", "purchaseToken")) {
            val invalid = object : FixtureConformanceTest() {
                override val provider = object : OpenIapProtocol by actualProvider {
                    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { options ->
                        actualProvider.getAvailablePurchases(options).map { purchase ->
                            PurchaseAndroid.fromJson(purchase.toJson() + (field to "altered_value"))
                        }
                    }
                }
            }
            assertThrows(AssertionError::class.java) { invalid.`purchase restores and finishes with a stable identity`() }
        }
    }
    @Test fun `suite rejects redemption updates from the wrong platform`() {
        val invalid = object : FixtureConformanceTest() {
            private var updateListener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener? = null
            override val provider = object : OpenIapProtocol by fixture {
                override fun addPurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updateListener = listener }
                override fun removePurchaseUpdateListener(listener: dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener) { updateListener = null }
            }
            override suspend fun triggerCapability(capability: StoreCapability) {
                updateListener?.onPurchaseUpdated(PurchaseIOS.fromJson(fixture.purchase("conformance.product").toJson()))
            }
        }
        assertThrows(AssertionError::class.java) { invalid.`declared redemption capability reaches the purchase listener`() }
    }
    @Test fun `declared redemption requires the canonical SDK handler`() {
        val invalid = object : FixtureConformanceTest() {
            override val provider = object : OpenIapProtocol by fixture {
                override val mutationHandlers = fixture.mutationHandlers.copy(openRedeemOfferCode = null)
            }
        }
        assertThrows(OpenIapError.FeatureNotSupported::class.java) {
            invalid.`declared redemption capability reaches the purchase listener`()
        }
    }
    @Test fun `suite rejects declared native redemption that does not open`() {
        for (throwsError in listOf(false, true)) {
            val invalid = object : FixtureConformanceTest() {
                override val provider = object : OpenIapProtocol by fixture {
                    override suspend fun openRedeemOfferCode(activity: Activity): Boolean =
                        if (throwsError) error("Vendor failure") else false
                }
            }
            if (throwsError) {
                assertThrows(IllegalStateException::class.java) {
                    invalid.`native redemption matches the declared capability`()
                }
            } else {
                assertThrows(AssertionError::class.java) {
                    invalid.`native redemption matches the declared capability`()
                }
            }
        }
    }
    @Test fun `suite checks the receipt returned by canonical redemption`() {
        val receipt = fixture.purchase("conformance.product")
        val returned = listOf<Purchase>(
            PurchaseIOS.fromJson(receipt.toJson()),
            PurchaseAndroid.fromJson(receipt.toJson() + ("storeId" to "other_store")),
            receipt.copy(store = IapStore.Google),
            PurchaseAndroid.fromJson(receipt.toJson() + ("purchaseState" to "pending")),
        )
        for (purchase in returned) {
            val invalid = object : FixtureConformanceTest() {
                override val provider = object : OpenIapProtocol by fixture {
                    override val mutationHandlers = fixture.mutationHandlers.copy(openRedeemOfferCode = { purchase })
                }
            }
            assertThrows("Invalid returned receipt: ${purchase.javaClass.simpleName}/${purchase.store}/${purchase.storeId}/${purchase.purchaseState}", AssertionError::class.java) {
                invalid.`declared redemption capability reaches the purchase listener`()
            }
        }
        val valid = object : FixtureConformanceTest() {
            override val provider = object : OpenIapProtocol by fixture {
                override val mutationHandlers = fixture.mutationHandlers.copy(openRedeemOfferCode = { receipt })
            }
        }
        valid.`declared redemption capability reaches the purchase listener`()
    }
    @Test fun `suite invokes the canonical handler when redemption is undeclared`() {
        val base = FixtureConformanceTest()
        fun withoutRedemption(
            handler: MutationOpenRedeemOfferCodeHandler?,
            nativeResult: suspend () -> Boolean = { false },
        ) = object : FixtureConformanceTest() {
            override val factory = object : OpenIapProviderFactory by base.factory {
                override val capabilities = base.factory.capabilities - "offerCodeRedemption"
            }
            override val adapter = object : StoreConformanceAdapter by base.adapter {
                override val capabilities = base.adapter.capabilities - StoreCapability.OfferCodeRedemption
            }
            override val provider = object : OpenIapProtocol by base.provider {
                override val mutationHandlers = base.provider.mutationHandlers.copy(openRedeemOfferCode = handler)
                override suspend fun openRedeemOfferCode(activity: Activity): Boolean = nativeResult()
            }
        }
        withoutRedemption({ null }).`unsupported offer code redemption returns its documented no-op`()
        withoutRedemption(null).`unsupported offer code redemption returns its documented no-op`()
        withoutRedemption({ throw OpenIapError.FeatureNotSupported() })
            .`unsupported offer code redemption returns its documented no-op`()
        withoutRedemption({ null }, { throw OpenIapError.FeatureNotSupported() })
            .`unsupported offer code redemption returns its documented no-op`()
        assertThrows(AssertionError::class.java) {
            withoutRedemption({ null }, { true })
                .`unsupported offer code redemption returns its documented no-op`()
        }
        assertThrows(IllegalStateException::class.java) {
            withoutRedemption({ null }, { error("Native vendor failure") })
                .`unsupported offer code redemption returns its documented no-op`()
        }
        assertThrows(AssertionError::class.java) {
            withoutRedemption({ fixture.purchase("conformance.product") })
                .`unsupported offer code redemption returns its documented no-op`()
        }
        assertThrows(IllegalStateException::class.java) {
            withoutRedemption({ error("Vendor failure") })
                .`unsupported offer code redemption returns its documented no-op`()
        }
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
