// Learn more https://docs.expo.io/guides/customizing-metro
const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Read library version mode from libraries-versions.jsonc
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
let useLocalDev = true;
const versionsPath = path.resolve(__dirname, '../../../libraries-versions.jsonc');
if (fs.existsSync(versionsPath)) {
  const librariesVersions = parseJsonc(fs.readFileSync(versionsPath, 'utf8'));
  useLocalDev = !librariesVersions['expo-iap'] || librariesVersions['expo-iap'] === 'local';
}

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
