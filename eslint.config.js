const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  js.configs.recommended,
  ...compat.extends('plugin:prettier/recommended'),

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'warn',
    },
  },

  {
    ignores: ['node_modules/**', 'dist/**'],
  },
];
