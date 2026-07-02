import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(__dirname, '..');
const packageRoot = path.resolve(exampleRoot, '..');
const tempRoot = path.join(os.tmpdir(), 'openiap-rn-iap-vega-example');
const tempPackageSourceRoot = path.join(
  tempRoot,
  'openiap-react-native-iap-src',
);
const buildType = process.argv[2] === 'Release' ? 'Release' : 'Debug';
const iapkitApiKey = process.env.IAPKIT_API_KEY ?? '';
const iapkitBaseUrl = process.env.IAPKIT_BASE_URL ?? '';

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

const writeLocalJavaScriptModule = (packageName, source) => {
  const moduleRoot = path.join(tempRoot, 'node_modules', packageName);
  fs.mkdirSync(moduleRoot, {recursive: true});
  fs.writeFileSync(
    path.join(moduleRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version: '0.0.0-local',
        main: 'index.js',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(moduleRoot, 'index.js'), source, 'utf8');
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

const rewritePackageSourceImports = (source, sourcePath) => {
  const relativeSourcePath = path
    .relative(path.join(packageRoot, 'src'), sourcePath)
    .replaceAll(path.sep, '/');

  if (relativeSourcePath === 'hooks/useIAP.ts') {
    return source
      .replaceAll("from '../'", "from '../index.kepler'")
      .replaceAll('from "../"', 'from "../index.kepler"');
  }

  return source;
};

const copyExampleSources = () => {
  copyFile(path.join(exampleRoot, 'App.kepler.tsx'), 'App.tsx');
  copyDirectory(path.join(exampleRoot, 'screens'), 'screens');
  copyDirectory(path.join(exampleRoot, 'src'), 'src');
};

const writeExampleShims = () => {
  writeLocalJavaScriptModule(
    '@env',
    `export const IAPKIT_API_KEY = ${JSON.stringify(iapkitApiKey)};
export const IAPKIT_BASE_URL = ${JSON.stringify(iapkitBaseUrl)};
`,
  );
  writeLocalJavaScriptModule(
    '@react-native-clipboard/clipboard',
    `let value = '';

export const setString = (nextValue) => {
  value = String(nextValue ?? '');
};

export const getString = async () => value;

export default {
  setString,
  getString,
};
`,
  );
};

const run = (command, args, cwd = tempRoot) => {
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      RN_IAP_DEV_MODE: 'true',
      RN_IAP_VEGA: '1',
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
      name: 'rniapvegaexample',
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
        appName: 'RNIapVegaExample',
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
      name: 'dev.hyo.openiap.rniap.example.main',
      displayName: 'React Native IAP Vega Example',
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

      if (moduleName === 'react-native-iap') {
        return {
          type: 'sourceFile',
          filePath: path.join(packageSourceRoot, 'index.kepler.ts'),
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
  'openiap-react-native-iap.ts',
  path.join(tempPackageSourceRoot, 'index.kepler.ts'),
);
copyFile(path.join(exampleRoot, 'manifest.toml'), 'manifest.toml');

run('bun', ['install', '--force']);
writeLocalPackageAlias(
  'react-native-iap',
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
