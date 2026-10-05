package dev.hyo.godotiap

import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.InAppMessageCategoryAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test

class GodotIapHelperTest {
    @Test
    fun `omitted in-app message categories preserve the transactional default`() {
        assertEquals(
            listOf(InAppMessageCategoryAndroid.Transactional),
            validateGodotInAppMessageParams("{}").categories,
        )
    }

    @Test
    fun `in-app message categories reject malformed input`() {
        val params = validateGodotInAppMessageParams(
            """{"categories":["transactional","unknown-in-app-message-category-id"]}""",
        )
        assertEquals(
            listOf(
                InAppMessageCategoryAndroid.Transactional,
                InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId,
            ),
            params.categories,
        )

        listOf(
            """{"categories":["future-category"]}""",
            """{"categories":[999]}""",
            """{"categories":"transactional"}""",
        ).forEach { json ->
            assertThrows(IllegalArgumentException::class.java) {
                validateGodotInAppMessageParams(json)
            }
        }
    }

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
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":7,"replacementMode":"without-proration"}}""",
            """{"type":"subs","skus":["new"],"subscriptionProductReplacementParams":{"oldProductId":"   ","replacementMode":"without-proration"}}""",
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

    @Test
    fun `last init error keeps the provider code and message`() {
        val reported = JSONObject(
            GodotIapHelper.lastInitErrorJson(
                OpenIapError.ProviderConfiguration(
                    "No Android store provider registered. Select openiapStore and link its provider artifact.",
                ),
            ),
        )

        assertEquals("developer-error", reported.getString("code"))
        assertEquals(
            "No Android store provider registered. Select openiapStore and link its provider artifact.",
            reported.getString("message"),
        )
    }

    @Test
    fun `missing last init error reads as empty`() {
        assertEquals("", GodotIapHelper.lastInitErrorJson(null))
    }

    @Test
    fun `missing store identity fills from the connected official provider`() {
        mapOf("play" to "google", "horizon" to "horizon", "amazon" to "amazon").forEach { (storeId, store) ->
            val filled = GodotIapHelper.withProviderStoreIdentity(
                mapOf("productId" to "coins", "purchaseToken" to "token"),
            ) { storeId }
            assertEquals(store, filled["store"])
            assertEquals(storeId, filled["storeId"])
            assertEquals("token", PurchaseAndroid.fromJson(filled).purchaseToken)
        }
    }

    @Test
    fun `missing store identity fills community providers as unknown`() {
        val filled = GodotIapHelper.withProviderStoreIdentity(
            mapOf("productId" to "coins", "purchaseToken" to "token"),
        ) { "community-fixture" }
        assertEquals("unknown", filled["store"])
        assertEquals("community-fixture", filled["storeId"])
        assertEquals("token", PurchaseAndroid.fromJson(filled).purchaseToken)
    }

    @Test
    fun `named store identities pass through untouched`() {
        var lookups = 0
        val provider = { lookups += 1; "play" }
        listOf(
            mapOf("store" to "google", "storeId" to "play"),
            mapOf("store" to "google", "storeId" to "horizon"),
            mapOf("store" to "google"),
            mapOf("storeId" to "play"),
        ).forEach { input ->
            assertSame(input, GodotIapHelper.withProviderStoreIdentity(input, provider))
        }
        assertEquals(0, lookups)
        assertThrows(IllegalArgumentException::class.java) {
            PurchaseAndroid.fromJson(mapOf("store" to "google", "storeId" to "horizon"))
        }
    }

    @Test
    fun `unreadable provider leaves identity-less payloads untouched`() {
        val input = mapOf("productId" to "coins")
        assertSame(input, GodotIapHelper.withProviderStoreIdentity(input) { null })
    }

}
