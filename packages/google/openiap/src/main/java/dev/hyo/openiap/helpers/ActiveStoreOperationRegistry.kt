package dev.hyo.openiap.helpers

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicReference

internal data class ActiveStoreConnection<Client : Any>(
    val client: Client?,
    val generation: Long,
)

/** Owns callbacks registered for the lifetime of one store connection. */
internal class ActiveStoreListenerOwner<Client : Any>(
    private val lock: Any,
    private val current: () -> ActiveStoreConnection<Client>,
    private val source: () -> Client?,
    private val generation: Long,
) {
    fun <T> claim(block: () -> T): T? = synchronized(lock) {
        if (!isActiveLocked()) null else block()
    }

    fun deliver(block: () -> Unit): Boolean {
        val active = claim { true } == true
        if (active) block()
        return active
    }

    private fun isActiveLocked(): Boolean {
        val sourceClient = source() ?: return false
        val connection = current()
        return connection.client === sourceClient && connection.generation == generation
    }
}

/** Resets state derived from the previous client at a connection transition. */
internal inline fun <Client : Any> transitionStoreConnection(
    current: Client?,
    next: Client?,
    resetDerivedState: () -> Unit,
): Client? {
    if (current !== next || next == null) resetDerivedState()
    return next
}

internal class ActiveStoreOperationCompletion<T> internal constructor(
    private val onIsActive: () -> Boolean,
    private val onSuccess: (T, () -> Unit) -> Unit,
    private val onFailure: (Throwable, () -> Unit) -> Unit,
) {
    fun isActive(): Boolean = onIsActive()

    fun succeed(value: T, beforeResume: () -> Unit = {}) = onSuccess(value, beforeResume)

    fun fail(error: Throwable, beforeResume: () -> Unit = {}) =
        onFailure(error, beforeResume)
}

/** Tracks callback operations owned by one BillingClient generation. */
internal class ActiveStoreOperationRegistry<Client : Any>(
    private val lock: Any,
    private val current: () -> ActiveStoreConnection<Client>,
) {
    private class Owner<Client : Any>(
        val client: Client,
        val generation: Long,
        val disconnect: (OpenIapError) -> Unit,
    )

    private data class CompletionClaim(
        val claimed: Boolean,
        val error: Throwable? = null,
    )

    private val owners = mutableSetOf<Owner<Client>>()

    suspend fun <T> await(
        client: Client,
        issue: (ActiveStoreOperationCompletion<T>) -> Unit,
    ): T = suspendCancellableCoroutine { continuation ->
        val ownerRef = AtomicReference<Owner<Client>?>(null)
        val resumer = continuation.resumeGuard {
            ownerRef.get()?.let(::cancel)
        }
        val owner = register(client) { error -> resumer.resumeWithException(error) }
        if (owner == null) {
            resumer.resumeWithException(
                OpenIapError.ServiceDisconnected(
                    "Billing connection changed before the operation could start"
                )
            )
            return@suspendCancellableCoroutine
        }
        ownerRef.set(owner)
        if (!continuation.isActive) {
            cancel(owner)
            return@suspendCancellableCoroutine
        }

        val completion = ActiveStoreOperationCompletion<T>(
            onIsActive = { isActive(owner) },
            onSuccess = { value, beforeResume ->
                val claim = complete(owner, beforeResume)
                if (claim.claimed) {
                    claim.error?.let(resumer::resumeWithException) ?: resumer.resume(value)
                }
            },
            onFailure = { error, beforeResume ->
                val claim = complete(owner, beforeResume)
                if (claim.claimed) {
                    resumer.resumeWithException(claim.error ?: error)
                }
            },
        )

        try {
            issue(completion)
        } catch (error: Throwable) {
            if (error is Error) {
                cancel(owner)
                throw error
            }
            completion.fail(error)
        }
    }

    /** Detaches matching operations atomically; invoke returned failures outside [lock]. */
    fun invalidate(
        client: Client? = null,
        error: () -> OpenIapError,
    ): List<() -> Unit> = synchronized(lock) {
        owners.filter { client == null || it.client === client }
            .also(owners::removeAll)
            .map { owner -> { owner.disconnect(error()) } }
    }

    internal fun size(): Int = synchronized(lock) { owners.size }

    private fun register(
        client: Client,
        disconnect: (OpenIapError) -> Unit,
    ): Owner<Client>? = synchronized(lock) {
        val active = current()
        if (active.client !== client) return@synchronized null
        Owner(client, active.generation, disconnect).also(owners::add)
    }

    private fun complete(owner: Owner<Client>, beforeResume: () -> Unit): CompletionClaim =
        synchronized(lock) {
            if (owner !in owners) return@synchronized CompletionClaim(false)
            val active = current()
            if (
                active.client !== owner.client ||
                active.generation != owner.generation
            ) {
                return@synchronized CompletionClaim(false)
            }
            owners.remove(owner)
            CompletionClaim(true, runCatching(beforeResume).exceptionOrNull())
        }

    private fun cancel(owner: Owner<Client>) {
        synchronized(lock) { owners.remove(owner) }
    }

    private fun isActive(owner: Owner<Client>): Boolean = synchronized(lock) {
        val active = current()
        owner in owners &&
            active.client === owner.client &&
            active.generation == owner.generation
    }
}
