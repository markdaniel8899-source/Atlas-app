// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // RN's Animated API stores its values in refs; the React Compiler
      // flavour of this rule flags the documented React Native pattern.
      'react-hooks/refs': 'off',
      // Mount/unmount animation state machines legitimately sync state in
      // effects before/after driving Animated values.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
