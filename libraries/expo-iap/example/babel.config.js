// The Vega target is recognized by its manifest.toml; EXPO_IAP_VEGA stays as
// an explicit override.
function isVegaTarget() {
  const fs = require('fs');
  const path = require('path');
  try {
    return fs.existsSync(path.join(__dirname, 'manifest.toml'));
  } catch {
    return false;
  }
}

module.exports = function (api) {
  const isVega = process.env.EXPO_IAP_VEGA === '1' || isVegaTarget();
  api.cache.using(() => (isVega ? 'vega' : 'expo'));

  if (isVega) {
    const path = require('path');

    return {
      presets: [
        ['module:@react-native/babel-preset'],
        'module:@amazon-devices/kepler-module-resolver-preset',
      ],
      plugins: [
        [
          'module-resolver',
          {
            alias: {
              '^react-native$': path.resolve(
                __dirname,
                'node_modules',
                '@amazon-devices',
                'react-native-kepler',
                'index',
              ),
              '^react-native/(.+)': path.resolve(
                __dirname,
                'node_modules',
                '@amazon-devices',
                'react-native-kepler',
                '\\1',
              ),
            },
          },
        ],
      ],
    };
  }

  return {
    presets: ['babel-preset-expo'],
  };
};
