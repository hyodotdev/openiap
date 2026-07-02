import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(__dirname, '..');
const packageRoot = path.resolve(exampleRoot, '..');
const tempRoot = path.join(os.tmpdir(), 'openiap-expo-iap-vega-example');
const tempPackageSourceRoot = path.join(tempRoot, 'openiap-expo-iap-src');
const buildType = process.argv[2] === 'Release' ? 'Release' : 'Debug';
const iapkitApiKey = process.env.EXPO_PUBLIC_IAPKIT_API_KEY ?? '';
const iapkitBaseUrl = process.env.EXPO_PUBLIC_IAPKIT_BASE_URL ?? '';
const vegaPackageId = 'dev.hyo.openiap.expo.example';
const vegaComponentId = `${vegaPackageId}.main`;
const vegaAppName = 'ExpoIapVegaExample';
const vegaDisplayName = 'Expo IAP Vega Example';

const writeFile = (relativePath, contents) => {
  const filePath = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, contents, 'utf8');
};

const copyFile = (source, relativeDestination) => {
  const destination = path.join(tempRoot, relativeDestination);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(source, destination);
};

const copyDirectory = (source, relativeDestination) => {
  fs.cpSync(source, path.join(tempRoot, relativeDestination), {
    recursive: true,
  });
};

const writeLocalPackageAlias = (packageName, entryPath) => {
  const aliasRoot = path.join(tempRoot, 'node_modules', packageName);
  const relativeEntry = path
    .relative(aliasRoot, entryPath)
    .replaceAll(path.sep, '/');
  const importPath = relativeEntry.startsWith('.')
    ? relativeEntry
    : `./${relativeEntry}`;

  fs.mkdirSync(aliasRoot, {recursive: true});
  fs.writeFileSync(
    path.join(aliasRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version: '0.0.0-local',
        main: 'index.ts',
        'react-native': 'index.ts',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(aliasRoot, 'index.ts'),
    `export * from ${JSON.stringify(importPath)};\n`,
    'utf8',
  );
};

const writeLocalEntryModule = (relativePath, entryPath) => {
  const localRoot = path.dirname(path.join(tempRoot, relativePath));
  const relativeEntry = path
    .relative(localRoot, entryPath)
    .replaceAll(path.sep, '/');
  const importPath = relativeEntry.startsWith('.')
    ? relativeEntry
    : `./${relativeEntry}`;

  writeFile(relativePath, `export * from ${JSON.stringify(importPath)};\n`);
};

const writeLocalJavaScriptModule = (packageName, source, main = 'index.js') => {
  const moduleRoot = path.join(tempRoot, 'node_modules', packageName);
  fs.mkdirSync(moduleRoot, {recursive: true});
  fs.writeFileSync(
    path.join(moduleRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version: '0.0.0-local',
        main,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(moduleRoot, main), source, 'utf8');
};

const createVegaManifest = () => `schema-version = 1

[package]
id = "${vegaPackageId}"
title = "${vegaDisplayName}"
version = "1.0.0"

[components]
[[components.interactive]]
id = "${vegaComponentId}"
runtime-module = "/com.amazon.kepler.keplerscript.runtime.loader_2@IKeplerScript_2_0"
launch-type = "singleton"
categories = ["com.amazon.category.main"]

[wants]
[[wants.service]]
id = "com.amazon.inputmethod.service"

[[wants.service]]
id = "com.amazon.network.service"

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

const rewriteExpoSourceImports = (source) =>
  source
    .replaceAll("from '../../src/utils/errorMapping'", "from 'expo-iap'")
    .replaceAll('from "../../src/utils/errorMapping"', 'from "expo-iap"')
    .replaceAll("from '../../src/types'", "from 'expo-iap'")
    .replaceAll('from "../../src/types"', 'from "expo-iap"')
    .replaceAll("from '../../src'", "from 'expo-iap'")
    .replaceAll('from "../../src"', 'from "expo-iap"');

const rewritePackageSourceImports = (source, sourcePath) => {
  const relativeSourcePath = path
    .relative(path.join(packageRoot, 'src'), sourcePath)
    .replaceAll(path.sep, '/');

  if (relativeSourcePath === 'useIAP.ts') {
    return source
      .replaceAll("from './index'", "from './index.kepler'")
      .replaceAll('from "./index"', 'from "./index.kepler"')
      .replaceAll("from './modules/ios'", "from './index.kepler'")
      .replaceAll('from "./modules/ios"', 'from "./index.kepler"')
      .replaceAll("from './modules/android'", "from './index.kepler'")
      .replaceAll('from "./modules/android"', 'from "./index.kepler"');
  }

  return source;
};

const copyDirectoryWithTransform = (
  sourceRoot,
  relativeDestination,
  transform,
) => {
  for (const entry of fs.readdirSync(sourceRoot, {withFileTypes: true})) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(relativeDestination, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryWithTransform(sourcePath, destinationPath, transform);
      continue;
    }

    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      writeFile(
        destinationPath,
        transform(fs.readFileSync(sourcePath, 'utf8'), sourcePath),
      );
      continue;
    }

    copyFile(sourcePath, destinationPath);
  }
};

const copyExampleSources = () => {
  copyFile(path.join(exampleRoot, 'App.kepler.tsx'), 'App.tsx');
  copyDirectory(path.join(exampleRoot, 'src'), 'src');
  copyDirectory(path.join(exampleRoot, 'vega-shims'), 'vega-shims');

  if (fs.existsSync(path.join(exampleRoot, 'assets'))) {
    copyDirectory(path.join(exampleRoot, 'assets'), 'assets');
  }

  copyDirectoryWithTransform(
    path.join(exampleRoot, 'app'),
    'app',
    rewriteExpoSourceImports,
  );
};

const writeExampleShims = () => {
  writeLocalJavaScriptModule(
    'expo-router',
    `export * from '../../vega-shims/expo-router';
`,
  );
  writeLocalJavaScriptModule(
    'expo-clipboard',
    `let value = '';

export const setStringAsync = async (nextValue) => {
  value = String(nextValue ?? '');
};

export const getStringAsync = async () => value;
`,
  );
  writeLocalJavaScriptModule(
    'expo-constants',
    `export default {
  expoConfig: {
    extra: {
      iapkitApiKey: ${JSON.stringify(iapkitApiKey)},
      iapkitBaseUrl: ${JSON.stringify(iapkitBaseUrl)},
    },
  },
  manifest: null,
};
`,
  );
  writeLocalJavaScriptModule(
    'expo-modules-core',
    `export class UnavailabilityError extends Error {
  constructor(moduleName, propertyName) {
    super(\`\${moduleName}.\${propertyName} is unavailable\`);
    this.name = 'UnavailabilityError';
  }
}

export class EventEmitter {
  addListener() {
    return {remove() {}};
  }
  removeListener() {}
}

export class EventSubscription {
  remove() {}
}

export const requireNativeModule = (moduleName) => {
  throw new UnavailabilityError(moduleName, 'native module');
};
`,
  );
  writeLocalJavaScriptModule(
    '@expo/react-native-action-sheet',
    `import React, {createContext, useContext} from 'react';
import {ActionSheetIOS, Alert, Platform} from 'react-native';

const ActionSheetContext = createContext({
  showActionSheetWithOptions(options, callback) {
    if (Platform.OS === 'ios' && ActionSheetIOS?.showActionSheetWithOptions) {
      ActionSheetIOS.showActionSheetWithOptions(options, callback);
      return;
    }

    const labels = options?.options ?? [];
    Alert.alert(
      options?.title ?? 'Select option',
      options?.message,
      labels.map((label, index) => ({
        text: String(label),
        onPress: () => callback(index),
      })),
    );
  },
});

export const ActionSheetProvider = ({children}) => (
  <ActionSheetContext.Provider value={useContext(ActionSheetContext)}>
    {children}
  </ActionSheetContext.Provider>
);

export const useActionSheet = () => useContext(ActionSheetContext);
`,
    'index.jsx',
  );
};

const run = (command, args, cwd = tempRoot) => {
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      EXPO_IAP_VEGA: '1',
    },
    stdio: 'inherit',
  });
};

fs.rmSync(tempRoot, {force: true, recursive: true});
fs.mkdirSync(tempRoot, {recursive: true});
copyDirectoryWithTransform(
  path.join(packageRoot, 'src'),
  path.relative(tempRoot, tempPackageSourceRoot),
  rewritePackageSourceImports,
);

writeFile(
  'package.json',
  `${JSON.stringify(
    {
      name: 'expoiapvegaexample',
      version: '0.0.1',
      private: true,
      scripts: {
        'build:vega': `react-native build-vega --build-type ${buildType} --reset-cache`,
      },
      dependencies: {
        '@amazon-devices/keplerscript-appstore-iap-lib': '~2.12.13',
        '@amazon-devices/react-native-kepler': '^2.0.0',
        react: '18.2.0',
        'react-native': '0.72.0',
      },
      devDependencies: {
        '@amazon-devices/kepler-cli-platform': '~0.22.0',
        '@react-native-community/cli': '11.3.2',
        '@react-native/metro-config': '^0.72.6',
        'metro-react-native-babel-preset': '~0.76.9',
        typescript: '4.8.4',
      },
      kepler: {
        projectType: 'application',
        appName: vegaAppName,
        targets: ['tv'],
        os: ['vega'],
      },
    },
    null,
    2,
  )}\n`,
);

writeFile(
  'app.json',
  `${JSON.stringify(
    {
      '//': 'The declared app name must match the Vega component id.',
      name: vegaComponentId,
      displayName: vegaDisplayName,
    },
    null,
    2,
  )}\n`,
);

writeFile(
  'index.js',
  `import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
`,
);

writeFile(
  'babel.config.js',
  `module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};
`,
);

writeFile(
  'metro.config.js',
  `const path = require('path');
const {
  getDefaultConfig,
  mergeConfig,
} = require('@react-native/metro-config');

const packageSourceRoot = ${JSON.stringify(tempPackageSourceRoot)};
const tempNodeModules = path.resolve(__dirname, 'node_modules');

const resolveFromTemp = (moduleName) =>
  require.resolve(moduleName, {paths: [tempNodeModules]});

const vegaConfig = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (
        moduleName === 'react' ||
        moduleName === 'react/jsx-runtime' ||
        moduleName === 'react/jsx-dev-runtime' ||
        moduleName === 'react-native'
      ) {
        return {
          type: 'sourceFile',
          filePath: resolveFromTemp(moduleName),
        };
      }

      if (moduleName === 'expo-iap') {
        return {
          type: 'sourceFile',
          filePath: path.join(packageSourceRoot, 'index.kepler.ts'),
        };
      }

      if (moduleName === 'expo-router') {
        return {
          type: 'sourceFile',
          filePath: path.join(__dirname, 'vega-shims', 'expo-router.tsx'),
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
    disableHierarchicalLookup: true,
    extraNodeModules: new Proxy(
      {},
      {
        get: (_target, moduleName) =>
          path.join(tempNodeModules, String(moduleName)),
      },
    ),
    nodeModulesPaths: [tempNodeModules],
  },
  watchFolders: [packageSourceRoot],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), vegaConfig);
`,
);

copyExampleSources();
writeLocalEntryModule(
  'openiap-expo-iap.ts',
  path.join(tempPackageSourceRoot, 'index.kepler.ts'),
);
writeFile('manifest.toml', createVegaManifest());

run('bun', ['install', '--force']);
writeLocalPackageAlias(
  'expo-iap',
  path.join(tempPackageSourceRoot, 'index.kepler.ts'),
);
writeExampleShims();
run('./node_modules/.bin/react-native', [
  'build-vega',
  '--build-type',
  buildType,
  '--reset-cache',
]);

const outputDir = path.join(
  exampleRoot,
  'build',
  buildType === 'Release' ? 'armv7-release' : 'armv7-debug',
);
fs.rmSync(outputDir, {force: true, recursive: true});
fs.mkdirSync(outputDir, {recursive: true});

const tempOutputDir = path.join(
  tempRoot,
  'build',
  buildType === 'Release' ? 'armv7-release' : 'armv7-debug',
);
for (const fileName of fs.readdirSync(tempOutputDir)) {
  if (fileName.endsWith('.vpkg')) {
    fs.copyFileSync(
      path.join(tempOutputDir, fileName),
      path.join(outputDir, fileName),
    );
  }
}

console.log(`Vega ${buildType} build copied to ${outputDir}`);
