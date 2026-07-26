import {loadProjectEnv} from '@expo/env';

export const loadVegaBuildEnvironment = ({
  buildType,
  projectRoot,
  systemEnv = process.env,
}) => {
  loadProjectEnv(projectRoot, {
    force: true,
    mode: buildType === 'Release' ? 'production' : 'development',
    silent: true,
    systemEnv,
  });

  return {
    iapkitApiKey: systemEnv.EXPO_PUBLIC_IAPKIT_API_KEY ?? '',
    iapkitBaseUrl: systemEnv.EXPO_PUBLIC_IAPKIT_BASE_URL ?? '',
  };
};

export const createVegaManifest = ({
  componentId,
  displayName,
  packageId,
}) => `schema-version = 1

[package]
id = "${packageId}"
title = "${displayName}"
version = "1.0.0"

[components]
[[components.interactive]]
id = "${componentId}"
runtime-module = "/com.amazon.kepler.keplerscript.runtime.loader_2@IKeplerScript_2_0"
launch-type = "singleton"
categories = ["com.amazon.category.main"]

[wants]
[[wants.service]]
id = "com.amazon.inputmethod.service"

[[wants.service]]
id = "com.amazon.network.service"

[[wants.service]]
id = "com.amazon.audio.system"

[[wants.service]]
id = "com.amazon.audio.control"

[[wants.service]]
id = "com.amazon.iap.core.service"

[[wants.service]]
id = "com.amazon.iap.tester.service"

[[wants.module]]
id = "/com.amazon.iap.core@IIAPCoreUI"

[[wants.module]]
id = "/com.amazonappstore.iap.tester@IIAPTesterUI"

[needs]
[[needs.module]]
id = "/com.amazon.kepler.appstore.iap.purchase.core@IAppstoreIAPPurchaseCoreService"
`;
