import type {IOS} from '@expo/config-types';
import type {IOSAlternativeBillingConfig} from './withIAP';
import type {VegaProjectOptions} from './withVega';

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
   * Amazon platform targets. Fire OS and Vega OS can both be enabled in the
   * same config, but they still produce separate build artifacts.
   */
  amazon?: AmazonPlatformOptions;
};

export type AmazonPlatformOptions = {
  /**
   * Enable Fire OS support for Amazon-distributed Android builds.
   * This selects the Android `amazon` flavor.
   * @platform android
   * @default false
   */
  fireOS?: boolean;
  /**
   * Enable Vega OS project generation for Amazon's Kepler runtime.
   * This prepares Vega metadata and build scripts; it does not select an
   * Android Gradle flavor.
   * @default false
   */
  vegaOS?: boolean;
};

type BaseExpoIapOptions = {
  /**
   * IAPKit project key for managed receipt verification.
   * Get your project key from https://kit.openiap.dev.
   * This will be available via `Constants.expoConfig?.extra?.iapkitApiKey`.
   */
  iapkitApiKey?: string;
  enableLocalDev?: boolean;
  localPath?:
    | string
    | {
        ios?: string;
        android?: string;
      };
  ios?: {
    /**
     * Configure external purchase countries, links, and entitlements.
     * Requires approval from Apple.
     */
    alternativeBilling?: IOSAlternativeBillingConfig;
  };
  android?: {
    /**
     * Horizon OS options for Quest devices.
     * @platform android
     */
    horizon?: {
      /**
       * Horizon OS app ID for Quest devices.
       */
      appId?: string;
    };
    /**
     * Amazon target configuration. Module selection lives under
     * modules.amazon; this object only contains per-target settings.
     */
    amazon?: {
      /**
       * Vega OS project generation overrides used when modules.amazon.vegaOS is true.
       * packageId defaults to android.package, title defaults to expo.name,
       * appName defaults from title, and icon defaults to expo.icon.
       */
      vegaOS?: VegaProjectOptions;
    };
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
  AutoModuleOptions | ExplicitModuleOptions;

declare module '@expo/config-types' {
  interface IOS {
    onside?: {
      enabled?: boolean;
    };
  }
}
