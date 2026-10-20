package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import dev.hyo.openiap.OpenIapError as AndroidOpenIapError
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProtocol as AndroidOpenIapProtocol
import dev.hyo.openiap.helpers.PLAY_REDEEM_OFFER_CODE_URL
import dev.hyo.openiap.helpers.finishPurchaseToken
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.utils.verifyPurchaseWithGooglePlay as verifyPurchaseWithGooglePlayAndroid
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.AppOwnershipVerificationResult
import io.github.hyochan.kmpiap.openiap.VerifyAppOwnershipProps
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
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

internal suspend fun endDelegatedConnectionWithCleanup(
    endConnection: suspend () -> Boolean,
    cleanup: () -> Unit,
): Boolean = try {
    endConnection()
} finally {
    cleanup()
}

/** Every Android flavor: KMP's API over the openiap-google module of the linked store. */
internal class OpenIapDelegateInAppPurchaseAndroid(
    private val storeName: String,
    private val store: Store,
    private val versionPlatform: String,
    private val firstPurchaseNotice: FirstPurchaseNotice = FirstPurchaseNotice.shared,
) : KmpInAppPurchase, Application.ActivityLifecycleCallbacks {
    private var context: Context? = null
    private var currentActivity: Activity? = null
    private var activityCallbacksDisposer: (() -> Unit)? = null
    @Volatile
    private var module: AndroidOpenIapProtocol? = null
    private val connectionMutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    // Cleared when the store drops the billing service so the next initConnection reconnects.
    @Volatile
    private var isConnected = false
    // The program the live connection enabled; null when none or disconnected.
    @Volatile
    private var enabledBillingProgram: BillingProgramAndroid? = null
    // The Play requestPurchase call running on this thread, so each call keeps only its own errors.
    private val runningPlayCall = ThreadLocal<Any?>()

    // Horizon and Amazon have no Play billing programs, choice events, or billing-issue signal.
    private val hasPlayBillingApis = store == Store.PLAY_STORE || store == Store.UNKNOWN
    // Keeps the contract of KMP's former in-house Play implementation: request failures throw
    // (openiap-google reports them as an event), programs gate their APIs, and redeem works without an Activity.
    private val isPlay = store == Store.PLAY_STORE

    private val _purchaseUpdatedListener = eventFlow<Purchase>()
    override val purchaseUpdatedListener: Flow<Purchase> = _purchaseUpdatedListener.asSharedFlow()
    override fun purchaseUpdatedListener(options: PurchaseUpdatedListenerOptions?): Flow<Purchase> = purchaseUpdatedListener

    private val _purchaseErrorListener = eventFlow<PurchaseError>()
    override val purchaseErrorListener: Flow<PurchaseError> = _purchaseErrorListener.asSharedFlow()

    override val promotedProductListener: Flow<String?> = eventFlow<String?>().asSharedFlow()

    private val billingIssues = eventFlow<Purchase>()
    override val subscriptionBillingIssueListener: Flow<Purchase> =
        if (hasPlayBillingApis) billingIssues.asSharedFlow() else emptyFlow()

    private val userChoices = eventFlow<UserChoiceBillingDetails>()
    override val userChoiceBillingListenerAndroid: Flow<UserChoiceBillingDetails> =
        if (hasPlayBillingApis) userChoices.asSharedFlow() else emptyFlow()

    private val developerChoices = eventFlow<DeveloperProvidedBillingDetailsAndroid>()
    override val developerProvidedBillingListenerAndroid: Flow<DeveloperProvidedBillingDetailsAndroid> =
        if (hasPlayBillingApis) developerChoices.asSharedFlow() else emptyFlow()

    private var userChoiceListener: OpenIapUserChoiceBillingListener? = null
    private var developerChoiceListener: OpenIapDeveloperProvidedBillingListener? = null
    private var updateListener: OpenIapPurchaseUpdateListener? = null
    private var errorListener: OpenIapPurchaseErrorListener? = null
    private var billingIssueListener: OpenIapSubscriptionBillingIssueListener? = null
    private var connectionStateListener: OpenIapConnectionStateListener? = null

    override suspend fun initConnection(config: InitConnectionConfig?): Boolean = withContext(Dispatchers.Main) {
        connectionMutex.withLock {
            if (isConnected) return@withLock true
            withMappedOpenIapError {
                val openModule = ensureModuleLocked()
                openModule.setActivity(currentActivity)
                openModule.initConnection(config?.toOpenIap()).also { connected ->
                    isConnected = connected
                    enabledBillingProgram = config?.enableBillingProgramAndroid
                        ?.takeIf { connected && it != BillingProgramAndroid.Unspecified }
                }
            }
        }
    }

    override suspend fun endConnection(): Boolean = withContext(Dispatchers.IO) {
        connectionMutex.withLock {
            val openModule = module ?: return@withLock true
            // Amazon emits pending purchase errors during teardown, before listeners detach.
            try {
                endDelegatedConnectionWithCleanup(
                    endConnection = { openModule.endConnection() },
                    cleanup = {
                        try {
                            unregisterListeners(openModule)
                        } finally {
                            isConnected = false
                            enabledBillingProgram = null
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
                        message = error.message ?: "Failed to end $storeName billing connection",
                    )
                )
            }
        }
    }

    override suspend fun fetchProducts(params: ProductRequest): FetchProductsResult =
        withMappedOpenIapError { requireModule().fetchProducts(params.toOpenIap()).toKmp() }

    override suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult? =
        withMappedOpenIapError {
            val openModule = requireModule()
            if (isPlay) requestPlayPurchase(openModule, params) else openModule.requestPurchase(params.toOpenIap())?.toKmp()
        }

    private suspend fun requestPlayPurchase(
        openModule: AndroidOpenIapProtocol,
        params: RequestPurchaseProps,
    ): RequestPurchaseResult? {
        if (enabledBillingProgram == BillingProgramAndroid.ExternalOffer) {
            failWith(
                PurchaseError(
                    code = ErrorCode.FeatureNotSupported,
                    message = "requestPurchase cannot run the external-offer program automatically. " +
                        "Use isBillingProgramAvailableAndroid, launchExternalLinkAndroid, " +
                        "and createBillingProgramReportingDetailsAndroid.",
                )
            )
        }
        // openiap-google admits one purchase at a time and frees it before emitting the outcome.
        val call = Any()
        val requestedSkus = params.androidSkus()
        // Published inside this call: its own. From a Play callback: the latest may still be an earlier
        // request's, so it counts only without an own failure. Published inside another call: not ours.
        // Known limit: overlapping requests can still swap callback errors; exact pairing needs request
        // ids on openiap-google's error events.
        val ownFailure = AtomicReference<AndroidOpenIapError?>()
        val callbackFailure = AtomicReference<AndroidOpenIapError?>()
        // The module tags request failures with the requested SKU, or none when it cannot pick one.
        val captureFailure = OpenIapPurchaseErrorListener { error ->
            val productId = error.toKmpPurchaseError().productId
            if (productId == null || productId in requestedSkus) {
                when (runningPlayCall.get()) {
                    call -> ownFailure.set(error)
                    null -> callbackFailure.set(error)
                }
            }
        }
        openModule.addPurchaseErrorListener(captureFailure)
        try {
            val result = withContext(runningPlayCall.asContextElement(call)) {
                openModule.requestPurchase(params.toOpenIap())
            }
            // The module already published this failure to the error listeners.
            (ownFailure.get() ?: callbackFailure.get())?.takeIf { result.isEmpty() }?.let { throw it }
            return result?.toKmp()
        } finally {
            openModule.removePurchaseErrorListener(captureFailure)
        }
    }

    override suspend fun getAvailablePurchases(options: PurchaseOptions?): List<Purchase> =
        withMappedOpenIapError {
            requireModule().getAvailablePurchases(options?.toOpenIap()).map { it.toKmp() }
        }

    override suspend fun getActiveSubscriptions(subscriptionIds: List<String>?): List<ActiveSubscription> =
        withMappedOpenIapError {
            requireModule().getActiveSubscriptions(subscriptionIds)
                .map { ActiveSubscription.fromJson(it.toJson()) }
        }

    override suspend fun hasActiveSubscriptions(subscriptionIds: List<String>?): Boolean =
        withMappedOpenIapError {
            requireModule().hasActiveSubscriptions(subscriptionIds)
        }

    override suspend fun restorePurchases() {
        withMappedOpenIapError { requireModule().restorePurchases() }
    }

    override suspend fun finishTransaction(purchase: PurchaseInput, isConsumable: Boolean?) {
        withMappedOpenIapError {
            requireModule().finishTransaction(purchase.toOpenIap(), isConsumable)
        }
        firstPurchaseNotice.onTransactionFinished(purchase, context)
    }

    override suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean =
        finishToken(purchaseToken, isConsumable = false)

    override suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean =
        finishToken(purchaseToken, isConsumable = true)

    override suspend fun deepLinkToSubscriptions(options: DeepLinkOptions?) {
        withMappedOpenIapError { requireModule().deepLinkToSubscriptions(options?.toOpenIap()) }
    }

    override suspend fun getStorefront(): String =
        withMappedOpenIapError {
            authoritativeStorefrontCountryOrNull(requireModule().getStorefront()) ?: failWith(
                PurchaseError(
                    code = ErrorCode.ServiceError,
                    message = "$storeName returned no authoritative storefront country code",
                )
            )
        }

    override suspend fun verifyPurchaseWithProvider(options: VerifyPurchaseWithProviderProps): VerifyPurchaseWithProviderResult {
        if (store == Store.UNKNOWN) {
            return withMappedOpenIapError {
                val result = requireModule().verifyPurchaseWithProvider(
                    requireNotNull(dev.hyo.openiap.VerifyPurchaseWithProviderProps.fromJson(options.toJson()))
                )
                VerifyPurchaseWithProviderResult.fromJson(result.toJson())
            }
        }
        if (options.provider != PurchaseVerificationProvider.Iapkit) {
            failUnsupported("Verification provider ${options.provider.rawValue} is not supported on Android")
        }
        if (options.iapkit == null) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = "IAPKit options are required for Android verification"
                )
            )
        }
        val androidProps = runCatching {
            dev.hyo.openiap.VerifyPurchaseWithProviderProps.fromJson(options.toJson())
        }.getOrNull() ?: failWith(
            PurchaseError(
                code = ErrorCode.PurchaseVerificationFailed,
                message = "Invalid IAPKit options for Android verification"
            )
        )
        // The store's module fills in what a minimal request omits: Amazon's user, Horizon's signed-in user.
        return verifyOrFail {
            val result = ensureModule().verifyPurchaseWithProvider(androidProps)
            VerifyPurchaseWithProviderResult(
                iapkit = result.iapkit?.toKmpIapkitResult(),
                provider = options.provider
            )
        }
    }

    override suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult = when (store) {
        Store.UNKNOWN -> withMappedOpenIapError {
            VerifyPurchaseResult.fromJson(requireModule().verifyPurchase(options.toOpenIap()).toJson())
        }
        // Calls the Play Developer API directly, so it needs no billing connection.
        Store.PLAY_STORE -> verifyOrFail {
            VerifyPurchaseResultAndroid.fromJson(
                verifyPurchaseWithGooglePlayAndroid(options.toOpenIap(), "kmp-iap-android-$storeName").toJson()
            )
        }
        else -> failUnsupported("verifyPurchase is not supported on Android. Use verifyPurchaseWithProvider for server-side verification via IAPKit.")
    }

    override suspend fun isBillingProgramAvailableAndroid(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid =
        if (hasPlayBillingApis) withMappedOpenIapError {
            BillingProgramAvailabilityResultAndroid.fromJson(requireModule().isBillingProgramAvailable(
                dev.hyo.openiap.BillingProgramAndroid.fromJson(program.rawValue)
            ).toJson())
        } else BillingProgramAvailabilityResultAndroid(billingProgram = program, isAvailable = false)

    override suspend fun getBillingChoiceInfoAndroid(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid =
        if (hasPlayBillingApis) withMappedOpenIapError {
            BillingChoiceInfoAndroid.fromJson(requireModule().getBillingChoiceInfo(
                requireNotNull(dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid.fromJson(params.toJson()))
            ).toJson())
        } else failUnsupported("Google Play Billing Choice is unavailable on $storeName.")

    override suspend fun createBillingProgramReportingDetailsAndroid(
        program: BillingProgramAndroid,
        developerBillingType: DeveloperBillingTypeAndroid?
    ): BillingProgramReportingDetailsAndroid =
        if (hasPlayBillingApis) withMappedOpenIapError {
            BillingProgramReportingDetailsAndroid.fromJson(requireModule().createBillingProgramReportingDetails(
                dev.hyo.openiap.BillingProgramAndroid.fromJson(program.rawValue),
                developerBillingType?.let { dev.hyo.openiap.DeveloperBillingTypeAndroid.fromJson(it.rawValue) }
            ).toJson())
        } else failUnsupported("Google Play billing programs are unavailable on $storeName.")

    override suspend fun showBillingProgramInformationDialogAndroid(params: BillingProgramInformationDialogParamsAndroid): BillingResultAndroid =
        if (hasPlayBillingApis) withMappedOpenIapError {
            BillingResultAndroid.fromJson(requireModule().showBillingProgramInformationDialog(
                requireActivity(),
                requireNotNull(dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid.fromJson(params.toJson()))
            ).toJson())
        } else failUnsupported("Google Play Billing Choice is unavailable on $storeName.")

    override suspend fun showInAppMessagesAndroid(params: InAppMessageParamsAndroid?): InAppMessageResultAndroid =
        if (hasPlayBillingApis) withMappedOpenIapError {
            InAppMessageResultAndroid.fromJson(requireModule().showInAppMessages(
                requireActivity(), params?.let { dev.hyo.openiap.InAppMessageParamsAndroid.fromJson(it.toJson()) }
            ).toJson())
        } else failUnsupported("Google Play billing in-app messages are unavailable on $storeName.")

    override suspend fun launchExternalLinkAndroid(params: LaunchExternalLinkParamsAndroid): Boolean =
        if (hasPlayBillingApis) withMappedOpenIapError {
            requireModule().launchExternalLink(
                requireActivity(), requireNotNull(dev.hyo.openiap.LaunchExternalLinkParamsAndroid.fromJson(params.toJson()))
            )
        } else false

    // Opens the store's redeem page, which needs no billing connection.
    override suspend fun openRedeemOfferCode(): Purchase? = when {
        !hasPlayBillingApis -> null
        isPlay && currentActivity == null -> openPlayRedeemPageFromAppContext()
        else -> withMappedOpenIapError {
            dev.hyo.openiap.utils.redeemOfferCode(ensureModule(), requireActivity())?.toKmp()
        }
    }
    override suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails =
        if (hasPlayBillingApis) {
            requireEnabledProgram("userChoiceBillingAndroid", BillingProgramAndroid.UserChoiceBilling)
            userChoices.first()
        } else failUnsupported("User Choice Billing is unavailable on $storeName.")
    override suspend fun developerProvidedBillingAndroid(): DeveloperProvidedBillingDetailsAndroid =
        if (hasPlayBillingApis) {
            requireEnabledProgram(
                "developerProvidedBillingAndroid",
                BillingProgramAndroid.ExternalPayments,
                BillingProgramAndroid.BillingChoice,
            )
            developerChoices.first()
        } else failUnsupported("Developer-provided billing is unavailable on $storeName.")
    override suspend fun subscriptionBillingIssue(): Purchase =
        if (hasPlayBillingApis) billingIssues.first()
        else failUnsupported("Subscription billing-issue events are unavailable on $storeName.")
    override suspend fun purchaseUpdated(options: PurchaseUpdatedListenerOptions?): Purchase = purchaseUpdatedListener(options).first()
    override suspend fun purchaseError(): PurchaseError = purchaseErrorListener.first()
    override suspend fun promotedProductIOS(): String = ""
    override suspend fun currentEntitlementIOS(sku: String): PurchaseIOS? = null
    override suspend fun getAllTransactionsIOS(): List<PurchaseIOS> = emptyList()
    // Play Integrity and store checks need no billing connection.
    override suspend fun verifyAppOwnership(options: VerifyAppOwnershipProps?): AppOwnershipVerificationResult =
        withMappedOpenIapError {
            val props = options?.let { dev.hyo.openiap.VerifyAppOwnershipProps.fromJson(it.toJson()) }
            AppOwnershipVerificationResult.fromJson(ensureModule().verifyAppOwnership(props).toJson())
        }

    override suspend fun getAppTransactionIOS(): AppTransaction? = null
    override suspend fun getPendingTransactionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun getReceiptDataIOS(): String? = null
    override suspend fun getTransactionJwsIOS(sku: String): String? = null
    override suspend fun getPromotedProductIOS(): io.github.hyochan.kmpiap.openiap.ProductIOS? = null
    override suspend fun beginRefundRequestIOS(sku: String): String? = null
    override suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS> = emptyList()
    override suspend fun syncIOS(): Boolean = false
    override suspend fun clearTransactionIOS(): Boolean = false
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

    private fun requireActivity(): Activity = currentActivity ?: throw AndroidOpenIapError.MissingCurrentActivity

    private fun requireModule(): AndroidOpenIapProtocol =
        module ?: failWith(PurchaseError(code = ErrorCode.NotPrepared, message = "$storeName billing module not initialized"))

    /** The module without a billing connection, for operations that never need one. */
    private suspend fun ensureModule(): AndroidOpenIapProtocol =
        module ?: connectionMutex.withLock { ensureModuleLocked() }

    private fun ensureModuleLocked(): AndroidOpenIapProtocol =
        module ?: OpenIapProvider.create(ensureContext()).also { created ->
            module = created
            registerListeners(created)
        }

    private fun registerListeners(openModule: AndroidOpenIapProtocol) {
        val purchaseUpdate = OpenIapPurchaseUpdateListener { purchase ->
            _purchaseUpdatedListener.tryEmit(purchase.toKmp())
        }
        val purchaseError = OpenIapPurchaseErrorListener { error ->
            _purchaseErrorListener.tryEmit(error.toKmpPurchaseError())
        }
        // Locked so an in-flight initConnection cannot overwrite the drop; runs inline when uncontended.
        val connectionState = OpenIapConnectionStateListener {
            scope.launch(start = CoroutineStart.UNDISPATCHED) {
                connectionMutex.withLock {
                    isConnected = false
                    enabledBillingProgram = null
                }
            }
        }
        openModule.addPurchaseUpdateListener(purchaseUpdate)
        openModule.addPurchaseErrorListener(purchaseError)
        openModule.addConnectionStateListener(connectionState)
        if (hasPlayBillingApis) {
            val issue = OpenIapSubscriptionBillingIssueListener { purchase -> billingIssues.tryEmit(purchase.toKmp()) }
            openModule.addSubscriptionBillingIssueListener(issue)
            billingIssueListener = issue
            val userChoice = OpenIapUserChoiceBillingListener { details ->
                userChoices.tryEmit(UserChoiceBillingDetails.fromJson(details.toJson()))
            }
            val developerChoice = OpenIapDeveloperProvidedBillingListener { details ->
                developerChoices.tryEmit(DeveloperProvidedBillingDetailsAndroid.fromJson(details.toJson()))
            }
            openModule.addUserChoiceBillingListener(userChoice)
            openModule.addDeveloperProvidedBillingListener(developerChoice)
            userChoiceListener = userChoice
            developerChoiceListener = developerChoice
        }

        updateListener = purchaseUpdate
        errorListener = purchaseError
        connectionStateListener = connectionState
    }

    private fun unregisterListeners(openModule: AndroidOpenIapProtocol) {
        updateListener?.let(openModule::removePurchaseUpdateListener)
        errorListener?.let(openModule::removePurchaseErrorListener)
        connectionStateListener?.let(openModule::removeConnectionStateListener)
        billingIssueListener?.let(openModule::removeSubscriptionBillingIssueListener)
        userChoiceListener?.let(openModule::removeUserChoiceBillingListener)
        developerChoiceListener?.let(openModule::removeDeveloperProvidedBillingListener)
        userChoiceListener = null
        developerChoiceListener = null
        updateListener = null
        errorListener = null
        connectionStateListener = null
        billingIssueListener = null
    }

    private suspend fun <T> withMappedOpenIapError(block: suspend () -> T): T =
        try {
            block()
        } catch (error: AndroidOpenIapError) {
            throw PurchaseException(error.toKmpPurchaseError())
        }

    // Play only delivers a choice when initConnection enabled its program; fail fast instead of waiting forever.
    private fun requireEnabledProgram(api: String, vararg programs: BillingProgramAndroid) {
        if (isPlay && enabledBillingProgram !in programs) {
            failWith(
                PurchaseError(
                    code = ErrorCode.DeveloperError,
                    message = "$api requires enableBillingProgramAndroid = ${programs.joinToString(" or ")} in initConnection",
                )
            )
        }
    }

    private fun openPlayRedeemPageFromAppContext(): Purchase? {
        val appContext = ensureContext()
        val redeemPage = Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_REDEEM_OFFER_CODE_URL))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            appContext.startActivity(redeemPage)
        } catch (error: Exception) {
            throw PurchaseException(
                PurchaseError(
                    code = ErrorCode.Unknown,
                    debugMessage = error.message,
                    message = "Failed to open the Play Store redeem page",
                )
            )
        }
        return null
    }

    /** Reports any failure other than our own as PurchaseVerificationFailed. */
    private suspend fun <T> verifyOrFail(block: suspend () -> T): T =
        try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (error: PurchaseException) {
            throw error
        } catch (error: AndroidOpenIapError) {
            // Keeps the cause openiap-google puts in debugMessage.
            failWith(error.toKmpPurchaseError().copy(code = ErrorCode.PurchaseVerificationFailed))
        } catch (error: Exception) {
            failWith(
                PurchaseError(
                    code = ErrorCode.PurchaseVerificationFailed,
                    message = error.message ?: "Purchase verification failed"
                )
            )
        }

    // A refused token throws instead of returning false, which callers tend to ignore.
    private suspend fun finishToken(purchaseToken: String, isConsumable: Boolean): Boolean {
        withMappedOpenIapError { requireModule().finishPurchaseToken(purchaseToken, isConsumable) }
        return true
    }

    private fun failWith(error: PurchaseError): Nothing {
        _purchaseErrorListener.tryEmit(error)
        throw PurchaseException(error)
    }

    private fun failUnsupported(message: String): Nothing =
        failWith(PurchaseError(code = ErrorCode.FeatureNotSupported, message = message))
}

internal fun AndroidOpenIapError.toKmpPurchaseError(): PurchaseError {
    // Preserve native product IDs and request diagnostics. The specific cause in debugMessage beats a
    // code's fixed text, but not a message openiap-google already built around it.
    val payload = toJSON() + mapOf(
        "message" to (debugMessage?.takeIf { it.isNotBlank() && it !in message } ?: message),
    )
    return PurchaseError.fromJson(payload)
}

private fun dev.hyo.openiap.RequestPurchaseResult?.isEmpty(): Boolean = when (this) {
    null -> true
    is dev.hyo.openiap.RequestPurchaseResultPurchase -> value == null
    is dev.hyo.openiap.RequestPurchaseResultPurchases -> value.isNullOrEmpty()
}

private fun RequestPurchaseProps.androidSkus(): List<String> = when (val request = request) {
    is RequestPurchaseProps.Request.Purchase -> request.value.google?.skus
    is RequestPurchaseProps.Request.Subscription -> request.value.google?.skus
}.orEmpty()

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

private fun VerifyPurchaseProps.toOpenIap(): dev.hyo.openiap.VerifyPurchaseProps =
    dev.hyo.openiap.VerifyPurchaseProps.fromJson(toJson())

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
