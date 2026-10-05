package dev.hyo.openiap

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The play manifest must keep registering its factory; OpenIapStore depends on it. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class PlayProviderDiscoveryTest {
    @Test
    fun `merged manifest discovers the play factory`() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val factory = OpenIapProvider.factory(context)

        assertEquals("dev.hyo.openiap.OpenIapStoreFactory", factory.javaClass.name)
        assertEquals("play", factory.storeId)
        assertTrue(OpenIapProvider.create(context, factory) is OpenIapModule)
    }
}
