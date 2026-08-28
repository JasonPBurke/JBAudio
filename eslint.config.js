// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactCompiler = require('eslint-plugin-react-compiler');

/**
 * The Player-library ban's two rules, below, and the messages they report.
 *
 * Declared once because the second block has to RESTATE the first block's
 * `paths` entry -- see the comment on that block for why -- and a copied string
 * is how the two would drift apart.
 */
const PLAYER_LIBRARY = 'react-native-track-player';
const PLAYER_LIBRARY_MESSAGE =
  'Import from @/player/trackPlayer instead -- the adapter is the only module that may import the Player library.';
/** Matches the adapter by path, so a relative import cannot route around it. */
const ADAPTER_GROUP = ['**/player/trackPlayer'];
const ADAPTER_HOOKS = ['useActiveTrackBookId', 'useIsPlaying'];
const ADAPTER_HOOKS_MESSAGE =
  'Read the mirror in @/store/playerState instead -- components/PlayerStateSync is the one subscriber to the Player library hooks, and a second one silently re-creates the fan-out ticket 09 removed.';

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
    // Stage 2 of the Player-library ban, and the last of it.
    // `src/player/trackPlayer.ts` is the one module allowed to import
    // `react-native-track-player`; everything above it goes through that
    // adapter. Exempted: the adapter, and the test directories where the fake
    // plugs in -- so the rule reads "only the adapter and its tests".
    //
    // The glob is a list because of `index.js`: the app entry, the only
    // production file outside `src/` that imports the library (measured across
    // the tree, not assumed), and the file that registers the headless playback
    // service -- leaving it uncovered would exempt the very cold-start path the
    // Remote control surface depends on.
    //
    // ⚠ THE MIGRATION IS THE THING THAT ENDED HERE, NOT JUST A LINT RULE.
    // Stage 1 (ticket 08) was an `allowImportNames` list, chosen because the
    // permitted names ARE the migration tracker: what was still importable was
    // exactly what was still unmigrated. Ticket 09 took the list from four
    // names to three; ticket 10 took the last three -- `useActiveTrack`,
    // `useIsPlaying` and `isPlaying`, all in `components/PlayerStateSync.tsx`
    // -- onto the adapter, and deleting the empty list is the completion
    // signal. Do not reintroduce an allow list to unblock a file: an exemption
    // here is a file that has not been migrated, and the adapter is where the
    // missing export belongs.
    //
    // Deliberately NARROW, and measured rather than assumed: `eslint` reports
    // 0 errors on the tree as it stands with no permitted names at all. Probed
    // on a throwaway file, because all of these look exempt and are not -- the
    // rule fires on `import TrackPlayer from`, on a bare enum, on `import type`
    // and on `import * as`. ⚠ Unlike stage 1 it reports PER STATEMENT, not per
    // name: `allowImportNames` is what made stage 1 report per name.
    //
    // Probed the same way, three shapes it does NOT see, none an oversight:
    // `require(...)` and the module-name string literal in `jest.mock(...)`,
    // which occur only under the exempted test directories; and a bindingless
    // `import 'react-native-track-player'`, which binds nothing and so cannot
    // reach the library's surface at all.
    //
    // ⚠ THIS BLOCK NOW EXISTS ONLY FOR `components/PlayerStateSync.tsx`. Every
    // other covered file is also matched by the block below, whose rule config
    // REPLACES this one -- flat config does not merge two
    // `no-restricted-imports` settings, the later one wins outright -- and
    // which restates this `paths` entry for exactly that reason. Deleting this
    // block would leave `PlayerStateSync.tsx` free to import the library
    // directly again.
    files: ['src/**', 'index.js'],
    ignores: ['src/player/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: PLAYER_LIBRARY, message: PLAYER_LIBRARY_MESSAGE }],
        },
      ],
    },
  },
  {
    // The one-subscriber rule, and the second half of what ticket 09 bought.
    //
    // Ticket 09 collapsed ELEVEN `useActiveTrack()` subscriptions across twelve
    // files into one, in `components/PlayerStateSync.tsx`, which mirrors the
    // answer into `store/playerState` for everyone else. While stage 1 of the
    // ban stood, that collapse was enforced as a SIDE EFFECT: a twelfth
    // subscription meant importing a name off the allow list, and the list was
    // watched. Emptying the list removed that, and the hooks are now ordinary
    // exports of an ordinary module -- so this block states the rule outright
    // rather than letting it decay into a comment.
    //
    // ⚠ IT MATTERS THAT THIS IS MECHANICAL. A second subscriber lints clean
    // without it, type-checks, and LOOKS correct on a device: a duplicated
    // subscription renders the right thing and merely costs renders. There is
    // no symptom to notice.
    //
    // ⚠ IT RESTATES THE `paths` ENTRY ABOVE, and that is required rather than
    // redundant. Flat config replaces rule options instead of merging them, so
    // for every file this block matches, its `no-restricted-imports` is the
    // only one in effect; omitting `paths` here would silently switch the
    // library ban off across almost all of `src/`. The block above survives for
    // the single file this one ignores.
    //
    // `patterns` rather than `paths` because `paths` matches the literal
    // specifier string: `@/player/trackPlayer` and `../player/trackPlayer` are
    // the same module and only a glob catches both. The app entry reaches the
    // adapter by a RELATIVE import today.
    //
    // Not banned: `subscribe`, and the imperative reads. Event subscriptions
    // are a documented and endorsed pattern here -- `BookTimeRemaining` and
    // `useCurrentChapterStable` each hold their own, and the Reanimated
    // progress hook must -- so only the two REACT HOOKS are listed, which are
    // the ones that fan a render out.
    files: ['src/**', 'index.js'],
    ignores: [
      'src/player/**',
      'src/**/__tests__/**',
      'src/components/PlayerStateSync.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: PLAYER_LIBRARY, message: PLAYER_LIBRARY_MESSAGE }],
          patterns: [
            {
              group: ADAPTER_GROUP,
              importNames: ADAPTER_HOOKS,
              message: ADAPTER_HOOKS_MESSAGE,
            },
          ],
        },
      ],
    },
  },
]);
