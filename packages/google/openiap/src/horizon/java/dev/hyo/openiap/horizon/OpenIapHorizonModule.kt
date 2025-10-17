package dev.hyo.openiap.horizon

import android.app.Activity
import android.content.Context
import android.util.Log
import com.meta.horizon.billingclient.api.AcknowledgePurchaseParams
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
import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.IapPlatform
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationHandlers
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.QueryFetchProductsHandler
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.QueryHandlers
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import dev.hyo.openiap.ReceiptValidationProps
import dev.hyo.openiap.RequestPurchaseResultPurchase
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.SubscriptionHandlers
import dev.hyo.openiap.SubscriptionPurchaseErrorHandler
import dev.hyo.openiap.SubscriptionPurchaseUpdatedHandler
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.utils.HorizonBillingConverters.toActiveSubscription
import dev.hyo.openiap.utils.HorizonBillingConverters.toInAppProduct
import dev.hyo.openiap.utils.HorizonBillingConverters.toPurchase
import dev.hyo.openiap.utils.HorizonBillingConverters.toSubscriptionProduct
import dev.hyo.openiap.utils.toActiveSubscription
import dev.hyo.openiap.utils.toProduct
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.lang.ref.WeakReference
import kotlin.coroutines.resume

private const val TAG = "OpenIapHorizonModule"

class OpenIapHorizonModule(
    private val context: Context,
    private val appId: String? = null
) : OpenIapProtocol, PurchasesUpdatedListener {

    private var billingClient: BillingClient? = null
    private var currentActivityRef: WeakReference<Activity>? = null
    private var currentPurchaseCallback: ((Result<List<Purchase>>) -> Unit)? = null

    private val purchaseUpdateListeners = mutableSetOf<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = mutableSetOf<OpenIapPurchaseErrorListener>()

    init {
        buildBillingClient()
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    override val initConnection: MutationInitConnectionHandler = {
        withContext(Dispatchers.IO) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                val client = billingClient ?: run {
                    if (continuation.isActive) continuation.resume(false)
                    return@suspendCancellableCoroutine
                }
                client.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        val ok = result.responseCode == BillingClient.BillingResponseCode.OK
                        if (!ok) {
                            OpenIapLog.w("Horizon setup failed: ${result.debugMessage}", TAG)
                        }
                        if (continuation.isActive) continuation.resume(ok)
                    }

                    override fun onBillingServiceDisconnected() {
                        OpenIapLog.i("Horizon service disconnected", TAG)
                    }
                })
            }
        }
    }

    override val endConnection: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            runCatching {
                billingClient?.endConnection()
                billingClient = null
                true
            }.getOrElse { false }
        }
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (params.skus.isEmpty()) throw OpenIapError.EmptySkuList

            val queryType = params.type ?: ProductQueryType.All
            val includeInApp = queryType == ProductQueryType.InApp || queryType == ProductQueryType.All
            val includeSubs = queryType == ProductQueryType.Subs || queryType == ProductQueryType.All

            val inAppProducts = if (includeInApp) {
                queryProductDetails(client, params.skus, BillingClient.ProductType.INAPP)
                    .map { it.toInAppProduct() }
            } else emptyList()

            val subscriptionProducts = if (includeSubs) {
                queryProductDetails(client, params.skus, BillingClient.ProductType.SUBS)
                    .map { it.toSubscriptionProduct() }
            } else emptyList()

            when (queryType) {
                ProductQueryType.InApp -> FetchProductsResultProducts(inAppProducts)
                ProductQueryType.Subs -> FetchProductsResultSubscriptions(subscriptionProducts)
                ProductQueryType.All -> {
                    val combined = buildList<Product> {
                        addAll(inAppProducts)
                        addAll(subscriptionProducts.map(ProductSubscriptionAndroid::toProduct))
                    }
                    FetchProductsResultProducts(combined)
                }
            }
        }
    }

    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { _ ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val purchases = queryPurchases(client, BillingClient.ProductType.INAPP) +
                queryPurchases(client, BillingClient.ProductType.SUBS)
            purchases
        }
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val subs = queryPurchases(client, BillingClient.ProductType.SUBS)
            val filtered = if (subscriptionIds.isNullOrEmpty()) {
                subs
            } else {
                subs.filter { purchase ->
                    val id = (purchase as? PurchaseAndroid)?.productId
                    subscriptionIds.contains(id)
                }
            }
            filtered.mapNotNull { (it as? PurchaseAndroid)?.toActiveSubscription() }
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val androidArgs = props.toAndroidPurchaseArgs()
            if (androidArgs.skus.isEmpty()) throw OpenIapError.EmptySkuList

            val activity = currentActivityRef?.get() ?: (context as? Activity)
            if (activity == null) {
                val err = OpenIapError.MissingCurrentActivity
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            val desiredType = if (androidArgs.type == ProductQueryType.Subs) {
                BillingClient.ProductType.SUBS
            } else BillingClient.ProductType.INAPP

            val details = queryProductDetails(client, androidArgs.skus, desiredType)
            if (details.isEmpty()) {
                val err = OpenIapError.SkuNotFound(androidArgs.skus.firstOrNull().orEmpty())
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            val detailsBySku = details.associateBy { it.productId }
            val orderedDetails = androidArgs.skus.mapNotNull { detailsBySku[it] }
            if (orderedDetails.size != androidArgs.skus.size) {
                val missingSku = androidArgs.skus.firstOrNull { !detailsBySku.containsKey(it) }
                val err = OpenIapError.SkuNotFound(missingSku ?: "")
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            suspendCancellableCoroutine<List<Purchase>> { continuation ->
                currentPurchaseCallback = { result ->
                    if (continuation.isActive) continuation.resume(result.getOrDefault(emptyList()))
                }

                val paramsList = orderedDetails.mapIndexed { index, detail ->
                    val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(detail)
                    if (desiredType == BillingClient.ProductType.SUBS) {
                        val fromOffers = androidArgs.subscriptionOffers
                            ?.firstOrNull { it.sku == detail.productId }
                            ?.offerToken
                        val resolvedToken = fromOffers
                            ?: detail.subscriptionOfferDetails?.firstOrNull()?.offerToken
                        resolvedToken?.let { builder.setOfferToken(it) }
                    }
                    builder.build()
                }

                val flowBuilder = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(paramsList)
                    .setIsOfferPersonalized(androidArgs.isOfferPersonalized == true)

                androidArgs.obfuscatedAccountId?.let { flowBuilder.setObfuscatedAccountId(it) }
                androidArgs.obfuscatedProfileId?.let { flowBuilder.setObfuscatedProfileId(it) }

                val result = client.launchBillingFlow(activity, flowBuilder.build())
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    val error = OpenIapError.fromBillingResponseCode(result.responseCode, result.debugMessage)
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(error) } }
                    if (continuation.isActive) continuation.resume(emptyList())
                    currentPurchaseCallback = null
                }
            }
        }

        RequestPurchaseResultPurchases(purchases)
    }

    override val finishTransaction: MutationFinishTransactionHandler = { purchase, isConsumable ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val token = purchase.purchaseToken ?: return@withContext
            if (isConsumable == true) {
                val params = ConsumeParams.newBuilder().setPurchaseToken(token).build()
                suspendCancellableCoroutine<Unit> { continuation ->
                    client.consumeAsync(params) { result, _ ->
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            OpenIapLog.w("Failed to consume Horizon purchase: ${result.debugMessage}", TAG)
                        }
                        if (continuation.isActive) continuation.resume(Unit)
                    }
                }
            } else {
                val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()
                suspendCancellableCoroutine<Unit> { continuation ->
                    client.acknowledgePurchase(params) { result ->
                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            OpenIapLog.w("Failed to acknowledge Horizon purchase: ${result.debugMessage}", TAG)
                        }
                        if (continuation.isActive) continuation.resume(Unit)
                    }
                }
            }
        }
    }

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchaseToken).build()
            suspendCancellableCoroutine<Boolean> { continuation ->
                client.acknowledgePurchase(params) { result ->
                    val success = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!success) {
                        OpenIapLog.w("Horizon acknowledge failed: ${result.debugMessage}", TAG)
                    }
                    if (continuation.isActive) continuation.resume(success)
                }
            }
        }
    }

    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = ConsumeParams.newBuilder().setPurchaseToken(purchaseToken).build()
            suspendCancellableCoroutine<Boolean> { continuation ->
                client.consumeAsync(params) { result, _ ->
                    val success = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!success) {
                        OpenIapLog.w("Horizon consume failed: ${result.debugMessage}", TAG)
                    }
                    if (continuation.isActive) continuation.resume(success)
                }
            }
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = { _ -> }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            runCatching { getAvailablePurchases(null) }
            Unit
        }
    }

    override val validateReceipt: MutationValidateReceiptHandler = { throw OpenIapError.NotSupported }

    private val purchaseError: SubscriptionPurchaseErrorHandler = {
        onPurchaseError(this::addPurchaseErrorListener, this::removePurchaseErrorListener)
    }

    private val purchaseUpdated: SubscriptionPurchaseUpdatedHandler = {
        onPurchaseUpdated(this::addPurchaseUpdateListener, this::removePurchaseUpdateListener)
    }

    override val queryHandlers: QueryHandlers = QueryHandlers(
        fetchProducts = fetchProducts,
        getActiveSubscriptions = getActiveSubscriptions,
        getAvailablePurchases = getAvailablePurchases,
        getStorefrontIOS = { getStorefront() },
        hasActiveSubscriptions = hasActiveSubscriptions
    )

    override val mutationHandlers: MutationHandlers = MutationHandlers(
        acknowledgePurchaseAndroid = acknowledgePurchaseAndroid,
        consumePurchaseAndroid = consumePurchaseAndroid,
        deepLinkToSubscriptions = deepLinkToSubscriptions,
        endConnection = endConnection,
        finishTransaction = finishTransaction,
        initConnection = initConnection,
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        validateReceipt = validateReceipt
    )

    override val subscriptionHandlers: SubscriptionHandlers = SubscriptionHandlers(
        purchaseError = purchaseError,
        purchaseUpdated = purchaseUpdated
    )

    private suspend fun getStorefront(): String = withContext(Dispatchers.IO) {
        val client = billingClient ?: return@withContext ""
        suspendCancellableCoroutine { continuation ->
            runCatching {
                client.getBillingConfigAsync(
                    GetBillingConfigParams.newBuilder().build()
                ) { result, config ->
                    if (continuation.isActive) {
                        val code = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            config?.countryCode.orEmpty()
                        } else ""
                        continuation.resume(code)
                    }
                }
            }.onFailure { error ->
                OpenIapLog.w("Horizon getStorefront failed: ${error.message}", TAG)
                if (continuation.isActive) continuation.resume("")
            }
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

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<HorizonPurchase>?) {
        Log.d(TAG, "onPurchasesUpdated code=${result.responseCode} count=${purchases?.size ?: 0}")
        purchases?.forEachIndexed { index, purchase ->
            Log.d(
                TAG,
                "[HorizonPurchase $index] token=${purchase.purchaseToken} orderId=${purchase.orderId} autoRenew=${purchase.isAutoRenewing()}"
            )
        }

        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            val mapped = purchases.map { purchase ->
                val type = if (purchase.products?.any { it.contains("subs", ignoreCase = true) } == true) {
                    BillingClient.ProductType.SUBS
                } else BillingClient.ProductType.INAPP
                purchase.toPurchase(type)
            }
            mapped.forEach { converted ->
                purchaseUpdateListeners.forEach { listener ->
                    runCatching { listener.onPurchaseUpdated(converted) }
                }
            }
            currentPurchaseCallback?.invoke(Result.success(mapped))
        } else {
            val error = OpenIapError.fromBillingResponseCode(result.responseCode, result.debugMessage)
            purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(error) } }
            currentPurchaseCallback?.invoke(Result.success(emptyList()))
        }
        currentPurchaseCallback = null
    }

    private suspend fun queryProductDetails(
        client: BillingClient,
        skus: List<String>,
        productType: String
    ): List<HorizonProductDetails> = suspendCancellableCoroutine { continuation ->
        val products = skus.map { sku ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(productType)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        client.queryProductDetailsAsync(params) { result, details ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                if (continuation.isActive) continuation.resume(details ?: emptyList())
            } else {
                OpenIapLog.w("Horizon queryProductDetails failed: ${result.debugMessage}", TAG)
                if (continuation.isActive) continuation.resume(emptyList())
            }
        }
    }

    private suspend fun queryPurchases(
        client: BillingClient,
        productType: String
    ): List<Purchase> = suspendCancellableCoroutine { continuation ->
        val params = QueryPurchasesParams.newBuilder().setProductType(productType).build()
        client.queryPurchasesAsync(params) { result, list ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val mapped = (list ?: emptyList()).map { it.toPurchase(productType) }
                if (continuation.isActive) continuation.resume(mapped)
            } else {
                if (continuation.isActive) continuation.resume(emptyList())
            }
        }
    }

    private fun buildBillingClient() {
        val pendingPurchasesParams = com.meta.horizon.billingclient.api.PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()

        val builder = BillingClient
            .newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(pendingPurchasesParams)
        if (!appId.isNullOrEmpty()) {
            builder.setAppId(appId)
        }
        billingClient = builder.build()
    }

    // Alternative Billing (Google Play only - not supported on Horizon)
    override suspend fun checkAlternativeBillingAvailability(): Boolean {
        throw OpenIapError.FeatureNotSupported
    }

    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean {
        throw OpenIapError.FeatureNotSupported
    }

    override suspend fun createAlternativeBillingReportingToken(): String? {
        throw OpenIapError.FeatureNotSupported
    }

    override fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        // Not supported on Horizon
    }

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        // Not supported on Horizon
    }

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        // Not supported on Horizon
    }
}
