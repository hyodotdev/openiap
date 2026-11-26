package dev.hyo.openiap

import android.content.pm.ApplicationInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonIapkitOptionsTest {
    private fun horizonOptions(sandbox: Boolean?): RequestVerifyPurchaseWithIapkitProps =
        RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_pk_test",
            baseUrl = "https://kit.openiap.dev",
            includeClientPayload = true,
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                sku = "dev.hyo.martie.premium",
                userId = "123456789",
                sandbox = sandbox,
            ),
        )

    @Test
    fun resolvedUserIdPreservesSkuAndOptions() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_pk_test",
            baseUrl = "https://kit.openiap.dev",
            includeClientPayload = true,
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                sku = "dev.hyo.martie.premium",
                sandbox = true,
            ),
        )

        val resolved = withResolvedHorizonUserId(options, " 123456789 ")

        assertEquals("dev.hyo.martie.premium", resolved.horizon?.sku)
        assertEquals("123456789", resolved.horizon?.userId)
        assertEquals(true, resolved.horizon?.sandbox)
        assertEquals("openiap-kit_pk_test", resolved.apiKey)
        assertEquals("https://kit.openiap.dev", resolved.baseUrl)
        assertEquals(true, resolved.includeClientPayload)
    }

    @Test
    fun blankResolvedUserIdIsRejected() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                sku = "dev.hyo.martie.premium",
            ),
        )

        assertThrows(IllegalArgumentException::class.java) {
            withResolvedHorizonUserId(options, " ")
        }
    }

    @Test
    fun debuggableFlagIsReadFromTheApplicationInfo() {
        assertTrue(isDebuggableApp(ApplicationInfo().apply { flags = ApplicationInfo.FLAG_DEBUGGABLE }))
        assertTrue(
            isDebuggableApp(
                ApplicationInfo().apply {
                    flags = ApplicationInfo.FLAG_DEBUGGABLE or ApplicationInfo.FLAG_HAS_CODE
                },
            ),
        )
        assertFalse(isDebuggableApp(ApplicationInfo().apply { flags = ApplicationInfo.FLAG_HAS_CODE }))
    }

    @Test
    fun omittedSandboxFollowsTheDebuggableFlag() {
        for (isDebuggable in listOf(true, false)) {
            val resolved = withDefaultHorizonSandbox(horizonOptions(sandbox = null), isDebuggable)

            assertEquals(isDebuggable, resolved.horizon?.sandbox)
            assertEquals("dev.hyo.martie.premium", resolved.horizon?.sku)
            assertEquals("123456789", resolved.horizon?.userId)
            assertEquals("openiap-kit_pk_test", resolved.apiKey)
            assertEquals("https://kit.openiap.dev", resolved.baseUrl)
            assertEquals(true, resolved.includeClientPayload)
        }
    }

    @Test
    fun explicitSandboxWinsOverTheDebuggableFlag() {
        assertEquals(
            true,
            withDefaultHorizonSandbox(horizonOptions(sandbox = true), isDebuggable = false).horizon?.sandbox,
        )
        assertEquals(
            false,
            withDefaultHorizonSandbox(horizonOptions(sandbox = false), isDebuggable = true).horizon?.sandbox,
        )
    }

    @Test
    fun otherStorePayloadsAreLeftUntouched() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            google = RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = "token-123"),
        )

        val resolved = withDefaultHorizonSandbox(options, isDebuggable = true)

        assertSame(options, resolved)
        assertNull(resolved.horizon)
    }
}
