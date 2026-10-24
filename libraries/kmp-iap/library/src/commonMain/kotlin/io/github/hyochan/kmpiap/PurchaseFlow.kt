// Port of specs/client/src/purchase-flow.ts, the purchase flow every OpenIAP SDK
// shares; androidUnitTest runs its purchase-flow.vectors.json.
// Guide: https://kit.openiap.dev/docs/purchase-flow
package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.PurchaseUpdatedListenerOptions
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onSubscription
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

/**
 * The app backend's verdict on one purchase. Only [Entitled] grants access;
 * [Verified] and [Linked] mean the purchase is valid but access is not granted
 * yet. [OwnershipConflict] sets `alreadyGranted` when another account already
 * got access, which lets the app finish it. [Invalid] and
 * [TestAccountRestricted] are settled rejections: return
 * [VerificationDelayed] for any answer that may still change.
 */
sealed interface PurchaseConfirmation {
    data object StorePending : PurchaseConfirmation
    data class VerificationDelayed(val retryAfterMs: Long) : PurchaseConfirmation
    data class OwnershipConflict(val alreadyGranted: Boolean) : PurchaseConfirmation
    data object TestAccountRestricted : PurchaseConfirmation
    data class Invalid(val reason: String? = null) : PurchaseConfirmation
    data class Verified(val retryAfterMs: Long? = null) : PurchaseConfirmation
    data class Linked(val retryAfterMs: Long? = null) : PurchaseConfirmation
    data class Entitled(val alreadyGranted: Boolean) : PurchaseConfirmation

    companion object {
        /**
         * Reads the backend's JSON response body. Throws for anything off the
         * contract, which the flow reports as [PurchaseFlowStatus.Failed], so a
         * malformed body never finishes a transaction. Drops unknown fields and
         * an invalid retry hint.
         */
        fun fromJson(json: String): PurchaseConfirmation {
            val body = Json.parseToJsonElement(json) as? JsonObject
            fun primitive(key: String, isString: Boolean): JsonPrimitive? =
                (body?.get(key) as? JsonPrimitive)?.takeIf { it.isString == isString }
            val retryAfterMs = primitive("retryAfterMs", isString = false)?.doubleOrNull
                ?.takeIf { it.isFinite() && it >= 0 }?.toLong()
            val alreadyGranted = primitive("alreadyGranted", isString = false)?.booleanOrNull
            return when (primitive("status", isString = true)?.content) {
                "store_pending" -> StorePending
                "test_account_restricted" -> TestAccountRestricted
                "invalid" -> Invalid(primitive("reason", isString = true)?.content)
                "verification_delayed" -> retryAfterMs?.let(::VerificationDelayed)
                "verified" -> Verified(retryAfterMs)
                "linked" -> Linked(retryAfterMs)
                "ownership_conflict" -> alreadyGranted?.let(::OwnershipConflict)
                "entitled" -> alreadyGranted?.let(::Entitled)
                else -> null
            } ?: throw IllegalArgumentException("Unrecognized purchase confirmation from the backend")
        }
    }
}

/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an [Entitled] status still grants access.
 * `changePending` marks an [Entitled] purchase whose requested upgrade,
 * downgrade, or prepaid top-up has not applied yet (Google Play waits for its
 * payment, Amazon applies it at the next renewal): access stays on the current
 * plan. `recovered` marks an [Invalid] purchase recovery found, not one the
 * user just bought.
 */
sealed interface PurchaseFlowStatus {
    data object StorePending : PurchaseFlowStatus
    data class VerificationDelayed(val retryAfterMs: Long) : PurchaseFlowStatus
    data class OwnershipConflict(
        val alreadyGranted: Boolean,
        val finishError: Throwable? = null,
    ) : PurchaseFlowStatus
    data class TestAccountRestricted(val finishError: Throwable? = null) : PurchaseFlowStatus
    data class Invalid(
        val reason: String? = null,
        val finishError: Throwable? = null,
        val recovered: Boolean = false,
    ) : PurchaseFlowStatus
    data class Verified(val retryAfterMs: Long? = null) : PurchaseFlowStatus
    data class Linked(val retryAfterMs: Long? = null) : PurchaseFlowStatus
    data class Entitled(
        val alreadyGranted: Boolean,
        val finishError: Throwable? = null,
        val changePending: Boolean = false,
    ) : PurchaseFlowStatus
    data class Failed(val error: Throwable) : PurchaseFlowStatus
}

/** A delivered purchase and where the flow left it. */
data class PurchaseFlowOutcome(val purchase: Purchase, val status: PurchaseFlowStatus)

/**
 * Confirms each purchase with the app's backend, or IAPKit, and finishes it
 * once access is settled. Single-product, single-unit purchases only. Create
 * it with [KmpIAP.createPurchaseFlow].
 */
@OptIn(ExperimentalCoroutinesApi::class) // resetReplayCache
class PurchaseFlow internal constructor(
    scope: CoroutineScope,
    private val confirmWithBackend: suspend (purchase: Purchase, isConsumable: Boolean) -> PurchaseConfirmation,
    private val isConsumable: (productId: String) -> Boolean,
    private val finishTransaction: suspend (purchase: Purchase, isConsumable: Boolean) -> Unit,
    private val getAvailablePurchases: suspend () -> List<Purchase>,
    private val getPendingTransactionsIOS: (suspend () -> List<Purchase>)?,
    listenForPurchases: Flow<Purchase>?,
    // Store events that end the user's purchase request, collected until dispose.
    endsRequest: Flow<*>?,
    private val onDispose: () -> Unit,
    private val wasRequested: (Purchase) -> Boolean,
    private val confirmTimeout: Duration,
) {
    private inner class Run(purchase: Purchase, var requested: Boolean) {
        var latest = purchase
        val task: Deferred<PurchaseFlowStatus> = children.async(start = CoroutineStart.LAZY) {
            val status = confirmAndFinish(purchase)
            mutex.withLock {
                runs.remove(purchase.id)
                if (status.isSettled()) settled[purchase.id] = status
                publish(PurchaseFlowOutcome(latest, forDelivery(latest, status, requested)))
            }
            status
        }
    }

    init {
        check(scope.isActive) { "createPurchaseFlow needs an active scope; this one has ended" }
    }

    // A failure in one confirmation, even an Error, stays out of the listener and the app's scope.
    private val supervisor = SupervisorJob(scope.coroutineContext[Job])
    private val children = CoroutineScope(scope.coroutineContext + supervisor)
    private val listening = CoroutineScope(children.coroutineContext + Job(supervisor))
    private val mutex = Mutex()
    // A listener and a recovery pass can deliver the same transaction at once.
    private val runs = mutableMapOf<String, Run>()
    // Finished purchases, and rejections the store settles on its own. A
    // recovery pass can hold a store list read before the listener settled one.
    private val settled = mutableMapOf<String, PurchaseFlowStatus>()
    private val recoveries = mutableMapOf<Boolean, Deferred<List<PurchaseFlowOutcome>>>()
    // Null marks the end after dispose. The cache keeps an outcome only until a collector takes it.
    private val outcomeFlow = MutableSharedFlow<PurchaseFlowOutcome?>(
        replay = 1,
        extraBufferCapacity = 63,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    // Atomic, so only one dispose runs the cleanup even when two race.
    private val disposal = MutableStateFlow(false)
    private val disposed get() = disposal.value

    /**
     * Every outcome: once per confirmation, however many deliveries shared it,
     * and once per delivery of an already settled purchase. An outcome
     * published while nobody collects waits for the next collector; one a
     * collector already got is not replayed. Collection ends at [dispose].
     */
    val outcomes: Flow<PurchaseFlowOutcome> = outcomeFlow
        .onSubscription {
            outcomeFlow.resetReplayCache()
            // A collector that starts after dispose still finds the end marker.
            if (disposed) outcomeFlow.tryEmit(null)
        }
        .takeWhile { it != null }
        .filterNotNull()

    // Last, so an immediate dispatcher finds every field initialized.
    init {
        listenForPurchases?.let { purchases ->
            listen {
                purchases.collect { purchase ->
                    // A pending delivery leaves the mark for the completed one that follows.
                    val requested = purchase.purchaseState != PurchaseState.Pending && wasRequested(purchase)
                    // Registered before the next delivery; the run publishes its own outcome.
                    mutex.withLock { admit(purchase, requested, reconfirm = false) }
                }
            }
        }
        endsRequest?.let { events -> listen { events.collect() } }
    }

    /**
     * Confirms one purchase the user just bought. Finishes it once access is
     * granted to this or another account, and a settled rejection on iOS only:
     * Google Play refunds a rejected purchase left unacknowledged, while iOS
     * would redeliver it forever. The flow already processes what it listens
     * for; call this for purchases the app receives elsewhere.
     */
    suspend fun processPurchase(purchase: Purchase): PurchaseFlowStatus = deliver(purchase, requested = true)

    /**
     * Runs unfinished purchases, or every owned one with [includeFinished] for
     * a restore button, through the flow one at a time; a call made while a
     * pass runs shares it. Throws if it meets an Apple purchase without
     * `getPendingTransactionsIOS`.
     */
    suspend fun recoverPurchases(includeFinished: Boolean = false): List<PurchaseFlowOutcome> =
        mutex.withLock {
            recoveries[includeFinished]?.takeIf { it.isActive }
                ?: children.async { recover(includeFinished) }.also { recoveries[includeFinished] = it }
        }.await()

    /**
     * Stops listening and publishing, ends collection of [outcomes], and stops
     * a recovery pass from confirming anything more; confirmations already
     * running still finish. Call it when the signed-in account changes, then
     * create the next account's flow.
     */
    fun dispose() {
        // A second dispose must not clear the next account's requests.
        if (!disposal.compareAndSet(expect = false, update = true)) return
        listening.cancel()
        onDispose()
        outcomeFlow.tryEmit(null)
    }

    // Undispatched, so the stream is subscribed before the constructor returns.
    private fun listen(block: suspend CoroutineScope.() -> Unit) {
        listening.launch(start = CoroutineStart.UNDISPATCHED, block = block)
    }

    private fun publish(outcome: PurchaseFlowOutcome) {
        if (disposed) return
        outcomeFlow.tryEmit(outcome)
        if (outcomeFlow.subscriptionCount.value > 0) outcomeFlow.resetReplayCache()
        // A dispose racing this publish still leaves its end marker last.
        if (disposed) outcomeFlow.tryEmit(null)
    }

    // Marked per delivery: a shared run may have started from an older copy of
    // the purchase, before Play attached the pending change.
    private fun forDelivery(purchase: Purchase, status: PurchaseFlowStatus, requested: Boolean): PurchaseFlowStatus =
        when {
            status is PurchaseFlowStatus.Entitled && purchase.pendingPurchaseUpdate() != null ->
                status.copy(changePending = true)
            // An old expired renewal must not ask a subscriber to buy again.
            status is PurchaseFlowStatus.Invalid && !requested -> status.copy(recovered = true)
            else -> status
        }

    private suspend fun deliver(purchase: Purchase, requested: Boolean): PurchaseFlowStatus {
        val answer = mutex.withLock { admit(purchase, requested, reconfirm = false) }
        return forDelivery(purchase, answer.await(), requested)
    }

    // Under the lock: answers at once what needs no confirmation, else joins or starts the run.
    private fun admit(purchase: Purchase, requested: Boolean, reconfirm: Boolean): Deferred<PurchaseFlowStatus> {
        immediateStatus(purchase, reconfirm)?.let { immediate ->
            val status = forDelivery(purchase, immediate, requested)
            publish(PurchaseFlowOutcome(purchase, status))
            return CompletableDeferred(status)
        }
        val run = activeRun(purchase.id)?.apply {
            latest = purchase
            this.requested = this.requested || requested
        } ?: Run(purchase, requested).also {
            runs[purchase.id] = it
            it.task.start()
        }
        return run.task
    }

    // A run cancelled with its scope never cleared its entry.
    private fun activeRun(id: String): Run? = runs[id]?.takeIf { it.task.isActive }

    private fun immediateStatus(purchase: Purchase, reconfirm: Boolean): PurchaseFlowStatus? {
        runCatching { requireSupportedPurchase(purchase) }
            .onFailure { return PurchaseFlowStatus.Failed(it) }
        // Payment is not complete; the store delivers the purchase again once it is.
        if (purchase.purchaseState == PurchaseState.Pending) return PurchaseFlowStatus.StorePending
        return if (reconfirm || activeRun(purchase.id) != null) null else settled[purchase.id]
    }

    private suspend fun confirmAndFinish(purchase: Purchase): PurchaseFlowStatus {
        val consumable: Boolean
        val confirmation = try {
            // Read once: finishing must consume exactly what confirmation granted.
            consumable = isConsumable(purchase.productId)
            withTimeoutOrNull(confirmTimeout) { confirmWithBackend(purchase, consumable) }
                ?: return PurchaseFlowStatus.Failed(
                    IllegalStateException("confirmWithBackend did not answer within $confirmTimeout")
                )
        } catch (error: Throwable) {
            // Only this run's own cancellation propagates; an Error must not leave the run stuck.
            currentCoroutineContext().ensureActive()
            return PurchaseFlowStatus.Failed(error)
        }
        // Finishing settles a purchase for good, so only a settled verdict does.
        return when (confirmation) {
            is PurchaseConfirmation.Entitled -> finish(purchase, consumable, confirmation)
            is PurchaseConfirmation.OwnershipConflict ->
                if (confirmation.alreadyGranted) finish(purchase, consumable, confirmation) else confirmation.toStatus()
            is PurchaseConfirmation.Invalid, PurchaseConfirmation.TestAccountRestricted ->
                if (purchase.store == IapStore.Apple) finish(purchase, consumable, confirmation) else confirmation.toStatus()
            else -> confirmation.toStatus()
        }
    }

    private suspend fun finish(
        purchase: Purchase,
        consumable: Boolean,
        confirmation: PurchaseConfirmation,
    ): PurchaseFlowStatus =
        try {
            // Play keeps an acknowledged purchase finished; a restore need not redo it.
            if ((purchase as? PurchaseAndroid)?.isAcknowledgedAndroid != true || consumable) {
                finishTransaction(purchase, consumable)
            }
            confirmation.toStatus()
        } catch (finishError: Throwable) {
            currentCoroutineContext().ensureActive()
            confirmation.toStatus(finishError)
        }

    private suspend fun recover(includeFinished: Boolean): List<PurchaseFlowOutcome> {
        // iOS lists unfinished transactions directly; other stores list owned
        // purchases, and isUnfinished picks the ones still to settle.
        var pendingIOS: List<Purchase>? = null
        var pendingIOSFailed = false
        try {
            pendingIOS = getPendingTransactionsIOS?.invoke()
        } catch (error: Exception) {
            currentCoroutineContext().ensureActive()
            // One unverified transaction fails the whole list. Re-confirming a
            // finished purchase is safe, so every owned Apple purchase stands in.
            pendingIOSFailed = true
        }
        val available = if (includeFinished || pendingIOS == null) getAvailablePurchases() else emptyList()
        check(getPendingTransactionsIOS != null || available.none { it.store == IapStore.Apple }) {
            "recoverPurchases needs getPendingTransactionsIOS on iOS to find unfinished transactions"
        }
        val unfinished = available.filter {
            includeFinished || if (it.store == IapStore.Apple) pendingIOSFailed else isUnfinished(it)
        }
        val outcomes = mutableListOf<PurchaseFlowOutcome>()
        for (purchase in (pendingIOS.orEmpty() + unfinished).distinctBy { it.id }) {
            // The next account's flow confirms the rest with its own session.
            if (disposed) break
            // One lock, so a purchase the listener settles meanwhile is not published twice.
            val answer = mutex.withLock {
                if (!includeFinished && purchase.id in settled) null
                else admit(purchase, requested = false, reconfirm = includeFinished)
            } ?: continue
            outcomes += PurchaseFlowOutcome(purchase, forDelivery(purchase, answer.await(), requested = false))
        }
        return outcomes
    }

    // Amazon and most community stores report no acknowledgment, and Amazon
    // approves a Kids purchase later; a listed consumable is unconsumed.
    private fun isUnfinished(purchase: Purchase): Boolean =
        (purchase as? PurchaseAndroid)?.isAcknowledgedAndroid != true || isConsumable(purchase.productId)
}

/**
 * Creates the app's purchase flow over this instance. It confirms every
 * purchase the store delivers until [PurchaseFlow.dispose], and finishes,
 * lists, and recovers purchases through this instance; pass a function to
 * replace any of those defaults.
 *
 * Create one per signed-in account, in a [scope] that outlives the screens,
 * and capture that account's session in [confirmWithBackend]. An app without a
 * backend passes [confirmWithIapkit]. Pass the app's one instance: on Meta
 * Horizon a second billing client kills the process.
 *
 * @param confirmWithBackend confirms the purchase and grants access before it
 *   answers [PurchaseConfirmation.Entitled]: the flow finishes, and so
 *   consumes, the purchase right after.
 * @param isConsumable from the app's product config. On Android a wrong answer
 *   consumes a non-consumable or blocks rebuying a consumable.
 * @param confirmTimeout how long [confirmWithBackend] may take before the
 *   purchase ends as [PurchaseFlowStatus.Failed].
 * @param wasRequested whether the user's own request produced a delivery. Only
 *   then may an [PurchaseFlowStatus.Invalid] delivery offer buying again. The
 *   default matches the products passed to [KmpIAP.requestPurchase].
 * @see <a href="https://kit.openiap.dev/docs/purchase-flow">Purchase flow</a>
 */
fun KmpIAP.createPurchaseFlow(
    scope: CoroutineScope,
    confirmWithBackend: suspend (purchase: Purchase, isConsumable: Boolean) -> PurchaseConfirmation,
    isConsumable: (productId: String) -> Boolean,
    confirmTimeout: Duration = 30.seconds,
    finishTransaction: suspend (purchase: Purchase, isConsumable: Boolean) -> Unit =
        { purchase, consumable -> this.finishTransaction(purchase, consumable) },
    getAvailablePurchases: suspend () -> List<Purchase> = { this.getAvailablePurchases() },
    // Off iOS a store may answer [], which would hide unacknowledged Android purchases.
    getPendingTransactionsIOS: (suspend () -> List<Purchase>)? =
        if (getCurrentPlatform() == IapPlatform.Ios) ({ this.getPendingTransactionsIOS() }) else null,
    // The flow deduplicates itself, and a StoreKit replay is how a failed confirmation retries.
    listenForPurchases: Flow<Purchase>? = purchaseUpdatedListener(PurchaseUpdatedListenerOptions(dedupeTransactionIOS = false)),
    wasRequested: (Purchase) -> Boolean = purchaseRequests::wasRequested,
): PurchaseFlow = PurchaseFlow(
    scope = scope,
    confirmWithBackend = confirmWithBackend,
    isConsumable = isConsumable,
    finishTransaction = finishTransaction,
    getAvailablePurchases = getAvailablePurchases,
    getPendingTransactionsIOS = getPendingTransactionsIOS,
    listenForPurchases = listenForPurchases,
    // An error ends the user's request; dispose ends them all.
    endsRequest = purchaseErrorListener.onEach { purchaseRequests.clear() },
    onDispose = purchaseRequests::clear,
    wasRequested = wasRequested,
    confirmTimeout = confirmTimeout,
)

/** The products passed to [KmpIAP.requestPurchase] whose purchase has not arrived yet. */
internal class PurchaseRequests {
    // When the app asked for each product. An atomic map: requests, deliveries, and errors arrive on different threads.
    private val requestedAt = MutableStateFlow(emptyMap<String, Long>())

    fun mark(params: RequestPurchaseProps) {
        val requested = when (val request = params.request) {
            is RequestPurchaseProps.Request.Purchase ->
                listOfNotNull(request.value.apple?.sku) + request.value.google?.skus.orEmpty()
            // A plan change requests its target products.
            is RequestPurchaseProps.Request.Subscription ->
                listOfNotNull(request.value.apple?.sku) + request.value.google?.skus.orEmpty()
        }
        val now = Clock.System.now().toEpochMilliseconds()
        requestedAt.update { marks -> marks + requested.associateWith { now } }
    }

    /**
     * Whether the user requested [purchase]: bought after the request, or a
     * plan change to a requested product. A match clears its mark.
     */
    fun wasRequested(purchase: Purchase): Boolean {
        var matched = false
        requestedAt.update { marks ->
            // A receipt older than the request is the store redelivering an earlier purchase.
            val bought = marks[purchase.productId]
                ?.takeIf { purchase.transactionDate >= it - PURCHASE_REQUEST_CLOCK_SKEW_MS }
                ?.let { purchase.productId }
            val changed = purchase.pendingPurchaseUpdate()?.products.orEmpty().filter { it in marks }
            val hits = listOfNotNull(bought) + changed
            matched = hits.isNotEmpty()
            marks - hits
        }
        return matched
    }

    fun clear() {
        requestedAt.value = emptyMap()
    }
}

// As in specs/client/src/purchase-flow.ts: a device clock may run ahead of the store's.
private const val PURCHASE_REQUEST_CLOCK_SKEW_MS = 600_000L

/** What a status means for the user; see [describePurchaseFlowStatus]. */
enum class PurchaseFlowGuidanceKey(val rawValue: String) {
    PaymentPending("payment_pending"),
    ChangePending("change_pending"),
    VerificationDelayed("verification_delayed"),
    OwnedByAnotherAccount("owned_by_another_account"),
    TestPurchaseNotAccepted("test_purchase_not_accepted"),
    PurchaseNotValid("purchase_not_valid"),
    AccessPending("access_pending"),
    AccessGranted("access_granted"),
    TryAgainLater("try_again_later"),
}

/**
 * Neutral guidance an app maps to its own copy.
 *
 * @property offerPurchase true only for an invalid purchase the user just made.
 *   False whenever the user may already have paid: never ask them to buy again.
 * @property retryAfterMs earliest time to run the purchase through the flow again.
 */
data class PurchaseFlowGuidance(
    val key: PurchaseFlowGuidanceKey,
    val offerPurchase: Boolean,
    val retryAfterMs: Long? = null,
)

/** The guidance for [status]. */
fun describePurchaseFlowStatus(status: PurchaseFlowStatus): PurchaseFlowGuidance = when (status) {
    PurchaseFlowStatus.StorePending -> PurchaseFlowGuidance(PurchaseFlowGuidanceKey.PaymentPending, offerPurchase = false)
    is PurchaseFlowStatus.VerificationDelayed ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.VerificationDelayed, offerPurchase = false, retryAfterMs = status.retryAfterMs)
    is PurchaseFlowStatus.OwnershipConflict ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.OwnedByAnotherAccount, offerPurchase = false)
    is PurchaseFlowStatus.TestAccountRestricted ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.TestPurchaseNotAccepted, offerPurchase = false)
    is PurchaseFlowStatus.Invalid ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.PurchaseNotValid, offerPurchase = !status.recovered)
    is PurchaseFlowStatus.Verified ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.AccessPending, offerPurchase = false, retryAfterMs = status.retryAfterMs)
    is PurchaseFlowStatus.Linked ->
        PurchaseFlowGuidance(PurchaseFlowGuidanceKey.AccessPending, offerPurchase = false, retryAfterMs = status.retryAfterMs)
    is PurchaseFlowStatus.Entitled -> PurchaseFlowGuidance(
        if (status.changePending) PurchaseFlowGuidanceKey.ChangePending else PurchaseFlowGuidanceKey.AccessGranted,
        offerPurchase = false,
    )
    is PurchaseFlowStatus.Failed -> PurchaseFlowGuidance(PurchaseFlowGuidanceKey.TryAgainLater, offerPurchase = false)
}

/** Body the app sends its backend, which takes the user from its own session. */
data class PurchaseConfirmationRequest(
    /** [IapStore.Apple] or [IapStore.Google]. */
    val store: IapStore,
    /** Apple JWS or Google Play purchase token, forwarded to IAPKit as is. */
    val purchaseToken: String,
    /** The product the app expected; IAPKit rejects a store mismatch. */
    val productId: String,
)

/** Builds the backend request body; throws for a purchase without Apple or Google evidence. */
fun toPurchaseConfirmationRequest(purchase: Purchase): PurchaseConfirmationRequest {
    val token = purchase.purchaseToken
    require((purchase.store == IapStore.Apple || purchase.store == IapStore.Google) && !token.isNullOrEmpty()) {
        "Purchase ${purchase.productId} has no Apple or Google purchase token to confirm"
    }
    requireSupportedPurchase(purchase)
    return PurchaseConfirmationRequest(purchase.store, token, purchase.productId)
}

private fun PurchaseConfirmation.toStatus(finishError: Throwable? = null): PurchaseFlowStatus = when (this) {
    PurchaseConfirmation.StorePending -> PurchaseFlowStatus.StorePending
    is PurchaseConfirmation.VerificationDelayed -> PurchaseFlowStatus.VerificationDelayed(retryAfterMs)
    is PurchaseConfirmation.OwnershipConflict -> PurchaseFlowStatus.OwnershipConflict(alreadyGranted, finishError)
    PurchaseConfirmation.TestAccountRestricted -> PurchaseFlowStatus.TestAccountRestricted(finishError)
    is PurchaseConfirmation.Invalid -> PurchaseFlowStatus.Invalid(reason, finishError)
    is PurchaseConfirmation.Verified -> PurchaseFlowStatus.Verified(retryAfterMs)
    is PurchaseConfirmation.Linked -> PurchaseFlowStatus.Linked(retryAfterMs)
    is PurchaseConfirmation.Entitled -> PurchaseFlowStatus.Entitled(alreadyGranted, finishError)
}

// A settled purchase is finished, or rejected for good where the store
// settles it, so the same delivery need not be confirmed again.
private fun PurchaseFlowStatus.isSettled(): Boolean = when (this) {
    is PurchaseFlowStatus.Entitled -> finishError == null
    is PurchaseFlowStatus.Invalid -> finishError == null
    is PurchaseFlowStatus.TestAccountRestricted -> finishError == null
    is PurchaseFlowStatus.OwnershipConflict -> alreadyGranted && finishError == null
    else -> false
}

private fun Purchase.pendingPurchaseUpdate() = (this as? PurchaseAndroid)?.pendingPurchaseUpdateAndroid

private fun requireSupportedPurchase(purchase: Purchase) {
    require(purchase.quantity == 1) { "Purchase flow supports only single-unit purchases" }
    require(purchase.ids.orEmpty().toSet().size <= 1) {
        "Purchase flow cannot finish a multi-product purchase before every product is granted"
    }
}
