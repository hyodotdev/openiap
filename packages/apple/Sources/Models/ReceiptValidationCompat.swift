// Compatibility aliases for legacy receipt validation APIs
// These map old ReceiptValidation* names to the new VerifyPurchase* types.

@available(*, deprecated, message: "Use VerifyPurchaseProps instead")
public typealias ReceiptValidationProps = VerifyPurchaseProps

@available(*, deprecated, message: "Use VerifyPurchaseResult instead")
public typealias ReceiptValidationResult = VerifyPurchaseResult

@available(*, deprecated, message: "Use VerifyPurchaseResultIOS instead")
public typealias ReceiptValidationResultIOS = VerifyPurchaseResultIOS
