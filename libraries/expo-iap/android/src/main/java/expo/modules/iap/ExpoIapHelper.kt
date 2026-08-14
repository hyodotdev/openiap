package expo.modules.iap

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue

object ExpoIapHelper {
    private const val MAX_BUFFERED_EVENTS = 200
    internal const val ERROR_ENVELOPE_PREFIX = "OPENIAP_ERROR_JSON:"

    data class ListenerHandles(
        val purchaseUpdate: OpenIapPurchaseUpdateListener,
        val purchaseError: OpenIapPurchaseErrorListener,
        val userChoiceBilling: OpenIapUserChoiceBillingListener,
        val developerProvidedBilling: OpenIapDeveloperProvidedBillingListener,
        val subscriptionBillingIssue: OpenIapSubscriptionBillingIssueListener,
    )

    internal fun serializeOpenIapError(error: OpenIapError): Map<String, Any?> =
        error.toJSON() +
            when (error) {
                is OpenIapError.ProductNotFound -> mapOf("productId" to error.productId)
                is OpenIapError.SkuNotFound -> mapOf("productId" to error.sku)
                else -> emptyMap()
            }

    internal fun serializeErrorEnvelope(payload: Map<String, Any?>): String = ERROR_ENVELOPE_PREFIX + JSONObject(payload).toString()

    fun emitOrQueue(
        module: Module,
        scope: CoroutineScope,
        connectionReady: java.util.concurrent.atomic.AtomicBoolean,
        pendingEvents: ConcurrentLinkedQueue<Pair<String, Map<String, Any?>>>,
        name: String,
        payload: Map<String, Any?>,
    ) {
        if (connectionReady.get()) {
            // Ensure event emission occurs on the main dispatcher
            scope.launch { module.sendEvent(name, payload) }
            return
        }
        // Bound the buffer to prevent unbounded growth if init stalls
        if (pendingEvents.size >= MAX_BUFFERED_EVENTS) {
            pendingEvents.poll()
            ExpoIapLog.warning("pendingEvents overflow; dropping oldest")
        }
        pendingEvents.add(name to payload)
    }

    fun parseProductQueryType(rawType: String?): ProductQueryType {
        val normalized = rawType?.trim()?.lowercase(Locale.US)
        return when (normalized) {
            null, "", "in-app" -> ProductQueryType.InApp
            "subs" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            else -> throw IllegalArgumentException(
                "Unsupported product type: $rawType. Use in-app, subs, or all.",
            )
        }
    }

    fun parsePurchaseProductQueryType(rawType: String?): ProductQueryType {
        val type = parseProductQueryType(rawType)
        require(type != ProductQueryType.All) {
            "Product type all is only supported for product queries."
        }
        return type
    }

    internal fun parseDeepLinkSubscriptionParams(params: Map<String, Any?>): DeepLinkSubscriptionParams {
        return DeepLinkSubscriptionParams(
            sku = params["skuAndroid"] as? String,
            packageName = params["packageNameAndroid"] as? String,
        )
    }

    fun parseRequestPurchaseParams(params: Map<String, Any?>): RequestPurchaseParams {
        // If the params contain a canonical request.google envelope, flatten it
        // before parsing the native request.
        val effective: Map<String, Any?> =
            run {
                if (params.containsKey("request")) {
                    val request = params["request"]
                    require(request is Map<*, *>) { "request must be an object" }
                    val nested = request["google"]
                    require(nested is Map<*, *> && nested.keys.all { it is String }) {
                        "request.google must be an object with string keys"
                    }
                    require(!nested.containsKey("type")) {
                        "type must be provided only at the purchase envelope"
                    }
                    val flat = mutableMapOf<String, Any?>()
                    // Carry over top-level fields such as the purchase type.
                    for ((k, v) in params) {
                        if (k != "request") flat[k] = v
                    }
                    // Overlay platform-specific fields.
                    for ((k, v) in nested) {
                        flat[k as String] = v
                    }
                    flat
                } else {
                    params
                }
            }

        require(effective["type"] == null || effective["type"] is String) {
            "type must be a string"
        }
        effective["skus"]?.let { rawSkus ->
            require(rawSkus is List<*> && rawSkus.all { it is String && it.isNotBlank() }) {
                "skus must contain only non-empty strings"
            }
        }
        for (key in listOf(
            "obfuscatedAccountId",
            "obfuscatedProfileId",
            "purchaseToken",
            "originalExternalTransactionId",
            "offerToken",
        )) {
            require(effective[key] == null || effective[key] is String) { "$key must be a string" }
        }
        require(effective["isOfferPersonalized"] == null || effective["isOfferPersonalized"] is Boolean) {
            "isOfferPersonalized must be a boolean"
        }
        for (key in listOf("developerBillingOption", "subscriptionProductReplacementParams")) {
            effective[key]?.let { value ->
                require(value is Map<*, *> && value.keys.all { it is String }) {
                    "$key must be an object with string keys"
                }
            }
        }
        effective["subscriptionOffers"]?.let { rawOffers ->
            require(rawOffers is List<*>) { "subscriptionOffers must be a list" }
            require(rawOffers.all { rawOffer ->
                val offer = rawOffer as? Map<*, *> ?: return@all false
                val sku = offer["sku"] as? String
                val token = offer["offerToken"] as? String
                offer.keys.all { it is String } && !sku.isNullOrBlank() && !token.isNullOrBlank()
            }) { "subscriptionOffers must contain valid sku and offerToken strings" }
        }

        val type = effective["type"] as? String
        val purchaseType = parsePurchaseProductQueryType(type)
        val subscriptionOnlyFields = listOf(
            "subscriptionOffers",
            "subscriptionProductReplacementParams",
            "purchaseToken",
            "originalExternalTransactionId",
        )
        require(
            purchaseType != ProductQueryType.InApp ||
                subscriptionOnlyFields.none { effective[it] != null },
        ) { "Subscription options require product type subs" }
        require(purchaseType != ProductQueryType.Subs || effective["offerToken"] == null) {
            "offerToken requires product type in-app"
        }
        val skus = (effective["skus"] as? List<*>)?.map { it as String } ?: emptyList()
        val obfuscatedAccountId = effective["obfuscatedAccountId"] as? String
        val obfuscatedProfileId = effective["obfuscatedProfileId"] as? String
        val isOfferPersonalized = effective["isOfferPersonalized"] as? Boolean ?: false
        val explicitSubscriptionOffers =
            (effective["subscriptionOffers"] as? List<*>)?.map { rawOffer ->
                val offerMap = rawOffer as Map<*, *>
                val sku = offerMap["sku"] as String
                val offerToken = offerMap["offerToken"] as String
                AndroidSubscriptionOfferInput(offerToken = offerToken, sku = sku)
            } ?: emptyList()
        val purchaseToken = effective["purchaseToken"] as? String
        val originalExternalTransactionId = effective["originalExternalTransactionId"] as? String
        val developerBillingOption =
            (effective["developerBillingOption"] as? Map<*, *>)?.let { optionMap ->
                val json =
                    optionMap.entries
                        .associate { (key, value) -> key as String to value }
                DeveloperBillingOptionParamsAndroid.fromJson(json)
            }
        val subscriptionProductReplacementParams =
            (effective["subscriptionProductReplacementParams"] as? Map<*, *>)?.let { paramsMap ->
                val json = paramsMap.entries.associate { (key, value) -> key as String to value }
                SubscriptionProductReplacementParamsAndroid.fromJson(json)
            }
        // offerToken for one-time purchase discounts (Android 8.0+)
        val offerToken = effective["offerToken"] as? String

        return RequestPurchaseParams(
            type = type,
            skus = skus,
            obfuscatedAccountId = obfuscatedAccountId,
            obfuscatedProfileId = obfuscatedProfileId,
            isOfferPersonalized = isOfferPersonalized,
            offerToken = offerToken,
            explicitSubscriptionOffers = explicitSubscriptionOffers,
            developerBillingOption = developerBillingOption,
            originalExternalTransactionId = originalExternalTransactionId,
            purchaseToken = purchaseToken,
            subscriptionProductReplacementParams = subscriptionProductReplacementParams,
        )
    }

    fun parseSubscriptionReplacementMode(mode: String): SubscriptionReplacementModeAndroid =
        when (mode) {
            "with-time-proration" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "charge-prorated-price" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "charge-full-price" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "without-proration" -> SubscriptionReplacementModeAndroid.WithoutProration
            "deferred" -> SubscriptionReplacementModeAndroid.Deferred
            "keep-existing" -> SubscriptionReplacementModeAndroid.KeepExisting
            else -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
        }

    data class RequestPurchaseParams(
        val type: String?,
        val skus: List<String>,
        val obfuscatedAccountId: String?,
        val obfuscatedProfileId: String?,
        val isOfferPersonalized: Boolean,
        /** Offer token for one-time purchase discounts (Android 8.0+) */
        val offerToken: String?,
        val explicitSubscriptionOffers: List<AndroidSubscriptionOfferInput>,
        val developerBillingOption: DeveloperBillingOptionParamsAndroid?,
        val originalExternalTransactionId: String?,
        val purchaseToken: String?,
        val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?,
    )

    internal data class DeepLinkSubscriptionParams(
        val sku: String?,
        val packageName: String?,
    )

    fun addPurchasePromise(promise: Promise) {
        PromiseUtils.addPromiseForKey(PromiseUtils.PROMISE_BUY_ITEM, promise)
    }

    fun resolvePurchasePromises(purchases: List<Map<String, Any?>>) {
        PromiseUtils.resolvePromisesForKey(
            PromiseUtils.PROMISE_BUY_ITEM,
            purchases,
        )
    }

    fun rejectPurchasePromises(
        code: String,
        message: String?,
        error: Exception?,
    ) {
        PromiseUtils.rejectPromisesForKey(
            PromiseUtils.PROMISE_BUY_ITEM,
            code,
            message,
            error,
        )
    }

    /**
     * Helper to safely emit an event with error fallback.
     * Reduces code duplication across listener handlers.
     */
    private fun safeEmitEvent(
        module: Module,
        scope: CoroutineScope,
        connectionReady: java.util.concurrent.atomic.AtomicBoolean,
        pendingEvents: ConcurrentLinkedQueue<Pair<String, Map<String, Any?>>>,
        eventName: String,
        payload: Map<String, Any?>,
        eventPurchaseError: String,
        fallbackErrorCode: String,
        fallbackErrorPrefix: String,
        logTag: String,
    ) {
        runCatching {
            emitOrQueue(module, scope, connectionReady, pendingEvents, eventName, payload)
        }.onFailure { error ->
            ExpoIapLog.failure("buffer/send $logTag", error)
            val errorPayload =
                mapOf(
                    "code" to fallbackErrorCode,
                    "message" to "$fallbackErrorPrefix: ${error.message}",
                )
            runCatching {
                emitOrQueue(module, scope, connectionReady, pendingEvents, eventPurchaseError, errorPayload)
            }.onFailure { ExpoIapLog.failure("send error event", it) }
        }
    }

    fun setupListeners(
        openIap: OpenIapModule,
        module: Module,
        scope: CoroutineScope,
        connectionReady: java.util.concurrent.atomic.AtomicBoolean,
        pendingEvents: ConcurrentLinkedQueue<Pair<String, Map<String, Any?>>>,
        eventPurchaseUpdated: String,
        eventPurchaseError: String,
        eventUserChoiceBilling: String,
        eventDeveloperProvidedBilling: String,
        eventSubscriptionBillingIssue: String,
    ): ListenerHandles {
        val purchaseUpdateListener =
            OpenIapPurchaseUpdateListener { p ->
                runCatching {
                    emitOrQueue(
                        module,
                        scope,
                        connectionReady,
                        pendingEvents,
                        eventPurchaseUpdated,
                        p.toJson(),
                    )
                }.onFailure { error ->
                    ExpoIapLog.failure("buffer/send PURCHASE_UPDATED", error)
                    // Emit as purchase error so user knows something went wrong
                    val errorPayload =
                        mapOf(
                            "code" to OpenIapError.PurchaseFailed.CODE,
                            "message" to "Failed to process purchase update: ${error.message}",
                        )
                    runCatching {
                        emitOrQueue(
                            module,
                            scope,
                            connectionReady,
                            pendingEvents,
                            eventPurchaseError,
                            errorPayload,
                        )
                    }.onFailure { ExpoIapLog.failure("send error event", it) }
                }
            }
        openIap.addPurchaseUpdateListener(purchaseUpdateListener)

        val purchaseErrorListener =
            OpenIapPurchaseErrorListener { e ->
                val errorJson = serializeOpenIapError(e)
                runCatching {
                    emitOrQueue(
                        module,
                        scope,
                        connectionReady,
                        pendingEvents,
                        eventPurchaseError,
                        errorJson,
                    )
                }.onFailure { error ->
                    ExpoIapLog.failure("buffer/send PURCHASE_ERROR", error)
                    // Critical: if we can't emit the original error, at least try to emit a generic one
                    val fallbackPayload =
                        mapOf(
                            "code" to OpenIapError.UnknownError.CODE,
                            "message" to "Failed to emit purchase error: ${error.message}",
                        )
                    runCatching {
                        emitOrQueue(
                            module,
                            scope,
                            connectionReady,
                            pendingEvents,
                            eventPurchaseError,
                            fallbackPayload,
                        )
                    }.onFailure { ExpoIapLog.failure("send fallback error event", it) }
                }
                // Also reject any pending purchase promises to match iOS behavior
                val errorCode = errorJson["code"] as? String ?: OpenIapError.PurchaseFailed.CODE
                rejectPurchasePromises(
                    errorCode,
                    serializeErrorEnvelope(errorJson),
                    null,
                )
            }
        openIap.addPurchaseErrorListener(purchaseErrorListener)

        val userChoiceBillingListener =
            OpenIapUserChoiceBillingListener { details ->
                safeEmitEvent(
                    module,
                    scope,
                    connectionReady,
                    pendingEvents,
                    eventUserChoiceBilling,
                    details.toJson(),
                    eventPurchaseError,
                    "alternative-billing-not-available",
                    "Failed to process user choice billing",
                    "USER_CHOICE_BILLING",
                )
            }
        openIap.addUserChoiceBillingListener(userChoiceBillingListener)

        // Developer Provided Billing listener for External Payments (8.3.0+) and Billing Choice (9.1.0+)
        val developerProvidedBillingListener =
            OpenIapDeveloperProvidedBillingListener { details ->
                safeEmitEvent(
                    module,
                    scope,
                    connectionReady,
                    pendingEvents,
                    eventDeveloperProvidedBilling,
                    details.toJson(),
                    eventPurchaseError,
                    "developer-billing-error",
                    "Failed to process developer provided billing",
                    "DEVELOPER_PROVIDED_BILLING",
                )
            }
        openIap.addDeveloperProvidedBillingListener(developerProvidedBillingListener)

        // Subscription billing-issue listener (Play Billing 8.1+ isSuspended; no-op on Horizon)
        val subscriptionBillingIssueListener =
            OpenIapSubscriptionBillingIssueListener { purchase ->
                safeEmitEvent(
                    module,
                    scope,
                    connectionReady,
                    pendingEvents,
                    eventSubscriptionBillingIssue,
                    purchase.toJson(),
                    eventPurchaseError,
                    "subscription-billing-issue-error",
                    "Failed to process subscription billing issue",
                    "SUBSCRIPTION_BILLING_ISSUE",
                )
            }
        openIap.addSubscriptionBillingIssueListener(subscriptionBillingIssueListener)

        return ListenerHandles(
            purchaseUpdate = purchaseUpdateListener,
            purchaseError = purchaseErrorListener,
            userChoiceBilling = userChoiceBillingListener,
            developerProvidedBilling = developerProvidedBillingListener,
            subscriptionBillingIssue = subscriptionBillingIssueListener,
        )
    }

    fun cleanupListeners(
        openIap: OpenIapModule,
        handles: ListenerHandles?,
    ) {
        if (handles == null) return
        openIap.removePurchaseUpdateListener(handles.purchaseUpdate)
        openIap.removePurchaseErrorListener(handles.purchaseError)
        openIap.removeUserChoiceBillingListener(handles.userChoiceBilling)
        openIap.removeDeveloperProvidedBillingListener(handles.developerProvidedBilling)
        openIap.removeSubscriptionBillingIssueListener(handles.subscriptionBillingIssue)
    }
}
