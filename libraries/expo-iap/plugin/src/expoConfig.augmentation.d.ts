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
   * @deprecated A debug build follows the connected Quest. Pin EAS and release
   * builds with `ORG_GRADLE_PROJECT_openiapStore=horizon` in the profile's `env`.
   * Still pins, with a warning.
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
   * @deprecated A debug build follows the connected Fire device. Pin EAS and
   * release builds with `ORG_GRADLE_PROJECT_openiapStore=amazon` in the
   * profile's `env`. Still pins, with a warning.
   * @platform android
   */
  fireOS?: boolean;
  /**
   * Vega OS project generation for Amazon's Kepler runtime. Unset means
   * auto-detect: a root manifest.toml turns generation on. Set explicitly
   * to force it on or off.
   * This prepares Vega metadata and build scripts; it does not select an
   * Android Gradle flavor.
   * @default auto-detect
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
       * Path to the Amazon Appstore public key (`AppstoreAuthenticationKey.pem`),
       * relative to the project root. Copied into the app's assets on every
       * prebuild; Fire OS needs it to verify receipts.
       */
      appstoreKey?: string;
      /**
       * Vega OS project generation overrides, used when generation is enabled
       * (auto-detected or explicit). packageId defaults to android.package,
       * title defaults to expo.name, appName defaults from title, and icon
       * defaults to expo.icon.
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
