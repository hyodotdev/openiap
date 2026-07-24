package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ProductSubscriptionIOS
import io.github.hyochan.kmpiap.openiap.SubscriptionBillingPlanTypeIOS
import platform.Foundation.NSNull
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ProductPayloadNormalizerTestIOS {
    @Test
    fun `recovers populated native aliases from empty canonical placeholders`() {
        val payload: Map<Any?, Any?> = mapOf(
            "id" to "premium.monthly",
            "type" to "subs",
            "typeIOS" to "auto-renewable-subscription",
            "subscriptionInfoIOS" to emptyMap<Any?, Any?>(),
            "subscription" to mapOf<Any?, Any?>(
                "subscriptionGroupId" to "group-1",
                "subscriptionPeriod" to mapOf<Any?, Any?>(
                    "unit" to "month",
                    "value" to 1,
                ),
            ),
            "subscriptionOffers" to emptyList<Any?>(),
            "offers" to listOf(
                mapOf<Any?, Any?>(
                    "displayPrice" to "Free",
                    "id" to "intro",
                    "price" to 0.0,
                    "type" to "introductory",
                )
            ),
            "discountsIOS" to emptyList<Any?>(),
            "discounts" to listOf(
                mapOf<Any?, Any?>(
                    "identifier" to "legacy-discount",
                    "numberOfPeriods" to 1,
                    "paymentMode" to "free-trial",
                    "price" to "Free",
                    "priceAmount" to 0.0,
                    "subscriptionPeriod" to "P1M",
                    "type" to "introductory",
                )
            ),
        )

        val normalized = assertNotNull(normalizeProductPayloadIOS(payload))
        val product = ProductSubscriptionIOS.fromJson(normalized)

        assertEquals("group-1", product.subscriptionInfoIOS?.subscriptionGroupId)
        assertEquals("intro", product.subscriptionOffers?.single()?.id)
        assertEquals("legacy-discount", product.discountsIOS?.single()?.identifier)
    }

    @Test
    fun `preserves canonical purchase metadata before generated decoding`() {
        val payload: Map<Any?, Any?> = mapOf(
            "platform" to "ios",
            "store" to "apple",
            "id" to "transaction-1",
            "productId" to "premium.monthly",
            "purchaseState" to "purchased",
            "purchaseToken" to "signed-jws",
            "quantity" to 1,
            "transactionDate" to 1_700_000_000_000.0,
            "advancedCommerceInfoIOS" to mapOf<Any?, Any?>(
                "items" to emptyList<Any?>(),
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
        assertEquals(SubscriptionBillingPlanTypeIOS.Monthly, purchase.billingPlanTypeIOS)
        assertEquals(12, purchase.commitmentInfoIOS?.totalBillingPeriods)
        assertEquals("monthly-plan", purchase.currentPlanId)
        assertEquals("offer-id", purchase.offerIOS?.id)
        assertEquals("premium.yearly", purchase.renewalInfoIOS?.pendingUpgradeProductId)
    }

    @Test
    fun `adds legacy purchase defaults without overwriting canonical values`() {
        val normalized = assertNotNull(
            normalizePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "platform" to NSNull(),
                    "store" to "apple",
                    "quantity" to NSNull(),
                    "renewalInfoIOS" to mapOf<Any?, Any?>(
                        "pendingUpgradeProductId" to NSNull(),
                    ),
                )
            )
        )

        assertEquals("ios", normalized["platform"])
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
                "platform" to "android",
                "id" to "purchase-token",
            )
        )

        assertEquals(null, purchase)
    }

    @Test
    fun `canonicalizes legacy iOS discriminator casing before generated decoding`() {
        val purchase = assertNotNull(
            decodePurchasePayloadIOS(
                mapOf<Any?, Any?>(
                    "platform" to "iOS",
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
}
