package dev.hyo.openiap.helpers

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

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
    fun `two claims that race have exactly one winner`() {
        val bothRead = CountDownLatch(2)
        val racing = object : ContextWrapper(context) {
            override fun getApplicationContext(): Context = this

            override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
                val real = super.getSharedPreferences(name, mode)
                // Without the claim lock, both callers read "not shown" before either writes.
                return object : SharedPreferences by real {
                    override fun getBoolean(key: String?, defValue: Boolean): Boolean {
                        val stored = real.getBoolean(key, defValue)
                        bothRead.countDown()
                        bothRead.await(300, TimeUnit.MILLISECONDS)
                        return stored
                    }
                }
            }
        }
        val winners = AtomicInteger()
        val pool = Executors.newFixedThreadPool(2)
        repeat(2) {
            pool.execute { if (OpenIapFirstPurchaseNotice.claim(racing)) winners.incrementAndGet() }
        }
        pool.shutdown()
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS))
        assertEquals(1, winners.get())
    }

    @Test
    fun `the flag is on disk, so a relaunch does not claim again`() {
        assertTrue(OpenIapFirstPurchaseNotice.claim(context))
        val stored = context.getSharedPreferences("dev.hyo.openiap", Context.MODE_PRIVATE)
        assertTrue(stored.getBoolean("first_purchase_notice_shown", false))
        assertFalse(OpenIapFirstPurchaseNotice.claim(context))
    }
}
