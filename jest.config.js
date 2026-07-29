/**
 * Jest previously ran on pure defaults (babel-jest via babel.config.js).
 * The `@/` path alias only resolved for type-only imports (erased at
 * compile); this mapper makes runtime `@/` imports work in tests, mirroring
 * the tsconfig `paths` entries. Order matters: the more specific assets
 * mapping must come before the catch-all.
 */
/** @type {import('jest').Config} */
module.exports = {
  moduleNameMapper: {
    // Static image imports must map to a stub before the alias entries below,
    // or `@/assets/...` resolves to real PNG bytes that jest tries to parse.
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
