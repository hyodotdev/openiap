package dev.hyo.openiap.store

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.ProductSubscription
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.PurchaseOptions
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import dev.hyo.openiap.RequestPurchaseResultPurchase
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.RequestPurchaseResult
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.QueryFetchProductsHandler
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import android.app.Activity
import android.content.Context
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
// OpenIapModule is loaded via reflection to support both Play and Horizon flavors
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.utils.toProduct
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * OpenIapStore (Android)
 * Convenience store that wraps an [OpenIapProtocol] implementation (Play Store or Horizon)
 * and exposes suspend APIs with observable StateFlows for UI layers to consume.
 */
class OpenIapStore(private val module: OpenIapProtocol) {
    init {
        android.util.Log.i("OpenIapStore", "Initialized with module: ${module.javaClass.simpleName}")
    }

    constructor(context: Context) : this(buildModule(context, null, null))
    constructor(context: Context, store: String?) : this(buildModule(context, store, null))
    constructor(context: Context, store: String?, appId: String?) : this(buildModule(context, store, appId))

    // Play-specific alternative billing constructors moved to play/store/OpenIapStoreExtensions.kt

    // Public state
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    // Backwards-compat alias for example app
    val connectionStatus: StateFlow<Boolean> get() = isConnected

    private val _products = MutableStateFlow<List<Product>>(emptyList())
    val products: StateFlow<List<Product>> = _products.asStateFlow()

    private val _subscriptions = MutableStateFlow<List<ProductSubscription>>(emptyList())
    val subscriptions: StateFlow<List<ProductSubscription>> = _subscriptions.asStateFlow()

    private val _availablePurchases = MutableStateFlow<List<Purchase>>(emptyList())
    val availablePurchases: StateFlow<List<Purchase>> = _availablePurchases.asStateFlow()

    private val _currentPurchase = MutableStateFlow<Purchase?>(null)
    val currentPurchase: StateFlow<Purchase?> = _currentPurchase.asStateFlow()

    private val _status = MutableStateFlow(IapStatus())
    val status: StateFlow<IapStatus> = _status.asStateFlow()

    // Prevent duplicate finishing/consuming of the same purchase token
    private val processedPurchaseTokens = mutableSetOf<String>()

    // Keep listener references to support proper removal
    private var pendingRequestProductId: String? = null

    private val purchaseUpdateListener = OpenIapPurchaseUpdateListener { purchase ->
        _currentPurchase.value = purchase
        setStatusMessage(
            message = "Purchase successful",
            status = PurchaseResultStatus.Success,
            productId = purchase.productId,
            transactionId = purchase.id
        )
        _status.value = _status.value.copy(lastError = null)
        pendingRequestProductId = null

        // CRITICAL FIX: Refresh available purchases to update UI
        // This ensures the purchase list reflects the new purchase immediately
        kotlinx.coroutines.GlobalScope.launch {
            try {
                android.util.Log.i("OpenIapStore", "Purchase update received, refreshing available purchases")

                // Wait a bit for the purchase to be fully processed by Horizon
                kotlinx.coroutines.delay(500)

                // Ensure connection is ready
                if (!isConnected.value) {
                    android.util.Log.w("OpenIapStore", "Not connected, skipping purchase refresh (connection will be restored on next app start)")
                    // Don't attempt to reconnect here as it may cause issues
                    // The purchase will be available on next app launch
                    return@launch
                }

                android.util.Log.i("OpenIapStore", "About to call module.getAvailablePurchases(null)")
                val result = module.getAvailablePurchases(null)
                android.util.Log.i("OpenIapStore", "module.getAvailablePurchases returned: ${result.size} purchases")
                result.forEachIndexed { index, purchase ->
                    android.util.Log.i("OpenIapStore", "  Purchase[$index]: ${purchase.productId}")
                }
                _availablePurchases.value = result
                android.util.Log.i("OpenIapStore", "Available purchases updated: ${result.size} purchases")
            } catch (e: Exception) {
                android.util.Log.e("OpenIapStore", "Failed to refresh purchases after update", e)
                e.printStackTrace()
            }
        }
    }
    private val purchaseErrorListener = OpenIapPurchaseErrorListener { error ->
        if (error is OpenIapError.UserCancelled || error is OpenIapError.PurchaseCancelled) {
            val code = OpenIapError.toCode(error)
            val message = OpenIapError.defaultMessage(code)
            setStatusMessage(
                message = message,
                status = PurchaseResultStatus.Info,
                productId = pendingRequestProductId,
                code = code
            )
            _status.value = _status.value.copy(lastError = null)
            pendingRequestProductId = null
            return@OpenIapPurchaseErrorListener
        }
        val code = OpenIapError.toCode(error)
        val message = error.message?.takeIf { it.isNotBlank() } ?: OpenIapError.defaultMessage(code)
        setStatusMessage(
            message = message,
            status = PurchaseResultStatus.Error,
            productId = pendingRequestProductId,
            code = code
        )
        _status.value = _status.value.copy(
            lastError = ErrorData(
                code = code,
                message = message
            )
        )
        pendingRequestProductId = null
    }

    /**
     * Set user choice billing listener
     * This listener will be called when user selects alternative billing in user choice mode
     *
     * @param listener User choice billing listener
     */
    fun setUserChoiceBillingListener(listener: dev.hyo.openiap.listener.UserChoiceBillingListener?) {
        module.setUserChoiceBillingListener(listener)
    }

    // Expose a way to set the current Activity for purchase flows
    fun setActivity(activity: Activity?) {
        module.setActivity(activity)
    }

    init {
        module.addPurchaseUpdateListener(purchaseUpdateListener)
        module.addPurchaseErrorListener(purchaseErrorListener)
    }

    /**
     * Clear listeners and transient state. Call when the screen is disposed.
     */
    fun clear() {
        module.removePurchaseUpdateListener(purchaseUpdateListener)
        module.removePurchaseErrorListener(purchaseErrorListener)
        processedPurchaseTokens.clear()
        pendingRequestProductId = null
    }

    // -------------------------------------------------------------------------
    // Connection Management - Using GraphQL handler pattern
    // -------------------------------------------------------------------------

    val initConnection: MutationInitConnectionHandler = { config ->
        setLoading { it.initConnection = true }
        try {
            OpenIapLog.i("OpenIapStore.initConnection: Calling module.initConnection...", "OpenIapStore")
            val ok = module.initConnection(config)
            OpenIapLog.i("OpenIapStore.initConnection: module.initConnection returned: $ok", "OpenIapStore")
            _isConnected.value = ok
            ok
        } catch (e: Exception) {
            OpenIapLog.e("OpenIapStore.initConnection: Exception", e, "OpenIapStore")
            setError(e.message)
            throw e
        } finally {
            setLoading { it.initConnection = false }
        }
    }

    /**
     * Convenience overload that calls initConnection with null config
     */
    suspend fun initConnection(): Boolean {
        OpenIapLog.i("OpenIapStore.initConnection(): Calling initConnection(null)...", "OpenIapStore")
        return initConnection(null)
    }

    val endConnection: MutationEndConnectionHandler = {
        removePurchaseUpdateListener(purchaseUpdateListener)
        removePurchaseErrorListener(purchaseErrorListener)
        try {
            val ok = module.endConnection()
            _isConnected.value = false
            clear()
            ok
        } catch (e: Exception) {
            setError(e.message)
            throw e
        }
    }


    // -------------------------------------------------------------------------
    // Product Management - Using GraphQL handler pattern
    // -------------------------------------------------------------------------
    val fetchProducts: QueryFetchProductsHandler = { request ->
        android.util.Log.i("OpenIapStore", "fetchProducts called with SKUs: ${request.skus}, type: ${request.type}")
        setLoading { it.fetchProducts = true }
        try {
            android.util.Log.i("OpenIapStore", "Calling module.fetchProducts")
            val result = module.fetchProducts(request)
            android.util.Log.i("OpenIapStore", "module.fetchProducts returned: $result")
            when (result) {
                is FetchProductsResultProducts -> {
                    // Merge new products with existing ones
                    val newProducts = result.value.orEmpty()
                    val existingProductIds = _products.value.map { it.id }.toSet()
                    val productsToAdd = newProducts.filter { it.id !in existingProductIds }
                    _products.value = _products.value + productsToAdd
                }
                is FetchProductsResultSubscriptions -> {
                    // Merge new subscriptions with existing ones
                    val subs = result.value.orEmpty()
                    val existingSubIds = _subscriptions.value.map { it.id }.toSet()
                    val subsToAdd = subs.filter { it.id !in existingSubIds }
                    _subscriptions.value = _subscriptions.value + subsToAdd

                    // Also add subscription products to products list
                    val subProducts = subs
                        .filterIsInstance<ProductSubscriptionAndroid>()
                        .map { it.toProduct() }
                    val existingProductIds = _products.value.map { it.id }.toSet()
                    val productsToAdd = subProducts.filter { it.id !in existingProductIds }
                    _products.value = _products.value + productsToAdd
                }
            }
            result
        } catch (e: Exception) {
            setError(e.message)
            throw e
        } finally {
            setLoading { it.fetchProducts = false }
        }
    }


    // -------------------------------------------------------------------------
    // Purchases / Restore - Using GraphQL handler pattern
    // -------------------------------------------------------------------------
    val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { options ->
        android.util.Log.i("OpenIapStore", "getAvailablePurchases called, module type: ${module.javaClass.simpleName}")
        setLoading { it.restorePurchases = true }
        try {
            android.util.Log.i("OpenIapStore", "Calling module.getAvailablePurchases(options)")
            val result = module.getAvailablePurchases(options)
            android.util.Log.i("OpenIapStore", "module.getAvailablePurchases returned ${result.size} purchases")
            _availablePurchases.value = result
            result
        } catch (e: Exception) {
            android.util.Log.e("OpenIapStore", "getAvailablePurchases exception: ${e.message}", e)
            setError(e.message)
            throw e
        } finally {
            setLoading { it.restorePurchases = false }
        }
    }


    // -------------------------------------------------------------------------
    // Purchase Flow - Using GraphQL handler pattern
    // -------------------------------------------------------------------------
    val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val skuForStatus = when (val request = props.request) {
            is RequestPurchaseProps.Request.Purchase -> request.value.android?.skus?.firstOrNull()
            is RequestPurchaseProps.Request.Subscription -> request.value.android?.skus?.firstOrNull()
            else -> null
        }

        if (skuForStatus != null) {
            addPurchasing(skuForStatus)
            pendingRequestProductId = skuForStatus
        }

        try {
            module.mutationHandlers.requestPurchase?.invoke(props)
                ?: throw OpenIapError.NotSupported
        } finally {
            if (skuForStatus != null) removePurchasing(skuForStatus)
        }
    }


    // Using GraphQL handler pattern
    val finishTransaction: MutationFinishTransactionHandler = { purchaseInput, isConsumable ->
        val token = purchaseInput.purchaseToken
        // Check if already processed - but we can't check isAcknowledgedAndroid on PurchaseInput
        if (token == null || !processedPurchaseTokens.contains(token)) {
            try {
                module.mutationHandlers.finishTransaction?.invoke(purchaseInput, isConsumable)
                if (token != null) processedPurchaseTokens.add(token)
            } catch (e: Exception) {
                setError(e.message)
                throw e
            }
        }
    }


    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------
    suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription> =
        module.queryHandlers.getActiveSubscriptions?.invoke(subscriptionIds) ?: emptyList()

    suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean =
        module.queryHandlers.hasActiveSubscriptions?.invoke(subscriptionIds) ?: false

    suspend fun deepLinkToSubscriptions(options: DeepLinkOptions) = module.mutationHandlers.deepLinkToSubscriptions?.invoke(options)

    // -------------------------------------------------------------------------
    // Alternative Billing (Step-by-Step API)
    // -------------------------------------------------------------------------
    /**
     * Step 1: Check if alternative billing is available for this user/device
     * @return true if available, false otherwise
     */
    suspend fun checkAlternativeBillingAvailability(): Boolean = module.checkAlternativeBillingAvailability()

    /**
     * Step 2: Show alternative billing information dialog to user
     * Must be called BEFORE processing payment
     * @param activity Current activity context
     * @return true if user accepted, false if canceled
     */
    suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean =
        module.showAlternativeBillingInformationDialog(activity)

    /**
     * Step 3: Create external transaction token for alternative billing
     * Must be called AFTER successful payment in your payment system
     * Token must be reported to Google Play backend within 24 hours
     * @return External transaction token, or null if failed
     */
    suspend fun createAlternativeBillingReportingToken(): String? =
        module.createAlternativeBillingReportingToken()

    // -------------------------------------------------------------------------
    // Event listeners passthrough
    // -------------------------------------------------------------------------
    fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) = module.addPurchaseUpdateListener(listener)
    fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) = module.removePurchaseUpdateListener(listener)
    fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener) = module.addPurchaseErrorListener(listener)
    fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener) = module.removePurchaseErrorListener(listener)
    fun addUserChoiceBillingListener(listener: dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener) = module.addUserChoiceBillingListener(listener)
    fun removeUserChoiceBillingListener(listener: dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener) = module.removeUserChoiceBillingListener(listener)

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------
    private fun setLoading(block: (LoadingStates) -> Unit) {
        val current = _status.value
        val loading = current.loadings.copy().apply { block(this) }
        _status.value = current.copy(loadings = loading)
    }

    private fun setError(message: String?) {
        val msg = message ?: "Operation failed"
        setStatusMessage(msg, PurchaseResultStatus.Error)
        _status.value = _status.value.copy(lastError = message?.let {
            ErrorData(code = "ERROR", message = it)
        })
    }

    private fun setStatusMessage(
        message: String,
        status: PurchaseResultStatus,
        productId: String? = null,
        transactionId: String? = null,
        code: String? = null
    ) {
        _status.value = _status.value.copy(
            lastPurchaseResult = PurchaseResultData(
                productId = productId,
                transactionId = transactionId,
                message = message,
                status = status,
                code = code
            )
        )
    }

    fun postStatusMessage(
        message: String,
        status: PurchaseResultStatus,
        productId: String? = null
    ) {
        setStatusMessage(message, status, productId)
        _status.value = _status.value.copy(
            lastError = if (status == PurchaseResultStatus.Error) {
                ErrorData(code = "ERROR", message = message)
            } else {
                null
            }
        )
    }

    fun clearStatusMessage() {
        _status.value = _status.value.copy(lastPurchaseResult = null)
    }

    private fun addPurchasing(productId: String) {
        val current = _status.value
        val set = current.loadings.purchasing.toMutableSet()
        set.add(productId)
        _status.value = current.copy(loadings = current.loadings.copy(purchasing = set))
    }

    private fun removePurchasing(productId: String) {
        val current = _status.value
        val set = current.loadings.purchasing.toMutableSet()
        set.remove(productId)
        _status.value = current.copy(loadings = current.loadings.copy(purchasing = set))
    }

}

// -----------------------------------------------------------------------------
// Status types (aligned with openiap-apple)
// -----------------------------------------------------------------------------
data class IapStatus(
    val loadings: LoadingStates = LoadingStates(),
    val lastPurchaseResult: PurchaseResultData? = null,
    val lastError: ErrorData? = null,
    val currentOperation: IapOperation? = null,
    val operationHistory: List<IapOperation> = emptyList()
) {
    fun isPurchasing(productId: String) = loadings.purchasing.contains(productId)
    val isLoading: Boolean
        get() = loadings.initConnection || loadings.fetchProducts || loadings.restorePurchases || loadings.purchasing.isNotEmpty()
}

data class LoadingStates(
    var initConnection: Boolean = false,
    var fetchProducts: Boolean = false,
    var restorePurchases: Boolean = false,
    var purchasing: Set<String> = emptySet()
)

data class PurchaseResultData(
    val productId: String?,
    val transactionId: String?,
    val message: String,
    val status: PurchaseResultStatus = PurchaseResultStatus.Success,
    val code: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

enum class PurchaseResultStatus { Success, Info, Error }

data class ErrorData(
    val code: String,
    val message: String,
    val productId: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

data class IapOperation(
    val type: IapOperationType,
    val productId: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val result: IapOperationResult? = null
)

enum class IapOperationType {
    InitConnection,
    EndConnection,
    FetchProducts,
    RequestPurchase,
    FinishTransaction,
    RestorePurchases,
    ValidateReceipt,
}
sealed class IapOperationResult {
    object Success : IapOperationResult()
    data class Failure(val message: String) : IapOperationResult()
    object Cancelled : IapOperationResult()
}

private fun buildModule(context: Context, store: String?, appId: String?): OpenIapProtocol {
    // Get default store from BuildConfig if available
    val defaultStore = try {
        val buildConfig = Class.forName("io.github.hyochan.openiap.BuildConfig")
        val storeValue = buildConfig.getField("OPENIAP_STORE").get(null) as? String ?: "play"
        android.util.Log.i("OpenIapStore", "BuildConfig.OPENIAP_STORE = $storeValue")
        storeValue
    } catch (e: Throwable) {
        android.util.Log.w("OpenIapStore", "Failed to read BuildConfig.OPENIAP_STORE: ${e.message}")
        "play"
    }

    val selected = (store ?: defaultStore).lowercase()

    // For Horizon flavors, try to get app ID from manifest if not provided
    val resolvedAppId = if ((selected == "horizon" || selected == "meta" || selected == "quest" || selected == "auto") && appId.isNullOrEmpty()) {
        try {
            val applicationInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            val metaAppId = applicationInfo.metaData?.getString("com.meta.horizon.platform.ovr.OCULUS_APP_ID")
            android.util.Log.i("OpenIapStore", "Read OCULUS_APP_ID from manifest: $metaAppId")
            metaAppId ?: ""
        } catch (e: Throwable) {
            android.util.Log.w("OpenIapStore", "Failed to read OCULUS_APP_ID from manifest: ${e.message}")
            ""
        }
    } else {
        appId ?: ""
    }

    android.util.Log.i("OpenIapStore", "buildModule: selected=$selected, appId=$resolvedAppId, defaultStore=$defaultStore")
    OpenIapLog.d("buildModule: selected=$selected, appId=$resolvedAppId, defaultStore=$defaultStore", "OpenIapStore")

    return when (selected) {
        "horizon", "meta", "quest" -> {
            try {
                OpenIapLog.d("Loading OpenIapHorizonModule with appId=$resolvedAppId", "OpenIapStore")
                val clazz = Class.forName("dev.hyo.openiap.horizon.OpenIapHorizonModule")
                val constructor = clazz.getConstructor(Context::class.java, String::class.java)
                val instance = constructor.newInstance(context, resolvedAppId) as OpenIapProtocol
                OpenIapLog.d("Successfully loaded OpenIapHorizonModule", "OpenIapStore")
                instance
            } catch (e: Throwable) {
                // Fallback to Play Store implementation
                OpenIapLog.e("Failed to load OpenIapHorizonModule, falling back to Play", e, "OpenIapStore")
                loadPlayModule(context)
            }
        }
        "auto" -> {
            // Auto-detect environment
            if (isHorizonEnvironment(context)) {
                try {
                    val clazz = Class.forName("dev.hyo.openiap.horizon.OpenIapHorizonModule")
                    val constructor = clazz.getConstructor(Context::class.java, String::class.java)
                    constructor.newInstance(context, resolvedAppId) as OpenIapProtocol
                } catch (e: Throwable) {
                    loadPlayModule(context)
                }
            } else {
                loadPlayModule(context)
            }
        }
        else -> {
            // Default to Play Store (includes "play", "google", "gplay", "googleplay", "gms")
            loadPlayModule(context)
        }
    }
}

private fun isHorizonEnvironment(context: Context): Boolean {
    val manufacturer = android.os.Build.MANUFACTURER.lowercase()
    if (manufacturer.contains("meta") || manufacturer.contains("oculus")) return true
    return try {
        context.packageManager.getPackageInfo("com.oculus.vrshell", 0)
        true
    } catch (_: Throwable) {
        false
    }
}

/**
 * Load OpenIapModule (Play flavor) via reflection
 */
private fun loadPlayModule(context: Context): OpenIapProtocol {
    return try {
        // Try to load OpenIapModule with default parameters (Context, NONE mode, null listener)
        val clazz = Class.forName("dev.hyo.openiap.OpenIapModule")
        val alternativeBillingModeClass = Class.forName("dev.hyo.openiap.AlternativeBillingMode")
        val userChoiceBillingListenerClass = Class.forName("dev.hyo.openiap.listener.UserChoiceBillingListener")

        val constructor = clazz.getConstructor(
            Context::class.java,
            alternativeBillingModeClass,
            userChoiceBillingListenerClass
        )

        // Get NONE enum value
        val noneMode = alternativeBillingModeClass.enumConstants?.first {
            (it as Enum<*>).name == "NONE"
        }

        constructor.newInstance(context, noneMode, null) as OpenIapProtocol
    } catch (e: Throwable) {
        throw IllegalStateException("Failed to load OpenIapModule. Make sure you're using the Play flavor.", e)
    }
}
