package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class ExternalPurchaseLinkHorizonTest {

    @Test
    fun `unified handler is unavailable without an activity`() {
        val module = OpenIapModule(ContextWrapper(null))
        val request = ExternalPurchaseLinkRequest(url = "https://example.com/checkout")

        val result = runBlocking { module.mutationHandlers.openExternalPurchaseLink!!.invoke(request) }

        assertEquals(ExternalPurchaseLinkStatus.Unavailable, result.status)
    }
}
