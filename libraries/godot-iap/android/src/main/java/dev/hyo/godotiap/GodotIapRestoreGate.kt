package dev.hyo.godotiap

import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
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

/**
 * Runs the provider restore under the gate, then counts the available
 * purchases. Emits nothing; the result JSON carries success and count.
 */
internal suspend fun runSilentRestore(
    gate: GodotIapRestoreGate,
    restore: suspend () -> Unit,
    countAvailable: suspend () -> Int,
    onFailure: (Exception) -> Unit = { GodotIapLog.failure("restorePurchases", it) },
): String {
    return try {
        gate.whileRestoring(restore)
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
