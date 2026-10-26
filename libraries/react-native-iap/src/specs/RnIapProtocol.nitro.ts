// Private result transport; public RnIap remains the legacy-compatible contract.
import type {HybridObject} from 'react-native-nitro-modules';
import type {
  BillingProgramAndroid,
  DeveloperBillingTypeAndroid,
  ExternalPurchaseCustomLinkNoticeTypeIOS,
  NitroActiveSubscription,
  NitroAvailablePurchasesOptions,
  NitroBillingChoiceInfoAndroid,
  NitroBillingProgramAvailabilityResultAndroid,
  NitroBillingProgramInformationDialogParamsAndroid,
  NitroBillingProgramReportingDetailsAndroid,
  NitroBillingResultAndroid,
  NitroDeepLinkOptionsAndroid,
  NitroFinishTransactionParams,
  NitroGetBillingChoiceInfoParamsAndroid,
  NitroInAppMessageParamsAndroid,
  NitroInAppMessageResultAndroid,
  NitroLaunchExternalLinkParamsAndroid,
  NitroProduct,
  NitroPurchase,
  NitroPurchaseRequest,
  NitroPurchaseResult,
  NitroPurchaseVerificationParams,
  NitroPurchaseVerificationResultAndroid,
  NitroPurchaseVerificationResultHorizon,
  NitroPurchaseVerificationResultIOS,
  NitroSubscriptionStatus,
  NitroVerifyPurchaseWithProviderProps,
  NitroVerifyPurchaseWithProviderResult,
  RnIap,
} from './RnIap.nitro';
import type {
  PurchaseError as SchemaPurchaseError,
  InitConnectionConfig,
  ExternalPurchaseCustomLinkNoticeResultIOS,
  ExternalPurchaseCustomLinkTokenResultIOS,
  ExternalPurchaseCustomLinkTokenTypeIOS,
  ExternalPurchaseLinkResultIOS,
  ExternalPurchaseNoticeResultIOS,
  RequestPurchaseResult,
} from '../types';

export interface NitroPurchaseError extends Omit<SchemaPurchaseError, 'code'> {
  code: string;
}

export interface NitroBooleanOutcome {
  value?: boolean;
  error?: NitroPurchaseError;
}

export interface NitroProductListOutcome {
  value?: NitroProduct[];
  error?: NitroPurchaseError;
}

export interface NitroRequestPurchaseResultOutcome {
  value?: RequestPurchaseResult;
  error?: NitroPurchaseError;
}

export interface NitroPurchaseListOutcome {
  value?: NitroPurchase[];
  error?: NitroPurchaseError;
}

export interface NitroActiveSubscriptionListOutcome {
  value?: NitroActiveSubscription[];
  error?: NitroPurchaseError;
}

export interface NitroFinishTransactionOutcome {
  value?: NitroPurchaseResult | boolean;
  error?: NitroPurchaseError;
}

export interface NitroGetAppTransactionIOSOutcome {
  value?: string | null;
  error?: NitroPurchaseError;
}

export interface NitroGetPromotedProductIOSOutcome {
  value?: NitroProduct | null;
  error?: NitroPurchaseError;
}

export interface NitroStringOutcome {
  value?: string;
  error?: NitroPurchaseError;
}

export interface NitroOpenRedeemOfferCodeOutcome {
  value?: NitroPurchase | null;
  error?: NitroPurchaseError;
}

export interface NitroVoidOutcome {
  error?: NitroPurchaseError;
}

export interface NitroSubscriptionStatusIOSOutcome {
  value?: NitroSubscriptionStatus[] | null;
  error?: NitroPurchaseError;
}

export interface NitroVerifyPurchaseOutcome {
  value?:
    | NitroPurchaseVerificationResultIOS
    | NitroPurchaseVerificationResultAndroid
    | NitroPurchaseVerificationResultHorizon;
  error?: NitroPurchaseError;
}

export interface NitroVerifyPurchaseWithProviderResultOutcome {
  value?: NitroVerifyPurchaseWithProviderResult;
  error?: NitroPurchaseError;
}

export interface NitroBillingProgramAvailabilityResultAndroidOutcome {
  value?: NitroBillingProgramAvailabilityResultAndroid;
  error?: NitroPurchaseError;
}

export interface NitroBillingChoiceInfoAndroidOutcome {
  value?: NitroBillingChoiceInfoAndroid;
  error?: NitroPurchaseError;
}

export interface NitroBillingProgramReportingDetailsAndroidOutcome {
  value?: NitroBillingProgramReportingDetailsAndroid;
  error?: NitroPurchaseError;
}

export interface NitroBillingResultAndroidOutcome {
  value?: NitroBillingResultAndroid;
  error?: NitroPurchaseError;
}

export interface NitroInAppMessageResultAndroidOutcome {
  value?: NitroInAppMessageResultAndroid;
  error?: NitroPurchaseError;
}

export interface NitroExternalPurchaseNoticeResultIOSOutcome {
  value?: ExternalPurchaseNoticeResultIOS;
  error?: NitroPurchaseError;
}

export interface NitroExternalPurchaseLinkResultIOSOutcome {
  value?: ExternalPurchaseLinkResultIOS;
  error?: NitroPurchaseError;
}

export interface NitroExternalPurchaseCustomLinkTokenResultIOSOutcome {
  value?: ExternalPurchaseCustomLinkTokenResultIOS;
  error?: NitroPurchaseError;
}

export interface NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome {
  value?: ExternalPurchaseCustomLinkNoticeResultIOS;
  error?: NitroPurchaseError;
}

export interface RnIapProtocol extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  readonly core: RnIap;
  initConnection(
    config?: InitConnectionConfig | null,
  ): Promise<NitroBooleanOutcome>;
  endConnection(): Promise<NitroBooleanOutcome>;
  fetchProducts(skus: string[], type: string): Promise<NitroProductListOutcome>;
  requestPurchase(
    request: NitroPurchaseRequest,
  ): Promise<NitroRequestPurchaseResultOutcome>;
  getAvailablePurchases(
    options?: NitroAvailablePurchasesOptions,
  ): Promise<NitroPurchaseListOutcome>;
  getActiveSubscriptions(
    subscriptionIds?: string[],
  ): Promise<NitroActiveSubscriptionListOutcome>;
  hasActiveSubscriptions(
    subscriptionIds?: string[],
  ): Promise<NitroBooleanOutcome>;
  finishTransaction(
    params: NitroFinishTransactionParams,
  ): Promise<NitroFinishTransactionOutcome>;
  getAppTransactionIOS(): Promise<NitroGetAppTransactionIOSOutcome>;
  getPromotedProductIOS(): Promise<NitroGetPromotedProductIOSOutcome>;
  verifyAppOwnership(optionsJson: string): Promise<NitroStringOutcome>;
  openRedeemOfferCode(): Promise<NitroOpenRedeemOfferCodeOutcome>;
  clearTransactionIOS(): Promise<NitroVoidOutcome>;
  beginRefundRequestIOS(sku: string): Promise<NitroGetAppTransactionIOSOutcome>;
  subscriptionStatusIOS(
    sku: string,
  ): Promise<NitroSubscriptionStatusIOSOutcome>;
  currentEntitlementIOS(sku: string): Promise<NitroOpenRedeemOfferCodeOutcome>;
  latestTransactionIOS(sku: string): Promise<NitroOpenRedeemOfferCodeOutcome>;
  getPendingTransactionsIOS(): Promise<NitroPurchaseListOutcome>;
  getAllTransactionsIOS(): Promise<NitroPurchaseListOutcome>;
  restorePurchases(): Promise<NitroBooleanOutcome>;
  syncIOS(): Promise<NitroBooleanOutcome>;
  showManageSubscriptionsIOS(): Promise<NitroPurchaseListOutcome>;
  deepLinkToSubscriptionsIOS(): Promise<NitroBooleanOutcome>;
  isEligibleForIntroOfferIOS(groupID: string): Promise<NitroBooleanOutcome>;
  getReceiptDataIOS(): Promise<NitroStringOutcome>;
  requestReceiptRefreshIOS(): Promise<NitroStringOutcome>;
  isTransactionVerifiedIOS(sku: string): Promise<NitroBooleanOutcome>;
  getTransactionJwsIOS(sku: string): Promise<NitroGetAppTransactionIOSOutcome>;
  verifyPurchase(
    params: NitroPurchaseVerificationParams,
  ): Promise<NitroVerifyPurchaseOutcome>;
  verifyPurchaseWithProvider(
    params: NitroVerifyPurchaseWithProviderProps,
  ): Promise<NitroVerifyPurchaseWithProviderResultOutcome>;
  getStorefront(): Promise<NitroStringOutcome>;
  deepLinkToSubscriptionsAndroid?(
    options: NitroDeepLinkOptionsAndroid,
  ): Promise<NitroVoidOutcome>;
  enableBillingProgramAndroid(program: BillingProgramAndroid): NitroVoidOutcome;
  isBillingProgramAvailableAndroid(
    program: BillingProgramAndroid,
  ): Promise<NitroBillingProgramAvailabilityResultAndroidOutcome>;
  getBillingChoiceInfoAndroid(
    params: NitroGetBillingChoiceInfoParamsAndroid,
  ): Promise<NitroBillingChoiceInfoAndroidOutcome>;
  createBillingProgramReportingDetailsAndroid(
    program: BillingProgramAndroid,
    developerBillingType?: DeveloperBillingTypeAndroid | null,
  ): Promise<NitroBillingProgramReportingDetailsAndroidOutcome>;
  showBillingProgramInformationDialogAndroid(
    params: NitroBillingProgramInformationDialogParamsAndroid,
  ): Promise<NitroBillingResultAndroidOutcome>;
  showInAppMessagesAndroid(
    params?: NitroInAppMessageParamsAndroid | null,
  ): Promise<NitroInAppMessageResultAndroidOutcome>;
  launchExternalLinkAndroid(
    params: NitroLaunchExternalLinkParamsAndroid,
  ): Promise<NitroBooleanOutcome>;
  canPresentExternalPurchaseNoticeIOS(): Promise<NitroBooleanOutcome>;
  presentExternalPurchaseNoticeSheetIOS(): Promise<NitroExternalPurchaseNoticeResultIOSOutcome>;
  presentExternalPurchaseLinkIOS(
    url: string,
  ): Promise<NitroExternalPurchaseLinkResultIOSOutcome>;
  isEligibleForExternalPurchaseCustomLinkIOS(): Promise<NitroBooleanOutcome>;
  getExternalPurchaseCustomLinkTokenIOS(
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS,
  ): Promise<NitroExternalPurchaseCustomLinkTokenResultIOSOutcome>;
  showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS,
  ): Promise<NitroExternalPurchaseCustomLinkNoticeResultIOSOutcome>;
}
