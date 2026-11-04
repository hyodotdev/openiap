import type {PluginListenerHandle} from '@capacitor/core';
import type {
  BillingChoiceInfoAndroid,
  BillingProgramAndroid,
  BillingProgramAvailabilityResultAndroid,
  BillingProgramInformationDialogParamsAndroid,
  BillingProgramReportingDetailsAndroid,
  BillingResultAndroid,
  DeepLinkOptions,
  DeveloperBillingTypeAndroid,
  ExternalPurchaseCustomLinkNoticeResultIOS,
  ExternalPurchaseCustomLinkNoticeTypeIOS,
  ExternalPurchaseCustomLinkTokenResultIOS,
  ExternalPurchaseCustomLinkTokenTypeIOS,
  ExternalPurchaseLinkResultIOS,
  ExternalPurchaseNoticeResultIOS,
  GetBillingChoiceInfoParamsAndroid,
  IapEvent,
  InAppMessageParamsAndroid,
  InAppMessageResultAndroid,
  InitConnectionConfig,
  LaunchExternalLinkParamsAndroid,
  ProductQueryType,
  PurchaseInput,
  PurchaseOptions,
  VerifyAppOwnershipProps,
  VerifyPurchaseProps,
  VerifyPurchaseWithProviderProps,
} from './types';

/** Every native method resolves an object; scalar and list results sit in `value`. */
export interface NativeValue<T> {
  value: T;
}

/** The native request shape: the generated decoders key the request by product type. */
export interface NativePurchaseRequest {
  type: 'in-app' | 'subs';
  requestPurchase?: Record<string, unknown>;
  requestSubscription?: Record<string, unknown>;
}

/**
 * The bridge between the JavaScript API and the iOS/Android plugin classes.
 * Results the wrappers decode stay `unknown`. Internal: apps call the exported
 * functions in `index.ts`, which validate input and normalize errors.
 */
export interface CapacitorIapNativePlugin {
  // Connection
  initConnection(options: {
    config: InitConnectionConfig | null;
  }): Promise<NativeValue<boolean>>;
  endConnection(): Promise<NativeValue<boolean>>;

  // Products and purchases
  fetchProducts(options: {
    skus: string[];
    type: ProductQueryType;
  }): Promise<NativeValue<unknown[]>>;
  requestPurchase(options: {
    request: NativePurchaseRequest;
  }): Promise<NativeValue<unknown>>;
  finishTransaction(options: {
    purchase: PurchaseInput;
    isConsumable: boolean;
  }): Promise<NativeValue<boolean>>;
  getAvailablePurchases(options: {
    options: PurchaseOptions;
  }): Promise<NativeValue<unknown[]>>;
  getActiveSubscriptions(options: {
    subscriptionIds: string[] | null;
  }): Promise<NativeValue<unknown[]>>;
  hasActiveSubscriptions(options: {
    subscriptionIds: string[] | null;
  }): Promise<NativeValue<boolean>>;
  restorePurchases(): Promise<NativeValue<boolean>>;
  deepLinkToSubscriptions(options: {
    options: DeepLinkOptions | null;
  }): Promise<NativeValue<boolean>>;
  openRedeemOfferCode(): Promise<NativeValue<unknown>>;
  getStorefront(): Promise<NativeValue<string>>;
  verifyPurchase(options: {
    props: VerifyPurchaseProps;
  }): Promise<NativeValue<unknown>>;
  verifyPurchaseWithProvider(options: {
    props: VerifyPurchaseWithProviderProps;
  }): Promise<NativeValue<unknown>>;
  verifyAppOwnership(options: {
    options: VerifyAppOwnershipProps;
  }): Promise<NativeValue<unknown>>;
  setPurchaseUpdatedListenerOptions(options: {
    dedupeTransactionIOS: boolean;
  }): Promise<NativeValue<boolean>>;
  /** Internal: the once-per-install flag behind the first-purchase notice. */
  claimFirstPurchaseNotice(): Promise<NativeValue<boolean>>;

  // iOS
  syncIOS(): Promise<NativeValue<boolean>>;
  isEligibleForIntroOfferIOS(options: {
    groupID: string;
  }): Promise<NativeValue<boolean>>;
  subscriptionStatusIOS(options: {
    sku: string;
  }): Promise<NativeValue<unknown[]>>;
  currentEntitlementIOS(options: {sku: string}): Promise<NativeValue<unknown>>;
  latestTransactionIOS(options: {sku: string}): Promise<NativeValue<unknown>>;
  beginRefundRequestIOS(options: {
    sku: string;
  }): Promise<NativeValue<string | null>>;
  showManageSubscriptionsIOS(): Promise<NativeValue<unknown[]>>;
  getReceiptDataIOS(): Promise<NativeValue<string>>;
  requestReceiptRefreshIOS(): Promise<NativeValue<string>>;
  isTransactionVerifiedIOS(options: {
    sku: string;
  }): Promise<NativeValue<boolean>>;
  getTransactionJwsIOS(options: {
    sku: string;
  }): Promise<NativeValue<string | null>>;
  getAppTransactionIOS(): Promise<NativeValue<unknown>>;
  getPromotedProductIOS(): Promise<NativeValue<unknown>>;
  getPendingTransactionsIOS(): Promise<NativeValue<unknown[]>>;
  getAllTransactionsIOS(): Promise<NativeValue<unknown[]>>;
  clearTransactionIOS(): Promise<NativeValue<boolean>>;
  canPresentExternalPurchaseNoticeIOS(): Promise<NativeValue<boolean>>;
  presentExternalPurchaseNoticeSheetIOS(): Promise<
    NativeValue<ExternalPurchaseNoticeResultIOS>
  >;
  presentExternalPurchaseLinkIOS(options: {
    url: string;
  }): Promise<NativeValue<ExternalPurchaseLinkResultIOS>>;
  isEligibleForExternalPurchaseCustomLinkIOS(): Promise<NativeValue<boolean>>;
  getExternalPurchaseCustomLinkTokenIOS(options: {
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS;
  }): Promise<NativeValue<ExternalPurchaseCustomLinkTokenResultIOS>>;
  showExternalPurchaseCustomLinkNoticeIOS(options: {
    noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS;
  }): Promise<NativeValue<ExternalPurchaseCustomLinkNoticeResultIOS>>;

  // Android
  acknowledgePurchaseAndroid(options: {
    purchaseToken: string;
  }): Promise<NativeValue<boolean>>;
  consumePurchaseAndroid(options: {
    purchaseToken: string;
  }): Promise<NativeValue<boolean>>;
  isBillingProgramAvailableAndroid(options: {
    program: BillingProgramAndroid;
  }): Promise<NativeValue<BillingProgramAvailabilityResultAndroid>>;
  getBillingChoiceInfoAndroid(options: {
    params: GetBillingChoiceInfoParamsAndroid;
  }): Promise<NativeValue<BillingChoiceInfoAndroid>>;
  createBillingProgramReportingDetailsAndroid(options: {
    program: BillingProgramAndroid;
    developerBillingType: DeveloperBillingTypeAndroid | null;
  }): Promise<NativeValue<BillingProgramReportingDetailsAndroid>>;
  launchExternalLinkAndroid(options: {
    params: LaunchExternalLinkParamsAndroid;
  }): Promise<NativeValue<boolean>>;
  showBillingProgramInformationDialogAndroid(options: {
    params: BillingProgramInformationDialogParamsAndroid;
  }): Promise<NativeValue<BillingResultAndroid>>;
  showInAppMessagesAndroid(options: {
    params: InAppMessageParamsAndroid | null;
  }): Promise<NativeValue<InAppMessageResultAndroid>>;

  // Events
  addListener(
    eventName: IapEvent,
    listener: (payload: unknown) => void,
  ): Promise<PluginListenerHandle>;
}
