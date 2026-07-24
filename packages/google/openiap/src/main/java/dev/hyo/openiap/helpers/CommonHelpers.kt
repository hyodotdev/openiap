// This file intentionally normalizes legacy 2.x request fields. Consumers
// still see generated compiler warnings; remove these reads in OpenIAP 3.0.
@file:Suppress("DEPRECATION")

package dev.hyo.openiap.helpers

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.AlternativeBillingModeAndroid
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
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
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Suspend function to wait for a purchase update via listener.
 * Shared between Play and Horizon flavors.
 */
internal suspend fun onPurchaseUpdated(
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
 * Shared between Play and Horizon flavors.
 */
internal suspend fun onPurchaseError(
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
 * Shared between Play and Horizon flavors (Horizon never fires).
 */
internal suspend fun onSubscriptionBillingIssue(
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
internal suspend fun onUserChoiceBilling(
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
internal suspend fun onDeveloperProvidedBilling(
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
 * Shared between Play and Horizon flavors.
 */
internal data class AndroidPurchaseArgs(
    val skus: List<String>,
    val isOfferPersonalized: Boolean?,
    val obfuscatedAccountId: String?,
    val obfuscatedProfileId: String?,
    val offerToken: String?,
    val purchaseToken: String?,
    val originalExternalTransactionId: String?,
    val replacementMode: Int?,
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>?,
    val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?,
    val developerBillingOption: DeveloperBillingOptionParamsAndroid?,
    val type: ProductQueryType,
    val useAlternativeBilling: Boolean?
)

internal fun resolveLegacySubscriptionReplacementMode(
    purchaseToken: String?,
    originalExternalTransactionId: String?,
    replacementMode: Int?,
    hasProductLevelReplacementParams: Boolean = false
): Int? = if (hasProductLevelReplacementParams) null else replacementMode ?: 5.takeIf {
    !purchaseToken.isNullOrBlank() && originalExternalTransactionId.isNullOrBlank()
}

/**
 * The public schema currently exposes one product-level replacement object.
 * Applying that object to multiple target products is ambiguous because Play
 * Billing associates replacement parameters with each ProductDetails entry.
 */
internal fun isSubscriptionReplacementTargetCountValid(
    targetSkuCount: Int,
    hasProductLevelReplacementParams: Boolean,
): Boolean = !hasProductLevelReplacementParams || targetSkuCount == 1

internal fun subscriptionUpdateSourceCount(
    purchaseToken: String?,
    originalExternalTransactionId: String?,
): Int = listOf(purchaseToken, originalExternalTransactionId)
    .count { !it.isNullOrBlank() }

internal fun requireAuthoritativeStorefrontCountry(countryCode: String?): String =
    countryCode
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?: throw OpenIapError.UnknownError(
            "Store returned no authoritative storefront country code"
        )

internal fun emitFailureAndThrow(
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
internal suspend fun awaitAuthoritativeStorefrontCountry(
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

internal fun isConnectionAttemptCurrent(
    currentGeneration: Long,
    attemptGeneration: Long,
    ownsAttempt: Boolean,
    ownsClient: Boolean,
): Boolean = currentGeneration == attemptGeneration && ownsAttempt && ownsClient

internal fun <T> connectionClientToClose(
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
 * Correlate a store purchase update with the request that launched the billing
 * UI. Purchase updates can also be delivered for out-of-band or older flows.
 */
internal fun isPurchaseForPendingRequest(
    transactionDateMillis: Double,
    productIds: Collection<String>,
    requestedSkus: Set<String>,
    launchStartedAtMillis: Double,
): Boolean = transactionDateMillis >= launchStartedAtMillis &&
    productIds.any { it in requestedSkus }

internal fun resolveBillingProgramsForConnection(
    pendingPrograms: Set<BillingProgramAndroid>,
    configuredProgram: BillingProgramAndroid?,
): Set<BillingProgramAndroid> = buildSet {
    addAll(pendingPrograms.filterNot { it == BillingProgramAndroid.Unspecified })
    configuredProgram
        ?.takeUnless { it == BillingProgramAndroid.Unspecified }
        ?.let(::add)
}

internal fun hasLegacyBillingProgramConflict(
    deprecatedMode: AlternativeBillingModeAndroid?,
    billingPrograms: Set<BillingProgramAndroid>,
): Boolean {
    val mode = deprecatedMode ?: AlternativeBillingModeAndroid.None
    if (mode == AlternativeBillingModeAndroid.None) return false
    return billingPrograms.any { program ->
        !(mode == AlternativeBillingModeAndroid.UserChoice &&
            program == BillingProgramAndroid.UserChoiceBilling)
    }
}

/**
 * Extension function to convert RequestPurchaseProps to AndroidPurchaseArgs.
 * Shared between Play and Horizon flavors.
 */
internal fun RequestPurchaseProps.toAndroidPurchaseArgs(): AndroidPurchaseArgs {
    return when (val payload = request) {
        is RequestPurchaseProps.Request.Purchase -> {
            // Prefer 'google' over deprecated 'android' field
            val params = payload.value.google ?: payload.value.android
                ?: throw IllegalArgumentException("Google purchase parameters are required (use 'google' field)")
            AndroidPurchaseArgs(
                skus = params.skus,
                isOfferPersonalized = params.isOfferPersonalized,
                obfuscatedAccountId = params.obfuscatedAccountId,
                obfuscatedProfileId = params.obfuscatedProfileId,
                offerToken = params.offerToken,
                purchaseToken = null,
                originalExternalTransactionId = null,
                replacementMode = null,
                subscriptionOffers = null,
                subscriptionProductReplacementParams = null,
                developerBillingOption = params.developerBillingOption,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
        is RequestPurchaseProps.Request.Subscription -> {
            // Prefer 'google' over deprecated 'android' field
            val params = payload.value.google ?: payload.value.android
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
                replacementMode = params.replacementMode,
                subscriptionOffers = params.subscriptionOffers,
                subscriptionProductReplacementParams = params.subscriptionProductReplacementParams,
                developerBillingOption = params.developerBillingOption,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
    }
}

/**
 * Extension function to convert OpenIapError to PurchaseError.
 * Shared between Play and Horizon flavors.
 */
internal fun OpenIapError.toPurchaseError(): PurchaseError {
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
