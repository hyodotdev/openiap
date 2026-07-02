package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class FetchProductsAmazonTest {

    @Test
    fun `empty sku list with null type returns empty all result`() = runBlocking {
        val module = OpenIapModule(ContextWrapper(null))

        val result = module.fetchProducts(ProductRequest(emptyList(), null))

        assertTrue(result is FetchProductsResultAll)
        assertTrue((result as FetchProductsResultAll).value.orEmpty().isEmpty())
    }

    @Test
    fun `empty sku list with all type returns empty all result`() = runBlocking {
        val module = OpenIapModule(ContextWrapper(null))

        val result = module.fetchProducts(ProductRequest(emptyList(), ProductQueryType.All))

        assertTrue(result is FetchProductsResultAll)
        assertTrue((result as FetchProductsResultAll).value.orEmpty().isEmpty())
    }

    @Test
    fun `empty sku list with product type throws EmptySkuList`() = runBlocking {
        val module = OpenIapModule(ContextWrapper(null))

        val thrown = runCatching {
            module.fetchProducts(ProductRequest(emptyList(), ProductQueryType.InApp))
        }.exceptionOrNull()

        assertTrue(thrown is OpenIapError.EmptySkuList)
    }
}
