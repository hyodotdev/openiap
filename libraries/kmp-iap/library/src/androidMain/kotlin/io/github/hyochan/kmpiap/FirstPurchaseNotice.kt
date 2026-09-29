package io.github.hyochan.kmpiap

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import dev.hyo.openiap.helpers.OpenIapFirstPurchaseNotice
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseState
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

// Must match "consoleNotice" in packages/docs/community-touchpoints.json.
internal val FIRST_PURCHASE_NOTICE = listOf(
    "[OpenIAP] First purchase finished in this app 🎉",
    "If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap",
    "When your app ships, list it for free: https://openiap.dev/showcase",
    "(Shown once, debug builds only.)",
).joinToString("\n")

internal fun isJUnitOnClasspath(): Boolean =
    listOf("org.junit.Test", "org.junit.jupiter.api.Test")
        .any { name -> runCatching { Class.forName(name) }.isSuccess }

/**
 * Logs [FIRST_PURCHASE_NOTICE] once per install, after a debug build of the
 * host app finishes its first purchase. Internal to kmp-iap; not app API.
 */
internal class FirstPurchaseNotice(
    private val isTestRunner: () -> Boolean = ::isJUnitOnClasspath,
    // kmp-iap always ships compiled in release, so ask the host app.
    private val isHostDebuggable: (Context) -> Boolean = {
        it.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
    },
    // A lambda, not a bound reference, so an openiap-google without the helper fails only inside the notice.
    private val claim: (Context) -> Boolean = { OpenIapFirstPurchaseNotice.claim(it) },
    private val log: (String) -> Unit = { Log.i("OpenIAP", it) },
    private val runInBackground: (() -> Unit) -> Unit = { work -> thread { work() } },
) {
    private val claimAttempted = AtomicBoolean(false)

    /** Call after finishTransaction succeeded; never throws and never waits on the flag's disk write. */
    fun onTransactionFinished(purchase: Purchase, context: Context?) {
        if (context == null || purchase.purchaseState != PurchaseState.Purchased) return
        runCatching {
            if (!isTestRunner() && isHostDebuggable(context) && claimAttempted.compareAndSet(false, true)) {
                runInBackground { runCatching { if (claim(context)) log(FIRST_PURCHASE_NOTICE) } }
            }
        }
    }

    companion object {
        /** One per process, so every KmpIAP instance shares the in-memory guard. */
        val shared = FirstPurchaseNotice()
    }
}
