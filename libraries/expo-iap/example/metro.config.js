// Learn more https://docs.expo.io/guides/customizing-metro
const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const isVega = process.env.EXPO_IAP_VEGA === '1';

// Read library version mode from libraries-versions.jsonc
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
let useLocalDev = true;
const versionsPath = path.resolve(
  __dirname,
  '../../../libraries-versions.jsonc',
);
if (fs.existsSync(versionsPath)) {
  const librariesVersions = parseJsonc(fs.readFileSync(versionsPath, 'utf8'));
  useLocalDev =
    !librariesVersions['expo-iap'] || librariesVersions['expo-iap'] === 'local';
}

if (isVega) {
  const {
    getDefaultConfig: getReactNativeDefaultConfig,
    mergeConfig,
  } = require('@react-native/metro-config');
  const {
    getKeplerCompatibilityMetroConfig,
  } = require('@amazon-devices/kepler-compatibility-metro-config');

  const keplerReactNativeRoot = path.resolve(
    __dirname,
    'node_modules',
    '@amazon-devices',
    'react-native-kepler',
  );
  const expoIapRoot = path.resolve(__dirname, '..');
  const resolveKeplerReactNativeFile = (moduleName) => {
    const relativePath =
      moduleName === 'react-native'
        ? 'index.js'
        : moduleName.replace(/^react-native\//, '');
    const basePath = path.join(keplerReactNativeRoot, relativePath);
    const candidates = [
      basePath,
      `${basePath}.js`,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.json`,
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? basePath;
  };

  const vegaConfig = {
    resolver: {
      resolveRequest: (context, moduleName, platform) => {
        if (moduleName === 'react-native') {
          return {
            type: 'sourceFile',
            filePath: resolveKeplerReactNativeFile(moduleName),
          };
        }

        if (moduleName.startsWith('react-native/')) {
          return {
            type: 'sourceFile',
            filePath: resolveKeplerReactNativeFile(moduleName),
          };
        }

        return context.resolveRequest(context, moduleName, platform);
      },
      extraNodeModules: {
        'expo-iap': expoIapRoot,
        'react-native': path.join(keplerReactNativeRoot, 'index.js'),
      },
      nodeModulesPaths: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(expoIapRoot, 'node_modules'),
      ],
    },
    watchFolders: [expoIapRoot, keplerReactNativeRoot],
  };

  module.exports = mergeConfig(
    getReactNativeDefaultConfig(__dirname),
    getKeplerCompatibilityMetroConfig(),
    vegaConfig,
  );
} else {
  const config = getDefaultConfig(__dirname);

  // Exclude test files from bundling
  config.resolver.blockList = [
    ...Array.from(config.resolver.blockList ?? []),
    /.*\/__tests__\/.*/,
    /.*\.test\.(js|jsx|ts|tsx)$/,
    /.*\.spec\.(js|jsx|ts|tsx)$/,
  ];

  if (useLocalDev) {
    // Local development: resolve expo-iap from parent directory source
    config.resolver.blockList.push(
      new RegExp(path.resolve(__dirname, '..', 'node_modules', 'react')),
      new RegExp(path.resolve(__dirname, '..', 'node_modules', 'react-native')),
    );

    config.resolver.nodeModulesPaths = [
      path.resolve(__dirname, './node_modules'),
      path.resolve(__dirname, '../node_modules'),
    ];

    config.resolver.extraNodeModules = {
      'expo-iap': path.resolve(__dirname, '..'),
    };

    config.watchFolders = [path.resolve(__dirname, '..')];
  }

  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  });

  module.exports = config;
}
