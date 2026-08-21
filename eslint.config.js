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
    // Jest's own config and setup files are CommonJS run by the test runner,
    // not app code: they legitimately use `require` and the jest globals, and
    // the TypeScript rules the app config assumes are not loaded for them.
    files: ['jest.config.js', 'jest.rn-setup.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
]);
