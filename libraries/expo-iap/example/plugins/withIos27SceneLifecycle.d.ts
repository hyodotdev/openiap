import type {ConfigPlugin} from 'expo/config-plugins';

export type SceneInfoPlist = {
  UIApplicationSceneManifest?: {
    UIApplicationSupportsMultipleScenes?: boolean;
    UISceneConfigurations?: Record<
      string,
      {
        UISceneConfigurationName?: string;
        UISceneDelegateClassName?: string;
      }[]
    >;
  };
};

export declare const EXPO_SCENE_DELEGATE_SOURCE: string;

export declare const applyIos27SceneInfoPlist: <T extends SceneInfoPlist>(
  plist: T,
) => T;

export declare const migrateExpoAppDelegateToSceneLifecycle: (
  contents: string,
) => string;

export declare const resolveSceneDelegateContents: (
  existingContents: string,
) => string;

declare const withIos27SceneLifecycle: ConfigPlugin;
export default withIos27SceneLifecycle;
