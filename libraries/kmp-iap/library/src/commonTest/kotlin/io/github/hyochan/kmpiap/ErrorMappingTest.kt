package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.utils.ErrorCodeUtils
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorMappingTest {
    @Test
    fun historicalReceiptStringsNormalizeToCanonicalCodes() {
        assertEquals(
            ErrorCode.PurchaseVerificationFailed,
            ErrorCodeUtils.fromPlatformCode("E_RECEIPT_FAILED", IapPlatform.Android),
        )
        assertEquals(
            ErrorCode.PurchaseVerificationFinished,
            ErrorCodeUtils.fromPlatformCode("receipt-finished", IapPlatform.Android),
        )
        assertEquals(
            ErrorCode.PurchaseVerificationFinished,
            ErrorCodeUtils.fromPlatformCode("ReceiptFinished", IapPlatform.Android),
        )
        assertEquals(
            ErrorCode.PurchaseVerificationFinishFailed,
            ErrorCodeUtils.fromPlatformCode("RECEIPT_FINISHED_FAILED", IapPlatform.Android),
        )
    }

    @Test
    fun historicalIosNumbersNormalizeToCanonicalCodes() {
        assertEquals(
            ErrorCode.PurchaseVerificationFailed,
            ErrorCodeUtils.fromPlatformCode(5, IapPlatform.Ios),
        )
        assertEquals(
            ErrorCode.PurchaseVerificationFinishFailed,
            ErrorCodeUtils.fromPlatformCode(15, IapPlatform.Ios),
        )
    }
}
