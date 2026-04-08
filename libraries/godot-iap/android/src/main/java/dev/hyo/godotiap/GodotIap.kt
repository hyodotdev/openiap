package dev.hyo.godotiap

import dev.hyo.openiap.*
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import kotlinx.coroutines.runBlocking
import org.godotengine.godot.Godot
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.plugin.SignalInfo
import org.godotengine.godot.plugin.UsedByGodot
import org.json.JSONArray
import org.json.JSONObject
import dev.hyo.openiap.BillingProgramAndroid as OpenIapBillingProgram
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid as OpenIapExternalLinkLaunchMode
import dev.hyo.openiap.ExternalLinkTypeAndroid as OpenIapExternalLinkType
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid as OpenIapLaunchExternalLinkParams

/**
 * GodotIap - Godot plugin for in-app purchases using OpenIAP
 *
 * Provides Google Play Billing integration following the OpenIAP specification.
 */
class GodotIap(godot: Godot) : GodotPlugin(godot) {

    private lateinit var openIap: OpenIapModule
    private lateinit var store: OpenIapStore
    private var isInitialized = false

    // Listeners
    private val purchaseUpdateListener = OpenIapPurchaseUpdateListener { purchase ->
        GodotIapLog.debug("Purchase updated: ${purchase.productId}")
        val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
        emitSignal("purchase_updated", JSONObject(sanitized).toString())
    }

    private val purchaseErrorListener = OpenIapPurchaseErrorListener { error ->
        GodotIapLog.failure("Purchase", Exception(error.message))
        val errorPayload = error.toJSON()
        emitSignal("purchase_error", JSONObject(errorPayload).toString())
    }

    override fun getPluginName(): String = "GodotIap"

    override fun getPluginSignals(): Set<SignalInfo> {
        return setOf(
            SignalInfo("purchase_updated", String::class.java),
            SignalInfo("purchase_error", String::class.java),
            SignalInfo("products_fetched", String::class.java),
            SignalInfo("connected"),
            SignalInfo("disconnected"),
            SignalInfo("user_choice_billing", String::class.java),
            SignalInfo("developer_provided_billing", String::class.java)
        )
    }

    // ==========================================
    // Connection
    // ==========================================

    @UsedByGodot
    fun initConnection(): Boolean {
        GodotIapLog.debug("initConnection called")

        val activity = activity ?: run {
            GodotIapLog.failure("initConnection", Exception("Activity is null"))
            return false
        }

        return runBlocking {
            try {
                // Use OpenIapModule directly like expo-iap does
                openIap = OpenIapModule(activity)
                store = OpenIapStore(openIap)
                store.addPurchaseUpdateListener(purchaseUpdateListener)
                store.addPurchaseErrorListener(purchaseErrorListener)

                val result = store.initConnection()
                isInitialized = result

                if (result) {
                    emitSignal("connected")
                }

                GodotIapLog.result("initConnection", result)
                result
            } catch (e: Exception) {
                GodotIapLog.failure("initConnection", e)
                false
            }
        }
    }

    @UsedByGodot
    fun endConnection(): Boolean {
        GodotIapLog.debug("endConnection called")

        if (!isInitialized) return true

        return runBlocking {
            try {
                store.removePurchaseUpdateListener(purchaseUpdateListener)
                store.removePurchaseErrorListener(purchaseErrorListener)

                val result = store.endConnection()
                isInitialized = false
                emitSignal("disconnected")

                GodotIapLog.result("endConnection", result)
                result
            } catch (e: Exception) {
                GodotIapLog.failure("endConnection", e)
                false
            }
        }
    }

    // ==========================================
    // Products
    // ==========================================

    @UsedByGodot
    fun fetchProducts(requestJson: String): String {
        GodotIapLog.payload("fetchProducts", requestJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("error", "Not initialized")
                put("products", JSONArray())
            }.toString()
        }

        return runBlocking {
            try {
                // Parse request JSON: { "skus": [...], "type": "all" | "inapp" | "subs" }
                val request = JSONObject(requestJson)
                val skusArray = request.optJSONArray("skus") ?: JSONArray()
                val skus = mutableListOf<String>()
                for (i in 0 until skusArray.length()) {
                    skus.add(skusArray.getString(i))
                }

                // Parse type from request (default to "all")
                val typeStr = request.optString("type", "all")
                val queryType = when (typeStr) {
                    "inapp" -> ProductQueryType.InApp
                    "subs" -> ProductQueryType.Subs
                    else -> ProductQueryType.All
                }

                val result = store.fetchProducts(ProductRequest(skus = skus, type = queryType))
                val productsArray = JSONArray()

                when (result) {
                    is FetchProductsResultProducts -> {
                        result.value?.forEach { product ->
                            productsArray.put(JSONObject(product.toJson()))
                        }
                    }
                    is FetchProductsResultSubscriptions -> {
                        result.value?.forEach { subscription ->
                            productsArray.put(JSONObject(subscription.toJson()))
                        }
                    }
                    is FetchProductsResultAll -> {
                        result.value?.forEach { item ->
                            when (item) {
                                is ProductOrSubscription.ProductItem -> {
                                    productsArray.put(JSONObject(item.value.toJson()))
                                }
                                is ProductOrSubscription.ProductSubscriptionItem -> {
                                    productsArray.put(JSONObject(item.value.toJson()))
                                }
                            }
                        }
                    }
                }

                val responseJson = JSONObject().apply {
                    put("products", productsArray)
                }

                GodotIapLog.result("fetchProducts", responseJson.toString())
                emitSignal("products_fetched", responseJson.toString())
                responseJson.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("fetchProducts", e)
                JSONObject().apply {
                    put("error", e.message)
                    put("products", JSONArray())
                }.toString()
            }
        }
    }

    // ==========================================
    // Purchases
    // ==========================================

    /**
     * Request purchase - handles both in-app and subscription products
     * Uses JSON params like expo-iap for flexibility
     * @param paramsJson JSON string containing: type, skus, obfuscatedAccountId, etc.
     */
    @UsedByGodot
    fun requestPurchase(paramsJson: String): String {
        GodotIapLog.payload("requestPurchase", paramsJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                // Parse params using helper (like expo-iap)
                val params = GodotIapHelper.parseRequestPurchaseParams(paramsJson)

                // Determine product type
                val productType = GodotIapHelper.parseProductQueryType(params.type)

                // Build request props based on product type (exactly like expo-iap)
                val requestProps = when (productType) {
                    ProductQueryType.Subs -> {
                        val android = RequestSubscriptionAndroidProps(
                            isOfferPersonalized = params.isOfferPersonalized,
                            obfuscatedAccountId = params.obfuscatedAccountId,
                            obfuscatedProfileId = params.obfuscatedProfileId,
                            purchaseToken = params.purchaseToken,
                            replacementMode = params.replacementMode,
                            skus = params.skus,
                            subscriptionOffers = params.subscriptionOffers.takeIf { it.isNotEmpty() },
                            subscriptionProductReplacementParams = params.subscriptionProductReplacementParams
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(android = android)
                            ),
                            type = ProductQueryType.Subs
                        )
                    }
                    else -> {
                        val android = RequestPurchaseAndroidProps(
                            isOfferPersonalized = params.isOfferPersonalized,
                            obfuscatedAccountId = params.obfuscatedAccountId,
                            obfuscatedProfileId = params.obfuscatedProfileId,
                            offerToken = params.offerTokenArr.firstOrNull(),
                            skus = params.skus
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(android = android)
                            ),
                            type = ProductQueryType.InApp
                        )
                    }
                }

                val result = store.requestPurchase(requestProps)

                when (result) {
                    is RequestPurchaseResultPurchase -> {
                        result.value?.let { purchase ->
                            JSONObject().apply {
                                put("success", true)
                                put("productId", purchase.productId)
                                put("purchaseToken", purchase.purchaseToken)
                                put("purchaseState", purchase.purchaseState.rawValue)
                            }.toString()
                        } ?: JSONObject().apply {
                            put("success", false)
                            put("userCancelled", true)
                        }.toString()
                    }
                    is RequestPurchaseResultPurchases -> {
                        result.value?.firstOrNull()?.let { purchase ->
                            JSONObject().apply {
                                put("success", true)
                                put("productId", purchase.productId)
                                put("purchaseToken", purchase.purchaseToken)
                                put("purchaseState", purchase.purchaseState.rawValue)
                            }.toString()
                        } ?: JSONObject().apply {
                            put("success", false)
                            put("userCancelled", true)
                        }.toString()
                    }
                    null -> {
                        JSONObject().apply {
                            put("success", false)
                            put("userCancelled", true)
                        }.toString()
                    }
                    else -> {
                        JSONObject().apply {
                            put("success", false)
                            put("error", "Unknown result type")
                        }.toString()
                    }
                }
            } catch (e: OpenIapError.PurchaseCancelled) {
                GodotIapLog.debug("requestPurchase cancelled by user")
                JSONObject().apply {
                    put("success", false)
                    put("userCancelled", true)
                }.toString()
            } catch (e: OpenIapError) {
                GodotIapLog.failure("requestPurchase", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                    put("errorCode", e.code)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("requestPurchase", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun finishTransaction(purchaseJson: String, isConsumable: Boolean): String {
        GodotIapLog.payload("finishTransaction", mapOf("purchaseJson" to purchaseJson, "isConsumable" to isConsumable))

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val json = JSONObject(purchaseJson)
                val productId = json.getString("productId")

                // Get the actual purchase from available purchases
                val purchases = store.getAvailablePurchases(null)
                val purchase = purchases.find { it.productId == productId }

                if (purchase != null) {
                    store.finishTransaction(purchase, isConsumable)
                    GodotIapLog.result("finishTransaction", "success")
                    JSONObject().apply {
                        put("success", true)
                    }.toString()
                } else {
                    GodotIapLog.warning("finishTransaction: Purchase not found")
                    JSONObject().apply {
                        put("success", false)
                        put("error", "Purchase not found")
                    }.toString()
                }
            } catch (e: Exception) {
                GodotIapLog.failure("finishTransaction", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun restorePurchases(): String {
        GodotIapLog.debug("restorePurchases called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                // getAvailablePurchases effectively restores purchases
                val purchases = store.getAvailablePurchases(null)

                // Emit each purchase
                purchases.forEach { purchase ->
                    val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
                    emitSignal("purchase_updated", JSONObject(sanitized).toString())
                }

                GodotIapLog.result("restorePurchases", "count=${purchases.size}")
                JSONObject().apply {
                    put("success", true)
                    put("count", purchases.size)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("restorePurchases", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun getAvailablePurchases(): String {
        GodotIapLog.debug("getAvailablePurchases called")

        if (!isInitialized) {
            return JSONArray().toString()
        }

        return runBlocking {
            try {
                val purchases = store.getAvailablePurchases(null)
                val purchasesArray = JSONArray()

                purchases.forEach { purchase ->
                    val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
                    purchasesArray.put(JSONObject(sanitized))
                }

                GodotIapLog.result("getAvailablePurchases", "count=${purchasesArray.length()}")
                purchasesArray.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("getAvailablePurchases", e)
                JSONArray().toString()
            }
        }
    }

    // ==========================================
    // Subscriptions
    // ==========================================

    @UsedByGodot
    fun getActiveSubscriptions(subscriptionIdsJson: String?): String {
        GodotIapLog.debug("getActiveSubscriptions called")

        if (!isInitialized) {
            return JSONArray().toString()
        }

        return runBlocking {
            try {
                val subscriptionIds = subscriptionIdsJson?.let {
                    val array = JSONArray(it)
                    val list = mutableListOf<String>()
                    for (i in 0 until array.length()) {
                        list.add(array.getString(i))
                    }
                    list.takeIf { ids -> ids.isNotEmpty() }
                }

                val subscriptions = store.getActiveSubscriptions(subscriptionIds)
                val subscriptionsArray = JSONArray()

                subscriptions.forEach { sub ->
                    val sanitized = GodotIapHelper.sanitizeDictionary(sub.toJson())
                    subscriptionsArray.put(JSONObject(sanitized))
                }

                GodotIapLog.result("getActiveSubscriptions", "count=${subscriptionsArray.length()}")
                subscriptionsArray.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("getActiveSubscriptions", e)
                JSONArray().toString()
            }
        }
    }

    @UsedByGodot
    fun hasActiveSubscriptions(subscriptionIdsJson: String?): String {
        GodotIapLog.debug("hasActiveSubscriptions called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("hasActive", false)
            }.toString()
        }

        return runBlocking {
            try {
                val subscriptionIds = subscriptionIdsJson?.let {
                    val array = JSONArray(it)
                    val list = mutableListOf<String>()
                    for (i in 0 until array.length()) {
                        list.add(array.getString(i))
                    }
                    list.takeIf { ids -> ids.isNotEmpty() }
                }

                val hasActive = store.hasActiveSubscriptions(subscriptionIds)

                GodotIapLog.result("hasActiveSubscriptions", hasActive)
                JSONObject().apply {
                    put("success", true)
                    put("hasActive", hasActive)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("hasActiveSubscriptions", e)
                JSONObject().apply {
                    put("success", false)
                    put("hasActive", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    // ==========================================
    // Android Specific - Acknowledge/Consume
    // ==========================================

    @UsedByGodot
    fun acknowledgePurchaseAndroid(purchaseToken: String): String {
        GodotIapLog.debug("acknowledgePurchaseAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                openIap.acknowledgePurchaseAndroid(purchaseToken)
                GodotIapLog.result("acknowledgePurchaseAndroid", "success")
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("acknowledgePurchaseAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun consumePurchaseAndroid(purchaseToken: String): String {
        GodotIapLog.debug("consumePurchaseAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                openIap.consumePurchaseAndroid(purchaseToken)
                GodotIapLog.result("consumePurchaseAndroid", "success")
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("consumePurchaseAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    // ==========================================
    // Android Specific - Alternative Billing
    // ==========================================

    @Suppress("DEPRECATION")
    @UsedByGodot
    fun checkAlternativeBillingAvailabilityAndroid(): String {
        GodotIapLog.debug("checkAlternativeBillingAvailabilityAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("isAvailable", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val isAvailable = openIap.checkAlternativeBillingAvailability()
                GodotIapLog.result("checkAlternativeBillingAvailabilityAndroid", isAvailable)
                JSONObject().apply {
                    put("success", true)
                    put("isAvailable", isAvailable)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("checkAlternativeBillingAvailabilityAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("isAvailable", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @Suppress("DEPRECATION")
    @UsedByGodot
    fun showAlternativeBillingDialogAndroid(): String {
        GodotIapLog.debug("showAlternativeBillingDialogAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        val activity = activity ?: run {
            return JSONObject().apply {
                put("success", false)
                put("error", "Activity not available")
            }.toString()
        }

        return runBlocking {
            try {
                val userAccepted = openIap.showAlternativeBillingInformationDialog(activity)
                GodotIapLog.result("showAlternativeBillingDialogAndroid", userAccepted)
                JSONObject().apply {
                    put("success", true)
                    put("userAccepted", userAccepted)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("showAlternativeBillingDialogAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @Suppress("DEPRECATION")
    @UsedByGodot
    fun createAlternativeBillingTokenAndroid(): String {
        GodotIapLog.debug("createAlternativeBillingTokenAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val token = openIap.createAlternativeBillingReportingToken()
                GodotIapLog.result("createAlternativeBillingTokenAndroid", "token generated")
                JSONObject().apply {
                    put("success", true)
                    put("token", token ?: "")
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("createAlternativeBillingTokenAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun isBillingProgramAvailableAndroid(billingProgram: String): String {
        GodotIapLog.payload("isBillingProgramAvailableAndroid", billingProgram)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("isAvailable", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val program = mapBillingProgram(billingProgram)
                val result = store.isBillingProgramAvailable(program)
                GodotIapLog.result("isBillingProgramAvailableAndroid", result.isAvailable)
                JSONObject().apply {
                    put("success", true)
                    put("isAvailable", result.isAvailable)
                    put("billingProgram", billingProgram)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("isBillingProgramAvailableAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("isAvailable", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun launchExternalLinkAndroid(paramsJson: String): String {
        GodotIapLog.payload("launchExternalLinkAndroid", paramsJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        val activity = activity ?: run {
            return JSONObject().apply {
                put("success", false)
                put("error", "Activity not available")
            }.toString()
        }

        return runBlocking {
            try {
                val json = JSONObject(paramsJson)
                val billingProgram = json.optString("billingProgram", "external-offer")
                val launchMode = json.optString("launchMode", "unspecified")
                val linkType = json.optString("linkType", "unspecified")
                val linkUri = json.getString("linkUri")

                val params = OpenIapLaunchExternalLinkParams(
                    billingProgram = mapBillingProgram(billingProgram),
                    launchMode = mapExternalLinkLaunchMode(launchMode),
                    linkType = mapExternalLinkType(linkType),
                    linkUri = linkUri
                )

                val result = store.launchExternalLink(activity, params)
                GodotIapLog.result("launchExternalLinkAndroid", result)
                JSONObject().apply {
                    put("success", true)
                    put("launched", result)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("launchExternalLinkAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun createBillingProgramReportingDetailsAndroid(billingProgram: String): String {
        GodotIapLog.payload("createBillingProgramReportingDetailsAndroid", billingProgram)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val program = mapBillingProgram(billingProgram)
                val result = store.createBillingProgramReportingDetails(program)
                GodotIapLog.result("createBillingProgramReportingDetailsAndroid", "token generated")
                JSONObject().apply {
                    put("success", true)
                    put("billingProgram", billingProgram)
                    put("externalTransactionToken", result.externalTransactionToken ?: "")
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("createBillingProgramReportingDetailsAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    // ==========================================
    // Storefront & Deep Link
    // ==========================================

    @UsedByGodot
    fun getStorefrontAndroid(): String {
        GodotIapLog.debug("getStorefrontAndroid called")

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val countryCode = openIap.getStorefront()
                GodotIapLog.result("getStorefrontAndroid", countryCode)
                JSONObject().apply {
                    put("success", true)
                    put("countryCode", countryCode ?: "")
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("getStorefrontAndroid", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun deepLinkToSubscriptions(optionsJson: String): String {
        GodotIapLog.payload("deepLinkToSubscriptions", optionsJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val json = if (optionsJson.isNotEmpty()) JSONObject(optionsJson) else null
                val options = json?.let {
                    DeepLinkOptions(
                        skuAndroid = it.optString("skuAndroid").takeIf { s -> s.isNotEmpty() },
                        packageNameAndroid = it.optString("packageNameAndroid").takeIf { s -> s.isNotEmpty() }
                    )
                }

                openIap.deepLinkToSubscriptions(options)
                GodotIapLog.result("deepLinkToSubscriptions", "success")
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("deepLinkToSubscriptions", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    // ==========================================
    // Verification
    // ==========================================

    @UsedByGodot
    fun verifyPurchase(propsJson: String): String {
        GodotIapLog.payload("verifyPurchase", propsJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val json = JSONObject(propsJson)
                val googleJson = json.optJSONObject("google")

                if (googleJson != null) {
                    // Server-side verification with Google options
                    val googleOptions = VerifyPurchaseGoogleOptions(
                        sku = googleJson.getString("sku"),
                        accessToken = googleJson.getString("accessToken"),
                        packageName = googleJson.getString("packageName"),
                        purchaseToken = googleJson.getString("purchaseToken"),
                        isSub = googleJson.optBoolean("isSub", false)
                    )

                    val props = VerifyPurchaseProps(google = googleOptions)
                    val result = openIap.verifyPurchase(props)
                    val resultMap = result.toJson()

                    val response = JSONObject().apply {
                        for ((key, value) in resultMap) {
                            put(key, value)
                        }
                        // Set success after loop to avoid being overwritten by resultMap
                        put("success", true)
                    }.toString()
                    GodotIapLog.result("verifyPurchase", "verified")
                    response
                } else {
                    GodotIapLog.warning("verifyPurchase: Missing google verification options")
                    JSONObject().apply {
                        put("success", false)
                        put("error", "Missing google verification options")
                    }.toString()
                }
            } catch (e: Exception) {
                GodotIapLog.failure("verifyPurchase", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    @UsedByGodot
    fun verifyPurchaseWithProvider(propsJson: String): String {
        GodotIapLog.payload("verifyPurchaseWithProvider", propsJson)

        if (!isInitialized) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Not initialized")
            }.toString()
        }

        return runBlocking {
            try {
                val json = JSONObject(propsJson)

                // Build IAPKit props
                val iapkitProps = RequestVerifyPurchaseWithIapkitProps(
                    apiKey = json.optString("apiKey").takeIf { it.isNotEmpty() },
                    apple = json.optJSONObject("apple")?.let { appleJson ->
                        RequestVerifyPurchaseWithIapkitAppleProps(
                            jws = appleJson.getString("jws")
                        )
                    },
                    google = json.optJSONObject("google")?.let { googleJson ->
                        RequestVerifyPurchaseWithIapkitGoogleProps(
                            purchaseToken = googleJson.getString("purchaseToken")
                        )
                    }
                )

                val providerProps = VerifyPurchaseWithProviderProps(
                    iapkit = iapkitProps,
                    provider = PurchaseVerificationProvider.Iapkit
                )

                val result = openIap.verifyPurchaseWithProvider(providerProps)

                val response = JSONObject().apply {
                    put("success", true)
                    put("provider", result.provider.toJson())
                    result.iapkit?.let { iapkit ->
                        put("isValid", iapkit.isValid)
                        put("state", iapkit.state.toJson())
                        put("store", iapkit.store.toJson())
                    }
                    result.errors?.let { errors ->
                        val errorsArray = JSONArray()
                        errors.forEach { error ->
                            errorsArray.put(JSONObject().apply {
                                put("code", error.code)
                                put("message", error.message)
                            })
                        }
                        put("errors", errorsArray)
                    }
                }.toString()
                GodotIapLog.result("verifyPurchaseWithProvider", "verified")
                response
            } catch (e: Exception) {
                GodotIapLog.failure("verifyPurchaseWithProvider", e)
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message)
                }.toString()
            }
        }
    }

    // ==========================================
    // Utility
    // ==========================================

    @UsedByGodot
    fun getPackageNameAndroid(): String {
        return activity?.packageName ?: ""
    }

    // ==========================================
    // Billing Programs API Helper Functions
    // ==========================================

    private fun mapBillingProgram(program: String): OpenIapBillingProgram =
        when (program) {
            "external-offer" -> OpenIapBillingProgram.ExternalOffer
            "external-content-link" -> OpenIapBillingProgram.ExternalContentLink
            "external-payments" -> OpenIapBillingProgram.ExternalPayments
            "user-choice-billing" -> OpenIapBillingProgram.UserChoiceBilling
            else -> OpenIapBillingProgram.Unspecified
        }

    private fun mapExternalLinkLaunchMode(mode: String): OpenIapExternalLinkLaunchMode =
        when (mode) {
            "launch-in-external-browser-or-app" -> OpenIapExternalLinkLaunchMode.LaunchInExternalBrowserOrApp
            "caller-will-launch-link" -> OpenIapExternalLinkLaunchMode.CallerWillLaunchLink
            else -> OpenIapExternalLinkLaunchMode.Unspecified
        }

    private fun mapExternalLinkType(type: String): OpenIapExternalLinkType =
        when (type) {
            "link-to-digital-content-offer" -> OpenIapExternalLinkType.LinkToDigitalContentOffer
            "link-to-app-download" -> OpenIapExternalLinkType.LinkToAppDownload
            else -> OpenIapExternalLinkType.Unspecified
        }

}
