const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getSentryExpoConfig(__dirname);

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

// `@expo-google-fonts/material-symbols`' barrel eagerly requires all seven font
// weights (~6.4 MB) into res/raw for a feature this app never renders. The alias
// below swaps it for a trimmed re-export that keeps only the weight expo-symbols
// actually selects. Full reasoning in `shims/materialSymbols.js`.
const resolverAliases = {
  '@expo-google-fonts/material-symbols': path.join(
    __dirname,
    'shims/materialSymbols.js',
  ),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const alias = resolverAliases[moduleName];

  if (alias) {
    return { type: 'sourceFile', filePath: alias };
  }

  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
