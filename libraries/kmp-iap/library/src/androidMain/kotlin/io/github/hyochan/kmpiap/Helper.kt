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
import io.github.hyochan.kmpiap.openiap.DiscountAmountAndroid
import io.github.hyochan.kmpiap.openiap.DiscountDisplayInfoAndroid
import io.github.hyochan.kmpiap.openiap.DiscountOffer
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalLinkLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkTypeAndroid
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.InstallmentPlanDetailsAndroid
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.LimitedQuantityInfoAndroid
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductAndroid
import io.github.hyochan.kmpiap.openiap.ProductAndroidOneTimePurchaseOfferDetail
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroidOfferDetails
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.PreorderDetailsAndroid
import io.github.hyochan.kmpiap.openiap.PricingPhaseAndroid
import io.github.hyochan.kmpiap.openiap.PricingPhasesAndroid
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.SubscriptionOffer
import io.github.hyochan.kmpiap.openiap.PaymentMode
import io.github.hyochan.kmpiap.openiap.DiscountOfferType
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.RentalDetailsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionPeriod
import io.github.hyochan.kmpiap.openiap.SubscriptionPeriodUnit
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import io.github.hyochan.kmpiap.openiap.ValidTimeWindowAndroid
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import com.android.billingclient.api.BillingFlowParams
import dev.hyo.openiap.BillingProgramAndroid as OpenIapBillingProgram
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid as OpenIapExternalLinkLaunchMode
import dev.hyo.openiap.ExternalLinkTypeAndroid as OpenIapExternalLinkType
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid as OpenIapLaunchExternalLinkParams

private val billingPeriodRegex = Regex("""P(\d+)([DWMY])""")

internal data class UnfetchedProductInfo(
    val productId: String,
    val productType: String,
    val statusCode: Int,
)

internal data class ProductQueryOutcome(
    val productDetails: List<ProductDetails>,
    val unfetchedProducts: List<UnfetchedProductInfo>,
    val succeeded: Boolean,
)

internal data class ProductQueryOutcomes(
    val inApp: ProductQueryOutcome,
    val subscriptions: ProductQueryOutcome,
)

internal data class ProductCacheKey(
    val productId: String,
    val productType: String,
)

internal suspend fun collectProductQueryOutcomes(
    queryType: ProductQueryType,
    queryInApp: suspend () -> ProductQueryOutcome,
    querySubscriptions: suspend () -> ProductQueryOutcome,
): ProductQueryOutcomes {
    val emptySuccess = ProductQueryOutcome(emptyList(), emptyList(), true)

    return when (queryType) {
        ProductQueryType.InApp -> ProductQueryOutcomes(queryInApp(), emptySuccess)
        ProductQueryType.Subs -> ProductQueryOutcomes(emptySuccess, querySubscriptions())
        ProductQueryType.All -> {
            suspend fun capture(block: suspend () -> ProductQueryOutcome): Result<ProductQueryOutcome> =
                try {
                    Result.success(block())
                } catch (error: Throwable) {
                    if (error is CancellationException || error is Error) throw error
                    Result.failure(error)
                }

            val (inAppResult, subscriptionsResult) = coroutineScope {
                awaitAll(
                    async { capture(queryInApp) },
                    async { capture(querySubscriptions) },
                )
            }
            val firstError = inAppResult.exceptionOrNull()
                ?: subscriptionsResult.exceptionOrNull()
            val failedOutcome = ProductQueryOutcome(emptyList(), emptyList(), false)
            val inApp = inAppResult.getOrElse { failedOutcome }
            val subscriptions = subscriptionsResult.getOrElse { failedOutcome }
            if (!inApp.succeeded && !subscriptions.succeeded) {
                throw checkNotNull(firstError)
            }
            ProductQueryOutcomes(inApp, subscriptions)
        }
    }
}

internal fun productStatusFromUnfetchedStatus(statusCode: Int): ProductStatusAndroid =
    when (statusCode) {
        3 -> ProductStatusAndroid.NotFound
        4 -> ProductStatusAndroid.NoOffersAvailable
        else -> ProductStatusAndroid.Unknown
    }

internal fun unfetchedProductInfoFrom(items: List<*>): List<UnfetchedProductInfo> {
    val sample = items.firstOrNull { it != null } ?: return emptyList()

    return runCatching {
        val itemClass = sample.javaClass
        val getProductId = itemClass.getMethod("getProductId").apply { isAccessible = true }
        val getProductType = itemClass.getMethod("getProductType").apply { isAccessible = true }
        val getStatusCode = itemClass.getMethod("getStatusCode").apply { isAccessible = true }

        items.mapNotNull { item ->
            item ?: return@mapNotNull null
            runCatching {
                val productId = getProductId.invoke(item) as? String
                val productType = getProductType.invoke(item) as? String
                val statusCode = getStatusCode.invoke(item) as? Int

                if (productId == null || productType == null || statusCode == null) {
                    null
                } else {
                    UnfetchedProductInfo(productId, productType, statusCode)
                }
            }.getOrNull()
        }
    }.getOrDefault(emptyList())
}

internal fun QueryProductDetailsResult.unfetchedProductsCompat(): List<UnfetchedProductInfo> =
    runCatching {
        val items = javaClass.getMethod("getUnfetchedProductList").invoke(this) as? List<*>
            ?: return@runCatching emptyList()
        unfetchedProductInfoFrom(items)
    }.getOrDefault(emptyList())

internal fun billingStringOrEmpty(block: () -> String?): String =
    runCatching(block).getOrNull().orEmpty()

internal fun unavailableInAppProduct(
    productId: String,
    status: ProductStatusAndroid,
): ProductAndroid = ProductAndroid(
    currency = "",
    description = "",
    displayName = null,
    displayPrice = "",
    id = productId,
    nameAndroid = "",
    platform = IapPlatform.Android,
    price = null,
    productStatusAndroid = status,
    title = "",
    type = ProductType.InApp,
)

internal fun unavailableSubscriptionProduct(
    productId: String,
    status: ProductStatusAndroid,
): ProductSubscriptionAndroid = ProductSubscriptionAndroid(
    currency = "",
    description = "",
    displayName = null,
    displayPrice = "",
    id = productId,
    nameAndroid = "",
    platform = IapPlatform.Android,
    price = null,
    productStatusAndroid = status,
    subscriptionOfferDetailsAndroid = emptyList(),
    subscriptionOffers = emptyList(),
    title = "",
    type = ProductType.Subs,
)

internal fun emitFailureAndThrow(
    errorFlow: MutableSharedFlow<PurchaseError>,
    error: PurchaseError
): Nothing {
    errorFlow.tryEmit(error)
    throw PurchaseException(error)
}

internal fun clearProductCache(cache: MutableMap<ProductCacheKey, ProductDetails>) {
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
 * Maps SubscriptionReplacementModeAndroid to BillingFlowParams product-level replacement mode.
 */
internal fun mapReplacementMode(mode: SubscriptionReplacementModeAndroid): Int? = when (mode) {
    SubscriptionReplacementModeAndroid.UnknownReplacementMode ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.UNKNOWN_REPLACEMENT_MODE
    SubscriptionReplacementModeAndroid.WithTimeProration ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.WITH_TIME_PRORATION
    SubscriptionReplacementModeAndroid.ChargeProratedPrice ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.CHARGE_PRORATED_PRICE
    SubscriptionReplacementModeAndroid.ChargeFullPrice ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.CHARGE_FULL_PRICE
    SubscriptionReplacementModeAndroid.WithoutProration ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.WITHOUT_PRORATION
    SubscriptionReplacementModeAndroid.Deferred ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.DEFERRED
    SubscriptionReplacementModeAndroid.KeepExisting ->
        BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.KEEP_EXISTING
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
    cache: MutableMap<ProductCacheKey, ProductDetails>,
    errorFlow: MutableSharedFlow<PurchaseError>
): Map<String, ProductDetails>? {
    val details = mutableMapOf<String, ProductDetails>()
    skus.forEach { sku ->
        cache[ProductCacheKey(sku, productType)]?.let { details[sku] = it }
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
                    queryResult.productDetailsList.forEach { detail ->
                        cache[ProductCacheKey(detail.productId, detail.productType)] = detail
                    }
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
            cache[ProductCacheKey(sku, productType)]?.let { details[sku] = it }
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
    val allOneTimeOffers = runCatching { oneTimePurchaseOfferDetailsList }.getOrNull().orEmpty()
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
    val oneTimeOfferDetails = if (allOneTimeOffers.isNotEmpty()) {
        allOneTimeOffers.map { it.toOfferDetail() }
    } else {
        oneTime?.let { listOf(it.toOfferDetail()) }
    }
    val discountOffers = if (allOneTimeOffers.isNotEmpty()) {
        allOneTimeOffers.map { it.toDiscountOffer() }
    } else {
        oneTime?.let { listOf(it.toDiscountOffer()) }
    }
    val subscriptionOfferDetails = offers?.map { it.toOfferDetail() }
    val subscriptionOffers = subscriptionOfferDetails?.map { it.toSubscriptionOffer() }

    return ProductAndroid(
        currency = currencyCode,
        debugDescription = description,
        description = description,
        discountOffers = discountOffers,
        displayName = name,
        displayPrice = displayPrice,
        id = productId,
        nameAndroid = name,
        oneTimePurchaseOfferDetailsAndroid = oneTimeOfferDetails,
        platform = IapPlatform.Android,
        price = priceValue,
        productStatusAndroid = ProductStatusAndroid.Ok,
        subscriptionOfferDetailsAndroid = subscriptionOfferDetails,
        subscriptionOffers = subscriptionOffers,
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
        discountOffers = product.discountOffers,
        displayName = product.displayName,
        displayPrice = product.displayPrice,
        id = product.id,
        nameAndroid = product.nameAndroid,
        oneTimePurchaseOfferDetailsAndroid = product.oneTimePurchaseOfferDetailsAndroid,
        platform = product.platform,
        price = product.price,
        productStatusAndroid = product.productStatusAndroid,
        subscriptionOfferDetailsAndroid = offers,
        subscriptionOffers = offers.map { it.toSubscriptionOffer() },
        title = product.title,
        type = product.type
    )
}

private fun ProductDetails.OneTimePurchaseOfferDetails.toOfferDetail(): ProductAndroidOneTimePurchaseOfferDetail {
    val discountInfo = runCatching { discountDisplayInfo }.getOrNull()

    return ProductAndroidOneTimePurchaseOfferDetail(
        discountDisplayInfo = discountInfo?.let { info ->
            DiscountDisplayInfoAndroid(
                discountAmount = runCatching { info.discountAmount }.getOrNull()?.let { amount ->
                    DiscountAmountAndroid(
                        discountAmountMicros = amount.discountAmountMicros.toString(),
                        formattedDiscountAmount = amount.formattedDiscountAmount
                    )
                },
                percentageDiscount = runCatching { info.percentageDiscount }.getOrNull()
            )
        },
        formattedPrice = formattedPrice,
        fullPriceMicros = runCatching { fullPriceMicros?.toString() }.getOrNull(),
        limitedQuantityInfo = runCatching { limitedQuantityInfo }.getOrNull()?.let { info ->
            LimitedQuantityInfoAndroid(
                maximumQuantity = info.maximumQuantity,
                remainingQuantity = info.remainingQuantity
            )
        },
        offerId = runCatching { offerId }.getOrNull(),
        offerTags = runCatching { offerTags.orEmpty() }.getOrElse { emptyList() },
        offerToken = billingStringOrEmpty { this.offerToken },
        preorderDetailsAndroid = runCatching { preorderDetails }.getOrNull()?.let { details ->
            PreorderDetailsAndroid(
                preorderPresaleEndTimeMillis = details.preorderPresaleEndTimeMillis.toString(),
                preorderReleaseTimeMillis = details.preorderReleaseTimeMillis.toString()
            )
        },
        priceAmountMicros = priceAmountMicros.toString(),
        priceCurrencyCode = priceCurrencyCode,
        purchaseOptionId = runCatching { purchaseOptionId }.getOrNull(),
        rentalDetailsAndroid = runCatching { rentalDetails }.getOrNull()?.let { details ->
            RentalDetailsAndroid(
                rentalPeriod = details.rentalPeriod,
                rentalExpirationPeriod = runCatching { details.rentalExpirationPeriod }.getOrNull()
            )
        },
        validTimeWindow = runCatching { validTimeWindow }.getOrNull()?.let { window ->
            ValidTimeWindowAndroid(
                startTimeMillis = window.startTimeMillis.toString(),
                endTimeMillis = window.endTimeMillis.toString()
            )
        }
    )
}

private fun ProductDetails.OneTimePurchaseOfferDetails.toDiscountOffer(): DiscountOffer {
    val discountInfo = runCatching { discountDisplayInfo }.getOrNull()

    return DiscountOffer(
        id = runCatching { offerId }.getOrNull(),
        displayPrice = formattedPrice,
        price = priceAmountMicros.toDouble() / 1_000_000.0,
        currency = priceCurrencyCode,
        type = DiscountOfferType.OneTime,
        offerTokenAndroid = billingStringOrEmpty { this.offerToken },
        offerTagsAndroid = runCatching { offerTags.orEmpty() }.getOrElse { emptyList() },
        fullPriceMicrosAndroid = runCatching { fullPriceMicros?.toString() }.getOrNull(),
        percentageDiscountAndroid = runCatching { discountInfo?.percentageDiscount }.getOrNull(),
        discountAmountMicrosAndroid = runCatching {
            discountInfo?.discountAmount?.discountAmountMicros?.toString()
        }.getOrNull(),
        formattedDiscountAmountAndroid = runCatching {
            discountInfo?.discountAmount?.formattedDiscountAmount
        }.getOrNull(),
        validTimeWindowAndroid = runCatching { validTimeWindow }.getOrNull()?.let { window ->
            ValidTimeWindowAndroid(
                startTimeMillis = window.startTimeMillis.toString(),
                endTimeMillis = window.endTimeMillis.toString()
            )
        },
        limitedQuantityInfoAndroid = runCatching { limitedQuantityInfo }.getOrNull()?.let { info ->
            LimitedQuantityInfoAndroid(
                maximumQuantity = info.maximumQuantity,
                remainingQuantity = info.remainingQuantity
            )
        },
        preorderDetailsAndroid = runCatching { preorderDetails }.getOrNull()?.let { details ->
            PreorderDetailsAndroid(
                preorderPresaleEndTimeMillis = details.preorderPresaleEndTimeMillis.toString(),
                preorderReleaseTimeMillis = details.preorderReleaseTimeMillis.toString()
            )
        },
        rentalDetailsAndroid = runCatching { rentalDetails }.getOrNull()?.let { details ->
            RentalDetailsAndroid(
                rentalPeriod = details.rentalPeriod,
                rentalExpirationPeriod = runCatching { details.rentalExpirationPeriod }.getOrNull()
            )
        },
        purchaseOptionIdAndroid = runCatching { purchaseOptionId }.getOrNull()
    )
}

/**
 * Convert ProductSubscriptionAndroidOfferDetails to SubscriptionOffer.
 * Maps Android-specific offer details to cross-platform SubscriptionOffer type.
 */
internal fun ProductSubscriptionAndroidOfferDetails.toSubscriptionOffer(): SubscriptionOffer {
    val firstPhase = pricingPhases.pricingPhaseList.firstOrNull()
    val period = firstPhase?.billingPeriod?.let { parseBillingPeriod(it) }

    // Determine payment mode from first pricing phase
    val paymentMode = firstPhase?.let {
        determinePaymentMode(
            recurrenceMode = it.recurrenceMode,
            priceAmountMicros = it.priceAmountMicros.toLongOrNull() ?: 0L
        )
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
        period = period,
        periodCount = firstPhase?.billingCycleCount,
        basePlanIdAndroid = basePlanId,
        offerTokenAndroid = offerToken,
        offerTagsAndroid = offerTags,
        pricingPhasesAndroid = pricingPhases,
        installmentPlanDetailsAndroid = installmentPlanDetails
    )
}

private fun parseBillingPeriod(billingPeriod: String): SubscriptionPeriod? {
    if (billingPeriod.isEmpty()) return null

    val match = billingPeriodRegex.matchEntire(billingPeriod) ?: return null
    val value = match.groupValues[1].toIntOrNull() ?: return null
    val unit = when (match.groupValues[2]) {
        "D" -> SubscriptionPeriodUnit.Day
        "W" -> SubscriptionPeriodUnit.Week
        "M" -> SubscriptionPeriodUnit.Month
        "Y" -> SubscriptionPeriodUnit.Year
        else -> SubscriptionPeriodUnit.Unknown
    }
    return SubscriptionPeriod(unit = unit, value = value)
}

private fun determinePaymentMode(
    recurrenceMode: Int,
    priceAmountMicros: Long
): PaymentMode =
    when {
        priceAmountMicros == 0L -> PaymentMode.FreeTrial
        recurrenceMode == 3 -> PaymentMode.PayUpFront
        recurrenceMode == 2 -> PaymentMode.PayAsYouGo
        recurrenceMode == 1 -> PaymentMode.PayAsYouGo
        else -> PaymentMode.Unknown
    }

internal fun ProductDetails.SubscriptionOfferDetails.toOfferDetail(): ProductSubscriptionAndroidOfferDetails {
    val installmentDetails = runCatching { installmentPlanDetails }.getOrNull()?.let { details ->
        InstallmentPlanDetailsAndroid(
            commitmentPaymentsCount = details.installmentPlanCommitmentPaymentsCount,
            subsequentCommitmentPaymentsCount = details.subsequentInstallmentPlanCommitmentPaymentsCount
        )
    }

    return ProductSubscriptionAndroidOfferDetails(
        basePlanId = basePlanId,
        installmentPlanDetails = installmentDetails,
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
