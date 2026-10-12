package dev.hyo.godotiap

import dev.hyo.openiap.OpenIapError
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test

class GodotIapEnvelopeTest {
    @Test
    fun `not-prepared envelopes keep their extra fields`() {
        val result = JSONObject(notInitializedJson("hasActive" to false))
        assertFalse(result.getBoolean("hasActive"))
        assertEquals("not-prepared", result.getString("code"))
    }

    @Test
    fun `a thrown store error keeps its code`() {
        val refused = JSONObject(failureJson(OpenIapError.BillingError("The store did not consume the purchase")))
        assertFalse(refused.getBoolean("success"))
        assertEquals("service-error", refused.getString("code"))
        assertEquals("not-prepared", JSONObject(failureJson(OpenIapError.NotPrepared)).getString("code"))
    }

    @Test
    fun `verification keeps every Horizon and Google option`() {
        val horizon = GodotIapHelper.parseVerifyPurchaseProps(
            """{"horizon":{"sku":"gems","userId":"42","accessToken":"OC|app|secret"}}""",
        ).horizon
        assertEquals("gems", horizon?.sku)
        assertEquals("42", horizon?.userId)
        assertEquals("OC|app|secret", horizon?.accessToken)

        val google = GodotIapHelper.parseVerifyPurchaseProps(
            """{"google":{"sku":"sub","accessToken":"token","packageName":"app","purchaseToken":"opaque","isSub":true}}""",
        ).google
        assertEquals("opaque", google?.purchaseToken)
        assertEquals(true, google?.isSub)
    }

    @Test
    fun `verification input errors are developer errors`() {
        for (props in listOf("{}", "not json", """{"horizon":"bad"}""")) {
            try {
                GodotIapHelper.parseVerifyPurchaseProps(props)
                fail("$props must be rejected")
            } catch (error: OpenIapError) {
                assertEquals("$props", "developer-error", error.code)
            }
        }
    }
}
