// Metro configuration for Expo + React Native
// Ensures .wasm files are treated as assets so they can be bundled and loaded at runtime
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];


module.exports = config;
