package dev.hyo.capacitoriap

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JsonBridgeTest {
    @Test
    fun readsNestedJavaScriptObjects() {
        val json = JSONObject("""{"type":"subs","requestSubscription":{"google":{"skus":["premium"],"isOfferPersonalized":null}}}""")

        val map = JsonBridge.toMap(json)

        assertEquals("subs", map["type"])
        val google = (map["requestSubscription"] as Map<*, *>)["google"] as Map<*, *>
        assertEquals(listOf("premium"), google["skus"])
        assertTrue(google.containsKey("isOfferPersonalized"))
        assertEquals(null, google["isOfferPersonalized"])
    }

    @Test
    fun keepsNullFieldsInPayloads() {
        val payload =
            JsonBridge.toJSObject(
                mapOf(
                    "productId" to "coins",
                    "purchaseToken" to null,
                    "ids" to listOf("coins"),
                    "pendingPurchaseUpdateAndroid" to mapOf("products" to listOf("pro")),
                ),
            )

        assertTrue(payload.has("purchaseToken"))
        assertTrue(payload.isNull("purchaseToken"))
        assertEquals("coins", (payload.get("ids") as JSONArray).getString(0))
        assertEquals("pro", payload.getJSONObject("pendingPurchaseUpdateAndroid").getJSONArray("products").getString(0))
    }
}
