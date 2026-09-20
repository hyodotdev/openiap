package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.PendingPurchasesParams
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A bridge caching a connected flag learns of a service drop only from this
 * listener; the module otherwise fails in-flight work and nulls its client
 * without telling the caller (issue #408).
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class ConnectionStateListenerTest {

    @Test
    fun `dropping the live client notifies once and clears it`() {
        val module = module()
        val client = billingClient()
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
        val live = billingClient()
        setBillingClient(module, live)
        var calls = 0
        module.addConnectionStateListener(OpenIapConnectionStateListener { calls += 1 })

        module.handleBillingServiceDisconnected(billingClient())

        assertEquals(0, calls)
        assertSame(live, billingClientOf(module))
    }

    @Test
    fun `a drop during setup is reported through initConnection, not the listener`() {
        val module = module()
        val client = billingClient()
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
        val client = billingClient()
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
        val client = billingClient()
        setBillingClient(module, client)
        var calls = 0
        module.addConnectionStateListener(OpenIapConnectionStateListener { error("boom") })
        module.addConnectionStateListener(OpenIapConnectionStateListener { calls += 1 })

        module.handleBillingServiceDisconnected(client)

        assertEquals(1, calls)
    }

    private fun module(): OpenIapModule =
        OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

    /** Never started, so nothing reaches Play; the handler only compares identity. */
    private fun billingClient(): BillingClient =
        BillingClient.newBuilder(ApplicationProvider.getApplicationContext())
            .setListener { _, _ -> }
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()

    private fun billingClientField() =
        OpenIapModule::class.java.getDeclaredField("billingClient").apply { isAccessible = true }

    private fun setBillingClient(module: OpenIapModule, client: BillingClient?) {
        billingClientField().set(module, client)
    }

    private fun billingClientOf(module: OpenIapModule): BillingClient? =
        billingClientField().get(module) as BillingClient?
}
