module.exports = function (api) {
  const isVega = process.env.EXPO_IAP_VEGA === '1';
  api.cache.using(() => (isVega ? 'vega' : 'expo'));

  if (isVega) {
    const path = require('path');

    return {
      presets: [
        ['module:metro-react-native-babel-preset'],
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
