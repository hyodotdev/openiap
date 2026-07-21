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
  VerifyPurchaseResultAndroid,
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
 * Validate receipt for Android. NOTE: This method is here for debugging purposes only. Including
 * your access token in the binary you ship to users is potentially dangerous.
 * Use server side validation instead for your production builds
 *
 * @deprecated Use verifyPurchase instead
 * @param {Object} params - The parameters object
 * @param {string} params.packageName - package name of your app.
 * @param {string} params.productId - product id for your in app product.
 * @param {string} params.productToken - token for your purchase (called 'token' in the API documentation).
 * @param {string} params.accessToken - OAuth access token with androidpublisher scope. Required for authentication.
 * @param {boolean} params.isSub - whether this is subscription or in-app. `true` for subscription.
 * @returns {Promise<ReceiptAndroid>}
 */
export const validateReceiptAndroid = async ({
  packageName,
  productId,
  productToken,
  accessToken,
  isSub,
}: {
  packageName: string;
  productId: string;
  productToken: string;
  accessToken: string;
  isSub?: boolean;
}): Promise<VerifyPurchaseResultAndroid> => {
  const type = isSub ? 'subscriptions' : 'products';

  const url =
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications' +
    `/${packageName}/purchases/${type}/${productId}` +
    `/tokens/${productToken}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw Object.assign(new Error(response.statusText), {
      statusCode: response.status,
    });
  }

  return response.json();
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
 * Launches the Play Store redeem page (https://play.google.com/redeem); purchases
 * completed there are delivered through the standard purchase listeners.
 * Does not require the billing client to be initialized (no Play Billing version requirement).
 * Android counterpart of presentCodeRedemptionSheetIOS.
 *
 * @returns Promise resolving to true when the redemption flow was launched
 *
 * @see {@link https://openiap.dev/docs/apis/android/open-redeem-offer-code-android}
 */
export const openRedeemOfferCodeAndroid: MutationField<
  'openRedeemOfferCodeAndroid'
> = async () => {
  await Linking.openURL('https://play.google.com/redeem');
  return true;
};

/**
 * Check if alternative billing is available for this user/device (Android only).
 * Step 1 of alternative billing flow.
 *
 * Returns true if available, false otherwise.
 * Throws OpenIapError.NotPrepared if billing client not ready.
 *
 * @returns {Promise<boolean>}
 *
 * @example
 * ```typescript
 * const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
 * if (isAvailable) {
 *   // Proceed with alternative billing flow
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android}
 */
export const checkAlternativeBillingAvailabilityAndroid: MutationField<
  'checkAlternativeBillingAvailabilityAndroid'
> = async () => {
  requireAndroidPlatform('checkAlternativeBillingAvailabilityAndroid');
  return ExpoIapModule.checkAlternativeBillingAvailabilityAndroid();
};

/**
 * Show alternative billing information dialog to user (Android only).
 * Step 2 of alternative billing flow.
 * Must be called BEFORE processing payment in your payment system.
 *
 * Returns true if user accepted, false if user canceled.
 * Throws OpenIapError.NotPrepared if billing client not ready.
 *
 * @returns {Promise<boolean>}
 *
 * @example
 * ```typescript
 * const userAccepted = await showAlternativeBillingDialogAndroid();
 * if (userAccepted) {
 *   // Process payment in your payment system
 *   const success = await processCustomPayment();
 *   if (success) {
 *     // Create reporting token
 *     const token = await createAlternativeBillingTokenAndroid();
 *     // Send token to your backend for Google Play reporting
 *   }
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android}
 */
export const showAlternativeBillingDialogAndroid: MutationField<
  'showAlternativeBillingDialogAndroid'
> = async () => {
  requireAndroidPlatform('showAlternativeBillingDialogAndroid');
  return ExpoIapModule.showAlternativeBillingDialogAndroid();
};

/**
 * Create external transaction token for Google Play reporting (Android only).
 * Step 3 of alternative billing flow.
 * Must be called AFTER successful payment in your payment system.
 * Token must be reported to Google Play backend within 24 hours.
 *
 * Returns token string, or null if creation failed.
 * Throws OpenIapError.NotPrepared if billing client not ready.
 *
 * @param {string} sku - The product SKU that was purchased
 * @returns {Promise<string | null>}
 *
 * @example
 * ```typescript
 * const token = await createAlternativeBillingTokenAndroid('premium_subscription');
 * if (token) {
 *   // Send token to your backend
 *   await fetch('/api/report-transaction', {
 *     method: 'POST',
 *     body: JSON.stringify({ token, sku: 'premium_subscription' })
 *   });
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-alternative-billing-token-android}
 */
export const createAlternativeBillingTokenAndroid: MutationField<
  'createAlternativeBillingTokenAndroid'
> = async (sku?: string) => {
  requireAndroidPlatform('createAlternativeBillingTokenAndroid');
  return ExpoIapModule.createAlternativeBillingTokenAndroid(sku);
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
