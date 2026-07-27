package dev.hyo.openiap.store

import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OpenIapStorePurchaseRequestResolverTest {
    @Test
    fun `google resolves across generated purchase union branches`() {
        val purchase = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf("dev.hyo.purchase.google"),
                    ),
                ),
            ),
            type = ProductQueryType.InApp,
        )
        val subscription = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Subscription(
                RequestSubscriptionPropsByPlatforms(
                    google = RequestSubscriptionAndroidProps(
                        skus = listOf("dev.hyo.subscription.google"),
                    ),
                ),
            ),
            type = ProductQueryType.Subs,
        )

        assertEquals(
            "dev.hyo.purchase.google",
            OpenIapStorePurchaseRequestResolver.sku(purchase),
        )
        assertEquals(
            "dev.hyo.subscription.google",
            OpenIapStorePurchaseRequestResolver.sku(subscription),
        )
    }

    @Test
    fun `google payload with no sku resolves to null`() {
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(skus = emptyList()),
                ),
            ),
            type = ProductQueryType.InApp,
        )
        assertNull(OpenIapStorePurchaseRequestResolver.sku(props))
    }
}
