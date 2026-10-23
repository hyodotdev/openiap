@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.MutationInitConnectionHandler
import io.flutter.plugin.common.MethodCall
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SharedProviderTest {
    @Before fun installFakeProvider() = FakeProviderFactory.install()

    private fun dispose(vararg engines: AndroidInappPurchasePlugin) {
        engines.forEach { it.dispose() }
        settle()
    }

    @Test fun `engines share one provider and the last one ends it`() {
        val engines = listOf(fakeEngine(), fakeEngine())
        engines.forEach { assertEquals(true, it.call("restorePurchases")) }
        assertEquals(1, FakeProviderFactory.created)

        dispose(engines[0])
        assertEquals(0, FakeProviderFactory.endCalls)
        dispose(engines[1])
        assertEquals(1, FakeProviderFactory.endCalls)
    }

    @Test fun `concurrent initConnection never interleaves on the shared client`() {
        val engines = listOf(fakeEngine(), fakeEngine())
        val replies = engines.map { it.start("initConnection") }
        settle()
        engines.zip(replies).forEach { (engine, reply) ->
            assertEquals(listOf<Any?>("Billing client ready"), reply)
            assertEquals(true, engine.call("isReady"))
        }
        assertEquals(1, FakeProviderFactory.maxActive)
        assertEquals(1, FakeProviderFactory.created)
        dispose(*engines.toTypedArray())
    }

    @Test fun `a replacement engine waits until the old client has ended`() {
        val old = fakeEngine()
        assertEquals("Billing client ready", old.call("initConnection"))
        old.dispose()
        val replacement = fakeEngine()
        replacement.start("restorePurchases")
        settle()
        assertEquals(2, FakeProviderFactory.created)
        assertEquals(0, FakeProviderFactory.maxLiveAtCreate)
        dispose(replacement)
    }

    @Test fun `one engine ending keeps the other connected`() {
        val (first, second) = listOf(fakeEngine(), fakeEngine())
        assertEquals("Billing client ready", first.call("initConnection"))
        assertEquals(false, second.call("isReady"))
        assertEquals("Billing client ready", second.call("initConnection"))
        assertEquals(0, FakeProviderFactory.endCalls)

        assertEquals(true, first.call("endConnection"))
        assertEquals(false, first.call("isReady"))
        assertEquals(true, second.call("isReady"))
        assertEquals(0, FakeProviderFactory.endCalls)

        assertEquals(true, second.call("endConnection"))
        assertEquals(false, second.call("isReady"))
        assertEquals(1, FakeProviderFactory.endCalls)
        dispose(first, second)
    }

    @Test fun `initConnection leaves the live client to the store module`() {
        val configs = mutableListOf<InitConnectionConfig?>()
        val record: MutationInitConnectionHandler = { config ->
            configs.add(config)
            true
        }
        FakeProviderFactory.handlers["getInitConnection"] = record
        val engine = fakeEngine()

        assertEquals("Billing client ready", engine.call("initConnection"))
        assertEquals(
            "Billing client ready",
            engine.call("initConnection", mapOf("enableBillingProgramAndroid" to "external-offer")),
        )

        // No config reaches the module as null, so it keeps a live client.
        assertEquals(2, configs.size)
        assertEquals(null, configs[0])
        assertEquals(BillingProgramAndroid.ExternalOffer, configs[1]?.enableBillingProgramAndroid)
        assertEquals(0, FakeProviderFactory.endCalls)
        dispose(engine)
    }

    @Test fun `only the engine that set the Activity clears it`() {
        val (background, foreground) = listOf(fakeEngine(), fakeEngine())
        listOf(background, foreground).forEach { it.call("restorePurchases") }
        val backgroundActivity = Robolectric.buildActivity(Activity::class.java).get()
        val foregroundActivity = Robolectric.buildActivity(Activity::class.java).get()
        background.setActivity(backgroundActivity)
        foreground.setActivity(foregroundActivity)

        background.setActivity(null)
        assertSame(foregroundActivity, FakeProviderFactory.activity)
        foreground.setActivity(null)
        assertEquals(null, FakeProviderFactory.activity)
        dispose(background, foreground)
    }

    @Test fun `an engine still in front re-claims the Activity on its next call`() {
        val (front, other) = listOf(fakeEngine(), fakeEngine())
        listOf(front, other).forEach { it.call("restorePurchases") }
        val frontActivity = Robolectric.buildActivity(Activity::class.java).get()
        front.setActivity(frontActivity)
        other.setActivity(Robolectric.buildActivity(Activity::class.java).get())
        other.setActivity(null)
        assertEquals(null, FakeProviderFactory.activity)

        assertEquals("Billing client ready", front.call("initConnection"))
        assertSame(frontActivity, FakeProviderFactory.activity)
        dispose(front, other)
    }

    @Test fun `acknowledge and consume reject a store refusal`() {
        val engine = fakeEngine()
        val token = mapOf("purchaseToken" to "opaque")
        FakeProviderFactory.storeAccepts = false
        assertEquals("error:${ErrorCode.ServiceError.rawValue}", engine.call("acknowledgePurchaseAndroid", token))
        assertEquals("error:${ErrorCode.ServiceError.rawValue}", engine.call("consumePurchaseAndroid", token))

        FakeProviderFactory.storeAccepts = true
        assertEquals(0, JSONObject(engine.call("acknowledgePurchaseAndroid", token) as String).getInt("responseCode"))
        assertEquals(0, JSONObject(engine.call("consumePurchaseAndroid", token) as String).getInt("responseCode"))
        dispose(engine)
    }

    @Test fun `finishTransaction reconnects a dropped billing service`() {
        val engine = fakeEngine()
        assertEquals("Billing client ready", engine.call("initConnection"))
        FakeProviderFactory.dropService()
        settle()

        val purchase = mapOf("id" to "order", "productId" to "premium", "purchaseToken" to "opaque", "store" to "google", "storeId" to "play")
        assertEquals(null, engine.call("finishTransaction", mapOf("purchase" to purchase, "isConsumable" to false)))
        assertEquals(true, FakeProviderFactory.finishedWhileConnected)
        assertEquals(true, engine.call("isReady"))
        dispose(engine)
    }

    @Test fun `a reconnect after a drop leaves the program to the store module`() {
        val configs = mutableListOf<InitConnectionConfig?>()
        val record: MutationInitConnectionHandler = { config ->
            configs.add(config)
            FakeProviderFactory.serviceDropped = false
            true
        }
        FakeProviderFactory.handlers["getInitConnection"] = record
        val engine = fakeEngine()
        assertEquals(
            "Billing client ready",
            engine.call("initConnection", mapOf("enableBillingProgramAndroid" to "external-offer")),
        )
        FakeProviderFactory.dropService()
        settle()

        val purchase = mapOf("id" to "order", "productId" to "premium", "purchaseToken" to "opaque", "store" to "google", "storeId" to "play")
        assertEquals(null, engine.call("finishTransaction", mapOf("purchase" to purchase, "isConsumable" to false)))

        // No config, so the module reconnects with the program it had.
        assertEquals(2, configs.size)
        assertEquals(null, configs[1])
        dispose(engine)
    }

    @Test fun `a dropped billing service requires initConnection again`() {
        val sent = mutableListOf<MethodCall>()
        val engine = fakeEngine(sent)
        assertEquals("Billing client ready", engine.call("initConnection"))
        assertEquals(true, engine.call("isReady"))

        FakeProviderFactory.connectionListeners.single().onBillingServiceDisconnected()
        settle()

        assertEquals(false, engine.call("isReady"))
        val update = sent.last { it.method == "connection-updated" }
        assertEquals(false, JSONObject(update.arguments as String).getBoolean("connected"))
        dispose(engine)
        assertTrue(FakeProviderFactory.connectionListeners.isEmpty())
    }

    @Test fun `a drop before initConnection resumes leaves it not ready`() {
        val log = mutableListOf<Any?>()
        val engine = fakeEngine(log)
        val dropAfterSetup: MutationInitConnectionHandler = {
            FakeProviderFactory.dropService()
            true
        }
        FakeProviderFactory.handlers["getInitConnection"] = dropAfterSetup
        engine.start("initConnection", replies = log)
        settle()

        assertEquals(false, engine.call("isReady"))
        // Dart must see the success before the drop, or it records a dead connection as live.
        val dartView = log.map { if (it is MethodCall) JSONObject(it.arguments as String).getBoolean("connected") else it }
        assertEquals(listOf(true, "Billing client ready", false), dartView)
        dispose(engine)
    }
}
