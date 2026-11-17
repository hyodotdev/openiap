package dev.hyo.openiap

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class DeepLinkToSubscriptionsPlayTest {

    @Test
    fun `deepLinkToSubscriptions reports a page that cannot open as an OpenIapError`() {
        val context = object : ContextWrapper(ApplicationProvider.getApplicationContext<Context>()) {
            override fun startActivity(intent: Intent) {
                throw ActivityNotFoundException("no browser")
            }
        }

        val thrown = runCatching {
            runBlocking { OpenIapModule(context).deepLinkToSubscriptions(null) }
        }.exceptionOrNull()

        assertTrue("expected OpenIapError.UnknownError, got $thrown", thrown is OpenIapError.UnknownError)
    }
}
