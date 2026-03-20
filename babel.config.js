module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['babel-plugin-react-compiler'],
      ['react-native-boost/plugin'],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['react-native-worklets/plugin'],
    ],
  };
};
