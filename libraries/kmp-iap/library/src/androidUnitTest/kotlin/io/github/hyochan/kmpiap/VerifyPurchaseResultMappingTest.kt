package io.github.hyochan.kmpiap

import com.google.gson.Gson
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class VerifyPurchaseResultMappingTest {
    // A realistic purchases.products.get response: Google returns none of the
    // Amazon-RVS-shaped fields (parentProductId, productType, receiptId, term,
    // termSku), so reflective Gson leaves those declared-non-null fields null
    // on the openiap-google result — the same parse PurchaseVerificationValidator
    // performs. verifyPurchase must absorb that through the JSON map boundary
    // instead of tripping constructor null checks.
    @Test
    fun `gson-parsed google result with absent fields maps through the json boundary`() {
        val googleResult = Gson().fromJson(
            """
            {
              "autoRenewing": false,
              "purchaseDate": 1752969600000,
              "quantity": 1,
              "testTransaction": true,
              "productId": "dev.hyo.martie.bulbs10"
            }
            """.trimIndent(),
            dev.hyo.openiap.VerifyPurchaseResultAndroid::class.java,
        )

        // The hazard the boundary absorbs: Gson left this declared-non-null
        // field null, so a direct constructor copy would throw NPE.
        @Suppress("SENSELESS_COMPARISON")
        assertNull(googleResult.parentProductId as String?)

        val mapped = VerifyPurchaseResultAndroid.fromJson(googleResult.toJson())

        assertEquals("dev.hyo.martie.bulbs10", mapped.productId)
        assertEquals(1752969600000.0, mapped.purchaseDate)
        assertEquals(1, mapped.quantity)
        assertTrue(mapped.testTransaction)
        assertEquals("", mapped.parentProductId)
        assertEquals("", mapped.productType)
        assertEquals("", mapped.receiptId)
        assertEquals("", mapped.term)
        assertEquals("", mapped.termSku)
    }
}
