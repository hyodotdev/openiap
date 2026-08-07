const {
  IOSConfig,
  WarningAggregator,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_DELEGATE_SCENE_CONFIGURATION = `  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }

`;

const LEGACY_WINDOW_BOOTSTRAP =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const EXPO_SCENE_DELEGATE_SOURCE = `internal import Expo
import React

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let factory = appDelegate?.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate?.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions(from: connectionOptions)
    )
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace,
      ]
      if let sourceApplication = context.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate?.application(
        UIApplication.shared,
        open: context.url,
        options: options
      )
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  private func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options: [UIApplication.LaunchOptionsKey: Any] = [:]

    if let context = connectionOptions.urlContexts.first {
      options[.url] = context.url
      if let sourceApplication = context.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
    }

    if let userActivity = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue:
          userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }

    return options.isEmpty ? nil : options
  }
}
`;

const applyIos27SceneInfoPlist = (plist) => {
  const existingConfigurations =
    plist.UIApplicationSceneManifest?.UISceneConfigurations
      ?.UIWindowSceneSessionRoleApplication;
  if (
    Array.isArray(existingConfigurations) &&
    existingConfigurations.length > 0
  ) {
    return plist;
  }

  plist.UIApplicationSceneManifest = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        },
      ],
    },
  };
  return plist;
};

const migrateExpoAppDelegateToSceneLifecycle = (contents) => {
  if (
    contents.includes('configurationForConnecting connectingSceneSession') &&
    !LEGACY_WINDOW_BOOTSTRAP.test(contents)
  ) {
    return contents;
  }

  if (!LEGACY_WINDOW_BOOTSTRAP.test(contents)) {
    throw new Error(
      'Could not find the Expo SDK 54 window bootstrap in AppDelegate.swift. ' +
        'Upgrade the example scene-lifecycle plugin before building with Xcode 27.',
    );
  }

  const withoutWindowBootstrap = contents.replace(
    LEGACY_WINDOW_BOOTSTRAP,
    '    // SceneDelegate creates the window and starts React Native.\n',
  );
  const linkingMarker = '  // Linking API\n';
  if (!withoutWindowBootstrap.includes(linkingMarker)) {
    throw new Error(
      'Could not find the AppDelegate linking marker needed for UIScene migration.',
    );
  }

  return withoutWindowBootstrap.replace(
    linkingMarker,
    `${APP_DELEGATE_SCENE_CONFIGURATION}${linkingMarker}`,
  );
};

const resolveSceneDelegateContents = (existingContents) => {
  if (!existingContents) {
    return `${EXPO_SCENE_DELEGATE_SOURCE.trim()}\n`;
  }
  if (
    existingContents.includes('ExpoAppSceneDelegate') ||
    existingContents.trim() === EXPO_SCENE_DELEGATE_SOURCE.trim()
  ) {
    return existingContents;
  }
  throw new Error(
    'SceneDelegate.swift already exists with an unsupported custom implementation. ' +
      'Migrate it manually instead of letting the Xcode 27 example plugin overwrite it.',
  );
};

const withIos27SceneLifecycle = (config) => {
  config = withInfoPlist(config, (cfg) => {
    applyIos27SceneInfoPlist(cfg.modResults);
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      WarningAggregator.addWarningIOS(
        'expo-iap-example',
        'Xcode 27 scene migration requires a Swift AppDelegate.',
      );
      return cfg;
    }
    cfg.modResults.contents = migrateExpoAppDelegateToSceneLifecycle(
      cfg.modResults.contents,
    );
    return cfg;
  });

  return withXcodeProject(config, (cfg) => {
    const sourceRoot = IOSConfig.Paths.getSourceRoot(
      cfg.modRequest.projectRoot,
    );
    const projectName = path.basename(sourceRoot);
    const sceneDelegatePath = path.join(sourceRoot, 'SceneDelegate.swift');
    const existingSceneDelegate = fs.existsSync(sceneDelegatePath)
      ? fs.readFileSync(sceneDelegatePath, 'utf8')
      : '';
    const resolvedSceneDelegate = resolveSceneDelegateContents(
      existingSceneDelegate,
    );
    if (!existingSceneDelegate) {
      fs.writeFileSync(sceneDelegatePath, resolvedSceneDelegate, 'utf8');
    }

    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/SceneDelegate.swift`,
      groupName: projectName,
      project: cfg.modResults,
    });
    return cfg;
  });
};

module.exports = withIos27SceneLifecycle;
module.exports.default = withIos27SceneLifecycle;
module.exports.applyIos27SceneInfoPlist = applyIos27SceneInfoPlist;
module.exports.EXPO_SCENE_DELEGATE_SOURCE = EXPO_SCENE_DELEGATE_SOURCE;
module.exports.migrateExpoAppDelegateToSceneLifecycle =
  migrateExpoAppDelegateToSceneLifecycle;
module.exports.resolveSceneDelegateContents = resolveSceneDelegateContents;
