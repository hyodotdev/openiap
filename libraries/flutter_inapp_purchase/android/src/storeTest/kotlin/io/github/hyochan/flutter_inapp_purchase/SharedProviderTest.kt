@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import dev.hyo.openiap.ErrorCode
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
        assertEquals(1, FakeProviderFactory.endCalls)

        assertEquals(true, first.call("endConnection"))
        assertEquals(false, first.call("isReady"))
        assertEquals(true, second.call("isReady"))
        assertEquals(1, FakeProviderFactory.endCalls)

        assertEquals(true, second.call("endConnection"))
        assertEquals(false, second.call("isReady"))
        assertEquals(2, FakeProviderFactory.endCalls)
        dispose(first, second)
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
}
