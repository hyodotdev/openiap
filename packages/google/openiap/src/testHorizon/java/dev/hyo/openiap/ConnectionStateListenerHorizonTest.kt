package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import com.meta.horizon.billingclient.api.BillingClient
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Horizon ships the same listener surface as Play, so it has to fire it too;
 * accepting the listener and staying silent is the bug this guards (issue #408).
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class ConnectionStateListenerHorizonTest {

    @Test
    fun `dropping the live client notifies once and clears it`() {
        val module = module()
        val client = RecordingBillingClient()
        setBillingClient(module, client)
        var calls = 0
        val listener = OpenIapConnectionStateListener { calls += 1 }

        module.addConnectionStateListener(listener)
        module.addConnectionStateListener(listener)
        module.handleBillingServiceDisconnected(client)

        assertEquals(1, calls)
        assertNull(billingClientOf(module))
    }

    @Test
    fun `a superseded client does not notify`() {
        val module = module()
        val live = RecordingBillingClient()
        setBillingClient(module, live)
        var calls = 0
        module.addConnectionStateListener(OpenIapConnectionStateListener { calls += 1 })

        module.handleBillingServiceDisconnected(RecordingBillingClient())

        assertEquals(0, calls)
        assertSame(live, billingClientOf(module))
    }

    @Test
    fun `a drop during setup is reported through initConnection, not the listener`() {
        val module = module()
        val client = RecordingBillingClient()
        setBillingClient(module, client)
        var calls = 0
        var setupPending = false
        module.addConnectionStateListener(OpenIapConnectionStateListener { calls += 1 })

        module.handleBillingServiceDisconnected(
            client = client,
            ownsAttempt = { true },
            onSetupPending = { setupPending = true },
        )

        assertEquals(0, calls)
        assertEquals(true, setupPending)
        assertSame(client, billingClientOf(module))
    }

    @Test
    fun `a removed listener stops receiving`() {
        val module = module()
        val client = RecordingBillingClient()
        setBillingClient(module, client)
        var calls = 0
        val listener = OpenIapConnectionStateListener { calls += 1 }

        module.addConnectionStateListener(listener)
        module.removeConnectionStateListener(listener)
        module.handleBillingServiceDisconnected(client)

        assertEquals(0, calls)
    }

    @Test
    fun `a throwing listener does not stop the others`() {
        val module = module()
        val client = RecordingBillingClient()
        setBillingClient(module, client)
        var calls = 0
        module.addConnectionStateListener(OpenIapConnectionStateListener { error("boom") })
        module.addConnectionStateListener(OpenIapConnectionStateListener { calls += 1 })

        module.handleBillingServiceDisconnected(client)

        assertEquals(1, calls)
    }

    private fun module(): OpenIapModule =
        OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

    private fun billingClientField() =
        OpenIapModule::class.java.getDeclaredField("billingClient").apply { isAccessible = true }

    private fun setBillingClient(module: OpenIapModule, client: BillingClient?) {
        billingClientField().set(module, client)
    }

    private fun billingClientOf(module: OpenIapModule): BillingClient? =
        billingClientField().get(module) as BillingClient?
}
