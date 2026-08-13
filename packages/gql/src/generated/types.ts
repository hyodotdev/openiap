// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Refresh this file with the generated-types workflow documented for your checkout.
// ============================================================================

export interface ActiveSubscription {
  autoRenewingAndroid?: (boolean | null);
  basePlanIdAndroid?: (string | null);
  /**
   * The current plan identifier. This is:
   * - On Android: the basePlanId (e.g., "premium", "premium-year")
   * - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
   * This provides a unified way to identify which specific plan/tier the user is subscribed to.
   */
  currentPlanId?: (string | null);
  daysUntilExpirationIOS?: (number | null);
  environmentIOS?: (string | null);
  expirationDateIOS?: (number | null);
  isActive: boolean;
  productId: string;
  purchaseToken?: (string | null);
  /** Required for subscription upgrade/downgrade on Android */
  purchaseTokenAndroid?: (string | null);
  /**
   * Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,
   * pending upgrades/downgrades, and auto-renewal preferences.
   */
  renewalInfoIOS?: (RenewalInfoIOS | null);
  /** Unix timestamp in milliseconds since January 1, 1970 UTC. */
  transactionDate: number;
  transactionId: string;
}

/**
 * Advanced Commerce metadata from a transaction (iOS 18.4+).
 * Contains item details, tax information, and refund data for purchases
 * made through the Advanced Commerce API using generic SKUs.
 * Only present for transactions that use the Advanced Commerce API.
 */
export interface AdvancedCommerceInfoIOS {
  /** Optional description */
  description?: (string | null);
  /** Optional display name */
  displayName?: (string | null);
  /** Estimated tax amount (decimal string) */
  estimatedTax?: (string | null);
  /** The items purchased as part of this transaction */
  items: AdvancedCommerceItemIOS[];
  /**
   * Subscription period for this transaction.
   * Available in OpenIAP Spec 3.1.0 / openiap-apple 3.1.0
   * (requires iOS 18.4+, macOS 15.4+, tvOS 18.4+, watchOS 11.4+,
   * or visionOS 2.4+).
   */
  period?: (SubscriptionPeriodValueIOS | null);
  /** Request reference identifier for tracking */
  requestReferenceId?: (string | null);
  /** Tax code for the transaction */
  taxCode?: (string | null);
  /** Price excluding tax (decimal string) */
  taxExclusivePrice?: (string | null);
  /** Tax rate applied (decimal string) */
  taxRate?: (string | null);
}

/** Details of an Advanced Commerce item (iOS 18.4+). */
export interface AdvancedCommerceItemDetailsIOS {
  /** JSON representation of the item details */
  jsonRepresentation?: (string | null);
}

/**
 * An item purchased through the Advanced Commerce API (iOS 18.4+).
 * Represents a developer-defined product within a generic SKU transaction.
 */
export interface AdvancedCommerceItemIOS {
  /** The item's detail information */
  details?: (AdvancedCommerceItemDetailsIOS | null);
  /** Refunds issued for this item, if any */
  refunds?: (AdvancedCommerceRefundIOS[] | null);
  /** Date access to this item was revoked (milliseconds since epoch) */
  revocationDate?: (number | null);
}

/** Refund information for an Advanced Commerce item (iOS 18.4+). */
export interface AdvancedCommerceRefundIOS {
  /** JSON representation of the refund details */
  jsonRepresentation?: (string | null);
}

export interface AndroidSubscriptionOfferInput {
  /** Offer token */
  offerToken: string;
  /** Product SKU */
  sku: string;
}

export interface AppTransaction {
  appId: number;
  appTransactionId?: (string | null);
  appVersion: string;
  appVersionId: number;
  bundleId: string;
  deviceVerification: string;
  deviceVerificationNonce: string;
  environment: string;
  originalAppVersion: string;
  /**
   * Original App Store platform raw value. Xcode 27 adds the back-deployed managed
   * acquisition-platform value.
   */
  originalPlatform?: (string | null);
  originalPurchaseDate: number;
  preorderDate?: (number | null);
  /**
   * Date the app-acquisition transaction was revoked (epoch milliseconds).
   * Available through the Xcode 27 SDK and back-deployed to Apple 16+.
   */
  revocationDate?: (number | null);
  signedDate: number;
  /**
   * Store channel of the original app purchase: consumer, education, enterprise,
   * or another future StoreKit value (Apple 27+ beta).
   */
  storeType?: (string | null);
}

/**
 * Play Billing choice image layout (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export type BillingChoiceImageLayoutAndroid = 'rectangular-four-by-one' | 'rectangular-three-by-one' | 'rectangular-two-by-two';

/**
 * Display information for developer-rendered Billing Choice screens (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export interface BillingChoiceInfoAndroid {
  /** URL for the Play Billing choice image matching the requested layout. */
  playBillingChoiceImageUrl: string;
  /** Play Loyalty information for the user. */
  playBillingLoyaltyInfo?: (string | null);
}

/**
 * Choice screen renderer for Billing Choice availability (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export type BillingChoiceScreenTypeAndroid = 'unspecified' | 'developer-rendered' | 'google-rendered';

/**
 * Billing program types for Google Play Billing Programs (Android)
 * Available in Google Play Billing Library 8.2.0 (External Offer and External Content Link
 * integrations require 8.2.1+), EXTERNAL_PAYMENTS added in 8.3.0,
 * BILLING_CHOICE added in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (requires Play Billing 9.1.0+).
 */
export type BillingProgramAndroid = 'unspecified' | 'user-choice-billing' | 'external-content-link' | 'external-offer' | 'external-payments' | 'billing-choice';

/**
 * Result of checking billing program availability (Android)
 * Available in Google Play Billing Library 8.2.0+
 */
export interface BillingProgramAvailabilityResultAndroid {
  /** The billing program that was checked */
  billingProgram: BillingProgramAndroid;
  /**
   * Billing Choice screen renderer. Populated only for available BILLING_CHOICE results.
   * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
   */
  choiceScreenType?: (BillingChoiceScreenTypeAndroid | null);
  /** Whether the billing program is available for the user */
  isAvailable: boolean;
  /**
   * Whether external-link payment is available for Billing Choice.
   * Populated only for available BILLING_CHOICE results.
   * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0.
   */
  isExternalLinkAvailable?: (boolean | null);
}

/**
 * Parameters for showing a billing program information dialog (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export interface BillingProgramInformationDialogParamsAndroid {
  /** Billing program. Currently only BILLING_CHOICE is supported. */
  billingProgram?: BillingProgramAndroid;
  /** External transaction token returned by the Billing Choice reporting-details flow. */
  externalTransactionToken: string;
}

/**
 * Reporting details for transactions made outside of Google Play Billing (Android)
 * Contains the external transaction token needed for reporting
 * Available in Google Play Billing Library 8.2.0+
 */
export interface BillingProgramReportingDetailsAndroid {
  /** The billing program that the reporting details are associated with */
  billingProgram: BillingProgramAndroid;
  /**
   * External transaction token used to report transactions made outside of Google Play Billing.
   * Do not cache it for a later redirect session. For External Offer, the same token may report
   * multiple purchases made during the session that generated it.
   */
  externalTransactionToken: string;
}

/**
 * Extended billing result with sub-response code (Android)
 * Available in Google Play Billing Library 8.0.0+
 */
export interface BillingResultAndroid {
  /** Debug message from the billing library */
  debugMessage?: (string | null);
  /** The response code from the billing operation */
  responseCode: number;
  /**
   * Sub-response code for more granular error information (8.0+).
   * Provides additional context when responseCode indicates an error.
   */
  subResponseCode?: (SubResponseCodeAndroid | null);
}

/**
 * Metadata for one auto-renewable subscription included in an Apple
 * subscription bundle (Apple 27+ beta).
 */
export interface BundledSubscriptionIOS {
  description: string;
  displayName: string;
  displayPrice: string;
  id: string;
  isFamilyShareable: boolean;
  price: number;
  subscriptionGroupDisplayName: string;
  subscriptionGroupId: string;
  subscriptionGroupLevel: number;
}

export interface DeepLinkOptions {
  /** Android package name to target (required on Android) */
  packageNameAndroid?: (string | null);
  /** Android SKU to open (required on Android) */
  skuAndroid?: (string | null);
}

/**
 * Launch mode for developer billing option (Android)
 * Determines how the external payment URL is launched
 * Available in Google Play Billing Library 8.3.0+
 */
export type DeveloperBillingLaunchModeAndroid = 'unspecified' | 'launch-in-external-browser-or-app' | 'caller-will-launch-link';

/**
 * Parameters for a developer billing option in a purchase flow (Android).
 * Used with BillingFlowParams for external payments (8.3.0+) and Billing Choice
 * (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+).
 * Only billingProgram is required; link fields are used when the selected program
 * links outside the app.
 */
export interface DeveloperBillingOptionParamsAndroid {
  /** The billing program. Use EXTERNAL_PAYMENTS or BILLING_CHOICE. */
  billingProgram: BillingProgramAndroid;
  /**
   * A pre-generated external transaction token for a Billing Choice external-link
   * flow. Omit it when Google Play should provide the token in the callback.
   */
  externalTransactionToken?: (string | null);
  /**
   * The launch mode for the external payment link.
   * Required only when the selected billing program links outside the app.
   */
  launchMode?: (DeveloperBillingLaunchModeAndroid | null);
  /**
   * The URI where the external payment will be processed.
   * Required only when the selected billing program links outside the app.
   */
  linkUri?: (string | null);
}

/**
 * Developer-provided billing destination type for Billing Program reporting details (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export type DeveloperBillingTypeAndroid = 'developer-billing-type-unspecified' | 'in-app' | 'external-link';

/**
 * Details provided when user selects developer billing option (Android)
 * Received via DeveloperProvidedBillingListener callback
 * Available in Google Play Billing Library 8.3.0+
 */
export interface DeveloperProvidedBillingDetailsAndroid {
  /**
   * External transaction token used to report transactions made through developer billing.
   * Nullable for flows such as external payments where no token is returned.
   */
  externalTransactionToken?: (string | null);
  /**
   * URI to launch for an external-link Billing Choice flow, when provided by
   * Google Play.
   */
  linkUri?: (string | null);
  /**
   * Original external transaction ID when replacing a subscription that was
   * purchased through developer billing.
   */
  originalExternalTransactionId?: (string | null);
  /** Products selected for the developer billing flow. */
  products: DeveloperProvidedBillingProductAndroid[];
}

/** Product selected for developer-provided billing (Android 9.0+). */
export interface DeveloperProvidedBillingProductAndroid {
  /** Product identifier. */
  id: string;
  /** Subscription offer token, when applicable. */
  offerToken?: (string | null);
  /** Google Play product type (in-app or subscription). */
  type: ProductType;
}

/**
 * Discount amount details for one-time purchase offers (Android)
 * Available in Google Play Billing Library 8.0+
 */
export interface DiscountAmountAndroid {
  /** Discount amount in micro-units (1,000,000 = 1 unit of currency) */
  discountAmountMicros: string;
  /** Formatted discount amount with currency sign (e.g., "$4.99") */
  formattedDiscountAmount: string;
}

/**
 * Discount display information for one-time purchase offers (Android)
 * Available in Google Play Billing Library 8.0+
 */
export interface DiscountDisplayInfoAndroid {
  /**
   * Absolute discount amount details
   * Only returned for fixed amount discounts
   */
  discountAmount?: (DiscountAmountAndroid | null);
  /**
   * Percentage discount (e.g., 33 for 33% off)
   * Only returned for percentage-based discounts
   */
  percentageDiscount?: (number | null);
}

/**
 * Standardized one-time product discount offer.
 * Provides a platform-neutral OpenIAP shape for Google Play one-time product
 * purchase options and offers.
 *
 * Currently populated only on Android (Google Play Billing 8.0+).
 * iOS does not populate this type.
 *
 * @see https://openiap.dev/docs/types/discount-offer
 */
export interface DiscountOffer {
  /** Currency code (ISO 4217, e.g., "USD") */
  currency: string;
  /**
   * [Android] Fixed discount amount in micro-units.
   * Only present for fixed amount discounts.
   */
  discountAmountMicrosAndroid?: (string | null);
  /** Formatted display price string (e.g., "$4.99") */
  displayPrice: string;
  /** [Android] Formatted discount amount including its currency sign (e.g., "$5.00"). */
  formattedDiscountAmountAndroid?: (string | null);
  /**
   * [Android] Original full price in micro-units before discount.
   * Divide by 1,000,000 to get the actual price.
   * Use for displaying strikethrough original price.
   */
  fullPriceMicrosAndroid?: (string | null);
  /**
   * Unique identifier for the offer.
   * - iOS: Not applicable (one-time discounts not supported)
   * - Android: offerId from the Google Play one-time purchase option
   */
  id?: (string | null);
  /**
   * [Android] Limited quantity information.
   * Contains maximumQuantity and remainingQuantity.
   */
  limitedQuantityInfoAndroid?: (LimitedQuantityInfoAndroid | null);
  /** [Android] List of tags associated with this offer. */
  offerTagsAndroid?: (string[] | null);
  /**
   * [Android] Offer token required for purchase.
   * Must be passed to requestPurchase() when purchasing with this offer.
   */
  offerTokenAndroid?: (string | null);
  /**
   * [Android] Percentage discount (e.g., 33 for 33% off).
   * Only present for percentage-based discounts.
   */
  percentageDiscountAndroid?: (number | null);
  /**
   * [Android] Pre-order details if this is a pre-order offer.
   * Available in Google Play Billing Library 8.1.0+
   */
  preorderDetailsAndroid?: (PreorderDetailsAndroid | null);
  /** Numeric price value */
  price: number;
  /**
   * [Android] Purchase option ID for this offer.
   * Used to identify which purchase option the user selected.
   * Available in Google Play Billing Library 8.0+
   */
  purchaseOptionIdAndroid?: (string | null);
  /** [Android] Rental details if this is a rental offer. */
  rentalDetailsAndroid?: (RentalDetailsAndroid | null);
  /**
   * Offer category. DiscountOffer currently represents Android one-time product
   * offers and is populated as OneTime. Introductory and Promotional are used by
   * SubscriptionOffer.
   */
  type: DiscountOfferType;
  /**
   * [Android] Valid time window for the offer.
   * Contains startTimeMillis and endTimeMillis.
   */
  validTimeWindowAndroid?: (ValidTimeWindowAndroid | null);
}

export interface DiscountOfferInputIOS {
  /** Discount identifier */
  identifier: string;
  /** Key identifier for validation */
  keyIdentifier: string;
  /** Cryptographic nonce */
  nonce: string;
  /** Signature for validation */
  signature: string;
  /** Timestamp of discount offer */
  timestamp: number;
}

/**
 * Discount offer type enumeration.
 * Categorizes the type of discount or promotional offer.
 */
export type DiscountOfferType = 'introductory' | 'promotional' | 'one-time';

export interface EntitlementIOS {
  jsonRepresentation: string;
  sku: string;
  transactionId: string;
}

export enum ErrorCode {
  ActivityUnavailable = 'activity-unavailable',
  AlreadyOwned = 'already-owned',
  AlreadyPrepared = 'already-prepared',
  BillingResponseJsonParseError = 'billing-response-json-parse-error',
  BillingUnavailable = 'billing-unavailable',
  ConnectionClosed = 'connection-closed',
  DeferredPayment = 'deferred-payment',
  DeveloperError = 'developer-error',
  DuplicatePurchase = 'duplicate-purchase',
  EmptySkuList = 'empty-sku-list',
  FeatureNotSupported = 'feature-not-supported',
  IapNotAvailable = 'iap-not-available',
  InitConnection = 'init-connection',
  Interrupted = 'interrupted',
  ItemNotOwned = 'item-not-owned',
  ItemUnavailable = 'item-unavailable',
  NetworkError = 'network-error',
  NotEnded = 'not-ended',
  NotPrepared = 'not-prepared',
  Pending = 'pending',
  PurchaseError = 'purchase-error',
  PurchaseVerificationFailed = 'purchase-verification-failed',
  PurchaseVerificationFinishFailed = 'purchase-verification-finish-failed',
  PurchaseVerificationFinished = 'purchase-verification-finished',
  QueryProduct = 'query-product',
  RemoteError = 'remote-error',
  ServiceDisconnected = 'service-disconnected',
  ServiceError = 'service-error',
  ServiceTimeout = 'service-timeout',
  SkuNotFound = 'sku-not-found',
  SkuOfferMismatch = 'sku-offer-mismatch',
  SyncError = 'sync-error',
  TransactionValidationFailed = 'transaction-validation-failed',
  Unknown = 'unknown',
  UserCancelled = 'user-cancelled',
  UserError = 'user-error'
}

/**
 * Launch mode for external link flow (Android)
 * Determines how the external URL is launched
 * Introduced in Google Play Billing Library 8.2.0. External Offer and External Content Link
 * integrations require 8.2.1+ and fresh details immediately before every redirect session.
 */
export type ExternalLinkLaunchModeAndroid = 'unspecified' | 'launch-in-external-browser-or-app' | 'caller-will-launch-link';

/**
 * Link type for external link flow (Android)
 * Specifies the type of external link destination
 * Available in Google Play Billing Library 8.2.0+
 */
export type ExternalLinkTypeAndroid = 'unspecified' | 'link-to-digital-content-offer' | 'link-to-app-download';

/** Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+). */
export interface ExternalPurchaseCustomLinkNoticeResultIOS {
  /** Whether the user chose to continue to external purchase */
  continued: boolean;
  /** Optional error message if the presentation failed */
  error?: (string | null);
}

/**
 * Notice types for ExternalPurchaseCustomLink (iOS 18.1+).
 * Determines the style of disclosure notice to display.
 * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/noticetype
 */
export type ExternalPurchaseCustomLinkNoticeTypeIOS = 'browser';

/** Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+). */
export interface ExternalPurchaseCustomLinkTokenResultIOS {
  /** Optional error message if token retrieval failed */
  error?: (string | null);
  /**
   * The external purchase token string.
   * Report this token to Apple's External Purchase Server API.
   */
  token?: (string | null);
}

/**
 * Token types for ExternalPurchaseCustomLink (iOS 18.1+).
 * Used to request different types of external purchase tokens for reporting to Apple.
 * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
 */
export type ExternalPurchaseCustomLinkTokenTypeIOS = 'acquisition' | 'services';

/** Result of presenting an external purchase link */
export interface ExternalPurchaseLinkResultIOS {
  /** Optional error message if the presentation failed */
  error?: (string | null);
  /** Whether the user completed the external purchase flow */
  success: boolean;
}

/** User actions on external purchase notice sheet (iOS 17.4+) */
export type ExternalPurchaseNoticeAction = 'continue' | 'dismissed';

/**
 * Result of presenting external purchase notice sheet (iOS 17.4+)
 * Returns the token when user continues to external purchase.
 */
export interface ExternalPurchaseNoticeResultIOS {
  /** Optional error message if the presentation failed */
  error?: (string | null);
  /**
   * External purchase token returned when user continues (iOS 17.4+).
   * This token should be reported to Apple's External Purchase Server API.
   * Only present when result is Continue.
   */
  externalPurchaseToken?: (string | null);
  /** Notice result indicating user action */
  result: ExternalPurchaseNoticeAction;
}

export type FetchProductsResult = ProductOrSubscription[] | Product[] | ProductSubscription[] | null;

/**
 * Parameters for fetching Billing Choice display information (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
 */
export interface GetBillingChoiceInfoParamsAndroid {
  /** Billing program. Currently only BILLING_CHOICE is supported. */
  billingProgram?: BillingProgramAndroid;
  /** Desired Play Billing choice image layout. */
  playBillingChoiceImageLayout?: BillingChoiceImageLayoutAndroid;
  /** BCP 47 locale tag. If omitted, Play Billing uses the user's default locale. */
  userLocale?: (string | null);
}

export type IapEvent = 'purchase-updated' | 'purchase-error' | 'promoted-product-ios' | 'user-choice-billing-android' | 'developer-provided-billing-android' | 'subscription-billing-issue';

export type IapPlatform = 'ios' | 'android';

export type IapStore = 'unknown' | 'apple' | 'google' | 'horizon' | 'amazon';

/** Serialization format of a public IAPKit product client payload. */
export type IapkitClientPayloadFormat = 'toml' | 'json' | 'text';

/**
 * Public app-facing data attached to one store product in IAPKit.
 * Never place credentials, signing keys, or server-authoritative rules here.
 */
export interface IapkitProductClientPayload {
  body: string;
  format: IapkitClientPayloadFormat;
  updatedAt: number;
  version: number;
}

/** Unified purchase states from IAPKit verification response. */
export type IapkitPurchaseState = 'entitled' | 'pending-acknowledgment' | 'pending' | 'canceled' | 'expired' | 'ready-to-consume' | 'consumed' | 'unknown' | 'inauthentic';

/**
 * High-level in-app message category (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
export type InAppMessageCategoryAndroid = 'unknown-in-app-message-category-id' | 'transactional';

/**
 * Parameters for showing Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
export interface InAppMessageParamsAndroid {
  /** In-app message categories to show. Defaults to transactional messages. */
  categories?: (InAppMessageCategoryAndroid[] | null);
}

/**
 * Response code from Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
export type InAppMessageResponseCodeAndroid = 'no-action-needed' | 'subscription-status-updated';

/**
 * Result from showing Play billing in-app messages (Android)
 * Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
 * (upstream API available since Play Billing 4.1.0).
 */
export interface InAppMessageResultAndroid {
  /** Purchase token returned when a subscription status changed. */
  purchaseToken?: (string | null);
  /** Response code for the in-app messaging flow. */
  responseCode: InAppMessageResponseCodeAndroid;
}

/** Connection initialization configuration */
export interface InitConnectionConfig {
  /**
   * Billing Choice renderer configured in Play Console. Available in OpenIAP
   * Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   * GOOGLE_RENDERED registers the developer-provided billing listener so OpenIAP
   * can emit the selection event. DEVELOPER_RENDERED omits that listener so the
   * app can render its own choice screen and use the reporting/dialog/link APIs.
   * Must match choiceScreenType returned by isBillingProgramAvailableAndroid.
   * Defaults to GOOGLE_RENDERED.
   */
  billingChoiceScreenTypeAndroid?: (BillingChoiceScreenTypeAndroid | null);
  /**
   * Enable a specific billing program for Android (7.0+)
   * When set, enables the specified billing program for external transactions.
   * - USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)
   * - EXTERNAL_CONTENT_LINK: Link to external content (introduced in 8.2.0; use 8.2.1+)
   * - EXTERNAL_OFFER: External offers for digital content (introduced in 8.2.0; use 8.2.1+)
   * - EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)
   * - BILLING_CHOICE: Google-rendered or developer-rendered billing choice
   *   (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; requires Play Billing 9.1.0+)
   */
  enableBillingProgramAndroid?: (BillingProgramAndroid | null);
}

/**
 * Installment plan details for subscription offers (Android)
 * Contains information about the installment plan commitment.
 * Available in Google Play Billing Library 7.0+
 */
export interface InstallmentPlanDetailsAndroid {
  /**
   * Committed payments count after a user signs up for this subscription plan.
   * For example, for a monthly subscription with commitmentPaymentsCount of 12,
   * users will be charged monthly for 12 months after signup.
   */
  commitmentPaymentsCount: number;
  /**
   * Subsequent committed payments count after the subscription plan renews.
   * For example, for a monthly subscription with subsequentCommitmentPaymentsCount of 12,
   * users will be committed to another 12 monthly payments when the plan renews.
   * Returns 0 if the installment plan has no subsequent commitment (reverts to normal plan).
   */
  subsequentCommitmentPaymentsCount: number;
}

/**
 * Parameters for launching an external link (Android)
 * Used with launchExternalLink to initiate external offer, app install, or
 * developer-rendered Billing Choice flows
 * Available in Google Play Billing Library 8.2.0+
 */
export interface LaunchExternalLinkParamsAndroid {
  /** The billing program (EXTERNAL_CONTENT_LINK, EXTERNAL_OFFER, or BILLING_CHOICE) */
  billingProgram: BillingProgramAndroid;
  /**
   * External transaction token for a developer-rendered Billing Choice external-link
   * flow. Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
   * (requires Play Billing 9.1.0+). Generate it with createBillingProgramReportingDetailsAndroid.
   */
  externalTransactionToken?: (string | null);
  /** The external link launch mode */
  launchMode: ExternalLinkLaunchModeAndroid;
  /** The type of the external link */
  linkType: ExternalLinkTypeAndroid;
  /** The URI where the content will be accessed from */
  linkUri: string;
}

/**
 * Limited quantity information for one-time purchase offers (Android)
 * Available in Google Play Billing Library 8.0+
 */
export interface LimitedQuantityInfoAndroid {
  /** Maximum quantity a user can purchase */
  maximumQuantity: number;
  /** Remaining quantity the user can still purchase */
  remainingQuantity: number;
}

export interface Mutation {
  /**
   * Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.
   * See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android
   */
  acknowledgePurchaseAndroid: Promise<boolean>;
  /**
   * Present the refund request sheet (iOS 15+). See also Features → Refund.
   * See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios
   */
  beginRefundRequestIOS?: Promise<(string | null)>;
  /**
   * Clear pending transactions in the queue (sandbox helper).
   * See: https://openiap.dev/docs/apis/ios/clear-transaction-ios
   */
  clearTransactionIOS: Promise<boolean>;
  /**
   * Consume a consumable purchase so it can be re-bought.
   * See: https://openiap.dev/docs/apis/android/consume-purchase-android
   */
  consumePurchaseAndroid: Promise<boolean>;
  /**
   * Create the reporting details and external transaction token required by a billing program.
   * Introduced in Play Billing 8.2.0. External Offer and External Content Link integrations
   * must use 8.2.1+ and create fresh details immediately before every redirect session;
   * do not cache the token for a later redirect. The same token may report multiple purchases
   * made during one External Offer session.
   * Replaces the deprecated createExternalOfferReportingDetailsAsync API.
   * Returns external transaction token needed for reporting external transactions.
   * developerBillingType is optional. When program is BILLING_CHOICE and developerBillingType is omitted,
   * native Android defaults it to IN_APP.
   * The Billing Choice extension is available in OpenIAP Spec 2.1.0 /
   * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   * Throws OpenIapError.NotPrepared if billing client not ready.
   * See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android
   */
  createBillingProgramReportingDetailsAndroid: Promise<BillingProgramReportingDetailsAndroid>;
  /**
   * Open the platform's subscription management UI.
   * See: https://openiap.dev/docs/apis/deep-link-to-subscriptions
   */
  deepLinkToSubscriptions: Promise<void>;
  /**
   * Close the store connection and release resources.
   * See: https://openiap.dev/docs/apis/end-connection
   */
  endConnection: Promise<boolean>;
  /**
   * Complete a transaction after server-side verification. Required on Android within 3 days.
   * See: https://openiap.dev/docs/apis/finish-transaction
   */
  finishTransaction: Promise<void>;
  /**
   * Initialize the store connection. Call before any IAP API.
   * See: https://openiap.dev/docs/apis/init-connection
   */
  initConnection: Promise<boolean>;
  /**
   * Check whether a billing program (e.g., External Payments) is available for the current user.
   * Replaces the deprecated isExternalOfferAvailableAsync API.
   * Introduced in Google Play Billing Library 8.2.0. External Offer and External
   * Content Link integrations must use 8.2.1+ because 8.2.1 fixes this API.
   * Returns availability result with isAvailable flag.
   * Throws OpenIapError.NotPrepared if billing client not ready.
   * See: https://openiap.dev/docs/apis/android/is-billing-program-available-android
   */
  isBillingProgramAvailableAndroid: Promise<BillingProgramAvailabilityResultAndroid>;
  /**
   * Launch an external content/offer link from inside the Billing Programs flow (introduced in
   * Play Billing 8.2.0; External Offer and External Content Link require 8.2.1+),
   * including developer-rendered Billing Choice external-link flows.
   * Billing Choice availability: OpenIAP Spec 2.1.0 / openiap-google 2.3.0
   * (requires Play Billing 9.1.0+).
   * Replaces the deprecated showExternalOfferInformationDialog API.
   * Shows Play Store dialog and optionally launches external URL.
   * Throws OpenIapError.NotPrepared if billing client not ready.
   * See: https://openiap.dev/docs/apis/android/launch-external-link-android
   */
  launchExternalLinkAndroid: Promise<boolean>;
  /**
   * Open the Google Play offer/promo code redemption flow so the user can enter a code.
   * On Google Play builds, launches the Play Store redeem page
   * (https://play.google.com/redeem). A purchase listener can receive the redeemed
   * purchase while the app is running with an active billing connection; always
   * reconcile with getAvailablePurchases when the app resumes.
   * Does not require the billing client to be initialized (no Play Billing version requirement).
   * Available in OpenIAP Spec 2.4.2 / openiap-google 2.5.0.
   * Android counterpart of presentCodeRedemptionSheetIOS.
   * Returns true when the redemption flow was launched, or false when the current
   * store flavor does not provide an equivalent redemption flow.
   * See: https://openiap.dev/docs/apis/android/open-redeem-offer-code-android
   */
  openRedeemOfferCodeAndroid: Promise<boolean>;
  /**
   * Show the App Store offer code redemption sheet.
   * When built with Xcode 27+ and running on iOS 27+, Mac Catalyst 27+, or
   * visionOS 27+, returns the verified transaction produced by the redemption.
   * StoreKit 2's scene-based sheet returns null after presentation on iOS 16–26,
   * visionOS 1–26, and those platforms on Apple 27 when built with an older SDK.
   * iOS 15 uses the StoreKit 1 sheet and also returns null. On Mac Catalyst, the
   * scene-based API throws StoreKitError.unknown, while the Catalyst 15 StoreKit 1
   * call has no effect and returns null. Reconcile null results from a presented
   * sheet through the normal transaction listener or an explicit
   * available-purchases refresh.
   * See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios
   */
  presentCodeRedemptionSheetIOS?: Promise<(PurchaseIOS | null)>;
  /**
   * Present an external purchase link, StoreKit External (iOS 16+).
   * See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios
   */
  presentExternalPurchaseLinkIOS: Promise<ExternalPurchaseLinkResultIOS>;
  /**
   * Present the external purchase notice sheet (iOS 17.4+).
   * Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues.
   * Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()
   * See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios
   */
  presentExternalPurchaseNoticeSheetIOS: Promise<ExternalPurchaseNoticeResultIOS>;
  /**
   * Initiate a purchase or subscription flow; rely on events for final state.
   * See: https://openiap.dev/docs/apis/request-purchase
   */
  requestPurchase?: Promise<(Purchase | Purchase[] | null)>;
  /**
   * Restore non-consumable and active subscription purchases.
   * See: https://openiap.dev/docs/apis/restore-purchases
   */
  restorePurchases: Promise<void>;
  /**
   * Show Google's mandatory information dialog before a developer-rendered,
   * in-app Billing Choice screen.
   * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   * Throws OpenIapError.NotPrepared if billing client not ready.
   * See: https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android
   */
  showBillingProgramInformationDialogAndroid: Promise<BillingResultAndroid>;
  /**
   * Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).
   * Call this after a deliberate customer interaction before linking out to external purchases.
   * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
   * See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios
   */
  showExternalPurchaseCustomLinkNoticeIOS: Promise<ExternalPurchaseCustomLinkNoticeResultIOS>;
  /**
   * Overlay Play billing in-app messages, such as payment issues or subscription price-change confirmations.
   * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0
   * (upstream API available since Play Billing 4.1.0).
   * Returns a response code and, when the subscription status changes, the related purchase token.
   * Throws OpenIapError.NotPrepared if billing client not ready.
   * See: https://openiap.dev/docs/apis/android/show-in-app-messages-android
   */
  showInAppMessagesAndroid: Promise<InAppMessageResultAndroid>;
  /**
   * Present the manage-subscriptions sheet and return changed purchases (iOS 15+).
   * See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios
   */
  showManageSubscriptionsIOS: Promise<PurchaseIOS[]>;
  /**
   * Force sync transactions with the App Store (iOS 15+).
   * See: https://openiap.dev/docs/apis/ios/sync-ios
   */
  syncIOS: Promise<boolean>;
  /**
   * Verify a purchase against your own backend. Every VerifyPurchaseResult
   * variant exposes isValid, so entitlement can be gated without inspecting the
   * concrete type. Variants add their own metadata on top: IOS carries
   * receipt/JWS fields, Android carries Play Store receipt fields, and Horizon
   * carries grantTime.
   * See: https://openiap.dev/docs/features/validation#verify-purchase
   */
  verifyPurchase: Promise<VerifyPurchaseResult>;
  /**
   * Verify via a managed provider without standing up your own server. The
   * PurchaseVerificationProvider enum currently exposes only IAPKit; platform
   * availability may differ by implementation.
   * See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider
   */
  verifyPurchaseWithProvider: Promise<VerifyPurchaseWithProviderResult>;
}

export type MutationAcknowledgePurchaseAndroidArgs = string;

export type MutationBeginRefundRequestIosArgs = string;

export type MutationConsumePurchaseAndroidArgs = string;

export interface MutationCreateBillingProgramReportingDetailsAndroidArgs {
  developerBillingType?: (DeveloperBillingTypeAndroid | null);
  program: BillingProgramAndroid;
}

export type MutationDeepLinkToSubscriptionsArgs = (DeepLinkOptions | null) | undefined;

export interface MutationFinishTransactionArgs {
  isConsumable?: (boolean | null);
  purchase: PurchaseInput;
}

export type MutationInitConnectionArgs = (InitConnectionConfig | null) | undefined;

export type MutationIsBillingProgramAvailableAndroidArgs = BillingProgramAndroid;

export type MutationLaunchExternalLinkAndroidArgs = LaunchExternalLinkParamsAndroid;

export type MutationPresentExternalPurchaseLinkIosArgs = string;

export type MutationRequestPurchaseArgs = RequestPurchaseProps;

export type MutationShowBillingProgramInformationDialogAndroidArgs = BillingProgramInformationDialogParamsAndroid;

export type MutationShowExternalPurchaseCustomLinkNoticeIosArgs = ExternalPurchaseCustomLinkNoticeTypeIOS;

export type MutationShowInAppMessagesAndroidArgs = (InAppMessageParamsAndroid | null) | undefined;

export type MutationVerifyPurchaseArgs = VerifyPurchaseProps;

export type MutationVerifyPurchaseWithProviderArgs = VerifyPurchaseWithProviderProps;

/**
 * Payment mode for subscription offers.
 * Determines how the user pays during the offer period.
 */
export type PaymentMode = 'free-trial' | 'pay-as-you-go' | 'pay-up-front' | 'unknown';

export type PaymentModeIOS = 'empty' | 'free-trial' | 'pay-as-you-go' | 'pay-up-front';

/**
 * Pending purchase update for subscription upgrades/downgrades (Android)
 * When a user initiates a subscription change (upgrade/downgrade), the new purchase
 * may be pending until the current billing period ends. This type contains the
 * details of the pending change.
 * Available in Google Play Billing Library 5.0+
 */
export interface PendingPurchaseUpdateAndroid {
  /**
   * Product IDs for the pending purchase update.
   * These are the new products the user is switching to.
   */
  products: string[];
  /**
   * Purchase token for the pending transaction.
   * Use this token to track or manage the pending purchase update.
   */
  purchaseToken: string;
}

/**
 * Pre-order details for one-time purchase products (Android)
 * Available in Google Play Billing Library 8.1.0+
 */
export interface PreorderDetailsAndroid {
  /**
   * Pre-order presale end time in milliseconds since epoch.
   * This is when the presale period ends and the product will be released.
   */
  preorderPresaleEndTimeMillis: string;
  /**
   * Pre-order release time in milliseconds since epoch.
   * This is when the product will be available to users who pre-ordered.
   */
  preorderReleaseTimeMillis: string;
}

export interface PricingPhaseAndroid {
  billingCycleCount: number;
  billingPeriod: string;
  formattedPrice: string;
  priceAmountMicros: string;
  priceCurrencyCode: string;
  recurrenceMode: number;
}

export interface PricingPhasesAndroid {
  pricingPhaseList: PricingPhaseAndroid[];
}

export type Product = ProductAndroid | ProductIOS;

export interface ProductAndroid extends ProductCommon {
  currency: string;
  debugDescription?: (string | null);
  description: string;
  /**
   * Standardized Android one-time product purchase options and offers.
   * Native metadata uses Android-suffixed fields.
   * @see https://openiap.dev/docs/types/discount-offer
   */
  discountOffers?: (DiscountOffer[] | null);
  displayName?: (string | null);
  displayPrice: string;
  id: string;
  nameAndroid: string;
  platform: 'android';
  price?: (number | null);
  /**
   * Product-level status code indicating fetch result (Android 8.0+)
   * OK = product fetched successfully
   * NOT_FOUND = SKU doesn't exist
   * NO_OFFERS_AVAILABLE = user not eligible for any offers
   * Available in Google Play Billing Library 8.0.0+
   */
  productStatusAndroid?: (ProductStatusAndroid | null);
  /**
   * Standardized subscription offers.
   * Cross-platform type with Android-specific fields using suffix.
   * @see https://openiap.dev/docs/types/subscription-offer
   */
  subscriptionOffers?: (SubscriptionOffer[] | null);
  title: string;
  type: 'in-app';
}

export interface ProductCommon {
  currency: string;
  debugDescription?: (string | null);
  description: string;
  displayName?: (string | null);
  displayPrice: string;
  id: string;
  platform: 'android' | 'ios';
  price?: (number | null);
  title: string;
  type: 'in-app' | 'subs';
} 

export interface ProductIOS extends ProductCommon {
  currency: string;
  debugDescription?: (string | null);
  description: string;
  displayName?: (string | null);
  displayNameIOS: string;
  displayPrice: string;
  id: string;
  isFamilyShareableIOS: boolean;
  jsonRepresentationIOS: string;
  platform: 'ios';
  price?: (number | null);
  /**
   * iOS 26.4+ subscription pricing terms, including billing plan metadata for
   * monthly subscriptions with a 12-month commitment.
   */
  pricingTermsIOS?: (SubscriptionPricingTermsIOS[] | null);
  /**
   * Standardized subscription offers.
   * Cross-platform type with iOS-specific fields using suffix.
   * Note: iOS does not support one-time product discounts.
   * @see https://openiap.dev/docs/types/subscription-offer
   */
  subscriptionOffers?: (SubscriptionOffer[] | null);
  title: string;
  type: 'in-app';
  typeIOS: ProductTypeIOS;
}

export type ProductOrSubscription = Product | ProductSubscription;

export type ProductQueryType = 'in-app' | 'subs' | 'all';

export interface ProductRequest {
  skus: string[];
  type?: (ProductQueryType | null);
}

/**
 * Status code for individual products returned from queryProductDetailsAsync (Android)
 * Prior to 8.0, products that couldn't be fetched were simply not returned.
 * With 8.0+, these products are returned with a status code explaining why.
 * Available in Google Play Billing Library 8.0.0+
 */
export type ProductStatusAndroid = 'ok' | 'not-found' | 'no-offers-available' | 'unknown';

export type ProductSubscription = ProductSubscriptionAndroid | ProductSubscriptionIOS;

export interface ProductSubscriptionAndroid extends ProductCommon {
  currency: string;
  debugDescription?: (string | null);
  description: string;
  displayName?: (string | null);
  displayPrice: string;
  id: string;
  nameAndroid: string;
  platform: 'android';
  price?: (number | null);
  /**
   * Product-level status code indicating fetch result (Android 8.0+)
   * OK = product fetched successfully
   * NOT_FOUND = SKU doesn't exist
   * NO_OFFERS_AVAILABLE = user not eligible for any offers
   * Available in Google Play Billing Library 8.0.0+
   */
  productStatusAndroid?: (ProductStatusAndroid | null);
  /**
   * Standardized subscription offers.
   * Cross-platform type with Android-specific fields using suffix.
   * @see https://openiap.dev/docs/types/subscription-offer
   */
  subscriptionOffers: SubscriptionOffer[];
  title: string;
  type: 'subs';
}

export interface ProductSubscriptionIOS extends ProductCommon {
  /**
   * Subscriptions included in this Apple subscription bundle. Empty or null for
   * every other product type (Apple 27+ beta).
   */
  bundledSubscriptionsIOS?: (BundledSubscriptionIOS[] | null);
  currency: string;
  debugDescription?: (string | null);
  description: string;
  displayName?: (string | null);
  displayNameIOS: string;
  displayPrice: string;
  id: string;
  introductoryPriceAsAmountIOS?: (string | null);
  introductoryPriceIOS?: (string | null);
  introductoryPriceNumberOfPeriodsIOS?: (string | null);
  introductoryPricePaymentModeIOS: PaymentModeIOS;
  introductoryPriceSubscriptionPeriodIOS?: (SubscriptionPeriodIOS | null);
  isFamilyShareableIOS: boolean;
  jsonRepresentationIOS: string;
  platform: 'ios';
  price?: (number | null);
  /**
   * iOS 26.4+ subscription pricing terms, including billing plan metadata for
   * monthly subscriptions with a 12-month commitment.
   */
  pricingTermsIOS?: (SubscriptionPricingTermsIOS[] | null);
  /** App Store subscription group identifier for intro-offer eligibility checks. */
  subscriptionGroupIdIOS?: (string | null);
  /**
   * Standardized subscription offers.
   * Cross-platform type with iOS-specific fields using suffix.
   * @see https://openiap.dev/docs/types/subscription-offer
   */
  subscriptionOffers?: (SubscriptionOffer[] | null);
  subscriptionPeriodNumberIOS?: (string | null);
  subscriptionPeriodUnitIOS?: (SubscriptionPeriodIOS | null);
  title: string;
  type: 'subs';
  typeIOS: ProductTypeIOS;
}

export type ProductType = 'in-app' | 'subs';

export type ProductTypeIOS = 'consumable' | 'non-consumable' | 'auto-renewable-subscription' | 'non-renewing-subscription' | 'subscription-bundle' | 'subscription-suite';

/**
 * JWS promotional offer input for iOS 15+ (StoreKit 2, WWDC 2025).
 * New signature format using compact JWS string for promotional offers.
 * This provides a simpler alternative to the legacy signature-based promotional offers.
 * Back-deployed to iOS 15.
 */
export interface PromotionalOfferJwsInputIOS {
  /**
   * Compact JWS string signed by your server.
   * The JWS should contain the promotional offer signature data.
   * Format: header.payload.signature (base64url encoded)
   */
  jws: string;
  /** The promotional offer identifier from App Store Connect */
  offerId: string;
}

export type Purchase = PurchaseAndroid | PurchaseIOS;

export interface PurchaseAndroid extends PurchaseCommon {
  autoRenewingAndroid?: (boolean | null);
  currentPlanId?: (string | null);
  dataAndroid?: (string | null);
  developerPayloadAndroid?: (string | null);
  id: string;
  ids?: (string[] | null);
  isAcknowledgedAndroid?: (boolean | null);
  isAutoRenewing: boolean;
  /**
   * Whether the subscription is suspended (Android)
   * A suspended subscription means the user's payment method failed and they need to fix it.
   * Users should be directed to the subscription center to resolve the issue.
   * Do NOT grant entitlements for suspended subscriptions.
   * Available in Google Play Billing Library 8.1.0+
   */
  isSuspendedAndroid?: (boolean | null);
  obfuscatedAccountIdAndroid?: (string | null);
  obfuscatedProfileIdAndroid?: (string | null);
  packageNameAndroid?: (string | null);
  /**
   * Pending purchase update for uncommitted subscription upgrade/downgrade (Android)
   * Contains the new products and purchase token for the pending transaction.
   * Returns null if no pending update exists.
   * Available in Google Play Billing Library 5.0+
   */
  pendingPurchaseUpdateAndroid?: (PendingPurchaseUpdateAndroid | null);
  productId: string;
  purchaseState: PurchaseState;
  purchaseToken?: (string | null);
  quantity: number;
  signatureAndroid?: (string | null);
  /** Store where purchase was made */
  store: IapStore;
  /** Unix timestamp in milliseconds since January 1, 1970 UTC. */
  transactionDate: number;
  transactionId?: (string | null);
  /**
   * Amazon Appstore user id (PurchaseResponse.getUserData().getUserId()).
   * Only populated on the Amazon flavor; required for server-side Amazon RVS
   * receipt verification (userId + receiptId). Null on Google Play and Horizon.
   */
  userIdAmazon?: (string | null);
  /**
   * Amazon Appstore marketplace (PurchaseResponse.getUserData().getMarketplace()),
   * for example "US" or "FR". Only populated on the Amazon flavor.
   */
  userMarketplaceAmazon?: (string | null);
}

export interface PurchaseCommon {
  /**
   * The current plan identifier. This is:
   * - On Android: the basePlanId (e.g., "premium", "premium-year")
   * - On iOS: the productId (e.g., "com.example.premium_monthly", "com.example.premium_yearly")
   * This provides a unified way to identify which specific plan/tier the user is subscribed to.
   */
  currentPlanId?: (string | null);
  id: string;
  ids?: (string[] | null);
  isAutoRenewing: boolean;
  productId: string;
  purchaseState: PurchaseState;
  /** Unified purchase token (iOS JWS, Android purchaseToken) */
  purchaseToken?: (string | null);
  quantity: number;
  /** Store where purchase was made */
  store: IapStore;
  /** Unix timestamp in milliseconds since January 1, 1970 UTC. */
  transactionDate: number;
}

export interface PurchaseError {
  code: ErrorCode;
  debugMessage?: (string | null);
  isEmptyProductList?: (boolean | null);
  message: string;
  productId?: (string | null);
  productIds?: (string[] | null);
  productType?: (string | null);
  responseCode?: (number | null);
  subResponseCodeAndroid?: (SubResponseCodeAndroid | null);
}

export interface PurchaseIOS extends PurchaseCommon {
  /**
   * Advanced Commerce API metadata (iOS 18.4+).
   * Present only for transactions that use the Advanced Commerce API.
   * Contains item details, tax information, and refund data for generic SKU purchases.
   */
  advancedCommerceInfoIOS?: (AdvancedCommerceInfoIOS | null);
  appAccountToken?: (string | null);
  appBundleIdIOS?: (string | null);
  /** iOS 26.4+ billing plan selected for this transaction. */
  billingPlanTypeIOS?: (SubscriptionBillingPlanTypeIOS | null);
  /**
   * Original transaction identifier for the subscription bundle that produced
   * this transaction (Apple 27+ SDK; back-deployed by StoreKit).
   */
  bundleOriginalTransactionIdIOS?: (string | null);
  /** Product identifier of the subscription bundle that produced this transaction. */
  bundleProductIdIOS?: (string | null);
  /** Subscription-group identifier of the bundle that produced this transaction. */
  bundleSubscriptionGroupIdIOS?: (string | null);
  /** Bundle transaction identifier associated with this component transaction. */
  bundleTransactionIdIOS?: (string | null);
  /** iOS 26.4+ progress information for monthly subscriptions with a 12-month commitment. */
  commitmentInfoIOS?: (TransactionCommitmentInfoIOS | null);
  countryCodeIOS?: (string | null);
  currencyCodeIOS?: (string | null);
  currencySymbolIOS?: (string | null);
  currentPlanId?: (string | null);
  environmentIOS?: (string | null);
  expirationDateIOS?: (number | null);
  id: string;
  ids?: (string[] | null);
  isAutoRenewing: boolean;
  isUpgradedIOS?: (boolean | null);
  offerIOS?: (PurchaseOfferIOS | null);
  originalTransactionDateIOS?: (number | null);
  originalTransactionIdentifierIOS?: (string | null);
  /** StoreKit ownership raw value. Xcode 27 adds the back-deployed assigned value. */
  ownershipTypeIOS?: (string | null);
  /**
   * Original transaction identifier replaced when moving between a standalone
   * subscription and a subscription bundle.
   */
  previousOriginalTransactionIdIOS?: (string | null);
  productId: string;
  purchaseState: PurchaseState;
  purchaseToken?: (string | null);
  quantity: number;
  quantityIOS?: (number | null);
  reasonIOS?: (string | null);
  reasonStringRepresentationIOS?: (string | null);
  renewalInfoIOS?: (RenewalInfoIOS | null);
  revocationDateIOS?: (number | null);
  /** Normalized StoreKit revocation reason, including upgraded_to_bundle. */
  revocationReasonIOS?: (string | null);
  /**
   * StoreKit revocation type, including assignment-revocation on Apple 26.4+
   * when compiled with the Xcode 27 SDK.
   */
  revocationTypeIOS?: (string | null);
  /** Store where purchase was made */
  store: IapStore;
  storefrontCountryCodeIOS?: (string | null);
  subscriptionGroupIdIOS?: (string | null);
  /** Unix timestamp in milliseconds since January 1, 1970 UTC. */
  transactionDate: number;
  transactionId: string;
  transactionReasonIOS?: (string | null);
  webOrderLineItemIdIOS?: (string | null);
}

export type PurchaseInput = Purchase;

export interface PurchaseOfferIOS {
  id: string;
  paymentMode: string;
  type: string;
}

export interface PurchaseOptions {
  /** Also emit results through the iOS event listeners */
  alsoPublishToEventListenerIOS?: (boolean | null);
  /**
   * Include suspended subscriptions in the result (Android 8.1+).
   * Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
   * Users should be directed to the subscription center to resolve payment issues.
   * Default: false (only active subscriptions are returned)
   */
  includeSuspendedAndroid?: (boolean | null);
  /** Limit to currently active items on iOS */
  onlyIncludeActiveItemsIOS?: (boolean | null);
}

export type PurchaseState = 'pending' | 'purchased' | 'unknown';

export interface PurchaseUpdatedListenerOptions {
  /**
   * iOS only. Defaults to true. When false, listener callbacks also receive
   * StoreKit replay events for a transaction ID that was already emitted during
   * the current connection session. Android ignores this option.
   */
  dedupeTransactionIOS?: (boolean | null);
}

export type PurchaseVerificationProvider = 'iapkit';

export interface Query {
  /**
   * Check eligibility for the external purchase notice sheet (iOS 17.4+).
   * Uses ExternalPurchase.canPresent.
   * See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios
   */
  canPresentExternalPurchaseNoticeIOS: Promise<boolean>;
  /**
   * Get the user's current entitlement for a product, using StoreKit 2 (iOS 15+).
   * See: https://openiap.dev/docs/apis/ios/current-entitlement-ios
   */
  currentEntitlementIOS?: Promise<(PurchaseIOS | null)>;
  /**
   * Fetch products or subscriptions from the store.
   * See: https://openiap.dev/docs/apis/fetch-products
   */
  fetchProducts: Promise<(ProductOrSubscription[] | Product[] | ProductSubscription[] | null)>;
  /**
   * Get details of all currently active subscriptions (filters by subscriptionIds when provided).
   * See: https://openiap.dev/docs/apis/get-active-subscriptions
   */
  getActiveSubscriptions: Promise<ActiveSubscription[]>;
  /**
   * List every StoreKit transaction (finished + unfinished) for the current user.
   * Requires the SKIncludeConsumableInAppPurchaseHistory Info.plist key in the host app
   * for finished consumables to be included (iOS 18+).
   * Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape.
   * See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios
   */
  getAllTransactionsIOS: Promise<PurchaseIOS[]>;
  /**
   * Fetch the app transaction (iOS 16+).
   * See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios
   */
  getAppTransactionIOS?: Promise<(AppTransaction | null)>;
  /**
   * List active purchases for the current user.
   * See: https://openiap.dev/docs/apis/get-available-purchases
   */
  getAvailablePurchases: Promise<Purchase[]>;
  /**
   * Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens.
   * OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   * Throws OpenIapError.NotPrepared if billing client is not ready.
   * See: https://openiap.dev/docs/apis/android/get-billing-choice-info-android
   */
  getBillingChoiceInfoAndroid: Promise<BillingChoiceInfoAndroid>;
  /**
   * Fetch a token for Apple's External Purchase Server reporting API (iOS 18.1+).
   * Use this token to report transactions made through ExternalPurchaseCustomLink.
   * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
   * See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios
   */
  getExternalPurchaseCustomLinkTokenIOS: Promise<ExternalPurchaseCustomLinkTokenResultIOS>;
  /**
   * List unfinished StoreKit transactions in the queue.
   * See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios
   */
  getPendingTransactionsIOS: Promise<PurchaseIOS[]>;
  /**
   * Read the App Store-promoted product, if any (iOS 15+).
   * OpenIAP consumes PurchaseIntent.intents on iOS 16.4+ and uses the
   * StoreKit 1 observer only on iOS 15–16.3. When PurchaseIntent carries an
   * externally redeemed win-back offer, OpenIAP preserves it for the next
   * matching requestPurchase unless the caller supplies an explicit win-back or
   * promotional offer.
   * See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios
   */
  getPromotedProductIOS?: Promise<(ProductIOS | null)>;
  /**
   * Get base64-encoded receipt data (legacy validation).
   * See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios
   */
  getReceiptDataIOS?: Promise<(string | null)>;
  /**
   * Return the store-authoritative country code: ISO 3166-1 alpha-3 on Apple
   * platforms and alpha-2 on Android. The operation fails when the store cannot
   * provide a value; implementations must not synthesize a locale fallback.
   * See: https://openiap.dev/docs/apis/get-storefront
   */
  getStorefront: Promise<string>;
  /**
   * Return the JWS string for a transaction (StoreKit 2).
   * See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios
   */
  getTransactionJwsIOS?: Promise<(string | null)>;
  /**
   * Check whether the user has any active subscription.
   * See: https://openiap.dev/docs/apis/has-active-subscriptions
   */
  hasActiveSubscriptions: Promise<boolean>;
  /**
   * Check eligibility for the custom-link variant of external purchase (iOS 18.1+).
   * Returns true if the app can use custom external purchase links.
   * Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
   * See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios
   */
  isEligibleForExternalPurchaseCustomLinkIOS: Promise<boolean>;
  /**
   * Check intro-offer eligibility for a subscription group.
   * See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios
   */
  isEligibleForIntroOfferIOS: Promise<boolean>;
  /**
   * Check whether a transaction's JWS verification passed (StoreKit 2).
   * See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios
   */
  isTransactionVerifiedIOS: Promise<boolean>;
  /**
   * Get the latest verified transaction for a product, using StoreKit 2.
   * See: https://openiap.dev/docs/apis/ios/latest-transaction-ios
   */
  latestTransactionIOS?: Promise<(PurchaseIOS | null)>;
  /**
   * Get subscription status objects from StoreKit 2 (iOS 15+).
   * See: https://openiap.dev/docs/apis/ios/subscription-status-ios
   */
  subscriptionStatusIOS: Promise<SubscriptionStatusIOS[]>;
}

export type QueryCurrentEntitlementIosArgs = string;

export type QueryFetchProductsArgs = ProductRequest;

export type QueryGetActiveSubscriptionsArgs = (string[] | null) | undefined;

export type QueryGetAvailablePurchasesArgs = (PurchaseOptions | null) | undefined;

export type QueryGetBillingChoiceInfoAndroidArgs = GetBillingChoiceInfoParamsAndroid;

export type QueryGetExternalPurchaseCustomLinkTokenIosArgs = ExternalPurchaseCustomLinkTokenTypeIOS;

export type QueryGetTransactionJwsIosArgs = string;

export type QueryHasActiveSubscriptionsArgs = (string[] | null) | undefined;

export type QueryIsEligibleForIntroOfferIosArgs = string;

export type QueryIsTransactionVerifiedIosArgs = string;

export type QueryLatestTransactionIosArgs = string;

export type QuerySubscriptionStatusIosArgs = string;

export interface RefundResultIOS {
  message?: (string | null);
  status: string;
}

export interface RenewalCommitmentInfoIOS {
  commitmentAutoRenewProductId: string;
  commitmentAutoRenewStatus: boolean;
  commitmentRenewalBillingPlanType: SubscriptionBillingPlanTypeIOS;
  commitmentRenewalDate: number;
  commitmentRenewalPrice: number;
}

/**
 * Subscription renewal information from Product.SubscriptionInfo.RenewalInfo
 * https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
 */
export interface RenewalInfoIOS {
  autoRenewPreference?: (string | null);
  /** Original transaction identifier for the bundle used by the next renewal. */
  bundleOriginalTransactionId?: (string | null);
  /** Product identifier for the bundle used by the next renewal. */
  bundleProductId?: (string | null);
  /** Subscription-group identifier for the bundle used by the next renewal. */
  bundleSubscriptionGroupId?: (string | null);
  /**
   * iOS 26.4+ renewal commitment metadata for monthly subscriptions with a
   * 12-month commitment.
   */
  commitmentInfo?: (RenewalCommitmentInfoIOS | null);
  /**
   * StoreKit's raw integer expiration-reason value represented as a string.
   * Xcode 27 adds the back-deployed unbundled case. Preserve unknown future values.
   */
  expirationReason?: (string | null);
  /**
   * Grace period expiration date (milliseconds since epoch)
   * When set, subscription is in grace period (billing issue but still has access)
   */
  gracePeriodExpirationDate?: (number | null);
  /**
   * True if subscription failed to renew due to billing issue and is retrying
   * StoreKit exposes this directly as RenewalInfo.isInBillingRetry.
   */
  isInBillingRetry?: (boolean | null);
  jsonRepresentation?: (string | null);
  /**
   * Product ID that will be used on next renewal (when user upgrades/downgrades)
   * If set and different from current productId, subscription will change on expiration
   */
  pendingUpgradeProductId?: (string | null);
  /**
   * User's response to subscription price increase
   * Possible values: "AGREED", "PENDING", null (no price increase)
   */
  priceIncreaseStatus?: (string | null);
  /** iOS 26.4+ billing plan that will renew after the current period. */
  renewalBillingPlanType?: (SubscriptionBillingPlanTypeIOS | null);
  /**
   * Expected renewal date (milliseconds since epoch)
   * For active subscriptions, when the next renewal/charge will occur
   */
  renewalDate?: (number | null);
  /** Offer ID applied to next renewal (promotional offer, subscription offer code, etc.) */
  renewalOfferId?: (string | null);
  /**
   * Type of offer applied to next renewal
   * Possible values: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE", "WIN_BACK", etc.
   */
  renewalOfferType?: (string | null);
  willAutoRenew: boolean;
  /** Whether this subscription will leave its bundle and renew standalone. */
  willUnbundle?: (boolean | null);
}

/**
 * Rental details for one-time purchase products that can be rented (Android)
 * Available in Google Play Billing Library 8.0+
 */
export interface RentalDetailsAndroid {
  /**
   * Rental expiration period in ISO 8601 format
   * Time after rental period ends when user can still extend
   */
  rentalExpirationPeriod?: (string | null);
  /** Rental period in ISO 8601 format (e.g., P7D for 7 days) */
  rentalPeriod: string;
}

export interface RequestPurchaseAndroidProps {
  /**
   * Developer billing option parameters for external payments and Billing Choice.
   * Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
   * (requires Play Billing 9.1.0+).
   */
  developerBillingOption?: (DeveloperBillingOptionParamsAndroid | null);
  /**
   * Personalized offer flag.
   * When true, indicates the price was customized for this user.
   */
  isOfferPersonalized?: (boolean | null);
  /** Obfuscated account ID */
  obfuscatedAccountId?: (string | null);
  /** Obfuscated profile ID */
  obfuscatedProfileId?: (string | null);
  /**
   * Offer token for one-time purchase discounts (8.0+).
   * Pass the offerToken from discountOffers
   * to apply a discount offer to the purchase.
   */
  offerToken?: (string | null);
  /** List of product SKUs */
  skus: string[];
}

export interface RequestPurchaseIosProps {
  /**
   * Advanced commerce data token (iOS 15+).
   * Used with StoreKit 2's Product.PurchaseOption.custom API for passing
   * campaign tokens, affiliate IDs, or other attribution data.
   * The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
   */
  advancedCommerceData?: (string | null);
  /** Auto-finish transaction (dangerous) */
  andDangerouslyFinishTransactionAutomatically?: (boolean | null);
  /** App account token for user tracking */
  appAccountToken?: (string | null);
  /** Purchase quantity */
  quantity?: (number | null);
  /** Product SKU */
  sku: string;
  /**
   * Promotional offer to apply (subscriptions only, ignored for one-time purchases).
   * iOS only supports promotional offers for auto-renewable subscriptions.
   */
  withOffer?: (DiscountOfferInputIOS | null);
}

export type RequestPurchaseProps =
  | {
      /** Per-platform purchase request props */
      request: RequestPurchasePropsByPlatforms;
      /** Explicit purchase type hint (defaults to in-app) */
      type: 'in-app';
    }
  | {
      /** Per-platform subscription request props */
      request: RequestSubscriptionPropsByPlatforms;
      /** Explicit purchase type hint (defaults to in-app) */
      type: 'subs';
    };

/**
 * Platform-specific purchase request parameters.
 *
 * Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
 * - apple: Always targets App Store
 * - google: Targets Play Store by default, Horizon when built with horizon flavor,
 *   or Fire OS when built with amazon flavor
 *   (determined at build time, not runtime)
 */
export interface RequestPurchasePropsByPlatforms {
  /** Apple-specific purchase parameters */
  apple?: (RequestPurchaseIosProps | null);
  /** Google-specific purchase parameters */
  google?: (RequestPurchaseAndroidProps | null);
}

export type RequestPurchaseResult = Purchase | Purchase[] | null;

export interface RequestSubscriptionAndroidProps {
  /**
   * Developer billing option parameters for external payments and Billing Choice.
   * Billing Choice is available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
   * (requires Play Billing 9.1.0+).
   */
  developerBillingOption?: (DeveloperBillingOptionParamsAndroid | null);
  /**
   * Personalized offer flag.
   * When true, indicates the price was customized for this user.
   */
  isOfferPersonalized?: (boolean | null);
  /** Obfuscated account ID */
  obfuscatedAccountId?: (string | null);
  /** Obfuscated profile ID */
  obfuscatedProfileId?: (string | null);
  /**
   * Original external transaction ID for replacing a subscription that was
   * purchased through developer billing. Available in OpenIAP Spec 2.1.0 /
   * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   */
  originalExternalTransactionId?: (string | null);
  /** Purchase token for upgrades/downgrades */
  purchaseToken?: (string | null);
  /** List of subscription SKUs */
  skus: string[];
  /** Subscription offers */
  subscriptionOffers?: (AndroidSubscriptionOfferInput[] | null);
  /**
   * Product-level replacement parameters (8.1.0+)
   * Use this instead of replacementMode for item-level replacement
   * This singular form requires skus to contain exactly one target product.
   * Multi-item subscription changes need a per-target replacement mapping and
   * are rejected rather than applying one oldProductId to multiple products.
   */
  subscriptionProductReplacementParams?: (SubscriptionProductReplacementParamsAndroid | null);
}

export interface RequestSubscriptionIosProps {
  /**
   * Advanced commerce data token (iOS 15+).
   * Used with StoreKit 2's Product.PurchaseOption.custom API for passing
   * campaign tokens, affiliate IDs, or other attribution data.
   * The data is formatted as JSON: {"signatureInfo": {"token": "<value>"}}
   */
  advancedCommerceData?: (string | null);
  andDangerouslyFinishTransactionAutomatically?: (boolean | null);
  appAccountToken?: (string | null);
  /**
   * Billing plan to use when purchasing an annual subscription that offers
   * monthly billing with a 12-month commitment (iOS 26.4+).
   */
  billingPlanType?: (SubscriptionBillingPlanTypeIOS | null);
  /**
   * Compact JWS string for overriding introductory offer eligibility
   * (iOS 15+, WWDC 2025). When nil, the system determines eligibility.
   * Generate the JWS on your server and pass it to StoreKit's
   * introductoryOfferEligibility(compactJWS:) purchase option.
   */
  compactJWS?: (string | null);
  /**
   * JWS promotional offer (iOS 15+, WWDC 2025).
   * New signature format using compact JWS string for promotional offers.
   * Back-deployed to iOS 15.
   */
  promotionalOfferJWS?: (PromotionalOfferJwsInputIOS | null);
  quantity?: (number | null);
  sku: string;
  /**
   * Win-back offer to apply (iOS 18+)
   * Used to re-engage churned subscribers with a discount or free trial.
   * The offer is available when the customer is eligible and can be discovered
   * via StoreKit Message (automatic) or subscription offer APIs.
   */
  winBackOffer?: (WinBackOfferInputIOS | null);
  /**
   * Promotional offer to apply for subscription purchases.
   * Requires server-signed offer with nonce, timestamp, keyId, and signature.
   */
  withOffer?: (DiscountOfferInputIOS | null);
}

/**
 * Platform-specific subscription request parameters.
 *
 * Note: "Platforms" refers to the SDK/OS level (apple, google), not the store.
 * - apple: Always targets App Store
 * - google: Targets Play Store by default, Horizon when built with horizon flavor,
 *   or Fire OS when built with amazon flavor
 *   (determined at build time, not runtime)
 */
export interface RequestSubscriptionPropsByPlatforms {
  /** Apple-specific subscription parameters */
  apple?: (RequestSubscriptionIosProps | null);
  /** Google-specific subscription parameters */
  google?: (RequestSubscriptionAndroidProps | null);
}

export interface RequestVerifyPurchaseWithIapkitAmazonProps {
  /**
   * Available in OpenIAP Spec 3.2.0 / openiap-apple 3.2.0 / openiap-google 3.3.0.
   * Optional Amazon product id that must match the product id verified by RVS.
   */
  expectedProductId?: (string | null);
  /** Amazon Appstore receipt id returned by PurchaseResponse.getReceipt().getReceiptId(). */
  receiptId: string;
  /** Use Amazon RVS Cloud Sandbox for App Tester receipts. */
  sandbox?: (boolean | null);
  /** Amazon Appstore user id returned by PurchaseResponse.getUserData().getUserId(). */
  userId?: (string | null);
}

export interface RequestVerifyPurchaseWithIapkitAppleProps {
  /** The JWS token returned with the purchase response. */
  jws: string;
}

export interface RequestVerifyPurchaseWithIapkitGoogleProps {
  /** The token provided to the user's device when the product or subscription was purchased. */
  purchaseToken: string;
}

/**
 * Platform-specific verification parameters for IAPKit.
 *
 * - apple: Verifies via App Store (JWS token)
 * - google: Verifies via Play Store (purchase token)
 * - amazon: Verifies via Amazon Appstore RVS (userId + receiptId)
 */
export interface RequestVerifyPurchaseWithIapkitProps {
  /** Amazon Appstore verification parameters. */
  amazon?: (RequestVerifyPurchaseWithIapkitAmazonProps | null);
  /** API key used for the Authorization header (Bearer {apiKey}). */
  apiKey?: (string | null);
  /** Apple App Store verification parameters. */
  apple?: (RequestVerifyPurchaseWithIapkitAppleProps | null);
  /**
   * Available in OpenIAP Spec 2.3.1 / openiap-apple 2.4.0 / openiap-google 2.4.0.
   * Base URL for the IAPKit server. Defaults to https://kit.openiap.dev.
   * Set this to a reachable HTTP(S) origin when self-hosting or testing a local IAPKit server.
   * The apiKey must be issued by the same IAPKit/Convex deployment as this server.
   */
  baseUrl?: (string | null);
  /** Google Play Store verification parameters. */
  google?: (RequestVerifyPurchaseWithIapkitGoogleProps | null);
  /**
   * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
   * Include the product's public IAPKit client payload in a valid Apple or
   * Google verification response. Defaults to false so existing response
   * shapes and bandwidth remain unchanged.
   */
  includeClientPayload?: (boolean | null);
}

export interface RequestVerifyPurchaseWithIapkitResult {
  /**
   * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
   * Public product payload when includeClientPayload was requested, the
   * Apple or Google receipt is valid, and a payload exists for that product.
   */
  clientPayload?: (IapkitProductClientPayload | null);
  /**
   * Available in OpenIAP Spec 3.2.0 / openiap-apple 3.2.0 / openiap-google 3.3.0.
   * Amazon RVS environment selected by IAPKit. Present as `Sandbox` or
   * `Production` on handled Amazon verification results.
   *
   * Deliberately String, not an enum: the value space belongs to IAPKit and the
   * stores behind it, and Apple's App Store Server alone also names `Xcode` and
   * `LocalTesting`. SDKs must forward this value opaquely. Never reject a
   * verification because the environment is unrecognised — that fails a purchase
   * the store already confirmed.
   */
  environment?: (string | null);
  /**
   * True when the purchase is valid and actionable.
   * Only entitled, pending-acknowledgment, or ready-to-consume return true.
   * Callers must still match productId and use the platform plus app-owned product
   * type to choose the fulfillment path.
   */
  isValid: boolean;
  /**
   * Available in OpenIAP Spec 2.4.0 / openiap-apple 2.4.1 / openiap-google 2.4.1.
   * Store-verified product identifier when the provider returns one.
   */
  productId?: (string | null);
  /** The current state of the purchase. */
  state: IapkitPurchaseState;
  store: IapStore;
}

/**
 * Sub-response codes for more granular purchase error information (Android)
 * Available in Google Play Billing Library 8.0.0+
 */
export type SubResponseCodeAndroid = 'no-applicable-sub-response-code' | 'payment-declined-due-to-insufficient-funds' | 'user-ineligible';

export interface Subscription {
  /**
   * Fires when a user selects developer billing in an External Payments or
   * Billing Choice flow (Android only). The payload can contain an external
   * transaction token, link URI, original transaction ID, and selected products.
   * Billing Choice payload fields are available in OpenIAP Spec 2.1.0 /
   * openiap-google 2.3.0 (requires Play Billing 9.1.0+).
   */
  developerProvidedBillingAndroid: DeveloperProvidedBillingDetailsAndroid;
  /**
   * Fires when the App Store surfaces a promoted product (iOS only).
   * A win-back offer attached to PurchaseIntent is preserved for the next
   * matching requestPurchase unless the caller supplies an explicit win-back or
   * promotional offer.
   */
  promotedProductIOS: string;
  /** Fires when a purchase fails or is cancelled */
  purchaseError: PurchaseError;
  /**
   * Fires when a purchase completes successfully or a pending purchase resolves
   * Options can opt iOS listeners into duplicate StoreKit transaction replays
   * for diagnostics; default listeners receive one event per transaction ID
   * during a single connection session.
   */
  purchaseUpdated: Purchase;
  /**
   * Fires when a subscription enters a billing-issue state that needs user action
   * (payment method failed, card expired, etc.). Cross-platform unification:
   *
   * - iOS 16.4+ / Mac Catalyst 16.4+ / visionOS 1.0+: delivered via StoreKit 2
   *   `Message.Reason.billingIssue`.
   * - Android (Play flavor, Billing 8.1+): emitted when `isSuspended == true` is first detected
   *   on a previously healthy subscription. Requires Google Play Billing Library 8.1.0 or newer.
   * - Android (Horizon flavor): NOT emitted. The Horizon Billing Compatibility SDK implements
   *   the Play Billing 7.0 API surface which does not expose a suspended-subscription signal.
   * - Android (Amazon flavor): NOT emitted. Amazon Appstore IAP does not expose an
   *   equivalent subscription billing-issue signal.
   *
   * Listeners should not assume the event will fire on every store. Direct users to the
   * platform subscription management UI (`deepLinkToSubscriptions`) to resolve the issue.
   */
  subscriptionBillingIssue: Purchase;
  /**
   * Fires when a user selects alternative billing in the User Choice Billing dialog (Android only)
   * Only triggered when the user selects alternative billing instead of Google Play billing
   */
  userChoiceBillingAndroid: UserChoiceBillingDetails;
}

export type SubscriptionPurchaseUpdatedArgs = (PurchaseUpdatedListenerOptions | null) | undefined;

export type SubscriptionBillingPlanTypeIOS = 'unknown' | 'monthly' | 'up-front';

export interface SubscriptionCommitmentInfoIOS {
  displayPrice: string;
  period: SubscriptionPeriodValueIOS;
  price: number;
}

/**
 * Standardized subscription discount/promotional offer.
 * Provides a unified interface for subscription offers across iOS and Android.
 *
 * Both platforms support subscription offers with different implementations:
 * - iOS: Introductory offers, promotional offers with server-side signatures
 * - Android: Offer tokens with pricing phases
 *
 * @see https://openiap.dev/docs/types/subscription-offer
 */
export interface SubscriptionOffer {
  /**
   * [Android] Base plan identifier.
   * Identifies which base plan this offer belongs to.
   */
  basePlanIdAndroid?: (string | null);
  /** Currency code (ISO 4217, e.g., "USD") */
  currency?: (string | null);
  /** Formatted display price string (e.g., "$9.99/month") */
  displayPrice: string;
  /**
   * Unique identifier for the offer.
   * - iOS: Discount identifier from App Store Connect
   * - Android: offerId from the Google Play subscription offer
   */
  id: string;
  /**
   * [Android] Installment plan details for this subscription offer.
   * Only set for installment subscription plans; null for non-installment plans.
   * Available in Google Play Billing Library 7.0+
   */
  installmentPlanDetailsAndroid?: (InstallmentPlanDetailsAndroid | null);
  /**
   * [iOS] Key identifier for signature validation.
   * Used with server-side signature generation for promotional offers.
   */
  keyIdentifierIOS?: (string | null);
  /** [iOS] Localized price string. */
  localizedPriceIOS?: (string | null);
  /**
   * [iOS] Cryptographic nonce (UUID) for signature validation.
   * Must be generated server-side for each purchase attempt.
   */
  nonceIOS?: (string | null);
  /** [iOS] Number of billing periods for this discount. */
  numberOfPeriodsIOS?: (number | null);
  /** [Android] List of tags associated with this offer. */
  offerTagsAndroid?: (string[] | null);
  /**
   * [Android] Offer token required for purchase.
   * Must be passed to requestPurchase() when purchasing with this offer.
   */
  offerTokenAndroid?: (string | null);
  /** Payment mode during the offer period */
  paymentMode?: (PaymentMode | null);
  /** Subscription period for this offer */
  period?: (SubscriptionPeriod | null);
  /** Number of periods the offer applies */
  periodCount?: (number | null);
  /** Numeric price value */
  price: number;
  /**
   * [Android] Pricing phases for this subscription offer.
   * Contains detailed pricing information for each phase (trial, intro, regular).
   */
  pricingPhasesAndroid?: (PricingPhasesAndroid | null);
  /**
   * [iOS] Server-generated signature for promotional offer validation.
   * Required when applying promotional offers on iOS.
   */
  signatureIOS?: (string | null);
  /**
   * [iOS] Timestamp when the signature was generated.
   * Used for signature validation.
   */
  timestampIOS?: (number | null);
  /** Type of subscription offer (Introductory or Promotional) */
  type: DiscountOfferType;
}

export type SubscriptionOfferTypeIOS = 'introductory' | 'promotional' | 'win-back';

/** Subscription period value combining unit and count. */
export interface SubscriptionPeriod {
  /** The period unit (day, week, month, year) */
  unit: SubscriptionPeriodUnit;
  /** The number of units (e.g., 1 for monthly, 3 for quarterly) */
  value: number;
}

export type SubscriptionPeriodIOS = 'day' | 'week' | 'month' | 'year' | 'empty';

/** Subscription period unit for cross-platform use. */
export type SubscriptionPeriodUnit = 'day' | 'week' | 'month' | 'year' | 'unknown';

export interface SubscriptionPeriodValueIOS {
  unit: SubscriptionPeriodIOS;
  value: number;
}

export interface SubscriptionPricingTermsIOS {
  billingDisplayPrice: string;
  billingPeriod: SubscriptionPeriodValueIOS;
  billingPlanType: SubscriptionBillingPlanTypeIOS;
  billingPrice: number;
  commitmentInfo: SubscriptionCommitmentInfoIOS;
  subscriptionOffers?: (SubscriptionOffer[] | null);
}

/**
 * Product-level subscription replacement parameters (Android)
 * Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams
 * Available in Google Play Billing Library 8.1.0+
 */
export interface SubscriptionProductReplacementParamsAndroid {
  /** The old product ID that needs to be replaced */
  oldProductId: string;
  /** The replacement mode for this product change */
  replacementMode: SubscriptionReplacementModeAndroid;
}

/**
 * Replacement mode for subscription changes (Android)
 * These modes determine how the subscription replacement affects billing.
 * Available in Google Play Billing Library 8.1.0+
 */
export type SubscriptionReplacementModeAndroid = 'unknown-replacement-mode' | 'with-time-proration' | 'charge-prorated-price' | 'charge-full-price' | 'without-proration' | 'deferred' | 'keep-existing';

export interface SubscriptionStatusIOS {
  renewalInfo?: (RenewalInfoIOS | null);
  state: string;
}

export interface TransactionCommitmentInfoIOS {
  billingPeriodNumber: number;
  commitmentExpiresDate: number;
  commitmentPrice: number;
  totalBillingPeriods: number;
}

/**
 * User Choice Billing event details (Android)
 * Fired when a user selects alternative billing in the User Choice Billing dialog
 */
export interface UserChoiceBillingDetails {
  /** Token that must be reported to Google Play within 24 hours */
  externalTransactionToken: string;
  /**
   * External transaction ID of the originating subscription when the user is
   * upgrading or downgrading a developer-billed subscription. Available in
   * OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).
   */
  originalExternalTransactionId?: (string | null);
  /**
   * Structured product details selected in the user-choice flow, including the
   * product type and offer token. Legacy payloads may omit this field; use
   * products as the product-ID fallback. Available in OpenIAP Spec 2.3.0 /
   * openiap-google 2.3.1 (requires Play Billing 9.1+).
   */
  productDetailsAndroid?: (DeveloperProvidedBillingProductAndroid[] | null);
  /** List of product IDs selected by the user */
  products: string[];
}

/**
 * Valid time window for when an offer is available (Android)
 * Available in Google Play Billing Library 8.0+
 */
export interface ValidTimeWindowAndroid {
  /** End time in milliseconds since epoch */
  endTimeMillis: string;
  /** Start time in milliseconds since epoch */
  startTimeMillis: string;
}

/**
 * Apple App Store verification parameters.
 * Used for server-side receipt validation via App Store Server API.
 */
export interface VerifyPurchaseAppleOptions {
  /** Product SKU to validate */
  sku: string;
}

/**
 * Google Play Store verification parameters.
 * Used for server-side receipt validation via Google Play Developer API.
 *
 * ⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.
 */
export interface VerifyPurchaseGoogleOptions {
  /**
   * Google OAuth2 access token for API authentication.
   * ⚠️ Sensitive: Do not log this value.
   */
  accessToken: string;
  /** Whether this is a subscription purchase (affects API endpoint used) */
  isSub?: (boolean | null);
  /** Android package name (e.g., com.example.app) */
  packageName: string;
  /**
   * Purchase token from the purchase response.
   * ⚠️ Sensitive: Do not log this value.
   */
  purchaseToken: string;
  /** Product SKU to validate */
  sku: string;
}

/**
 * Meta Horizon (Quest) verification parameters.
 * Used for server-side entitlement verification via Meta's S2S API.
 * POST https://graph.oculus.com/$APP_ID/verify_entitlement
 *
 * ⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.
 */
export interface VerifyPurchaseHorizonOptions {
  /**
   * Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token).
   * ⚠️ Sensitive: Do not log this value.
   */
  accessToken: string;
  /** The SKU for the add-on item, defined in Meta Developer Dashboard */
  sku: string;
  /** The user ID of the user whose purchase you want to verify */
  userId: string;
}

/**
 * Platform-specific purchase verification parameters.
 *
 * - apple: Verifies via App Store Server API
 * - google: Verifies via Google Play Developer API
 * - horizon: Verifies via Meta's S2S API (verify_entitlement endpoint)
 */
export interface VerifyPurchaseProps {
  /** Apple App Store verification parameters. */
  apple?: (VerifyPurchaseAppleOptions | null);
  /** Google Play Store verification parameters. */
  google?: (VerifyPurchaseGoogleOptions | null);
  /** Meta Horizon (Quest) verification parameters. */
  horizon?: (VerifyPurchaseHorizonOptions | null);
}

export type VerifyPurchaseResult = VerifyPurchaseResultAndroid | VerifyPurchaseResultHorizon | VerifyPurchaseResultIOS;

export interface VerifyPurchaseResultAndroid extends VerifyPurchaseResultCommon {
  autoRenewing: boolean;
  betaProduct: boolean;
  cancelDate?: (number | null);
  cancelReason?: (string | null);
  deferredDate?: (number | null);
  deferredSku?: (string | null);
  freeTrialEndDate: number;
  gracePeriodEndDate: number;
  /**
   * Whether the purchase is valid. Uniform across every VerifyPurchaseResult
   * variant so callers can gate entitlement without inspecting the concrete type.
   */
  isValid: boolean;
  parentProductId: string;
  productId: string;
  productType: string;
  purchaseDate: number;
  quantity: number;
  receiptId: string;
  renewalDate: number;
  term: string;
  termSku: string;
  testTransaction: boolean;
}

/** Validity shared by every store-specific purchase verification result. */
export interface VerifyPurchaseResultCommon {
  /** Whether the purchase is valid, without inspecting the concrete result variant. */
  isValid: boolean;
}

/**
 * Result from Meta Horizon verify_entitlement API.
 * Returns verification status and grant time for the entitlement.
 */
export interface VerifyPurchaseResultHorizon extends VerifyPurchaseResultCommon {
  /** Unix timestamp (seconds) when the entitlement was granted. */
  grantTime?: (number | null);
  /**
   * Whether the purchase is valid. Uniform across every VerifyPurchaseResult
   * variant so callers can gate entitlement without inspecting the concrete type.
   */
  isValid: boolean;
  /**
   * Whether the entitlement verification succeeded.
   * @deprecated Renamed to isValid so every VerifyPurchaseResult variant answers validity the same way. Scheduled for removal in OpenIAP 4.0.
   */
  success: boolean;
}

export interface VerifyPurchaseResultIOS extends VerifyPurchaseResultCommon {
  /** Whether the receipt is valid */
  isValid: boolean;
  /** JWS representation */
  jwsRepresentation: string;
  /** Latest transaction if available */
  latestTransaction?: (Purchase | null);
  /** Receipt data string */
  receiptData: string;
}

export interface VerifyPurchaseWithProviderError {
  code?: (string | null);
  message: string;
}

export interface VerifyPurchaseWithProviderProps {
  iapkit?: (RequestVerifyPurchaseWithIapkitProps | null);
  provider: PurchaseVerificationProvider;
}

export interface VerifyPurchaseWithProviderResult {
  /** Error details if verification failed */
  errors?: (VerifyPurchaseWithProviderError[] | null);
  /** IAPKit verification result */
  iapkit?: (RequestVerifyPurchaseWithIapkitResult | null);
  provider: PurchaseVerificationProvider;
}

export type VoidResult = void;

/**
 * Win-back offer input for iOS 18+ (StoreKit 2)
 * Win-back offers are used to re-engage churned subscribers.
 * The offer is automatically presented via StoreKit Message when eligible,
 * or can be applied programmatically during purchase.
 */
export interface WinBackOfferInputIOS {
  /** The win-back offer ID from App Store Connect */
  offerId: string;
}
// -- Mutation helper types (auto-generated)
export type MutationArgsMap = {
  acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidArgs;
  beginRefundRequestIOS: MutationBeginRefundRequestIosArgs;
  clearTransactionIOS: never;
  consumePurchaseAndroid: MutationConsumePurchaseAndroidArgs;
  createBillingProgramReportingDetailsAndroid: MutationCreateBillingProgramReportingDetailsAndroidArgs;
  deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsArgs;
  endConnection: never;
  finishTransaction: MutationFinishTransactionArgs;
  initConnection: MutationInitConnectionArgs;
  isBillingProgramAvailableAndroid: MutationIsBillingProgramAvailableAndroidArgs;
  launchExternalLinkAndroid: MutationLaunchExternalLinkAndroidArgs;
  openRedeemOfferCodeAndroid: never;
  presentCodeRedemptionSheetIOS: never;
  presentExternalPurchaseLinkIOS: MutationPresentExternalPurchaseLinkIosArgs;
  presentExternalPurchaseNoticeSheetIOS: never;
  requestPurchase: MutationRequestPurchaseArgs;
  restorePurchases: never;
  showBillingProgramInformationDialogAndroid: MutationShowBillingProgramInformationDialogAndroidArgs;
  showExternalPurchaseCustomLinkNoticeIOS: MutationShowExternalPurchaseCustomLinkNoticeIosArgs;
  showInAppMessagesAndroid: MutationShowInAppMessagesAndroidArgs;
  showManageSubscriptionsIOS: never;
  syncIOS: never;
  verifyPurchase: MutationVerifyPurchaseArgs;
  verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderArgs;
};

export type MutationField<K extends keyof Mutation> =
  MutationArgsMap[K] extends never
    ? () => NonNullable<Mutation[K]>
    : undefined extends MutationArgsMap[K]
      ? (args?: MutationArgsMap[K]) => NonNullable<Mutation[K]>
      : (args: MutationArgsMap[K]) => NonNullable<Mutation[K]>;

export type MutationFieldMap = {
  [K in keyof Mutation]?: MutationField<K>;
};
// -- End mutation helper types

// -- Query helper types (auto-generated)
export type QueryArgsMap = {
  canPresentExternalPurchaseNoticeIOS: never;
  currentEntitlementIOS: QueryCurrentEntitlementIosArgs;
  fetchProducts: QueryFetchProductsArgs;
  getActiveSubscriptions: QueryGetActiveSubscriptionsArgs;
  getAllTransactionsIOS: never;
  getAppTransactionIOS: never;
  getAvailablePurchases: QueryGetAvailablePurchasesArgs;
  getBillingChoiceInfoAndroid: QueryGetBillingChoiceInfoAndroidArgs;
  getExternalPurchaseCustomLinkTokenIOS: QueryGetExternalPurchaseCustomLinkTokenIosArgs;
  getPendingTransactionsIOS: never;
  getPromotedProductIOS: never;
  getReceiptDataIOS: never;
  getStorefront: never;
  getTransactionJwsIOS: QueryGetTransactionJwsIosArgs;
  hasActiveSubscriptions: QueryHasActiveSubscriptionsArgs;
  isEligibleForExternalPurchaseCustomLinkIOS: never;
  isEligibleForIntroOfferIOS: QueryIsEligibleForIntroOfferIosArgs;
  isTransactionVerifiedIOS: QueryIsTransactionVerifiedIosArgs;
  latestTransactionIOS: QueryLatestTransactionIosArgs;
  subscriptionStatusIOS: QuerySubscriptionStatusIosArgs;
};

export type QueryField<K extends keyof Query> =
  QueryArgsMap[K] extends never
    ? () => NonNullable<Query[K]>
    : undefined extends QueryArgsMap[K]
      ? (args?: QueryArgsMap[K]) => NonNullable<Query[K]>
      : (args: QueryArgsMap[K]) => NonNullable<Query[K]>;

export type QueryFieldMap = {
  [K in keyof Query]?: QueryField<K>;
};
// -- End query helper types

// -- Subscription helper types (auto-generated)
export type SubscriptionArgsMap = {
  developerProvidedBillingAndroid: never;
  promotedProductIOS: never;
  purchaseError: never;
  purchaseUpdated: SubscriptionPurchaseUpdatedArgs;
  subscriptionBillingIssue: never;
  userChoiceBillingAndroid: never;
};

export type SubscriptionField<K extends keyof Subscription> =
  SubscriptionArgsMap[K] extends never
    ? () => NonNullable<Subscription[K]>
    : undefined extends SubscriptionArgsMap[K]
      ? (args?: SubscriptionArgsMap[K]) => NonNullable<Subscription[K]>
      : (args: SubscriptionArgsMap[K]) => NonNullable<Subscription[K]>;

export type SubscriptionFieldMap = {
  [K in keyof Subscription]?: SubscriptionField<K>;
};
// -- End subscription helper types
