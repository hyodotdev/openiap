import {CapacitorIap} from '../plugin';
import type {
  BillingProgramAndroid,
  BillingProgramReportingDetailsAndroid,
  DeepLinkOptions,
  DeveloperBillingTypeAndroid,
  MutationCreateBillingProgramReportingDetailsAndroidArgs,
  MutationField,
  QueryField,
} from '../types';
import {invokeNativeWithPurchaseError} from '../utils/nativeError';
import {requireAndroid} from '../utils/platform';

// Android rejections carry the OpenIAP error payload; rethrow them as PurchaseError.
const callAndroid = async <T>(
  operation: () => Promise<{value: T}>,
): Promise<T> =>
  (await invokeNativeWithPurchaseError(operation, 'android')).value;

/** True when `item` is a Play, Horizon, or Amazon product or purchase payload. */
export function isProductAndroid<T extends {platform?: string}>(
  item: unknown,
): item is T & {platform: 'android'} {
  return (
    item != null &&
    typeof item === 'object' &&
    'platform' in item &&
    typeof item.platform === 'string' &&
    item.platform.toLowerCase() === 'android'
  );
}

/**
 * Open the store's subscription management screen, or one subscription's
 * page when `skuAndroid` is set.
 */
export const deepLinkToSubscriptionsAndroid = async (
  options?: DeepLinkOptions | null,
): Promise<void> => {
  requireAndroid('deepLinkToSubscriptionsAndroid');
  await invokeNativeWithPurchaseError(
    () =>
      CapacitorIap.deepLinkToSubscriptions({
        options: {
          skuAndroid: options?.skuAndroid ?? null,
          packageNameAndroid: options?.packageNameAndroid ?? null,
        },
      }),
    'android',
  );
};

/**
 * Consume a purchase token so the product can be bought again. Prefer
 * `finishTransaction` with `isConsumable: true`, which calls this.
 *
 * @see {@link https://openiap.dev/docs/apis/android/consume-purchase-android}
 */
export const consumePurchaseAndroid: MutationField<
  'consumePurchaseAndroid'
> = async (purchaseToken) => {
  requireAndroid('consumePurchaseAndroid');
  return (
    (await callAndroid(() =>
      CapacitorIap.consumePurchaseAndroid({purchaseToken}),
    )) === true
  );
};

/**
 * Acknowledge a non-consumable purchase or subscription. Prefer
 * `finishTransaction`, which calls this.
 *
 * @see {@link https://openiap.dev/docs/apis/android/acknowledge-purchase-android}
 */
export const acknowledgePurchaseAndroid: MutationField<
  'acknowledgePurchaseAndroid'
> = async (purchaseToken) => {
  requireAndroid('acknowledgePurchaseAndroid');
  return (
    (await callAndroid(() =>
      CapacitorIap.acknowledgePurchaseAndroid({purchaseToken}),
    )) === true
  );
};

/**
 * Check whether a billing program is available to this user (Play Billing
 * 8.2.0+; Billing Choice details need 9.1.0+).
 *
 * @see {@link https://openiap.dev/docs/apis/android/is-billing-program-available-android}
 */
export const isBillingProgramAvailableAndroid: MutationField<
  'isBillingProgramAvailableAndroid'
> = async (program) => {
  requireAndroid('isBillingProgramAvailableAndroid');
  return callAndroid(() =>
    CapacitorIap.isBillingProgramAvailableAndroid({program}),
  );
};

/**
 * Fetch the Play assets for a developer-rendered Billing Choice screen
 * (Play Billing 9.1.0+).
 *
 * @see {@link https://openiap.dev/docs/apis/android/get-billing-choice-info-android}
 */
export const getBillingChoiceInfoAndroid: QueryField<
  'getBillingChoiceInfoAndroid'
> = async (params) => {
  requireAndroid('getBillingChoiceInfoAndroid');
  return callAndroid(() =>
    CapacitorIap.getBillingChoiceInfoAndroid({
      params: {
        billingProgram: params?.billingProgram ?? 'billing-choice',
        playBillingChoiceImageLayout:
          params?.playBillingChoiceImageLayout ?? 'rectangular-four-by-one',
        userLocale: params?.userLocale ?? null,
      },
    }),
  );
};

/**
 * Launch an external link for a billing program (Play Billing 8.2.0+).
 *
 * @see {@link https://openiap.dev/docs/apis/android/launch-external-link-android}
 */
export const launchExternalLinkAndroid: MutationField<
  'launchExternalLinkAndroid'
> = async (params) => {
  requireAndroid('launchExternalLinkAndroid');
  return (
    (await callAndroid(() =>
      CapacitorIap.launchExternalLinkAndroid({params}),
    )) === true
  );
};

const createBillingProgramReportingDetailsAndroidField: MutationField<
  'createBillingProgramReportingDetailsAndroid'
> = async ({program, developerBillingType}) => {
  requireAndroid('createBillingProgramReportingDetailsAndroid');
  return callAndroid(() =>
    CapacitorIap.createBillingProgramReportingDetailsAndroid({
      program,
      developerBillingType: developerBillingType ?? null,
    }),
  );
};

/**
 * Create the external transaction token to report a payment made outside
 * Google Play (Play Billing 8.2.0+). Report it to Google within 24 hours.
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android}
 */
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
  return createBillingProgramReportingDetailsAndroidField(
    typeof programOrArgs === 'string'
      ? {program: programOrArgs, developerBillingType}
      : programOrArgs,
  );
}

/**
 * Show Google's information dialog before a developer-rendered Billing Choice
 * screen (Play Billing 9.1.0+).
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android}
 */
export const showBillingProgramInformationDialogAndroid: MutationField<
  'showBillingProgramInformationDialogAndroid'
> = async (params) => {
  requireAndroid('showBillingProgramInformationDialogAndroid');
  return callAndroid(() =>
    CapacitorIap.showBillingProgramInformationDialogAndroid({
      params: {
        billingProgram: params.billingProgram ?? 'billing-choice',
        externalTransactionToken: params.externalTransactionToken,
      },
    }),
  );
};

/**
 * Show Play Billing in-app messages, such as transactional subscription updates.
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-in-app-messages-android}
 */
export const showInAppMessagesAndroid: MutationField<
  'showInAppMessagesAndroid'
> = async (params) => {
  requireAndroid('showInAppMessagesAndroid');
  return callAndroid(() =>
    CapacitorIap.showInAppMessagesAndroid({params: params ?? null}),
  );
};
