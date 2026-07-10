package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ProductType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeveloperProvidedBillingReflectionTest {
    @Test
    fun `billing 8_3 details emit even without external transaction token`() {
        val details = extractDeveloperProvidedBillingDetails(
            Billing83LikeDetails(
                linkUri = "https://example.com/checkout",
                originalExternalTransactionId = "external-123",
                products = listOf(
                    Billing83LikeProduct(
                        id = "monthly",
                        offerToken = "offer-123",
                        type = "subs"
                    )
                )
            )
        )

        assertNull(details.externalTransactionToken)
        assertEquals("https://example.com/checkout", details.linkUri)
        assertEquals("external-123", details.originalExternalTransactionId)
        assertEquals(1, details.products.size)
        assertEquals("monthly", details.products.single().id)
        assertEquals("offer-123", details.products.single().offerToken)
        assertEquals(ProductType.Subs, details.products.single().type)
    }

    @Test
    fun `missing optional detail getters do not suppress available fields`() {
        val details = extractDeveloperProvidedBillingDetails(TokenOnlyDetails("token-123"))

        assertEquals("token-123", details.externalTransactionToken)
        assertNull(details.linkUri)
        assertNull(details.originalExternalTransactionId)
        assertEquals(emptyList(), details.products)
    }
}

internal class Billing83LikeDetails(
    private val linkUri: String,
    private val originalExternalTransactionId: String,
    private val products: List<Billing83LikeProduct>
) {
    fun getLinkUri(): String = linkUri
    fun getOriginalExternalTransactionId(): String = originalExternalTransactionId
    fun getProducts(): List<Billing83LikeProduct> = products
}

internal class Billing83LikeProduct(
    private val id: String,
    private val offerToken: String,
    private val type: String
) {
    fun getId(): String = id
    fun getOfferToken(): String = offerToken
    fun getType(): String = type
}

internal class TokenOnlyDetails(private val token: String) {
    fun getExternalTransactionToken(): String = token
}
