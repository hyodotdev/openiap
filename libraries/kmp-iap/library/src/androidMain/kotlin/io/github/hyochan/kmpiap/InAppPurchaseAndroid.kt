package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.AlternativeBillingOnlyReportingDetails
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingConfig
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingProgramAvailabilityDetails
import com.android.billingclient.api.BillingProgramReportingDetailsParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.ExternalOfferReportingDetails
import com.android.billingclient.api.GetBillingChoiceInfoParams
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.UserChoiceBillingListener
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.ConnectionResult
import io.github.hyochan.kmpiap.openiap.AndroidSubscriptionOfferInput
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseLinkResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import io.github.hyochan.kmpiap.openiap.UserChoiceBillingDetails
import io.github.hyochan.kmpiap.openiap.FetchProductsResult
import io.github.hyochan.kmpiap.openiap.FetchProductsResultAll
import io.github.hyochan.kmpiap.openiap.FetchProductsResultProducts
import io.github.hyochan.kmpiap.openiap.FetchProductsResultSubscriptions
import io.github.hyochan.kmpiap.openiap.MutationDeepLinkToSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.MutationEndConnectionHandler
import io.github.hyochan.kmpiap.openiap.MutationInitConnectionHandler
import io.github.hyochan.kmpiap.openiap.MutationFinishTransactionHandler
import io.github.hyochan.kmpiap.openiap.MutationRequestPurchaseHandler
import io.github.hyochan.kmpiap.openiap.MutationHandlers
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductOrSubscription
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.ProductIOS
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseOptions
import io.github.hyochan.kmpiap.openiap.PurchaseUpdatedListenerOptions
import io.github.hyochan.kmpiap.openiap.QueryFetchProductsHandler
import io.github.hyochan.kmpiap.openiap.QueryGetActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.QueryGetAvailablePurchasesHandler
import io.github.hyochan.kmpiap.openiap.QueryHasActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.QueryHandlers
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResult
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchase
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchases
import io.github.hyochan.kmpiap.openiap.AppTransaction
import io.github.hyochan.kmpiap.openiap.SubscriptionStatusIOS
import io.github.hyochan.kmpiap.openiap.PurchaseInput
import io.github.hyochan.kmpiap.openiap.SubscriptionHandlers
import io.github.hyochan.kmpiap.Store
import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitClientPayloadFormat
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.IapkitProductClientPayload
import io.github.hyochan.kmpiap.openiap.BillingChoiceImageLayoutAndroid
import io.github.hyochan.kmpiap.openiap.BillingChoiceInfoAndroid
import io.github.hyochan.kmpiap.openiap.BillingChoiceScreenTypeAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAvailabilityResultAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramInformationDialogParamsAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramReportingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.BillingResultAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperBillingLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperBillingOptionParamsAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperBillingTypeAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperProvidedBillingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperProvidedBillingProductAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkTypeAndroid
import io.github.hyochan.kmpiap.openiap.GetBillingChoiceInfoParamsAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageCategoryAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageParamsAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageResponseCodeAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageResultAndroid
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionProductReplacementParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitAmazonProps as AndroidVerifyPurchaseWithIapkitAmazonProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps as AndroidVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps as AndroidVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.VerifyPurchaseGoogleOptions as AndroidVerifyPurchaseGoogleOptions
import dev.hyo.openiap.VerifyPurchaseProps as AndroidVerifyPurchaseProps
import dev.hyo.openiap.utils.verifyPurchaseWithGooglePlay as verifyPurchaseWithGooglePlayAndroid
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit as verifyPurchaseWithIapkitAndroid
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.collections.buildList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val KMP_IAP_LOG_TAG = "KmpIAP"
private const val PURCHASE_RESUME_FALLBACK_DELAY_MS = 2_000L
private const val PURCHASE_FOCUS_POLL_INTERVAL_MS = 500L
private const val PURCHASE_PROXY_CLOSED_FALLBACK_DELAY_MS = 1_000L
private const val PURCHASE_CALLBACK_TIMEOUT_MS = 60_000L

internal suspend fun <T> awaitBillingQueryResult(
    result: Deferred<Result<T>>,
    disconnected: Deferred<PurchaseError>,
): T = select {
    result.onAwait { it.getOrThrow() }
    disconnected.onAwait { throw PurchaseException(it) }
}

internal fun throwPurchaseRequestFailure(
    error: Throwable,
    productId: String?,
    publish: (PurchaseError) -> Unit,
): Nothing {
    val mappedError = (error as? PurchaseException)?.error ?: PurchaseError(
        code = ErrorCode.DeveloperError,
        debugMessage = error.message,
        message = error.message ?: "Invalid billing flow parameters",
    )
    val purchaseError = mappedError.takeIf { it.productId != null }
        ?: mappedError.copy(productId = productId)
    publish(purchaseError)
    throw PurchaseException(purchaseError)
}

internal fun billingProgramConfigurationException(
    program: BillingProgramAndroid,
    error: Exception,
): PurchaseException {
    if (error is PurchaseException) return error
    val cause = (error as? java.lang.reflect.InvocationTargetException)
        ?.targetException ?: error
    val unavailable = error is ClassNotFoundException || error is NoSuchMethodException
    return PurchaseException(PurchaseError(
        code = if (unavailable) ErrorCode.FeatureNotSupported else ErrorCode.ServiceError,
        debugMessage = cause.message,
        message = if (unavailable) {
            "$program is not supported by this Play Billing Library"
        } else {
            "Failed to enable $program: ${cause.message ?: cause.javaClass.simpleName}"
        },
    ))
}

private fun logWarning(message: String) {
    if (android.util.Log.isLoggable(KMP_IAP_LOG_TAG, android.util.Log.WARN)) {
        android.util.Log.w(KMP_IAP_LOG_TAG, message)
    }
}

private fun logError(message: String, throwable: Throwable) {
    if (android.util.Log.isLoggable(KMP_IAP_LOG_TAG, android.util.Log.ERROR)) {
        android.util.Log.e(KMP_IAP_LOG_TAG, message, throwable)
    }
}

internal fun isPurchaseForPendingRequest(
    transactionDateMillis: Double,
    productIds: Collection<String>,
    requestedSkus: Set<String>,
    launchStartedAtMillis: Double,
): Boolean = transactionDateMillis >= launchStartedAtMillis &&
    (requestedSkus.isEmpty() || productIds.any { it in requestedSkus })

internal fun isSubscriptionReplacementTargetCountValid(
    targetSkuCount: Int,
    hasProductLevelReplacementParams: Boolean,
): Boolean = !hasProductLevelReplacementParams || targetSkuCount == 1

internal fun resolveBillingProgramForConnection(
    requestedProgram: BillingProgramAndroid?,
): BillingProgramAndroid? = requestedProgram
    ?.takeUnless { it == BillingProgramAndroid.Unspecified }

internal fun subscriptionUpdateSourceCount(
    purchaseToken: String?,
    originalExternalTransactionId: String?,
): Int = listOf(purchaseToken, originalExternalTransactionId)
    .count { !it.isNullOrBlank() }

internal fun availablePurchasesQueryParams(
    client: BillingClient,
    productType: String,
    includeSuspendedSubscriptions: Boolean,
): QueryPurchasesParams {
    val builder = QueryPurchasesParams.newBuilder().setProductType(productType)
    if (
        productType == BillingClient.ProductType.SUBS &&
        includeSuspendedSubscriptions &&
        client.isFeatureSupported(
            BillingClient.FeatureType.INCLUDE_SUSPENDED_SUBSCRIPTIONS,
        ).responseCode == BillingClient.BillingResponseCode.OK
    ) {
        builder.includeSuspendedSubscriptions(true)
    }
    return builder.build()
}

private fun Any.invokeOptionalStringGetter(methodName: String): String? =
    runCatching { javaClass.getMethod(methodName).invoke(this) as? String }
        .getOrNull()
        ?.takeIf { it.isNotBlank() }

private fun Any.invokeOptionalListGetter(methodName: String): List<*> =
    runCatching { javaClass.getMethod(methodName).invoke(this) as? List<*> }
        .getOrNull()
        .orEmpty()

internal fun extractDeveloperProvidedBillingDetails(
    details: Any
): DeveloperProvidedBillingDetailsAndroid {
    val products = details.invokeOptionalListGetter("getProducts").mapNotNull { product ->
        product ?: return@mapNotNull null
        val id = product.invokeOptionalStringGetter("getId") ?: return@mapNotNull null
        val type = when (product.invokeOptionalStringGetter("getType")) {
            BillingClient.ProductType.INAPP -> ProductType.InApp
            BillingClient.ProductType.SUBS -> ProductType.Subs
            else -> return@mapNotNull null
        }
        DeveloperProvidedBillingProductAndroid(
            id = id,
            offerToken = product.invokeOptionalStringGetter("getOfferToken"),
            type = type
        )
    }

    return DeveloperProvidedBillingDetailsAndroid(
        externalTransactionToken = details.invokeOptionalStringGetter("getExternalTransactionToken"),
        linkUri = details.invokeOptionalStringGetter("getLinkUri"),
        originalExternalTransactionId = details.invokeOptionalStringGetter("getOriginalExternalTransactionId"),
        products = products
    )
}

private fun com.android.billingclient.api.UserChoiceDetails.toOpenIapDetails(): UserChoiceBillingDetails {
    val productDetails = products.mapNotNull { product ->
        val type = when (product.type) {
            BillingClient.ProductType.INAPP -> ProductType.InApp
            BillingClient.ProductType.SUBS -> ProductType.Subs
            else -> return@mapNotNull null
        }
        DeveloperProvidedBillingProductAndroid(
            id = product.id,
            offerToken = product.offerToken,
            type = type
        )
    }
    return UserChoiceBillingDetails(
        externalTransactionToken = externalTransactionToken,
        originalExternalTransactionId = originalExternalTransactionId,
        productDetailsAndroid = productDetails,
        products = productDetails.map { it.id }
    )
}

internal class InAppPurchaseAndroid(
    private val applicationContextProvider: () -> Context? = ::tryGetApplicationContext,
    private val redeemFlowLauncher: ((Context) -> Boolean)? = null,
) : KmpInAppPurchase {

    private data class ConnectionAttempt(
        val generation: Long,
        val billingProgram: BillingProgramAndroid?,
        val billingChoiceScreenType: BillingChoiceScreenTypeAndroid,
        val completion: CompletableDeferred<Boolean> = CompletableDeferred(),
    )

    private class PurchaseRequestLifecycle {
        val disconnectError = AtomicReference<PurchaseError?>(null)
        val disconnectSignal = CompletableDeferred<PurchaseError>()
        @Volatile
        var terminalResult: Result<List<Purchase>>? = null
        val errorPublished = AtomicBoolean(false)
    }

    private data class PendingPurchaseMetadata(
        val productType: String,
        val requestedSkus: List<String>,
        val launchStartedAtMillis: Double,
    )

    private data class ConnectionEndState(
        val client: BillingClient?,
        val initAttempt: ConnectionAttempt?,
        val pendingPurchase: PendingPurchaseOwner?,
        val billingQueries: List<BillingQueryOwner>,
        val disconnectError: PurchaseError?,
        val callbacksDisposer: (() -> Unit)?,
    )

    private data class BillingSessionTransition(
        val callbacksDisposer: (() -> Unit)?,
        val billingQueries: List<BillingQueryOwner>,
    )

    private data class PendingPurchaseOwner(
        val lifecycle: PurchaseRequestLifecycle,
        val client: BillingClient? = null,
        val callback: ((Result<List<Purchase>>) -> Unit)? = null,
        val metadata: PendingPurchaseMetadata? = null,
        val fallbackRunnable: Runnable? = null,
    )

    private class BillingQueryOwner(
        val client: BillingClient,
        val generation: Long,
    ) {
        val disconnectSignal = CompletableDeferred<PurchaseError>()
    }

    @Volatile
    private var billingClient: BillingClient? = null
    private var isConnected = false
    @Volatile
    private var context: Context? = null
    @Volatile
    private var currentActivity: Activity? = null
    private var activityCallbacksDisposer: (() -> Unit)? = null
    private var activityCallbacksGeneration: Long? = null
    private val purchaseLifecycleLock = Any()
    private var pendingPurchase: PendingPurchaseOwner? = null
    private val activeBillingQueries = mutableSetOf<BillingQueryOwner>()
    private var connectionGeneration = 0L
    private var connectionAttempt: ConnectionAttempt? = null
    private val mainHandler by lazy {
        Handler(Looper.getMainLooper())
    }

    private fun advanceBillingSessionLocked(): BillingSessionTransition {
        connectionGeneration += 1
        isConnected = false
        enabledBillingProgram = null
        billingChoiceScreenType = BillingChoiceScreenTypeAndroid.GoogleRendered
        emittedBillingIssueTokens.clear()
        currentActivity = null
        activityCallbacksGeneration = null
        val transition = BillingSessionTransition(
            callbacksDisposer = activityCallbacksDisposer,
            billingQueries = activeBillingQueries.toList(),
        )
        activityCallbacksDisposer = null
        activeBillingQueries.clear()
        return transition
    }

    private fun completeBillingSessionTransition(
        transition: BillingSessionTransition,
        error: PurchaseError,
    ) {
        transition.billingQueries.forEach { it.disconnectSignal.complete(error) }
        runCatching { transition.callbacksDisposer?.invoke() }
    }

    private fun deliverBillingSessionEvent(
        client: BillingClient?,
        generation: Long,
        deliver: () -> Unit,
    ) {
        val active = synchronized(purchaseLifecycleLock) {
            client != null && isActiveBillingSessionLocked(client, generation)
        }
        if (active) deliver()
    }

    private fun isActiveBillingSessionLocked(
        client: BillingClient,
        generation: Long,
    ): Boolean = billingClient === client &&
        connectionGeneration == generation &&
        isConnected

    private fun <T : Any> claimBillingQuery(
        owner: BillingQueryOwner,
        action: () -> T,
    ): T? = synchronized(purchaseLifecycleLock) {
        if (isActiveBillingSessionLocked(owner.client, owner.generation)) action() else null
    }

    private fun staleBillingQueryError() = PurchaseError(
        code = ErrorCode.ServiceDisconnected,
        message = "Billing connection ended before the query completed",
    )

    private suspend fun <T> awaitBillingQuery(
        expectedClient: BillingClient? = null,
        expectedGeneration: Long? = null,
        unavailableError: PurchaseError = PurchaseError(
            code = ErrorCode.NotPrepared,
            message = "BillingClient not ready",
        ),
        onError: (PurchaseError) -> Unit = {},
        captureOwner: (BillingClient, Long) -> Unit = { _, _ -> },
        start: (BillingClient, (Result<T>) -> Unit) -> Unit,
    ): T {
        val owner = synchronized(purchaseLifecycleLock) {
            billingClient?.takeIf {
                isConnected &&
                    it.isReady &&
                    (expectedClient == null || it === expectedClient) &&
                    (expectedGeneration == null || connectionGeneration == expectedGeneration)
            }?.let { client ->
                BillingQueryOwner(client, connectionGeneration).also(activeBillingQueries::add)
            }
        } ?: run {
            onError(unavailableError)
            throw PurchaseException(unavailableError)
        }
        captureOwner(owner.client, owner.generation)
        val result = CompletableDeferred<Result<T>>()
        val complete: (Result<T>) -> Unit = { value ->
            if (claimBillingQuery(owner) { result.complete(value) } == null) {
                result.complete(Result.failure(PurchaseException(staleBillingQueryError())))
            }
        }

        try {
            val startResult = claimBillingQuery(owner) {
                runCatching { start(owner.client, complete) }
            } ?: throw PurchaseException(staleBillingQueryError())
            startResult.getOrThrow()
            return awaitBillingQueryResult(result, owner.disconnectSignal)
        } catch (error: PurchaseException) {
            onError(error.error)
            throw error
        } finally {
            synchronized(purchaseLifecycleLock) { activeBillingQueries.remove(owner) }
        }
    }

    private suspend fun <T> awaitBillingQueryAndPublish(
        unavailableCode: ErrorCode = ErrorCode.ServiceDisconnected,
        expectedClient: BillingClient? = null,
        expectedGeneration: Long? = null,
        captureOwner: (BillingClient, Long) -> Unit = { _, _ -> },
        start: (BillingClient, (Result<T>) -> Unit) -> Unit,
    ): T = awaitBillingQuery(
        expectedClient = expectedClient,
        expectedGeneration = expectedGeneration,
        unavailableError = PurchaseError(
            code = unavailableCode,
            message = "Billing client is not connected",
        ),
        onError = { _purchaseErrorListener.tryEmit(it) },
        captureOwner = captureOwner,
        start = start,
    )

    private fun failBillingQueriesForClient(
        client: BillingClient,
        error: PurchaseError,
    ) {
        val owners = synchronized(purchaseLifecycleLock) {
            activeBillingQueries.filter { it.client === client }
                .also(activeBillingQueries::removeAll)
        }
        owners.forEach { it.disconnectSignal.complete(error) }
    }

    private fun endReplacedBillingClient(client: BillingClient) {
        val error = PurchaseError(
            code = ErrorCode.ServiceDisconnected,
            message = "Billing client was replaced",
        )
        failBillingQueriesForClient(client, error)
        failPendingPurchaseForClient(client, error)
        client.endConnection()
    }

    @Volatile
    private var enabledBillingProgram: BillingProgramAndroid? = null
    @Volatile
    private var billingChoiceScreenType: BillingChoiceScreenTypeAndroid =
        BillingChoiceScreenTypeAndroid.GoogleRendered

    // ---------------------------------------------------------------------
    // Event streams
    // ---------------------------------------------------------------------
    private val _purchaseUpdatedListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedListener.asSharedFlow()
    override fun purchaseUpdatedListener(options: PurchaseUpdatedListenerOptions?): Flow<Purchase> =
        purchaseUpdatedListener

    private val _purchaseErrorListener = MutableSharedFlow<PurchaseError>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorListener.asSharedFlow()

    private val _connectionStateListener = MutableSharedFlow<ConnectionResult>(replay = 1, extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val connectionStateListener: Flow<ConnectionResult> = _connectionStateListener.asSharedFlow()

    private val _promotedProductListener = MutableSharedFlow<String?>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val promotedProductListener: Flow<String?> = _promotedProductListener.asSharedFlow()

    private val _userChoiceBillingListener = MutableSharedFlow<UserChoiceBillingDetails>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val userChoiceBillingListener: Flow<UserChoiceBillingDetails> = _userChoiceBillingListener.asSharedFlow()

    private val _developerProvidedBillingListener = MutableSharedFlow<DeveloperProvidedBillingDetailsAndroid>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val developerProvidedBillingListener: Flow<DeveloperProvidedBillingDetailsAndroid> = _developerProvidedBillingListener.asSharedFlow()

    private val _subscriptionBillingIssueListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val subscriptionBillingIssueListener: Flow<Purchase> = _subscriptionBillingIssueListener.asSharedFlow()

    private fun failWith(error: PurchaseError): Nothing =
        emitFailureAndThrow(_purchaseErrorListener, error)

    // ---------------------------------------------------------------------
    // Mutation handlers
    // ---------------------------------------------------------------------
    private val initConnectionHandler: MutationInitConnectionHandler = { config ->
        withContext(Dispatchers.IO) {
            val inFlight = synchronized(purchaseLifecycleLock) {
                if (isConnected && billingClient?.isReady == true) {
                    return@withContext true
                }
                connectionAttempt
            }
            if (inFlight != null) {
                return@withContext withTimeoutOrNull(15_000) {
                    inFlight.completion.await()
                } ?: false
            }

            val configuredProgram = config?.enableBillingProgramAndroid
            val requestedProgram = resolveBillingProgramForConnection(configuredProgram)
            val requestedBillingChoiceScreenType = config?.billingChoiceScreenTypeAndroid
                ?.takeUnless { it == BillingChoiceScreenTypeAndroid.Unspecified }
                ?: BillingChoiceScreenTypeAndroid.GoogleRendered
            var previousClient: BillingClient? = null
            val (attempt, isOwner, previousTransition) =
                synchronized(purchaseLifecycleLock) {
                    if (isConnected && billingClient?.isReady == true) {
                        return@withContext true
                    }
                    connectionAttempt?.let { existing ->
                        Triple(existing, false, null)
                    } ?: run {
                        previousClient = billingClient
                        val transition = advanceBillingSessionLocked()
                        val created = ConnectionAttempt(
                            generation = connectionGeneration,
                            billingProgram = requestedProgram,
                            billingChoiceScreenType = requestedBillingChoiceScreenType,
                        )
                        connectionAttempt = created
                        Triple(created, true, transition)
                    }
                }
            val replacedError = PurchaseError(
                code = ErrorCode.ServiceDisconnected,
                message = "Billing client was replaced",
            )
            previousTransition?.let {
                completeBillingSessionTransition(it, replacedError)
            }
            previousClient?.let { failPendingPurchaseForClient(it, replacedError) }
            if (!isOwner) {
                return@withContext withTimeoutOrNull(15_000) {
                    attempt.completion.await()
                } ?: false
            }

            var connectingClient: BillingClient? = null
            try {
                val shouldCaptureApplication = synchronized(purchaseLifecycleLock) {
                    connectionAttempt === attempt &&
                        connectionGeneration == attempt.generation &&
                        activityCallbacksDisposer == null
                }
                if (shouldCaptureApplication) {
                    var capturedContext: Context? = null
                    var capturedActivity: Activity? = null
                    val callbacks = activityLifecycleCallbacks(attempt.generation)
                    val disposer = tryCaptureApplication(
                        callback = callbacks,
                        onContextAvailable = { appContext -> capturedContext = appContext },
                        onActivityFound = { activity -> capturedActivity = activity },
                    )
                    val installed = synchronized(purchaseLifecycleLock) {
                        if (
                            connectionAttempt !== attempt ||
                            connectionGeneration != attempt.generation ||
                            activityCallbacksDisposer != null
                        ) {
                            false
                        } else {
                            capturedContext?.let { context = it }
                            capturedActivity?.let { currentActivity = it }
                            if (disposer != null) {
                                activityCallbacksDisposer = disposer
                                activityCallbacksGeneration = attempt.generation
                            }
                            true
                        }
                    }
                    if (!installed) {
                        runCatching { disposer?.invoke() }
                    }
                }

                val ctx = synchronized(purchaseLifecycleLock) {
                    context.takeIf {
                        connectionAttempt === attempt &&
                            connectionGeneration == attempt.generation
                    }
                } ?: run {
                    throw PurchaseException(
                        PurchaseError(code = ErrorCode.ServiceError, message = "Context not available")
                    )
                }

                lateinit var client: BillingClient
                val clientRef = AtomicReference<BillingClient?>()
                val listener = object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        val connected = result.responseCode == BillingClient.BillingResponseCode.OK
                        val owned = finishConnectionAttempt(attempt, client, connected)
                        if (!connected && owned) {
                            _purchaseErrorListener.tryEmit(
                                PurchaseError(
                                    code = ErrorCode.ServiceError,
                                    debugMessage = result.debugMessage.takeIf { it.isNotBlank() },
                                    message = result.debugMessage.takeIf { it.isNotBlank() }
                                        ?: "Failed to connect"
                                )
                            )
                        }
                    }

                    override fun onBillingServiceDisconnected() =
                        handleBillingServiceDisconnected(attempt, client)
                }

                val builder = BillingClient.newBuilder(ctx)
                    .setListener { billingResult, purchases ->
                        val sourceClient = clientRef.get() ?: return@setListener
                        deliverBillingSessionEvent(sourceClient, attempt.generation) {
                            handlePurchaseUpdate(sourceClient, billingResult, purchases)
                        }
                    }

                requestedProgram?.let { program ->
                    if (
                        program == BillingProgramAndroid.ExternalPayments ||
                        program == BillingProgramAndroid.BillingChoice
                    ) {
                        enableDeveloperProvidedBillingProgram(
                            builder,
                            program,
                            includeDeveloperListener =
                                program == BillingProgramAndroid.ExternalPayments ||
                                    requestedBillingChoiceScreenType !=
                                    BillingChoiceScreenTypeAndroid.DeveloperRendered,
                            sourceClient = clientRef::get,
                            sourceGeneration = attempt.generation,
                        )
                    } else {
                        enableBillingProgram(
                            builder,
                            program,
                            clientRef::get,
                            attempt.generation,
                        )
                    }
                }

                client = enablePendingPurchasesCompat(builder).build()
                clientRef.set(client)
                connectingClient = client
                val (installed, previousClient) = synchronized(purchaseLifecycleLock) {
                    if (
                        connectionAttempt === attempt &&
                        connectionGeneration == attempt.generation
                    ) {
                        val previous = billingClient
                        billingClient = client
                        true to previous
                    } else {
                        false to null
                    }
                }
                if (!installed) {
                    client.endConnection()
                    attempt.completion.complete(false)
                    return@withContext false
                }
                previousClient?.takeIf { it !== client }?.let { previous ->
                    endReplacedBillingClient(previous)
                }

                val startResult = synchronized(purchaseLifecycleLock) {
                    if (
                        connectionAttempt !== attempt ||
                        connectionGeneration != attempt.generation ||
                        billingClient !== client
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
                    logError("Failed to start billing connection", error)
                    finishConnectionAttempt(attempt, client, false)
                }

                val connected = withTimeoutOrNull(15_000) {
                    attempt.completion.await()
                }
                if (connected == null) {
                    abortConnectionAttempt(attempt, client)
                    false
                } else {
                    connected
                }
            } catch (error: Throwable) {
                abortConnectionAttempt(attempt, connectingClient)
                throw error
            }
        }
    }

    private val endConnectionHandler: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            runCatching {
                val endState = synchronized(purchaseLifecycleLock) {
                    val transition = advanceBillingSessionLocked()
                    val activeClient = billingClient
                    val activeAttempt = connectionAttempt
                    billingClient = null
                    connectionAttempt = null
                    isConnected = false
                    val owner = pendingPurchase
                    val disconnectError = owner?.let {
                        PurchaseError(
                            code = ErrorCode.ServiceDisconnected,
                            debugMessage =
                                "Billing connection ended while a purchase request was in progress",
                            message = "Billing service disconnected",
                            productId = it.metadata?.requestedSkus?.singleOrNull(),
                        )
                    }
                    if (owner != null && disconnectError != null) {
                        val failure = Result.failure<List<Purchase>>(
                            PurchaseException(disconnectError)
                        )
                        owner.lifecycle.disconnectError.compareAndSet(null, disconnectError)
                        if (owner.lifecycle.terminalResult == null) {
                            owner.lifecycle.terminalResult = failure
                        }
                    }
                    pendingPurchase = null
                    ConnectionEndState(
                        client = activeClient,
                        initAttempt = activeAttempt,
                        pendingPurchase = owner,
                        billingQueries = transition.billingQueries,
                        disconnectError = disconnectError,
                        callbacksDisposer = transition.callbacksDisposer,
                    )
                }
                val queryError = staleBillingQueryError()
                endState.billingQueries.forEach {
                    it.disconnectSignal.complete(queryError)
                }
                val fallbackCleared = runCatching {
                    endState.pendingPurchase?.fallbackRunnable
                        ?.let(mainHandler::removeCallbacks)
                }.isSuccess
                val callbacksDisposed = runCatching {
                    endState.callbacksDisposer?.invoke()
                }.isSuccess
                endState.initAttempt?.completion?.complete(false)
                val owner = endState.pendingPurchase
                val disconnectError = endState.disconnectError
                if (owner != null && disconnectError != null) {
                    publishTerminalPurchaseError(owner.lifecycle, disconnectError)
                    owner.lifecycle.disconnectSignal.complete(disconnectError)
                    owner.callback?.invoke(checkNotNull(owner.lifecycle.terminalResult))
                }
                endState.client?.endConnection()
                _connectionStateListener.tryEmit(ConnectionResult(connected = false, message = "Disconnected"))
                fallbackCleared && callbacksDisposed
            }.getOrElse { false }
        }
    }

    private fun finishConnectionAttempt(
        attempt: ConnectionAttempt,
        expectedClient: BillingClient,
        connected: Boolean,
    ): Boolean {
        val (ownsAttempt, clientToClose, transition) = synchronized(purchaseLifecycleLock) {
            val owns = connectionAttempt === attempt &&
                connectionGeneration == attempt.generation &&
                billingClient === expectedClient
            var sessionTransition: BillingSessionTransition? = null
            if (owns) {
                connectionAttempt = null
                isConnected = connected
                if (connected) {
                    enabledBillingProgram = attempt.billingProgram
                    billingChoiceScreenType = attempt.billingChoiceScreenType
                } else {
                    billingClient = null
                    sessionTransition = advanceBillingSessionLocked()
                }
            }
            val stale = !owns &&
                (connectionGeneration != attempt.generation || billingClient !== expectedClient)
            Triple(
                owns,
                expectedClient.takeIf { (owns && !connected) || stale },
                sessionTransition,
            )
        }
        transition?.let {
            completeBillingSessionTransition(
                it,
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Billing connection failed",
                ),
            )
        }
        clientToClose?.let { closingClient ->
            failPendingPurchaseForClient(
                closingClient,
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Billing connection failed during purchase",
                ),
            )
            closingClient.endConnection()
        }
        if (!ownsAttempt) {
            attempt.completion.complete(false)
            return false
        }
        if (connected) {
            _connectionStateListener.tryEmit(
                ConnectionResult(connected = true, message = "Connected")
            )
        }
        attempt.completion.complete(connected)
        return true
    }

    private fun handleBillingServiceDisconnected(
        attempt: ConnectionAttempt,
        client: BillingClient,
    ) {
        val disconnectState = synchronized(purchaseLifecycleLock) {
            if (
                billingClient !== client ||
                connectionGeneration != attempt.generation
            ) {
                return
            }
            val setupPending = connectionAttempt === attempt
            setupPending to if (setupPending) null else advanceBillingSessionLocked()
        }
        val error = PurchaseError(
            code = ErrorCode.ServiceDisconnected,
            message = "Billing service disconnected",
        )
        disconnectState.second?.let { completeBillingSessionTransition(it, error) }
        if (disconnectState.first) finishConnectionAttempt(attempt, client, false)
        _connectionStateListener.tryEmit(
            ConnectionResult(connected = false, message = "Disconnected")
        )
        failPendingPurchaseForClient(
            client,
            error.copy(debugMessage = "Billing service disconnected during purchase"),
        )
    }

    private fun abortConnectionAttempt(
        attempt: ConnectionAttempt,
        expectedClient: BillingClient?,
    ) {
        val (clientToClose, transition) = synchronized(purchaseLifecycleLock) {
            if (connectionAttempt !== attempt) return@synchronized null to null
            connectionAttempt = null
            isConnected = false
            val current = billingClient
            if (expectedClient == null || current === expectedClient) {
                billingClient = null
            }
            (expectedClient ?: current) to advanceBillingSessionLocked()
        }
        transition?.let {
            completeBillingSessionTransition(
                it,
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Billing connection aborted",
                ),
            )
        }
        clientToClose?.let { closingClient ->
            failPendingPurchaseForClient(
                closingClient,
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Billing connection aborted during purchase",
                ),
            )
            closingClient.endConnection()
        }
        attempt.completion.complete(false)
    }

    private val requestPurchaseHandler: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.Main) {
            if (enabledBillingProgram == BillingProgramAndroid.ExternalOffer) {
                failWith(
                    PurchaseError(
                        code = ErrorCode.FeatureNotSupported,
                        message =
                            "requestPurchase cannot run the external-offer program automatically. " +
                                "Use isBillingProgramAvailableAndroid, launchExternalLinkAndroid, " +
                                "and createBillingProgramReportingDetailsAndroid.",
                    )
                )
            }
            val resolvedType = props.type

            val purchaseRequest = (props.request as? RequestPurchaseProps.Request.Purchase)?.value
            val subscriptionRequest = (props.request as? RequestPurchaseProps.Request.Subscription)?.value
            val purchaseAndroidOptions = purchaseRequest?.google
            val subscriptionAndroidOptions = subscriptionRequest?.google

            val subscriptionOffers: List<AndroidSubscriptionOfferInput> =
                subscriptionAndroidOptions?.subscriptionOffers.orEmpty()

            val purchaseToken = subscriptionAndroidOptions?.purchaseToken
            val originalExternalTransactionId = subscriptionAndroidOptions?.originalExternalTransactionId
            val subscriptionProductReplacementParams = subscriptionAndroidOptions?.subscriptionProductReplacementParams

            val targetSkus: List<String> =
                purchaseAndroidOptions?.skus ?: subscriptionAndroidOptions?.skus ?: emptyList()

            val isOfferPersonalized = purchaseAndroidOptions?.isOfferPersonalized
                ?: subscriptionAndroidOptions?.isOfferPersonalized
            val obfuscatedAccountId = purchaseAndroidOptions?.obfuscatedAccountId
                ?: subscriptionAndroidOptions?.obfuscatedAccountId
            val obfuscatedProfileId = purchaseAndroidOptions?.obfuscatedProfileId
                ?: subscriptionAndroidOptions?.obfuscatedProfileId
            // offerToken for one-time purchase discounts (Android 8.0+)
            val oneTimePurchaseOfferToken = purchaseAndroidOptions?.offerToken
            val developerBillingOption = purchaseAndroidOptions?.developerBillingOption
                ?: subscriptionAndroidOptions?.developerBillingOption
            if (targetSkus.isEmpty()) {
                failWith(
                    PurchaseError(code = ErrorCode.EmptySkuList, message = "SKU list is empty")
                )
            }

            if (!isSubscriptionReplacementTargetCountValid(
                    targetSkuCount = targetSkus.size,
                    hasProductLevelReplacementParams =
                        subscriptionProductReplacementParams != null,
                )
            ) {
                failWith(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message =
                            "subscriptionProductReplacementParams requires exactly one target SKU",
                    )
                )
            }

            val updateSourceCount = subscriptionUpdateSourceCount(
                purchaseToken,
                originalExternalTransactionId,
            )
            if (updateSourceCount > 1) {
                failWith(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message =
                            "purchaseToken and originalExternalTransactionId are mutually exclusive",
                    )
                )
            }
            if (
                subscriptionProductReplacementParams != null &&
                updateSourceCount != 1
            ) {
                failWith(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message =
                            "subscriptionProductReplacementParams requires exactly one update source",
                    )
                )
            }

            if (subscriptionProductReplacementParams != null &&
                BuildConfig.OPENIAP_STORE.lowercase() != "play"
            ) {
                failWith(
                    PurchaseError(
                        code = ErrorCode.FeatureNotSupported,
                        message =
                            "subscriptionProductReplacementParams is only supported by Google Play",
                    )
                )
            }

            val activity = currentActivity
            if (activity == null) {
                failWith(
                    PurchaseError(code = ErrorCode.ActivityUnavailable, message = "Activity not available for purchase")
                )
            }

            val client = billingClient
            if (client == null || !client.isReady) {
                failWith(
                    PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready")
                )
            }

            val requestLifecycle = PurchaseRequestLifecycle()
            val lifecycleInstallError = synchronized(purchaseLifecycleLock) {
                when {
                    billingClient !== client || !isConnected || !client.isReady -> PurchaseError(
                        code = ErrorCode.ServiceDisconnected,
                        message = "Billing service disconnected before purchase could start"
                    )
                    pendingPurchase != null -> PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message = "Another purchase is already in progress"
                    )
                    else -> {
                        pendingPurchase = PendingPurchaseOwner(requestLifecycle, client)
                        null
                    }
                }
            }
            if (lifecycleInstallError != null) {
                failWith(lifecycleInstallError)
            }

            var expectedCallback: ((Result<List<Purchase>>) -> Unit)? = null
            var launchStartedAtMillis: Double? = null
            val didLaunchBillingFlow = AtomicBoolean(false)
            try {

            val desiredProductType =
                if (resolvedType == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

            val productDetailsBySku = loadProductDetails(
                client = client,
                productType = desiredProductType,
                skus = targetSkus,
                disconnectSignal = requestLifecycle.disconnectSignal,
            )

            requestLifecycle.disconnectError.get()?.let { throw PurchaseException(it) }

            // Guard: oneTimePurchaseOfferToken requires exactly one SKU
            if (desiredProductType == BillingClient.ProductType.INAPP &&
                oneTimePurchaseOfferToken != null &&
                targetSkus.size > 1
            ) {
                throw PurchaseException(
                    PurchaseError(
                        code = ErrorCode.SkuOfferMismatch,
                        message = "oneTimePurchaseOfferToken requires a single in-app SKU",
                    ),
                )
            }

            withTimeoutOrNull(PURCHASE_CALLBACK_TIMEOUT_MS) {
                suspendCancellableCoroutine<List<Purchase>> { continuation ->
                val callback: (Result<List<Purchase>>) -> Unit = { result ->
                    if (continuation.isActive) {
                        result.fold(
                            onSuccess = { continuation.resume(it) },
                            onFailure = { continuation.resumeWithException(it) }
                        )
                    }
                }
                expectedCallback = callback
                val terminalResult = attachPurchaseCallback(requestLifecycle, callback)
                if (terminalResult != null) {
                    callback(terminalResult)
                    return@suspendCancellableCoroutine
                }

                requestLifecycle.disconnectError.get()?.let { disconnectError ->
                    completePendingPurchaseFlow(
                        callback,
                        Result.failure(PurchaseException(disconnectError))
                    )
                    return@suspendCancellableCoroutine
                }

                val paramsList = mutableListOf<BillingFlowParams.ProductDetailsParams>()
                val offersBySku = subscriptionOffers
                    .groupBy(AndroidSubscriptionOfferInput::sku)
                    .mapValues { entry -> entry.value.toMutableList() }
                    .toMutableMap()

                var mismatch = false
                for (sku in targetSkus) {
                    val detail = productDetailsBySku[sku] ?: continue
                    val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(detail)

                    if (desiredProductType == BillingClient.ProductType.SUBS) {
                        val availableTokens = detail.subscriptionOfferDetails?.map { it.offerToken }.orEmpty()
                        val queuedToken = offersBySku[detail.productId]?.takeIf { it.isNotEmpty() }?.removeAt(0)?.offerToken
                        val resolvedToken = queuedToken ?: detail.subscriptionOfferDetails?.firstOrNull()?.offerToken

                        if (resolvedToken.isNullOrEmpty() || (availableTokens.isNotEmpty() && !availableTokens.contains(resolvedToken))) {
                            failPendingPurchaseFlow(
                                requestLifecycle,
                                callback,
                                PurchaseError(
                                    code = ErrorCode.SkuOfferMismatch,
                                    message = "Offer token mismatch for ${detail.productId}",
                                ),
                            )
                            mismatch = true
                            break
                        }

                        // Apply item-level subscription replacement params (8.1.0+)
                        subscriptionProductReplacementParams?.let { params ->
                            val replacementParamsBuilder = BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.newBuilder()
                                .setOldProductId(params.oldProductId)
                            mapReplacementMode(params.replacementMode)?.let { mode ->
                                replacementParamsBuilder.setReplacementMode(mode)
                            }
                            builder.setSubscriptionProductReplacementParams(replacementParamsBuilder.build())
                        }

                        if (subscriptionProductReplacementParams?.replacementMode != SubscriptionReplacementModeAndroid.KeepExisting) {
                            builder.setOfferToken(resolvedToken)
                        }
                    } else {
                        // Handle offerToken for one-time purchase discounts (Android 8.0+)
                        oneTimePurchaseOfferToken?.let { token ->
                            builder.setOfferToken(token)
                        }
                    }

                    paramsList += builder.build()
                }

                if (mismatch) return@suspendCancellableCoroutine

                val flowBuilder = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(paramsList)

                if (isOfferPersonalized == true) {
                    flowBuilder.setIsOfferPersonalized(true)
                }
                obfuscatedAccountId?.let { accountId ->
                    flowBuilder.setObfuscatedAccountId(accountId)
                }
                obfuscatedProfileId?.let { profileId ->
                    flowBuilder.setObfuscatedProfileId(profileId)
                }

                val hasSubscriptionUpdateSource =
                    !purchaseToken.isNullOrEmpty() || !originalExternalTransactionId.isNullOrEmpty()
                if (desiredProductType == BillingClient.ProductType.SUBS && hasSubscriptionUpdateSource) {
                    val updateParamsBuilder = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                    purchaseToken?.takeIf { it.isNotEmpty() }?.let {
                        updateParamsBuilder.setOldPurchaseToken(it)
                    }
                    originalExternalTransactionId?.takeIf { it.isNotEmpty() }?.let {
                        updateParamsBuilder.setOriginalExternalTransactionId(it)
                    }
                    val replacementMode = resolveSubscriptionReplacementMode(
                        purchaseToken = purchaseToken,
                        originalExternalTransactionId = originalExternalTransactionId,
                        hasProductLevelReplacementParams = subscriptionProductReplacementParams != null
                    )
                    replacementMode?.let { mode ->
                        @Suppress("DEPRECATION")
                        updateParamsBuilder.setSubscriptionReplacementMode(mode)
                    }
                    flowBuilder.setSubscriptionUpdateParams(updateParamsBuilder.build())
                }

                // Apply the developer billing option for External Payments (8.3.0+) or Billing Choice (9.1.0+)
                developerBillingOption?.let { option ->
                    applyDeveloperBillingOption(flowBuilder, option)
                }

                if (!continuation.isActive ||
                    !ownsPendingPurchaseRequest(requestLifecycle, callback)
                ) {
                    abandonPendingPurchaseFlow(requestLifecycle, callback)
                    return@suspendCancellableCoroutine
                }
                val requestLaunchTimestampMillis = System.currentTimeMillis().toDouble()
                launchStartedAtMillis = requestLaunchTimestampMillis
                val pendingSnapshot = PendingPurchaseOwner(
                    lifecycle = requestLifecycle,
                    client = client,
                    callback = callback,
                    metadata = PendingPurchaseMetadata(
                        productType = desiredProductType,
                        requestedSkus = targetSkus,
                        launchStartedAtMillis = requestLaunchTimestampMillis,
                    ),
                )
                val launchAttempt = synchronized(purchaseLifecycleLock) {
                    val owner = pendingPurchase
                    if (owner?.lifecycle !== requestLifecycle || owner.callback !== callback ||
                        billingClient !== client || !isConnected || !client.isReady
                    ) {
                        null
                    } else {
                        pendingPurchase = owner.copy(metadata = pendingSnapshot.metadata)
                        didLaunchBillingFlow.set(true)
                        runCatching {
                            client.launchBillingFlow(activity, flowBuilder.build())
                        }
                    }
                }
                if (launchAttempt == null) {
                    val error = requestLifecycle.disconnectError.get() ?: PurchaseError(
                        code = ErrorCode.ServiceDisconnected,
                        message = "Billing service disconnected before purchase launch",
                        productId = targetSkus.singleOrNull(),
                    )
                    failPendingPurchaseFlow(requestLifecycle, callback, error)
                    return@suspendCancellableCoroutine
                }
                val launchResult = launchAttempt.getOrElse { error ->
                    val purchaseError = PurchaseError(
                        code = ErrorCode.PurchaseError,
                        debugMessage = error.message,
                        message = error.message ?: "Failed to launch billing flow",
                        productId = targetSkus.singleOrNull(),
                    )
                    failPendingPurchaseFlow(requestLifecycle, callback, purchaseError)
                    return@suspendCancellableCoroutine
                }
                if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    val error = launchResult.toPurchaseUpdateError(targetSkus.singleOrNull())
                    failPendingPurchaseFlow(requestLifecycle, callback, error)
                } else {
                    if (!ownsPendingPurchaseRequest(requestLifecycle, callback)) {
                        return@suspendCancellableCoroutine
                    }
                    schedulePurchaseResumeFallback(pendingSnapshot)
                }

                continuation.invokeOnCancellation {
                    if (!didLaunchBillingFlow.get()) {
                        abandonPendingPurchaseFlow(requestLifecycle, callback)
                    }
                }
                }
            } ?: recoverPendingPurchaseAfterTimeout(
                client = client,
                productType = desiredProductType,
                requestedSkus = targetSkus,
                requestLifecycle = requestLifecycle,
                expectedCallback = expectedCallback,
                launchStartedAtMillis = launchStartedAtMillis,
            )
            } catch (error: CancellationException) {
                expectedCallback?.let { callback ->
                    if (!didLaunchBillingFlow.get()) {
                        abandonPendingPurchaseFlow(requestLifecycle, callback)
                    }
                }
                throw error
            } catch (error: Throwable) {
                throwPurchaseRequestFailure(error, targetSkus.singleOrNull()) { purchaseError ->
                    failPendingPurchaseFlow(requestLifecycle, expectedCallback, purchaseError)
                }
            } finally {
                val callback = expectedCallback
                val shouldRetainLaunchedOwner = didLaunchBillingFlow.get() &&
                    callback != null &&
                    ownsPendingPurchaseRequest(requestLifecycle, callback)
                if (!shouldRetainLaunchedOwner) {
                    clearPendingPurchaseStateForRequest(requestLifecycle)
                }
            }
        }

        RequestPurchaseResultPurchases(purchases)
    }

    private val deepLinkToSubscriptionsHandler: MutationDeepLinkToSubscriptionsHandler = { options ->
        options?.let { launchDeepLinkToSubscriptions(it) }
    }

    private val finishTransactionHandler: MutationFinishTransactionHandler = { purchase, isConsumable ->
        if (purchase !is PurchaseAndroid) {
            failWith(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Android finishTransaction requires an Android purchase",
                )
            )
        }
        val token = purchase.purchaseToken?.takeIf { it.isNotBlank() } ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFinishFailed,
                message = "Missing purchase token on Android purchase",
            )
        )
        if (isConsumable == true) {
            consumePurchaseAndroid(token)
        } else {
            acknowledgePurchaseAndroid(token)
        }
    }

    // ---------------------------------------------------------------------
    // Interface implementation
    // ---------------------------------------------------------------------
    /**
     * Initialize the store connection. Must be called before any other IAP API.
     *
     * @param config Optional [InitConnectionConfig]. Use `enableBillingProgramAndroid`
     *   (Android, Play Billing 8.2.0+) to opt into External Payments etc.; iOS ignores
     *   Android-specific fields.
     * @return `true` once the platform billing client is connected.
     * @throws PurchaseException when the billing client fails to initialize.
     *
     * @see <a href="https://openiap.dev/docs/apis/init-connection">init-connection</a>
     */
    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = initConnectionHandler(config)

    /**
     * Close the store connection and release resources.
     *
     * @see <a href="https://openiap.dev/docs/apis/end-connection">https://openiap.dev/docs/apis/end-connection</a>
     */
    override suspend fun endConnection(): Boolean = endConnectionHandler()

    /**
     * Retrieve products or subscriptions from the store by SKU.
     *
     * @param params [ProductRequest] with `skus` and optional `type`
     *   ([ProductQueryType.InApp], [ProductQueryType.Subs], or [ProductQueryType.All];
     *   defaults to InApp).
     * @return [FetchProductsResult] sealed variant — Products for InApp, Subscriptions
     *   for Subs, mixed for All.
     * @throws PurchaseException on store rejection (unknown SKU, network, not connected).
     *
     * @see <a href="https://openiap.dev/docs/apis/fetch-products">fetch-products</a>
     */
    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        fetchProductsHandler(params)

    /**
     * Initiate a purchase or subscription flow. Result is delivered via the
     * purchaseUpdated event flow — NOT the return value.
     *
     * @param request [RequestPurchaseProps]. The OUTER `request` is the props envelope;
     *   the INNER `RequestPurchaseProps.request` field carries the per-platform payload —
     *   set `request.request.apple.sku` (iOS) and/or `request.request.google.skus`
     *   (Android). Subscriptions also need `subscriptionOffers` on Android.
     * @return The dispatched purchase payload (do not rely on this for the outcome).
     * @throws PurchaseException on synchronous rejection (billing not ready, missing offerToken).
     *
     * Warning: Event-based. Collect from `purchaseUpdatedListener` / `purchaseErrorListener`
     * (or the equivalent flows on `KmpIAP`) for the final state.
     *
     * @see <a href="https://openiap.dev/docs/apis/request-purchase">request-purchase</a>
     */
    override suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult? =
        requestPurchaseHandler(params)

    /**
     * List the user's unfinished purchases — non-consumables, active subscriptions, and
     * any pending transactions not finished previously.
     *
     * @param options Optional [PurchaseOptions]. iOS-only fields
     *   (`alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`) are ignored on Android.
     * @return List of [Purchase] currently held by the platform store.
     * @throws PurchaseException when the platform query fails.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-available-purchases">get-available-purchases</a>
     */
    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        getAvailablePurchasesHandler(options)

    /**
     * Get details of all currently active subscriptions.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-active-subscriptions">https://openiap.dev/docs/apis/get-active-subscriptions</a>
     */
    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        getActiveSubscriptionsHandler(subscriptionIds)

    /**
     * Check whether the user has any active subscription.
     *
     * @see <a href="https://openiap.dev/docs/apis/has-active-subscriptions">https://openiap.dev/docs/apis/has-active-subscriptions</a>
     */
    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        hasActiveSubscriptionsHandler(subscriptionIds)

    /**
     * Restore non-consumable and active subscription purchases.
     *
     * @see <a href="https://openiap.dev/docs/apis/restore-purchases">https://openiap.dev/docs/apis/restore-purchases</a>
     */
    override suspend fun restorePurchases() {
        getAvailablePurchasesHandler.invoke(null)
    }

    /**
     * Get the user's current entitlement for a product.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/current-entitlement-ios">https://openiap.dev/docs/apis/ios/current-entitlement-ios</a>
     */
    override suspend fun currentEntitlementIOS(sku: String): PurchaseIOS? = null

    /**
     * Fetch the app transaction (iOS 16+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-app-transaction-ios">https://openiap.dev/docs/apis/ios/get-app-transaction-ios</a>
     */
    override suspend fun getAppTransactionIOS(): AppTransaction? = null

    /**
     * List unfinished StoreKit transactions.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-pending-transactions-ios">https://openiap.dev/docs/apis/ios/get-pending-transactions-ios</a>
     */
    override suspend fun getPendingTransactionsIOS(): List<PurchaseIOS> = emptyList()

    /**
     * List every StoreKit transaction (finished + unfinished).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-all-transactions-ios">https://openiap.dev/docs/apis/ios/get-all-transactions-ios</a>
     */
    override suspend fun getAllTransactionsIOS(): List<PurchaseIOS> = emptyList()

    /**
     * Get base64 receipt data (legacy validation).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-receipt-data-ios">https://openiap.dev/docs/apis/ios/get-receipt-data-ios</a>
     */
    override suspend fun getReceiptDataIOS(): String? = null

    /**
     * Return the JWS string for a transaction.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-transaction-jws-ios">https://openiap.dev/docs/apis/ios/get-transaction-jws-ios</a>
     */
    override suspend fun getTransactionJwsIOS(sku: String): String? = null

    /**
     * Check intro-offer eligibility for a subscription group.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios">https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios</a>
     */
    override suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean = false

    /**
     * Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios">https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios</a>
     */
    override suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean = false

    /**
     * Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios">https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios</a>
     */
    override suspend fun showExternalPurchaseCustomLinkNoticeIOS(
        noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
    ): ExternalPurchaseCustomLinkNoticeResultIOS {
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "showExternalPurchaseCustomLinkNoticeIOS is an iOS-only API (iOS 18.1+)."
            )
        )
    }

    /**
     * Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios">https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios</a>
     */
    override suspend fun getExternalPurchaseCustomLinkTokenIOS(
        tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
    ): ExternalPurchaseCustomLinkTokenResultIOS {
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "getExternalPurchaseCustomLinkTokenIOS is an iOS-only API (iOS 18.1+)."
            )
        )
    }

    /**
     * Check whether a transaction's JWS verification passed.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-transaction-verified-ios">https://openiap.dev/docs/apis/ios/is-transaction-verified-ios</a>
     */
    override suspend fun isTransactionVerifiedIOS(sku: String): Boolean = false

    /**
     * Get the latest verified transaction for a product.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/latest-transaction-ios">https://openiap.dev/docs/apis/ios/latest-transaction-ios</a>
     */
    override suspend fun latestTransactionIOS(sku: String): PurchaseIOS? = null

    /**
     * Get subscription status objects from StoreKit 2.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/subscription-status-ios">https://openiap.dev/docs/apis/ios/subscription-status-ios</a>
     */
    override suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS> = emptyList()

    suspend fun isPurchaseValid(purchase: Purchase): Boolean = isPurchaseTokenValid(purchase)

    override suspend fun promotedProductIOS(): String = ""

    override suspend fun purchaseError(): PurchaseError = purchaseErrorListener.first()

    override suspend fun purchaseUpdated(options: PurchaseUpdatedListenerOptions?): Purchase =
        purchaseUpdatedListener(options).first()

    override suspend fun subscriptionBillingIssue(): Purchase = subscriptionBillingIssueListener.first()

    /**
     * Complete a purchase transaction. Call after server-side verification.
     *
     * @param purchase The [Purchase] to finalize.
     * @param isConsumable `true` for consumables (Android consume — token can be re-bought),
     *   `false` for non-consumables and subscriptions (acknowledge only). Default `false`.
     * @throws PurchaseException when the platform finalize call fails.
     *
     * Important: Android auto-refunds purchases NOT acknowledged/consumed within 3 days.
     * iOS unfinished transactions replay on every app launch.
     *
     * @see <a href="https://openiap.dev/docs/apis/finish-transaction">finish-transaction</a>
     */
    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?) {
        finishTransactionHandler(purchase, isConsumable)
    }

    /**
     * Open the platform's subscription management UI.
     *
     * @see <a href="https://openiap.dev/docs/apis/deep-link-to-subscriptions">https://openiap.dev/docs/apis/deep-link-to-subscriptions</a>
     */
    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?) {
        deepLinkToSubscriptionsHandler(options)
    }

    // ---------------------------------------------------------------------
    // Query handlers
    // ---------------------------------------------------------------------
    private val fetchProductsHandler: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            if (params.skus.isEmpty()) {
                failWith(PurchaseError(code = ErrorCode.EmptySkuList, message = "SKU list is empty"))
            }

            val queryType = params.type ?: ProductQueryType.InApp
            val errorPublished = AtomicBoolean(false)

            fun publishQueryError(error: PurchaseError) {
                if (errorPublished.compareAndSet(false, true)) {
                    _purchaseErrorListener.tryEmit(error)
                }
            }

            suspend fun query(productType: String): ProductQueryOutcome {
                val requestedProductIds = params.skus.distinct()
                val queryParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        requestedProductIds.map { sku ->
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(sku)
                                .setProductType(productType)
                                .build()
                        }
                    )
                    .build()

                return awaitBillingQuery(
                    unavailableError = PurchaseError(
                        code = ErrorCode.NotPrepared,
                        message = "Billing client not ready",
                    ),
                    onError = ::publishQueryError,
                ) { client, complete ->
                    client.queryProductDetailsAsync(queryParams) { billingResult, result ->
                        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                            val freshDetailsById = result.productDetailsList
                                .associateBy { it.productId }
                            complete(
                                Result.success(
                                    ProductQueryOutcome(
                                        productDetails = params.skus.mapNotNull(freshDetailsById::get),
                                        unfetchedProducts = result.unfetchedProductsCompat(),
                                        succeeded = true,
                                    )
                                )
                            )
                        } else {
                            val error = billingResult.toQueryProductError(
                                productIds = requestedProductIds,
                                productType = productType,
                                isEmptyProductList = result.productDetailsList.isEmpty(),
                            )
                            complete(Result.failure(PurchaseException(error)))
                        }
                    }
                }
            }

            val outcomes = collectProductQueryOutcomes(
                queryType = queryType,
                queryInApp = { query(BillingClient.ProductType.INAPP) },
                querySubscriptions = { query(BillingClient.ProductType.SUBS) },
            )
            val inAppResult = outcomes.inApp
            val subscriptionsResult = outcomes.subscriptions

            fun ProductQueryOutcome.statusFor(productId: String) = unfetchedProducts
                .firstOrNull { it.productId == productId }
                ?.let { productStatusFromUnfetchedStatus(it.statusCode) }

            fun unavailableAllProduct(productId: String): ProductOrSubscription? {
                val statuses = listOfNotNull(
                    inAppResult.unfetchedProducts.firstOrNull { it.productId == productId },
                    subscriptionsResult.unfetchedProducts.firstOrNull { it.productId == productId },
                )
                val noOffers = statuses.firstOrNull {
                    productStatusFromUnfetchedStatus(it.statusCode) ==
                        ProductStatusAndroid.NoOffersAvailable
                }
                val selected = noOffers ?: statuses.firstOrNull()
                val status = when {
                    noOffers != null ->
                        ProductStatusAndroid.NoOffersAvailable
                    inAppResult.succeeded && subscriptionsResult.succeeded &&
                        statuses.size == 2 && statuses.all {
                            productStatusFromUnfetchedStatus(it.statusCode) ==
                                ProductStatusAndroid.NotFound
                        } -> ProductStatusAndroid.NotFound
                    inAppResult.succeeded || subscriptionsResult.succeeded ->
                        ProductStatusAndroid.Unknown
                    else -> return null
                }

                return if (selected?.productType == BillingClient.ProductType.SUBS) {
                    ProductOrSubscription.ProductSubscriptionItem(
                        unavailableSubscriptionProduct(productId, status)
                    )
                } else {
                    ProductOrSubscription.ProductItem(unavailableInAppProduct(productId, status))
                }
            }

            return@withContext when (queryType) {
                ProductQueryType.InApp -> {
                    val detailsById = inAppResult.productDetails.associateBy { it.productId }
                    FetchProductsResultProducts(
                        params.skus.mapNotNull { productId ->
                            detailsById[productId]?.toProduct()
                                ?: if (inAppResult.succeeded) {
                                    unavailableInAppProduct(
                                        productId,
                                        inAppResult.statusFor(productId)
                                            ?: ProductStatusAndroid.Unknown,
                                    )
                                } else {
                                    null
                                }
                        }
                    )
                }
                ProductQueryType.Subs -> {
                    val detailsById = subscriptionsResult.productDetails.associateBy { it.productId }
                    FetchProductsResultSubscriptions(
                        params.skus.mapNotNull { productId ->
                            detailsById[productId]?.toSubscriptionProduct()
                                ?: if (subscriptionsResult.succeeded) {
                                    unavailableSubscriptionProduct(
                                        productId,
                                        subscriptionsResult.statusFor(productId)
                                            ?: ProductStatusAndroid.Unknown,
                                    )
                                } else {
                                    null
                                }
                        }
                    )
                }
                ProductQueryType.All -> {
                    val inAppById = inAppResult.productDetails.associateBy { it.productId }
                    val subscriptionsById = subscriptionsResult.productDetails.associateBy { it.productId }
                    val combined = params.skus.mapNotNull { productId ->
                        inAppById[productId]?.let {
                            ProductOrSubscription.ProductItem(it.toProduct())
                        } ?: subscriptionsById[productId]?.toSubscriptionProduct()?.let {
                            ProductOrSubscription.ProductSubscriptionItem(it)
                        } ?: unavailableAllProduct(productId)
                    }
                    FetchProductsResultAll(combined)
                }
            }
        }
    }

    private val getAvailablePurchasesHandler: QueryGetAvailablePurchasesHandler = { options ->
        withContext(Dispatchers.IO) {
            val includeSuspended = options?.includeSuspendedAndroid == true

            suspend fun query(
                type: String,
                includeSuspendedSubs: Boolean,
                expectedClient: BillingClient? = null,
                expectedGeneration: Long? = null,
                captureOwner: (BillingClient, Long) -> Unit = { _, _ -> },
            ): List<Purchase> =
                awaitBillingQueryAndPublish(
                    expectedClient = expectedClient,
                    expectedGeneration = expectedGeneration,
                    captureOwner = captureOwner,
                ) { client, complete ->
                    // Include suspended subscriptions (Google Play Billing Library 8.1+)
                    // Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
                    // Users should be directed to the subscription center to resolve payment issues.
                    val params = availablePurchasesQueryParams(
                        client,
                        type,
                        includeSuspendedSubs,
                    )
                    client.queryPurchasesAsync(params) { result, purchases ->
                        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            complete(Result.success(purchases.map { it.toPurchase() }))
                        } else {
                            val error = result.toBillingOperationError(
                                defaultMessage = "Failed to query owned purchases",
                            )
                            complete(Result.failure(PurchaseException(error)))
                        }
                    }
                }

            lateinit var sessionClient: BillingClient
            var sessionGeneration = 0L
            val all = mutableListOf<Purchase>()
            all += query(
                BillingClient.ProductType.INAPP,
                includeSuspendedSubs = false,
            ) { client, generation ->
                sessionClient = client
                sessionGeneration = generation
            }
            // Always query with suspended=true so the billing-issue notifier can see
            // them, then filter the returned list based on the caller's preference.
            val subs = query(
                BillingClient.ProductType.SUBS,
                includeSuspendedSubs = true,
                expectedClient = sessionClient,
                expectedGeneration = sessionGeneration,
            )
            notifySuspendedSubscriptions(
                subs,
                sessionClient,
                sessionGeneration,
            )
            if (includeSuspended) {
                all += subs
            } else {
                all += subs.filterNot { (it as? PurchaseAndroid)?.isSuspendedAndroid == true }
            }
            all
        }
    }

    private val emittedBillingIssueTokens = mutableSetOf<String>()

    private fun notifySuspendedSubscriptions(
        purchases: List<Purchase>,
        expectedClient: BillingClient,
        expectedGeneration: Long,
    ) {
        val candidates = purchases.mapNotNull { purchase ->
            (purchase as? PurchaseAndroid)
                ?.takeIf { it.isSuspendedAndroid == true }
                ?.let { android -> android.purchaseToken?.let { it to android } }
        }
        val notifications = synchronized(purchaseLifecycleLock) {
            if (!isActiveBillingSessionLocked(expectedClient, expectedGeneration)) {
                emptyList()
            } else {
                candidates.mapNotNull { (token, purchase) ->
                    purchase.takeIf { emittedBillingIssueTokens.add(token) }
                }
            }
        }
        notifications.forEach(_subscriptionBillingIssueListener::tryEmit)
    }

    private val getActiveSubscriptionsHandler: QueryGetActiveSubscriptionsHandler = { ids ->
        withContext(Dispatchers.IO) {
            awaitBillingQueryAndPublish { client, complete ->
                val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
                client.queryPurchasesAsync(params) { result, purchases ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        val active = purchases
                            .filter { purchase ->
                                ids?.let { list -> purchase.products.any(list::contains) } ?: true
                            }
                            .filter { purchase ->
                                purchase.purchaseState ==
                                    com.android.billingclient.api.Purchase.PurchaseState.PURCHASED
                            }.map { purchase -> purchase.toActiveSubscription() }
                        complete(Result.success(active))
                    } else {
                        val error = result.toBillingOperationError(
                            defaultMessage = "Failed to query active subscriptions",
                        )
                        complete(Result.failure(PurchaseException(error)))
                    }
                }
            }
        }
    }

    private val hasActiveSubscriptionsHandler: QueryHasActiveSubscriptionsHandler = { ids ->
        withContext(Dispatchers.IO) { getActiveSubscriptionsHandler(ids).isNotEmpty() }
    }

    // ---------------------------------------------------------------------
    // Handler collections
    // ---------------------------------------------------------------------
    val queryHandlers: QueryHandlers by lazy {
        QueryHandlers(
            fetchProducts = fetchProductsHandler,
            getAvailablePurchases = getAvailablePurchasesHandler,
            getActiveSubscriptions = getActiveSubscriptionsHandler,
            hasActiveSubscriptions = hasActiveSubscriptionsHandler
        )
    }

    val mutationHandlers: MutationHandlers by lazy {
        MutationHandlers(
            initConnection = initConnectionHandler,
            endConnection = endConnectionHandler,
            requestPurchase = requestPurchaseHandler,
            deepLinkToSubscriptions = deepLinkToSubscriptionsHandler,
            finishTransaction = finishTransactionHandler,
            acknowledgePurchaseAndroid = { token -> acknowledgePurchaseAndroid(token) },
            consumePurchaseAndroid = { token -> consumePurchaseAndroid(token) },
            restorePurchases = { getAvailablePurchasesHandler.invoke(null) }
        )
    }

    val subscriptionHandlers: SubscriptionHandlers by lazy {
        SubscriptionHandlers(
            purchaseUpdated = { purchaseUpdatedListener.first() },
            purchaseError = { purchaseErrorListener.first() },
            subscriptionBillingIssue = { subscriptionBillingIssueListener.first() }
        )
    }

    // ---------------------------------------------------------------------
    // Android specific overrides
    // ---------------------------------------------------------------------
    private fun billingProgramConstant(program: BillingProgramAndroid, operation: String): Int =
        when (program) {
            BillingProgramAndroid.ExternalContentLink -> BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK
            BillingProgramAndroid.UserChoiceBilling -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "USER_CHOICE_BILLING is configured during initConnection, not through the BillingProgram API",
                )
            )
            BillingProgramAndroid.ExternalOffer -> BillingClient.BillingProgram.EXTERNAL_OFFER
            BillingProgramAndroid.ExternalPayments -> BillingClient.BillingProgram.EXTERNAL_PAYMENTS
            BillingProgramAndroid.BillingChoice -> BillingClient.BillingProgram.BILLING_CHOICE
            BillingProgramAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot $operation with UNSPECIFIED program"
                )
            )
        }

    private fun billingChoiceImageLayout(layout: BillingChoiceImageLayoutAndroid): String =
        when (layout) {
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
    ): Int? =
        when (developerBillingType) {
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

    private fun billingChoiceScreenTypeFromConstant(value: Int?): BillingChoiceScreenTypeAndroid? =
        when (value) {
            BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.UNSPECIFIED ->
                BillingChoiceScreenTypeAndroid.Unspecified
            BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.DEVELOPER_RENDERED ->
                BillingChoiceScreenTypeAndroid.DeveloperRendered
            BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails.ChoiceScreenType.GOOGLE_RENDERED ->
                BillingChoiceScreenTypeAndroid.GoogleRendered
            else -> null
        }

    private fun inAppMessageCategoryConstant(category: InAppMessageCategoryAndroid): Int =
        when (category) {
            InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId ->
                InAppMessageParams.InAppMessageCategoryId.UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID
            InAppMessageCategoryAndroid.Transactional ->
                InAppMessageParams.InAppMessageCategoryId.TRANSACTIONAL
        }

    private fun inAppMessageResponseCodeFromConstant(value: Int?): InAppMessageResponseCodeAndroid =
        when (value) {
            InAppMessageResult.InAppMessageResponseCode.SUBSCRIPTION_STATUS_UPDATED ->
                InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated
            else -> InAppMessageResponseCodeAndroid.NoActionNeeded
        }

    private fun BillingResult.toBillingResultAndroid(): BillingResultAndroid =
        BillingResultAndroid(
            responseCode = responseCode,
            debugMessage = debugMessage,
            subResponseCode = onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode()
        )

    /**
     * Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/acknowledge-purchase-android">https://openiap.dev/docs/apis/android/acknowledge-purchase-android</a>
     */
    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean {
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()

        return awaitBillingQueryAndPublish { client, complete ->
            client.acknowledgePurchase(params) { result ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    complete(Result.success(true))
                } else {
                    complete(Result.failure(PurchaseException(result.toPurchaseUpdateError())))
                }
            }
        }
    }

    /**
     * Consume a consumable purchase so it can be re-bought.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/consume-purchase-android">https://openiap.dev/docs/apis/android/consume-purchase-android</a>
     */
    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean {
        val params = ConsumeParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()

        return awaitBillingQueryAndPublish { client, complete ->
            client.consumeAsync(params) { result, _ ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    complete(Result.success(true))
                } else {
                    complete(Result.failure(PurchaseException(result.toPurchaseUpdateError())))
                }
            }
        }
    }

    /**
     * Show the App Store offer code redemption sheet.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios">https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios</a>
     */
    override suspend fun presentCodeRedemptionSheetIOS(): PurchaseIOS? = null

    suspend fun finishTransactionIOS(transactionId: String) {}

    /**
     * Clear pending transactions in the queue (sandbox helper).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/clear-transaction-ios">https://openiap.dev/docs/apis/ios/clear-transaction-ios</a>
     */
    override suspend fun clearTransactionIOS(): Boolean = false

    suspend fun clearProductsIOS() {}

    /**
     * Read the App Store-promoted product, if any.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-promoted-product-ios">https://openiap.dev/docs/apis/ios/get-promoted-product-ios</a>
     */
    override suspend fun getPromotedProductIOS(): ProductIOS? = null

    /**
     * Present the refund request sheet (iOS 15+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/begin-refund-request-ios">https://openiap.dev/docs/apis/ios/begin-refund-request-ios</a>
     */
    override suspend fun beginRefundRequestIOS(sku: String): String? = null

    /**
     * Present the manage-subscriptions sheet.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios">https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios</a>
     */
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> = emptyList()

    /**
     * Force sync transactions with the App Store.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/sync-ios">https://openiap.dev/docs/apis/ios/sync-ios</a>
     */
    override suspend fun syncIOS(): Boolean = false

    /**
     * Verify a purchase with the Google Play Developer API.
     *
     * @see <a href="https://openiap.dev/docs/features/validation#verify-purchase">https://openiap.dev/docs/features/validation#verify-purchase</a>
     */
    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult {
        // Mirrors the other OpenIAP wrappers (flutter/godot/maui): delegate to
        // openiap-google's Play Developer API check. The accessToken ships in
        // the request, so this is a debugging aid — production apps should
        // verify server-side or use verifyPurchaseWithProvider (IAPKit).
        val googleOptions = options.google ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "verifyPurchase on Android requires google options " +
                    "(packageName, purchaseToken, accessToken, sku)"
            )
        )

        return try {
            val androidResult = verifyPurchaseWithGooglePlayAndroid(
                AndroidVerifyPurchaseProps(
                    apple = null,
                    google = AndroidVerifyPurchaseGoogleOptions(
                        accessToken = googleOptions.accessToken,
                        isSub = googleOptions.isSub,
                        packageName = googleOptions.packageName,
                        purchaseToken = googleOptions.purchaseToken,
                        sku = googleOptions.sku
                    ),
                    horizon = null
                ),
                "kmp-iap-android"
            )

            // openiap-google parses the Play Developer API response with
            // reflective Gson, so fields declared non-null there (the
            // Amazon-RVS-shaped ones Google never returns, e.g.
            // parentProductId) can still be null at runtime. A direct
            // constructor copy would trip Kotlin's parameter null checks, so
            // round-trip through the JSON map boundary where the generated
            // fromJson applies its schema defaults.
            VerifyPurchaseResultAndroid.fromJson(androidResult.toJson())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = e.message ?: "Purchase verification failed"
                )
            )
        }
    }

    /**
     * Verify via a managed provider (currently IAPKit; the PurchaseVerificationProvider enum exposes only Iapkit today).
     *
     * @see <a href="https://openiap.dev/docs/features/validation#verify-purchase-with-provider">https://openiap.dev/docs/features/validation#verify-purchase-with-provider</a>
     */
    override suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult {
        if (options.provider != PurchaseVerificationProvider.Iapkit) {
            failWith(
                PurchaseError(
                    code = ErrorCode.FeatureNotSupported,
                    message = "Verification provider ${options.provider.rawValue} is not supported on Android"
                )
            )
        }

        val iapkitOptions = options.iapkit ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "IAPKit options are required for Android verification"
            )
        )
        val payloadCount = listOfNotNull(
            iapkitOptions.apple,
            iapkitOptions.google,
            iapkitOptions.amazon
        ).size
        val googleOptions = iapkitOptions.google
        val amazonOptions = iapkitOptions.amazon
        if (payloadCount != 1 || (googleOptions == null && amazonOptions == null)) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = "IAPKit verification on KMP Android requires exactly one google or amazon payload"
                )
            )
        }

        return try {
            val openIapProps = AndroidVerifyPurchaseWithIapkitProps(
                apiKey = iapkitOptions.apiKey,
                apple = null,
                amazon = amazonOptions?.let { amazon ->
                    AndroidVerifyPurchaseWithIapkitAmazonProps(
                        receiptId = amazon.receiptId,
                        sandbox = amazon.sandbox,
                        userId = amazon.userId
                    )
                },
                baseUrl = iapkitOptions.baseUrl,
                google = googleOptions?.let { google ->
                    AndroidVerifyPurchaseWithIapkitGoogleProps(
                        purchaseToken = google.purchaseToken
                    )
                },
                includeClientPayload = iapkitOptions.includeClientPayload
            )

            val androidResult = verifyPurchaseWithIapkitAndroid(openIapProps, "kmp-iap-android")

            val iapkitResult = RequestVerifyPurchaseWithIapkitResult(
                clientPayload = androidResult.clientPayload?.let { payload ->
                    IapkitProductClientPayload(
                        body = payload.body,
                        format = IapkitClientPayloadFormat.fromJson(payload.format.toJson()),
                        updatedAt = payload.updatedAt,
                        version = payload.version
                    )
                },
                isValid = androidResult.isValid,
                productId = androidResult.productId,
                state = IapkitPurchaseState.fromJson(androidResult.state.toJson()),
                store = IapStore.fromJson(androidResult.store.toJson())
            )

            VerifyPurchaseWithProviderResult(
                iapkit = iapkitResult,
                provider = options.provider
            )
        } catch (e: Exception) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = e.message ?: "Purchase verification failed"
                )
            )
        }
    }

    override fun getVersion(): String = kmpIapVersionString("Android")
    override fun getStore(): Store = Store.PLAY_STORE
    override suspend fun canMakePayments(): Boolean = true

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    private fun handlePurchaseUpdate(
        expectedClient: BillingClient,
        billingResult: BillingResult,
        purchases: List<com.android.billingclient.api.Purchase>?
    ) {
        val pendingSnapshot = synchronized(purchaseLifecycleLock) {
            if (billingClient !== expectedClient) return
            pendingPurchaseSnapshotLocked()?.takeIf { it.client === expectedClient }
        }
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchases.orEmpty().map { it.toPurchase() }
            val metadata = pendingSnapshot?.metadata
            val matched = if (metadata == null) {
                emptyList()
            } else {
                mapped.filter { purchase ->
                    isPurchaseForPendingRequest(
                        transactionDateMillis = purchase.transactionDate,
                        productIds = listOf(purchase.productId) + purchase.ids.orEmpty(),
                        requestedSkus = metadata.requestedSkus.toSet(),
                        launchStartedAtMillis = metadata.launchStartedAtMillis,
                    )
                }
            }
            val result = Result.success(matched)
            val claimedOwner = if (matched.isNotEmpty() && pendingSnapshot != null) {
                claimPendingPurchaseUpdate(expectedClient, pendingSnapshot, result) ?: return
            } else {
                if (synchronized(purchaseLifecycleLock) { billingClient !== expectedClient }) return
                null
            }
            mapped.forEach { _purchaseUpdatedListener.tryEmit(it) }
            claimedOwner?.let { completeClaimedPurchaseFlow(it, result) }
            if (mapped.isEmpty() && pendingSnapshot?.callback != null) {
                logWarning("Ignoring an empty successful purchase callback")
            } else if (mapped.isNotEmpty() && metadata != null && matched.isEmpty()) {
                logWarning("Ignoring unrelated purchase update while another purchase is pending")
            }
        } else {
            val error = billingResult.toPurchaseUpdateError(
                requestProductId = pendingSnapshot?.metadata?.requestedSkus?.singleOrNull(),
            )
            if (pendingSnapshot == null) {
                if (synchronized(purchaseLifecycleLock) { billingClient !== expectedClient }) return
                _purchaseErrorListener.tryEmit(error)
            } else {
                val result = Result.failure<List<Purchase>>(PurchaseException(error))
                val owner = claimPendingPurchaseUpdate(
                    expectedClient,
                    pendingSnapshot,
                    result,
                ) ?: return
                publishTerminalPurchaseError(pendingSnapshot.lifecycle, error)
                completeClaimedPurchaseFlow(owner, result)
            }
        }
    }

    private fun claimPendingPurchaseUpdate(
        expectedClient: BillingClient,
        expectedOwner: PendingPurchaseOwner,
        result: Result<List<Purchase>>,
    ): PendingPurchaseOwner? = synchronized(purchaseLifecycleLock) {
        val current = pendingPurchase ?: return@synchronized null
        if (
            billingClient !== expectedClient ||
            current.client !== expectedClient ||
            current.lifecycle !== expectedOwner.lifecycle ||
            current.callback !== expectedOwner.callback
        ) {
            return@synchronized null
        }
        if (current.lifecycle.terminalResult == null) current.lifecycle.terminalResult = result
        pendingPurchase = null
        current
    }

    private fun completeClaimedPurchaseFlow(
        owner: PendingPurchaseOwner,
        result: Result<List<Purchase>>,
    ) {
        owner.fallbackRunnable?.let(mainHandler::removeCallbacks)
        owner.callback?.invoke(result)
    }

    private fun publishTerminalPurchaseError(
        lifecycle: PurchaseRequestLifecycle,
        error: PurchaseError,
    ) {
        if (lifecycle.errorPublished.compareAndSet(false, true)) {
            _purchaseErrorListener.tryEmit(error)
        }
    }

    private fun attachPurchaseCallback(
        requestLifecycle: PurchaseRequestLifecycle,
        callback: (Result<List<Purchase>>) -> Unit,
    ): Result<List<Purchase>>? = synchronized(purchaseLifecycleLock) {
        val owner = pendingPurchase
        if (owner?.lifecycle !== requestLifecycle) {
            return@synchronized requestLifecycle.terminalResult
                ?: Result.failure(
                    PurchaseException(
                        PurchaseError(
                            code = ErrorCode.ServiceDisconnected,
                            message = "Purchase request is no longer active",
                        )
                    )
                )
        }
        if (owner.callback != null) {
            return@synchronized Result.failure(
                PurchaseException(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message = "Another purchase is already in progress",
                    )
                )
            )
        }
        pendingPurchase = owner.copy(callback = callback)
        null
    }

    private fun completePendingPurchaseFlow(
        expectedCallback: (Result<List<Purchase>>) -> Unit,
        result: Result<List<Purchase>>
    ): Boolean {
        val owner = claimPendingPurchaseResult(
            requestLifecycle = null,
            expectedCallback = expectedCallback,
            result = result,
        ) ?: return false
        completeClaimedPurchaseFlow(owner, result)
        return true
    }

    private fun claimPendingPurchaseResult(
        requestLifecycle: PurchaseRequestLifecycle?,
        expectedCallback: ((Result<List<Purchase>>) -> Unit)?,
        result: Result<List<Purchase>>,
    ): PendingPurchaseOwner? = synchronized(purchaseLifecycleLock) {
        val current = pendingPurchase ?: return@synchronized null
        if (
            (requestLifecycle != null && current.lifecycle !== requestLifecycle) ||
            (expectedCallback != null && current.callback !== expectedCallback)
        ) {
            return@synchronized null
        }
        if (current.lifecycle.terminalResult == null) current.lifecycle.terminalResult = result
        pendingPurchase = null
        current
    }

    private fun failPendingPurchaseFlow(
        requestLifecycle: PurchaseRequestLifecycle,
        expectedCallback: ((Result<List<Purchase>>) -> Unit)?,
        error: PurchaseError,
    ): Boolean {
        val failure = Result.failure<List<Purchase>>(PurchaseException(error))
        val owner = claimPendingPurchaseResult(
            requestLifecycle,
            expectedCallback,
            failure,
        ) ?: return false
        publishTerminalPurchaseError(requestLifecycle, error)
        completeClaimedPurchaseFlow(owner, failure)
        return true
    }

    private fun abandonPendingPurchaseFlow(
        requestLifecycle: PurchaseRequestLifecycle,
        expectedCallback: (Result<List<Purchase>>) -> Unit,
    ): Boolean {
        val owner = synchronized(purchaseLifecycleLock) {
            val current = pendingPurchase
            if (current?.lifecycle !== requestLifecycle || current.callback !== expectedCallback) {
                return false
            }
            pendingPurchase = null
            current
        }
        owner.fallbackRunnable?.let(mainHandler::removeCallbacks)
        return true
    }

    private fun failPendingPurchaseForClient(
        expectedClient: BillingClient,
        error: PurchaseError
    ) {
        val terminal = synchronized(purchaseLifecycleLock) {
            val owner = pendingPurchase ?: return
            if (owner.client !== expectedClient) return
            val resolvedError = if (error.productId == null) {
                error.copy(productId = owner.metadata?.requestedSkus?.singleOrNull())
            } else {
                error
            }
            val failure = Result.failure<List<Purchase>>(PurchaseException(resolvedError))
            owner.lifecycle.disconnectError.compareAndSet(null, resolvedError)
            if (owner.lifecycle.terminalResult == null) {
                owner.lifecycle.terminalResult = failure
            }
            pendingPurchase = null
            Triple(owner, resolvedError, failure)
        }
        val (owner, resolvedError, failure) = terminal
        owner.fallbackRunnable?.let(mainHandler::removeCallbacks)
        publishTerminalPurchaseError(owner.lifecycle, resolvedError)
        owner.lifecycle.disconnectSignal.complete(resolvedError)
        owner.callback?.invoke(failure)
    }

    private fun ownsPendingPurchaseRequest(
        requestLifecycle: PurchaseRequestLifecycle,
        expectedCallback: ((Result<List<Purchase>>) -> Unit)? = null,
    ): Boolean = synchronized(purchaseLifecycleLock) {
        val owner = pendingPurchase
        owner?.lifecycle === requestLifecycle &&
            (expectedCallback == null || owner.callback === expectedCallback)
    }

    private fun ownsPendingPurchaseFlow(snapshot: PendingPurchaseOwner): Boolean =
        snapshot.callback != null && snapshot.metadata != null &&
            ownsPendingPurchaseRequest(snapshot.lifecycle, snapshot.callback)

    private fun clearPendingPurchaseStateForRequest(
        requestLifecycle: PurchaseRequestLifecycle,
    ): Boolean {
        val owner = synchronized(purchaseLifecycleLock) {
            val current = pendingPurchase
            if (current?.lifecycle !== requestLifecycle) {
                return false
            }
            pendingPurchase = null
            current
        }
        owner.fallbackRunnable?.let(mainHandler::removeCallbacks)
        return true
    }

    /** Must be called while holding [purchaseLifecycleLock]. */
    private fun pendingPurchaseSnapshotLocked(): PendingPurchaseOwner? =
        pendingPurchase?.takeIf { it.callback != null && it.metadata != null }

    private fun schedulePurchaseResumeFallback() {
        val snapshot = synchronized(purchaseLifecycleLock) {
            pendingPurchaseSnapshotLocked() ?: return
        }
        schedulePurchaseResumeFallback(snapshot)
    }

    private fun schedulePurchaseResumeFallback(snapshot: PendingPurchaseOwner) {
        val runnable = object : Runnable {
            override fun run() {
                if (!ownsPendingPurchaseFlow(snapshot)) return

                val activity = currentActivity
                if (activity == null || !activity.hasWindowFocus()) {
                    mainHandler.postDelayed(this, PURCHASE_FOCUS_POLL_INTERVAL_MS)
                    return
                }

                resolvePendingPurchaseAfterResume(snapshot)
            }
        }
        schedulePurchaseFallback(
            snapshot,
            runnable,
            PURCHASE_RESUME_FALLBACK_DELAY_MS,
        )
    }

    private fun schedulePurchaseFallback(
        snapshot: PendingPurchaseOwner,
        runnable: Runnable,
        delayMillis: Long,
    ) {
        val previous = synchronized(purchaseLifecycleLock) {
            val current = pendingPurchase
            if (current?.lifecycle !== snapshot.lifecycle ||
                current.callback !== snapshot.callback || current.metadata == null
            ) {
                return
            }
            current.fallbackRunnable.also {
                pendingPurchase = current.copy(fallbackRunnable = runnable)
            }
        }
        previous?.let(mainHandler::removeCallbacks)
        mainHandler.postDelayed(runnable, delayMillis)
        if (!ownsPendingPurchaseFlow(snapshot)) {
            mainHandler.removeCallbacks(runnable)
            synchronized(purchaseLifecycleLock) {
                val current = pendingPurchase
                if (current?.fallbackRunnable === runnable) {
                    pendingPurchase = current.copy(fallbackRunnable = null)
                }
            }
        }
    }

    private fun resolvePendingPurchaseAfterResume(snapshot: PendingPurchaseOwner) {
        val client = billingClient ?: return
        if (!ownsPendingPurchaseFlow(snapshot)) return
        val callback = snapshot.callback ?: return
        val metadata = snapshot.metadata ?: return

        val requestedSkuSet = metadata.requestedSkus.toSet()
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(metadata.productType)
            .build()

        client.queryPurchasesAsync(params) { result, purchases ->
            if (!ownsPendingPurchaseFlow(snapshot)) {
                return@queryPurchasesAsync
            }

            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val matched = purchases
                    .filter { purchase ->
                        isPurchaseForPendingRequest(
                            transactionDateMillis = purchase.purchaseTime.toDouble(),
                            productIds = purchase.products,
                            requestedSkus = requestedSkuSet,
                            launchStartedAtMillis = metadata.launchStartedAtMillis,
                        )
                    }
                    .map { it.toPurchase() }

                if (matched.isNotEmpty() && completePendingPurchaseFlow(
                        callback,
                        Result.success(matched),
                    )) {
                    matched.forEach { _purchaseUpdatedListener.tryEmit(it) }
                    return@queryPurchasesAsync
                }
            }
        }
    }

    private suspend fun recoverPendingPurchaseAfterTimeout(
        client: BillingClient,
        productType: String,
        requestedSkus: List<String>,
        requestLifecycle: PurchaseRequestLifecycle,
        expectedCallback: ((Result<List<Purchase>>) -> Unit)?,
        launchStartedAtMillis: Double?,
    ): List<Purchase> {
        requestLifecycle.terminalResult?.let { return it.getOrThrow() }
        requestLifecycle.disconnectError.get()?.let { throw PurchaseException(it) }
        if (!ownsPendingPurchaseRequest(requestLifecycle, expectedCallback)) {
            requestLifecycle.terminalResult?.let { return it.getOrThrow() }
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Purchase request is no longer active",
                )
            )
        }

        val matched = if (launchStartedAtMillis == null) {
            emptyList()
        } else {
            queryPendingPurchaseMatches(
                client = client,
                productType = productType,
                requestedSkus = requestedSkus,
                launchStartedAtMillis = launchStartedAtMillis,
            )
        }
        requestLifecycle.disconnectError.get()?.let { throw PurchaseException(it) }
        if (!ownsPendingPurchaseRequest(requestLifecycle, expectedCallback)) {
            requestLifecycle.terminalResult?.let { return it.getOrThrow() }
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.ServiceDisconnected,
                    message = "Purchase request ended during timeout recovery",
                )
            )
        }

        if (matched.isNotEmpty()) {
            val claimed = expectedCallback?.let { callback ->
                completePendingPurchaseFlow(callback, Result.success(matched))
            } ?: clearPendingPurchaseStateForRequest(requestLifecycle)
            if (!claimed) {
                requestLifecycle.terminalResult?.let { return it.getOrThrow() }
                requestLifecycle.disconnectError.get()?.let { throw PurchaseException(it) }
            }
            matched.forEach { _purchaseUpdatedListener.tryEmit(it) }
            return matched
        }

        val error = PurchaseError(
            code = ErrorCode.UserCancelled,
            message = "User cancelled the operation"
        )
        val claimed = failPendingPurchaseFlow(requestLifecycle, expectedCallback, error)
        if (!claimed) {
            requestLifecycle.terminalResult?.let { return it.getOrThrow() }
            requestLifecycle.disconnectError.get()?.let { throw PurchaseException(it) }
        }
        throw PurchaseException(error)
    }

    internal suspend fun queryPendingPurchaseMatches(
        client: BillingClient,
        productType: String,
        requestedSkus: List<String>,
        launchStartedAtMillis: Double,
    ): List<Purchase> {
        val requestedSkuSet = requestedSkus.toSet()
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(productType)
            .build()

        return awaitBillingQuery(
            expectedClient = client,
            unavailableError = PurchaseError(
                code = ErrorCode.ServiceDisconnected,
                message = "Purchase billing client is no longer active",
            ),
        ) { activeClient, complete ->
            activeClient.queryPurchasesAsync(params) { result, purchases ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    val error = result.toBillingOperationError(
                        "Failed to recover pending purchase",
                    )
                    complete(Result.failure(PurchaseException(error)))
                } else {
                    val matched = purchases
                        .filter { purchase ->
                            isPurchaseForPendingRequest(
                                transactionDateMillis = purchase.purchaseTime.toDouble(),
                                productIds = purchase.products,
                                requestedSkus = requestedSkuSet,
                                launchStartedAtMillis = launchStartedAtMillis,
                            )
                        }
                        .map { it.toPurchase() }
                    complete(Result.success(matched))
                }
            }
        }
    }

    private fun isBillingProxyActivity(activity: Activity): Boolean =
        activity.javaClass.name == "com.android.billingclient.api.ProxyBillingActivity"

    private fun schedulePurchaseProxyClosedFallback() {
        val snapshot = synchronized(purchaseLifecycleLock) {
            pendingPurchaseSnapshotLocked() ?: return
        }
        val runnable = Runnable {
            resolvePendingPurchaseAfterResume(snapshot)
        }
        schedulePurchaseFallback(
            snapshot,
            runnable,
            PURCHASE_PROXY_CLOSED_FALLBACK_DELAY_MS,
        )
    }

    private fun launchDeepLinkToSubscriptions(options: DeepLinkOptions) {
        val sku = options.skuAndroid ?: return
        val activity = currentActivity ?: return
        val url = "https://play.google.com/store/account/subscriptions?sku=$sku&package=${activity.packageName}"
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    /**
     * Return the user's storefront country code.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-storefront">https://openiap.dev/docs/apis/get-storefront</a>
    */
    override suspend fun getStorefront(): String {
        val countryCode = try {
            awaitBillingQueryAndPublish<String?>(ErrorCode.NotPrepared) { client, complete ->
                client.getBillingConfigAsync(
                    GetBillingConfigParams.newBuilder().build()
                ) { result: BillingResult, config: BillingConfig? ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        complete(Result.success(config?.countryCode))
                    } else {
                        val error = result.toBillingOperationError("Failed to query Play storefront")
                        complete(Result.failure(PurchaseException(error)))
                    }
                }
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: Exception) {
            failWith(PurchaseError(
                code = ErrorCode.ServiceError,
                debugMessage = error.message,
                message = error.message ?: "Failed to query Play storefront",
            ))
        }
        return authoritativeStorefrontCountryOrNull(countryCode) ?: failWith(
            PurchaseError(
                code = ErrorCode.ServiceError,
                message = "Play returned no authoritative storefront country code",
            )
        )
    }

    // ---------------------------------------------------------------------
    // iOS External Purchase Methods (stubs for Android)
    // ---------------------------------------------------------------------

    /**
     * Present an external purchase link (iOS 16+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios">https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios</a>
     */
    override suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS {
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = "External purchase links are iOS only"))
    }

    /**
     * Present the external purchase notice sheet (iOS 17.4+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios">https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios</a>
     */
    override suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS {
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = "External purchase notice sheet is iOS only"))
    }

    /**
     * Check eligibility for the external purchase notice sheet (iOS 17.4+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios">https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios</a>
     */
    override suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean {
        return false // Not supported on Android
    }

    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails {
        if (enabledBillingProgram != BillingProgramAndroid.UserChoiceBilling) {
            failWith(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "userChoiceBillingAndroid requires BillingProgramAndroid.UserChoiceBilling"
                )
            )
        }
        return _userChoiceBillingListener.first()
    }

    // ---------------------------------------------------------------------
    // Billing Programs API (Android 8.2.1+)
    // These APIs use reflection to maintain compatibility with older Billing Library versions
    // Full implementation uses Google Play Billing Library 9.1.0
    // ---------------------------------------------------------------------

    /**
     * Check whether a billing program is available.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/is-billing-program-available-android">https://openiap.dev/docs/apis/android/is-billing-program-available-android</a>
     */
    override suspend fun isBillingProgramAvailableAndroid(
        program: BillingProgramAndroid
    ): BillingProgramAvailabilityResultAndroid {
        val billingProgramConstant = billingProgramConstant(program, "check availability")

        return try {
            awaitBillingQuery { client, complete ->
                // Use reflection to call isBillingProgramAvailableAsync (8.2.0+)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramAvailabilityListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramAvailabilityResponse") {
                        val result = args?.get(0) as? BillingResult
                        if (result == null) {
                            complete(Result.failure(
                                PurchaseException(
                                    PurchaseError(
                                        code = ErrorCode.Unknown,
                                        message = "Missing Billing Program availability result",
                                    )
                                )
                            ))
                            return@newProxyInstance null
                        }
                        val isAvailable = when (result.responseCode) {
                            BillingClient.BillingResponseCode.OK -> true
                            BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> false
                            else -> {
                                complete(Result.failure(
                                    PurchaseException(
                                        result.toBillingOperationError(
                                            "Failed to check billing program availability"
                                        )
                                    )
                                ))
                                return@newProxyInstance null
                            }
                        }
                        val availabilityDetails = args.getOrNull(1)
                        val choiceDetails =
                            if (program == BillingProgramAndroid.BillingChoice) {
                                runCatching {
                                    availabilityDetails?.javaClass
                                        ?.getMethod("getBillingChoiceAvailabilityDetails")
                                        ?.invoke(availabilityDetails)
                                }.getOrNull()
                            } else {
                                null
                            }
                        val choiceScreenType = runCatching {
                            choiceDetails?.javaClass
                                ?.getMethod("getChoiceScreenType")
                                ?.invoke(choiceDetails) as? Int
                        }.getOrNull()
                        val isExternalLinkAvailable = runCatching {
                            choiceDetails?.javaClass
                                ?.getMethod("isExternalLinkAvailable")
                                ?.invoke(choiceDetails) as? Boolean
                        }.getOrNull()
                        complete(Result.success(
                            BillingProgramAvailabilityResultAndroid(
                                billingProgram = program,
                                choiceScreenType = billingChoiceScreenTypeFromConstant(choiceScreenType),
                                isAvailable = isAvailable,
                                isExternalLinkAvailable = isExternalLinkAvailable
                            )
                        ))
                    }
                    null
                }

                val method = client.javaClass.getMethod(
                    "isBillingProgramAvailableAsync",
                    Int::class.javaPrimitiveType,
                    listenerClass
                )
                method.invoke(client, billingProgramConstant, listener)
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "isBillingProgramAvailableAsync requires Billing Library 8.2.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "Billing Program availability requires Billing Library 8.2.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                message = "Failed to check billing program availability: ${error.message}",
            ))
        }
    }

    /**
     * Create the reporting payload Google requires (Play Billing 8.3.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android">https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android</a>
     */
    override suspend fun createBillingProgramReportingDetailsAndroid(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid {
        val billingProgramConstant = billingProgramConstant(program, "create reporting details")

        return try {
            awaitBillingQuery { client, complete ->
                val paramsClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsParams")
                val builderClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                    .invoke(builder, billingProgramConstant)
                developerBillingTypeConstant(program, developerBillingType)?.let { typeConstant ->
                    builderClass.getMethod("setDeveloperBillingType", Int::class.javaPrimitiveType)
                        .invoke(builder, typeConstant)
                }
                val requestParams = builderClass.getMethod("build").invoke(builder)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onCreateBillingProgramReportingDetailsResponse") {
                        val result = args?.get(0) as? BillingResult
                        val details = args?.getOrNull(1)
                        val callbackResult = if (
                            result?.responseCode == BillingClient.BillingResponseCode.OK &&
                            details != null
                        ) {
                            val token = runCatching {
                                details.javaClass.getMethod("getExternalTransactionToken")
                                    .invoke(details) as? String
                            }.getOrNull()
                            if (token != null) {
                                Result.success(
                                    BillingProgramReportingDetailsAndroid(
                                        billingProgram = program,
                                        externalTransactionToken = token,
                                    )
                                )
                            } else {
                                Result.failure(PurchaseException(PurchaseError(
                                    code = ErrorCode.Unknown,
                                    message = "Failed to extract external transaction token",
                                )))
                            }
                        } else {
                            val error = result?.toBillingOperationError(
                                "Failed to create billing program reporting details"
                            ) ?: PurchaseError(
                                code = ErrorCode.Unknown,
                                message = "Missing Billing Program reporting result",
                            )
                            Result.failure(PurchaseException(error))
                        }
                        complete(callbackResult)
                    }
                    null
                }

                val method = client.javaClass.getMethod(
                    "createBillingProgramReportingDetailsAsync",
                    paramsClass,
                    listenerClass
                )
                method.invoke(client, requestParams, listener)
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "createBillingProgramReportingDetailsAsync requires Billing Library 8.2.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "Billing Program reporting requires Billing Library 8.2.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                message = "Failed to create billing program reporting details: ${error.message}",
            ))
        }
    }

    override suspend fun getBillingChoiceInfoAndroid(
        params: GetBillingChoiceInfoParamsAndroid
    ): BillingChoiceInfoAndroid {
        val program = if (params.billingProgram == BillingProgramAndroid.Unspecified) {
            BillingProgramAndroid.BillingChoice
        } else {
            params.billingProgram
        }
        if (program != BillingProgramAndroid.BillingChoice) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "getBillingChoiceInfoAndroid only supports BillingChoice"
                )
            )
        }

        return try {
            awaitBillingQuery { client, complete ->
                val paramsClass = Class.forName("com.android.billingclient.api.GetBillingChoiceInfoParams")
                val builderClass = Class.forName("com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                    .invoke(builder, billingProgramConstant(program, "get Billing Choice info"))
                builderClass.getMethod("setPlayBillingChoiceImageLayout", String::class.java)
                    .invoke(builder, billingChoiceImageLayout(params.playBillingChoiceImageLayout))
                params.userLocale?.takeIf { it.isNotBlank() }?.let { languageTag ->
                    builderClass.getMethod("setUserLocale", java.util.Locale::class.java)
                        .invoke(builder, java.util.Locale.forLanguageTag(languageTag))
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
                        val callbackResult = if (
                            result?.responseCode == BillingClient.BillingResponseCode.OK &&
                            choiceInfo != null
                        ) {
                            runCatching {
                                val imageUrl = choiceInfo.javaClass
                                    .getMethod("getPlayBillingChoiceImageUrl")
                                    .invoke(choiceInfo) as? String
                                check(!imageUrl.isNullOrBlank()) {
                                    "Missing Play Billing choice image URL"
                                }
                                BillingChoiceInfoAndroid(
                                    playBillingChoiceImageUrl = imageUrl,
                                    playBillingLoyaltyInfo = choiceInfo.javaClass
                                        .getMethod("getPlayBillingLoyaltyInfo")
                                        .invoke(choiceInfo) as? String,
                                )
                            }.fold(
                                onSuccess = { Result.success(it) },
                                onFailure = { error ->
                                    Result.failure(
                                        PurchaseException(
                                            PurchaseError(
                                                code = ErrorCode.Unknown,
                                                message = error.message
                                                    ?: "Failed to parse Billing Choice info",
                                            )
                                        )
                                    )
                                },
                            )
                        } else {
                            val error = result?.toBillingOperationError(
                                "Failed to get Billing Choice info"
                            ) ?: PurchaseError(
                                code = ErrorCode.Unknown,
                                message = "Missing Billing Choice info result",
                            )
                            Result.failure(PurchaseException(error))
                        }
                        complete(callbackResult)
                    }
                    null
                }
                client.javaClass.getMethod("getBillingChoiceInfoAsync", paramsClass, listenerClass)
                    .invoke(client, requestParams, listener)
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "getBillingChoiceInfoAsync requires Billing Library 9.1.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "GetBillingChoiceInfoParams requires Billing Library 9.1.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                message = "Failed to get Billing Choice info: ${error.message}",
            ))
        }
    }

    override suspend fun showBillingProgramInformationDialogAndroid(
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid = withContext(Dispatchers.Main) {
        val activity = synchronized(purchaseLifecycleLock) { currentActivity }
            ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.ActivityUnavailable,
                message = "Activity not available",
            )
        )
        val program = if (params.billingProgram == BillingProgramAndroid.Unspecified) {
            BillingProgramAndroid.BillingChoice
        } else {
            params.billingProgram
        }
        if (program != BillingProgramAndroid.BillingChoice) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "showBillingProgramInformationDialogAndroid only supports BillingChoice"
                )
            )
        }

        try {
            awaitBillingQuery { client, complete ->
                val paramsClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogParams")
                val builderClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                    .invoke(builder, billingProgramConstant(program, "show Billing Choice information dialog"))
                builderClass.getMethod("setExternalTransactionToken", String::class.java)
                    .invoke(builder, params.externalTransactionToken)
                val requestParams = builderClass.getMethod("build").invoke(builder)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramInformationDialogListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramInformationDialogResponse") {
                        val result = args?.get(0) as? BillingResult
                        complete(Result.success(
                            result?.toBillingResultAndroid()
                                ?: BillingResultAndroid(
                                    responseCode = BillingClient.BillingResponseCode.ERROR
                                )
                        ))
                    }
                    null
                }
                client.javaClass.getMethod(
                    "showBillingProgramInformationDialog",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                ).invoke(client, activity, requestParams, listener)
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "showBillingProgramInformationDialog requires Billing Library 9.1.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "BillingProgramInformationDialogParams requires Billing Library 9.1.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                message = "Failed to show Billing Choice information dialog: ${error.message}",
            ))
        }
    }

    override suspend fun showInAppMessagesAndroid(
        params: InAppMessageParamsAndroid?
    ): InAppMessageResultAndroid = withContext(Dispatchers.Main) {
        val activity = synchronized(purchaseLifecycleLock) { currentActivity }
            ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.ActivityUnavailable,
                message = "Activity not available",
            )
        )

        try {
            awaitBillingQuery { client, complete ->
                val paramsClass = Class.forName("com.android.billingclient.api.InAppMessageParams")
                val builderClass = Class.forName("com.android.billingclient.api.InAppMessageParams\$Builder")
                val builder = paramsClass.getMethod("newBuilder").invoke(null)
                val categories = params?.categories?.takeIf { it.isNotEmpty() }
                    ?: listOf(InAppMessageCategoryAndroid.Transactional)
                for (category in categories) {
                    builderClass.getMethod("addInAppMessageCategoryToShow", Int::class.javaPrimitiveType)
                        .invoke(builder, inAppMessageCategoryConstant(category))
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
                        complete(Result.success(
                            InAppMessageResultAndroid(
                                responseCode = inAppMessageResponseCodeFromConstant(responseCode),
                                purchaseToken = purchaseToken,
                            )
                        ))
                    }
                    null
                }
                val submitResult = client.javaClass.getMethod(
                    "showInAppMessages",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                ).invoke(client, activity, requestParams, listener) as? BillingResult
                if (submitResult != null &&
                    submitResult.responseCode != BillingClient.BillingResponseCode.OK
                ) {
                    complete(Result.failure(PurchaseException(
                        PurchaseError(
                            code = mapBillingResponseCode(submitResult.responseCode),
                            debugMessage = submitResult.debugMessage,
                            message = "showInAppMessages failed: ${submitResult.debugMessage}",
                            responseCode = submitResult.responseCode,
                        )
                    )))
                }
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "showInAppMessages requires Billing Library 4.1.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "InAppMessageParams requires Billing Library 4.1.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                message = "Failed to show in-app messages: ${error.message}",
            ))
        }
    }

    /**
     * Launch an external content/offer link (Play Billing 8.2.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/launch-external-link-android">https://openiap.dev/docs/apis/android/launch-external-link-android</a>
     */
    override suspend fun launchExternalLinkAndroid(
        params: LaunchExternalLinkParamsAndroid
    ): Boolean = withContext(Dispatchers.Main) {
        val activity = synchronized(purchaseLifecycleLock) { currentActivity }
            ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.ActivityUnavailable,
                message = "Activity not available",
            )
        )

        // Convert enums to BillingClient constants
        val billingProgramConstant = billingProgramConstant(params.billingProgram, "launch")

        val launchModeConstant = when (params.launchMode) {
            ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
            ExternalLinkLaunchModeAndroid.CallerWillLaunchLink -> 2
            ExternalLinkLaunchModeAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot launch with UNSPECIFIED launch mode"
                )
            )
        }

        val linkTypeConstant = when (params.linkType) {
            ExternalLinkTypeAndroid.LinkToDigitalContentOffer -> 1
            ExternalLinkTypeAndroid.LinkToAppDownload -> 2
            ExternalLinkTypeAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot launch with UNSPECIFIED link type"
                )
            )
        }

        try {
            awaitBillingQuery { client, complete ->
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
                val setLinkUriMethod = builderClass.getMethod("setLinkUri", Uri::class.java)
                setLinkUriMethod.invoke(builder, Uri.parse(params.linkUri))

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
                        val result = args?.get(0) as? BillingResult
                        if (result?.responseCode == BillingClient.BillingResponseCode.OK) {
                            complete(Result.success(true))
                        } else {
                            val error = result?.toBillingOperationError(
                                "Failed to launch external link"
                            ) ?: PurchaseError(
                                code = ErrorCode.Unknown,
                                message = "Missing external link launch result",
                            )
                            complete(Result.failure(PurchaseException(error)))
                        }
                    }
                    null
                }

                // Call launchExternalLink
                val launchMethod = client.javaClass.getMethod(
                    "launchExternalLink",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                )
                launchMethod.invoke(client, activity, launchParams, listener)
            }
        } catch (error: PurchaseException) {
            throw error
        } catch (error: NoSuchMethodException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "launchExternalLink requires Billing Library 8.2.0+",
            ))
        } catch (error: ClassNotFoundException) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "LaunchExternalLinkParams requires Billing Library 8.2.0+",
            ))
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                debugMessage = error.message,
                message = error.message ?: "Failed to launch external link",
            ))
        }
    }

    /**
     * Open the Google Play offer/promo code redemption flow (https://play.google.com/redeem).
     * A listener can receive the redeemed purchase while the app has an active billing
     * connection; reconcile available purchases when the app resumes.
     * Does not require the billing client to be initialized.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/open-redeem-offer-code-android">https://openiap.dev/docs/apis/android/open-redeem-offer-code-android</a>
     */
    override suspend fun openRedeemOfferCodeAndroid(): Boolean = withContext(Dispatchers.Main) {
        val launchContext: Context = synchronized(purchaseLifecycleLock) { currentActivity ?: context }
            ?: applicationContextProvider()?.applicationContext
            ?: throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.ActivityUnavailable,
                    message = "Activity not available",
                )
            )
        redeemFlowLauncher?.let { return@withContext it(launchContext) }
        try {
            launchContext.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/redeem")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
            true
        } catch (error: Exception) {
            throw PurchaseException(PurchaseError(
                code = ErrorCode.Unknown,
                debugMessage = error.message,
                message = error.message ?: "Failed to open the Play Store redeem page",
            ))
        }
    }

    // ---------------------------------------------------------------------
    // Activity lifecycle
    // ---------------------------------------------------------------------
    private fun activityLifecycleCallbacks(
        generation: Long,
    ): Application.ActivityLifecycleCallbacks =
        object : Application.ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) =
                handleActivityCreated(generation, activity)

            override fun onActivityResumed(activity: Activity) =
                handleActivityResumed(generation, activity)

            override fun onActivityDestroyed(activity: Activity) =
                handleActivityDestroyed(generation, activity)

            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
        }

    private fun handleActivityCreated(generation: Long, activity: Activity) {
        if (isBillingProxyActivity(activity)) return
        synchronized(purchaseLifecycleLock) {
            if (
                activityCallbacksDisposer != null &&
                activityCallbacksGeneration == generation &&
                connectionGeneration == generation &&
                currentActivity == null
            ) {
                currentActivity = activity
            }
        }
    }
    private fun handleActivityResumed(generation: Long, activity: Activity) {
        if (isBillingProxyActivity(activity)) return
        val ownsCallbacks = synchronized(purchaseLifecycleLock) {
            if (
                activityCallbacksDisposer != null &&
                activityCallbacksGeneration == generation &&
                connectionGeneration == generation
            ) {
                currentActivity = activity
                true
            } else {
                false
            }
        }
        if (ownsCallbacks) schedulePurchaseResumeFallback()
    }
    private fun handleActivityDestroyed(generation: Long, activity: Activity) {
        val ownsCallbacks = synchronized(purchaseLifecycleLock) {
            activityCallbacksDisposer != null &&
                activityCallbacksGeneration == generation &&
                connectionGeneration == generation
        }
        if (!ownsCallbacks) return
        if (isBillingProxyActivity(activity)) {
            schedulePurchaseProxyClosedFallback()
            return
        }
        synchronized(purchaseLifecycleLock) {
            if (
                activityCallbacksDisposer != null &&
                activityCallbacksGeneration == generation &&
                connectionGeneration == generation &&
                currentActivity === activity
            ) {
                currentActivity = null
            }
        }
    }

    // ---------------------------------------------------------------------
    // Developer-provided billing programs (8.3.0+)
    // ---------------------------------------------------------------------

    /**
     * Enable External Payments or Billing Choice using the available Play APIs.
     * The listener is omitted for developer-rendered Billing Choice.
     */
    private fun enableDeveloperProvidedBillingProgram(
        builder: BillingClient.Builder,
        program: BillingProgramAndroid,
        includeDeveloperListener: Boolean,
        sourceClient: () -> BillingClient?,
        sourceGeneration: Long,
    ) {
        try {
            // Get the EnableBillingProgramParams class
            val enableParamsClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams")
            val enableParamsBuilderClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams\$Builder")

            val newBuilderMethod = enableParamsClass.getMethod("newBuilder")
            val enableParamsBuilder = newBuilderMethod.invoke(null)

            val setBillingProgramMethod = enableParamsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            setBillingProgramMethod.invoke(enableParamsBuilder, billingProgramConstant(program, "enable billing program"))

            if (includeDeveloperListener) {
                val listenerClass = Class.forName("com.android.billingclient.api.DeveloperProvidedBillingListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onUserSelectedDeveloperBilling") {
                        args?.firstOrNull()?.let { details ->
                            val mappedDetails = extractDeveloperProvidedBillingDetails(details)
                            deliverBillingSessionEvent(sourceClient(), sourceGeneration) {
                                _developerProvidedBillingListener.tryEmit(mappedDetails)
                            }
                        }
                    }
                    null
                }

                enableParamsBuilderClass.getMethod("setDeveloperProvidedBillingListener", listenerClass)
                    .invoke(enableParamsBuilder, listener)
            }

            // Build the params
            val buildMethod = enableParamsBuilderClass.getMethod("build")
            val enableParams = buildMethod.invoke(enableParamsBuilder)

            // Call enableBillingProgram on the BillingClient.Builder
            val enableMethod = builder.javaClass.getMethod("enableBillingProgram", enableParamsClass)
            enableMethod.invoke(builder, enableParams)

        } catch (error: Exception) {
            throw billingProgramConfigurationException(program, error)
        }
    }

    /**
     * Enable a billing program using reflection for 8.2.0+ compatibility.
     * Used for EXTERNAL_CONTENT_LINK and EXTERNAL_OFFER programs.
     * Note: EXTERNAL_PAYMENTS should use enableExternalPaymentsProgram() instead.
     */
    private fun enableBillingProgram(
        builder: BillingClient.Builder,
        program: BillingProgramAndroid,
        sourceClient: () -> BillingClient?,
        sourceGeneration: Long,
    ) {
        val programConstant = when (program) {
            BillingProgramAndroid.UserChoiceBilling -> {
                // UserChoiceBilling uses enableUserChoiceBilling() instead of enableBillingProgram()
                builder.enableUserChoiceBilling { userChoiceDetails ->
                    val details = userChoiceDetails.toOpenIapDetails()
                    deliverBillingSessionEvent(sourceClient(), sourceGeneration) {
                        _userChoiceBillingListener.tryEmit(details)
                    }
                }
                return
            }
            BillingProgramAndroid.ExternalContentLink,
            BillingProgramAndroid.ExternalOffer,
            BillingProgramAndroid.BillingChoice ->
                billingProgramConstant(program, "enable billing program")
            BillingProgramAndroid.ExternalPayments -> {
                logWarning("ExternalPayments should use enableExternalPaymentsProgram()")
                return
            }
            BillingProgramAndroid.Unspecified -> return
        }

        try {
            val method = builder.javaClass.getMethod("enableBillingProgram", Int::class.javaPrimitiveType)
            method.invoke(builder, programConstant)
        } catch (error: Exception) {
            throw billingProgramConfigurationException(program, error)
        }
    }

    /**
     * Apply DeveloperBillingOption to BillingFlowParams using reflection for 8.3.0+ compatibility.
     */
    private fun applyDeveloperBillingOption(
        flowBuilder: BillingFlowParams.Builder,
        option: DeveloperBillingOptionParamsAndroid
    ) {
        try {
            // Get the DeveloperBillingOptionParams class
            val paramsClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams")
            val paramsBuilderClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams\$Builder")

            // Create DeveloperBillingOptionParams
            val newBuilderMethod = paramsClass.getMethod("newBuilder")
            val paramsBuilder = newBuilderMethod.invoke(null)

            // Set billing program (EXTERNAL_PAYMENTS = 4)
            val billingProgramConstant = when (option.billingProgram) {
                BillingProgramAndroid.UserChoiceBilling -> throw PurchaseException(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message = "User Choice Billing cannot be used as a developer billing option",
                    )
                )
                BillingProgramAndroid.ExternalPayments,
                BillingProgramAndroid.BillingChoice,
                BillingProgramAndroid.ExternalContentLink,
                BillingProgramAndroid.ExternalOffer ->
                    billingProgramConstant(option.billingProgram, "apply developer billing option")
                BillingProgramAndroid.Unspecified -> throw PurchaseException(
                    PurchaseError(
                        code = ErrorCode.DeveloperError,
                        message = "Cannot use an unspecified developer billing program",
                    )
                )
            }
            val setBillingProgramMethod = paramsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            setBillingProgramMethod.invoke(paramsBuilder, billingProgramConstant)

            // Link fields are optional for in-app Billing Choice flows.
            val launchModeConstant = when (option.launchMode) {
                DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
                DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink -> 2
                DeveloperBillingLaunchModeAndroid.Unspecified -> throw IllegalArgumentException(
                    "Cannot use UNSPECIFIED launch mode"
                )
                null -> null
            }
            launchModeConstant?.let { launchMode ->
                paramsBuilderClass.getMethod("setLaunchMode", Int::class.javaPrimitiveType)
                    .invoke(paramsBuilder, launchMode)
            }

            option.linkUri?.takeIf { it.isNotBlank() }?.let { linkUri ->
                paramsBuilderClass.getMethod("setLinkUri", android.net.Uri::class.java)
                    .invoke(paramsBuilder, android.net.Uri.parse(linkUri))
            }

            option.externalTransactionToken?.takeIf { it.isNotBlank() }?.let { token ->
                paramsBuilderClass.getMethod("setExternalTransactionToken", String::class.java)
                    .invoke(paramsBuilder, token)
            }

            // Build the params
            val buildMethod = paramsBuilderClass.getMethod("build")
            val developerBillingParams = buildMethod.invoke(paramsBuilder)

            // Apply to BillingFlowParams.Builder
            val enableDeveloperBillingOptionMethod = flowBuilder.javaClass.getMethod(
                "enableDeveloperBillingOption",
                paramsClass
            )
            enableDeveloperBillingOptionMethod.invoke(flowBuilder, developerBillingParams)

        } catch (e: NoSuchMethodException) {
            logWarning("DeveloperBillingOption requires Billing Library 8.3.0+")
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.FeatureNotSupported,
                    message = "DeveloperBillingOption requires Play Billing 8.3.0+",
                )
            )
        } catch (e: ClassNotFoundException) {
            logWarning("DeveloperBillingOption requires Billing Library 8.3.0+")
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.FeatureNotSupported,
                    message = "DeveloperBillingOption requires Play Billing 8.3.0+",
                )
            )
        } catch (e: PurchaseException) {
            throw e
        } catch (e: Exception) {
            logError("Failed to apply DeveloperBillingOption: ${e.message}", e)
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    debugMessage = e.message,
                    message = e.message ?: "Invalid developer billing option",
                )
            )
        }
    }

    /**
     * Get the developer provided billing details when user selects developer billing
     * in an External Payments or Billing Choice flow.
     *
     * @throws PurchaseException if a developer-provided billing program is not enabled
     */
    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid {
        if (enabledBillingProgram != BillingProgramAndroid.ExternalPayments &&
            enabledBillingProgram != BillingProgramAndroid.BillingChoice
        ) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Developer-provided billing is not enabled. Set enableBillingProgramAndroid to ExternalPayments or BillingChoice."
                )
            )
        }
        return _developerProvidedBillingListener.first()
    }
}
