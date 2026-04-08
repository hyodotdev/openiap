package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.AlternativeBillingOnlyReportingDetails
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.ExternalOfferReportingDetails
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.UserChoiceBillingListener
import io.github.hyochan.kmpiap.clearProductCache
import io.github.hyochan.kmpiap.ensureConnectedOrFail
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.AlternativeBillingModeAndroid
import io.github.hyochan.kmpiap.ConnectionResult
import io.github.hyochan.kmpiap.openiap.AndroidSubscriptionOfferInput
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseLinkResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import io.github.hyochan.kmpiap.openiap.UserChoiceBillingDetails
import io.github.hyochan.kmpiap.openiap.FetchProductsResult
import io.github.hyochan.kmpiap.openiap.FetchProductsResultProducts
import io.github.hyochan.kmpiap.openiap.FetchProductsResultSubscriptions
import io.github.hyochan.kmpiap.openiap.MutationDeepLinkToSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.MutationEndConnectionHandler
import io.github.hyochan.kmpiap.openiap.MutationInitConnectionHandler
import io.github.hyochan.kmpiap.openiap.MutationFinishTransactionHandler
import io.github.hyochan.kmpiap.openiap.MutationRequestPurchaseHandler
import io.github.hyochan.kmpiap.openiap.MutationValidateReceiptHandler
import io.github.hyochan.kmpiap.openiap.MutationHandlers
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.ProductIOS
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseOptions
import io.github.hyochan.kmpiap.openiap.QueryFetchProductsHandler
import io.github.hyochan.kmpiap.openiap.QueryGetActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.QueryGetAvailablePurchasesHandler
import io.github.hyochan.kmpiap.openiap.QueryHasActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.QueryHandlers
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResult
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchase
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchases
import io.github.hyochan.kmpiap.openiap.AppTransaction
import io.github.hyochan.kmpiap.openiap.SubscriptionStatusIOS
import io.github.hyochan.kmpiap.openiap.PurchaseInput
import io.github.hyochan.kmpiap.openiap.SubscriptionHandlers
import io.github.hyochan.kmpiap.Store
import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAvailabilityResultAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramReportingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperBillingLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperBillingOptionParamsAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperProvidedBillingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkLaunchModeAndroid
import io.github.hyochan.kmpiap.openiap.ExternalLinkTypeAndroid
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionProductReplacementParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps as GoogleVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps as GoogleVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit as verifyPurchaseWithIapkitGoogle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.collections.buildList
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class InAppPurchaseAndroid : KmpInAppPurchase, Application.ActivityLifecycleCallbacks {

    private var billingClient: BillingClient? = null
    private var isConnected = false
    private var context: Context? = null
    private var currentActivity: Activity? = null
    private var activityCallbacksDisposer: (() -> Unit)? = null
    private val cachedProductDetails = ConcurrentHashMap<String, ProductDetails>()
    private var currentPurchaseCallback: ((Result<List<Purchase>>) -> Unit)? = null
    private var alternativeBillingMode: AlternativeBillingModeAndroid = AlternativeBillingModeAndroid.None
    private var enabledBillingProgram: BillingProgramAndroid? = null

    // ---------------------------------------------------------------------
    // Event streams
    // ---------------------------------------------------------------------
    private val _purchaseUpdatedListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedListener.asSharedFlow()

    private val _purchaseErrorListener = MutableSharedFlow<PurchaseError>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorListener.asSharedFlow()

    private val _connectionStateListener = MutableSharedFlow<ConnectionResult>(replay = 1, extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val connectionStateListener: Flow<ConnectionResult> = _connectionStateListener.asSharedFlow()

    private val _promotedProductListener = MutableSharedFlow<String?>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val promotedProductListener: Flow<String?> = _promotedProductListener.asSharedFlow()

    private val _userChoiceBillingListener = MutableSharedFlow<UserChoiceBillingDetails>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val userChoiceBillingListener: Flow<UserChoiceBillingDetails> = _userChoiceBillingListener.asSharedFlow()

    private val _developerProvidedBillingListener = MutableSharedFlow<DeveloperProvidedBillingDetailsAndroid>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val developerProvidedBillingListener: Flow<DeveloperProvidedBillingDetailsAndroid> = _developerProvidedBillingListener.asSharedFlow()

    private fun failWith(error: PurchaseError): Nothing =
        emitFailureAndThrow(_purchaseErrorListener, error)

    private fun mapFetchResultToProducts(
        params: ProductRequest,
        result: FetchProductsResult
    ): List<Product> = mapFetchResultToProductsHelper(params, result, cachedProductDetails)

    // ---------------------------------------------------------------------
    // Mutation handlers
    // ---------------------------------------------------------------------
    private val initConnectionHandler: MutationInitConnectionHandler = { config ->
        withContext(Dispatchers.IO) {
            // Set alternative billing mode (reset to None if no config supplied)
            alternativeBillingMode = config?.alternativeBillingModeAndroid ?: AlternativeBillingModeAndroid.None
            // Track enabled billing program for validation
            enabledBillingProgram = config?.enableBillingProgramAndroid

            if (context == null) {
                val disposer = tryCaptureApplication(
                    callback = this@InAppPurchaseAndroid,
                    onContextAvailable = { appContext -> context = appContext },
                    onActivityFound = { activity -> currentActivity = activity }
                )
                if (context != null) {
                    activityCallbacksDisposer = disposer
                } else {
                    disposer?.invoke()
                }
            }

            val ctx = context ?: run {
                activityCallbacksDisposer = null
                failWith(
                    PurchaseError(code = ErrorCode.ServiceError, message = "Context not available")
                )
            }

            withTimeout(15_000) {
                suspendCancellableCoroutine { continuation ->
                    val listener = object : BillingClientStateListener {
                        override fun onBillingSetupFinished(result: BillingResult) {
                            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                                isConnected = true
                                _connectionStateListener.tryEmit(ConnectionResult(connected = true, message = "Connected"))
                                continuation.resume(true)
                            } else {
                                val error = PurchaseError(
                                    code = ErrorCode.ServiceError,
                                    message = result.debugMessage ?: "Failed to connect"
                                )
                                _purchaseErrorListener.tryEmit(error)
                                continuation.resume(false)
                            }
                        }

                        override fun onBillingServiceDisconnected() {
                            isConnected = false
                            _connectionStateListener.tryEmit(ConnectionResult(connected = false, message = "Disconnected"))
                        }
                    }

                    val builder = BillingClient.newBuilder(ctx)
                        .setListener { billingResult, purchases ->
                            handlePurchaseUpdate(billingResult, purchases)
                        }

                    // Configure alternative billing if specified
                    when (alternativeBillingMode) {
                        AlternativeBillingModeAndroid.UserChoice -> {
                            builder.enableUserChoiceBilling { userChoiceDetails ->
                                val details = UserChoiceBillingDetails(
                                    externalTransactionToken = userChoiceDetails.externalTransactionToken,
                                    products = userChoiceDetails.products.map { it.id }
                                )
                                _userChoiceBillingListener.tryEmit(details)
                            }
                        }
                        AlternativeBillingModeAndroid.AlternativeOnly -> {
                            builder.enableAlternativeBillingOnly()
                        }
                        AlternativeBillingModeAndroid.None -> {
                            // Standard billing, no changes needed
                        }
                    }

                    // Enable billing program from config (8.2.0+, EXTERNAL_PAYMENTS requires 8.3.0+)
                    config?.enableBillingProgramAndroid?.let { program ->
                        if (program == BillingProgramAndroid.ExternalPayments) {
                            enableExternalPaymentsProgram(builder)
                        } else {
                            enableBillingProgram(builder, program)
                        }
                    }

                    billingClient = enablePendingPurchasesCompat(builder).build()
                    billingClient?.startConnection(listener)

                    continuation.invokeOnCancellation {
                        billingClient?.endConnection()
                        billingClient = null
                    }
                }
            }
        }
    }

    private val endConnectionHandler: MutationEndConnectionHandler = {
        withContext(Dispatchers.IO) {
            runCatching {
                billingClient?.endConnection()
                billingClient = null
                isConnected = false
                activityCallbacksDisposer?.invoke()
                activityCallbacksDisposer = null
                _connectionStateListener.tryEmit(ConnectionResult(connected = false, message = "Disconnected"))
                clearProductCache(cachedProductDetails)
                true
            }.getOrElse { false }
        }
    }

    private val requestPurchaseHandler: MutationRequestPurchaseHandler = { props ->
        val purchases = withContext(Dispatchers.Main) {
            val resolvedType = props.type ?: when (props.request) {
                is RequestPurchaseProps.Request.Purchase -> ProductQueryType.InApp
                is RequestPurchaseProps.Request.Subscription -> ProductQueryType.Subs
            }

            val purchaseAndroidOptions = (props.request as? RequestPurchaseProps.Request.Purchase)?.value?.android
            val subscriptionAndroidOptions = (props.request as? RequestPurchaseProps.Request.Subscription)?.value?.android

            val subscriptionOffers: List<AndroidSubscriptionOfferInput> =
                subscriptionAndroidOptions?.subscriptionOffers.orEmpty()

            val purchaseToken = subscriptionAndroidOptions?.purchaseToken
            val replacementMode = subscriptionAndroidOptions?.replacementMode
            val subscriptionProductReplacementParams = subscriptionAndroidOptions?.subscriptionProductReplacementParams

            val targetSkus: List<String> =
                purchaseAndroidOptions?.skus ?: subscriptionAndroidOptions?.skus ?: emptyList()

            val isOfferPersonalized = purchaseAndroidOptions?.isOfferPersonalized
                ?: subscriptionAndroidOptions?.isOfferPersonalized
            val obfuscatedAccountId = purchaseAndroidOptions?.obfuscatedAccountId
                ?: subscriptionAndroidOptions?.obfuscatedAccountId
            val obfuscatedProfileId = purchaseAndroidOptions?.obfuscatedProfileId
                ?: subscriptionAndroidOptions?.obfuscatedProfileId
            // offerToken for one-time purchase discounts (Android 7.0+)
            val oneTimePurchaseOfferToken = purchaseAndroidOptions?.offerToken
            val developerBillingOption = purchaseAndroidOptions?.developerBillingOption
                ?: subscriptionAndroidOptions?.developerBillingOption
            if (targetSkus.isEmpty()) {
                _purchaseErrorListener.tryEmit(
                    PurchaseError(code = ErrorCode.EmptySkuList, message = "SKU list is empty")
                )
                return@withContext emptyList()
            }

            val activity = currentActivity
            if (activity == null) {
                _purchaseErrorListener.tryEmit(
                    PurchaseError(code = ErrorCode.ActivityUnavailable, message = "Activity not available for purchase")
                )
                return@withContext emptyList()
            }

            val client = billingClient
            if (client == null || !client.isReady) {
                _purchaseErrorListener.tryEmit(
                    PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready")
                )
                return@withContext emptyList()
            }

            val desiredProductType =
                if (resolvedType == ProductQueryType.Subs) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

            val productDetailsBySku = loadProductDetails(
                client = client,
                productType = desiredProductType,
                skus = targetSkus,
                cache = cachedProductDetails,
                errorFlow = _purchaseErrorListener
            )
                ?: return@withContext emptyList()

            // Guard: oneTimePurchaseOfferToken requires exactly one SKU
            if (desiredProductType == BillingClient.ProductType.INAPP &&
                oneTimePurchaseOfferToken != null &&
                targetSkus.size > 1
            ) {
                _purchaseErrorListener.tryEmit(
                    PurchaseError(
                        code = ErrorCode.SkuOfferMismatch,
                        message = "oneTimePurchaseOfferToken requires a single in-app SKU"
                    )
                )
                return@withContext emptyList()
            }

            suspendCancellableCoroutine<List<Purchase>> { continuation ->
                currentPurchaseCallback = { result ->
                    if (continuation.isActive) continuation.resume(result.getOrDefault(emptyList()))
                }

                val paramsList = mutableListOf<BillingFlowParams.ProductDetailsParams>()
                val offersBySku = subscriptionOffers
                    .groupBy(AndroidSubscriptionOfferInput::sku)
                    .mapValues { entry -> entry.value.toMutableList() }
                    .toMutableMap()

                var mismatch = false
                for (sku in targetSkus) {
                    val detail = productDetailsBySku[sku] ?: continue
                    val builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(detail)

                    if (desiredProductType == BillingClient.ProductType.SUBS) {
                        val availableTokens = detail.subscriptionOfferDetails?.map { it.offerToken }.orEmpty()
                        val queuedToken = offersBySku[detail.productId]?.takeIf { it.isNotEmpty() }?.removeAt(0)?.offerToken
                        val resolvedToken = queuedToken ?: detail.subscriptionOfferDetails?.firstOrNull()?.offerToken

                        if (resolvedToken.isNullOrEmpty() || (availableTokens.isNotEmpty() && !availableTokens.contains(resolvedToken))) {
                            _purchaseErrorListener.tryEmit(
                                PurchaseError(
                                    code = ErrorCode.SkuOfferMismatch,
                                    message = "Offer token mismatch for ${detail.productId}"
                                )
                            )
                            continuation.resume(emptyList())
                            currentPurchaseCallback = null
                            mismatch = true
                            break
                        }

                        builder.setOfferToken(resolvedToken)

                        // Apply item-level subscription replacement params (8.1.0+)
                        subscriptionProductReplacementParams?.let { params ->
                            val replacementParamsBuilder = BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.newBuilder()
                                .setOldProductId(params.oldProductId)
                            mapReplacementMode(params.replacementMode)?.let { mode ->
                                replacementParamsBuilder.setReplacementMode(mode)
                            }
                            builder.setSubscriptionProductReplacementParams(replacementParamsBuilder.build())
                        }
                    } else {
                        // Handle offerToken for one-time purchase discounts (Android 7.0+)
                        oneTimePurchaseOfferToken?.let { token ->
                            builder.setOfferToken(token)
                        }
                    }

                    paramsList += builder.build()
                }

                if (mismatch) return@suspendCancellableCoroutine

                val flowBuilder = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(paramsList)

                if (isOfferPersonalized == true) {
                    flowBuilder.setIsOfferPersonalized(true)
                }
                obfuscatedAccountId?.let { accountId ->
                    flowBuilder.setObfuscatedAccountId(accountId)
                }
                obfuscatedProfileId?.let { profileId ->
                    flowBuilder.setObfuscatedProfileId(profileId)
                }

                if (desiredProductType == BillingClient.ProductType.SUBS && !purchaseToken.isNullOrEmpty()) {
                    val updateParamsBuilder = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                        .setOldPurchaseToken(purchaseToken)
                    replacementMode?.let(updateParamsBuilder::setSubscriptionReplacementMode)
                    flowBuilder.setSubscriptionUpdateParams(updateParamsBuilder.build())
                }

                // Apply developer billing option for External Payments flow (8.3.0+)
                developerBillingOption?.let { option ->
                    applyDeveloperBillingOption(flowBuilder, option)
                }

                val launchResult = billingClient?.launchBillingFlow(activity, flowBuilder.build())
                if (launchResult?.responseCode != BillingClient.BillingResponseCode.OK) {
                    val error = PurchaseError(
                        code = mapBillingResponseCode(launchResult?.responseCode ?: -1),
                        message = launchResult?.debugMessage ?: "Failed to launch billing flow"
                    )
                    _purchaseErrorListener.tryEmit(error)
                    currentPurchaseCallback?.invoke(Result.success(emptyList()))
                    currentPurchaseCallback = null
                }

                continuation.invokeOnCancellation { currentPurchaseCallback = null }
            }
        }

        RequestPurchaseResultPurchases(purchases)
    }

    private val validateReceiptHandler: MutationValidateReceiptHandler = { _ ->
        // Android doesn't support native receipt validation like iOS
        // Use verifyPurchaseWithProvider for server-side verification
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "validateReceipt is not supported on Android. Use verifyPurchaseWithProvider for server-side verification."
            )
        )
    }

    private val deepLinkToSubscriptionsHandler: MutationDeepLinkToSubscriptionsHandler = { options ->
        options?.let { launchDeepLinkToSubscriptions(it) }
    }

    private val finishTransactionHandler: MutationFinishTransactionHandler = finishTransaction@{ purchase, isConsumable ->
        if (purchase.platform != IapPlatform.Android) return@finishTransaction
        val token = purchase.purchaseToken ?: return@finishTransaction
        runCatching {
            if (isConsumable == true) {
                consumePurchaseAndroid(token)
            } else {
                acknowledgePurchaseAndroid(token)
            }
        }.onFailure {
            _purchaseErrorListener.tryEmit(
                PurchaseError(
                    code = ErrorCode.ReceiptFinishedFailed,
                    message = "Failed to finish transaction: ${it.message ?: "unknown"}"
                )
            )
        }
    }

    // ---------------------------------------------------------------------
    // Interface implementation
    // ---------------------------------------------------------------------
    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = initConnectionHandler(config)

    override suspend fun endConnection(): Boolean = endConnectionHandler()

    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        fetchProductsHandler(params)

    override suspend fun requestPurchase(request: RequestPurchaseProps): RequestPurchaseResult? =
        requestPurchaseHandler(request)

    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        getAvailablePurchasesHandler(options)

    suspend fun getPurchaseHistories(options: PurchaseOptions?): List<Purchase> = emptyList()

    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        getActiveSubscriptionsHandler(subscriptionIds)

    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        hasActiveSubscriptionsHandler(subscriptionIds)

    override suspend fun restorePurchases() {
        getAvailablePurchasesHandler.invoke(null)
    }

    override suspend fun currentEntitlementIOS(sku: String): PurchaseIOS? = null

    override suspend fun getAppTransactionIOS(): AppTransaction? = null

    override suspend fun getPendingTransactionsIOS(): List<PurchaseIOS> = emptyList()

    override suspend fun getReceiptDataIOS(): String? = null

    override suspend fun getTransactionJwsIOS(sku: String): String? = null

    override suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean = false

    override suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean = false

    override suspend fun showExternalPurchaseCustomLinkNoticeIOS(
        noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
    ): ExternalPurchaseCustomLinkNoticeResultIOS {
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "showExternalPurchaseCustomLinkNoticeIOS is an iOS-only API (iOS 18.1+)."
            )
        )
    }

    override suspend fun getExternalPurchaseCustomLinkTokenIOS(
        tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
    ): ExternalPurchaseCustomLinkTokenResultIOS {
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "getExternalPurchaseCustomLinkTokenIOS is an iOS-only API (iOS 18.1+)."
            )
        )
    }

    override suspend fun isTransactionVerifiedIOS(sku: String): Boolean = false

    override suspend fun latestTransactionIOS(sku: String): PurchaseIOS? = null

    override suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS> = emptyList()

    override suspend fun validateReceiptIOS(options: VerifyPurchaseProps): VerifyPurchaseResultIOS {
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "validateReceiptIOS is an iOS-only API. Use verifyPurchaseWithProvider for server-side verification on Android."
            )
        )
    }

    suspend fun isPurchaseValid(purchase: Purchase): Boolean = isPurchaseTokenValid(purchase)

    override suspend fun promotedProductIOS(): String = ""

    override suspend fun purchaseError(): PurchaseError = purchaseErrorListener.first()

    override suspend fun purchaseUpdated(): Purchase = purchaseUpdatedListener.first()

    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?) {
        finishTransactionHandler(purchase, isConsumable)
    }

    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?) {
        deepLinkToSubscriptionsHandler(options)
    }

    // ---------------------------------------------------------------------
    // Query handlers
    // ---------------------------------------------------------------------
    private val fetchProductsHandler: QueryFetchProductsHandler = { params ->
        withContext(Dispatchers.IO) {
            val client = billingClient ?: failWith(
                PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not initialized")
            )
            if (!client.isReady) failWith(
                PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready")
            )
            if (params.skus.isEmpty()) failWith(
                PurchaseError(code = ErrorCode.EmptySkuList, message = "SKU list is empty")
            )

            val queryType = params.type ?: ProductQueryType.All
            val includeInApp = queryType == ProductQueryType.InApp || queryType == ProductQueryType.All
            val includeSubs = queryType == ProductQueryType.Subs || queryType == ProductQueryType.All

            suspend fun query(productType: String): List<ProductDetails> {
                val ordered = mutableListOf<ProductDetails>()
                val missing = mutableListOf<String>()

                params.skus.forEach { sku ->
                    val cached = cachedProductDetails[sku]
                    if (cached != null && cached.productType == productType) {
                        ordered += cached
                    } else {
                        missing += sku
                    }
                }

                if (missing.isNotEmpty()) {
                    val queryParams = QueryProductDetailsParams.newBuilder()
                        .setProductList(
                            missing.map { sku ->
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(sku)
                                    .setProductType(productType)
                                    .build()
                            }
                        )
                        .build()

                    val queried = suspendCancellableCoroutine<List<ProductDetails>> { continuation ->
                        client.queryProductDetailsAsync(queryParams) { billingResult: BillingResult, result: QueryProductDetailsResult ->
                            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                                result.productDetailsList?.forEach { detail -> cachedProductDetails[detail.productId] = detail }
                                continuation.resume(result.productDetailsList.orEmpty())
                            } else {
                                continuation.resume(emptyList())
                            }
                        }
                    }

                    missing.forEach { sku ->
                        cachedProductDetails[sku]?.takeIf { it.productType == productType }?.let { ordered += it }
                    }

                    queried.filter { detail -> detail.productType == productType && detail.productId in params.skus }
                        .forEach { detail ->
                            if (!ordered.contains(detail)) ordered += detail
                        }
                }

                return ordered
            }

            val inAppDetails = if (includeInApp) query(BillingClient.ProductType.INAPP) else emptyList()
            val subsDetails = if (includeSubs) query(BillingClient.ProductType.SUBS) else emptyList()

            return@withContext when (queryType) {
                ProductQueryType.InApp -> FetchProductsResultProducts(inAppDetails.map { it.toProduct() })
                ProductQueryType.Subs -> FetchProductsResultSubscriptions(subsDetails.mapNotNull { it.toSubscriptionProduct() })
                ProductQueryType.All -> {
                    val combined = buildList<Product> {
                        addAll(inAppDetails.map { it.toProduct() })
                        addAll(subsDetails.map { it.toProduct() })
                    }
                    FetchProductsResultProducts(combined)
                }
            }
        }
    }

    private val getAvailablePurchasesHandler: QueryGetAvailablePurchasesHandler = { options ->
        withContext(Dispatchers.IO) {
            ensureConnectedOrFail(isConnected, ::failWith)
            val client = billingClient ?: return@withContext emptyList()
            val includeSuspended = options?.includeSuspendedAndroid == true

            suspend fun query(type: String, includeSuspendedSubs: Boolean): List<Purchase> = suspendCancellableCoroutine { continuation ->
                val paramsBuilder = QueryPurchasesParams.newBuilder().setProductType(type)

                // Include suspended subscriptions (Google Play Billing Library 8.1+)
                // Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
                // Users should be directed to the subscription center to resolve payment issues.
                if (type == BillingClient.ProductType.SUBS && includeSuspendedSubs) {
                    runCatching {
                        // Use reflection to maintain backward compatibility with older billing library versions
                        val setIncludeSuspendedMethod = paramsBuilder::class.java.getMethod(
                            "setIncludeSuspended",
                            Boolean::class.javaPrimitiveType
                        )
                        setIncludeSuspendedMethod.invoke(paramsBuilder, true)
                    }
                }

                val params = paramsBuilder.build()
                client.queryPurchasesAsync(params) { result, purchases ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        continuation.resume(purchases.map { it.toPurchase() })
                    } else {
                        continuation.resume(emptyList())
                    }
                }
            }

            val all = mutableListOf<Purchase>()
            all += query(BillingClient.ProductType.INAPP, includeSuspendedSubs = false)
            all += query(BillingClient.ProductType.SUBS, includeSuspendedSubs = includeSuspended)
            all
        }
    }

    private val getActiveSubscriptionsHandler: QueryGetActiveSubscriptionsHandler = { ids ->
        withContext(Dispatchers.IO) {
            ensureConnectedOrFail(isConnected, ::failWith)
            val client = billingClient ?: return@withContext emptyList()

            suspendCancellableCoroutine { continuation ->
                val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
                client.queryPurchasesAsync(params) { result, purchases ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        val active = purchases
                            .filter { purchase -> ids?.let { list -> purchase.products.any(list::contains) } ?: true }
                            .filter { purchase -> purchase.purchaseState == com.android.billingclient.api.Purchase.PurchaseState.PURCHASED }
                            .map { purchase ->
                                ActiveSubscription(
                                    autoRenewingAndroid = purchase.isAutoRenewing,
                                    isActive = true,
                                    productId = purchase.products.firstOrNull().orEmpty(),
                                    purchaseToken = purchase.purchaseToken,
                                    transactionDate = purchase.purchaseTime.toDouble() / 1000,
                                    transactionId = purchase.orderId ?: purchase.purchaseToken,
                                    willExpireSoon = null,
                                    daysUntilExpirationIOS = null,
                                    environmentIOS = null,
                                    expirationDateIOS = null
                                )
                            }
                        continuation.resume(active)
                    } else {
                        continuation.resume(emptyList())
                    }
                }
            }
        }
    }

    private val hasActiveSubscriptionsHandler: QueryHasActiveSubscriptionsHandler = { ids ->
        withContext(Dispatchers.IO) { getActiveSubscriptionsHandler(ids).isNotEmpty() }
    }

    // ---------------------------------------------------------------------
    // Handler collections
    // ---------------------------------------------------------------------
    val queryHandlers: QueryHandlers by lazy {
        QueryHandlers(
            fetchProducts = fetchProductsHandler,
            getAvailablePurchases = getAvailablePurchasesHandler,
            getActiveSubscriptions = getActiveSubscriptionsHandler,
            hasActiveSubscriptions = hasActiveSubscriptionsHandler
        )
    }

    val mutationHandlers: MutationHandlers by lazy {
        MutationHandlers(
            initConnection = initConnectionHandler,
            endConnection = endConnectionHandler,
            requestPurchase = requestPurchaseHandler,
            validateReceipt = validateReceiptHandler,
            deepLinkToSubscriptions = deepLinkToSubscriptionsHandler,
            finishTransaction = finishTransactionHandler,
            acknowledgePurchaseAndroid = { token -> acknowledgePurchaseAndroid(token) },
            consumePurchaseAndroid = { token -> consumePurchaseAndroid(token) },
            restorePurchases = { getAvailablePurchasesHandler.invoke(null) }
        )
    }

    val subscriptionHandlers: SubscriptionHandlers by lazy {
        SubscriptionHandlers(
            purchaseUpdated = { purchaseUpdatedListener.first() },
            purchaseError = { purchaseErrorListener.first() }
        )
    }

    // ---------------------------------------------------------------------
    // Android specific overrides
    // ---------------------------------------------------------------------
    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean {
        ensureConnectedOrFail(isConnected, ::failWith)
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()

        return suspendCancellableCoroutine { continuation ->
            billingClient?.acknowledgePurchase(params) { result ->
                when (result.responseCode) {
                    BillingClient.BillingResponseCode.OK,
                    BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> continuation.resume(true)
                    else -> {
                        val error = PurchaseError(
                            code = ErrorCode.ServiceError,
                            message = "Failed to acknowledge: ${result.debugMessage} (code: ${result.responseCode})"
                        )
                        _purchaseErrorListener.tryEmit(error)
                        continuation.resumeWithException(PurchaseException(error))
                    }
                }
            }
        }
    }

    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean {
        ensureConnectedOrFail(isConnected, ::failWith)
        val params = ConsumeParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()

        return suspendCancellableCoroutine { continuation ->
            billingClient?.consumeAsync(params) { result, _ ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    continuation.resume(true)
                } else {
                    val error = PurchaseError(
                        code = ErrorCode.ServiceError,
                        message = "Failed to consume: ${result.debugMessage} (code: ${result.responseCode})"
                    )
                    _purchaseErrorListener.tryEmit(error)
                    continuation.resumeWithException(PurchaseException(error))
                }
            }
        }
    }

    override suspend fun getStorefrontIOS(): String = ""
    override suspend fun presentCodeRedemptionSheetIOS(): Boolean = false
    suspend fun finishTransactionIOS(transactionId: String) {}
    override suspend fun clearTransactionIOS(): Boolean = false
    suspend fun clearProductsIOS() {}
    override suspend fun getPromotedProductIOS(): ProductIOS? = null
    override suspend fun requestPurchaseOnPromotedProductIOS(): Boolean = false
    override suspend fun beginRefundRequestIOS(sku: String): String? = null
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun syncIOS(): Boolean = false
    override suspend fun validateReceipt(options: ValidationOptions): ValidationResult = validateReceiptHandler(options)

    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult {
        // Android doesn't support native receipt verification like iOS
        // Use verifyPurchaseWithProvider for server-side verification via IAPKit
        failWith(
            PurchaseError(
                code = ErrorCode.FeatureNotSupported,
                message = "verifyPurchase is not supported on Android. Use verifyPurchaseWithProvider for server-side verification via IAPKit."
            )
        )
    }

    override suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult {
        if (options.provider != PurchaseVerificationProvider.Iapkit) {
            failWith(
                PurchaseError(
                    code = ErrorCode.FeatureNotSupported,
                    message = "Verification provider ${options.provider.rawValue} is not supported on Android"
                )
            )
        }

        val iapkitOptions = options.iapkit ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "IAPKit options are required for Android verification"
            )
        )
        val googleOptions = iapkitOptions.google ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "Google purchaseToken is required for Android verification"
            )
        )

        return try {
            val openIapProps = GoogleVerifyPurchaseWithIapkitProps(
                apiKey = iapkitOptions.apiKey,
                apple = null,
                google = GoogleVerifyPurchaseWithIapkitGoogleProps(
                    purchaseToken = googleOptions.purchaseToken
                )
            )

            val googleResult = verifyPurchaseWithIapkitGoogle(openIapProps, "kmp-iap-android")

            val iapkitResult = RequestVerifyPurchaseWithIapkitResult(
                isValid = googleResult.isValid,
                state = IapkitPurchaseState.fromJson(googleResult.state.toJson()),
                store = IapStore.fromJson(googleResult.store.toJson())
            )

            VerifyPurchaseWithProviderResult(
                iapkit = iapkitResult,
                provider = options.provider
            )
        } catch (e: Exception) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = e.message ?: "Purchase verification failed"
                )
            )
        }
    }

    override fun getVersion(): String = ANDROID_VERSION
    override fun getStore(): Store = Store.PLAY_STORE
    override suspend fun canMakePayments(): Boolean = true

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    private fun handlePurchaseUpdate(
        billingResult: BillingResult,
        purchases: List<com.android.billingclient.api.Purchase>?
    ) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchases.orEmpty().map { it.toPurchase() }
            mapped.forEach { _purchaseUpdatedListener.tryEmit(it) }
            currentPurchaseCallback?.invoke(Result.success(mapped))
        } else {
            val error = PurchaseError(
                code = mapBillingResponseCode(billingResult.responseCode),
                message = billingResult.debugMessage ?: "Purchase failed"
            )
            _purchaseErrorListener.tryEmit(error)
            currentPurchaseCallback?.invoke(Result.success(emptyList()))
        }
        currentPurchaseCallback = null
    }

    private fun launchDeepLinkToSubscriptions(options: DeepLinkOptions) {
        val sku = options.skuAndroid ?: return
        val activity = currentActivity ?: return
        val url = "https://play.google.com/store/account/subscriptions?sku=$sku&package=${activity.packageName}"
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    override suspend fun getStorefront(): String {
        // Android doesn't have a storefront concept like iOS
        // Return a default value or country code based on locale
        return java.util.Locale.getDefault().country
    }

    // ---------------------------------------------------------------------
    // iOS External Purchase Methods (stubs for Android)
    // ---------------------------------------------------------------------

    override suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS {
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = "External purchase links are iOS only"))
    }

    override suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS {
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = "External purchase notice sheet is iOS only"))
    }

    override suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean {
        return false // Not supported on Android
    }

    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails {
        if (alternativeBillingMode != AlternativeBillingModeAndroid.UserChoice) {
            failWith(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "userChoiceBillingAndroid requires UserChoice alternative billing mode"
                )
            )
        }
        return _userChoiceBillingListener.first()
    }

    // ---------------------------------------------------------------------
    // Alternative Billing Methods (Android only)
    // ---------------------------------------------------------------------

    /**
     * Check if alternative billing is available for this user/device (Android only).
     * Step 1 of alternative billing flow.
     *
     * For AlternativeOnly mode: Uses isAlternativeBillingOnlyAvailableAsync
     * For UserChoice mode: Uses isFeatureSupported with ALTERNATIVE_BILLING feature
     */
    override suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean {
        return withContext(Dispatchers.IO) {
            val client = billingClient ?: run {
                failWith(PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready"))
            }

            when (alternativeBillingMode) {
                AlternativeBillingModeAndroid.AlternativeOnly -> {
                    suspendCancellableCoroutine { continuation ->
                        client.isAlternativeBillingOnlyAvailableAsync { billingResult ->
                            continuation.resume(billingResult.responseCode == BillingClient.BillingResponseCode.OK)
                        }
                    }
                }
                AlternativeBillingModeAndroid.UserChoice -> {
                    // User Choice Billing doesn't have a specific feature type constant
                    // It's enabled via enableUserChoiceBilling() and is available if alternative billing is supported
                    val result = client.isFeatureSupported(BillingClient.FeatureType.ALTERNATIVE_BILLING_ONLY)
                    result.responseCode == BillingClient.BillingResponseCode.OK
                }
                else -> false
            }
        }
    }

    /**
     * Show alternative billing information dialog to user (Android only).
     * Step 2 of alternative billing flow.
     * Must be called BEFORE processing payment in your payment system.
     *
     * Note: This is only applicable for AlternativeOnly mode.
     * For UserChoice mode, Google automatically shows selection dialog.
     */
    override suspend fun showAlternativeBillingDialogAndroid(): Boolean {
        // Only applicable for AlternativeOnly mode
        if (alternativeBillingMode != AlternativeBillingModeAndroid.AlternativeOnly) {
            failWith(PurchaseError(code = ErrorCode.DeveloperError, message = "showAlternativeBillingDialogAndroid is only for AlternativeOnly mode"))
        }

        return withContext(Dispatchers.Main) {
            val client = billingClient ?: run {
                failWith(PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready"))
            }
            val activity = currentActivity ?: run {
                failWith(PurchaseError(code = ErrorCode.ActivityUnavailable, message = "Activity not available"))
            }

            suspendCancellableCoroutine { continuation ->
                client.showAlternativeBillingOnlyInformationDialog(activity) { billingResult ->
                    val success = billingResult.responseCode == BillingClient.BillingResponseCode.OK
                    continuation.resume(success)
                }
            }
        }
    }

    /**
     * Create external transaction token for Google Play reporting (Android only).
     * Step 3 of alternative billing flow.
     * Must be called AFTER successful payment in your payment system.
     * Token must be reported to Google Play backend within 24 hours.
     *
     * Note: This is only applicable for AlternativeOnly mode.
     * For UserChoice mode, the token is provided in UserChoiceBillingDetails.
     */
    override suspend fun createAlternativeBillingTokenAndroid(): String? {
        // Only applicable for AlternativeOnly mode
        if (alternativeBillingMode != AlternativeBillingModeAndroid.AlternativeOnly) {
            failWith(PurchaseError(code = ErrorCode.DeveloperError, message = "createAlternativeBillingTokenAndroid is only for AlternativeOnly mode. For UserChoice mode, get token from UserChoiceBillingDetails"))
        }

        return withContext(Dispatchers.IO) {
            val client = billingClient ?: run {
                failWith(PurchaseError(code = ErrorCode.NotPrepared, message = "Billing client not ready"))
            }

            suspendCancellableCoroutine { continuation ->
                client.createAlternativeBillingOnlyReportingDetailsAsync { billingResult, alternativeBillingDetails ->
                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                        continuation.resume(alternativeBillingDetails?.externalTransactionToken)
                    } else {
                        continuation.resume(null)
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Billing Programs API (Android 8.2.1+)
    // These APIs use reflection to maintain compatibility with older Billing Library versions
    // Full implementation uses Google Play Billing Library 8.2.1
    // ---------------------------------------------------------------------

    override suspend fun isBillingProgramAvailableAndroid(
        program: BillingProgramAndroid
    ): BillingProgramAvailabilityResultAndroid {
        val client = billingClient ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.NotPrepared,
                message = "BillingClient not initialized"
            )
        )

        // Convert our enum to BillingClient.BillingProgram constant
        val billingProgramConstant = when (program) {
            BillingProgramAndroid.UserChoiceBilling -> 2 // USER_CHOICE_BILLING (7.0+)
            BillingProgramAndroid.ExternalContentLink -> 1 // EXTERNAL_CONTENT_LINK
            BillingProgramAndroid.ExternalOffer -> 3 // EXTERNAL_OFFER
            BillingProgramAndroid.ExternalPayments -> 4 // EXTERNAL_PAYMENTS (8.3.0+)
            BillingProgramAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot check availability for UNSPECIFIED program"
                )
            )
        }

        return suspendCancellableCoroutine { continuation ->
            try {
                // Use reflection to call isBillingProgramAvailableAsync (8.2.0+)
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramAvailabilityListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramAvailabilityResponse") {
                        val result = args?.get(0) as? BillingResult
                        val isAvailable = result?.responseCode == BillingClient.BillingResponseCode.OK
                        if (continuation.isActive) {
                            continuation.resume(BillingProgramAvailabilityResultAndroid(
                                billingProgram = program,
                                isAvailable = isAvailable
                            ))
                        }
                    }
                    null
                }

                val method = client.javaClass.getMethod(
                    "isBillingProgramAvailableAsync",
                    Int::class.javaPrimitiveType,
                    listenerClass
                )
                method.invoke(client, billingProgramConstant, listener)
            } catch (e: NoSuchMethodException) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.FeatureNotSupported,
                            message = "isBillingProgramAvailableAsync requires Billing Library 8.2.0+"
                        )
                    ))
                }
            } catch (e: Exception) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.Unknown,
                            message = "Failed to check billing program availability: ${e.message}"
                        )
                    ))
                }
            }
        }
    }

    override suspend fun createBillingProgramReportingDetailsAndroid(
        program: BillingProgramAndroid
    ): BillingProgramReportingDetailsAndroid {
        val client = billingClient ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.NotPrepared,
                message = "BillingClient not initialized"
            )
        )

        val billingProgramConstant = when (program) {
            BillingProgramAndroid.UserChoiceBilling -> 2
            BillingProgramAndroid.ExternalContentLink -> 1
            BillingProgramAndroid.ExternalOffer -> 3
            BillingProgramAndroid.ExternalPayments -> 4
            BillingProgramAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot create reporting details for UNSPECIFIED program"
                )
            )
        }

        return suspendCancellableCoroutine { continuation ->
            try {
                val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onBillingProgramReportingDetailsResponse") {
                        val result = args?.get(0) as? BillingResult
                        val details = args?.getOrNull(1)

                        if (result?.responseCode == BillingClient.BillingResponseCode.OK && details != null) {
                            try {
                                val tokenMethod = details.javaClass.getMethod("getExternalTransactionToken")
                                val token = tokenMethod.invoke(details) as? String

                                if (continuation.isActive && token != null) {
                                    continuation.resume(BillingProgramReportingDetailsAndroid(
                                        billingProgram = program,
                                        externalTransactionToken = token
                                    ))
                                } else if (continuation.isActive) {
                                    continuation.resumeWithException(PurchaseException(
                                        PurchaseError(
                                            code = ErrorCode.Unknown,
                                            message = "Failed to extract external transaction token"
                                        )
                                    ))
                                }
                            } catch (e: Exception) {
                                if (continuation.isActive) {
                                    continuation.resumeWithException(PurchaseException(
                                        PurchaseError(
                                            code = ErrorCode.Unknown,
                                            message = "Failed to extract token: ${e.message}"
                                        )
                                    ))
                                }
                            }
                        } else if (continuation.isActive) {
                            continuation.resumeWithException(PurchaseException(
                                PurchaseError(
                                    code = ErrorCode.Unknown,
                                    message = "Reporting details creation failed: ${result?.debugMessage}"
                                )
                            ))
                        }
                    }
                    null
                }

                val method = client.javaClass.getMethod(
                    "createBillingProgramReportingDetailsAsync",
                    Int::class.javaPrimitiveType,
                    listenerClass
                )
                method.invoke(client, billingProgramConstant, listener)
            } catch (e: NoSuchMethodException) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.FeatureNotSupported,
                            message = "createBillingProgramReportingDetailsAsync requires Billing Library 8.2.0+"
                        )
                    ))
                }
            } catch (e: Exception) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.Unknown,
                            message = "Failed to create billing program reporting details: ${e.message}"
                        )
                    ))
                }
            }
        }
    }

    override suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean {
        val client = billingClient ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.NotPrepared,
                message = "BillingClient not initialized"
            )
        )

        val activity = currentActivity ?: throw PurchaseException(
            PurchaseError(
                code = ErrorCode.NotPrepared,
                message = "Activity not available"
            )
        )

        // Convert enums to BillingClient constants
        val billingProgramConstant = when (params.billingProgram) {
            BillingProgramAndroid.UserChoiceBilling -> 2
            BillingProgramAndroid.ExternalContentLink -> 1
            BillingProgramAndroid.ExternalOffer -> 3
            BillingProgramAndroid.ExternalPayments -> 4
            BillingProgramAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot launch with UNSPECIFIED program"
                )
            )
        }

        val launchModeConstant = when (params.launchMode) {
            ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
            ExternalLinkLaunchModeAndroid.CallerWillLaunchLink -> 2
            ExternalLinkLaunchModeAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot launch with UNSPECIFIED launch mode"
                )
            )
        }

        val linkTypeConstant = when (params.linkType) {
            ExternalLinkTypeAndroid.LinkToDigitalContentOffer -> 1
            ExternalLinkTypeAndroid.LinkToAppDownload -> 2
            ExternalLinkTypeAndroid.Unspecified -> throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "Cannot launch with UNSPECIFIED link type"
                )
            )
        }

        return suspendCancellableCoroutine { continuation ->
            try {
                // Build LaunchExternalLinkParams using reflection
                val paramsClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkParams")
                val builderClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkParams\$Builder")

                val newBuilderMethod = paramsClass.getMethod("newBuilder")
                val builder = newBuilderMethod.invoke(null)

                // Set billing program
                val setBillingProgramMethod = builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
                setBillingProgramMethod.invoke(builder, billingProgramConstant)

                // Set launch mode
                val setLaunchModeMethod = builderClass.getMethod("setLaunchMode", Int::class.javaPrimitiveType)
                setLaunchModeMethod.invoke(builder, launchModeConstant)

                // Set link type
                val setLinkTypeMethod = builderClass.getMethod("setLinkType", Int::class.javaPrimitiveType)
                setLinkTypeMethod.invoke(builder, linkTypeConstant)

                // Set link URI
                val setLinkUriMethod = builderClass.getMethod("setLinkUri", Uri::class.java)
                setLinkUriMethod.invoke(builder, Uri.parse(params.linkUri))

                // Build the params
                val buildMethod = builderClass.getMethod("build")
                val launchParams = buildMethod.invoke(builder)

                // Create the response listener
                val listenerClass = Class.forName("com.android.billingclient.api.LaunchExternalLinkResponseListener")
                val listener = java.lang.reflect.Proxy.newProxyInstance(
                    listenerClass.classLoader,
                    arrayOf(listenerClass)
                ) { _, method, args ->
                    if (method.name == "onLaunchExternalLinkResponse") {
                        val result = args?.get(0) as? BillingResult
                        if (result?.responseCode == BillingClient.BillingResponseCode.OK) {
                            if (continuation.isActive) continuation.resume(true)
                        } else {
                            if (continuation.isActive) {
                                continuation.resumeWithException(PurchaseException(
                                    PurchaseError(
                                        code = ErrorCode.Unknown,
                                        message = "External link launch failed: ${result?.debugMessage}"
                                    )
                                ))
                            }
                        }
                    }
                    null
                }

                // Call launchExternalLink
                val launchMethod = client.javaClass.getMethod(
                    "launchExternalLink",
                    Activity::class.java,
                    paramsClass,
                    listenerClass
                )
                launchMethod.invoke(client, activity, launchParams, listener)
            } catch (e: NoSuchMethodException) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.FeatureNotSupported,
                            message = "launchExternalLink requires Billing Library 8.2.0+"
                        )
                    ))
                }
            } catch (e: Exception) {
                if (continuation.isActive) {
                    continuation.resumeWithException(PurchaseException(
                        PurchaseError(
                            code = ErrorCode.Unknown,
                            message = "Failed to launch external link: ${e.message}"
                        )
                    ))
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Activity lifecycle
    // ---------------------------------------------------------------------
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (currentActivity == null) currentActivity = activity
    }
    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityResumed(activity: Activity) { currentActivity = activity }
    override fun onActivityPaused(activity: Activity) {}
    override fun onActivityStopped(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {
        if (currentActivity == activity) currentActivity = null
    }

    // ---------------------------------------------------------------------
    // External Payments Program (8.3.0+)
    // ---------------------------------------------------------------------

    /**
     * Enable External Payments program using reflection for 8.3.0+ compatibility.
     * This sets up the DeveloperProvidedBillingListener to receive callbacks
     * when the user selects developer billing in the external payments flow.
     */
    private fun enableExternalPaymentsProgram(builder: BillingClient.Builder) {
        try {
            // Get the EnableBillingProgramParams class
            val enableParamsClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams")
            val enableParamsBuilderClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams\$Builder")

            // Create EnableBillingProgramParams for EXTERNAL_PAYMENTS (constant value 4)
            val newBuilderMethod = enableParamsClass.getMethod("newBuilder")
            val enableParamsBuilder = newBuilderMethod.invoke(null)

            val setBillingProgramMethod = enableParamsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            setBillingProgramMethod.invoke(enableParamsBuilder, 4) // EXTERNAL_PAYMENTS = 4

            // Create the DeveloperProvidedBillingListener proxy
            val listenerClass = Class.forName("com.android.billingclient.api.DeveloperProvidedBillingListener")
            val listener = java.lang.reflect.Proxy.newProxyInstance(
                listenerClass.classLoader,
                arrayOf(listenerClass)
            ) { _, method, args ->
                if (method.name == "onDeveloperProvidedBillingDetails") {
                    val details = args?.get(0)
                    if (details != null) {
                        try {
                            val tokenMethod = details.javaClass.getMethod("getExternalTransactionToken")
                            val token = tokenMethod.invoke(details) as? String
                            if (token != null) {
                                val billingDetails = DeveloperProvidedBillingDetailsAndroid(
                                    externalTransactionToken = token
                                )
                                _developerProvidedBillingListener.tryEmit(billingDetails)
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("KmpIAP", "Failed to extract developer billing token: ${e.message}")
                        }
                    }
                }
                null
            }

            // Set the listener on the builder
            val setListenerMethod = enableParamsBuilderClass.getMethod("setDeveloperProvidedBillingListener", listenerClass)
            setListenerMethod.invoke(enableParamsBuilder, listener)

            // Build the params
            val buildMethod = enableParamsBuilderClass.getMethod("build")
            val enableParams = buildMethod.invoke(enableParamsBuilder)

            // Call enableBillingProgram on the BillingClient.Builder
            val enableMethod = builder.javaClass.getMethod("enableBillingProgram", enableParamsClass)
            enableMethod.invoke(builder, enableParams)

        } catch (e: NoSuchMethodException) {
            android.util.Log.w("KmpIAP", "External Payments requires Billing Library 8.3.0+")
        } catch (e: ClassNotFoundException) {
            android.util.Log.w("KmpIAP", "External Payments requires Billing Library 8.3.0+")
        } catch (e: Exception) {
            android.util.Log.e("KmpIAP", "Failed to enable External Payments program: ${e.message}")
        }
    }

    /**
     * Enable a billing program using reflection for 8.2.0+ compatibility.
     * Used for EXTERNAL_CONTENT_LINK and EXTERNAL_OFFER programs.
     * Note: EXTERNAL_PAYMENTS should use enableExternalPaymentsProgram() instead.
     */
    private fun enableBillingProgram(builder: BillingClient.Builder, program: BillingProgramAndroid) {
        val programConstant = when (program) {
            BillingProgramAndroid.UserChoiceBilling -> {
                // UserChoiceBilling uses enableUserChoiceBilling() instead of enableBillingProgram()
                builder.enableUserChoiceBilling { userChoiceDetails ->
                    val details = UserChoiceBillingDetails(
                        externalTransactionToken = userChoiceDetails.externalTransactionToken,
                        products = userChoiceDetails.products.map { it.id }
                    )
                    _userChoiceBillingListener.tryEmit(details)
                }
                return
            }
            BillingProgramAndroid.ExternalContentLink -> 1
            BillingProgramAndroid.ExternalOffer -> 3
            BillingProgramAndroid.ExternalPayments -> {
                android.util.Log.w("KmpIAP", "ExternalPayments should use enableExternalPaymentsProgram()")
                return
            }
            BillingProgramAndroid.Unspecified -> return
        }

        try {
            val method = builder.javaClass.getMethod("enableBillingProgram", Int::class.javaPrimitiveType)
            method.invoke(builder, programConstant)
        } catch (e: NoSuchMethodException) {
            android.util.Log.w("KmpIAP", "Billing program $program requires Billing Library 8.2.0+")
        } catch (e: Exception) {
            android.util.Log.e("KmpIAP", "Failed to enable billing program $program: ${e.message}")
        }
    }

    /**
     * Apply DeveloperBillingOption to BillingFlowParams using reflection for 8.3.0+ compatibility.
     */
    private fun applyDeveloperBillingOption(
        flowBuilder: BillingFlowParams.Builder,
        option: DeveloperBillingOptionParamsAndroid
    ) {
        try {
            // Get the DeveloperBillingOptionParams class
            val paramsClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams")
            val paramsBuilderClass = Class.forName("com.android.billingclient.api.DeveloperBillingOptionParams\$Builder")

            // Create DeveloperBillingOptionParams
            val newBuilderMethod = paramsClass.getMethod("newBuilder")
            val paramsBuilder = newBuilderMethod.invoke(null)

            // Set billing program (EXTERNAL_PAYMENTS = 4)
            val billingProgramConstant = when (option.billingProgram) {
                BillingProgramAndroid.UserChoiceBilling -> 2
                BillingProgramAndroid.ExternalPayments -> 4
                BillingProgramAndroid.ExternalContentLink -> 1
                BillingProgramAndroid.ExternalOffer -> 3
                BillingProgramAndroid.Unspecified -> 0
            }
            val setBillingProgramMethod = paramsBuilderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            setBillingProgramMethod.invoke(paramsBuilder, billingProgramConstant)

            // Set launch mode
            val launchModeConstant = when (option.launchMode) {
                DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp -> 1
                DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink -> 2
                DeveloperBillingLaunchModeAndroid.Unspecified -> 0
            }
            val setLaunchModeMethod = paramsBuilderClass.getMethod("setLaunchMode", Int::class.javaPrimitiveType)
            setLaunchModeMethod.invoke(paramsBuilder, launchModeConstant)

            // Set link URI
            val setLinkUriMethod = paramsBuilderClass.getMethod("setLinkUri", android.net.Uri::class.java)
            setLinkUriMethod.invoke(paramsBuilder, android.net.Uri.parse(option.linkUri))

            // Build the params
            val buildMethod = paramsBuilderClass.getMethod("build")
            val developerBillingParams = buildMethod.invoke(paramsBuilder)

            // Apply to BillingFlowParams.Builder
            val setDeveloperBillingOptionMethod = flowBuilder.javaClass.getMethod(
                "setDeveloperBillingOption",
                paramsClass
            )
            setDeveloperBillingOptionMethod.invoke(flowBuilder, developerBillingParams)

        } catch (e: NoSuchMethodException) {
            android.util.Log.w("KmpIAP", "DeveloperBillingOption requires Billing Library 8.3.0+")
        } catch (e: ClassNotFoundException) {
            android.util.Log.w("KmpIAP", "DeveloperBillingOption requires Billing Library 8.3.0+")
        } catch (e: Exception) {
            android.util.Log.e("KmpIAP", "Failed to apply DeveloperBillingOption: ${e.message}")
        }
    }

    /**
     * Get the developer provided billing details when user selects developer billing
     * in the External Payments flow.
     *
     * @throws PurchaseException if External Payments program is not enabled
     */
    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid {
        if (enabledBillingProgram != BillingProgramAndroid.ExternalPayments) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "External Payments program not enabled. Set enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments in InitConnectionConfig."
                )
            )
        }
        return _developerProvidedBillingListener.first()
    }
}
