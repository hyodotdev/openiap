package dev.hyo.openiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.amazon.device.iap.PurchasingListener
import com.amazon.device.iap.PurchasingService
import com.amazon.device.iap.model.FulfillmentResult
import com.amazon.device.iap.model.ProductDataResponse
import com.amazon.device.iap.model.PurchaseResponse
import com.amazon.device.iap.model.PurchaseUpdatesResponse
import com.amazon.device.iap.model.UserData
import com.amazon.device.iap.model.UserDataResponse
import dev.hyo.openiap.helpers.isSubscriptionReplacementTargetCountValid
import dev.hyo.openiap.helpers.requireAuthoritativeStorefrontCountry
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.utils.toActiveSubscription
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.lang.ref.WeakReference
import java.text.NumberFormat
import java.text.ParsePosition
import java.util.Currency
import java.util.Collections
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference
import com.amazon.device.iap.model.Product as AmazonProduct
import com.amazon.device.iap.model.ProductType as AmazonProductType
import com.amazon.device.iap.model.Receipt as AmazonReceipt

private const val TAG = "OpenIapAmazon"
private const val AMAZON_REQUEST_TIMEOUT_MS = 60_000L
private const val AMAZON_PURCHASE_REQUEST_TIMEOUT_MS = 5 * 60_000L
private const val AMAZON_PURCHASE_CANCEL_FALLBACK_MS = 2_000L
private const val AMAZON_PRODUCT_DATA_BATCH_SIZE = 100
private const val AMAZON_PURCHASE_UPDATES_MAX_PAGES = 100
private const val AMAZON_EARLY_RESPONSE_CACHE_MAX = 128

internal fun withResolvedAmazonUserId(
    options: RequestVerifyPurchaseWithIapkitProps,
    userId: String,
): RequestVerifyPurchaseWithIapkitProps {
    val amazon = requireNotNull(options.amazon)
    return RequestVerifyPurchaseWithIapkitProps(
        amazon = RequestVerifyPurchaseWithIapkitAmazonProps(
            expectedProductId = amazon.expectedProductId,
            receiptId = amazon.receiptId,
            sandbox = amazon.sandbox,
            userId = userId,
        ),
        apiKey = options.apiKey,
        apple = options.apple,
        baseUrl = options.baseUrl,
        google = options.google,
        includeClientPayload = options.includeClientPayload,
    )
}

internal fun shouldIncludeAmazonReceipt(
    isCanceled: Boolean,
    hasCancelDate: Boolean,
): Boolean = !isCanceled && !hasCancelDate

internal fun configureAmazonPurchasingService(
    registerListener: () -> Unit,
    enablePendingPurchases: () -> Unit,
) {
    registerListener()
    enablePendingPurchases()
}

internal data class AmazonIssuedRequest(
    val requestId: String,
    val generation: Long,
)

internal data class AmazonNativeIssue(
    val generation: Long,
    val request: Any?,
)

private data class AmazonPurchaseIssuance(
    val sku: String,
    val generation: Long,
)

/**
 * Correlates Amazon request IDs with the logical OpenIAP connection that
 * issued them. Amazon can invoke a callback before the awaiting coroutine has
 * installed its Deferred, so endConnection must invalidate both issued and
 * already-pending requests atomically.
 */
internal class AmazonRequestLifecycle {
    private val lock = Any()
    private var generation = 0L
    private val issuesInProgressByGeneration = mutableMapOf<Long, Int>()
    private val issuedGenerations = mutableMapOf<String, Long>()

    fun beginIssue(): Long = synchronized(lock) {
        issuesInProgressByGeneration[generation] =
            (issuesInProgressByGeneration[generation] ?: 0) + 1
        generation
    }

    fun currentGeneration(): Long = synchronized(lock) { generation }

    fun isGenerationCurrent(capturedGeneration: Long): Boolean = synchronized(lock) {
        generation == capturedGeneration
    }

    fun issueIfCurrent(
        expectedGeneration: Long? = null,
        issue: () -> Any?,
    ): AmazonNativeIssue? = synchronized(lock) {
        if (expectedGeneration != null && generation != expectedGeneration) {
            return@synchronized null
        }
        val capturedGeneration = generation
        issuesInProgressByGeneration[capturedGeneration] =
            (issuesInProgressByGeneration[capturedGeneration] ?: 0) + 1
        try {
            AmazonNativeIssue(capturedGeneration, issue())
        } catch (error: Throwable) {
            finishIssueLocked(capturedGeneration)
            throw error
        }
    }

    fun cancelIssue(capturedGeneration: Long) {
        synchronized(lock) { finishIssueLocked(capturedGeneration) }
    }

    fun registerIssued(
        requestId: String,
        capturedGeneration: Long,
        onRegistered: (String) -> Unit = {},
    ): AmazonIssuedRequest? =
        synchronized(lock) {
            finishIssueLocked(capturedGeneration)
            if (generation != capturedGeneration) return@synchronized null
            AmazonIssuedRequest(requestId, capturedGeneration).also {
                issuedGenerations[requestId] = capturedGeneration
                onRegistered(requestId)
            }
        }

    fun isCurrent(request: AmazonIssuedRequest): Boolean = synchronized(lock) {
        generation == request.generation &&
            issuedGenerations[request.requestId] == request.generation
    }

    fun cacheIfCurrent(requestId: String, cache: () -> Unit): Boolean = synchronized(lock) {
        if (
            (issuesInProgressByGeneration[generation] ?: 0) <= 0 &&
            issuedGenerations[requestId] != generation
        ) {
            return@synchronized false
        }
        cache()
        true
    }

    fun installIfCurrent(request: AmazonIssuedRequest, install: () -> Unit): Boolean =
        synchronized(lock) {
            if (
                generation != request.generation ||
                issuedGenerations[request.requestId] != request.generation
            ) {
                return@synchronized false
            }
            install()
            true
        }

    fun completeIfCurrent(requestId: String, complete: () -> Unit = {}): Boolean =
        synchronized(lock) {
            if (issuedGenerations[requestId] != generation) return@synchronized false
            issuedGenerations.remove(requestId)
            complete()
            true
        }

    fun complete(requestId: String) {
        synchronized(lock) { issuedGenerations.remove(requestId) }
    }

    fun endGeneration(clearEarlyResponses: () -> Unit = {}): Set<String> = synchronized(lock) {
        generation += 1
        issuedGenerations.keys.toSet().also {
            issuedGenerations.clear()
            clearEarlyResponses()
        }
    }

    private fun finishIssueLocked(capturedGeneration: Long) {
        val remaining = (issuesInProgressByGeneration[capturedGeneration] ?: 0) - 1
        if (remaining > 0) {
            issuesInProgressByGeneration[capturedGeneration] = remaining
        } else {
            issuesInProgressByGeneration.remove(capturedGeneration)
        }
    }
}

internal class BoundedAmazonRequestIds(
    private val maximumSize: Int = 2_048,
) {
    private val lock = Any()
    private val ids = linkedSetOf<String>()

    fun add(requestId: String) {
        synchronized(lock) {
            ids.remove(requestId)
            ids.add(requestId)
            while (ids.size > maximumSize) ids.remove(ids.first())
        }
    }

    fun addAll(requestIds: Collection<String>) {
        for (requestId in requestIds) add(requestId)
    }

    fun remove(requestId: String): Boolean = synchronized(lock) { ids.remove(requestId) }

    internal fun size(): Int = synchronized(lock) { ids.size }
}

internal class AmazonPurchaseUpdatesSession {
    private val mutex = Mutex()

    suspend fun <T> run(block: suspend () -> T): T = mutex.withLock { block() }
}

internal fun <T> deduplicateAmazonPurchaseUpdates(
    items: List<T>,
    receiptId: (T) -> String,
): List<T> {
    val seenReceiptIds = mutableSetOf<String>()
    return items.filter { item ->
        val id = receiptId(item)
        id.isBlank() || seenReceiptIds.add(id)
    }
}

internal fun resolveAmazonStorefront(marketplace: String?): String =
    requireAuthoritativeStorefrontCountry(marketplace)

internal object AmazonPriceParser {
    fun toPriceAmount(displayPrice: String?): Double {
        val value = displayPrice?.trim().orEmpty()
        if (value.isEmpty()) return 0.0

        parseLocalizedPrice(value)?.let { return it }

        val numeric = value.replace(Regex("[^0-9,.-]"), "")
        if (numeric.isBlank()) return 0.0

        val lastDot = numeric.lastIndexOf('.')
        val lastComma = numeric.lastIndexOf(',')
        val decimalIndex = maxOf(lastDot, lastComma)
        val hasMixedSeparators = lastDot >= 0 && lastComma >= 0
        val fractionLength = if (decimalIndex >= 0) {
            numeric.length - decimalIndex - 1
        } else {
            0
        }
        val currencyFractionDigits = value.currencyFractionDigits()
        val separatorMatchesCurrency = currencyFractionDigits != null &&
            fractionLength == currencyFractionDigits
        val hasDecimalSeparator = decimalIndex >= 0 &&
            (hasMixedSeparators || fractionLength in 1..2 || separatorMatchesCurrency)
        val normalized = if (hasDecimalSeparator) {
            val integerPart = numeric.substring(0, decimalIndex).replace(Regex("[^0-9-]"), "")
            val fractionPart = numeric.substring(decimalIndex + 1).replace(Regex("[^0-9]"), "")
            "$integerPart.$fractionPart"
        } else {
            numeric.replace(Regex("[^0-9-]"), "")
        }
        return normalized.toDoubleOrNull() ?: 0.0
    }

    private fun parseLocalizedPrice(value: String): Double? {
        val locale = Locale.getDefault()
        return listOf(
            NumberFormat.getCurrencyInstance(locale),
            NumberFormat.getNumberInstance(locale)
        ).firstNotNullOfOrNull { format ->
            val position = ParsePosition(0)
            val parsed = format.parse(value, position)
            if (
                parsed != null &&
                position.index > 0 &&
                !value.hasUnparsedPriceCharacters(position.index)
            ) {
                parsed.toDouble()
            } else {
                null
            }
        }
    }

    private fun String.hasUnparsedPriceCharacters(startIndex: Int): Boolean {
        return drop(startIndex).any { it.isDigit() || it == '.' || it == ',' || it == '-' }
    }

    private fun String.currencyFractionDigits(): Int? {
        val code = Regex("\\b[A-Z]{3}\\b").find(this)?.value ?: return null
        return runCatching { Currency.getInstance(code).defaultFractionDigits }
            .getOrNull()
            ?.takeIf { it >= 0 }
    }
}

internal fun buildAmazonPurchase(
    packageName: String,
    receiptId: String,
    receiptSku: String,
    isSubscription: Boolean,
    purchaseDateMillis: Double,
    isCanceled: Boolean,
    isDeferred: Boolean,
    deferredSku: String? = null,
    termSku: String? = null,
    productIdOverride: String? = null,
    userIdAmazon: String? = null,
    userMarketplaceAmazon: String? = null
): PurchaseAndroid {
    val resolvedProductId = productIdOverride?.takeIf { it.isNotBlank() } ?: receiptSku
    val resolvedCurrentPlanId = termSku?.takeIf { it.isNotBlank() } ?: resolvedProductId
    val state = if (isCanceled) PurchaseState.Unknown else PurchaseState.Purchased
    val pendingSubscriptionUpdate = deferredSku
        ?.takeIf { isDeferred && it.isNotBlank() }
        ?.let { pendingSku ->
            PendingPurchaseUpdateAndroid(
                products = listOf(pendingSku),
                // Amazon exposes the deferred SKU/date on the current receipt,
                // but no separate token for the future renewal. Retain the
                // current receipt ID as the stable tracking token.
                purchaseToken = receiptId,
            )
        }
    return PurchaseAndroid(
        autoRenewingAndroid = isSubscription && !isCanceled,
        currentPlanId = if (isSubscription) resolvedCurrentPlanId else null,
        dataAndroid = "",
        id = receiptId,
        ids = listOf(resolvedProductId),
        isAcknowledgedAndroid = null,
        isAutoRenewing = isSubscription && !isCanceled,
        isSuspendedAndroid = false,
        packageNameAndroid = packageName,
        pendingPurchaseUpdateAndroid = pendingSubscriptionUpdate,
        productId = resolvedProductId,
        purchaseState = state,
        purchaseToken = receiptId,
        quantity = 1,
        signatureAndroid = null,
        store = IapStore.Amazon,
        transactionDate = purchaseDateMillis,
        transactionId = receiptId,
        userIdAmazon = userIdAmazon,
        userMarketplaceAmazon = userMarketplaceAmazon
    )
}

/**
 * OpenIapModule for Amazon Appstore SDK IAP.
 *
 * Amazon's native IAP API is listener based instead of connection based. The
 * OpenIAP connection lifecycle registers the listener, while individual API
 * calls await the matching RequestId callback.
 */
internal suspend fun unsupportedRedeemOfferCode(): Boolean = false

internal fun amazonPurchaseError(
    status: String?,
    sku: String,
): OpenIapError? = when (status) {
    "SUCCESSFUL" -> null
    "ALREADY_PURCHASED" ->
        OpenIapError.ItemAlreadyOwned("Amazon reported the item is already purchased").withProductId(sku)
    "INVALID_SKU" -> OpenIapError.SkuNotFound(sku)
    "NOT_SUPPORTED" ->
        OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device").withProductId(sku)
    "INACTIVE_BASE_SUBSCRIPTION" ->
        OpenIapError.ItemUnavailable("Amazon add-on purchase requires an active base subscription").withProductId(sku)
    "PENDING" -> OpenIapError.DeferredPurchase().withProductId(sku)
    "FAILED" ->
        OpenIapError.PurchaseFailed("Amazon purchase did not complete successfully").withProductId(sku)
    else -> OpenIapError.UnknownError("Unrecognized Amazon purchase response").withProductId(sku)
}

class OpenIapModule(
    private val context: Context,
) : OpenIapProtocol, PurchasingListener {

    private class AmazonPurchaseRequestFailure(
        val requestId: String,
        val purchaseError: OpenIapError,
    ) : Exception(purchaseError.message, purchaseError)

    private var currentActivityRef: WeakReference<Activity>? = null
    private val registrationLock = Any()
    private var isRegistered = false
    private val mainHandler by lazy(LazyThreadSafetyMode.NONE) { Handler(Looper.getMainLooper()) }
    private var pendingPurchaseRequestId: String? = null
    private var purchaseCancelFallback: Runnable? = null
    private var purchaseLifecycleCallbacks: Application.ActivityLifecycleCallbacks? = null

    private val productDataRequests = ConcurrentHashMap<String, CompletableDeferred<ProductDataResponse>>()
    private val purchaseRequests = ConcurrentHashMap<String, CompletableDeferred<PurchaseResponse>>()
    private val purchaseUpdatesRequests = ConcurrentHashMap<String, CompletableDeferred<PurchaseUpdatesResponse>>()
    private val userDataRequests = ConcurrentHashMap<String, CompletableDeferred<UserDataResponse>>()
    // Amazon userId/marketplace are needed for server-side RVS verification.
    // Purchase mapping prefers the userData carried on each Purchase(Updates)Response;
    // this cached snapshot (refreshed only by lifecycle-accepted responses and
    // cleared on endConnection) is the fallback for responses without userData.
    // One immutable snapshot keeps userId/marketplace from mixing across users.
    @Volatile private var cachedAmazonUserData: UserData? = null
    private val earlyProductDataResponses = ConcurrentHashMap<String, ProductDataResponse>()
    private val earlyPurchaseResponses = ConcurrentHashMap<String, PurchaseResponse>()
    private val earlyPurchaseUpdatesResponses = ConcurrentHashMap<String, PurchaseUpdatesResponse>()
    private val earlyUserDataResponses = ConcurrentHashMap<String, UserDataResponse>()
    private val timedOutRequestIds = BoundedAmazonRequestIds()
    private val requestLifecycle = AmazonRequestLifecycle()
    private val purchaseUpdatesSession = AmazonPurchaseUpdatesSession()
    private val purchaseTypeByReceiptId = ConcurrentHashMap<String, AmazonProductType>()
    private val purchaseSkuByRequestId = ConcurrentHashMap<String, String>()
    private val purchaseErrorsPublishedAtEnd: MutableSet<String> =
        Collections.newSetFromMap(ConcurrentHashMap())
    private val activePurchaseSku = AtomicReference<String?>(null)
    private val purchaseIssuance = AtomicReference<AmazonPurchaseIssuance?>(null)
    private val purchaseIssuanceErrorsPublishedAtEnd: MutableSet<String> =
        Collections.newSetFromMap(ConcurrentHashMap())
    private val productTypeBySku = ConcurrentHashMap<String, AmazonProductType>()

    private val purchaseUpdateListeners: MutableSet<OpenIapPurchaseUpdateListener> =
        Collections.newSetFromMap(ConcurrentHashMap())
    private val purchaseErrorListeners: MutableSet<OpenIapPurchaseErrorListener> =
        Collections.newSetFromMap(ConcurrentHashMap())

    private fun ensureRegistered() {
        synchronized(registrationLock) {
            if (isRegistered) return
            configureAmazonPurchasingService(
                registerListener = {
                    PurchasingService.registerListener(context.applicationContext, this)
                },
                enablePendingPurchases = PurchasingService::enablePendingPurchases,
            )
            isRegistered = true
        }
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
        if (activity != null) schedulePurchaseCancelFallback()
    }

    override val initConnection: MutationInitConnectionHandler = {
        withContext(Dispatchers.Main) {
            try {
                ensureRegistered()
                val response = requestUserData()
                when (response.requestStatus) {
                    UserDataResponse.RequestStatus.SUCCESSFUL -> true
                    UserDataResponse.RequestStatus.NOT_SUPPORTED -> {
                        OpenIapLog.warn("Amazon initConnection not supported on this device", TAG)
                        false
                    }
                    UserDataResponse.RequestStatus.FAILED -> {
                        OpenIapLog.warn("Amazon initConnection user data request failed", TAG)
                        false
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                OpenIapLog.error("Amazon initConnection failed: ${error.message}", error, TAG)
                false
            }
        }
    }

    override val endConnection: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            val disconnectMessage =
                "Amazon Appstore connection ended while a request was in progress"
            // Mark issued IDs before touching pending maps. A request may have
            // returned its native ID but not installed its Deferred yet.
            val abortedRequestIds = requestLifecycle.endGeneration {
                earlyProductDataResponses.clear()
                earlyPurchaseResponses.clear()
                earlyPurchaseUpdatesResponses.clear()
                earlyUserDataResponses.clear()
                clearPurchaseRequestTracking()
                cachedAmazonUserData = null
            }
            timedOutRequestIds.addAll(abortedRequestIds)
            val abortedMappedSkus = mutableSetOf<String>()
            for (requestId in abortedRequestIds) {
                purchaseSkuByRequestId[requestId]?.let { sku ->
                    abortedMappedSkus += sku
                    if (purchaseErrorsPublishedAtEnd.add(requestId)) {
                        emitPurchaseError(
                            OpenIapError.ServiceDisconnected(
                                "Amazon Appstore connection ended during purchase"
                            ).withProductId(sku)
                        )
                    }
                }
            }
            purchaseIssuance.get()
                ?.takeUnless { requestLifecycle.isGenerationCurrent(it.generation) }
                ?.sku
                ?.takeUnless { it in abortedMappedSkus }
                ?.let { sku ->
                    if (purchaseIssuanceErrorsPublishedAtEnd.add(sku)) {
                        emitPurchaseError(
                            OpenIapError.ServiceDisconnected(
                                "Amazon Appstore connection ended while issuing purchase"
                            ).withProductId(sku)
                        )
                    }
                }
            failPendingAmazonRequests(productDataRequests, abortedRequestIds, disconnectMessage)
            failPendingAmazonRequests(purchaseRequests, abortedRequestIds, disconnectMessage)
            failPendingAmazonRequests(purchaseUpdatesRequests, abortedRequestIds, disconnectMessage)
            failPendingAmazonRequests(userDataRequests, abortedRequestIds, disconnectMessage)
            true
        }
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val queryType = params.type ?: ProductQueryType.All
            if (params.skus.isEmpty()) {
                throw OpenIapError.EmptySkuList
            }
            val operationGeneration = requestLifecycle.currentGeneration()

            val responses = params.skus
                .chunked(AMAZON_PRODUCT_DATA_BATCH_SIZE)
                .let { batches ->
                    coroutineScope {
                        batches.map { batch ->
                            async { requestProductData(batch, operationGeneration) }
                        }.awaitAll()
                    }
                }
            val failedResponse = responses.firstOrNull {
                it.requestStatus != ProductDataResponse.RequestStatus.SUCCESSFUL
            }

            when (failedResponse?.requestStatus ?: ProductDataResponse.RequestStatus.SUCCESSFUL) {
                ProductDataResponse.RequestStatus.SUCCESSFUL -> {
                    val products = responses.flatMap { response ->
                        response.productData.orEmpty().values
                    }
                        .sortedWith(compareBy { product ->
                            params.skus.indexOf(product.sku).takeIf { it >= 0 } ?: Int.MAX_VALUE
                        })
                    products.forEach(::cacheProductType)

                    val inApps = products
                        .filter { it.productType != AmazonProductType.SUBSCRIPTION }
                        .map { it.toInAppProduct() }
                    val subscriptions = products
                        .filter { it.productType == AmazonProductType.SUBSCRIPTION }
                        .map { it.toSubscriptionProduct() }

                    when (queryType) {
                        ProductQueryType.InApp -> FetchProductsResultProducts(inApps)
                        ProductQueryType.Subs -> FetchProductsResultSubscriptions(subscriptions)
                        ProductQueryType.All -> {
                            val allItems = buildList {
                                inApps.forEach { add(ProductOrSubscription.ProductItem(it)) }
                                subscriptions.forEach { add(ProductOrSubscription.ProductSubscriptionItem(it)) }
                            }
                            FetchProductsResultAll(allItems)
                        }
                    }
                }
                ProductDataResponse.RequestStatus.NOT_SUPPORTED -> {
                    throw OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device")
                }
                ProductDataResponse.RequestStatus.FAILED -> {
                    throw OpenIapError.QueryProduct.withDiagnostics(
                        debugMessage = "Amazon getProductData failed",
                        productIds = params.skus,
                        productType = queryType.rawValue,
                        isEmptyProductList = responses.all { it.productData.isNullOrEmpty() }
                    )
                }
            }
        }
    }

    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { options ->
        withContext(Dispatchers.IO) {
            val purchases = getAvailableItems(ProductQueryType.All)
            if (options?.includeSuspendedAndroid == true) {
                purchases
            } else {
                purchases.filterNot { (it as? PurchaseAndroid)?.isSuspendedAndroid == true }
            }
        }
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            val ids = subscriptionIds.orEmpty().toSet()
            getAvailablePurchases(null)
                .filterIsInstance<PurchaseAndroid>()
                .filter { purchase ->
                    purchase.isAutoRenewing && (ids.isEmpty() || purchase.productId in ids)
                }
                .map { purchase -> purchase.toActiveSubscription() }
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = try {
            withContext(Dispatchers.IO) {
                ensureRegistered()
                val androidArgs = props.toAndroidPurchaseArgs()
                if (androidArgs.skus.isEmpty()) {
                    emitPurchaseErrorAndThrow(OpenIapError.EmptySkuList)
                }
                if (!isSubscriptionReplacementTargetCountValid(
                        targetSkuCount = androidArgs.skus.size,
                        hasProductLevelReplacementParams =
                            androidArgs.subscriptionProductReplacementParams != null,
                    )
                ) {
                    emitPurchaseErrorAndThrow(
                        OpenIapError.DeveloperError(
                            "subscriptionProductReplacementParams requires exactly one target SKU"
                        )
                    )
                }
                if (androidArgs.subscriptionProductReplacementParams != null) {
                    emitPurchaseErrorAndThrow(
                        OpenIapError.FeatureNotSupported(
                            "subscriptionProductReplacementParams is only supported by Google Play"
                        )
                    )
                }
                if (androidArgs.skus.size != 1) {
                    emitPurchaseErrorAndThrow(
                        OpenIapError.DeveloperError("Amazon Appstore SDK purchases one SKU at a time")
                    )
                }

                val sku = androidArgs.skus.first()
                if (!activePurchaseSku.compareAndSet(null, sku)) {
                    emitPurchaseErrorAndThrow(
                        OpenIapError.DeveloperError(
                            "Another Amazon purchase is already in progress"
                        ).withProductId(sku)
                    )
                }
                val purchaseGeneration = requestLifecycle.currentGeneration()
                val response = try {
                    requestAmazonPurchase(sku)
                } catch (error: CancellationException) {
                    purchaseIssuanceErrorsPublishedAtEnd.remove(sku)
                    throw error
                } catch (error: Throwable) {
                    val correlated = error as? AmazonPurchaseRequestFailure
                    val requestId = correlated?.requestId
                    val purchaseError = correlated?.purchaseError
                        ?: error.toOpenIapError("Amazon purchase request failed")
                            .withProductId(sku)
                    val alreadyPublished = if (requestId != null) {
                        purchaseErrorsPublishedAtEnd.remove(requestId)
                    } else {
                        purchaseIssuanceErrorsPublishedAtEnd.remove(sku)
                    }
                    requestId?.let(purchaseSkuByRequestId::remove)
                    if (alreadyPublished) throw purchaseError
                    emitPurchaseErrorAndThrow(purchaseError)
                } finally {
                    activePurchaseSku.compareAndSet(sku, null)
                }
                purchaseSkuByRequestId.remove(response.requestId.toString())
                purchaseErrorsPublishedAtEnd.remove(response.requestId.toString())
                when (response.requestStatus) {
                    PurchaseResponse.RequestStatus.SUCCESSFUL -> {
                        val receipt = response.receipt ?: run {
                            emitPurchaseErrorAndThrow(
                                OpenIapError.PurchaseFailed("Amazon purchase response did not include a receipt")
                                    .withProductId(sku)
                            )
                        }
                        if (!receipt.sku.isNullOrBlank() && receipt.sku != sku) {
                            OpenIapLog.warn(
                                "Amazon receipt SKU '${receipt.sku}' differs from requested SKU '$sku'. " +
                                    "Using the requested SKU for the OpenIAP purchase productId; " +
                                    "align the Amazon catalog and App Tester data for restore and server verification.",
                                TAG
                            )
                        }
                        // This response is correlated by Amazon requestId, so the
                        // local request SKU is safe even when callbacks arrive out
                        // of order.
                        cacheReceiptProduct(receipt, receipt.productTypeOrNull())
                        if (requestLifecycle.isGenerationCurrent(purchaseGeneration)) {
                            response.userData?.let { rememberAmazonUserData(it) }
                        }
                        val purchase = receipt.toPurchase(
                            productTypeOverride = receipt.productTypeOrNull(),
                            productIdOverride = sku,
                            userData = response.userData
                        )
                        for (listener in purchaseUpdateListeners) {
                            runCatching { listener.onPurchaseUpdated(purchase) }
                        }
                        listOf(purchase)
                    }
                    else -> emitPurchaseErrorAndThrow(
                        checkNotNull(amazonPurchaseError(response.requestStatus.name, sku))
                    )
                }
            }
        } catch (_: OpenIapError) {
            // The error was already published by emitPurchaseErrorAndThrow.
            // Keep the request event-based, matching the Play implementation.
            emptyList()
        }
        RequestPurchaseResultPurchases(purchases)
    }

    suspend fun getAvailableItems(type: ProductQueryType): List<Purchase> = withContext(Dispatchers.IO) {
        requestPurchaseUpdates(reset = true).filter { purchase ->
            val receiptId = purchase.purchaseToken ?: purchase.id
            val productType = purchaseTypeByReceiptId[receiptId]
                ?: productTypeBySku[purchase.productId]
            when (type) {
                ProductQueryType.All -> true
                ProductQueryType.Subs -> productType == AmazonProductType.SUBSCRIPTION
                ProductQueryType.InApp -> productType != AmazonProductType.SUBSCRIPTION
            }
        }
    }

    override val finishTransaction: MutationFinishTransactionHandler = { purchase, _ ->
        withContext(Dispatchers.IO) {
            ensureRegistered()
            val receiptId = purchase.purchaseToken ?: purchase.id
            if (receiptId.isBlank()) {
                throw OpenIapError.PurchaseFailed("Missing Amazon receiptId")
            }
            PurchasingService.notifyFulfillment(receiptId, FulfillmentResult.FULFILLED)
        }
    }

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { purchaseToken ->
        acknowledgePurchase(purchaseToken)
    }

    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler = { purchaseToken ->
        consumePurchase(purchaseToken)
    }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            requestPurchaseUpdates(reset = true)
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = {
        withContext(Dispatchers.Main) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("amzn://apps/android?p=${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(intent) }
                .onFailure { OpenIapLog.warn("Amazon subscription deep link unavailable: ${it.message}", TAG) }
        }
    }

    override val verifyPurchase: MutationVerifyPurchaseHandler = {
        throw OpenIapError.FeatureNotSupported(
            "Amazon receipt verification requires server-side RVS integration"
        )
    }

    override val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler = {
        if (it.provider != PurchaseVerificationProvider.Iapkit) {
            throw OpenIapError.FeatureNotSupported()
        }
        val options = it.iapkit ?: throw OpenIapError.DeveloperError(
            "Missing IAPKit verification parameters"
        )
        val payloadCount = listOfNotNull(options.apple, options.google, options.amazon).size
        val amazon = options.amazon
        if (payloadCount != 1 || amazon == null) {
            throw OpenIapError.DeveloperError(
                "Amazon IAPKit verification requires exactly one amazon payload"
            )
        }
        val resolvedOptions = if (amazon.userId.isNullOrBlank()) {
            val userDataResponse = requestUserData()
            val userId = userDataResponse.userData?.userId
                ?: throw OpenIapError.DeveloperError("Amazon IAPKit verification could not resolve userId")
            withResolvedAmazonUserId(options, userId)
        } else {
            options
        }

        VerifyPurchaseWithProviderResult(
            iapkit = verifyPurchaseWithIapkit(resolvedOptions, TAG),
            provider = it.provider
        )
    }

    private val purchaseError: SubscriptionPurchaseErrorHandler = {
        onPurchaseError(this::addPurchaseErrorListener, this::removePurchaseErrorListener)
    }

    private val purchaseUpdated: SubscriptionPurchaseUpdatedHandler = {
        onPurchaseUpdated(this::addPurchaseUpdateListener, this::removePurchaseUpdateListener)
    }

    private val subscriptionBillingIssue: SubscriptionSubscriptionBillingIssueHandler = {
        // Amazon Appstore SDK does not expose a suspended-subscription event, so
        // fail immediately instead of leaving consumers waiting forever.
        throw OpenIapError.FeatureNotSupported()
    }

    private val userChoiceBillingAndroid: SubscriptionUserChoiceBillingAndroidHandler = {
        throw OpenIapError.FeatureNotSupported(
            "Amazon Appstore does not support User Choice Billing events",
        )
    }

    private val developerProvidedBillingAndroid: SubscriptionDeveloperProvidedBillingAndroidHandler = {
        throw OpenIapError.FeatureNotSupported(
            "Amazon Appstore does not support Developer Provided Billing events",
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

    override val mutationHandlers: MutationHandlers = MutationHandlers(
        acknowledgePurchaseAndroid = acknowledgePurchaseAndroid,
        consumePurchaseAndroid = consumePurchaseAndroid,
        createBillingProgramReportingDetailsAndroid = { program, developerBillingType ->
            createBillingProgramReportingDetails(program, developerBillingType)
        },
        deepLinkToSubscriptions = deepLinkToSubscriptions,
        endConnection = endConnection,
        finishTransaction = finishTransaction,
        initConnection = initConnection,
        isBillingProgramAvailableAndroid = { program -> isBillingProgramAvailable(program) },
        launchExternalLinkAndroid = { params ->
            val activity = currentActivityRef?.get()
                ?: throw OpenIapError.MissingCurrentActivity
            launchExternalLink(activity, params)
        },
        // Amazon has no redemption surface; these no-ops must not require an Activity.
        openRedeemOfferCode = { null },
        openRedeemOfferCodeAndroid = { unsupportedRedeemOfferCode() },
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        showBillingProgramInformationDialogAndroid = { params ->
            val activity = currentActivityRef?.get()
                ?: throw OpenIapError.MissingCurrentActivity
            showBillingProgramInformationDialog(activity, params)
        },
        showInAppMessagesAndroid = { params ->
            val activity = currentActivityRef?.get()
                ?: throw OpenIapError.MissingCurrentActivity
            showInAppMessages(activity, params)
        },
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

    suspend fun getStorefront(): String = withContext(Dispatchers.IO) {
        try {
            val response = requestUserData()
            when (response.requestStatus) {
                UserDataResponse.RequestStatus.SUCCESSFUL ->
                    resolveAmazonStorefront(response.userData?.marketplace)
                UserDataResponse.RequestStatus.NOT_SUPPORTED ->
                    throw OpenIapError.FeatureNotSupported(
                        "Amazon Appstore storefront is not supported on this device"
                    )
                UserDataResponse.RequestStatus.FAILED ->
                    throw OpenIapError.ServiceUnavailable(
                        "Amazon Appstore user data request failed"
                    )
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            val mapped = error as? OpenIapError
                ?: OpenIapError.ServiceUnavailable(error.message)
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

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) = Unit

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) = Unit

    override fun addDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) = Unit

    override fun removeDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) = Unit

    override fun addSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener) = Unit

    override fun removeSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener) = Unit

    override suspend fun isBillingProgramAvailable(
        program: BillingProgramAndroid
    ): BillingProgramAvailabilityResultAndroid = BillingProgramAvailabilityResultAndroid(
        billingProgram = program,
        isAvailable = false
    )

    override suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid {
        throw OpenIapError.FeatureNotSupported("Amazon Appstore does not support Google Play billing programs")
    }

    override suspend fun launchExternalLink(
        activity: Activity,
        params: LaunchExternalLinkParamsAndroid
    ): Boolean = false

    override suspend fun openRedeemOfferCode(activity: Activity): Boolean {
        // No-op: offer-code redemption is a Google Play feature, not supported on Amazon Appstore
        OpenIapLog.warn("openRedeemOfferCode is not supported on Amazon (no-op)", TAG)
        return unsupportedRedeemOfferCode()
    }

    override suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid {
        throw OpenIapError.FeatureNotSupported("Amazon Appstore does not support Google Play Billing Choice")
    }

    override suspend fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid {
        throw OpenIapError.FeatureNotSupported("Amazon Appstore does not support Google Play Billing Choice")
    }

    override suspend fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParamsAndroid?
    ): InAppMessageResultAndroid {
        throw OpenIapError.FeatureNotSupported("Amazon Appstore does not support Google Play billing in-app messages")
    }

    private fun rememberAmazonUserData(userData: UserData) {
        if (userData.userId.isNullOrBlank()) return
        cachedAmazonUserData = userData
    }

    override fun onUserDataResponse(userDataResponse: UserDataResponse) {
        val accepted = completeOrCache(
            userDataRequests,
            earlyUserDataResponses,
            userDataResponse.requestId.toString(),
            userDataResponse
        )
        // Cache only lifecycle-accepted callbacks so a late response cannot
        // overwrite the active identity after endConnection or a newer request.
        if (accepted && userDataResponse.requestStatus == UserDataResponse.RequestStatus.SUCCESSFUL) {
            userDataResponse.userData?.let { rememberAmazonUserData(it) }
        }
    }

    override fun onProductDataResponse(productDataResponse: ProductDataResponse) {
        completeOrCache(
            productDataRequests,
            earlyProductDataResponses,
            productDataResponse.requestId.toString(),
            productDataResponse
        )
    }

    override fun onPurchaseResponse(purchaseResponse: PurchaseResponse) {
        clearPurchaseRequestTracking(purchaseResponse.requestId.toString())
        completeOrCache(
            purchaseRequests,
            earlyPurchaseResponses,
            purchaseResponse.requestId.toString(),
            purchaseResponse
        )
    }

    private fun trackPurchaseRequest(requestId: String) {
        pendingPurchaseRequestId = requestId
        registerPurchaseLifecycleCallbacks()
    }

    private fun registerPurchaseLifecycleCallbacks() {
        if (purchaseLifecycleCallbacks != null) return
        val application = context.applicationContext as? Application ?: return
        val callbacks = object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                schedulePurchaseCancelFallback()
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        }
        application.registerActivityLifecycleCallbacks(callbacks)
        purchaseLifecycleCallbacks = callbacks
    }

    private fun schedulePurchaseCancelFallback() {
        val requestId = pendingPurchaseRequestId ?: return
        purchaseCancelFallback?.let(mainHandler::removeCallbacks)
        val fallback = Runnable {
            val pending = purchaseRequests[requestId] ?: return@Runnable
            if (!pending.isCompleted) {
                pending.completeExceptionally(
                    OpenIapError.UserCancelled("Amazon purchase failed or was cancelled")
                )
            }
        }
        purchaseCancelFallback = fallback
        mainHandler.postDelayed(fallback, AMAZON_PURCHASE_CANCEL_FALLBACK_MS)
    }

    private fun clearPurchaseRequestTracking(requestId: String? = null) {
        val pendingRequestId = pendingPurchaseRequestId
        if (requestId != null && pendingRequestId != null && requestId != pendingRequestId) {
            return
        }
        purchaseCancelFallback?.let(mainHandler::removeCallbacks)
        purchaseCancelFallback = null
        pendingPurchaseRequestId = null
        val callbacks = purchaseLifecycleCallbacks ?: return
        (context.applicationContext as? Application)?.unregisterActivityLifecycleCallbacks(callbacks)
        purchaseLifecycleCallbacks = null
    }

    override fun onPurchaseUpdatesResponse(purchaseUpdatesResponse: PurchaseUpdatesResponse) {
        completeOrCache(
            purchaseUpdatesRequests,
            earlyPurchaseUpdatesResponses,
            purchaseUpdatesResponse.requestId.toString(),
            purchaseUpdatesResponse
        )
    }

    private fun emitPurchaseError(error: OpenIapError) {
        for (listener in purchaseErrorListeners) {
            runCatching { listener.onPurchaseError(error) }
        }
    }

    private fun emitPurchaseErrorAndThrow(error: OpenIapError): Nothing {
        emitPurchaseError(error)
        throw error
    }

    private fun issueAmazonRequest(
        operation: String,
        missingRequestError: () -> OpenIapError,
        onRegistered: (String) -> Unit = {},
        expectedGeneration: Long? = null,
        issue: () -> Any?,
    ): AmazonIssuedRequest {
        val nativeIssue = requestLifecycle.issueIfCurrent(expectedGeneration, issue)
            ?: throw OpenIapError.ServiceDisconnected(
                "Amazon Appstore connection ended before issuing $operation"
            )
        val generation = nativeIssue.generation
        val request = nativeIssue.request
        if (request == null) {
            requestLifecycle.cancelIssue(generation)
            throw missingRequestError()
        }
        val requestId = request.toString()
        return requestLifecycle.registerIssued(requestId, generation, onRegistered)
            ?: run {
                timedOutRequestIds.add(requestId)
                discardEarlyAmazonResponse(requestId)
                throw OpenIapError.ServiceDisconnected(
                    "Amazon Appstore connection ended while issuing $operation"
                )
            }
    }

    private fun discardEarlyAmazonResponse(requestId: String) {
        earlyProductDataResponses.remove(requestId)
        earlyPurchaseResponses.remove(requestId)
        earlyPurchaseUpdatesResponses.remove(requestId)
        earlyUserDataResponses.remove(requestId)
    }

    private suspend fun requestUserData(): UserDataResponse {
        val operationGeneration = requestLifecycle.currentGeneration()
        val issuedRequest = withContext(Dispatchers.Main) {
            ensureRegistered()
            issueAmazonRequest(
                operation = "getUserData",
                missingRequestError = { OpenIapError.InitConnection },
                expectedGeneration = operationGeneration,
            ) {
                runCatching { PurchasingService.getUserData() }
                    .getOrElse {
                    throw OpenIapError.InitConnection
                }
            }
        }
        return awaitAmazonResponse(issuedRequest, userDataRequests, earlyUserDataResponses)
    }

    private suspend fun requestProductData(
        skus: List<String>,
        expectedGeneration: Long,
    ): ProductDataResponse {
        val issuedRequest = withContext(Dispatchers.Main) {
            ensureRegistered()
            issueAmazonRequest(
                operation = "getProductData",
                missingRequestError = {
                    OpenIapError.QueryProduct.withDiagnostics(
                    debugMessage = "Amazon getProductData failed to return a requestId",
                    productIds = skus
                    )
                },
                expectedGeneration = expectedGeneration,
            ) {
                runCatching { PurchasingService.getProductData(skus.toSet()) }
                    .getOrElse { error ->
                        throw error.toOpenIapError("Amazon getProductData request failed")
                    }
            }
        }
        return awaitAmazonResponse(issuedRequest, productDataRequests, earlyProductDataResponses)
    }

    private suspend fun requestAmazonPurchase(sku: String): PurchaseResponse {
        val issuance = AmazonPurchaseIssuance(
            sku = sku,
            generation = requestLifecycle.currentGeneration(),
        )
        check(purchaseIssuance.compareAndSet(null, issuance)) {
            "Amazon purchase issuance must be single-flight"
        }
        val issuedRequest = try {
            withContext(Dispatchers.Main) {
                ensureRegistered()
                issueAmazonRequest(
                    operation = "purchase",
                    missingRequestError = {
                        OpenIapError.PurchaseFailed(
                            "Amazon purchase request did not return a requestId"
                        ).withProductId(sku)
                    },
                    onRegistered = { requestId ->
                        purchaseSkuByRequestId[requestId] = sku
                        trackPurchaseRequest(requestId)
                    },
                    expectedGeneration = issuance.generation,
                ) {
                    runCatching { PurchasingService.purchase(sku) }
                        .getOrElse { error ->
                            throw error.toOpenIapError("Amazon purchase request failed")
                                .withProductId(sku)
                        }
                }
            }
        } finally {
            purchaseIssuance.compareAndSet(issuance, null)
        }
        return try {
            awaitAmazonResponse(
                issuedRequest,
                purchaseRequests,
                earlyPurchaseResponses,
                timeoutMs = AMAZON_PURCHASE_REQUEST_TIMEOUT_MS
            )
        } catch (error: CancellationException) {
            purchaseSkuByRequestId.remove(issuedRequest.requestId)
            purchaseErrorsPublishedAtEnd.remove(issuedRequest.requestId)
            throw error
        } catch (error: Throwable) {
            val purchaseError = error.toOpenIapError("Amazon purchase request failed")
                .withProductId(sku)
            throw AmazonPurchaseRequestFailure(
                requestId = issuedRequest.requestId,
                purchaseError = purchaseError,
            )
        } finally {
            clearPurchaseRequestTracking(issuedRequest.requestId)
        }
    }

    private suspend fun requestPurchaseUpdates(reset: Boolean): List<Purchase> =
        purchaseUpdatesSession.run {
            val operationGeneration = requestLifecycle.currentGeneration()
            val receipts = mutableListOf<AmazonReceipt>()
            var shouldReset = reset
            var pageCount = 0
            var hasMore = false
            var responseUserData: UserData? = null
            do {
                if (pageCount >= AMAZON_PURCHASE_UPDATES_MAX_PAGES) {
                    throw OpenIapError.ServiceTimeout(
                        "Amazon purchase updates exceeded pagination limit ($AMAZON_PURCHASE_UPDATES_MAX_PAGES pages)"
                    )
                }
                pageCount += 1
                val response = awaitPurchaseUpdates(shouldReset, operationGeneration)
                shouldReset = false
                when (response.requestStatus) {
                    PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL -> {
                        response.userData?.let {
                            responseUserData = it
                            if (requestLifecycle.isGenerationCurrent(operationGeneration)) {
                                rememberAmazonUserData(it)
                            }
                        }
                        receipts += response.receipts.orEmpty()
                            .filter {
                                shouldIncludeAmazonReceipt(
                                    isCanceled = it.isCanceled,
                                    hasCancelDate = it.cancelDate != null,
                                )
                            }
                    }
                    PurchaseUpdatesResponse.RequestStatus.NOT_SUPPORTED -> {
                        throw OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device")
                    }
                    PurchaseUpdatesResponse.RequestStatus.FAILED -> {
                        throw OpenIapError.RestoreFailed
                    }
                }
                hasMore = response.hasMore()
            } while (hasMore)
            val uniqueReceipts = deduplicateAmazonPurchaseUpdates(receipts) {
                it.receiptId.orEmpty()
            }
            hydrateProductTypesForReceipts(uniqueReceipts, operationGeneration)
            uniqueReceipts.map { receipt ->
                val productType = receipt.productTypeOrNull()
                    ?: productTypeBySku[receipt.sku.orEmpty()]
                cacheReceiptProduct(receipt, productType)
                receipt.toPurchase(
                    productTypeOverride = productType,
                    userData = responseUserData,
                )
            }
        }

    private suspend fun hydrateProductTypesForReceipts(
        receipts: List<AmazonReceipt>,
        expectedGeneration: Long,
    ) {
        val missingSkus = linkedSetOf<String>()
        for (receipt in receipts) {
            val sku = receipt.sku.orEmpty()
            if (sku.isBlank()) continue

            val productType = receipt.productTypeOrNull()
            if (productType != null) {
                cacheReceiptProduct(receipt, productType)
            } else if (!productTypeBySku.containsKey(sku)) {
                missingSkus += sku
            }
        }
        if (missingSkus.isEmpty()) return

        missingSkus.chunked(AMAZON_PRODUCT_DATA_BATCH_SIZE).forEach { batch ->
            val response = requestProductData(batch, expectedGeneration)
            when (response.requestStatus) {
                ProductDataResponse.RequestStatus.SUCCESSFUL -> {
                    response.productData.orEmpty().values.forEach { product ->
                        cacheProductType(product)
                    }
                }
                ProductDataResponse.RequestStatus.NOT_SUPPORTED -> {
                    throw OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device")
                }
                ProductDataResponse.RequestStatus.FAILED -> {
                    throw OpenIapError.QueryProduct.withDiagnostics(
                        debugMessage = "Amazon getProductData failed while hydrating purchase types",
                        productIds = batch,
                        productType = ProductQueryType.All.rawValue,
                        isEmptyProductList = response.productData.isNullOrEmpty()
                    )
                }
            }
        }
    }

    private fun cacheReceiptProduct(
        receipt: AmazonReceipt,
        productType: AmazonProductType?,
    ) {
        val receiptId = receipt.receiptId.orEmpty()
        val sku = receipt.sku.orEmpty()
        if (productType != null && receiptId.isNotBlank()) {
            purchaseTypeByReceiptId[receiptId] = productType
        }
        if (productType != null && sku.isNotBlank()) {
            productTypeBySku[sku] = productType
        }
    }

    private fun cacheProductType(product: AmazonProduct) {
        val sku = runCatching { product.sku }.getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?: return
        val productType = runCatching { product.productType }.getOrNull() ?: return
        productTypeBySku[sku] = productType
    }

    private fun AmazonReceipt.productTypeOrNull(): AmazonProductType? {
        return runCatching { productType }.getOrNull()
    }

    private fun Throwable.toOpenIapError(defaultMessage: String): OpenIapError {
        return this as? OpenIapError
            ?: OpenIapError.PurchaseFailed("$defaultMessage: ${message ?: javaClass.simpleName}")
    }

    private suspend fun awaitPurchaseUpdates(
        reset: Boolean,
        expectedGeneration: Long,
    ): PurchaseUpdatesResponse {
        val issuedRequest = withContext(Dispatchers.Main) {
            ensureRegistered()
            issueAmazonRequest(
                operation = "getPurchaseUpdates",
                missingRequestError = { OpenIapError.RestoreFailed },
                expectedGeneration = expectedGeneration,
            ) {
                runCatching { PurchasingService.getPurchaseUpdates(reset) }
                    .getOrElse { throw OpenIapError.RestoreFailed }
            }
        }
        return awaitAmazonResponse(
            issuedRequest,
            purchaseUpdatesRequests,
            earlyPurchaseUpdatesResponses
        )
    }

    private suspend fun <T> awaitAmazonResponse(
        issuedRequest: AmazonIssuedRequest,
        pending: ConcurrentHashMap<String, CompletableDeferred<T>>,
        earlyResponses: ConcurrentHashMap<String, T>,
        timeoutMs: Long = AMAZON_REQUEST_TIMEOUT_MS
    ): T {
        val requestId = issuedRequest.requestId
        if (!requestLifecycle.isCurrent(issuedRequest)) {
            timedOutRequestIds.add(requestId)
            throw OpenIapError.ServiceDisconnected(
                "Amazon Appstore connection ended before the response wait was installed"
            )
        }
        val earlyResponse = earlyResponses.remove(requestId)
        if (earlyResponse != null) {
            if (requestLifecycle.completeIfCurrent(requestId)) return earlyResponse
            timedOutRequestIds.add(requestId)
            throw OpenIapError.ServiceDisconnected(
                "Amazon Appstore connection ended before the early response was claimed"
            )
        }

        val deferred = CompletableDeferred<T>()
        val installed = requestLifecycle.installIfCurrent(issuedRequest) {
            pending[requestId] = deferred
        }
        if (!installed) {
            pending.remove(requestId, deferred)
            timedOutRequestIds.add(requestId)
            throw OpenIapError.ServiceDisconnected(
                "Amazon Appstore connection ended while the response wait was being installed"
            )
        }
        earlyResponses.remove(requestId)?.let { response ->
            pending.remove(requestId, deferred)
            if (requestLifecycle.completeIfCurrent(requestId)) return response
            timedOutRequestIds.add(requestId)
            throw OpenIapError.ServiceDisconnected(
                "Amazon Appstore connection ended before the early response was claimed"
            )
        }

        return try {
            withTimeout(timeoutMs) { deferred.await() }
        } catch (_: TimeoutCancellationException) {
            timedOutRequestIds.add(requestId)
            earlyResponses.remove(requestId)
            throw OpenIapError.ServiceTimeout("Amazon Appstore request timed out")
        } catch (error: CancellationException) {
            timedOutRequestIds.add(requestId)
            earlyResponses.remove(requestId)
            throw error
        } finally {
            pending.remove(requestId, deferred)
            requestLifecycle.complete(requestId)
        }
    }

    /**
     * Returns true when the response was accepted by the current request
     * lifecycle (delivered to its Deferred or cached as an early response),
     * false when it was ignored as timed-out, ended, or unknown.
     */
    private fun <T> completeOrCache(
        pending: ConcurrentHashMap<String, CompletableDeferred<T>>,
        earlyResponses: ConcurrentHashMap<String, T>,
        requestId: String,
        value: T
    ): Boolean {
        if (timedOutRequestIds.remove(requestId)) {
            requestLifecycle.complete(requestId)
            OpenIapLog.warn(
                "Ignoring late Amazon Appstore response for aborted request $requestId",
                TAG
            )
            return false
        }
        val deferred = pending[requestId]
        if (deferred != null) {
            val accepted = requestLifecycle.completeIfCurrent(requestId) {
                pending.remove(requestId, deferred)
                if (!deferred.isCompleted) deferred.complete(value)
            }
            if (!accepted) {
                OpenIapLog.warn(
                    "Ignoring Amazon Appstore response for an ended request $requestId",
                    TAG,
                )
            }
            return accepted
        }
        val cached = requestLifecycle.cacheIfCurrent(requestId) {
            if (earlyResponses.size >= AMAZON_EARLY_RESPONSE_CACHE_MAX) {
                earlyResponses.keys.firstOrNull()?.let(earlyResponses::remove)
            }
            earlyResponses[requestId] = value
        }
        if (!cached) {
            OpenIapLog.warn(
                "Ignoring Amazon Appstore response for unknown request $requestId",
                TAG,
            )
        }
        return cached
    }

    private fun <T> failPendingAmazonRequests(
        pending: ConcurrentHashMap<String, CompletableDeferred<T>>,
        abortedRequestIds: Set<String>,
        debugMessage: String,
    ) {
        for (requestId in abortedRequestIds) {
            pending.remove(requestId)?.let { deferred ->
                // Reuse the late-response suppression set so a store callback
                // arriving after endConnection cannot be retained as an early
                // response for a future logical connection.
                timedOutRequestIds.add(requestId)
                deferred.completeExceptionally(
                    OpenIapError.ServiceDisconnected(debugMessage)
                )
            }
        }
    }

    private suspend fun acknowledgePurchase(purchaseToken: String): Boolean = fulfillPurchase(
        purchaseToken = purchaseToken,
        operation = "acknowledge"
    )

    private suspend fun consumePurchase(purchaseToken: String): Boolean = fulfillPurchase(
        purchaseToken = purchaseToken,
        operation = "consume"
    )

    private suspend fun fulfillPurchase(
        purchaseToken: String,
        operation: String
    ): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            ensureRegistered()
            PurchasingService.notifyFulfillment(purchaseToken, FulfillmentResult.FULFILLED)
            true
        }.getOrElse {
            OpenIapLog.warn("Amazon $operation failed: ${it.message}", TAG)
            false
        }
    }

    private fun AmazonProduct.toInAppProduct(): ProductAndroid {
        return ProductAndroid(
            currency = "",
            debugDescription = description,
            description = description.orEmpty(),
            displayName = title,
            displayPrice = price.orEmpty(),
            id = sku,
            nameAndroid = title.orEmpty(),
            platform = IapPlatform.Android,
            price = price.toPriceAmount(),
            productStatusAndroid = ProductStatusAndroid.Ok,
            title = title.orEmpty(),
            type = ProductType.InApp
        )
    }

    private fun AmazonProduct.toSubscriptionProduct(): ProductSubscriptionAndroid {
        val subscriptionPeriod = this.subscriptionPeriod.toIsoBillingPeriod()
        val priceAmount = price.toPriceAmount()
        val phase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = subscriptionPeriod,
            formattedPrice = price.orEmpty(),
            priceAmountMicros = "0",
            priceCurrencyCode = "",
            recurrenceMode = 1
        )
        val phases = PricingPhasesAndroid(listOf(phase))
        val standardizedOffer = SubscriptionOffer(
            basePlanIdAndroid = sku,
            currency = "",
            displayPrice = price.orEmpty(),
            id = sku,
            offerTagsAndroid = emptyList(),
            offerTokenAndroid = "",
            paymentMode = PaymentMode.PayAsYouGo,
            period = null,
            price = priceAmount,
            pricingPhasesAndroid = phases,
            type = DiscountOfferType.Introductory
        )
        return ProductSubscriptionAndroid(
            currency = "",
            debugDescription = description,
            description = description.orEmpty(),
            displayName = title,
            displayPrice = price.orEmpty(),
            id = sku,
            nameAndroid = title.orEmpty(),
            platform = IapPlatform.Android,
            price = priceAmount,
            productStatusAndroid = ProductStatusAndroid.Ok,
            subscriptionOffers = listOf(standardizedOffer),
            title = title.orEmpty(),
            type = ProductType.Subs
        )
    }

    private fun String?.toIsoBillingPeriod(): String {
        val value = this?.trim().orEmpty()
        if (value.isEmpty() || value.startsWith("P")) return value

        return when (value.lowercase(Locale.ROOT)) {
            "weekly", "week", "1 week" -> "P1W"
            "biweekly", "bi-weekly", "bi weekly", "2 week", "2 weeks" -> "P2W"
            "monthly", "month", "1 month" -> "P1M"
            "bi-monthly", "bimonthly", "2 month", "2 months" -> "P2M"
            "quarterly", "quarter", "3 months" -> "P3M"
            "semiannual", "semiannually", "semi-annual", "semi-annually", "6 months" -> "P6M"
            "annual", "annually", "yearly", "year", "1 year" -> "P1Y"
            else -> value
        }
    }

    private fun String?.toPriceAmount(): Double {
        return AmazonPriceParser.toPriceAmount(this)
    }

    private fun AmazonReceipt.toPurchase(
        productTypeOverride: AmazonProductType? = productTypeOrNull(),
        productIdOverride: String? = null,
        userData: UserData? = null
    ): PurchaseAndroid {
        val dateMillis = purchaseDate?.time?.toDouble() ?: 0.0
        val receiptCanceled = isCanceled || cancelDate != null
        val receiptDeferred = isDeferred
        // The response's own userData is authoritative for this purchase; the
        // cached snapshot is the fallback. Never mix fields across snapshots.
        val resolvedUserData = userData ?: cachedAmazonUserData
        return buildAmazonPurchase(
            packageName = context.packageName,
            receiptId = receiptId,
            receiptSku = sku,
            isSubscription = productTypeOverride == AmazonProductType.SUBSCRIPTION,
            purchaseDateMillis = dateMillis,
            isCanceled = receiptCanceled,
            isDeferred = receiptDeferred,
            deferredSku = deferredSku,
            termSku = termSku,
            productIdOverride = productIdOverride,
            userIdAmazon = resolvedUserData?.userId,
            userMarketplaceAmazon = resolvedUserData?.marketplace
        ).copy(dataAndroid = toJSON().toString())
    }

}
