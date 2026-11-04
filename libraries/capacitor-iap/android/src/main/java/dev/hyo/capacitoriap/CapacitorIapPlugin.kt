package dev.hyo.capacitoriap

import android.app.Activity
import android.content.pm.ApplicationInfo
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.DeveloperBillingTypeAndroid
import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid
import dev.hyo.openiap.IapEvent
import dev.hyo.openiap.InAppMessageParamsAndroid
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseOptions
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseResultPurchase
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.VerifyAppOwnershipProps
import dev.hyo.openiap.VerifyPurchaseGoogleOptions
import dev.hyo.openiap.VerifyPurchaseHorizonOptions
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseWithProviderProps
import dev.hyo.openiap.helpers.OpenIapFirstPurchaseNotice
import dev.hyo.openiap.helpers.finishPurchaseToken
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.utils.redeemOfferCode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Bridges the capacitor-iap JavaScript API to openiap-google. Every method
 * resolves `{ value }` and rejects with the OpenIAP error code, carrying the
 * full PurchaseError payload as the rejection's data.
 */
@CapacitorPlugin(name = "CapacitorIap")
class CapacitorIapPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val connectionMutex = Mutex()
    // The application context: the provider outlives this plugin's Activity.
    private val openIapLazy: Lazy<OpenIapProtocol> = lazy { OpenIapProvider.create(context.applicationContext) }
    private val openIap: OpenIapProtocol get() = openIapLazy.value
    private var listenersAttached = false
    private val removeListeners = mutableListOf<() -> Unit>()

    // Play reports some purchase failures only as error events, so a pending
    // requestPurchase settles on whichever arrives first: the result or an error.
    private val pendingPurchases = PendingRequests<PluginCall>()

    // Connection

    @PluginMethod
    fun initConnection(call: PluginCall) {
        launch(call, "initConnection", OpenIapError.InitConnection.CODE) {
            connectionMutex.withLock {
                // Horizon needs the Activity before initConnection to set up OVRPlatform.
                activity?.let { openIap.setActivity(it) }
                attachListeners()
                val config = call.getObject("config")?.let { InitConnectionConfig.fromJson(JsonBridge.toMap(it)) }
                if (!openIap.initConnection(config)) throw OpenIapError.InitConnection.forProvider(context)
                true
            }
        }
    }

    @PluginMethod
    fun endConnection(call: PluginCall) {
        launch(call, "endConnection", OpenIapError.ServiceDisconnected.CODE) {
            connectionMutex.withLock {
                if (!openIapLazy.isInitialized()) return@withLock true
                try {
                    openIap.endConnection()
                } finally {
                    detachListeners()
                    pendingPurchases.settleAll { it.rejectWith(OpenIapError.ServiceDisconnected()) }
                }
            }
        }
    }

    // Products and purchases

    @PluginMethod
    fun fetchProducts(call: PluginCall) {
        launch(call, "fetchProducts", OpenIapError.QueryProduct.CODE) {
            val skus = stringList(call, "skus")
            val type = ProductQueryType.fromJson(call.getString("type") ?: "in-app")
            when (val result = openIap.fetchProducts(ProductRequest(skus, type))) {
                is FetchProductsResultAll -> result.value.orEmpty().map { it.toJson() }
                is FetchProductsResultProducts -> result.value.orEmpty().map { it.toJson() }
                is FetchProductsResultSubscriptions -> result.value.orEmpty().map { it.toJson() }
            }
        }
    }

    @PluginMethod
    fun requestPurchase(call: PluginCall) {
        val props =
            try {
                RequestPurchaseProps.fromJson(JsonBridge.toMap(call.getObject("request") ?: JSObject()))
            } catch (error: RuntimeException) {
                // The generated decoder throws on a missing branch and casts on wrong types.
                call.rejectWith(OpenIapError.DeveloperError(error.message))
                return
            }

        pendingPurchases.add(call)
        scope.launch {
            try {
                // Without an Activity the provider reports MissingCurrentActivity as an error event.
                openIap.setActivity(activity)
                val purchases =
                    when (val result = openIap.requestPurchase(props)) {
                        is RequestPurchaseResultPurchases -> result.value.orEmpty()
                        is RequestPurchaseResultPurchase -> listOfNotNull(result.value)
                        else -> emptyList()
                    }
                val payload = purchases.map { it.toJson() }
                pendingPurchases.settleAll { it.resolveValue(payload) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                val openIapError = error as? OpenIapError ?: OpenIapError.PurchaseFailed(error.message)
                pendingPurchases.settleAll { it.rejectWith(openIapError) }
            }
        }
    }

    @PluginMethod
    fun finishTransaction(call: PluginCall) {
        launch(call, "finishTransaction", OpenIapError.DeveloperError.CODE) {
            val purchase = PurchaseAndroid.fromJson(JsonBridge.toMap(call.getObject("purchase") ?: JSObject()))
            openIap.finishTransaction(purchase, call.getBoolean("isConsumable", false))
            true
        }
    }

    @PluginMethod
    fun acknowledgePurchaseAndroid(call: PluginCall) {
        launch(call, "acknowledgePurchaseAndroid") {
            openIap.finishPurchaseToken(requireString(call, "purchaseToken"), isConsumable = false)
            true
        }
    }

    @PluginMethod
    fun consumePurchaseAndroid(call: PluginCall) {
        launch(call, "consumePurchaseAndroid") {
            openIap.finishPurchaseToken(requireString(call, "purchaseToken"), isConsumable = true)
            true
        }
    }

    @PluginMethod
    fun getAvailablePurchases(call: PluginCall) {
        launch(call, "getAvailablePurchases") {
            val options = call.getObject("options")?.let { PurchaseOptions.fromJson(JsonBridge.toMap(it)) }
            openIap.getAvailablePurchases(options).map { it.toJson() }
        }
    }

    @PluginMethod
    fun getActiveSubscriptions(call: PluginCall) {
        launch(call, "getActiveSubscriptions") {
            openIap.getActiveSubscriptions(optionalStringList(call, "subscriptionIds")).map { it.toJson() }
        }
    }

    @PluginMethod
    fun hasActiveSubscriptions(call: PluginCall) {
        launch(call, "hasActiveSubscriptions") {
            openIap.hasActiveSubscriptions(optionalStringList(call, "subscriptionIds"))
        }
    }

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        launch(call, "restorePurchases") {
            openIap.restorePurchases()
            true
        }
    }

    @PluginMethod
    fun deepLinkToSubscriptions(call: PluginCall) {
        launch(call, "deepLinkToSubscriptions") {
            val options = call.getObject("options")?.let { DeepLinkOptions.fromJson(JsonBridge.toMap(it)) }
            openIap.deepLinkToSubscriptions(options ?: DeepLinkOptions())
            true
        }
    }

    @PluginMethod
    fun openRedeemOfferCode(call: PluginCall) {
        launch(call, "openRedeemOfferCode") {
            redeemOfferCode(openIap, activity)?.toJson()
        }
    }

    @PluginMethod
    fun getStorefront(call: PluginCall) {
        launch(call, "getStorefront") { openIap.getStorefront() }
    }

    @PluginMethod
    fun verifyPurchase(call: PluginCall) {
        launch(call, "verifyPurchase", OpenIapError.VerificationFailed.CODE) {
            openIap.verifyPurchase(verifyPurchaseProps(JsonBridge.toMap(call.getObject("props") ?: JSObject()))).toJson()
        }
    }

    @PluginMethod
    fun verifyPurchaseWithProvider(call: PluginCall) {
        launch(call, "verifyPurchaseWithProvider", OpenIapError.VerificationFailed.CODE) {
            val props =
                VerifyPurchaseWithProviderProps.fromJson(JsonBridge.toMap(call.getObject("props") ?: JSObject()))
                    ?: throw IllegalArgumentException("Invalid verifyPurchaseWithProvider params")
            openIap.verifyPurchaseWithProvider(props).toJson()
        }
    }

    @PluginMethod
    fun verifyAppOwnership(call: PluginCall) {
        launch(call, "verifyAppOwnership") {
            val options = VerifyAppOwnershipProps.fromJson(JsonBridge.toMap(call.getObject("options") ?: JSObject()))
            openIap.verifyAppOwnership(options).toJson()
        }
    }

    /** iOS only: Android delivers every purchase update once. */
    @PluginMethod
    fun setPurchaseUpdatedListenerOptions(call: PluginCall) {
        call.resolveValue(true)
    }

    // Internal: backs the JS first-purchase notice; not app API.
    @PluginMethod
    fun claimFirstPurchaseNotice(call: PluginCall) {
        val debuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        call.resolveValue(debuggable && OpenIapFirstPurchaseNotice.claim(context))
    }

    // Billing programs (Play Billing 8.2.0+)

    @PluginMethod
    fun isBillingProgramAvailableAndroid(call: PluginCall) {
        launch(call, "isBillingProgramAvailableAndroid") {
            openIap.isBillingProgramAvailable(BillingProgramAndroid.fromJson(requireString(call, "program"))).toJson()
        }
    }

    @PluginMethod
    fun getBillingChoiceInfoAndroid(call: PluginCall) {
        launch(call, "getBillingChoiceInfoAndroid") {
            val params = GetBillingChoiceInfoParamsAndroid.fromJson(JsonBridge.toMap(call.getObject("params") ?: JSObject()))
            openIap.getBillingChoiceInfo(params).toJson()
        }
    }

    @PluginMethod
    fun createBillingProgramReportingDetailsAndroid(call: PluginCall) {
        launch(call, "createBillingProgramReportingDetailsAndroid") {
            openIap
                .createBillingProgramReportingDetails(
                    BillingProgramAndroid.fromJson(requireString(call, "program")),
                    call.getString("developerBillingType")?.let(DeveloperBillingTypeAndroid::fromJson),
                ).toJson()
        }
    }

    @PluginMethod
    fun launchExternalLinkAndroid(call: PluginCall) {
        launch(call, "launchExternalLinkAndroid") {
            val params =
                LaunchExternalLinkParamsAndroid.fromJson(JsonBridge.toMap(call.getObject("params") ?: JSObject()))
                    ?: throw IllegalArgumentException("launchExternalLinkAndroid requires billingProgram and linkUri")
            openIap.launchExternalLink(requireActivity(), params)
        }
    }

    @PluginMethod
    fun showBillingProgramInformationDialogAndroid(call: PluginCall) {
        launch(call, "showBillingProgramInformationDialogAndroid") {
            val params =
                BillingProgramInformationDialogParamsAndroid.fromJson(JsonBridge.toMap(call.getObject("params") ?: JSObject()))
                    ?: throw IllegalArgumentException("externalTransactionToken is required")
            openIap.showBillingProgramInformationDialog(requireActivity(), params).toJson()
        }
    }

    @PluginMethod
    fun showInAppMessagesAndroid(call: PluginCall) {
        launch(call, "showInAppMessagesAndroid") {
            val params = call.getObject("params")?.let { InAppMessageParamsAndroid.fromJson(JsonBridge.toMap(it)) }
            openIap.showInAppMessages(requireActivity(), params).toJson()
        }
    }

    override fun handleOnDestroy() {
        detachListeners()
        pendingPurchases.settleAll { it.rejectWith(OpenIapError.ServiceDisconnected()) }
        scope.cancel()
        // The process can outlive the Activity; release the billing connection.
        if (openIapLazy.isInitialized()) {
            val provider = openIap
            provider.setActivity(null)
            CoroutineScope(Dispatchers.Main).launch { runCatching { provider.endConnection() } }
        }
    }

    // Events

    private fun attachListeners() {
        if (listenersAttached) return
        listenersAttached = true

        val purchaseUpdated = OpenIapPurchaseUpdateListener { emit(IapEvent.PurchaseUpdated, it.toJson(), retain = true) }
        val purchaseError =
            OpenIapPurchaseErrorListener { error ->
                emit(IapEvent.PurchaseError, error.toJSON())
                pendingPurchases.settleAll { it.rejectWith(error) }
            }
        val userChoiceBilling = OpenIapUserChoiceBillingListener { emit(IapEvent.UserChoiceBillingAndroid, it.toJson()) }
        val developerProvidedBilling =
            OpenIapDeveloperProvidedBillingListener { emit(IapEvent.DeveloperProvidedBillingAndroid, it.toJson()) }
        val billingIssue = OpenIapSubscriptionBillingIssueListener { emit(IapEvent.SubscriptionBillingIssue, it.toJson()) }

        openIap.addPurchaseUpdateListener(purchaseUpdated)
        openIap.addPurchaseErrorListener(purchaseError)
        openIap.addUserChoiceBillingListener(userChoiceBilling)
        openIap.addDeveloperProvidedBillingListener(developerProvidedBilling)
        openIap.addSubscriptionBillingIssueListener(billingIssue)
        removeListeners +=
            listOf(
                { openIap.removePurchaseUpdateListener(purchaseUpdated) },
                { openIap.removePurchaseErrorListener(purchaseError) },
                { openIap.removeUserChoiceBillingListener(userChoiceBilling) },
                { openIap.removeDeveloperProvidedBillingListener(developerProvidedBilling) },
                { openIap.removeSubscriptionBillingIssueListener(billingIssue) },
            )
    }

    private fun detachListeners() {
        removeListeners.forEach { it() }
        removeListeners.clear()
        listenersAttached = false
    }

    // A retained purchase waits in Capacitor until JavaScript listens, so one
    // delivered during initConnection is not lost; other events go only to
    // current listeners.
    private fun emit(
        event: IapEvent,
        payload: Map<String, Any?>,
        retain: Boolean = false,
    ) {
        scope.launch { notifyListeners(event.rawValue, JsonBridge.toJSObject(payload), retain) }
    }

    // Bridging

    private fun requireActivity(): Activity = activity ?: throw OpenIapError.MissingCurrentActivity

    /** Runs `body` on the main dispatcher and resolves `{ value }`, or rejects with the OpenIAP error. */
    private fun launch(
        call: PluginCall,
        name: String,
        fallbackCode: String = OpenIapError.ServiceUnavailable.CODE,
        body: suspend () -> Any?,
    ) {
        scope.launch {
            try {
                call.resolveValue(body())
            } catch (error: CancellationException) {
                throw error
            } catch (error: OpenIapError) {
                call.rejectWith(error)
            } catch (error: IllegalArgumentException) {
                call.rejectWith(OpenIapError.DeveloperError(error.message ?: "Invalid arguments for $name"))
            } catch (error: Exception) {
                call.rejectWith(error, fallbackCode)
            }
        }
    }

    private fun PluginCall.resolveValue(value: Any?) {
        resolve(JSObject().put("value", JsonBridge.toJson(value)))
    }

    private fun PluginCall.rejectWith(error: OpenIapError) {
        reject(error.message ?: error.code, error.code, null, JsonBridge.toJSObject(error.toJSON()))
    }

    private fun PluginCall.rejectWith(
        error: Exception,
        code: String,
    ) {
        val message = error.message ?: code
        val payload = mapOf("code" to code, "message" to message, "debugMessage" to error.message, "platform" to "android")
        reject(message, code, error, JsonBridge.toJSObject(payload))
    }

    private fun requireString(
        call: PluginCall,
        key: String,
    ): String = call.getString(key)?.takeIf { it.isNotBlank() } ?: throw IllegalArgumentException("$key is required")

    private fun stringList(
        call: PluginCall,
        key: String,
    ): List<String> = call.getArray(key)?.toList<String>().orEmpty()

    private fun optionalStringList(
        call: PluginCall,
        key: String,
    ): List<String>? = if (call.getData().isNull(key)) null else stringList(call, key)
}

@Suppress("UNCHECKED_CAST")
internal fun verifyPurchaseProps(params: Map<String, Any?>): VerifyPurchaseProps {
    fun required(
        options: Map<String, Any?>,
        scope: String,
        field: String,
    ): String =
        (options[field] as? String)?.takeIf { it.isNotEmpty() }
            ?: throw IllegalArgumentException("Missing or empty required parameter: $scope.$field")

    val google =
        (params["google"] as? Map<String, Any?>)?.let { options ->
            VerifyPurchaseGoogleOptions(
                sku = required(options, "google", "sku"),
                accessToken = required(options, "google", "accessToken"),
                packageName = required(options, "google", "packageName"),
                purchaseToken = required(options, "google", "purchaseToken"),
                isSub = options["isSub"] as? Boolean,
            )
        }
    val horizon =
        (params["horizon"] as? Map<String, Any?>)?.let { options ->
            VerifyPurchaseHorizonOptions(
                sku = required(options, "horizon", "sku"),
                userId = required(options, "horizon", "userId"),
                accessToken = required(options, "horizon", "accessToken"),
            )
        }
    return VerifyPurchaseProps(google = google, horizon = horizon)
}
