package expo.modules.iap

import android.os.Bundle
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.OpenIapProvider
import expo.modules.kotlin.events.BasicEventListener
import expo.modules.kotlin.events.EventName
import kotlinx.coroutines.Job
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderDestructionTest {
    @Test
    fun `destruction completes after provider initialization fails`() {
        val context = RuntimeEnvironment.getApplication()
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle()
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
        var attempts = 0
        val provider =
            lazy {
                attempts++
                OpenIapProvider.create(context)
            }
        val module = ExpoIapModule()
        module.field("openIapLazy").set(module, provider)
        assertThrows(OpenIapError.ProviderConfiguration::class.java) { provider.value }
        val events = module.field("pendingEvents").get(module) as ConcurrentLinkedQueue<*>
        val connected = module.field("connectionReady").get(module) as AtomicBoolean
        connected.set(true)
        val destroy = module.definition().eventListeners[EventName.MODULE_DESTROY] as BasicEventListener
        destroy.call()
        assertEquals(1, attempts)
        assertFalse(provider.isInitialized())
        assertFalse(connected.get())
        assertTrue(events.isEmpty())
        assertTrue((module.field("job").get(module) as Job).isCancelled)
    }

    @Test
    fun `unused module can be destroyed without a host context`() {
        val module = ExpoIapModule()
        val destroy = module.definition().eventListeners[EventName.MODULE_DESTROY] as BasicEventListener
        destroy.call()
        assertTrue((module.field("job").get(module) as Job).isCancelled)
    }

    @Test
    fun `listener failure still clears state and cancels work`() {
        val provider =
            Proxy.newProxyInstance(
                OpenIapProtocol::class.java.classLoader,
                arrayOf(OpenIapProtocol::class.java),
            ) { _, _, _ -> throw IllegalStateException("Provider cleanup failed") } as OpenIapProtocol
        val module = ExpoIapModule()
        module.field("openIapLazy").set(module, lazy { provider })
        module.field("listenerHandles").set(
            module,
            ExpoIapHelper.ListenerHandles(
                purchaseUpdate = {},
                purchaseError = {},
                userChoiceBilling = {},
                developerProvidedBilling = {},
                subscriptionBillingIssue = {},
                connectionState = {},
            ),
        )
        val connected = module.field("connectionReady").get(module) as AtomicBoolean
        connected.set(true)
        val destroy = module.definition().eventListeners[EventName.MODULE_DESTROY] as BasicEventListener

        assertThrows(IllegalStateException::class.java) { destroy.call() }
        assertNull(module.field("listenerHandles").get(module))
        assertFalse(connected.get())
        assertTrue((module.field("job").get(module) as Job).isCancelled)
    }

    private fun ExpoIapModule.field(name: String) = javaClass.getDeclaredField(name).apply { isAccessible = true }
}
