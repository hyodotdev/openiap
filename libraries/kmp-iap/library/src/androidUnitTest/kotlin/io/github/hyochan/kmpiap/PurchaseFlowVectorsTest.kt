package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.PendingPurchaseUpdateAndroid
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import kotlin.math.min
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull

/** Runs the shared cases from specs/client/src/purchase-flow.vectors.json, as the TypeScript runner does. */
@OptIn(ExperimentalCoroutinesApi::class)
class PurchaseFlowVectorsTest {
    private val vectors = Json.parseToJsonElement(
        checkNotNull(javaClass.classLoader?.getResource("purchase-flow.vectors.json")).readText()
    ).jsonObject

    @Test
    fun process() = runCases("process") { vector ->
        val item = purchaseOf(vector.obj("purchase"))
        val isConsumable = vector.bool("isConsumable")
        var confirms = 0
        val finishes = mutableListOf<Pair<Purchase, Boolean>>()
        val flow = PurchaseFlow(
            scope = backgroundScope,
            confirmWithBackend = { _, _ ->
                confirms++
                if (vector.bool("confirmThrows")) throw IllegalStateException("backend down")
                // Raw JSON on purpose: the flow must reject malformed answers itself.
                PurchaseConfirmation.fromJson(vector["confirmation"].toString())
            },
            isConsumable = { isConsumable },
            finishTransaction = { purchase, consumable ->
                finishes += purchase to consumable
                if (vector.bool("finishThrows")) throw IllegalStateException("store down")
            },
            getAvailablePurchases = { emptyList() },
            getPendingTransactionsIOS = null,
            listenForPurchases = null,
            endsRequest = null,
            onDispose = {},
            wasRequested = { false },
            confirmTimeout = 30.seconds,
        )

        val status = flow.processPurchase(item)

        assertEquals(if (vector["confirms"]?.jsonPrimitive?.booleanOrNull == false) 0 else 1, confirms, "confirms")
        assertEquals(if (vector.bool("finishes")) listOf(item to isConsumable) else emptyList(), finishes, "finishes")
        assertEquals(vector.plain("status"), comparable(status), "status")
        assertEquals(vector.plain("guidance"), comparable(describePurchaseFlowStatus(status)), "guidance")
    }

    @Test
    fun iapkit() = runCases("iapkit") { vector ->
        val item = purchaseOf(vector.obj("purchase"))
        val isConsumable = vector.bool("isConsumable")
        val amazon = vector["amazon"]?.jsonObject
        val productIds = amazon?.obj("verifiedProductIds")?.mapValues { it.value.jsonPrimitive.content }.orEmpty()
        val stores = vector["verifyAs"]?.jsonObject?.mapValues { IapStore.fromJson(it.value.jsonPrimitive.content) }.orEmpty()
        var grants = 0
        val options = IapkitConfirmationOptions(
            apiKey = if ("apiKey" in vector) vector.string("apiKey") else "pk",
            baseUrl = vector.string("baseUrl"),
            amazon = amazon?.let {
                IapkitConfirmationOptions.Amazon(sandbox = it.bool("sandbox"), verifiedProductId = { id -> productIds[id] ?: id })
            },
            verifyAs = { stores[it.storeId] },
            grant = if (vector.bool("noGrant")) null else { _, _ -> grants++ },
        )
        val requests = mutableListOf<VerifyPurchaseWithProviderProps>()
        val confirm = createIapkitConfirmation({ props ->
            requests += props
            // The SDK's result type refuses some evidence, such as another official store id; that throws here.
            VerifyPurchaseWithProviderResult.fromJson(vector.plainObject("result") + ("provider" to "iapkit"))
        }, options)

        val answer = runCatching { confirm(item, isConsumable) }

        if (vector.bool("error")) {
            assertTrue(answer.isFailure, "expected an error, got ${answer.getOrNull()}")
        } else {
            assertEquals(vector.plain("confirmation"), comparable(answer.getOrThrow()), "confirmation")
        }
        val props = vector["props"]
        if (props is JsonNull || vector["verifies"]?.jsonPrimitive?.booleanOrNull == false) {
            assertEquals(emptyList(), requests, "verify calls")
        } else {
            assertEquals(listOf(vector.plain("props")), requests.map { withoutNulls(it.toJson()) }, "verify calls")
        }
        assertEquals(if (vector.bool("granted")) 1 else 0, grants, "grants")
    }

    @Test
    fun device() = runCases("device") { vector ->
        val item = purchaseOf(vector.obj("purchase"))
        val pending = vector["pending"]!!.jsonArray.map { purchaseOf(it.jsonObject) as PurchaseIOS }
        val clock = vector["clock"]?.jsonObject
        var now = clock?.long("beforeRead") ?: System.currentTimeMillis()
        var reads = 0
        var grants = 0
        val confirm = createDeviceConfirmationIOS(
            { reads++; clock?.let { now = it.long("afterRead") }; pending },
            grant = if (vector.bool("noGrant")) null else { _, _ -> grants++ },
            clock = { now },
        )

        val answer = runCatching { confirm(item, vector.bool("isConsumable")) }

        if (vector.bool("error")) {
            assertTrue(answer.isFailure, "expected an error, got ${answer.getOrNull()}")
        } else {
            assertEquals(vector.plain("confirmation"), comparable(answer.getOrThrow()), "confirmation")
        }
        assertEquals(if (vector["reads"]?.jsonPrimitive?.booleanOrNull == false) 0 else 1, reads, "reads")
        assertEquals(if (vector.bool("granted")) 1 else 0, grants, "grants")
    }

    @Test
    fun sequences() = runCases("sequences") { vector ->
        val purchases = vector.obj("purchases").mapValues { purchaseOf(it.value.jsonObject) }
        val answers = vector.obj("answers").mapValues { it.value.jsonArray }
        val consumables = vector["consumables"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty().toSet()
        val requested = vector["requested"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty().toMutableSet()
        val requestedOnce = vector.bool("requestedOnce")
        val available = vector["available"]?.jsonArray?.map { purchases.getValue(it.jsonPrimitive.content) }.orEmpty()
        val pendingIOS = vector["pendingIOS"]
        val confirms = mutableMapOf<String, Int>()
        val finishes = mutableMapOf<String, Int>()
        val published = mutableListOf<PurchaseFlowOutcome>()
        val store = MutableSharedFlow<Purchase>(extraBufferCapacity = 16)
        val flow = PurchaseFlow(
            scope = backgroundScope,
            confirmWithBackend = { purchase, _ ->
                val count = confirms.merge(purchase.id, 1, Int::plus)!!
                val list = answers[purchase.id] ?: answers.getValue("*")
                val answer = list[min(count, list.size) - 1]
                if (answer == JsonPrimitive("throw")) throw IllegalStateException("backend down")
                PurchaseConfirmation.fromJson(answer.toString())
            },
            isConsumable = { it in consumables },
            finishTransaction = { purchase, _ -> finishes.merge(purchase.id, 1, Int::plus) },
            getAvailablePurchases = { available },
            getPendingTransactionsIOS = when (pendingIOS) {
                null -> null
                JsonPrimitive("throw") -> ({ throw IllegalStateException("unverified") })
                else -> ({ pendingIOS.jsonArray.map { purchases.getValue(it.jsonPrimitive.content) } })
            },
            listenForPurchases = store,
            endsRequest = null,
            onDispose = {},
            // Like an SDK's request mark, requestedOnce answers true once per id.
            wasRequested = { if (requestedOnce) requested.remove(it.id) else it.id in requested },
            confirmTimeout = 30.seconds,
        )
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { flow.outcomes.collect { published += it } }
        runCurrent()

        for (step in vector["steps"]!!.jsonArray.map { it.jsonObject }) {
            if (step.bool("dispose")) flow.dispose()
            // Buffered, so a step's deliveries all arrive before any confirmation settles.
            step["listener"]?.jsonArray?.forEach { store.tryEmit(purchases.getValue(it.jsonPrimitive.content)) }
            val processed = step["process"]?.jsonArray.orEmpty().map {
                async { flow.processPurchase(purchases.getValue(it.jsonPrimitive.content)) }
            }
            val recovered = step["recover"]?.jsonObject?.let { async { flow.recoverPurchases(it.bool("includeFinished")) } }
            processed.awaitAll()
            if (recovered != null) assertEquals(step.plain("outcomes"), byId(recovered.await()), "recovered outcomes")
            // Listener deliveries settle without a result to wait on; runCurrent also runs the flow's background scope.
            runCurrent()
        }

        assertEquals(vector.plain("confirms"), confirms.mapValues { it.value.toLong() }, "confirms")
        assertEquals(vector.plain("finishes"), finishes.mapValues { it.value.toLong() }, "finishes")
        if ("published" in vector) assertEquals(vector.plain("published"), byId(published), "published")
    }

    // Runs every case, then reports each failure by name.
    private fun runCases(kind: String, case: suspend TestScope.(JsonObject) -> Unit) {
        val cases = vectors[kind]!!.jsonArray.map { it.jsonObject }
        assertTrue(cases.isNotEmpty())
        val failures = cases.mapNotNull { vector ->
            val name = vector["name"]!!.jsonPrimitive.content
            runCatching { runTest { case(vector) } }.exceptionOrNull()?.let { "$kind: $name: ${it.message}" }
        }
        if (failures.isNotEmpty()) fail(failures.joinToString("\n"))
        println("purchase-flow vectors: ${cases.size} $kind cases passed")
    }

    private fun purchaseOf(json: JsonObject): Purchase {
        val store = IapStore.fromJson(json.string("store")!!)
        val id = json.string("id")!!
        val productId = json.string("productId")!!
        val state = PurchaseState.fromJson(json.string("purchaseState")!!)
        val quantity = json["quantity"]?.jsonPrimitive?.longOrNull?.toInt() ?: 1
        val ids = json["ids"]?.jsonArray?.map { it.jsonPrimitive.content }
        val storeId = json.string("storeId").orEmpty()
        return if (store == IapStore.Apple) {
            PurchaseIOS(
                id = id, transactionId = id, productId = productId, purchaseState = state, purchaseToken = json.string("purchaseToken"),
                quantity = quantity, ids = ids, store = store, storeId = storeId,
                environmentIOS = json.string("environmentIOS"), isAutoRenewing = false, transactionDate = 0.0,
                revocationDateIOS = json["revocationDateIOS"]?.jsonPrimitive?.doubleOrNull,
                isUpgradedIOS = json["isUpgradedIOS"]?.jsonPrimitive?.booleanOrNull,
                expirationDateIOS = json["expirationDateIOS"]?.jsonPrimitive?.doubleOrNull,
            )
        } else {
            PurchaseAndroid(
                id = id, productId = productId, purchaseState = state, purchaseToken = json.string("purchaseToken"),
                quantity = quantity, ids = ids, store = store, storeId = storeId,
                isAcknowledgedAndroid = json["isAcknowledgedAndroid"]?.jsonPrimitive?.booleanOrNull,
                pendingPurchaseUpdateAndroid = json["pendingPurchaseUpdateAndroid"]?.jsonObject?.let { pending ->
                    PendingPurchaseUpdateAndroid(
                        products = pending["products"]!!.jsonArray.map { it.jsonPrimitive.content },
                        purchaseToken = "",
                    )
                },
                userIdAmazon = json.string("userIdAmazon"),
                isAutoRenewing = false, transactionDate = 0.0,
            )
        }
    }

    // The TypeScript shape of a status: error and finishError compare as true, whatever the message.
    private fun comparable(status: PurchaseFlowStatus): Map<String, Any?> = buildMap {
        fun finishError(error: Throwable?) { if (error != null) put("finishError", true) }
        when (status) {
            PurchaseFlowStatus.StorePending -> put("status", "store_pending")
            is PurchaseFlowStatus.VerificationDelayed -> {
                put("status", "verification_delayed")
                put("retryAfterMs", status.retryAfterMs)
            }
            is PurchaseFlowStatus.OwnershipConflict -> {
                put("status", "ownership_conflict")
                put("alreadyGranted", status.alreadyGranted)
                finishError(status.finishError)
            }
            is PurchaseFlowStatus.TestAccountRestricted -> {
                put("status", "test_account_restricted")
                finishError(status.finishError)
            }
            is PurchaseFlowStatus.Invalid -> {
                put("status", "invalid")
                status.reason?.let { put("reason", it) }
                finishError(status.finishError)
                if (status.recovered) put("recovered", true)
            }
            is PurchaseFlowStatus.Verified -> {
                put("status", "verified")
                status.retryAfterMs?.let { put("retryAfterMs", it) }
            }
            is PurchaseFlowStatus.Linked -> {
                put("status", "linked")
                status.retryAfterMs?.let { put("retryAfterMs", it) }
            }
            is PurchaseFlowStatus.Entitled -> {
                put("status", "entitled")
                put("alreadyGranted", status.alreadyGranted)
                finishError(status.finishError)
                if (status.changePending) put("changePending", true)
            }
            is PurchaseFlowStatus.Failed -> {
                put("status", "failed")
                put("error", true)
            }
        }
    }

    private fun comparable(confirmation: PurchaseConfirmation): Map<String, Any?> = when (confirmation) {
        PurchaseConfirmation.StorePending -> comparable(PurchaseFlowStatus.StorePending)
        is PurchaseConfirmation.VerificationDelayed ->
            comparable(PurchaseFlowStatus.VerificationDelayed(confirmation.retryAfterMs))
        is PurchaseConfirmation.OwnershipConflict ->
            comparable(PurchaseFlowStatus.OwnershipConflict(confirmation.alreadyGranted))
        PurchaseConfirmation.TestAccountRestricted -> comparable(PurchaseFlowStatus.TestAccountRestricted())
        is PurchaseConfirmation.Invalid -> comparable(PurchaseFlowStatus.Invalid(confirmation.reason))
        is PurchaseConfirmation.Verified -> comparable(PurchaseFlowStatus.Verified(confirmation.retryAfterMs))
        is PurchaseConfirmation.Linked -> comparable(PurchaseFlowStatus.Linked(confirmation.retryAfterMs))
        is PurchaseConfirmation.Entitled -> comparable(PurchaseFlowStatus.Entitled(confirmation.alreadyGranted))
    }

    private fun comparable(guidance: PurchaseFlowGuidance): Map<String, Any?> = buildMap {
        put("key", guidance.key.rawValue)
        put("offerPurchase", guidance.offerPurchase)
        guidance.retryAfterMs?.let { put("retryAfterMs", it) }
    }

    private fun byId(outcomes: List<PurchaseFlowOutcome>): List<Map<String, Any?>> =
        outcomes.map { mapOf("id" to it.purchase.id, "status" to comparable(it.status)) }

    private fun JsonObject.obj(key: String): JsonObject = getValue(key).jsonObject
    private fun JsonObject.string(key: String): String? = (get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content
    private fun JsonObject.bool(key: String): Boolean = (get(key) as? JsonPrimitive)?.booleanOrNull ?: false
    private fun JsonObject.long(key: String): Long = getValue(key).jsonPrimitive.long
    private fun JsonObject.plain(key: String): Any? = plain(getValue(key))
    @Suppress("UNCHECKED_CAST")
    private fun JsonObject.plainObject(key: String): Map<String, Any?> = get(key)?.let { plain(it) as Map<String, Any?> }.orEmpty()

    // JSON as the Kotlin values the generated types and the comparisons use; whole numbers are Long.
    private fun plain(json: JsonElement): Any? = when (json) {
        JsonNull -> null
        is JsonPrimitive -> when {
            json.isString -> json.content
            json.booleanOrNull != null -> json.booleanOrNull
            else -> json.longOrNull ?: json.content.toDouble()
        }
        is JsonArray -> json.map { plain(it) }
        is JsonObject -> json.mapValues { plain(it.value) }
    }

    private fun withoutNulls(value: Any?): Any? = when (value) {
        is Map<*, *> -> value.filterValues { it != null }.mapValues { withoutNulls(it.value) }
        is List<*> -> value.map { withoutNulls(it) }
        else -> value
    }
}
