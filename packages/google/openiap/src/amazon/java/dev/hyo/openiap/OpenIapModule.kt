package dev.hyo.openiap

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.amazon.device.iap.PurchasingListener
import com.amazon.device.iap.PurchasingService
import com.amazon.device.iap.model.FulfillmentResult
import com.amazon.device.iap.model.ProductDataResponse
import com.amazon.device.iap.model.PurchaseResponse
import com.amazon.device.iap.model.PurchaseUpdatesResponse
import com.amazon.device.iap.model.UserData
import com.amazon.device.iap.model.UserDataResponse
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.listener.DeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.listener.UserChoiceBillingListener
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap
import com.amazon.device.iap.model.Product as AmazonProduct
import com.amazon.device.iap.model.ProductType as AmazonProductType
import com.amazon.device.iap.model.Receipt as AmazonReceipt

private const val TAG = "OpenIapAmazon"
private const val AMAZON_REQUEST_TIMEOUT_MS = 60_000L
private const val AMAZON_PRODUCT_DATA_BATCH_SIZE = 100

/**
 * OpenIapModule for Amazon Appstore SDK IAP.
 *
 * Amazon's native IAP API is listener based instead of connection based. The
 * OpenIAP connection lifecycle registers the listener and enables pending
 * purchases, while individual API calls await the matching RequestId callback.
 */
class OpenIapModule(
    private val context: Context,
    @Suppress("UNUSED_PARAMETER")
    private var alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    @Suppress("UNUSED_PARAMETER")
    private var userChoiceBillingListener: UserChoiceBillingListener? = null,
    @Suppress("UNUSED_PARAMETER")
    private var developerProvidedBillingListener: DeveloperProvidedBillingListener? = null
) : OpenIapProtocol, PurchasingListener {

    constructor(context: Context, enableAlternativeBilling: Boolean) : this(
        context,
        if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE,
        null
    )

    private var currentActivityRef: WeakReference<Activity>? = null
    private var isRegistered = false
    private var storefrontCode: String = ""

    private val productDataRequests = ConcurrentHashMap<String, CompletableDeferred<ProductDataResponse>>()
    private val purchaseRequests = ConcurrentHashMap<String, CompletableDeferred<PurchaseResponse>>()
    private val purchaseUpdatesRequests = ConcurrentHashMap<String, CompletableDeferred<PurchaseUpdatesResponse>>()
    private val userDataRequests = ConcurrentHashMap<String, CompletableDeferred<UserDataResponse>>()
    private val earlyProductDataResponses = ConcurrentHashMap<String, ProductDataResponse>()
    private val earlyPurchaseResponses = ConcurrentHashMap<String, PurchaseResponse>()
    private val earlyPurchaseUpdatesResponses = ConcurrentHashMap<String, PurchaseUpdatesResponse>()
    private val earlyUserDataResponses = ConcurrentHashMap<String, UserDataResponse>()
    private val purchaseTypeByReceiptId = ConcurrentHashMap<String, AmazonProductType>()
    private val productTypeBySku = ConcurrentHashMap<String, AmazonProductType>()

    private val purchaseUpdateListeners = ConcurrentHashMap.newKeySet<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = ConcurrentHashMap.newKeySet<OpenIapPurchaseErrorListener>()

    private fun ensureRegistered() {
        if (isRegistered) return
        PurchasingService.registerListener(context.applicationContext, this)
        runCatching { PurchasingService.enablePendingPurchases() }
            .onFailure { OpenIapLog.w("Amazon pending purchases unavailable: ${it.message}", TAG) }
        isRegistered = true
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    override val initConnection: MutationInitConnectionHandler = {
        withContext(Dispatchers.Main) {
            runCatching {
                ensureRegistered()
                val response = requestUserData()
                when (response.requestStatus) {
                    UserDataResponse.RequestStatus.SUCCESSFUL -> true
                    UserDataResponse.RequestStatus.NOT_SUPPORTED -> {
                        OpenIapLog.w("Amazon initConnection not supported on this device", TAG)
                        false
                    }
                    UserDataResponse.RequestStatus.FAILED -> {
                        OpenIapLog.w("Amazon initConnection user data request failed", TAG)
                        false
                    }
                }
            }.getOrElse { error ->
                OpenIapLog.e("Amazon initConnection failed: ${error.message}", error, TAG)
                false
            }
        }
    }

    override val endConnection: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            productDataRequests.clear()
            purchaseRequests.clear()
            purchaseUpdatesRequests.clear()
            userDataRequests.clear()
            earlyProductDataResponses.clear()
            earlyPurchaseResponses.clear()
            earlyPurchaseUpdatesResponses.clear()
            earlyUserDataResponses.clear()
            purchaseTypeByReceiptId.clear()
            productTypeBySku.clear()
            storefrontCode = ""
            true
        }
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val queryType = params.type ?: ProductQueryType.All
            if (params.skus.isEmpty() && queryType != ProductQueryType.All) {
                throw OpenIapError.EmptySkuList
            }

            val responses = params.skus
                .chunked(AMAZON_PRODUCT_DATA_BATCH_SIZE)
                .map { requestProductData(it) }
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
                    products.forEach { productTypeBySku[it.sku] = it.productType }

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

    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = {
        withContext(Dispatchers.IO) {
            ensureRegistered()
            requestPurchaseUpdates(reset = true)
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
                .map { purchase ->
                    ActiveSubscription(
                        autoRenewingAndroid = purchase.autoRenewingAndroid,
                        basePlanIdAndroid = purchase.currentPlanId,
                        currentPlanId = purchase.currentPlanId,
                        isActive = purchase.purchaseState == PurchaseState.Purchased,
                        productId = purchase.productId,
                        purchaseToken = purchase.purchaseToken,
                        purchaseTokenAndroid = purchase.purchaseToken,
                        transactionDate = purchase.transactionDate,
                        transactionId = purchase.transactionId ?: purchase.id
                    )
                }
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            ensureRegistered()
            val androidArgs = props.toAndroidPurchaseArgs()
            if (androidArgs.skus.isEmpty()) {
                emitPurchaseError(OpenIapError.EmptySkuList)
                return@withContext emptyList()
            }
            if (androidArgs.skus.size != 1) {
                emitPurchaseError(
                    OpenIapError.DeveloperError("Amazon Appstore SDK purchases one SKU at a time")
                )
                return@withContext emptyList()
            }

            val sku = androidArgs.skus.first()
            val response = requestAmazonPurchase(sku)
            when (response.requestStatus) {
                PurchaseResponse.RequestStatus.SUCCESSFUL -> {
                    val receipt = response.receipt ?: run {
                        emitPurchaseError(OpenIapError.PurchaseFailed("Amazon purchase response did not include a receipt"))
                        return@withContext emptyList()
                    }
                    val purchase = receipt.toPurchase()
                    purchaseTypeByReceiptId[receipt.receiptId] = receipt.productType
                    productTypeBySku[receipt.sku] = receipt.productType
                    purchaseUpdateListeners.forEach { listener ->
                        runCatching { listener.onPurchaseUpdated(purchase) }
                    }
                    listOf(purchase)
                }
                PurchaseResponse.RequestStatus.ALREADY_PURCHASED -> {
                    val error = OpenIapError.ItemAlreadyOwned("Amazon reported the item is already purchased")
                    emitPurchaseError(error)
                    emptyList()
                }
                PurchaseResponse.RequestStatus.INVALID_SKU -> {
                    val error = OpenIapError.SkuNotFound(sku)
                    emitPurchaseError(error)
                    emptyList()
                }
                PurchaseResponse.RequestStatus.NOT_SUPPORTED -> {
                    val error = OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device")
                    emitPurchaseError(error)
                    emptyList()
                }
                PurchaseResponse.RequestStatus.PENDING -> {
                    val error = OpenIapError.PurchaseDeferred
                    emitPurchaseError(error)
                    emptyList()
                }
                PurchaseResponse.RequestStatus.FAILED -> {
                    val error = OpenIapError.UserCancelled("Amazon purchase failed or was cancelled")
                    emitPurchaseError(error)
                    emptyList()
                }
            }
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
        withContext(Dispatchers.IO) {
            runCatching {
                ensureRegistered()
                PurchasingService.notifyFulfillment(purchaseToken, FulfillmentResult.FULFILLED)
                true
            }.getOrElse {
                OpenIapLog.w("Amazon acknowledge failed: ${it.message}", TAG)
                false
            }
        }
    }

    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            runCatching {
                ensureRegistered()
                PurchasingService.notifyFulfillment(purchaseToken, FulfillmentResult.FULFILLED)
                true
            }.getOrElse {
                OpenIapLog.w("Amazon consume failed: ${it.message}", TAG)
                false
            }
        }
    }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            requestPurchaseUpdates(reset = true)
            Unit
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = {
        withContext(Dispatchers.Main) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("amzn://apps/android?p=${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(intent) }
                .onFailure { OpenIapLog.w("Amazon subscription deep link unavailable: ${it.message}", TAG) }
            Unit
        }
    }

    @Deprecated("Use verifyPurchase")
    override val validateReceipt: MutationValidateReceiptHandler = {
        verifyPurchase(it)
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
        val amazon = options.amazon ?: throw OpenIapError.DeveloperError(
            "Amazon IAPKit verification requires amazon parameters"
        )
        val resolvedOptions = if (amazon.userId.isNullOrBlank()) {
            val userDataResponse = requestUserData()
            val userId = userDataResponse.userData?.userId
                ?: throw OpenIapError.DeveloperError("Amazon IAPKit verification could not resolve userId")
            options.copy(amazon = amazon.copy(userId = userId))
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

    override val queryHandlers: QueryHandlers = QueryHandlers(
        fetchProducts = fetchProducts,
        getActiveSubscriptions = getActiveSubscriptions,
        getAvailablePurchases = getAvailablePurchases,
        getStorefront = { getStorefront() },
        getStorefrontIOS = { getStorefront() },
        hasActiveSubscriptions = hasActiveSubscriptions
    )

    @Suppress("DEPRECATION")
    override val mutationHandlers: MutationHandlers = MutationHandlers(
        acknowledgePurchaseAndroid = acknowledgePurchaseAndroid,
        checkAlternativeBillingAvailabilityAndroid = { checkAlternativeBillingAvailability() },
        consumePurchaseAndroid = consumePurchaseAndroid,
        createAlternativeBillingTokenAndroid = { createAlternativeBillingReportingToken() },
        createBillingProgramReportingDetailsAndroid = { program ->
            createBillingProgramReportingDetails(program)
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
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        showAlternativeBillingDialogAndroid = {
            val activity = currentActivityRef?.get()
                ?: throw OpenIapError.MissingCurrentActivity
            showAlternativeBillingInformationDialog(activity)
        },
        validateReceipt = validateReceipt,
        verifyPurchase = verifyPurchase,
        verifyPurchaseWithProvider = verifyPurchaseWithProvider
    )

    override val subscriptionHandlers: SubscriptionHandlers = SubscriptionHandlers(
        purchaseError = purchaseError,
        purchaseUpdated = purchaseUpdated,
        subscriptionBillingIssue = subscriptionBillingIssue
    )

    suspend fun getStorefront(): String = withContext(Dispatchers.IO) {
        if (storefrontCode.isNotBlank()) return@withContext storefrontCode
        runCatching { requestUserData() }
        storefrontCode
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

    override fun setUserChoiceBillingListener(listener: UserChoiceBillingListener?) {
        userChoiceBillingListener = listener
    }

    override fun setDeveloperProvidedBillingListener(listener: DeveloperProvidedBillingListener?) {
        developerProvidedBillingListener = listener
    }

    @Deprecated("Amazon Appstore does not support Google Play alternative billing")
    override suspend fun checkAlternativeBillingAvailability(): Boolean = false

    @Deprecated("Amazon Appstore does not support Google Play alternative billing")
    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean = false

    @Deprecated("Amazon Appstore does not support Google Play alternative billing")
    override suspend fun createAlternativeBillingReportingToken(): String? = null

    override suspend fun isBillingProgramAvailable(
        program: BillingProgramAndroid
    ): BillingProgramAvailabilityResultAndroid = BillingProgramAvailabilityResultAndroid(
        billingProgram = program,
        isAvailable = false
    )

    override suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid
    ): BillingProgramReportingDetailsAndroid {
        throw OpenIapError.FeatureNotSupported("Amazon Appstore does not support Google Play billing programs")
    }

    override suspend fun launchExternalLink(
        activity: Activity,
        params: LaunchExternalLinkParamsAndroid
    ): Boolean = false

    override fun onUserDataResponse(userDataResponse: UserDataResponse) {
        updateStorefront(userDataResponse.userData)
        completeOrCache(
            userDataRequests,
            earlyUserDataResponses,
            userDataResponse.requestId.toString(),
            userDataResponse
        )
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
        completeOrCache(
            purchaseRequests,
            earlyPurchaseResponses,
            purchaseResponse.requestId.toString(),
            purchaseResponse
        )
    }

    override fun onPurchaseUpdatesResponse(purchaseUpdatesResponse: PurchaseUpdatesResponse) {
        purchaseUpdatesResponse.receipts.orEmpty().forEach { receipt ->
            purchaseTypeByReceiptId[receipt.receiptId] = receipt.productType
            productTypeBySku[receipt.sku] = receipt.productType
        }
        completeOrCache(
            purchaseUpdatesRequests,
            earlyPurchaseUpdatesResponses,
            purchaseUpdatesResponse.requestId.toString(),
            purchaseUpdatesResponse
        )
    }

    private fun emitPurchaseError(error: OpenIapError) {
        purchaseErrorListeners.forEach { listener ->
            runCatching { listener.onPurchaseError(error) }
        }
    }

    private suspend fun requestUserData(): UserDataResponse {
        val requestId = withContext(Dispatchers.Main) {
            ensureRegistered()
            PurchasingService.getUserData().toString()
        }
        return awaitAmazonResponse(requestId, userDataRequests, earlyUserDataResponses)
    }

    private suspend fun requestProductData(skus: List<String>): ProductDataResponse {
        val requestId = withContext(Dispatchers.Main) {
            ensureRegistered()
            PurchasingService.getProductData(skus.toSet()).toString()
        }
        return awaitAmazonResponse(requestId, productDataRequests, earlyProductDataResponses)
    }

    private suspend fun requestAmazonPurchase(sku: String): PurchaseResponse {
        val requestId = withContext(Dispatchers.Main) {
            ensureRegistered()
            PurchasingService.purchase(sku).toString()
        }
        return awaitAmazonResponse(requestId, purchaseRequests, earlyPurchaseResponses)
    }

    private suspend fun requestPurchaseUpdates(reset: Boolean): List<Purchase> {
        val purchases = mutableListOf<Purchase>()
        var shouldReset = reset
        do {
            val response = awaitPurchaseUpdates(shouldReset)
            shouldReset = false
            when (response.requestStatus) {
                PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL -> {
                    purchases += response.receipts.orEmpty().map { receipt ->
                        purchaseTypeByReceiptId[receipt.receiptId] = receipt.productType
                        productTypeBySku[receipt.sku] = receipt.productType
                        receipt.toPurchase()
                    }
                }
                PurchaseUpdatesResponse.RequestStatus.NOT_SUPPORTED -> {
                    throw OpenIapError.FeatureNotSupported("Amazon Appstore IAP is not supported on this device")
                }
                PurchaseUpdatesResponse.RequestStatus.FAILED -> {
                    throw OpenIapError.RestoreFailed
                }
            }
        } while (response.hasMore())
        return purchases
    }

    private suspend fun awaitPurchaseUpdates(reset: Boolean): PurchaseUpdatesResponse {
        val requestId = withContext(Dispatchers.Main) {
            ensureRegistered()
            PurchasingService.getPurchaseUpdates(reset).toString()
        }
        return awaitAmazonResponse(requestId, purchaseUpdatesRequests, earlyPurchaseUpdatesResponses)
    }

    private suspend fun <T> awaitAmazonResponse(
        requestId: String,
        pending: ConcurrentHashMap<String, CompletableDeferred<T>>,
        earlyResponses: ConcurrentHashMap<String, T>
    ): T {
        earlyResponses.remove(requestId)?.let { return it }

        val deferred = CompletableDeferred<T>()
        pending[requestId] = deferred
        earlyResponses.remove(requestId)?.let { response ->
            pending.remove(requestId)
            if (!deferred.isCompleted) deferred.complete(response)
        }

        return try {
            withTimeout(AMAZON_REQUEST_TIMEOUT_MS) { deferred.await() }
        } catch (_: TimeoutCancellationException) {
            throw OpenIapError.ServiceTimeout("Amazon Appstore request timed out")
        } finally {
            pending.remove(requestId)
            earlyResponses.remove(requestId)
        }
    }

    private fun <T> completeOrCache(
        pending: ConcurrentHashMap<String, CompletableDeferred<T>>,
        earlyResponses: ConcurrentHashMap<String, T>,
        requestId: String,
        value: T
    ) {
        val deferred = pending.remove(requestId)
        if (deferred != null) {
            if (!deferred.isCompleted) deferred.complete(value)
        } else {
            earlyResponses[requestId] = value
        }
    }

    private fun updateStorefront(userData: UserData?) {
        val countryCode = userData?.countryCode
        storefrontCode = countryCode
            ?: userData?.marketplace
            ?: storefrontCode
    }

    private fun AmazonProduct.toInAppProduct(): ProductAndroid {
        return ProductAndroid(
            currency = "",
            description = description.orEmpty(),
            displayName = title,
            displayPrice = price.orEmpty(),
            id = sku,
            nameAndroid = title.orEmpty(),
            platform = IapPlatform.Android,
            price = null,
            productStatusAndroid = ProductStatusAndroid.Ok,
            title = title.orEmpty(),
            type = ProductType.InApp
        )
    }

    private fun AmazonProduct.toSubscriptionProduct(): ProductSubscriptionAndroid {
        val subscriptionPeriod = this.subscriptionPeriod
        val phase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = subscriptionPeriod.orEmpty(),
            formattedPrice = price.orEmpty(),
            priceAmountMicros = "0",
            priceCurrencyCode = "",
            recurrenceMode = 1
        )
        val phases = PricingPhasesAndroid(listOf(phase))
        val legacyOffer = ProductSubscriptionAndroidOfferDetails(
            basePlanId = sku,
            offerId = null,
            offerTags = emptyList(),
            offerToken = "",
            pricingPhases = phases
        )
        val standardizedOffer = SubscriptionOffer(
            basePlanIdAndroid = sku,
            currency = "",
            displayPrice = price.orEmpty(),
            id = sku,
            offerTagsAndroid = emptyList(),
            offerTokenAndroid = "",
            paymentMode = PaymentMode.PayAsYouGo,
            period = null,
            price = 0.0,
            pricingPhasesAndroid = phases,
            type = DiscountOfferType.Introductory
        )
        return ProductSubscriptionAndroid(
            currency = "",
            description = description.orEmpty(),
            displayName = title,
            displayPrice = price.orEmpty(),
            id = sku,
            nameAndroid = title.orEmpty(),
            platform = IapPlatform.Android,
            price = null,
            productStatusAndroid = ProductStatusAndroid.Ok,
            subscriptionOfferDetailsAndroid = listOf(legacyOffer),
            subscriptionOffers = listOf(standardizedOffer),
            title = title.orEmpty(),
            type = ProductType.Subs
        )
    }

    private fun AmazonReceipt.toPurchase(): PurchaseAndroid {
        val isSubscription = productType == AmazonProductType.SUBSCRIPTION
        val dateMillis = purchaseDate?.time?.toDouble() ?: 0.0
        val state = if (isCanceled) PurchaseState.Unknown else PurchaseState.Purchased
        return PurchaseAndroid(
            autoRenewingAndroid = isSubscription && !isCanceled,
            currentPlanId = if (isSubscription) sku else null,
            dataAndroid = toJSON().toString(),
            id = receiptId,
            ids = listOf(sku),
            isAcknowledgedAndroid = null,
            isAutoRenewing = isSubscription && !isCanceled,
            packageNameAndroid = context.packageName,
            platform = IapPlatform.Android,
            productId = sku,
            purchaseState = state,
            purchaseToken = receiptId,
            quantity = 1,
            signatureAndroid = null,
            store = IapStore.Amazon,
            transactionDate = dateMillis,
            transactionId = receiptId
        )
    }

}
