/**
 * Jest previously ran on pure defaults (babel-jest via babel.config.js).
 * The `@/` path alias only resolved for type-only imports (erased at
 * compile); this mapper makes runtime `@/` imports work in tests, mirroring
 * the tsconfig `paths` entries. Order matters: the more specific assets
 * mapping must come before the catch-all.
 */
/** @type {import('jest').Config} */
module.exports = {
  // `__tests__/support/` holds shared harnesses, not suites. The default
  // testMatch treats every file under `__tests__` as a test file, so without
  // this a support module fails the run with "must contain at least one test"
  // — an error that names neither this file nor the rule. Matched anywhere
  // rather than under one directory, so the next support module just works.
  // NB: this replaces jest's default, which is why node_modules is restated.
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/support/'],
  moduleNameMapper: {
    // Static image imports must map to a stub before the alias entries below,
    // or `@/assets/...` resolves to real PNG bytes that jest tries to parse.
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
