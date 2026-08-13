package dev.hyo.godotiap

import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class GodotIapHelperTest {
    @Test
    fun `canonical product query types preserve their exact meaning`() {
        assertEquals(
            ProductQueryType.InApp,
            GodotIapHelper.parseProductQueryType("in-app", ProductQueryType.All),
        )
        assertEquals(
            ProductQueryType.Subs,
            GodotIapHelper.parseProductQueryType("subs", ProductQueryType.All),
        )
        assertEquals(
            ProductQueryType.All,
            GodotIapHelper.parseProductQueryType("all", ProductQueryType.InApp),
        )
    }

    @Test
    fun `removed aliases unknown values and purchase-all are rejected`() {
        listOf("inapp", "in_app", "subscription", "subscriptions").forEach { removed ->
            assertThrows(IllegalArgumentException::class.java) {
                GodotIapHelper.parseProductQueryType(removed)
            }
        }
        assertThrows(IllegalArgumentException::class.java) {
            GodotIapHelper.parseProductQueryType("subscrption")
        }
        assertThrows(IllegalArgumentException::class.java) {
            GodotIapHelper.parseProductQueryType(
                rawType = "all",
                allowAll = false,
            )
        }
    }

    @Test
    fun `subscription replacement modes require complete concrete params`() {
        val invalidParams = listOf(
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{}}""",
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":"old"}}""",
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":"old","replacementMode":"future-mode"}}""",
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":"old","replacementMode":"unknown-replacement-mode"}}""",
        )

        invalidParams.forEach { json ->
            assertThrows(IllegalArgumentException::class.java) {
                GodotIapHelper.parseRequestPurchaseParams(json)
            }
        }
    }

    @Test
    fun `all concrete subscription replacement modes parse`() {
        val mappings = mapOf(
            "with-time-proration" to SubscriptionReplacementModeAndroid.WithTimeProration,
            "charge-prorated-price" to SubscriptionReplacementModeAndroid.ChargeProratedPrice,
            "charge-full-price" to SubscriptionReplacementModeAndroid.ChargeFullPrice,
            "without-proration" to SubscriptionReplacementModeAndroid.WithoutProration,
            "deferred" to SubscriptionReplacementModeAndroid.Deferred,
            "keep-existing" to SubscriptionReplacementModeAndroid.KeepExisting,
        )

        mappings.forEach { (rawMode, expected) ->
            val params = GodotIapHelper.parseRequestPurchaseParams(
                """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":"old","replacementMode":"$rawMode"}}""",
            )
            assertEquals(expected, params.subscriptionProductReplacementParams?.replacementMode)
        }
    }

    @Test
    fun `native purchase boundary rejects replacement params for in-app products`() {
        assertThrows(IllegalArgumentException::class.java) {
            GodotIapHelper.parseRequestPurchaseParams(
                """{"type":"in-app","skus":["coins"],"subscriptionProductReplacementParams":{"oldProductId":"old","replacementMode":"without-proration"}}""",
            )
        }
    }

    @Test
    fun `developer billing option is either absent or valid`() {
        listOf(
            """{"skus":["coins"],"developerBillingOption":"billing-choice"}""",
            """{"skus":["coins"],"developerBillingOption":{}}""",
            """{"skus":["coins"],"developerBillingOption":{"billingProgram":"future-program"}}""",
        ).forEach { json ->
            assertThrows(IllegalArgumentException::class.java) {
                GodotIapHelper.parseRequestPurchaseParams(json)
            }
        }

        val absent = GodotIapHelper.parseRequestPurchaseParams("""{"skus":["coins"]}""")
        assertEquals(null, absent.developerBillingOption)

        val nullable = GodotIapHelper.parseRequestPurchaseParams(
            """{"type":"subs","skus":["monthly"],"developerBillingOption":null,"subscriptionOffers":null,"subscriptionProductReplacementParams":null}""",
        )
        assertEquals(null, nullable.developerBillingOption)
        assertEquals(0, nullable.subscriptionOffers.size)
        assertEquals(null, nullable.subscriptionProductReplacementParams)

        val valid = GodotIapHelper.parseRequestPurchaseParams(
            """{"skus":["coins"],"developerBillingOption":{"billingProgram":"billing-choice"}}""",
        )
        assertEquals(BillingProgramAndroid.BillingChoice, valid.developerBillingOption?.billingProgram)
    }

    @Test
    fun `purchase lists reject malformed explicit entries`() {
        listOf(
            """{"type":"subs","skus":"monthly"}""",
            """{"type":"subs","skus":[]}""",
            """{"type":"subs","skus":["monthly",7]}""",
            """{"type":"subs","skus":[""]}""",
            """{"type":"subs","skus":["monthly"],"obfuscatedAccountId":7}""",
            """{"type":"subs","skus":["monthly"],"isOfferPersonalized":"true"}""",
            """{"type":"subs","skus":["monthly"],"offerToken":"one-time-token"}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":"offer"}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[]}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[7]}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[{"offerToken":"token"}]}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[{"sku":"monthly"}]}""",
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[{"sku":"yearly","offerToken":"token"}]}""",
            """{"type":"in-app","skus":["coins"],"subscriptionOffers":[]}""",
            """{"type":"in-app","skus":["coins"],"purchaseToken":"subscription-token"}""",
            """{"type":"in-app","skus":["coins"],"originalExternalTransactionId":"external-id"}""",
        ).forEach { json ->
            assertThrows(IllegalArgumentException::class.java) {
                GodotIapHelper.parseRequestPurchaseParams(json)
            }
        }

        val multipleOffers = GodotIapHelper.parseRequestPurchaseParams(
            """{"type":"subs","skus":["monthly"],"subscriptionOffers":[{"sku":"monthly","offerToken":"one"},{"sku":"monthly","offerToken":"two"}]}""",
        )
        assertEquals(2, multipleOffers.subscriptionOffers.size)
    }

}
