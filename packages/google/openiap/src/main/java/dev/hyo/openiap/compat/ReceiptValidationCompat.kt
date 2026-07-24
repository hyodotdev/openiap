package dev.hyo.openiap.compat

import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseResult
import dev.hyo.openiap.VerifyPurchaseResultIOS

@Deprecated(
    message = "Use VerifyPurchaseProps instead. Scheduled for removal in OpenIAP 3.0.",
    replaceWith = ReplaceWith("VerifyPurchaseProps", "dev.hyo.openiap.VerifyPurchaseProps")
)
typealias ReceiptValidationProps = VerifyPurchaseProps

@Deprecated(
    message = "Use VerifyPurchaseResult instead. Scheduled for removal in OpenIAP 3.0.",
    replaceWith = ReplaceWith("VerifyPurchaseResult", "dev.hyo.openiap.VerifyPurchaseResult")
)
typealias ReceiptValidationResult = VerifyPurchaseResult

@Deprecated(
    message = "Use VerifyPurchaseResultIOS instead. Scheduled for removal in OpenIAP 3.0.",
    replaceWith = ReplaceWith("VerifyPurchaseResultIOS", "dev.hyo.openiap.VerifyPurchaseResultIOS")
)
typealias ReceiptValidationResultIOS = VerifyPurchaseResultIOS
