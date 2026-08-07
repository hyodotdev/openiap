import {
  applyIos27SceneInfoPlist,
  EXPO_SCENE_DELEGATE_SOURCE,
  migrateExpoAppDelegateToSceneLifecycle,
  resolveSceneDelegateContents,
} from '../plugins/withIos27SceneLifecycle';
import type {SceneInfoPlist} from '../plugins/withIos27SceneLifecycle';

const legacyAppDelegate = `import Expo

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let factory = ExpoReactNativeFactory(delegate: delegate)
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return true
  }

  // Linking API
}
`;

describe('Xcode 27 scene lifecycle', () => {
  it('replaces the legacy app-owned window bootstrap', () => {
    const result = migrateExpoAppDelegateToSceneLifecycle(legacyAppDelegate);

    expect(result).toContain(
      'configurationForConnecting connectingSceneSession',
    );
    expect(result).toContain(
      'configuration.delegateClass = SceneDelegate.self',
    );
    expect(result).not.toContain('UIWindow(frame: UIScreen.main.bounds)');
    expect(result).not.toContain('factory.startReactNative(');
  });

  it('is idempotent after migration', () => {
    const migrated = migrateExpoAppDelegateToSceneLifecycle(legacyAppDelegate);

    expect(migrateExpoAppDelegateToSceneLifecycle(migrated)).toBe(migrated);
  });

  it('fails closed when the Expo template changes unexpectedly', () => {
    expect(() =>
      migrateExpoAppDelegateToSceneLifecycle(
        'public class AppDelegate: ExpoAppDelegate {}',
      ),
    ).toThrow('Could not find the Expo SDK 54 window bootstrap');
  });

  it('writes a single-scene configuration', () => {
    const plist = applyIos27SceneInfoPlist({} as SceneInfoPlist);

    expect(plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    });
  });

  it('preserves an existing non-empty scene configuration', () => {
    const existing = {
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: true,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Expo Configuration',
              UISceneDelegateClassName:
                '$(PRODUCT_MODULE_NAME).ExpoSceneDelegate',
            },
          ],
        },
      },
    };

    expect(applyIos27SceneInfoPlist(existing)).toBe(existing);
    expect(existing.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Expo Configuration',
            UISceneDelegateClassName:
              '$(PRODUCT_MODULE_NAME).ExpoSceneDelegate',
          },
        ],
      },
    });
  });

  it('starts React Native from a UIWindowScene and forwards Expo lifecycle events', () => {
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      'UIWindow(windowScene: windowScene)',
    );
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      'appDelegate?.window = window',
    );
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      'appDelegate?.applicationDidBecomeActive',
    );
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      'appDelegate?.applicationDidEnterBackground',
    );
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      'connectionOptions.userActivities.first',
    );
    expect(EXPO_SCENE_DELEGATE_SOURCE).toContain(
      '"UIApplicationLaunchOptionsUserActivityKey": userActivity',
    );
  });

  it('preserves supported scene delegates and rejects unexpected custom files', () => {
    const officialSceneDelegate =
      'class SceneDelegate: ExpoAppSceneDelegate {}';

    expect(resolveSceneDelegateContents(officialSceneDelegate)).toBe(
      officialSceneDelegate,
    );
    expect(resolveSceneDelegateContents(EXPO_SCENE_DELEGATE_SOURCE)).toBe(
      EXPO_SCENE_DELEGATE_SOURCE,
    );
    expect(resolveSceneDelegateContents('')).toContain(
      'class SceneDelegate: UIResponder, UIWindowSceneDelegate',
    );
    expect(resolveSceneDelegateContents('')).toContain('internal import Expo');
    expect(() =>
      resolveSceneDelegateContents(
        'class SceneDelegate: UIResponder, UIWindowSceneDelegate {}',
      ),
    ).toThrow('unsupported custom implementation');
  });
});
