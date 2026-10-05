package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import android.app.Application
import android.app.Application.ActivityLifecycleCallbacks
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.BillingChoiceImageLayoutAndroid
import dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.DeveloperBillingTypeAndroid
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid
import dev.hyo.openiap.ExternalLinkTypeAndroid
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import dev.hyo.openiap.helpers.OpenIapFirstPurchaseNotice
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.utils.redeemOfferCode
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** Provider-backed Flutter MethodChannel implementation. */
class AndroidInappPurchasePlugin internal constructor() : MethodCallHandler, ActivityLifecycleCallbacks {
    private val job = Job()
    private val scope = CoroutineScope(Dispatchers.Main + job)
    private val handler = Handler(Looper.getMainLooper())

    private var context: Context? = null
    private var activity: Activity? = null
    private var channel: MethodChannel? = null

    private var connectionReady: Boolean = false
    private var listenersAttached = false
    private val connectionMutex = Mutex()
    // OpenIAP module instance
    private var openIap: OpenIapProtocol? = null

    private fun parseQueryType(raw: String?): ProductQueryType {
        return when (val normalized = raw?.trim()?.lowercase(Locale.ROOT)) {
            null, "", "in-app" -> ProductQueryType.InApp
            "subs" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            else -> throw IllegalArgumentException(
                "Unsupported product type: $normalized. Use in-app, subs, or all.",
            )
        }
    }

    private fun serializeOpenIapError(error: OpenIapError): Map<String, Any?> =
        error.toJSON().toMutableMap().apply {
            when (error) {
                is OpenIapError.ProductNotFound -> this["productId"] = error.productId
                is OpenIapError.SkuNotFound -> this["productId"] = error.sku
                else -> Unit
            }
        }

    private fun fetchResultToJsonArray(
        result: FetchProductsResult,
        deduplicate: Boolean = false
    ): JSONArray {
        val entries: List<Map<String, Any?>> = when (result) {
            is FetchProductsResultAll -> result.value?.map { it.toJson() }
                ?: emptyList()
            is FetchProductsResultProducts -> result.value?.map { it.toJson() }
                ?: emptyList()
            is FetchProductsResultSubscriptions -> result.value?.map { it.toJson() }
                ?: emptyList()
        }
        val array = JSONArray()
        val seenIds = mutableSetOf<String>()

        entries.forEach { entry ->
            val id = entry["id"] as? String

            // Handle deduplication for ProductQueryType.All bug in OpenIAP
            if (deduplicate && id != null) {
                if (!seenIds.add(id)) {
                    OpenIapLog.warn("OpenIAP returned duplicate product with id: $id (filtering out duplicate)", TAG)
                    return@forEach
                }
            }

            val obj = JSONObject(entry)
            // Always add productId for compatibility, handling null/blank values
            val productIdValue = obj.opt("productId")
            val hasUsableProductId = when (productIdValue) {
                null -> false
                JSONObject.NULL -> false
                is String -> productIdValue.isNotBlank()
                else -> true
            }
            if (!hasUsableProductId && !id.isNullOrBlank()) {
                obj.put("productId", id)
            }
            array.put(obj)
        }
        return array
    }

    private fun purchasesToJsonArray(purchases: List<Purchase>): JSONArray {
        val array = JSONArray()
        purchases.forEach { purchase ->
            array.put(JSONObject(purchase.toJson()))
        }
        return array
    }

    private fun buildRequestPurchaseProps(
        type: ProductQueryType,
        skus: List<String>,
        obfuscatedAccountId: String?,
        obfuscatedProfileId: String?,
        isOfferPersonalized: Boolean,
        subscriptionOffers: List<AndroidSubscriptionOfferInput>,
        purchaseToken: String?,
        originalExternalTransactionId: String? = null,
        offerToken: String? = null,
        developerBillingOption: DeveloperBillingOptionParamsAndroid? = null,
        subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid? = null
    ): RequestPurchaseProps {
        val androidPayload = mutableMapOf<String, Any?>().apply {
            put(KEY_SKUS, skus)
            put(KEY_IS_OFFER_PERSONALIZED, isOfferPersonalized)
            obfuscatedAccountId?.let { put(KEY_OBFUSCATED_ACCOUNT, it) }
            obfuscatedProfileId?.let { put(KEY_OBFUSCATED_PROFILE, it) }
            developerBillingOption?.let { put(KEY_DEVELOPER_BILLING_OPTION, it.toJson()) }
        }

        val root = mutableMapOf<String, Any?>(
            KEY_TYPE to type.toJson()
        )

        return when (type) {
            ProductQueryType.Subs -> {
                purchaseToken?.let { androidPayload[KEY_PURCHASE_TOKEN] = it }
                originalExternalTransactionId?.let {
                    androidPayload[KEY_ORIGINAL_EXTERNAL_TRANSACTION_ID] = it
                }
                subscriptionProductReplacementParams?.let {
                    androidPayload[KEY_SUBSCRIPTION_PRODUCT_REPLACEMENT_PARAMS] = it.toJson()
                }
                if (subscriptionOffers.isNotEmpty()) {
                    androidPayload[KEY_SUBSCRIPTION_OFFERS] = subscriptionOffers.map { it.toJson() }
                }
                root[KEY_REQUEST_SUBSCRIPTION] = mapOf(KEY_GOOGLE to androidPayload)
                RequestPurchaseProps.fromJson(root)
            }
            ProductQueryType.InApp -> {
                // offerToken for one-time purchase discounts (Android 8.0+)
                offerToken?.let { androidPayload[KEY_OFFER_TOKEN] = it }
                root[KEY_REQUEST_PURCHASE] = mapOf(KEY_GOOGLE to androidPayload)
                RequestPurchaseProps.fromJson(root)
            }
            ProductQueryType.All -> throw IllegalArgumentException(
                "type must be InApp or Subs when requesting a purchase"
            )
        }
    }

    private fun MethodResultWrapper.error(
        code: String,
        defaultMessage: String,
        message: String? = null
    ) {
        val resolvedMessage = message ?: defaultMessage
        this.error(code, resolvedMessage, null)
    }

    private fun emitConnectionUpdated(connected: Boolean) {
        val item = JSONObject().apply { put("connected", connected) }
        handler.post { channel?.invokeMethod("connection-updated", item.toString()) }
    }

    fun setContext(context: Context?) {
        this.context = context
    }

    fun setActivity(activity: Activity?) {
        this.activity = activity
        openIap?.setActivity(activity)
    }

    fun setChannel(channel: MethodChannel?) {
        this.channel = channel
    }

    fun onDetachedFromActivity() {
        activity = null
        openIap?.setActivity(null)
    }

    fun dispose() {
        val iap = openIap
        openIap = null
        context = null
        activity = null
        channel = null
        connectionReady = false
        listenersAttached = false
        scope.launch {
            connectionMutex.withLock {
                kotlin.runCatching { iap?.endConnection() }
            }
        }.invokeOnCompletion {
            job.cancel()
        }
    }

    // ActivityLifecycleCallbacks (no-ops except for cleanup)
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityResumed(activity: Activity) {}
    override fun onActivityPaused(activity: Activity) {}
    override fun onActivityStopped(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {
        if (this.activity === activity) {
            (context as? Application)?.unregisterActivityLifecycleCallbacks(this)
            onDetachedFromActivity()
        }
    }

    @Suppress("DEPRECATION")
    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        val ch = channel
        if (ch == null) {
            OpenIapLog.error("onMethodCall received for ${call.method} but channel is null. Cannot send result.")
            result.error(OpenIapError.DeveloperError.CODE, "MethodChannel is not attached", null)
            return
        }
        val safe = MethodResultWrapper(result, ch)

        // Quick methods that do not depend on billing readiness
        when (call.method) {
            // Internal to the Dart first-purchase notice; not app API.
            "claimFirstPurchaseNotice" -> {
                val appContext = context
                // The flag's SharedPreferences write blocks, so keep it off the main thread.
                scope.launch {
                    val claimed = appContext != null && withContext(Dispatchers.IO) {
                        runCatching { OpenIapFirstPurchaseNotice.claim(appContext) }.getOrDefault(false)
                    }
                    safe.success(claimed)
                }
                return
            }
            "manageSubscription" -> {
                val sku = call.argument<String>("sku")
                val packageName = call.argument<String>("packageName")
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        iap.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = sku, packageNameAndroid = packageName))
                        safe.success(true)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
                return
            }
            "openPlayStoreSubscriptions" -> {
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        iap.deepLinkToSubscriptions(DeepLinkOptions())
                        safe.success(true)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
                return
            }
            "openRedeemOfferCodeAndroid" -> {
                scope.launch {
                    try {
                        val iap = connectionMutex.withLock {
                            attachListenersIfNeeded()
                            requireOpenIap()
                        }
                        safe.success(redeemOfferCode(iap, activity))
                    } catch (e: OpenIapError) {
                        safe.error(e.code, e.message, serializeOpenIapError(e))
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
                return
            }
        }

        // Initialization / teardown
        when (call.method) {
            "initConnection" -> {
                // Parse Android billing configuration from arguments.
                val params = call.arguments as? Map<*, *>
                val configMap = mutableMapOf<String, Any?>()
                params?.get("enableBillingProgramAndroid")?.let {
                    configMap["enableBillingProgramAndroid"] = it
                }
                params?.get("billingChoiceScreenTypeAndroid")?.let {
                    configMap["billingChoiceScreenTypeAndroid"] = it
                }
                val newConfig = if (configMap.isEmpty()) {
                    InitConnectionConfig()
                } else {
                    InitConnectionConfig.fromJson(configMap)
                }

                OpenIapLog.debug("initConnection called with config: $configMap", TAG)

                scope.launch {
                    connectionMutex.withLock {
                        try {
                            attachListenersIfNeeded()
                            openIap?.setActivity(activity)

                            // Restart the connection to apply billing configuration.
                            try {
                                OpenIapLog.debug("Ending connection before reinitializing (current ready state: $connectionReady)", TAG)
                                openIap?.endConnection()
                                connectionReady = false

                                // Let Play finish asynchronous disconnection before reconnecting.
                                kotlinx.coroutines.delay(300)
                            } catch (e: Exception) {
                                OpenIapLog.warn("Error ending connection: ${e.message}", TAG)
                            }

                            OpenIapLog.debug("Initializing connection with config: $configMap", TAG)
                            val ok = openIap?.initConnection(newConfig) ?: false
                            connectionReady = ok
                            OpenIapLog.debug("Connection initialized: $ok", TAG)

                            // Emit connection-updated for compatibility
                            emitConnectionUpdated(ok)
                            if (ok) {
                                safe.success("Billing client ready")
                            } else {
                                val initError = OpenIapError.InitConnection.forStore(linkedStoreId)
                                safe.error(initError.code, initError.message, "responseCode: -1")
                            }
                        } catch (e: OpenIapError) {
                            safe.error(e.code, e.message, serializeOpenIapError(e))
                        } catch (e: Exception) {
                            OpenIapLog.error("Error during initConnection: ${e.message}", e)
                            val initError = OpenIapError.InitConnection.forStore(linkedStoreId)
                            safe.error(initError.code, initError.message, e.message)
                        }
                    }
                }
                return
            }
            "endConnection" -> {
                scope.launch {
                    connectionMutex.withLock {
                        try {
                            OpenIapLog.debug("endConnection called", TAG)
                            val disconnected = openIap?.endConnection() ?: true
                            if (disconnected) connectionReady = false
                            OpenIapLog.debug("endConnection result: $disconnected", TAG)
                            safe.success(disconnected)
                        } catch (e: Exception) {
                            OpenIapLog.error("Error ending connection: ${e.message}", e)
                            replyBillingError(safe, e)
                        }
                    }
                }
                return
            }
            "setPurchaseUpdatedListenerOptions" -> {
                safe.success(null)
                return
            }
            "isReady" -> {
                safe.success(connectionReady)
                return
            }
        }


        when (call.method) {
            "fetchProducts" -> {
                val params = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                val typeStr = call.argument<String>("type")
                val skus = (params["skus"] as? List<*>)
                    ?.filterIsInstance<String>()
                    ?: emptyList()
                val queryType = parseQueryType(typeStr)
                scope.launch {
                    withBillingReady(safe, autoInit = true) {
                        try {
                            val iap = requireOpenIap()
                            val result = iap.fetchProducts(ProductRequest(skus, queryType))
                            val arr = fetchResultToJsonArray(result, queryType == ProductQueryType.All)
                            safe.success(arr.toString())
                        } catch (e: OpenIapError) {
                            safe.error(e.code, e.message, serializeOpenIapError(e))
                        } catch (e: Exception) {
                            replyBillingError(safe, e, OpenIapError.QueryProduct)
                        }
                    }
                }
            }

            // Expo parity: getAvailableItems()
            "getAvailableItems" -> {
                val params = call.arguments as? Map<*, *>
                val includeSuspended = params?.get("includeSuspendedAndroid") as? Boolean ?: false

                scope.launch {
                    withBillingReady(safe, autoInit = true) {
                        try {
                            val iap = requireOpenIap()
                            val options = if (includeSuspended) {
                                dev.hyo.openiap.PurchaseOptions(includeSuspendedAndroid = true)
                            } else {
                                null
                            }
                            val purchases = iap.getAvailablePurchases(options)
                            val arr = purchasesToJsonArray(purchases)
                            safe.success(arr.toString())
                        } catch (e: Exception) {
                            replyBillingError(safe, e)
                        }
                    }
                }
            }

            "getActiveSubscriptions" -> {
                @Suppress("UNCHECKED_CAST")
                val subscriptionIds = call.arguments as? List<String>

                OpenIapLog.debug("getActiveSubscriptions called with subscriptionIds: $subscriptionIds", TAG)

                scope.launch {
                    withBillingReady(safe) {
                        try {
                            val iap = requireOpenIap()
                            val subscriptions = iap.getActiveSubscriptions(subscriptionIds)
                            val arr = JSONArray()
                            subscriptions.forEach { subscription ->
                                arr.put(JSONObject(subscription.toJson()))
                            }
                            safe.success(arr.toString())
                        } catch (e: Exception) {
                            replyBillingError(safe, e)
                        }
                    }
                }
            }

            "requestPurchase" -> {
                val validated = try {
                    validateFlutterPurchaseParams(call.arguments)
                } catch (e: IllegalArgumentException) {
                    safe.error(
                        OpenIapError.DeveloperError.CODE,
                        OpenIapError.DeveloperError.MESSAGE,
                        e.message,
                    )
                    return
                }
                val params = validated.values
                val purchaseType = validated.type
                val skus: List<String> =
                    (params["skus"] as? List<*>)
                        ?.map { it as String }
                        ?: emptyList()
                val skusNormalized = skus.filter { it.isNotBlank() }
                val obfuscatedAccountId = params["obfuscatedAccountId"] as? String
                val obfuscatedProfileId = params["obfuscatedProfileId"] as? String
                val isOfferPersonalized = params["isOfferPersonalized"] as? Boolean ?: false
                val purchaseToken = params["purchaseToken"] as? String
                val originalExternalTransactionId =
                    params[KEY_ORIGINAL_EXTERNAL_TRANSACTION_ID] as? String
                val offerToken = params["offerToken"] as? String

                // Parse developerBillingOption for External Payments (8.3.0+) or Billing Choice (9.1.0+)
                val developerBillingOptionMap = params[KEY_DEVELOPER_BILLING_OPTION] as? Map<*, *>
                val developerBillingOption = developerBillingOptionMap?.let { optionMap ->
                    try {
                        val json = optionMap.entries.mapNotNull { (key, value) ->
                            (key as? String)?.let { it to value }
                        }.toMap()
                        DeveloperBillingOptionParamsAndroid.fromJson(json)
                    } catch (e: Exception) {
                        safe.error(
                            OpenIapError.DeveloperError.CODE,
                            OpenIapError.DeveloperError.MESSAGE,
                            "Invalid developerBillingOption: ${e.message}"
                        )
                        return
                    }
                }

                // Parse subscriptionProductReplacementParams for item-level replacement (8.1.0+)
                val subscriptionProductReplacementParamsMap = params[KEY_SUBSCRIPTION_PRODUCT_REPLACEMENT_PARAMS] as? Map<*, *>
                val subscriptionProductReplacementParams = subscriptionProductReplacementParamsMap?.let { paramsMap ->
                    try {
                        val oldProductId = paramsMap["oldProductId"] as? String
                        val replacementModeStr = paramsMap["replacementMode"] as? String
                        if (!oldProductId.isNullOrBlank() && !replacementModeStr.isNullOrBlank()) {
                            val replacementMode = SubscriptionReplacementModeAndroid.fromJson(replacementModeStr)
                            SubscriptionProductReplacementParamsAndroid(
                                oldProductId = oldProductId,
                                replacementMode = replacementMode
                            )
                        } else {
                            throw IllegalArgumentException(
                                "oldProductId and replacementMode are required"
                            )
                        }
                    } catch (e: Exception) {
                        safe.error(
                            OpenIapError.DeveloperError.CODE,
                            OpenIapError.DeveloperError.MESSAGE,
                            "Invalid subscriptionProductReplacementParams: ${e.message}"
                        )
                        return
                    }
                }

                // Validate SKUs
                if (skusNormalized.isEmpty()) {
                    safe.error(OpenIapError.EmptySkuList.CODE, OpenIapError.EmptySkuList.MESSAGE, "Empty SKUs provided")
                    return
                }

                OpenIapLog.debug("requestPurchase called", TAG)
                OpenIapLog.debug("  - connectionReady = $connectionReady", TAG)
                OpenIapLog.debug("  - params keys = ${params.keys.joinToString()}", TAG)

                scope.launch {
                    // Ensure connection and listeners under mutex
                    connectionMutex.withLock {
                        try {
                            attachListenersIfNeeded()
                            openIap?.setActivity(activity)

                            // Check if connection is ready
                            if (!connectionReady) {
                                safe.error(
                                    OpenIapError.NotPrepared.CODE,
                                    OpenIapError.NotPrepared.MESSAGE,
                                    "Connection not ready. Call initConnection() first with the desired billing mode."
                                )
                                return@launch
                            }
                        } catch (e: OpenIapError) {
                            safe.error(e.code, e.message, serializeOpenIapError(e))
                            return@launch
                        } catch (e: Exception) {
                            replyBillingError(safe, e)
                            return@launch
                        }
                    }

                try {
                    val iap = requireOpenIap()
                    val offers =
                        (params["subscriptionOffers"] as? List<*>)?.map { entry ->
                            val map = entry as Map<*, *>
                            val sku = map["sku"] as String
                            val token = map["offerToken"] as String
                            AndroidSubscriptionOfferInput(sku = sku, offerToken = token)
                        } ?: emptyList()

                    val requestProps = buildRequestPurchaseProps(
                        type = purchaseType,
                        skus = skusNormalized,
                        obfuscatedAccountId = obfuscatedAccountId,
                        obfuscatedProfileId = obfuscatedProfileId,
                        isOfferPersonalized = isOfferPersonalized,
                        subscriptionOffers = offers,
                        purchaseToken = purchaseToken,
                        originalExternalTransactionId = originalExternalTransactionId,
                        offerToken = offerToken,
                        developerBillingOption = developerBillingOption,
                        subscriptionProductReplacementParams = subscriptionProductReplacementParams
                    )

                    iap.requestPurchase(requestProps)
                    // Success signaled by purchase-updated event
                    safe.success(null)
                } catch (e: OpenIapError) {
                    safe.error(e.code, e.message, serializeOpenIapError(e))
                } catch (e: Exception) {
                    safe.error(OpenIapError.PurchaseFailed.CODE, OpenIapError.PurchaseFailed.MESSAGE, e.message)
                }
            }
            }

            // -----------------------------------------------------------------
            // Android-suffix stable APIs (kept)
            // -----------------------------------------------------------------
            "getStorefront" -> {
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val code = iap.getStorefront()
                        safe.success(code)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "getStorefrontAndroid" -> {
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val code = iap.getStorefront()
                        safe.success(code)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "deepLinkToSubscriptionsAndroid" -> {
                val params = call.arguments as? Map<*, *>
                val sku = params?.get("skuAndroid") as? String
                val pkg = params?.get("packageNameAndroid") as? String
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        iap.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = sku, packageNameAndroid = pkg))
                        safe.success(null)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "hasActiveSubscriptions" -> {
                val ids = call.argument<List<String>>("subscriptionIds")
                scope.launch {
                    try {
                        safe.success(requireOpenIap().hasActiveSubscriptions(ids))
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "restorePurchases" -> {
                scope.launch {
                    try {
                        requireOpenIap().restorePurchases()
                        safe.success(true)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "finishTransaction" -> {
                val purchase = call.argument<Map<String, Any?>>("purchase")
                val isConsumable = call.argument<Boolean>("isConsumable") ?: false
                scope.launch {
                    try {
                        val payload = purchase ?: throw OpenIapError.DeveloperError("Missing purchase")
                        requireOpenIap().finishTransaction(dev.hyo.openiap.PurchaseAndroid.fromJson(payload), isConsumable)
                        safe.success(null)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "acknowledgePurchaseAndroid" -> {
                val params = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                val purchaseToken =
                    resolveCanonicalPurchaseToken(params)?.takeIf { it.isNotBlank() }
                if (purchaseToken == null) {
                    safe.error(OpenIapError.DeveloperError.CODE, OpenIapError.DeveloperError.MESSAGE, "Missing purchaseToken")
                    return
                }
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        iap.acknowledgePurchaseAndroid(purchaseToken)
                        val resp = JSONObject().apply { put("responseCode", 0) }
                        safe.success(resp.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "consumePurchaseAndroid" -> {
                val params = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                val purchaseToken =
                    resolveCanonicalPurchaseToken(params)?.takeIf { it.isNotBlank() }
                if (purchaseToken == null) {
                    safe.error(OpenIapError.DeveloperError.CODE, OpenIapError.DeveloperError.MESSAGE, "Missing purchaseToken")
                    return
                }
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        iap.consumePurchaseAndroid(purchaseToken)
                        val resp = JSONObject().apply {
                            put("responseCode", 0)
                            put("purchaseToken", purchaseToken)
                        }
                        safe.success(resp.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }

            // Billing Programs API (8.2.0+)
            "isBillingProgramAvailableAndroid" -> {
                val programStr = call.argument<String>("program")
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val program = BillingProgramAndroid.fromJson(programStr ?: "unspecified")
                        val result = iap.isBillingProgramAvailable(program)
                        val response = JSONObject().apply {
                            put("billingProgram", result.billingProgram.toJson())
                            put("choiceScreenType", result.choiceScreenType?.toJson())
                            put("isAvailable", result.isAvailable)
                            put("isExternalLinkAvailable", result.isExternalLinkAvailable)
                        }
                        safe.success(response.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "getBillingChoiceInfoAndroid" -> {
                val programStr = call.argument<String?>("billingProgram")
                val imageLayoutStr = call.argument<String?>("playBillingChoiceImageLayout")
                val userLocale = call.argument<String?>("userLocale")
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val params = GetBillingChoiceInfoParamsAndroid(
                            billingProgram = BillingProgramAndroid.fromJson(programStr ?: "billing-choice"),
                            playBillingChoiceImageLayout = BillingChoiceImageLayoutAndroid.fromJson(imageLayoutStr ?: "rectangular-four-by-one"),
                            userLocale = userLocale
                        )
                        val result = iap.getBillingChoiceInfo(params)
                        val response = JSONObject().apply {
                            put("playBillingChoiceImageUrl", result.playBillingChoiceImageUrl)
                            put("playBillingLoyaltyInfo", result.playBillingLoyaltyInfo)
                        }
                        safe.success(response.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "createBillingProgramReportingDetailsAndroid" -> {
                val programStr = call.argument<String>("program")
                val developerBillingTypeStr = call.argument<String?>("developerBillingType")
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val program = BillingProgramAndroid.fromJson(programStr ?: "unspecified")
                        val developerBillingType = developerBillingTypeStr?.let {
                            DeveloperBillingTypeAndroid.fromJson(it)
                        }
                        val result = iap.createBillingProgramReportingDetails(program, developerBillingType)
                        val response = JSONObject().apply {
                            put("billingProgram", result.billingProgram.toJson())
                            put("externalTransactionToken", result.externalTransactionToken)
                        }
                        safe.success(response.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "showBillingProgramInformationDialogAndroid" -> {
                val programStr = call.argument<String?>("billingProgram")
                val token = call.argument<String?>("externalTransactionToken")
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val act = activity
                        if (act == null) {
                            safe.error(OpenIapError.BillingError.CODE, OpenIapError.BillingError.MESSAGE, "Activity not available")
                            return@launch
                        }
                        if (token.isNullOrBlank()) {
                            safe.error(OpenIapError.DeveloperError.CODE, "externalTransactionToken is required for showBillingProgramInformationDialogAndroid", null)
                            return@launch
                        }
                        val result = iap.showBillingProgramInformationDialog(
                            act,
                            BillingProgramInformationDialogParamsAndroid(
                                billingProgram = BillingProgramAndroid.fromJson(programStr ?: "billing-choice"),
                                externalTransactionToken = token
                            )
                        )
                        val response = JSONObject().apply {
                            put("responseCode", result.responseCode)
                            put("debugMessage", result.debugMessage)
                            put("subResponseCode", result.subResponseCode?.toJson())
                        }
                        safe.success(response.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "showInAppMessagesAndroid" -> {
                val params = try {
                    validateFlutterInAppMessageParams(call.argument<Any?>("categories"))
                } catch (e: IllegalArgumentException) {
                    safe.error(
                        OpenIapError.DeveloperError.CODE,
                        OpenIapError.DeveloperError.MESSAGE,
                        e.message,
                    )
                    return
                }
                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val act = activity
                        if (act == null) {
                            safe.error(OpenIapError.BillingError.CODE, OpenIapError.BillingError.MESSAGE, "Activity not available")
                            return@launch
                        }
                        val result = iap.showInAppMessages(act, params)
                        val response = JSONObject().apply {
                            put("responseCode", result.responseCode.toJson())
                            put("purchaseToken", result.purchaseToken)
                        }
                        safe.success(response.toString())
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }
            "launchExternalLinkAndroid" -> {
                val programStr = call.argument<String?>("billingProgram")
                val launchModeStr = call.argument<String?>("launchMode")
                val linkTypeStr = call.argument<String?>("linkType")
                val linkUri: String? = call.argument<String>("linkUri")?.takeIf { it.isNotBlank() }
                val externalTransactionToken: String? =
                    call.argument<String>("externalTransactionToken")?.takeIf { it.isNotBlank() }

                scope.launch {
                    try {
                        val iap = requireOpenIap()
                        val act = activity
                        if (act == null) {
                            safe.error(OpenIapError.BillingError.CODE, OpenIapError.BillingError.MESSAGE, "Activity not available")
                            return@launch
                        }
                        if (linkUri == null) {
                            safe.error(OpenIapError.DeveloperError.CODE, "linkUri is required for launchExternalLinkAndroid", null)
                            return@launch
                        }
                        val launchParams = LaunchExternalLinkParamsAndroid(
                            billingProgram = BillingProgramAndroid.fromJson(programStr ?: "unspecified"),
                            externalTransactionToken = externalTransactionToken,
                            launchMode = ExternalLinkLaunchModeAndroid.fromJson(launchModeStr ?: "unspecified"),
                            linkType = ExternalLinkTypeAndroid.fromJson(linkTypeStr ?: "unspecified"),
                            linkUri = linkUri
                        )
                        val success = iap.launchExternalLink(act, launchParams)
                        safe.success(success)
                    } catch (e: Exception) {
                        replyBillingError(safe, e)
                    }
                }
            }

            // Verify Purchase (Platform-specific, v8.0.0+)
            "verifyPurchase" -> {
                val googleOptions = call.argument<Map<String, Any?>>("google")
                val horizonOptions = call.argument<Map<String, Any?>>("horizon")

                if ((googleOptions == null) == (horizonOptions == null)) {
                    safe.error(
                        OpenIapError.DeveloperError.CODE,
                        "Exactly one of google or horizon options is required for Android verification",
                        null
                    )
                    return
                }

                val optionName = if (googleOptions != null) "google" else "horizon"
                val optionLabel = if (googleOptions != null) "Google" else "Horizon"
                val selectedOptions = googleOptions ?: horizonOptions!!
                val requiredFields = if (googleOptions != null) {
                    listOf("accessToken", "packageName", "purchaseToken", "sku")
                } else {
                    listOf("accessToken", "sku", "userId")
                }
                val missingField = requiredFields.firstOrNull {
                    (selectedOptions[it] as? String).isNullOrBlank()
                }
                if (missingField != null) {
                    safe.error(
                        OpenIapError.DeveloperError.CODE,
                        "$missingField is required for $optionLabel verification",
                        null
                    )
                    return
                }

                scope.launch {
                    withBillingReady(safe, autoInit = true) {
                        try {
                            val iap = requireOpenIap()

                            // Forward the complete platform payload and let the generated
                            // contract own both parsing and result serialization.
                            val propsMap = mapOf(optionName to selectedOptions)
                            val props = dev.hyo.openiap.VerifyPurchaseProps.fromJson(propsMap)
                            val hasParsedOptions = if (optionName == "google") {
                                props.google != null
                            } else {
                                props.horizon != null
                            }
                            if (!hasParsedOptions) {
                                safe.error(
                                    OpenIapError.DeveloperError.CODE,
                                    "Invalid $optionName options for Android verification",
                                    null
                                )
                                return@withBillingReady
                            }
                            val result = iap.verifyPurchase(props)
                            safe.success(JSONObject(result.toJson()).toString())
                        } catch (e: Exception) {
                            OpenIapLog.error("verifyPurchase error", e)
                            replyBillingError(safe, e, OpenIapError.VerificationFailed)
                        }
                    }
                }
            }

            // Verify Purchase with Provider (IAPKit)
            "verifyPurchaseWithProvider" -> {
                val params = call.arguments as? Map<*, *>
                val provider = params?.get("provider") as? String

                if (provider == null) {
                    safe.error(OpenIapError.DeveloperError.CODE, "provider required", null)
                    return
                }

                scope.launch {
                    withBillingReady(safe, autoInit = true) {
                        try {
                            val iap = requireOpenIap()

                            // Build props map for OpenIAP
                            val propsMap = mutableMapOf<String, Any?>("provider" to provider)
                            (params["iapkit"] as? Map<*, *>)?.let { iapkit ->
                                val iapkitMap = mutableMapOf<String, Any?>()
                                (iapkit["apiKey"] as? String)?.let { iapkitMap["apiKey"] = it }
                                (iapkit["baseUrl"] as? String)?.let { iapkitMap["baseUrl"] = it }
                                (iapkit["includeClientPayload"] as? Boolean)?.let {
                                    iapkitMap["includeClientPayload"] = it
                                }
                                ((iapkit["google"] as? Map<*, *>)?.get("purchaseToken") as? String)?.let { purchaseToken ->
                                    iapkitMap["google"] = mapOf("purchaseToken" to purchaseToken)
                                }
                                ((iapkit["apple"] as? Map<*, *>)?.get("jws") as? String)?.let { jws ->
                                    iapkitMap["apple"] = mapOf("jws" to jws)
                                }
                                (iapkit["amazon"] as? Map<*, *>)?.let { amazon ->
                                    (amazon["receiptId"] as? String)?.let { receiptId ->
                                        val amazonMap = mutableMapOf<String, Any?>(
                                            "receiptId" to receiptId
                                        )
                                        (amazon["sandbox"] as? Boolean)?.let { sandbox ->
                                            amazonMap["sandbox"] = sandbox
                                        }
                                        (amazon["expectedProductId"] as? String)?.let { expectedProductId ->
                                            amazonMap["expectedProductId"] = expectedProductId
                                        }
                                        (amazon["userId"] as? String)?.let { userId ->
                                            amazonMap["userId"] = userId
                                        }
                                        iapkitMap["amazon"] = amazonMap
                                    }
                                }
                                (iapkit["horizon"] as? Map<*, *>)?.let { horizon ->
                                    (horizon["sku"] as? String)?.let { sku ->
                                        val horizonMap = mutableMapOf<String, Any?>(
                                            "sku" to sku
                                        )
                                        (horizon["userId"] as? String)?.let { userId ->
                                            horizonMap["userId"] = userId
                                        }
                                        iapkitMap["horizon"] = horizonMap
                                    }
                                }
                                propsMap["iapkit"] = iapkitMap
                            }

                            val props = dev.hyo.openiap.VerifyPurchaseWithProviderProps.fromJson(propsMap)
                            if (props == null) {
                                safe.error(OpenIapError.DeveloperError.CODE, "Invalid props for verifyPurchaseWithProvider", null)
                                return@withBillingReady
                            }
                            val result = iap.verifyPurchaseWithProvider(props)
                            safe.success(JSONObject(result.toJson()).toString())
                        } catch (e: Exception) {
                            OpenIapLog.error("verifyPurchaseWithProvider error", e)
                            replyBillingError(safe, e, OpenIapError.VerificationFailed)
                        }
                    }
                }
            }

            else -> safe.notImplemented()
        }
    }

    private fun resolveCanonicalPurchaseToken(
        params: Map<*, *>,
    ): String? {
        return params[KEY_PURCHASE_TOKEN] as? String
    }

    private suspend fun withBillingReady(
        safe: MethodResultWrapper,
        autoInit: Boolean = false,
        block: suspend () -> Unit
    ) {
        connectionMutex.withLock {
            try {
                attachListenersIfNeeded()
                openIap?.setActivity(activity)
                if (!connectionReady) {
                    if (autoInit) {
                        val ok = openIap?.initConnection(InitConnectionConfig()) ?: false
                        connectionReady = ok
                        emitConnectionUpdated(ok)
                        if (!ok) {
                            val initError = OpenIapError.InitConnection.forStore(linkedStoreId)
                            safe.error(initError.code, initError.message, "Failed to initialize connection")
                            return
                        }
                    } else {
                        safe.error(OpenIapError.NotPrepared.CODE, OpenIapError.NotPrepared.MESSAGE, "Billing not ready")
                        return
                    }
                }
            } catch (e: OpenIapError) {
                safe.error(e.code, e.message, serializeOpenIapError(e))
                return
            } catch (e: Exception) {
                replyBillingError(safe, e)
                return
            }
        }
        block()
    }

    // The store this binary links, for init-failure messages.
    private var linkedStoreId: String? = null

    private fun requireOpenIap(): OpenIapProtocol = openIap ?: run {
        val ctx = context ?: throw OpenIapError.NotPrepared
        val factory = OpenIapProvider.factory(ctx)
        linkedStoreId = factory.storeId
        OpenIapProvider.create(ctx, factory).also {
            it.setActivity(activity)
            openIap = it
        }
    }

    private fun replyBillingError(
        safe: MethodResultWrapper,
        error: Exception,
        fallback: OpenIapError = OpenIapError.BillingError(),
    ) {
        if (error is OpenIapError) {
            safe.error(error.code, error.message, serializeOpenIapError(error))
        } else {
            safe.error(fallback.code, fallback.message, error.message)
        }
    }

    private fun attachListenersIfNeeded() {
        if (listenersAttached) return
        val iap = requireOpenIap()
        iap.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { p ->
            scope.launch {
                try {
                    val payload = JSONObject(p.toJson())
                    channel?.invokeMethod("purchase-updated", payload.toString())
                } catch (e: Exception) {
                    OpenIapLog.error("Failed to send purchase-updated", e)
                }
            }
        })
        iap.addPurchaseErrorListener(OpenIapPurchaseErrorListener { e ->
            scope.launch {
                try {
                    val payload = JSONObject(serializeOpenIapError(e))
                    channel?.invokeMethod("purchase-error", payload.toString())
                } catch (ex: Exception) {
                    OpenIapLog.error("Failed to send purchase-error", ex)
                }
            }
        })
        iap.addUserChoiceBillingListener { details ->
            scope.launch {
                try {
                    val payload = JSONObject(details.toJson())
                    channel?.invokeMethod("user-choice-billing-android", payload.toString())
                } catch (e: Exception) {
                    OpenIapLog.error("Failed to send user-choice-billing-android", e)
                }
            }
        }
        iap.addDeveloperProvidedBillingListener(OpenIapDeveloperProvidedBillingListener { details ->
            scope.launch {
                try {
                    val payload = JSONObject(details.toJson())
                    channel?.invokeMethod("developer-provided-billing-android", payload.toString())
                } catch (e: Exception) {
                    OpenIapLog.error("Failed to send developer-provided-billing-android", e)
                }
            }
        })
        iap.addSubscriptionBillingIssueListener(
            dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener { purchase ->
                scope.launch {
                    try {
                        val payload = JSONObject(purchase.toJson())
                        channel?.invokeMethod("subscription-billing-issue", payload.toString())
                    } catch (e: Exception) {
                        OpenIapLog.error("Failed to send subscription-billing-issue", e)
                    }
                }
            }
        )
        listenersAttached = true
    }

    companion object {
        private const val TAG = "InappPurchasePlugin"

        private const val KEY_REQUEST_SUBSCRIPTION = "requestSubscription"
        private const val KEY_REQUEST_PURCHASE = "requestPurchase"
        private const val KEY_GOOGLE = "google"
        private const val KEY_TYPE = "type"
        private const val KEY_SKUS = "skus"
        private const val KEY_IS_OFFER_PERSONALIZED = "isOfferPersonalized"
        // Input field names use simplified naming (without Android suffix) per OpenIAP 1.3.15+
        private const val KEY_OBFUSCATED_ACCOUNT = "obfuscatedAccountId"
        private const val KEY_OBFUSCATED_PROFILE = "obfuscatedProfileId"
        private const val KEY_PURCHASE_TOKEN = "purchaseToken"
        private const val KEY_ORIGINAL_EXTERNAL_TRANSACTION_ID = "originalExternalTransactionId"
        private const val KEY_OFFER_TOKEN = "offerToken"
        private const val KEY_SUBSCRIPTION_OFFERS = "subscriptionOffers"
        private const val KEY_DEVELOPER_BILLING_OPTION = "developerBillingOption"
        private const val KEY_SUBSCRIPTION_PRODUCT_REPLACEMENT_PARAMS = "subscriptionProductReplacementParams"
    }
}
