package dev.hyo.openiap

import android.app.Activity
import android.content.Context
import android.util.Log
import com.meta.horizon.billingclient.api.AcknowledgePurchaseParams
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyInformationDialogListener
import com.meta.horizon.billingclient.api.AlternativeBillingOnlyReportingDetails
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
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.helpers.restorePurchasesHorizon
import dev.hyo.openiap.helpers.queryPurchasesHorizon
import dev.hyo.openiap.helpers.ProductManager
import dev.hyo.openiap.helpers.queryProductDetailsHorizon
import dev.hyo.openiap.utils.HorizonBillingConverters.toActiveSubscription
import dev.hyo.openiap.utils.HorizonBillingConverters.toInAppProduct
import dev.hyo.openiap.utils.HorizonBillingConverters.toPurchase
import dev.hyo.openiap.utils.HorizonBillingConverters.toSubscriptionProduct
import dev.hyo.openiap.utils.toProduct
import dev.hyo.openiap.utils.validateReceiptWithGooglePlay
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.lang.ref.WeakReference
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "OpenIapModule"

/**
 * OpenIapModule for Meta Horizon Billing
 *
 * @param context Android context
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 *
 * Note: Oculus App ID is read from AndroidManifest.xml meta-data with key "com.oculus.vr.APP_ID"
 */
class OpenIapModule(
    private val context: Context,
    private var alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    private var userChoiceBillingListener: dev.hyo.openiap.listener.UserChoiceBillingListener? = null
) : OpenIapProtocol, PurchasesUpdatedListener {

    companion object {
        // CRITICAL FIX: Shared purchase cache across all OpenIapModule instances
        // This ensures purchases are available even when connection is closed and reopened
        // Using ConcurrentHashMap for thread-safety across coroutines
        private val sharedPurchaseCache = java.util.concurrent.ConcurrentHashMap<String, Purchase>()

        // Delay before proactively querying purchases after billing flow
        private const val PURCHASE_QUERY_DELAY_MS = 500L
    }

    // Read Oculus App ID from AndroidManifest.xml
    private val appId: String? by lazy {
        try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            val id = appInfo.metaData?.getString("com.oculus.vr.APP_ID")
            OpenIapLog.d("Read Oculus App ID from manifest: $id", TAG)
            id
        } catch (e: Exception) {
            OpenIapLog.w("Failed to read com.oculus.vr.APP_ID from AndroidManifest.xml: ${e.message}", TAG)
            null
        }
    }

    private var billingClient: BillingClient? = null
    private var currentActivityRef: WeakReference<Activity>? = null
    private var currentPurchaseCallback: ((Result<List<Purchase>>) -> Unit)? = null
    private val productManager = ProductManager()
    private val fallbackActivity: Activity? = if (context is Activity) context else null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val purchaseUpdateListeners = mutableSetOf<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = mutableSetOf<OpenIapPurchaseErrorListener>()

    init {
        // DO NOT build BillingClient here - React Native context doesn't have Activity yet
        // BillingClient will be built in initConnection() when Activity is guaranteed to be available
        OpenIapLog.d("OpenIapModule initialized (Horizon flavor)", TAG)
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    override val initConnection: MutationInitConnectionHandler = {
        withContext(Dispatchers.IO) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                OpenIapLog.i("=== INIT CONNECTION ===", TAG)

                // CRITICAL FIX: Rebuild BillingClient if it was destroyed by endConnection
                // Use current Activity if available, otherwise fallback to Context
                if (billingClient == null) {
                    val contextForInit = currentActivityRef?.get() ?: fallbackActivity ?: context
                    OpenIapLog.d("Building BillingClient with ${contextForInit.javaClass.simpleName}...", TAG)
                    buildBillingClient(contextForInit)
                }

                val client = billingClient ?: run {
                    OpenIapLog.w("Failed to build BillingClient", TAG)
                    if (continuation.isActive) continuation.resume(false)
                    return@suspendCancellableCoroutine
                }

                client.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        val ok = result.responseCode == BillingClient.BillingResponseCode.OK
                        if (!ok) {
                            OpenIapLog.w("Horizon setup failed: code=${result.responseCode}, ${result.debugMessage}", TAG)
                        } else {
                            OpenIapLog.i("Horizon billing connected successfully", TAG)
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

            OpenIapLog.i("=== HORIZON fetchProducts ===", TAG)
            OpenIapLog.i("Requested SKUs: ${params.skus}", TAG)
            OpenIapLog.i("Query type: ${params.type}", TAG)

            val queryType = params.type ?: ProductQueryType.All
            val includeInApp = queryType == ProductQueryType.InApp || queryType == ProductQueryType.All
            val includeSubs = queryType == ProductQueryType.Subs || queryType == ProductQueryType.All

            val inAppProducts = if (includeInApp) {
                try {
                    val details = queryProductDetailsHorizon(client, productManager, params.skus, BillingClient.ProductType.INAPP)
                    OpenIapLog.i("Successfully fetched ${details.size} INAPP products", TAG)
                    details.map { it.toInAppProduct() }
                } catch (e: Exception) {
                    OpenIapLog.w("Failed to fetch INAPP products: ${e.message}", TAG)
                    emptyList()
                }
            } else emptyList()

            val subscriptionProducts = if (includeSubs) {
                try {
                    val details = queryProductDetailsHorizon(client, productManager, params.skus, BillingClient.ProductType.SUBS)
                    OpenIapLog.i("Successfully fetched ${details.size} SUBS products", TAG)
                    details.forEach { product ->
                        OpenIapLog.d("  - SUBS: ${product.productId}", TAG)
                    }
                    details.map { it.toSubscriptionProduct() }
                } catch (e: Exception) {
                    OpenIapLog.w("Failed to fetch SUBS products: ${e.message}", TAG)
                    emptyList()
                }
            } else emptyList()

            OpenIapLog.i("Total products: INAPP=${inAppProducts.size}, SUBS=${subscriptionProducts.size}", TAG)
            OpenIapLog.i("=== END fetchProducts ===", TAG)

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
            OpenIapLog.i("=== HORIZON getAvailablePurchases ===", TAG)

            val purchases = restorePurchasesHorizon(billingClient)
            OpenIapLog.i("Retrieved ${purchases.size} total purchases (INAPP + SUBS)", TAG)

            // CRITICAL FIX: Merge with cached purchases
            val cachedPurchases = sharedPurchaseCache.values.toList()

            // Combine query results with cache, preferring query results
            val purchaseMap = mutableMapOf<String, Purchase>()
            cachedPurchases.forEach { purchaseMap[it.productId] = it }
            purchases.forEach { purchaseMap[it.productId] = it } // Override with fresh data

            val allPurchases = purchaseMap.values.toList()

            allPurchases.forEachIndexed { index, purchase ->
                val txnId = when (purchase) {
                    is dev.hyo.openiap.PurchaseAndroid -> purchase.transactionId
                    else -> "N/A"
                }
                OpenIapLog.i(
                    "  [$index] productId=${purchase.productId} " +
                    "transactionId=$txnId " +
                    "platform=${purchase.platform}",
                    TAG
                )
            }
            OpenIapLog.i("=== END getAvailablePurchases ===", TAG)
            allPurchases
        }
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            OpenIapLog.i("=== HORIZON getActiveSubscriptions ===", TAG)
            OpenIapLog.i("Requested subscriptionIds: $subscriptionIds", TAG)

            val allPurchases = queryPurchasesHorizon(billingClient, BillingClient.ProductType.SUBS)
            OpenIapLog.i("Total SUBS purchases from query: ${allPurchases.size}", TAG)

            val androidPurchases = allPurchases.filterIsInstance<PurchaseAndroid>()
            OpenIapLog.i("PurchaseAndroid instances: ${androidPurchases.size}", TAG)

            val ids = subscriptionIds.orEmpty()
            val filtered = if (ids.isEmpty()) {
                OpenIapLog.i("No filter - returning all subscriptions", TAG)
                androidPurchases
            } else {
                OpenIapLog.i("Filtering by IDs: $ids", TAG)
                androidPurchases.filter { it.productId in ids }
            }

            OpenIapLog.i("Filtered subscriptions count: ${filtered.size}", TAG)

            // Enrich purchases with basePlanId from ProductDetails
            // If not in cache, query from Horizon Billing to ensure we have the latest data
            // First, collect all unique product IDs that need ProductDetails
            val productIdsNeedingDetails = filtered
                .map { it.productId }
                .distinct()
                .filter { productManager.get(it, BillingClient.ProductType.SUBS) == null }

            // Batch query missing ProductDetails to minimize API calls
            if (productIdsNeedingDetails.isNotEmpty()) {
                try {
                    queryProductDetailsHorizon(
                        billingClient,
                        productManager,
                        productIdsNeedingDetails,
                        BillingClient.ProductType.SUBS
                    )
                } catch (e: Exception) {
                    OpenIapLog.w("Failed to query ProductDetails for missing products: ${e.message}", TAG)
                }
            }

            // Now enrich purchases with cached ProductDetails
            val activeSubscriptions = filtered.map { purchase ->
                val productDetails = productManager.get(purchase.productId, BillingClient.ProductType.SUBS)
                val offers = productDetails?.subscriptionOfferDetails.orEmpty()
                if (offers.size > 1) {
                    OpenIapLog.w("Multiple offers (${offers.size}) found for ${purchase.productId}, using first basePlanId (may be inaccurate)", TAG)
                }
                val basePlanId = offers.firstOrNull()?.basePlanId

                // If basePlanId is available and not already set, update the purchase
                if (basePlanId != null && purchase.currentPlanId == null) {
                    purchase.copy(currentPlanId = basePlanId).toActiveSubscription()
                } else {
                    purchase.toActiveSubscription()
                }
            }

            activeSubscriptions.forEachIndexed { index, sub ->
                OpenIapLog.i(
                    "  [$index] productId=${sub.productId} " +
                    "basePlanId=${sub.basePlanIdAndroid} " +
                    "isActive=${sub.isActive} " +
                    "autoRenewing=${sub.autoRenewingAndroid}",
                    TAG
                )
            }

            OpenIapLog.i("=== END getActiveSubscriptions ===", TAG)
            activeSubscriptions
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            val androidArgs = props.toAndroidPurchaseArgs()
            OpenIapLog.i("=== REQUEST PURCHASE: ${androidArgs.skus} ===", TAG)

            val activity = currentActivityRef?.get() ?: fallbackActivity

            if (activity == null) {
                val err = OpenIapError.MissingCurrentActivity
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            val client = billingClient
            if (client == null) {
                val err = OpenIapError.NotPrepared
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            if (androidArgs.skus.isEmpty()) {
                val err = OpenIapError.EmptySkuList
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            suspendCancellableCoroutine<List<Purchase>> { continuation ->
                currentPurchaseCallback = { result ->
                    if (continuation.isActive) continuation.resume(result.getOrDefault(emptyList()))
                }

                val desiredType = if (androidArgs.type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

                val detailsBySku = mutableMapOf<String, HorizonProductDetails>()
                androidArgs.skus.forEach { sku ->
                    productManager.get(sku, desiredType)?.takeIf { it.productType == desiredType }?.let { detailsBySku[sku] = it }
                }

                val missing = androidArgs.skus.filter { !detailsBySku.containsKey(it) }

                fun buildAndLaunch(details: List<HorizonProductDetails>) {
                    val paramsList = mutableListOf<BillingFlowParams.ProductDetailsParams>()
                    val requestedOffersBySku = mutableMapOf<String, MutableList<String>>()

                    if (androidArgs.type == ProductQueryType.Subs) {
                        androidArgs.subscriptionOffers.orEmpty().forEach { offer ->
                            if (offer.offerToken.isNotEmpty()) {
                                OpenIapLog.d("Adding offer token for SKU ${offer.sku}: ${offer.offerToken}", TAG)
                                val queue = requestedOffersBySku.getOrPut(offer.sku) { mutableListOf() }
                                queue.add(offer.offerToken)
                            }
                        }
                    }

                    details.forEachIndexed { index, productDetails ->
                        val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)

                        if (androidArgs.type == ProductQueryType.Subs) {
                            val availableOffers = productDetails.subscriptionOfferDetails?.map {
                                "${it.basePlanId}:${it.offerToken}"
                            } ?: emptyList()
                            OpenIapLog.d("Available offers for ${productDetails.productId}: $availableOffers", TAG)

                            val availableTokens = productDetails.subscriptionOfferDetails?.map { it.offerToken } ?: emptyList()
                            val fromQueue = requestedOffersBySku[productDetails.productId]?.let { queue ->
                                if (queue.isNotEmpty()) queue.removeAt(0) else null
                            }
                            val fromIndex = androidArgs.subscriptionOffers?.getOrNull(index)?.takeIf { it.sku == productDetails.productId }?.offerToken
                            val resolved = fromQueue ?: fromIndex ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken

                            OpenIapLog.d("Resolved offer token for ${productDetails.productId}: $resolved", TAG)
                            android.util.Log.i(TAG, "BILLING_FLOW_PARAM: SKU=${productDetails.productId}, resolvedOfferToken=$resolved")

                            if (resolved.isNullOrEmpty() || (availableTokens.isNotEmpty() && !availableTokens.contains(resolved))) {
                                OpenIapLog.w("Invalid offer token: $resolved not in $availableTokens", TAG)
                                val err = OpenIapError.SkuOfferMismatch
                                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                                currentPurchaseCallback?.invoke(Result.success(emptyList()))
                                return
                            }

                            builder.setOfferToken(resolved)
                        }

                        paramsList += builder.build()
                    }

                    val flowBuilder = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(paramsList)
                        .setIsOfferPersonalized(androidArgs.isOfferPersonalized == true)

                    androidArgs.obfuscatedAccountId?.let { flowBuilder.setObfuscatedAccountId(it) }

                    // For subscription upgrades/downgrades, purchaseToken and obfuscatedProfileId are mutually exclusive
                    if (androidArgs.type == ProductQueryType.Subs && !androidArgs.purchaseTokenAndroid.isNullOrBlank()) {
                        // This is a subscription upgrade/downgrade - do not set obfuscatedProfileId
                        OpenIapLog.d("=== Subscription Upgrade Flow ===", TAG)
                        OpenIapLog.d("  - Old Token: ${androidArgs.purchaseTokenAndroid.take(10)}...", TAG)
                        OpenIapLog.d("  - Target SKUs: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("  - Replacement mode: ${androidArgs.replacementModeAndroid}", TAG)
                        OpenIapLog.d("  - Product Details Count: ${paramsList.size}", TAG)
                        paramsList.forEachIndexed { idx, params ->
                            OpenIapLog.d("  - Product[$idx]: SKU=${details[idx].productId}, offerToken=...", TAG)
                        }

                        val updateParamsBuilder = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                            .setOldPurchaseToken(androidArgs.purchaseTokenAndroid)

                        // Set replacement mode - this is critical for upgrades
                        val replacementMode = androidArgs.replacementModeAndroid ?: 5 // Default to CHARGE_FULL_PRICE
                        updateParamsBuilder.setSubscriptionReplacementMode(replacementMode)
                        OpenIapLog.d("  - Final replacement mode: $replacementMode", TAG)

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

                    val billingFlowParams = flowBuilder.build()

                    // Run on UI thread as required by Android Billing API
                    activity.runOnUiThread {
                        val result = client.launchBillingFlow(activity, billingFlowParams)
                        OpenIapLog.d("launchBillingFlow result: ${result.responseCode} - ${result.debugMessage}", TAG)

                        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                            val err = when (result.responseCode) {
                                BillingClient.BillingResponseCode.DEVELOPER_ERROR -> {
                                    OpenIapLog.w("DEVELOPER_ERROR: Invalid arguments. Check if subscriptions are in the same group.", TAG)
                                    OpenIapError.PurchaseFailed
                                }
                                BillingClient.BillingResponseCode.USER_CANCELED -> OpenIapError.UserCancelled
                                else -> OpenIapError.PurchaseFailed
                            }
                            purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                            currentPurchaseCallback?.invoke(Result.success(emptyList()))
                        } else {
                            // CRITICAL FIX: Proactively query purchases in case onPurchasesUpdated doesn't fire
                            // Horizon SDK may not always trigger the callback, so we query after a delay
                            OpenIapLog.i("launchBillingFlow started successfully, will query purchases proactively", TAG)
                            scope.launch {
                                delay(PURCHASE_QUERY_DELAY_MS) // Wait for purchase to complete
                                try {
                                    val queried = restorePurchasesHorizon(billingClient)
                                    val filtered = if (androidArgs.skus.isEmpty()) {
                                        queried
                                    } else {
                                        queried.filter { it.productId in androidArgs.skus }
                                    }

                                    if (filtered.isNotEmpty()) {
                                        OpenIapLog.d("Proactive query found ${filtered.size} purchases", TAG)
                                        filtered.forEach { purchase ->
                                            purchaseUpdateListeners.forEach { listener ->
                                                runCatching { listener.onPurchaseUpdated(purchase) }
                                            }
                                        }
                                        currentPurchaseCallback?.invoke(Result.success(filtered))
                                    }
                                } catch (e: Exception) {
                                    OpenIapLog.e("Error in proactive purchase query", e, TAG)
                                }
                            }
                        }
                    }
                }

                if (missing.isEmpty()) {
                    val ordered = androidArgs.skus.mapNotNull { detailsBySku[it] }
                    if (ordered.size != androidArgs.skus.size) {
                        val missingSku = androidArgs.skus.firstOrNull { !detailsBySku.containsKey(it) }
                        val err = OpenIapError.SkuNotFound(missingSku ?: "")
                        purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                        currentPurchaseCallback?.invoke(Result.success(emptyList()))
                        return@suspendCancellableCoroutine
                    }
                    buildAndLaunch(ordered)
                } else {
                    // Need to query missing products
                    val productList = missing.map { sku ->
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(sku)
                            .setProductType(desiredType)
                            .build()
                    }
                    val params = QueryProductDetailsParams.newBuilder()
                        .setProductList(productList)
                        .build()

                    client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                            val err = OpenIapError.QueryProduct
                            purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                            currentPurchaseCallback?.invoke(Result.success(emptyList()))
                            return@queryProductDetailsAsync
                        }

                        val list = productDetailsList ?: emptyList()
                        productManager.putAll(list, desiredType)

                        // Now build the full ordered list
                        val ordered = androidArgs.skus.mapNotNull { sku ->
                            productManager.get(sku, desiredType)?.takeIf { it.productType == desiredType }
                        }

                        if (ordered.size != androidArgs.skus.size) {
                            val missingSku = androidArgs.skus.firstOrNull { sku ->
                                productManager.get(sku, desiredType)?.takeIf { it.productType == desiredType } == null
                            }
                            val err = OpenIapError.SkuNotFound(missingSku ?: "")
                            purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                            currentPurchaseCallback?.invoke(Result.success(emptyList()))
                            return@queryProductDetailsAsync
                        }

                        buildAndLaunch(ordered)
                    }
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
            OpenIapLog.i("=== HORIZON restorePurchases ===", TAG)
            OpenIapLog.i("Number of purchase update listeners: ${purchaseUpdateListeners.size}", TAG)

            val all = restorePurchasesHorizon(billingClient)
            OpenIapLog.i("Total restored purchases: ${all.size}", TAG)

            all.forEachIndexed { index, purchase ->
                OpenIapLog.i("  Restoring [$index] productId=${purchase.productId}", TAG)
                purchaseUpdateListeners.forEach { listener ->
                    runCatching {
                        listener.onPurchaseUpdated(purchase)
                        OpenIapLog.d("  - Listener notified", TAG)
                    }.onFailure { e ->
                        OpenIapLog.e("  - Listener failed", e, TAG)
                    }
                }
            }

            OpenIapLog.i("=== END restorePurchases ===", TAG)
            Unit
        }
    }

    @Deprecated("Use verifyPurchase")
    override val validateReceipt: MutationValidateReceiptHandler = { props ->
        verifyPurchase(props)
    }

    override val verifyPurchase: MutationVerifyPurchaseHandler = { props ->
        validateReceiptWithGooglePlay(props, TAG)
    }

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

    @Suppress("DEPRECATION")
    override val mutationHandlers: MutationHandlers = MutationHandlers(
        acknowledgePurchaseAndroid = acknowledgePurchaseAndroid,
        consumePurchaseAndroid = consumePurchaseAndroid,
        deepLinkToSubscriptions = deepLinkToSubscriptions,
        endConnection = endConnection,
        finishTransaction = finishTransaction,
        initConnection = initConnection,
        requestPurchase = requestPurchase,
        restorePurchases = restorePurchases,
        validateReceipt = validateReceipt,
        verifyPurchase = verifyPurchase
    )

    override val subscriptionHandlers: SubscriptionHandlers = SubscriptionHandlers(
        purchaseError = purchaseError,
        purchaseUpdated = purchaseUpdated
    )

    suspend fun getStorefront(): String = withContext(Dispatchers.IO) {
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
        try {
            OpenIapLog.i("=== HORIZON onPurchasesUpdated ===", TAG)
            OpenIapLog.i("Response code: ${result.responseCode}", TAG)
            OpenIapLog.i("Purchases count: ${purchases?.size ?: 0}", TAG)

            purchases?.forEachIndexed { index, purchase ->
                val redactedToken = purchase.purchaseToken?.take(8)?.plus("…")
                val redactedOrder = purchase.orderId?.take(8)?.plus("…")
                OpenIapLog.i(
                    "[HorizonPurchase $index] productIds=${purchase.products} token=$redactedToken orderId=$redactedOrder " +
                    "acknowledged=${purchase.isAcknowledged()} autoRenew=${purchase.isAutoRenewing()}",
                    TAG
                )
            }

            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                // When using DEFERRED replacement mode, purchases will be null
                // This is expected behavior - the change will take effect at next renewal
                if (purchases != null) {
                    OpenIapLog.i("Processing ${purchases.size} successful purchases", TAG)

                    val mapped = purchases.map { purchase ->
                    // CRITICAL FIX: Determine product type from ProductManager cache, not from product ID string
                    val firstProductId = purchase.products?.firstOrNull()
                    // Try both types since we don't know which one was used
                    val cachedProduct = firstProductId?.let {
                        productManager.get(it, BillingClient.ProductType.SUBS)
                            ?: productManager.get(it, BillingClient.ProductType.INAPP)
                    }
                    val type = cachedProduct?.productType ?: run {
                        // Fallback: if not in cache, check if product ID contains "subs"
                        if (purchase.products?.any { it.contains("subs", ignoreCase = true) } == true) {
                            BillingClient.ProductType.SUBS
                        } else {
                            BillingClient.ProductType.INAPP
                        }
                    }

                    // Extract basePlanId from ProductDetails for subscriptions
                    val basePlanId = if (type == BillingClient.ProductType.SUBS) {
                        val offers = cachedProduct?.subscriptionOfferDetails.orEmpty()
                        if (offers.size > 1) {
                            OpenIapLog.w("Multiple offers (${offers.size}) found for ${firstProductId}, using first basePlanId (may be inaccurate)", TAG)
                        }
                        offers.firstOrNull()?.basePlanId
                    } else {
                        null
                    }

                    OpenIapLog.d("Mapping purchase products=${purchase.products} to type=$type basePlanId=$basePlanId (cached=${cachedProduct != null})", TAG)

                    val converted = purchase.toPurchase(basePlanId)
                    OpenIapLog.d("Converted purchase: productId=${converted.productId}, acknowledged=${purchase.isAcknowledged()}", TAG)
                    converted
                }

                OpenIapLog.i("Mapped ${mapped.size} purchases, notifying ${purchaseUpdateListeners.size} listeners", TAG)

                mapped.forEach { converted ->
                    // CRITICAL FIX: Cache the purchase locally
                    sharedPurchaseCache[converted.productId] = converted
                    OpenIapLog.d("Cached purchase: productId=${converted.productId}, cache size=${sharedPurchaseCache.size}", TAG)
                    OpenIapLog.d("Notifying ${purchaseUpdateListeners.size} listeners about purchase: productId=${converted.productId}", TAG)
                    purchaseUpdateListeners.forEach { listener ->
                        runCatching {
                            listener.onPurchaseUpdated(converted)
                            OpenIapLog.d("Listener notified successfully", TAG)
                        }.onFailure { e ->
                            OpenIapLog.e("Listener notification failed", e, TAG)
                        }
                    }
                }

                OpenIapLog.d("Invoking currentPurchaseCallback with ${mapped.size} purchases (single-shot)", TAG)
                    currentPurchaseCallback?.let { cb ->
                        currentPurchaseCallback = null
                        cb.invoke(Result.success(mapped))
                    }
                    OpenIapLog.i("Purchase callback invoked", TAG)
                } else {
                    // Purchases is null - likely DEFERRED mode
                    OpenIapLog.d("Purchase successful but purchases list is null (DEFERRED mode)", TAG)
                    currentPurchaseCallback?.let { cb ->
                        currentPurchaseCallback = null
                        cb.invoke(Result.success(emptyList()))
                    }
                }
            } else {
                OpenIapLog.w("Purchase failed or cancelled: code=${result.responseCode}", TAG)
                val error = OpenIapError.fromBillingResponseCode(result.responseCode, result.debugMessage)
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(error) } }
                currentPurchaseCallback?.invoke(Result.success(emptyList()))
            }
            currentPurchaseCallback = null
            OpenIapLog.i("=== END onPurchasesUpdated ===", TAG)
        } catch (e: Exception) {
            OpenIapLog.e("Exception in onPurchasesUpdated", e, TAG)
        }
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

    /**
     * Build BillingClient with the provided context.
     *
     * CRITICAL: Horizon SDK requires Activity to properly initialize OVRPlatform with returnComponent.
     * If Context (non-Activity) is provided, Horizon SDK will run in limited mode and may cause
     * NullPointerException during purchase flow.
     *
     * @param contextForBilling Activity (preferred) or Application Context (fallback)
     */
    private fun buildBillingClient(contextForBilling: Context) {
        if (contextForBilling is Activity) {
            OpenIapLog.d("Building BillingClient with Activity", TAG)
        } else {
            OpenIapLog.w("Building BillingClient with Context (not Activity) - Horizon SDK will run in limited mode", TAG)
        }

        val pendingPurchasesParams = com.meta.horizon.billingclient.api.PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()

        val builder = BillingClient
            .newBuilder(contextForBilling)
            .setListener(this)
            .enablePendingPurchases(pendingPurchasesParams)

        // Set app ID if available from manifest
        appId?.let { id ->
            if (id.isNotEmpty()) {
                builder.setAppId(id)
                OpenIapLog.d("Horizon App ID set: $id", TAG)
            }
        }

        billingClient = builder.build()
    }

    // Alternative Billing - Testing if supported by Horizon Billing Compatibility Library
    override suspend fun checkAlternativeBillingAvailability(): Boolean = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            // Try to call the alternative billing method
            val result = suspendCancellableCoroutine<BillingResult> { cont ->
                try {
                    client.isAlternativeBillingOnlyAvailableAsync { billingResult ->
                        cont.resume(billingResult)
                    }
                } catch (e: NoSuchMethodError) {
                    // Method doesn't exist in Horizon library
                    OpenIapLog.w("Alternative Billing not supported by Horizon library", TAG)
                    cont.resumeWithException(Exception("Feature not supported"))
                } catch (e: Exception) {
                    Log.e(TAG, "Error checking alternative billing: ${e.message}")
                    cont.resumeWithException(e)
                }
            }

            OpenIapLog.d("Alternative Billing availability: ${result.responseCode}", TAG)
            result.responseCode == BillingClient.BillingResponseCode.OK
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Error in checkAlternativeBillingAvailability: ${e.message}")
            false
        }
    }

    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            val activityRef = WeakReference(activity)
            val currentActivity = activityRef.get() ?: throw Exception("Activity not available")

            val result = suspendCancellableCoroutine<BillingResult> { cont ->
                try {
                    val listener = AlternativeBillingOnlyInformationDialogListener { billingResult ->
                        cont.resume(billingResult)
                    }
                    currentActivity.runOnUiThread {
                        client.showAlternativeBillingOnlyInformationDialog(
                            currentActivity,
                            listener
                        )
                    }
                } catch (e: NoSuchMethodError) {
                    OpenIapLog.w("showAlternativeBillingOnlyInformationDialog not supported", TAG)
                    cont.resumeWithException(Exception("Feature not supported"))
                } catch (e: Exception) {
                    Log.e(TAG, "Error showing alternative billing dialog: ${e.message}")
                    cont.resumeWithException(e)
                }
            }

            OpenIapLog.d("Alternative Billing dialog result: ${result.responseCode}", TAG)
            result.responseCode == BillingClient.BillingResponseCode.OK
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Error in showAlternativeBillingInformationDialog: ${e.message}")
            false
        }
    }

    override suspend fun createAlternativeBillingReportingToken(): String? = withContext(Dispatchers.IO) {
        try {
            val client = billingClient ?: throw Exception("Not connected")

            val result = suspendCancellableCoroutine<Pair<BillingResult, AlternativeBillingOnlyReportingDetails?>> { cont ->
                try {
                    client.createAlternativeBillingOnlyReportingDetailsAsync { billingResult, details ->
                        cont.resume(Pair(billingResult, details))
                    }
                } catch (e: NoSuchMethodError) {
                    OpenIapLog.w("createAlternativeBillingOnlyReportingDetails not supported", TAG)
                    cont.resumeWithException(Exception("Feature not supported"))
                } catch (e: Exception) {
                    Log.e(TAG, "Error creating alternative billing token: ${e.message}")
                    cont.resumeWithException(e)
                }
            }

            OpenIapLog.d("Alternative Billing token result: ${result.first.responseCode}", TAG)
            if (result.first.responseCode == BillingClient.BillingResponseCode.OK) {
                result.second?.externalTransactionToken
            } else {
                null
            }
        } catch (e: OpenIapError) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Error in createAlternativeBillingReportingToken: ${e.message}")
            null
        }
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
