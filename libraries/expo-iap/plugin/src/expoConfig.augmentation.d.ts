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
   * @deprecated Leave it out: a local debug build follows the connected Quest.
   * Pin every EAS or release build that must target Horizon with
   * `ORG_GRADLE_PROJECT_openiapStore=horizon` in the build profile's `env`.
   * Still honored as a pin, with a warning.
   * @platform android
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
   * @deprecated Leave it out: a local debug build follows the connected Fire
   * device. Pin every EAS or release build that must target Fire OS with
   * `ORG_GRADLE_PROJECT_openiapStore=amazon` in the build profile's `env`.
   * Still honored as a pin, with a warning.
   * @platform android
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
       * Path, relative to the project root, of the Amazon Appstore public key
       * (`AppstoreAuthenticationKey.pem`) downloaded from the Amazon Developer
       * Console. Copied into `android/app/src/main/assets` on every prebuild;
       * Fire OS builds cannot verify receipts without it, other stores ignore it.
       */
      appstoreKey?: string;
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
  | AutoModuleOptions
  | ExplicitModuleOptions;

declare module '@expo/config-types' {
  interface IOS {
    onside?: {
      enabled?: boolean;
    };
  }
}
