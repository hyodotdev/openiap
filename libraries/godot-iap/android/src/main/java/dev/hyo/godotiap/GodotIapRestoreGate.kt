package dev.hyo.godotiap

/**
 * Drops listener-driven purchase emissions while a restore runs. The Horizon
 * provider notifies purchase listeners inside restorePurchases, and the
 * restore loop re-emits every owned purchase, so without the gate each one
 * signals twice. The listener fires on another thread, hence the volatile.
 */
internal class GodotIapRestoreGate {
    @Volatile
    private var restoring = false

    fun shouldEmit(): Boolean = !restoring

    suspend fun <T> whileRestoring(block: suspend () -> T): T {
        restoring = true
        try {
            return block()
        } finally {
            restoring = false
        }
    }
}
