package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionIOS
import io.github.hyochan.kmpiap.openiap.SubscriptionBillingPlanTypeIOS
import io.github.hyochan.kmpiap.openiap.SubscriptionPeriodIOS
import platform.Foundation.NSNull
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class ProductPayloadNormalizerTestIOS {
    private fun validPurchase(id: String = "transaction-1"): Map<String, Any?> = mapOf(
        "store" to "apple",
        "id" to id,
        "productId" to "premium.monthly",
        "purchaseState" to "purchased",
        "quantity" to 1,
        "transactionDate" to 1_700_000_000_000.0,
        "transactionId" to id,
        "isAutoRenewing" to true,
    )

    private fun validActiveSubscription(id: String = "transaction-1"): Map<String, Any?> = mapOf(
        "productId" to "premium.monthly",
        "isActive" to true,
        "transactionId" to id,
        "transactionDate" to 1_700_000_000_000.0,
    )

    @Test
    fun `strict purchase list preserves explicit empty result`() {
        assertEquals(emptyList(), decodePurchaseListPayloadIOS(emptyList<Any?>()))
    }

    @Test
    fun `strict purchase list rejects non-list and mixed malformed payloads`() {
        val nonList = assertFailsWith<PurchaseException> {
            decodePurchaseListPayloadIOS(null)
        }
        assertEquals(ErrorCode.BillingResponseJsonParseError, nonList.error.code)

        val mixed = assertFailsWith<PurchaseException> {
            decodePurchaseListPayloadIOS(listOf(validPurchase(), "invalid"))
        }
        assertEquals(ErrorCode.BillingResponseJsonParseError, mixed.error.code)
    }

    @Test
    fun `strict purchase list rejects malformed optional objects`() {
        val malformed = validPurchase().toMutableMap().apply {
            this["advancedCommerceInfoIOS"] = mapOf(
                "items" to listOf("not-an-object")
            )
        }

        val error = assertFailsWith<PurchaseException> {
            decodePurchaseListPayloadIOS(listOf(malformed))
        }
        assertEquals(ErrorCode.BillingResponseJsonParseError, error.error.code)
    }

    @Test
    fun `strict active subscription list rejects partial and malformed payloads`() {
        assertEquals(
            emptyList(),
            decodeActiveSubscriptionListPayloadIOS(emptyList<Any?>()),
        )

        val mixed = assertFailsWith<PurchaseException> {
            decodeActiveSubscriptionListPayloadIOS(
                listOf(validActiveSubscription(), mapOf("productId" to "broken"))
            )
        }
        assertEquals(ErrorCode.BillingResponseJsonParseError, mixed.error.code)

        val invalidRenewalInfo = assertFailsWith<PurchaseException> {
            decodeActiveSubscriptionListPayloadIOS(
                listOf(validActiveSubscription() + ("renewalInfoIOS" to "invalid"))
            )
        }
        assertEquals(
            ErrorCode.BillingResponseJsonParseError,
            invalidRenewalInfo.error.code,
        )
    }

    @Test
    fun `strict active subscription list filters only after complete decoding`() {
        val other = validActiveSubscription("transaction-2") +
            ("productId" to "premium.yearly")
        val result = decodeActiveSubscriptionListPayloadIOS(
            listOf(validActiveSubscription(), other),
            listOf("premium.yearly"),
        )

        assertEquals(listOf("premium.yearly"), result.map { it.productId })
    }

    @Test
    fun `strict purchase list rejects generated decoder defaults and lossy arrays`() {
        val malformedPayloads = listOf(
            validPurchase().minus("store"),
            validPurchase().minus("id"),
            validPurchase().minus("transactionId"),
            validPurchase().minus("productId"),
            validPurchase().minus("isAutoRenewing"),
            validPurchase().minus("purchaseState"),
            validPurchase().minus("transactionDate"),
            validPurchase().minus("quantity"),
            validPurchase().plus("quantity" to 1.5),
            validPurchase().plus("ids" to listOf("transaction-1", 2)),
            validPurchase().plus("offerIOS" to "not-an-object"),
        )

        malformedPayloads.forEach { payload ->
            val error = assertFailsWith<PurchaseException> {
                decodePurchaseListPayloadIOS(listOf(payload))
            }
            assertEquals(ErrorCode.BillingResponseJsonParseError, error.error.code)
        }
    }

    @Test
    fun `recovers native offers from an empty canonical placeholder`() {
        val payload: Map<Any?, Any?> = mapOf(
            "id" to "premium.monthly",
            "type" to "subs",
            "typeIOS" to "auto-renewable-subscription",
            "subscriptionGroupIdIOS" to "group-1",
            "subscriptionOffers" to emptyList<Any?>(),
            "offers" to listOf(
                mapOf<Any?, Any?>(
                    "displayPrice" to "Free",
                    "id" to "intro",
                    "price" to 0.0,
                    "type" to "introductory",
                )
            ),
        )

        val normalized = assertNotNull(normalizeProductPayloadIOS(payload))
        val product = ProductSubscriptionIOS.fromJson(normalized)

        assertEquals("group-1", product.subscriptionGroupIdIOS)
        assertEquals("intro", product.subscriptionOffers?.single()?.id)
    }

    @Test
    fun `preserves canonical purchase metadata before generated decoding`() {
        val payload: Map<Any?, Any?> = mapOf(
            "store" to "apple",
            "id" to "transaction-1",
            "productId" to "premium.monthly",
            "purchaseState" to "purchased",
            "purchaseToken" to "signed-jws",
            "quantity" to 1,
            "transactionDate" to 1_700_000_000_000.0,
            "advancedCommerceInfoIOS" to mapOf<Any?, Any?>(
                "items" to emptyList<Any?>(),
                "period" to mapOf(
                    "unit" to "month",
                    "value" to 1,
                ),
                "requestReferenceId" to "request-reference",
            ),
            "billingPlanTypeIOS" to "monthly",
            "commitmentInfoIOS" to mapOf<Any?, Any?>(
                "billingPeriodNumber" to 2,
                "commitmentExpiresDate" to 1_800_000_000_000.0,
                "commitmentPrice" to 9.99,
                "totalBillingPeriods" to 12,
            ),
            "currentPlanId" to "monthly-plan",
            "isAutoRenewing" to true,
            "offerIOS" to mapOf<Any?, Any?>(
                "id" to "offer-id",
                "paymentMode" to "pay-as-you-go",
                "type" to "promotional",
            ),
            "renewalInfoIOS" to mapOf<Any?, Any?>(
                "pendingUpgradeProductId" to "premium.yearly",
                "willAutoRenew" to true,
            ),
        )

        val purchase = assertNotNull(decodePurchasePayloadIOS(payload))

        assertEquals("request-reference", purchase.advancedCommerceInfoIOS?.requestReferenceId)
        assertEquals(SubscriptionPeriodIOS.Month, purchase.advancedCommerceInfoIOS?.period?.unit)
        assertEquals(1, purchase.advancedCommerceInfoIOS?.period?.value)
        assertEquals(SubscriptionBillingPlanTypeIOS.Monthly, purchase.billingPlanTypeIOS)
        assertEquals(12, purchase.commitmentInfoIOS?.totalBillingPeriods)
        assertEquals("monthly-plan", purchase.currentPlanId)
        assertEquals("offer-id", purchase.offerIOS?.id)
        assertEquals("premium.yearly", purchase.renewalInfoIOS?.pendingUpgradeProductId)
    }

    @Test
    fun `adds native purchase defaults without restoring removed platform`() {
        val normalized = assertNotNull(
            normalizePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "store" to "apple",
                    "quantity" to NSNull(),
                    "renewalInfoIOS" to mapOf<Any?, Any?>(
                        "pendingUpgradeProductId" to NSNull(),
                    ),
                )
            )
        )

        assertEquals(false, normalized.containsKey("platform"))
        assertEquals("apple", normalized["store"])
        assertEquals(1, normalized["quantity"])
        assertEquals(
            null,
            (normalized["renewalInfoIOS"] as Map<*, *>)["pendingUpgradeProductId"],
        )
    }

    @Test
    fun `does not decode a non iOS purchase payload`() {
        val purchase = decodePurchasePayloadIOS(
            mapOf<Any?, Any?>(
                "store" to "google",
                "id" to "purchase-token",
                "transactionId" to "order-id",
                "productId" to "premium.monthly",
                "purchaseState" to "purchased",
                "quantity" to 1,
                "transactionDate" to 1_700_000_000_000.0,
            )
        )

        assertEquals(null, purchase)
    }

    @Test
    fun `canonicalizes native Apple store casing before generated decoding`() {
        val purchase = assertNotNull(
            decodePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "store" to "Apple",
                    "id" to "transaction-legacy",
                    "productId" to "premium.monthly",
                    "purchaseState" to "purchased",
                    "quantity" to 1,
                    "transactionDate" to 1_700_000_000_000.0,
                    "transactionId" to "transaction-legacy",
                )
            )
        )

        assertEquals("transaction-legacy", purchase.id)
    }

    @Test
    fun `keeps purchase when optional advanced commerce payload is malformed`() {
        val purchase = assertNotNull(
            decodePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "store" to "apple",
                    "id" to "transaction-1",
                    "productId" to "premium.monthly",
                    "purchaseState" to "purchased",
                    "quantity" to 1,
                    "transactionDate" to 1_700_000_000_000.0,
                    "transactionId" to "transaction-1",
                    "advancedCommerceInfoIOS" to mapOf<Any?, Any?>(
                        "items" to listOf("not-an-object"),
                    ),
                    "renewalInfoIOS" to mapOf<Any?, Any?>(
                        "pendingUpgradeProductId" to "premium.yearly",
                        "willAutoRenew" to true,
                    ),
                )
            )
        )

        assertEquals(null, purchase.advancedCommerceInfoIOS)
        assertEquals("premium.yearly", purchase.renewalInfoIOS?.pendingUpgradeProductId)
    }

    @Test
    fun `recovers native purchase identity and quantity labels`() {
        val purchase = assertNotNull(
            decodePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "id" to "transaction-legacy",
                    "productId" to "premium.monthly",
                    "purchaseState" to "purchased",
                    "quantityIOS" to 2,
                    "transactionDate" to 1_700_000_000_000.0,
                )
            )
        )

        assertEquals("transaction-legacy", purchase.transactionId)
        assertEquals(2, purchase.quantity)
    }

    @Test
    fun `rejects purchase payload without core identity`() {
        val purchase = decodePurchasePayloadIOS(
            mapOf<Any?, Any?>(
                "store" to "apple",
                "productId" to "premium.monthly",
                "purchaseState" to "purchased",
            )
        )

        assertEquals(null, purchase)
    }
}
