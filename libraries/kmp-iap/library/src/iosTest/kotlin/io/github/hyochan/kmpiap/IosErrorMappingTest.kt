package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlin.test.Test
import kotlin.test.assertEquals
import platform.Foundation.NSError

class IosErrorMappingTest {
    @Test
    fun testNSErrorUserInfoMapsToPurchaseException() {
        val error = NSError.errorWithDomain(
            domain = "OpenIAP",
            code = -1,
            userInfo = mapOf(
                "code" to "user-cancelled",
                "message" to "Request Canceled",
                "productId" to "premium_monthly",
                "debugMessage" to "StoreKit cancellation"
            )
        )

        val exception = error.toPurchaseException()

        assertEquals(ErrorCode.UserCancelled, exception.error.code)
        assertEquals("Request Canceled", exception.error.message)
        assertEquals("premium_monthly", exception.error.productId)
        assertEquals("StoreKit cancellation", exception.error.debugMessage)
    }

    @Test
    fun testNSErrorCodeFallback() {
        val error = NSError.errorWithDomain(
            domain = "OpenIAP",
            code = -1,
            userInfo = mapOf("message" to "Native failure")
        )

        val exception = error.toPurchaseException(ErrorCode.ServiceError)

        assertEquals(ErrorCode.ServiceError, exception.error.code)
        assertEquals("Native failure", exception.error.message)
    }
}
