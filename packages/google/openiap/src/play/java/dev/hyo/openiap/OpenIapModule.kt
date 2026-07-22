package dev.hyo.openiap

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingConfig
import com.android.billingclient.api.BillingConfigResponseListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingProgramAvailabilityDetails
import com.android.billingclient.api.BillingProgramReportingDetailsParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.GetBillingChoiceInfoParams
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase as BillingPurchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.gson.Gson
import dev.hyo.openiap.helpers.ActiveStoreConnection
import dev.hyo.openiap.helpers.ActiveStoreListenerOwner
import dev.hyo.openiap.helpers.ActiveStoreOperationRegistry
import dev.hyo.openiap.helpers.ProductManager
import dev.hyo.openiap.helpers.ProductQueryResult
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.MutationHandlers
import dev.hyo.openiap.PurchaseVerificationProvider
import dev.hyo.openiap.QueryHandlers
import dev.hyo.openiap.SubscriptionHandlers
import dev.hyo.openiap.QueryFetchProductsHandler
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.SubscriptionPurchaseErrorHandler
import dev.hyo.openiap.SubscriptionPurchaseUpdatedHandler
import dev.hyo.openiap.SubscriptionSubscriptionBillingIssueHandler
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.helpers.AndroidPurchaseArgs
import dev.hyo.openiap.helpers.SubscriptionBasePlanOffer
import dev.hyo.openiap.helpers.onDeveloperProvidedBilling
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.onSubscriptionBillingIssue
import dev.hyo.openiap.helpers.onUserChoiceBilling
import dev.hyo.openiap.helpers.emitFailureAndThrow
import dev.hyo.openiap.helpers.requireAuthoritativeStorefrontCountry
import dev.hyo.openiap.helpers.queryAlreadyOwnedPurchases
import dev.hyo.openiap.helpers.queryProductDetails
import dev.hyo.openiap.helpers.queryProductDetailsWithStatus
import dev.hyo.openiap.helpers.queryPurchases
import dev.hyo.openiap.helpers.isPurchaseForPendingRequest
import dev.hyo.openiap.helpers.isSubscriptionReplacementTargetCountValid
import dev.hyo.openiap.helpers.isConnectionAttemptCurrent
import dev.hyo.openiap.helpers.connectionClientToClose
import dev.hyo.openiap.helpers.hasLegacyBillingProgramConflict
import dev.hyo.openiap.helpers.subscriptionUpdateSourceCount
import dev.hyo.openiap.helpers.transitionStoreConnection
import dev.hyo.openiap.helpers.resolveBasePlanIdForOfferToken
import dev.hyo.openiap.helpers.resolveBillingProgramsForConnection
import dev.hyo.openiap.helpers.resolveLegacySubscriptionReplacementMode
import dev.hyo.openiap.helpers.resumeGuard
import dev.hyo.openiap.helpers.restorePurchases as restorePurchasesHelper
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.utils.BillingConverters.toInAppProduct
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import dev.hyo.openiap.utils.BillingConverters.toSubscriptionProduct
import dev.hyo.openiap.utils.BillingConverters.productStatusFromUnfetchedStatus
import dev.hyo.openiap.utils.BillingConverters.unavailableInAppProduct
import dev.hyo.openiap.utils.BillingConverters.unavailableSubscriptionProduct
import dev.hyo.openiap.utils.fromBillingState
import dev.hyo.openiap.utils.toActiveSubscription
import dev.hyo.openiap.utils.toOpenIapBillingResult
import dev.hyo.openiap.utils.toOpenIapSubResponseCode
import dev.hyo.openiap.utils.verifyPurchaseWithGooglePlay
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.lang.ref.WeakReference
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

// AlternativeBillingMode moved to main source set (shared between Play and Horizon)

internal fun recordRecoverableProductQueryFailure(
    firstError: Throwable?,
    error: Throwable,
): Throwable {
    if (
        error is CancellationException ||
        error is Error ||
        error is OpenIapError.ServiceDisconnected
    ) throw error
    return firstError ?: error
}

internal data class AllProductQueryResults<T : Any>(
    val inApp: T?,
    val subscriptions: T?,
)

internal suspend fun <T : Any> collectAllProductQueryResults(
    queryInApp: suspend () -> T,
    querySubscriptions: suspend () -> T,
): AllProductQueryResults<T> {
    suspend fun capture(query: suspend () -> T): Result<T> =
        try {
            Result.success(query())
        } catch (error: Throwable) {
            Result.failure(recordRecoverableProductQueryFailure(null, error))
        }

    val (inAppResult, subscriptionsResult) = coroutineScope {
        awaitAll(
            async { capture(queryInApp) },
            async { capture(querySubscriptions) },
        )
    }
    val firstError = inAppResult.exceptionOrNull()
        ?: subscriptionsResult.exceptionOrNull()
    if (inAppResult.isFailure && subscriptionsResult.isFailure) {
        throw checkNotNull(firstError)
    }

    return AllProductQueryResults(
        inApp = inAppResult.getOrNull(),
        subscriptions = subscriptionsResult.getOrNull(),
    )
}

internal fun <T : Any> claimPendingPurchaseIfOwned(
    lock: Any,
    current: () -> T?,
    owns: (T) -> Boolean,
    clear: () -> Unit,
): T? = synchronized(lock) {
    current()?.takeIf(owns)?.also { clear() }
}

internal fun commitPlayConnectionConfiguration(
    connected: Boolean,
    pendingPrograms: MutableSet<BillingProgramAndroid>,
    attemptedPendingPrograms: Set<BillingProgramAndroid>,
    requestedMode: AlternativeBillingMode,
): AlternativeBillingMode {
    if (!connected) return AlternativeBillingMode.NONE
    pendingPrograms.removeAll(attemptedPendingPrograms)
    return requestedMode
}

/**
 * Main OpenIapModule implementation for Android
 *
 * @param context Android context
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 */
class OpenIapModule(
    private val context: Context,
    alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    @Volatile
    private var userChoiceBillingListener: dev.hyo.openiap.listener.UserChoiceBillingListener? = null,
    @Volatile
    private var developerProvidedBillingListener: dev.hyo.openiap.listener.DeveloperProvidedBillingListener? = null
) : OpenIapProtocol, PurchasesUpdatedListener {

    companion object {
        private const val TAG = "OpenIapModule"
    }

    // For backward compatibility
    constructor(context: Context, enableAlternativeBilling: Boolean) : this(
        context,
        if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE,
        null
    )

    @Volatile
    private var billingClient: BillingClient? = null
    private val connectionLifecycleLock = Any()
    private var connectionGeneration = 0L
    private fun currentStoreConnection() =
        ActiveStoreConnection(billingClient, connectionGeneration)

    private val activeOperations = ActiveStoreOperationRegistry<BillingClient>(connectionLifecycleLock) {
        currentStoreConnection()
    }

    private fun listenerOwner(
        source: () -> BillingClient?,
        generation: Long,
    ) = ActiveStoreListenerOwner(
        connectionLifecycleLock,
        ::currentStoreConnection,
        source,
        generation,
    )

    private fun listenerOwner(client: BillingClient, generation: Long) =
        listenerOwner({ client }, generation)

    private fun listenerOwner(client: BillingClient) = synchronized(connectionLifecycleLock) {
        listenerOwner(client, connectionGeneration)
    }

    private var connectionAttempt: ConnectionAttempt? = null
    private val defaultAlternativeBillingMode = alternativeBillingMode
    @Volatile
    private var activeAlternativeBillingMode = AlternativeBillingMode.NONE

    private data class BillingConnectionConfiguration(
        val alternativeBillingMode: AlternativeBillingMode,
        val billingPrograms: Set<BillingProgramAndroid>,
        val billingChoiceScreenType: BillingChoiceScreenTypeAndroid,
    )

    private data class ConnectionAttempt(
        val generation: Long,
        val configuration: BillingConnectionConfiguration,
        val pendingPrograms: Set<BillingProgramAndroid>,
        val completion: CompletableDeferred<Boolean> = CompletableDeferred(),
    )

    private data class ConnectionStart(
        val attempt: ConnectionAttempt,
        val isOwner: Boolean,
    )

    private data class ConnectionEnd(
        val client: BillingClient?,
        val initAttempt: ConnectionAttempt?,
        val pendingPurchase: PendingPurchaseSnapshot?,
        val operationFailures: List<() -> Unit>,
    )
    private var currentActivityRef: WeakReference<Activity>? = null
    private val productManager = ProductManager()
    private val gson = Gson()
    private val fallbackActivity: Activity? = if (context is Activity) context else null

    private val purchaseUpdateListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
    private val userChoiceBillingListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapUserChoiceBillingListener>()
    private val developerProvidedBillingListeners = java.util.concurrent.CopyOnWriteArraySet<OpenIapDeveloperProvidedBillingListener>()
    // Thread-safe: listeners can be added/removed on the main thread while
    // notifySuspendedSubscriptions iterates from Dispatchers.IO.
    private val subscriptionBillingIssueListeners =
        java.util.concurrent.CopyOnWriteArraySet<dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener>()
    // Dedup tokens across the session. Thread-safe set backed by ConcurrentHashMap.
    // Uses Collections.newSetFromMap instead of ConcurrentHashMap.newKeySet (API 24+).
    private val emittedBillingIssueTokens: MutableSet<String> =
        java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap())

    private fun resetConnectionStateLocked() {
        productManager.clear()
        emittedBillingIssueTokens.clear()
        activeAlternativeBillingMode = AlternativeBillingMode.NONE
    }

    private fun replaceBillingClientLocked(next: BillingClient?): BillingClient? =
        billingClient.also { previous ->
            billingClient = transitionStoreConnection(previous, next, ::resetConnectionStateLocked)
        }

    private data class PendingPurchaseSnapshot(
        val client: BillingClient,
        val generation: Long,
        val callback: (Result<List<Purchase>>) -> Unit,
        val requestedSkus: Set<String>,
        val requestedProductType: String?,
        val selectedBasePlanIdsBySku: Map<String, String?> = emptyMap(),
        val launchStartedAtMillis: Double? = null,
    )
    private var pendingPurchase: PendingPurchaseSnapshot? = null

    private fun clearPurchaseStateLocked() {
        pendingPurchase = null
    }

    private fun claimPurchaseCallback(
        expectedClient: BillingClient,
        expectedCallback: ((Result<List<Purchase>>) -> Unit)? = null,
        requireLaunched: Boolean = false,
    ): PendingPurchaseSnapshot? = claimPendingPurchaseIfOwned(
        lock = connectionLifecycleLock,
        current = { pendingPurchase },
        owns = { pending ->
            pending.client === expectedClient &&
                (expectedCallback == null || pending.callback === expectedCallback) &&
                (!requireLaunched || pending.launchStartedAtMillis != null)
        },
        clear = ::clearPurchaseStateLocked,
    )

    private fun finishPurchaseCallback(
        expectedClient: BillingClient,
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        result: Result<List<Purchase>>,
        error: OpenIapError? = null,
        requireLaunched: Boolean = false,
    ) {
        val pending = claimPurchaseCallback(
            expectedClient,
            expectedCallback,
            requireLaunched,
        ) ?: return
        error?.withProductId(pending.requestedSkus.singleOrNull())?.let(::emitPurchaseError)
        pending.callback(result)
    }

    private fun failPurchaseCallbackForClient(
        expectedClient: BillingClient,
        error: OpenIapError,
    ) {
        val pending = claimPurchaseCallback(expectedClient) ?: return
        error.withProductId(pending.requestedSkus.singleOrNull())
        emitPurchaseError(error)
        pending.callback(Result.failure(error))
    }

    private fun installPurchaseCallback(
        expectedClient: BillingClient,
        requestedSkus: Set<String>,
        requestedProductType: String,
        callback: (Result<List<Purchase>>) -> Unit
    ): OpenIapError? = synchronized(connectionLifecycleLock) {
        when {
            billingClient !== expectedClient || !expectedClient.isReady ->
                OpenIapError.ServiceDisconnected(
                    "Billing connection ended before the purchase request could start"
                )
            pendingPurchase != null ->
                OpenIapError.DeveloperError("Another purchase is already in progress")
            else -> {
                pendingPurchase = PendingPurchaseSnapshot(
                    client = expectedClient,
                    generation = connectionGeneration,
                    callback = callback,
                    requestedSkus = requestedSkus.toSet(),
                    requestedProductType = requestedProductType,
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

    private fun clearPurchaseCallback(
        expectedClient: BillingClient,
        callback: (Result<List<Purchase>>) -> Unit,
    ) {
        synchronized(connectionLifecycleLock) {
            // Once launchBillingFlow has accepted the request, keep a tombstone
            // owner even if the caller cancels. Otherwise its late callback can
            // be mistaken for a newer request.
            val state = pendingPurchase
            if (state?.client === expectedClient &&
                state.callback === callback &&
                state.launchStartedAtMillis == null
            ) {
                clearPurchaseStateLocked()
            }
        }
    }

    private fun launchPurchaseFlowIfOwned(
        expectedClient: BillingClient,
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        launchStartedAtMillis: Double,
        selectedBasePlanIdsBySku: Map<String, String?>,
        launch: () -> BillingResult,
    ): Result<BillingResult>? = synchronized(connectionLifecycleLock) {
        val state = pendingPurchase
        if (billingClient !== expectedClient ||
            !expectedClient.isReady ||
            state?.client !== expectedClient ||
            state.callback !== expectedCallback
        ) {
            null
        } else {
            pendingPurchase = state.copy(
                selectedBasePlanIdsBySku = selectedBasePlanIdsBySku.toMap(),
                launchStartedAtMillis = launchStartedAtMillis,
            )
            runCatching(launch)
        }
    }

    private fun billingResultError(message: String): BillingResult =
        BillingResult.newBuilder()
            .setResponseCode(BillingClient.BillingResponseCode.ERROR)
            .setDebugMessage(message)
            .build()

    private fun billingProgramToConstant(program: BillingProgramAndroid): Int = when (program) {
        BillingProgramAndroid.ExternalContentLink -> BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK
        BillingProgramAndroid.ExternalOffer -> BillingClient.BillingProgram.EXTERNAL_OFFER
        BillingProgramAndroid.ExternalPayments -> BillingClient.BillingProgram.EXTERNAL_PAYMENTS
        BillingProgramAndroid.BillingChoice -> BillingClient.BillingProgram.BILLING_CHOICE
        BillingProgramAndroid.UserChoiceBilling ->
            throw OpenIapError.DeveloperError(
                "USER_CHOICE_BILLING uses AlternativeBillingMode, not BillingProgram API"
            )
        BillingProgramAndroid.Unspecified ->
            throw OpenIapError.DeveloperError("Cannot use UNSPECIFIED billing program")
    }

    private fun billingChoiceProgramOrDefault(program: BillingProgramAndroid): BillingProgramAndroid =
        if (program == BillingProgramAndroid.Unspecified) {
            BillingProgramAndroid.BillingChoice
        } else {
            program
        }

    private fun billingChoiceImageLayoutConstant(layout: BillingChoiceImageLayoutAndroid): String = when (layout) {
        BillingChoiceImageLayoutAndroid.RectangularFourByOne ->
            GetBillingChoiceInfoParams.ImageLayout.RECTANGULAR_FOUR_BY_ONE
        BillingChoiceImageLayoutAndroid.RectangularThreeByOne ->
            GetBillingChoiceInfoParams.ImageLayout.RECTANGULAR_THREE_BY_ONE
        BillingChoiceImageLayoutAndroid.RectangularTwoByTwo ->
            GetBillingChoiceInfoParams.ImageLayout.RECTANGULAR_TWO_BY_TWO
    }

    private fun developerBillingTypeConstant(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): Int? = when (developerBillingType) {
        DeveloperBillingTypeAndroid.InApp ->
            BillingProgramReportingDetailsParams.DeveloperBillingType.IN_APP
        DeveloperBillingTypeAndroid.ExternalLink ->
            BillingProgramReportingDetailsParams.DeveloperBillingType.EXTERNAL_LINK
        DeveloperBillingTypeAndroid.DeveloperBillingTypeUnspecified, null ->
            if (program == BillingProgramAndroid.BillingChoice) {
                BillingProgramReportingDetailsParams.DeveloperBillingType.IN_APP
            } else {
                null
            }
    }

    private fun billingChoiceScreenTypeFromConstant(value: Int?): BillingChoiceScreenTypeAndroid? = when (value) {
        BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.UNSPECIFIED ->
            BillingChoiceScreenTypeAndroid.Unspecified
        BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.DEVELOPER_RENDERED ->
            BillingChoiceScreenTypeAndroid.DeveloperRendered
        BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.GOOGLE_RENDERED ->
            BillingChoiceScreenTypeAndroid.GoogleRendered
        else -> null
    }

    private fun inAppMessageCategoryToConstant(category: InAppMessageCategoryAndroid): Int = when (category) {
        InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId ->
            InAppMessageParams.InAppMessageCategoryId.UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID
        InAppMessageCategoryAndroid.Transactional ->
            InAppMessageParams.InAppMessageCategoryId.TRANSACTIONAL
    }

    private fun inAppMessageResponseCodeFromConstant(value: Int?): InAppMessageResponseCodeAndroid = when (value) {
        InAppMessageResult.InAppMessageResponseCode.SUBSCRIPTION_STATUS_UPDATED ->
            InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated
        else -> InAppMessageResponseCodeAndroid.NoActionNeeded
    }

    // Billing programs queued via enableBillingProgram (8.2.0+ through Billing Choice 9.1.0+)
    private val pendingBillingPrograms = mutableSetOf<BillingProgramAndroid>()

    override val initConnection: MutationInitConnectionHandler = { config ->
        withContext(Dispatchers.IO) {
            val start = synchronized(connectionLifecycleLock) {
                if (billingClient?.isReady == true) return@withContext true
                connectionAttempt?.let { existing ->
                    return@synchronized ConnectionStart(existing, isOwner = false)
                }

                val configuredLegacyMode = config?.alternativeBillingModeAndroid
                    ?: when (defaultAlternativeBillingMode) {
                        AlternativeBillingMode.NONE -> AlternativeBillingModeAndroid.None
                        AlternativeBillingMode.USER_CHOICE -> AlternativeBillingModeAndroid.UserChoice
                        AlternativeBillingMode.ALTERNATIVE_ONLY ->
                            AlternativeBillingModeAndroid.AlternativeOnly
                    }
                val attemptedPendingPrograms = pendingBillingPrograms.toSet()
                val requestedBillingPrograms = resolveBillingProgramsForConnection(
                    attemptedPendingPrograms,
                    config?.enableBillingProgramAndroid,
                )
                if (hasLegacyBillingProgramConflict(
                        configuredLegacyMode,
                        requestedBillingPrograms,
                    )
                ) {
                    throw OpenIapError.DeveloperError(
                        "alternativeBillingModeAndroid conflicts with enableBillingProgramAndroid"
                    )
                }
                val requestedAlternativeBillingMode = when (configuredLegacyMode) {
                    AlternativeBillingModeAndroid.None ->
                        if (config?.enableBillingProgramAndroid ==
                            BillingProgramAndroid.UserChoiceBilling
                        ) {
                            AlternativeBillingMode.USER_CHOICE
                        } else {
                            AlternativeBillingMode.NONE
                        }
                    AlternativeBillingModeAndroid.UserChoice -> AlternativeBillingMode.USER_CHOICE
                    AlternativeBillingModeAndroid.AlternativeOnly ->
                        AlternativeBillingMode.ALTERNATIVE_ONLY
                }
                val configuration = BillingConnectionConfiguration(
                    alternativeBillingMode = requestedAlternativeBillingMode,
                    billingPrograms = requestedBillingPrograms.toSet(),
                    billingChoiceScreenType = config?.billingChoiceScreenTypeAndroid
                        ?.takeUnless { it == BillingChoiceScreenTypeAndroid.Unspecified }
                        ?: BillingChoiceScreenTypeAndroid.GoogleRendered,
                )
                val attempt = ConnectionAttempt(
                    connectionGeneration,
                    configuration,
                    attemptedPendingPrograms,
                )
                connectionAttempt = attempt
                ConnectionStart(attempt, isOwner = true)
            }
            val attempt = start.attempt
            if (!start.isOwner) {
                return@withContext withTimeoutOrNull(15_000) {
                    attempt.completion.await()
                } ?: false
            }
            val connectionConfiguration = attempt.configuration

            val availability = GoogleApiAvailability.getInstance()
            if (availability.isGooglePlayServicesAvailable(context) != ConnectionResult.SUCCESS) {
                finishConnectionAttempt(attempt, null, false)
                return@withContext false
            }

            val client = runCatching {
                buildBillingClient(connectionConfiguration, attempt.generation)
            }
                .getOrElse { error ->
                    OpenIapLog.w("Failed to build BillingClient: ${error.message}", TAG)
                    finishConnectionAttempt(attempt, null, false)
                    return@withContext false
                }
            val (installed, previousClient, replacedOperationFailures) = synchronized(connectionLifecycleLock) {
                if (isConnectionAttemptCurrent(
                        currentGeneration = connectionGeneration,
                        attemptGeneration = attempt.generation,
                        ownsAttempt = connectionAttempt === attempt,
                        ownsClient = true,
                    )
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
            previousClient?.takeIf { it !== client }?.let { replacedClient ->
                failPurchaseCallbackForClient(
                    replacedClient,
                    OpenIapError.ServiceDisconnected(
                        "Billing client was replaced during purchase"
                    ),
                )
                replacedClient.endConnection()
            }

            if (client.isReady) {
                finishConnectionAttempt(attempt, client, true)
                return@withContext true
            }

            val listener = object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    val connected = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!connected) {
                        OpenIapLog.w(
                            result.debugMessage.takeIf { it.isNotBlank() }
                                ?: "Billing setup failed",
                            TAG,
                        )
                    }
                    finishConnectionAttempt(attempt, client, connected)
                }

                override fun onBillingServiceDisconnected() {
                    OpenIapLog.i("Billing service disconnected", TAG)
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
                        )
                    )
                }
            }
            val startResult = synchronized(connectionLifecycleLock) {
                if (!isConnectionAttemptCurrent(
                        currentGeneration = connectionGeneration,
                        attemptGeneration = attempt.generation,
                        ownsAttempt = connectionAttempt === attempt,
                        ownsClient = billingClient === client,
                    )
                ) {
                    null
                } else {
                    runCatching { client.startConnection(listener) }
                }
            }
            if (startResult == null) {
                client.endConnection()
                attempt.completion.complete(false)
                return@withContext false
            }
            startResult.onFailure { error ->
                OpenIapLog.w("Billing startConnection failed: ${error.message}", TAG)
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
                    val activeAttempt = connectionAttempt
                    connectionAttempt = null
                    pendingBillingPrograms.clear()
                    val activePurchase = pendingPurchase
                    clearPurchaseStateLocked()
                    ConnectionEnd(
                        client = activeClient,
                        initAttempt = activeAttempt,
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
                )
                if (end.pendingPurchase != null) {
                    disconnectError.withProductId(end.pendingPurchase.requestedSkus.singleOrNull())
                    emitPurchaseError(disconnectError)
                    end.pendingPurchase.callback(Result.failure(disconnectError))
                }
                end.client?.endConnection()
            }.fold(onSuccess = { true }, onFailure = { false })
        }
    }

    private fun finishConnectionAttempt(
        attempt: ConnectionAttempt,
        expectedClient: BillingClient?,
        connected: Boolean,
    ) {
        val (ownsAttempt, clientToClose, operationFailures) = synchronized(connectionLifecycleLock) {
            val currentClient = billingClient
            val owns = isConnectionAttemptCurrent(
                currentGeneration = connectionGeneration,
                attemptGeneration = attempt.generation,
                ownsAttempt = connectionAttempt === attempt,
                ownsClient = expectedClient == null || billingClient === expectedClient,
            )
            if (owns) {
                connectionAttempt = null
                if (!connected) replaceBillingClientLocked(null)
                activeAlternativeBillingMode = commitPlayConnectionConfiguration(
                    connected,
                    pendingBillingPrograms,
                    attempt.pendingPrograms,
                    attempt.configuration.alternativeBillingMode,
                )
            }
            val close = connectionClientToClose(
                ownsAttempt = owns,
                connected = connected,
                currentClient = currentClient,
                expectedClient = expectedClient,
                expectedClientIsStale = expectedClient != null &&
                    (connectionGeneration != attempt.generation || billingClient !== expectedClient),
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

    private data class UnfetchedStatus(
        val productType: String,
        val status: ProductStatusAndroid,
    )

    private fun ProductQueryResult.unfetchedStatus(productId: String): UnfetchedStatus? =
        unfetchedProducts.firstOrNull { it.productId == productId }?.let {
            UnfetchedStatus(
                productType = it.productType,
                status = productStatusFromUnfetchedStatus(it.statusCode),
            )
        }

    private fun ProductQueryResult.toInAppProducts(skus: List<String>): List<ProductAndroid> {
        val detailsById = productDetails.associateBy { it.productId }
        return skus.map { productId ->
            detailsById[productId]?.toInAppProduct()
                ?: unavailableInAppProduct(
                    productId,
                    unfetchedStatus(productId)?.status ?: ProductStatusAndroid.Unknown,
                )
        }
    }

    private fun ProductQueryResult.toSubscriptionProducts(
        skus: List<String>,
    ): List<ProductSubscriptionAndroid> {
        val detailsById = productDetails.associateBy { it.productId }
        return skus.map { productId ->
            detailsById[productId]?.toSubscriptionProduct()
                ?: unavailableSubscriptionProduct(
                    productId,
                    unfetchedStatus(productId)?.status ?: ProductStatusAndroid.Unknown,
                )
        }
    }

    private fun unavailableAllProduct(
        productId: String,
        inAppResult: ProductQueryResult?,
        subscriptionsResult: ProductQueryResult?,
    ): ProductOrSubscription {
        val statuses = listOfNotNull(
            inAppResult?.unfetchedStatus(productId),
            subscriptionsResult?.unfetchedStatus(productId),
        )
        val noOffers = statuses.firstOrNull { it.status == ProductStatusAndroid.NoOffersAvailable }
        val selected = noOffers ?: statuses.firstOrNull()
        val status = when {
            noOffers != null -> ProductStatusAndroid.NoOffersAvailable
            inAppResult != null && subscriptionsResult != null &&
                statuses.size == 2 && statuses.all { it.status == ProductStatusAndroid.NotFound } ->
                ProductStatusAndroid.NotFound
            else -> ProductStatusAndroid.Unknown
        }

        return if (selected?.productType == BillingClient.ProductType.SUBS) {
            ProductOrSubscription.ProductSubscriptionItem(
                unavailableSubscriptionProduct(productId, status)
            )
        } else {
            ProductOrSubscription.ProductItem(unavailableInAppProduct(productId, status))
        }
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady) throw OpenIapError.NotPrepared
            if (params.skus.isEmpty()) throw OpenIapError.EmptySkuList

            val queryType = params.type ?: ProductQueryType.InApp

            when (queryType) {
                ProductQueryType.InApp -> {
                    val result = queryProductDetailsWithStatus(
                        client,
                        productManager,
                        activeOperations,
                        params.skus,
                        BillingClient.ProductType.INAPP,
                    )
                    FetchProductsResultProducts(result.toInAppProducts(params.skus))
                }
                ProductQueryType.Subs -> {
                    val result = queryProductDetailsWithStatus(
                        client,
                        productManager,
                        activeOperations,
                        params.skus,
                        BillingClient.ProductType.SUBS,
                    )
                    FetchProductsResultSubscriptions(result.toSubscriptionProducts(params.skus))
                }
                ProductQueryType.All -> {
                    val results = collectAllProductQueryResults(
                        queryInApp = {
                            queryProductDetailsWithStatus(
                                client,
                                productManager,
                                activeOperations,
                                params.skus,
                                BillingClient.ProductType.INAPP,
                            )
                        },
                        querySubscriptions = {
                            queryProductDetailsWithStatus(
                                client,
                                productManager,
                                activeOperations,
                                params.skus,
                                BillingClient.ProductType.SUBS,
                            )
                        },
                    )
                    val inAppResult = results.inApp
                    val subscriptionsResult = results.subscriptions

                    val inAppById = inAppResult?.productDetails.orEmpty().associateBy { it.productId }
                    val subscriptionsById = subscriptionsResult?.productDetails.orEmpty()
                        .associateBy { it.productId }
                    val orderedItems = params.skus.map { productId ->
                        inAppById[productId]?.let {
                            ProductOrSubscription.ProductItem(it.toInAppProduct())
                        } ?: subscriptionsById[productId]?.let {
                            ProductOrSubscription.ProductSubscriptionItem(it.toSubscriptionProduct())
                        } ?: unavailableAllProduct(productId, inAppResult, subscriptionsResult)
                    }

                    FetchProductsResultAll(orderedItems)
                }
            }
        }
    }
    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { options ->
        withContext(Dispatchers.IO) {
            val includeSuspended = options?.includeSuspendedAndroid == true
            // Always query suspended subs so the billing-issue notifier sees them even when the
            // caller asked to hide suspended from the returned list. See:
            // https://developer.android.com/google/play/billing/subscriptions#suspended
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val owner = listenerOwner(client)
            val purchases = restorePurchasesHelper(
                client,
                activeOperations,
                includeSuspended = true,
            )
            notifySuspendedSubscriptions(purchases, owner)
            if (includeSuspended) {
                purchases
            } else {
                purchases.filterNot { (it as? PurchaseAndroid)?.isSuspendedAndroid == true }
            }
        }
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val androidPurchases = queryPurchases(
                client,
                activeOperations,
                BillingClient.ProductType.SUBS,
            )
                .filterIsInstance<PurchaseAndroid>()
                .filter { it.purchaseState == PurchaseState.Purchased }
            val ids = subscriptionIds.orEmpty()
            val filtered = if (ids.isEmpty()) {
                androidPurchases
            } else {
                androidPurchases.filter { purchase ->
                    (listOf(purchase.productId) + purchase.ids.orEmpty()).any { it in ids }
                }
            }

            // Enrich purchases with basePlanId from ProductDetails
            // If not in cache, query from Google Play to ensure we have the latest data
            // First, collect all unique product IDs that need ProductDetails
            val productIdsNeedingDetails = filtered
                .map { it.productId }
                .distinct()
                .filter { productManager.get(it, BillingClient.ProductType.SUBS) == null }

            // Batch query missing ProductDetails to minimize API calls
            if (productIdsNeedingDetails.isNotEmpty()) {
                try {
                    queryProductDetails(
                        client,
                        productManager,
                        activeOperations,
                        productIdsNeedingDetails,
                        BillingClient.ProductType.SUBS
                    )
                } catch (e: OpenIapError.ServiceDisconnected) {
                    throw e
                } catch (e: Exception) {
                    OpenIapLog.w("Failed to query ProductDetails for missing products: ${e.message}", TAG)
                }
            }

            // Now enrich purchases with cached ProductDetails
            filtered.map { purchase ->
                val productDetails = productManager.get(
                    purchase.productId,
                    BillingClient.ProductType.SUBS,
                )
                val offers = productDetails?.subscriptionOfferDetails.orEmpty()
                val basePlanId = resolveBasePlanIdForOfferToken(
                    offers.map { SubscriptionBasePlanOffer(it.offerToken, it.basePlanId) },
                    requestedOfferToken = null,
                )

                // If basePlanId is available and not already set, update the purchase
                if (basePlanId != null && purchase.currentPlanId == null) {
                    purchase.copy(currentPlanId = basePlanId).toActiveSubscription()
                } else {
                    purchase.toActiveSubscription()
                }
            }
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    /**
     * Check if alternative billing is available for this user/device
     * Step 1 of alternative billing flow
     * @deprecated Use isBillingProgramAvailable with BillingProgramAndroid.ExternalOffer instead
     */
    @Deprecated("Use isBillingProgramAvailable with BillingProgramAndroid.ExternalOffer instead")
    override suspend fun checkAlternativeBillingAvailability(): Boolean = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Checking alternative billing availability...", TAG)
        val checkAvailabilityMethod = client.javaClass.getMethod(
            "isAlternativeBillingOnlyAvailableAsync",
            com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener::class.java
        )

        activeOperations.await(client) { operation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener")
            val availabilityListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyAvailabilityResponse") {
                    val result = args?.get(0) as? BillingResult
                    OpenIapLog.d("Availability check result: ${result?.responseCode} - ${result?.debugMessage}", TAG)

                    if (result?.responseCode == BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.d("✓ Alternative billing is available", TAG)
                        operation.succeed(true)
                    } else {
                        OpenIapLog.e("✗ Alternative billing not available: ${result?.debugMessage}", tag = TAG)
                        operation.succeed(false)
                    }
                }
                null
            }
            checkAvailabilityMethod.invoke(client, availabilityListener)
        }
    }

    /**
     * Show alternative billing information dialog to user
     * Step 2 of alternative billing flow
     * Must be called BEFORE processing payment
     * @deprecated Use launchExternalLink instead
     */
    @Deprecated("Use launchExternalLink instead")
    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Showing alternative billing information dialog...", TAG)
        val showDialogMethod = client.javaClass.getMethod(
            "showAlternativeBillingOnlyInformationDialog",
            android.app.Activity::class.java,
            com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener::class.java
        )

        val dialogResult = activeOperations.await(client) { operation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener")
            val dialogListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyInformationDialogResponse") {
                    val result = args?.get(0) as? BillingResult
                    OpenIapLog.d("Dialog result: ${result?.responseCode} - ${result?.debugMessage}", TAG)
                    operation.succeed(
                        result ?: billingResultError("Missing alternative billing dialog result")
                    )
                }
                null
            }
            showDialogMethod.invoke(client, activity, dialogListener)
        }

        when (dialogResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> true
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                OpenIapLog.d("User canceled information dialog", TAG)
                false
            }
            else -> {
                OpenIapLog.e("Information dialog failed: ${dialogResult.debugMessage}", tag = TAG)
                false
            }
        }
    }

    /**
     * Create external transaction token for alternative billing
     * Step 3 of alternative billing flow
     * Must be called AFTER successful payment in your payment system
     * Token must be reported to Google Play backend within 24 hours
     * @deprecated Use createBillingProgramReportingDetails with BillingProgramAndroid.ExternalOffer instead
     */
    @Deprecated("Use createBillingProgramReportingDetails with BillingProgramAndroid.ExternalOffer instead")
    override suspend fun createAlternativeBillingReportingToken(): String? = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Creating alternative billing reporting token...", TAG)
        val createTokenMethod = client.javaClass.getMethod(
            "createAlternativeBillingOnlyReportingDetailsAsync",
            com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener::class.java
        )

        activeOperations.await(client) { operation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener")
            val tokenListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyTokenResponse") {
                    val result = args?.get(0) as? BillingResult
                    val details = args?.getOrNull(1)

                    if (result?.responseCode == BillingClient.BillingResponseCode.OK && details != null) {
                        try {
                            val tokenMethod = details.javaClass.getMethod("getExternalTransactionToken")
                            val token = tokenMethod.invoke(details) as? String
                            OpenIapLog.d("✓ External transaction token created", TAG)
                            operation.succeed(token)
                        } catch (e: Exception) {
                            OpenIapLog.e("Failed to extract token: ${e.message}", e, TAG)
                            operation.succeed(null)
                        }
                    } else {
                        OpenIapLog.e("Token creation failed: ${result?.debugMessage}", tag = TAG)
                        operation.succeed(null)
                    }
                }
                null
            }
            createTokenMethod.invoke(client, tokenListener)
        }
    }

    /**
     * Check if a billing program is available for this user/device (8.2.0+)
     * This is the new API that replaces checkAlternativeBillingAvailability for external offers.
     *
     * @param program The billing program to check, including BILLING_CHOICE on 9.1.0+
     * @return Result containing availability information
     */
    override suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Checking billing program availability for: $program", TAG)

        val billingProgramConstant = billingProgramToConstant(program)

        activeOperations.await(client) { operation ->
            try {
                // Use reflection to call isBillingProgramAvailableAsync (8.2.0+)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramAvailabilityListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramAvailabilityResponse") {
                        val result = (args?.get(0) as? BillingResult)
                            ?: billingResultError("Missing Billing Program availability result")
                        OpenIapLog.d("Billing program availability result: ${result?.responseCode} - ${result?.debugMessage}", TAG)

                        val isAvailable = when (result.responseCode) {
                            BillingClient.BillingResponseCode.OK -> true
                            BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> false
                            else -> {
                                operation.fail(result.toOpenIapError())
                                return@newProxyInstance null
                            }
                        }
                        val availabilityDetails = args?.getOrNull(1)
                        val billingChoiceDetails = if (program == BillingProgramAndroid.BillingChoice && isAvailable) {
                            runCatching {
                                availabilityDetails?.javaClass
                                    ?.getMethod("getBillingChoiceAvailabilityDetails")
                                    ?.invoke(availabilityDetails)
                            }.getOrNull()
                        } else {
                            null
                        }
                        val choiceScreenType = runCatching {
                            val value = billingChoiceDetails?.javaClass
                                ?.getMethod("getChoiceScreenType")
                                ?.invoke(billingChoiceDetails) as? Int
                            billingChoiceScreenTypeFromConstant(value)
                        }.getOrNull()
                        val isExternalLinkAvailable = runCatching {
                            billingChoiceDetails?.javaClass
                                ?.getMethod("isExternalLinkAvailable")
                                ?.invoke(billingChoiceDetails) as? Boolean
                        }.getOrNull()
                        operation.succeed(
                            BillingProgramAvailabilityResultAndroid(
                                billingProgram = program,
                                isAvailable = isAvailable,
                                choiceScreenType = choiceScreenType,
                                isExternalLinkAvailable = isExternalLinkAvailable
                            )
                        )
                    }
                    null
                }

                val method = client.javaClass.getMethod(
                    "isBillingProgramAvailableAsync",
                    Int::class.javaPrimitiveType,
                    listenerClass
                )
                method.invoke(client, billingProgramConstant, listener)
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("isBillingProgramAvailableAsync not found. Requires Billing Library 8.2.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: ClassNotFoundException) {
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: Exception) {
                OpenIapLog.e("Failed to check billing program availability: ${e.message}", e, TAG)
                operation.fail(
                    OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName)
                )
            }
        }
    }

    /**
     * Create reporting details for transactions made outside of Google Play Billing (8.2.0+;
     * External Offer requires 8.2.1+).
     * This is the new API that replaces createAlternativeBillingReportingToken for external offers.
     *
     * For External Offer and External Content Link, generate fresh reporting details for every
     * session immediately before redirecting the user. Do not create or reuse a token after
     * payment has already completed.
     *
     * @param program The billing program, including BILLING_CHOICE on 9.1.0+
     * @return Reporting details containing the external transaction token
     */
    override suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Creating billing program reporting details for: $program", TAG)

        val billingProgramConstant = billingProgramToConstant(program)
        val developerBillingTypeConstant = developerBillingTypeConstant(program, developerBillingType)

        activeOperations.await(client) { operation ->
            try {
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    // Note: Callback method name is onCreateBillingProgramReportingDetailsResponse (not onBillingProgramReportingDetailsResponse)
                    if (method.name == "onCreateBillingProgramReportingDetailsResponse") {
                        val result = args?.get(0) as? BillingResult
                        val details = args?.getOrNull(1)

                        if (result?.responseCode == BillingClient.BillingResponseCode.OK && details != null) {
                            try {
                                val tokenMethod = details.javaClass.getMethod("getExternalTransactionToken")
                                val token = tokenMethod.invoke(details) as? String
                                OpenIapLog.d("Billing program reporting token created", TAG)

                                if (token != null) {
                                    operation.succeed(
                                        BillingProgramReportingDetailsAndroid(
                                            billingProgram = program,
                                            externalTransactionToken = token
                                        )
                                    )
                                } else {
                                    operation.fail(
                                        OpenIapError.PurchaseFailed("Missing external transaction token")
                                    )
                                }
                            } catch (e: Exception) {
                                OpenIapLog.e("Failed to extract token: ${e.message}", e, TAG)
                                operation.fail(
                                    OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName)
                                )
                            }
                        } else {
                            OpenIapLog.e("Reporting details creation failed: ${result?.debugMessage}", tag = TAG)
                            operation.fail(
                                result?.toOpenIapError()
                                    ?: OpenIapError.UnknownError(
                                        "Missing Billing Program reporting result"
                                    )
                            )
                        }
                    }
                    null
                }

                // BillingProgramReportingDetailsParams was added in 8.2.0.
                // External Offer requires the 8.2.1 bugfix release.
                val paramsClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsParams")
                val paramsBuilderClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder")

                val newBuilderMethod = paramsClass.getMethod("newBuilder")
                val paramsBuilder = newBuilderMethod.invoke(null)

                // Set billing program
                val setBillingProgramMethod = paramsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                setBillingProgramMethod.invoke(paramsBuilder, billingProgramConstant)

                developerBillingTypeConstant?.let { typeConstant ->
                    try {
                        val setDeveloperBillingTypeMethod = paramsBuilderClass.getMethod(
                            "setDeveloperBillingType",
                            Int::class.javaPrimitiveType
                        )
                        setDeveloperBillingTypeMethod.invoke(paramsBuilder, typeConstant)
                    } catch (e: NoSuchMethodException) {
                        OpenIapLog.e("setDeveloperBillingType not found. Requires Billing Library 9.1.0+", e, TAG)
                        throw OpenIapError.FeatureNotSupported()
                    }
                }

                // Build the params
                val buildMethod = paramsBuilderClass.getMethod("build")
                val reportingParams = buildMethod.invoke(paramsBuilder)

                // Call createBillingProgramReportingDetailsAsync with (BillingProgramReportingDetailsParams, Listener)
                val method = client.javaClass.getMethod(
                    "createBillingProgramReportingDetailsAsync",
                    paramsClass,
                    listenerClass
                )
                method.invoke(client, reportingParams, listener)
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("createBillingProgramReportingDetailsAsync not found. Requires Billing Library 8.2.0+ (8.2.1+ for External Offer)", e, TAG)
                throw OpenIapError.FeatureNotSupported(
                    "Billing program reporting details require Play Billing 8.2.0+ (8.2.1+ for External Offer)"
                )
            } catch (e: ClassNotFoundException) {
                OpenIapLog.e("BillingProgramReportingDetailsParams not found. Requires Billing Library 8.2.0+ (8.2.1+ for External Offer)", e, TAG)
                throw OpenIapError.FeatureNotSupported(
                    "Billing program reporting details require Play Billing 8.2.0+ (8.2.1+ for External Offer)"
                )
            } catch (e: OpenIapError) {
                throw e
            } catch (e: Exception) {
                OpenIapLog.e("Failed to create billing program reporting details: ${e.message}", e, TAG)
                throw OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    /**
     * Launch an external link for external offer or app download (8.2.0+)
     * This is the new API that replaces showExternalOfferInformationDialog.
     *
     * @param activity Current activity context
     * @param params Parameters for the external link
     * @return true if launch was successful, false otherwise
     */
    override suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean = withContext(Dispatchers.Main) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Launching external link: program=${params.billingProgram}, launchMode=${params.launchMode}, linkType=${params.linkType}", TAG)

        val billingProgramConstant = billingProgramToConstant(params.billingProgram)

        val launchModeConstant = when (params.launchMode) {
            ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
            ExternalLinkLaunchModeAndroid.CallerWillLaunchLink -> 2
            ExternalLinkLaunchModeAndroid.Unspecified -> throw OpenIapError.DeveloperError(
                "Cannot launch with UNSPECIFIED launch mode"
            )
        }

        val linkTypeConstant = when (params.linkType) {
            ExternalLinkTypeAndroid.LinkToDigitalContentOffer -> 1
            ExternalLinkTypeAndroid.LinkToAppDownload -> 2
            ExternalLinkTypeAndroid.Unspecified -> throw OpenIapError.DeveloperError(
                "Cannot launch with UNSPECIFIED link type"
            )
        }

        activeOperations.await(client) { operation ->
            try {
                // Build LaunchExternalLinkParams using reflection
                val paramsClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkParams")
                val builderClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkParams\$Builder")

                val newBuilderMethod = paramsClass.getMethod("newBuilder")
                val builder = newBuilderMethod.invoke(null)

                // Set billing program
                val setBillingProgramMethod = builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                setBillingProgramMethod.invoke(builder, billingProgramConstant)

                // Set launch mode
                val setLaunchModeMethod = builderClass.getMethod("setLaunchMode", Int::class.javaPrimitiveType)
                setLaunchModeMethod.invoke(builder, launchModeConstant)

                // Set link type
                val setLinkTypeMethod = builderClass.getMethod("setLinkType", Int::class.javaPrimitiveType)
                setLinkTypeMethod.invoke(builder, linkTypeConstant)

                // Set link URI
                val setLinkUriMethod = builderClass.getMethod("setLinkUri", android.net.Uri::class.java)
                setLinkUriMethod.invoke(builder, android.net.Uri.parse(params.linkUri))

                params.externalTransactionToken?.takeIf { it.isNotBlank() }?.let { token ->
                    builderClass.getMethod("setExternalTransactionToken", String::class.java)
                        .invoke(builder, token)
                }

                // Build the params
                val buildMethod = builderClass.getMethod("build")
                val launchParams = buildMethod.invoke(builder)

                // Create the response listener
                val listenerClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkResponseListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onLaunchExternalLinkResponse") {
                        val result = (args?.get(0) as? BillingResult)
                            ?: billingResultError("Missing external link launch result")
                        OpenIapLog.d("External link launch result: ${result?.responseCode} - ${result?.debugMessage}", TAG)

                        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            operation.succeed(true)
                        } else {
                            operation.fail(result.toOpenIapError())
                        }
                    }
                    null
                }

                // Call launchExternalLink
                val launchMethod = client.javaClass.getMethod(
                    "launchExternalLink",
                    android.app.Activity::class.java,
                    paramsClass,
                    listenerClass
                )
                launchMethod.invoke(client, activity, launchParams, listener)
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("launchExternalLink not found. Requires Billing Library 8.2.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: ClassNotFoundException) {
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: Exception) {
                OpenIapLog.e("Failed to launch external link: ${e.message}", e, TAG)
                operation.fail(
                    OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName)
                )
            }
        }
    }

    /**
     * Open the Google Play offer/promo code redemption page (https://play.google.com/redeem)
     * so the user can enter a code. A listener can receive the redeemed purchase while the
     * app has an active billing connection; reconcile available purchases when the app
     * resumes. Does not require the billing client to be initialized.
     *
     * @param activity Current activity context
     * @return true when the redemption flow was launched
     */
    override suspend fun openRedeemOfferCode(activity: Activity): Boolean {
        OpenIapLog.d("Opening Google Play offer code redemption page", TAG)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/redeem"))
            .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        return runCatching { activity.startActivity(intent) }
            .onFailure { OpenIapLog.w("Failed to open offer code redemption page: ${it.message}", TAG) }
            .isSuccess
    }

    /**
     * Fetch Billing Choice display information for developer-rendered choice screens (9.1.0+).
     */
    override suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        val program = billingChoiceProgramOrDefault(params.billingProgram)
        val billingProgramConstant = billingProgramToConstant(program)
        if (program != BillingProgramAndroid.BillingChoice) {
            throw OpenIapError.DeveloperError(
                "getBillingChoiceInfo only supports BILLING_CHOICE"
            )
        }

        activeOperations.await(client) { operation ->
            try {
                val paramsClass = Class.forName("com.android.billingclient.api.GetBillingChoiceInfoParams")
                val builderClass = Class.forName("com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder")

                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                    .invoke(builder, billingProgramConstant)
                builderClass.getMethod("setPlayBillingChoiceImageLayout", String::class.java)
                    .invoke(builder, billingChoiceImageLayoutConstant(params.playBillingChoiceImageLayout))
                params.userLocale?.takeIf { it.isNotBlank() }?.let { languageTag ->
                    builderClass.getMethod("setUserLocale", Locale::class.java)
                        .invoke(builder, Locale.forLanguageTag(languageTag))
                }

                val requestParams = builderClass.getMethod("build").invoke(builder)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingChoiceInfoResponseListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingChoiceInfoResponse") {
                        val result = args?.get(0) as? BillingResult
                        val choiceInfo = args?.getOrNull(1)
                        if (result?.responseCode == BillingClient.BillingResponseCode.OK && choiceInfo != null) {
                            val imageUrl = choiceInfo.javaClass
                                .getMethod("getPlayBillingChoiceImageUrl")
                                .invoke(choiceInfo) as? String
                            val loyaltyInfo = choiceInfo.javaClass
                                .getMethod("getPlayBillingLoyaltyInfo")
                                .invoke(choiceInfo) as? String

                            if (imageUrl.isNullOrBlank()) {
                                operation.fail(OpenIapError.PurchaseFailed("Missing Play Billing choice image URL"))
                            } else {
                                operation.succeed(
                                    BillingChoiceInfoAndroid(
                                        playBillingChoiceImageUrl = imageUrl,
                                        playBillingLoyaltyInfo = loyaltyInfo
                                    )
                                )
                            }
                        } else {
                            operation.fail(
                                result?.toOpenIapError()
                                    ?: OpenIapError.UnknownError(
                                        "Missing Billing Choice info result"
                                    )
                            )
                        }
                    }
                    null
                }

                client.javaClass.getMethod("getBillingChoiceInfoAsync", paramsClass, listenerClass)
                    .invoke(client, requestParams, listener)
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("getBillingChoiceInfoAsync not found. Requires Billing Library 9.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: ClassNotFoundException) {
                OpenIapLog.e("GetBillingChoiceInfoParams not found. Requires Billing Library 9.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: Exception) {
                OpenIapLog.e("Failed to get Billing Choice info: ${e.message}", e, TAG)
                operation.fail(OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName))
            }
        }
    }

    /**
     * Show the mandatory information dialog before a developer-rendered,
     * in-app Billing Choice screen (9.1.0+).
     */
    override suspend fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid = withContext(Dispatchers.Main) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        val program = billingChoiceProgramOrDefault(params.billingProgram)
        val billingProgramConstant = billingProgramToConstant(program)
        if (program != BillingProgramAndroid.BillingChoice) {
            throw OpenIapError.DeveloperError(
                "showBillingProgramInformationDialog only supports BILLING_CHOICE"
            )
        }

        activeOperations.await(client) { operation ->
            try {
                val paramsClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogParams")
                val builderClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)

                builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                    .invoke(builder, billingProgramConstant)
                builderClass.getMethod("setExternalTransactionToken", String::class.java)
                    .invoke(builder, params.externalTransactionToken)

                val requestParams = builderClass.getMethod("build").invoke(builder)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramInformationDialogResponse") {
                        val result = (args?.get(0) as? BillingResult)
                            ?: billingResultError("Missing Billing Program information dialog result")
                        operation.succeed(result.toOpenIapBillingResult())
                    }
                    null
                }

                client.javaClass.getMethod(
                    "showBillingProgramInformationDialog",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                ).invoke(client, activity, requestParams, listener)
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("showBillingProgramInformationDialog not found. Requires Billing Library 9.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: ClassNotFoundException) {
                OpenIapLog.e("BillingProgramInformationDialogParams not found. Requires Billing Library 9.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: Exception) {
                OpenIapLog.e("Failed to show Billing Program information dialog: ${e.message}", e, TAG)
                operation.fail(OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName))
            }
        }
    }

    /**
     * Show Play billing in-app messages, such as payment issues or price-change confirmations.
     */
    override suspend fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParamsAndroid?
    ): InAppMessageResultAndroid = withContext(Dispatchers.Main) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        activeOperations.await(client) { operation ->
            try {
                val paramsClass = Class.forName("com.android.billingclient.api.InAppMessageParams")
                val builderClass = Class.forName("com.android.billingclient.api.InAppMessageParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                val categories = params?.categories?.takeIf { it.isNotEmpty() }
                    ?: listOf(InAppMessageCategoryAndroid.Transactional)

                for (category in categories) {
                    builderClass.getMethod("addInAppMessageCategoryToShow", Int::class.javaPrimitiveType)
                        .invoke(builder, inAppMessageCategoryToConstant(category))
                }

                val requestParams = builderClass.getMethod("build").invoke(builder)
                val listenerClass = Class.forName("com.android.billingclient.api.InAppMessageResponseListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onInAppMessageResponse") {
                        val result = args?.get(0)
                        val responseCode = runCatching {
                            result?.javaClass?.getMethod("getResponseCode")?.invoke(result) as? Int
                        }.getOrNull()
                        val purchaseToken = runCatching {
                            result?.javaClass?.getMethod("getPurchaseToken")?.invoke(result) as? String
                        }.getOrNull()
                        operation.succeed(
                            InAppMessageResultAndroid(
                                responseCode = inAppMessageResponseCodeFromConstant(responseCode),
                                purchaseToken = purchaseToken
                            )
                        )
                    }
                    null
                }

                val submitResult = client.javaClass.getMethod(
                    "showInAppMessages",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                ).invoke(client, activity, requestParams, listener) as? BillingResult

                if (submitResult != null && submitResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    operation.fail(OpenIapError.PurchaseFailed(submitResult.debugMessage))
                }
            } catch (e: NoSuchMethodException) {
                OpenIapLog.e("showInAppMessages not found. Requires Billing Library 4.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: ClassNotFoundException) {
                OpenIapLog.e("InAppMessageParams not found. Requires Billing Library 4.1.0+", e, TAG)
                operation.fail(OpenIapError.FeatureNotSupported())
            } catch (e: Exception) {
                OpenIapLog.e("Failed to show in-app messages: ${e.message}", e, TAG)
                operation.fail(OpenIapError.PurchaseFailed(e.message ?: e.javaClass.simpleName))
            }
        }
    }

    /**
     * Enable a billing program for the next BillingClient connection (8.2.0+).
     * This should be called before initConnection to configure the BillingClient.
     *
     * @param program The billing program to enable
     */
    fun enableBillingProgram(program: BillingProgramAndroid) {
        if (program != BillingProgramAndroid.Unspecified) {
            synchronized(connectionLifecycleLock) {
                pendingBillingPrograms.add(program)
            }
            OpenIapLog.d("Billing program queued for next connection: $program", TAG)
        }
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            // requestPurchase cannot orchestrate the developer-owned payment
            // step required by the deprecated Alternative Billing Only flow.
            if (activeAlternativeBillingMode == AlternativeBillingMode.ALTERNATIVE_ONLY) {
                val error = OpenIapError.FeatureNotSupported(
                    "requestPurchase cannot run Alternative Billing Only automatically. " +
                        "Use the explicit deprecated sequence: check availability, show the " +
                        "information dialog, complete developer payment, create a reporting " +
                        "token, then report it from your backend."
                )
                emitPurchaseError(error)
                throw error
            }

            val androidArgs = props.toAndroidPurchaseArgs()
            val activity = currentActivityRef?.get() ?: fallbackActivity

            if (activity == null) {
                val err = OpenIapError.MissingCurrentActivity
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            val client = billingClient
            if (client == null || !client.isReady) {
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

            val updateSourceCount = subscriptionUpdateSourceCount(
                androidArgs.purchaseToken,
                androidArgs.originalExternalTransactionId,
            )
            if (updateSourceCount > 1) {
                val err = OpenIapError.DeveloperError(
                    "purchaseToken and originalExternalTransactionId are mutually exclusive"
                )
                emitPurchaseError(err)
                return@withContext emptyList()
            }
            if (
                androidArgs.subscriptionProductReplacementParams != null &&
                updateSourceCount != 1
            ) {
                val err = OpenIapError.DeveloperError(
                    "subscriptionProductReplacementParams requires exactly one update source"
                )
                emitPurchaseError(err)
                return@withContext emptyList()
            }

            val desiredType = if (androidArgs.type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

            suspendCancellableCoroutine<List<Purchase>> { continuation ->
                var callbackRef: ((Result<List<Purchase>>) -> Unit)? = null
                val resumer = continuation.resumeGuard {
                    callbackRef?.let { clearPurchaseCallback(client, it) }
                }
                val callback: (Result<List<Purchase>>) -> Unit = { result ->
                    result.fold(resumer::resume, resumer::resumeWithException)
                }
                fun finishWithError(error: OpenIapError, requireLaunched: Boolean = false) {
                    finishPurchaseCallback(
                        client,
                        callback,
                        Result.success(emptyList()),
                        error,
                        requireLaunched,
                    )
                }
                callbackRef = callback
                val installError = installPurchaseCallback(
                    expectedClient = client,
                    requestedSkus = androidArgs.skus.toSet(),
                    requestedProductType = desiredType,
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
                    clearPurchaseCallback(client, callback)
                    return@suspendCancellableCoroutine
                }

                fun buildAndLaunch(details: List<ProductDetails>) {
                    if (!continuation.isActive || !ownsPurchaseCallback(client, callback)) {
                        return
                    }
                    val paramsList = mutableListOf<BillingFlowParams.ProductDetailsParams>()
                    val requestedOffersBySku = mutableMapOf<String, MutableList<String>>()
                    val selectedBasePlanIdsBySku = mutableMapOf<String, String?>()

                    // Reject multi-SKU one-time purchase requests when offerToken is provided
                    // A single offerToken cannot be applied to multiple SKUs
                    if (androidArgs.type == ProductQueryType.InApp &&
                        !androidArgs.offerToken.isNullOrEmpty() &&
                        androidArgs.skus.size > 1) {
                        OpenIapLog.w(
                            "offerToken requires a single SKU. Provided SKUs: ${androidArgs.skus}",
                            TAG
                        )
                        val err = OpenIapError.SkuOfferMismatchFailure()
                        finishWithError(err)
                        return
                    }

                    if (androidArgs.type == ProductQueryType.Subs) {
                        for (offer in androidArgs.subscriptionOffers.orEmpty()) {
                            if (offer.offerToken.isNotEmpty()) {
                                OpenIapLog.d("Adding offer token for SKU ${offer.sku}", TAG)
                                val queue = requestedOffersBySku.getOrPut(offer.sku) { mutableListOf() }
                                queue.add(offer.offerToken)
                            }
                        }
                    }

                    for ((index, productDetails) in details.withIndex()) {
                        val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)

                        if (androidArgs.type == ProductQueryType.Subs) {
                            val availableOffers = productDetails.subscriptionOfferDetails?.map {
                                it.basePlanId
                            } ?: emptyList()
                            OpenIapLog.d("Available offer base plans for ${productDetails.productId}: $availableOffers", TAG)

                            val availableTokens = productDetails.subscriptionOfferDetails?.map { it.offerToken } ?: emptyList()
                            val fromQueue = requestedOffersBySku[productDetails.productId]?.let { queue ->
                                if (queue.isNotEmpty()) queue.removeAt(0) else null
                            }
                            val fromIndex = androidArgs.subscriptionOffers?.getOrNull(index)?.takeIf { it.sku == productDetails.productId }?.offerToken
                            val resolved = fromQueue ?: fromIndex ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken

                            OpenIapLog.d(
                                "Resolved offer token for ${productDetails.productId}: present=${!resolved.isNullOrEmpty()}",
                                TAG,
                            )

                            if (resolved.isNullOrEmpty() || (availableTokens.isNotEmpty() && !availableTokens.contains(resolved))) {
                                OpenIapLog.w("Invalid offer token for ${productDetails.productId}", TAG)
                                val err = OpenIapError.SkuOfferMismatchFailure()
                                finishWithError(err)
                                return
                            }

                            builder.setOfferToken(resolved)
                            selectedBasePlanIdsBySku[productDetails.productId] =
                                productDetails.subscriptionOfferDetails
                                    ?.firstOrNull { it.offerToken == resolved }
                                    ?.basePlanId

                            // Apply per-product subscription replacement params (8.1.0+)
                            androidArgs.subscriptionProductReplacementParams?.let { replacementParams ->
                                applySubscriptionProductReplacementParams(builder, replacementParams)
                            }
                        } else if (androidArgs.type == ProductQueryType.InApp && !androidArgs.offerToken.isNullOrEmpty()) {
                            // Handle one-time purchase discount offers (Android 8.0+)
                            OpenIapLog.d("Setting offer token for one-time product ${productDetails.productId}", TAG)

                            // Validate offer token exists in available one-time purchase offers
                            // Use oneTimePurchaseOfferDetailsList (Billing Library 8.0+) for discount offers
                            val oneTimePurchaseOffers = productDetails.oneTimePurchaseOfferDetailsList
                            val availableTokens = oneTimePurchaseOffers?.map { it.offerToken } ?: emptyList()

                            if (availableTokens.isEmpty()) {
                                OpenIapLog.w("No one-time purchase offers available for ${productDetails.productId}, but offerToken was provided", TAG)
                                val err = OpenIapError.SkuOfferMismatchFailure()
                                finishWithError(err)
                                return
                            }

                            if (!availableTokens.contains(androidArgs.offerToken)) {
                                OpenIapLog.w("Invalid one-time offer token for ${productDetails.productId}", TAG)
                                val err = OpenIapError.SkuOfferMismatchFailure()
                                finishWithError(err)
                                return
                            }

                            builder.setOfferToken(androidArgs.offerToken)
                        }

                        paramsList += builder.build()
                    }

                    val flowBuilder = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(paramsList)
                        .setIsOfferPersonalized(androidArgs.isOfferPersonalized == true)

                    androidArgs.obfuscatedAccountId?.let { flowBuilder.setObfuscatedAccountId(it) }

                    // Note: Alternative billing must be configured at BillingClient initialization
                    // via BillingClient.newBuilder(context).enableAlternativeBillingOnly() or
                    // enableUserChoiceBilling(). The useAlternativeBilling flag is currently
                    // informational only and requires proper BillingClient setup.
                    if (androidArgs.useAlternativeBilling == true) {
                        OpenIapLog.d("=== PURCHASE WITH ALTERNATIVE BILLING ===", TAG)
                        OpenIapLog.d("useAlternativeBilling flag: true", TAG)
                        OpenIapLog.d("Products: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("Note: Alternative billing was configured during BillingClient initialization", TAG)
                        OpenIapLog.d("If alternative billing is not working, check:", TAG)
                        OpenIapLog.d("1. Google Play Console alternative billing setup", TAG)
                        OpenIapLog.d("2. App enrollment in alternative billing program", TAG)
                        OpenIapLog.d("3. Billing Library version (6.2+ required)", TAG)
                        OpenIapLog.d("==========================================", TAG)
                    }

                    val hasSubscriptionUpdateSource =
                        !androidArgs.purchaseToken.isNullOrBlank() ||
                            !androidArgs.originalExternalTransactionId.isNullOrBlank()

                    // Subscription replacements identify the original purchase with either a
                    // Play purchase token or a developer-billing transaction ID.
                    if (androidArgs.type == ProductQueryType.Subs && hasSubscriptionUpdateSource) {
                        // This is a subscription upgrade/downgrade - do not set obfuscatedProfileId
                        OpenIapLog.d("=== Subscription Upgrade Flow ===", TAG)
                        OpenIapLog.d("  - Target SKUs: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("  - Replacement mode: ${androidArgs.replacementMode}", TAG)
                        OpenIapLog.d("  - Product Details Count: ${paramsList.size}", TAG)
                        for ((index, params) in paramsList.withIndex()) {
                            OpenIapLog.d("  - Product[$index]: SKU=${details[index].productId}, offerToken=...", TAG)
                        }

                        val updateParamsBuilder = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                        androidArgs.purchaseToken?.takeIf { it.isNotBlank() }?.let {
                            updateParamsBuilder.setOldPurchaseToken(it)
                        }
                        androidArgs.originalExternalTransactionId?.takeIf { it.isNotBlank() }?.let {
                            updateParamsBuilder.setOriginalExternalTransactionId(it)
                        }

                        // Developer-billed replacements use only the original external
                        // transaction ID unless the caller explicitly supplies a mode.
                        val replacementMode = resolveLegacySubscriptionReplacementMode(
                            androidArgs.purchaseToken,
                            androidArgs.originalExternalTransactionId,
                            androidArgs.replacementMode,
                            androidArgs.subscriptionProductReplacementParams != null
                        )
                        replacementMode?.let { mode ->
                            @Suppress("DEPRECATION")
                            updateParamsBuilder.setSubscriptionReplacementMode(mode)
                            OpenIapLog.d("  - Final replacement mode: $mode", TAG)
                        }

                        val updateParams = updateParamsBuilder.build()
                        flowBuilder.setSubscriptionUpdateParams(updateParams)
                        OpenIapLog.d("=== Subscription Update Params Set ===", TAG)
                    } else {
                        // Only set obfuscatedProfileId for new purchases, not upgrades
                        androidArgs.obfuscatedProfileId?.let {
                            OpenIapLog.d("Setting obfuscatedProfileId for new purchase", TAG)
                            flowBuilder.setObfuscatedProfileId(it)
                        }
                    }

                    // Apply developer billing option for external payments flow (8.3.0+)
                    androidArgs.developerBillingOption?.let { developerBillingOption ->
                        applyDeveloperBillingOption(flowBuilder, developerBillingOption)
                    }

                    val billingFlowParams = flowBuilder.build()

                    // BillingClient requires launchBillingFlow to run on the
                    // Android UI thread. Some SDK wrappers call from background
                    // coroutines, so match the Horizon implementation here.
                    activity.runOnUiThread {
                        if (!continuation.isActive) {
                            return@runOnUiThread
                        }
                        val launchStartedAtMillis = System.currentTimeMillis().toDouble()
                        val launchResult = launchPurchaseFlowIfOwned(
                            expectedClient = client,
                            expectedCallback = callback,
                            launchStartedAtMillis = launchStartedAtMillis,
                            selectedBasePlanIdsBySku = selectedBasePlanIdsBySku,
                        ) {
                            client.launchBillingFlow(activity, billingFlowParams)
                        } ?: return@runOnUiThread
                        launchResult.exceptionOrNull()?.let { error ->
                            val purchaseError = OpenIapError.PurchaseFailed(
                                error.message ?: "Failed to launch billing flow"
                            )
                            finishWithError(purchaseError, requireLaunched = true)
                            return@runOnUiThread
                        }
                        val result = launchResult.getOrThrow()
                        OpenIapLog.d("launchBillingFlow result: ${result.responseCode} - ${result.debugMessage}", TAG)
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            if (result.responseCode == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                                val err = OpenIapError.fromBillingResponseCode(
                                    result.responseCode,
                                    result.debugMessage
                                )
                                OpenIapLog.d("ITEM_ALREADY_OWNED received; querying owned purchases for ${androidArgs.skus}", TAG)
                                val basePlanIdsBySku = if (desiredType == BillingClient.ProductType.SUBS) {
                                    details.associate { productDetails ->
                                        val requestedOfferToken = androidArgs.subscriptionOffers
                                            ?.find { it.sku == productDetails.productId }
                                            ?.offerToken
                                        val offers = productDetails.subscriptionOfferDetails
                                            .orEmpty()
                                            .map { offer ->
                                                SubscriptionBasePlanOffer(
                                                    offerToken = offer.offerToken,
                                                    basePlanId = offer.basePlanId
                                                )
                                            }
                                        productDetails.productId to resolveBasePlanIdForOfferToken(
                                            offers,
                                            requestedOfferToken
                                        )
                                    }
                                } else {
                                    emptyMap()
                                }
                                queryAlreadyOwnedPurchases(client, desiredType, androidArgs.skus, basePlanIdsBySku) { recovered ->
                                    if (recovered.isNotEmpty()) {
                                        val pending = claimPurchaseCallback(
                                            client,
                                            callback,
                                            requireLaunched = true,
                                        ) ?: return@queryAlreadyOwnedPurchases
                                        OpenIapLog.d("Recovered ${recovered.size} already-owned purchase(s)", TAG)
                                        notifySuspendedSubscriptions(
                                            recovered,
                                            listenerOwner(pending.client, pending.generation),
                                        )
                                        for (purchase in recovered) {
                                            for (listener in purchaseUpdateListeners) {
                                                runCatching { listener.onPurchaseUpdated(purchase) }
                                            }
                                        }
                                        pending.callback(Result.success(recovered))
                                    } else {
                                        OpenIapLog.w("ITEM_ALREADY_OWNED recovery found no matching owned purchases", TAG)
                                        finishWithError(err, requireLaunched = true)
                                    }
                                }
                                return@runOnUiThread
                            }
                            if (result.responseCode == BillingClient.BillingResponseCode.DEVELOPER_ERROR) {
                                OpenIapLog.w("DEVELOPER_ERROR: Invalid arguments. Check if subscriptions are in the same group.", TAG)
                            }
                            val err = if (result.responseCode == BillingClient.BillingResponseCode.ERROR) {
                                OpenIapError.PurchaseFailed(result.debugMessage)
                            } else {
                                OpenIapError.fromBillingResponseCode(
                                    result.responseCode,
                                    result.debugMessage
                                )
                            }
                            finishWithError(err, requireLaunched = true)
                        }
                    }
                }

                // Google explicitly discourages reusing cached ProductDetails for a
                // purchase. Refresh every requested SKU immediately before building
                // BillingFlowParams so price and offer eligibility cannot be stale.
                val productIdsToQuery = androidArgs.skus.distinct()
                val productList = productIdsToQuery.map { sku ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku)
                        .setProductType(desiredType)
                        .build()
                }

                val queryParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(productList)
                    .build()

                val didHandleProductDetails = AtomicBoolean(false)
                client.queryProductDetailsAsync(queryParams) { billingResult: BillingResult, result: QueryProductDetailsResult ->
                    if (!didHandleProductDetails.compareAndSet(false, true)) return@queryProductDetailsAsync
                    val productDetailsList = result.productDetailsList
                    val ownsRequest = synchronized(connectionLifecycleLock) {
                        val owns = billingClient === client &&
                            pendingPurchase?.let {
                                it.client === client && it.callback === callback
                            } == true
                        if (owns &&
                            billingResult.responseCode == BillingClient.BillingResponseCode.OK &&
                            !productDetailsList.isNullOrEmpty()
                        ) {
                            productManager.putAll(productDetailsList)
                        }
                        owns
                    }
                    if (!continuation.isActive || !ownsRequest) {
                        return@queryProductDetailsAsync
                    }

                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && !productDetailsList.isNullOrEmpty()) {
                        val detailsBySku = productDetailsList.associateBy { it.productId }
                        val ordered = androidArgs.skus.mapNotNull { detailsBySku[it] }
                        if (ordered.size != androidArgs.skus.size) {
                            val missingSku = androidArgs.skus.firstOrNull { !detailsBySku.containsKey(it) }
                            val err = OpenIapError.SkuNotFound(missingSku ?: "")
                            finishWithError(err)
                            return@queryProductDetailsAsync
                        }
                        try {
                            buildAndLaunch(ordered)
                        } catch (error: Throwable) {
                            val purchaseError = (error as? OpenIapError
                                ?: OpenIapError.DeveloperError(
                                    error.message ?: "Invalid billing flow parameters"
                                ))
                            OpenIapLog.e(
                                "Failed to build billing flow: ${error.message}",
                                error,
                                TAG,
                            )
                            finishWithError(purchaseError)
                        }
                    } else {
                        val err = OpenIapError.QueryProduct.withDiagnostics(
                            responseCode = billingResult.responseCode,
                            debugMessage = billingResult.debugMessage,
                            productIds = productIdsToQuery,
                            productType = desiredType,
                            isEmptyProductList = productDetailsList.isNullOrEmpty()
                        )
                        finishWithError(err)
                    }
                }
            }
        }
        RequestPurchaseResultPurchases(purchases)
    }

    suspend fun getAvailableItems(type: ProductQueryType): List<Purchase> = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        val billingType = if (type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP
        queryPurchases(client, activeOperations, billingType)
    }

    override val finishTransaction: MutationFinishTransactionHandler = { purchase, isConsumable ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady) throw OpenIapError.NotPrepared
            val token = purchase.purchaseToken.orEmpty()
            if (token.isBlank()) {
                throw OpenIapError.PurchaseFailed("Missing purchase token on purchase")
            }

            val result = if (isConsumable == true) {
                val params = ConsumeParams.newBuilder().setPurchaseToken(token).build()
                activeOperations.await(client) { operation ->
                    client.consumeAsync(params) { outcome, _ ->
                        operation.succeed(outcome)
                    }
                }
            } else {
                val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()
                activeOperations.await(client) { operation ->
                    client.acknowledgePurchase(params) { outcome ->
                        operation.succeed(outcome)
                    }
                }
            }

            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                throw OpenIapError.fromBillingResponseCode(
                    result.responseCode,
                    result.debugMessage,
                )
            }
        }
    }

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchaseToken).build()
            activeOperations.await(client) { operation ->
                client.acknowledgePurchase(params) { result ->
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.w("Failed to acknowledge purchase: ${result.debugMessage}", TAG)
                        operation.succeed(false)
                    } else {
                        operation.succeed(true)
                    }
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
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.w("Failed to consume purchase: ${result.debugMessage}", TAG)
                        operation.succeed(false)
                    } else {
                        operation.succeed(true)
                    }
                }
            }
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = { options ->
        val pkg = options?.packageNameAndroid ?: context.packageName
        val uri = if (!options?.skuAndroid.isNullOrBlank()) {
            Uri.parse("https://play.google.com/store/account/subscriptions?sku=${options!!.skuAndroid}&package=$pkg")
        } else {
            Uri.parse("https://play.google.com/store/account/subscriptions?package=$pkg")
        }
        val intent = Intent(Intent.ACTION_VIEW, uri).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        context.startActivity(intent)
    }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            restorePurchasesHelper(client, activeOperations)
            Unit
        }
    }

    @Deprecated("Use verifyPurchase")
    override val validateReceipt: MutationValidateReceiptHandler = { props ->
        verifyPurchase(props)
    }

    override val verifyPurchase: MutationVerifyPurchaseHandler = { props ->
        verifyPurchaseWithGooglePlay(props, TAG)
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
        onSubscriptionBillingIssue(this::addSubscriptionBillingIssueListener, this::removeSubscriptionBillingIssueListener)
    }

    private val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler = {
        onUserChoiceBilling(this::addUserChoiceBillingListener, this::removeUserChoiceBillingListener)
    }

    private val developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler = {
        onDeveloperProvidedBilling(
            this::addDeveloperProvidedBillingListener,
            this::removeDeveloperProvidedBillingListener,
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
        openRedeemOfferCodeAndroid = {
            val activity = currentActivityRef?.get() ?: fallbackActivity
                ?: throw OpenIapError.MissingCurrentActivity
            openRedeemOfferCode(activity)
        },
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        showAlternativeBillingDialogAndroid = {
            val activity = currentActivityRef?.get() ?: fallbackActivity
                ?: throw OpenIapError.MissingCurrentActivity
            showAlternativeBillingInformationDialog(activity)
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

    // BillingClient is built lazily in initConnection() so that
    // alternativeBillingMode and billing programs can be configured
    // before the first client instance is created.

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
        if (!client.isReady) {
            emitFailureAndThrow(OpenIapError.NotPrepared, ::emitPurchaseError)
        }
        try {
            activeOperations.await(client) { operation ->
                client.getBillingConfigAsync(
                    GetBillingConfigParams.newBuilder().build(),
                    BillingConfigResponseListener { result: BillingResult, config: BillingConfig? ->
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            operation.fail(result.toOpenIapError())
                            return@BillingConfigResponseListener
                        }
                        try {
                            operation.succeed(requireAuthoritativeStorefrontCountry(config?.countryCode))
                        } catch (error: OpenIapError) {
                            operation.fail(error)
                        }
                    }
                )
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            val mapped = error as? OpenIapError
                ?: OpenIapError.ServiceUnavailable(error.message)
            OpenIapLog.w("getStorefront failed: ${mapped.message}", TAG)
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

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        userChoiceBillingListeners.add(listener)
    }

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        userChoiceBillingListeners.remove(listener)
    }

    override fun addDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {
        developerProvidedBillingListeners.add(listener)
    }

    override fun removeDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {
        developerProvidedBillingListeners.remove(listener)
    }

    override fun addSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) {
        subscriptionBillingIssueListeners.add(listener)
    }

    override fun removeSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) {
        subscriptionBillingIssueListeners.remove(listener)
    }

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: List<BillingPurchase>?,
    ) {
        val client = synchronized(connectionLifecycleLock) { billingClient } ?: return
        onPurchasesUpdated(client, listenerOwner(client), billingResult, purchases)
    }

    /**
     * Inspects the given purchases and fires `subscriptionBillingIssue` once per purchaseToken
     * whose `isSuspendedAndroid == true`. Dedupes across queries within the current session
     * via [emittedBillingIssueTokens]; re-emits only if a token clears and re-enters suspension
     * in a later session / new module instance.
     */
    private fun notifySuspendedSubscriptions(
        purchases: List<Purchase>,
        owner: ActiveStoreListenerOwner<BillingClient>,
    ) {
        if (subscriptionBillingIssueListeners.isEmpty()) return
        val candidates = purchases.mapNotNull { purchase ->
            val android = purchase as? PurchaseAndroid ?: return@mapNotNull null
            if (android.isSuspendedAndroid != true) return@mapNotNull null
            val token = android.purchaseToken ?: return@mapNotNull null
            android to token
        }
        val issues = owner.claim {
            candidates.mapNotNull { (purchase, token) ->
                purchase.takeIf { emittedBillingIssueTokens.add(token) }
            }
        }.orEmpty()

        for (android in issues) {
            for (listener in subscriptionBillingIssueListeners) {
                try {
                    listener.onSubscriptionBillingIssue(android)
                } catch (t: Throwable) {
                    OpenIapLog.e("subscriptionBillingIssue listener threw", t, TAG)
                }
            }
        }
    }

    private fun onPurchasesUpdated(
        sourceClient: BillingClient,
        owner: ActiveStoreListenerOwner<BillingClient>,
        billingResult: BillingResult,
        purchases: List<BillingPurchase>?,
    ) {
        // Snapshot the owner before mapping or notifying listeners. A listener
        // can synchronously start another purchase, and this callback must never
        // consume that newer request.
        var ownedPendingRequest: PendingPurchaseSnapshot? = null
        val ownsCallback = owner.claim {
            ownedPendingRequest = pendingPurchase?.takeIf { it.client === sourceClient }
            true
        } == true
        if (!ownsCallback) return
        val pendingRequest = ownedPendingRequest
        OpenIapLog.d("onPurchasesUpdated: code=${billingResult.responseCode} msg=${billingResult.debugMessage} count=${purchases?.size ?: 0}", TAG)
        if (purchases != null) {
            for ((index, purchase) in purchases.withIndex()) {
                OpenIapLog.d(
                    "[Purchase $index] orderId=${purchase.orderId} state=${purchase.purchaseState} autoRenew=${purchase.isAutoRenewing} acknowledged=${purchase.isAcknowledged} products=${purchase.products}",
                    TAG
                )
            }
        }

        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            // When using DEFERRED replacement mode, purchases will be null
            // This is expected behavior - the change will take effect at next renewal
            if (purchases != null) {
                val mapped = purchases.map { purchase ->
                    val firstProductId = purchase.products.firstOrNull()
                    val cached = firstProductId?.let { productManager.get(it) }
                    val matchesPendingRequest = pendingRequest != null &&
                        purchase.products.any { it in pendingRequest.requestedSkus }
                    val productType = cached?.productType
                        ?: pendingRequest?.requestedProductType?.takeIf { matchesPendingRequest }
                        // BillingClient does not expose product type on Purchase.
                        // isAutoRenewing is a safer last-resort signal than
                        // inventing type from SKU text.
                        ?: if (purchase.isAutoRenewing) {
                            BillingClient.ProductType.SUBS
                        } else {
                            BillingClient.ProductType.INAPP
                        }

                    // Extract basePlanId from ProductDetails for subscriptions
                    val basePlanId = if (productType == BillingClient.ProductType.SUBS) {
                        firstProductId?.let { productId ->
                            pendingRequest?.selectedBasePlanIdsBySku?.get(productId)
                        }
                            ?.takeIf { matchesPendingRequest }
                            ?: cached?.subscriptionOfferDetails
                                .orEmpty()
                                .singleOrNull()
                                ?.basePlanId
                    } else {
                        null
                    }

                    OpenIapLog.d("Mapping purchase products=${purchase.products} to type=$productType basePlanId=$basePlanId (cached=${cached != null})", TAG)
                    purchase.toPurchase(productType, basePlanId)
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
                // Claim the pending callback before notifying listeners so the
                // resolution below cannot race a listener that starts another
                // purchase. A failed claim means the request was completed or
                // cleared elsewhere (disconnect/endConnection); the store still
                // reported real purchases, so listener delivery must not be
                // skipped in that case.
                val completedRequest = if (matched.isNotEmpty() && pendingRequest != null) {
                    claimPurchaseCallback(
                        sourceClient,
                        pendingRequest.callback,
                        requireLaunched = true,
                    )
                } else {
                    null
                }
                OpenIapLog.d("Mapped purchases count=${mapped.size}", TAG)
                notifySuspendedSubscriptions(mapped, owner)
                for (converted in mapped) {
                    for (listener in purchaseUpdateListeners) {
                        runCatching { listener.onPurchaseUpdated(converted) }
                    }
                }
                if (completedRequest != null) {
                    completedRequest.callback(Result.success(matched))
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
                    finishPurchaseCallback(
                        sourceClient,
                        pendingRequest.callback,
                        Result.success(emptyList()),
                        requireLaunched = true,
                    )
                }
            }
        } else {
            val subResponseCode = billingResult.onPurchasesUpdatedSubResponseCode
                .toOpenIapSubResponseCode()
            when (billingResult.responseCode) {
                BillingClient.BillingResponseCode.USER_CANCELED -> {
                    val err = OpenIapError.UserCancelled(billingResult.debugMessage)
                        .withSubResponseCode(subResponseCode)
                    if (pendingRequest != null) {
                        finishPurchaseCallback(
                            sourceClient,
                            pendingRequest.callback,
                            Result.success(emptyList()),
                            err,
                            requireLaunched = true,
                        )
                    }
                }
                BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> {
                    val error = OpenIapError.fromBillingResponseCode(
                        billingResult.responseCode,
                        billingResult.debugMessage,
                        subResponseCode,
                    )
                    // Some devices surface ITEM_ALREADY_OWNED through this
                    // listener instead of the synchronous launchBillingFlow
                    // result. Mirror the synchronous recovery: query the owned
                    // purchases for the in-flight request and treat a match as
                    // success instead of failing the purchase.
                    val desiredType = pendingRequest?.requestedProductType
                    if (pendingRequest != null && desiredType != null) {
                        OpenIapLog.d(
                            "ITEM_ALREADY_OWNED received via listener; querying owned purchases for ${pendingRequest.requestedSkus}",
                            TAG,
                        )
                        queryAlreadyOwnedPurchases(
                            sourceClient,
                            desiredType,
                            pendingRequest.requestedSkus.toList(),
                            pendingRequest.selectedBasePlanIdsBySku,
                        ) { recovered ->
                            if (recovered.isNotEmpty()) {
                                val pending = claimPurchaseCallback(
                                    sourceClient,
                                    pendingRequest.callback,
                                    requireLaunched = true,
                                ) ?: return@queryAlreadyOwnedPurchases
                                OpenIapLog.d("Recovered ${recovered.size} already-owned purchase(s)", TAG)
                                notifySuspendedSubscriptions(
                                    recovered,
                                    listenerOwner(pending.client, pending.generation),
                                )
                                for (purchase in recovered) {
                                    for (listener in purchaseUpdateListeners) {
                                        runCatching { listener.onPurchaseUpdated(purchase) }
                                    }
                                }
                                pending.callback(Result.success(recovered))
                            } else {
                                OpenIapLog.w("ITEM_ALREADY_OWNED recovery found no matching owned purchases", TAG)
                                finishPurchaseCallback(
                                    sourceClient,
                                    pendingRequest.callback,
                                    Result.success(emptyList()),
                                    error,
                                    requireLaunched = true,
                                )
                            }
                        }
                    } else {
                        OpenIapLog.w("Purchase failed: code=${billingResult.responseCode} msg=${error.message}", TAG)
                        if (pendingRequest != null) {
                            finishPurchaseCallback(
                                sourceClient,
                                pendingRequest.callback,
                                Result.success(emptyList()),
                                error,
                                requireLaunched = true,
                            )
                        }
                    }
                }
                else -> {
                    val error = OpenIapError.fromBillingResponseCode(
                        billingResult.responseCode,
                        billingResult.debugMessage,
                        subResponseCode,
                    )
                    OpenIapLog.w("Purchase failed: code=${billingResult.responseCode} msg=${error.message}", TAG)
                    if (pendingRequest != null) {
                        finishPurchaseCallback(
                            sourceClient,
                            pendingRequest.callback,
                            Result.success(emptyList()),
                            error,
                            requireLaunched = true,
                        )
                    }
                }
            }
        }
    }

    private fun buildBillingClient(
        configuration: BillingConnectionConfiguration,
        sourceGeneration: Long,
    ): BillingClient {
        OpenIapLog.d("=== buildBillingClient START ===", TAG)
        OpenIapLog.d("alternativeBillingMode: ${configuration.alternativeBillingMode}", TAG)

        val clientRef = AtomicReference<BillingClient>()
        val eventOwner = listenerOwner(clientRef::get, sourceGeneration)
        val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
            clientRef.get()?.let { onPurchasesUpdated(it, eventOwner, result, purchases) }
        }
        val builder = BillingClient.newBuilder(context)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )

        enableAutoServiceReconnectionIfAvailable(builder)

        // Enable alternative billing if requested
        // This requires proper Google Play Console configuration
        when (configuration.alternativeBillingMode) {
            AlternativeBillingMode.NONE -> {
                OpenIapLog.d("Standard Google Play billing mode", TAG)
            }
            AlternativeBillingMode.USER_CHOICE -> {
                OpenIapLog.d("=== USER CHOICE BILLING INITIALIZATION ===", TAG)
                try {
                    // Try to use UserChoiceBillingListener via reflection for compatibility
                    val listenerClass = Class.forName("com.android.billingclient.api.UserChoiceBillingListener")
                    val userChoiceListener = java.lang.reflect.Proxy.newProxyInstance(
                        listenerClass.classLoader,
                        arrayOf(listenerClass)
                    ) { _, method, args ->
                        if (method.name == "userSelectedAlternativeBilling") {
                            OpenIapLog.d("=== USER SELECTED ALTERNATIVE BILLING ===", TAG)
                            val userChoiceDetails = args?.get(0)
                            OpenIapLog.d("UserChoiceDetails received (sensitive fields redacted)", TAG)

                            // Extract external transaction token and products
                            try {
                                val detailsClass = userChoiceDetails?.javaClass
                                val tokenMethod = detailsClass?.getMethod("getExternalTransactionToken")
                                val originalTransactionIdMethod = runCatching {
                                    detailsClass?.getMethod("getOriginalExternalTransactionId")
                                }.getOrNull()
                                val productsMethod = detailsClass?.getMethod("getProducts")

                                val externalToken = tokenMethod?.invoke(userChoiceDetails) as? String
                                val originalExternalTransactionId = originalTransactionIdMethod
                                    ?.invoke(userChoiceDetails) as? String
                                val products = productsMethod?.invoke(userChoiceDetails) as? List<*>

                                if (externalToken != null && products != null) {
                                    val productDetails = products.mapNotNull { product ->
                                        val productClass = product?.javaClass ?: return@mapNotNull null
                                        val id = productClass.getMethod("getId").invoke(product) as? String
                                            ?: return@mapNotNull null
                                        val type = when (productClass.getMethod("getType").invoke(product) as? String) {
                                            BillingClient.ProductType.INAPP -> ProductType.InApp
                                            BillingClient.ProductType.SUBS -> ProductType.Subs
                                            else -> return@mapNotNull null
                                        }
                                        DeveloperProvidedBillingProductAndroid(
                                            id = id,
                                            offerToken = (productClass.getMethod("getOfferToken")
                                                .invoke(product) as? String)?.takeIf { it.isNotBlank() },
                                            type = type
                                        )
                                    }
                                    val productIds = productDetails.map { it.id }
                                    OpenIapLog.d("External transaction token received", TAG)
                                    OpenIapLog.d("Products: $productIds", TAG)

                                    // Create UserChoiceBillingDetails for the event
                                    val billingDetails = dev.hyo.openiap.UserChoiceBillingDetails(
                                        externalTransactionToken = externalToken,
                                        originalExternalTransactionId = originalExternalTransactionId,
                                        productDetailsAndroid = productDetails,
                                        products = productIds
                                    )

                                    eventOwner.deliver {
                                        userChoiceBillingListener?.let { legacyListener ->
                                            try {
                                                legacyListener.onUserSelectedAlternativeBilling(
                                                    dev.hyo.openiap.listener.UserChoiceDetails(
                                                        externalTransactionToken = externalToken,
                                                        products = productIds
                                                    )
                                                )
                                            } catch (e: Exception) {
                                                OpenIapLog.w("Legacy UserChoiceBilling listener error: ${e.message}", TAG)
                                            }
                                        }

                                        for (listener in userChoiceBillingListeners) {
                                            try {
                                                listener.onUserChoiceBilling(billingDetails)
                                            } catch (e: Exception) {
                                                OpenIapLog.w("UserChoiceBilling listener error: ${e.message}", TAG)
                                            }
                                        }
                                    }
                                } else {
                                    OpenIapLog.w("Failed to extract user choice details", TAG)
                                }
                            } catch (e: Exception) {
                                OpenIapLog.e("Error processing user choice details", e, TAG)
                            }
                            OpenIapLog.d("==========================================", TAG)
                        }
                        null
                    }

                    val enableMethod = builder.javaClass.getMethod("enableUserChoiceBilling", listenerClass)
                    enableMethod.invoke(builder, userChoiceListener)
                    OpenIapLog.d("✓ User choice billing enabled successfully", TAG)
                    if (userChoiceBillingListener != null) {
                        OpenIapLog.d("✓ UserChoiceBillingListener registered", TAG)
                    } else {
                        OpenIapLog.w("⚠ No UserChoiceBillingListener provided", TAG)
                    }
                } catch (e: Exception) {
                    OpenIapLog.w("✗ Failed to enable user choice billing: ${e.javaClass.simpleName}: ${e.message}", TAG)
                    OpenIapLog.w("User choice billing requires Billing Library 7.0+ and Google Play Console setup", TAG)
                    throw e
                }
                OpenIapLog.d("=== END USER CHOICE BILLING INITIALIZATION ===", TAG)
            }
            AlternativeBillingMode.ALTERNATIVE_ONLY -> {
                OpenIapLog.d("=== ALTERNATIVE BILLING ONLY INITIALIZATION ===", TAG)

                // List all available methods on BillingClient.Builder
                try {
                    val allMethods = builder.javaClass.methods.map { it.name }.sorted()
                    OpenIapLog.d("All BillingClient.Builder methods: $allMethods", TAG)
                } catch (e: Exception) {
                    OpenIapLog.w("Could not list methods: ${e.message}", TAG)
                }

                try {
                    // For Billing Library 6.2+, try enableAlternativeBillingOnly()
                    OpenIapLog.d("Attempting to call enableAlternativeBillingOnly()...", TAG)
                    val method = builder.javaClass.getMethod("enableAlternativeBillingOnly")
                    OpenIapLog.d("Method found: $method", TAG)
                    method.invoke(builder)  // Returns void, mutates builder
                    OpenIapLog.d("✓ Alternative billing only enabled successfully", TAG)
                } catch (e: NoSuchMethodException) {
                    OpenIapLog.e("✗ enableAlternativeBillingOnly() method not found", e, TAG)
                    OpenIapLog.e("This method requires Billing Library 6.2+", tag = TAG)
                    OpenIapLog.e("Current library version: 9.1.0", tag = TAG)
                    OpenIapLog.e("Alternative billing will NOT work - standard Google Play billing will be used", tag = TAG)
                    throw e
                } catch (e: Exception) {
                    OpenIapLog.e("✗ Failed to enable alternative billing only: ${e.javaClass.simpleName}: ${e.message}", e, TAG)
                    throw e
                }
                OpenIapLog.d("=== END ALTERNATIVE BILLING ONLY INITIALIZATION ===", TAG)
            }
        }

        // Enable billing programs (8.2.0+ through Billing Choice 9.1.0+)
        if (configuration.billingPrograms.isNotEmpty()) {
            OpenIapLog.d("=== BILLING PROGRAMS INITIALIZATION ===", TAG)
            for (program in configuration.billingPrograms) {
                // USER_CHOICE_BILLING is handled via AlternativeBillingMode, skip here
                if (program == BillingProgramAndroid.UserChoiceBilling) {
                    OpenIapLog.d("✓ User Choice Billing handled via AlternativeBillingMode", TAG)
                    continue
                }

                val programConstant = when (program) {
                    BillingProgramAndroid.UserChoiceBilling -> continue // Already handled above
                    BillingProgramAndroid.Unspecified -> continue
                    else -> billingProgramToConstant(program)
                }

                val needsDeveloperListener =
                        program == BillingProgramAndroid.ExternalPayments ||
                        (program == BillingProgramAndroid.BillingChoice &&
                            configuration.billingChoiceScreenType !=
                            BillingChoiceScreenTypeAndroid.DeveloperRendered)

                if (needsDeveloperListener) {
                    try {
                        enableBillingProgramWithDeveloperListener(
                            builder,
                            program,
                            programConstant,
                            eventOwner,
                        )
                        OpenIapLog.d("✓ Billing program enabled with developer listener: $program", TAG)
                    } catch (e: NoSuchMethodException) {
                        OpenIapLog.w("✗ EnableBillingProgramParams not found for $program", TAG)
                        throw e
                    } catch (e: Exception) {
                        OpenIapLog.w("✗ Failed to enable billing program $program: ${e.message}", TAG)
                        throw e
                    }
                } else if (program == BillingProgramAndroid.BillingChoice) {
                    try {
                        enableBillingProgramWithoutDeveloperListener(builder, program, programConstant)
                        OpenIapLog.d("✓ Developer-rendered Billing Choice enabled without developer listener", TAG)
                    } catch (e: NoSuchMethodException) {
                        OpenIapLog.w("✗ EnableBillingProgramParams not found for $program", TAG)
                        throw e
                    } catch (e: Exception) {
                        OpenIapLog.w("✗ Failed to enable billing program $program: ${e.message}", TAG)
                        throw e
                    }
                } else {
                    // For other programs, use the simpler enableBillingProgram method
                    try {
                        val method = builder.javaClass.getMethod("enableBillingProgram", Int::class.javaPrimitiveType)
                        method.invoke(builder, programConstant)
                        OpenIapLog.d("✓ Billing program enabled: $program (constant=$programConstant)", TAG)
                    } catch (e: NoSuchMethodException) {
                        OpenIapLog.w("✗ enableBillingProgram not found. Requires Billing Library 8.2.0+", TAG)
                        throw e
                    } catch (e: Exception) {
                        OpenIapLog.w("✗ Failed to enable billing program $program: ${e.message}", TAG)
                        throw e
                    }
                }
            }
            OpenIapLog.d("=== END BILLING PROGRAMS INITIALIZATION ===", TAG)
        }

        OpenIapLog.d("=== buildBillingClient END ===", TAG)
        return builder.build().also(clientRef::set)
    }

    /**
     * Billing Library 8.0+ can automatically reconnect to the billing service,
     * but MAUI/Xamarin hosts can accidentally package an older BillingClient
     * through NuGet/Java dependency resolution. A direct method call would crash
     * the app with NoSuchMethodError before OpenIAP can surface a typed error.
     */
    private fun enableAutoServiceReconnectionIfAvailable(builder: BillingClient.Builder) {
        try {
            val method = builder.javaClass.getMethod("enableAutoServiceReconnection")
            method.invoke(builder)
            OpenIapLog.d("✓ Auto service reconnection enabled", TAG)
        } catch (e: NoSuchMethodException) {
            OpenIapLog.w("Auto service reconnection unavailable. Requires Billing Library 8.0+.", TAG)
        } catch (e: Throwable) {
            OpenIapLog.w("Failed to enable auto service reconnection: ${e.message}", TAG)
        }
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    /**
     * Set user choice billing listener
     *
     * @param listener User choice billing listener
     */
    override fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        userChoiceBillingListener = listener
    }

    /**
     * Set the legacy-style developer-provided billing listener for External Payments
     * (8.3.0+) and Google-rendered Billing Choice (9.1.0+).
     * @param listener Developer-provided billing listener or null to remove
     */
    override fun setDeveloperProvidedBillingListener(listener: dev.hyo.openiap.listener.DeveloperProvidedBillingListener?) {
        developerProvidedBillingListener = listener
    }

    /**
     * Apply SubscriptionProductReplacementParams to ProductDetailsParams builder using reflection.
     * This enables per-product replacement mode configuration (Billing Library 8.1.0+).
     *
     * @param builder The ProductDetailsParams.Builder to configure
     * @param params The replacement parameters containing oldProductId and replacementMode
     */
    private fun applySubscriptionProductReplacementParams(
        builder: BillingFlowParams.ProductDetailsParams.Builder,
        params: SubscriptionProductReplacementParamsAndroid
    ) {
        try {
            // Convert our enum to BillingClient SubscriptionProductReplacementParams.ReplacementMode constant
            val replacementModeConstant = params.replacementMode.toReplacementModeConstant()

            // Build SubscriptionProductReplacementParams using reflection
            // Note: SubscriptionProductReplacementParams is nested under ProductDetailsParams (Billing Library 8.1.0+)
            val replacementParamsClass = Class.forName(
                "com.android.billingclient.api.BillingFlowParams\$ProductDetailsParams\$SubscriptionProductReplacementParams"
            )
            val replacementBuilderClass = Class.forName(
                "com.android.billingclient.api.BillingFlowParams\$ProductDetailsParams\$SubscriptionProductReplacementParams\$Builder"
            )

            // Create new builder
            val newBuilderMethod = replacementParamsClass.getMethod("newBuilder")
            val replacementBuilder = newBuilderMethod.invoke(null)

            // Set old product ID
            val setOldProductIdMethod = replacementBuilderClass.getMethod("setOldProductId", String::class.java)
            setOldProductIdMethod.invoke(replacementBuilder, params.oldProductId)

            // Set replacement mode
            val setReplacementModeMethod = replacementBuilderClass.getMethod("setReplacementMode", Int::class.javaPrimitiveType)
            setReplacementModeMethod.invoke(replacementBuilder, replacementModeConstant)

            // Build the params
            val buildMethod = replacementBuilderClass.getMethod("build")
            val subscriptionReplacementParams = buildMethod.invoke(replacementBuilder)

            // Apply to ProductDetailsParams builder
            val setSubsReplacementParamsMethod = builder.javaClass.getMethod(
                "setSubscriptionProductReplacementParams",
                replacementParamsClass
            )
            setSubsReplacementParamsMethod.invoke(builder, subscriptionReplacementParams)

            OpenIapLog.d("Applied SubscriptionProductReplacementParams: oldProductId=${params.oldProductId}, mode=${params.replacementMode} (constant=$replacementModeConstant)", TAG)
        } catch (e: NoSuchMethodException) {
            OpenIapLog.w("setSubscriptionProductReplacementParams not found. Requires Billing Library 8.1.0+.", TAG)
            throw OpenIapError.FeatureNotSupported(
                "Subscription product replacement requires Play Billing 8.1.0+"
            )
        } catch (e: ClassNotFoundException) {
            OpenIapLog.w("SubscriptionProductReplacementParams class not found. Requires Billing Library 8.1.0+.", TAG)
            throw OpenIapError.FeatureNotSupported(
                "Subscription product replacement requires Play Billing 8.1.0+"
            )
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            OpenIapLog.e("Failed to apply SubscriptionProductReplacementParams: ${e.message}", e, TAG)
            throw OpenIapError.DeveloperError(
                e.message ?: "Invalid subscription product replacement parameters"
            )
        }
    }

    /**
     * Enable a billing program with DeveloperProvidedBillingListener.
     * Used by EXTERNAL_PAYMENTS (8.3.0+) and BILLING_CHOICE (9.1.0+).
     *
     * @param builder The BillingClient.Builder to configure
     */
    private fun enableBillingProgramWithDeveloperListener(
        builder: BillingClient.Builder,
        program: BillingProgramAndroid,
        programConstant: Int,
        listenerOwner: ActiveStoreListenerOwner<BillingClient>,
    ) {
        OpenIapLog.d("=== BILLING PROGRAM INITIALIZATION WITH DEVELOPER LISTENER: $program ===", TAG)

        // Create DeveloperProvidedBillingListener via reflection
        val listenerClass = Class.forName("com.android.billingclient.api.DeveloperProvidedBillingListener")
        val developerBillingListener = java.lang.reflect.Proxy.newProxyInstance(
            listenerClass.classLoader,
            arrayOf(listenerClass)
        ) { _, method, args ->
            if (method.name == "onUserSelectedDeveloperBilling") {
                OpenIapLog.d("=== USER SELECTED DEVELOPER PROVIDED BILLING ===", TAG)
                val billingDetails = args?.get(0)
                OpenIapLog.d(
                    "DeveloperProvidedBillingDetails received (sensitive fields redacted)",
                    TAG,
                )

                try {
                    val detailsClass = billingDetails?.javaClass
                    val externalToken = (detailsClass
                        ?.getMethod("getExternalTransactionToken")
                        ?.invoke(billingDetails) as? String)
                        ?.takeIf { it.isNotBlank() }
                    val linkUri = (detailsClass
                        ?.getMethod("getLinkUri")
                        ?.invoke(billingDetails) as? String)
                        ?.takeIf { it.isNotBlank() }
                    val originalExternalTransactionId = (detailsClass
                        ?.getMethod("getOriginalExternalTransactionId")
                        ?.invoke(billingDetails) as? String)
                        ?.takeIf { it.isNotBlank() }
                    val products = (detailsClass
                        ?.getMethod("getProducts")
                        ?.invoke(billingDetails) as? List<*>)
                        .orEmpty()
                        .mapNotNull { product ->
                            val productClass = product?.javaClass ?: return@mapNotNull null
                            val id = productClass.getMethod("getId").invoke(product) as? String
                                ?: return@mapNotNull null
                            val type = when (productClass.getMethod("getType").invoke(product) as? String) {
                                BillingClient.ProductType.INAPP -> ProductType.InApp
                                BillingClient.ProductType.SUBS -> ProductType.Subs
                                else -> return@mapNotNull null
                            }
                            DeveloperProvidedBillingProductAndroid(
                                id = id,
                                offerToken = (productClass.getMethod("getOfferToken")
                                    .invoke(product) as? String)?.takeIf { it.isNotBlank() },
                                type = type
                            )
                        }

                    val details = DeveloperProvidedBillingDetailsAndroid(
                        externalTransactionToken = externalToken,
                        linkUri = linkUri,
                        originalExternalTransactionId = originalExternalTransactionId,
                        products = products
                    )

                    listenerOwner.deliver {
                        developerProvidedBillingListener?.let { legacyListener ->
                            try {
                                legacyListener.onUserSelectedDeveloperBilling(
                                    dev.hyo.openiap.listener.DeveloperProvidedBillingDetails(
                                        externalTransactionToken = externalToken,
                                        linkUri = linkUri,
                                        originalExternalTransactionId = originalExternalTransactionId,
                                        products = products
                                    )
                                )
                            } catch (e: Exception) {
                                OpenIapLog.w("Legacy DeveloperProvidedBilling listener error: ${e.message}", TAG)
                            }
                        }

                        for (listener in developerProvidedBillingListeners) {
                            try {
                                listener.onDeveloperProvidedBilling(details)
                            } catch (e: Exception) {
                                OpenIapLog.w("DeveloperProvidedBilling listener error: ${e.message}", TAG)
                            }
                        }
                    }
                } catch (e: Exception) {
                    OpenIapLog.e("Error processing developer billing details", e, TAG)
                }
                OpenIapLog.d("==========================================", TAG)
            }
            null
        }

        // Build EnableBillingProgramParams
        val enableParamsClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams")
        val enableParamsBuilderClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams\$Builder")

        val newBuilderMethod = enableParamsClass.getMethod("newBuilder")
        val enableBuilder = newBuilderMethod.invoke(null)

        val setBillingProgramMethod = enableParamsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
        setBillingProgramMethod.invoke(enableBuilder, programConstant)

        // Set developer provided billing listener
        val setListenerMethod = enableParamsBuilderClass.getMethod("setDeveloperProvidedBillingListener", listenerClass)
        setListenerMethod.invoke(enableBuilder, developerBillingListener)

        // Build the params
        val buildMethod = enableParamsBuilderClass.getMethod("build")
        val enableParams = buildMethod.invoke(enableBuilder)

        // Call enableBillingProgram on builder
        val enableMethod = builder.javaClass.getMethod("enableBillingProgram", enableParamsClass)
        enableMethod.invoke(builder, enableParams)

        OpenIapLog.d("✓ DeveloperProvidedBillingListener registered", TAG)
        OpenIapLog.d("=== END BILLING PROGRAM INITIALIZATION WITH DEVELOPER LISTENER ===", TAG)
    }

    /** Enable developer-rendered Billing Choice without a selection listener. */
    private fun enableBillingProgramWithoutDeveloperListener(
        builder: BillingClient.Builder,
        program: BillingProgramAndroid,
        programConstant: Int
    ) {
        val enableParamsClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams")
        val enableParamsBuilderClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams\$Builder")
        val enableBuilder = enableParamsClass.getMethod("newBuilder").invoke(null)

        enableParamsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            .invoke(enableBuilder, programConstant)
        val enableParams = enableParamsBuilderClass.getMethod("build").invoke(enableBuilder)
        builder.javaClass.getMethod("enableBillingProgram", enableParamsClass)
            .invoke(builder, enableParams)

        OpenIapLog.d("Billing program enabled without developer listener: $program", TAG)
    }

    /**
     * Apply DeveloperBillingOptionParams to BillingFlowParams builder.
     * This enables the side-by-side choice between Google Play and developer billing.
     *
     * @param flowBuilder The BillingFlowParams.Builder to configure
     * @param params The developer billing option parameters
     */
    private fun applyDeveloperBillingOption(
        flowBuilder: BillingFlowParams.Builder,
        params: DeveloperBillingOptionParamsAndroid
    ) {
        try {
            OpenIapLog.d(
                "Applying DeveloperBillingOption: program=${params.billingProgram}, " +
                    "launchMode=${params.launchMode}, uriPresent=${!params.linkUri.isNullOrBlank()}",
                TAG,
            )

            val billingProgramConstant = billingProgramToConstant(params.billingProgram)

            val launchModeConstant = when (params.launchMode) {
                DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
                DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink -> 2
                DeveloperBillingLaunchModeAndroid.Unspecified -> throw IllegalArgumentException("Cannot use UNSPECIFIED launch mode")
                null -> null
            }

            // Build DeveloperBillingOptionParams using reflection
            val developerBillingParamsClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams")
            val developerBillingBuilderClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams\$Builder")

            val newBuilderMethod = developerBillingParamsClass.getMethod("newBuilder")
            val developerBillingBuilder = newBuilderMethod.invoke(null)

            // Set billing program
            val setBillingProgramMethod = developerBillingBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            setBillingProgramMethod.invoke(developerBillingBuilder, billingProgramConstant)

            params.linkUri?.takeIf { it.isNotBlank() }?.let { linkUri ->
                developerBillingBuilderClass.getMethod("setLinkUri", android.net.Uri::class.java)
                    .invoke(developerBillingBuilder, android.net.Uri.parse(linkUri))
            }

            launchModeConstant?.let { launchMode ->
                developerBillingBuilderClass.getMethod("setLaunchMode", Int::class.javaPrimitiveType)
                    .invoke(developerBillingBuilder, launchMode)
            }

            params.externalTransactionToken?.takeIf { it.isNotBlank() }?.let { token ->
                developerBillingBuilderClass.getMethod("setExternalTransactionToken", String::class.java)
                    .invoke(developerBillingBuilder, token)
            }

            // Build the developer billing params
            val buildMethod = developerBillingBuilderClass.getMethod("build")
            val developerBillingParams = buildMethod.invoke(developerBillingBuilder)

            // Apply to BillingFlowParams builder
            val enableDeveloperBillingMethod = flowBuilder.javaClass.getMethod(
                "enableDeveloperBillingOption",
                developerBillingParamsClass
            )
            enableDeveloperBillingMethod.invoke(flowBuilder, developerBillingParams)

            OpenIapLog.d("✓ DeveloperBillingOption applied successfully", TAG)
        } catch (e: NoSuchMethodException) {
            OpenIapLog.w("DeveloperBillingOption not found. Requires Billing Library 8.3.0+", TAG)
            throw OpenIapError.FeatureNotSupported()
        } catch (e: ClassNotFoundException) {
            OpenIapLog.w("DeveloperBillingOptionParams class not found. Requires Billing Library 8.3.0+", TAG)
            throw OpenIapError.FeatureNotSupported()
        } catch (e: Exception) {
            OpenIapLog.e("Failed to apply DeveloperBillingOption: ${e.message}", e, TAG)
            throw e
        }
    }
}
