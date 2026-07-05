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
   * @deprecated Use android.horizon.appId instead
   */
  horizonAppId?: string;
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
     * Horizon OS app ID for Quest devices
     * @platform android
     * @deprecated Use android.horizon.appId instead
     */
    horizonAppId?: string;
    /**
     * Amazon Android and Vega-specific project overrides.
     */
    amazon?: {
      /**
       * Enable Fire OS support for Amazon-distributed Android builds.
       * @deprecated Use modules.amazon.fireOS instead.
       */
      fireOS?: boolean;
      /**
       * Enable Vega OS project generation for Amazon's Kepler runtime.
       * @deprecated Use modules.amazon.vegaOS instead.
       */
      vegaOS?: boolean;
      /**
       * Vega project generation overrides used when modules.amazon.vegaOS is true.
       * packageId defaults to android.package, title defaults to expo.name,
       * appName defaults from title, and icon defaults to expo.icon.
       */
      vega?: VegaProjectOptions;
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
