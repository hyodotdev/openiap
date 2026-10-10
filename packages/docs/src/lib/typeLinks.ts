// Identifier → Type doc page slug. Used by `linkifyType` so capitalized
// identifiers (Swift/Kotlin/Dart/GDScript class-name tokens, TypeScript
// type references) render as clickable anchors that jump to the matching
// `/docs/types/...` page. Add new entries here when a new type page ships.
export const TYPE_LINKS: Record<string, string> = {
  // Cross-platform
  ActiveSubscription: '/docs/types/active-subscription',
  AlternativeBillingTypes: '/docs/types/alternative-billing-types',
  BillingChoiceImageLayoutAndroid: '/docs/types/billing-programs',
  BillingChoiceInfoAndroid: '/docs/types/billing-programs',
  BillingChoiceScreenTypeAndroid: '/docs/types/billing-programs',
  BillingProgramAndroid: '/docs/types/billing-programs',
  BillingProgramAvailabilityResultAndroid: '/docs/types/billing-programs',
  BillingProgramInformationDialogParamsAndroid: '/docs/types/billing-programs',
  BillingProgramReportingDetailsAndroid: '/docs/types/billing-programs',
  BillingResultAndroid: '/docs/types/billing-programs',
  DeveloperBillingTypeAndroid: '/docs/types/billing-programs',
  DeepLinkOptions: '/docs/types#common',
  DiscountOffer: '/docs/types/discount-offer',
  ExternalPurchaseLinkResultIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseNoticeResultIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkNoticeResultIOS:
    '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkTokenResultIOS:
    '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkNoticeTypeIOS: '/docs/types/external-purchase-link',
  ExternalPurchaseCustomLinkTokenTypeIOS: '/docs/types/external-purchase-link',
  FetchProductsResult: '/docs/types/product-request',
  InitConnectionConfig:
    '/docs/types/alternative-billing-types#init-connection-config',
  GetBillingChoiceInfoParamsAndroid: '/docs/types/billing-programs',
  InAppMessageCategoryAndroid: '/docs/types/billing-programs',
  InAppMessageParamsAndroid: '/docs/types/billing-programs',
  InAppMessageResponseCodeAndroid: '/docs/types/billing-programs',
  InAppMessageResultAndroid: '/docs/types/billing-programs',
  IapkitClientPayloadFormat:
    '/docs/types/verify-purchase-with-provider-result#iapkit-product-client-payload',
  IapkitProductClientPayload:
    '/docs/types/verify-purchase-with-provider-result#iapkit-product-client-payload',
  LaunchExternalLinkParamsAndroid: '/docs/types/billing-programs',
  Product: '/docs/types/product',
  ProductAndroid: '/docs/types/product',
  ProductIOS: '/docs/types/product',
  ProductOrSubscription: '/docs/types/product',
  ProductQueryType: '/docs/types/product-request',
  ProductRequest: '/docs/types/product-request',
  ProductSubscription: '/docs/types/subscription-product',
  ProductSubscriptionAndroid: '/docs/types/subscription-product',
  ProductSubscriptionIOS: '/docs/types/subscription-product',
  Purchase: '/docs/types/purchase',
  PurchaseAndroid: '/docs/types/purchase',
  PurchaseIOS: '/docs/types/purchase',
  PurchaseInput: '/docs/types/purchase',
  PurchaseOptions: '/docs/types/purchase',
  PurchaseVerificationProvider:
    '/docs/types/verify-purchase-with-provider-props',
  RequestPurchaseAndroidProps: '/docs/types/request-purchase-props',
  RequestPurchaseIosProps: '/docs/types/request-purchase-props',
  RequestPurchaseProps: '/docs/types/request-purchase-props',
  RequestPurchasePropsByPlatforms: '/docs/types/request-purchase-props',
  RequestPurchaseResult: '/docs/types/request-purchase-props',
  RequestVerifyPurchaseWithIapkitProps:
    '/docs/types/verify-purchase-with-provider-props#request-verify-purchase-with-iapkit-props',
  RequestVerifyPurchaseWithIapkitResult:
    '/docs/types/verify-purchase-with-provider-result#request-verify-purchase-with-iapkit-result',
  RequestSubscriptionPropsByPlatforms: '/docs/types/request-purchase-props',
  Storefront: '/docs/types/storefront',
  SubscriptionOffer: '/docs/types/subscription-offer',
  SubscriptionProduct: '/docs/types/subscription-product',
  VerifyPurchase: '/docs/types/verify-purchase',
  VerifyPurchaseProps: '/docs/types/verify-purchase',
  VerifyPurchaseResult: '/docs/types/verify-purchase',
  VerifyPurchaseResultAndroid: '/docs/types/verify-purchase',
  VerifyPurchaseResultHorizon: '/docs/types/verify-purchase',
  VerifyPurchaseResultIOS: '/docs/types/verify-purchase',
  VerifyPurchaseWithProviderProps:
    '/docs/types/verify-purchase-with-provider-props',
  VerifyPurchaseWithProviderResult:
    '/docs/types/verify-purchase-with-provider-result',
  VoidResult: '/docs/types#common',
  // iOS-only
  AppTransaction: '/docs/types/ios/app-transaction-ios',
  AppTransactionIOS: '/docs/types/ios/app-transaction-ios',
  PaymentMode: '/docs/types/ios/payment-mode-ios',
  PaymentModeIOS: '/docs/types/ios/payment-mode-ios',
  RenewalInfo: '/docs/types/ios/renewal-info-ios',
  RenewalInfoIOS: '/docs/types/ios/renewal-info-ios',
  RenewalCommitmentInfoIOS:
    '/docs/types/ios/subscription-billing-plan-ios#renewal-commitment-info-ios',
  SubscriptionBillingPlanTypeIOS:
    '/docs/types/ios/subscription-billing-plan-ios#subscription-billing-plan-type-ios',
  SubscriptionCommitmentInfoIOS:
    '/docs/types/ios/subscription-billing-plan-ios#subscription-commitment-info-ios',
  SubscriptionPeriod: '/docs/types/ios/subscription-period-ios',
  SubscriptionPeriodIOS: '/docs/types/ios/subscription-period-ios',
  SubscriptionPricingTermsIOS:
    '/docs/types/ios/subscription-billing-plan-ios#subscription-pricing-terms-ios',
  SubscriptionStatus: '/docs/types/ios/subscription-status-ios',
  SubscriptionStatusIOS: '/docs/types/ios/subscription-status-ios',
  TransactionCommitmentInfoIOS:
    '/docs/types/ios/subscription-billing-plan-ios#transaction-commitment-info-ios',
  // Android-only
  PricingPhaseAndroid: '/docs/types/android/pricing-phase-android',
};
