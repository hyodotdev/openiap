// The Amazon implementation overrides the shared 2.x compatibility methods.
// Consumer call sites retain warnings; remove the overrides in kmp-iap 3.
@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import dev.hyo.openiap.OpenIapError as AndroidOpenIapError
import dev.hyo.openiap.OpenIapProtocol as AndroidOpenIapProtocol
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit as verifyPurchaseWithIapkitAndroid
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.AppTransaction
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAvailabilityResultAndroid
import io.github.hyochan.kmpiap.openiap.BillingChoiceInfoAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramInformationDialogParamsAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramReportingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.BillingResultAndroid
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
import io.github.hyochan.kmpiap.openiap.DeveloperBillingTypeAndroid
import io.github.hyochan.kmpiap.openiap.DeveloperProvidedBillingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkNoticeTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseCustomLinkTokenTypeIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseLinkResultIOS
import io.github.hyochan.kmpiap.openiap.ExternalPurchaseNoticeResultIOS
import io.github.hyochan.kmpiap.openiap.FetchProductsResult
import io.github.hyochan.kmpiap.openiap.FetchProductsResultAll
import io.github.hyochan.kmpiap.openiap.FetchProductsResultProducts
import io.github.hyochan.kmpiap.openiap.FetchProductsResultSubscriptions
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import io.github.hyochan.kmpiap.openiap.GetBillingChoiceInfoParamsAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageParamsAndroid
import io.github.hyochan.kmpiap.openiap.InAppMessageResultAndroid
import io.github.hyochan.kmpiap.openiap.LaunchExternalLinkParamsAndroid
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductOrSubscription
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.ProductSubscription
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseInput
import io.github.hyochan.kmpiap.openiap.PurchaseOptions
import io.github.hyochan.kmpiap.openiap.PurchaseUpdatedListenerOptions
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResult
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchase
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchases
import io.github.hyochan.kmpiap.openiap.SubscriptionStatusIOS
import io.github.hyochan.kmpiap.openiap.UserChoiceBillingDetails
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

internal suspend fun endAmazonConnectionWithCleanup(
    endConnection: suspend () -> Boolean,
    cleanup: () -> Unit,
): Boolean = try {
    endConnection()
} finally {
    cleanup()
}

internal class AmazonInAppPurchaseAndroid(
    private val storeName: String = "amazon",
    private val store: Store = Store.AMAZON,
    private val versionPlatform: String = "Android Amazon"
) : KmpInAppPurchase, Application.ActivityLifecycleCallbacks {
    private var context: Context? = null
    private var currentActivity: Activity? = null
    private var activityCallbacksDisposer: (() -> Unit)? = null
    @Volatile
    private var module: AndroidOpenIapProtocol? = null
    private val connectionMutex = Mutex()
    private var isConnected = false

    private val _purchaseUpdatedListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedListener.asSharedFlow()
    override fun purchaseUpdatedListener(options: PurchaseUpdatedListenerOptions?): Flow<Purchase> = purchaseUpdatedListener

    private val _purchaseErrorListener = MutableSharedFlow<PurchaseError>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorListener.asSharedFlow()

    override val promotedProductListener: Flow<String?> =
        MutableSharedFlow<String?>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST).asSharedFlow()

    override val subscriptionBillingIssueListener: Flow<Purchase> = emptyFlow()

    private var updateListener: OpenIapPurchaseUpdateListener? = null
    private var errorListener: OpenIapPurchaseErrorListener? = null

    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = withContext(Dispatchers.Main) {
        connectionMutex.withLock {
            if (isConnected) return@withLock true
            withMappedOpenIapError {
                val ctx = ensureContext()
                val openModule = module ?: buildOpenIapModule(ctx).also { created ->
                    module = created
                    registerListeners(created)
                }
                openModule.setActivity(currentActivity)
                openModule.initConnection(config?.toOpenIap()).also { connected ->
                    isConnected = connected
                }
            }
        }
    }

    override suspend fun endConnection(): Boolean = withContext(Dispatchers.IO) {
        connectionMutex.withLock {
            val openModule = module ?: return@withLock true
            // Keep listeners attached through the native end call. Amazon emits
            // pending purchase disconnects synchronously before returning, so
            // KMP receives the typed error and can then release the old module.
            try {
                endAmazonConnectionWithCleanup(
                    endConnection = { openModule.endConnection() },
                    cleanup = {
                    try {
                        unregisterListeners(openModule)
                    } finally {
                        isConnected = false
                        module = null
                        val disposer = activityCallbacksDisposer
                        activityCallbacksDisposer = null
                        context = null
                        currentActivity = null
                        disposer?.invoke()
                    }
                    },
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: AndroidOpenIapError) {
                throw PurchaseException(error.toKmpPurchaseError())
            } catch (error: PurchaseException) {
                throw error
            } catch (error: Exception) {
                throw PurchaseException(
                    PurchaseError(
                        code = ErrorCode.ServiceError,
                        debugMessage = error.message,
                        message = error.message ?: "Failed to end Amazon billing connection",
                    )
                )
            }
        }
    }

    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        withMappedOpenIapError { requireModule().fetchProducts(params.toOpenIap()).toKmp() }

    override suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult? =
        withMappedOpenIapError { requireModule().requestPurchase(params.toOpenIap())?.toKmp() }

    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        withMappedOpenIapError {
            requireModule().getAvailablePurchases(options?.toOpenIap()).map { it.toKmp() }
        }

    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        withMappedOpenIapError {
            requireModule().queryHandlers.getActiveSubscriptions?.invoke(subscriptionIds)
                ?.map { ActiveSubscription.fromJson(it.toJson()) }
                ?: emptyList()
        }

    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        withMappedOpenIapError {
            requireModule().queryHandlers.hasActiveSubscriptions?.invoke(subscriptionIds) ?: false
        }

    override suspend fun restorePurchases() {
        withMappedOpenIapError { requireModule().mutationHandlers.restorePurchases?.invoke() }
    }

    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?) {
        withMappedOpenIapError {
            requireModule().finishTransaction(purchase.toOpenIap(), isConsumable)
        }
    }

    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean =
        withMappedOpenIapError { requireModule().acknowledgePurchaseAndroid(purchaseToken) }

    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean =
        withMappedOpenIapError { requireModule().consumePurchaseAndroid(purchaseToken) }

    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?) {
        withMappedOpenIapError {
            options?.let {
                requireModule().mutationHandlers.deepLinkToSubscriptions?.invoke(it.toOpenIap())
            }
        }
    }

    override suspend fun getStorefront(): String =
        withMappedOpenIapError {
            val handler = requireModule().queryHandlers.getStorefront
                ?: failUnsupported("Amazon storefront query is unavailable.")
            authoritativeStorefrontCountryOrNull(handler()) ?: failWith(
                PurchaseError(
                    code = ErrorCode.ServiceError,
                    message = "Amazon returned no authoritative storefront country code",
                )
            )
        }

    override suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult {
        if (options.provider != PurchaseVerificationProvider.Iapkit) {
            failUnsupported("Verification provider ${options.provider.rawValue} is not supported on Android")
        }
        val iapkitOptions = options.iapkit ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "IAPKit options are required for Android verification"
            )
        )
        val androidOptions = runCatching {
            dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps.fromJson(iapkitOptions.toJson())
        }.getOrElse {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = "Invalid IAPKit options for Android verification"
                )
            )
        }
        val androidResult = withMappedOpenIapError {
            verifyPurchaseWithIapkitAndroid(androidOptions, "kmp-iap-android-$storeName")
        }
        val iapkitResult = androidResult.toKmpIapkitResult()
        return VerifyPurchaseWithProviderResult(
            iapkit = iapkitResult,
            provider = options.provider
        )
    }

    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult =
        failUnsupported("verifyPurchase is not supported on Android. Use verifyPurchaseWithProvider for server-side verification via IAPKit.")

    override suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid =
        BillingProgramAvailabilityResultAndroid(billingProgram = program, isAvailable = false)

    override suspend fun getBillingChoiceInfoAndroid(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid =
        failUnsupported("Amazon Appstore does not support Google Play Billing Choice.")

    override suspend fun createBillingProgramReportingDetailsAndroid(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid =
        failUnsupported("Amazon Appstore does not support Google Play billing programs.")

    override suspend fun showBillingProgramInformationDialogAndroid(params: BillingProgramInformationDialogParamsAndroid): BillingResultAndroid =
        failUnsupported("Amazon Appstore does not support Google Play Billing Choice.")

    override suspend fun showInAppMessagesAndroid(params: InAppMessageParamsAndroid?): InAppMessageResultAndroid =
        failUnsupported("Google Play billing in-app messages are unavailable on $storeName.")

    override suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean = false
    override suspend fun openRedeemOfferCodeAndroid(): Boolean = false
    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails =
        failUnsupported("User Choice Billing is unavailable on $storeName.")
    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid =
        failUnsupported("Developer-provided billing is unavailable on $storeName.")
    override suspend fun subscriptionBillingIssue(): Purchase =
        failUnsupported("Subscription billing-issue events are unavailable on $storeName.")
    override suspend fun purchaseUpdated(options: PurchaseUpdatedListenerOptions?): Purchase = purchaseUpdatedListener(options).first()
    override suspend fun purchaseError(): PurchaseError = purchaseErrorListener.first()
    override suspend fun promotedProductIOS(): String = ""
    override suspend fun currentEntitlementIOS(sku: String): PurchaseIOS? = null
    override suspend fun getAllTransactionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun getAppTransactionIOS(): AppTransaction? = null
    override suspend fun getPendingTransactionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun getReceiptDataIOS(): String? = null
    override suspend fun getTransactionJwsIOS(sku: String): String? = null
    override suspend fun getPromotedProductIOS(): io.github.hyochan.kmpiap.openiap.ProductIOS? = null
    override suspend fun beginRefundRequestIOS(sku: String): String? = null
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun syncIOS(): Boolean = false
    override suspend fun clearTransactionIOS(): Boolean = false
    override suspend fun presentCodeRedemptionSheetIOS(): PurchaseIOS? = null
    override suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS = failUnsupported("External purchase links are iOS only.")
    override suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS = failUnsupported("External purchase notice sheet is iOS only.")
    override suspend fun showExternalPurchaseCustomLinkNoticeIOS(noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS): ExternalPurchaseCustomLinkNoticeResultIOS = failUnsupported("External purchase custom-link notice is iOS only.")
    override suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean = false
    override suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean = false
    override suspend fun getExternalPurchaseCustomLinkTokenIOS(tokenType: ExternalPurchaseCustomLinkTokenTypeIOS): ExternalPurchaseCustomLinkTokenResultIOS = failUnsupported("External purchase custom-link token is iOS only.")
    override suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean = false
    override suspend fun isTransactionVerifiedIOS(sku: String): Boolean = false
    override suspend fun latestTransactionIOS(sku: String): PurchaseIOS? = null
    override suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS> = emptyList()
    override fun getVersion(): String = kmpIapVersionString(versionPlatform)
    override fun getStore(): Store = store
    override suspend fun canMakePayments(): Boolean = true

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        currentActivity = activity
        module?.setActivity(activity)
    }

    override fun onActivityStarted(activity: Activity) {
        currentActivity = activity
        module?.setActivity(activity)
    }

    override fun onActivityResumed(activity: Activity) {
        currentActivity = activity
        module?.setActivity(activity)
    }

    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) {
        if (currentActivity === activity) {
            currentActivity = null
            module?.setActivity(null)
        }
    }

    private fun ensureContext(): Context {
        context?.let { return it }
        val disposer = tryCaptureApplication(
            callback = this,
            onContextAvailable = { appContext -> context = appContext },
            onActivityFound = { activity -> currentActivity = activity }
        )
        if (context != null) {
            activityCallbacksDisposer = disposer
            return context!!
        }
        disposer?.invoke()
        failWith(PurchaseError(code = ErrorCode.ServiceError, message = "Context not available"))
    }

    private fun requireModule(): AndroidOpenIapProtocol =
        module ?: failWith(PurchaseError(code = ErrorCode.NotPrepared, message = "$storeName billing module not initialized"))

    private fun buildOpenIapModule(ctx: Context): AndroidOpenIapProtocol {
        val clazz = Class.forName("dev.hyo.openiap.OpenIapModule")
        val constructor = clazz.getConstructor(Context::class.java)
        return constructor.newInstance(ctx) as AndroidOpenIapProtocol
    }

    private fun registerListeners(openModule: AndroidOpenIapProtocol) {
        val purchaseUpdate = OpenIapPurchaseUpdateListener { purchase ->
            _purchaseUpdatedListener.tryEmit(purchase.toKmp())
        }
        val purchaseError = OpenIapPurchaseErrorListener { error ->
            _purchaseErrorListener.tryEmit(error.toKmpPurchaseError())
        }
        openModule.addPurchaseUpdateListener(purchaseUpdate)
        openModule.addPurchaseErrorListener(purchaseError)

        updateListener = purchaseUpdate
        errorListener = purchaseError
    }

    private fun unregisterListeners(openModule: AndroidOpenIapProtocol) {
        updateListener?.let(openModule::removePurchaseUpdateListener)
        errorListener?.let(openModule::removePurchaseErrorListener)
        updateListener = null
        errorListener = null
    }

    private suspend fun <T> withMappedOpenIapError(block: suspend () -> T): T =
        try {
            block()
        } catch (error: AndroidOpenIapError) {
            throw PurchaseException(error.toKmpPurchaseError())
        }

    private fun failWith(error: PurchaseError): Nothing {
        _purchaseErrorListener.tryEmit(error)
        throw PurchaseException(error)
    }

    private fun failUnsupported(message: String): Nothing =
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = message))
}

internal fun AndroidOpenIapError.toKmpPurchaseError(): PurchaseError {
    // toJSON() already resolves intrinsic ProductNotFound/SkuNotFound IDs and
    // per-request requestProductId diagnostics. Do not overwrite it with null
    // for other typed errors such as Amazon cancellation or deferred purchase.
    val payload = toJSON() + mapOf(
        "message" to (debugMessage?.takeIf { it.isNotBlank() } ?: message),
    )
    return PurchaseError.fromJson(payload)
}

private fun InitConnectionConfig.toOpenIap(): dev.hyo.openiap.InitConnectionConfig =
    dev.hyo.openiap.InitConnectionConfig.fromJson(toJson())

private fun ProductRequest.toOpenIap(): dev.hyo.openiap.ProductRequest =
    dev.hyo.openiap.ProductRequest.fromJson(toJson())
        ?: error("Invalid product request")

private fun PurchaseOptions.toOpenIap(): dev.hyo.openiap.PurchaseOptions =
    dev.hyo.openiap.PurchaseOptions.fromJson(toJson())

private fun RequestPurchaseProps.toOpenIap(): dev.hyo.openiap.RequestPurchaseProps =
    dev.hyo.openiap.RequestPurchaseProps.fromJson(toJson())

private fun Purchase.toOpenIap(): dev.hyo.openiap.Purchase =
    dev.hyo.openiap.Purchase.fromJson(toJson())

private fun DeepLinkOptions.toOpenIap(): dev.hyo.openiap.DeepLinkOptions =
    dev.hyo.openiap.DeepLinkOptions.fromJson(toJson())

private fun dev.hyo.openiap.Purchase.toKmp(): Purchase =
    Purchase.fromJson(toJson())

private fun dev.hyo.openiap.FetchProductsResult.toKmp(): FetchProductsResult =
    when (this) {
        is dev.hyo.openiap.FetchProductsResultAll ->
            FetchProductsResultAll(value?.map { ProductOrSubscription.fromJson(it.toJson()) })
        is dev.hyo.openiap.FetchProductsResultProducts ->
            FetchProductsResultProducts(value?.map { Product.fromJson(it.toJson()) })
        is dev.hyo.openiap.FetchProductsResultSubscriptions ->
            FetchProductsResultSubscriptions(value?.map { ProductSubscription.fromJson(it.toJson()) })
    }

private fun dev.hyo.openiap.RequestPurchaseResult.toKmp(): RequestPurchaseResult =
    when (this) {
        is dev.hyo.openiap.RequestPurchaseResultPurchase ->
            RequestPurchaseResultPurchase(value?.let { Purchase.fromJson(it.toJson()) })
        is dev.hyo.openiap.RequestPurchaseResultPurchases ->
            RequestPurchaseResultPurchases(value?.map { Purchase.fromJson(it.toJson()) })
    }
