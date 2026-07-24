// Compatibility aliases for legacy receipt validation APIs
// These map old ReceiptValidation* names to the new VerifyPurchase* types.

@available(*, deprecated, message: "Use VerifyPurchaseProps instead. Scheduled for removal in OpenIAP 3.0.")
public typealias ReceiptValidationProps = VerifyPurchaseProps

@available(*, deprecated, message: "Use VerifyPurchaseResult instead. Scheduled for removal in OpenIAP 3.0.")
public typealias ReceiptValidationResult = VerifyPurchaseResult

@available(*, deprecated, message: "Use VerifyPurchaseResultIOS instead. Scheduled for removal in OpenIAP 3.0.")
public typealias ReceiptValidationResultIOS = VerifyPurchaseResultIOS
