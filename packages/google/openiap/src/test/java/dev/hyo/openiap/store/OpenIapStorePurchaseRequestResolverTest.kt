package dev.hyo.openiap.store

import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class OpenIapStorePurchaseRequestResolverTest {
    @Test
    fun `canonical google wins across generated purchase union branches`() {
        val purchase = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf("dev.hyo.purchase.google"),
                    ),
                    android = RequestPurchaseAndroidProps(
                        skus = listOf("dev.hyo.purchase.legacy"),
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
                    android = RequestSubscriptionAndroidProps(
                        skus = listOf("dev.hyo.subscription.legacy"),
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
    fun `canonical google payload with no sku suppresses legacy fallback`() {
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(skus = emptyList()),
                    android = RequestPurchaseAndroidProps(
                        skus = listOf("dev.hyo.purchase.legacy"),
                    ),
                ),
            ),
            type = ProductQueryType.InApp,
        )
        val warnings = mutableListOf<String>()

        val sku = OpenIapStorePurchaseRequestResolver.sku(
            props = props,
            legacyWarningKey = "test.${UUID.randomUUID()}",
            warnLegacy = warnings::add,
        )

        assertNull(sku)
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `legacy android works across generated union branches and warns once`() {
        val purchase = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    android = RequestPurchaseAndroidProps(
                        skus = listOf("dev.hyo.purchase.legacy"),
                    ),
                ),
            ),
            type = ProductQueryType.InApp,
        )
        val subscription = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Subscription(
                RequestSubscriptionPropsByPlatforms(
                    android = RequestSubscriptionAndroidProps(
                        skus = listOf("dev.hyo.subscription.legacy"),
                    ),
                ),
            ),
            type = ProductQueryType.Subs,
        )
        val warningKey = "test.${UUID.randomUUID()}"
        val warnings = mutableListOf<String>()

        assertEquals(
            "dev.hyo.purchase.legacy",
            OpenIapStorePurchaseRequestResolver.sku(
                props = purchase,
                legacyWarningKey = warningKey,
                warnLegacy = warnings::add,
            ),
        )
        assertEquals(
            "dev.hyo.subscription.legacy",
            OpenIapStorePurchaseRequestResolver.sku(
                props = subscription,
                legacyWarningKey = warningKey,
                warnLegacy = warnings::add,
            ),
        )

        assertEquals(1, warnings.size)
        assertTrue(warnings.single().contains("`android`"))
        assertTrue(warnings.single().contains("OpenIAP 3.0"))
    }
}
