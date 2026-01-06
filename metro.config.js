const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

//! can I remove this? Thinking this was from the included wasm file that i removed
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

// config.transformer.getTransformOptions = async () => ({
//   transform: {
//     experimentalImportSupport: true,
//   },
// });

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

module.exports = config;