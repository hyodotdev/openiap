package dev.hyo.openiap.helpers

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

// Play only: Robolectric cannot verify the Amazon Appstore SDK's receiver bytecode,
// and the helper does not depend on the store.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OpenIapFirstPurchaseNoticeTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Before
    fun clearInstall() {
        context.getSharedPreferences("dev.hyo.openiap", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun `claims once per install`() {
        assertTrue(OpenIapFirstPurchaseNotice.claim(context))
        assertFalse(OpenIapFirstPurchaseNotice.claim(context))
    }

    @Test
    fun `the flag is on disk, so a relaunch does not claim again`() {
        assertTrue(OpenIapFirstPurchaseNotice.claim(context))
        val stored = context.getSharedPreferences("dev.hyo.openiap", Context.MODE_PRIVATE)
        assertTrue(stored.getBoolean("first_purchase_notice_shown", false))
        assertFalse(OpenIapFirstPurchaseNotice.claim(context))
    }

    @Test
    fun `debuggable follows the host app flag`() {
        context.applicationInfo.flags = context.applicationInfo.flags or ApplicationInfo.FLAG_DEBUGGABLE
        assertTrue(OpenIapFirstPurchaseNotice.isHostDebuggable(context))
        context.applicationInfo.flags = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE.inv()
        assertFalse(OpenIapFirstPurchaseNotice.isHostDebuggable(context))
    }
}
