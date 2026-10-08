package dev.hyo.openiap.maui

import android.os.Bundle
import android.os.Looper
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderConfigurationTest {
    @Test fun `invalid provider is reported through init rather than JNI construction`() {
        val context = RuntimeEnvironment.getApplication()
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle()
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
        val module = OpenIapMauiModule(context)
        module.setActivity(null)
        val token = module.addPurchaseUpdatedListener { fail("Invalid provider must not emit a purchase") }
        var error: String? = null
        var responses = 0
        module.initConnection(null) { result, errorJson ->
            assertNull(result)
            error = errorJson
            responses++
        }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, responses)
        val payload = JsonParser.parseString(error).asJsonObject
        assertEquals("developer-error", payload["code"].asString)
        assertTrue(payload["message"].asString.contains("provider", ignoreCase = true))
        module.removeListener(token)
    }
}
