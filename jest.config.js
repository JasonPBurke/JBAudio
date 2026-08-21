/**
 * Two projects, deliberately.
 *
 * `helpers` is the original config: pure TypeScript, node environment, no
 * preset, no transform of `node_modules`. It runs ~890 tests in about two
 * seconds and that speed is an asset -- it is why the pure decision units in
 * `src/helpers/` are worth extracting in the first place.
 *
 * `rn` adds React Native and Expo via `jest-expo`, which replaces the
 * environment, the transform, `transformIgnorePatterns` and the module mapper
 * wholesale. Running everything under that preset would slow the fast lane down
 * and couple a suite that has nothing to do with React to a preset upgrade.
 * Splitting them keeps each failure mode in its own lane.
 *
 * A test opts INTO the RN lane by being named `*.rn.test.tsx`. The suffix is
 * explicit and greppable; the alternative -- inferring from the `.tsx`
 * extension -- would silently move a pure test the day someone added JSX to it.
 */

/** Mirrors the tsconfig `paths` entries so runtime `@/` imports resolve. */
const aliases = {
  // Static image imports must map to a stub before the alias entries below,
  // or `@/assets/...` resolves to real PNG bytes that jest tries to parse.
  '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
  '^@/assets/(.*)$': '<rootDir>/assets/$1',
  '^@/(.*)$': '<rootDir>/src/$1',
};

/** Matches the RN lane's opt-in suffix, in the one place both projects read it. */
const RN_TEST_PATTERN = '\\.rn\\.test\\.[jt]sx?$';

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'helpers',
      // `__tests__/support/` holds shared harnesses, not suites. The default
      // testMatch treats every file under `__tests__` as a test file, so
      // without this a support module fails the run with "must contain at
      // least one test" -- an error that names neither this file nor the rule.
      // Matched anywhere rather than under one directory, so the next support
      // module just works.
      // NB: this replaces jest's default, which is why node_modules is
      // restated. The third entry hands every `*.rn.test.tsx` to the other
      // project instead of failing here on the first `react-native` import.
      testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/support/',
        RN_TEST_PATTERN,
      ],
      moduleNameMapper: aliases,
    },
    {
      displayName: 'rn',
      // The Android preset rather than `jest-expo/universal`: this app ships
      // Android only, and the universal preset runs every suite once per
      // platform.
      preset: 'jest-expo/android',
      testMatch: [`**/__tests__/**/*.rn.test.[jt]s?(x)`],
      // The preset supplies its own mapper (Expo module resolution); spreading
      // ours after it adds the `@/` aliases without dropping that.
      moduleNameMapper: {
        ...require('jest-expo/jest-preset').moduleNameMapper,
        ...aliases,
      },
      setupFilesAfterEnv: ['<rootDir>/jest.rn-setup.js'],
    },
  ],
};
