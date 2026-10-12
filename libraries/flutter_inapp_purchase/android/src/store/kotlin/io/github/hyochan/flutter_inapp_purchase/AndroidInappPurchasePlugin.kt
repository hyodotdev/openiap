package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import android.content.Context
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
import dev.hyo.openiap.helpers.finishPurchaseToken
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
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
class AndroidInappPurchasePlugin internal constructor() : MethodCallHandler {
    private val job = Job()
    private val scope = CoroutineScope(Dispatchers.Main + job)
    private val handler = Handler(Looper.getMainLooper())

    private var context: Context? = null
    private var activity: Activity? = null
    private var channel: MethodChannel? = null

    private var listenersAttached = false
    // This engine's handle on the shared provider.
    private var openIap: OpenIapProtocol? = null

    /** Read under [lifecycle]: this engine asked for the connection and it is up. */
    private val connectionReady: Boolean
        get() = this in connectedEngines && providerReady

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

    private fun emitConnectionUpdated(connected: Boolean) {
        val item = JSONObject().apply { put("connected", connected) }
        handler.post { channel?.invokeMethod("connection-updated", item.toString()) }
    }

    fun setContext(context: Context?) {
        this.context = context
    }

    fun setActivity(activity: Activity?) {
        this.activity = activity
        openIap?.let { shareActivity(this, it, activity) }
    }

    fun setChannel(channel: MethodChannel?) {
        this.channel = channel
    }

    fun dispose() {
        setActivity(null)
        channel = null
        scope.launch {
            lifecycle.withLock {
                val iap = openIap ?: return@withLock
                openIap = null
                if (listenersAttached) detachListeners(iap)
                listenersAttached = false
                val wasConnected = connectedEngines.remove(this@AndroidInappPurchasePlugin)
                providerUsers--
                if (providerUsers == 0) sharedProvider = null
                // Ending inside the lock keeps a new provider from starting beside this one.
                if (providerUsers == 0 || (wasConnected && connectedEngines.isEmpty())) {
                    providerReady = false
                    runCatching { iap.endConnection() }
                }
            }
            context = null
        }.invokeOnCompletion {
            job.cancel()
        }
    }

    @Suppress("DEPRECATION")
    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (channel == null) {
            OpenIapLog.error("onMethodCall received for ${call.method} after the plugin detached")
            result.error(OpenIapError.DeveloperError.CODE, "MethodChannel is not attached", null)
            return
        }
        val safe = MethodResultWrapper(result)

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
            "openRedeemOfferCode" -> {
                scope.launch {
                    try {
                        val iap = lifecycle.withLock { attachListenersLocked() }
                        safe.success(redeemOfferCode(iap, activity)?.toJson())
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
                    lifecycle.withLock {
                        try {
                            val iap = attachListenersLocked()
                            // Another engine already holds the connection; restarting would drop it.
                            if (providerReady && (connectedEngines - this@AndroidInappPurchasePlugin).isNotEmpty()) {
                                connectedEngines.add(this@AndroidInappPurchasePlugin)
                                emitConnectionUpdated(true)
                                safe.success("Billing client ready")
                                return@withLock
                            }

                            // Restart the connection to apply billing configuration.
                            try {
                                OpenIapLog.debug("Ending connection before reinitializing (current ready state: $connectionReady)", TAG)
                                iap.endConnection()
                                providerReady = false

                                // Let Play finish asynchronous disconnection before reconnecting.
                                kotlinx.coroutines.delay(300)
                            } catch (e: Exception) {
                                OpenIapLog.warn("Error ending connection: ${e.message}", TAG)
                            }

                            OpenIapLog.debug("Initializing connection with config: $configMap", TAG)
                            val ok = iap.initConnection(newConfig)
                            markConnected(ok)
                            OpenIapLog.debug("Connection initialized: $ok", TAG)

                            // Emit connection-updated for compatibility
                            emitConnectionUpdated(ok)
                            if (ok) {
                                safe.success("Billing client ready")
                            } else {
                                val initError = initConnectionError()
                                safe.error(initError.code, initError.message, "responseCode: -1")
                            }
                        } catch (e: OpenIapError) {
                            safe.error(e.code, e.message, serializeOpenIapError(e))
                        } catch (e: Exception) {
                            OpenIapLog.error("Error during initConnection: ${e.message}", e)
                            val initError = initConnectionError()
                            safe.error(initError.code, initError.message, e.message)
                        }
                    }
                }
                return
            }
            "endConnection" -> {
                scope.launch {
                    lifecycle.withLock {
                        try {
                            OpenIapLog.debug("endConnection called", TAG)
                            val self = this@AndroidInappPurchasePlugin
                            // Only the last engine that asked for the connection ends it.
                            val disconnected = if ((connectedEngines - self).isNotEmpty()) {
                                connectedEngines.remove(self)
                                true
                            } else {
                                (openIap?.endConnection() ?: true).also { if (it) markConnected(false) }
                            }
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
                scope.launch { safe.success(lifecycle.withLock { connectionReady }) }
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
                    lifecycle.withLock {
                        try {
                            attachListenersLocked()

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
            "getStorefront", "getStorefrontAndroid" -> {
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
            "acknowledgePurchaseAndroid", "consumePurchaseAndroid" -> {
                val params = call.arguments as? Map<*, *> ?: emptyMap<String, Any?>()
                val purchaseToken =
                    resolveCanonicalPurchaseToken(params)?.takeIf { it.isNotBlank() }
                if (purchaseToken == null) {
                    safe.error(OpenIapError.DeveloperError.CODE, OpenIapError.DeveloperError.MESSAGE, "Missing purchaseToken")
                    return
                }
                val isConsumable = call.method == "consumePurchaseAndroid"
                scope.launch {
                    try {
                        requireOpenIap().finishPurchaseToken(purchaseToken, isConsumable)
                        val resp = JSONObject().apply {
                            put("responseCode", 0)
                            if (isConsumable) put("purchaseToken", purchaseToken)
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

            "verifyAppOwnership" -> {
                val params = (call.arguments as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap()
                scope.launch {
                    try {
                        val provider = requireOpenIap()
                        val options = dev.hyo.openiap.VerifyAppOwnershipProps.fromJson(params)
                        safe.success(JSONObject(provider.verifyAppOwnership(options).toJson()).toString())
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        val fallback = if (e is IllegalArgumentException) {
                            OpenIapError.DeveloperError(e.message)
                        } else {
                            OpenIapError.ServiceUnavailable(e.message)
                        }
                        replyBillingError(safe, e, fallback)
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
        lifecycle.withLock {
            try {
                val iap = attachListenersLocked()
                if (!connectionReady) {
                    if (autoInit) {
                        // Join a connection another engine holds instead of starting a second one.
                        val ok = providerReady || iap.initConnection(InitConnectionConfig())
                        markConnected(ok)
                        emitConnectionUpdated(ok)
                        if (!ok) {
                            val initError = initConnectionError()
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

    private fun initConnectionError(): OpenIapError =
        context?.let { OpenIapError.InitConnection.forProvider(it) } ?: OpenIapError.InitConnection

    private suspend fun requireOpenIap(): OpenIapProtocol = openIap ?: lifecycle.withLock { providerLocked() }

    /** Caller holds [lifecycle]; joins the shared provider, creating it once per process. */
    private fun providerLocked(): OpenIapProtocol = openIap ?: run {
        val ctx = context ?: throw OpenIapError.NotPrepared
        val provider = sharedProvider ?: OpenIapProvider.create(ctx)
        sharedProvider = provider
        providerUsers++
        openIap = provider
        activity?.let { shareActivity(this, provider, it) }
        provider
    }

    /** Caller holds [lifecycle]. */
    private fun markConnected(connected: Boolean) {
        providerReady = connected
        if (connected) connectedEngines.add(this) else connectedEngines.remove(this)
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

    private val purchaseUpdateListener = OpenIapPurchaseUpdateListener { purchase ->
        emit("purchase-updated") { JSONObject(purchase.toJson()) }
    }
    private val purchaseErrorListener = OpenIapPurchaseErrorListener { error ->
        emit("purchase-error") { JSONObject(serializeOpenIapError(error)) }
    }
    private val userChoiceBillingListener = OpenIapUserChoiceBillingListener { details ->
        emit("user-choice-billing-android") { JSONObject(details.toJson()) }
    }
    private val developerProvidedBillingListener = OpenIapDeveloperProvidedBillingListener { details ->
        emit("developer-provided-billing-android") { JSONObject(details.toJson()) }
    }
    private val subscriptionBillingIssueListener = OpenIapSubscriptionBillingIssueListener { purchase ->
        emit("subscription-billing-issue") { JSONObject(purchase.toJson()) }
    }

    // The billing service dropped; every engine's Dart must call initConnection again.
    private val connectionStateListener = OpenIapConnectionStateListener {
        providerReady = false
        emitConnectionUpdated(false)
    }

    private fun emit(method: String, payload: () -> JSONObject) {
        scope.launch {
            try {
                channel?.invokeMethod(method, payload().toString())
            } catch (e: Exception) {
                OpenIapLog.error("Failed to send $method", e)
            }
        }
    }

    /** Caller holds [lifecycle]. */
    private fun attachListenersLocked(): OpenIapProtocol {
        val iap = providerLocked()
        if (listenersAttached) return iap
        iap.addPurchaseUpdateListener(purchaseUpdateListener)
        iap.addPurchaseErrorListener(purchaseErrorListener)
        iap.addUserChoiceBillingListener(userChoiceBillingListener)
        iap.addDeveloperProvidedBillingListener(developerProvidedBillingListener)
        iap.addSubscriptionBillingIssueListener(subscriptionBillingIssueListener)
        iap.addConnectionStateListener(connectionStateListener)
        listenersAttached = true
        return iap
    }

    private fun detachListeners(iap: OpenIapProtocol) {
        iap.removePurchaseUpdateListener(purchaseUpdateListener)
        iap.removePurchaseErrorListener(purchaseErrorListener)
        iap.removeUserChoiceBillingListener(userChoiceBillingListener)
        iap.removeDeveloperProvidedBillingListener(developerProvidedBillingListener)
        iap.removeSubscriptionBillingIssueListener(subscriptionBillingIssueListener)
        iap.removeConnectionStateListener(connectionStateListener)
    }

    companion object {
        private const val TAG = "InappPurchasePlugin"

        // Horizon kills the process when a second billing client queries purchases, so every
        // FlutterEngine shares one provider and runs its connection lifecycle under one lock.
        private val lifecycle = Mutex()
        private var sharedProvider: OpenIapProtocol? = null
        private var providerUsers = 0
        // Engines whose Dart side connected and has not ended the connection.
        private val connectedEngines = mutableSetOf<AndroidInappPurchasePlugin>()
        @Volatile
        private var providerReady = false
        private var activityOwner: AndroidInappPurchasePlugin? = null

        /** Purchases use the provider's Activity, so only the engine that set it may clear it. */
        @Synchronized
        private fun shareActivity(
            plugin: AndroidInappPurchasePlugin,
            provider: OpenIapProtocol,
            activity: Activity?,
        ) {
            if (activity != null) {
                activityOwner = plugin
                provider.setActivity(activity)
            } else if (activityOwner === plugin) {
                activityOwner = null
                provider.setActivity(null)
            }
        }

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
