package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.DiscountOffer
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalLinkLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkTypeAndroid
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult as AndroidRequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.IapkitClientPayloadFormat
import io.github.hyochan.kmpiap.openiap.IapkitProductClientPayload
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.InstallmentPlanDetailsAndroid
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.LimitedQuantityInfoAndroid
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductAndroid
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroid
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.PreorderDetailsAndroid
import io.github.hyochan.kmpiap.openiap.PricingPhaseAndroid
import io.github.hyochan.kmpiap.openiap.PricingPhasesAndroid
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.SubscriptionOffer
import io.github.hyochan.kmpiap.openiap.PaymentMode
import io.github.hyochan.kmpiap.openiap.DiscountOfferType
import io.github.hyochan.kmpiap.openiap.PendingPurchaseUpdateAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.RentalDetailsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionPeriod
import io.github.hyochan.kmpiap.openiap.SubscriptionPeriodUnit
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import io.github.hyochan.kmpiap.openiap.ValidTimeWindowAndroid
import io.github.hyochan.kmpiap.openiap.SubResponseCodeAndroid
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.selects.select
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
            val errors = listOfNotNull(
                inAppResult.exceptionOrNull(),
                subscriptionsResult.exceptionOrNull(),
            )
            errors.firstOrNull { error ->
                (error as? PurchaseException)?.error?.code == ErrorCode.ServiceDisconnected
            }?.let { throw it }
            val failedOutcome = ProductQueryOutcome(emptyList(), emptyList(), false)
            val inApp = inAppResult.getOrElse { failedOutcome }
            val subscriptions = subscriptionsResult.getOrElse { failedOutcome }
            if (!inApp.succeeded && !subscriptions.succeeded) {
                throw errors.first()
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

internal fun authoritativeStorefrontCountryOrNull(countryCode: String?): String? =
    countryCode?.trim()?.takeIf { it.isNotEmpty() }

@Suppress("DEPRECATION")
internal fun mapBillingResponseCode(responseCode: Int): ErrorCode = when (responseCode) {
    BillingClient.BillingResponseCode.USER_CANCELED -> ErrorCode.UserCancelled
    BillingClient.BillingResponseCode.NETWORK_ERROR -> ErrorCode.NetworkError
    BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> ErrorCode.ServiceError
    BillingClient.BillingResponseCode.SERVICE_TIMEOUT -> ErrorCode.ServiceTimeout
    BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> ErrorCode.BillingUnavailable
    BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> ErrorCode.ItemUnavailable
    BillingClient.BillingResponseCode.DEVELOPER_ERROR -> ErrorCode.DeveloperError
    BillingClient.BillingResponseCode.ERROR -> ErrorCode.ServiceError
    BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> ErrorCode.AlreadyOwned
    BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> ErrorCode.ItemNotOwned
    BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> ErrorCode.ServiceDisconnected
    BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> ErrorCode.FeatureNotSupported
    else -> ErrorCode.Unknown
}

internal fun BillingResult.toBillingOperationError(
    defaultMessage: String,
    requestProductId: String? = null,
): PurchaseError {
    val code = mapBillingResponseCode(responseCode)
    val diagnosticMessage = debugMessage.takeIf { it.isNotBlank() }
    return PurchaseError(
        code = code,
        debugMessage = diagnosticMessage,
        message = diagnosticMessage ?: defaultMessage,
        productId = requestProductId,
        responseCode = responseCode,
        subResponseCodeAndroid = onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode(),
    )
}

internal fun BillingResult.toPurchaseUpdateError(requestProductId: String? = null): PurchaseError =
    toBillingOperationError(
        defaultMessage = if (
            mapBillingResponseCode(responseCode) == ErrorCode.UserCancelled
        ) {
            "User cancelled the operation"
        } else {
            "Purchase failed"
        },
        requestProductId = requestProductId,
    )

internal fun BillingResult.toQueryProductError(
    productIds: List<String>,
    productType: String,
    isEmptyProductList: Boolean,
): PurchaseError {
    val diagnosticMessage = debugMessage.takeIf { it.isNotBlank() }
    return PurchaseError(
        code = ErrorCode.QueryProduct,
        debugMessage = diagnosticMessage,
        isEmptyProductList = isEmptyProductList,
        message = diagnosticMessage ?: "Failed to query product details",
        productIds = productIds,
        productType = productType,
        responseCode = responseCode,
    )
}

internal fun Int.toOpenIapSubResponseCode(): SubResponseCodeAndroid? = when (this) {
    BillingClient.OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE ->
        SubResponseCodeAndroid.NoApplicableSubResponseCode
    BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS ->
        SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds
    BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE ->
        SubResponseCodeAndroid.UserIneligible
    else -> null
}

/**
 * Maps SubscriptionReplacementModeAndroid to BillingFlowParams product-level replacement mode.
 */
internal fun mapReplacementMode(mode: SubscriptionReplacementModeAndroid): Int? = when (mode) {
    SubscriptionReplacementModeAndroid.UnknownReplacementMode ->
        throw IllegalArgumentException("A concrete subscription replacement mode is required.")
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

internal fun resolveSubscriptionReplacementMode(
    purchaseToken: String?,
    originalExternalTransactionId: String?,
    hasProductLevelReplacementParams: Boolean = false
): Int? = if (hasProductLevelReplacementParams) null else 5.takeIf {
    !purchaseToken.isNullOrBlank() && originalExternalTransactionId.isNullOrBlank()
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

internal fun tryGetApplicationContext(): Context? = runCatching {
    val activityThreadClass = Class.forName("android.app.ActivityThread")
    val activityThread = activityThreadClass.getMethod("currentActivityThread").invoke(null)
    val application = activityThreadClass.getMethod("getApplication").invoke(activityThread) as? Application
    application?.applicationContext
}.getOrNull()

internal suspend fun loadProductDetails(
    client: BillingClient,
    productType: String,
    skus: List<String>,
    disconnectSignal: Deferred<PurchaseError>? = null,
): Map<String, ProductDetails> {
    val requestedSkus = skus.distinct()
    val details = mutableMapOf<String, ProductDetails>()

    // Google discourages reusing cached ProductDetails for a purchase. Always
    // refresh every requested SKU immediately before building BillingFlowParams.
    if (requestedSkus.isNotEmpty()) {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                requestedSkus.map { sku ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku)
                        .setProductType(productType)
                        .build()
                }
            )
            .build()

        val queryDeferred = CompletableDeferred<Pair<BillingResult, QueryProductDetailsResult>>()
        client.queryProductDetailsAsync(params) { billingResult: BillingResult, queryResult: QueryProductDetailsResult ->
            queryDeferred.complete(billingResult to queryResult)
        }
        val (billingResult, queryResult) = if (disconnectSignal == null) {
            queryDeferred.await()
        } else {
            select {
                queryDeferred.onAwait { it }
                disconnectSignal.onAwait { error -> throw PurchaseException(error) }
            }
        }

        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            throw PurchaseException(
                billingResult.toQueryProductError(
                    productIds = requestedSkus,
                    productType = productType,
                    isEmptyProductList = queryResult.productDetailsList.isEmpty(),
                )
            )
        }

        if (queryResult.productDetailsList.isEmpty()) {
            throw PurchaseException(
                billingResult.toQueryProductError(
                    productIds = requestedSkus,
                    productType = productType,
                    isEmptyProductList = true,
                )
            )
        }

        queryResult.productDetailsList.forEach { detail ->
            details[detail.productId] = detail
        }
    }

    if (details.size != requestedSkus.size) {
        val missingSku = requestedSkus.firstOrNull { !details.containsKey(it) }.orEmpty()
        throw PurchaseException(
            PurchaseError(
                code = ErrorCode.SkuNotFound,
                message = "Product not found: $missingSku",
                productId = missingSku,
            )
        )
    }

    return details
}

internal fun Long.toOpenIapTransactionDate(): Double = toDouble()

internal fun billingPurchaseIsSuspended(purchase: Any): Boolean =
    listOf("getIsSuspended", "isSuspended").firstNotNullOfOrNull { methodName ->
        runCatching {
            purchase.javaClass.getMethod(methodName).invoke(purchase) as? Boolean
        }.getOrNull()
    } ?: false

internal fun com.android.billingclient.api.Purchase.toPurchase(): Purchase {
    val purchaseStateEnum = when (purchaseState) {
        com.android.billingclient.api.Purchase.PurchaseState.PURCHASED -> PurchaseState.Purchased
        com.android.billingclient.api.Purchase.PurchaseState.PENDING -> PurchaseState.Pending
        com.android.billingclient.api.Purchase.PurchaseState.UNSPECIFIED_STATE -> PurchaseState.Unknown
        else -> PurchaseState.Unknown
    }

    val accountIdentifiers = accountIdentifiers
    val pendingUpdate = runCatching { pendingPurchaseUpdate }.getOrNull()?.let { update ->
        PendingPurchaseUpdateAndroid(
            products = update.products,
            purchaseToken = update.purchaseToken,
        )
    }

    return PurchaseAndroid(
        autoRenewingAndroid = isAutoRenewing,
        dataAndroid = originalJson,
        developerPayloadAndroid = developerPayload,
        id = orderId ?: purchaseToken,
        ids = products,
        isAcknowledgedAndroid = isAcknowledged,
        isAutoRenewing = isAutoRenewing,
        isSuspendedAndroid = billingPurchaseIsSuspended(this),
        obfuscatedAccountIdAndroid = accountIdentifiers?.obfuscatedAccountId,
        obfuscatedProfileIdAndroid = accountIdentifiers?.obfuscatedProfileId,
        packageNameAndroid = packageName,
        pendingPurchaseUpdateAndroid = pendingUpdate,
        productId = products.firstOrNull() ?: "",
        store = IapStore.Google,
        purchaseState = purchaseStateEnum,
        purchaseToken = purchaseToken,
        quantity = quantity,
        signatureAndroid = signature,
        transactionDate = purchaseTime.toOpenIapTransactionDate(),
        transactionId = orderId,
        // Amazon-flavor-only fields; Google Play purchases never carry them.
        userIdAmazon = null,
        userMarketplaceAmazon = null,
    )
}

internal fun com.android.billingclient.api.Purchase.toActiveSubscription(): ActiveSubscription =
    ActiveSubscription(
        autoRenewingAndroid = isAutoRenewing,
        isActive = purchaseState ==
            com.android.billingclient.api.Purchase.PurchaseState.PURCHASED,
        productId = products.firstOrNull().orEmpty(),
        purchaseToken = purchaseToken,
        purchaseTokenAndroid = purchaseToken,
        transactionDate = purchaseTime.toOpenIapTransactionDate(),
        transactionId = orderId ?: purchaseToken,
    )

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
    val discountOffers = if (allOneTimeOffers.isNotEmpty()) {
        allOneTimeOffers.map { it.toDiscountOffer() }
    } else {
        oneTime?.let { listOf(it.toDiscountOffer()) }
    }
    val subscriptionOffers = offers?.map { it.toSubscriptionOffer() }

    return ProductAndroid(
        currency = currencyCode,
        debugDescription = description,
        description = description,
        discountOffers = discountOffers,
        displayName = name,
        displayPrice = displayPrice,
        id = productId,
        nameAndroid = name,
        platform = IapPlatform.Android,
        price = priceValue,
        productStatusAndroid = ProductStatusAndroid.Ok,
        subscriptionOffers = subscriptionOffers,
        title = title,
        type = productType
    )
}

internal fun ProductDetails.toSubscriptionProduct(): ProductSubscriptionAndroid? {
    val product = toProduct() as? ProductAndroid ?: return null
    val offers = product.subscriptionOffers ?: return null
    return ProductSubscriptionAndroid(
        currency = product.currency,
        debugDescription = product.debugDescription,
        description = product.description,
        displayName = product.displayName,
        displayPrice = product.displayPrice,
        id = product.id,
        nameAndroid = product.nameAndroid,
        platform = product.platform,
        price = product.price,
        productStatusAndroid = product.productStatusAndroid,
        subscriptionOffers = offers,
        title = product.title,
        type = product.type
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

internal fun ProductDetails.SubscriptionOfferDetails.toSubscriptionOffer(): SubscriptionOffer {
    val mappedPricingPhases = PricingPhasesAndroid(
        pricingPhaseList = pricingPhases.pricingPhaseList.map { phase ->
            PricingPhaseAndroid(
                billingCycleCount = phase.billingCycleCount,
                billingPeriod = phase.billingPeriod,
                formattedPrice = phase.formattedPrice,
                priceAmountMicros = phase.priceAmountMicros.toString(),
                priceCurrencyCode = phase.priceCurrencyCode,
                recurrenceMode = phase.recurrenceMode,
            )
        },
    )
    val firstPhase = mappedPricingPhases.pricingPhaseList.firstOrNull()
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
        !offerId.isNullOrEmpty() -> DiscountOfferType.Promotional
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
        pricingPhasesAndroid = mappedPricingPhases,
        installmentPlanDetailsAndroid = runCatching { installmentPlanDetails }.getOrNull()?.let { details ->
            InstallmentPlanDetailsAndroid(
                commitmentPaymentsCount = details.installmentPlanCommitmentPaymentsCount,
                subsequentCommitmentPaymentsCount =
                    details.subsequentInstallmentPlanCommitmentPaymentsCount,
            )
        },
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
    BillingProgramAndroid.BillingChoice -> OpenIapBillingProgram.BillingChoice
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

/**
 * Re-shapes an openiap-google IAPKit result into this module's generated types.
 * openiap-google has already decoded it safely, so unknown values degrade here
 * rather than re-imposing a fail-closed gate when the two versions drift.
 */
internal fun AndroidRequestVerifyPurchaseWithIapkitResult.toKmpIapkitResult(): RequestVerifyPurchaseWithIapkitResult =
    RequestVerifyPurchaseWithIapkitResult(
        clientPayload = clientPayload?.let { payload ->
            IapkitClientPayloadFormat.entries
                .firstOrNull { it.rawValue == payload.format.toJson() }
                ?.let { format ->
                    IapkitProductClientPayload(
                        body = payload.body,
                        format = format,
                        updatedAt = payload.updatedAt,
                        version = payload.version
                    )
                }
        },
        environment = environment,
        isValid = isValid,
        productId = productId,
        state = runCatching {
            IapkitPurchaseState.fromJson(state.toJson())
        }.getOrDefault(IapkitPurchaseState.Unknown),
        store = runCatching {
            IapStore.fromJson(store.toJson())
        }.getOrDefault(IapStore.Unknown)
    )
