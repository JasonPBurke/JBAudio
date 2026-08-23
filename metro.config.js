const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getSentryExpoConfig(__dirname);

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

// Metro does not tree-shake, so a package's barrel costs its full weight even
// when the app imports a single symbol from it. Each alias below swaps a barrel
// for a trimmed re-export:
//
//   material-symbols   its barrel eagerly requires all seven font weights
//                      (~6.4 MB) into res/raw, for a feature this app never
//                      renders. See `shims/materialSymbols.js`.
//   lucide-react-native  its barrel re-exports ~1,600 icons (1.3 MB, 16.2% of
//                      the bundle) for the 67 this app imports. The shim is
//                      GENERATED — see `scripts/generateLucideShim.js`.
const resolverAliases = {
  '@expo-google-fonts/material-symbols': path.join(
    __dirname,
    'shims/materialSymbols.js',
  ),
  'lucide-react-native': path.join(__dirname, 'shims/lucideIcons.js'),
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
