package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.*
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import platform.Foundation.*
import cocoapods.openiap.*
import platform.darwin.NSObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
internal class InAppPurchaseIOS : KmpInAppPurchase {
    // OpenIAP module instance - use constructor, not shared()
    private val openIapModule = OpenIapModule()

    // Event flows
    private val _purchaseUpdatedFlow = MutableSharedFlow<Purchase>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedFlow.asSharedFlow()

    override fun purchaseUpdatedListener(options: PurchaseUpdatedListenerOptions?): Flow<Purchase> {
        if (options?.dedupeTransactionIOS != false) {
            return purchaseUpdatedListener
        }

        return callbackFlow {
            val subscription = openIapModule.addPurchaseUpdatedListener(
                { dictionary ->
                    convertAnyToPurchase(dictionary)?.let { trySend(it) }
                },
                false
            )
            awaitClose { openIapModule.removeListener(subscription) }
        }
    }

    private val _purchaseErrorFlow = MutableSharedFlow<PurchaseError>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorFlow.asSharedFlow()

    private val _promotedProductFlow = MutableSharedFlow<String?>(
        replay = 0,
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val promotedProductListener: Flow<String?> = _promotedProductFlow.asSharedFlow()

    // StoreKit 2 Message.billingIssue bridge (iOS 18+).
    // Reference: https://developer.apple.com/documentation/storekit/message/reason/4123328-billingissue
    // Backed by openIapModule.addSubscriptionBillingIssueListener, set up in setupListeners()
    // and removed in endConnection().
    private val _subscriptionBillingIssueFlow = MutableSharedFlow<Purchase>(
        replay = 0,
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val subscriptionBillingIssueListener: Flow<Purchase> = _subscriptionBillingIssueFlow.asSharedFlow()

    private var isConnected = false
    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Listener subscriptions
    private var purchaseSubscription: NSObject? = null
    private var errorSubscription: NSObject? = null
    private var promotedProductSubscription: NSObject? = null
    private var subscriptionBillingIssueSubscription: NSObject? = null

    init {
        // Register listeners
        setupListeners()
    }

    private fun setupListeners() {
        // Idempotent: early-return if listeners already attached (e.g. init{} ran on
        // construction and initConnection() tries to re-register).
        if (purchaseSubscription != null) return

        // Purchase updated listener
        purchaseSubscription = openIapModule.addPurchaseUpdatedListener { dictionary ->
            val purchase = convertAnyToPurchase(dictionary)
            if (purchase != null) {
                coroutineScope.launch {
                    _purchaseUpdatedFlow.emit(purchase)
                }
            }
        }

        // Purchase error listener
        errorSubscription = openIapModule.addPurchaseErrorListener { dictionary ->
            val map = (dictionary as? Map<*, *>)?.mapKeys { it.key.toString() } ?: return@addPurchaseErrorListener
            val codeString = map["code"] as? String ?: "unknown"
            val errorCode = ErrorCode.entries.find { it.rawValue == codeString } ?: ErrorCode.Unknown
            val error = PurchaseError(
                code = errorCode,
                message = map["message"] as? String ?: "",
                productId = map["productId"] as? String
            )
            coroutineScope.launch {
                _purchaseErrorFlow.emit(error)
            }
        }

        // Promoted product listener
        promotedProductSubscription = openIapModule.addPromotedProductListener { sku ->
            coroutineScope.launch {
                _promotedProductFlow.emit(sku)
            }
        }

        // Subscription billing-issue listener (iOS 18+ Message.billingIssue via OpenIapModule)
        subscriptionBillingIssueSubscription = openIapModule.addSubscriptionBillingIssueListener { dictionary ->
            val purchase = convertAnyToPurchase(dictionary)
            if (purchase != null) {
                coroutineScope.launch {
                    _subscriptionBillingIssueFlow.emit(purchase)
                }
            }
        }
    }

    override fun getVersion(): String = kmpIapVersionString("iOS")

    override fun getStore(): Store = Store.APP_STORE

    override suspend fun canMakePayments(): Boolean {
        // OpenIAP will check this during initConnection
        return isConnected
    }

    // -------------------------------------------------------------------------
    // MutationResolver Implementation
    // -------------------------------------------------------------------------

    /**
     * Initialize the store connection. Must be called before any other IAP API.
     *
     * @param config Optional [InitConnectionConfig]. Use `enableBillingProgramAndroid`
     *   (Android, Play Billing 8.2.0+) to opt into External Payments etc.; iOS ignores
     *   Android-specific fields.
     * @return `true` once the platform billing client is connected.
     * @throws PurchaseException when the billing client fails to initialize.
     *
     * @see <a href="https://openiap.dev/docs/apis/init-connection">init-connection</a>
     */
    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = suspendCoroutine { continuation ->
        // iOS doesn't use alternative billing config, it's Android only
        openIapModule.initConnectionWithCompletion { success, error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else {
                isConnected = success
                // Re-register listeners after endConnection()/initConnection() cycles.
                // init{} runs only on first construction; without this, flows stop
                // emitting after a disconnect + reconnect.
                if (success) {
                    setupListeners()
                }
                continuation.resume(success)
            }
        }
    }

    /**
     * Close the store connection and release resources.
     *
     * @see <a href="https://openiap.dev/docs/apis/end-connection">https://openiap.dev/docs/apis/end-connection</a>
     */
    override suspend fun endConnection(): Boolean = suspendCoroutine { continuation ->
        // Remove all listeners and null the subscription tokens so initConnection()
        // can freshly re-register without orphaning the previous subscriptions.
        purchaseSubscription?.let { openIapModule.removeListener(it) }
        purchaseSubscription = null
        errorSubscription?.let { openIapModule.removeListener(it) }
        errorSubscription = null
        promotedProductSubscription?.let { openIapModule.removeListener(it) }
        promotedProductSubscription = null
        subscriptionBillingIssueSubscription?.let { openIapModule.removeListener(it) }
        subscriptionBillingIssueSubscription = null

        openIapModule.endConnectionWithCompletion { success, error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else {
                isConnected = false
                continuation.resume(success)
            }
        }
    }

    /**
     * Initiate a purchase or subscription flow. Result is delivered via the
     * purchaseUpdated event flow — NOT the return value.
     *
     * @param params [RequestPurchaseProps]. The OUTER `params` is the props envelope;
     *   the INNER `RequestPurchaseProps.request` field carries the per-platform payload —
     *   set `params.request.apple.sku` (iOS) and/or `params.request.google.skus` (Android).
     *   Subscriptions also need `subscriptionOffers` on Android.
     * @return The dispatched purchase payload (do not rely on this for the outcome).
     * @throws PurchaseException on synchronous rejection (billing not ready, missing offerToken).
     *
     * Warning: Event-based. Collect from `purchaseUpdatedListener` / `purchaseErrorListener`
     * (or the equivalent flows on `KmpIAP`) for the final state.
     *
     * @see <a href="https://openiap.dev/docs/apis/request-purchase">request-purchase</a>
     */
    override suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult? =
        suspendCoroutine { continuation ->
            requireIosSku(params)?.let { message ->
                continuation.resumeWithException(Exception(message))
                return@suspendCoroutine
            }

            openIapModule.requestPurchaseWithPayload(params.toJson().toObjCMap()) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    val purchase = convertAnyToPurchase(result)
                    continuation.resume(purchase?.let { RequestPurchaseResultPurchase(it) })
                } else {
                    continuation.resume(null)
                }
            }
        }

    private fun requireIosSku(params: RequestPurchaseProps): String? {
        val (sku, kind) = when (val request = params.request) {
            is RequestPurchaseProps.Request.Purchase ->
                (request.value.apple?.sku ?: request.value.ios?.sku) to "purchase"
            is RequestPurchaseProps.Request.Subscription ->
                (request.value.apple?.sku ?: request.value.ios?.sku) to "subscription"
        }

        return if (sku.isNullOrBlank()) {
            "SKU is required for iOS $kind"
        } else {
            null
        }
    }

    private fun Map<String, Any?>.toObjCMap(): Map<Any?, Any?> =
        entries.associate { (key, value) -> key to value.toObjCValue() }

    private fun Any?.toObjCValue(): Any = when (val value = this) {
        null -> NSNull()
        is Map<*, *> -> NSMutableDictionary().apply {
            value.forEach { (key, nestedValue) ->
                if (key != null) {
                    setObject(
                        nestedValue.toObjCValue(),
                        NSString.create(string = key.toString())
                    )
                }
            }
        }
        is List<*> -> NSMutableArray().apply {
            value.forEach { addObject(it.toObjCValue()) }
        }
        else -> value
    }

    /**
     * Buy the currently promoted product.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios">https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios</a>
     */
    override suspend fun requestPurchaseOnPromotedProductIOS(): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.requestPurchaseOnPromotedProductIOSWithCompletion { success, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else {
                    continuation.resume(success)
                }
            }
        }

    /**
     * Restore non-consumable and active subscription purchases.
     *
     * @see <a href="https://openiap.dev/docs/apis/restore-purchases">https://openiap.dev/docs/apis/restore-purchases</a>
     */
    override suspend fun restorePurchases(): Unit = suspendCoroutine { continuation ->
        openIapModule.restorePurchasesWithCompletion { error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else {
                continuation.resume(Unit)
            }
        }
    }

    /**
     * Complete a purchase transaction. Call after server-side verification.
     *
     * @param purchase The [Purchase] to finalize.
     * @param isConsumable `true` for consumables (Android consume — token can be re-bought),
     *   `false` for non-consumables and subscriptions (acknowledge only). Default `false`.
     * @throws PurchaseException when the platform finalize call fails.
     *
     * Important: Android auto-refunds purchases NOT acknowledged/consumed within 3 days.
     * iOS unfinished transactions replay on every app launch.
     *
     * @see <a href="https://openiap.dev/docs/apis/finish-transaction">finish-transaction</a>
     */
    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?): Unit =
        suspendCoroutine { continuation ->
            val transactionId = purchase.id
            val productId = purchase.productId

            openIapModule.finishTransactionWithPurchaseId(
                transactionId,
                productId = productId,
                isConsumable = isConsumable ?: false
            ) { error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else {
                    continuation.resume(Unit)
                }
            }
        }

    /**
     * Open the platform's subscription management UI.
     *
     * @see <a href="https://openiap.dev/docs/apis/deep-link-to-subscriptions">https://openiap.dev/docs/apis/deep-link-to-subscriptions</a>
     */
    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?): Unit =
        suspendCoroutine { continuation ->
            openIapModule.deepLinkToSubscriptionsWithCompletion { error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else {
                    continuation.resume(Unit)
                }
            }
        }

    /**
     * Show the App Store offer code redemption sheet.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios">https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios</a>
     */
    override suspend fun presentCodeRedemptionSheetIOS(): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.presentCodeRedemptionSheetIOSWithCompletion { success, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else {
                    continuation.resume(success)
                }
            }
        }

    /**
     * Present the refund request sheet (iOS 15+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/begin-refund-request-ios">https://openiap.dev/docs/apis/ios/begin-refund-request-ios</a>
     */
    override suspend fun beginRefundRequestIOS(sku: String): String? =
        suspendCoroutine { continuation ->
            openIapModule.beginRefundRequestIOSWithSku(sku) { status, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else {
                    continuation.resume(status)
                }
            }
        }

    /**
     * Clear pending transactions in the queue (sandbox helper).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/clear-transaction-ios">https://openiap.dev/docs/apis/ios/clear-transaction-ios</a>
     */
    override suspend fun clearTransactionIOS(): Boolean = suspendCoroutine { continuation ->
        openIapModule.clearTransactionIOSWithCompletion { success, error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else {
                continuation.resume(success)
            }
        }
    }

    /**
     * Present the manage-subscriptions sheet.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios">https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios</a>
     */
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> =
        suspendCoroutine { continuation ->
            openIapModule.showManageSubscriptionsIOSWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    val purchases = convertAnyListToPurchaseIOSList(result)
                    continuation.resume(purchases)
                } else {
                    continuation.resume(emptyList())
                }
            }
        }

    /**
     * Force sync transactions with the App Store.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/sync-ios">https://openiap.dev/docs/apis/ios/sync-ios</a>
     */
    override suspend fun syncIOS(): Boolean = suspendCoroutine { continuation ->
        openIapModule.syncIOSWithCompletion { success, error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else {
                continuation.resume(success)
            }
        }
    }

    /**
     * Deprecated. Use verifyPurchase instead.
     *
     * @see <a href="https://openiap.dev/docs/apis/validate-receipt">https://openiap.dev/docs/apis/validate-receipt</a>
     */
    override suspend fun validateReceipt(options: VerifyPurchaseProps): VerifyPurchaseResult {
        // Call the iOS-specific version and return the result directly
        return validateReceiptIOS(options)
    }

    // -------------------------------------------------------------------------
    // QueryResolver Implementation
    // -------------------------------------------------------------------------

    /**
     * Retrieve products or subscriptions from the store by SKU.
     *
     * @param params [ProductRequest] with `skus` and optional `type`
     *   ([ProductQueryType.InApp], [ProductQueryType.Subs], or [ProductQueryType.All];
     *   defaults to InApp).
     * @return [FetchProductsResult] sealed variant — Products for InApp, Subscriptions
     *   for Subs, mixed for All.
     * @throws PurchaseException on store rejection (unknown SKU, network, not connected).
     *
     * @see <a href="https://openiap.dev/docs/apis/fetch-products">fetch-products</a>
     */
    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        suspendCoroutine { continuation ->
            val skus = params.skus
            val type = params.type?.rawValue

            openIapModule.fetchProductsWithSkus(skus, type = type) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    // Convert [Any] to products or subscriptions based on type
                    when (params.type) {
                        ProductQueryType.Subs -> {
                            val subscriptions = convertAnyListToProductSubscriptions(result)
                            continuation.resume(FetchProductsResultSubscriptions(subscriptions))
                        }
                        ProductQueryType.All -> {
                            val items = convertAnyListToProductOrSubscriptions(result)
                            continuation.resume(FetchProductsResultAll(items))
                        }
                        else -> {
                            val products = convertAnyListToProducts(result)
                            continuation.resume(FetchProductsResultProducts(products))
                        }
                    }
                } else {
                    when (params.type) {
                        ProductQueryType.Subs -> continuation.resume(FetchProductsResultSubscriptions(emptyList()))
                        ProductQueryType.All -> continuation.resume(FetchProductsResultAll(emptyList()))
                        else -> continuation.resume(FetchProductsResultProducts(emptyList()))
                    }
                }
            }
        }

    /**
     * List the user's unfinished purchases — non-consumables, active subscriptions, and
     * any pending transactions not finished previously.
     *
     * @param options Optional [PurchaseOptions]. iOS-only fields
     *   (`alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`) are ignored on Android.
     * @return List of [Purchase] currently held by the platform store.
     * @throws PurchaseException when the platform query fails.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-available-purchases">get-available-purchases</a>
     */
    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        suspendCoroutine { continuation ->
            openIapModule.getAvailablePurchasesWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    val purchases = convertAnyListToPurchases(result)
                    continuation.resume(purchases)
                } else {
                    continuation.resume(emptyList())
                }
            }
        }

    /**
     * Return the user's storefront country code.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-storefront">https://openiap.dev/docs/apis/get-storefront</a>
     */
    override suspend fun getStorefront(): String {
        return getStorefrontIOS()
    }

    /**
     * Deprecated. Use cross-platform getStorefront instead.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-storefront-ios">https://openiap.dev/docs/apis/ios/get-storefront-ios</a>
     */
    override suspend fun getStorefrontIOS(): String = suspendCoroutine { continuation ->
        openIapModule.getStorefrontIOSWithCompletion { result, error ->
            if (error != null) {
                continuation.resume("US") // Default fallback
            } else {
                continuation.resume(result ?: "US")
            }
        }
    }

    /**
     * List unfinished StoreKit transactions.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-pending-transactions-ios">https://openiap.dev/docs/apis/ios/get-pending-transactions-ios</a>
     */
    override suspend fun getPendingTransactionsIOS(): List<PurchaseIOS> =
        suspendCoroutine { continuation ->
            openIapModule.getPendingTransactionsIOSWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    val purchases = convertAnyListToPurchaseIOSList(result)
                    continuation.resume(purchases)
                } else {
                    continuation.resume(emptyList())
                }
            }
        }

    /**
     * List every StoreKit transaction (finished + unfinished).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-all-transactions-ios">https://openiap.dev/docs/apis/ios/get-all-transactions-ios</a>
     */
    override suspend fun getAllTransactionsIOS(): List<PurchaseIOS> =
        suspendCoroutine { continuation ->
            openIapModule.getAllTransactionsIOSWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                } else if (result != null) {
                    val purchases = convertAnyListToPurchaseIOSList(result)
                    continuation.resume(purchases)
                } else {
                    continuation.resume(emptyList())
                }
            }
        }

    /**
     * Get base64 receipt data (legacy validation).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-receipt-data-ios">https://openiap.dev/docs/apis/ios/get-receipt-data-ios</a>
     */
    override suspend fun getReceiptDataIOS(): String? = suspendCoroutine { continuation ->
        openIapModule.getReceiptDataIOSWithCompletion { result, error ->
            if (error != null) {
                continuation.resume(null)
            } else {
                continuation.resume(result)
            }
        }
    }

    /**
     * Read the App Store-promoted product, if any.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-promoted-product-ios">https://openiap.dev/docs/apis/ios/get-promoted-product-ios</a>
     */
    override suspend fun getPromotedProductIOS(): ProductIOS? = suspendCoroutine { continuation ->
        openIapModule.getPromotedProductIOSWithCompletion { result, error ->
            if (error != null) {
                continuation.resumeWithException(Exception(error.localizedDescription))
            } else if (result != null) {
                val product = convertAnyToProductIOS(result)
                continuation.resume(product)
            } else {
                continuation.resume(null)
            }
        }
    }

    /**
     * Get details of all currently active subscriptions.
     *
     * @see <a href="https://openiap.dev/docs/apis/get-active-subscriptions">https://openiap.dev/docs/apis/get-active-subscriptions</a>
     */
    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        suspendCoroutine { continuation ->
            openIapModule.getActiveSubscriptionsWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@getActiveSubscriptionsWithCompletion
                }

                continuation.resume(filterActiveSubscriptions(result, subscriptionIds))
            }
        }

    /**
     * Fetch the app transaction (iOS 16+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-app-transaction-ios">https://openiap.dev/docs/apis/ios/get-app-transaction-ios</a>
     */
    override suspend fun getAppTransactionIOS(): AppTransaction? =
        suspendCoroutine { continuation ->
            // Note: getAppTransactionIOS requires iOS 16.0+
            // The @available annotation on the Swift side handles version checking
            openIapModule.getAppTransactionIOSWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@getAppTransactionIOSWithCompletion
                }

                val map = (result as? Map<*, *>)?.mapKeys { it.key.toString() }
                val appTransaction = map?.let {
                    try {
                        AppTransaction.fromJson(it)
                    } catch (e: Exception) {
                        null
                    }
                }

                continuation.resume(appTransaction)
            }
        }

    /**
     * Get the user's current entitlement for a product.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/current-entitlement-ios">https://openiap.dev/docs/apis/ios/current-entitlement-ios</a>
     */
    override suspend fun currentEntitlementIOS(sku: String): PurchaseIOS? =
        suspendCoroutine { continuation ->
            openIapModule.currentEntitlementIOSWithSku(sku) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@currentEntitlementIOSWithSku
                }

                val purchase = convertAnyToPurchaseIOS(result)
                continuation.resume(purchase)
            }
        }

    /**
     * Return the JWS string for a transaction.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-transaction-jws-ios">https://openiap.dev/docs/apis/ios/get-transaction-jws-ios</a>
     */
    override suspend fun getTransactionJwsIOS(sku: String): String? =
        suspendCoroutine { continuation ->
            openIapModule.getTransactionJwsIOSWithSku(sku) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@getTransactionJwsIOSWithSku
                }

                continuation.resume(result)
            }
        }

    /**
     * Check whether the user has any active subscription.
     *
     * @see <a href="https://openiap.dev/docs/apis/has-active-subscriptions">https://openiap.dev/docs/apis/has-active-subscriptions</a>
     */
    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        suspendCoroutine { continuation ->
            if (subscriptionIds.isNullOrEmpty()) {
                openIapModule.hasActiveSubscriptionsWithCompletion { hasActive, error ->
                    if (error != null) {
                        continuation.resumeWithException(Exception(error.localizedDescription))
                        return@hasActiveSubscriptionsWithCompletion
                    }

                    continuation.resume(hasActive)
                }
                return@suspendCoroutine
            }

            openIapModule.getActiveSubscriptionsWithCompletion { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@getActiveSubscriptionsWithCompletion
                }

                continuation.resume(filterActiveSubscriptions(result, subscriptionIds).isNotEmpty())
            }
        }

    private fun filterActiveSubscriptions(
        result: List<*>?,
        subscriptionIds: List<String>?
    ): List<ActiveSubscription> {
        val subscriptions = result?.mapNotNull { item ->
            val map = (item as? Map<*, *>)?.mapKeys { it.key.toString() } ?: return@mapNotNull null
            try {
                ActiveSubscription.fromJson(map)
            } catch (e: Exception) {
                null
            }
        } ?: emptyList()

        if (subscriptionIds.isNullOrEmpty()) {
            return subscriptions
        }

        val filter = subscriptionIds.toSet()
        return subscriptions.filter { it.productId in filter }
    }

    /**
     * Check intro-offer eligibility for a subscription group.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios">https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios</a>
     */
    override suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.isEligibleForIntroOfferIOSWithGroupID(groupID) { isEligible, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@isEligibleForIntroOfferIOSWithGroupID
                }

                continuation.resume(isEligible)
            }
        }

    /**
     * Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios">https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios</a>
     */
    override suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.isEligibleForExternalPurchaseCustomLinkIOSWithCompletion { isEligible, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@isEligibleForExternalPurchaseCustomLinkIOSWithCompletion
                }

                continuation.resume(isEligible)
            }
        }

    /**
     * Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios">https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios</a>
     */
    override suspend fun showExternalPurchaseCustomLinkNoticeIOS(
        noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
    ): ExternalPurchaseCustomLinkNoticeResultIOS =
        suspendCoroutine { continuation ->
            openIapModule.showExternalPurchaseCustomLinkNoticeIOSWithNoticeType(noticeType.rawValue) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@showExternalPurchaseCustomLinkNoticeIOSWithNoticeType
                }

                if (result == null) {
                    continuation.resume(
                        ExternalPurchaseCustomLinkNoticeResultIOS(
                            continued = false,
                            error = "Null result from OpenIAP"
                        )
                    )
                    return@showExternalPurchaseCustomLinkNoticeIOSWithNoticeType
                }

                val map = (result as? Map<*, *>)?.mapKeys { it.key.toString() } ?: emptyMap()
                val notice = try {
                    ExternalPurchaseCustomLinkNoticeResultIOS.fromJson(map)
                } catch (e: Exception) {
                    ExternalPurchaseCustomLinkNoticeResultIOS(continued = false, error = e.message)
                }
                continuation.resume(notice)
            }
        }

    /**
     * Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios">https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios</a>
     */
    override suspend fun getExternalPurchaseCustomLinkTokenIOS(
        tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
    ): ExternalPurchaseCustomLinkTokenResultIOS =
        suspendCoroutine { continuation ->
            openIapModule.getExternalPurchaseCustomLinkTokenIOSWithTokenType(tokenType.rawValue) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@getExternalPurchaseCustomLinkTokenIOSWithTokenType
                }

                if (result == null) {
                    continuation.resume(
                        ExternalPurchaseCustomLinkTokenResultIOS(
                            token = null,
                            error = "Null result from OpenIAP"
                        )
                    )
                    return@getExternalPurchaseCustomLinkTokenIOSWithTokenType
                }

                val map = (result as? Map<*, *>)?.mapKeys { it.key.toString() } ?: emptyMap()
                val tokenResult = try {
                    ExternalPurchaseCustomLinkTokenResultIOS.fromJson(map)
                } catch (e: Exception) {
                    ExternalPurchaseCustomLinkTokenResultIOS(token = null, error = e.message)
                }
                continuation.resume(tokenResult)
            }
        }

    /**
     * Check whether a transaction's JWS verification passed.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/is-transaction-verified-ios">https://openiap.dev/docs/apis/ios/is-transaction-verified-ios</a>
     */
    override suspend fun isTransactionVerifiedIOS(sku: String): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.isTransactionVerifiedIOSWithSku(sku) { isVerified, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@isTransactionVerifiedIOSWithSku
                }

                continuation.resume(isVerified)
            }
        }

    /**
     * Get the latest verified transaction for a product.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/latest-transaction-ios">https://openiap.dev/docs/apis/ios/latest-transaction-ios</a>
     */
    override suspend fun latestTransactionIOS(sku: String): PurchaseIOS? =
        suspendCoroutine { continuation ->
            openIapModule.latestTransactionIOSWithSku(sku) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@latestTransactionIOSWithSku
                }

                val purchase = convertAnyToPurchaseIOS(result)
                continuation.resume(purchase)
            }
        }

    /**
     * Get subscription status objects from StoreKit 2.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/subscription-status-ios">https://openiap.dev/docs/apis/ios/subscription-status-ios</a>
     */
    override suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS> =
        suspendCoroutine { continuation ->
            openIapModule.subscriptionStatusIOSWithSku(sku) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@subscriptionStatusIOSWithSku
                }

                val statuses = result?.mapNotNull { item ->
                    val map = (item as? Map<*, *>)?.mapKeys { it.key.toString() } ?: return@mapNotNull null
                    try {
                        SubscriptionStatusIOS.fromJson(map)
                    } catch (e: Exception) {
                        null
                    }
                } ?: emptyList()

                continuation.resume(statuses)
            }
        }

    /**
     * Deprecated. Legacy App Store receipt validation.
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/validate-receipt-ios">https://openiap.dev/docs/apis/ios/validate-receipt-ios</a>
     */
    override suspend fun validateReceiptIOS(options: VerifyPurchaseProps): VerifyPurchaseResultIOS {
        val sku = options.apple?.sku?.trim()
        if (sku.isNullOrEmpty()) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Apple SKU is required for iOS receipt validation"
                )
            )
        }

        return suspendCoroutine { continuation ->
            openIapModule.verifyPurchaseWithSku(sku) { result, error ->
                if (error != null) {
                    continuation.resumeWithException(Exception(error.localizedDescription))
                    return@verifyPurchaseWithSku
                }

                val map = (result as? Map<*, *>)?.mapKeys { it.key.toString() }
                if (map == null) {
                    continuation.resumeWithException(
                        PurchaseException(
                            PurchaseError(
                                code = ErrorCode.PurchaseVerificationFailed,
                                message = "Verification returned no payload"
                            )
                        )
                    )
                    return@verifyPurchaseWithSku
                }

                try {
                    continuation.resume(VerifyPurchaseResultIOS.fromJson(map))
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        PurchaseException(
                            PurchaseError(
                                code = ErrorCode.PurchaseVerificationFailed,
                                message = "Failed to parse verification result: ${e.message}"
                            )
                        )
                    )
                }
            }
        }
    }

    /**
     * Verify a purchase against your own backend.
     *
     * @see <a href="https://openiap.dev/docs/features/validation#verify-purchase">https://openiap.dev/docs/features/validation#verify-purchase</a>
     */
    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult {
        // Call the iOS-specific validation method
        return validateReceiptIOS(options)
    }

    /**
     * Verify via a managed provider (currently IAPKit; the PurchaseVerificationProvider enum exposes only Iapkit today).
     *
     * @see <a href="https://openiap.dev/docs/features/validation#verify-purchase-with-provider">https://openiap.dev/docs/features/validation#verify-purchase-with-provider</a>
     */
    override suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult =
        suspendCoroutine { continuation ->
            val provider = options.provider.rawValue
            val apiKey = options.iapkit?.apiKey
            val jws = options.iapkit?.apple?.jws

            openIapModule.verifyPurchaseWithProviderObjCWithProvider(
                provider = provider,
                apiKey = apiKey,
                jws = jws
            ) { result, error ->
                if (error != null) {
                    val nsError = error
                    continuation.resumeWithException(
                        PurchaseException(
                            PurchaseError(
                                code = ErrorCode.PurchaseVerificationFailed,
                                message = nsError.localizedDescription
                            )
                        )
                    )
                    return@verifyPurchaseWithProviderObjCWithProvider
                }

                if (result == null) {
                    continuation.resumeWithException(
                        PurchaseException(
                            PurchaseError(
                                code = ErrorCode.PurchaseVerificationFailed,
                                message = "Verification returned null result"
                            )
                        )
                    )
                    return@verifyPurchaseWithProviderObjCWithProvider
                }

                try {
                    val map = (result as? Map<*, *>)?.mapKeys { it.key.toString() }

                    val iapkitResult = if (map != null) {
                        val isValid = map["isValid"] as? Boolean ?: false
                        val stateString = map["state"] as? String ?: "unknown"
                        val storeString = map["store"] as? String ?: "apple"

                        val state = try {
                            IapkitPurchaseState.fromJson(stateString)
                        } catch (e: IllegalArgumentException) {
                            IapkitPurchaseState.Unknown
                        }

                        val store = try {
                            IapStore.fromJson(storeString)
                        } catch (e: IllegalArgumentException) {
                            IapStore.Apple
                        }

                        RequestVerifyPurchaseWithIapkitResult(
                            isValid = isValid,
                            state = state,
                            store = store
                        )
                    } else null

                    continuation.resume(
                        VerifyPurchaseWithProviderResult(
                            iapkit = iapkitResult,
                            provider = options.provider
                        )
                    )
                } catch (e: Exception) {
                    continuation.resumeWithException(
                        PurchaseException(
                            PurchaseError(
                                code = ErrorCode.PurchaseVerificationFailed,
                                message = "Failed to parse verification result: ${e.message}"
                            )
                        )
                    )
                }
            }
        }

    // -------------------------------------------------------------------------
    // SubscriptionResolver Implementation
    // -------------------------------------------------------------------------

    override suspend fun purchaseUpdated(options: PurchaseUpdatedListenerOptions?): Purchase =
        purchaseUpdatedListener(options).first()

    override suspend fun purchaseError(): PurchaseError {
        throw UnsupportedOperationException("Use purchaseErrorListener Flow instead")
    }

    override suspend fun promotedProductIOS(): String {
        throw UnsupportedOperationException("Use promotedProductListener Flow instead")
    }

    // Cross-platform billing-issue handler — iOS impl backed by StoreKit.Message listener
    // via openIapModule.addSubscriptionBillingIssueListener. Consumers should collect
    // `subscriptionBillingIssueListener` (Flow) rather than invoking this directly.
    // Reference (OpenIAP): https://openiap.dev/docs/events#subscription-billing-issue
    override suspend fun subscriptionBillingIssue(): Purchase = subscriptionBillingIssueListener.first()

    // -------------------------------------------------------------------------
    // Conversion Helpers
    // -------------------------------------------------------------------------

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyToPurchase(data: Any?): Purchase? {
        return convertAnyToPurchaseIOS(data)
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyToPurchaseIOS(data: Any?): PurchaseIOS? {
        if (data == null) return null

        return try {
            // OpenIAP returns NSDictionary which can be cast to Map
            val dict = (data as? Map<*, *>) ?: return null
            val map = dict.mapKeys { it.key.toString() }

            val platform = map["platform"] as? String
            if (platform == "ios" || platform == "iOS") {
                PurchaseIOS(
                    appAccountToken = map["appAccountToken"] as? String,
                    appBundleIdIOS = map["appBundleIdIOS"] as? String,
                    countryCodeIOS = map["countryCodeIOS"] as? String,
                    currencyCodeIOS = map["currencyCodeIOS"] as? String,
                    currencySymbolIOS = map["currencySymbolIOS"] as? String,
                    environmentIOS = map["environmentIOS"] as? String,
                    expirationDateIOS = (map["expirationDateIOS"] as? Number)?.toDouble(),
                    id = map["id"] as? String ?: "",
                    ids = (map["ids"] as? List<*>)?.mapNotNull { it as? String },
                    isAutoRenewing = map["isAutoRenewing"] as? Boolean ?: false,
                    isUpgradedIOS = map["isUpgradedIOS"] as? Boolean,
                    offerIOS = null, // Complex object, handle separately if needed
                    originalTransactionDateIOS = (map["originalTransactionDateIOS"] as? Number)?.toDouble(),
                    originalTransactionIdentifierIOS = map["originalTransactionIdentifierIOS"] as? String,
                    ownershipTypeIOS = map["ownershipTypeIOS"] as? String,
                    platform = IapPlatform.Ios,
                    productId = map["productId"] as? String ?: "",
                    store = IapStore.Apple,
                    purchaseState = (map["purchaseState"] as? String)?.let {
                        PurchaseState.fromJson(it)
                    } ?: PurchaseState.Unknown,
                    purchaseToken = map["purchaseToken"] as? String,
                    quantity = (map["quantity"] as? Number)?.toInt() ?: 1,
                    quantityIOS = (map["quantityIOS"] as? Number)?.toInt(),
                    reasonIOS = map["reasonIOS"] as? String,
                    reasonStringRepresentationIOS = map["reasonStringRepresentationIOS"] as? String,
                    revocationDateIOS = (map["revocationDateIOS"] as? Number)?.toDouble(),
                    revocationReasonIOS = map["revocationReasonIOS"] as? String,
                    storefrontCountryCodeIOS = map["storefrontCountryCodeIOS"] as? String,
                    subscriptionGroupIdIOS = map["subscriptionGroupIdIOS"] as? String,
                    transactionDate = (map["transactionDate"] as? Number)?.toDouble() ?: 0.0,
                    transactionId = map["transactionId"] as? String ?: "",
                    transactionReasonIOS = map["transactionReasonIOS"] as? String,
                    webOrderLineItemIdIOS = map["webOrderLineItemIdIOS"] as? String
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyListToPurchases(data: Any?): List<Purchase> {
        if (data == null) return emptyList()

        return try {
            val list = data as? List<*> ?: return emptyList()
            list.mapNotNull { convertAnyToPurchase(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyListToPurchaseIOSList(data: Any?): List<PurchaseIOS> {
        if (data == null) return emptyList()

        return try {
            val list = data as? List<*> ?: return emptyList()
            list.mapNotNull { item ->
                convertAnyToPurchaseIOS(item)
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyListToProducts(data: Any?): List<Product> {
        if (data == null) {
            return emptyList()
        }

        return try {
            val list = data as? List<*>
            if (list == null) {
                return emptyList()
            }

            list.mapNotNull { item ->
                val dict = (item as? Map<*, *>)
                if (dict == null) {
                    return@mapNotNull null
                }

                val map = dict.mapKeys { it.key.toString() }

                // Parse subscription offers from the data (if product has subscription info)
                val subscriptionOffers = convertAnyListToSubscriptionOffers(
                    map["subscriptionOffers"] ?: map["offers"]
                )

                ProductIOS(
                    currency = map["currency"] as? String ?: "",
                    debugDescription = map["debugDescription"] as? String,
                    description = map["description"] as? String ?: "",
                    displayName = map["displayName"] as? String,
                    displayNameIOS = map["displayNameIOS"] as? String ?: "",
                    displayPrice = map["displayPrice"] as? String ?: "",
                    id = map["id"] as? String ?: "",
                    isFamilyShareableIOS = map["isFamilyShareableIOS"] as? Boolean ?: false,
                    jsonRepresentationIOS = map["jsonRepresentationIOS"] as? String ?: "",
                    platform = IapPlatform.Ios,
                    price = (map["price"] as? Number)?.toDouble(),
                    subscriptionInfoIOS = null, // Complex object, handle separately if needed
                    subscriptionOffers = subscriptionOffers.ifEmpty { null },
                    title = map["title"] as? String ?: "",
                    type = (map["type"] as? String)?.let { ProductType.fromJson(it) }
                        ?: ProductType.InApp,
                    typeIOS = (map["typeIOS"] as? String)?.let {
                        ProductTypeIOS.fromJson(it)
                    } ?: ProductTypeIOS.Consumable
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyListToProductSubscriptions(data: Any?): List<ProductSubscription> {
        if (data == null) return emptyList()

        return try {
            val list = data as? List<*> ?: return emptyList()
            list.mapNotNull { item ->
                val dict = (item as? Map<*, *>) ?: return@mapNotNull null
                val map = dict.mapKeys { it.key.toString() }

                // Parse subscription offers from the data
                val subscriptionOffers = convertAnyListToSubscriptionOffers(
                    map["subscriptionOffers"] ?: map["offers"]
                )

                ProductSubscriptionIOS(
                    currency = map["currency"] as? String ?: "",
                    debugDescription = map["debugDescription"] as? String,
                    description = map["description"] as? String ?: "",
                    discountsIOS = null, // Complex array (deprecated, use subscriptionOffers)
                    displayName = map["displayName"] as? String,
                    displayNameIOS = map["displayNameIOS"] as? String ?: "",
                    displayPrice = map["displayPrice"] as? String ?: "",
                    id = map["id"] as? String ?: "",
                    introductoryPriceAsAmountIOS = map["introductoryPriceAsAmountIOS"] as? String,
                    introductoryPriceIOS = map["introductoryPriceIOS"] as? String,
                    introductoryPriceNumberOfPeriodsIOS = map["introductoryPriceNumberOfPeriodsIOS"] as? String,
                    introductoryPricePaymentModeIOS = PaymentModeIOS.Empty, // Complex enum
                    introductoryPriceSubscriptionPeriodIOS = null, // Complex enum
                    isFamilyShareableIOS = map["isFamilyShareableIOS"] as? Boolean ?: false,
                    jsonRepresentationIOS = map["jsonRepresentationIOS"] as? String ?: "",
                    platform = IapPlatform.Ios,
                    price = (map["price"] as? Number)?.toDouble(),
                    subscriptionInfoIOS = null, // Complex object
                    subscriptionOffers = subscriptionOffers.ifEmpty { null },
                    subscriptionGroupIdIOS = map["subscriptionGroupIdIOS"] as? String,
                    subscriptionPeriodNumberIOS = map["subscriptionPeriodNumberIOS"] as? String,
                    subscriptionPeriodUnitIOS = null, // Complex enum
                    title = map["title"] as? String ?: "",
                    type = ProductType.Subs,
                    typeIOS = ProductTypeIOS.AutoRenewableSubscription
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun convertAnyListToProductOrSubscriptions(data: Any?): List<ProductOrSubscription> {
        if (data == null) return emptyList()

        val list = data as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            runCatching {
                val dict = (item as? Map<*, *>) ?: return@runCatching null
                val map = dict.mapKeys { it.key.toString() }

                // Native iOS may return either generated union JSON or raw StoreKit maps;
                // decode the union first, then recover by product type for legacy payloads.
                runCatching { ProductOrSubscription.fromJson(map) }.getOrElse {
                    val type = map["type"] as? String
                    if (type == ProductType.Subs.rawValue) {
                        convertAnyListToProductSubscriptions(listOf(item)).firstOrNull()?.let {
                            ProductOrSubscription.ProductSubscriptionItem(it)
                        }
                    } else {
                        convertAnyListToProducts(listOf(item)).firstOrNull()?.let {
                            ProductOrSubscription.ProductItem(it)
                        }
                    }
                }
            }.getOrNull()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun convertAnyToProductIOS(data: Any?): ProductIOS? {
        if (data == null) return null

        return try {
            val dict = (data as? Map<*, *>) ?: return null
            val map = dict.mapKeys { it.key.toString() }

            ProductIOS(
                currency = map["currency"] as? String ?: "",
                debugDescription = map["debugDescription"] as? String,
                description = map["description"] as? String ?: "",
                displayName = map["displayName"] as? String,
                displayNameIOS = map["displayNameIOS"] as? String ?: "",
                displayPrice = map["displayPrice"] as? String ?: "",
                id = map["id"] as? String ?: "",
                isFamilyShareableIOS = map["isFamilyShareableIOS"] as? Boolean ?: false,
                jsonRepresentationIOS = map["jsonRepresentationIOS"] as? String ?: "",
                platform = IapPlatform.Ios,
                price = (map["price"] as? Number)?.toDouble(),
                subscriptionInfoIOS = null, // Complex object
                title = map["title"] as? String ?: "",
                type = (map["type"] as? String)?.let { ProductType.fromJson(it) }
                    ?: ProductType.InApp,
                typeIOS = (map["typeIOS"] as? String)?.let {
                    ProductTypeIOS.fromJson(it)
                } ?: ProductTypeIOS.Consumable
            )
        } catch (e: Exception) {
            null
        }
    }

    // -------------------------------------------------------------------------
    // Android-specific stubs (not implemented on iOS)
    // -------------------------------------------------------------------------

    /**
     * Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/acknowledge-purchase-android">https://openiap.dev/docs/apis/android/acknowledge-purchase-android</a>
     */
    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean {
        throw UnsupportedOperationException("Android method not available on iOS")
    }

    /**
     * Consume a consumable purchase so it can be re-bought.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/consume-purchase-android">https://openiap.dev/docs/apis/android/consume-purchase-android</a>
     */
    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean {
        throw UnsupportedOperationException("Android method not available on iOS")
    }

    // -------------------------------------------------------------------------
    // Android Alternative Billing Methods (stubs for iOS)
    // -------------------------------------------------------------------------

    /**
     * Check whether alternative billing is available for the user.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android">https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android</a>
     */
    override suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean {
        return false // Not supported on iOS
    }

    /**
     * Display Google's alternative billing information dialog.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android">https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android</a>
     */
    override suspend fun showAlternativeBillingDialogAndroid(): Boolean {
        throw UnsupportedOperationException("Android alternative billing not available on iOS")
    }

    /**
     * Create a reporting token for an alternative billing flow.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/create-alternative-billing-token-android">https://openiap.dev/docs/apis/android/create-alternative-billing-token-android</a>
     */
    override suspend fun createAlternativeBillingTokenAndroid(): String? {
        return null // Not supported on iOS
    }

    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails {
        throw UnsupportedOperationException("Android user choice billing not available on iOS")
    }

    // -------------------------------------------------------------------------
    // iOS External Purchase Methods
    // -------------------------------------------------------------------------

    /**
     * Present an external purchase link (iOS 16+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios">https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios</a>
     */
    override suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS =
        suspendCoroutine { continuation ->
            openIapModule.presentExternalPurchaseLinkIOSWithUrl(url) { result, error ->
                if (error != null) {
                    continuation.resume(
                        ExternalPurchaseLinkResultIOS(
                            success = false,
                            error = error.localizedDescription
                        )
                    )
                    return@presentExternalPurchaseLinkIOSWithUrl
                }

                val resultDict = (result as? Map<*, *>)?.mapKeys { it.key.toString() } ?: emptyMap()
                continuation.resume(
                    ExternalPurchaseLinkResultIOS(
                        success = resultDict["success"] as? Boolean ?: false,
                        error = resultDict["error"] as? String
                    )
                )
            }
        }

    /**
     * Present the external purchase notice sheet (iOS 17.4+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios">https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios</a>
     */
    override suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS =
        suspendCoroutine { continuation ->
            openIapModule.presentExternalPurchaseNoticeSheetIOSWithCompletion { result, error ->
                if (error != null) {
                    continuation.resume(
                        ExternalPurchaseNoticeResultIOS(
                            result = ExternalPurchaseNoticeAction.Dismissed,
                            error = error.localizedDescription
                        )
                    )
                    return@presentExternalPurchaseNoticeSheetIOSWithCompletion
                }

                val resultDict = (result as? Map<*, *>)?.mapKeys { it.key.toString() } ?: emptyMap()
                val action = when (resultDict["result"] as? String) {
                    "continue" -> ExternalPurchaseNoticeAction.Continue
                    else -> ExternalPurchaseNoticeAction.Dismissed
                }

                continuation.resume(
                    ExternalPurchaseNoticeResultIOS(
                        result = action,
                        error = resultDict["error"] as? String
                    )
                )
            }
        }

    /**
     * Check eligibility for the external purchase notice sheet (iOS 17.4+).
     *
     * @see <a href="https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios">https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios</a>
     */
    override suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean =
        suspendCoroutine { continuation ->
            openIapModule.canPresentExternalPurchaseNoticeIOSWithCompletion { canPresent, error ->
                continuation.resume(error == null && canPresent)
            }
        }

    // Billing Programs API (Android 8.2.0+ only) - iOS stubs
    /**
     * Check whether a billing program is available.
     *
     * @see <a href="https://openiap.dev/docs/apis/android/is-billing-program-available-android">https://openiap.dev/docs/apis/android/is-billing-program-available-android</a>
     */
    override suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid {
        throw UnsupportedOperationException("isBillingProgramAvailableAndroid is only available on Android")
    }

    /**
     * Create the reporting payload Google requires (Play Billing 8.3.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android">https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android</a>
     */
    override suspend fun createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid): BillingProgramReportingDetailsAndroid {
        throw UnsupportedOperationException("createBillingProgramReportingDetailsAndroid is only available on Android")
    }

    /**
     * Launch an external content/offer link (Play Billing 8.2.0+).
     *
     * @see <a href="https://openiap.dev/docs/apis/android/launch-external-link-android">https://openiap.dev/docs/apis/android/launch-external-link-android</a>
     */
    override suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean {
        throw UnsupportedOperationException("launchExternalLinkAndroid is only available on Android")
    }

    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid {
        throw UnsupportedOperationException("developerProvidedBillingAndroid is only available on Android")
    }

    // -------------------------------------------------------------------------
    // iOS Subscription Offer Conversion Helpers
    // -------------------------------------------------------------------------

    /**
     * Convert iOS subscription offer dictionary to SubscriptionOffer.
     * Maps iOS-specific offer details to cross-platform SubscriptionOffer type.
     */
    @Suppress("UNCHECKED_CAST")
    private fun convertAnyToSubscriptionOffer(data: Any?): SubscriptionOffer? {
        if (data == null) return null

        return try {
            val dict = (data as? Map<*, *>) ?: return null
            val map = dict.mapKeys { it.key.toString() }

            // Determine payment mode
            val paymentModeString = map["paymentMode"] as? String
            val paymentMode = when (paymentModeString?.lowercase()) {
                "freetrial", "free_trial", "free-trial" -> PaymentMode.FreeTrial
                "payasyougo", "pay_as_you_go", "pay-as-you-go" -> PaymentMode.PayAsYouGo
                "payupfront", "pay_up_front", "pay-up-front" -> PaymentMode.PayUpFront
                else -> null
            }

            // Determine offer type
            val typeString = map["type"] as? String
            val offerType = when (typeString?.lowercase()) {
                "introductory" -> DiscountOfferType.Introductory
                "promotional" -> DiscountOfferType.Promotional
                else -> DiscountOfferType.Introductory
            }

            // Parse subscription period
            val periodDict = map["period"] as? Map<*, *>
            val period = if (periodDict != null) {
                val periodMap = periodDict.mapKeys { it.key.toString() }
                val value = (periodMap["value"] as? Number)?.toInt() ?: 1
                val unitString = periodMap["unit"] as? String
                val unit = when (unitString?.lowercase()) {
                    "day" -> SubscriptionPeriodUnit.Day
                    "week" -> SubscriptionPeriodUnit.Week
                    "month" -> SubscriptionPeriodUnit.Month
                    "year" -> SubscriptionPeriodUnit.Year
                    else -> SubscriptionPeriodUnit.Month
                }
                SubscriptionPeriod(value = value, unit = unit)
            } else {
                null
            }

            SubscriptionOffer(
                id = map["id"] as? String ?: "",
                displayPrice = map["displayPrice"] as? String ?: "",
                price = (map["price"] as? Number)?.toDouble() ?: 0.0,
                currency = map["currency"] as? String,
                type = offerType,
                paymentMode = paymentMode,
                period = period,
                periodCount = (map["periodCount"] as? Number)?.toInt(),
                numberOfPeriodsIOS = (map["numberOfPeriods"] as? Number)?.toInt()
                    ?: (map["numberOfPeriodsIOS"] as? Number)?.toInt(),
                localizedPriceIOS = map["localizedPrice"] as? String
                    ?: map["localizedPriceIOS"] as? String,
                keyIdentifierIOS = map["keyIdentifier"] as? String
                    ?: map["keyIdentifierIOS"] as? String,
                nonceIOS = map["nonce"] as? String ?: map["nonceIOS"] as? String,
                signatureIOS = map["signature"] as? String ?: map["signatureIOS"] as? String,
                timestampIOS = (map["timestamp"] as? Number)?.toDouble()
                    ?: (map["timestampIOS"] as? Number)?.toDouble()
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Convert a list of iOS subscription offers to SubscriptionOffer list.
     */
    @Suppress("UNCHECKED_CAST")
    private fun convertAnyListToSubscriptionOffers(data: Any?): List<SubscriptionOffer> {
        if (data == null) return emptyList()

        return try {
            val list = data as? List<*> ?: return emptyList()
            list.mapNotNull { convertAnyToSubscriptionOffer(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
