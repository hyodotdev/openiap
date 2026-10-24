@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.os.Looper
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProviderFactory
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMethodCodec
import kotlinx.coroutines.delay
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import java.lang.reflect.Proxy
import java.nio.ByteBuffer
import java.time.Duration

/** A provider registered through manifest metadata; each test starts with [install]. */
class FakeProviderFactory : OpenIapProviderFactory {
    override val storeId = "test_fake_provider"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = io.github.hyochan.openiap.core.BuildConfig.CLIENT_PROTOCOL_VERSION

    override fun create(context: Context): OpenIapProtocol {
        maxLiveAtCreate = maxOf(maxLiveAtCreate, live)
        created++
        var connected = false
        // Lifecycle calls suspend so a second engine could interleave without the shared lock.
        val init: MutationInitConnectionHandler = {
            enterLifecycle()
            if (!connected) live++
            connected = true
            serviceDropped = false
            true
        }
        val end: MutationEndConnectionHandler = {
            enterLifecycle()
            if (connected) live--
            connected = false
            endCalls++
            true
        }
        val restore: MutationRestorePurchasesHandler = {}
        val finish: MutationFinishTransactionHandler = { _, _ -> finishedWhileConnected = connected && !serviceDropped }
        val acknowledge: MutationAcknowledgePurchaseAndroidHandler = { storeAccepts }
        val consume: MutationConsumePurchaseAndroidHandler = { storeAccepts }
        return Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, args ->
            calls++
            if (method.name in handlers) return@newProxyInstance handlers[method.name]
            when (method.name) {
                "getInitConnection" -> init
                "getEndConnection" -> end
                "getRestorePurchases" -> restore
                "getFinishTransaction" -> finish
                "getAcknowledgePurchaseAndroid" -> acknowledge
                "getConsumePurchaseAndroid" -> consume
                "setActivity" -> null.also { activity = args[0] as Activity? }
                "addConnectionStateListener" -> null.also { connectionListeners.add(args[0] as OpenIapConnectionStateListener) }
                "removeConnectionStateListener" -> null.also { connectionListeners.remove(args[0]) }
                else -> null
            }
        } as OpenIapProtocol
    }

    companion object {
        var created = 0
        // Connected clients; Horizon allows one.
        var live = 0
        var maxLiveAtCreate = 0
        var endCalls = 0
        var calls = 0
        var active = 0
        var maxActive = 0
        var storeAccepts = true
        var finishedWhileConnected: Boolean? = null
        var serviceDropped = false
        var activity: Activity? = null
        val connectionListeners = mutableListOf<OpenIapConnectionStateListener>()

        /** Method name to the value the proxy returns, e.g. "getVerifyPurchase" to a handler. */
        val handlers = mutableMapOf<String, Any?>()

        /** The store drops the billing service and tells every listener. */
        fun dropService() {
            serviceDropped = true
            connectionListeners.toList().forEach { it.onBillingServiceDisconnected() }
        }

        private suspend fun enterLifecycle() {
            active++
            maxActive = maxOf(maxActive, active)
            delay(50)
            active--
        }

        fun install() {
            created = 0
            live = 0
            maxLiveAtCreate = 0
            endCalls = 0
            calls = 0
            active = 0
            maxActive = 0
            storeAccepts = true
            finishedWhileConnected = null
            serviceDropped = false
            activity = null
            connectionListeners.clear()
            handlers.clear()
            val context = RuntimeEnvironment.getApplication()
            val info = context.packageManager.getApplicationInfo(context.packageName, 0)
            info.metaData = Bundle().apply { putString(OpenIapProvider.METADATA_KEY, FakeProviderFactory::class.java.name) }
            shadowOf(context.packageManager).installPackage(
                android.content.pm.PackageInfo().apply {
                    packageName = context.packageName
                    applicationInfo = info
                },
            )
        }
    }
}

/** A plugin with a channel that records what it sends to Dart. */
fun fakeEngine(sent: MutableList<in MethodCall> = mutableListOf()): AndroidInappPurchasePlugin {
    val messenger =
        Proxy.newProxyInstance(BinaryMessenger::class.java.classLoader, arrayOf(BinaryMessenger::class.java)) { _, method, args ->
            // The engine reads a message up to its position, so decode from the start.
            if (method.name == "send") sent.add(StandardMethodCodec.INSTANCE.decodeMethodCall((args[1] as ByteBuffer).apply { flip() }))
            null
        } as BinaryMessenger
    return AndroidInappPurchasePlugin().apply {
        setContext(RuntimeEnvironment.getApplication())
        setChannel(MethodChannel(messenger, "test"))
    }
}

/** Starts [method] without waiting, so another engine's call can run beside it. */
fun AndroidInappPurchasePlugin.start(
    method: String,
    arguments: Any? = null,
    replies: MutableList<Any?> = mutableListOf(),
): MutableList<Any?> {
    onMethodCall(
        MethodCall(method, arguments),
        object : MethodChannel.Result {
            override fun success(result: Any?) {
                replies.add(result)
            }

            override fun error(
                code: String,
                message: String?,
                details: Any?,
            ) {
                replies.add("error:$code")
            }

            override fun notImplemented() = fail("$method must be implemented")
        },
    )
    return replies
}

/** Calls [method], runs the main looper, and returns the only reply (an error as `error:<code>`). */
fun AndroidInappPurchasePlugin.call(
    method: String,
    arguments: Any? = null,
): Any? {
    val replies = start(method, arguments)
    settle()
    assertEquals("$method replies once", 1, replies.size)
    return replies.single()
}

/** Runs queued main-thread work. */
fun settle() = shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2))
