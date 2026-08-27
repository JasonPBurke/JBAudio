// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactCompiler = require('eslint-plugin-react-compiler');

module.exports = defineConfig([
  expoConfig,
  reactCompiler.configs.recommended,
  {
    ignores: ['dist/*'],
  },
  {
    // `jest.rn-setup.js` is CommonJS run by the test runner, not app code, and
    // its `jest.mock(...)` calls need the one global the app config does not
    // define.
    //
    // Deliberately NARROW, and measured rather than assumed: deleting this
    // block entirely produces `'jest' is not defined` in this file and nothing
    // else. `require` and `module` are already globals here, and
    // `jest.config.js` needs no entry at all -- both were in this block and
    // both were inert. Re-measure before widening it again.
    files: ['jest.rn-setup.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
  {
    // `scripts/` holds build-time Node CLIs, not app code. Measured the same way
    // as the block above: deleting this entry produces `'__dirname' is not
    // defined` and nothing else -- `require`, `module` and `console` are already
    // globals here. Re-measure before widening it.
    files: ['scripts/**'],
    languageOptions: {
      globals: { __dirname: 'readonly' },
    },
  },
  {
    // Stage 1 of the Player-library ban. `src/player/trackPlayer.ts` is the one
    // module allowed to import `react-native-track-player`; everything above it
    // goes through that adapter. Exempted: the adapter, and the test
    // directories where the fake plugs in -- so the rule reads "only the
    // adapter and its tests".
    //
    // The glob is a list because of `index.js`: the app entry, the only
    // production file outside `src/` that imports the library (measured across
    // the tree, not assumed), and the file that registers the headless playback
    // service -- leaving it uncovered would exempt the very cold-start path the
    // Remote control surface depends on.
    //
    // An allow list rather than a ban list, because the permitted names ARE the
    // migration tracker: what is still importable is exactly what is still
    // unmigrated, and the list empties when the reactive surface moves onto the
    // store mirror. Three React hooks are that surface; `isPlaying` is the one
    // imperative read the adapter pass left behind, for the same later ticket.
    // Everything omitted is reachable through the adapter instead -- the enums
    // and types it re-exports, the default export it replaces with wrappers.
    //
    // Deliberately NARROW, and measured rather than assumed: with these four
    // names, `eslint` reports 0 errors on the tree as it stands. Probed on a
    // throwaway file, because all four of these look exempt and are not -- the
    // rule fires on `import TrackPlayer from`, on a bare enum, on `import type`
    // and on `import * as`, and per-name rather than per-statement.
    //
    // Probed the same way, three shapes it does NOT see, none an oversight:
    // `require(...)` and the module-name string literal in `jest.mock(...)`,
    // which occur only under the exempted test directories; and a bindingless
    // `import 'react-native-track-player'`, which binds nothing and so cannot
    // reach the library's surface at all.
    files: ['src/**', 'index.js'],
    ignores: ['src/player/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-track-player',
              allowImportNames: [
                'useActiveTrack',
                'useIsPlaying',
                'useTrackPlayerEvents',
                'isPlaying',
              ],
              message:
                'Import from @/player/trackPlayer instead -- the adapter is the only module that may import the Player library.',
            },
          ],
        },
      ],
    },
  },
]);
