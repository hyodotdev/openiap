package dev.hyo.openiap

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The amazon manifest must keep registering its factory; OpenIapStore depends on it. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], instrumentedPackages = ["com.amazon"])
class AmazonProviderDiscoveryTest {
    @Test
    fun `merged manifest discovers the amazon factory`() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val factory = OpenIapProvider.factory(context)

        assertEquals("dev.hyo.openiap.OpenIapStoreFactory", factory.javaClass.name)
        assertEquals("amazon", factory.storeId)
        assertTrue(OpenIapProvider.create(context, factory) is OpenIapModule)
    }
}
