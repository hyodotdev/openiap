package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.PurchaseError
import kotlin.test.Test
import kotlin.test.assertEquals

class ExamplePurchaseFlowTest {
    @Test fun purchaseErrorTextListsCodeMessageAndDebugMessage() {
        val cancelled = PurchaseError(code = ErrorCode.UserCancelled, message = "Cancelled")
        assertEquals(
            "⚠️ Purchase cancelled by user\nCode: user-cancelled\nMessage: Cancelled",
            cancelled.resultText("Purchase"),
        )
        assertEquals(
            "❌ Subscription failed\nCode: service-error\nMessage: Unavailable\nDebug: Response code 2",
            cancelled.copy(code = ErrorCode.ServiceError, message = "Unavailable", debugMessage = "Response code 2")
                .resultText("Subscription"),
        )
    }
}
