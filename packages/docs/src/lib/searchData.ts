export interface ApiItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  parameters?: string;
  returns?: string;
  path: string;
}

export const apiData: ApiItem[] = [
  // Connection Management
  {
    id: 'init-connection',
    title: 'initConnection',
    category: 'Connection',
    description: 'Initialize connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/init-connection',
  },
  {
    id: 'end-connection',
    title: 'endConnection',
    category: 'Connection',
    description: 'End connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/end-connection',
  },

  // Product Management
  {
    id: 'fetch-products',
    title: 'fetchProducts',
    category: 'Products',
    description: 'Retrieve products or subscriptions from the store',
    parameters: 'ProductRequest',
    returns: '[Product!]!',
    path: '/docs/apis/fetch-products',
  },
  {
    id: 'get-available-purchases',
    title: 'getAvailablePurchases',
    category: 'Products',
    description: 'Get all available purchases for the current user',
    parameters: 'PurchaseOptions?',
    returns: '[Purchase!]!',
    path: '/docs/apis/get-available-purchases',
  },

  // Purchase Operations
  {
    id: 'request-purchase',
    title: 'requestPurchase',
    category: 'Purchase',
    description: 'Request a purchase (one-time or subscription)',
    parameters: 'RequestPurchaseProps',
    returns: 'Purchase!',
    path: '/docs/apis/request-purchase',
  },
  {
    id: 'finish-transaction',
    title: 'finishTransaction',
    category: 'Purchase',
    description:
      'Complete a purchase transaction. Must be called after successful verification',
    parameters: 'Purchase!, isConsumable: Boolean?',
    returns: 'Void',
    path: '/docs/apis/finish-transaction',
  },
  {
    id: 'restore-purchases',
    title: 'restorePurchases',
    category: 'Purchase',
    description: 'Restore completed transactions (cross-platform)',
    parameters: '',
    returns: 'Void',
    path: '/docs/apis/restore-purchases',
  },
  {
    id: 'get-storefront',
    title: 'getStorefront',
    category: 'Purchase',
    description: 'Get storefront country code for the active user',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis/get-storefront',
  },

  // Subscription Management
  {
    id: 'get-active-subscriptions',
    title: 'getActiveSubscriptions',
    category: 'Subscription',
    description: 'Get all active subscriptions with detailed information',
    parameters: 'subscriptionIds: [String]?',
    returns: '[ActiveSubscription!]!',
    path: '/docs/apis/get-active-subscriptions',
  },
  {
    id: 'has-active-subscriptions',
    title: 'hasActiveSubscriptions',
    category: 'Subscription',
    description: 'Check if the user has any active subscriptions',
    parameters: 'subscriptionIds: [String]?',
    returns: 'Boolean!',
    path: '/docs/apis/has-active-subscriptions',
  },
  {
    id: 'deep-link-to-subscriptions',
    title: 'deepLinkToSubscriptions',
    category: 'Subscription',
    description: 'Open native subscription management interface',
    parameters: 'DeepLinkOptions',
    returns: 'Void',
    path: '/docs/apis/deep-link-to-subscriptions',
  },

  // Verification
  {
    id: 'verify-purchase',
    title: 'verifyPurchase',
    category: 'Validation',
    description: 'Verify purchases with your server or platform providers',
    parameters: 'PurchaseVerificationProps!',
    returns: 'PurchaseVerificationResult!',
    path: '/docs/features/validation#verify-purchase',
  },
  {
    id: 'verify-purchase-with-provider',
    title: 'verifyPurchaseWithProvider',
    category: 'Validation',
    description: 'Verify purchases using IAPKit or other providers',
    parameters: 'VerifyPurchaseWithProviderProps!',
    returns: 'VerifyPurchaseWithProviderResult!',
    path: '/docs/features/validation#verify-purchase-with-provider',
  },
  {
    id: 'validate-receipt',
    title: 'validateReceipt',
    category: 'Validation',
    description:
      'Deprecated. Use verifyPurchase instead. Cross-platform receipt validation entry point.',
    parameters: 'options: ReceiptValidationProps!',
    returns: 'ReceiptValidationResult!',
    path: '/docs/apis/validate-receipt',
  },

  // iOS Specific
  {
    id: 'clear-transaction-ios',
    title: 'clearTransactionIOS',
    category: 'iOS Specific',
    description: 'Clear pending transactions',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/clear-transaction-ios',
  },
  {
    id: 'sync-ios',
    title: 'syncIOS',
    category: 'iOS Specific',
    description: 'Force StoreKit transaction sync (iOS 15+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/sync-ios',
  },
  {
    id: 'get-promoted-product-ios',
    title: 'getPromotedProductIOS',
    category: 'iOS Specific',
    description: 'Get the currently promoted product (iOS 11+)',
    parameters: '',
    returns: 'ProductIOS',
    path: '/docs/apis/ios/get-promoted-product-ios',
  },
  {
    id: 'request-purchase-on-promoted-product-ios',
    title: 'requestPurchaseOnPromotedProductIOS',
    category: 'iOS Specific',
    description: 'Purchase a promoted product (iOS 11+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/request-purchase-on-promoted-product-ios',
  },
  {
    id: 'get-pending-transactions-ios',
    title: 'getPendingTransactionsIOS',
    category: 'iOS Specific',
    description: 'Retrieve pending StoreKit transactions',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis/ios/get-pending-transactions-ios',
  },
  {
    id: 'is-eligible-for-intro-offer-ios',
    title: 'isEligibleForIntroOfferIOS',
    category: 'iOS Specific',
    description: 'Check introductory offer eligibility',
    parameters: 'groupID: String!',
    returns: 'Boolean!',
    path: '/docs/apis/ios/is-eligible-for-intro-offer-ios',
  },
  {
    id: 'subscription-status-ios',
    title: 'subscriptionStatusIOS',
    category: 'iOS Specific',
    description: 'Get StoreKit 2 subscription status (iOS 15+)',
    parameters: 'sku: String!',
    returns: '[SubscriptionStatusIOS!]!',
    path: '/docs/apis/ios/subscription-status-ios',
  },
  {
    id: 'current-entitlement-ios',
    title: 'currentEntitlementIOS',
    category: 'iOS Specific',
    description: 'Get current StoreKit 2 entitlement (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis/ios/current-entitlement-ios',
  },
  {
    id: 'latest-transaction-ios',
    title: 'latestTransactionIOS',
    category: 'iOS Specific',
    description: 'Get latest StoreKit 2 transaction (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis/ios/latest-transaction-ios',
  },
  {
    id: 'show-manage-subscriptions-ios',
    title: 'showManageSubscriptionsIOS',
    category: 'iOS Specific',
    description: 'Open subscription management UI and return changes (iOS 15+)',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis/ios/show-manage-subscriptions-ios',
  },
  {
    id: 'begin-refund-request-ios',
    title: 'beginRefundRequestIOS',
    category: 'iOS Specific',
    description: 'Initiate refund request (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis/ios/begin-refund-request-ios',
  },
  {
    id: 'is-transaction-verified-ios',
    title: 'isTransactionVerifiedIOS',
    category: 'iOS Specific',
    description: 'Verify StoreKit 2 transaction signature',
    parameters: 'sku: String!',
    returns: 'Boolean!',
    path: '/docs/apis/ios/is-transaction-verified-ios',
  },
  {
    id: 'get-transaction-jws-ios',
    title: 'getTransactionJwsIOS',
    category: 'iOS Specific',
    description: 'Get the transaction JWS (StoreKit 2)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis/ios/get-transaction-jws-ios',
  },
  {
    id: 'get-receipt-data-ios',
    title: 'getReceiptDataIOS',
    category: 'iOS Specific',
    description: 'Get base64-encoded receipt data for validation',
    parameters: '',
    returns: 'String',
    path: '/docs/apis/ios/get-receipt-data-ios',
  },
  {
    id: 'present-code-redemption-sheet-ios',
    title: 'presentCodeRedemptionSheetIOS',
    category: 'iOS Specific',
    description: 'Present the App Store code redemption sheet',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/present-code-redemption-sheet-ios',
  },
  {
    id: 'get-app-transaction-ios',
    title: 'getAppTransactionIOS',
    category: 'iOS Specific',
    description: 'Fetch the current app transaction (iOS 16+)',
    parameters: '',
    returns: 'AppTransaction',
    path: '/docs/apis/ios/get-app-transaction-ios',
  },
  {
    id: 'external-purchase-ios',
    title: 'iOS External Purchase',
    category: 'iOS Specific',
    description: 'External purchase flow for iOS 17.4+',
    parameters: '',
    returns: '',
    path: '/docs/features/external-purchase',
  },
  {
    id: 'get-all-transactions-ios',
    title: 'getAllTransactionsIOS',
    category: 'iOS Specific',
    description:
      'Get the full StoreKit 2 transaction history as PurchaseIOS values (iOS 18+ requires SK2ConsumableTransactionHistory Info.plist key for consumables)',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis/ios/get-all-transactions-ios',
  },
  {
    id: 'get-storefront-ios',
    title: 'getStorefrontIOS',
    category: 'iOS Specific',
    description: 'Deprecated. Use getStorefront() (cross-platform) instead.',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis/ios/get-storefront-ios',
  },
  {
    id: 'validate-receipt-ios',
    title: 'validateReceiptIOS',
    category: 'iOS Specific',
    description: 'Deprecated. Use verifyPurchase instead.',
    parameters: 'options: ReceiptValidationProps!',
    returns: 'ReceiptValidationResultIOS!',
    path: '/docs/apis/ios/validate-receipt-ios',
  },
  {
    id: 'can-present-external-purchase-notice-ios',
    title: 'canPresentExternalPurchaseNoticeIOS',
    category: 'iOS Specific',
    description:
      'Check if the external purchase notice sheet can be presented (iOS 17.4+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/can-present-external-purchase-notice-ios',
  },
  {
    id: 'present-external-purchase-notice-sheet-ios',
    title: 'presentExternalPurchaseNoticeSheetIOS',
    category: 'iOS Specific',
    description: "Present Apple's compliance notice sheet (iOS 17.4+)",
    parameters: '',
    returns: 'ExternalPurchaseNoticeResultIOS!',
    path: '/docs/apis/ios/present-external-purchase-notice-sheet-ios',
  },
  {
    id: 'present-external-purchase-link-ios',
    title: 'presentExternalPurchaseLinkIOS',
    category: 'iOS Specific',
    description: 'Open the external purchase URL in Safari (iOS 18.2+)',
    parameters: 'url: String!',
    returns: 'ExternalPurchaseLinkResultIOS!',
    path: '/docs/apis/ios/present-external-purchase-link-ios',
  },
  {
    id: 'is-eligible-for-external-purchase-custom-link-ios',
    title: 'isEligibleForExternalPurchaseCustomLinkIOS',
    category: 'iOS Specific',
    description:
      'Check whether the app can use the iOS 18.1+ ExternalPurchaseCustomLink API',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios',
  },
  {
    id: 'get-external-purchase-custom-link-token-ios',
    title: 'getExternalPurchaseCustomLinkTokenIOS',
    category: 'iOS Specific',
    description:
      'Get the iOS 18.1+ ExternalPurchaseCustomLink token for reporting transactions to Apple',
    parameters: '',
    returns: 'String',
    path: '/docs/apis/ios/get-external-purchase-custom-link-token-ios',
  },
  {
    id: 'show-external-purchase-custom-link-notice-ios',
    title: 'showExternalPurchaseCustomLinkNoticeIOS',
    category: 'iOS Specific',
    description:
      'Show the iOS 18.1+ ExternalPurchaseCustomLink notice sheet before linking out to external purchases',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios/show-external-purchase-custom-link-notice-ios',
  },

  // Android Specific
  {
    id: 'acknowledge-purchase-android',
    title: 'acknowledgePurchaseAndroid',
    category: 'Android Specific',
    description: 'Acknowledge a non-consumable purchase or subscription',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis/android/acknowledge-purchase-android',
  },
  {
    id: 'consume-purchase-android',
    title: 'consumePurchaseAndroid',
    category: 'Android Specific',
    description: 'Consume a purchase (for consumable products only)',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis/android/consume-purchase-android',
  },
  {
    id: 'check-alternative-billing-availability-android',
    title: 'checkAlternativeBillingAvailabilityAndroid',
    category: 'Android Specific',
    description:
      'Check if alternative billing is available (Step 1 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/android/check-alternative-billing-availability-android',
  },
  {
    id: 'show-alternative-billing-dialog-android',
    title: 'showAlternativeBillingDialogAndroid',
    category: 'Android Specific',
    description:
      'Show alternative billing dialog to user (Step 2 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/android/show-alternative-billing-dialog-android',
  },
  {
    id: 'create-alternative-billing-token-android',
    title: 'createAlternativeBillingTokenAndroid',
    category: 'Android Specific',
    description:
      'Create external transaction token for Google Play (Step 3 of alternative billing)',
    parameters: '',
    returns: 'String',
    path: '/docs/apis/android/create-alternative-billing-token-android',
  },
  {
    id: 'enable-billing-program-android',
    title: 'enableBillingProgramAndroid',
    category: 'Android Specific',
    description:
      'Step 0 of Billing Programs API. Enable a billing program before initConnection() (Billing Library 8.2.0+)',
    parameters: 'config: EnableBillingProgramConfigAndroid!',
    returns: 'Boolean!',
    path: '/docs/apis/android/enable-billing-program-android',
  },
  {
    id: 'is-billing-program-available-android',
    title: 'isBillingProgramAvailableAndroid',
    category: 'Android Specific',
    description:
      'Step 1 of Billing Programs API. Check if a billing program is available for the current user',
    parameters: 'programId: String!',
    returns: 'BillingProgramAvailabilityResultAndroid!',
    path: '/docs/apis/android/is-billing-program-available-android',
  },
  {
    id: 'launch-external-link-android',
    title: 'launchExternalLinkAndroid',
    category: 'Android Specific',
    description:
      'Step 2 of Billing Programs API. Launch external link flow — shows Play Store dialog and optionally launches external URL',
    parameters: 'params: LaunchExternalLinkParamsAndroid!',
    returns: 'LaunchExternalLinkResultAndroid!',
    path: '/docs/apis/android/launch-external-link-android',
  },
  {
    id: 'create-billing-program-reporting-details-android',
    title: 'createBillingProgramReportingDetailsAndroid',
    category: 'Android Specific',
    description:
      'Step 3 of Billing Programs API. Create reporting details with external transaction token after successful payment',
    parameters: '',
    returns: 'BillingProgramReportingDetailsAndroid!',
    path: '/docs/apis/android/create-billing-program-reporting-details-android',
  },

  // Debugging & Logging (moved to Features)
  {
    id: 'debugging-logging',
    title: 'Debugging & Logging',
    category: 'Debugging',
    description: 'Enable verbose logging for development',
    parameters: '',
    returns: '',
    path: '/docs/features/debugging',
  },
  {
    id: 'enable-logging',
    title: 'Enable Logging',
    category: 'Debugging',
    description: 'Enable or disable debug logs',
    parameters: 'Boolean',
    returns: '',
    path: '/docs/features/debugging#enable-logging',
  },
  {
    id: 'baseplanid-limitation',
    title: 'Android basePlanId Limitation',
    category: 'Debugging',
    description: 'Understanding basePlanId limitations with multiple offers',
    parameters: '',
    returns: '',
    path: '/docs/features/debugging#android-baseplanid-limitation',
  },

  // Documentation Pages
  {
    id: 'external-purchase-page',
    title: 'External Purchase',
    category: 'Documentation',
    description:
      'External purchase links for iOS - redirect users to external payment websites (iOS 16.0+)',
    path: '/docs/features/external-purchase',
  },
  {
    id: 'refund-page',
    title: 'Refund',
    category: 'Documentation',
    description:
      'Handle refunds across iOS and Android. beginRefundRequestIOS, Android auto-refund, App Store Server Notifications, Real-time Developer Notifications',
    path: '/docs/features/refund',
  },
  {
    id: 'refund-ios',
    title: 'iOS Refund Request',
    category: 'Refund',
    description:
      'Present in-app refund sheet on iOS 15+ via beginRefundRequestIOS',
    path: '/docs/features/refund#begin-refund-request-ios',
  },
  {
    id: 'refund-ios-server-notifications',
    title: 'App Store Server Notifications V2 (Refund)',
    category: 'Refund',
    description:
      'Detect approved iOS refunds via REFUND, REVOKE, REFUND_DECLINED notifications',
    path: '/docs/features/refund#ios-server-notifications',
  },
  {
    id: 'refund-android-rtdn',
    title: 'Real-time Developer Notifications (Refund)',
    category: 'Refund',
    description:
      'Detect Android refunds via voidedPurchaseNotification and SUBSCRIPTION_REVOKED RTDN',
    path: '/docs/features/refund#android-rtdn',
  },
  {
    id: 'refund-android-voided-api',
    title: 'Voided Purchases API',
    category: 'Refund',
    description: 'Poll Google Play Voided Purchases API as a fallback',
    path: '/docs/features/refund#android-voided-api',
  },
  {
    id: 'entitlement-revocation',
    title: 'Revoking Entitlements',
    category: 'Refund',
    description:
      'Revoke user entitlements after a refund is detected — server-side cleanup pattern',
    path: '/docs/features/refund#entitlement-revocation',
  },
  {
    id: 'validation-page',
    title: 'Validation',
    category: 'Documentation',
    description:
      'Server-side purchase validation with verifyPurchase and verifyPurchaseWithProvider (IAPKit)',
    path: '/docs/features/validation',
  },
  {
    id: 'debugging-page',
    title: 'Debugging',
    category: 'Documentation',
    description:
      'Enable OpenIapLog and understand common warnings such as Android basePlanId limitation',
    path: '/docs/features/debugging',
  },
  {
    id: 'types-page',
    title: 'Types',
    category: 'Documentation',
    description: 'Type definitions and data structures',
    path: '/docs/types',
  },
  {
    id: 'types-product',
    title: 'Product Types',
    category: 'Types',
    description:
      'Product, SubscriptionProduct, Unified Platform Types, Storefront',
    path: '/docs/types/product',
  },
  {
    id: 'product',
    title: 'Product',
    category: 'Types',
    description:
      'Base product type: id, title, description, price, currency, type',
    path: '/docs/types/product#product',
  },
  {
    id: 'subscription-product',
    title: 'ProductSubscription',
    category: 'Types',
    description:
      'Subscription product with pricing phases, intro offers, billing periods',
    path: '/docs/types/subscription-product',
  },
  {
    id: 'storefront',
    title: 'Storefront',
    category: 'Types',
    description: 'Store region info: countryCode returned by getStorefront()',
    path: '/docs/types/storefront',
  },
  {
    id: 'types-purchase',
    title: 'Purchase Types',
    category: 'Types',
    description: 'Purchase, PurchaseState, ActiveSubscription, RenewalInfoIOS',
    path: '/docs/types/purchase',
  },
  {
    id: 'purchase',
    title: 'Purchase',
    category: 'Types',
    description:
      'Purchase transaction: id, productId, transactionDate, transactionReceipt',
    path: '/docs/types/purchase#purchase',
  },
  {
    id: 'purchase-state',
    title: 'PurchaseState',
    category: 'Types',
    description:
      'Purchase state enum: purchased, pending, failed, restored, deferred',
    path: '/docs/types/purchase',
  },
  {
    id: 'active-subscription',
    title: 'ActiveSubscription',
    category: 'Types',
    description:
      'Active subscription: id, productId, isActive from getActiveSubscriptions()',
    path: '/docs/types/active-subscription',
  },
  {
    id: 'types-request',
    title: 'Request Types',
    category: 'Types',
    description:
      'ProductRequest, RequestPurchaseProps, platform-specific request types',
    path: '/docs/types/request-purchase-props',
  },
  {
    id: 'types-verification',
    title: 'Verification Types',
    category: 'Types',
    description:
      'VerifyPurchaseProps, IAPKit integration, purchase verification',
    path: '/docs/types/verify-purchase',
  },
  {
    id: 'types-ios',
    title: 'iOS Types',
    category: 'Types',
    description:
      'DiscountOffer, SubscriptionStatusIOS, PaymentMode, AppTransaction',
    path: '/docs/types#ios-types',
  },
  {
    id: 'types-android',
    title: 'Android Types',
    category: 'Types',
    description: 'SubscriptionOffer, PricingPhase, PricingPhasesAndroid',
    path: '/docs/types#android-types',
  },
  {
    id: 'types-alternative',
    title: 'Alternative Billing Types',
    category: 'Types',
    description:
      'AlternativeBillingModeAndroid, InitConnectionConfig, External Purchase Link',
    path: '/docs/types/alternative-billing-types',
  },

  // iOS-Specific Types (from types/ios.tsx)
  {
    id: 'discount-offer',
    title: 'DiscountOffer',
    category: 'Types (iOS)',
    description:
      'iOS promotional offer for purchase: identifier, keyIdentifier, nonce, signature, timestamp',
    path: '/docs/types/ios/discount-offer-ios',
  },
  {
    id: 'discount',
    title: 'Discount',
    category: 'Types (iOS)',
    description:
      'iOS discount info: identifier, type, numberOfPeriods, price, paymentMode, subscriptionPeriod',
    path: '/docs/types/ios#discount',
  },
  {
    id: 'subscription-period-ios',
    title: 'SubscriptionPeriodIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription period units: Day, Week, Month, Year',
    path: '/docs/types/ios/subscription-period-ios',
  },
  {
    id: 'payment-mode',
    title: 'PaymentMode',
    category: 'Types (iOS)',
    description:
      'iOS payment mode for offers: FreeTrial, PayAsYouGo, PayUpFront',
    path: '/docs/types/ios/payment-mode-ios',
  },
  {
    id: 'subscription-status-ios-type',
    title: 'SubscriptionStatusIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription status from StoreKit 2: state, renewalInfo',
    path: '/docs/types/ios/subscription-status-ios',
  },
  {
    id: 'app-transaction',
    title: 'AppTransaction',
    category: 'Types (iOS)',
    description:
      'iOS app transaction info: bundleId, appVersion, originalAppVersion, environment',
    path: '/docs/types/ios/app-transaction-ios',
  },

  // Android-Specific Types (from types/android.tsx)
  {
    id: 'subscription-offer',
    title: 'SubscriptionOffer',
    category: 'Types (Android)',
    description:
      'Android subscription offer: sku, offerToken for Play Billing purchases',
    path: '/docs/types/android/subscription-offer-android',
  },
  {
    id: 'pricing-phase',
    title: 'PricingPhase',
    category: 'Types (Android)',
    description:
      'Android pricing phase: billingPeriod, formattedPrice, priceAmountMicros, recurrenceMode',
    path: '/docs/types/android/pricing-phase-android',
  },
  {
    id: 'pricing-phases-android',
    title: 'PricingPhasesAndroid',
    category: 'Types (Android)',
    description: 'Android pricing phases container: pricingPhaseList array',
    path: '/docs/types/android/pricing-phase-android#pricing-phases-android',
  },

  // Alternative Billing Types (from types/alternative.tsx)
  {
    id: 'alternative-billing-mode-android',
    title: 'AlternativeBillingModeAndroid',
    category: 'Types (Android)',
    description: 'Android billing mode: NONE, USER_CHOICE, ALTERNATIVE_ONLY',
    path: '/docs/types/alternative-billing-types',
  },
  {
    id: 'init-connection-config',
    title: 'InitConnectionConfig',
    category: 'Types',
    description:
      'Configuration for initConnection: alternativeBillingModeAndroid',
    path: '/docs/types/alternative-billing-types',
  },
  {
    id: 'external-purchase-link-ios',
    title: 'External Purchase Link (iOS)',
    category: 'Types (iOS)',
    description:
      'iOS external purchase APIs: canPresent, presentNoticeSheet, presentLink (iOS 17.4+)',
    path: '/docs/types/external-purchase-link',
  },
  {
    id: 'billing-programs',
    title: 'Billing Programs',
    category: 'Types',
    description:
      'Android Billing Programs API (Play Billing 8.2.0+): BillingProgramAndroid, ExternalLink launch modes, Developer Provided Billing parameters',
    path: '/docs/types/billing-programs',
  },

  // Platform-Specific Request Types
  {
    id: 'request-purchase-ios-props',
    title: 'RequestPurchaseIosProps',
    category: 'Types (iOS)',
    description:
      'iOS purchase request parameters: sku, appAccountToken, quantity, withOffer',
    path: '/docs/types/request-purchase-props',
  },
  {
    id: 'request-purchase-android-props',
    title: 'RequestPurchaseAndroidProps',
    category: 'Types (Android)',
    description:
      'Android purchase request parameters: skus, obfuscatedAccountId, isOfferPersonalized',
    path: '/docs/types/request-purchase-props',
  },
  {
    id: 'request-subscription-ios-props',
    title: 'RequestSubscriptionIosProps',
    category: 'Types (iOS)',
    description:
      'iOS subscription request parameters (same as RequestPurchaseIosProps)',
    path: '/docs/types/request-purchase-props',
  },
  {
    id: 'request-subscription-android-props',
    title: 'RequestSubscriptionAndroidProps',
    category: 'Types (Android)',
    description:
      'Android subscription request: purchaseToken, replacementMode, subscriptionOffers',
    path: '/docs/types/request-purchase-props',
  },

  // Platform-Specific Product Types
  {
    id: 'product-ios',
    title: 'ProductIOS',
    category: 'Types (iOS)',
    description:
      'iOS product fields: typeIOS, isFamilyShareableIOS, subscriptionOffers',
    path: '/docs/types/product#product-ios',
  },
  {
    id: 'product-android',
    title: 'ProductAndroid',
    category: 'Types (Android)',
    description:
      'Android product fields: nameAndroid, discountOffers, subscriptionOffers',
    path: '/docs/types/product#product-android',
  },
  {
    id: 'subscription-product-ios',
    title: 'ProductSubscriptionIOS',
    category: 'Types (iOS)',
    description:
      'iOS subscription fields: subscriptionOffers, introductoryPriceIOS, subscriptionPeriodUnitIOS',
    path: '/docs/types/subscription-product#subscription-product-ios',
  },
  {
    id: 'subscription-product-android',
    title: 'ProductSubscriptionAndroid',
    category: 'Types (Android)',
    description: 'Android subscription fields: subscriptionOffers',
    path: '/docs/types/subscription-product#subscription-product-android',
  },

  // Platform-Specific Purchase Types
  {
    id: 'purchase-ios',
    title: 'PurchaseIOS',
    category: 'Types (iOS)',
    description:
      'iOS purchase fields: originalTransactionDateIOS, expirationDateIOS, renewalInfoIOS',
    path: '/docs/types/purchase#purchase-ios',
  },
  {
    id: 'purchase-android',
    title: 'PurchaseAndroid',
    category: 'Types (Android)',
    description:
      'Android purchase fields: dataAndroid, signatureAndroid, isAcknowledgedAndroid',
    path: '/docs/types/purchase#purchase-android',
  },
  {
    id: 'renewal-info-ios',
    title: 'RenewalInfoIOS',
    category: 'Types (iOS)',
    description:
      'iOS subscription renewal info: willAutoRenew, expirationReason, gracePeriodExpirationDate',
    path: '/docs/types/ios/renewal-info-ios',
  },
  {
    id: 'active-subscription-ios',
    title: 'ActiveSubscriptionIOS',
    category: 'Types (iOS)',
    description:
      'iOS active subscription: expirationDateIOS, environmentIOS, daysUntilExpirationIOS',
    path: '/docs/types/active-subscription#active-subscription-ios',
  },
  {
    id: 'active-subscription-android',
    title: 'ActiveSubscriptionAndroid',
    category: 'Types (Android)',
    description:
      'Android active subscription: autoRenewingAndroid, basePlanIdAndroid, purchaseTokenAndroid',
    path: '/docs/types/active-subscription#active-subscription-android',
  },

  // Platform-Specific Verification Types
  {
    id: 'verify-purchase-result-ios',
    title: 'VerifyPurchaseResultIOS',
    category: 'Types (iOS)',
    description:
      'iOS verification result: isValid, receiptData, jwsRepresentation, latestTransaction',
    path: '/docs/types/verify-purchase#verify-purchase-result-ios',
  },
  {
    id: 'verify-purchase-result-android',
    title: 'VerifyPurchaseResultAndroid',
    category: 'Types (Android)',
    description:
      'Android verification result: autoRenewing, cancelDate, renewalDate, transactionId',
    path: '/docs/types/verify-purchase#verify-purchase-result-android',
  },
  {
    id: 'verify-purchase-result-horizon',
    title: 'VerifyPurchaseResultHorizon',
    category: 'Types (Horizon)',
    description: 'Meta Quest verification result: success, grantTime',
    path: '/docs/types/verify-purchase#verify-purchase-result-horizon',
  },

  {
    id: 'apis-page',
    title: 'APIs',
    category: 'Documentation',
    description: 'API reference and function signatures',
    path: '/docs/apis',
  },
  {
    id: 'events-page',
    title: 'Events',
    category: 'Documentation',
    description: 'Event listeners and callbacks',
    path: '/docs/events',
  },
  {
    id: 'errors-page',
    title: 'Errors',
    category: 'Documentation',
    description: 'Error codes and error handling',
    path: '/docs/errors',
  },
];
