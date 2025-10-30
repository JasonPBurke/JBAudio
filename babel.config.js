module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['react-native-worklets/plugin'],
      // ['react-native-reanimated/plugin'],
      ['babel-plugin-react-compiler'],
    ],
  };
};
