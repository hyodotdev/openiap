package io.github.hyochan.flutter_inapp_purchase

import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidInappPurchasePluginTest {
    @Test
    fun `connection APIs report unavailable`() {
        listOf("initConnection", "endConnection", "isReady").forEach { method ->
            val result = CapturingResult()
            AndroidInappPurchasePlugin().onMethodCall(MethodCall(method, null), result)

            assertEquals(false, result.value)
            assertFalse(result.notImplemented)
            assertNull(result.errorCode)
        }
    }

    @Test
    fun `store reports none`() {
        val result = CapturingResult()
        AndroidInappPurchasePlugin().onMethodCall(MethodCall("getStore", null), result)

        assertEquals("none", result.value)
    }

    @Test
    fun `purchase APIs report iap not available`() {
        val result = CapturingResult()
        AndroidInappPurchasePlugin().onMethodCall(MethodCall("requestPurchase", null), result)

        assertEquals(AndroidInappPurchasePlugin.ERROR_CODE, result.errorCode)
        assertEquals(AndroidInappPurchasePlugin.ERROR_MESSAGE, result.errorMessage)
        assertEquals(
            AndroidInappPurchasePlugin.ERROR_VALUE,
            (result.errorDetails as Map<*, *>)["code"],
        )
    }

    private class CapturingResult : MethodChannel.Result {
        var value: Any? = null
        var errorCode: String? = null
        var errorMessage: String? = null
        var errorDetails: Any? = null
        var notImplemented = false

        override fun success(result: Any?) {
            value = result
        }

        override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {
            this.errorCode = errorCode
            this.errorMessage = errorMessage
            this.errorDetails = errorDetails
        }

        override fun notImplemented() {
            notImplemented = true
        }
    }
}
