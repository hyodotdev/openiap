package dev.hyo.capacitoriap

/** Requests waiting on one store outcome; each settles exactly once. */
internal class PendingRequests<T> {
    private val pending = mutableListOf<T>()

    fun add(request: T) {
        synchronized(pending) { pending.add(request) }
    }

    /** Settles every waiting request; a later outcome finds none to settle. */
    fun settleAll(settle: (T) -> Unit) {
        val drained = synchronized(pending) { pending.toList().also { pending.clear() } }
        drained.forEach(settle)
    }
}
