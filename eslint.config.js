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
]);
