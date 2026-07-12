@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package io.github.hyochan.kmpiap

import android.app.Activity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.AcknowledgePurchaseResponseListener
import com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener
import com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener
import com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener
import com.android.billingclient.api.BillingChoiceInfoResponseListener
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
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResponseListener
import com.android.billingclient.api.LaunchExternalLinkParams
import com.android.billingclient.api.LaunchExternalLinkResponseListener
import com.android.billingclient.api.ProductDetailsResponseListener
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import io.github.hyochan.kmpiap.openiap.AlternativeBillingModeAndroid
import io.github.hyochan.kmpiap.openiap.BillingChoiceScreenTypeAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue

class BillingQueryLifecycleTest {
    @Test
    fun `end fails fetchProducts when its native callback never arrives`() =
        runTest {
            val client = LifecycleBillingClient()
            val module = connectedModule(client)

            assertDisconnectedOnEnd(module, client.productQueryStarted) {
                module.fetchProducts(
                    ProductRequest(
                        skus = listOf("product"),
                        type = ProductQueryType.InApp,
                    ),
                )
            }
        }

    @Test
    fun `end fails acknowledge when its native callback never arrives`() =
        runTest {
            val client = LifecycleBillingClient()
            val module = connectedModule(client)

            assertDisconnectedOnEnd(module, client.acknowledgeStarted) {
                module.acknowledgePurchaseAndroid("purchase-token")
            }
        }

    @Test
    fun `end fails pending purchase recovery when its callback never arrives`() =
        runTest {
            val client = LifecycleBillingClient()
            val module = connectedModule(client)

            assertDisconnectedOnEnd(module, client.purchaseQueryStarted) {
                module.queryPendingPurchaseMatches(
                    client = client,
                    productType = BillingClient.ProductType.INAPP,
                    requestedSkus = listOf("product"),
                    launchStartedAtMillis = 0.0,
                )
            }
        }

    @Test
    fun `all product query propagates end after one leg succeeds`() =
        runTest {
            val client = LifecycleBillingClient(completeFirstProductQuery = true)
            val module = connectedModule(client)

            assertDisconnectedOnEnd(module, client.productQueryStarted) {
                module.fetchProducts(
                    ProductRequest(
                        skus = listOf("product"),
                        type = ProductQueryType.All,
                    ),
                )
            }
        }

    @Test
    fun `a claimed callback result wins over a later disconnect`() =
        runTest {
            val result = CompletableDeferred(Result.success(true))
            val disconnected = CompletableDeferred<PurchaseError>()
            disconnected.complete(serviceDisconnectedError())

            assertTrue(awaitBillingQueryResult(result, disconnected))
        }

    @Test
    fun `service disconnect fails a callback-less query`() =
        runTest {
            val client = LifecycleBillingClient()
            val module = connectedModule(client)
            module.setField("activityCallbacksDisposer", { error("dispose failed") })

            assertDisconnectedAfter(
                started = client.acknowledgeStarted,
                request = { module.acknowledgePurchaseAndroid("purchase-token") },
                disconnect = {
                    disconnect(module, connectionAttempt(module), client)
                },
            )
        }

    @Test
    fun `starting a replacement attempt detaches old callback-less queries`() =
        runTest {
            val client = LifecycleBillingClient()
            val module = connectedModule(client)

            val failure =
                assertDisconnectedAfter(
                    started = client.acknowledgeStarted,
                    request = { module.acknowledgePurchaseAndroid("purchase-token") },
                    disconnect = {
                        client.ready = false
                        assertTrue(runCatching { module.initConnection(null) }.isFailure)
                    },
                )
            assertEquals("Billing client was replaced", failure.error.message)
        }

    @Test
    fun `stale callbacks cannot cross a replacement attempt`() =
        runTest {
            val oldClient = LifecycleBillingClient()
            val module = connectedModule(oldClient)
            val oldAttempt = connectionAttempt(module)
            val oldGeneration = generation(module)

            advanceSession(module)
            val replacementAttempt = connectionAttempt(module)
            installAttempt(module, replacementAttempt, oldClient)
            val replacementGeneration = generation(module)

            disconnect(module, oldAttempt, oldClient)

            assertEquals(replacementGeneration, generation(module))
            assertSame(replacementAttempt, field(module, "connectionAttempt"))

            val newClient = LifecycleBillingClient()
            installClient(module, newClient)
            assertTrue(finishAttempt(module, replacementAttempt, newClient, connected = true))

            var deliveries = 0
            deliverSessionEvent(module, oldClient, oldGeneration) { deliveries += 1 }
            deliverSessionEvent(module, newClient, replacementGeneration) { deliveries += 1 }
            assertEquals(1, deliveries)
            module.endConnection()
        }

    @Test
    fun `failed setup resets config and successful retry commits its snapshot`() =
        runTest {
            val module = InAppPurchaseAndroid()
            val failedClient = LifecycleBillingClient()
            val failedAttempt =
                connectionAttempt(
                    module,
                    alternativeMode = AlternativeBillingModeAndroid.AlternativeOnly,
                    program = BillingProgramAndroid.ExternalOffer,
                    screenType = BillingChoiceScreenTypeAndroid.DeveloperRendered,
                )
            installAttempt(module, failedAttempt, failedClient)

            assertTrue(finishAttempt(module, failedAttempt, failedClient, connected = false))
            assertConfig(
                module,
                AlternativeBillingModeAndroid.None,
                null,
                BillingChoiceScreenTypeAndroid.GoogleRendered,
            )

            val connectedClient = LifecycleBillingClient()
            val connectedAttempt =
                connectionAttempt(
                    module,
                    alternativeMode = AlternativeBillingModeAndroid.AlternativeOnly,
                    program = BillingProgramAndroid.ExternalOffer,
                    screenType = BillingChoiceScreenTypeAndroid.DeveloperRendered,
                )
            installAttempt(module, connectedAttempt, connectedClient)

            assertTrue(finishAttempt(module, connectedAttempt, connectedClient, connected = true))
            assertConfig(
                module,
                AlternativeBillingModeAndroid.AlternativeOnly,
                BillingProgramAndroid.ExternalOffer,
                BillingChoiceScreenTypeAndroid.DeveloperRendered,
            )
            module.endConnection()
        }

    @Test
    fun `available purchases does not switch clients between query legs`() =
        runTest {
            val oldClient = LifecycleBillingClient()
            val module = connectedModule(oldClient)
            lateinit var newClient: LifecycleBillingClient

            assertDisconnectedAfter(
                started = oldClient.inAppPurchaseQueryStarted,
                request = { module.getAvailablePurchases(null) },
                disconnect = {
                    oldClient.completeInAppPurchaseQuery()
                    module.endConnection()
                    newClient = LifecycleBillingClient()
                    installClient(module, newClient)
                    setConnected(module, true)
                },
            )
            assertEquals(0, newClient.purchaseQueryCount.get())
            module.endConnection()
        }

    @Test
    fun `stale suspended results cannot claim reconnect dedup tokens`() =
        runTest {
            val oldClient = LifecycleBillingClient()
            val module = connectedModule(oldClient)
            val oldGeneration = generation(module)
            val suspended = suspendedPurchase("suspended-token")

            module.endConnection()
            val newClient = LifecycleBillingClient()
            installClient(module, newClient)
            setConnected(module, true)

            notifySuspended(module, listOf(suspended), oldClient, oldGeneration)
            assertTrue(dedupTokens(module).isEmpty())

            notifySuspended(module, listOf(suspended), newClient, generation(module))
            assertEquals(setOf("suspended-token"), dedupTokens(module))
            module.endConnection()
        }

    private suspend fun assertDisconnectedOnEnd(
        module: InAppPurchaseAndroid,
        started: Deferred<Unit>,
        request: suspend () -> Any?,
    ) = assertDisconnectedAfter(started, request) { module.endConnection() }

    private suspend fun assertDisconnectedAfter(
        started: Deferred<Unit>,
        request: suspend () -> Any?,
        disconnect: suspend () -> Unit,
    ) = supervisorScope {
        val pending = async { request() }
        withContext(Dispatchers.Default) {
            withTimeout(5_000) { started.await() }
        }

        disconnect()

        val failure =
            assertFailsWith<PurchaseException> {
                withContext(Dispatchers.Default) {
                    withTimeout(5_000) { pending.await() }
                }
            }
        assertEquals(ErrorCode.ServiceDisconnected, failure.error.code)
        failure
    }

    private fun connectedModule(client: BillingClient) =
        InAppPurchaseAndroid().also { module ->
            installClient(module, client)
            setConnected(module, true)
        }

    private fun setConnected(
        module: InAppPurchaseAndroid,
        connected: Boolean,
    ) = module.setField("isConnected", connected)

    private fun installClient(
        module: InAppPurchaseAndroid,
        client: BillingClient,
    ) = module.setField("billingClient", client)

    private fun connectionAttempt(
        module: InAppPurchaseAndroid,
        alternativeMode: AlternativeBillingModeAndroid = AlternativeBillingModeAndroid.None,
        program: BillingProgramAndroid? = null,
        screenType: BillingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.GoogleRendered,
    ): Any {
        val type =
            InAppPurchaseAndroid::class.java.declaredClasses
                .first { it.simpleName == "ConnectionAttempt" }
        val constructor =
            type.declaredConstructors
                .first { it.parameterCount == 5 }
                .apply { isAccessible = true }
        return constructor.newInstance(
            generation(module),
            alternativeMode,
            program,
            screenType,
            CompletableDeferred<Boolean>(),
        )
    }

    private fun installAttempt(
        module: InAppPurchaseAndroid,
        attempt: Any,
        client: BillingClient,
    ) {
        module.setField("connectionAttempt", attempt)
        installClient(module, client)
    }

    private fun finishAttempt(
        module: InAppPurchaseAndroid,
        attempt: Any,
        client: BillingClient,
        connected: Boolean,
    ): Boolean = module.call("finishConnectionAttempt", attempt, client, connected) as Boolean

    private fun disconnect(
        module: InAppPurchaseAndroid,
        attempt: Any,
        client: BillingClient,
    ) = module.call("handleBillingServiceDisconnected", attempt, client)

    private fun advanceSession(module: InAppPurchaseAndroid) {
        synchronized(field<Any>(module, "purchaseLifecycleLock")) {
            module.call("advanceBillingSessionLocked")
        }
    }

    private fun generation(module: InAppPurchaseAndroid): Long = field(module, "connectionGeneration")

    @Suppress("UNCHECKED_CAST")
    private fun <T> field(
        module: InAppPurchaseAndroid,
        name: String,
    ): T =
        module.javaClass
            .getDeclaredField(name)
            .apply { isAccessible = true }
            .get(module) as T

    private fun InAppPurchaseAndroid.setField(
        name: String,
        value: Any?,
    ) {
        javaClass
            .getDeclaredField(name)
            .apply { isAccessible = true }
            .set(this, value)
    }

    private fun InAppPurchaseAndroid.call(
        name: String,
        vararg arguments: Any?,
    ): Any? =
        javaClass.declaredMethods
            .first { it.name.startsWith(name) }
            .apply { isAccessible = true }
            .invoke(this, *arguments)

    private fun deliverSessionEvent(
        module: InAppPurchaseAndroid,
        client: BillingClient,
        generation: Long,
        action: () -> Unit,
    ) = module.call("deliverBillingSessionEvent", client, generation, action)

    private fun notifySuspended(
        module: InAppPurchaseAndroid,
        purchases: List<PurchaseAndroid>,
        client: BillingClient,
        generation: Long,
    ) = module.call("notifySuspendedSubscriptions", purchases, client, generation)

    private fun assertConfig(
        module: InAppPurchaseAndroid,
        alternativeMode: AlternativeBillingModeAndroid,
        program: BillingProgramAndroid?,
        screenType: BillingChoiceScreenTypeAndroid,
    ) {
        assertEquals(alternativeMode, field(module, "alternativeBillingMode"))
        assertEquals(program, field<BillingProgramAndroid?>(module, "enabledBillingProgram"))
        assertEquals(screenType, field(module, "billingChoiceScreenType"))
    }

    private fun dedupTokens(module: InAppPurchaseAndroid): Set<String> =
        field<Set<String>>(module, "emittedBillingIssueTokens").toSet()

    private fun suspendedPurchase(token: String) =
        PurchaseAndroid(
            id = token,
            isAutoRenewing = false,
            isSuspendedAndroid = true,
            platform = IapPlatform.Android,
            productId = "subscription",
            purchaseState = PurchaseState.Purchased,
            purchaseToken = token,
            quantity = 1,
            store = IapStore.Google,
            transactionDate = 0.0,
        )

    private fun serviceDisconnectedError() =
        PurchaseError(
            code = ErrorCode.ServiceDisconnected,
            message = "Billing connection ended before the query completed",
        )
}

private class LifecycleBillingClient(
    private val completeFirstProductQuery: Boolean = false,
) : BillingClient() {
    @Volatile
    var ready = true
    val productQueryStarted = CompletableDeferred<Unit>()
    val acknowledgeStarted = CompletableDeferred<Unit>()
    val purchaseQueryStarted = CompletableDeferred<Unit>()
    val inAppPurchaseQueryStarted = CompletableDeferred<Unit>()
    val purchaseQueryCount = AtomicInteger()
    private val productQueryCount = AtomicInteger()

    @Volatile
    private var inAppPurchaseListener: PurchasesResponseListener? = null

    fun completeInAppPurchaseQuery() {
        checkNotNull(inAppPurchaseListener).onQueryPurchasesResponse(
            BillingResult.newBuilder().setResponseCode(BillingResponseCode.OK).build(),
            emptyList(),
        )
    }

    override fun getConnectionState(): Int = ConnectionState.CONNECTED

    override fun isReady(): Boolean = ready

    override fun queryProductDetailsAsync(
        params: QueryProductDetailsParams,
        listener: ProductDetailsResponseListener,
    ) {
        if (completeFirstProductQuery && productQueryCount.getAndIncrement() == 0) {
            listener.onProductDetailsResponse(
                BillingResult
                    .newBuilder()
                    .setResponseCode(BillingResponseCode.OK)
                    .build(),
                QueryProductDetailsResult.create(emptyList(), emptyList()),
            )
        } else {
            productQueryStarted.complete(Unit)
        }
    }

    override fun acknowledgePurchase(
        params: AcknowledgePurchaseParams,
        listener: AcknowledgePurchaseResponseListener,
    ) {
        acknowledgeStarted.complete(Unit)
    }

    override fun endConnection() = Unit

    override fun isFeatureSupported(feature: String): BillingResult = unsupported()

    override fun launchBillingFlow(
        activity: Activity,
        params: BillingFlowParams,
    ): BillingResult = unsupported()

    override fun showAlternativeBillingOnlyInformationDialog(
        activity: Activity,
        listener: AlternativeBillingOnlyInformationDialogListener,
    ): BillingResult = unsupported()

    override fun showExternalOfferInformationDialog(
        activity: Activity,
        listener: ExternalOfferInformationDialogListener,
    ): BillingResult = unsupported()

    override fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParams,
        listener: InAppMessageResponseListener,
    ): BillingResult = unsupported()

    override fun consumeAsync(
        params: ConsumeParams,
        listener: ConsumeResponseListener,
    ) {
        unsupported()
    }

    override fun createAlternativeBillingOnlyReportingDetailsAsync(
        listener: AlternativeBillingOnlyReportingDetailsListener,
    ) {
        unsupported()
    }

    override fun createBillingProgramReportingDetailsAsync(
        params: BillingProgramReportingDetailsParams,
        listener: BillingProgramReportingDetailsListener,
    ) {
        unsupported()
    }

    override fun createExternalOfferReportingDetailsAsync(listener: ExternalOfferReportingDetailsListener) {
        unsupported()
    }

    override fun getBillingChoiceInfoAsync(
        params: GetBillingChoiceInfoParams,
        listener: BillingChoiceInfoResponseListener,
    ) {
        unsupported()
    }

    override fun getBillingConfigAsync(
        params: GetBillingConfigParams,
        listener: BillingConfigResponseListener,
    ) {
        unsupported()
    }

    override fun isAlternativeBillingOnlyAvailableAsync(listener: AlternativeBillingOnlyAvailabilityListener) {
        unsupported()
    }

    override fun isBillingProgramAvailableAsync(
        billingProgram: Int,
        listener: BillingProgramAvailabilityListener,
    ) {
        unsupported()
    }

    override fun isExternalOfferAvailableAsync(listener: ExternalOfferAvailabilityListener) {
        unsupported()
    }

    override fun launchExternalLink(
        activity: Activity,
        params: LaunchExternalLinkParams,
        listener: LaunchExternalLinkResponseListener,
    ) {
        unsupported()
    }

    override fun queryPurchasesAsync(
        params: QueryPurchasesParams,
        listener: PurchasesResponseListener,
    ) {
        if (purchaseQueryCount.getAndIncrement() == 0) {
            inAppPurchaseListener = listener
            inAppPurchaseQueryStarted.complete(Unit)
        }
        purchaseQueryStarted.complete(Unit)
    }

    override fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParams,
        listener: BillingProgramInformationDialogListener,
    ) {
        unsupported()
    }

    override fun startConnection(listener: BillingClientStateListener) = unsupported()

    private fun unsupported(): Nothing = error("Unexpected BillingClient call")
}
