package dev.hyo.godotiap

import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.StoreIds
import org.json.JSONObject

/**
 * Drops listener-driven purchase emissions while a restore runs. The Horizon
 * provider notifies purchase listeners inside restorePurchases, and restore
 * stays silent, so those notifications must not signal. The listener fires on
 * another thread, hence the volatile.
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

/** Restore before connecting reports not-prepared, like the purchase queries. */
internal fun restoreNotInitialized(): String =
    JSONObject().apply {
        put("success", false)
        put("code", "not-prepared")
        put("error", "IAP connection is not initialized")
    }.toString()

/**
 * Only the Horizon restore notifies purchase listeners, so only it runs
 * behind the gate. Unknown or unreadable ids mean no suppression.
 */
internal fun shouldSuppressRestoreListeners(providerStoreId: String?): Boolean =
    providerStoreId == StoreIds.Horizon

/**
 * Runs the provider restore, then counts the available purchases. Emits
 * nothing; the result JSON carries success and count.
 */
internal suspend fun runSilentRestore(
    gate: GodotIapRestoreGate,
    suppressListener: Boolean,
    restore: suspend () -> Unit,
    countAvailable: suspend () -> Int,
    onFailure: (Exception) -> Unit = { GodotIapLog.failure("restorePurchases", it) },
): String {
    return try {
        if (suppressListener) {
            gate.whileRestoring(restore)
        } else {
            restore()
        }
        val count = countAvailable()
        GodotIapLog.result("restorePurchases", "count=$count")
        JSONObject().apply {
            put("success", true)
            put("count", count)
        }.toString()
    } catch (error: Exception) {
        onFailure(error)
        JSONObject().apply {
            put("success", false)
            put("code", (error as? OpenIapError)?.code ?: ErrorCode.ServiceError.toJson())
            put("error", error.message)
        }.toString()
    }
}
