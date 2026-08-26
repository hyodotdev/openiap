// External dependencies
import {Linking, Platform} from 'react-native';

// Internal modules
import ExpoIapModule from '../ExpoIapModule';
import {isVegaOS} from '../vega';

// Types
import type {
  BillingChoiceInfoAndroid,
  BillingProgramAndroid,
  BillingProgramInformationDialogParamsAndroid,
  BillingProgramReportingDetailsAndroid,
  BillingResultAndroid,
  DeepLinkOptions,
  DeveloperBillingTypeAndroid,
  GetBillingChoiceInfoParamsAndroid,
  InAppMessageParamsAndroid,
  InAppMessageResultAndroid,
  MutationCreateBillingProgramReportingDetailsAndroidArgs,
  MutationField,
  QueryField,
} from '../types';

type NativeAndroidModule = {
  deepLinkToSubscriptionsAndroid?: (params: {
    skuAndroid?: string;
    packageNameAndroid?: string;
  }) => Promise<void> | void;
  getStorefront?: () => Promise<string> | string;
};

const nativeAndroidModule = ExpoIapModule as NativeAndroidModule;

/**
 * Enforce the documented Android-only contract. Vega OS is treated as an
 * Android store runtime (matching `isAndroidStoreRuntime` in src/index.ts),
 * so it passes through. Without this guard, calling a suffixed wrapper on
 * another platform falls through to the native proxy and surfaces as an
 * opaque `TypeError: ExpoIapModule.<name> is not a function` instead of the
 * promised platform error.
 */
const requireAndroidPlatform = (methodName: string): void => {
  if (Platform.OS !== 'android' && !isVegaOS()) {
    throw new Error(`${methodName} is only available on Android and Vega OS`);
  }
};

// Type guards
export function isProductAndroid<T extends {platform?: string}>(
  item: unknown,
): item is T & {platform: 'android'} {
  return (
    item != null &&
    typeof item === 'object' &&
    'platform' in item &&
    typeof (item as any).platform === 'string' &&
    (item as any).platform.toLowerCase() === 'android'
  );
}

/**
 * Deep link to subscriptions screen on Android.
 * @param {Object} params - The parameters object
 * @param {string} params.skuAndroid - The product's SKU (on Android)
 * @param {string} params.packageNameAndroid - The package name of your Android app (e.g., 'com.example.app')
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await deepLinkToSubscriptionsAndroid({
 *   skuAndroid: 'subscription_id',
 *   packageNameAndroid: 'com.example.app'
 * });
 * ```
 */
export const deepLinkToSubscriptionsAndroid = async (
  options?: DeepLinkOptions | null,
): Promise<void> => {
  const sku = options?.skuAndroid ?? undefined;
  const packageName = options?.packageNameAndroid ?? undefined;

  // Prefer native deep link implementation via OpenIAP module
  if (nativeAndroidModule?.deepLinkToSubscriptionsAndroid) {
    return nativeAndroidModule.deepLinkToSubscriptionsAndroid({
      skuAndroid: sku,
      packageNameAndroid: packageName,
    });
  }

  // Fallback to Linking if native method unavailable
  if (!packageName) {
    throw new Error(
      'packageName is required for deepLinkToSubscriptionsAndroid',
    );
  }
  const base = `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(
    packageName,
  )}`;
  const url = sku ? `${base}&sku=${encodeURIComponent(sku)}` : base;
  return Linking.openURL(url);
};

/**
 * Consume a purchase token so the user can purchase the same product again
 * (Android consumable products). Prefer using `finishTransaction` with
 * `isConsumable: true`, which dispatches to this under the hood.
 *
 * @see {@link https://openiap.dev/docs/apis/android/consume-purchase-android}
 */
export const consumePurchaseAndroid: MutationField<
  'consumePurchaseAndroid'
> = async (purchaseToken) => {
  requireAndroidPlatform('consumePurchaseAndroid');
  const result = await ExpoIapModule.consumePurchaseAndroid(purchaseToken);

  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record.success === 'boolean') {
      return record.success;
    }
    if (typeof record.responseCode === 'number') {
      return record.responseCode === 0;
    }
  }

  throw new Error(
    `consumePurchaseAndroid returned an unexpected response payload: ${JSON.stringify(
      result,
    )}`,
  );
};

/**
 * Acknowledge a non-consumable purchase or subscription (Android only).
 * @param {Object} params - The parameters object
 * @param {string} params.token - The product's token (on Android)
 * @returns {Promise<VoidResult | void>}
 * @throws Error if called on a non-Android platform
 *
 * @see {@link https://openiap.dev/docs/apis/android/acknowledge-purchase-android}
 */
export const acknowledgePurchaseAndroid: MutationField<
  'acknowledgePurchaseAndroid'
> = async (purchaseToken) => {
  requireAndroidPlatform('acknowledgePurchaseAndroid');
  const result = await ExpoIapModule.acknowledgePurchaseAndroid(purchaseToken);

  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record.success === 'boolean') {
      return record.success;
    }
    if (typeof record.responseCode === 'number') {
      return record.responseCode === 0;
    }
  }

  return true;
};

/**
 * Open the Google Play offer/promo code redemption flow so the user can enter a code (Android only).
 * On Play builds, launches the Play Store redeem page. A listener can receive
 * the purchase while the app has an active billing connection; reconcile
 * available purchases when the app resumes. Unsupported store flavors return false.
 * Does not require the billing client to be initialized (no Play Billing version requirement).
 * Android counterpart of presentCodeRedemptionSheetIOS.
 *
 * @returns Promise resolving to true when launched, or false when unsupported
 *
 * @deprecated Use `openRedeemOfferCode` instead. Scheduled for removal in
 * OpenIAP 4.0.
 *
 * @see {@link https://openiap.dev/docs/apis/android/open-redeem-offer-code-android}
 */
export const openRedeemOfferCodeAndroid: MutationField<
  'openRedeemOfferCodeAndroid'
> = async () => {
  requireAndroidPlatform('openRedeemOfferCodeAndroid');
  if (isVegaOS()) {
    return false;
  }
  return ExpoIapModule.openRedeemOfferCodeAndroid();
};

// ============================================================================
// Billing Programs API (Google Play Billing Library 8.2.0+)
// ============================================================================

/**
 * Check if a specific billing program is available for this user/device (Android only).
 * Available in Google Play Billing Library 8.2.0+. Billing Choice availability
 * details, including the configured renderer and external-link support, require 9.1.0+.
 *
 * @param program - The billing program to check
 * @returns Promise resolving to availability result
 *
 * @example
 * ```typescript
 * const result = await isBillingProgramAvailableAndroid('external-offer');
 * if (result.isAvailable) {
 *   // Proceed with billing program flow
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/is-billing-program-available-android}
 */
export const isBillingProgramAvailableAndroid: MutationField<
  'isBillingProgramAvailableAndroid'
> = async (program) => {
  requireAndroidPlatform('isBillingProgramAvailableAndroid');
  return ExpoIapModule.isBillingProgramAvailableAndroid(program);
};

/**
 * Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens.
 * Available in Google Play Billing Library 9.1.0+.
 *
 * @param params - Billing Choice info request parameters
 * @returns Promise resolving to Play Billing Choice display information
 *
 * @see {@link https://openiap.dev/docs/apis/android/get-billing-choice-info-android}
 */
export const getBillingChoiceInfoAndroid: QueryField<
  'getBillingChoiceInfoAndroid'
> = async (
  params: GetBillingChoiceInfoParamsAndroid = {},
): Promise<BillingChoiceInfoAndroid> => {
  requireAndroidPlatform('getBillingChoiceInfoAndroid');
  return ExpoIapModule.getBillingChoiceInfoAndroid({
    billingProgram: params.billingProgram ?? 'billing-choice',
    playBillingChoiceImageLayout:
      params.playBillingChoiceImageLayout ?? 'rectangular-four-by-one',
    userLocale: params.userLocale ?? null,
  });
};

/**
 * Launch an external link for the specified billing program (Android only).
 * Available in Google Play Billing Library 8.2.0+; developer-rendered Billing
 * Choice external-link flows require 9.1.0+ and `externalTransactionToken`.
 *
 * @param params - The external link parameters
 * @returns Promise resolving to true if the link was launched successfully
 *
 * @example
 * ```typescript
 * await launchExternalLinkAndroid({
 *   billingProgram: 'billing-choice',
 *   externalTransactionToken: 'pre-generated-token',
 *   launchMode: 'launch-in-external-browser-or-app',
 *   linkType: 'link-to-digital-content-offer',
 *   linkUri: 'https://your-payment-site.com',
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/launch-external-link-android}
 */
export const launchExternalLinkAndroid: MutationField<
  'launchExternalLinkAndroid'
> = async (params) => {
  requireAndroidPlatform('launchExternalLinkAndroid');
  return ExpoIapModule.launchExternalLinkAndroid(params);
};

/**
 * Create billing program reporting details for Google Play reporting (Android only).
 * Available in Google Play Billing Library 8.2.0+.
 *
 * Must be called AFTER successful payment in your payment system.
 * Token must be reported to Google Play backend within 24 hours.
 *
 * @param program - The billing program type
 * @returns Promise resolving to reporting details including the external transaction token
 *
 * @example
 * ```typescript
 * const details = await createBillingProgramReportingDetailsAndroid('external-offer');
 * // Report details.externalTransactionToken to Google Play within 24 hours
 * await reportToGooglePlay(details.externalTransactionToken);
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android}
 */
const createBillingProgramReportingDetailsAndroidField: MutationField<
  'createBillingProgramReportingDetailsAndroid'
> = async (
  args: MutationCreateBillingProgramReportingDetailsAndroidArgs,
): Promise<BillingProgramReportingDetailsAndroid> => {
  requireAndroidPlatform('createBillingProgramReportingDetailsAndroid');
  return ExpoIapModule.createBillingProgramReportingDetailsAndroid(
    args.program,
    args.developerBillingType ?? null,
  );
};

export function createBillingProgramReportingDetailsAndroid(
  args: MutationCreateBillingProgramReportingDetailsAndroidArgs,
): Promise<BillingProgramReportingDetailsAndroid>;
export function createBillingProgramReportingDetailsAndroid(
  program: BillingProgramAndroid,
  developerBillingType?: DeveloperBillingTypeAndroid | null,
): Promise<BillingProgramReportingDetailsAndroid>;
export function createBillingProgramReportingDetailsAndroid(
  programOrArgs:
    | BillingProgramAndroid
    | MutationCreateBillingProgramReportingDetailsAndroidArgs,
  developerBillingType?: DeveloperBillingTypeAndroid | null,
): Promise<BillingProgramReportingDetailsAndroid> {
  const args =
    typeof programOrArgs === 'string'
      ? {program: programOrArgs, developerBillingType}
      : programOrArgs;
  return createBillingProgramReportingDetailsAndroidField(args);
}

/**
 * Show Google's mandatory information dialog before a developer-rendered,
 * in-app Billing Choice screen.
 * Available in Google Play Billing Library 9.1.0+.
 *
 * @param params - Dialog parameters with the external transaction token
 * @returns Promise resolving to BillingResult
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android}
 */
export const showBillingProgramInformationDialogAndroid: MutationField<
  'showBillingProgramInformationDialogAndroid'
> = async (
  params: BillingProgramInformationDialogParamsAndroid,
): Promise<BillingResultAndroid> => {
  requireAndroidPlatform('showBillingProgramInformationDialogAndroid');
  return ExpoIapModule.showBillingProgramInformationDialogAndroid({
    billingProgram: params.billingProgram ?? 'billing-choice',
    externalTransactionToken: params.externalTransactionToken,
  });
};

/**
 * Show Play Billing in-app messages, such as transactional subscription updates.
 * Available in Google Play Billing Library 4.1.0+.
 *
 * @param params - Optional in-app message categories
 * @returns Promise resolving to in-app message result
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-in-app-messages-android}
 */
export const showInAppMessagesAndroid: MutationField<
  'showInAppMessagesAndroid'
> = async (
  params?: InAppMessageParamsAndroid | null,
): Promise<InAppMessageResultAndroid> => {
  requireAndroidPlatform('showInAppMessagesAndroid');
  return ExpoIapModule.showInAppMessagesAndroid(params ?? null);
};
