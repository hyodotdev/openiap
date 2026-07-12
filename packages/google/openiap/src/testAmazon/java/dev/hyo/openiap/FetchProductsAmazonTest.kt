package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class FetchProductsAmazonTest {

    @Test
    fun `empty sku list with null type throws EmptySkuList`() = runBlocking {
        val module = OpenIapModule(ContextWrapper(null))

        val thrown = try {
            module.fetchProducts(ProductRequest(emptyList(), null))
            null
        } catch (error: Throwable) {
            error
        }

        assertTrue(thrown is OpenIapError.EmptySkuList)
    }

    @Test
    fun `empty sku list with all type throws EmptySkuList`() = runBlocking {
        val module = OpenIapModule(ContextWrapper(null))

        val thrown = try {
            module.fetchProducts(ProductRequest(emptyList(), ProductQueryType.All))
            null
        } catch (error: Throwable) {
            error
        }

        assertTrue(thrown is OpenIapError.EmptySkuList)
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
