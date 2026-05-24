import type {IOS} from '@expo/config-types';
import type {IOSAlternativeBillingConfig} from './withIAP';

export type ExpoIapModuleOverrides = {
  /**
   * Enable Onside Store support for iOS alternative billing
   * @platform ios
   * @default false
   */
  onside?: boolean;
  /**
   * Enable Horizon OS support for Meta Quest devices
   * @platform android
   * @default false
   */
  horizon?: boolean;
  /**
   * Enable Fire OS support for Amazon-distributed Android builds
   * @platform android
   * @default false
   */
  fireOS?: boolean;
  /**
   * Mark this config as targeting Vega OS. Vega OS is selected by the kepler
   * runtime and must not be combined with Android store flavors.
   * @default false
   */
  vega?: boolean;
};

type BaseExpoIapOptions = {
  enableLocalDev?: boolean;
  localPath?:
    | string
    | {
        ios?: string;
        android?: string;
      };
  /**
   * iOS Alternative Billing configuration.
   * Configure external purchase countries, links, and entitlements.
   * Requires approval from Apple.
   * @platform ios
   * @deprecated Use ios.alternativeBilling instead
   */
  iosAlternativeBilling?: IOSAlternativeBillingConfig;
  ios?: {
    alternativeBilling?: IOSAlternativeBillingConfig;
  };
  /**
   * Horizon OS app ID for Quest devices
   * @platform android
   * @deprecated Use android.horizonAppId instead
   */
  horizonAppId?: string;
  android?: {
    /**
     * Horizon OS app ID for Quest devices
     * @platform android
     */
    horizonAppId?: string;
  };
};

type AutoModuleOptions = BaseExpoIapOptions & {
  module?: 'auto';
  modules?: ExpoIapModuleOverrides;
};

type ExplicitModuleOptions = BaseExpoIapOptions & {
  module: 'expo-iap' | 'onside';
  modules?: never;
};

export type ExpoIapPluginCommonOptions =
  | AutoModuleOptions
  | ExplicitModuleOptions;

declare module '@expo/config-types' {
  interface IOS {
    onside?: {
      enabled?: boolean;
    };
  }
}
