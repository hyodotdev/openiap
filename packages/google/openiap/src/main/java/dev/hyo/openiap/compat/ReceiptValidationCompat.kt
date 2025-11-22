package dev.hyo.openiap.compat

import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseResult
import dev.hyo.openiap.VerifyPurchaseResultIOS

@Deprecated(
    message = "Use VerifyPurchaseProps instead",
    replaceWith = ReplaceWith("VerifyPurchaseProps", "dev.hyo.openiap.VerifyPurchaseProps")
)
typealias ReceiptValidationProps = VerifyPurchaseProps

@Deprecated(
    message = "Use VerifyPurchaseResult instead",
    replaceWith = ReplaceWith("VerifyPurchaseResult", "dev.hyo.openiap.VerifyPurchaseResult")
)
typealias ReceiptValidationResult = VerifyPurchaseResult

@Deprecated(
    message = "Use VerifyPurchaseResultIOS instead",
    replaceWith = ReplaceWith("VerifyPurchaseResultIOS", "dev.hyo.openiap.VerifyPurchaseResultIOS")
)
typealias ReceiptValidationResultIOS = VerifyPurchaseResultIOS
