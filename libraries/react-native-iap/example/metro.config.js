const path = require('path');
const fs = require('fs');
const {getDefaultConfig} = require('@react-native/metro-config');

// Read library version mode from libraries-versions.jsonc
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
let useLocalDev = true;
try {
  const librariesVersions = parseJsonc(
    fs.readFileSync(
      path.resolve(__dirname, '../../../libraries-versions.jsonc'),
      'utf8',
    ),
  );
  useLocalDev = !librariesVersions['react-native-iap'] || librariesVersions['react-native-iap'] === 'local';
} catch {
  // File missing or malformed — default to local dev mode
}

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
module.exports = (async () => {
  if (useLocalDev) {
    const root = path.resolve(__dirname, '..');
    const {withMetroConfig} = await import('react-native-monorepo-config');

    return withMetroConfig(getDefaultConfig(__dirname), {
      root,
      dirname: __dirname,
    });
  }

  return getDefaultConfig(__dirname);
})();
