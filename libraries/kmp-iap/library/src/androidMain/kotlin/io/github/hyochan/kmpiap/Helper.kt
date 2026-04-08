package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalLinkLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkTypeAndroid
import io.github.hyochan.kmpiap.openiap.FetchProductsResult
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductAndroid
import io.github.hyochan.kmpiap.openiap.ProductAndroidOneTimePurchaseOfferDetail
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroidOfferDetails
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.PricingPhaseAndroid
import io.github.hyochan.kmpiap.openiap.PricingPhasesAndroid
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.SubscriptionOffer
import io.github.hyochan.kmpiap.openiap.PaymentMode
import io.github.hyochan.kmpiap.openiap.DiscountOfferType
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import kotlinx.coroutines.flow.MutableSharedFlow
import com.android.billingclient.api.BillingFlowParams
import dev.hyo.openiap.BillingProgramAndroid as OpenIapBillingProgram
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid as OpenIapExternalLinkLaunchMode
import dev.hyo.openiap.ExternalLinkTypeAndroid as OpenIapExternalLinkType
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid as OpenIapLaunchExternalLinkParams

internal const val ANDROID_VERSION = "KMP-IAP v1.0.0-alpha02 (Android)"

internal fun emitFailureAndThrow(
    errorFlow: MutableSharedFlow<PurchaseError>,
    error: PurchaseError
): Nothing {
    errorFlow.tryEmit(error)
    throw PurchaseException(error)
}

internal fun mapFetchResultToProductsHelper(
    params: ProductRequest,
    @Suppress("UNUSED_PARAMETER")
    result: FetchProductsResult,
    cache: Map<String, ProductDetails>
): List<Product> = params.skus.flatMap { sku ->
    cache[sku]?.let { listOf(it.toProduct()) } ?: emptyList()
}

internal fun clearProductCache(cache: MutableMap<String, ProductDetails>) {
    cache.clear()
}

internal fun ensureConnectedOrFail(
    isConnected: Boolean,
    fail: (PurchaseError) -> Nothing
) {
    if (!isConnected) {
        fail(
            PurchaseError(
                code = ErrorCode.ServiceError,
                message = "Not connected to billing service"
            )
        )
    }
}

internal fun isPurchaseTokenValid(purchase: Purchase): Boolean =
    purchase.purchaseToken?.isNotEmpty() == true

internal fun mapBillingResponseCode(responseCode: Int): ErrorCode = when (responseCode) {
    BillingClient.BillingResponseCode.USER_CANCELED -> ErrorCode.UserCancelled
    BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> ErrorCode.ServiceError
    BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> ErrorCode.BillingUnavailable
    BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> ErrorCode.ItemUnavailable
    BillingClient.BillingResponseCode.DEVELOPER_ERROR -> ErrorCode.DeveloperError
    BillingClient.BillingResponseCode.ERROR -> ErrorCode.Unknown
    BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> ErrorCode.AlreadyOwned
    BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> ErrorCode.ItemNotOwned
    BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> ErrorCode.ServiceDisconnected
    BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> ErrorCode.FeatureNotSupported
    else -> ErrorCode.Unknown
}

/**
 * Maps SubscriptionReplacementModeAndroid enum to BillingFlowParams replacement mode int.
 * Used for setSubscriptionReplacementMode in SubscriptionUpdateParams and SubscriptionProductReplacementParams.
 */
internal fun mapReplacementMode(mode: SubscriptionReplacementModeAndroid): Int? = when (mode) {
    SubscriptionReplacementModeAndroid.UnknownReplacementMode -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.UNKNOWN_REPLACEMENT_MODE
    SubscriptionReplacementModeAndroid.WithTimeProration -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION
    SubscriptionReplacementModeAndroid.ChargeProratedPrice -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
    SubscriptionReplacementModeAndroid.ChargeFullPrice -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE
    SubscriptionReplacementModeAndroid.WithoutProration -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION
    SubscriptionReplacementModeAndroid.Deferred -> BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.DEFERRED
    SubscriptionReplacementModeAndroid.KeepExisting -> null // KEEP_EXISTING is not a standard replacement mode
}

internal fun enablePendingPurchasesCompat(builder: BillingClient.Builder): BillingClient.Builder {
    return try {
        val paramsClass = Class.forName("com.android.billingclient.api.PendingPurchasesParams")
        val newBuilder = paramsClass.getMethod("newBuilder").invoke(null)
        val enableOneTime = newBuilder.javaClass.getMethod("enableOneTimeProducts").invoke(newBuilder) ?: newBuilder
        val enableSubscriptions = runCatching {
            enableOneTime.javaClass.getMethod("enableSubscriptionProducts").invoke(enableOneTime)
        }.getOrNull() ?: enableOneTime
        val params = enableSubscriptions.javaClass.getMethod("build").invoke(enableSubscriptions)
        builder.javaClass.getMethod("enablePendingPurchases", paramsClass).invoke(builder, params)
        builder
    } catch (throwable: Throwable) {
        runCatching { builder.javaClass.getMethod("enablePendingPurchases").invoke(builder) }
        println("[KMP-IAP] Pending purchase support unavailable: ${throwable.message ?: "unknown"}")
        builder
    }
}

internal fun tryCaptureApplication(
    callback: Application.ActivityLifecycleCallbacks,
    onContextAvailable: (Context?) -> Unit,
    onActivityFound: (Activity?) -> Unit
): (() -> Unit)? {
    var disposer: (() -> Unit)? = null

    runCatching {
        val activityThreadClass = Class.forName("android.app.ActivityThread")
        val currentActivityThread = activityThreadClass.getMethod("currentActivityThread").invoke(null)
        val getApplication = activityThreadClass.getMethod("getApplication")
        val app = getApplication.invoke(currentActivityThread) as? Application
        onContextAvailable(app?.applicationContext)
        app?.registerActivityLifecycleCallbacks(callback)
        disposer = app?.let { application ->
            { application.unregisterActivityLifecycleCallbacks(callback) }
        }

        val activitiesField = activityThreadClass.getDeclaredField("mActivities")
        activitiesField.isAccessible = true
        val activities = activitiesField.get(currentActivityThread) as? Map<*, *>
        activities?.values?.forEach { value ->
            val recordClass = value?.javaClass
            val activityField = recordClass?.getDeclaredField("activity")
            activityField?.isAccessible = true
            val activity = activityField?.get(value) as? Activity
            if (activity != null && !activity.isFinishing) {
                onActivityFound(activity)
                return@forEach
            }
        }
    }

    return disposer
}

internal suspend fun loadProductDetails(
    client: BillingClient,
    productType: String,
    skus: List<String>,
    cache: MutableMap<String, ProductDetails>,
    errorFlow: MutableSharedFlow<PurchaseError>
): Map<String, ProductDetails>? {
    val details = mutableMapOf<String, ProductDetails>()
    skus.forEach { sku ->
        cache[sku]?.takeIf { it.productType == productType }?.let { details[sku] = it }
    }

    val missing = skus.filterNot(details::containsKey)
    if (missing.isNotEmpty()) {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                missing.map { sku ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku)
                        .setProductType(productType)
                        .build()
                }
            )
            .build()

        val success = suspendCancellableCoroutine<Boolean> { continuation ->
            client.queryProductDetailsAsync(params) { billingResult: BillingResult, queryResult: QueryProductDetailsResult ->
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryResult.productDetailsList?.forEach { detail -> cache[detail.productId] = detail }
                    continuation.resume(true)
                } else {
                    continuation.resume(false)
                }
            }
        }

        if (!success) {
            errorFlow.tryEmit(
                PurchaseError(code = ErrorCode.QueryProduct, message = "Failed to query product details")
            )
            return null
        }

        skus.forEach { sku ->
            cache[sku]?.takeIf { it.productType == productType }?.let { details[sku] = it }
        }
    }

    if (details.size != skus.size) {
        val missingSku = skus.firstOrNull { !details.containsKey(it) }.orEmpty()
        errorFlow.tryEmit(
            PurchaseError(code = ErrorCode.SkuNotFound, message = "Product not found: $missingSku")
        )
        return null
    }

    return details
}

internal fun com.android.billingclient.api.Purchase.toPurchase(): Purchase {
    val purchaseStateEnum = when (purchaseState) {
        com.android.billingclient.api.Purchase.PurchaseState.PURCHASED -> PurchaseState.Purchased
        com.android.billingclient.api.Purchase.PurchaseState.PENDING -> PurchaseState.Pending
        com.android.billingclient.api.Purchase.PurchaseState.UNSPECIFIED_STATE -> PurchaseState.Unknown
        else -> PurchaseState.Unknown
    }

    val accountIdentifiers = accountIdentifiers

    return PurchaseAndroid(
        autoRenewingAndroid = isAutoRenewing,
        dataAndroid = originalJson,
        developerPayloadAndroid = null,
        id = orderId ?: purchaseToken,
        ids = products,
        isAcknowledgedAndroid = isAcknowledged,
        isAutoRenewing = isAutoRenewing,
        obfuscatedAccountIdAndroid = accountIdentifiers?.obfuscatedAccountId,
        obfuscatedProfileIdAndroid = accountIdentifiers?.obfuscatedProfileId,
        packageNameAndroid = packageName,
        platform = IapPlatform.Android,
        productId = products.firstOrNull() ?: "",
        store = IapStore.Google,
        purchaseState = purchaseStateEnum,
        purchaseToken = purchaseToken,
        quantity = quantity,
        signatureAndroid = signature,
        transactionDate = purchaseTime.toDouble() / 1000
    )
}

internal fun ProductDetails.toProduct(): Product {
    val oneTime = oneTimePurchaseOfferDetails
    val offers = subscriptionOfferDetails

    val pricingPhase = offers?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()

    val productType = if (!offers.isNullOrEmpty()) ProductType.Subs else ProductType.InApp
    val displayPrice = when {
        oneTime != null -> oneTime.formattedPrice
        pricingPhase != null -> pricingPhase.formattedPrice
        else -> ""
    }
    val priceValue = when {
        oneTime != null -> oneTime.priceAmountMicros.toDouble() / 1_000_000
        pricingPhase != null -> pricingPhase.priceAmountMicros.toDouble() / 1_000_000
        else -> null
    }
    val currencyCode = when {
        oneTime != null -> oneTime.priceCurrencyCode
        pricingPhase != null -> pricingPhase.priceCurrencyCode
        else -> "USD"
    }

    return ProductAndroid(
        currency = currencyCode,
        description = description,
        displayPrice = displayPrice,
        id = productId,
        nameAndroid = name,
        oneTimePurchaseOfferDetailsAndroid = oneTime?.let {
            listOf(ProductAndroidOneTimePurchaseOfferDetail(
                formattedPrice = it.formattedPrice,
                priceAmountMicros = it.priceAmountMicros.toString(),
                priceCurrencyCode = it.priceCurrencyCode,
                offerTags = emptyList(),
                offerToken = ""
            ))
        },
        platform = IapPlatform.Android,
        price = priceValue,
        subscriptionOfferDetailsAndroid = offers?.map { it.toOfferDetail() },
        title = title,
        type = productType
    )
}

internal fun ProductDetails.toSubscriptionProduct(): ProductSubscriptionAndroid? {
    val product = toProduct() as? ProductAndroid ?: return null
    val offers = product.subscriptionOfferDetailsAndroid ?: return null
    return ProductSubscriptionAndroid(
        currency = product.currency,
        debugDescription = product.debugDescription,
        description = product.description,
        displayName = product.displayName,
        displayPrice = product.displayPrice,
        id = product.id,
        nameAndroid = product.nameAndroid,
        oneTimePurchaseOfferDetailsAndroid = product.oneTimePurchaseOfferDetailsAndroid,
        platform = product.platform,
        price = product.price,
        subscriptionOfferDetailsAndroid = offers,
        subscriptionOffers = offers.map { it.toSubscriptionOffer() },
        title = product.title,
        type = product.type
    )
}

/**
 * Convert ProductSubscriptionAndroidOfferDetails to SubscriptionOffer.
 * Maps Android-specific offer details to cross-platform SubscriptionOffer type.
 */
internal fun ProductSubscriptionAndroidOfferDetails.toSubscriptionOffer(): SubscriptionOffer {
    val firstPhase = pricingPhases.pricingPhaseList.firstOrNull()

    // Determine payment mode from first pricing phase
    val paymentMode = firstPhase?.let {
        val priceAmount = it.priceAmountMicros.toLongOrNull() ?: 0L
        when {
            priceAmount == 0L -> PaymentMode.FreeTrial
            it.recurrenceMode == 3 -> PaymentMode.PayUpFront  // NON_RECURRING
            else -> PaymentMode.PayAsYouGo
        }
    }

    // Get price from first pricing phase
    val (displayPrice, price, currency) = firstPhase?.let {
        val micros = it.priceAmountMicros.toLongOrNull() ?: 0L
        Triple(
            it.formattedPrice,
            micros.toDouble() / 1_000_000.0,
            it.priceCurrencyCode
        )
    } ?: Triple("", 0.0, null)

    // Determine offer type
    val type = when {
        offerId != null && offerId.isNotEmpty() -> DiscountOfferType.Promotional
        paymentMode == PaymentMode.FreeTrial -> DiscountOfferType.Introductory
        else -> DiscountOfferType.Introductory
    }

    return SubscriptionOffer(
        id = offerId ?: basePlanId,
        displayPrice = displayPrice,
        price = price,
        currency = currency,
        type = type,
        paymentMode = paymentMode,
        basePlanIdAndroid = basePlanId,
        offerTokenAndroid = offerToken,
        offerTagsAndroid = offerTags,
        pricingPhasesAndroid = pricingPhases
    )
}

internal fun ProductDetails.SubscriptionOfferDetails.toOfferDetail(): ProductSubscriptionAndroidOfferDetails {
    return ProductSubscriptionAndroidOfferDetails(
        basePlanId = basePlanId,
        offerId = offerId,
        offerTags = offerTags,
        offerToken = offerToken,
        pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = pricingPhases.pricingPhaseList.map { phase ->
                PricingPhaseAndroid(
                    billingCycleCount = phase.billingCycleCount,
                    billingPeriod = phase.billingPeriod,
                    formattedPrice = phase.formattedPrice,
                    priceAmountMicros = phase.priceAmountMicros.toString(),
                    priceCurrencyCode = phase.priceCurrencyCode,
                    recurrenceMode = phase.recurrenceMode
                )
            }
        )
    )
}

// ---------------------------------------------------------------------
// Billing Programs API Mapping Functions (Android 8.2.0+)
// ---------------------------------------------------------------------

/**
 * Convert KMP-IAP BillingProgramAndroid to OpenIAP BillingProgramAndroid
 */
internal fun BillingProgramAndroid.toOpenIapProgram(): OpenIapBillingProgram = when (this) {
    BillingProgramAndroid.Unspecified -> OpenIapBillingProgram.Unspecified
    BillingProgramAndroid.ExternalContentLink -> OpenIapBillingProgram.ExternalContentLink
    BillingProgramAndroid.ExternalOffer -> OpenIapBillingProgram.ExternalOffer
    BillingProgramAndroid.ExternalPayments -> OpenIapBillingProgram.ExternalPayments
    BillingProgramAndroid.UserChoiceBilling -> OpenIapBillingProgram.UserChoiceBilling
}

/**
 * Convert KMP-IAP ExternalLinkLaunchModeAndroid to OpenIAP ExternalLinkLaunchModeAndroid
 */
internal fun ExternalLinkLaunchModeAndroid.toOpenIapLaunchMode(): OpenIapExternalLinkLaunchMode = when (this) {
    ExternalLinkLaunchModeAndroid.Unspecified -> OpenIapExternalLinkLaunchMode.Unspecified
    ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp -> OpenIapExternalLinkLaunchMode.LaunchInExternalBrowserOrApp
    ExternalLinkLaunchModeAndroid.CallerWillLaunchLink -> OpenIapExternalLinkLaunchMode.CallerWillLaunchLink
}

/**
 * Convert KMP-IAP ExternalLinkTypeAndroid to OpenIAP ExternalLinkTypeAndroid
 */
internal fun ExternalLinkTypeAndroid.toOpenIapLinkType(): OpenIapExternalLinkType = when (this) {
    ExternalLinkTypeAndroid.Unspecified -> OpenIapExternalLinkType.Unspecified
    ExternalLinkTypeAndroid.LinkToDigitalContentOffer -> OpenIapExternalLinkType.LinkToDigitalContentOffer
    ExternalLinkTypeAndroid.LinkToAppDownload -> OpenIapExternalLinkType.LinkToAppDownload
}

/**
 * Convert KMP-IAP LaunchExternalLinkParamsAndroid to OpenIAP LaunchExternalLinkParamsAndroid
 */
internal fun LaunchExternalLinkParamsAndroid.toOpenIapParams(): OpenIapLaunchExternalLinkParams =
    OpenIapLaunchExternalLinkParams(
        billingProgram = billingProgram.toOpenIapProgram(),
        launchMode = launchMode.toOpenIapLaunchMode(),
        linkType = linkType.toOpenIapLinkType(),
        linkUri = linkUri
    )
