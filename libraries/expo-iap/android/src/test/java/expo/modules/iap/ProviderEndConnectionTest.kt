package expo.modules.iap

import android.os.Looper
import dev.hyo.openiap.OpenIapProtocol
import expo.modules.kotlin.Promise
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderEndConnectionTest {
    @Test
    fun `endConnection without a provider resets state without creating one`() {
        val provider = lazy<OpenIapProtocol> { throw AssertionError("must not create a provider") }
        val module = ExpoIapModule()
        module.field("openIapLazy").set(module, provider)
        val connected = module.field("connectionReady").get(module) as AtomicBoolean
        connected.set(true)
        @Suppress("UNCHECKED_CAST")
        val events = module.field("pendingEvents").get(module) as ConcurrentLinkedQueue<Pair<String, Map<String, Any?>>>
        events.add("purchase-updated" to mapOf<String, Any?>("test" to true))
        var resolved: Any? = null
        var resolves = 0
        var rejects = 0
        val promise =
            object : Promise {
                override fun resolve(value: Any?) {
                    resolves++
                    resolved = value
                }

                override fun reject(
                    code: String?,
                    message: String?,
                    cause: Throwable?,
                ) {
                    rejects++
                }
            }
        val function = module.definition().asyncFunctions.getValue("endConnection")

        @Suppress("UNCHECKED_CAST")
        val body =
            function.javaClass
                .getDeclaredField("body")
                .apply { isAccessible = true }
                .get(function) as (
                Array<out Any?>,
                Promise,
            ) -> Unit
        body(emptyArray<Any?>(), promise)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, resolves)
        assertEquals(0, rejects)
        assertEquals(true, resolved)
        assertFalse(provider.isInitialized())
        assertFalse(connected.get())
        assertTrue(events.isEmpty())
        assertNull(module.field("listenerHandles").get(module))
    }

    private fun ExpoIapModule.field(name: String) = javaClass.getDeclaredField(name).apply { isAccessible = true }
}
