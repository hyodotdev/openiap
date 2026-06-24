package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import dev.hyo.openiap.OpenIapError as AndroidOpenIapError
import dev.hyo.openiap.OpenIapProtocol as AndroidOpenIapProtocol
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit as verifyPurchaseWithIapkitAndroid
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.AppTransaction
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAvailabilityResultAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramReportingDetailsAndroid
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
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
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.SubscriptionStatusIOS
import io.github.hyochan.kmpiap.openiap.UserChoiceBillingDetails
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.util.Locale

internal class AmazonInAppPurchaseAndroid(
    private val storeName: String = "amazon",
    private val store: Store = Store.AMAZON,
    private val versionPlatform: String = "Android Amazon"
) : KmpInAppPurchase, Application.ActivityLifecycleCallbacks {
    private var context: Context? = null
    private var currentActivity: Activity? = null
    private var activityCallbacksDisposer: (() -> Unit)? = null
    private var module: AndroidOpenIapProtocol? = null

    private val _purchaseUpdatedListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedListener.asSharedFlow()
    override fun purchaseUpdatedListener(options: PurchaseUpdatedListenerOptions?): Flow<Purchase> = purchaseUpdatedListener

    private val _purchaseErrorListener = MutableSharedFlow<PurchaseError>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorListener.asSharedFlow()

    override val promotedProductListener: Flow<String?> =
        MutableSharedFlow<String?>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST).asSharedFlow()

    private val _subscriptionBillingIssueListener = MutableSharedFlow<Purchase>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    override val subscriptionBillingIssueListener: Flow<Purchase> = _subscriptionBillingIssueListener.asSharedFlow()

    private val _userChoiceBillingListener = MutableSharedFlow<UserChoiceBillingDetails>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    private val _developerProvidedBillingListener = MutableSharedFlow<DeveloperProvidedBillingDetailsAndroid>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    private var updateListener: OpenIapPurchaseUpdateListener? = null
    private var errorListener: OpenIapPurchaseErrorListener? = null
    private var userChoiceListener: OpenIapUserChoiceBillingListener? = null
    private var developerProvidedListener: OpenIapDeveloperProvidedBillingListener? = null
    private var subscriptionIssueListener: OpenIapSubscriptionBillingIssueListener? = null

    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = withContext(Dispatchers.Main) {
        val ctx = ensureContext()
        val openModule = module ?: buildOpenIapModule(ctx).also { created ->
            module = created
            registerListeners(created)
        }
        openModule.setActivity(currentActivity)
        openModule.initConnection(config?.toOpenIap())
    }

    override suspend fun endConnection(): Boolean = withContext(Dispatchers.IO) {
        val openModule = module ?: return@withContext true
        unregisterListeners(openModule)
        activityCallbacksDisposer?.invoke()
        activityCallbacksDisposer = null
        runCatching { openModule.endConnection() }.getOrDefault(true).also {
            module = null
            context = null
            currentActivity = null
        }
    }

    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        requireModule().fetchProducts(params.toOpenIap()).toKmp()

    override suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult? =
        requireModule().requestPurchase(params.toOpenIap())?.toKmp()

    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        requireModule().getAvailablePurchases(options?.toOpenIap()).map { it.toKmp() }

    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        requireModule().queryHandlers.getActiveSubscriptions?.invoke(subscriptionIds)
            ?.map { ActiveSubscription.fromJson(it.toJson()) }
            ?: emptyList()

    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        requireModule().queryHandlers.hasActiveSubscriptions?.invoke(subscriptionIds) ?: false

    override suspend fun restorePurchases() {
        requireModule().mutationHandlers.restorePurchases?.invoke()
    }

    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?) {
        requireModule().finishTransaction(purchase.toOpenIap(), isConsumable)
    }

    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean =
        requireModule().acknowledgePurchaseAndroid(purchaseToken)

    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean =
        requireModule().consumePurchaseAndroid(purchaseToken)

    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?) {
        options?.let { requireModule().mutationHandlers.deepLinkToSubscriptions?.invoke(it.toOpenIap()) }
    }

    override suspend fun getStorefront(): String =
        requireModule().queryHandlers.getStorefront?.invoke().orEmpty().ifBlank { Locale.getDefault().country }

    override suspend fun getStorefrontIOS(): String = getStorefront()

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
        val androidOptions = dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps.fromJson(iapkitOptions.toJson())
        val androidResult = verifyPurchaseWithIapkitAndroid(androidOptions, "kmp-iap-android-$storeName")
        return VerifyPurchaseWithProviderResult(
            iapkit = RequestVerifyPurchaseWithIapkitResult.fromJson(androidResult.toJson()),
            provider = options.provider
        )
    }

    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult =
        failUnsupported("verifyPurchase is not supported on Android. Use verifyPurchaseWithProvider for server-side verification via IAPKit.")

    override suspend fun validateReceipt(options: VerifyPurchaseProps): VerifyPurchaseResult =
        failUnsupported("validateReceipt is not supported on Android. Use verifyPurchaseWithProvider for server-side verification.")

    override suspend fun validateReceiptIOS(options: VerifyPurchaseProps): VerifyPurchaseResultIOS =
        failUnsupported("validateReceiptIOS is an iOS-only API.")

    override suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid =
        BillingProgramAvailabilityResultAndroid(billingProgram = program, isAvailable = false)

    override suspend fun createBillingProgramReportingDetailsAndroid(program: BillingProgramAndroid): BillingProgramReportingDetailsAndroid =
        failUnsupported("Amazon Appstore does not support Google Play billing programs.")

    override suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean = false
    override suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean = false
    override suspend fun showAlternativeBillingDialogAndroid(): Boolean = false
    override suspend fun createAlternativeBillingTokenAndroid(): String? = null
    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails = _userChoiceBillingListener.first()
    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid = _developerProvidedBillingListener.first()
    override suspend fun subscriptionBillingIssue(): Purchase = subscriptionBillingIssueListener.first()
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
    override suspend fun requestPurchaseOnPromotedProductIOS(): Boolean = failUnsupported("requestPurchaseOnPromotedProductIOS is an iOS-only API.")
    override suspend fun beginRefundRequestIOS(sku: String): String? = null
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun syncIOS(): Boolean = false
    override suspend fun clearTransactionIOS(): Boolean = false
    override suspend fun presentCodeRedemptionSheetIOS(): Boolean = false
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
        val alternativeBillingModeClass = Class.forName("dev.hyo.openiap.AlternativeBillingMode")
        val noneMode = alternativeBillingModeClass.enumConstants?.first { (it as Enum<*>).name == "NONE" }
        val userChoiceBillingListenerClass = Class.forName("dev.hyo.openiap.listener.UserChoiceBillingListener")
        val developerProvidedBillingListenerClass = runCatching {
            Class.forName("dev.hyo.openiap.listener.DeveloperProvidedBillingListener")
        }.getOrNull()

        val constructorArgs = listOfNotNull(
            runCatching {
                val constructor = clazz.getConstructor(
                    Context::class.java,
                    alternativeBillingModeClass,
                    userChoiceBillingListenerClass,
                    developerProvidedBillingListenerClass
                )
                constructor to arrayOf(ctx, noneMode, null, null)
            }.getOrNull(),
            runCatching {
                val constructor = clazz.getConstructor(
                    Context::class.java,
                    alternativeBillingModeClass,
                    userChoiceBillingListenerClass
                )
                constructor to arrayOf(ctx, noneMode, null)
            }.getOrNull(),
            runCatching {
                val constructor = clazz.getConstructor(Context::class.java)
                constructor to arrayOf(ctx)
            }.getOrNull()
        )

        val (constructor, args) = constructorArgs.firstOrNull()
            ?: error("Failed to find $storeName OpenIapModule constructor")
        return constructor.newInstance(*args) as AndroidOpenIapProtocol
    }

    private fun registerListeners(openModule: AndroidOpenIapProtocol) {
        val purchaseUpdate = OpenIapPurchaseUpdateListener { purchase ->
            _purchaseUpdatedListener.tryEmit(purchase.toKmp())
        }
        val purchaseError = OpenIapPurchaseErrorListener { error ->
            _purchaseErrorListener.tryEmit(error.toKmp())
        }
        val userChoice = OpenIapUserChoiceBillingListener { details ->
            _userChoiceBillingListener.tryEmit(UserChoiceBillingDetails.fromJson(details.toJson()))
        }
        val developerProvided = OpenIapDeveloperProvidedBillingListener { details ->
            _developerProvidedBillingListener.tryEmit(DeveloperProvidedBillingDetailsAndroid.fromJson(details.toJson()))
        }
        val subscriptionIssue = OpenIapSubscriptionBillingIssueListener { purchase ->
            _subscriptionBillingIssueListener.tryEmit(purchase.toKmp())
        }

        openModule.addPurchaseUpdateListener(purchaseUpdate)
        openModule.addPurchaseErrorListener(purchaseError)
        openModule.addUserChoiceBillingListener(userChoice)
        openModule.addDeveloperProvidedBillingListener(developerProvided)
        openModule.addSubscriptionBillingIssueListener(subscriptionIssue)

        updateListener = purchaseUpdate
        errorListener = purchaseError
        userChoiceListener = userChoice
        developerProvidedListener = developerProvided
        subscriptionIssueListener = subscriptionIssue
    }

    private fun unregisterListeners(openModule: AndroidOpenIapProtocol) {
        updateListener?.let(openModule::removePurchaseUpdateListener)
        errorListener?.let(openModule::removePurchaseErrorListener)
        userChoiceListener?.let(openModule::removeUserChoiceBillingListener)
        developerProvidedListener?.let(openModule::removeDeveloperProvidedBillingListener)
        subscriptionIssueListener?.let(openModule::removeSubscriptionBillingIssueListener)
        updateListener = null
        errorListener = null
        userChoiceListener = null
        developerProvidedListener = null
        subscriptionIssueListener = null
    }

    private fun AndroidOpenIapError.toKmp(): PurchaseError =
        PurchaseError(
            code = ErrorCode.fromJson(code),
            message = debugMessage?.takeIf { it.isNotBlank() } ?: message
        )

    private fun failWith(error: PurchaseError): Nothing {
        _purchaseErrorListener.tryEmit(error)
        throw PurchaseException(error)
    }

    private fun failUnsupported(message: String): Nothing =
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = message))
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
