package dev.hyo.openiap.helpers

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.UserChoiceBillingDetails
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Suspend function to wait for a purchase update via listener.
 */
suspend fun onPurchaseUpdated(
    addListener: (OpenIapPurchaseUpdateListener) -> Unit,
    removeListener: (OpenIapPurchaseUpdateListener) -> Unit
): Purchase = suspendCancellableCoroutine { continuation ->
    lateinit var resumer: ContinuationResumeGuard<Purchase>
    val listener = object : OpenIapPurchaseUpdateListener {
        override fun onPurchaseUpdated(purchase: Purchase) {
            removeListener(this)
            resumer.resume(purchase)
        }
    }
    resumer = continuation.resumeGuard { removeListener(listener) }
    addListener(listener)
    if (!continuation.isActive) removeListener(listener)
}

/**
 * Suspend function to wait for a purchase error via listener.
 */
suspend fun onPurchaseError(
    addListener: (OpenIapPurchaseErrorListener) -> Unit,
    removeListener: (OpenIapPurchaseErrorListener) -> Unit
): PurchaseError = suspendCancellableCoroutine { continuation ->
    lateinit var resumer: ContinuationResumeGuard<PurchaseError>
    val listener = object : OpenIapPurchaseErrorListener {
        override fun onPurchaseError(error: OpenIapError) {
            removeListener(this)
            resumer.resume(error.toPurchaseError())
        }
    }
    resumer = continuation.resumeGuard { removeListener(listener) }
    addListener(listener)
    if (!continuation.isActive) removeListener(listener)
}

/**
 * Suspend function to wait for a subscription billing-issue event via listener.
 */
suspend fun onSubscriptionBillingIssue(
    addListener: (OpenIapSubscriptionBillingIssueListener) -> Unit,
    removeListener: (OpenIapSubscriptionBillingIssueListener) -> Unit
): Purchase = suspendCancellableCoroutine { continuation ->
    lateinit var resumer: ContinuationResumeGuard<Purchase>
    val listener = object : OpenIapSubscriptionBillingIssueListener {
        override fun onSubscriptionBillingIssue(purchase: Purchase) {
            removeListener(this)
            resumer.resume(purchase)
        }
    }
    resumer = continuation.resumeGuard { removeListener(listener) }
    addListener(listener)
    if (!continuation.isActive) removeListener(listener)
}

/**
 * Suspend function to wait for a User Choice Billing selection.
 */
suspend fun onUserChoiceBilling(
    addListener: (OpenIapUserChoiceBillingListener) -> Unit,
    removeListener: (OpenIapUserChoiceBillingListener) -> Unit
): UserChoiceBillingDetails = suspendCancellableCoroutine { continuation ->
    lateinit var resumer: ContinuationResumeGuard<UserChoiceBillingDetails>
    lateinit var listener: OpenIapUserChoiceBillingListener
    listener = OpenIapUserChoiceBillingListener { details ->
        removeListener(listener)
        resumer.resume(details)
    }
    resumer = continuation.resumeGuard { removeListener(listener) }
    addListener(listener)
    if (!continuation.isActive) removeListener(listener)
}

/**
 * Suspend function to wait for a Developer Provided Billing selection.
 */
suspend fun onDeveloperProvidedBilling(
    addListener: (OpenIapDeveloperProvidedBillingListener) -> Unit,
    removeListener: (OpenIapDeveloperProvidedBillingListener) -> Unit
): DeveloperProvidedBillingDetailsAndroid = suspendCancellableCoroutine { continuation ->
    lateinit var resumer: ContinuationResumeGuard<DeveloperProvidedBillingDetailsAndroid>
    lateinit var listener: OpenIapDeveloperProvidedBillingListener
    listener = OpenIapDeveloperProvidedBillingListener { details ->
        removeListener(listener)
        resumer.resume(details)
    }
    resumer = continuation.resumeGuard { removeListener(listener) }
    addListener(listener)
    if (!continuation.isActive) removeListener(listener)
}

/**
 * Data class representing parsed Android purchase arguments.
 */
data class AndroidPurchaseArgs(
    val skus: List<String>,
    val isOfferPersonalized: Boolean?,
    val obfuscatedAccountId: String?,
    val obfuscatedProfileId: String?,
    val offerToken: String?,
    val purchaseToken: String?,
    val originalExternalTransactionId: String?,
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>?,
    val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?,
    val developerBillingOption: DeveloperBillingOptionParamsAndroid?,
    val type: ProductQueryType
)

/**
 * The public schema currently exposes one product-level replacement object.
 * Applying that object to multiple target products is ambiguous because Play
 * Billing associates replacement parameters with each ProductDetails entry.
 */
fun isSubscriptionReplacementTargetCountValid(
    targetSkuCount: Int,
    hasProductLevelReplacementParams: Boolean,
): Boolean = !hasProductLevelReplacementParams || targetSkuCount == 1

fun subscriptionUpdateSourceCount(
    purchaseToken: String?,
    originalExternalTransactionId: String?,
): Int = listOf(purchaseToken, originalExternalTransactionId)
    .count { !it.isNullOrBlank() }

/** Google Play's offer and promo code redemption page. */
const val PLAY_REDEEM_OFFER_CODE_URL = "https://play.google.com/redeem"

fun requireAuthoritativeStorefrontCountry(countryCode: String?): String =
    countryCode
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?: throw OpenIapError.UnknownError(
            "Store returned no authoritative storefront country code"
        )

fun isConnectionAttemptCurrent(
    currentGeneration: Long,
    attemptGeneration: Long,
    ownsAttempt: Boolean,
    ownsClient: Boolean,
): Boolean = currentGeneration == attemptGeneration && ownsAttempt && ownsClient

fun <T> connectionClientToClose(
    ownsAttempt: Boolean,
    connected: Boolean,
    currentClient: T?,
    expectedClient: T?,
    expectedClientIsStale: Boolean,
): T? = when {
    ownsAttempt && !connected -> expectedClient ?: currentClient
    !ownsAttempt && expectedClientIsStale -> expectedClient
    else -> null
}

/**
 * Whether a store purchase completes the launched request, pending or purchased: a requested SKU
 * whose token the store did not report when the request launched.
 */
fun isPurchaseForPendingRequest(
    productIds: Collection<String>,
    purchaseToken: String?,
    requestedSkus: Set<String>,
    tokensBeforeLaunch: Set<String>,
): Boolean = !purchaseToken.isNullOrBlank() &&
    purchaseToken !in tokensBeforeLaunch &&
    productIds.any { it in requestedSkus }

/**
 * Remembers recently delivered purchase states so each reaches listeners once, however many
 * paths (store callback, polling, recovery) report it.
 */
class PurchaseDeliveryClaims(private val maximumSize: Int = 100) {
    private val lock = Any()
    private val keys = linkedSetOf<String>()

    fun claim(purchase: Purchase): Boolean = synchronized(lock) {
        val stableId = purchase.purchaseToken?.takeIf(String::isNotBlank)
            ?: purchase.id.takeIf(String::isNotBlank)
            ?: "${purchase.productId}:${purchase.transactionDate}"
        if (!keys.add("$stableId:${purchase.purchaseState.rawValue}")) return@synchronized false
        while (keys.size > maximumSize) keys.remove(keys.first())
        true
    }
}

/** Claims [current] for one terminal result when [owns] accepts it. */
fun <T : Any> claimPendingPurchaseIfOwned(
    lock: Any,
    current: () -> T?,
    owns: (T) -> Boolean,
    clear: () -> Unit,
): T? = synchronized(lock) {
    current()?.takeIf(owns)?.also { clear() }
}

data class AllProductQueryResults<T : Any>(
    val inApp: T?,
    val subscriptions: T?,
)

/**
 * Runs the in-app and subscription queries of a `type: all` fetch together. One failed branch
 * yields `null` for it; both failing throws the in-app error. Cancellation, [Error], and a
 * dropped connection are never recovered.
 */
suspend fun <T : Any> collectAllProductQueryResults(
    queryInApp: suspend () -> T,
    querySubscriptions: suspend () -> T,
): AllProductQueryResults<T> {
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
        awaitAll(
            async { capture(queryInApp) },
            async { capture(querySubscriptions) },
        )
    }
    if (inAppResult.isFailure && subscriptionsResult.isFailure) {
        throw checkNotNull(inAppResult.exceptionOrNull())
    }
    return AllProductQueryResults(
        inApp = inAppResult.getOrNull(),
        subscriptions = subscriptionsResult.getOrNull(),
    )
}

/**
 * A store that reports why it refused to consume or acknowledge a purchase token. Optional for
 * providers; public because store modules build against openiap-core as a separate module.
 */
interface PurchaseTokenSettler {
    /** Consumes ([isConsumable]) or acknowledges [purchaseToken]; a refusal throws the store's mapped [OpenIapError]. */
    suspend fun settlePurchaseToken(purchaseToken: String, isConsumable: Boolean)
}

/**
 * Consumes ([isConsumable]) or acknowledges [purchaseToken] and throws when the store refuses:
 * the store's mapped [OpenIapError] for a [PurchaseTokenSettler], otherwise
 * [OpenIapError.BillingError] (`service-error`), since the Boolean handlers only report `false`.
 */
suspend fun OpenIapProtocol.finishPurchaseToken(purchaseToken: String, isConsumable: Boolean) {
    if (this is PurchaseTokenSettler) return settlePurchaseToken(purchaseToken, isConsumable)
    val finished = if (isConsumable) {
        consumePurchaseAndroid(purchaseToken)
    } else {
        acknowledgePurchaseAndroid(purchaseToken)
    }
    if (!finished) {
        val operation = if (isConsumable) "consume" else "acknowledge"
        throw OpenIapError.BillingError("The store did not $operation the purchase")
    }
}

// Binary-compatibility shims for openiap-core consumers; OpenIAP itself no longer calls them.

@Deprecated("Unused by OpenIAP; it will be removed in the next major release.")
fun emitFailureAndThrow(
    error: OpenIapError,
    emitError: (OpenIapError) -> Unit,
): Nothing {
    emitError(error)
    throw error
}

/**
 * Complete an asynchronous storefront query exactly once and publish only the
 * failure that wins the callback race.
 */
@Deprecated("Unused by OpenIAP; it will be removed in the next major release.")
@Suppress("DEPRECATION")
suspend fun awaitAuthoritativeStorefrontCountry(
    emitError: (OpenIapError) -> Unit,
    onRequestFailure: (Exception) -> Unit = {},
    request: (
        onCountryCode: (String?) -> Unit,
        onFailure: (OpenIapError) -> Unit,
    ) -> Unit,
): String = suspendCancellableCoroutine { continuation ->
    val resumer = continuation.resumeGuard()

    fun fail(error: OpenIapError) {
        resumer.resumeWithException(error) { emitError(error) }
    }

    fun succeed(countryCode: String?) {
        val country = try {
            requireAuthoritativeStorefrontCountry(countryCode)
        } catch (error: OpenIapError) {
            fail(error)
            return
        }
        resumer.resume(country)
    }

    try {
        request(::succeed, ::fail)
    } catch (error: Exception) {
        onRequestFailure(error)
        fail(
            error as? OpenIapError
                ?: OpenIapError.ServiceUnavailable(error.message)
        )
    }
}

@Deprecated(
    "Purchase time cannot correlate a purchase with its request; it will be removed in the next major release.",
)
fun isPurchaseForPendingRequest(
    transactionDateMillis: Double,
    productIds: Collection<String>,
    requestedSkus: Set<String>,
    launchStartedAtMillis: Double,
): Boolean = transactionDateMillis >= launchStartedAtMillis &&
    productIds.any { it in requestedSkus }

fun resolveBillingProgramsForConnection(
    pendingPrograms: Set<BillingProgramAndroid>,
    configuredProgram: BillingProgramAndroid?,
): Set<BillingProgramAndroid> = buildSet {
    addAll(pendingPrograms.filterNot { it == BillingProgramAndroid.Unspecified })
    configuredProgram
        ?.takeUnless { it == BillingProgramAndroid.Unspecified }
        ?.let(::add)
}

/**
 * Extension function to convert RequestPurchaseProps to AndroidPurchaseArgs.
 */
fun RequestPurchaseProps.toAndroidPurchaseArgs(): AndroidPurchaseArgs {
    return when (val payload = request) {
        is RequestPurchaseProps.Request.Purchase -> {
            val params = payload.value.google
                ?: throw IllegalArgumentException("Google purchase parameters are required (use 'google' field)")
            AndroidPurchaseArgs(
                skus = params.skus,
                isOfferPersonalized = params.isOfferPersonalized,
                obfuscatedAccountId = params.obfuscatedAccountId,
                obfuscatedProfileId = params.obfuscatedProfileId,
                offerToken = params.offerToken,
                purchaseToken = null,
                originalExternalTransactionId = null,
                subscriptionOffers = null,
                subscriptionProductReplacementParams = null,
                developerBillingOption = params.developerBillingOption,
                type = type
            )
        }
        is RequestPurchaseProps.Request.Subscription -> {
            val params = payload.value.google
                ?: throw IllegalArgumentException("Google subscription parameters are required (use 'google' field)")

            // For subscription upgrades/downgrades:
            // - purchaseToken: Identifies which existing subscription to upgrade/downgrade
            // - obfuscatedProfileId: Optional user identifier for fraud prevention and attribution
            // Both can be provided together - they serve different purposes and are not mutually exclusive
            AndroidPurchaseArgs(
                skus = params.skus,
                isOfferPersonalized = params.isOfferPersonalized,
                obfuscatedAccountId = params.obfuscatedAccountId,
                obfuscatedProfileId = params.obfuscatedProfileId,
                offerToken = null,
                purchaseToken = params.purchaseToken,
                originalExternalTransactionId = params.originalExternalTransactionId,
                subscriptionOffers = params.subscriptionOffers,
                subscriptionProductReplacementParams = params.subscriptionProductReplacementParams,
                developerBillingOption = params.developerBillingOption,
                type = type
            )
        }
    }
}

/**
 * Extension function to convert OpenIapError to PurchaseError.
 */
fun OpenIapError.toPurchaseError(): PurchaseError {
    val code = runCatching { ErrorCode.fromJson(this.code) }.getOrElse { ErrorCode.Unknown }
    val queryProductError = this as? OpenIapError.QueryProduct
    val productId = when (this) {
        is OpenIapError.ProductNotFound -> productId
        is OpenIapError.SkuNotFound -> sku
        else -> requestProductId
    }
    return PurchaseError(
        code = code,
        debugMessage = debugMessage,
        message = message,
        productId = productId,
        responseCode = queryProductError?.responseCode,
        productIds = queryProductError?.productIds,
        productType = queryProductError?.productType,
        isEmptyProductList = queryProductError?.isEmptyProductList,
        subResponseCodeAndroid = this.subResponseCode,
    )
}
