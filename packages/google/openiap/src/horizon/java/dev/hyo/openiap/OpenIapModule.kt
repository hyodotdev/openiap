package dev.hyo.openiap

import android.app.Activity
import android.content.Context
import android.os.Bundle
import com.meta.horizon.billingclient.api.AcknowledgePurchaseParams
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyInformationDialogListener
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyReportingDetails
import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.BillingClientStateListener
import com.meta.horizon.billingclient.api.BillingFlowParams
import com.meta.horizon.billingclient.api.BillingResult
import com.meta.horizon.billingclient.api.ConsumeParams
import com.meta.horizon.billingclient.api.GetBillingConfigParams
import com.meta.horizon.billingclient.api.PendingPurchasesParams
import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import com.meta.horizon.billingclient.api.PurchasesUpdatedListener
import com.meta.horizon.billingclient.api.QueryProductDetailsParams
import com.meta.horizon.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.helpers.isSubscriptionReplacementTargetCountValid
import dev.hyo.openiap.helpers.ActiveStoreConnection
import dev.hyo.openiap.helpers.ActiveStoreOperationRegistry
import dev.hyo.openiap.helpers.isPurchaseForPendingRequest
import dev.hyo.openiap.helpers.connectionClientToClose
import dev.hyo.openiap.helpers.emitFailureAndThrow
import dev.hyo.openiap.helpers.requireAuthoritativeStorefrontCountry
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.restorePurchasesHorizon
import dev.hyo.openiap.helpers.queryPurchasesHorizon
import dev.hyo.openiap.helpers.ProductManager
import dev.hyo.openiap.helpers.queryProductDetailsHorizon
import dev.hyo.openiap.helpers.resumeGuard
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.helpers.transitionStoreConnection
import dev.hyo.openiap.utils.HorizonBillingConverters.toActiveSubscription
import dev.hyo.openiap.utils.HorizonBillingConverters.toInAppProduct
import dev.hyo.openiap.utils.HorizonBillingConverters.toPurchase
import dev.hyo.openiap.utils.HorizonBillingConverters.toSubscriptionProduct
import dev.hyo.openiap.utils.verifyPurchaseWithGooglePlay
import dev.hyo.openiap.utils.verifyPurchaseWithHorizon
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.PurchaseVerificationProvider
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

private const val TAG = "OpenIapModule"
private const val HORIZON_APP_ID_META_DATA = "com.meta.horizon.platform.HORIZON_APP_ID"
private const val PURCHASE_QUERY_INITIAL_DELAY_MS = 500L
private const val PURCHASE_QUERY_INTERVAL_MS = 1_000L
private const val PURCHASE_QUERY_MAX_ATTEMPTS = 300
private val LEGACY_HORIZON_APP_ID_META_DATA = listOf(
    "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
    "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
    "com.oculus.vr.APP_ID"
)

internal fun resolveHorizonAppId(metaData: Bundle?): String? =
    (listOf(HORIZON_APP_ID_META_DATA) + LEGACY_HORIZON_APP_ID_META_DATA)
        .firstNotNullOfOrNull { key ->
            metaData?.getString(key)?.takeIf { it.isNotBlank() }
        }

internal data class HorizonAllQueryResults<T : Any>(
    val inApp: T?,
    val subscriptions: T?,
)

internal suspend fun <T : Any> collectHorizonAllQueryResults(
    queryInApp: suspend () -> T,
    querySubscriptions: suspend () -> T,
): HorizonAllQueryResults<T> {
    suspend fun capture(query: suspend () -> T): Result<T> = try {
        Result.success(query())
    } catch (error: Throwable) {
        if (
            error is CancellationException ||
            error is Error ||
            error is OpenIapError.ServiceDisconnected
        ) throw error
        Result.failure(error)
    }

    val (inAppResult, subscriptionsResult) = coroutineScope {
        val inApp = async { capture(queryInApp) }
        val subscriptions = async { capture(querySubscriptions) }
        inApp.await() to subscriptions.await()
    }
    if (inAppResult.isFailure && subscriptionsResult.isFailure) {
        throw checkNotNull(inAppResult.exceptionOrNull())
    }
    return HorizonAllQueryResults(
        inApp = inAppResult.getOrNull(),
        subscriptions = subscriptionsResult.getOrNull(),
    )
}

/**
 * Bounded purchase polling for Horizon, whose compatibility callback can be
 * omitted after a successfully launched flow. `null` means request ownership
 * was lost; an empty list means the bounded window elapsed without a match.
 */
internal suspend fun <T> pollHorizonPurchases(
    initialDelayMillis: Long,
    intervalMillis: Long,
    maxAttempts: Int,
    ownsRequest: () -> Boolean,
    query: suspend () -> List<T>,
    matches: (T) -> Boolean,
    onQueryFailure: (Throwable) -> Unit = {},
): List<T>? {
    require(initialDelayMillis >= 0)
    require(intervalMillis >= 0)
    require(maxAttempts > 0)

    if (initialDelayMillis > 0) delay(initialDelayMillis)
    repeat(maxAttempts) { attempt ->
        if (!ownsRequest()) return null
        val matched = try {
            query().filter(matches)
        } catch (error: Throwable) {
            if (error is CancellationException || error is Error) throw error
            onQueryFailure(error)
            emptyList()
        }
        if (matched.isNotEmpty()) return matched
        if (attempt + 1 < maxAttempts && intervalMillis > 0) delay(intervalMillis)
    }
    return emptyList()
}

internal class HorizonPurchaseDeliveryClaims(
    private val maximumSize: Int = 100,
) {
    private val lock = Any()
    private val keys = linkedSetOf<String>()

    fun claim(key: String): Boolean = synchronized(lock) {
        if (!keys.add(key)) return@synchronized false
        while (keys.size > maximumSize) keys.remove(keys.first())
        true
    }

    internal fun size(): Int = synchronized(lock) { keys.size }
}

internal fun <T : Any> claimHorizonPendingIfOwned(
    lock: Any,
    current: () -> T?,
    owns: (T) -> Boolean,
    clear: () -> Unit,
): T? = synchronized(lock) {
    current()?.takeIf(owns)?.also { clear() }
}

internal fun horizonUnsupportedPurchaseError(
    type: ProductQueryType,
    offerToken: String?,
    purchaseToken: String?,
    replacementMode: Int?,
    originalExternalTransactionId: String?,
    hasDeveloperBillingOption: Boolean,
    useAlternativeBilling: Boolean = false,
): OpenIapError? = when {
    !originalExternalTransactionId.isNullOrBlank() -> OpenIapError.FeatureNotSupported(
        "originalExternalTransactionId is only supported by Google Play Billing 9.1+"
    )
    hasDeveloperBillingOption -> OpenIapError.FeatureNotSupported(
        "developerBillingOption is only supported by Google Play Billing 8.3+"
    )
    useAlternativeBilling -> OpenIapError.FeatureNotSupported(
        "Alternative billing is not supported by Meta Horizon Billing"
    )
    type == ProductQueryType.InApp && !offerToken.isNullOrBlank() ->
        OpenIapError.FeatureNotSupported(
            "One-time product offer tokens are not supported by Meta Horizon Billing"
        )
    replacementMode != null && purchaseToken.isNullOrBlank() ->
        OpenIapError.DeveloperError(
            "replacementMode requires purchaseToken for a subscription replacement"
        )
    else -> null
}

internal fun matchesRequestedProductIds(
    primaryProductId: String,
    productIds: Collection<String>,
    requestedProductIds: Collection<String>,
): Boolean = requestedProductIds.isEmpty() ||
    primaryProductId in requestedProductIds ||
    productIds.any { it in requestedProductIds }

internal fun hasInvalidHorizonSubscriptionOffer(
    requestedSkus: Collection<String>,
    offers: Collection<AndroidSubscriptionOfferInput>,
): Boolean {
    val requestedCounts = requestedSkus.groupingBy { it }.eachCount()
    val offerCounts = offers.groupingBy { it.sku }.eachCount()
    return offers.any { it.sku !in requestedCounts || it.offerToken.isBlank() } ||
        offerCounts.any { (sku, count) -> count > requestedCounts.getValue(sku) }
}

internal fun uniqueHorizonBasePlanId(values: Collection<String?>): String? =
    values.mapNotNull { it?.takeIf(String::isNotBlank) }.distinct().singleOrNull()

internal fun uniqueHorizonOfferToken(values: Collection<String?>): String? =
    values.mapNotNull { it?.takeIf(String::isNotBlank) }.distinct().singleOrNull()

internal fun resolveHorizonProductType(
    productIds: Collection<String>,
    pendingRequestSkus: Set<String>,
    pendingRequestType: ProductQueryType?,
    cachedSubscriptionProductIds: Set<String>,
    cachedInAppProductIds: Set<String>,
): ProductQueryType? {
    if (pendingRequestType != null && productIds.any { it in pendingRequestSkus }) {
        return pendingRequestType
    }
    val isSubscription = productIds.any { it in cachedSubscriptionProductIds }
    val isInApp = productIds.any { it in cachedInAppProductIds }
    return when {
        isSubscription && !isInApp -> ProductQueryType.Subs
        isInApp && !isSubscription -> ProductQueryType.InApp
        else -> null
    }
}

/**
 * OpenIapModule for Meta Horizon Billing
 *
 * @param context Android context
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 *
 * The Horizon App ID is read from AndroidManifest.xml meta-data. New apps should
 * use "com.meta.horizon.platform.HORIZON_APP_ID"; legacy keys remain readable
 * for migration compatibility.
 */
internal suspend fun unsupportedRedeemOfferCode(): Boolean = false

class OpenIapModule(
    private val context: Context,
    private var alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    private var userChoiceBillingListener: dev.hyo.openiap.listener.UserChoiceBillingListener? = null
) : OpenIapProtocol {

    // Read the canonical Horizon 2.x key first, then migration-only legacy keys.
    private val appId: String? by lazy {
        try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            val id = resolveHorizonAppId(appInfo.metaData)
            OpenIapLog.d("Read Horizon App ID from manifest: $id", TAG)
            id
        } catch (e: Exception) {
            OpenIapLog.w("Failed to read Horizon App ID from AndroidManifest.xml: ${e.message}", TAG)
            null
        }
    }

    @Volatile
    private var billingClient: BillingClient? = null
    private val connectionLifecycleLock = Any()
    private var connectionGeneration = 0L
    private val activeOperations = ActiveStoreOperationRegistry<BillingClient>(connectionLifecycleLock) {
        ActiveStoreConnection(billingClient, connectionGeneration)
    }
    private var connectionAttempt: ConnectionAttempt? = null

    private fun replaceBillingClientLocked(next: BillingClient?): BillingClient? =
        billingClient.also { previous ->
            billingClient = transitionStoreConnection(previous, next, productManager::clear)
        }

    private data class ConnectionAttempt(
        val generation: Long,
        val completion: CompletableDeferred<Boolean> = CompletableDeferred(),
    )

    private data class ConnectionEnd(
        val client: BillingClient?,
        val initAttempt: ConnectionAttempt?,
        val pendingPurchase: PendingPurchaseSnapshot?,
        val operationFailures: List<() -> Unit>,
    )
    private var currentActivityRef: WeakReference<Activity>? = null
    private val purchaseDeliveryClaims = HorizonPurchaseDeliveryClaims()

    private data class PendingPurchaseSnapshot(
        val client: BillingClient,
        val callback: (Result<List<Purchase>>) -> Unit,
        val requestedSkus: Set<String>,
        val requestedType: ProductQueryType?,
        val selectedBasePlanIds: Map<String, String> = emptyMap(),
        val launchStartedAtMillis: Double? = null,
    )
    private var pendingPurchase: PendingPurchaseSnapshot? = null

    private fun clearPurchaseStateLocked() {
        pendingPurchase = null
    }

    private fun takePurchaseCallback(
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        expectedClient: BillingClient? = null,
    ): ((Result<List<Purchase>>) -> Unit)? = claimHorizonPendingIfOwned(
        lock = connectionLifecycleLock,
        current = { pendingPurchase },
        owns = { pending ->
            pending.callback === expectedCallback &&
                (expectedClient == null ||
                    billingClient === expectedClient && pending.client === expectedClient)
        },
        clear = ::clearPurchaseStateLocked,
    )?.callback

    private fun consumePurchaseCallback(
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        result: Result<List<Purchase>>,
        expectedClient: BillingClient? = null,
    ): Boolean {
        val callback = takePurchaseCallback(expectedCallback, expectedClient)
        callback?.invoke(result)
        return callback != null
    }

    private fun purchaseDeliveryKey(purchase: Purchase): String {
        val stableId = purchase.purchaseToken?.takeIf(String::isNotBlank)
            ?: purchase.id.takeIf(String::isNotBlank)
            ?: "${purchase.productId}:${purchase.transactionDate}"
        return "$stableId:${purchase.purchaseState.rawValue}"
    }

    private fun claimPurchaseDelivery(purchase: Purchase): Boolean =
        purchaseDeliveryClaims.claim(purchaseDeliveryKey(purchase))

    private fun installPurchaseCallback(
        expectedClient: BillingClient,
        requestedSkus: Set<String>,
        requestedType: ProductQueryType,
        callback: (Result<List<Purchase>>) -> Unit
    ): OpenIapError? = synchronized(connectionLifecycleLock) {
        when {
            billingClient !== expectedClient || !expectedClient.isReady() -> OpenIapError.ServiceDisconnected(
                "Billing connection ended before the purchase request could start"
            )
            pendingPurchase != null -> OpenIapError.DeveloperError()
            else -> {
                pendingPurchase = PendingPurchaseSnapshot(
                    client = expectedClient,
                    callback = callback,
                    requestedSkus = requestedSkus.toSet(),
                    requestedType = requestedType,
                )
                null
            }
        }
    }

    private fun ownsPurchaseCallback(
        expectedClient: BillingClient,
        callback: (Result<List<Purchase>>) -> Unit,
    ): Boolean = synchronized(connectionLifecycleLock) {
        billingClient === expectedClient &&
            pendingPurchase?.let {
                it.client === expectedClient && it.callback === callback
            } == true
    }

    private fun clearPurchaseCallback(callback: (Result<List<Purchase>>) -> Unit) {
        synchronized(connectionLifecycleLock) {
            val state = pendingPurchase
            if (state?.callback === callback && state.launchStartedAtMillis == null) {
                clearPurchaseStateLocked()
            }
        }
    }

    private fun launchPurchaseFlowIfOwned(
        expectedClient: BillingClient,
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        launchStartedAtMillis: Double,
        selectedBasePlanIds: Map<String, String>,
        launch: () -> BillingResult,
    ): Result<BillingResult>? = synchronized(connectionLifecycleLock) {
        val state = pendingPurchase
        if (
            billingClient !== expectedClient ||
            !expectedClient.isReady() ||
            state?.client !== expectedClient ||
            state.callback !== expectedCallback
        ) {
            null
        } else {
            pendingPurchase = state.copy(
                selectedBasePlanIds = selectedBasePlanIds.toMap(),
                launchStartedAtMillis = launchStartedAtMillis,
            )
            runCatching(launch)
        }
    }

    private fun finishPurchaseCallback(
        expectedClient: BillingClient,
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        error: OpenIapError,
    ): Boolean {
        val pending = synchronized(connectionLifecycleLock) {
            pendingPurchase?.takeIf {
                billingClient === expectedClient &&
                    it.client === expectedClient && it.callback === expectedCallback
            }?.also { clearPurchaseStateLocked() }
        } ?: return false
        error.withProductId(pending.requestedSkus.singleOrNull())
        emitPurchaseError(error)
        pending.callback(Result.success(emptyList()))
        return true
    }

    private fun correlateSelectedBasePlan(
        purchase: PurchaseAndroid,
        selectedBasePlanIds: Map<String, String>,
    ): PurchaseAndroid {
        if (selectedBasePlanIds.isEmpty()) return purchase
        val productIds = (listOf(purchase.productId) + purchase.ids.orEmpty())
            .filter(String::isNotBlank)
        val basePlanId = uniqueHorizonBasePlanId(productIds.map(selectedBasePlanIds::get))
        return if (basePlanId == null) purchase else purchase.copy(currentPlanId = basePlanId)
    }

    private fun failPurchaseCallbackForClient(
        expectedClient: BillingClient,
        error: OpenIapError,
    ) {
        val (callback, pendingSku) = synchronized(connectionLifecycleLock) {
            if (pendingPurchase?.client === expectedClient) {
                (pendingPurchase?.callback to pendingPurchase?.requestedSkus?.singleOrNull())
                    .also { clearPurchaseStateLocked() }
            } else {
                null to null
            }
        }
        callback ?: return
        error.withProductId(pendingSku)
        emitPurchaseError(error)
        callback(Result.failure(error))
    }
    private val productManager = ProductManager()
    private val fallbackActivity: Activity? = if (context is Activity) context else null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val purchaseUpdateListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
    private val userChoiceBillingListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapUserChoiceBillingListener>()
    private val developerProvidedBillingListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapDeveloperProvidedBillingListener>()

    init {
        // DO NOT build BillingClient here - React Native context doesn't have Activity yet
        // BillingClient will be built in initConnection() when Activity is guaranteed to be available
        OpenIapLog.d("OpenIapModule initialized (Horizon flavor)", TAG)
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    override val initConnection: MutationInitConnectionHandler = {
        withContext(Dispatchers.IO) {
            OpenIapLog.i("=== INIT CONNECTION ===", TAG)

            val (attempt, isOwner) = synchronized(connectionLifecycleLock) {
                val currentClient = billingClient
                if (currentClient?.isReady() == true) {
                    return@withContext true
                }
                connectionAttempt?.let { existing ->
                    return@synchronized existing to false
                }
                ConnectionAttempt(connectionGeneration).also { created ->
                    connectionAttempt = created
                } to true
            }

            if (!isOwner) {
                return@withContext withTimeoutOrNull(15_000) {
                    attempt.completion.await()
                } ?: false
            }

            val contextForInit = currentActivityRef?.get() ?: fallbackActivity ?: context
            OpenIapLog.d("Building BillingClient with ${contextForInit.javaClass.simpleName}...", TAG)
            lateinit var client: BillingClient
            client = runCatching {
                buildBillingClient(
                    contextForInit,
                    PurchasesUpdatedListener { result, purchases ->
                        onPurchasesUpdated(client, result, purchases)
                    },
                )
            }
                .getOrElse { error ->
                    OpenIapLog.w("Failed to build BillingClient: ${error.message}", TAG)
                    finishConnectionAttempt(attempt, null, false)
                    return@withContext attempt.completion.await()
                }

            val (installed, previousClient, replacedOperationFailures) = synchronized(connectionLifecycleLock) {
                if (
                    connectionAttempt === attempt &&
                    connectionGeneration == attempt.generation
                ) {
                    val previous = replaceBillingClientLocked(client)
                    val failures = previous?.takeIf { it !== client }?.let { replaced ->
                        activeOperations.invalidate(replaced) {
                            OpenIapError.ServiceDisconnected("Billing client was replaced")
                        }
                    }.orEmpty()
                    Triple(true, previous, failures)
                } else {
                    Triple(false, null, emptyList())
                }
            }
            replacedOperationFailures.forEach { it() }
            if (!installed) {
                client.endConnection()
                attempt.completion.complete(false)
                return@withContext false
            }
            previousClient?.takeIf { it !== client }?.let { previous ->
                failPurchaseCallbackForClient(
                    previous,
                    OpenIapError.ServiceDisconnected(
                        "Billing client was replaced during purchase"
                    ),
                )
                previous.endConnection()
            }

            if (client.isReady()) {
                finishConnectionAttempt(attempt, client, true)
                return@withContext attempt.completion.await()
            }

            val startResult = synchronized(connectionLifecycleLock) {
                if (
                    connectionAttempt !== attempt ||
                    connectionGeneration != attempt.generation ||
                    billingClient !== client
                ) {
                    null
                } else {
                    runCatching {
                        client.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        val ok = result.responseCode == BillingClient.BillingResponseCode.OK
                        if (!ok) {
                            OpenIapLog.w(
                                "Horizon setup failed: code=${result.responseCode}, ${result.debugMessage}",
                                TAG,
                            )
                        } else {
                            OpenIapLog.i("Horizon billing connected successfully", TAG)
                        }
                        finishConnectionAttempt(attempt, client, ok)
                    }

                    override fun onBillingServiceDisconnected() {
                        OpenIapLog.i("Horizon service disconnected", TAG)
                        val (setupPending, operationFailures) = synchronized(connectionLifecycleLock) {
                            val pending = connectionAttempt === attempt && billingClient === client
                            if (!pending && billingClient === client) {
                                connectionGeneration += 1
                                replaceBillingClientLocked(null)
                            }
                            val failures = activeOperations.invalidate(client) {
                                OpenIapError.ServiceDisconnected("Billing service disconnected")
                            }
                            pending to failures
                        }
                        operationFailures.forEach { it() }
                        if (setupPending) finishConnectionAttempt(attempt, client, false)
                        failPurchaseCallbackForClient(
                            client,
                            OpenIapError.ServiceDisconnected(
                                "Billing service disconnected during purchase"
                            ),
                        )
                    }
                        })
                    }
                }
            }
            if (startResult == null) {
                client.endConnection()
                attempt.completion.complete(false)
                return@withContext false
            }
            startResult.onFailure { error ->
                OpenIapLog.w("Horizon startConnection failed: ${error.message}", TAG)
                finishConnectionAttempt(attempt, client, false)
            }
            val connected = withTimeoutOrNull(15_000) { attempt.completion.await() }
            if (connected == null) {
                finishConnectionAttempt(attempt, client, false)
                false
            } else {
                connected
            }
        }
    }

    override val endConnection: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            runCatching {
                val end = synchronized(connectionLifecycleLock) {
                    connectionGeneration += 1
                    val activeClient = replaceBillingClientLocked(null)
                    val pendingAttempt = connectionAttempt
                    val activePurchase = pendingPurchase
                    connectionAttempt = null
                    clearPurchaseStateLocked()
                    ConnectionEnd(
                        client = activeClient,
                        initAttempt = pendingAttempt,
                        pendingPurchase = activePurchase,
                        operationFailures = activeOperations.invalidate {
                            OpenIapError.ServiceDisconnected("Billing connection ended")
                        },
                    )
                }
                end.operationFailures.forEach { it() }
                end.initAttempt?.completion?.complete(false)
                val disconnectError = OpenIapError.ServiceDisconnected(
                    "Billing connection ended while a purchase request was in progress"
                ).withProductId(end.pendingPurchase?.requestedSkus?.singleOrNull())
                if (end.pendingPurchase != null) {
                    emitPurchaseError(disconnectError)
                    end.pendingPurchase.callback(Result.failure(disconnectError))
                }
                end.client?.endConnection()
                true
            }.getOrElse { false }
        }
    }

    private fun finishConnectionAttempt(
        attempt: ConnectionAttempt,
        expectedClient: BillingClient?,
        connected: Boolean,
    ) {
        val (ownsAttempt, clientToClose, operationFailures) = synchronized(connectionLifecycleLock) {
            val currentClient = billingClient
            val owns = connectionAttempt === attempt &&
                connectionGeneration == attempt.generation &&
                (expectedClient == null || billingClient === expectedClient)
            val shouldClose = connectionGeneration != attempt.generation ||
                (expectedClient != null && billingClient !== expectedClient)
            if (owns) {
                connectionAttempt = null
                if (!connected) {
                    replaceBillingClientLocked(null)
                }
            }
            val close = connectionClientToClose(
                ownsAttempt = owns,
                connected = connected,
                currentClient = currentClient,
                expectedClient = expectedClient,
                expectedClientIsStale = shouldClose,
            )
            val failedClient = when {
                owns && !connected -> currentClient
                close != null -> close
                else -> null
            }
            val failures = failedClient?.let { client ->
                activeOperations.invalidate(client) {
                    OpenIapError.ServiceDisconnected("Billing connection failed")
                }
            }.orEmpty()
            Triple(owns, close, failures)
        }
        operationFailures.forEach { it() }
        clientToClose?.let { closingClient ->
            failPurchaseCallbackForClient(
                closingClient,
                OpenIapError.ServiceDisconnected(
                    "Billing connection failed during purchase"
                ),
            )
            closingClient.endConnection()
        }
        if (!ownsAttempt) {
            attempt.completion.complete(false)
            return
        }
        attempt.completion.complete(connected)
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady()) throw OpenIapError.NotPrepared
            if (params.skus.isEmpty()) throw OpenIapError.EmptySkuList

            val queryType = params.type ?: ProductQueryType.InApp
            when (queryType) {
                ProductQueryType.InApp -> FetchProductsResultProducts(
                    queryProductDetailsHorizon(
                        client,
                        productManager,
                        activeOperations,
                        params.skus,
                        BillingClient.ProductType.INAPP,
                    ).map { it.toInAppProduct() }
                )
                ProductQueryType.Subs -> FetchProductsResultSubscriptions(
                    queryProductDetailsHorizon(
                        client,
                        productManager,
                        activeOperations,
                        params.skus,
                        BillingClient.ProductType.SUBS,
                    ).map { it.toSubscriptionProduct() }
                )
                ProductQueryType.All -> {
                    val results = collectHorizonAllQueryResults(
                        queryInApp = {
                            queryProductDetailsHorizon(
                                client,
                                productManager,
                                activeOperations,
                                params.skus,
                                BillingClient.ProductType.INAPP,
                            )
                        },
                        querySubscriptions = {
                            queryProductDetailsHorizon(
                                client,
                                productManager,
                                activeOperations,
                                params.skus,
                                BillingClient.ProductType.SUBS,
                            )
                        },
                    )
                    val combined = buildList<ProductOrSubscription> {
                        addAll(results.inApp.orEmpty().map {
                            ProductOrSubscription.ProductItem(it.toInAppProduct())
                        })
                        addAll(results.subscriptions.orEmpty().map {
                            ProductOrSubscription.ProductSubscriptionItem(
                                it.toSubscriptionProduct()
                            )
                        })
                    }
                    FetchProductsResultAll(combined)
                }
            }
        }
    }

    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { _ ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val purchases = restorePurchasesHorizon(client, activeOperations)
            OpenIapLog.i("Retrieved ${purchases.size} authoritative Horizon purchases", TAG)
            purchases
        }
    }

    /**
     * Get available items by product type (Play-compatible API for Horizon)
     * Used by react-native-iap when type filter is specified
     */
    suspend fun getAvailableItems(type: ProductQueryType): List<Purchase> = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        val billingType = if (type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP
        queryPurchasesHorizon(client, activeOperations, billingType)
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            OpenIapLog.i("=== HORIZON getActiveSubscriptions ===", TAG)
            OpenIapLog.i("Requested subscriptionIds: $subscriptionIds", TAG)

            val client = billingClient ?: throw OpenIapError.NotPrepared
            val allPurchases = queryPurchasesHorizon(
                client,
                activeOperations,
                BillingClient.ProductType.SUBS,
            )
            OpenIapLog.i("Total SUBS purchases from query: ${allPurchases.size}", TAG)

            val androidPurchases = allPurchases.filterIsInstance<PurchaseAndroid>()
            OpenIapLog.i("PurchaseAndroid instances: ${androidPurchases.size}", TAG)

            val ids = subscriptionIds.orEmpty()
            val filtered = androidPurchases
                .filter { it.purchaseState == PurchaseState.Purchased }
                .filter { purchase ->
                    matchesRequestedProductIds(
                        primaryProductId = purchase.productId,
                        productIds = purchase.ids.orEmpty(),
                        requestedProductIds = ids,
                    )
                }

            OpenIapLog.i("Filtered subscriptions count: ${filtered.size}", TAG)

            val subscriptionProductIds = filtered
                .flatMap { listOf(it.productId) + it.ids.orEmpty() }
                .filter(String::isNotBlank)
                .distinct()
            val freshDetailsById = if (subscriptionProductIds.isEmpty()) {
                emptyMap()
            } else {
                try {
                    queryProductDetailsHorizon(
                        client,
                        productManager,
                        activeOperations,
                        subscriptionProductIds,
                        BillingClient.ProductType.SUBS,
                    ).associateBy { it.productId }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: OpenIapError.ServiceDisconnected) {
                    throw error
                } catch (error: Exception) {
                    OpenIapLog.w(
                        "Failed to refresh subscription ProductDetails: ${error.message}",
                        TAG,
                    )
                    emptyMap()
                }
            }

            val activeSubscriptions = filtered.map { purchase ->
                val productIds = (listOf(purchase.productId) + purchase.ids.orEmpty())
                    .filter(String::isNotBlank)
                    .distinct()
                val basePlanId = uniqueHorizonBasePlanId(
                    productIds.flatMap { productId ->
                        freshDetailsById[productId]
                            ?.subscriptionOfferDetails
                            .orEmpty()
                            .map { it.basePlanId }
                    }
                )

                if (basePlanId != null && purchase.currentPlanId == null) {
                    purchase.copy(currentPlanId = basePlanId).toActiveSubscription()
                } else {
                    purchase.toActiveSubscription()
                }
            }

            activeSubscriptions.forEachIndexed { index, sub ->
                OpenIapLog.i(
                    "  [$index] productId=${sub.productId} " +
                    "basePlanId=${sub.basePlanIdAndroid} " +
                    "isActive=${sub.isActive} " +
                    "autoRenewing=${sub.autoRenewingAndroid}",
                    TAG
                )
            }

            OpenIapLog.i("=== END getActiveSubscriptions ===", TAG)
            activeSubscriptions
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            val androidArgs = props.toAndroidPurchaseArgs()
            OpenIapLog.i("=== REQUEST PURCHASE: ${androidArgs.skus} ===", TAG)

            val activity = currentActivityRef?.get() ?: fallbackActivity

            if (activity == null) {
                val err = OpenIapError.MissingCurrentActivity
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            val client = billingClient
            if (client == null || !client.isReady()) {
                val err = OpenIapError.NotPrepared
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            if (androidArgs.skus.isEmpty()) {
                val err = OpenIapError.EmptySkuList
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            if (!isSubscriptionReplacementTargetCountValid(
                    targetSkuCount = androidArgs.skus.size,
                    hasProductLevelReplacementParams =
                        androidArgs.subscriptionProductReplacementParams != null,
                )
            ) {
                val err = OpenIapError.DeveloperError(
                    "subscriptionProductReplacementParams requires exactly one target SKU"
                )
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            if (androidArgs.subscriptionProductReplacementParams != null) {
                val err = OpenIapError.FeatureNotSupported(
                    "subscriptionProductReplacementParams is only supported by Google Play"
                )
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            horizonUnsupportedPurchaseError(
                type = androidArgs.type,
                offerToken = androidArgs.offerToken,
                purchaseToken = androidArgs.purchaseToken,
                replacementMode = androidArgs.replacementMode,
                originalExternalTransactionId = androidArgs.originalExternalTransactionId,
                hasDeveloperBillingOption = androidArgs.developerBillingOption != null,
                useAlternativeBilling = androidArgs.useAlternativeBilling == true,
            )?.let { error ->
                emitPurchaseError(error)
                return@withContext emptyList()
            }

            if (hasInvalidHorizonSubscriptionOffer(
                    requestedSkus = androidArgs.skus,
                    offers = androidArgs.subscriptionOffers.orEmpty(),
                )
            ) {
                val error = OpenIapError.SkuOfferMismatchFailure()
                emitPurchaseError(error)
                return@withContext emptyList()
            }

            suspendCancellableCoroutine<List<Purchase>> { continuation ->
                var callbackRef: ((Result<List<Purchase>>) -> Unit)? = null
                val resumer = continuation.resumeGuard {
                    callbackRef?.let(::clearPurchaseCallback)
                }
                val callback: (Result<List<Purchase>>) -> Unit = { result ->
                    result.fold(resumer::resume, resumer::resumeWithException)
                }
                callbackRef = callback
                val installError = installPurchaseCallback(
                    expectedClient = client,
                    requestedSkus = androidArgs.skus.toSet(),
                    requestedType = androidArgs.type,
                    callback = callback,
                )
                if (installError != null) {
                    OpenIapLog.w("requestPurchase rejected: ${installError.message}", TAG)
                    if (installError is OpenIapError.ServiceDisconnected) {
                        emitPurchaseError(installError)
                    }
                    resumer.resumeWithException(installError)
                    return@suspendCancellableCoroutine
                }
                if (!continuation.isActive) {
                    clearPurchaseCallback(callback)
                    return@suspendCancellableCoroutine
                }

                val desiredType = if (androidArgs.type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

                fun buildAndLaunch(details: List<HorizonProductDetails>) {
                    if (!continuation.isActive || !ownsPurchaseCallback(client, callback)) {
                        return
                    }
                    val paramsList = mutableListOf<BillingFlowParams.ProductDetailsParams>()
                    val requestedOffersBySku = mutableMapOf<String, MutableList<String>>()
                    val selectedBasePlanIds = mutableMapOf<String, String>()

                    if (androidArgs.type == ProductQueryType.Subs) {
                        androidArgs.subscriptionOffers.orEmpty().forEach { offer ->
                            if (offer.offerToken.isNotEmpty()) {
                                OpenIapLog.d("Adding offer token for SKU ${offer.sku}", TAG)
                                val queue = requestedOffersBySku.getOrPut(offer.sku) { mutableListOf() }
                                queue.add(offer.offerToken)
                            }
                        }
                    }

                    details.forEach { productDetails ->
                        val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)

                        if (androidArgs.type == ProductQueryType.Subs) {
                            val availableOffers = productDetails.subscriptionOfferDetails?.map {
                                it.basePlanId
                            } ?: emptyList()
                            OpenIapLog.d("Available offer base plans for ${productDetails.productId}: $availableOffers", TAG)

                            val availableOffersByToken = productDetails.subscriptionOfferDetails
                                .orEmpty()
                                .associateBy { it.offerToken }
                            val availableTokens = availableOffersByToken.keys
                            val fromQueue = requestedOffersBySku[productDetails.productId]?.let { queue ->
                                if (queue.isNotEmpty()) queue.removeAt(0) else null
                            }
                            val resolved = fromQueue ?: uniqueHorizonOfferToken(
                                productDetails.subscriptionOfferDetails.orEmpty().map { it.offerToken }
                            )

                            OpenIapLog.d(
                                "Resolved offer token for ${productDetails.productId}: present=${!resolved.isNullOrEmpty()}",
                                TAG,
                            )

                            if (resolved.isNullOrEmpty() || !availableTokens.contains(resolved)) {
                                OpenIapLog.w("Invalid offer token for ${productDetails.productId}", TAG)
                                finishPurchaseCallback(
                                    client,
                                    callback,
                                    OpenIapError.SkuOfferMismatchFailure(),
                                )
                                return
                            }

                            builder.setOfferToken(resolved)
                            availableOffersByToken[resolved]?.basePlanId
                                ?.takeIf(String::isNotBlank)
                                ?.let { selectedBasePlanIds[productDetails.productId] = it }
                        }

                        paramsList += builder.build()
                    }

                    val flowBuilder = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(paramsList)
                        .setIsOfferPersonalized(androidArgs.isOfferPersonalized == true)

                    androidArgs.obfuscatedAccountId?.let { flowBuilder.setObfuscatedAccountId(it) }
                    androidArgs.obfuscatedProfileId?.let {
                        OpenIapLog.d("Setting obfuscatedProfileId", TAG)
                        flowBuilder.setObfuscatedProfileId(it)
                    }

                    if (androidArgs.type == ProductQueryType.Subs && !androidArgs.purchaseToken.isNullOrBlank()) {
                        OpenIapLog.d("=== Subscription Upgrade Flow ===", TAG)
                        OpenIapLog.d("  - Old Token: <redacted>", TAG)
                        OpenIapLog.d("  - Target SKUs: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("  - Replacement mode: ${androidArgs.replacementMode}", TAG)
                        OpenIapLog.d("  - Product Details Count: ${paramsList.size}", TAG)
                        paramsList.forEachIndexed { idx, params ->
                            OpenIapLog.d("  - Product[$idx]: SKU=${details[idx].productId}, offerToken=...", TAG)
                        }

                        val updateParamsBuilder = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                            .setOldPurchaseToken(androidArgs.purchaseToken)

                        // Set replacement mode - this is critical for upgrades
                        val replacementMode = androidArgs.replacementMode ?: 5 // Default to CHARGE_FULL_PRICE
                        updateParamsBuilder.setSubscriptionReplacementMode(replacementMode)
                        OpenIapLog.d("  - Final replacement mode: $replacementMode", TAG)

                        val updateParams = updateParamsBuilder.build()
                        flowBuilder.setSubscriptionUpdateParams(updateParams)
                        OpenIapLog.d("=== Subscription Update Params Set ===", TAG)
                    }

                    val billingFlowParams = flowBuilder.build()

                    // Run on UI thread as required by Android Billing API
                    activity.runOnUiThread {
                        if (!continuation.isActive || !ownsPurchaseCallback(client, callback)) {
                            return@runOnUiThread
                        }
                        val launchStartedAtMillis = System.currentTimeMillis().toDouble()
                        val launchAttempt = launchPurchaseFlowIfOwned(
                            client,
                            callback,
                            launchStartedAtMillis,
                            selectedBasePlanIds,
                        ) {
                            client.launchBillingFlow(activity, billingFlowParams)
                        } ?: return@runOnUiThread
                        val result = launchAttempt.getOrElse { error ->
                            finishPurchaseCallback(
                                client,
                                callback,
                                OpenIapError.PurchaseFailed(
                                    error.message ?: "Failed to launch billing flow"
                                ),
                            )
                            return@runOnUiThread
                        }
                        OpenIapLog.d("launchBillingFlow result: ${result.responseCode} - ${result.debugMessage}", TAG)

                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            val err = when (result.responseCode) {
                                BillingClient.BillingResponseCode.DEVELOPER_ERROR -> {
                                    OpenIapLog.w("DEVELOPER_ERROR: Invalid arguments. Check if subscriptions are in the same group.", TAG)
                                    OpenIapError.DeveloperError(result.debugMessage)
                                }
                                BillingClient.BillingResponseCode.USER_CANCELED -> OpenIapError.UserCancelled(result.debugMessage)
                                else -> OpenIapError.PurchaseFailed(result.debugMessage)
                            }
                            finishPurchaseCallback(client, callback, err)
                        } else {
                            if (!ownsPurchaseCallback(client, callback)) return@runOnUiThread
                            OpenIapLog.i(
                                "launchBillingFlow started; polling purchases while awaiting the callback",
                                TAG,
                            )
                            scope.launch {
                                val matched = pollHorizonPurchases(
                                    initialDelayMillis = PURCHASE_QUERY_INITIAL_DELAY_MS,
                                    intervalMillis = PURCHASE_QUERY_INTERVAL_MS,
                                    maxAttempts = PURCHASE_QUERY_MAX_ATTEMPTS,
                                    ownsRequest = { ownsPurchaseCallback(client, callback) },
                                    query = {
                                        queryPurchasesHorizon(client, activeOperations, desiredType)
                                    },
                                    matches = { purchase ->
                                        purchase.transactionDate >= launchStartedAtMillis &&
                                            matchesRequestedProductIds(
                                                primaryProductId = purchase.productId,
                                                productIds = purchase.ids.orEmpty(),
                                                requestedProductIds = androidArgs.skus,
                                            )
                                    },
                                    onQueryFailure = { error ->
                                        OpenIapLog.w(
                                            "Horizon purchase polling failed: ${error.message}",
                                            TAG,
                                        )
                                    },
                                ) ?: return@launch

                                val correlated = matched.map { purchase ->
                                    (purchase as? PurchaseAndroid)?.let {
                                        correlateSelectedBasePlan(it, selectedBasePlanIds)
                                    } ?: purchase
                                }
                                if (correlated.isNotEmpty() && consumePurchaseCallback(
                                        callback,
                                        Result.success(correlated),
                                        client,
                                    )) {
                                        OpenIapLog.d("Purchase polling found ${correlated.size} purchases", TAG)
                                        correlated.forEach { purchase ->
                                            if (!claimPurchaseDelivery(purchase)) return@forEach
                                            purchaseUpdateListeners.forEach { listener ->
                                                runCatching { listener.onPurchaseUpdated(purchase) }
                                            }
                                        }
                                } else if (matched.isEmpty() && consumePurchaseCallback(
                                        callback,
                                        Result.success(emptyList()),
                                        client,
                                    )
                                ) {
                                    val timeoutError = OpenIapError.ServiceTimeout(
                                        "Meta Horizon purchase did not complete within the polling window"
                                    ).withProductId(androidArgs.skus.singleOrNull())
                                    emitPurchaseError(timeoutError)
                                }
                            }
                        }
                    }
                }

                try {
                    val productIdsToQuery = androidArgs.skus.distinct()
                    val productList = productIdsToQuery.map { sku ->
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(sku)
                            .setProductType(desiredType)
                            .build()
                    }
                    val params = QueryProductDetailsParams.newBuilder()
                        .setProductList(productList)
                        .build()

                    val didHandleProductDetails = AtomicBoolean(false)
                    client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                        if (!didHandleProductDetails.compareAndSet(false, true)) {
                            return@queryProductDetailsAsync
                        }
                        val list = productDetailsList ?: emptyList()
                        val ownsRequest = synchronized(connectionLifecycleLock) {
                            val owns = billingClient === client &&
                                pendingPurchase?.let {
                                    it.client === client && it.callback === callback
                                } == true
                            if (owns && billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                                productManager.replaceQueryResults(
                                    requestedProductIds = productIdsToQuery,
                                    details = list,
                                    productType = desiredType,
                                )
                            }
                            owns
                        }
                        if (!continuation.isActive || !ownsRequest) {
                            return@queryProductDetailsAsync
                        }

                        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                            val err = OpenIapError.QueryProduct.withDiagnostics(
                                responseCode = billingResult.responseCode,
                                debugMessage = billingResult.debugMessage,
                                productIds = productIdsToQuery,
                                productType = desiredType,
                                isEmptyProductList = productDetailsList.isNullOrEmpty()
                            )
                            finishPurchaseCallback(client, callback, err)
                            return@queryProductDetailsAsync
                        }

                        val detailsBySku = list.associateBy { it.productId }
                        val ordered = androidArgs.skus.mapNotNull(detailsBySku::get)

                        if (ordered.size != androidArgs.skus.size) {
                            val missingSku = androidArgs.skus.firstOrNull {
                                !detailsBySku.containsKey(it)
                            }
                            val err = OpenIapError.SkuNotFound(missingSku ?: "")
                            finishPurchaseCallback(client, callback, err)
                            return@queryProductDetailsAsync
                        }

                        try {
                            buildAndLaunch(ordered)
                        } catch (error: Error) {
                            throw error
                        } catch (error: Exception) {
                            val purchaseError = (error as? OpenIapError)
                                ?: OpenIapError.DeveloperError(
                                    error.message ?: "Invalid Horizon billing flow parameters"
                                )
                            finishPurchaseCallback(client, callback, purchaseError)
                        }
                    }
                } catch (error: Error) {
                    throw error
                } catch (error: Exception) {
                    val purchaseError = (error as? OpenIapError)
                        ?: OpenIapError.QueryProduct.withDiagnostics(
                            debugMessage = error.message,
                            productIds = androidArgs.skus.distinct(),
                            productType = desiredType,
                        )
                    finishPurchaseCallback(client, callback, purchaseError)
                }
            }
        }

        RequestPurchaseResultPurchases(purchases)
    }

    override val finishTransaction: MutationFinishTransactionHandler = { purchase, isConsumable ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady()) throw OpenIapError.NotPrepared
            val token = purchase.purchaseToken?.takeIf { it.isNotBlank() }
                ?: throw OpenIapError.PurchaseFailed("Missing purchase token on purchase")
            if (isConsumable == true) {
                val params = ConsumeParams.newBuilder().setPurchaseToken(token).build()
                activeOperations.await(client) { operation ->
                    client.consumeAsync(params) { result, _ ->
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            OpenIapLog.w("Failed to consume Horizon purchase: ${result.debugMessage}", TAG)
                            operation.fail(
                                OpenIapError.fromBillingResponseCode(
                                    result.responseCode,
                                    result.debugMessage
                                )
                            )
                        } else {
                            operation.succeed(Unit)
                        }
                    }
                }
            } else {
                val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()
                activeOperations.await(client) { operation ->
                    client.acknowledgePurchase(params) { result ->
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            OpenIapLog.w("Failed to acknowledge Horizon purchase: ${result.debugMessage}", TAG)
                            operation.fail(
                                OpenIapError.fromBillingResponseCode(
                                    result.responseCode,
                                    result.debugMessage
                                )
                            )
                        } else {
                            operation.succeed(Unit)
                        }
                    }
                }
            }
        }
    }

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchaseToken).build()
            activeOperations.await(client) { operation ->
                client.acknowledgePurchase(params) { result ->
                    val success = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!success) {
                        OpenIapLog.w("Horizon acknowledge failed: ${result.debugMessage}", TAG)
                    }
                    operation.succeed(success)
                }
            }
        }
    }

    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = ConsumeParams.newBuilder().setPurchaseToken(purchaseToken).build()
            activeOperations.await(client) { operation ->
                client.consumeAsync(params) { result, _ ->
                    val success = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!success) {
                        OpenIapLog.w("Horizon consume failed: ${result.debugMessage}", TAG)
                    }
                    operation.succeed(success)
                }
            }
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = { _ ->
        throw OpenIapError.FeatureNotSupported(
            "Meta Horizon Billing does not expose a subscription-management deep link"
        )
    }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            OpenIapLog.i("=== HORIZON restorePurchases ===", TAG)
            OpenIapLog.i("Number of purchase update listeners: ${purchaseUpdateListeners.size}", TAG)

            val client = billingClient ?: throw OpenIapError.NotPrepared
            val all = restorePurchasesHorizon(client, activeOperations)
            OpenIapLog.i("Total restored purchases: ${all.size}", TAG)

            all.forEachIndexed { index, purchase ->
                OpenIapLog.i("  Restoring [$index] productId=${purchase.productId}", TAG)
                purchaseUpdateListeners.forEach { listener ->
                    runCatching {
                        listener.onPurchaseUpdated(purchase)
                        OpenIapLog.d("  - Listener notified", TAG)
                    }.onFailure { e ->
                        OpenIapLog.e("  - Listener failed", e, TAG)
                    }
                }
            }

            OpenIapLog.i("=== END restorePurchases ===", TAG)
            Unit
        }
    }

    @Deprecated("Use verifyPurchase")
    override val validateReceipt: MutationValidateReceiptHandler = { props ->
        verifyPurchase(props)
    }

    override val verifyPurchase: MutationVerifyPurchaseHandler = { props ->
        // Use Horizon API if horizon options provided, otherwise fallback to Google Play
        if (props.horizon != null) {
            val horizonAppId = appId ?: throw OpenIapError.DeveloperError(
                "Horizon verifyPurchase requires appId to be set during initConnection"
            )
            val horizonResult = verifyPurchaseWithHorizon(props, horizonAppId, TAG)
            if (!horizonResult.success) {
                throw OpenIapError.InvalidPurchaseVerification
            }
            horizonResult
        } else {
            verifyPurchaseWithGooglePlay(props, TAG)
        }
    }

    override val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler = { props ->
        if (props.provider != PurchaseVerificationProvider.Iapkit) {
            throw OpenIapError.FeatureNotSupported()
        }
        val options = props.iapkit ?: throw OpenIapError.DeveloperError(
            "Missing IAPKit verification parameters"
        )
        VerifyPurchaseWithProviderResult(
            iapkit = verifyPurchaseWithIapkit(options, TAG),
            provider = props.provider
        )
    }

    private val purchaseError: SubscriptionPurchaseErrorHandler = {
        onPurchaseError(this::addPurchaseErrorListener, this::removePurchaseErrorListener)
    }

    private val purchaseUpdated: SubscriptionPurchaseUpdatedHandler = {
        onPurchaseUpdated(this::addPurchaseUpdateListener, this::removePurchaseUpdateListener)
    }

    private val subscriptionBillingIssue: SubscriptionSubscriptionBillingIssueHandler = {
        // Horizon Billing Compatibility SDK lacks a suspended-subscription signal
        // (see OpenIapSubscriptionBillingIssueListener docs), so report it as unsupported
        // rather than suspending forever.
        throw OpenIapError.FeatureNotSupported()
    }

    private val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler = {
        throw OpenIapError.FeatureNotSupported(
            "Horizon Billing does not support User Choice Billing events",
        )
    }

    private val developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler = {
        throw OpenIapError.FeatureNotSupported(
            "Horizon Billing does not support Developer Provided Billing events",
        )
    }

    override val queryHandlers: QueryHandlers = QueryHandlers(
        fetchProducts = fetchProducts,
        getActiveSubscriptions = getActiveSubscriptions,
        getAvailablePurchases = getAvailablePurchases,
        getBillingChoiceInfoAndroid = { params ->
            getBillingChoiceInfo(params)
        },
        getStorefront = { getStorefront() },
        hasActiveSubscriptions = hasActiveSubscriptions
    )

    @Suppress("DEPRECATION")
    override val mutationHandlers: MutationHandlers = MutationHandlers(
        acknowledgePurchaseAndroid = acknowledgePurchaseAndroid,
        checkAlternativeBillingAvailabilityAndroid = {
            checkAlternativeBillingAvailability()
        },
        consumePurchaseAndroid = consumePurchaseAndroid,
        createAlternativeBillingTokenAndroid = {
            createAlternativeBillingReportingToken()
        },
        createBillingProgramReportingDetailsAndroid = { program, developerBillingType ->
            createBillingProgramReportingDetails(program, developerBillingType)
        },
        deepLinkToSubscriptions = deepLinkToSubscriptions,
        endConnection = endConnection,
        finishTransaction = finishTransaction,
        initConnection = initConnection,
        isBillingProgramAvailableAndroid = { program ->
            isBillingProgramAvailable(program)
        },
        launchExternalLinkAndroid = { params ->
            val activity = currentActivityRef?.get() ?: fallbackActivity
                ?: throw OpenIapError.MissingCurrentActivity
            launchExternalLink(activity, params)
        },
        // Meta Horizon has no Google Play redemption surface. Keep the generated
        // handler callable without requiring an Activity for this explicit no-op.
        openRedeemOfferCodeAndroid = { unsupportedRedeemOfferCode() },
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        showAlternativeBillingDialogAndroid = {
            val activity = currentActivityRef?.get() ?: fallbackActivity
            if (activity == null) false else showAlternativeBillingInformationDialog(activity)
        },
        showBillingProgramInformationDialogAndroid = { params ->
            val activity = currentActivityRef?.get() ?: fallbackActivity
                ?: throw OpenIapError.MissingCurrentActivity
            showBillingProgramInformationDialog(activity, params)
        },
        showInAppMessagesAndroid = { params ->
            val activity = currentActivityRef?.get() ?: fallbackActivity
                ?: throw OpenIapError.MissingCurrentActivity
            showInAppMessages(activity, params)
        },
        validateReceipt = validateReceipt,
        verifyPurchase = verifyPurchase,
        verifyPurchaseWithProvider = verifyPurchaseWithProvider
    )

    override val subscriptionHandlers: SubscriptionHandlers = SubscriptionHandlers(
        developerProvidedBillingAndroid = developerProvidedBillingAndroid,
        purchaseError = purchaseError,
        purchaseUpdated = purchaseUpdated,
        subscriptionBillingIssue = subscriptionBillingIssue,
        userChoiceBillingAndroid = userChoiceBillingAndroid,
    )

    private fun emitPurchaseError(error: OpenIapError) {
        purchaseErrorListeners.forEach { registeredListener ->
            runCatching { registeredListener.onPurchaseError(error) }
        }
    }

    suspend fun getStorefront(): String = withContext(Dispatchers.IO) {
        val client = billingClient ?: emitFailureAndThrow(
            OpenIapError.NotPrepared,
            ::emitPurchaseError,
        )
        if (!client.isReady()) {
            emitFailureAndThrow(OpenIapError.NotPrepared, ::emitPurchaseError)
        }
        try {
            activeOperations.await(client) { operation ->
                client.getBillingConfigAsync(
                    GetBillingConfigParams.newBuilder().build()
                ) { result, config ->
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        operation.fail(
                            OpenIapError.fromBillingResponseCode(
                                result.responseCode,
                                result.debugMessage,
                            )
                        )
                        return@getBillingConfigAsync
                    }
                    try {
                        operation.succeed(requireAuthoritativeStorefrontCountry(config?.countryCode))
                    } catch (error: OpenIapError) {
                        operation.fail(error)
                    }
                }
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            val mapped = error as? OpenIapError
                ?: OpenIapError.ServiceUnavailable(error.message)
            OpenIapLog.w("Horizon getStorefront failed: ${mapped.message}", TAG)
            emitPurchaseError(mapped)
            throw mapped
        }
    }

    override fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) {
        purchaseUpdateListeners.add(listener)
    }

    override fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) {
        purchaseUpdateListeners.remove(listener)
    }

    override fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {
        purchaseErrorListeners.add(listener)
    }

    override fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {
        purchaseErrorListeners.remove(listener)
    }

    private fun onPurchasesUpdated(
        expectedClient: BillingClient,
        result: BillingResult,
        purchases: List<HorizonPurchase>?,
    ) {
        val pendingRequest = synchronized(connectionLifecycleLock) {
            if (billingClient !== expectedClient) return
            pendingPurchase
        }
        try {
            OpenIapLog.i("=== HORIZON onPurchasesUpdated ===", TAG)
            OpenIapLog.i("Response code: ${result.responseCode}", TAG)
            OpenIapLog.i("Purchases count: ${purchases?.size ?: 0}", TAG)

            purchases?.forEachIndexed { index, purchase ->
                OpenIapLog.i(
                    "[HorizonPurchase $index] productIds=${purchase.products} " +
                        "orderIdPresent=${!purchase.orderId.isNullOrBlank()} " +
                        "acknowledged=${purchase.isAcknowledged()} autoRenew=${purchase.isAutoRenewing()}",
                    TAG
                )
            }

            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                // When using DEFERRED replacement mode, purchases will be null
                // This is expected behavior - the change will take effect at next renewal
                if (purchases != null) {
                    OpenIapLog.i("Processing ${purchases.size} successful purchases", TAG)

                    val mapped = purchases.map { purchase ->
                        val productIds = purchase.products.orEmpty()
                        val correlatedRequest = pendingRequest?.takeIf { request ->
                            val launchStartedAtMillis = request.launchStartedAtMillis
                                ?: return@takeIf false
                            (purchase.purchaseTime ?: 0L).toDouble() >= launchStartedAtMillis &&
                                productIds.any { it in request.requestedSkus }
                        }
                        val cachedSubscriptionProductIds = productIds.filterTo(mutableSetOf()) {
                            productManager.get(it, BillingClient.ProductType.SUBS) != null
                        }
                        val cachedInAppProductIds = productIds.filterTo(mutableSetOf()) {
                            productManager.get(it, BillingClient.ProductType.INAPP) != null
                        }
                        val type = resolveHorizonProductType(
                            productIds = productIds,
                            pendingRequestSkus = correlatedRequest?.requestedSkus.orEmpty(),
                            pendingRequestType = correlatedRequest?.requestedType,
                            cachedSubscriptionProductIds = cachedSubscriptionProductIds,
                            cachedInAppProductIds = cachedInAppProductIds,
                        )
                        val selectedBasePlanId = uniqueHorizonBasePlanId(
                            productIds.map { correlatedRequest?.selectedBasePlanIds?.get(it) }
                        )
                        val unambiguousCachedBasePlanId = if (type == ProductQueryType.Subs) {
                            uniqueHorizonBasePlanId(
                                productIds.flatMap { productId ->
                                    productManager.get(productId, BillingClient.ProductType.SUBS)
                                        ?.subscriptionOfferDetails
                                        .orEmpty()
                                        .map { it.basePlanId }
                                }
                            )
                        } else {
                            null
                        }
                        val basePlanId = selectedBasePlanId ?: unambiguousCachedBasePlanId
                        OpenIapLog.d(
                            "Mapping Horizon purchase: type=$type basePlanResolved=${basePlanId != null}",
                            TAG,
                        )
                        purchase.toPurchase(basePlanId)
                    }
                    val matched = pendingRequest?.launchStartedAtMillis?.let { launchStartedAtMillis ->
                        mapped.filter { purchase ->
                            isPurchaseForPendingRequest(
                                transactionDateMillis = purchase.transactionDate,
                                productIds = listOf(purchase.productId) + purchase.ids.orEmpty(),
                                requestedSkus = pendingRequest.requestedSkus,
                                launchStartedAtMillis = launchStartedAtMillis,
                            )
                        }
                    }.orEmpty()
                    // Take the pending callback before notifying listeners so
                    // resolution cannot race a listener that starts another
                    // purchase. A failed take means the request was completed or
                    // cleared elsewhere (polling/disconnect); the store still
                    // reported real purchases, so listener delivery must not be
                    // skipped — claimPurchaseDelivery below dedupes anything the
                    // polling path already delivered.
                    val completedCallback = if (matched.isNotEmpty() && pendingRequest != null) {
                        takePurchaseCallback(pendingRequest.callback, expectedClient)
                    } else {
                        null
                    }

                    OpenIapLog.i(
                        "Mapped ${mapped.size} purchases, " +
                            "notifying ${purchaseUpdateListeners.size} listeners",
                        TAG,
                    )

                    mapped.forEach { converted ->
                        if (!claimPurchaseDelivery(converted)) {
                            OpenIapLog.d(
                                "Skipping duplicate store callback already delivered by polling",
                                TAG,
                            )
                            return@forEach
                        }
                        OpenIapLog.d(
                            "Notifying ${purchaseUpdateListeners.size} listeners about " +
                                "purchase: productId=${converted.productId}",
                            TAG,
                        )
                        purchaseUpdateListeners.forEach { listener ->
                            runCatching {
                                listener.onPurchaseUpdated(converted)
                                OpenIapLog.d("Listener notified successfully", TAG)
                            }.onFailure { e ->
                                OpenIapLog.e("Listener notification failed", e, TAG)
                            }
                        }
                    }

                    if (completedCallback != null) {
                        completedCallback(Result.success(matched))
                    } else if (matched.isNotEmpty() && pendingRequest != null) {
                        OpenIapLog.w(
                            "Purchase request completed elsewhere; delivered purchase update to listeners only",
                            TAG,
                        )
                    } else if (mapped.isNotEmpty() && pendingRequest != null) {
                        OpenIapLog.w(
                            "Ignoring unrelated purchase update while another purchase is pending",
                            TAG,
                        )
                    }
                } else {
                    // Purchases is null - likely DEFERRED mode
                    OpenIapLog.d("Purchase successful but purchases list is null (DEFERRED mode)", TAG)
                    if (pendingRequest?.launchStartedAtMillis != null) {
                        consumePurchaseCallback(
                            pendingRequest.callback,
                            Result.success(emptyList()),
                            expectedClient,
                        )
                    }
                }
            } else {
                OpenIapLog.w("Purchase failed or cancelled: code=${result.responseCode}", TAG)
                val completedCallback = pendingRequest
                    ?.takeIf { it.launchStartedAtMillis != null }
                    ?.let { takePurchaseCallback(it.callback, expectedClient) }
                if (completedCallback != null) {
                    val error = OpenIapError.fromBillingResponseCode(
                        result.responseCode,
                        result.debugMessage,
                    ).withProductId(pendingRequest.requestedSkus.singleOrNull())
                    emitPurchaseError(error)
                    completedCallback(Result.success(emptyList()))
                } else {
                    OpenIapLog.d("Ignoring non-OK callback without an active purchase owner", TAG)
                }
            }
            OpenIapLog.i("=== END onPurchasesUpdated ===", TAG)
        } catch (error: Exception) {
            OpenIapLog.e("Exception in onPurchasesUpdated", error, TAG)
            if (
                pendingRequest?.launchStartedAtMillis != null &&
                consumePurchaseCallback(
                    pendingRequest.callback,
                    Result.success(emptyList()),
                    expectedClient,
                )
            ) {
                val purchaseError = (error as? OpenIapError)
                    ?: OpenIapError.PurchaseFailed(
                        error.message ?: "Failed to process the Horizon purchase update"
                    )
                purchaseError.withProductId(pendingRequest.requestedSkus.singleOrNull())
                emitPurchaseError(purchaseError)
            }
        }
    }

    /**
     * Build BillingClient with the provided context.
     *
     * CRITICAL: Horizon SDK requires Activity to properly initialize OVRPlatform with returnComponent.
     * If Context (non-Activity) is provided, Horizon SDK will run in limited mode and may cause
     * NullPointerException during purchase flow.
     *
     * @param contextForBilling Activity (preferred) or Application Context (fallback)
     */
    private fun buildBillingClient(
        contextForBilling: Context,
        listener: PurchasesUpdatedListener,
    ): BillingClient {
        if (contextForBilling is Activity) {
            OpenIapLog.d("Building BillingClient with Activity", TAG)
        } else {
            OpenIapLog.w("Building BillingClient with Context (not Activity) - Horizon SDK will run in limited mode", TAG)
        }

        val pendingPurchasesParams = com.meta.horizon.billingclient.api.PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()

        val builder = BillingClient
            .newBuilder(contextForBilling)
            .setListener(listener)
            .enablePendingPurchases(pendingPurchasesParams)

        // Set app ID if available from manifest
        appId?.let { id ->
            if (id.isNotEmpty()) {
                builder.setAppId(id)
                OpenIapLog.d("Horizon App ID set: $id", TAG)
            }
        }

        return builder.build()
    }

    // Alternative Billing - Testing if supported by Horizon Billing Compatibility Library
    @Deprecated("Use isBillingProgramAvailable with BillingProgramAndroid.ExternalOffer instead")
    override suspend fun checkAlternativeBillingAvailability(): Boolean = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            // Try to call the alternative billing method
            val result = activeOperations.await(client) { operation ->
                try {
                    client.isAlternativeBillingOnlyAvailableAsync { billingResult ->
                        operation.succeed(billingResult)
                    }
                } catch (e: NoSuchMethodError) {
                    // Method doesn't exist in Horizon library
                    OpenIapLog.w("Alternative Billing not supported by Horizon library", TAG)
                    operation.fail(OpenIapError.FeatureNotSupported())
                } catch (e: Exception) {
                    OpenIapLog.e("Error checking alternative billing: ${e.message}", e, TAG)
                    operation.fail(e)
                }
            }

            OpenIapLog.d("Alternative Billing availability: ${result.responseCode}", TAG)
            result.responseCode == BillingClient.BillingResponseCode.OK
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            OpenIapLog.e("Error in checkAlternativeBillingAvailability: ${e.message}", e, TAG)
            false
        }
    }

    @Deprecated("Use launchExternalLink instead")
    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            val activityRef = WeakReference(activity)
            val currentActivity = activityRef.get() ?: throw Exception("Activity not available")

            val result = activeOperations.await(client) { operation ->
                try {
                    val listener = AlternativeBillingOnlyInformationDialogListener { billingResult ->
                        operation.succeed(billingResult)
                    }
                    currentActivity.runOnUiThread {
                        if (operation.isActive()) {
                            client.showAlternativeBillingOnlyInformationDialog(
                                currentActivity,
                                listener
                            )
                        }
                    }
                } catch (e: NoSuchMethodError) {
                    OpenIapLog.w("showAlternativeBillingOnlyInformationDialog not supported", TAG)
                    operation.fail(OpenIapError.FeatureNotSupported())
                } catch (e: Exception) {
                    OpenIapLog.e("Error showing alternative billing dialog: ${e.message}", e, TAG)
                    operation.fail(e)
                }
            }

            OpenIapLog.d("Alternative Billing dialog result: ${result.responseCode}", TAG)
            result.responseCode == BillingClient.BillingResponseCode.OK
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            OpenIapLog.e("Error in showAlternativeBillingInformationDialog: ${e.message}", e, TAG)
            false
        }
    }

    @Deprecated("Use createBillingProgramReportingDetails with BillingProgramAndroid.ExternalOffer instead")
    override suspend fun createAlternativeBillingReportingToken(): String? = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            val result = activeOperations.await(client) { operation ->
                try {
                    client.createAlternativeBillingOnlyReportingDetailsAsync { billingResult, details ->
                        operation.succeed(Pair(billingResult, details))
                    }
                } catch (e: NoSuchMethodError) {
                    OpenIapLog.w("createAlternativeBillingOnlyReportingDetails not supported", TAG)
                    operation.fail(OpenIapError.FeatureNotSupported())
                } catch (e: Exception) {
                    OpenIapLog.e("Error creating alternative billing token: ${e.message}", e, TAG)
                    operation.fail(e)
                }
            }

            OpenIapLog.d("Alternative Billing token result: ${result.first.responseCode}", TAG)
            if (result.first.responseCode == BillingClient.BillingResponseCode.OK) {
                result.second?.externalTransactionToken
            } else {
                null
            }
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            OpenIapLog.e("Error in createAlternativeBillingReportingToken: ${e.message}", e, TAG)
            null
        }
    }

    override fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        // No-op: User Choice Billing is a Google Play feature, not supported on Meta Horizon
        OpenIapLog.w("setUserChoiceBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun setDeveloperProvidedBillingListener(listener: dev.hyo.openiap.listener.DeveloperProvidedBillingListener?) {
        // No-op: developer-provided billing programs are Google Play-only.
        OpenIapLog.w("setDeveloperProvidedBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        // No-op: User Choice Billing is a Google Play feature, not supported on Meta Horizon
        OpenIapLog.w("addUserChoiceBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        // No-op: User Choice Billing is a Google Play feature, not supported on Meta Horizon
        OpenIapLog.w("removeUserChoiceBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun addDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {
        // No-op: developer-provided billing programs are Google Play-only.
        OpenIapLog.w("addDeveloperProvidedBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun removeDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {
        // No-op: developer-provided billing programs are Google Play-only.
        OpenIapLog.w("removeDeveloperProvidedBillingListener is not supported on Meta Horizon (no-op)", TAG)
    }

    override fun addSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) {
        // No-op: Suspended-subscription detection (Purchase.isSuspended) requires Google Play
        // Billing Library 8.1+. The Meta Horizon Billing Compatibility SDK targets Play Billing 7.0
        // and does not expose this signal.
        OpenIapLog.w("addSubscriptionBillingIssueListener is not supported on Meta Horizon (no-op); requires Play Billing 8.1+", TAG)
    }

    override fun removeSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) {
        // No-op: see addSubscriptionBillingIssueListener
        OpenIapLog.w("removeSubscriptionBillingIssueListener is not supported on Meta Horizon (no-op)", TAG)
    }

    // Google Play billing programs are not supported on Horizon.
    override suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid {
        // No-op: Billing Programs is a Google Play 8.2.0+ feature, not supported on Meta Horizon
        OpenIapLog.w("isBillingProgramAvailable is not supported on Meta Horizon (no-op)", TAG)
        return BillingProgramAvailabilityResultAndroid(
            billingProgram = program,
            isAvailable = false
        )
    }

    override suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid {
        OpenIapLog.w("createBillingProgramReportingDetails is not supported on Meta Horizon", TAG)
        throw OpenIapError.FeatureNotSupported(
            "Meta Horizon does not support Google Play Billing Program reporting details"
        )
    }

    override suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean {
        // No-op: Billing Programs is a Google Play 8.2.0+ feature, not supported on Meta Horizon
        OpenIapLog.w("launchExternalLink is not supported on Meta Horizon (no-op)", TAG)
        return unsupportedRedeemOfferCode()
    }

    override suspend fun openRedeemOfferCode(activity: Activity): Boolean {
        // No-op: offer-code redemption is a Google Play feature, not supported on Meta Horizon
        OpenIapLog.w("openRedeemOfferCode is not supported on Meta Horizon (no-op)", TAG)
        return false
    }

    override suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid {
        OpenIapLog.w("getBillingChoiceInfo is not supported on Meta Horizon", TAG)
        throw OpenIapError.FeatureNotSupported("Meta Horizon does not support Google Play Billing Choice")
    }

    override suspend fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid {
        OpenIapLog.w("showBillingProgramInformationDialog is not supported on Meta Horizon", TAG)
        throw OpenIapError.FeatureNotSupported("Meta Horizon does not support Google Play Billing Choice")
    }

    override suspend fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParamsAndroid?
    ): InAppMessageResultAndroid {
        OpenIapLog.w("showInAppMessages is not supported on Meta Horizon", TAG)
        throw OpenIapError.FeatureNotSupported("Meta Horizon does not support Google Play billing in-app messages")
    }
}
