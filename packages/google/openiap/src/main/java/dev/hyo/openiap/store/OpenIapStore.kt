package dev.hyo.openiap.store

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductOrSubscription
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
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.BillingProgramAvailabilityResultAndroid
import dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid
import dev.hyo.openiap.BillingProgramReportingDetailsAndroid
import dev.hyo.openiap.BillingChoiceInfoAndroid
import dev.hyo.openiap.BillingResultAndroid
import dev.hyo.openiap.DeveloperBillingTypeAndroid
import dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid
import dev.hyo.openiap.InAppMessageParamsAndroid
import dev.hyo.openiap.InAppMessageResultAndroid
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
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
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
internal object OpenIapStorePurchaseRequestResolver {
    fun sku(props: RequestPurchaseProps): String? =
        when (val request = props.request) {
            is RequestPurchaseProps.Request.Purchase ->
                request.value.google?.skus?.firstOrNull()
            is RequestPurchaseProps.Request.Subscription ->
                request.value.google?.skus?.firstOrNull()
        }
}

/**
 * OpenIapStore (Android)
 * Convenience store that wraps an [OpenIapProtocol] implementation (Play, Horizon, or Amazon)
 * and exposes suspend APIs with observable StateFlows for UI layers to consume.
 */
class OpenIapStore(private val module: OpenIapProtocol) {
    init {
        OpenIapLog.info("Initialized with module: ${module.javaClass.simpleName}", "OpenIapStore")
    }

    constructor(context: Context) : this(buildModule(context, null, null))
    constructor(context: Context, store: String?) : this(buildModule(context, store, null))
    constructor(context: Context, store: String?, appId: String?) : this(buildModule(context, store, appId))

    // Play-specific alternative billing constructors moved to play/store/OpenIapStoreExtensions.kt

    // Coroutine scope for background operations
    private val storeScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Public state
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
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
        storeScope.launch {
            try {
                OpenIapLog.info("Purchase update received, refreshing available purchases", "OpenIapStore")

                // Wait a bit for the purchase to be fully processed by Horizon
                kotlinx.coroutines.delay(500)

                // Ensure connection is ready
                if (!isConnected.value) {
                    OpenIapLog.warn("Not connected, skipping purchase refresh (connection will be restored on next app start)", "OpenIapStore")
                    // Don't attempt to reconnect here as it may cause issues
                    // The purchase will be available on next app launch
                    return@launch
                }

                OpenIapLog.info("About to call module.getAvailablePurchases(null)", "OpenIapStore")
                val result = module.getAvailablePurchases(null)
                OpenIapLog.info("module.getAvailablePurchases returned: ${result.size} purchases", "OpenIapStore")
                result.forEachIndexed { index, purchase ->
                    OpenIapLog.info("  Purchase[$index]: ${purchase.productId}", "OpenIapStore")
                }
                _availablePurchases.value = result
                OpenIapLog.info("Available purchases updated: ${result.size} purchases", "OpenIapStore")
            } catch (e: Exception) {
                OpenIapLog.error("Failed to refresh purchases after update", e, "OpenIapStore")
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
        storeScope.cancel()
    }

    // -------------------------------------------------------------------------
    // Connection Management - Using GraphQL handler pattern
    // -------------------------------------------------------------------------

    /**
     * Initialize the store connection. Must be called before any other IAP API.
     *
     * @param config Optional [InitConnectionConfig]. Use `enableBillingProgramAndroid` to
     *   opt in to External Payments / similar Play Billing programs. Pass `null` for default.
     * @return `true` once the Play Billing client is connected.
     * @throws OpenIapError.InitConnection when the billing client fails to initialize
     *   (e.g. Play Store missing, version too old).
     *
     * @see <a href="https://openiap.dev/docs/apis/init-connection">init-connection</a>
     */
    val initConnection: MutationInitConnectionHandler = { config ->
        setLoading { it.initConnection = true }
        try {
            OpenIapLog.info("OpenIapStore.initConnection: Calling module.initConnection...", "OpenIapStore")
            val ok = module.initConnection(config)
            OpenIapLog.info("OpenIapStore.initConnection: module.initConnection returned: $ok", "OpenIapStore")
            _isConnected.value = ok
            ok
        } catch (e: Exception) {
            OpenIapLog.error("OpenIapStore.initConnection: Exception", e, "OpenIapStore")
            setError(e.message)
            throw e
        } finally {
            setLoading { it.initConnection = false }
        }
    }

    /**
     * Initialize the store connection. Must be called before any other IAP API.
     *
     * Convenience overload — calls the config-accepting variant with `null`.
     *
     * @return `true` once the Play Billing client is connected.
     * @throws OpenIapError.InitConnection when the billing client fails to initialize
     *   (e.g. Play Store missing, version too old).
     *
     * @see <a href="https://openiap.dev/docs/apis/init-connection">init-connection</a>
     */
    suspend fun initConnection(): Boolean {
        OpenIapLog.info("OpenIapStore.initConnection(): Calling initConnection(null)...", "OpenIapStore")
        return initConnection(null)
    }

    /**
     * Close the store connection and release resources.
     *
     * @see <a href="https://openiap.dev/docs/apis/end-connection">https://openiap.dev/docs/apis/end-connection</a>
     */
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
    /**
     * Retrieve products or subscriptions from Google Play by SKU.
     *
     * @param params [ProductRequest] with `skus` and an optional `type`
     *   ([ProductQueryType.InApp], [ProductQueryType.Subs], or [ProductQueryType.All];
     *   defaults to InApp).
     * @return A [FetchProductsResult] sealed variant — `Products` for InApp,
     *   `Subscriptions` for Subs, mixed list for All.
     * @throws OpenIapError on store rejection (unknown SKU, network failure, not connected).
     *
     * @see <a href="https://openiap.dev/docs/apis/fetch-products">fetch-products</a>
     */
    val fetchProducts: QueryFetchProductsHandler = { request ->
        OpenIapLog.info("fetchProducts called with SKUs: ${request.skus}, type: ${request.type}", "OpenIapStore")
        setLoading { it.fetchProducts = true }
        try {
            OpenIapLog.info("Calling module.fetchProducts", "OpenIapStore")
            val result = module.fetchProducts(request)
            OpenIapLog.info("module.fetchProducts returned: $result", "OpenIapStore")
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
                is FetchProductsResultAll -> {
                    // Handle the all case - merge both products and subscriptions
                    // The result.value is List<ProductOrSubscription>? containing union wrappers
                    val items = result.value ?: emptyList()

                    // Extract Android-specific products and subscriptions from wrapper classes
                    val allProducts = items.mapNotNull {
                        (it as? ProductOrSubscription.ProductItem)?.value?.let { product ->
                            if (product is ProductAndroid) product else null
                        }
                    }
                    val allSubs = items.mapNotNull {
                        (it as? ProductOrSubscription.ProductSubscriptionItem)?.value?.let { subscription ->
                            if (subscription is ProductSubscriptionAndroid) subscription else null
                        }
                    }

                    // Merge products
                    val existingProductIds = _products.value.map { it.id }.toSet()
                    val productsToAdd = allProducts.filter { it.id !in existingProductIds }
                    _products.value = _products.value + productsToAdd

                    // Merge subscriptions
                    val existingSubIds = _subscriptions.value.map { it.id }.toSet()
                    val subsToAdd = allSubs.filter { it.id !in existingSubIds }
                    _subscriptions.value = _subscriptions.value + subsToAdd

                    // Also add subscription products to products list
                    val subProducts = allSubs
                        .filterIsInstance<ProductSubscriptionAndroid>()
                        .map { it.toProduct() }
                    val existingSubProductIds = _products.value.map { it.id }.toSet()
                    val subProductsToAdd = subProducts.filter { it.id !in existingSubProductIds }
                    _products.value = _products.value + subProductsToAdd
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
    /**
     * List the owned/available purchases held by Play Billing — non-consumables,
     * active subscriptions, and any pending transactions returned by
     * `BillingClient.queryPurchasesAsync` for INAPP + SUBS. Use this to restore
     * purchases or to recover anything not finished previously. (iOS uses
     * `Transaction.unfinished` / `Transaction.all` semantics; on Android the
     * concept is "owned by the user", not strictly "unfinished".)
     *
     * @param options Optional [PurchaseOptions]. Most fields are iOS-only and ignored
     *   on Android.
     * @return List of [Purchase] currently owned according to Play Billing.
     * @throws OpenIapError when the Play Billing query fails.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-available-purchases">get-available-purchases</a>
     */
    val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { options ->
        OpenIapLog.info("getAvailablePurchases called, module type: ${module.javaClass.simpleName}", "OpenIapStore")
        setLoading { it.restorePurchases = true }
        try {
            OpenIapLog.info("Calling module.getAvailablePurchases(options)", "OpenIapStore")
            val result = module.getAvailablePurchases(options)
            OpenIapLog.info("module.getAvailablePurchases returned ${result.size} purchases", "OpenIapStore")
            _availablePurchases.value = result
            result
        } catch (e: Exception) {
            OpenIapLog.error("getAvailablePurchases exception: ${e.message}", e, "OpenIapStore")
            setError(e.message)
            throw e
        } finally {
            setLoading { it.restorePurchases = false }
        }
    }


    // -------------------------------------------------------------------------
    // Purchase Flow - Using GraphQL handler pattern
    // -------------------------------------------------------------------------
    /**
     * Initiate a purchase flow. The result is delivered via the purchase update listener,
     * NOT through the return value.
     *
     * @param props [RequestPurchaseProps]. Use `request.google.skus` and pass
     *   `subscriptionOffers = [{sku, offerToken}]` for subscriptions.
     * @return The dispatched purchase payload (do not rely on this for the actual outcome).
     * @throws OpenIapError on synchronous rejection (e.g. billing client not ready,
     *   developer error such as missing offerToken on subs).
     *
     * Warning: Event-based. Collect from `purchaseUpdatedListener` / `purchaseErrorListener`
     * (or `OpenIapStore.currentPurchase` and `OpenIapStore.status.lastError` flows) for the
     * final state — there is no `currentError` field; errors live on `status.lastError`.
     *
     * @see <a href="https://openiap.dev/docs/apis/request-purchase">request-purchase</a>
     */
    val requestPurchase: MutationRequestPurchaseHandler = { props ->
        val skuForStatus = OpenIapStorePurchaseRequestResolver.sku(props)

        if (skuForStatus != null) {
            addPurchasing(skuForStatus)
            pendingRequestProductId = skuForStatus
        }

        try {
            module.mutationHandlers.requestPurchase?.invoke(props)
                ?: throw OpenIapError.FeatureNotSupported()
        } finally {
            if (skuForStatus != null) removePurchasing(skuForStatus)
        }
    }


    /**
     * Complete a purchase transaction. Call after server-side verification.
     *
     * @param purchase The [PurchaseInput] to finalize.
     * @param isConsumable Pass `true` for consumables (consumes the token so the SKU can be
     *   bought again), `false` for non-consumables and subscriptions (acknowledges only).
     * @throws OpenIapError when the Play Billing finalize call fails.
     *
     * Important: Google auto-refunds Android purchases NOT acknowledged/consumed within 3 days.
     *
     * @see <a href="https://openiap.dev/docs/apis/finish-transaction">finish-transaction</a>
     */
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
    /**
     * Get details of all currently active subscriptions.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-active-subscriptions">https://openiap.dev/docs/apis/get-active-subscriptions</a>
     */
    suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription> =
        module.queryHandlers.getActiveSubscriptions?.invoke(subscriptionIds) ?: emptyList()

    /**
     * Check whether the user has any active subscription.
     *
     * @see <a href="https://openiap.dev/docs/apis/has-active-subscriptions">https://openiap.dev/docs/apis/has-active-subscriptions</a>
     */
    suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean =
        module.queryHandlers.hasActiveSubscriptions?.invoke(subscriptionIds) ?: false

    /**
     * Open the platform's subscription management UI.
     *
     * @see <a href="https://openiap.dev/docs/apis/deep-link-to-subscriptions">https://openiap.dev/docs/apis/deep-link-to-subscriptions</a>
     */
    suspend fun deepLinkToSubscriptions(options: DeepLinkOptions) = module.mutationHandlers.deepLinkToSubscriptions?.invoke(options)

    // -------------------------------------------------------------------------
    // Billing Programs (Google Play Billing Library 8.2.0+)
    // -------------------------------------------------------------------------
    /**
     * Check whether a billing program (e.g., External Payments) is available.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/is-billing-program-available-android">https://openiap.dev/docs/apis/android/is-billing-program-available-android</a>
     */
    suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid =
        module.isBillingProgramAvailable(program)

    /**
     * Create the reporting payload Google requires after a Developer-Provided Billing transaction (Play Billing 8.3.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android">https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android</a>
     */
    suspend fun createBillingProgramReportingDetails(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid? = null
    ): BillingProgramReportingDetailsAndroid =
        module.createBillingProgramReportingDetails(program, developerBillingType)

    /**
     * Launch an external content/offer link from inside the Billing Programs flow (Play Billing 8.2.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/launch-external-link-android">https://openiap.dev/docs/apis/android/launch-external-link-android</a>
     */
    suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean =
        module.launchExternalLink(activity, params)

    /**
     * Open the Google Play offer/promo code redemption page (https://play.google.com/redeem)
     * so the user can enter a code. A listener can receive the redeemed purchase while the
     * app has an active billing connection; reconcile available purchases when the app
     * resumes. Does not require the billing client to be initialized.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/open-redeem-offer-code-android">https://openiap.dev/docs/apis/android/open-redeem-offer-code-android</a>
     */
    suspend fun openRedeemOfferCode(activity: Activity): Boolean =
        module.openRedeemOfferCode(activity)

    /**
     * Fetch Billing Choice display assets for developer-rendered choice screens (Play Billing 9.1.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/get-billing-choice-info-android">https://openiap.dev/docs/apis/android/get-billing-choice-info-android</a>
     */
    suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid =
        module.getBillingChoiceInfo(params)

    /**
     * Show the mandatory information dialog before a developer-rendered,
     * in-app Billing Choice screen (Play Billing 9.1.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android">https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android</a>
     */
    suspend fun showBillingProgramInformationDialog(
        activity: Activity,
        params: BillingProgramInformationDialogParamsAndroid
    ): BillingResultAndroid =
        module.showBillingProgramInformationDialog(activity, params)

    /**
     * Show Play billing in-app messages such as payment issues or price-change confirmations.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/show-in-app-messages-android">https://openiap.dev/docs/apis/android/show-in-app-messages-android</a>
     */
    suspend fun showInAppMessages(
        activity: Activity,
        params: InAppMessageParamsAndroid? = null
    ): InAppMessageResultAndroid =
        module.showInAppMessages(activity, params)

    /**
     * Enable a billing program for the next connection (8.2.0+; Billing Choice 9.1.0+).
     * This should be called BEFORE initConnection to configure the BillingClient.
     *
     * @param program The billing program to enable
     */
    fun enableBillingProgram(program: BillingProgramAndroid) {
        // Use reflection to call enableBillingProgram on the module
        // This is needed because the method is only available in the Play flavor
        try {
            val method = module.javaClass.getMethod("enableBillingProgram", BillingProgramAndroid::class.java)
            method.invoke(module, program)
            OpenIapLog.debug("Billing program enabled via store: $program", "OpenIapStore")
        } catch (e: NoSuchMethodException) {
            OpenIapLog.warn("enableBillingProgram not available (Horizon flavor or older library)", "OpenIapStore")
        } catch (e: Exception) {
            OpenIapLog.error("Failed to enable billing program: ${e.message}", e, "OpenIapStore")
        }
    }

    // -------------------------------------------------------------------------
    // Event listeners passthrough
    // -------------------------------------------------------------------------
    fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) = module.addPurchaseUpdateListener(listener)
    fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) = module.removePurchaseUpdateListener(listener)
    fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener) = module.addPurchaseErrorListener(listener)
    fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener) = module.removePurchaseErrorListener(listener)
    fun addUserChoiceBillingListener(listener: dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener) = module.addUserChoiceBillingListener(listener)
    fun removeUserChoiceBillingListener(listener: dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener) = module.removeUserChoiceBillingListener(listener)
    fun addDeveloperProvidedBillingListener(listener: dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener) = module.addDeveloperProvidedBillingListener(listener)
    fun removeDeveloperProvidedBillingListener(listener: dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener) = module.removeDeveloperProvidedBillingListener(listener)
    fun addSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) = module.addSubscriptionBillingIssueListener(listener)
    fun removeSubscriptionBillingIssueListener(listener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener) = module.removeSubscriptionBillingIssueListener(listener)

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
        OpenIapLog.info("BuildConfig.OPENIAP_STORE = $storeValue", "OpenIapStore")
        storeValue
    } catch (e: Throwable) {
        OpenIapLog.warn("Failed to read BuildConfig.OPENIAP_STORE: ${e.message}", "OpenIapStore")
        "play"
    }

    val selected = (store ?: defaultStore).lowercase()

    OpenIapLog.debug("buildModule: selected=$selected, defaultStore=$defaultStore", "OpenIapStore")

    return when (selected) {
        "horizon", "meta", "quest" -> {
            OpenIapLog.debug("Loading OpenIapModule (Horizon flavor)", "OpenIapStore")
            loadHorizonModule(context)
        }
        "amazon", "fireos", "fire" -> {
            OpenIapLog.debug("Loading OpenIapModule (Amazon flavor)", "OpenIapStore")
            loadAmazonModule(context)
        }
        else -> {
            // Default to Play Store (includes "play", "google", "gplay", "googleplay", "gms")
            OpenIapLog.debug("Loading OpenIapModule (Play flavor)", "OpenIapStore")
            loadPlayModule(context)
        }
    }
}

/**
 * Load OpenIapModule (Horizon flavor) via reflection
 * Note: Horizon flavor now uses the same package and class name as Play flavor
 * App ID is read from AndroidManifest.xml by the Horizon module
 */
private fun loadHorizonModule(context: Context): OpenIapProtocol {
    return try {
        // Both Play and Horizon flavors now use the same class name: dev.hyo.openiap.OpenIapModule
        val clazz = Class.forName("dev.hyo.openiap.OpenIapModule")
        val constructor = clazz.getConstructor(Context::class.java)
        val instance = constructor.newInstance(context) as OpenIapProtocol
        OpenIapLog.debug("Successfully loaded OpenIapModule (Horizon flavor)", "OpenIapStore")
        instance
    } catch (e: Throwable) {
        throw IllegalStateException("Failed to load OpenIapModule (Horizon flavor). Make sure you're using the Horizon flavor.", e)
    }
}

/**
 * Load OpenIapModule (Amazon flavor) via reflection
 * Note: Amazon flavor uses the same package and class name as Play flavor
 */
private fun loadAmazonModule(context: Context): OpenIapProtocol {
    return try {
        val clazz = Class.forName("dev.hyo.openiap.OpenIapModule")
        val constructor = clazz.getConstructor(Context::class.java)
        val instance = constructor.newInstance(context) as OpenIapProtocol
        OpenIapLog.debug("Successfully loaded OpenIapModule (Amazon flavor)", "OpenIapStore")
        instance
    } catch (e: Throwable) {
        throw IllegalStateException("Failed to load OpenIapModule (Amazon flavor). Make sure you're using the Amazon flavor.", e)
    }
}

/**
 * Load OpenIapModule (Play flavor) via reflection
 */
private fun loadPlayModule(context: Context): OpenIapProtocol {
    return try {
        val clazz = Class.forName("dev.hyo.openiap.OpenIapModule")
        val constructor = clazz.getConstructor(Context::class.java)
        constructor.newInstance(context) as OpenIapProtocol
    } catch (e: Throwable) {
        throw IllegalStateException("Failed to load OpenIapModule. Make sure you're using the Play flavor.", e)
    }
}
