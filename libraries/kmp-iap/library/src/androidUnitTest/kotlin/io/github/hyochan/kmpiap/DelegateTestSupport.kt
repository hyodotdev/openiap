package io.github.hyochan.kmpiap

import android.app.Activity
import android.content.Context
import dev.hyo.openiap.OpenIapProtocol
import java.lang.reflect.Proxy

/** A store module that answers every call through [invoke] (method name, arguments). */
internal fun fakeModule(invoke: (String, Array<out Any?>?) -> Any?): OpenIapProtocol =
    Proxy.newProxyInstance(
        OpenIapProtocol::class.java.classLoader,
        arrayOf(OpenIapProtocol::class.java),
    ) { _, method, args -> invoke(method.name, args) } as OpenIapProtocol

/** A delegate wired to [module] the way initConnection leaves it. */
internal fun delegateFor(
    store: Store,
    module: OpenIapProtocol,
    activity: Activity? = null,
    context: Context? = null,
    registerListeners: Boolean = false,
    firstPurchaseNotice: FirstPurchaseNotice = FirstPurchaseNotice.shared,
): OpenIapDelegateInAppPurchaseAndroid =
    OpenIapDelegateInAppPurchaseAndroid(store.name, store, "Android", firstPurchaseNotice).apply {
        setPrivateField("module", module)
        setPrivateField("currentActivity", activity)
        setPrivateField("context", context)
        if (registerListeners) {
            javaClass.getDeclaredMethod("registerListeners", OpenIapProtocol::class.java)
                .apply { isAccessible = true }
                .invoke(this, module)
        }
    }

internal fun Any.setPrivateField(name: String, value: Any?) {
    javaClass.getDeclaredField(name).apply { isAccessible = true }.set(this, value)
}

/** Records listeners a delegate attaches, keyed by type such as "PurchaseUpdateListener". */
internal class AttachedListeners {
    val byType = mutableMapOf<String, Any>()

    /** Returns true when [method] was a listener add/remove call. */
    fun record(method: String, args: Array<out Any?>?): Boolean = when {
        !method.endsWith("Listener") -> false
        method.startsWith("add") -> {
            byType[method.removePrefix("add")] = checkNotNull(args?.get(0))
            true
        }
        method.startsWith("remove") -> {
            if (byType[method.removePrefix("remove")] === args?.get(0)) {
                byType.remove(method.removePrefix("remove"))
            }
            true
        }
        else -> false
    }

    inline fun <reified T> get(type: String): T = byType.getValue(type) as T
}
