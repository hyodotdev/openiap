package dev.hyo.godotiap

import dev.hyo.openiap.*
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.helpers.OpenIapFirstPurchaseNotice
import dev.hyo.openiap.helpers.finishPurchaseToken
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.godotengine.godot.Godot
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.plugin.SignalInfo
import org.godotengine.godot.plugin.UsedByGodot
import org.json.JSONArray
import org.json.JSONObject
import dev.hyo.openiap.BillingProgramAndroid as OpenIapBillingProgram
import dev.hyo.openiap.DeveloperBillingTypeAndroid as OpenIapDeveloperBillingType
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid as OpenIapExternalLinkLaunchMode
import dev.hyo.openiap.ExternalLinkTypeAndroid as OpenIapExternalLinkType
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid as OpenIapLaunchExternalLinkParams

/**
 * GodotIap - Godot plugin for in-app purchases using OpenIAP
 *
 * Provides Google Play Billing integration following the OpenIAP specification.
 */
class GodotIap(godot: Godot) : GodotPlugin(godot) {

    private lateinit var openIap: OpenIapProtocol
    private lateinit var store: OpenIapStore
    private var lastInitError: OpenIapError.ProviderConfiguration? = null
    private val connectionLifecycle = GodotIapConnectionLifecycle()
    private val isInitialized: Boolean
        get() = connectionLifecycle.isConnected
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private fun serializeOpenIapError(error: OpenIapError): Map<String, Any?> =
        error.toJSON().toMutableMap().apply {
            when (error) {
                is OpenIapError.ProductNotFound -> this["productId"] = error.productId
                is OpenIapError.SkuNotFound -> this["productId"] = error.sku
                else -> Unit
            }
        }

    // Listeners
    private val restoreGate = GodotIapRestoreGate()
    private val purchaseUpdateListener = OpenIapPurchaseUpdateListener { purchase ->
        if (!restoreGate.shouldEmit()) return@OpenIapPurchaseUpdateListener
        GodotIapLog.debug("Purchase updated: ${purchase.productId}")
        val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
        emitSignal("purchase_updated", JSONObject(sanitized).toString())
    }

    private val purchaseErrorListener = OpenIapPurchaseErrorListener { error ->
        GodotIapLog.failure("Purchase", Exception(error.message))
        val errorPayload = serializeOpenIapError(error)
        emitSignal("purchase_error", JSONObject(errorPayload).toString())
    }

    private val subscriptionBillingIssueListener = OpenIapSubscriptionBillingIssueListener { purchase ->
        GodotIapLog.debug("subscription billing issue: ${purchase.productId}")
        val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
        emitSignal("subscription_billing_issue", JSONObject(sanitized).toString())
    }

    private val userChoiceBillingListener = OpenIapUserChoiceBillingListener { details ->
        emitSignal("user_choice_billing", JSONObject(details.toJson()).toString())
    }

    private val developerProvidedBillingListener = OpenIapDeveloperProvidedBillingListener { details ->
        emitSignal("developer_provided_billing", JSONObject(details.toJson()).toString())
    }

    // A dropped billing service ends the bridge connection, so initConnection connects again.
    private val connectionStateListener = OpenIapConnectionStateListener {
        pluginScope.launch(Dispatchers.IO) { endConnection() }
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
            SignalInfo("developer_provided_billing", String::class.java),
            SignalInfo("subscription_billing_issue", String::class.java)
        )
    }

    // ==========================================
    // Connection
    // ==========================================

    @UsedByGodot
    fun initConnection(): Boolean = initConnectionInternal(null)

    @UsedByGodot
    fun initConnectionWithConfig(configJson: String): Boolean {
        // A malformed config returns below, so clear before parsing.
        lastInitError = null
        val config = try {
            InitConnectionConfig.fromJson(
                GodotIapHelper.jsonObjectToMap(JSONObject(configJson))
            )
        } catch (e: Exception) {
            GodotIapLog.failure("initConnectionWithConfig", e)
            return false
        }
        return initConnectionInternal(config)
    }

    // Render-thread signals arrive after initConnection returns; the wrapper log reads this.
    @UsedByGodot
    fun getLastInitError(): String = GodotIapHelper.lastInitErrorJson(lastInitError)

    private fun initConnectionInternal(config: InitConnectionConfig?): Boolean {
        GodotIapLog.debug("initConnection called")
        // A stale cause must not leak into the next attempt's log.
        lastInitError = null

        val activity = activity ?: run {
            GodotIapLog.failure("initConnection", Exception("Activity is null"))
            return false
        }

        val normalizedConfig = (config ?: InitConnectionConfig()).toJson()
        val result = try {
            connectionLifecycle.init(
                config = normalizedConfig,
                onConfigMismatch = {
                    purchaseErrorListener.onPurchaseError(
                        OpenIapError.DeveloperError(
                            "Connection is already initialized with different billing configuration. " +
                                "Call endConnection before changing configuration."
                        )
                    )
                },
                connect = {
                    runBlocking {
                        val candidateModule = OpenIapProvider.create(activity)
                        val candidateStore = OpenIapStore(candidateModule)
                        attachListeners(candidateModule, candidateStore)
                        try {
                            val connected = candidateStore.initConnection(config)
                            if (connected) {
                                openIap = candidateModule
                                store = candidateStore
                            } else {
                                runCatching { candidateStore.endConnection() }
                                detachListeners(candidateModule, candidateStore)
                            }
                            connected
                        } catch (error: Exception) {
                            // Preserve listeners until endConnection has had a chance
                            // to publish any pending lifecycle failure.
                            runCatching { candidateStore.endConnection() }
                            detachListeners(candidateModule, candidateStore)
                            throw error
                        }
                    }
                },
            )
        } catch (error: Exception) {
            GodotIapLog.failure("initConnection", error)
            // A missing or incompatible provider is a build mistake, not a store outage.
            (error as? OpenIapError.ProviderConfiguration)?.let {
                lastInitError = it
                purchaseErrorListener.onPurchaseError(it)
            }
            GodotIapConnectionLifecycle.InitResult(false, false)
        }

        if (result.didConnect) emitSignal("connected")
        GodotIapLog.result("initConnection", result.success)
        return result.success
    }

    @UsedByGodot
    fun endConnection(): Boolean {
        GodotIapLog.debug("endConnection called")

        val result = try {
            connectionLifecycle.end(
                disconnect = {
                    runBlocking {
                        runCatching { store.endConnection() }
                            .onFailure { GodotIapLog.failure("endConnection", it) }
                            .getOrDefault(false)
                    }
                },
                cleanupListeners = { detachListeners(openIap, store) },
            )
        } catch (error: Exception) {
            GodotIapLog.failure("endConnection", error)
            GodotIapConnectionLifecycle.EndResult(false, false)
        }

        if (result.didEnd) emitSignal("disconnected")
        GodotIapLog.result("endConnection", result.success)
        return result.success
    }

    private fun attachListeners(module: OpenIapProtocol, targetStore: OpenIapStore): Unit {
        targetStore.addPurchaseUpdateListener(purchaseUpdateListener)
        targetStore.addPurchaseErrorListener(purchaseErrorListener)
        targetStore.addUserChoiceBillingListener(userChoiceBillingListener)
        targetStore.addDeveloperProvidedBillingListener(developerProvidedBillingListener)
        module.addSubscriptionBillingIssueListener(subscriptionBillingIssueListener)
        module.addConnectionStateListener(connectionStateListener)
    }

    private fun detachListeners(module: OpenIapProtocol, targetStore: OpenIapStore): Unit {
        targetStore.removePurchaseUpdateListener(purchaseUpdateListener)
        targetStore.removePurchaseErrorListener(purchaseErrorListener)
        targetStore.removeUserChoiceBillingListener(userChoiceBillingListener)
        targetStore.removeDeveloperProvidedBillingListener(developerProvidedBillingListener)
        module.removeSubscriptionBillingIssueListener(subscriptionBillingIssueListener)
        module.removeConnectionStateListener(connectionStateListener)
    }

    // ==========================================
    // Products
    // ==========================================

    @UsedByGodot
    fun fetchProducts(requestJson: String): String {
        GodotIapLog.payload("fetchProducts", requestJson)

        if (!isInitialized) {
            return notInitializedJson("products" to JSONArray())
        }

        return runBlocking {
            try {
                // Parse request JSON: { "skus": [...], "type": "all" | "in-app" | "subs" }
                val request = JSONObject(requestJson)
                val skusArray = request.optJSONArray("skus") ?: JSONArray()
                val skus = mutableListOf<String>()
                for (i in 0 until skusArray.length()) {
                    skus.add(skusArray.getString(i))
                }

                val queryType = GodotIapHelper.parseProductQueryType(
                    rawType = request.optString("type", ProductQueryType.All.toJson()),
                    defaultType = ProductQueryType.All,
                )

                val result = store.fetchProducts(ProductRequest(skus = skus, type = queryType))
                val productsArray = JSONArray()

                when (result) {
                    is FetchProductsResultProducts -> {
                        result.value?.let { products ->
                            for (product in products) {
                                productsArray.put(JSONObject(product.toJson()))
                            }
                        }
                    }
                    is FetchProductsResultSubscriptions -> {
                        result.value?.let { subscriptions ->
                            for (subscription in subscriptions) {
                                productsArray.put(JSONObject(subscription.toJson()))
                            }
                        }
                    }
                    is FetchProductsResultAll -> {
                        result.value?.let { items ->
                            for (item in items) {
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
                }

                val responseJson = JSONObject().apply {
                    put("products", productsArray)
                }

                GodotIapLog.result("fetchProducts", responseJson.toString())
                emitSignal("products_fetched", responseJson.toString())
                responseJson.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("fetchProducts", e)
                failureJson(e, fields = arrayOf("products" to JSONArray()))
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
            return notInitializedJson()
        }

        val requestProps = try {
            // Parse params using helper (like expo-iap)
            val params = GodotIapHelper.parseRequestPurchaseParams(paramsJson)

            // Determine product type
            val productType = GodotIapHelper.parseProductQueryType(
                rawType = params.type,
                defaultType = ProductQueryType.InApp,
                allowAll = false,
            )

            // Build request props based on product type (exactly like expo-iap)
            when (productType) {
                ProductQueryType.Subs -> {
                    val android = RequestSubscriptionAndroidProps(
                        isOfferPersonalized = params.isOfferPersonalized,
                        obfuscatedAccountId = params.obfuscatedAccountId,
                        obfuscatedProfileId = params.obfuscatedProfileId,
                        developerBillingOption = params.developerBillingOption,
                        originalExternalTransactionId = params.originalExternalTransactionId,
                        purchaseToken = params.purchaseToken,
                        skus = params.skus,
                        subscriptionOffers = params.subscriptionOffers.takeIf { it.isNotEmpty() },
                        subscriptionProductReplacementParams = params.subscriptionProductReplacementParams
                    )
                    RequestPurchaseProps(
                        request = RequestPurchaseProps.Request.Subscription(
                            RequestSubscriptionPropsByPlatforms(google = android)
                        ),
                        type = ProductQueryType.Subs
                    )
                }
                else -> {
                    val android = RequestPurchaseAndroidProps(
                        isOfferPersonalized = params.isOfferPersonalized,
                        obfuscatedAccountId = params.obfuscatedAccountId,
                        obfuscatedProfileId = params.obfuscatedProfileId,
                        developerBillingOption = params.developerBillingOption,
                        offerToken = params.offerToken,
                        skus = params.skus
                    )
                    RequestPurchaseProps(
                        request = RequestPurchaseProps.Request.Purchase(
                            RequestPurchasePropsByPlatforms(google = android)
                        ),
                        type = ProductQueryType.InApp
                    )
                }
            }
        } catch (e: Exception) {
            GodotIapLog.failure("requestPurchase", e)
            return failureJson(e)
        }

        pluginScope.launch {
            try {
                store.requestPurchase(requestProps)
            } catch (e: Exception) {
                // OpenIapModule owns purchase_error publication after dispatch.
                // The bridge only observes the exception so one failed request
                // cannot publish the same terminal error twice.
                GodotIapLog.failure("requestPurchase", e)
            }
        }

        return JSONObject().apply {
            put("success", true)
            put("pending", true)
        }.toString()
    }

    /** Store id of the linked provider, or null when it cannot be read. */
    private fun connectedProviderStoreId(): String? =
        runCatching { activity?.let { OpenIapProvider.factory(it).storeId } }.getOrNull()

    @UsedByGodot
    fun finishTransaction(purchaseJson: String, isConsumable: Boolean): String {
        GodotIapLog.payload("finishTransaction", mapOf("purchaseJson" to purchaseJson, "isConsumable" to isConsumable))

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val requestedPurchase = PurchaseAndroid.fromJson(
                    GodotIapHelper.withProviderStoreIdentity(
                        GodotIapHelper.jsonObjectToMap(JSONObject(purchaseJson)),
                    ) { connectedProviderStoreId() }
                )
                val purchase = if (!requestedPurchase.purchaseToken.isNullOrBlank()) {
                    requestedPurchase
                } else {
                    val requestedIds = setOfNotNull(
                        requestedPurchase.transactionId?.takeIf { it.isNotBlank() },
                        requestedPurchase.id.takeIf { it.isNotBlank() },
                    )
                    require(requestedIds.isNotEmpty()) {
                        "purchaseToken, transactionId, or id is required"
                    }

                    val exactMatches = store.getAvailablePurchases(null).filter { candidate ->
                        candidate.id in requestedIds ||
                            (candidate as? PurchaseAndroid)?.transactionId?.let {
                                it in requestedIds
                            } == true
                    }
                    require(exactMatches.size == 1) {
                        when {
                            exactMatches.isEmpty() -> "Purchase not found for the supplied transaction identity"
                            else -> "Multiple purchases matched the supplied transaction identity"
                        }
                    }
                    exactMatches.single()
                }

                store.finishTransaction(purchase, isConsumable)
                GodotIapLog.result("finishTransaction", "success")
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("finishTransaction", e)
                failureJson(e)
            }
        }
    }

    /** Internal: the once-per-install flag behind godot_iap.gd's first-purchase notice; not app API. */
    @UsedByGodot
    fun claimFirstPurchaseNotice(): Boolean {
        val context = activity ?: return false
        return runCatching { OpenIapFirstPurchaseNotice.claim(context) }.getOrDefault(false)
    }

    @UsedByGodot
    fun restorePurchases(): String {
        GodotIapLog.debug("restorePurchases called")

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            runSilentRestore(
                gate = restoreGate,
                suppressListener = shouldSuppressRestoreListeners(connectedProviderStoreId()),
                restore = { store.restorePurchases() },
                countAvailable = { store.getAvailablePurchases(null).size },
            )
        }
    }

    /**
     * Structured variant used by the GDScript wrapper to distinguish an
     * authoritative empty purchase list from a store or bridge failure.
     */
    @UsedByGodot
    fun getAvailablePurchasesResult(): String = getAvailablePurchasesResultInternal(null)

    @UsedByGodot
    fun getAvailablePurchasesResultWithOptions(optionsJson: String): String {
        val options = try {
            PurchaseOptions.fromJson(
                GodotIapHelper.jsonObjectToMap(JSONObject(optionsJson))
            )
        } catch (error: Exception) {
            GodotIapLog.failure("getAvailablePurchasesResultWithOptions", error)
            return failureJson(ErrorCode.DeveloperError.toJson(), error.message ?: "Invalid purchase options")
        }
        return getAvailablePurchasesResultInternal(options)
    }

    private fun getAvailablePurchasesResultInternal(options: PurchaseOptions?): String {
        GodotIapLog.debug("getAvailablePurchasesResult called")

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val purchasesArray = JSONArray()
                for (purchase in store.getAvailablePurchases(options)) {
                    val sanitized = GodotIapHelper.sanitizeDictionary(purchase.toJson())
                    purchasesArray.put(JSONObject(sanitized))
                }

                GodotIapLog.result(
                    "getAvailablePurchasesResult",
                    "count=${purchasesArray.length()}",
                )
                JSONObject().apply {
                    put("success", true)
                    put("purchases", purchasesArray)
                }.toString()
            } catch (error: Exception) {
                GodotIapLog.failure("getAvailablePurchasesResult", error)
                failureJson(error)
            }
        }
    }

    // ==========================================
    // Subscriptions
    // ==========================================

    /** An empty or missing filter means every subscription. */
    private fun parseSubscriptionIds(subscriptionIdsJson: String?): List<String>? {
        val array = JSONArray(subscriptionIdsJson ?: return null)
        return List(array.length()) { array.getString(it) }.takeIf { it.isNotEmpty() }
    }

    /** Structured entitlement query used by the failure-aware GDScript API. */
    @UsedByGodot
    fun getActiveSubscriptionsResult(subscriptionIdsJson: String?): String {
        GodotIapLog.debug("getActiveSubscriptionsResult called")

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val subscriptionIds = parseSubscriptionIds(subscriptionIdsJson)
                val subscriptionsArray = JSONArray()
                for (subscription in store.getActiveSubscriptions(subscriptionIds)) {
                    val sanitized = GodotIapHelper.sanitizeDictionary(subscription.toJson())
                    subscriptionsArray.put(JSONObject(sanitized))
                }
                JSONObject().apply {
                    put("success", true)
                    put("subscriptions", subscriptionsArray)
                }.toString()
            } catch (error: Exception) {
                GodotIapLog.failure("getActiveSubscriptionsResult", error)
                failureJson(error)
            }
        }
    }

    @UsedByGodot
    fun hasActiveSubscriptions(subscriptionIdsJson: String?): String {
        GodotIapLog.debug("hasActiveSubscriptions called")

        if (!isInitialized) {
            return notInitializedJson("hasActive" to false)
        }

        return runBlocking {
            try {
                val subscriptionIds = parseSubscriptionIds(subscriptionIdsJson)

                val hasActive = store.hasActiveSubscriptions(subscriptionIds)

                GodotIapLog.result("hasActiveSubscriptions", hasActive)
                JSONObject().apply {
                    put("success", true)
                    put("hasActive", hasActive)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("hasActiveSubscriptions", e)
                failureJson(e, fields = arrayOf("hasActive" to false))
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
            return notInitializedJson()
        }

        return finishPurchaseTokenJson(purchaseToken, isConsumable = false)
            .also { GodotIapLog.result("acknowledgePurchaseAndroid", it) }
    }

    @UsedByGodot
    fun consumePurchaseAndroid(purchaseToken: String): String {
        GodotIapLog.debug("consumePurchaseAndroid called")

        if (!isInitialized) {
            return notInitializedJson()
        }

        return finishPurchaseTokenJson(purchaseToken, isConsumable = true)
            .also { GodotIapLog.result("consumePurchaseAndroid", it) }
    }

    private fun finishPurchaseTokenJson(purchaseToken: String, isConsumable: Boolean): String =
        runBlocking {
            try {
                openIap.finishPurchaseToken(purchaseToken, isConsumable)
                JSONObject().put("success", true).toString()
            } catch (e: Exception) {
                failureJson(e)
            }
        }

    @UsedByGodot
    fun isBillingProgramAvailableAndroid(billingProgram: String): String {
        GodotIapLog.payload("isBillingProgramAvailableAndroid", billingProgram)

        if (!isInitialized) {
            return notInitializedJson("isAvailable" to false)
        }

        return runBlocking {
            try {
                val program = mapBillingProgram(billingProgram)
                val result = store.isBillingProgramAvailable(program)
                GodotIapLog.result("isBillingProgramAvailableAndroid", result.isAvailable)
                JSONObject().apply {
                    put("success", true)
                    put("isAvailable", result.isAvailable)
                    put("billingProgram", result.billingProgram.toJson())
                    put("choiceScreenType", result.choiceScreenType?.toJson())
                    put("isExternalLinkAvailable", result.isExternalLinkAvailable)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("isBillingProgramAvailableAndroid", e)
                failureJson(e, fields = arrayOf("isAvailable" to false))
            }
        }
    }

    @UsedByGodot
    fun getBillingChoiceInfoAndroid(paramsJson: String): String {
        GodotIapLog.payload("getBillingChoiceInfoAndroid", paramsJson)

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val json = JSONObject(paramsJson)
                val params = GetBillingChoiceInfoParamsAndroid(
                    billingProgram = mapBillingProgram(json.optString("billingProgram", "billing-choice")),
                    playBillingChoiceImageLayout = BillingChoiceImageLayoutAndroid.fromJson(
                        json.optString("playBillingChoiceImageLayout", "rectangular-four-by-one")
                    ),
                    userLocale = json.optString("userLocale", "").takeIf { it.isNotBlank() }
                )
                val result = store.getBillingChoiceInfo(params)
                GodotIapLog.result("getBillingChoiceInfoAndroid", "image url received")
                JSONObject().apply {
                    put("success", true)
                    put("playBillingChoiceImageUrl", result.playBillingChoiceImageUrl)
                    put("playBillingLoyaltyInfo", result.playBillingLoyaltyInfo)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("getBillingChoiceInfoAndroid", e)
                failureJson(e)
            }
        }
    }

    @UsedByGodot
    fun launchExternalLinkAndroid(paramsJson: String): String {
        GodotIapLog.payload("launchExternalLinkAndroid", paramsJson)

        if (!isInitialized) {
            return notInitializedJson()
        }

        val activity = activity
            ?: return failureJson(OpenIapError.MissingCurrentActivity.CODE, "Activity not available")

        return runBlocking {
            try {
                val json = JSONObject(paramsJson)
                val billingProgram = json.optString("billingProgram", "external-offer")
                val launchMode = json.optString("launchMode", "unspecified")
                val linkType = json.optString("linkType", "unspecified")
                val linkUri = json.getString("linkUri")
                val externalTransactionToken = json.optString("externalTransactionToken", "")
                    .takeIf { it.isNotBlank() }

                val params = OpenIapLaunchExternalLinkParams(
                    billingProgram = mapBillingProgram(billingProgram),
                    externalTransactionToken = externalTransactionToken,
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
                failureJson(e)
            }
        }
    }

    @UsedByGodot
    fun verifyAppOwnership(optionsJson: String): String {
        val requestId = java.util.UUID.randomUUID().toString()
        pluginScope.launch {
            val envelope = JSONObject().put("method", "verifyAppOwnership").put("requestId", requestId)
            try {
                if (!isInitialized) throw OpenIapError.NotPrepared
                val options = VerifyAppOwnershipProps.fromJson(GodotIapHelper.jsonObjectToMap(JSONObject(optionsJson)))
                val result = openIap.verifyAppOwnership(options)
                envelope.put("success", true).put("ownershipJson", JSONObject(result.toJson()).toString())
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                val code = when (error) {
                    is OpenIapError -> error.code
                    is IllegalArgumentException, is org.json.JSONException -> ErrorCode.DeveloperError.toJson()
                    else -> ErrorCode.ServiceError.toJson()
                }
                envelope.put("success", false).put("code", code).put("error", error.message)
            }
            emitSignal("products_fetched", envelope.toString())
        }
        return JSONObject().put("status", "pending").put("requestId", requestId).toString()
    }

    @UsedByGodot
    fun openRedeemOfferCode(): String {
        GodotIapLog.debug("openRedeemOfferCode called")

        val activity = activity
            ?: return failureJson(OpenIapError.MissingCurrentActivity.CODE, "Activity not available")

        return try {
            val provider = if (isInitialized) openIap else OpenIapProvider.create(activity)
            val purchase = runBlocking { dev.hyo.openiap.utils.redeemOfferCode(provider, activity) }
            GodotIapLog.result("openRedeemOfferCode", purchase != null)
            JSONObject().apply {
                put("success", true)
                purchase?.let { put("purchaseJson", JSONObject(it.toJson()).toString()) }
            }.toString()
        } catch (e: Exception) {
            GodotIapLog.failure("openRedeemOfferCode", e)
            failureJson(e)
        }
    }

    @UsedByGodot
    fun createBillingProgramReportingDetailsAndroid(billingProgram: String): String {
        return createBillingProgramReportingDetailsAndroidInternal(billingProgram, null)
    }

    @UsedByGodot
    fun createBillingProgramReportingDetailsAndroidWithType(paramsJson: String): String {
        GodotIapLog.payload("createBillingProgramReportingDetailsAndroidWithType", paramsJson)
        return try {
            val json = JSONObject(paramsJson)
            createBillingProgramReportingDetailsAndroidInternal(
                json.optString("billingProgram", "unspecified"),
                json.optString("developerBillingType", "").takeIf { it.isNotBlank() }
            )
        } catch (e: Exception) {
            failureJson(e)
        }
    }

    private fun createBillingProgramReportingDetailsAndroidInternal(
        billingProgram: String,
        developerBillingType: String?
    ): String {
        GodotIapLog.payload("createBillingProgramReportingDetailsAndroid", billingProgram)

        if (!isInitialized) {
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val program = mapBillingProgram(billingProgram)
                val result = store.createBillingProgramReportingDetails(
                    program,
                    developerBillingType?.let { OpenIapDeveloperBillingType.fromJson(it) }
                )
                GodotIapLog.result("createBillingProgramReportingDetailsAndroid", "token generated")
                JSONObject().apply {
                    put("success", true)
                    put("billingProgram", billingProgram)
                    put("externalTransactionToken", result.externalTransactionToken)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("createBillingProgramReportingDetailsAndroid", e)
                failureJson(e)
            }
        }
    }

    @UsedByGodot
    fun showBillingProgramInformationDialogAndroid(paramsJson: String): String {
        GodotIapLog.payload("showBillingProgramInformationDialogAndroid", paramsJson)

        if (!isInitialized) {
            return notInitializedJson()
        }

        val activity = activity
            ?: return failureJson(OpenIapError.MissingCurrentActivity.CODE, "Activity not available")

        return runBlocking {
            try {
                val json = JSONObject(paramsJson)
                val token = json.optString("externalTransactionToken", "")
                if (token.isBlank()) {
                    return@runBlocking failureJson(
                        ErrorCode.DeveloperError.toJson(),
                        "externalTransactionToken is required",
                    )
                }
                val result = store.showBillingProgramInformationDialog(
                    activity,
                    BillingProgramInformationDialogParamsAndroid(
                        billingProgram = mapBillingProgram(json.optString("billingProgram", "billing-choice")),
                        externalTransactionToken = token
                    )
                )
                JSONObject().apply {
                    put("success", true)
                    put("responseCode", result.responseCode)
                    put("debugMessage", result.debugMessage)
                    put("subResponseCode", result.subResponseCode?.toJson())
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("showBillingProgramInformationDialogAndroid", e)
                failureJson(e)
            }
        }
    }

    @UsedByGodot
    fun showInAppMessagesAndroid(paramsJson: String): String {
        GodotIapLog.payload("showInAppMessagesAndroid", paramsJson)

        if (!isInitialized) {
            return notInitializedJson()
        }

        val activity = activity
            ?: return failureJson(OpenIapError.MissingCurrentActivity.CODE, "Activity not available")

        return runBlocking {
            try {
                val params = validateGodotInAppMessageParams(paramsJson)
                val result = store.showInAppMessages(
                    activity,
                    params
                )
                JSONObject().apply {
                    put("success", true)
                    put("responseCode", result.responseCode.toJson())
                    put("purchaseToken", result.purchaseToken)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("showInAppMessagesAndroid", e)
                failureJson(e)
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
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val countryCode = openIap.getStorefront()
                GodotIapLog.result("getStorefrontAndroid", countryCode)
                JSONObject().apply {
                    put("success", true)
                    put("countryCode", countryCode)
                }.toString()
            } catch (e: Exception) {
                GodotIapLog.failure("getStorefrontAndroid", e)
                failureJson(e)
            }
        }
    }

    @UsedByGodot
    fun deepLinkToSubscriptions(optionsJson: String): String {
        GodotIapLog.payload("deepLinkToSubscriptions", optionsJson)

        if (!isInitialized) {
            return notInitializedJson()
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
                failureJson(e)
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
            return notInitializedJson()
        }

        return runBlocking {
            try {
                val result = openIap.verifyPurchase(GodotIapHelper.parseVerifyPurchaseProps(propsJson))
                GodotIapLog.result("verifyPurchase", "verified")
                JSONObject(result.toJson()).put("success", true).toString()
            } catch (e: Exception) {
                GodotIapLog.failure("verifyPurchase", e)
                failureJson(e, ErrorCode.PurchaseVerificationFailed)
            }
        }
    }

    @UsedByGodot
    fun verifyPurchaseWithProvider(propsJson: String): String {
        GodotIapLog.payload(
            "verifyPurchaseWithProvider",
            mapOf("hasIapkit" to propsJson.contains("\"iapkit\""))
        )

        fun errorResponse(message: String, code: String = ErrorCode.PurchaseVerificationFailed.toJson()): String {
            return JSONObject().apply {
                put("success", false)
                put("provider", PurchaseVerificationProvider.Iapkit.toJson())
                put(
                    "errors",
                    JSONArray().apply {
                        put(JSONObject().apply {
                            put("code", code)
                            put("message", message)
                        })
                    }
                )
            }.toString()
        }

        if (!isInitialized) {
            return errorResponse("Not initialized", ErrorCode.NotPrepared.toJson())
        }

        return runBlocking {
            try {
                val propsMap = GodotIapHelper.jsonObjectToMap(JSONObject(propsJson))
                val providerProps = VerifyPurchaseWithProviderProps.fromJson(propsMap)
                    ?: throw IllegalArgumentException("Invalid verifyPurchaseWithProvider options")

                val result = openIap.verifyPurchaseWithProvider(providerProps)
                val response = JSONObject(GodotIapHelper.sanitizeDictionary(result.toJson()))
                    .apply { put("success", true) }
                    .toString()
                GodotIapLog.result("verifyPurchaseWithProvider", "verified")
                response
            } catch (e: Exception) {
                GodotIapLog.failure("verifyPurchaseWithProvider", e)
                errorResponse(e.message ?: "Verification failed", (e as? OpenIapError)?.code ?: ErrorCode.PurchaseVerificationFailed.toJson())
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
            "billing-choice" -> OpenIapBillingProgram.BillingChoice
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
