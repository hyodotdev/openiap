package dev.hyo.openiap.maui

import android.app.Activity
import android.content.Context
import com.google.gson.Gson
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.FetchProductsResult
import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.FetchProductsResultSubscriptions
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.PurchaseOptions
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseResult
import dev.hyo.openiap.RequestPurchaseResultPurchase
import dev.hyo.openiap.RequestPurchaseResultPurchases
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseWithProviderProps
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Java-friendly facade over [OpenIapModule] for the .NET MAUI binding (`Hyo.OpenIap.Maui`).
 *
 * The C# Xamarin.Android binding generator chokes on Kotlin `suspend` functions,
 * Kotlin lambda types (`Function1`/`Function2`), default-arg synthetic methods (`*$default`),
 * and on the transitive `com.android.billingclient` dependency that `OpenIapModule`
 * pulls in. This class re-exposes the full Android-side resolver surface as plain Java
 * methods that take JSON strings, return JSON strings via a `Callback`, and emit
 * listener events through a `EventCallback` interface — keeping `OpenIapModule`
 * itself untouched so the existing kmp-iap / RN / Flutter / Godot wiring is unaffected.
 *
 * Mirrors the role of `packages/apple/Sources/OpenIapModule+ObjC.swift` on iOS.
 */
class OpenIapMauiShim(context: Context) {

    private val module = OpenIapModule(context)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // OpenIapModule.currentActivityRef is private; mirror it here so the Android-only
    // mutations that need an Activity (showAlternativeBillingDialogAndroid,
    // launchExternalLinkAndroid) can throw a typed error if the host app forgot to call setActivity().
    private var currentActivity: Activity? = null

    /**
     * Token-keyed listener registry. Listener objects come back from
     * [OpenIapModule.addPurchaseUpdateListener] etc. as opaque references; the C#
     * binding holds the [Long] token instead of the listener instance so it
     * doesn't have to cross the JNI boundary with a generic type parameter.
     */
    private val listeners = ConcurrentHashMap<Long, ListenerEntry>()
    private val nextListenerToken = AtomicLong(1)

    private fun interface ListenerEntry {
        fun unregister()
    }

    fun interface ResultCallback {
        /**
         * Exactly one of the arguments is non-null on every invocation.
         * @param json   Operation result encoded as JSON, or `null` for void/no-result ops.
         * @param error  Native error, or `null` on success.
         */
        fun onResult(json: String?, error: Throwable?)
    }

    fun interface EventCallback {
        fun onEvent(json: String)
    }

    // -----------------------------------------------------------------
    // Activity wiring (Activity is required for purchase flow + external link launches)
    // -----------------------------------------------------------------

    fun setActivity(activity: Activity?) {
        currentActivity = activity
        module.setActivity(activity)
    }

    // -----------------------------------------------------------------
    // Connection lifecycle
    // -----------------------------------------------------------------

    fun initConnection(configJson: String?, callback: ResultCallback) = run(callback) {
        val cfg = configJson?.let { InitConnectionConfig.fromJson(parseMap(it)) }
        val ok = module.initConnection(cfg)
        wrapBool(ok)
    }

    fun endConnection(callback: ResultCallback) = run(callback) {
        wrapBool(module.endConnection())
    }

    // -----------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------

    fun fetchProducts(paramsJson: String, callback: ResultCallback) = run(callback) {
        val params = ProductRequest.fromJson(parseMap(paramsJson)) ?: throw badInput("ProductRequest", paramsJson)
        encodeFetchProductsResult(module.fetchProducts(params))
    }

    fun getAvailablePurchases(optionsJson: String?, callback: ResultCallback) = run(callback) {
        val options = optionsJson?.let { PurchaseOptions.fromJson(parseMap(it)) }
        // Module's getAvailablePurchases is the suspend handler; the protocol exposes
        // the typealias as `val getAvailablePurchases: QueryGetAvailablePurchasesHandler`
        val purchases = module.getAvailablePurchases(options)
        encodePurchases(purchases)
    }

    fun getActiveSubscriptions(subscriptionIdsJson: String?, callback: ResultCallback) = run(callback) {
        val ids = subscriptionIdsJson?.let { parseStringList(it) }
        val list = module.getActiveSubscriptions(ids)
        encodeMapList(list.map { it.toJson() })
    }

    fun hasActiveSubscriptions(subscriptionIdsJson: String?, callback: ResultCallback) = run(callback) {
        val ids = subscriptionIdsJson?.let { parseStringList(it) }
        wrapBool(module.hasActiveSubscriptions(ids))
    }

    fun getStorefront(callback: ResultCallback) = run(callback) {
        wrapString(module.getStorefront())
    }

    // -----------------------------------------------------------------
    // Mutations — cross-platform
    // -----------------------------------------------------------------

    fun requestPurchase(paramsJson: String, callback: ResultCallback) = run(callback) {
        val props = RequestPurchaseProps.fromJson(parseMap(paramsJson))
        encodeRequestPurchaseResult(module.requestPurchase(props))
    }

    fun finishTransaction(purchaseJson: String, isConsumable: Boolean?, callback: ResultCallback) = run(callback) {
        // PurchaseInput is `typealias PurchaseInput = Purchase`; reuse the union dispatcher
        val purchase: PurchaseInput = dev.hyo.openiap.Purchase.fromJson(parseMap(purchaseJson))
        module.finishTransaction(purchase, isConsumable)
        // Consumers expect a string token-ish result on iOS; Android side has no token,
        // surface an empty string so the C# Task<string> resolves cleanly.
        wrapString("")
    }

    fun restorePurchases(callback: ResultCallback) = run(callback) {
        module.restorePurchases()
        wrapString("")
    }

    fun deepLinkToSubscriptions(optionsJson: String?, callback: ResultCallback) = run(callback) {
        val options = optionsJson?.let { DeepLinkOptions.fromJson(parseMap(it)) }
        module.deepLinkToSubscriptions(options)
        wrapString("")
    }

    fun validateReceipt(propsJson: String, callback: ResultCallback) = run(callback) {
        val props = VerifyPurchaseProps.fromJson(parseMap(propsJson))
        encodeVerifyPurchaseResult(module.validateReceipt(props))
    }

    fun verifyPurchase(propsJson: String, callback: ResultCallback) = run(callback) {
        val props = VerifyPurchaseProps.fromJson(parseMap(propsJson))
        encodeVerifyPurchaseResult(module.verifyPurchase(props))
    }

    fun verifyPurchaseWithProvider(propsJson: String, callback: ResultCallback) = run(callback) {
        val props = VerifyPurchaseWithProviderProps.fromJson(parseMap(propsJson))
            ?: throw badInput("VerifyPurchaseWithProviderProps", propsJson)
        gson.toJson(module.verifyPurchaseWithProvider(props).toJson())
    }

    // -----------------------------------------------------------------
    // Mutations — Android-only
    // -----------------------------------------------------------------

    fun acknowledgePurchaseAndroid(purchaseToken: String, callback: ResultCallback) = run(callback) {
        wrapBool(module.acknowledgePurchaseAndroid(purchaseToken))
    }

    fun consumePurchaseAndroid(purchaseToken: String, callback: ResultCallback) = run(callback) {
        wrapBool(module.consumePurchaseAndroid(purchaseToken))
    }

    fun checkAlternativeBillingAvailabilityAndroid(callback: ResultCallback) = run(callback) {
        wrapBool(module.checkAlternativeBillingAvailability())
    }

    fun showAlternativeBillingDialogAndroid(callback: ResultCallback) = run(callback) {
        val activity = currentActivityOrThrow("showAlternativeBillingDialogAndroid")
        wrapBool(module.showAlternativeBillingInformationDialog(activity))
    }

    fun createAlternativeBillingTokenAndroid(callback: ResultCallback) = run(callback) {
        wrapNullableString(module.createAlternativeBillingReportingToken())
    }

    fun isBillingProgramAvailableAndroid(programJson: String, callback: ResultCallback) = run(callback) {
        val program = parseProgram(programJson)
        gson.toJson(module.isBillingProgramAvailable(program).toJson())
    }

    fun createBillingProgramReportingDetailsAndroid(programJson: String, callback: ResultCallback) = run(callback) {
        val program = parseProgram(programJson)
        gson.toJson(module.createBillingProgramReportingDetails(program).toJson())
    }

    fun launchExternalLinkAndroid(paramsJson: String, callback: ResultCallback) = run(callback) {
        val params = LaunchExternalLinkParamsAndroid.fromJson(parseMap(paramsJson))
            ?: throw badInput("LaunchExternalLinkParamsAndroid", paramsJson)
        val activity = currentActivityOrThrow("launchExternalLinkAndroid")
        wrapBool(module.launchExternalLink(activity, params))
    }

    // -----------------------------------------------------------------
    // Listeners
    // -----------------------------------------------------------------

    fun addPurchaseUpdatedListener(callback: EventCallback): Long {
        val listener = OpenIapPurchaseUpdateListener { purchase ->
            callback.onEvent(gson.toJson(purchase.toJson()))
        }
        module.addPurchaseUpdateListener(listener)
        return register(object : ListenerEntry {
            override fun unregister() = module.removePurchaseUpdateListener(listener)
        })
    }

    fun addPurchaseErrorListener(callback: EventCallback): Long {
        val listener = OpenIapPurchaseErrorListener { error ->
            callback.onEvent(gson.toJson(encodeError(error)))
        }
        module.addPurchaseErrorListener(listener)
        return register(object : ListenerEntry {
            override fun unregister() = module.removePurchaseErrorListener(listener)
        })
    }

    fun addSubscriptionBillingIssueListener(callback: EventCallback): Long {
        val listener = OpenIapSubscriptionBillingIssueListener { purchase ->
            callback.onEvent(gson.toJson(purchase.toJson()))
        }
        module.addSubscriptionBillingIssueListener(listener)
        return register(object : ListenerEntry {
            override fun unregister() = module.removeSubscriptionBillingIssueListener(listener)
        })
    }

    fun addUserChoiceBillingAndroidListener(callback: EventCallback): Long {
        val listener = OpenIapUserChoiceBillingListener { details ->
            callback.onEvent(gson.toJson(details.toJson()))
        }
        module.addUserChoiceBillingListener(listener)
        return register(object : ListenerEntry {
            override fun unregister() = module.removeUserChoiceBillingListener(listener)
        })
    }

    fun addDeveloperProvidedBillingAndroidListener(callback: EventCallback): Long {
        val listener = OpenIapDeveloperProvidedBillingListener { details ->
            callback.onEvent(gson.toJson(details.toJson()))
        }
        module.addDeveloperProvidedBillingListener(listener)
        return register(object : ListenerEntry {
            override fun unregister() = module.removeDeveloperProvidedBillingListener(listener)
        })
    }

    fun removeListener(token: Long) {
        listeners.remove(token)?.unregister()
    }

    fun removeAllListeners() {
        val snapshot = listeners.values.toList()
        listeners.clear()
        snapshot.forEach { it.unregister() }
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    private fun register(entry: ListenerEntry): Long {
        val token = nextListenerToken.getAndIncrement()
        listeners[token] = entry
        return token
    }

    private fun currentActivityOrThrow(@Suppress("UNUSED_PARAMETER") api: String): Activity {
        // setActivity(...) is called by the host MAUI app on lifecycle events;
        // when it hasn't fired yet, surfacing OpenIapError.MissingCurrentActivity makes
        // the error path obvious instead of a generic NullPointerException.
        return currentActivity ?: throw OpenIapError.MissingCurrentActivity
    }

    /**
     * Run a suspending block off the main thread and route its result/error through [callback].
     * The block returns the JSON-encoded payload (or null for void).
     */
    private inline fun run(callback: ResultCallback, crossinline block: suspend () -> String?) {
        scope.launch {
            try {
                callback.onResult(block(), null)
            } catch (e: Throwable) {
                callback.onResult(null, e)
            }
        }
    }

    private fun parseMap(json: String): Map<String, Any?> {
        @Suppress("UNCHECKED_CAST")
        return gson.fromJson(json, Map::class.java) as Map<String, Any?>
    }

    private fun parseStringList(json: String): List<String> {
        @Suppress("UNCHECKED_CAST")
        return (gson.fromJson(json, List::class.java) as List<String>)
    }

    private fun parseProgram(json: String): BillingProgramAndroid {
        // Accept either a bare enum string ("user-choice-billing") or a wrapped {"value": "..."}.
        val trimmed = json.trim()
        val raw = if (trimmed.startsWith("\"")) {
            trimmed.removeSurrounding("\"")
        } else {
            (gson.fromJson(trimmed, Map::class.java)["value"] as? String) ?: trimmed
        }
        return BillingProgramAndroid.fromJson(raw)
    }

    private fun wrapBool(v: Boolean): String = gson.toJson(mapOf("value" to v))
    private fun wrapString(v: String): String = gson.toJson(mapOf("value" to v))
    private fun wrapNullableString(v: String?): String = gson.toJson(mapOf("value" to v))

    /**
     * Sealed-union dispatcher: collapse a typed [FetchProductsResult] to its JSON form.
     * The C# binding inspects `kind` to know which branch was taken.
     */
    private fun encodeFetchProductsResult(r: FetchProductsResult): String {
        return when (r) {
            is FetchProductsResultAll -> gson.toJson(mapOf(
                "kind" to "all",
                "items" to (r.value ?: emptyList()).map { it.toJson() }
            ))
            is FetchProductsResultProducts -> gson.toJson(mapOf(
                "kind" to "products",
                "items" to (r.value ?: emptyList()).map { it.toJson() }
            ))
            is FetchProductsResultSubscriptions -> gson.toJson(mapOf(
                "kind" to "subscriptions",
                "items" to (r.value ?: emptyList()).map { it.toJson() }
            ))
        }
    }

    private fun encodeRequestPurchaseResult(r: RequestPurchaseResult?): String {
        if (r == null) return gson.toJson(mapOf("kind" to "none"))
        return when (r) {
            is RequestPurchaseResultPurchase -> gson.toJson(mapOf(
                "kind" to "purchase",
                "value" to r.value?.toJson()
            ))
            is RequestPurchaseResultPurchases -> gson.toJson(mapOf(
                "kind" to "purchases",
                "items" to (r.value ?: emptyList()).map { it.toJson() }
            ))
        }
    }

    private fun encodeVerifyPurchaseResult(r: dev.hyo.openiap.VerifyPurchaseResult): String {
        return gson.toJson(r.toJson())
    }

    private fun encodePurchases(list: List<dev.hyo.openiap.Purchase>): String {
        return gson.toJson(mapOf("items" to list.map { it.toJson() }))
    }

    private fun encodeMapList(list: List<Map<String, Any?>>): String {
        return gson.toJson(mapOf("items" to list))
    }

    /**
     * OpenIapError doesn't expose the generated `PurchaseError` JSON directly
     * (it's an `Exception` subclass). Build the canonical payload that the
     * generated C# record expects.
     */
    private fun encodeError(e: OpenIapError): Map<String, Any?> {
        val productId = when (e) {
            is OpenIapError.ProductNotFound -> e.productId
            else -> null
        }
        return mapOf(
            "code" to e.code,
            "message" to e.message,
            "productId" to productId,
            "debugMessage" to e.debugMessage,
        )
    }

    private fun badInput(typeName: String, json: String): IllegalArgumentException {
        // The generated `Type.fromJson(Map)` returns null when required fields are missing.
        // Surface this as a typed error so the C# side can map it to OpenIapError.DeveloperError.
        return IllegalArgumentException("Could not decode $typeName from JSON: $json")
    }
}
