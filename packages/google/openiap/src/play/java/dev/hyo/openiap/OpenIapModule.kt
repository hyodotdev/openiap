package dev.hyo.openiap

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingConfig
import com.android.billingclient.api.BillingConfigResponseListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase as BillingPurchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.gson.Gson
import dev.hyo.openiap.helpers.ProductManager
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.MutationValidateReceiptHandler
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.MutationHandlers
import dev.hyo.openiap.PurchaseVerificationProvider
import dev.hyo.openiap.QueryHandlers
import dev.hyo.openiap.SubscriptionHandlers
import dev.hyo.openiap.QueryFetchProductsHandler
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.SubscriptionPurchaseErrorHandler
import dev.hyo.openiap.SubscriptionPurchaseUpdatedHandler
import dev.hyo.openiap.ReceiptValidationProps
import dev.hyo.openiap.helpers.AndroidPurchaseArgs
import dev.hyo.openiap.helpers.onPurchaseError
import dev.hyo.openiap.helpers.onPurchaseUpdated
import dev.hyo.openiap.helpers.queryProductDetails
import dev.hyo.openiap.helpers.queryPurchases
import dev.hyo.openiap.helpers.restorePurchases as restorePurchasesHelper
import dev.hyo.openiap.helpers.toAndroidPurchaseArgs
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.utils.BillingConverters.toInAppProduct
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import dev.hyo.openiap.utils.BillingConverters.toSubscriptionProduct
import dev.hyo.openiap.utils.fromBillingState
import dev.hyo.openiap.utils.toActiveSubscription
import dev.hyo.openiap.utils.toProduct
import dev.hyo.openiap.utils.validateReceiptWithGooglePlay
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import java.lang.ref.WeakReference

// AlternativeBillingMode moved to main source set (shared between Play and Horizon)

/**
 * Main OpenIapModule implementation for Android
 *
 * @param context Android context
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 */
class OpenIapModule(
    private val context: Context,
    private var alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    private var userChoiceBillingListener: dev.hyo.openiap.listener.UserChoiceBillingListener? = null
) : OpenIapProtocol, PurchasesUpdatedListener {

    companion object {
        private const val TAG = "OpenIapModule"
    }

    // For backward compatibility
    constructor(context: Context, enableAlternativeBilling: Boolean) : this(
        context,
        if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE,
        null
    )

    private var billingClient: BillingClient? = null
    private var currentActivityRef: WeakReference<Activity>? = null
    private val productManager = ProductManager()
    private val gson = Gson()
    private val fallbackActivity: Activity? = if (context is Activity) context else null

    private val purchaseUpdateListeners = mutableSetOf<OpenIapPurchaseUpdateListener>()
    private val purchaseErrorListeners = mutableSetOf<OpenIapPurchaseErrorListener>()
    private val userChoiceBillingListeners = mutableSetOf<OpenIapUserChoiceBillingListener>()
    private var currentPurchaseCallback: ((Result<List<Purchase>>) -> Unit)? = null

    override val initConnection: MutationInitConnectionHandler = { config ->
        // Update alternativeBillingMode if provided in config
        config?.alternativeBillingModeAndroid?.let { modeAndroid ->
            OpenIapLog.d("Setting alternative billing mode from config: $modeAndroid", TAG)
            // Map AlternativeBillingModeAndroid to AlternativeBillingMode
            alternativeBillingMode = when (modeAndroid) {
                AlternativeBillingModeAndroid.None -> AlternativeBillingMode.NONE
                AlternativeBillingModeAndroid.UserChoice -> AlternativeBillingMode.USER_CHOICE
                AlternativeBillingModeAndroid.AlternativeOnly -> AlternativeBillingMode.ALTERNATIVE_ONLY
            }
        }

        withContext(Dispatchers.IO) {
            suspendCancellableCoroutine<Boolean> { continuation ->
                initBillingClient(
                    onSuccess = { continuation.resume(true) },
                    onFailure = { err ->
                        OpenIapLog.w("Billing set up failed: ${err?.message}", TAG)
                        continuation.resume(false)
                    }
                )
            }
        }
    }

    override val endConnection: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            runCatching {
                billingClient?.endConnection()
                productManager.clear()
                billingClient = null
            }.fold(onSuccess = { true }, onFailure = { false })
        }
    }

    override val fetchProducts: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady) throw OpenIapError.NotPrepared
            if (params.skus.isEmpty() && params.type != ProductQueryType.All) throw OpenIapError.EmptySkuList

            val queryType = params.type ?: ProductQueryType.All

            when (queryType) {
                ProductQueryType.InApp -> {
                    val inAppProducts = queryProductDetails(client, productManager, params.skus, BillingClient.ProductType.INAPP)
                        .map { it.toInAppProduct() }
                    FetchProductsResultProducts(inAppProducts)
                }
                ProductQueryType.Subs -> {
                    val subscriptionProducts = queryProductDetails(client, productManager, params.skus, BillingClient.ProductType.SUBS)
                        .map { it.toSubscriptionProduct() }
                    FetchProductsResultSubscriptions(subscriptionProducts)
                }
                ProductQueryType.All -> {
                    // Query both types and combine results
                    val allProducts = mutableListOf<Product>()
                    val processedIds = mutableSetOf<String>()

                    // First, get all INAPP products
                    val inAppDetails = runCatching {
                        queryProductDetails(client, productManager, params.skus, BillingClient.ProductType.INAPP)
                    }.getOrDefault(emptyList())

                    inAppDetails.forEach { detail ->
                        val product = detail.toInAppProduct()
                        allProducts.add(product)
                        processedIds.add(detail.productId)
                    }

                    // Then, get subscription products (only add if not already processed as INAPP)
                    val subsDetails = runCatching {
                        queryProductDetails(client, productManager, params.skus, BillingClient.ProductType.SUBS)
                    }.getOrDefault(emptyList())

                    subsDetails.forEach { detail ->
                        if (detail.productId !in processedIds) {
                            // Keep subscription as ProductSubscription, but convert to Product for return
                            val subProduct = detail.toSubscriptionProduct()
                            allProducts.add(subProduct.toProduct())
                        }
                    }

                    // Return products in the order they were requested if SKUs provided
                    val orderedProducts = if (params.skus.isNotEmpty()) {
                        val productMap = allProducts.associateBy { it.id }
                        params.skus.mapNotNull { productMap[it] }
                    } else {
                        allProducts
                    }

                    FetchProductsResultProducts(orderedProducts)
                }
            }
        }
    }
    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { _ ->
        withContext(Dispatchers.IO) { restorePurchasesHelper(billingClient) }
    }

    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { subscriptionIds ->
        withContext(Dispatchers.IO) {
            val androidPurchases = queryPurchases(billingClient, BillingClient.ProductType.SUBS)
                .filterIsInstance<PurchaseAndroid>()
            val ids = subscriptionIds.orEmpty()
            val filtered = if (ids.isEmpty()) {
                androidPurchases
            } else {
                androidPurchases.filter { it.productId in ids }
            }

            // Enrich purchases with basePlanId from ProductDetails
            // If not in cache, query from Google Play to ensure we have the latest data
            // First, collect all unique product IDs that need ProductDetails
            val productIdsNeedingDetails = filtered
                .map { it.productId }
                .distinct()
                .filter { productManager.get(it) == null }

            // Batch query missing ProductDetails to minimize API calls
            if (productIdsNeedingDetails.isNotEmpty()) {
                try {
                    queryProductDetails(
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
            filtered.map { purchase ->
                val productDetails = productManager.get(purchase.productId)
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
        }
    }

    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { subscriptionIds ->
        getActiveSubscriptions(subscriptionIds).isNotEmpty()
    }

    /**
     * Check if alternative billing is available for this user/device
     * Step 1 of alternative billing flow
     */
    override suspend fun checkAlternativeBillingAvailability(): Boolean = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Checking alternative billing availability...", TAG)
        val checkAvailabilityMethod = client.javaClass.getMethod(
            "isAlternativeBillingOnlyAvailableAsync",
            com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener::class.java
        )

        suspendCancellableCoroutine { continuation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener")
            val availabilityListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyAvailabilityResponse") {
                    val result = args?.get(0) as? BillingResult
                    OpenIapLog.d("Availability check result: ${result?.responseCode} - ${result?.debugMessage}", TAG)

                    if (result?.responseCode == BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.d("✓ Alternative billing is available", TAG)
                        if (continuation.isActive) continuation.resume(true)
                    } else {
                        OpenIapLog.e("✗ Alternative billing not available: ${result?.debugMessage}", tag = TAG)
                        if (continuation.isActive) continuation.resume(false)
                    }
                }
                null
            }
            checkAvailabilityMethod.invoke(client, availabilityListener)
        }
    }

    /**
     * Show alternative billing information dialog to user
     * Step 2 of alternative billing flow
     * Must be called BEFORE processing payment
     */
    override suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Showing alternative billing information dialog...", TAG)
        val showDialogMethod = client.javaClass.getMethod(
            "showAlternativeBillingOnlyInformationDialog",
            android.app.Activity::class.java,
            com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener::class.java
        )

        val dialogResult = suspendCancellableCoroutine<BillingResult> { continuation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener")
            val dialogListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyInformationDialogResponse") {
                    val result = args?.get(0) as? BillingResult
                    OpenIapLog.d("Dialog result: ${result?.responseCode} - ${result?.debugMessage}", TAG)
                    if (continuation.isActive && result != null) {
                        continuation.resume(result)
                    }
                }
                null
            }
            showDialogMethod.invoke(client, activity, dialogListener)
        }

        when (dialogResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> true
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                OpenIapLog.d("User canceled information dialog", TAG)
                false
            }
            else -> {
                OpenIapLog.e("Information dialog failed: ${dialogResult.debugMessage}", tag = TAG)
                false
            }
        }
    }

    /**
     * Create external transaction token for alternative billing
     * Step 3 of alternative billing flow
     * Must be called AFTER successful payment in your payment system
     * Token must be reported to Google Play backend within 24 hours
     */
    override suspend fun createAlternativeBillingReportingToken(): String? = withContext(Dispatchers.IO) {
        val client = billingClient ?: throw OpenIapError.NotPrepared
        if (!client.isReady) throw OpenIapError.NotPrepared

        OpenIapLog.d("Creating alternative billing reporting token...", TAG)
        val createTokenMethod = client.javaClass.getMethod(
            "createAlternativeBillingOnlyReportingDetailsAsync",
            com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener::class.java
        )

        suspendCancellableCoroutine { continuation ->
            val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener")
            val tokenListener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onAlternativeBillingOnlyTokenResponse") {
                    val result = args?.get(0) as? BillingResult
                    val details = args?.getOrNull(1)

                    if (result?.responseCode == BillingClient.BillingResponseCode.OK && details != null) {
                        try {
                            val tokenMethod = details.javaClass.getMethod("getExternalTransactionToken")
                            val token = tokenMethod.invoke(details) as? String
                            OpenIapLog.d("✓ External transaction token created: $token", TAG)
                            if (continuation.isActive) continuation.resume(token)
                        } catch (e: Exception) {
                            OpenIapLog.e("Failed to extract token: ${e.message}", e, TAG)
                            if (continuation.isActive) continuation.resume(null)
                        }
                    } else {
                        OpenIapLog.e("Token creation failed: ${result?.debugMessage}", tag = TAG)
                        if (continuation.isActive) continuation.resume(null)
                    }
                }
                null
            }
            createTokenMethod.invoke(client, tokenListener)
        }
    }

    override val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.IO) {
            // ALTERNATIVE_ONLY mode: Show information dialog and create token
            if (alternativeBillingMode == AlternativeBillingMode.ALTERNATIVE_ONLY) {
                OpenIapLog.d("=== ALTERNATIVE BILLING ONLY MODE ===", TAG)

                val client = billingClient
                if (client == null || !client.isReady) {
                    val err = OpenIapError.NotPrepared
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                    return@withContext emptyList()
                }

                val activity = currentActivityRef?.get() ?: fallbackActivity
                if (activity == null) {
                    val err = OpenIapError.MissingCurrentActivity
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                    return@withContext emptyList()
                }

                try {
                    // Step 1: Check if alternative billing is available
                    val isAvailable = checkAlternativeBillingAvailability()
                    if (!isAvailable) {
                        OpenIapLog.e("Alternative billing is not available for this user/app", tag = TAG)

                        // Create detailed error for UI
                        val err = OpenIapError.AlternativeBillingUnavailable(
                            "Alternative Billing Unavailable\n\n" +
                            "Possible causes:\n" +
                            "1. User is not in an eligible country\n" +
                            "2. App not enrolled in Alternative Billing program\n" +
                            "3. Play Console setup incomplete\n\n" +
                            "To enable Alternative Billing:\n" +
                            "• Enroll app in Google Play Console\n" +
                            "• Wait for Google approval\n" +
                            "• Test with license tester accounts\n\n" +
                            "Current mode: ALTERNATIVE_ONLY\n" +
                            "Library: Billing 8.0.0"
                        )

                        purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                        return@withContext emptyList()
                    }

                    // Step 2: Show alternative billing information dialog
                    val dialogSuccess = showAlternativeBillingInformationDialog(activity)
                    if (!dialogSuccess) {
                        val err = OpenIapError.UserCancelled
                        purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                        return@withContext emptyList()
                    }

                    // Step 3: Create external transaction token
                    // ============================================================
                    // ⚠️ PRODUCTION IMPLEMENTATION REQUIRED
                    // ============================================================
                    // In production, this step should happen AFTER successful payment:
                    // 1. Dialog shown (✓ done above)
                    // 2. Process payment through YOUR payment system
                    // 3. After payment success, call: createAlternativeBillingReportingToken()
                    // 4. Send token to backend → report to Play within 24h
                    //
                    // For manual control, use the separate functions:
                    // - checkAlternativeBillingAvailability()
                    // - showAlternativeBillingInformationDialog(activity)
                    // - YOUR_PAYMENT_SYSTEM.processPayment()
                    // - createAlternativeBillingReportingToken()
                    // ============================================================
                    val tokenResult = createAlternativeBillingReportingToken()

                    if (tokenResult != null) {
                        OpenIapLog.d("✓ Alternative billing token created: $tokenResult", TAG)
                        OpenIapLog.d("", TAG)
                        OpenIapLog.d("============================================================", TAG)
                        OpenIapLog.d("NEXT STEPS (PRODUCTION IMPLEMENTATION REQUIRED)", TAG)
                        OpenIapLog.d("============================================================", TAG)
                        OpenIapLog.d("This token must be used to report the transaction to Google Play.", TAG)
                        OpenIapLog.d("", TAG)
                        OpenIapLog.d("Required implementation:", TAG)
                        OpenIapLog.d("1. Process payment through YOUR alternative payment system", TAG)
                        OpenIapLog.d("2. After successful payment, send this token to your backend:", TAG)
                        OpenIapLog.d("   Token: $tokenResult", TAG)
                        OpenIapLog.d("3. Backend reports to Google Play Developer API within 24 hours:", TAG)
                        OpenIapLog.d("   POST https://androidpublisher.googleapis.com/androidpublisher/v3/", TAG)
                        OpenIapLog.d("        applications/{packageName}/externalTransactions", TAG)
                        OpenIapLog.d("   Body: { externalTransactionToken: \"$tokenResult\", ... }", TAG)
                        OpenIapLog.d("", TAG)
                        OpenIapLog.d("See: https://developer.android.com/google/play/billing/alternative/reporting", TAG)
                        OpenIapLog.d("============================================================", TAG)
                        OpenIapLog.d("=== END ALTERNATIVE BILLING ONLY MODE ===", TAG)

                        // TODO: In production, emit this token via callback for payment processing
                        // alternativeBillingCallback?.onTokenCreated(
                        //     token = tokenResult,
                        //     productId = props.skus.first(),
                        //     onPaymentComplete = { transactionId ->
                        //         // App reports to backend after payment success
                        //     }
                        // )

                        // Return empty list - app should handle purchase via alternative billing
                        return@withContext emptyList()
                    } else {
                        val err = OpenIapError.PurchaseFailed
                        purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                        return@withContext emptyList()
                    }
                } catch (e: Exception) {
                    OpenIapLog.e("Alternative billing only flow failed: ${e.message}", e, TAG)
                    val err = OpenIapError.FeatureNotSupported
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                    return@withContext emptyList()
                }
            }

            val androidArgs = props.toAndroidPurchaseArgs()
            val activity = currentActivityRef?.get() ?: fallbackActivity

            if (activity == null) {
                val err = OpenIapError.MissingCurrentActivity
                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                return@withContext emptyList()
            }

            val client = billingClient
            if (client == null || !client.isReady) {
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

                val detailsBySku = mutableMapOf<String, ProductDetails>()
                androidArgs.skus.forEach { sku ->
                    productManager.get(sku)?.takeIf { it.productType == desiredType }?.let { detailsBySku[sku] = it }
                }

                val missing = androidArgs.skus.filter { !detailsBySku.containsKey(it) }

                fun buildAndLaunch(details: List<ProductDetails>) {
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

                    // Note: Alternative billing must be configured at BillingClient initialization
                    // via BillingClient.newBuilder(context).enableAlternativeBillingOnly() or
                    // enableUserChoiceBilling(). The useAlternativeBilling flag is currently
                    // informational only and requires proper BillingClient setup.
                    if (androidArgs.useAlternativeBilling == true) {
                        OpenIapLog.d("=== PURCHASE WITH ALTERNATIVE BILLING ===", TAG)
                        OpenIapLog.d("useAlternativeBilling flag: true", TAG)
                        OpenIapLog.d("Products: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("Note: Alternative billing was configured during BillingClient initialization", TAG)
                        OpenIapLog.d("If alternative billing is not working, check:", TAG)
                        OpenIapLog.d("1. Google Play Console alternative billing setup", TAG)
                        OpenIapLog.d("2. App enrollment in alternative billing program", TAG)
                        OpenIapLog.d("3. Billing Library version (6.2+ required)", TAG)
                        OpenIapLog.d("==========================================", TAG)
                    }

                    // For subscription upgrades/downgrades, purchaseToken and obfuscatedProfileId are mutually exclusive
                    if (androidArgs.type == ProductQueryType.Subs && !androidArgs.purchaseTokenAndroid.isNullOrBlank()) {
                        // This is a subscription upgrade/downgrade - do not set obfuscatedProfileId
                        OpenIapLog.d("=== Subscription Upgrade Flow ===", TAG)
                        OpenIapLog.d("  - Old Token: ${androidArgs.purchaseTokenAndroid.take(10)}...", TAG)
                        OpenIapLog.d("  - Target SKUs: ${androidArgs.skus}", TAG)
                        OpenIapLog.d("  - Replacement mode: ${androidArgs.replacementModeAndroid}", TAG)
                        OpenIapLog.d("  - Product Details Count: ${paramsList.size}", TAG)
                        paramsList.forEachIndexed { index, params ->
                            OpenIapLog.d("  - Product[$index]: SKU=${details[index].productId}, offerToken=...", TAG)
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

                    val result = client.launchBillingFlow(activity, flowBuilder.build())
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
                    val productList = missing.map { sku ->
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(sku)
                            .setProductType(desiredType)
                            .build()
                    }

                    val queryParams = QueryProductDetailsParams.newBuilder()
                        .setProductList(productList)
                        .build()

                    client.queryProductDetailsAsync(queryParams) { billingResult: BillingResult, result: QueryProductDetailsResult ->
                        val productDetailsList = result.productDetailsList
                        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && !productDetailsList.isNullOrEmpty()) {
                            productManager.putAll(productDetailsList)
                            productDetailsList.forEach { detailsBySku[it.productId] = it }
                            val ordered = androidArgs.skus.mapNotNull { detailsBySku[it] }
                            if (ordered.size != androidArgs.skus.size) {
                                val missingSku = androidArgs.skus.firstOrNull { !detailsBySku.containsKey(it) }
                                val err = OpenIapError.SkuNotFound(missingSku ?: "")
                                purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                                currentPurchaseCallback?.invoke(Result.success(emptyList()))
                                return@queryProductDetailsAsync
                            }
                            buildAndLaunch(ordered)
                        } else {
                            val err = OpenIapError.QueryProduct
                            purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                            currentPurchaseCallback?.invoke(Result.success(emptyList()))
                        }
                    }
                }
            }
        }
        RequestPurchaseResultPurchases(purchases)
    }

    suspend fun getAvailableItems(type: ProductQueryType): List<Purchase> = withContext(Dispatchers.IO) {
        val billingType = if (type == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP
        queryPurchases(billingClient, billingType)
    }

    override val finishTransaction: MutationFinishTransactionHandler = { purchase, isConsumable ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            if (!client.isReady) throw OpenIapError.NotPrepared
            val token = purchase.purchaseToken.orEmpty()
            if (token.isBlank()) {
                throw OpenIapError.PurchaseFailed
            }

            val result = if (isConsumable == true) {
                val params = ConsumeParams.newBuilder().setPurchaseToken(token).build()
                suspendCancellableCoroutine<BillingResult> { continuation ->
                    client.consumeAsync(params) { outcome, _ ->
                        if (continuation.isActive) continuation.resume(outcome)
                    }
                }
            } else {
                val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()
                suspendCancellableCoroutine<BillingResult> { continuation ->
                    client.acknowledgePurchase(params) { outcome ->
                        if (continuation.isActive) continuation.resume(outcome)
                    }
                }
            }

            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                throw OpenIapError.PurchaseFailed
            }
        }
    }

    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { purchaseToken ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: throw OpenIapError.NotPrepared
            val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchaseToken).build()
            suspendCancellableCoroutine<Boolean> { continuation ->
                client.acknowledgePurchase(params) { result ->
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.w("Failed to acknowledge purchase: ${result.debugMessage}", TAG)
                        if (continuation.isActive) continuation.resume(false)
                    } else if (continuation.isActive) {
                        continuation.resume(true)
                    }
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
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                        OpenIapLog.w("Failed to consume purchase: ${result.debugMessage}", TAG)
                        if (continuation.isActive) continuation.resume(false)
                    } else if (continuation.isActive) {
                        continuation.resume(true)
                    }
                }
            }
        }
    }

    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = { options ->
        val pkg = options?.packageNameAndroid ?: context.packageName
        val uri = if (!options?.skuAndroid.isNullOrBlank()) {
            Uri.parse("https://play.google.com/store/account/subscriptions?sku=${options!!.skuAndroid}&package=$pkg")
        } else {
            Uri.parse("https://play.google.com/store/account/subscriptions?package=$pkg")
        }
        val intent = Intent(Intent.ACTION_VIEW, uri).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        context.startActivity(intent)
    }

    override val restorePurchases: MutationRestorePurchasesHandler = {
        withContext(Dispatchers.IO) {
            restorePurchasesHelper(billingClient)
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

    override val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler = { props ->
        if (props.provider != PurchaseVerificationProvider.Iapkit) {
            throw OpenIapError.FeatureNotSupported
        }
        val options = props.iapkit ?: throw OpenIapError.DeveloperError
        verifyPurchaseWithIapkit(options, TAG)
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
        verifyPurchase = verifyPurchase,
        verifyPurchaseWithProvider = verifyPurchaseWithProvider
    )

    override val subscriptionHandlers: SubscriptionHandlers = SubscriptionHandlers(
        purchaseError = purchaseError,
        purchaseUpdated = purchaseUpdated
    )

    init {
        buildBillingClient()
    }

    suspend fun getStorefront() = withContext(Dispatchers.IO) {
        val client = billingClient ?: return@withContext ""
        suspendCancellableCoroutine { continuation ->
            runCatching {
                client.getBillingConfigAsync(
                    GetBillingConfigParams.newBuilder().build(),
                    BillingConfigResponseListener { result: BillingResult, config: BillingConfig? ->
                        val code = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            config?.countryCode.orEmpty()
                        } else ""
                        if (continuation.isActive) continuation.resume(code)
                    }
                )
            }.onFailure { error ->
                OpenIapLog.w("getStorefront failed: ${error.message}", TAG)
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

    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        userChoiceBillingListeners.add(listener)
    }

    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {
        userChoiceBillingListeners.remove(listener)
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<BillingPurchase>?) {
        OpenIapLog.d("onPurchasesUpdated: code=${billingResult.responseCode} msg=${billingResult.debugMessage} count=${purchases?.size ?: 0}", TAG)
        purchases?.forEachIndexed { index, purchase ->
            OpenIapLog.d(
                "[Purchase $index] token=${purchase.purchaseToken} orderId=${purchase.orderId} state=${purchase.purchaseState} autoRenew=${purchase.isAutoRenewing} acknowledged=${purchase.isAcknowledged} products=${purchase.products}",
                TAG
            )
        }

        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            // When using DEFERRED replacement mode, purchases will be null
            // This is expected behavior - the change will take effect at next renewal
            if (purchases != null) {
                val mapped = purchases.map { purchase ->
                    // CRITICAL FIX: Use ProductManager cache to determine product type, not substring matching
                    val firstProductId = purchase.products.firstOrNull()
                    val cached = firstProductId?.let { productManager.get(it) }
                    val productType = cached?.productType ?: run {
                        // Fallback: if not in cache, check if product ID contains "subs"
                        if (purchase.products.any { it.contains("subs", ignoreCase = true) }) {
                            BillingClient.ProductType.SUBS
                        } else {
                            BillingClient.ProductType.INAPP
                        }
                    }

                    // Extract basePlanId from ProductDetails for subscriptions
                    val basePlanId = if (productType == BillingClient.ProductType.SUBS) {
                        val offers = cached?.subscriptionOfferDetails.orEmpty()
                        if (offers.size > 1) {
                            OpenIapLog.w("Multiple offers (${offers.size}) found for ${firstProductId}, using first basePlanId (may be inaccurate)", TAG)
                        }
                        offers.firstOrNull()?.basePlanId
                    } else {
                        null
                    }

                    OpenIapLog.d("Mapping purchase products=${purchase.products} to type=$productType basePlanId=$basePlanId (cached=${cached != null})", TAG)
                    purchase.toPurchase(productType, basePlanId)
                }
                OpenIapLog.d("Mapped purchases=${gson.toJson(mapped)}", TAG)
                mapped.forEach { converted ->
                    purchaseUpdateListeners.forEach { listener ->
                        runCatching { listener.onPurchaseUpdated(converted) }
                    }
                }
                currentPurchaseCallback?.invoke(Result.success(mapped))
            } else {
                // Purchases is null - likely DEFERRED mode
                OpenIapLog.d("Purchase successful but purchases list is null (DEFERRED mode)", TAG)
                currentPurchaseCallback?.invoke(Result.success(emptyList()))
            }
        } else {
            when (billingResult.responseCode) {
                BillingClient.BillingResponseCode.USER_CANCELED -> {
                    val err = OpenIapError.UserCancelled
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(err) } }
                    currentPurchaseCallback?.invoke(Result.success(emptyList()))
                }
                else -> {
                    val error = OpenIapError.fromBillingResponseCode(
                        billingResult.responseCode,
                        billingResult.debugMessage
                    )
                    OpenIapLog.w("Purchase failed: code=${billingResult.responseCode} msg=${error.message}", TAG)
                    purchaseErrorListeners.forEach { listener -> runCatching { listener.onPurchaseError(error) } }
                    currentPurchaseCallback?.invoke(Result.success(emptyList()))
                }
            }
        }
        currentPurchaseCallback = null
    }

    private fun buildBillingClient() {
        OpenIapLog.d("=== buildBillingClient START ===", TAG)
        OpenIapLog.d("alternativeBillingMode: $alternativeBillingMode", TAG)

        val builder = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()

        // Enable alternative billing if requested
        // This requires proper Google Play Console configuration
        when (alternativeBillingMode) {
            AlternativeBillingMode.NONE -> {
                OpenIapLog.d("Standard Google Play billing mode", TAG)
            }
            AlternativeBillingMode.USER_CHOICE -> {
                OpenIapLog.d("=== USER CHOICE BILLING INITIALIZATION ===", TAG)
                try {
                    // Try to use UserChoiceBillingListener via reflection for compatibility
                    val listenerClass = Class.forName("com.android.billingclient.api.UserChoiceBillingListener")
                    val userChoiceListener = java.lang.reflect.Proxy.newProxyInstance(
                        listenerClass.classLoader,
                        arrayOf(listenerClass)
                    ) { _, method, args ->
                        if (method.name == "userSelectedAlternativeBilling") {
                            OpenIapLog.d("=== USER SELECTED ALTERNATIVE BILLING ===", TAG)
                            val userChoiceDetails = args?.get(0)
                            OpenIapLog.d("UserChoiceDetails: $userChoiceDetails", TAG)

                            // Extract external transaction token and products
                            try {
                                val detailsClass = userChoiceDetails?.javaClass
                                val tokenMethod = detailsClass?.getMethod("getExternalTransactionToken")
                                val productsMethod = detailsClass?.getMethod("getProducts")

                                val externalToken = tokenMethod?.invoke(userChoiceDetails) as? String
                                val products = productsMethod?.invoke(userChoiceDetails) as? List<*>

                                if (externalToken != null && products != null) {
                                    val productIds = products.mapNotNull { it?.toString() }
                                    OpenIapLog.d("External transaction token: $externalToken", TAG)
                                    OpenIapLog.d("Products: $productIds", TAG)

                                    // Create UserChoiceBillingDetails for the event
                                    val billingDetails = dev.hyo.openiap.UserChoiceBillingDetails(
                                        externalTransactionToken = externalToken,
                                        products = productIds
                                    )

                                    // Notify all UserChoiceBilling listeners
                                    userChoiceBillingListeners.forEach { listener ->
                                        try {
                                            listener.onUserChoiceBilling(billingDetails)
                                        } catch (e: Exception) {
                                            OpenIapLog.w("UserChoiceBilling listener error: ${e.message}", TAG)
                                        }
                                    }
                                } else {
                                    OpenIapLog.w("Failed to extract user choice details", TAG)
                                }
                            } catch (e: Exception) {
                                OpenIapLog.w("Error processing user choice details: ${e.message}", TAG)
                                e.printStackTrace()
                            }
                            OpenIapLog.d("==========================================", TAG)
                        }
                        null
                    }

                    val enableMethod = builder.javaClass.getMethod("enableUserChoiceBilling", listenerClass)
                    enableMethod.invoke(builder, userChoiceListener)
                    OpenIapLog.d("✓ User choice billing enabled successfully", TAG)
                    if (userChoiceBillingListener != null) {
                        OpenIapLog.d("✓ UserChoiceBillingListener registered", TAG)
                    } else {
                        OpenIapLog.w("⚠ No UserChoiceBillingListener provided", TAG)
                    }
                } catch (e: Exception) {
                    OpenIapLog.w("✗ Failed to enable user choice billing: ${e.javaClass.simpleName}: ${e.message}", TAG)
                    OpenIapLog.w("User choice billing requires Billing Library 7.0+ and Google Play Console setup", TAG)
                }
                OpenIapLog.d("=== END USER CHOICE BILLING INITIALIZATION ===", TAG)
            }
            AlternativeBillingMode.ALTERNATIVE_ONLY -> {
                OpenIapLog.d("=== ALTERNATIVE BILLING ONLY INITIALIZATION ===", TAG)

                // List all available methods on BillingClient.Builder
                try {
                    val allMethods = builder.javaClass.methods.map { it.name }.sorted()
                    OpenIapLog.d("All BillingClient.Builder methods: $allMethods", TAG)
                } catch (e: Exception) {
                    OpenIapLog.w("Could not list methods: ${e.message}", TAG)
                }

                try {
                    // For Billing Library 6.2+, try enableAlternativeBillingOnly()
                    OpenIapLog.d("Attempting to call enableAlternativeBillingOnly()...", TAG)
                    val method = builder.javaClass.getMethod("enableAlternativeBillingOnly")
                    OpenIapLog.d("Method found: $method", TAG)
                    method.invoke(builder)  // Returns void, mutates builder
                    OpenIapLog.d("✓ Alternative billing only enabled successfully", TAG)
                } catch (e: NoSuchMethodException) {
                    OpenIapLog.e("✗ enableAlternativeBillingOnly() method not found", e, TAG)
                    OpenIapLog.e("This method requires Billing Library 6.2+", tag = TAG)
                    OpenIapLog.e("Current library version: 8.0.0", tag = TAG)
                    OpenIapLog.e("Alternative billing will NOT work - standard Google Play billing will be used", tag = TAG)
                } catch (e: Exception) {
                    OpenIapLog.e("✗ Failed to enable alternative billing only: ${e.javaClass.simpleName}: ${e.message}", e, TAG)
                }
                OpenIapLog.d("=== END ALTERNATIVE BILLING ONLY INITIALIZATION ===", TAG)
            }
        }

        billingClient = builder.build()
        OpenIapLog.d("=== buildBillingClient END ===", TAG)
    }

    private fun initBillingClient(
        onSuccess: (BillingClient) -> Unit,
        onFailure: (Throwable?) -> Unit = {}
    ) {
        val availability = GoogleApiAvailability.getInstance()
        if (availability.isGooglePlayServicesAvailable(context) != ConnectionResult.SUCCESS) {
            val error = IllegalStateException("Google Play Services are not available on this device")
            onFailure(error)
            return
        }

        if (billingClient == null) {
            buildBillingClient()
        }

        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    val message = billingResult.debugMessage ?: "Billing setup failed"
                    OpenIapLog.w(message, TAG)
                    onFailure(IllegalStateException(message))
                    return
                }
                billingClient?.let(onSuccess)
            }

            override fun onBillingServiceDisconnected() {
                OpenIapLog.i("Billing service disconnected", TAG)
            }
        })
    }

    override fun setActivity(activity: Activity?) {
        currentActivityRef = activity?.let { WeakReference(it) }
    }

    /**
     * Set user choice billing listener
     *
     * @param listener User choice billing listener
     */
    override fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        userChoiceBillingListener = listener
    }
}
