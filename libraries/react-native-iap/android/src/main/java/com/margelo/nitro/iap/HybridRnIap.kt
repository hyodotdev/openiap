package com.margelo.nitro.iap

import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeepLinkOptions as OpenIapDeepLinkOptions
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.ProductSubscriptionAndroidOfferDetails
import dev.hyo.openiap.ProductCommon
import dev.hyo.openiap.ProductType as OpenIapProductType
import dev.hyo.openiap.Purchase as OpenIapPurchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestPurchaseResultPurchase
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import dev.hyo.openiap.SubResponseCodeAndroid as OpenIapSubResponseCodeAndroid
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid as OpenIapSubscriptionProductReplacementParams
import dev.hyo.openiap.SubscriptionReplacementModeAndroid as OpenIapSubscriptionReplacementMode
import dev.hyo.openiap.VerifyPurchaseGoogleOptions
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseResultAndroid
import dev.hyo.openiap.InitConnectionConfig as OpenIapInitConnectionConfig
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.BillingChoiceImageLayoutAndroid as OpenIapBillingChoiceImageLayout
import dev.hyo.openiap.BillingChoiceScreenTypeAndroid as OpenIapBillingChoiceScreenType
import dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid as OpenIapBillingProgramInformationDialogParams
import dev.hyo.openiap.BillingProgramAndroid as OpenIapBillingProgramAndroid
import dev.hyo.openiap.DeveloperBillingTypeAndroid as OpenIapDeveloperBillingType
import dev.hyo.openiap.DeveloperBillingLaunchModeAndroid as OpenIapDeveloperBillingLaunchMode
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid as OpenIapDeveloperBillingOptionParams
import dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid as OpenIapGetBillingChoiceInfoParams
import dev.hyo.openiap.InAppMessageCategoryAndroid as OpenIapInAppMessageCategory
import dev.hyo.openiap.InAppMessageParamsAndroid as OpenIapInAppMessageParams
import dev.hyo.openiap.InAppMessageResponseCodeAndroid as OpenIapInAppMessageResponseCode
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid as OpenIapLaunchExternalLinkParams
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid as OpenIapExternalLinkLaunchMode
import dev.hyo.openiap.ExternalLinkTypeAndroid as OpenIapExternalLinkType
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.store.OpenIapStore
import java.util.Locale
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Custom exception for OpenIAP errors that only includes the error JSON without stack traces.
 * This ensures clean error messages are passed to JavaScript without Java/Kotlin stack traces.
 */
class OpenIapException(private val errorJson: String, cause: Throwable? = null) : Exception(cause) {
    override val message: String
        get() = errorJson

    override fun toString(): String = errorJson

    override fun fillInStackTrace(): Throwable {
        // Don't fill in stack trace to avoid it being serialized
        return this
    }
}

internal suspend fun endRnConnectionWithCleanup(
    endConnection: suspend () -> Boolean,
    cleanup: () -> Unit,
): Boolean = try {
    endConnection()
} finally {
    cleanup()
}

class HybridRnIap : HybridRnIapSpec() {
    private data class PurchaseUpdatedListenerRegistration(
        val token: Double,
        val listener: (NitroPurchase) -> Unit
    )
    
    // Get ReactApplicationContext lazily from NitroModules
    private val context: ReactApplicationContext by lazy {
        NitroModules.applicationContext as ReactApplicationContext
    }

    // OpenIAP backend + local cache for product types
    private val openIap: OpenIapModule by lazy { OpenIapModule(context) }
    private val productTypeBySku = mutableMapOf<String, String>()

    // Event listeners
    private val purchaseUpdatedListeners = mutableListOf<PurchaseUpdatedListenerRegistration>()
    private var nextPurchaseUpdatedListenerToken = 1.0
    private val purchaseErrorListeners = mutableListOf<(NitroPurchaseResult) -> Unit>()
    private val promotedProductListenersIOS = mutableListOf<(NitroProduct) -> Unit>()
    private val userChoiceBillingListenersAndroid = mutableListOf<(UserChoiceBillingDetails) -> Unit>()
    private val developerProvidedBillingListenersAndroid = mutableListOf<(DeveloperProvidedBillingDetailsAndroid) -> Unit>()
    private val subscriptionBillingIssueListeners = mutableListOf<(NitroPurchase) -> Unit>()
    private var listenersAttached = false
    private var isInitialized = false
    private val connectionLifecycleQueue = ConnectionLifecycleQueue()
    
    // Connection methods
    // Variant wrapper helpers for nitrogen 0.35.0 compatibility
    private fun String?.wrapVariant(): Variant_NullType_String? = this?.let { Variant_NullType_String.Second(it) }
    private fun Double?.wrapVariant(): Variant_NullType_Double? = this?.let { Variant_NullType_Double.Second(it) }
    private fun Boolean?.wrapVariant(): Variant_NullType_Boolean? = this?.let { Variant_NullType_Boolean.Second(it) }
    private fun List<String>?.wrapVariant(): Variant_NullType_Array_String_? =
        this?.let { Variant_NullType_Array_String_.Second(it.toTypedArray()) }
    private fun dev.hyo.openiap.PendingPurchaseUpdateAndroid?.wrapVariant(): Variant_NullType_PendingPurchaseUpdateAndroid? =
        this?.let {
            Variant_NullType_PendingPurchaseUpdateAndroid.Second(
                PendingPurchaseUpdateAndroid(
                    products = it.products.toTypedArray(),
                    purchaseToken = it.purchaseToken
                )
            )
        }
    private fun Variant_NullType_String?.unwrapString(): String? = (this as? Variant_NullType_String.Second)?.value
    private fun Variant_NullType_Double?.unwrapDouble(): Double? = (this as? Variant_NullType_Double.Second)?.value
    private fun Variant_NullType_Boolean?.unwrapBool(): Boolean? = (this as? Variant_NullType_Boolean.Second)?.value

    private suspend fun ensureConnection() {
        initConnection(null as Variant_NullType_InitConnectionConfig?).await()
    }

    override fun initConnection(config: Variant_NullType_InitConnectionConfig?): Promise<Boolean> {
        val configValue = (config as? Variant_NullType_InitConnectionConfig.Second)?.value
        val performInit: suspend () -> Boolean = initOperation@{
            RnIapLog.payload("initConnection", configValue)
            if (isInitialized) return@initOperation true

            // CRITICAL: Set Activity BEFORE calling initConnection
            // Horizon SDK needs Activity to initialize OVRPlatform with proper returnComponent
            // https://github.com/meta-quest/Meta-Spatial-SDK-Samples/issues/82#issuecomment-3452577530
            try {
                withContext(Dispatchers.Main) {
                    runCatching { context.currentActivity }
                        .onSuccess { activity ->
                            if (activity != null) {
                                RnIapLog.debug("Activity available: ${activity.javaClass.name}")
                                openIap.setActivity(activity)
                            } else {
                                RnIapLog.warn("Activity is null during initConnection")
                            }
                        }
                        .onFailure {
                            RnIapLog.warn("Activity not available during initConnection - OpenIAP will use Context")
                        }
                }
            } catch (err: CancellationException) {
                throw err
            } catch (err: Throwable) {
                val error = OpenIapError.InitConnection
                val errorMessage = err.message ?: err.javaClass.name
                RnIapLog.failure("initConnection.setActivity", err)
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = errorMessage,
                        messageOverride = "Failed to set activity: $errorMessage"
                    )
                )
            }

            try {
                if (!listenersAttached) {
                    RnIapLog.payload("listeners.attach", null)
                    openIap.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { p ->
                        runCatching {
                            RnIapLog.result(
                                "purchaseUpdatedListener",
                                mapOf("productId" to p.productId)
                            )
                            sendPurchaseUpdate(convertToNitroPurchase(p))
                        }.onFailure { RnIapLog.failure("purchaseUpdatedListener", it) }
                    })
                    openIap.addPurchaseErrorListener(OpenIapPurchaseErrorListener { e ->
                        val code = OpenIapError.toCode(e)
                        val message = e.message ?: OpenIapError.defaultMessage(code)
                        runCatching {
                            RnIapLog.result(
                                "purchaseErrorListener",
                                mapOf("code" to code, "message" to message)
                            )
                            sendPurchaseError(toErrorResult(e))
                        }.onFailure { RnIapLog.failure("purchaseErrorListener", it) }
                    })
                    openIap.addUserChoiceBillingListener(OpenIapUserChoiceBillingListener { details ->
                        runCatching {
                            RnIapLog.result(
                                "userChoiceBillingListener",
                                mapOf("products" to details.products, "token" to details.externalTransactionToken)
                            )
                            val originalTransactionId = runCatching {
                                details.javaClass
                                    .getMethod("getOriginalExternalTransactionId")
                                    .invoke(details) as? String
                            }.getOrNull()
                            val productDetails = runCatching {
                                (details.javaClass.getMethod("getProductDetailsAndroid").invoke(details) as? List<*>)
                                    ?.mapNotNull { it as? dev.hyo.openiap.DeveloperProvidedBillingProductAndroid }
                            }.getOrNull()
                            val nitroDetails = UserChoiceBillingDetails(
                                externalTransactionToken = details.externalTransactionToken,
                                originalExternalTransactionId = originalTransactionId.wrapVariant(),
                                productDetailsAndroid = productDetails?.map { product ->
                                    DeveloperProvidedBillingProductAndroid(
                                        id = product.id,
                                        offerToken = product.offerToken.wrapVariant(),
                                        type = when (product.type) {
                                            OpenIapProductType.InApp -> ProductType.IN_APP
                                            OpenIapProductType.Subs -> ProductType.SUBS
                                        }
                                    )
                                }?.toTypedArray()?.let {
                                    Variant_NullType_Array_DeveloperProvidedBillingProductAndroid_.Second(it)
                                },
                                products = details.products.toTypedArray()
                            )
                            sendUserChoiceBilling(nitroDetails)
                        }.onFailure { RnIapLog.failure("userChoiceBillingListener", it) }
                    })
                    // Developer Provided Billing listener (External Payments 8.3.0+, Billing Choice 9.1.0+)
                    openIap.addDeveloperProvidedBillingListener(OpenIapDeveloperProvidedBillingListener { details ->
                        runCatching {
                            RnIapLog.result(
                                "developerProvidedBillingListener",
                                mapOf("productCount" to details.products.size)
                            )
                            val nitroDetails = DeveloperProvidedBillingDetailsAndroid(
                                externalTransactionToken = details.externalTransactionToken.wrapVariant(),
                                linkUri = details.linkUri.wrapVariant(),
                                originalExternalTransactionId = details.originalExternalTransactionId.wrapVariant(),
                                products = details.products.map { product ->
                                    DeveloperProvidedBillingProductAndroid(
                                        id = product.id,
                                        offerToken = product.offerToken.wrapVariant(),
                                        type = when (product.type) {
                                            OpenIapProductType.InApp -> ProductType.IN_APP
                                            OpenIapProductType.Subs -> ProductType.SUBS
                                        }
                                    )
                                }.toTypedArray()
                            )
                            sendDeveloperProvidedBilling(nitroDetails)
                        }.onFailure { RnIapLog.failure("developerProvidedBillingListener", it) }
                    })
                    listenersAttached = true
                    RnIapLog.result("listeners.attach", "attached")
                }
            } catch (err: CancellationException) {
                throw err
            } catch (err: Throwable) {
                listenersAttached = false
                val error = OpenIapError.InitConnection
                val errorMessage = err.message ?: err.javaClass.name
                RnIapLog.failure("initConnection.listeners", err)
                val wrapped = OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = errorMessage,
                        messageOverride = "Failed to register billing listeners: $errorMessage"
                    )
                )
                isInitialized = false
                throw wrapped
            }

            try {
                // Convert Nitro config to OpenIAP config
                // Note: enableBillingProgramAndroid is passed to OpenIapInitConnectionConfig
                // which handles enabling the billing program internally
                val openIapConfig = configValue?.let {
                    OpenIapInitConnectionConfig(
                        alternativeBillingModeAndroid = when (it.alternativeBillingModeAndroid) {
                            com.margelo.nitro.iap.AlternativeBillingModeAndroid.USER_CHOICE -> dev.hyo.openiap.AlternativeBillingModeAndroid.UserChoice
                            com.margelo.nitro.iap.AlternativeBillingModeAndroid.ALTERNATIVE_ONLY -> dev.hyo.openiap.AlternativeBillingModeAndroid.AlternativeOnly
                            else -> null
                        },
                        enableBillingProgramAndroid = configValue.enableBillingProgramAndroid?.let { program ->
                            mapBillingProgram(program)
                        },
                        billingChoiceScreenTypeAndroid = configValue.billingChoiceScreenTypeAndroid?.let { type ->
                            mapBillingChoiceScreenTypeToOpenIap(type)
                        }
                    )
                }
                val ok = try {
                    RnIapLog.payload("initConnection.native", openIapConfig)
                    withContext(Dispatchers.Main) {
                        openIap.initConnection(openIapConfig)
                    }
                } catch (err: CancellationException) {
                    throw err
                } catch (err: Throwable) {
                    val error = OpenIapError.InitConnection
                    RnIapLog.failure("initConnection.native", err)
                    throw OpenIapException(
                        toErrorJson(
                            error = error,
                            debugMessage = err.message,
                            messageOverride = err.message
                        )
                    )
                }
                if (!ok) {
                    val error = OpenIapError.InitConnection
                    RnIapLog.failure("initConnection.native", Exception(error.message))
                    throw OpenIapException(
                        toErrorJson(
                            error = error,
                            messageOverride = "Failed to initialize connection"
                        )
                    )
                }
                true
            } catch (e: Exception) {
                RnIapLog.failure("initConnection", e)
                throw e
            }
        }
        val invocation = connectionLifecycleQueue.enqueueInit(
            operation = performInit,
            onCommitted = { value ->
                isInitialized = value
                RnIapLog.result("initConnection", value)
            },
            onFailed = { isInitialized = false }
        )
        return Promise.async {
            invocation.await()
        }
    }
    
    override fun endConnection(): Promise<Boolean> {
        val pendingInitError = OpenIapException(
            toErrorJson(
                error = OpenIapError.ServiceDisconnected(
                    "Connection ended while initialization was in progress"
                )
            )
        )
        val invocation = connectionLifecycleQueue.enqueueEnd(pendingInitError) {
            RnIapLog.payload("endConnection", null)
            val result = endRnConnectionWithCleanup(
                endConnection = { openIap.endConnection() },
                cleanup = {
                    productTypeBySku.clear()
                    isInitialized = false
                    // Native listener sets persist; clear only bridge callbacks.
                    synchronized(purchaseUpdatedListeners) {
                        purchaseUpdatedListeners.clear()
                        nextPurchaseUpdatedListenerToken = 1.0
                    }
                    synchronized(purchaseErrorListeners) { purchaseErrorListeners.clear() }
                    promotedProductListenersIOS.clear()
                    synchronized(userChoiceBillingListenersAndroid) { userChoiceBillingListenersAndroid.clear() }
                    synchronized(developerProvidedBillingListenersAndroid) { developerProvidedBillingListenersAndroid.clear() }
                    clearSubscriptionBillingIssueListeners()
                },
            )
            RnIapLog.result("endConnection", result)
            result
        }
        return Promise.async {
            invocation.await()
        }
    }
    
    // Product methods
    override fun fetchProducts(skus: Array<String>, type: String): Promise<Array<NitroProduct>> {
        return Promise.async {
            RnIapLog.payload(
                "fetchProducts",
                mapOf(
                    "skus" to skus.toList(),
                    "type" to type
                )
            )

            if (skus.isEmpty()) {
                throw OpenIapException(toErrorJson(OpenIapError.EmptySkuList))
            }

            ensureConnection()

            val queryType = parseProductQueryType(type)
            val skusList = skus.toList()

            val products: List<ProductCommon> = try {
                when (queryType) {
                    ProductQueryType.All -> {
                        collectAllQueryProducts(
                            skusList = skusList,
                            fetchKind = { kind ->
                                RnIapLog.payload(
                                    "fetchProducts.native",
                                    mapOf("skus" to skusList, "type" to kind.rawValue)
                                )
                                val fetched = openIap.fetchProducts(ProductRequest(skusList, kind)).productsOrEmpty()
                                RnIapLog.result(
                                    "fetchProducts.native",
                                    fetched.map { mapOf("id" to it.id, "type" to it.type.rawValue) }
                                )
                                fetched
                            },
                            onFailure = { kind, error ->
                                RnIapLog.failure("fetchProducts.native[${kind.rawValue}]", error)
                            },
                        )
                    }
                    else -> {
                        RnIapLog.payload(
                            "fetchProducts.native",
                            mapOf("skus" to skusList, "type" to queryType.rawValue)
                        )
                        val fetched = openIap.fetchProducts(ProductRequest(skusList, queryType)).productsOrEmpty()
                        RnIapLog.result(
                            "fetchProducts.native",
                            fetched.map { mapOf("id" to it.id, "type" to it.type.rawValue) }
                        )

                        // Preserve input order for non-All queries
                        val byId = fetched.associateBy { it.id }
                        skusList.mapNotNull { byId[it] }
                    }
                }
            } catch (e: OpenIapError) {
                throw OpenIapException(toErrorJson(e))
            }

            products.forEach { p -> productTypeBySku[p.id] = p.type.rawValue }

            RnIapLog.result(
                "fetchProducts",
                products.map { mapOf("id" to it.id, "type" to it.type.rawValue) }
            )
            products.map { convertToNitroProduct(it) }.toTypedArray()
        }
    }
    
    // Purchase methods
    // Purchase methods (Unified)
    override fun requestPurchase(request: NitroPurchaseRequest): Promise<RequestPurchaseResult> {
        return Promise.async {
            val defaultResult = RequestPurchaseResult.create(emptyArray<com.margelo.nitro.iap.Purchase>())

            val androidRequest = (request.android as? Variant_NullType_NitroRequestPurchaseAndroid.Second)?.value
                ?: (request.google as? Variant_NullType_NitroRequestPurchaseAndroid.Second)?.value

            RnIapLog.payload(
                "requestPurchase",
                mapOf(
                    "androidSkus" to (androidRequest?.skus?.toList() ?: emptyList()),
                    "hasIOS" to (request.ios != null)
                )
            )

            if (androidRequest == null) {
                RnIapLog.warn("requestPurchase called without android payload")
                sendPurchaseError(toErrorResult(OpenIapError.DeveloperError()))
                return@async defaultResult
            }

            if (androidRequest.skus.isEmpty()) {
                RnIapLog.warn("requestPurchase received empty SKU list")
                sendPurchaseError(toErrorResult(OpenIapError.EmptySkuList))
                return@async defaultResult
            }

            try {
                ensureConnection()

                // Ensure Activity is available for purchase flow
                val activity = withContext(Dispatchers.Main) {
                    runCatching { context.currentActivity }
                        .getOrNull()
                }

                if (activity == null) {
                    RnIapLog.warn("requestPurchase: Activity is null - cannot start purchase flow")
                    sendPurchaseError(toErrorResult(OpenIapError.MissingCurrentActivity))
                    return@async defaultResult
                }

                withContext(Dispatchers.Main) {
                    openIap.setActivity(activity)
                }

                val missingSkus = androidRequest.skus.filterNot { productTypeBySku.containsKey(it) }
                if (missingSkus.isNotEmpty()) {
                    missingSkus.forEach { sku ->
                        RnIapLog.warn("requestPurchase missing cached type for $sku; attempting fetch")
                        val fetched = runCatching {
                            openIap.fetchProducts(
                                ProductRequest(listOf(sku), ProductQueryType.All)
                            ).productsOrEmpty()
                        }.getOrElse { error ->
                            RnIapLog.failure("requestPurchase.fetchMissing", error)
                            emptyList()
                        }
                        fetched.firstOrNull()?.let { productTypeBySku[it.id] = it.type.rawValue }
                        if (!productTypeBySku.containsKey(sku)) {
                            sendPurchaseError(toErrorResult(OpenIapError.SkuNotFound(sku)))
                            return@async defaultResult
                        }
                    }
                }

                val typeHint = androidRequest.skus.firstOrNull()?.let { productTypeBySku[it] } ?: "inapp"
                val queryType = parseProductQueryType(typeHint)

                val subscriptionOffers = (androidRequest.subscriptionOffers as? Variant_NullType_Array_AndroidSubscriptionOfferInput_.Second)?.value
                    ?.mapNotNull { offer ->
                        val sku = offer.sku
                        val token = offer.offerToken
                        if (sku.isBlank() || token.isBlank()) {
                            null
                        } else {
                            AndroidSubscriptionOfferInput(sku = sku, offerToken = token)
                        }
                    }
                    ?: emptyList()
                val normalizedOffers = subscriptionOffers.takeIf { it.isNotEmpty() }
                val developerBillingOption =
                    (androidRequest.developerBillingOption as?
                        Variant_NullType_DeveloperBillingOptionParamsAndroid.Second)
                        ?.value
                        ?.let(::mapDeveloperBillingOption)

                val requestProps = when (queryType) {
                    ProductQueryType.Subs -> {
                        val replacementMode = androidRequest.replacementMode.unwrapDouble()?.toInt()

                        // Parse subscriptionProductReplacementParams (8.1.0+)
                        val subscriptionProductReplacementParams = (androidRequest.subscriptionProductReplacementParams as? Variant_NullType_SubscriptionProductReplacementParamsAndroid.Second)?.value?.let { params ->
                            OpenIapSubscriptionProductReplacementParams(
                                oldProductId = params.oldProductId,
                                replacementMode = parseSubscriptionReplacementMode(params.replacementMode)
                            )
                        }

                        val androidProps = RequestSubscriptionAndroidProps(
                            isOfferPersonalized = androidRequest.isOfferPersonalized.unwrapBool(),
                            obfuscatedAccountId = androidRequest.obfuscatedAccountId.unwrapString(),
                            obfuscatedProfileId = androidRequest.obfuscatedProfileId.unwrapString(),
                            developerBillingOption = developerBillingOption,
                            originalExternalTransactionId = androidRequest.originalExternalTransactionId.unwrapString(),
                            purchaseToken = androidRequest.purchaseToken.unwrapString(),
                            replacementMode = replacementMode,
                            skus = androidRequest.skus.toList(),
                            subscriptionOffers = normalizedOffers,
                            subscriptionProductReplacementParams = subscriptionProductReplacementParams
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(google = androidProps)
                            ),
                            type = ProductQueryType.Subs
                        )
                    }
                    ProductQueryType.InApp, ProductQueryType.All -> {
                        val androidProps = RequestPurchaseAndroidProps(
                            isOfferPersonalized = androidRequest.isOfferPersonalized.unwrapBool(),
                            obfuscatedAccountId = androidRequest.obfuscatedAccountId.unwrapString(),
                            obfuscatedProfileId = androidRequest.obfuscatedProfileId.unwrapString(),
                            developerBillingOption = developerBillingOption,
                            offerToken = androidRequest.offerToken.unwrapString(),
                            skus = androidRequest.skus.toList()
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(google = androidProps)
                            ),
                            type = ProductQueryType.InApp
                        )
                    }
                }

                RnIapLog.payload(
                    "requestPurchase.native",
                    mapOf(
                        "skus" to androidRequest.skus.toList(),
                        "type" to requestProps.type.rawValue,
                        "offerCount" to (normalizedOffers?.size ?: 0)
                    )
                )

                val result = withContext(Dispatchers.Main) {
                    openIap.requestPurchase(requestProps)
                }
                val purchases = result.purchasesOrEmpty()
                RnIapLog.result(
                    "requestPurchase.native",
                    mapOf(
                        "purchaseCount" to purchases.size,
                        "productIds" to purchases.map { it.productId }
                    )
                )

                defaultResult
            } catch (e: Exception) {
                RnIapLog.failure("requestPurchase", e)
                sendPurchaseError(
                    toErrorResult(
                        error = OpenIapError.PurchaseFailed(),
                        debugMessage = e.message,
                        messageOverride = e.message
                    )
                )
                defaultResult
            }
        }
    }
    
    // Purchase history methods (Unified)
    override fun getAvailablePurchases(options: NitroAvailablePurchasesOptions?): Promise<Array<NitroPurchase>> {
        return Promise.async {
            val androidOptions = (options?.android as? Variant_NullType_NitroAvailablePurchasesAndroidOptions.Second)?.value
            ensureConnection()

            val includeSuspended = androidOptions?.includeSuspended.unwrapBool() ?: false

            RnIapLog.payload(
                "getAvailablePurchases",
                mapOf("type" to androidOptions?.type?.name, "includeSuspended" to includeSuspended)
            )

            val typeName = androidOptions?.type?.name?.lowercase(java.util.Locale.ROOT)
            val normalizedType = when (typeName) {
                "inapp" -> {
                    RnIapLog.warn("getAvailablePurchases received legacy type 'inapp'; forwarding as 'in-app'")
                    "in-app"
                }
                "in-app", "subs" -> typeName
                else -> null
            }

            // Create PurchaseOptions with includeSuspendedAndroid
            val purchaseOptions = dev.hyo.openiap.PurchaseOptions(
                includeSuspendedAndroid = includeSuspended
            )

            val result: List<OpenIapPurchase> = if (normalizedType != null) {
                val typeEnum = parseProductQueryType(normalizedType)
                RnIapLog.payload(
                    "getAvailablePurchases.native",
                    mapOf("type" to typeEnum.rawValue, "includeSuspended" to includeSuspended)
                )
                // Note: getAvailableItems doesn't accept PurchaseOptions
                // includeSuspended only applies when fetching all types
                openIap.getAvailableItems(typeEnum)
            } else {
                RnIapLog.payload("getAvailablePurchases.native", mapOf("type" to "all", "includeSuspended" to includeSuspended))
                openIap.getAvailablePurchases(purchaseOptions)
            }
            RnIapLog.result(
                "getAvailablePurchases",
                mapOf(
                    "purchaseCount" to result.size,
                    "productIds" to result.map { it.productId }
                )
            )
            result.map { convertToNitroPurchase(it) }.toTypedArray()
        }
    }

    override fun getActiveSubscriptions(subscriptionIds: Array<String>?): Promise<Array<NitroActiveSubscription>> {
        return Promise.async {
            ensureConnection()

            RnIapLog.payload(
                "getActiveSubscriptions",
                mapOf("subscriptionIds" to (subscriptionIds?.toList() ?: "all"))
            )

            try {
                // Use OpenIapModule's native getActiveSubscriptions method
                RnIapLog.payload("getActiveSubscriptions.native", mapOf("type" to "subs"))
                val activeSubscriptions = openIap.getActiveSubscriptions(subscriptionIds?.toList())

                val nitroSubscriptions = activeSubscriptions.map { sub ->
                    NitroActiveSubscription(
                        productId = sub.productId,
                        isActive = sub.isActive,
                        transactionId = sub.transactionId,
                        purchaseToken = sub.purchaseToken.wrapVariant(),
                        transactionDate = sub.transactionDate,
                        // Android specific fields
                        autoRenewingAndroid = sub.autoRenewingAndroid.wrapVariant(),
                        basePlanIdAndroid = sub.basePlanIdAndroid.wrapVariant(),
                        currentPlanId = sub.currentPlanId.wrapVariant(),
                        purchaseTokenAndroid = sub.purchaseTokenAndroid.wrapVariant(),
                        // iOS specific fields (null on Android)
                        expirationDateIOS = null,
                        environmentIOS = null,
                        willExpireSoon = null,
                        daysUntilExpirationIOS = null,
                        renewalInfoIOS = null
                    )
                }

                RnIapLog.result(
                    "getActiveSubscriptions",
                    nitroSubscriptions.map { mapOf("productId" to it.productId, "isActive" to it.isActive) }
                )

                nitroSubscriptions.toTypedArray()
            } catch (e: Exception) {
                RnIapLog.failure("getActiveSubscriptions", e)
                val error = OpenIapError.ServiceUnavailable()
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = e.message,
                        messageOverride = "Failed to get active subscriptions: ${e.message}"
                    )
                )
            }
        }
    }

    override fun hasActiveSubscriptions(subscriptionIds: Array<String>?): Promise<Boolean> {
        return Promise.async {
            ensureConnection()

            RnIapLog.payload(
                "hasActiveSubscriptions",
                mapOf("subscriptionIds" to (subscriptionIds?.toList() ?: "all"))
            )

            try {
                val hasActive = openIap.hasActiveSubscriptions(subscriptionIds?.toList())
                RnIapLog.result("hasActiveSubscriptions", hasActive)
                hasActive
            } catch (e: Exception) {
                RnIapLog.failure("hasActiveSubscriptions", e)
                val error = OpenIapError.ServiceUnavailable()
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = e.message,
                        messageOverride = "Failed to check active subscriptions: ${e.message}"
                    )
                )
            }
        }
    }

    // Transaction management methods (Unified)
    override fun finishTransaction(params: NitroFinishTransactionParams): Promise<Variant_Boolean_NitroPurchaseResult> {
        return Promise.async {
            val androidParams = (params.android as? Variant_NullType_NitroFinishTransactionAndroidParams.Second)?.value
                ?: return@async Variant_Boolean_NitroPurchaseResult.First(true)
            val purchaseToken = androidParams.purchaseToken
            val isConsumable = androidParams.isConsumable.unwrapBool() ?: false

            RnIapLog.payload(
                "finishTransaction",
                mapOf(
                    "purchaseToken" to "<hidden>",
                    "isConsumable" to isConsumable
                )
            )

            // Validate token early to avoid confusing native errors
            if (purchaseToken.isBlank()) {
                RnIapLog.warn("finishTransaction called with missing purchaseToken")
                return@async Variant_Boolean_NitroPurchaseResult.Second(
                    NitroPurchaseResult(
                        responseCode = -1.0,
                        debugMessage = "Missing purchaseToken",
                        code = OpenIapError.toCode(OpenIapError.DeveloperError()),
                        message = "Missing purchaseToken",
                        purchaseToken = null,
                        productId = null,
                        productIds = null,
                        productType = null,
                        isEmptyProductList = null,
                        subResponseCodeAndroid = null
                    )
                )
            }

            // Ensure connection; if it fails, return an error result instead of throwing
            try {
                ensureConnection()
            } catch (e: Exception) {
                val err = OpenIapError.InitConnection
                return@async Variant_Boolean_NitroPurchaseResult.Second(
                    NitroPurchaseResult(
                        responseCode = -1.0,
                        debugMessage = e.message,
                        code = OpenIapError.toCode(err),
                        message = e.message?.takeIf { it.isNotBlank() } ?: err.message,
                        purchaseToken = purchaseToken,
                        productId = null,
                        productIds = null,
                        productType = null,
                        isEmptyProductList = null,
                        subResponseCodeAndroid = null
                    )
                )
            }

            try {
                if (isConsumable) {
                    openIap.consumePurchaseAndroid(purchaseToken)
                } else {
                    openIap.acknowledgePurchaseAndroid(purchaseToken)
                }
                val result = Variant_Boolean_NitroPurchaseResult.Second(
                    NitroPurchaseResult(
                        responseCode = 0.0,
                        debugMessage = null,
                        code = "0",
                        message = "OK",
                        purchaseToken = purchaseToken,
                        productId = null,
                        productIds = null,
                        productType = null,
                        isEmptyProductList = null,
                        subResponseCodeAndroid = null
                    )
                )
                RnIapLog.result("finishTransaction", mapOf("success" to true))
                result
            } catch (e: Exception) {
                val err = OpenIapError.BillingError()
                RnIapLog.failure("finishTransaction", e)
                Variant_Boolean_NitroPurchaseResult.Second(
                    NitroPurchaseResult(
                        responseCode = -1.0,
                        debugMessage = e.message,
                        code = OpenIapError.toCode(err),
                        message = e.message?.takeIf { it.isNotBlank() } ?: err.message,
                        purchaseToken = null,
                        productId = null,
                        productIds = null,
                        productType = null,
                        isEmptyProductList = null,
                        subResponseCodeAndroid = null
                    )
                )
            }
        }
    }

    override fun getStorefront(): Promise<String> {
        return Promise.async {
            try {
                ensureConnection()
                RnIapLog.payload("getStorefront", null)
                val value = openIap.getStorefront()
                if (value.isBlank()) {
                    throw OpenIapError.ServiceUnavailable(
                        "Storefront lookup returned no country code"
                    )
                }
                RnIapLog.result("getStorefront", value)
                value
            } catch (e: OpenIapException) {
                RnIapLog.failure("getStorefront", e)
                throw e
            } catch (e: OpenIapError) {
                RnIapLog.failure("getStorefront", e)
                throw OpenIapException(toErrorJson(e))
            } catch (e: Exception) {
                RnIapLog.failure("getStorefront", e)
                val error = OpenIapError.ServiceUnavailable(e.message)
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = e.message,
                        messageOverride = "Failed to get storefront"
                    ),
                    e
                )
            }
        }
    }

    override val memorySize: Long
        get() = 0L
    
    // Event listener methods
    override fun addPurchaseUpdatedListener(
        listener: (purchase: NitroPurchase) -> Unit,
        options: PurchaseUpdatedListenerOptions?
    ): Double {
        return synchronized(purchaseUpdatedListeners) {
            val token = nextPurchaseUpdatedListenerToken
            nextPurchaseUpdatedListenerToken += 1.0
            purchaseUpdatedListeners.add(PurchaseUpdatedListenerRegistration(token, listener))
            token
        }
    }

    override fun addPurchaseErrorListener(listener: (error: NitroPurchaseResult) -> Unit) {
        synchronized(purchaseErrorListeners) {
            purchaseErrorListeners.add(listener)
        }
    }

    override fun removePurchaseUpdatedListener(token: Double) {
        synchronized(purchaseUpdatedListeners) {
            purchaseUpdatedListeners.removeAll { it.token == token }
        }
    }

    override fun removePurchaseErrorListener(listener: (error: NitroPurchaseResult) -> Unit) {
        synchronized(purchaseErrorListeners) {
            purchaseErrorListeners.remove(listener)
        }
    }
    
    override fun addPromotedProductListenerIOS(listener: (product: NitroProduct) -> Unit) {
        // Promoted products are iOS-only, but we implement the interface for consistency
        promotedProductListenersIOS.add(listener)
        RnIapLog.warn("addPromotedProductListenerIOS called on Android - promoted products are iOS-only")
    }

    override fun removePromotedProductListenerIOS(listener: (product: NitroProduct) -> Unit) {
        // Promoted products are iOS-only, but we implement the interface for consistency
        val removed = promotedProductListenersIOS.remove(listener)
        if (!removed) RnIapLog.warn("removePromotedProductListenerIOS: listener not found")
        RnIapLog.warn("removePromotedProductListenerIOS called on Android - promoted products are iOS-only")
    }
    
    // Billing callbacks handled internally by OpenIAP
    
    // Helper methods
    
    /**
     * Send purchase update event to listeners
     */
    private fun sendPurchaseUpdate(purchase: NitroPurchase) {
        RnIapLog.result(
            "sendPurchaseUpdate",
            mapOf("productId" to purchase.productId, "platform" to purchase.platform)
        )
        val snapshot = synchronized(purchaseUpdatedListeners) {
            purchaseUpdatedListeners.map { it.listener }
        }
        snapshot.forEach { it(purchase) }
    }

    /**
     * Send purchase error event to listeners
     */
    private fun sendPurchaseError(error: NitroPurchaseResult) {
        RnIapLog.result(
            "sendPurchaseError",
            mapOf("code" to error.code, "message" to error.message)
        )
        val snapshot = synchronized(purchaseErrorListeners) { ArrayList(purchaseErrorListeners) }
        snapshot.forEach { it(error) }
    }
    
    /**
     * Create purchase error result with proper format
     */
    private fun createPurchaseErrorResult(
        errorCode: String,
        message: String,
        sku: String? = null,
        responseCode: Int? = null,
        debugMessage: String? = null
    ): NitroPurchaseResult {
        return NitroPurchaseResult(
            responseCode = responseCode?.toDouble() ?: -1.0,
            debugMessage = debugMessage,
            code = errorCode,
            message = message,
            purchaseToken = null,
            productId = sku,
            productIds = null,
            productType = null,
            isEmptyProductList = null,
            subResponseCodeAndroid = null
        )
    }

    private fun parseProductQueryType(rawType: String): ProductQueryType {
        val normalized = rawType
            .trim()
            .lowercase(Locale.US)
            .replace("_", "")
            .replace("-", "")
        return when (normalized) {
            "subs", "subscription", "subscriptions" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            else -> ProductQueryType.InApp
        }
    }

    /**
     * Parse subscription replacement mode from Nitro enum to OpenIAP enum (8.1.0+)
     */
    private fun parseSubscriptionReplacementMode(mode: SubscriptionReplacementModeAndroid): OpenIapSubscriptionReplacementMode {
        return when (mode) {
            SubscriptionReplacementModeAndroid.WITH_TIME_PRORATION -> OpenIapSubscriptionReplacementMode.WithTimeProration
            SubscriptionReplacementModeAndroid.CHARGE_PRORATED_PRICE -> OpenIapSubscriptionReplacementMode.ChargeProratedPrice
            SubscriptionReplacementModeAndroid.CHARGE_FULL_PRICE -> OpenIapSubscriptionReplacementMode.ChargeFullPrice
            SubscriptionReplacementModeAndroid.WITHOUT_PRORATION -> OpenIapSubscriptionReplacementMode.WithoutProration
            SubscriptionReplacementModeAndroid.DEFERRED -> OpenIapSubscriptionReplacementMode.Deferred
            SubscriptionReplacementModeAndroid.KEEP_EXISTING -> OpenIapSubscriptionReplacementMode.KeepExisting
            SubscriptionReplacementModeAndroid.UNKNOWN_REPLACEMENT_MODE -> OpenIapSubscriptionReplacementMode.UnknownReplacementMode
        }
    }

    private fun FetchProductsResult.productsOrEmpty(): List<ProductCommon> = when (this) {
        is FetchProductsResultProducts -> this.value.orEmpty().filterIsInstance<ProductCommon>()
        is FetchProductsResultSubscriptions -> this.value.orEmpty().filterIsInstance<ProductCommon>()
        is FetchProductsResultAll -> this.value.orEmpty().filterIsInstance<ProductCommon>()
    }

    private fun dev.hyo.openiap.RequestPurchaseResult?.purchasesOrEmpty(): List<OpenIapPurchase> = when (this) {
        is RequestPurchaseResultPurchases -> this.value.orEmpty().mapNotNull { it }
        is RequestPurchaseResultPurchase -> this.value?.let(::listOf).orEmpty()
        else -> emptyList()
    }

    private fun serializeSubscriptionOffers(offers: List<ProductSubscriptionAndroidOfferDetails>): String {
        return JSONArray(legacySubscriptionOfferMaps(offers)).toString()
    }

    /**
     * Serialize standardized SubscriptionOffer list to JSON string (OpenIAP 1.3.10+)
     */
    private fun serializeStandardizedSubscriptionOffers(offers: List<dev.hyo.openiap.SubscriptionOffer>): String {
        return JSONArray(subscriptionOfferMaps(offers)).toString()
    }

    /**
     * Serialize standardized DiscountOffer list to JSON string (OpenIAP 1.3.10+)
     */
    private fun serializeStandardizedDiscountOffers(offers: List<dev.hyo.openiap.DiscountOffer>): String {
        return JSONArray(discountOfferMaps(offers)).toString()
    }

    private fun convertToNitroProduct(product: ProductCommon): NitroProduct {
        val subscriptionOffers = when (product) {
            is ProductSubscriptionAndroid -> product.subscriptionOfferDetailsAndroid.orEmpty()
            is ProductAndroid -> product.subscriptionOfferDetailsAndroid.orEmpty()
            else -> emptyList()
        }
        val oneTimeOffers = when (product) {
            is ProductSubscriptionAndroid -> product.oneTimePurchaseOfferDetailsAndroid
            is ProductAndroid -> product.oneTimePurchaseOfferDetailsAndroid
            else -> null
        }

        val subscriptionOffersJson = subscriptionOffers.takeIf { it.isNotEmpty() }?.let { serializeSubscriptionOffers(it) }
        val oneTimeOffersNitro = oneTimeOffers
            ?.map { it.toNitroOneTimePurchaseOfferDetail() }
            ?.toTypedArray()

        var originalPriceAndroid: String? = null
        var originalPriceAmountMicrosAndroid: Double? = null
        var introductoryPriceValueAndroid: Double? = null
        var introductoryPriceCyclesAndroid: Double? = null
        var introductoryPricePeriodAndroid: String? = null
        var subscriptionPeriodAndroid: String? = null
        var freeTrialPeriodAndroid: String? = null

        if (product.type == OpenIapProductType.InApp) {
            oneTimeOffers?.firstOrNull()?.let { otp ->
                originalPriceAndroid = otp.formattedPrice
                originalPriceAmountMicrosAndroid = otp.priceAmountMicros.toDoubleOrNull()
            }
        } else {
            val phases = subscriptionOffers.firstOrNull()?.pricingPhases?.pricingPhaseList.orEmpty()
            if (phases.isNotEmpty()) {
                val basePhase = phases.firstOrNull { it.recurrenceMode == 2 } ?: phases.last()
                originalPriceAndroid = basePhase.formattedPrice
                originalPriceAmountMicrosAndroid = basePhase.priceAmountMicros.toDoubleOrNull()
                subscriptionPeriodAndroid = basePhase.billingPeriod

                val introPhase = phases.firstOrNull {
                    it.billingCycleCount > 0 && (it.priceAmountMicros.toLongOrNull() ?: 0L) > 0L
                }
                if (introPhase != null) {
                    introductoryPriceValueAndroid = introPhase.priceAmountMicros.toDoubleOrNull()?.div(1_000_000.0)
                    introductoryPriceCyclesAndroid = introPhase.billingCycleCount.toDouble()
                    introductoryPricePeriodAndroid = introPhase.billingPeriod
                }

                val trialPhase = phases.firstOrNull { (it.priceAmountMicros.toLongOrNull() ?: 0L) == 0L }
                if (trialPhase != null) {
                    freeTrialPeriodAndroid = trialPhase.billingPeriod
                }
            }
        }

        val nameAndroid = when (product) {
            is ProductAndroid -> product.nameAndroid
            is ProductSubscriptionAndroid -> product.nameAndroid
            else -> null
        }

        // Extract productStatusAndroid (OpenIAP 1.3.14+, Billing Library 8.0+)
        val productStatusAndroid = when (product) {
            is ProductAndroid -> product.productStatusAndroid?.rawValue
            is ProductSubscriptionAndroid -> product.productStatusAndroid?.rawValue
            else -> null
        }

        // Serialize standardized cross-platform subscriptionOffers (OpenIAP 1.3.10+)
        val standardizedSubsOffers = when (product) {
            is ProductSubscriptionAndroid -> product.subscriptionOffers
            is ProductAndroid -> product.subscriptionOffers
            else -> null
        }
        val subscriptionOffersStandardizedJson = standardizedSubsOffers?.takeIf { it.isNotEmpty() }?.let {
            serializeStandardizedSubscriptionOffers(it)
        }

        // Serialize standardized cross-platform discountOffers (OpenIAP 1.3.10+)
        val standardizedDiscountOffers = when (product) {
            is ProductSubscriptionAndroid -> product.discountOffers
            is ProductAndroid -> product.discountOffers
            else -> null
        }
        val discountOffersJson = standardizedDiscountOffers?.takeIf { it.isNotEmpty() }?.let {
            serializeStandardizedDiscountOffers(it)
        }

        return NitroProduct(
            id = product.id,
            title = product.title,
            description = product.description,
            debugDescription = product.nitroDebugDescription(),
            type = product.type.rawValue,
            displayName = product.displayName.wrapVariant(),
            displayPrice = product.displayPrice,
            currency = product.currency,
            price = product.price.wrapVariant(),
            platform = IapPlatform.ANDROID,
            typeIOS = null,
            isFamilyShareableIOS = null,
            jsonRepresentationIOS = null,
            pricingTermsIOS = null,
            subscriptionInfoIOS = null,
            discountsIOS = null,
            subscriptionPeriodUnitIOS = null,
            subscriptionPeriodNumberIOS = null,
            introductoryPriceIOS = null,
            introductoryPriceAsAmountIOS = null,
            introductoryPricePaymentModeIOS = PaymentModeIOS.EMPTY,
            introductoryPriceNumberOfPeriodsIOS = null,
            introductoryPriceSubscriptionPeriodIOS = null,
            subscriptionGroupIdIOS = null,
            subscriptionOffers = subscriptionOffersStandardizedJson.wrapVariant(),
            discountOffers = discountOffersJson.wrapVariant(),
            nameAndroid = nameAndroid.wrapVariant(),
            originalPriceAndroid = originalPriceAndroid.wrapVariant(),
            originalPriceAmountMicrosAndroid = originalPriceAmountMicrosAndroid.wrapVariant(),
            introductoryPriceValueAndroid = introductoryPriceValueAndroid.wrapVariant(),
            introductoryPriceCyclesAndroid = introductoryPriceCyclesAndroid.wrapVariant(),
            introductoryPricePeriodAndroid = introductoryPricePeriodAndroid.wrapVariant(),
            subscriptionPeriodAndroid = subscriptionPeriodAndroid.wrapVariant(),
            freeTrialPeriodAndroid = freeTrialPeriodAndroid.wrapVariant(),
            subscriptionOfferDetailsAndroid = subscriptionOffersJson.wrapVariant(),
            oneTimePurchaseOfferDetailsAndroid = oneTimeOffersNitro?.let { Variant_NullType_Array_NitroOneTimePurchaseOfferDetail_.Second(it) },
            productStatusAndroid = productStatusAndroid.wrapVariant()
        )
    }

    // Purchase state is provided as enum value by OpenIAP
    
    private fun convertToNitroPurchase(purchase: OpenIapPurchase): NitroPurchase {
        val androidPurchase = purchase as? PurchaseAndroid
        val purchaseStateAndroidNumeric = when (purchase.purchaseState) {
            dev.hyo.openiap.PurchaseState.Purchased -> 1.0
            dev.hyo.openiap.PurchaseState.Pending -> 2.0
            else -> 0.0
        }
        return NitroPurchase(
            id = purchase.id,
            productId = purchase.productId,
            transactionDate = purchase.transactionDate,
            purchaseToken = purchase.purchaseToken.wrapVariant(),
            currentPlanId = purchase.currentPlanId.wrapVariant(),
            ids = purchase.ids.wrapVariant(),
            platform = IapPlatform.ANDROID,
            store = mapIapStore(purchase.store),
            quantity = purchase.quantity.toDouble(),
            purchaseState = mapPurchaseState(purchase.purchaseState),
            isAutoRenewing = purchase.isAutoRenewing,
            advancedCommerceInfoIOS = null,
            billingPlanTypeIOS = null,
            commitmentInfoIOS = null,
            quantityIOS = null,
            originalTransactionDateIOS = null,
            originalTransactionIdentifierIOS = null,
            appAccountToken = null,
            appBundleIdIOS = null,
            countryCodeIOS = null,
            currencyCodeIOS = null,
            currencySymbolIOS = null,
            environmentIOS = null,
            expirationDateIOS = null,
            isUpgradedIOS = null,
            offerIOS = null,
            ownershipTypeIOS = null,
            reasonIOS = null,
            reasonStringRepresentationIOS = null,
            revocationDateIOS = null,
            revocationReasonIOS = null,
            storefrontCountryCodeIOS = null,
            subscriptionGroupIdIOS = null,
            transactionReasonIOS = null,
            webOrderLineItemIdIOS = null,
            renewalInfoIOS = null,
            purchaseTokenAndroid = androidPurchase?.purchaseToken.wrapVariant(),
            dataAndroid = androidPurchase?.dataAndroid.wrapVariant(),
            signatureAndroid = androidPurchase?.signatureAndroid.wrapVariant(),
            autoRenewingAndroid = androidPurchase?.autoRenewingAndroid.wrapVariant(),
            purchaseStateAndroid = purchaseStateAndroidNumeric.wrapVariant(),
            isAcknowledgedAndroid = androidPurchase?.isAcknowledgedAndroid.wrapVariant(),
            packageNameAndroid = androidPurchase?.packageNameAndroid.wrapVariant(),
            obfuscatedAccountIdAndroid = androidPurchase?.obfuscatedAccountIdAndroid.wrapVariant(),
            obfuscatedProfileIdAndroid = androidPurchase?.obfuscatedProfileIdAndroid.wrapVariant(),
            developerPayloadAndroid = androidPurchase?.developerPayloadAndroid.wrapVariant(),
            isSuspendedAndroid = androidPurchase?.isSuspendedAndroid.wrapVariant(),
            pendingPurchaseUpdateAndroid = androidPurchase?.pendingPurchaseUpdateAndroid.wrapVariant()
        )
    }

    private fun mapPurchaseState(state: dev.hyo.openiap.PurchaseState): PurchaseState {
        return when (state) {
            dev.hyo.openiap.PurchaseState.Purchased -> PurchaseState.PURCHASED
            dev.hyo.openiap.PurchaseState.Pending -> PurchaseState.PENDING
            dev.hyo.openiap.PurchaseState.Unknown -> PurchaseState.UNKNOWN
        }
    }

    private fun mapIapStore(store: dev.hyo.openiap.IapStore): IapStore {
        return when (store) {
            dev.hyo.openiap.IapStore.Apple -> IapStore.APPLE
            dev.hyo.openiap.IapStore.Google -> IapStore.GOOGLE
            dev.hyo.openiap.IapStore.Horizon -> IapStore.HORIZON
            dev.hyo.openiap.IapStore.Amazon -> IapStore.AMAZON
            dev.hyo.openiap.IapStore.Unknown -> IapStore.UNKNOWN
        }
    }

    // Billing error messages handled by OpenIAP
    
    // iOS-specific method - not supported on Android
    override fun getStorefrontIOS(): Promise<String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    // iOS-specific method - not supported on Android
    override fun getAppTransactionIOS(): Promise<Variant_NullType_String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    // Android-specific deep link to subscription management
    override fun deepLinkToSubscriptionsAndroid(options: NitroDeepLinkOptionsAndroid): Promise<Unit> {
        return Promise.async {
            try {
                ensureConnection()
                OpenIapDeepLinkOptions(
                    skuAndroid = options.skuAndroid.unwrapString(),
                    packageNameAndroid = options.packageNameAndroid.unwrapString()
                ).let { openIap.deepLinkToSubscriptions(it) }
                RnIapLog.result("deepLinkToSubscriptionsAndroid", true)
            } catch (e: Exception) {
                RnIapLog.failure("deepLinkToSubscriptionsAndroid", e)
                throw e
            }
        }
    }

    // iOS-specific method - not supported on Android
    override fun getPromotedProductIOS(): Promise<Variant_NullType_NitroProduct> {
        return Promise.async {
            Variant_NullType_NitroProduct.First(NullType.NULL)
        }
    }

    // iOS-specific method - not supported on Android
    override fun requestPromotedProductIOS(): Promise<Variant_NullType_NitroProduct> {
        return Promise.async {
            // Android doesn't have promoted products like iOS App Store
            // Return null as this feature is iOS-only
            Variant_NullType_NitroProduct.First(NullType.NULL)
        }
    }

    override fun buyPromotedProductIOS(): Promise<Boolean> {
        return Promise.async {
            // Android doesn't have promoted products like iOS App Store
            false
        }
    }

    override fun presentCodeRedemptionSheetIOS(): Promise<Boolean> {
        return Promise.async {
            // Android doesn't have a code redemption sheet like iOS App Store
            // This is an iOS-only feature, so we return false on Android
            false
        }
    }

    override fun clearTransactionIOS(): Promise<Unit> {
        return Promise.async {
            // This is an iOS-only feature for clearing unfinished transactions
            // On Android, we don't need to do anything
        }
    }

    override fun beginRefundRequestIOS(sku: String): Promise<Variant_NullType_String> {
        return Promise.async {
            // Android doesn't have in-app refund requests like iOS
            // Refunds on Android are handled through Google Play Console
            Variant_NullType_String.First(NullType.NULL)
        }
    }

    // Updated signature to follow spec: returns updated subscriptions
    override fun showManageSubscriptionsIOS(): Promise<Array<NitroPurchase>> {
        return Promise.async {
            // Not supported on Android. Return empty list for iOS-only API.
            emptyArray()
        }
    }

    override fun deepLinkToSubscriptionsIOS(): Promise<Boolean> {
        return Promise.async {
            false
        }
    }

    // Receipt validation - calls OpenIAP's verifyPurchase
    override fun validateReceipt(params: NitroReceiptValidationParams): Promise<Variant_NitroReceiptValidationResultIOS_NitroReceiptValidationResultAndroid> {
        return Promise.async {
            try {
                // For Android, we need the google options to be provided (new platform-specific structure)
                val nitroGoogleOptions = (params.google as? Variant_NullType_NitroReceiptValidationGoogleOptions.Second)?.value
                    ?: throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Missing required parameter: google options"))

                // Validate required google fields
                val validations = mapOf(
                    "google.sku" to nitroGoogleOptions.sku,
                    "google.accessToken" to nitroGoogleOptions.accessToken,
                    "google.packageName" to nitroGoogleOptions.packageName,
                    "google.purchaseToken" to nitroGoogleOptions.purchaseToken
                )
                for ((name, value) in validations) {
                    if (value.isEmpty()) {
                        throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Missing or empty required parameter: $name"))
                    }
                }

                RnIapLog.payload("validateReceipt", mapOf(
                    "sku" to nitroGoogleOptions.sku,
                    "packageName" to nitroGoogleOptions.packageName,
                    "isSub" to nitroGoogleOptions.isSub.unwrapBool()
                ))

                // Create OpenIAP VerifyPurchaseGoogleOptions
                val googleOptions = VerifyPurchaseGoogleOptions(
                    sku = nitroGoogleOptions.sku,
                    accessToken = nitroGoogleOptions.accessToken,
                    packageName = nitroGoogleOptions.packageName,
                    purchaseToken = nitroGoogleOptions.purchaseToken,
                    isSub = nitroGoogleOptions.isSub.unwrapBool()
                )

                // Create OpenIAP VerifyPurchaseProps
                val props = VerifyPurchaseProps(google = googleOptions)

                // Call OpenIAP's verifyPurchase - this makes the actual Google Play API call
                val verifyResult = openIap.verifyPurchase(props)

                // Cast to Android result type (on Android, verifyPurchase returns VerifyPurchaseResultAndroid)
                val androidResult = verifyResult as? VerifyPurchaseResultAndroid
                    ?: throw OpenIapException(toErrorJson(OpenIapError.InvalidPurchaseVerification, debugMessage = "Unexpected result type from verifyPurchase"))
                RnIapLog.result(
                    "validateReceipt",
                    mapOf(
                        "productId" to androidResult.productId,
                        "testTransaction" to androidResult.testTransaction
                    )
                )

                // Convert OpenIAP result to Nitro result
                val result = NitroReceiptValidationResultAndroid(
                    autoRenewing = androidResult.autoRenewing,
                    betaProduct = androidResult.betaProduct,
                    cancelDate = androidResult.cancelDate.wrapVariant(),
                    cancelReason = androidResult.cancelReason.wrapVariant(),
                    deferredDate = androidResult.deferredDate.wrapVariant(),
                    deferredSku = androidResult.deferredSku.wrapVariant(),
                    freeTrialEndDate = androidResult.freeTrialEndDate,
                    gracePeriodEndDate = androidResult.gracePeriodEndDate,
                    parentProductId = androidResult.parentProductId,
                    productId = androidResult.productId,
                    productType = androidResult.productType,
                    purchaseDate = androidResult.purchaseDate,
                    quantity = androidResult.quantity.toDouble(),
                    receiptId = androidResult.receiptId,
                    renewalDate = androidResult.renewalDate,
                    term = androidResult.term,
                    termSku = androidResult.termSku,
                    testTransaction = androidResult.testTransaction
                )

                Variant_NitroReceiptValidationResultIOS_NitroReceiptValidationResultAndroid.Second(result)

            } catch (e: OpenIapException) {
                RnIapLog.failure("validateReceipt", e)
                throw e
            } catch (e: Exception) {
                RnIapLog.failure("validateReceipt", e)
                val debugMessage = e.message
                val error = OpenIapError.InvalidPurchaseVerification
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = debugMessage,
                        messageOverride = "Receipt validation failed: ${debugMessage ?: "unknown reason"}"
                    )
                )
            }
        }
    }

    override fun verifyPurchaseWithProvider(params: NitroVerifyPurchaseWithProviderProps): Promise<NitroVerifyPurchaseWithProviderResult> {
        return Promise.async {
            try {
                // Convert Nitro enum to string (e.g., IAPKIT -> "iapkit")
                val providerString = params.provider.name.lowercase(java.util.Locale.ROOT)
                RnIapLog.payload("verifyPurchaseWithProvider", mapOf("provider" to providerString))

                // Build the props map for OpenIAP - use string value for provider
                val propsMap = mutableMapOf<String, Any?>("provider" to providerString)
                (params.iapkit as? Variant_NullType_NitroVerifyPurchaseWithIapkitProps.Second)?.value?.let { iapkit ->
                    val iapkitMap = mutableMapOf<String, Any?>()
                    // Use provided apiKey, or fallback to host app AndroidManifest meta-data.
                    val apiKey = iapkit.apiKey.unwrapString() ?: getIapkitApiKeyFromManifest()
                    apiKey?.let { iapkitMap["apiKey"] = it }
                    iapkit.baseUrl.unwrapString()?.let { iapkitMap["baseUrl"] = it }
                    iapkit.includeClientPayload.unwrapBool()?.let {
                        iapkitMap["includeClientPayload"] = it
                    }
                    (iapkit.google as? Variant_NullType_NitroVerifyPurchaseWithIapkitGoogleProps.Second)?.value?.let { google ->
                        iapkitMap["google"] = mapOf("purchaseToken" to google.purchaseToken)
                    }
                    (iapkit.amazon as? Variant_NullType_NitroVerifyPurchaseWithIapkitAmazonProps.Second)?.value?.let { amazon ->
                        val amazonMap = mutableMapOf<String, Any?>(
                            "receiptId" to amazon.receiptId
                        )
                        amazon.userId.unwrapString()?.let { amazonMap["userId"] = it }
                        amazon.sandbox.unwrapBool()?.let { amazonMap["sandbox"] = it }
                        iapkitMap["amazon"] = amazonMap
                    }
                    (iapkit.apple as? Variant_NullType_NitroVerifyPurchaseWithIapkitAppleProps.Second)?.value?.let { apple ->
                        iapkitMap["apple"] = mapOf("jws" to apple.jws)
                    }
                    propsMap["iapkit"] = iapkitMap
                }

                val props = dev.hyo.openiap.VerifyPurchaseWithProviderProps.fromJson(propsMap)
                    ?: throw Exception("Failed to parse VerifyPurchaseWithProviderProps")
                val result = openIap.verifyPurchaseWithProvider(props)

                RnIapLog.result("verifyPurchaseWithProvider", mapOf("provider" to result.provider, "hasIapkit" to (result.iapkit != null)))

                // Convert result to Nitro types
                val nitroIapkitResult = result.iapkit?.let { item ->
                    val clientPayload = item.clientPayload?.let { payload ->
                        NitroIapkitProductClientPayload(
                            body = payload.body,
                            format = when (payload.format.rawValue) {
                                "toml" -> IapkitClientPayloadFormat.TOML
                                "json" -> IapkitClientPayloadFormat.JSON
                                else -> IapkitClientPayloadFormat.TEXT
                            },
                            updatedAt = payload.updatedAt,
                            version = payload.version
                        )
                    }
                    NitroVerifyPurchaseWithIapkitResult(
                        clientPayload = clientPayload?.let {
                            Variant_NullType_NitroIapkitProductClientPayload.Second(it)
                        },
                        isValid = item.isValid,
                        productId = item.productId?.let { Variant_NullType_String.Second(it) },
                        // Use rawValue ("pending-acknowledgment"), not the Kotlin
                        // enum constant name ("PendingAcknowledgment") — the
                        // mappers match separator-delimited spellings, so
                        // multi-word states would otherwise degrade to UNKNOWN.
                        state = mapIapkitPurchaseState(item.state.rawValue),
                        store = mapIapkitStore(item.store.rawValue)
                    )
                }

                // Convert errors if present
                val nitroErrors = result.errors?.map { error ->
                    NitroVerifyPurchaseWithProviderError(
                        code = error.code?.let { Variant_NullType_String.Second(it) },
                        message = error.message ?: ""
                    )
                }?.toTypedArray()

                NitroVerifyPurchaseWithProviderResult(
                    iapkit = nitroIapkitResult?.let { Variant_NullType_NitroVerifyPurchaseWithIapkitResult.Second(it) },
                    errors = nitroErrors?.let { Variant_NullType_Array_NitroVerifyPurchaseWithProviderError_.Second(it) },
                    provider = mapPurchaseVerificationProvider(result.provider.rawValue)
                )
            } catch (e: Exception) {
                RnIapLog.failure("verifyPurchaseWithProvider", e)
                val error = OpenIapError.VerificationFailed
                throw OpenIapException(
                    toErrorJson(
                        error = error,
                        debugMessage = e.message,
                        messageOverride = "Verification failed: ${e.message ?: "unknown reason"}"
                    )
                )
            }
        }
    }

    // iOS-specific methods - Not applicable on Android, return appropriate defaults
    override fun subscriptionStatusIOS(sku: String): Promise<Variant_NullType_Array_NitroSubscriptionStatus_> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun currentEntitlementIOS(sku: String): Promise<Variant_NullType_NitroPurchase> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun latestTransactionIOS(sku: String): Promise<Variant_NullType_NitroPurchase> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun getPendingTransactionsIOS(): Promise<Array<NitroPurchase>> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun getAllTransactionsIOS(): Promise<Array<NitroPurchase>> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun syncIOS(): Promise<Boolean> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    
    
    override fun isEligibleForIntroOfferIOS(groupID: String): Promise<Boolean> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun getReceiptDataIOS(): Promise<String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun getReceiptIOS(): Promise<String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun requestReceiptRefreshIOS(): Promise<String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun isTransactionVerifiedIOS(sku: String): Promise<Boolean> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }
    
    override fun getTransactionJwsIOS(sku: String): Promise<Variant_NullType_String> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    // -------------------------------------------------------------------------
    // Alternative Billing (Android)
    // -------------------------------------------------------------------------

    @Suppress("DEPRECATION")
    override fun checkAlternativeBillingAvailabilityAndroid(): Promise<Boolean> {
        return Promise.async {
            RnIapLog.payload("checkAlternativeBillingAvailabilityAndroid", null)
            try {
                val isAvailable = withContext(Dispatchers.Main) {
                    openIap.checkAlternativeBillingAvailability()
                }
                RnIapLog.result("checkAlternativeBillingAvailabilityAndroid", isAvailable)
                isAvailable
            } catch (err: Throwable) {
                RnIapLog.failure("checkAlternativeBillingAvailabilityAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun showAlternativeBillingDialogAndroid(): Promise<Boolean> {
        return Promise.async {
            RnIapLog.payload("showAlternativeBillingDialogAndroid", null)
            try {
                val activity = context.currentActivity
                    ?: throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Activity not available"))

                val userAccepted = withContext(Dispatchers.Main) {
                    openIap.setActivity(activity)
                    openIap.showAlternativeBillingInformationDialog(activity)
                }
                RnIapLog.result("showAlternativeBillingDialogAndroid", userAccepted)
                userAccepted
            } catch (err: Throwable) {
                RnIapLog.failure("showAlternativeBillingDialogAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun createAlternativeBillingTokenAndroid(sku: Variant_NullType_String?): Promise<Variant_NullType_String> {
        return Promise.async {
            val skuValue = sku.unwrapString()
            RnIapLog.payload("createAlternativeBillingTokenAndroid", mapOf("sku" to skuValue))
            try {
                // Note: OpenIapModule.createAlternativeBillingReportingToken() doesn't accept sku parameter
                // The sku parameter is ignored for now - may be used in future versions
                val token = withContext(Dispatchers.Main) {
                    openIap.createAlternativeBillingReportingToken()
                }
                RnIapLog.result(
                    "createAlternativeBillingTokenAndroid",
                    if (token.isNullOrBlank()) "<empty>" else "<token>"
                )
                token?.let { Variant_NullType_String.Second(it) } ?: Variant_NullType_String.First(NullType.NULL)
            } catch (err: Throwable) {
                RnIapLog.failure("createAlternativeBillingTokenAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    // User Choice Billing listener
    override fun addUserChoiceBillingListenerAndroid(listener: (UserChoiceBillingDetails) -> Unit) {
        synchronized(userChoiceBillingListenersAndroid) {
            userChoiceBillingListenersAndroid.add(listener)
        }
    }

    override fun removeUserChoiceBillingListenerAndroid(listener: (UserChoiceBillingDetails) -> Unit) {
        synchronized(userChoiceBillingListenersAndroid) {
            userChoiceBillingListenersAndroid.remove(listener)
        }
    }

    private fun sendUserChoiceBilling(details: UserChoiceBillingDetails) {
        val snapshot = synchronized(userChoiceBillingListenersAndroid) { ArrayList(userChoiceBillingListenersAndroid) }
        snapshot.forEach { it(details) }
    }

    // Developer Provided Billing listener (External Payments - 8.3.0+)
    override fun addDeveloperProvidedBillingListenerAndroid(listener: (DeveloperProvidedBillingDetailsAndroid) -> Unit) {
        synchronized(developerProvidedBillingListenersAndroid) {
            developerProvidedBillingListenersAndroid.add(listener)
        }
    }

    override fun removeDeveloperProvidedBillingListenerAndroid(listener: (DeveloperProvidedBillingDetailsAndroid) -> Unit) {
        synchronized(developerProvidedBillingListenersAndroid) {
            developerProvidedBillingListenersAndroid.remove(listener)
        }
    }

    private fun sendDeveloperProvidedBilling(details: DeveloperProvidedBillingDetailsAndroid) {
        val snapshot = synchronized(developerProvidedBillingListenersAndroid) { ArrayList(developerProvidedBillingListenersAndroid) }
        snapshot.forEach { it(details) }
    }

    // -------------------------------------------------------------------------
    // Subscription billing-issue listener (cross-platform event)
    // Source: Play Billing 8.1+ Purchase.isSuspended detection inside openiap-google.
    // -------------------------------------------------------------------------

    @Volatile
    private var subscriptionBillingIssueAttached = false
    private val subscriptionBillingIssueAttachLock = Any()
    private var subscriptionBillingIssueNativeListener: dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener? = null

    override fun addSubscriptionBillingIssueListener(listener: (purchase: NitroPurchase) -> Unit) {
        synchronized(subscriptionBillingIssueAttachLock) {
            synchronized(subscriptionBillingIssueListeners) {
                subscriptionBillingIssueListeners.add(listener)
            }
            attachSubscriptionBillingIssueIfNeeded()
        }
    }

    override fun removeSubscriptionBillingIssueListener(listener: (purchase: NitroPurchase) -> Unit) {
        synchronized(subscriptionBillingIssueAttachLock) {
            synchronized(subscriptionBillingIssueListeners) {
                subscriptionBillingIssueListeners.remove(listener)
            }
        }
    }

    private fun attachSubscriptionBillingIssueIfNeeded() {
        synchronized(subscriptionBillingIssueAttachLock) {
            if (subscriptionBillingIssueAttached) return
            val nativeListener = dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener { purchase ->
                runCatching {
                    val nitro = convertToNitroPurchase(purchase)
                    val snapshot = synchronized(subscriptionBillingIssueListeners) {
                        ArrayList(subscriptionBillingIssueListeners)
                    }
                    snapshot.forEach { it(nitro) }
                }.onFailure { RnIapLog.failure("subscriptionBillingIssueListener", it) }
            }
            openIap.addSubscriptionBillingIssueListener(nativeListener)
            subscriptionBillingIssueNativeListener = nativeListener
            subscriptionBillingIssueAttached = true
        }
    }

    private fun detachSubscriptionBillingIssueIfNeeded() {
        synchronized(subscriptionBillingIssueAttachLock) {
            subscriptionBillingIssueNativeListener?.let {
                openIap.removeSubscriptionBillingIssueListener(it)
            }
            subscriptionBillingIssueNativeListener = null
            subscriptionBillingIssueAttached = false
        }
    }

    private fun clearSubscriptionBillingIssueListeners() {
        synchronized(subscriptionBillingIssueAttachLock) {
            synchronized(subscriptionBillingIssueListeners) {
                subscriptionBillingIssueListeners.clear()
            }
            detachSubscriptionBillingIssueIfNeeded()
        }
    }

    // -------------------------------------------------------------------------
    // Billing Programs API (Android 8.2.0+)
    // -------------------------------------------------------------------------

    // Create OpenIapStore lazily for Billing Programs API
    private val openIapStore: OpenIapStore by lazy { OpenIapStore(openIap) }

    override fun enableBillingProgramAndroid(program: BillingProgramAndroid) {
        RnIapLog.payload("enableBillingProgramAndroid", mapOf("program" to program.name))
        try {
            val openIapProgram = mapBillingProgram(program)
            openIapStore.enableBillingProgram(openIapProgram)
            RnIapLog.result("enableBillingProgramAndroid", true)
        } catch (err: Throwable) {
            RnIapLog.failure("enableBillingProgramAndroid", err)
            // enableBillingProgram is void, so we just log the error
        }
    }

    override fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): Promise<NitroBillingProgramAvailabilityResultAndroid> {
        return Promise.async {
            RnIapLog.payload("isBillingProgramAvailableAndroid", mapOf("program" to program.name))
            try {
                ensureConnection()
                val openIapProgram = mapBillingProgram(program)
                val result = openIapStore.isBillingProgramAvailable(openIapProgram)
                val nitroResult = NitroBillingProgramAvailabilityResultAndroid(
                    billingProgram = program,
                    choiceScreenType = result.choiceScreenType?.let { mapBillingChoiceScreenType(it) },
                    isAvailable = result.isAvailable,
                    isExternalLinkAvailable = result.isExternalLinkAvailable.wrapVariant()
                )
                RnIapLog.result("isBillingProgramAvailableAndroid", mapOf("isAvailable" to result.isAvailable))
                nitroResult
            } catch (err: Throwable) {
                RnIapLog.failure("isBillingProgramAvailableAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    override fun getBillingChoiceInfoAndroid(params: NitroGetBillingChoiceInfoParamsAndroid): Promise<NitroBillingChoiceInfoAndroid> {
        return Promise.async {
            RnIapLog.payload("getBillingChoiceInfoAndroid", mapOf(
                "billingProgram" to params.billingProgram.name,
                "playBillingChoiceImageLayout" to params.playBillingChoiceImageLayout.name,
                "userLocale" to params.userLocale.unwrapString()
            ))
            try {
                ensureConnection()
                val result = openIapStore.getBillingChoiceInfo(
                    OpenIapGetBillingChoiceInfoParams(
                        billingProgram = mapBillingProgram(params.billingProgram),
                        playBillingChoiceImageLayout = mapBillingChoiceImageLayout(params.playBillingChoiceImageLayout),
                        userLocale = params.userLocale.unwrapString()
                    )
                )
                val nitroResult = NitroBillingChoiceInfoAndroid(
                    playBillingChoiceImageUrl = result.playBillingChoiceImageUrl,
                    playBillingLoyaltyInfo = result.playBillingLoyaltyInfo.wrapVariant()
                )
                RnIapLog.result("getBillingChoiceInfoAndroid", mapOf("hasImageUrl" to result.playBillingChoiceImageUrl.isNotBlank()))
                nitroResult
            } catch (err: Throwable) {
                RnIapLog.failure("getBillingChoiceInfoAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    override fun createBillingProgramReportingDetailsAndroid(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): Promise<NitroBillingProgramReportingDetailsAndroid> {
        return Promise.async {
            RnIapLog.payload(
                "createBillingProgramReportingDetailsAndroid",
                mapOf("program" to program.name, "developerBillingType" to developerBillingType?.name)
            )
            try {
                ensureConnection()
                val openIapProgram = mapBillingProgram(program)
                val result = openIapStore.createBillingProgramReportingDetails(
                    openIapProgram,
                    mapDeveloperBillingType(developerBillingType)
                )
                val nitroResult = NitroBillingProgramReportingDetailsAndroid(
                    billingProgram = program,
                    externalTransactionToken = result.externalTransactionToken
                )
                RnIapLog.result("createBillingProgramReportingDetailsAndroid", mapOf("hasToken" to true))
                nitroResult
            } catch (err: Throwable) {
                RnIapLog.failure("createBillingProgramReportingDetailsAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    override fun showBillingProgramInformationDialogAndroid(
        params: NitroBillingProgramInformationDialogParamsAndroid
    ): Promise<NitroBillingResultAndroid> {
        return Promise.async {
            RnIapLog.payload("showBillingProgramInformationDialogAndroid", mapOf("program" to params.billingProgram.name))
            try {
                ensureConnection()
                val activity = withContext(Dispatchers.Main) {
                    runCatching { context.currentActivity }.getOrNull()
                } ?: throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Activity not available"))
                val result = withContext(Dispatchers.Main) {
                    openIapStore.showBillingProgramInformationDialog(
                        activity,
                        OpenIapBillingProgramInformationDialogParams(
                            billingProgram = mapBillingProgram(params.billingProgram),
                            externalTransactionToken = params.externalTransactionToken
                        )
                    )
                }
                RnIapLog.result("showBillingProgramInformationDialogAndroid", mapOf("responseCode" to result.responseCode))
                NitroBillingResultAndroid(
                    responseCode = result.responseCode.toDouble(),
                    debugMessage = result.debugMessage.wrapVariant(),
                    subResponseCode = mapSubResponseCode(result.subResponseCode)
                )
            } catch (err: Throwable) {
                RnIapLog.failure("showBillingProgramInformationDialogAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    override fun showInAppMessagesAndroid(
        params: Variant_NullType_NitroInAppMessageParamsAndroid?
    ): Promise<NitroInAppMessageResultAndroid> {
        return Promise.async {
            val messageParams = params?.asSecondOrNull()
            val categories = messageParams?.categories?.asSecondOrNull()
            RnIapLog.payload("showInAppMessagesAndroid", mapOf("categories" to categories?.map { it.name }))
            try {
                ensureConnection()
                val activity = withContext(Dispatchers.Main) {
                    runCatching { context.currentActivity }.getOrNull()
                } ?: throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Activity not available"))
                val result = withContext(Dispatchers.Main) {
                    openIapStore.showInAppMessages(
                        activity,
                        messageParams?.let {
                            OpenIapInAppMessageParams(
                                categories = categories?.map { category -> mapInAppMessageCategory(category) }
                            )
                        }
                    )
                }
                RnIapLog.result("showInAppMessagesAndroid", mapOf("responseCode" to result.responseCode.name))
                NitroInAppMessageResultAndroid(
                    responseCode = mapInAppMessageResponseCode(result.responseCode),
                    purchaseToken = result.purchaseToken.wrapVariant()
                )
            } catch (err: Throwable) {
                RnIapLog.failure("showInAppMessagesAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message), err)
            }
        }
    }

    override fun launchExternalLinkAndroid(params: NitroLaunchExternalLinkParamsAndroid): Promise<Boolean> {
        return Promise.async {
            RnIapLog.payload("launchExternalLinkAndroid", mapOf(
                "billingProgram" to params.billingProgram.name,
                "launchMode" to params.launchMode.name,
                "linkType" to params.linkType.name,
                "linkUri" to params.linkUri
            ))
            try {
                ensureConnection()

                val activity = withContext(Dispatchers.Main) {
                    runCatching { context.currentActivity }.getOrNull()
                } ?: throw OpenIapException(toErrorJson(OpenIapError.DeveloperError(), debugMessage = "Activity not available"))

                val openIapParams = OpenIapLaunchExternalLinkParams(
                    billingProgram = mapBillingProgram(params.billingProgram),
                    externalTransactionToken = params.externalTransactionToken.unwrapString(),
                    launchMode = mapExternalLinkLaunchMode(params.launchMode),
                    linkType = mapExternalLinkType(params.linkType),
                    linkUri = params.linkUri
                )

                val result = withContext(Dispatchers.Main) {
                    openIapStore.launchExternalLink(activity, openIapParams)
                }
                RnIapLog.result("launchExternalLinkAndroid", result)
                result
            } catch (err: Throwable) {
                RnIapLog.failure("launchExternalLinkAndroid", err)
                val errorType = parseOpenIapError(err)
                throw OpenIapException(toErrorJson(errorType, debugMessage = err.message))
            }
        }
    }

    // Billing Programs helper functions
    private fun mapBillingProgram(program: BillingProgramAndroid): OpenIapBillingProgramAndroid {
        return when (program) {
            BillingProgramAndroid.UNSPECIFIED -> OpenIapBillingProgramAndroid.Unspecified
            BillingProgramAndroid.EXTERNAL_CONTENT_LINK -> OpenIapBillingProgramAndroid.ExternalContentLink
            BillingProgramAndroid.EXTERNAL_OFFER -> OpenIapBillingProgramAndroid.ExternalOffer
            BillingProgramAndroid.EXTERNAL_PAYMENTS -> OpenIapBillingProgramAndroid.ExternalPayments
            BillingProgramAndroid.USER_CHOICE_BILLING -> OpenIapBillingProgramAndroid.UserChoiceBilling
            BillingProgramAndroid.BILLING_CHOICE -> OpenIapBillingProgramAndroid.BillingChoice
        }
    }

    private fun mapBillingChoiceImageLayout(layout: BillingChoiceImageLayoutAndroid): OpenIapBillingChoiceImageLayout {
        return when (layout) {
            BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE -> OpenIapBillingChoiceImageLayout.RectangularFourByOne
            BillingChoiceImageLayoutAndroid.RECTANGULAR_THREE_BY_ONE -> OpenIapBillingChoiceImageLayout.RectangularThreeByOne
            BillingChoiceImageLayoutAndroid.RECTANGULAR_TWO_BY_TWO -> OpenIapBillingChoiceImageLayout.RectangularTwoByTwo
        }
    }

    private fun mapBillingChoiceScreenType(type: OpenIapBillingChoiceScreenType): BillingChoiceScreenTypeAndroid {
        return when (type) {
            OpenIapBillingChoiceScreenType.Unspecified -> BillingChoiceScreenTypeAndroid.UNSPECIFIED
            OpenIapBillingChoiceScreenType.DeveloperRendered -> BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED
            OpenIapBillingChoiceScreenType.GoogleRendered -> BillingChoiceScreenTypeAndroid.GOOGLE_RENDERED
        }
    }

    private fun mapBillingChoiceScreenTypeToOpenIap(
        type: BillingChoiceScreenTypeAndroid
    ): OpenIapBillingChoiceScreenType {
        return when (type) {
            BillingChoiceScreenTypeAndroid.UNSPECIFIED -> OpenIapBillingChoiceScreenType.Unspecified
            BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED -> OpenIapBillingChoiceScreenType.DeveloperRendered
            BillingChoiceScreenTypeAndroid.GOOGLE_RENDERED -> OpenIapBillingChoiceScreenType.GoogleRendered
        }
    }

    private fun mapDeveloperBillingType(type: DeveloperBillingTypeAndroid?): OpenIapDeveloperBillingType? {
        return when (type) {
            null, DeveloperBillingTypeAndroid.DEVELOPER_BILLING_TYPE_UNSPECIFIED -> null
            DeveloperBillingTypeAndroid.IN_APP -> OpenIapDeveloperBillingType.InApp
            DeveloperBillingTypeAndroid.EXTERNAL_LINK -> OpenIapDeveloperBillingType.ExternalLink
        }
    }

    private fun mapSubResponseCode(
        code: OpenIapSubResponseCodeAndroid?
    ): SubResponseCodeAndroid? = when (code) {
        null -> null
        OpenIapSubResponseCodeAndroid.NoApplicableSubResponseCode ->
            SubResponseCodeAndroid.NO_APPLICABLE_SUB_RESPONSE_CODE
        OpenIapSubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds ->
            SubResponseCodeAndroid.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS
        OpenIapSubResponseCodeAndroid.UserIneligible ->
            SubResponseCodeAndroid.USER_INELIGIBLE
    }

    private fun mapDeveloperBillingOption(
        option: DeveloperBillingOptionParamsAndroid
    ): OpenIapDeveloperBillingOptionParams {
        val launchMode = when (option.launchMode) {
            null -> null
            DeveloperBillingLaunchModeAndroid.UNSPECIFIED -> OpenIapDeveloperBillingLaunchMode.Unspecified
            DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP ->
                OpenIapDeveloperBillingLaunchMode.LaunchInExternalBrowserOrApp
            DeveloperBillingLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK ->
                OpenIapDeveloperBillingLaunchMode.CallerWillLaunchLink
        }
        return OpenIapDeveloperBillingOptionParams(
            billingProgram = mapBillingProgram(option.billingProgram),
            externalTransactionToken = option.externalTransactionToken.unwrapString(),
            launchMode = launchMode,
            linkUri = option.linkUri.unwrapString()
        )
    }

    private fun mapInAppMessageCategory(category: InAppMessageCategoryAndroid): OpenIapInAppMessageCategory {
        return when (category) {
            InAppMessageCategoryAndroid.UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID -> OpenIapInAppMessageCategory.UnknownInAppMessageCategoryId
            InAppMessageCategoryAndroid.TRANSACTIONAL -> OpenIapInAppMessageCategory.Transactional
        }
    }

    private fun mapInAppMessageResponseCode(code: OpenIapInAppMessageResponseCode): InAppMessageResponseCodeAndroid {
        return when (code) {
            OpenIapInAppMessageResponseCode.NoActionNeeded -> InAppMessageResponseCodeAndroid.NO_ACTION_NEEDED
            OpenIapInAppMessageResponseCode.SubscriptionStatusUpdated -> InAppMessageResponseCodeAndroid.SUBSCRIPTION_STATUS_UPDATED
        }
    }

    private fun mapExternalLinkLaunchMode(mode: ExternalLinkLaunchModeAndroid): OpenIapExternalLinkLaunchMode {
        return when (mode) {
            ExternalLinkLaunchModeAndroid.UNSPECIFIED -> OpenIapExternalLinkLaunchMode.Unspecified
            ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP -> OpenIapExternalLinkLaunchMode.LaunchInExternalBrowserOrApp
            ExternalLinkLaunchModeAndroid.CALLER_WILL_LAUNCH_LINK -> OpenIapExternalLinkLaunchMode.CallerWillLaunchLink
        }
    }

    private fun mapExternalLinkType(type: ExternalLinkTypeAndroid): OpenIapExternalLinkType {
        return when (type) {
            ExternalLinkTypeAndroid.UNSPECIFIED -> OpenIapExternalLinkType.Unspecified
            ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER -> OpenIapExternalLinkType.LinkToDigitalContentOffer
            ExternalLinkTypeAndroid.LINK_TO_APP_DOWNLOAD -> OpenIapExternalLinkType.LinkToAppDownload
        }
    }

    // -------------------------------------------------------------------------
    // External Purchase (iOS) - Not supported on Android
    // -------------------------------------------------------------------------

    override fun canPresentExternalPurchaseNoticeIOS(): Promise<Boolean> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun presentExternalPurchaseNoticeSheetIOS(): Promise<ExternalPurchaseNoticeResultIOS> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun presentExternalPurchaseLinkIOS(url: String): Promise<ExternalPurchaseLinkResultIOS> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    // ExternalPurchaseCustomLink (iOS 18.1+) - iOS only stubs
    override fun isEligibleForExternalPurchaseCustomLinkIOS(): Promise<Boolean> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun getExternalPurchaseCustomLinkTokenIOS(tokenType: ExternalPurchaseCustomLinkTokenTypeIOS): Promise<ExternalPurchaseCustomLinkTokenResultIOS> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    override fun showExternalPurchaseCustomLinkNoticeIOS(noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS): Promise<ExternalPurchaseCustomLinkNoticeResultIOS> {
        return Promise.async {
            throw OpenIapException(toErrorJson(OpenIapError.FeatureNotSupported()))
        }
    }

    // ---------------------------------------------------------------------
    // OpenIAP error helpers: unify error codes/messages from library
    // ---------------------------------------------------------------------
    private fun parseOpenIapError(err: Throwable): OpenIapError {
        // Try to extract OpenIapError from the exception chain
        var cause: Throwable? = err
        while (cause != null) {
            val message = cause.message ?: ""
            // Check if message contains OpenIAP error patterns
            when {
                message.contains("not prepared", ignoreCase = true) ||
                message.contains("not initialized", ignoreCase = true) -> return OpenIapError.NotPrepared
                message.contains("developer error", ignoreCase = true) ||
                message.contains("activity not available", ignoreCase = true) -> return OpenIapError.DeveloperError()
                message.contains("network", ignoreCase = true) -> return OpenIapError.NetworkError
                message.contains("service unavailable", ignoreCase = true) ||
                message.contains("billing unavailable", ignoreCase = true) -> return OpenIapError.ServiceUnavailable()
            }
            cause = cause.cause
        }
        // Default to ServiceUnavailable if we can't determine the error type
        return OpenIapError.ServiceUnavailable()
    }

    private fun toErrorJson(
        error: OpenIapError,
        productId: String? = null,
        debugMessage: String? = null,
        messageOverride: String? = null
    ): String {
        val code = OpenIapError.Companion.toCode(error)
        val message = messageOverride?.takeIf { it.isNotBlank() }
            ?: error.message?.takeIf { it.isNotBlank() }
            ?: OpenIapError.Companion.defaultMessage(code)
        val diagnostics = error.toJSON()
        val responseCode = (diagnostics["responseCode"] as? Number)?.toInt()
        val diagnosticProductId = productId
            ?: diagnostics["productId"] as? String
            ?: when (error) {
                is OpenIapError.ProductNotFound -> error.productId
                is OpenIapError.SkuNotFound -> error.sku
                else -> null
            }
        val productIds = diagnostics["productIds"] as? List<*>
        val productType = diagnostics["productType"] as? String
        val isEmptyProductList = diagnostics["isEmptyProductList"] as? Boolean

        val errorMap = mutableMapOf<String, Any?>(
            "code" to code,
            "message" to message
        )

        responseCode?.let { errorMap["responseCode"] = it }
        debugMessage
            ?.let { errorMap["debugMessage"] = it }
            ?: (diagnostics["debugMessage"] as? String)?.let { errorMap["debugMessage"] = it }
            ?: error.message?.let { errorMap["debugMessage"] = it }
        diagnosticProductId?.let { errorMap["productId"] = it }
        if (!productIds.isNullOrEmpty()) errorMap["productIds"] = productIds
        productType?.let { errorMap["productType"] = it }
        isEmptyProductList?.let { errorMap["isEmptyProductList"] = it }
        (diagnostics["subResponseCodeAndroid"] as? String)?.let {
            errorMap["subResponseCodeAndroid"] = it
        }

        return try {
            JSONObject(errorMap).toString()
        } catch (e: Exception) {
            "$code: $message"
        }
    }

    // Helper functions to map OpenIAP enum values to Nitro enum values
    private fun mapIapkitPurchaseState(stateName: String): IapkitPurchaseState {
        return when (stateName.uppercase()) {
            "ENTITLED" -> IapkitPurchaseState.ENTITLED
            "PENDING_ACKNOWLEDGMENT", "PENDING-ACKNOWLEDGMENT" -> IapkitPurchaseState.PENDING_ACKNOWLEDGMENT
            "PENDING" -> IapkitPurchaseState.PENDING
            "CANCELED" -> IapkitPurchaseState.CANCELED
            "EXPIRED" -> IapkitPurchaseState.EXPIRED
            "READY_TO_CONSUME", "READY-TO-CONSUME" -> IapkitPurchaseState.READY_TO_CONSUME
            "CONSUMED" -> IapkitPurchaseState.CONSUMED
            "INAUTHENTIC" -> IapkitPurchaseState.INAUTHENTIC
            else -> IapkitPurchaseState.UNKNOWN
        }
    }

    private fun mapIapkitStore(storeName: String): IapStore {
        return when (storeName.uppercase()) {
            "APPLE" -> IapStore.APPLE
            "GOOGLE" -> IapStore.GOOGLE
            "HORIZON" -> IapStore.HORIZON
            "AMAZON" -> IapStore.AMAZON
            else -> IapStore.UNKNOWN
        }
    }

    private fun mapPurchaseVerificationProvider(providerName: String): PurchaseVerificationProvider {
        return when (providerName.uppercase()) {
            "IAPKIT" -> PurchaseVerificationProvider.IAPKIT
            else -> PurchaseVerificationProvider.NONE
        }
    }

    /**
     * Read IAPKit API key from AndroidManifest.xml meta-data.
     * Host app sets: <meta-data android:name="dev.iapkit.API_KEY" android:value="..." />
     */
    private fun getIapkitApiKeyFromManifest(): String? {
        return try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            appInfo.metaData?.getString("dev.iapkit.API_KEY")
        } catch (e: Exception) {
            null
        }
    }

    private fun toErrorResult(
        error: OpenIapError,
        productId: String? = null,
        debugMessage: String? = null,
        messageOverride: String? = null
    ): NitroPurchaseResult {
        val code = OpenIapError.Companion.toCode(error)
        val message = messageOverride?.takeIf { it.isNotBlank() }
            ?: error.message?.takeIf { it.isNotBlank() }
            ?: OpenIapError.Companion.defaultMessage(code)
        val diagnostics = error.toJSON()
        val responseCode = (diagnostics["responseCode"] as? Number)?.toDouble()
        val diagnosticMessage = diagnostics["debugMessage"] as? String
        val diagnosticProductId = productId
            ?: diagnostics["productId"] as? String
            ?: when (error) {
                is OpenIapError.ProductNotFound -> error.productId
                is OpenIapError.SkuNotFound -> error.sku
                else -> null
            }
        val productIds = (diagnostics["productIds"] as? Iterable<*>)
            ?.filterIsInstance<String>()
            ?.toTypedArray()
        val subResponseCode = (diagnostics["subResponseCodeAndroid"] as? String)?.let {
            runCatching { OpenIapSubResponseCodeAndroid.fromJson(it) }.getOrNull()
        }
        return NitroPurchaseResult(
            responseCode = responseCode ?: -1.0,
            debugMessage = debugMessage ?: diagnosticMessage ?: error.message,
            code = code,
            message = message,
            purchaseToken = null,
            productId = diagnosticProductId,
            productIds = productIds,
            productType = diagnostics["productType"] as? String,
            isEmptyProductList = diagnostics["isEmptyProductList"] as? Boolean,
            subResponseCodeAndroid = mapSubResponseCode(subResponseCode)
        )
    }
}
