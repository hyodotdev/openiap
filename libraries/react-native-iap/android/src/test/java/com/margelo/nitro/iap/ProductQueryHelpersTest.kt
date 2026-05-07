package com.margelo.nitro.iap

import dev.hyo.openiap.IapPlatform
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductCommon
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductType
import java.util.Collections
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class ProductQueryHelpersTest {
    @Test
    fun `all query starts in-app and subs fetches concurrently`() = runBlocking {
        val startedKinds = Collections.synchronizedSet(mutableSetOf<ProductQueryType>())
        val bothStarted = CompletableDeferred<Unit>()

        val products = withTimeout(1000) {
            collectAllQueryProducts(
                skusList = listOf("monthly", "lifetime"),
                fetchKind = { kind ->
                    when (kind) {
                        ProductQueryType.InApp,
                        ProductQueryType.Subs -> {
                            startedKinds.add(kind)
                            if (startedKinds.size == 2) {
                                bothStarted.complete(Unit)
                            }
                            bothStarted.await()

                            when (kind) {
                                ProductQueryType.InApp -> listOf(
                                    fakeProduct("lifetime", ProductType.InApp),
                                )
                                ProductQueryType.Subs -> listOf(
                                    fakeProduct("monthly", ProductType.Subs),
                                )
                                ProductQueryType.All -> error("All should be expanded by the helper")
                            }
                        }
                        ProductQueryType.All -> error("All should be expanded by the helper")
                    }
                },
            )
        }

        assertEquals(setOf(ProductQueryType.InApp, ProductQueryType.Subs), startedKinds.toSet())
        assertEquals(listOf("monthly", "lifetime"), products.map { it.id })
    }

    @Test
    fun `all query returns partial success when one product kind fails`() = runBlocking {
        val queryError = OpenIapError.BillingError("Invalid subscriptions")
        val failures = mutableListOf<Pair<ProductQueryType, Throwable>>()

        val products = collectAllQueryProducts(
            skusList = listOf("monthly", "lifetime"),
            fetchKind = { kind ->
                when (kind) {
                    ProductQueryType.InApp -> listOf(fakeProduct("lifetime", ProductType.InApp))
                    ProductQueryType.Subs -> throw queryError
                    ProductQueryType.All -> error("All should be expanded by the helper")
                }
            },
            onFailure = { kind, error -> failures += kind to error },
        )

        assertEquals(listOf("lifetime"), products.map { it.id })
        assertEquals(listOf(ProductQueryType.Subs), failures.map { it.first })
        assertSame(queryError, failures.single().second)
    }

    @Test
    fun `all query rethrows first failure when both product kinds fail`() = runBlocking {
        val firstError = OpenIapError.BillingError("Invalid in-app products")
        val secondError = OpenIapError.BillingError("Service unavailable")
        val failures = mutableListOf<ProductQueryType>()

        try {
            collectAllQueryProducts(
                skusList = listOf("monthly", "lifetime"),
                fetchKind = { kind ->
                    when (kind) {
                        ProductQueryType.InApp -> throw firstError
                        ProductQueryType.Subs -> throw secondError
                        ProductQueryType.All -> error("All should be expanded by the helper")
                    }
                },
                onFailure = { kind, _ -> failures += kind },
            )
        } catch (error: Throwable) {
            assertSame(firstError, error)
            assertEquals(listOf(ProductQueryType.InApp, ProductQueryType.Subs), failures)
            return@runBlocking
        }

        error("Expected the first product query failure to be rethrown")
    }

    @Test
    fun `all query preserves input sku order and keeps first matching product`() = runBlocking {
        val products = collectAllQueryProducts(
            skusList = listOf("monthly", "lifetime", "annual"),
            fetchKind = { kind ->
                when (kind) {
                    ProductQueryType.InApp -> listOf(
                        fakeProduct("lifetime", ProductType.InApp),
                        fakeProduct("monthly", ProductType.InApp),
                    )
                    ProductQueryType.Subs -> listOf(
                        fakeProduct("monthly", ProductType.Subs),
                        fakeProduct("annual", ProductType.Subs),
                    )
                    ProductQueryType.All -> error("All should be expanded by the helper")
                }
            },
        )

        assertEquals(listOf("monthly", "lifetime", "annual"), products.map { it.id })
        assertEquals(ProductType.InApp, products[0].type)
    }

    private fun fakeProduct(productId: String, type: ProductType): ProductCommon =
        object : ProductCommon {
            override val currency: String = "USD"
            override val debugDescription: String? = null
            override val description: String = productId
            override val displayName: String? = productId
            override val displayPrice: String = "$1.00"
            override val id: String = productId
            override val platform: IapPlatform = IapPlatform.Android
            override val price: Double? = 1.0
            override val title: String = productId
            override val type: ProductType = type
        }
}
